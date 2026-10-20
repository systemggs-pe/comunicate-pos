import {afterAll,beforeEach,expect,it} from 'vitest';
import {PrismaClient} from '@prisma/client';
import request from 'supertest';
import {createApp} from '../../server/app';
import {clearEvidenceFixtures} from '../helpers/evidence';
import {seedTestAdmin,loginAgent,testOrigin,testEmail,testPassword} from '../helpers/auth';
import {postRegistration} from '../helpers/registration-identity';
import {workflowInput} from '../helpers/workflow';
import {fixtureImei} from '../helpers/imei';
const target=new URL(process.env.TEST_DATABASE_URL!);
if(!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/communicate_pos_test')throw Error('TEST DB ONLY');
const db=new PrismaClient({datasources:{db:{url:target.toString()}}}),app=createApp(db);
const old='123456789012345',correct=fixtureImei(880001);
let agent:Awaited<ReturnType<typeof loginAgent>>,equipmentId:string,imeiId:string,saleId:string;
const path=()=>`/api/equipment/${equipmentId}/imeis/${imeiId}`;
const body=(value=correct)=>({expectedValue:old,value,reason:'Cotejo manual con etiqueta del equipo sintético',confirm:true});
beforeEach(async()=>{
 await clearEvidenceFixtures(db);
 await db.$transaction([db.companySettings.deleteMany(),db.session.deleteMany(),db.authRateLimit.deleteMany(),db.registrationRequestHistory.deleteMany(),db.registrationRequest.deleteMany(),db.registrationOperation.deleteMany(),db.saleAccessory.deleteMany(),db.equipmentHistory.deleteMany(),db.auditLog.deleteMany(),db.saleEquipment.deleteMany(),db.sale.deleteMany(),db.imei.deleteMany(),db.equipment.deleteMany(),db.client.deleteMany(),db.user.deleteMany()]);
 await seedTestAdmin(db);agent=await loginAgent(app);
 const input=workflowInput();
 const sale=await agent.post('/api/sales').set('Origin',testOrigin).send({buyer:{client:input.client},items:[{equipment:{...input.equipment,imeis:input.imeis},unitPrice:'100.00'}],paymentMethod:'CASH'});
 expect(sale.status,JSON.stringify(sale.body)).toBe(201);saleId=sale.body.id;equipmentId=sale.body.equipment[0].equipmentId;
 const operation=await postRegistration(agent,{...input,expectedEquipmentId:equipmentId});expect(operation.status,JSON.stringify(operation.body)).toBe(201);
 imeiId=operation.body.requests[0].imeiId;
 // Deliberate synthetic legacy fixture. Never run this against a commercial DB.
 await db.imei.update({where:{id:imeiId},data:{value:old}});
});
afterAll(async()=>{await clearEvidenceFixtures(db);await db.$disconnect();});
it('AUD-10 historical invalid identifier remains searchable/readable without mutation',async()=>{
 const before=await db.imei.findUniqueOrThrow({where:{id:imeiId}}),audit=await db.auditLog.count();
 const lookup=await agent.get(`/api/equipment/by-imei/${old}`);expect(lookup.status).toBe(200);expect(lookup.body.id).toBe(equipmentId);
 expect((await agent.get(`/api/equipment?q=${old}`)).status).toBe(200);
 expect((await agent.get(`/api/sales/${saleId}`)).status).toBe(200);
 expect(await db.imei.findUniqueOrThrow({where:{id:imeiId}})).toEqual(before);expect(await db.auditLog.count()).toBe(audit);
});
it('AUD-10 invalid new sale and correction are rejected atomically; no repair or bypass',async()=>{
 const count=await db.sale.count();const input=workflowInput();
 const sale=await agent.post('/api/sales').set('Origin',testOrigin).send({buyer:{client:input.client},items:[{equipment:{...input.equipment,imeis:[{slot:1,value:old}]},unitPrice:'10.00'}],paymentMethod:'CASH'});expect(sale.status).toBe(400);
 for(const payload of [{...body(),value:old},{...body(),confirm:false},{...body(),reason:'x'}])expect((await agent.patch(path()).set('Origin',testOrigin).send(payload)).status).toBe(400);
 expect(await db.sale.count()).toBe(count);expect((await db.imei.findUniqueOrThrow({where:{id:imeiId}})).value).toBe(old);
 expect(await db.auditLog.count({where:{action:'IMEI_VALUE_CORRECTED'}})).toBe(0);
});
it('AUD-10 explicit authorized valid correction preserves sale, RECO, evidence and owner IDs',async()=>{
 const before={requests:await db.registrationRequest.findMany({orderBy:{id:'asc'}}),lines:await db.saleEquipment.findMany(),links:await db.registrationEvidence.findMany({orderBy:{id:'asc'}}),documents:await db.clientDocument.findMany({orderBy:{id:'asc'}}),equipment:await db.equipment.findUniqueOrThrow({where:{id:equipmentId}}),assets:await db.evidenceAsset.findMany({orderBy:{id:'asc'}})};
 const result=await agent.patch(path()).set('Origin',testOrigin).send(body());expect(result.status,JSON.stringify(result.body)).toBe(200);
 expect((await db.imei.findUniqueOrThrow({where:{id:imeiId}})).value).toBe(correct);
 expect(await db.registrationRequest.findMany({orderBy:{id:'asc'}})).toEqual(before.requests);expect(await db.saleEquipment.findMany()).toEqual(before.lines);expect(await db.registrationEvidence.findMany({orderBy:{id:'asc'}})).toEqual(before.links);expect(await db.clientDocument.findMany({orderBy:{id:'asc'}})).toEqual(before.documents);expect(await db.evidenceAsset.findMany({orderBy:{id:'asc'}})).toEqual(before.assets);expect(await db.equipment.findUniqueOrThrow({where:{id:equipmentId}})).toEqual(before.equipment);
 const actor=await db.user.findUniqueOrThrow({where:{email:testEmail}}),audit=await db.auditLog.findFirstOrThrow({where:{action:'IMEI_VALUE_CORRECTED',entityId:imeiId}});
 expect(audit.userId).toBe(actor.id);expect(audit.metadata).toMatchObject({reason:body().reason,previousSuffix:old.slice(-4),newSuffix:correct.slice(-4)});expect(JSON.stringify(audit.metadata)).not.toContain(old);
 expect(await db.equipmentHistory.count({where:{imeiId,userId:actor.id,eventType:'EQUIPMENT_UPDATED'}})).toBe(1);
 expect((await agent.get(`/api/equipment/by-imei/${correct}`)).body.id).toBe(equipmentId);
});
it('AUD-10 permission and conflict guards prevent unauthorized or duplicate correction',async()=>{
 expect((await request(app).patch(path()).set('Origin',testOrigin).send(body())).status).toBe(401);
 const role=await db.role.findUniqueOrThrow({where:{code:'SELLER'}});
 expect((await agent.post('/api/users').set('Origin',testOrigin).send({email:'review-seller@example.test',name:'Revisor sin permiso',password:testPassword,status:'ACTIVE',roleId:role.id})).status).toBe(201);
 const seller=await loginAgent(app,'review-seller@example.test');expect((await seller.patch(path()).set('Origin',testOrigin).send(body())).status).toBe(403);
 expect((await agent.patch(path()).set('Origin',testOrigin).send({...body(),expectedValue:'stale'})).status).toBe(409);
 const duplicate=(await db.imei.findFirstOrThrow({where:{equipmentId,id:{not:imeiId}}})).value;
 expect((await agent.patch(path()).set('Origin',testOrigin).send(body(duplicate))).status).toBe(409);
 expect((await db.imei.findUniqueOrThrow({where:{id:imeiId}})).value).toBe(old);
});
it('AUD-10 concurrent authorized corrections keep only one revision and retain associations',async()=>{
 const responses=await Promise.all([correct,fixtureImei(880002)].map(value=>agent.patch(path()).set('Origin',testOrigin).send(body(value))));
 expect(responses.map(r=>r.status).sort()).toEqual([200,409]);expect(await db.auditLog.count({where:{action:'IMEI_VALUE_CORRECTED',entityId:imeiId}})).toBe(1);expect(await db.registrationRequest.count({where:{imeiId}})).toBe(1);expect(await db.saleEquipment.count({where:{equipmentId}})).toBe(1);
});
