import type {Db} from '../repositories/pos.repository.js';
import {writeAudit,type AuditContext} from '../lib/audit.js';
import {DomainError} from '../lib/errors.js';

type IdentityChange={category:'DNI_FRONT'|'DNI_BACK';documentId?:string;expectedIds:string[]};

/** Caller holds the client lock before locking the uploaded assets. */
export async function applyRegistrationIdentityChanges(tx:Db,clientId:string,changes:IdentityChange[],manualSides:string[],actor:AuditContext){
 const reused:string[]=[];
 const assets=new Set<string>();
 for(const change of changes){
  if(!!change.documentId===manualSides.includes(change.category))throw new DomainError(400,'Selecciona una sola foto para cada lado del DNI.','CLIENT_DOCUMENT_DUPLICATE');
  const current=await tx.clientDocument.findMany({where:{clientId,category:change.category,status:'CURRENT',expiresAt:{gt:new Date()}},select:{id:true}});
  if(current.length!==change.expectedIds.length||current.some(doc=>!change.expectedIds.includes(doc.id)))throw new DomainError(409,'Cambió la foto guardada. Revisa el DNI y confirma el reemplazo nuevamente.','CLIENT_DOCUMENT_CHANGED');

  const document=change.documentId?await tx.clientDocument.findFirst({where:{id:change.documentId,clientId,
   source:{in:['CODART_DNIV','CODART_DNIVEL']},status:{in:['REVIEW','CURRENT']},expiresAt:{gt:new Date()},
   category:{in:[change.category,'IDENTITY_IMAGE']},evidenceAsset:{status:'READY',ownerClientId:clientId}}}):null;
  if(change.documentId&&!document)throw new DomainError(409,'La foto de CODART ya no está disponible para este DNI.','CLIENT_DOCUMENT_SCOPE');
  if(document&&assets.has(document.evidenceAssetId))throw new DomainError(400,'Elige una foto diferente para cada lado del DNI.','CLIENT_DOCUMENT_DUPLICATE');
  await tx.clientDocument.updateMany({where:{id:{in:current.filter(doc=>doc.id!==document?.id).map(doc=>doc.id)}},data:{status:'REPLACED'}});
  if(document){
   assets.add(document.evidenceAssetId);
   await tx.clientDocument.updateMany({where:{clientId,documentType:document.documentType,category:change.category,status:'CURRENT',expiresAt:{lte:new Date()}},data:{status:'REPLACED'}});
   await tx.clientDocument.update({where:{id:document.id},data:{category:change.category,status:'CURRENT'}});
   await writeAudit(tx,actor,'CLIENT_DOCUMENT_SIDE_IDENTIFIED','ClientDocument',document.id,{clientId,category:change.category,replaced:current.some(doc=>doc.id!==document.id)});
   reused.push(document.id);
  }
 }
 return reused;
}

export async function saveRegistrationIdentity(tx:Db,clientId:string,assetIds:string[],actor:AuditContext,requireConfirmation=false){
 const assets=await tx.evidenceAsset.findMany({where:{id:{in:assetIds},status:'READY',category:{in:['DNI_FRONT','DNI_BACK']}},orderBy:{id:'asc'}});
 let saved=0;
 for(const asset of assets){
  if(asset.ownerClientId&&asset.ownerClientId!==clientId)throw new DomainError(409,'Esta foto pertenece a otro cliente.','CLIENT_DOCUMENT_SCOPE');
  const current=await tx.clientDocument.findFirst({where:{clientId,category:asset.category,status:'CURRENT',expiresAt:{gt:new Date()},evidenceAsset:{status:'READY'}}});
  if(current){
   if(requireConfirmation)throw new DomainError(409,'Confirma el reemplazo de la foto guardada del DNI.','CLIENT_DOCUMENT_REPLACE_REQUIRED');
   continue;
  }
  const existing=await tx.clientDocument.findFirst({where:{clientId,evidenceAssetId:asset.id,documentType:'MANUAL',source:'REGISTRATION_EVIDENCE'}});
  const expiresAt=new Date(Date.now()+Math.max(1,Math.min(3650,Number(process.env.CLIENT_DOCUMENT_RETENTION_DAYS)||365))*86400000);
  await tx.evidenceAsset.update({where:{id:asset.id},data:{ownerClientId:clientId}});
  await tx.clientDocument.updateMany({where:{clientId,category:asset.category,status:'CURRENT',expiresAt:{lte:new Date()}},data:{status:'REPLACED'}});
  const fields={status:'CURRENT',expiresAt,purpose:'DNI PARA REGISTROS DEL CLIENTE',authorizationReference:`FOTO MANUAL CONFIRMADA EN REGISTRO POR ${actor.userId} EL ${new Date().toISOString()}`};
  const doc=existing?await tx.clientDocument.update({where:{id:existing.id},data:fields}):await tx.clientDocument.create({data:{clientId,evidenceAssetId:asset.id,category:asset.category,documentType:'MANUAL',source:'REGISTRATION_EVIDENCE',createdById:actor.userId,...fields}});
  await writeAudit(tx,actor,'CLIENT_DOCUMENT_UPLOADED','ClientDocument',doc.id,{clientId,assetId:asset.id,source:'REGISTRATION_EVIDENCE',existingFileReused:true,manualRegistrationConfirmed:true});
  saved++;
 }
 return saved;
}
