import {saveRegistrationIdentity} from '../documents/save-registration-identity.js';
import {randomUUID} from 'node:crypto';
import {autoAttachClientIdentity} from '../documents/auto-attach-identity.js';
import type {PrismaClient,EvidenceAsset} from '@prisma/client';
import {uploadInitSchema,evidenceAttachSchema,evidenceDeleteSchema,evidenceVerifySchema,maxEvidenceBytes,movistarDeclarationCategory} from '../../shared/evidence.js';
import {idSchema} from '../../shared/validation.js';
import type {AuthState} from '../auth/middleware.js';
import {writeAudit,type AuditContext} from '../lib/audit.js';
import {DomainError} from '../lib/errors.js';
import {createEvidenceStorage} from '../storage/s3.js';
import type {EvidenceStorageProvider} from '../storage/provider.js';
import {receiptPdfImage} from '../documents/registration-receipt-pdf.js';
import {validateMovistarDeclaration} from '../documents/movistar-declaration.js';
import {checksum,prepareEvidenceImage} from './image.js';
import {lockAsset,assertPrepared,cleanupEvidence} from './lifecycle.js';

export function createEvidenceService(db:PrismaClient,state:AuthState,actor:AuditContext,provider?:EvidenceStorageProvider){
 let resolved=provider;
 const storage=()=>resolved??=createEvidenceStorage();
 const permission=(...keys:typeof state.user.permissions[number][])=>{if(keys.some(k=>!state.user.permissions.includes(k)))throw new DomainError(403,'NO TIENES PERMISOS PARA ESTA EVIDENCIA.','PERMISSION_REQUIRED');};
 const prepared=(a:EvidenceAsset)=>({assetId:a.id,category:a.category,fileSize:a.fileSize,width:a.width,height:a.height});
 async function request(id:string){const found=await db.registrationRequest.findUnique({where:{id}});if(!found)throw new DomainError(404,'SOLICITUD NO ENCONTRADA.','REQUEST_NOT_FOUND');return found;}
 function owned(a:EvidenceAsset|null){if(!a||a.createdById!==state.user.id||a.ownerSessionId!==state.sessionId)throw new DomainError(404,'CARGA NO ENCONTRADA EN ESTA SESIÓN.','EVIDENCE_UPLOAD_NOT_FOUND');return a;}
 return {
  syncClientIdentity:async(id:unknown)=>{
   permission('registration.read','registration.update','registration.evidence.read','registration.evidence.upload','client.documents.read');
   const key=idSchema.parse(id);
   return db.$transaction(tx=>autoAttachClientIdentity(tx,key,actor),{timeout:20000});
  },
  init:async(raw:unknown)=>{
   permission('registration.evidence.upload');const input=uploadInitSchema.parse(raw);
   permission(input.requestId?'registration.update':'registration.create');if(input.requestId)await request(input.requestId);
   const declaration=input.category===movistarDeclarationCategory;
   if(!declaration&&input.fileSize>Math.min(maxEvidenceBytes,Number(process.env.MAX_EVIDENCE_FILE_SIZE)||maxEvidenceBytes))throw new DomainError(400,'IMAGEN DEMASIADO GRANDE.','EVIDENCE_SIZE_INVALID');
   const existing=await db.evidenceAsset.findUnique({where:{idempotencyKey:input.idempotencyKey}});
   if(existing&&(existing.createdById!==state.user.id||existing.ownerSessionId!==state.sessionId||existing.category!==input.category||existing.operationKey!==(input.operationKey??null)||existing.sourceRequestId!==(input.requestId??null)||existing.expectedChecksum!==input.checksum||existing.expectedSize!==input.fileSize||existing.expectedMimeType!==input.mimeType))throw new DomainError(409,'CLAVE DE CARGA UTILIZADA EN OTRA FOTO.','EVIDENCE_IDEMPOTENCY_CONFLICT');
   if(existing&&(existing.status!=='PENDING'||existing.verifiedAt||existing.expiresAt<=new Date()))throw new DomainError(409,'ESTA CARGA YA NO ADMITE ARCHIVOS.','EVIDENCE_UPLOAD_CLOSED');
   if(!existing&&await db.evidenceAsset.count({where:{ownerSessionId:state.sessionId,status:'PENDING'}})>=30)throw new DomainError(429,'DEMASIADAS CARGAS PENDIENTES. RETIRA LAS QUE NO UTILIZARÁS.','EVIDENCE_UPLOAD_LIMIT');
   const a=existing??await db.evidenceAsset.create({data:{storageKey:`evidence/${randomUUID()}.${declaration?'pdf':'webp'}`,stagingKey:`staging/${randomUUID()}`,originalStorageKey:input.mimeType==='application/pdf'&&!declaration?`evidence/${randomUUID()}.pdf`:undefined,createdById:state.user.id,ownerSessionId:state.sessionId,category:input.category,idempotencyKey:input.idempotencyKey,operationKey:input.operationKey,sourceRequestId:input.requestId,expectedMimeType:input.mimeType,expectedSize:input.fileSize,expectedChecksum:input.checksum,expiresAt:new Date(Date.now()+3600000),uploadExpiresAt:new Date()}});
   const authorization=await db.$transaction(async tx=>{const locked=owned(await lockAsset(tx,a.id));if(locked.status!=='PENDING'||locked.verifiedAt)throw new DomainError(409,'CARGA CERRADA.','EVIDENCE_UPLOAD_CLOSED');const signed=await storage().authorizeUpload(locked.stagingKey!,input.mimeType,input.fileSize);await tx.evidenceAsset.update({where:{id:a.id},data:{uploadExpiresAt:new Date(Math.max(locked.uploadExpiresAt.getTime(),Date.now()+signed.expiresIn*1000))}});return signed;});
   return {assetId:a.id,uploadUrl:authorization.url,headers:authorization.headers,expiresIn:authorization.expiresIn};
  },
  verify:async(id:unknown,raw:unknown={})=>{
   const {receiptPage}=evidenceVerifySchema.parse(raw);
   permission('registration.evidence.upload');const key=idSchema.parse(id);
   const a=await db.$transaction(async tx=>{const found=owned(await lockAsset(tx,key));if(found.status!=='PENDING'||found.expiresAt<=new Date())throw new DomainError(409,'CARGA CERRADA.','EVIDENCE_UPLOAD_CLOSED');if(found.verifiedAt)return found;if(found.verificationStartedAt&&found.verificationStartedAt.getTime()>Date.now()-120000)throw new DomainError(409,'VERIFICACIÓN EN CURSO.','EVIDENCE_VERIFY_BUSY');return tx.evidenceAsset.update({where:{id:key},data:{verificationStartedAt:new Date()}});});
   if(a.verifiedAt){if(receiptPage&&receiptPage!==a.receiptPage)throw new DomainError(409,'La página ya fue verificada. Vuelve a cargar el PDF para cambiarla.','RECEIPT_PDF_PAGE_CONFLICT');return prepared(a);}
   try{
    const declaration=a.category===movistarDeclarationCategory;
    const bytes=await storage().download(a.stagingKey!,declaration?a.expectedSize:maxEvidenceBytes);
    if(bytes.length!==a.expectedSize||checksum(bytes)!==a.expectedChecksum)throw new DomainError(400,'LA FOTO SUBIDA NO COINCIDE CON EL ARCHIVO SELECCIONADO.','EVIDENCE_CHECKSUM_INVALID');
    if(declaration)await validateMovistarDeclaration(bytes);
    const pdf=a.originalStorageKey?await receiptPdfImage(bytes,receiptPage):null;
    const output=declaration?{bytes,mimeType:'application/pdf',fileSize:bytes.length,checksum:a.expectedChecksum}:pdf?.image??await prepareEvidenceImage(bytes,a.expectedMimeType);
    const {bytes: _bytes,...metadata}=output;void _bytes;
    return db.$transaction(async tx=>{const locked=owned(await lockAsset(tx,key));if(locked.status!=='PENDING'||locked.expiresAt<=new Date())throw new DomainError(409,'CARGA CANCELADA DURANTE LA VERIFICACIÓN.','EVIDENCE_UPLOAD_CLOSED');await storage().upload(locked.storageKey,output.bytes,declaration?'application/pdf':undefined);if(pdf&&locked.originalStorageKey)await storage().upload(locked.originalStorageKey,bytes,'application/pdf');return prepared(await tx.evidenceAsset.update({where:{id:key},data:{...metadata,...(pdf?{originalFileSize:bytes.length,originalChecksum:checksum(bytes),receiptPage:pdf.page}:{}),verifiedAt:new Date(),verificationStartedAt:null}}));},{timeout:20000});
   }catch(error){await db.evidenceAsset.updateMany({where:{id:key,status:'PENDING'},data:{status:'FAILED',expiresAt:new Date()}});throw error instanceof DomainError?error:new DomainError(503,'ALMACENAMIENTO NO DISPONIBLE. VUELVE A SUBIR LA FOTO PARA REINTENTAR.','EVIDENCE_STORAGE_UNAVAILABLE');}
  },
  abandon:async(id:unknown)=>{permission('registration.evidence.upload');const key=idSchema.parse(id);await db.$transaction(async tx=>{const a=owned(await lockAsset(tx,key));if(a.status==='READY'||await tx.registrationEvidence.count({where:{evidenceAssetId:key}}))throw new DomainError(409,'LA FOTO YA ESTÁ ASOCIADA.','EVIDENCE_ALREADY_ATTACHED');await tx.evidenceAsset.update({where:{id:key},data:{status:'DELETING'}});});return cleanupEvidence(db,provider,[key]);},
  list:async(id:unknown)=>{
   permission('registration.read','registration.evidence.read');const key=idSchema.parse(id);await request(key);
   const links=await db.registrationEvidence.findMany({where:{registrationRequestId:key,evidenceAsset:{status:'READY'}},
    include:{evidenceAsset:{include:{equipmentReceipts:{where:{version:{not:null}},select:{equipmentId:true},take:1}}}},orderBy:{category:'asc'}});
   return links.map(({id,category,evidenceAsset:asset})=>({id,category,asset:{id:asset.id,mimeType:asset.mimeType,fileSize:asset.fileSize,
    width:asset.width,height:asset.height,originalPdf:!!asset.originalStorageKey&&!asset.equipmentReceipts.length,receiptPage:asset.receiptPage}}));
  },
  access:async(id:unknown,linkId:unknown,download=false,original=false)=>{
   permission('registration.read','registration.evidence.read');const key=idSchema.parse(id);await request(key);
   const e=await db.registrationEvidence.findFirst({where:{id:idSchema.parse(linkId),registrationRequestId:key,evidenceAsset:{status:'READY',
    ...(original?{equipmentReceipts:{none:{version:{not:null}}}}:{})}},include:{evidenceAsset:true}});
   if(!e)throw new DomainError(404,'EVIDENCIA NO ENCONTRADA.','EVIDENCE_NOT_FOUND');
   const storageKey=original?e.evidenceAsset.originalStorageKey:e.evidenceAsset.storageKey;
   if(!storageKey)throw new DomainError(404,'PDF original no disponible.','EVIDENCE_NOT_FOUND');
   if(!await storage().exists(storageKey))throw new DomainError(503,'NO SE ENCONTRÓ EL ARCHIVO EN EL ALMACENAMIENTO. CONTACTA AL ADMINISTRADOR.','EVIDENCE_STORAGE_MISSING');
   const filename=e.category===movistarDeclarationCategory?'declaracion-jurada-movistar.pdf':`evidencia-${e.category}.webp`;
   const result=await storage().authorizeDownload(storageKey,original?'boleta-original.pdf':download||e.category===movistarDeclarationCategory?filename:undefined);
   if(download)await writeAudit(db,actor,'EVIDENCE_DOWNLOADED','RegistrationEvidence',e.id,{requestId:key,category:e.category,assetId:e.evidenceAssetId});
   return result;
  },
  attach:async(id:unknown,raw:unknown)=>{permission('registration.update','registration.evidence.upload');const key=idSchema.parse(id),input=evidenceAttachSchema.parse(raw);if(['DNI_FRONT','DNI_BACK'].includes(input.category))permission('client.documents.upload');await request(key);
   const result=await db.$transaction(async tx=>{
    const initial=await tx.registrationRequest.findUniqueOrThrow({where:{id:key},select:{imei:{select:{equipmentId:true}}}});
    await tx.$queryRaw`SELECT id FROM "Equipment" WHERE id=${initial.imei.equipmentId}::uuid FOR UPDATE`;
    const equipment=await tx.equipment.findUniqueOrThrow({where:{id:initial.imei.equipmentId},select:{ownerId:true}});
    const saveIdentity=['DNI_FRONT','DNI_BACK'].includes(input.category)&&state.user.permissions.includes('client.documents.upload')&&!!equipment.ownerId&&!await tx.equipmentHistory.count({where:{equipmentId:initial.imei.equipmentId,eventType:'OWNER_CHANGED'}});
    if(saveIdentity)await tx.$queryRaw`SELECT id FROM "Client" WHERE id=${equipment.ownerId!}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "RegistrationRequest" WHERE id=${key}::uuid FOR UPDATE`;const old=await tx.registrationEvidence.findUnique({where:{registrationRequestId_category:{registrationRequestId:key,category:input.category}}});if((old?.id??null)!==input.expectedEvidenceId)throw new DomainError(409,'LA FOTO CAMBIÓ. ACTUALIZA EL EXPEDIENTE.','EVIDENCE_REPLACEMENT_CONFLICT');if(old)permission('registration.evidence.replace');const a=assertPrepared(await lockAsset(tx,input.assetId),state.user.id,state.sessionId,input.category);if(a.sourceRequestId!==key)throw new DomainError(409,'FOTO DE OTRA SOLICITUD.','EVIDENCE_SCOPE_MISMATCH');if(old)await tx.registrationEvidence.delete({where:{id:old.id}});await tx.evidenceAsset.update({where:{id:a.id},data:{status:'READY'}});const link=await tx.registrationEvidence.create({data:{registrationRequestId:key,evidenceAssetId:a.id,category:input.category,createdById:state.user.id}});await writeAudit(tx,actor,old?'EVIDENCE_REPLACED':'EVIDENCE_UPLOADED','RegistrationEvidence',link.id,{requestId:key,category:input.category,assetId:a.id});const identitySaved=saveIdentity?await saveRegistrationIdentity(tx,equipment.ownerId!,[a.id],actor):0;return {linkId:link.id,oldAssetId:old?.evidenceAssetId,identitySaved,identityNeedsReview:['DNI_FRONT','DNI_BACK'].includes(input.category)&&!saveIdentity};});return {saved:true,identitySaved:result.identitySaved>0,identityNeedsReview:result.identityNeedsReview,cleanup:result.oldAssetId?await cleanupEvidence(db,provider,[result.oldAssetId]):{deleted:0,pending:[]}};
  },
  remove:async(id:unknown,linkId:unknown,raw:unknown)=>{permission('registration.update','registration.evidence.delete');evidenceDeleteSchema.parse(raw);const key=idSchema.parse(id);await request(key);const assetId=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "RegistrationRequest" WHERE id=${key}::uuid FOR UPDATE`;const e=await tx.registrationEvidence.findFirst({where:{id:idSchema.parse(linkId),registrationRequestId:key}});if(!e)throw new DomainError(404,'EVIDENCIA NO ENCONTRADA.','EVIDENCE_NOT_FOUND');if(e.category===movistarDeclarationCategory&&(await tx.registrationRequest.findUniqueOrThrow({where:{id:key},select:{operator:true}})).operator==='MOVISTAR')throw new DomainError(409,'La declaración es obligatoria para una solicitud Movistar.','MOVISTAR_DECLARATION_REQUIRED');await tx.registrationEvidence.delete({where:{id:e.id}});await writeAudit(tx,actor,'EVIDENCE_DELETED','RegistrationEvidence',e.id,{requestId:key,category:e.category,assetId:e.evidenceAssetId});return e.evidenceAssetId;});return {deleted:true,cleanup:await cleanupEvidence(db,provider,[assetId])};},
  cleanup:async()=>{permission('registration.evidence.delete');return cleanupEvidence(db,provider);},
 };
}
