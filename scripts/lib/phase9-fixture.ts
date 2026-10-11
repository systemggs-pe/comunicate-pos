import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {CreateBucketCommand,HeadBucketCommand} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import {createApp} from '../../server/app.js';
import {createAuthService} from '../../server/services/auth.service.js';
import {S3EvidenceStorage,storageConfig} from '../../server/storage/s3.js';
import {checksum} from '../../server/evidence/image.js';
import {workflowInput} from '../../tests/helpers/workflow.js';
import {recoveryDatabase} from '../../server/ops/recovery.js';
export const fixtureEmail='phase9-load@example.test',fixturePassword='synthetic-phase9-password-only-2026',fixtureOrigin='http://127.0.0.1:5175';
export async function phase9Fixture(){
 const url=new URL(process.env.TEST_DATABASE_URL??'');url.pathname='/communicate_pos_phase9_load';const databaseUrl=url.toString();recoveryDatabase(databaseUrl);const adminUrl=new URL(url);adminUrl.pathname='/postgres';const admin=new PrismaClient({datasources:{db:{url:adminUrl.toString()}}});let fresh=false;
 try{const existing=await admin.$queryRaw<{datname:string}[]>`SELECT datname FROM pg_database WHERE datname='communicate_pos_phase9_load'`;if(!existing.length){await admin.$executeRawUnsafe('CREATE DATABASE "communicate_pos_phase9_load"');fresh=true;}}finally{await admin.$disconnect();}
 if(fresh){const migration=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env:{...process.env,DATABASE_URL:databaseUrl},stdio:'pipe',windowsHide:true});if(migration.status!==0)throw new Error('PHASE9_FIXTURE_MIGRATIONS_FAILED');}
 const config=storageConfig();if(!config.endpoint||!['localhost','127.0.0.1'].includes(new URL(config.endpoint).hostname))throw new Error('PHASE9_LOCAL_STORAGE_REQUIRED');const storage=new S3EvidenceStorage({...config,bucket:'communicate-evidence-phase9-load',downloadTTL:60});
 try{await storage.client.send(new HeadBucketCommand({Bucket:storage.config.bucket}));}catch(error){if((error as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode!==404)throw error;await storage.client.send(new CreateBucketCommand({Bucket:storage.config.bucket}));}
 const db=new PrismaClient({datasources:{db:{url:databaseUrl}},log:[{emit:'event',level:'query'}]}),app=createApp(db,{evidenceStorage:storage});const server=app.listen(0,'127.0.0.1');await new Promise<void>(yes=>server.once('listening',yes));const address=server.address();if(!address||typeof address==='string')throw new Error('FIXTURE_SERVER_FAILED');const base=`http://127.0.0.1:${address.port}`;
 let cookie='';async function api(path:string,body?:unknown){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:fixtureOrigin,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});if(!response.ok)throw new Error(`FIXTURE_HTTP_${response.status}`);if(path==='/api/auth/login')cookie=response.headers.get('set-cookie')!.split(';')[0];return await response.json();}
 try{
 if(fresh){await createAuthService(db).bootstrap({name:'Phase9 Synthetic',email:fixtureEmail,password:fixturePassword});await api('/api/auth/login',{email:fixtureEmail,password:fixturePassword});await db.client.createMany({data:Array.from({length:1000},(_,index)=>({dni:String(60000000+index),firstName:'Synthetic',lastName:`Load ${index}`}))});
 for(let index=0;index<20;index++){const input=workflowInput();input.client.dni=String(60000000+index);input.imeis.forEach((imei,slot)=>{imei.value=String(350000000000000+index*2+slot);input.requests[slot].value=imei.value;});let evidence:unknown[]=[];
 if(index===0){const file=await sharp({create:{width:80,height:120,channels:3,background:'#1166aa'}}).png().toBuffer();const init=await api('/api/evidence/uploads',{operationKey:input.idempotencyKey,idempotencyKey:randomUUID(),category:'DNI_FRONT',mimeType:'image/png',fileSize:file.length,checksum:checksum(file)}) as {uploadUrl:string;headers:Record<string,string>;assetId:string};const uploaded=await fetch(init.uploadUrl,{method:'PUT',headers:init.headers,body:new Uint8Array(file)});if(!uploaded.ok)throw new Error('FIXTURE_UPLOAD_FAILED');await api(`/api/evidence/uploads/${init.assetId}/verify`,{});evidence=[{assetId:init.assetId,category:'DNI_FRONT',imeiValues:input.imeis.map(i=>i.value)}];}
 await api('/api/registration-operations',{...input,evidence});const saleImeis=input.imeis.map((imei,slot)=>({...imei,value:String(360000000000000+index*2+slot)}));await api('/api/sales',{buyer:{client:input.client},items:[{equipment:{...input.equipment,imeis:saleImeis},unitPrice:'100.10'}],accessories:[{name:'SYNTHETIC CABLE',quantity:2,unitPrice:'0.10'}],discount:'0.05',occurredAt:'2026-10-10T12:30:00-05:00',paymentMethod:'YAPE'});
 }
 }else{if(await db.client.count()!==1000||await db.sale.count()!==20||await db.registrationRequest.count()!==40||await db.user.count()!==1)throw new Error('FIXTURE_STATE_MISMATCH');await db.authRateLimit.deleteMany();await api('/api/auth/login',{email:fixtureEmail,password:fixturePassword});}
 const link=await db.registrationEvidence.findFirstOrThrow();return {db,storage,databaseUrl,base,cookie,link,api,close:async()=>{await new Promise<void>(yes=>server.close(()=>yes()));storage.client.destroy();await db.$disconnect();}};
 }catch(error){await new Promise<void>(yes=>server.close(()=>yes()));storage.client.destroy();await db.$disconnect();throw error;}
}
