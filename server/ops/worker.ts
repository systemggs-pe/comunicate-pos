import {PrismaClient} from '@prisma/client';
import {ListObjectsV2Command} from '@aws-sdk/client-s3';
import {cleanupEvidence} from '../evidence/lifecycle.js';
import {createAuthService} from '../services/auth.service.js';
import type {S3EvidenceStorage} from '../storage/s3.js';
export interface WorkerResult {status:'SUCCESS'|'PARTIAL'|'FAILED';reason?:string;deleted:number;pending:number;orphans:number;inconsistent:number;scanTruncated:boolean;expiredSessions:number;finishedAt:string;durationMs:number}
export async function runWorker(db:PrismaClient, storage:S3EvidenceStorage, options:{lockUrl:string;batchSize:number;maxBatches:number;timeoutMs:number;signal?:AbortSignal;maintenance?:boolean}):Promise<WorkerResult>{
 const start=Date.now(),result:WorkerResult={status:'SUCCESS',deleted:0,pending:0,orphans:0,inconsistent:0,scanTruncated:false,expiredSessions:0,finishedAt:'',durationMs:0};
 if(!Number.isInteger(options.batchSize)||options.batchSize<1||options.batchSize>100||!Number.isInteger(options.maxBatches)||options.maxBatches<1||options.maxBatches>10||options.timeoutMs<1000||options.timeoutMs>180000)throw new Error('WORKER_LIMITS_INVALID');
 const lockUrl=new URL(options.lockUrl);lockUrl.searchParams.set('connection_limit','1');
 const locker=new PrismaClient({datasources:{db:{url:lockUrl.toString()}}});
 try{
  if(options.maintenance){result.reason='MAINTENANCE';return result;}
  await locker.$transaction(async tx=>{
   const acquired=await tx.$queryRaw<{locked:boolean}[]>`SELECT pg_try_advisory_xact_lock(741021,10) AS locked`;
   if(!acquired[0].locked){result.status='PARTIAL';result.reason='LOCK_BUSY';return;}
   const pending=new Set<string>();
   for(let i=0;i<options.maxBatches;i++){
    if(options.signal?.aborted||Date.now()-start>=options.timeoutMs){result.status='PARTIAL';result.reason='INTERRUPTED';break;}
    const batch=await cleanupEvidence(db,storage,undefined,{maxCandidates:options.batchSize,deadline:start+options.timeoutMs,signal:options.signal});
    result.deleted+=batch.deleted;batch.pending.forEach(id=>pending.add(id));if(!batch.deleted||batch.pending.length)break;
   }
   result.pending=pending.size;
   if(!options.signal?.aborted&&Date.now()-start<options.timeoutMs){
    const sessions=await createAuthService(db).cleanup();result.expiredSessions=sessions[0].count;
    const page=await storage.client.send(new ListObjectsV2Command({Bucket:storage.config.bucket,MaxKeys:100}));
    const keys=(page.Contents??[]).map(o=>o.Key).filter((k):k is string=>!!k);
    const referenced=await db.evidenceAsset.findMany({where:{OR:[{storageKey:{in:keys}},{stagingKey:{in:keys}}]},select:{storageKey:true,stagingKey:true}});
    const known=new Set(referenced.flatMap(a=>[a.storageKey,a.stagingKey]));
    // Unknown physical objects are reported only. Never delete without provenance/approval.
    result.orphans=keys.filter(k=>!known.has(k)).length;result.scanTruncated=!!page.IsTruncated;
   }
   const remaining=await db.evidenceAsset.count({where:{status:'DELETING'}});result.pending=Math.max(result.pending,remaining);
   result.inconsistent=await db.evidenceAsset.count({where:{status:'READY',links:{none:{}}}});
   if(result.pending||result.orphans||result.inconsistent||result.scanTruncated||options.signal?.aborted){result.status='PARTIAL';result.reason??='REVIEW_OR_RETRY';}
  },{timeout:options.timeoutMs+25000,maxWait:5000});
 }catch{result.status='FAILED';result.reason='WORKER_RETRY';}
 finally{await locker.$disconnect();result.finishedAt=new Date().toISOString();result.durationMs=Date.now()-start;}
 return result;
}
