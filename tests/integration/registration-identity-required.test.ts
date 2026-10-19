import 'dotenv/config';
import {beforeEach,afterAll,it,expect} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {createApp} from '../../server/app';
import {createPosService} from '../../server/services/pos.service';
import {clearEvidenceFixtures,evidenceTestStorage} from '../helpers/evidence';
import {seedTestAdmin,loginAgent,testOrigin,testEmail} from '../helpers/auth';
import {workflowInput} from '../helpers/workflow';
import {fixtureImei} from '../helpers/imei';
const url=new URL(process.env.TEST_DATABASE_URL!);
if(url.pathname!=='/communicate_pos_test'||!['127.0.0.1','localhost'].includes(url.hostname))throw Error('ISOLATED DB REQUIRED');
const db=new PrismaClient({datasources:{db:{url:url.href}}}),storage=evidenceTestStorage(),app=createApp(db,{evidenceStorage:storage});
beforeEach(async()=>{await clearEvidenceFixtures(db);await db.$transaction([db.companySettings.deleteMany(),db.session.deleteMany(),db.authRateLimit.deleteMany(),db.registrationRequestHistory.deleteMany(),db.registrationRequest.deleteMany(),db.registrationOperation.deleteMany(),db.saleAccessory.deleteMany(),db.equipmentHistory.deleteMany(),db.auditLog.deleteMany(),db.saleEquipment.deleteMany(),db.sale.deleteMany(),db.imei.deleteMany(),db.equipment.deleteMany(),db.client.deleteMany(),db.user.deleteMany()]);await seedTestAdmin(db);});
afterAll(async()=>{await clearEvidenceFixtures(db);storage.client.destroy();await db.$disconnect();});
const counts=async()=>({clients:await db.client.count(),equipment:await db.equipment.count(),imeis:await db.imei.count(),operations:await db.registrationOperation.count(),requests:await db.registrationRequest.count(),history:await db.registrationRequestHistory.count(),links:await db.registrationEvidence.count()});
it.each([undefined,false,true])('API requires both DNI sides regardless of legacy flag %s and rolls back all business rows',async flag=>{
 const agent=await loginAgent(app),before=await counts();const response=await agent.post('/api/registration-operations').set('Origin',testOrigin).send({...workflowInput(),...(flag===undefined?{}:{requireIdentityPhotos:flag})});
 expect(response.status).toBe(400);expect(response.body.error.code).toBe('REGISTRATION_IDENTITY_REQUIRED');expect(await counts()).toEqual(before);
});
it('direct service cannot bypass DNI validation without an HTTP layer',async()=>{
 const actor=await db.user.findUniqueOrThrow({where:{email:testEmail}}),before=await counts();
 await expect(createPosService(db,{userId:actor.id}).createRegistrationOperation({...workflowInput(),requireIdentityPhotos:false})).rejects.toMatchObject({code:'REGISTRATION_IDENTITY_REQUIRED'});expect(await counts()).toEqual(before);
});
async function prepareIdentity(expired=false,oneSide=false){
 const agent=await loginAgent(app),input=workflowInput(),client=await db.client.create({data:input.client});
 for(const [category,color] of (oneSide?[['DNI_FRONT','#123456']]:[['DNI_FRONT','#123456'],['DNI_BACK','#654321']])){
  const file=await sharp({create:{width:80,height:120,channels:3,background:color}}).png().toBuffer();
  const saved=await agent.post(`/api/clients/${client.id}/documents`).query({confirmed:'true',purpose:'SYNTHETIC REGISTRATION',authorizationReference:'SYNTHETIC CONSENT',category,documentType:'MANUAL'}).set('Origin',testOrigin).set('Content-Type','image/png').send(file);
  expect(saved.status,JSON.stringify(saved.body)).toBe(201);
 }
 if(expired)await db.clientDocument.updateMany({where:{clientId:client.id},data:{expiresAt:new Date(0)}});
 return {agent,input,client};
}
it('automatically reuses stored DNI for both IMEIs and the next procedure without duplicating physical files',async()=>{
 const {agent,input}=await prepareIdentity();const submit=(body:object)=>agent.post('/api/registration-operations').set('Origin',testOrigin).send(body);
 const first=await submit(input);expect(first.status,JSON.stringify(first.body)).toBe(201);expect(first.body.requests).toHaveLength(2);expect(await db.registrationEvidence.count()).toBe(4);expect(await db.equipment.count()).toBe(1);
 const next={...input,idempotencyKey:randomUUID(),imeis:input.imeis.map((i,index)=>({...i,value:fixtureImei(77000+index)}))};next.requests=next.requests.map((r,index)=>({...r,value:next.imeis[index].value}));
 const second=await submit(next);expect(second.status,JSON.stringify(second.body)).toBe(201);expect(await db.registrationEvidence.count()).toBe(8);expect(await db.evidenceAsset.count()).toBe(2);expect(await db.clientDocument.count()).toBe(2);
 const repeat=await submit(next);expect(repeat.status).toBe(201);expect(repeat.body.id).toBe(second.body.id);expect(await db.registrationRequest.count()).toBe(4);
});
it.each(['one-side','expired','different-client'])('rejects %s identity and leaves preexisting rows unchanged',async scenario=>{
 const {agent,input}=await prepareIdentity(scenario==='expired',scenario==='one-side');const before=await counts();
 const response=await agent.post('/api/registration-operations').set('Origin',testOrigin).send({...input,client:scenario==='different-client'?{...input.client,dni:'70000002'}:input.client});expect(response.status).toBe(400);expect(response.body.error.code).toBe('REGISTRATION_IDENTITY_REQUIRED');expect(await counts()).toEqual(before);
});

