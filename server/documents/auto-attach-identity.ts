import type {Db} from '../repositories/pos.repository.js';
import {writeAudit,type AuditContext} from '../lib/audit.js';
import {DomainError} from '../lib/errors.js';

/** Reuse private files. Never replace request photos or infer a historical owner. */
export async function autoAttachClientIdentity(tx:Db,requestId:string,actor:AuditContext){
 const initial=await tx.registrationRequest.findUnique({where:{id:requestId},select:{imei:{select:{equipmentId:true}}}});
 if(!initial)throw new DomainError(404,'REGISTRO NO ENCONTRADO.','REQUEST_NOT_FOUND');
 await tx.$queryRaw`SELECT id FROM "Equipment" WHERE id=${initial.imei.equipmentId}::uuid FOR UPDATE`;
 const request=await tx.registrationRequest.findUniqueOrThrow({where:{id:requestId},include:{imei:{include:{equipment:{select:{id:true,ownerId:true}}}}}});
 const clientId=request.imei.equipment.ownerId;
 if(!clientId)return {attached:0};
 if(await tx.equipmentHistory.count({where:{equipmentId:request.imei.equipmentId,eventType:'OWNER_CHANGED'}}))return {attached:0};
 await tx.$queryRaw`SELECT id FROM "Client" WHERE id=${clientId}::uuid FOR UPDATE`;
 await tx.$queryRaw`SELECT id FROM "RegistrationRequest" WHERE id=${requestId}::uuid FOR UPDATE`;
 const existing=await tx.registrationEvidence.findMany({where:{registrationRequestId:requestId,category:{in:['DNI_FRONT','DNI_BACK']}},select:{category:true,evidenceAssetId:true}});
 const missing=(['DNI_FRONT','DNI_BACK'] as const).filter(category=>!existing.some(link=>link.category===category));
 if(!missing.length)return {attached:0};
 const documents=await tx.clientDocument.findMany({where:{clientId,status:'CURRENT',expiresAt:{gt:new Date()},category:{in:['DNI_FRONT','DNI_BACK']},evidenceAsset:{status:'READY',OR:[{ownerClientId:clientId},{ownerClientId:null}]}},orderBy:[{createdAt:'desc'},{id:'asc'}],take:100});
 // Prefer a complete pair of the same DNI type; leave ambiguous duplicates for review.
 const linkedDocuments=existing.length?await tx.clientDocument.findMany({where:{clientId,evidenceAssetId:{in:existing.map(link=>link.evidenceAssetId)}},select:{documentType:true}}):[];
 const linkedTypes=[...new Set(linkedDocuments.map(d=>d.documentType))];
 if(linkedTypes.length>1)return {attached:0};
 const types=[...new Set(documents.map(d=>d.documentType))].filter(type=>!linkedTypes.length||type===linkedTypes[0]);
 const groups=types.map(type=>documents.filter(d=>d.documentType===type)).filter(group=>['DNI_FRONT','DNI_BACK'].every(category=>group.filter(d=>d.category===category).length<=1));
 const selected=groups.find(group=>group.length===2)??groups[0]??[];
 let attached=0;
 for(const d of selected.filter(d=>missing.includes(d.category as 'DNI_FRONT'|'DNI_BACK')).sort((a,b)=>a.evidenceAssetId.localeCompare(b.evidenceAssetId))){
  await tx.$queryRaw`SELECT id FROM "EvidenceAsset" WHERE id=${d.evidenceAssetId}::uuid FOR UPDATE`;
  const asset=await tx.evidenceAsset.findUnique({where:{id:d.evidenceAssetId}});
  if(!asset||asset.status!=='READY'||asset.ownerClientId&&asset.ownerClientId!==clientId||asset.category!==d.category&&asset.category!=='IDENTITY_IMAGE'||asset.category==='IDENTITY_IMAGE'&&asset.ownerClientId!==clientId)continue;
  const category=d.category as 'DNI_FRONT'|'DNI_BACK';
  const created=await tx.registrationEvidence.createMany({data:[{registrationRequestId:requestId,evidenceAssetId:asset.id,category,createdById:actor.userId}],skipDuplicates:true});
  if(!created.count)continue;
  attached+=created.count;
  await writeAudit(tx,actor,'CLIENT_DOCUMENT_REUSED','ClientDocument',d.id,{requestId,assetId:asset.id,category,automatic:true});
 }
 return {attached};
}
