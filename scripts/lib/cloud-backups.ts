import {createHash,randomUUID} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {ListObjectsV2Command,PutObjectCommand,GetObjectCommand,DeleteObjectCommand,HeadObjectCommand} from '@aws-sdk/client-s3';
import {z} from 'zod';
import type {S3EvidenceStorage} from '../../server/storage/s3.js';
import {verifyBackup} from '../../server/ops/recovery.js';
const fileName=z.string().regex(/^(database|manifest|object-[0-9]+)\.enc$/);
const inventorySchema=z.object({version:z.literal(1),createdAt:z.string().datetime(),files:z.array(z.object({file:fileName,size:z.number().int().positive().max(10_000_000_000),hash:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).min(2).max(100002)}).strict();
const prefix='communicate-pos-backups/';
function backupId(id:string){if(!/^[0-9]{13}-[a-f0-9-]{36}$/.test(id))throw new Error('BACKUP_ID_INVALID');return `${prefix}${id}/`;}
async function digest(path:string){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
export async function publishBackup(storage:S3EvidenceStorage,directory:string,password:string,maxBytes:number){
 const manifest=await verifyBackup(directory,password),files=['database.enc',...manifest.objects.map(o=>o.file),'manifest.enc'];
 const inventory:z.infer<typeof inventorySchema>={version:1,createdAt:new Date().toISOString(),files:[]};
 for(const file of files){const path=join(directory,file);inventory.files.push({file,size:(await stat(path)).size,hash:await digest(path)});}
 inventorySchema.parse(inventory);const bytes=inventory.files.reduce((sum,f)=>sum+f.size,0);if(!Number.isSafeInteger(maxBytes)||maxBytes<1||bytes>maxBytes)throw new Error('BACKUP_SIZE_BUDGET_EXCEEDED');
 let existingBytes=0,token:string|undefined;
 do{const page=await storage.client.send(new ListObjectsV2Command({Bucket:storage.config.bucket,Prefix:prefix,ContinuationToken:token}));existingBytes+=(page.Contents??[]).reduce((sum,o)=>sum+(o.Size??0),0);token=page.IsTruncated?page.NextContinuationToken:undefined;}while(token);
 const encoded=Buffer.from(JSON.stringify(inventory));if(existingBytes+bytes+encoded.length>maxBytes)throw new Error('BACKUP_RETAINED_BUDGET_EXCEEDED');
 const id=`${Date.now()}-${randomUUID()}`,root=backupId(id);
 for(const f of inventory.files){await storage.client.send(new PutObjectCommand({Bucket:storage.config.bucket,Key:root+f.file,Body:createReadStream(join(directory,f.file)),ContentLength:f.size,ContentType:'application/octet-stream',CacheControl:'private, no-store'}));const head=await storage.client.send(new HeadObjectCommand({Bucket:storage.config.bucket,Key:root+f.file}));if(head.ContentLength!==f.size)throw new Error('BACKUP_UPLOAD_SIZE_FAILED');const remote=await storage.client.send(new GetObjectCommand({Bucket:storage.config.bucket,Key:root+f.file}));if(!remote.Body)throw new Error('BACKUP_UPLOAD_CHECKSUM_FAILED');const hash=createHash('sha256');let count=0;for await(const chunk of remote.Body as AsyncIterable<Uint8Array>){count+=chunk.length;if(count>f.size)throw new Error('BACKUP_UPLOAD_CHECKSUM_FAILED');hash.update(chunk);}if(count!==f.size||hash.digest('hex')!==f.hash)throw new Error('BACKUP_UPLOAD_CHECKSUM_FAILED');}
 // Completion marker is uploaded last; failed/partial copies remain for diagnosis.
 await storage.client.send(new PutObjectCommand({Bucket:storage.config.bucket,Key:root+'complete.json',Body:encoded,ContentType:'application/json',CacheControl:'private, no-store'}));
 return {id,bytes,files:inventory.files.length};
}
export async function fetchBackup(storage:S3EvidenceStorage,id:string,directory:string,password:string){
 const root=backupId(id),marker=await storage.client.send(new GetObjectCommand({Bucket:storage.config.bucket,Key:root+'complete.json'}));
 if(!marker.Body||!marker.ContentLength||marker.ContentLength>20_000_000)throw new Error('BACKUP_INVENTORY_SIZE');
 const inventory=inventorySchema.parse(JSON.parse(await marker.Body.transformToString()));
 if(new Set(inventory.files.map(f=>f.file)).size!==inventory.files.length||!inventory.files.some(f=>f.file==='database.enc')||!inventory.files.some(f=>f.file==='manifest.enc'))throw new Error('BACKUP_INVENTORY_INVALID');
 await mkdir(directory,{recursive:false,mode:0o700});
 for(const f of inventory.files){const object=await storage.client.send(new GetObjectCommand({Bucket:storage.config.bucket,Key:root+f.file}));if(!object.Body||object.ContentLength!==f.size)throw new Error('BACKUP_DOWNLOAD_SIZE_FAILED');const hash=createHash('sha256');let size=0;const tap=new Transform({transform(chunk,_e,done){size+=chunk.length;if(size>f.size){done(new Error('BACKUP_SIZE_FAILED'));return;}hash.update(chunk);done(null,chunk);}});await pipeline(object.Body as AsyncIterable<Uint8Array>,tap,createWriteStream(join(directory,f.file),{flags:'wx',mode:0o600}));if(size!==f.size||hash.digest('hex')!==f.hash)throw new Error('BACKUP_DOWNLOAD_CHECKSUM_FAILED');}
 const manifest=await verifyBackup(directory,password);if(inventory.files.length!==manifest.objects.length+2)throw new Error('BACKUP_INVENTORY_INVALID');
 return {files:inventory.files.length,objects:manifest.objects.length};
}
export async function retentionPlan(storage:S3EvidenceStorage,days:number,now=Date.now()){
 if(!Number.isInteger(days)||days<1||days>365)throw new Error('BACKUP_RETENTION_INVALID');
 const markers:string[]=[];let token:string|undefined;
 do{const page=await storage.client.send(new ListObjectsV2Command({Bucket:storage.config.bucket,Prefix:prefix,ContinuationToken:token}));for(const object of page.Contents??[]){const match=object.Key?.match(/^communicate-pos-backups\/([0-9]{13}-[a-f0-9-]{36})\/complete\.json$/);if(match)markers.push(match[1]);}token=page.IsTruncated?page.NextContinuationToken:undefined;}while(token);
 const sorted=markers.sort().reverse();return sorted.filter((id,i)=>i>0&&Number(id.slice(0,13))<now-days*86400000);
}
export async function removeExpiredBackup(storage:S3EvidenceStorage,id:string,confirmation:string,days=3,now=Date.now()){
 if(confirmation!==`DELETE_EXPIRED:${id}`)throw new Error('BACKUP_RETENTION_CONFIRMATION_REQUIRED');
 if(!(await retentionPlan(storage,days,now)).includes(id))throw new Error('BACKUP_NOT_EXPIRED_OR_LAST_COPY');
 const root=backupId(id);let token:string|undefined;const keys:string[]=[];
 do{const page=await storage.client.send(new ListObjectsV2Command({Bucket:storage.config.bucket,Prefix:root,ContinuationToken:token}));keys.push(...(page.Contents??[]).flatMap(o=>o.Key?[o.Key]:[]));token=page.IsTruncated?page.NextContinuationToken:undefined;}while(token);
 // Marker first prevents treating an interrupted removal as a complete copy.
 keys.sort((a,b)=>Number(b.endsWith('complete.json'))-Number(a.endsWith('complete.json')));
 for(const key of keys)await storage.client.send(new DeleteObjectCommand({Bucket:storage.config.bucket,Key:key}));
 return {deleted:keys.length};
}
export async function recordBackupStatus(path:string,result:Record<string,unknown>){await writeFile(path,JSON.stringify({...result,finishedAt:new Date().toISOString()}),{mode:0o600});}
export async function readInventoryFile(path:string){return inventorySchema.parse(JSON.parse(await readFile(path,'utf8')));}
