import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {PrismaClient} from '@prisma/client';
import sharp from 'sharp';
import request from 'supertest';
import {phase9Fixture,fixtureEmail,fixturePassword,fixtureOrigin} from '../../scripts/lib/phase9-fixture';
import {createBackup,restoreBackup,recoveryDatabase} from '../../server/ops/recovery';
import {S3EvidenceStorage} from '../../server/storage/s3';
import {createApp} from '../../server/app';
import {checksum} from '../../server/evidence/image';
import {cleanupEvidence} from '../../server/evidence/lifecycle';

it('expediente y referencias sobreviven backup cifrado, restauración aislada y reinicio real de MinIO',async()=>{
 const fixture=await phase9Fixture(),suffix=randomUUID().replaceAll('-',''),container=`communicate-mvp-storage-${suffix}`;
 const target=new URL(fixture.databaseUrl);target.pathname=`/communicate_pos_restore_${suffix}`;const name=recoveryDatabase(target.toString(),true).name;
 const password=randomUUID()+randomUUID(),directory=`.test-results/mvp/recovery-${suffix}`;
 const restoredDb=new PrismaClient({datasources:{db:{url:target.toString()}}});let storage:S3EvidenceStorage|undefined,createdAsset:string|undefined,createdDoc:string|undefined,started=false;
 const removeOwnContainer=()=>{const label=docker(['inspect','--format',`{{ index .Config.Labels "communicate.mvp.lifecycle" }}`,container]);if(label!==suffix)throw Error('SYNTHETIC_CONTAINER_IDENTITY_MISMATCH');docker(['rm','-f','-v',container]);};
 const docker=(args:string[])=>{const result=spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:60000});if(result.status!==0)throw Error('SYNTHETIC_DOCKER_OPERATION_FAILED');return result.stdout.trim();};
 try{
  // No published fixed port, no shared MinIO restart, no product credentials.
  docker(['run','-d','--name',container,'--label',`communicate.mvp.lifecycle=${suffix}`,'-p','127.0.0.1::9000','-e','MINIO_ROOT_USER=synthetic_mvp','-e','MINIO_ROOT_PASSWORD=synthetic-mvp-storage-only','communicate-pos-minio:7aac2a2','server','/data']);started=true;
  const port=docker(['port',container,'9000/tcp']).split(':').at(-1);let endpoint=`http://127.0.0.1:${port}`;
  async function ready(){const deadline=Date.now()+30000;while(Date.now()<deadline){try{if((await fetch(endpoint+'/minio/health/ready')).ok)return;}catch{/* booting */}await new Promise(resolve=>setTimeout(resolve,250));}throw Error('SYNTHETIC_MINIO_NOT_READY');}
  await ready();storage=new S3EvidenceStorage({endpoint,region:'us-east-1',bucket:`communicate-evidence-restore-${suffix}`,accessKeyId:'synthetic_mvp',secretAccessKey:'synthetic-mvp-storage-only',forcePathStyle:true,uploadTTL:30,downloadTTL:30});
  const sourceApp=createApp(fixture.db,{evidenceStorage:fixture.storage}),agent=request.agent(sourceApp);
  expect((await agent.post('/api/auth/login').set('Origin',fixtureOrigin).send({email:fixtureEmail,password:fixturePassword})).status).toBe(200);
  const owner=await fixture.db.registrationRequest.findUniqueOrThrow({where:{id:fixture.link.registrationRequestId},include:{imei:{include:{equipment:true}}}}),clientId=owner.imei.equipment.ownerId!;
  const bytes=await sharp({create:{width:100,height:150,channels:3,background:'#886644'}}).png().toBuffer();
  const uploaded=await agent.post(`/api/clients/${clientId}/documents`).query({category:'DNI_BACK',documentType:'MANUAL',purpose:'SYNTHETIC RECOVERY',authorizationReference:'SYNTHETIC CONSENT',confirmed:'true'}).set('Origin',fixtureOrigin).set('Content-Type','image/png').send(bytes);expect(uploaded.status,JSON.stringify(uploaded.body)).toBe(201);createdDoc=uploaded.body.id;createdAsset=uploaded.body.asset.id;
  const historical=await agent.post(`/api/clients/${clientId}/documents/history/${fixture.link.id}`).set('Origin',fixtureOrigin).send({purpose:'SYNTHETIC RECOVERY',authorizationReference:'SYNTHETIC CONSENT',confirmed:true});expect(historical.status,JSON.stringify(historical.body)).toBe(201);
  const documentIds=[createdDoc,historical.body.id];
  await mkdir('.test-results/mvp',{recursive:true});const saved=await createBackup({databaseUrl:fixture.databaseUrl,storage:fixture.storage,directory,password,quiesced:true});
  const restored=await restoreBackup({databaseUrl:target.toString(),storage,directory,password,confirmDatabase:name});expect(restored.objects).toBe(saved.objects);expect(await restoredDb.session.count()).toBe(0);
  const docs=await restoredDb.clientDocument.findMany({where:{id:{in:documentIds as string[]}},include:{evidenceAsset:true}});expect(docs).toHaveLength(2);expect(await restoredDb.registrationEvidence.count({where:{evidenceAssetId:historical.body.asset.id}})).toBe(2);
  docker(['restart',container]);endpoint=`http://127.0.0.1:${docker(['port',container,'9000/tcp']).split(':').at(-1)}`;await ready();const oldConfig=storage.config;storage.client.destroy();storage=new S3EvidenceStorage({...oldConfig,endpoint});
  const afterRestart=request.agent(createApp(restoredDb,{evidenceStorage:storage}));expect((await afterRestart.post('/api/auth/login').set('Origin',fixtureOrigin).send({email:fixtureEmail,password:fixturePassword})).status).toBe(200);
  for(const d of docs){const access=await afterRestart.get(`/api/clients/${clientId}/documents/${d.id}/access?download=true`);expect(access.status).toBe(200);const downloaded=await fetch(access.body.url);expect(downloaded.status).toBe(200);expect(checksum(Buffer.from(await downloaded.arrayBuffer()))).toBe(d.evidenceAsset.checksum);expect((await fetch(`${endpoint}/${storage.config.bucket}/${d.evidenceAsset.storageKey}`)).status).toBe(403);}
  expect((await request(createApp(restoredDb,{evidenceStorage:storage})).get(`/api/clients/${clientId}/documents`)).status).toBe(401);
 }finally{
  if(createdDoc)await fixture.db.clientDocument.deleteMany({where:{id:createdDoc}});if(createdAsset)await cleanupEvidence(fixture.db,fixture.storage,[createdAsset]);
  storage?.client.destroy();await restoredDb.$disconnect();await fixture.close();
  const adminUrl=new URL(target);adminUrl.pathname='/postgres';const admin=new PrismaClient({datasources:{db:{url:adminUrl.toString()}}});try{await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);}finally{await admin.$disconnect();}
  if(started)removeOwnContainer();
 }
},180000);
