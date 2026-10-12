import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {CreateBucketCommand,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';
import express from 'express';
import {PrismaClient} from '@prisma/client';
import {phase9Fixture} from '../../scripts/lib/phase9-fixture';
import {runWorker} from '../../server/ops/worker';
import {S3EvidenceStorage} from '../../server/storage/s3';
import {createBackup,verifyBackup} from '../../server/ops/recovery';
import {publishBackup,fetchBackup,retentionPlan,removeExpiredBackup} from '../../scripts/lib/cloud-backups';
import {startHttp} from '../../server/ops/runtime';
import {createApp} from '../../server/app';
import request from 'supertest';
let f:Awaited<ReturnType<typeof phase9Fixture>>;
beforeAll(async()=>{f=await phase9Fixture();await mkdir('.test-results/phase10a',{recursive:true});},60000);
afterAll(async()=>{await f?.close();});
const options=()=>({lockUrl:f.databaseUrl,batchSize:5,maxBatches:2,timeoutMs:10000});
it('real unavailable PostgreSQL responds safe503 without removing session cookie or leaking DSN',async()=>{
 const offline=new PrismaClient({datasources:{db:{url:'postgresql://synthetic:synthetic@127.0.0.1:9/synthetic?connect_timeout=1'}}});try{const app=createApp(offline,{evidenceStorage:f.storage});expect((await request(app).get('/api/health')).status).toBe(200);const result=await request(app).get('/api/auth/me').set('Cookie',f.cookie);expect(result.status).toBe(503);expect(result.body.error.code).toBe('DATABASE_UNAVAILABLE');expect(result.headers['set-cookie']).toBeUndefined();expect(JSON.stringify(result.body)).not.toContain('synthetic');}finally{await offline.$disconnect();}
});
it('worker retries safe deletion without altering shared READY evidence and remains idempotent',async()=>{
 const admin=await f.db.user.findFirstOrThrow(),id=randomUUID(),storageKey=`evidence/${randomUUID()}.webp`;
 await f.storage.upload(storageKey,Buffer.from('synthetic expired object'));
 await f.db.evidenceAsset.create({data:{id,storageKey,createdById:admin.id,category:'DEVICE_BOX',idempotencyKey:randomUUID(),operationKey:randomUUID(),expectedMimeType:'image/png',expectedSize:24,expectedChecksum:'a'.repeat(64),expiresAt:new Date(0),uploadExpiresAt:new Date(0)}});
 const links=await f.db.registrationEvidence.count(),fail=new S3EvidenceStorage(f.storage.config),original=fail.delete.bind(fail);fail.delete=async()=>{throw new Error('synthetic secret must not log');};
 try{const result=await runWorker(f.db,fail,options());expect(result.status).toBe('PARTIAL');expect(result.pending).toBeGreaterThan(0);expect((await f.db.evidenceAsset.findUniqueOrThrow({where:{id}})).deleteAttempts).toBeGreaterThan(0);fail.delete=original;const retried=await runWorker(f.db,fail,options());expect(retried.deleted).toBeGreaterThan(0);expect(await f.db.evidenceAsset.findUnique({where:{id}})).toBeNull();expect(await f.storage.exists(storageKey)).toBe(false);expect(await f.db.registrationEvidence.count()).toBe(links);expect((await runWorker(f.db,fail,options())).deleted).toBe(0);}finally{fail.client.destroy();}
});
it('worker lock excludes overlapping invocations and releases after interrupted transaction',async()=>{
 const lock=new PrismaClient({datasources:{db:{url:f.databaseUrl}}});try{await lock.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(741021,10) AS locked`;expect(await runWorker(f.db,f.storage,options())).toMatchObject({status:'PARTIAL',reason:'LOCK_BUSY',deleted:0});},{timeout:15000});expect((await runWorker(f.db,f.storage,options())).reason).not.toBe('LOCK_BUSY');}finally{await lock.$disconnect();}
});
it('maintenance and SIGTERM signal prevent cleanup; unknown objects are reported without deleting',async()=>{
 const key=`staging/${randomUUID()}`;await f.storage.client.send(new PutObjectCommand({Bucket:f.storage.config.bucket,Key:key,Body:Buffer.from('synthetic unknown')}));try{expect(await runWorker(f.db,f.storage,{...options(),maintenance:true})).toMatchObject({status:'SUCCESS',reason:'MAINTENANCE',deleted:0});const aborted=new AbortController();aborted.abort();expect((await runWorker(f.db,f.storage,{...options(),signal:aborted.signal})).status).toBe('PARTIAL');const result=await runWorker(f.db,f.storage,options());expect(result.orphans).toBeGreaterThan(0);expect(await f.storage.exists(key)).toBe(true);}finally{await f.storage.delete(key);}
});
it('HTTP supervisor drains an in-flight request before disconnect, tolerates repeat shutdown and restarts',async()=>{
 const app=express();app.get('/health',(_req,res)=>res.json({status:'ok'}));let entered:()=>void=()=>undefined,release:()=>void=()=>undefined;const started=new Promise<void>(yes=>entered=yes),continueRequest=new Promise<void>(yes=>release=yes);app.get('/slow',async(_req,res)=>{entered();await continueRequest;res.end('finished');});let disconnected=false;const runtime=startHttp(app,0,async()=>{disconnected=true;});await new Promise<void>(yes=>runtime.server.once('listening',yes));const address=runtime.server.address();if(!address||typeof address==='string')throw new Error('LISTEN_FAILED');const response=fetch(`http://127.0.0.1:${address.port}/slow`);await started;const closing=runtime.shutdown();expect(disconnected).toBe(false);release();expect(await (await response).text()).toBe('finished');await closing;await runtime.shutdown();expect(disconnected).toBe(true);const restarted=startHttp(app,address.port,async()=>undefined);try{await new Promise<void>(yes=>restarted.server.once('listening',yes));expect((await fetch(`http://127.0.0.1:${address.port}/health`)).status).toBe(200);}finally{await restarted.shutdown();}
});
it('existing encrypted recovery uploads/downloads to isolated S3 backup bucket; detects corruption and plans explicit retention',async()=>{
 const id=randomUUID(),password=randomUUID()+randomUUID(),directory=`.test-results/phase10a/source-${id}`,backup=new S3EvidenceStorage({...f.storage.config,bucket:`communicate-backup-test-${id}`});await backup.client.send(new CreateBucketCommand({Bucket:backup.config.bucket}));
 try{await createBackup({databaseUrl:f.databaseUrl,storage:f.storage,directory,password,quiesced:true});const published=await publishBackup(backup,directory,password,1_000_000_000),destination=`.test-results/phase10a/download-${id}`;expect(await fetchBackup(backup,published.id,destination,password)).toMatchObject({files:published.files});await verifyBackup(destination,password);expect((await readFile(destination+'/manifest.enc')).equals(await readFile(directory+'/manifest.enc'))).toBe(true);expect(await retentionPlan(backup,1,Date.now()+10*86400000)).toEqual([]);await expect(removeExpiredBackup(backup,published.id,'wrong')).rejects.toThrow('CONFIRMATION');await expect(publishBackup(backup,directory,password,1)).rejects.toThrow('BUDGET');
 const second=await publishBackup(backup,directory,password,1_000_000_000);expect(await retentionPlan(backup,1,Date.now()+10*86400000)).toEqual([published.id]);expect((await removeExpiredBackup(backup,published.id,`DELETE_EXPIRED:${published.id}`,1,Date.now()+10*86400000)).deleted).toBeGreaterThan(0);await expect(removeExpiredBackup(backup,second.id,`DELETE_EXPIRED:${second.id}`,1,Date.now()+10*86400000)).rejects.toThrow('LAST_COPY');const object=await backup.client.send(new GetObjectCommand({Bucket:backup.config.bucket,Key:`communicate-pos-backups/${second.id}/manifest.enc`}));const bytes=Buffer.from(await object.Body!.transformToByteArray());bytes[40]^=1;await backup.client.send(new PutObjectCommand({Bucket:backup.config.bucket,Key:`communicate-pos-backups/${second.id}/manifest.enc`,Body:bytes}));await expect(fetchBackup(backup,second.id,`.test-results/phase10a/corrupt-${id}`,password)).rejects.toThrow('CHECKSUM');const local=Buffer.from(await readFile(directory+'/manifest.enc'));local[40]^=1;await writeFile(directory+'/manifest.enc',local);await expect(verifyBackup(directory,password)).rejects.toThrow();
 }finally{backup.client.destroy();}
},120000);
