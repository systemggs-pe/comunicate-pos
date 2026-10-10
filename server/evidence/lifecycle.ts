import type {PrismaClient, EvidenceAsset} from '@prisma/client';
import type {Db} from '../repositories/pos.repository.js';
import {DomainError} from '../lib/errors.js';
import {writeAudit,type AuditContext} from '../lib/audit.js';
import type {EvidenceCategory} from '../../shared/evidence.js';
import type {EvidenceStorageProvider} from '../storage/provider.js';
import {createEvidenceStorage} from '../storage/s3.js';

export async function lockAsset(tx:Db,id:string){await tx.$queryRaw`SELECT id FROM "EvidenceAsset" WHERE id=${id}::uuid FOR UPDATE`;return tx.evidenceAsset.findUnique({where:{id}});}
export function assertPrepared(asset:EvidenceAsset|null,userId:string,sessionId:string|undefined,category:EvidenceCategory){
 if(!asset||asset.status!=='PENDING'||!asset.verifiedAt||asset.createdById!==userId||asset.ownerSessionId!==sessionId||asset.category!==category||asset.expiresAt<=new Date())throw new DomainError(409,'LA FOTO NO ESTÁ PREPARADA PARA ESTA SESIÓN. VUELVE A ADJUNTARLA.','EVIDENCE_NOT_PREPARED');
 return asset;
}
export async function attachOperationEvidence(tx:Db,rows:{assetId:string;category:EvidenceCategory;imeiValues:string[]}[],operationKey:string,requests:{id:string;value:string}[],actor:AuditContext,sessionId?:string){
 for(const row of [...rows].sort((a,b)=>a.assetId.localeCompare(b.assetId))){
  const asset=assertPrepared(await lockAsset(tx,row.assetId),actor.userId!,sessionId,row.category);
  if(asset.operationKey!==operationKey)throw new DomainError(409,'LA FOTO PERTENECE A OTRA OPERACIÓN.','EVIDENCE_SCOPE_MISMATCH');
  await tx.evidenceAsset.update({where:{id:asset.id},data:{status:'READY'}});
  for(const value of row.imeiValues){const request=requests.find(r=>r.value===value);if(!request)throw new DomainError(400,'IMEI NO INCLUIDO EN LA OPERACIÓN.','EVIDENCE_SCOPE_MISMATCH');
   await tx.registrationEvidence.create({data:{registrationRequestId:request.id,evidenceAssetId:asset.id,category:row.category,createdById:actor.userId}});
   await writeAudit(tx,actor,'EVIDENCE_UPLOADED','RegistrationEvidence',asset.id,{requestId:request.id,category:row.category,assetId:asset.id});
  }
 }
}

// The database is the durable deletion outbox. Objects are idempotently deleted;
// a staging tombstone remains until every previously issued PUT has expired.
export async function cleanupEvidence(db:PrismaClient,provider?:EvidenceStorageProvider,ids?:string[]){
 const scope=ids?{id:{in:ids}}:{};
 await db.evidenceAsset.updateMany({where:{...scope,status:{in:['PENDING','FAILED']},expiresAt:{lte:new Date()},links:{none:{}}},data:{status:'DELETING'}});
 const candidates=await db.evidenceAsset.findMany({where:{...scope,OR:[{status:'DELETING',links:{none:{}}},{status:'READY',stagingKey:{not:null},uploadExpiresAt:{lt:new Date(Date.now()-5000)}}]},select:{id:true},take:100,orderBy:{createdAt:'asc'}});
 const pending:string[]=[];let deleted=0;
 if(!candidates.length)return {deleted,pending};
 let storage:EvidenceStorageProvider;
 try{storage=provider??createEvidenceStorage();}catch{ return {deleted,pending:candidates.map(c=>c.id)}; }
 for(const candidate of candidates){try{
  await db.$transaction(async tx=>{
   const asset=await lockAsset(tx,candidate.id);if(!asset)return;
   if(asset.status==='READY'){if(asset.stagingKey&&asset.uploadExpiresAt.getTime()+5000<Date.now()){await storage.delete(asset.stagingKey);await tx.evidenceAsset.update({where:{id:asset.id},data:{stagingKey:null}});}return;}
   if(asset.status!=='DELETING'||await tx.registrationEvidence.count({where:{evidenceAssetId:asset.id}}))return;
   await storage.delete(asset.storageKey);if(asset.stagingKey)await storage.delete(asset.stagingKey);
   if(asset.uploadExpiresAt.getTime()+5000>=Date.now()){pending.push(asset.id);await tx.evidenceAsset.update({where:{id:asset.id},data:{lastDeleteErrorCode:'UPLOAD_WINDOW_OPEN'}});return;}
   await tx.evidenceAsset.delete({where:{id:asset.id}});deleted++;
  },{timeout:20000});
 }catch{pending.push(candidate.id);await db.evidenceAsset.updateMany({where:{id:candidate.id},data:{deleteAttempts:{increment:1},lastDeleteErrorCode:'STORAGE_DELETE_RETRY'}});}}
 return {deleted,pending:[...new Set(pending)]};
}
