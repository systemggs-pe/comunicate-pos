import type {PrismaClient} from '@prisma/client';
import {evidenceTestStorage} from './evidence';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {expect} from 'vitest';
import type {loginAgent} from './auth';
import {testOrigin} from './auth';
import {checksum} from '../../server/evidence/image';
type Agent=Awaited<ReturnType<typeof loginAgent>>;
type Input={idempotencyKey:string;requests:{value:string}[];evidence?:{assetId:string;category:string;imeiValues:string[]}[]};
const drafts=new WeakMap<Agent,Map<string,Promise<Input['evidence']>>>();
// Explicit synthetic upload fixture: no business rows are inserted before the API transaction.
// Cache the operation draft for idempotency/concurrency tests, just as the UI does.
export async function registrationIdentity<T extends object>(agent:Agent,body:T,satisfied:{category:string;imeiValues:string[]}[]=[]):Promise<T>{
 const input=body as T & Input;
 let cache=drafts.get(agent);if(!cache){cache=new Map();drafts.set(agent,cache);}
 let pending=cache.get(input.idempotencyKey);
 if(!pending){pending=(async()=>{
  const links=[...(input.evidence??[])];
  for(const category of ['DNI_FRONT','DNI_BACK']){
   const values=input.requests.map(r=>r.value).filter(value=>![...links,...satisfied].some(l=>l.category===category&&l.imeiValues.includes(value)));
   if(!values.length)continue;
   const bytes=await sharp({create:{width:80,height:120,channels:3,background:category==='DNI_FRONT'?'#123456':'#654321'}}).png().toBuffer();
   const init=await agent.post('/api/evidence/uploads').set('Origin',testOrigin).send({operationKey:input.idempotencyKey,idempotencyKey:randomUUID(),category,mimeType:'image/png',fileSize:bytes.length,checksum:checksum(bytes)});
   expect(init.status,JSON.stringify(init.body)).toBe(201);
   expect((await fetch(init.body.uploadUrl,{method:'PUT',headers:init.body.headers,body:new Uint8Array(bytes)})).status).toBe(200);
   const verified=await agent.post(`/api/evidence/uploads/${init.body.assetId}/verify`).set('Origin',testOrigin).send({});expect(verified.status,JSON.stringify(verified.body)).toBe(200);
   links.push({assetId:init.body.assetId,category,imeiValues:values});
  }return links;
 })();cache.set(input.idempotencyKey,pending);}
 return {...input,evidence:await pending};
}

export async function postRegistration<T extends object>(agent:Agent,input:T){const body=await registrationIdentity(agent,input);return agent.post('/api/registration-operations').set('Origin',testOrigin).send(body);}

// Historical fixture only: satisfy new-registration validation through real uploads,
// then remove newly introduced fixture associations to represent pre-vault records.
// Dedicated AUD-02 tests cover retention/reuse of new registrations without this fixture.
export async function postLegacyRegistration<T extends object>(db:PrismaClient,agent:Agent,input:T){
 const shaped=input as T & Input & {client:{dni:string}};
 const docs=await db.clientDocument.findMany({where:{client:{dni:shaped.client.dni},status:'CURRENT',expiresAt:{gt:new Date()}}});
 const prepared=await registrationIdentity(agent,input,docs.map(d=>({category:d.category,imeiValues:shaped.requests.map(r=>r.value)})));
 const evidence=(prepared as T & Input).evidence??[],original=new Set((shaped.evidence??[]).map(l=>l.assetId));
 const added=evidence.filter(l=>!original.has(l.assetId)).map(l=>l.assetId);
 const response=await agent.post('/api/registration-operations').set('Origin',testOrigin).send(prepared);
 if(response.status===201){
  await db.clientDocument.deleteMany({where:{evidenceAssetId:{in:evidence.map(l=>l.assetId)},id:{notIn:docs.map(d=>d.id)}}});
  await db.registrationEvidence.deleteMany({where:{evidenceAssetId:{in:added}}});
  const storage=evidenceTestStorage();try{for(const asset of await db.evidenceAsset.findMany({where:{id:{in:added}}})){await storage.delete(asset.storageKey);if(asset.stagingKey)await storage.delete(asset.stagingKey);}await db.evidenceAsset.deleteMany({where:{id:{in:added}}});}finally{storage.client.destroy();}
 }return response;
}
