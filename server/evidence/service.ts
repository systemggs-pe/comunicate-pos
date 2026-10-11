import {randomUUID} from 'node:crypto';
import type {PrismaClient,EvidenceAsset} from '@prisma/client';
import {uploadInitSchema,evidenceAttachSchema,evidenceDeleteSchema,maxEvidenceBytes} from '../../shared/evidence.js';
import {idSchema} from '../../shared/validation.js';
import type {AuthState} from '../auth/middleware.js';
import {writeAudit,type AuditContext} from '../lib/audit.js';
import {DomainError} from '../lib/errors.js';
import {createEvidenceStorage} from '../storage/s3.js';
import type {EvidenceStorageProvider} from '../storage/provider.js';
import {checksum,prepareEvidenceImage} from './image.js';
import {lockAsset,assertPrepared,cleanupEvidence} from './lifecycle.js';

export function createEvidenceService(db:PrismaClient,state:AuthState,actor:AuditContext,provider?:EvidenceStorageProvider){
 let resolved=provider;
 const storage=()=>resolved??=createEvidenceStorage();
 const permission=(...keys:typeof state.user.permissions[number][])=>{if(keys.some(k=>!state.user.permissions.includes(k)))throw new DomainError(403,'NO TIENES PERMISOS PARA ESTA EVIDENCIA.','PERMISSION_REQUIRED');};
 const prepared=(a:EvidenceAsset)=>({assetId:a.id,category:a.category,fileSize:a.fileSize,width:a.width!,height:a.height!});
 async function request(id:string){const found=await db.registrationRequest.findUnique({where:{id}});if(!found)throw new DomainError(404,'SOLICITUD NO ENCONTRADA.','REQUEST_NOT_FOUND');return found;}
 function owned(a:EvidenceAsset|null){if(!a||a.createdById!==state.user.id||a.ownerSessionId!==state.sessionId)throw new DomainError(404,'CARGA NO ENCONTRADA EN ESTA SESIÓN.','EVIDENCE_UPLOAD_NOT_FOUND');return a;}
 return {
  init:async(raw:unknown)=>{
   permission('registration.evidence.upload');const input=uploadInitSchema.parse(raw);
   permission(input.requestId?'registration.update':'registration.create');if(input.requestId)await request(input.requestId);
   if(input.fileSize>Math.min(maxEvidenceBytes,Number(process.env.MAX_EVIDENCE_FILE_SIZE)||maxEvidenceBytes))throw new DomainError(400,'IMAGEN DEMASIADO GRANDE.','EVIDENCE_SIZE_INVALID');
   const existing=await db.evidenceAsset.findUnique({where:{idempotencyKey:input.idempotencyKey}});
   if(existing&&(existing.createdById!==state.user.id||existing.ownerSessionId!==state.sessionId||existing.category!==input.category||existing.operationKey!==(input.operationKey??null)||existing.sourceRequestId!==(input.requestId??null)||existing.expectedChecksum!==input.checksum||existing.expectedSize!==input.fileSize||existing.expectedMimeType!==input.mimeType))throw new DomainError(409,'CLAVE DE CARGA UTILIZADA EN OTRA FOTO.','EVIDENCE_IDEMPOTENCY_CONFLICT');
   if(existing&&(existing.status!=='PENDING'||existing.verifiedAt||existing.expiresAt<=new Date()))throw new DomainError(409,'ESTA CARGA YA NO ADMITE ARCHIVOS.','EVIDENCE_UPLOAD_CLOSED');
   if(!existing&&await db.evidenceAsset.count({where:{ownerSessionId:state.sessionId,status:'PENDING'}})>=30)throw new DomainError(429,'DEMASIADAS CARGAS PENDIENTES. RETIRA LAS QUE NO UTILIZARÁS.','EVIDENCE_UPLOAD_LIMIT');
   const a=existing??await db.evidenceAsset.create({data:{storageKey:`evidence/${randomUUID()}.webp`,stagingKey:`staging/${randomUUID()}`,createdById:state.user.id,ownerSessionId:state.sessionId,category:input.category,idempotencyKey:input.idempotencyKey,operationKey:input.operationKey,sourceRequestId:input.requestId,expectedMimeType:input.mimeType,expectedSize:input.fileSize,expectedChecksum:input.checksum,expiresAt:new Date(Date.now()+3600000),uploadExpiresAt:new Date()}});
   const authorization=await db.$transaction(async tx=>{const locked=owned(await lockAsset(tx,a.id));if(locked.status!=='PENDING'||locked.verifiedAt)throw new DomainError(409,'CARGA CERRADA.','EVIDENCE_UPLOAD_CLOSED');const signed=await storage().authorizeUpload(locked.stagingKey!,input.mimeType,input.fileSize);await tx.evidenceAsset.update({where:{id:a.id},data:{uploadExpiresAt:new Date(Math.max(locked.uploadExpiresAt.getTime(),Date.now()+signed.expiresIn*1000))}});return signed;});
   return {assetId:a.id,uploadUrl:authorization.url,headers:authorization.headers,expiresIn:authorization.expiresIn};
  },
  verify:async(id:unknown)=>{
   permission('registration.evidence.upload');const key=idSchema.parse(id);
   const a=await db.$transaction(async tx=>{const found=owned(await lockAsset(tx,key));if(found.status!=='PENDING'||found.expiresAt<=new Date())throw new DomainError(409,'CARGA CERRADA.','EVIDENCE_UPLOAD_CLOSED');if(found.verifiedAt)return found;if(found.verificationStartedAt&&found.verificationStartedAt.getTime()>Date.now()-120000)throw new DomainError(409,'VERIFICACIÓN EN CURSO.','EVIDENCE_VERIFY_BUSY');return tx.evidenceAsset.update({where:{id:key},data:{verificationStartedAt:new Date()}});});
   if(a.verifiedAt)return prepared(a);
   try{
    const bytes=await storage().download(a.stagingKey!,maxEvidenceBytes);
    if(bytes.length!==a.expectedSize||checksum(bytes)!==a.expectedChecksum)throw new DomainError(400,'LA FOTO SUBIDA NO COINCIDE CON EL ARCHIVO SELECCIONADO.','EVIDENCE_CHECKSUM_INVALID');
    const output=await prepareEvidenceImage(bytes,a.expectedMimeType);
    const {bytes: _bytes,...metadata}=output;void _bytes;
    return db.$transaction(async tx=>{const locked=owned(await lockAsset(tx,key));if(locked.status!=='PENDING'||locked.expiresAt<=new Date())throw new DomainError(409,'CARGA CANCELADA DURANTE LA VERIFICACIÓN.','EVIDENCE_UPLOAD_CLOSED');await storage().upload(locked.storageKey,output.bytes);return prepared(await tx.evidenceAsset.update({where:{id:key},data:{...metadata,verifiedAt:new Date(),verificationStartedAt:null}}));},{timeout:20000});
   }catch(error){await db.evidenceAsset.updateMany({where:{id:key,status:'PENDING'},data:{status:'FAILED',expiresAt:new Date()}});throw error instanceof DomainError?error:new DomainError(503,'ALMACENAMIENTO NO DISPONIBLE. VUELVE A SUBIR LA FOTO PARA REINTENTAR.','EVIDENCE_STORAGE_UNAVAILABLE');}
  },
  abandon:async(id:unknown)=>{permission('registration.evidence.upload');const key=idSchema.parse(id);await db.$transaction(async tx=>{const a=owned(await lockAsset(tx,key));if(a.status==='READY'||await tx.registrationEvidence.count({where:{evidenceAssetId:key}}))throw new DomainError(409,'LA FOTO YA ESTÁ ASOCIADA.','EVIDENCE_ALREADY_ATTACHED');await tx.evidenceAsset.update({where:{id:key},data:{status:'DELETING'}});});return cleanupEvidence(db,provider,[key]);},
  list:async(id:unknown)=>{permission('registration.read','registration.evidence.read');const key=idSchema.parse(id);await request(key);return (await db.registrationEvidence.findMany({where:{registrationRequestId:key,evidenceAsset:{status:'READY'}},include:{evidenceAsset:true},orderBy:{category:'asc'}})).map(e=>({id:e.id,category:e.category,asset:{id:e.evidenceAssetId,mimeType:e.evidenceAsset.mimeType,fileSize:e.evidenceAsset.fileSize,width:e.evidenceAsset.width,height:e.evidenceAsset.height}}));},
  access:async(id:unknown,linkId:unknown,download=false)=>{permission('registration.read','registration.evidence.read');const key=idSchema.parse(id);await request(key);const e=await db.registrationEvidence.findFirst({where:{id:idSchema.parse(linkId),registrationRequestId:key,evidenceAsset:{status:'READY'}},include:{evidenceAsset:true}});if(!e)throw new DomainError(404,'EVIDENCIA NO ENCONTRADA.','EVIDENCE_NOT_FOUND');if(!await storage().exists(e.evidenceAsset.storageKey))throw new DomainError(503,'NO SE ENCONTRÓ EL ARCHIVO EN EL ALMACENAMIENTO. CONTACTA AL ADMINISTRADOR.','EVIDENCE_STORAGE_MISSING');const result=await storage().authorizeDownload(e.evidenceAsset.storageKey,download?`evidencia-${e.category}.webp`:undefined);if(download)await writeAudit(db,actor,'EVIDENCE_DOWNLOADED','RegistrationEvidence',e.id,{requestId:key,category:e.category,assetId:e.evidenceAssetId});return result;},
  attach:async(id:unknown,raw:unknown)=>{permission('registration.update','registration.evidence.upload');const key=idSchema.parse(id),input=evidenceAttachSchema.parse(raw);await request(key);
   const result=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "RegistrationRequest" WHERE id=${key}::uuid FOR UPDATE`;const old=await tx.registrationEvidence.findUnique({where:{registrationRequestId_category:{registrationRequestId:key,category:input.category}}});if((old?.id??null)!==input.expectedEvidenceId)throw new DomainError(409,'LA FOTO CAMBIÓ. ACTUALIZA EL EXPEDIENTE.','EVIDENCE_REPLACEMENT_CONFLICT');if(old)permission('registration.evidence.replace');const a=assertPrepared(await lockAsset(tx,input.assetId),state.user.id,state.sessionId,input.category);if(a.sourceRequestId!==key)throw new DomainError(409,'FOTO DE OTRA SOLICITUD.','EVIDENCE_SCOPE_MISMATCH');if(old)await tx.registrationEvidence.delete({where:{id:old.id}});await tx.evidenceAsset.update({where:{id:a.id},data:{status:'READY'}});const link=await tx.registrationEvidence.create({data:{registrationRequestId:key,evidenceAssetId:a.id,category:input.category,createdById:state.user.id}});await writeAudit(tx,actor,old?'EVIDENCE_REPLACED':'EVIDENCE_UPLOADED','RegistrationEvidence',link.id,{requestId:key,category:input.category,assetId:a.id});return {linkId:link.id,oldAssetId:old?.evidenceAssetId};});return {saved:true,cleanup:result.oldAssetId?await cleanupEvidence(db,provider,[result.oldAssetId]):{deleted:0,pending:[]}};
  },
  remove:async(id:unknown,linkId:unknown,raw:unknown)=>{permission('registration.update','registration.evidence.delete');evidenceDeleteSchema.parse(raw);const key=idSchema.parse(id);await request(key);const assetId=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "RegistrationRequest" WHERE id=${key}::uuid FOR UPDATE`;const e=await tx.registrationEvidence.findFirst({where:{id:idSchema.parse(linkId),registrationRequestId:key}});if(!e)throw new DomainError(404,'EVIDENCIA NO ENCONTRADA.','EVIDENCE_NOT_FOUND');await tx.registrationEvidence.delete({where:{id:e.id}});await writeAudit(tx,actor,'EVIDENCE_DELETED','RegistrationEvidence',e.id,{requestId:key,category:e.category,assetId:e.evidenceAssetId});return e.evidenceAssetId;});return {deleted:true,cleanup:await cleanupEvidence(db,provider,[assetId])};},
  cleanup:async()=>{permission('registration.evidence.delete');return cleanupEvidence(db,provider);},
 };
}
