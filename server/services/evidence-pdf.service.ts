import {autoAttachClientIdentity} from '../documents/auto-attach-identity.js';
import {Prisma,type PrismaClient} from '@prisma/client';
import sharp from 'sharp';
import {z} from 'zod';
import {idSchema} from '../../shared/validation.js';
import {movistarDeclarationCategory,photoEvidenceCategories,maxEvidenceBytes,maxEvidencePixels} from '../../shared/evidence.js';
import {companyDefaults} from '../../shared/company.js';
import {createEvidencePdf,type EvidencePdfData} from '../documents/evidence.pdf.js';
import {compressRecoPdf} from '../documents/reco-pdf-compression.js';
import {S3EvidenceStorage,createEvidenceStorage} from '../storage/s3.js';
import type {EvidenceStorageProvider} from '../storage/provider.js';
import {checksum} from '../evidence/image.js';
import {DomainError} from '../lib/errors.js';
import {writeAudit,type AuditContext} from '../lib/audit.js';
const downloadOptions=z.object({compressed:z.boolean().default(false)}).default({compressed:false});
export function createEvidencePdfService(db:PrismaClient,actor:AuditContext,provider?:EvidenceStorageProvider,autoAttachIdentity=false){
 return {generate:async(raw:unknown,rawOptions?:unknown)=>{
  const id=idSchema.parse(raw);
  const {compressed}=downloadOptions.parse(rawOptions);
  let ownedStorage:EvidenceStorageProvider|undefined;
  try{return await db.$transaction(async tx=>{
   if(autoAttachIdentity)await autoAttachClientIdentity(tx,id,actor);
   await tx.$queryRaw`SELECT id FROM "RegistrationRequest" WHERE id=${id}::uuid FOR SHARE`;
   const row=await tx.registrationRequest.findUnique({where:{id},include:{applicant:true,createdBy:{select:{name:true}},imei:{include:{equipment:{include:{owner:true}}}},evidence:{include:{evidenceAsset:true}}}});
   if(!row)throw new DomainError(404,'SOLICITUD NO ENCONTRADA.','REQUEST_NOT_FOUND');
   const equipment=row.imei.equipment,client=row.applicant??equipment.owner;
   if(!client)throw new DomainError(409,'REVISA LA RELACIÓN DEL CLIENTE Y EQUIPO.','EVIDENCE_PDF_SCOPE');
   const photos:EvidencePdfData['photos']=[],storage=()=>provider??(ownedStorage??=createEvidenceStorage());
   const movistar=row.operator==='MOVISTAR';
   const sources=movistar||compressed?new Map<string,Buffer>():undefined;
   let declaration:Buffer|undefined;
   for(const link of [...row.evidence].sort((a,b)=>a.evidenceAssetId.localeCompare(b.evidenceAssetId))){
    if(link.category===movistarDeclarationCategory&&!movistar)continue;
    await tx.$queryRaw`SELECT id FROM "EvidenceAsset" WHERE id=${link.evidenceAssetId}::uuid FOR SHARE`;
    const asset=await tx.evidenceAsset.findUniqueOrThrow({where:{id:link.evidenceAssetId}});
    if(link.category===movistarDeclarationCategory){
     if(asset.status!=='READY'||asset.category!==movistarDeclarationCategory||asset.mimeType!=='application/pdf'||(asset.ownerClientId&&asset.ownerClientId!==client.id))throw new DomainError(409,'DECLARACIÓN JURADA NO DISPONIBLE PARA ESTA SOLICITUD.','EVIDENCE_PDF_SCOPE');
     try{
      declaration=await storage().download(asset.storageKey,asset.fileSize);
      if(declaration.length!==asset.fileSize||!asset.checksum||checksum(declaration)!==asset.checksum)throw new Error('CHECKSUM');
     }catch{
      throw new DomainError(503,'No se pudo leer la declaración jurada. El registro está guardado. Reintenta la descarga.','EVIDENCE_PDF_MOVISTAR_DECLARATION');
     }
     continue;
    }
    if(asset.status!=='READY'||!photoEvidenceCategories.some(c=>c===link.category)||(asset.category!==link.category&&!(asset.category==='IDENTITY_IMAGE'&&asset.ownerClientId===client.id&&['DNI_FRONT','DNI_BACK'].includes(link.category)))||(asset.ownerClientId&&asset.ownerClientId!==client.id))throw new DomainError(409,'EVIDENCIA NO DISPONIBLE O DE OTRO CLIENTE.','EVIDENCE_PDF_SCOPE');
    try{
     const bytes=await storage().download(asset.storageKey,maxEvidenceBytes);
     if(!asset.checksum||checksum(bytes)!==asset.checksum)throw new Error('CHECKSUM');
     const image=sharp(bytes,{limitInputPixels:maxEvidencePixels}).rotate().flatten({background:'#ffffff'}),metadata=await image.metadata();
     if(!metadata.width||!metadata.height)throw new Error('DIMENSIONS');
     const normalized=await image.jpeg({quality:90}).toBuffer({resolveWithObject:true});
     photos.push({category:link.category as EvidencePdfData['photos'][number]['category'],bytes:normalized.data,width:normalized.info.width,height:normalized.info.height});
     sources?.set(link.category,bytes);
    }catch{throw new DomainError(503,'NO SE PUDO GENERAR EL PDF. EL REGISTRO ESTÁ GUARDADO; REINTENTA EL DOCUMENTO.','EVIDENCE_PDF_UNAVAILABLE');}
   }
   const order=['DNI_FRONT','DNI_BACK','PURCHASE_RECEIPT','DEVICE_BOX','LOGICAL_IMEI'];photos.sort((a,b)=>order.indexOf(a.category)-order.indexOf(b.category));
   const company=await tx.companySettings.findUnique({where:{id:1}});
   const data:EvidencePdfData={businessName:company?.businessName??companyDefaults.businessName,code:row.code,date:new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'short'}).format(row.occurredAt),client:client.fullName||[client.firstName,client.lastName].filter(Boolean).join(' '),dni:client.dni??client.otherDocumentNumber??'',equipment:[equipment.commercialName,equipment.model].filter(Boolean).join(' · '),brand:equipment.brand,imei:row.imei.value,operator:row.operator,status:row.status==='PENDING'?'REGISTRO PENDIENTE':row.status==='BLOCKED'?'BLOQUEADO':'REGISTRADO',responsible:row.createdBy.name,photos};
   const original=createEvidencePdf(data);
   if(movistar&&!declaration)throw new DomainError(409,'Edita el registro y adjunta la declaración jurada de este IMEI para descargar el RECO.','EVIDENCE_PDF_MOVISTAR_DECLARATION_MISSING');
   const packet=sources?await compressRecoPdf(data,original,sources,declaration):undefined;
   const bytes=packet?.bytes??original;
   await writeAudit(tx,actor,'EVIDENCE_PDF_GENERATED','RegistrationRequest',id,{
    evidenceCount:photos.length,template:'EVIDENCE_A4_PHOTO_TEMPLATE_V2',
    ...(packet?{declarationIncluded:movistar,originalBytes:packet.originalSize,downloadBytes:bytes.length}:{})
   });
   return {pdfBase64:bytes.toString('base64'),fileName:`${row.code}${compressed&&!movistar?'-comprimido':''}.pdf`};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});}finally{if(ownedStorage instanceof S3EvidenceStorage)ownedStorage.client.destroy();}
 }};
}
