import type {Db} from '../repositories/pos.repository.js';
import {writeAudit,type AuditContext} from '../lib/audit.js';
import {DomainError} from '../lib/errors.js';

/** Caller holds the client lock before locking the uploaded assets. Never replace saved DNI. */
export async function saveRegistrationIdentity(tx:Db,clientId:string,assetIds:string[],actor:AuditContext){
 const assets=await tx.evidenceAsset.findMany({where:{id:{in:assetIds},status:'READY',category:{in:['DNI_FRONT','DNI_BACK']}},orderBy:{id:'asc'}});
 let saved=0;
 for(const asset of assets){
  if(asset.ownerClientId&&asset.ownerClientId!==clientId)throw new DomainError(409,'Esta foto pertenece a otro cliente.','CLIENT_DOCUMENT_SCOPE');
  const current=await tx.clientDocument.findFirst({where:{clientId,category:asset.category,status:'CURRENT',expiresAt:{gt:new Date()},evidenceAsset:{status:'READY'}}});
  if(current)continue;
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
