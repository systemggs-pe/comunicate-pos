import {companyDefaults} from '../../shared/company';
import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {beforeEach,afterAll,it,expect} from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import {createApp} from '../../server/app';
import {checksum} from '../../server/evidence/image';
import {clearEvidenceFixtures,evidenceTestStorage} from '../helpers/evidence';
import {loginAgent,seedTestAdmin,testOrigin,testEmail} from '../helpers/auth';
import {workflowInput} from '../helpers/workflow';
import {inspectEvidencePdf} from '../helpers/evidence-pdf';
import {permissionKeys} from '../../shared/auth';
const url=process.env.TEST_DATABASE_URL!,target=new URL(url);if(!['localhost','127.0.0.1'].includes(target.hostname)||target.pathname!=='/communicate_pos_test')throw Error('ISOLATED DB ONLY');
const db=new PrismaClient({datasources:{db:{url}}}),storage=evidenceTestStorage(),app=createApp(db,{evidenceStorage:storage});
let agent:Awaited<ReturnType<typeof loginAgent>>;
beforeEach(async()=>{await clearEvidenceFixtures(db);await db.$transaction([db.companySettings.deleteMany(),db.session.deleteMany(),db.authRateLimit.deleteMany(),db.registrationRequestHistory.deleteMany(),db.registrationRequest.deleteMany(),db.registrationOperation.deleteMany(),db.saleAccessory.deleteMany(),db.equipmentHistory.deleteMany(),db.auditLog.deleteMany(),db.saleEquipment.deleteMany(),db.sale.deleteMany(),db.imei.deleteMany(),db.equipment.deleteMany(),db.client.deleteMany(),db.user.deleteMany()]);const role=await db.role.findUniqueOrThrow({where:{code:'SUPERADMIN'}});await db.rolePermission.deleteMany({where:{roleId:role.id}});await db.rolePermission.createMany({data:permissionKeys.map(permissionKey=>({roleId:role.id,permissionKey}))});await seedTestAdmin(db);agent=await loginAgent(app);});
afterAll(async()=>{await clearEvidenceFixtures(db);storage.client.destroy();await db.$disconnect();});
const endpoint=(id:string)=>`/api/registration-requests/${id}/evidence-pdf`;
async function fixture(input:object=workflowInput()) {const response=await agent.post('/api/registration-operations').set('Origin',testOrigin).send(input);expect(response.status,JSON.stringify(response.body)).toBe(201);return response.body.requests as {id:string;code:string;imei:{value:string}}[];}
async function image(requestId:string,category:string,color='#765432'){
 const bytes=await sharp({create:{width:80,height:120,channels:3,background:color}}).png().toBuffer();
 const init=await agent.post('/api/evidence/uploads').set('Origin',testOrigin).send({idempotencyKey:randomUUID(),requestId,category,mimeType:'image/png',fileSize:bytes.length,checksum:checksum(bytes)});expect(init.status).toBe(201);
 expect((await fetch(init.body.uploadUrl,{method:'PUT',headers:init.body.headers,body:new Uint8Array(bytes)})).status).toBe(200);
 expect((await agent.post(`/api/evidence/uploads/${init.body.assetId}/verify`).set('Origin',testOrigin).send({})).status).toBe(200);
 expect((await agent.post(`/api/registration-requests/${requestId}/evidence`).set('Origin',testOrigin).send({assetId:init.body.assetId,category,expectedEvidenceId:null,confirm:true})).status).toBe(200);
 return db.evidenceAsset.findUniqueOrThrow({where:{id:init.body.assetId}});
}
it('A4 por RECO, sin fotos permitido, configuración real y reimpresión sin duplicar',async()=>{
 const rows=await fixture();expect((await agent.patch('/api/settings/company').set('Origin',testOrigin).send({...companyDefaults,businessName:'EMPRESA SINTÉTICA'})).status).toBe(200);
 for(const [index,row] of rows.entries()){const result=await agent.post(endpoint(row.id)).set('Origin',testOrigin).send({});expect(result.status).toBe(200);expect(result.headers['cache-control']).toBe('no-store');expect(result.body.fileName).toBe(`${row.code}-EVIDENCIAS.pdf`);const parsed=inspectEvidencePdf(Buffer.from(result.body.pdfBase64,'base64'));expect(parsed.pages).toHaveLength(1);expect(parsed.text).toContain(row.imei.value);expect(parsed.text).not.toContain(rows[1-index].imei.value);expect(parsed.text).toContain('SIN FOTOGRAFÍAS');expect(parsed.text).toContain('EMPRESA SINTÉTICA');expect((await agent.post(endpoint(row.id)).set('Origin',testOrigin).send({})).status).toBe(200);}
 expect(await db.registrationRequest.count()).toBe(2);expect(await db.registrationOperation.count()).toBe(1);expect(await db.equipment.count()).toBe(1);expect(await db.client.count()).toBe(1);
});
it('MinIO real: cinco categorías, imágenes proporcionadas y ninguna foto del otro RECO',async()=>{
 const [first,second]=await fixture();for(const category of ['DNI_FRONT','DNI_BACK','PURCHASE_RECEIPT','DEVICE_BOX','LOGICAL_IMEI'])await image(first.id,category);await image(second.id,'LOGICAL_IMEI','#112233');
 const result=await agent.post(endpoint(first.id)).set('Origin',testOrigin).send({});expect(result.status,JSON.stringify(result.body.error)).toBe(200);const parsed=inspectEvidencePdf(Buffer.from(result.body.pdfBase64,'base64'));expect(parsed.pages).toHaveLength(6);expect(parsed.pages.flatMap(p=>p.images)).toHaveLength(5);for(const title of ['DNI FRONTAL','DNI POSTERIOR','BOLETA','CAJA DEL EQUIPO','IMEI LÓGICO'])expect(parsed.text).toContain(title);expect(parsed.text).not.toContain(second.imei.value);
 const other=await agent.post(endpoint(second.id)).set('Origin',testOrigin).send({});expect(inspectEvidencePdf(Buffer.from(other.body.pdfBase64,'base64')).pages).toHaveLength(2);
});
it('falta archivo: conserva registros y permite reintentar solamente el documento',async()=>{
 const [row]=await fixture(),asset=await image(row.id,'DNI_FRONT'),bytes=await storage.download(asset.storageKey,10485760);await storage.delete(asset.storageKey);
 const failed=await agent.post(endpoint(row.id)).set('Origin',testOrigin).send({});expect(failed.status).toBe(503);expect(failed.body.error.code).toBe('EVIDENCE_PDF_UNAVAILABLE');expect(await db.registrationRequest.count()).toBe(2);expect(await db.registrationEvidence.count()).toBe(1);
 await storage.upload(asset.storageKey,bytes);expect((await agent.post(endpoint(row.id)).set('Origin',testOrigin).send({})).status).toBe(200);expect(await db.registrationOperation.count()).toBe(1);
});
it('autenticación, permisos de evidencia, CSRF e ID inexistente',async()=>{
 const [row]=await fixture();expect((await request(app).post(endpoint(row.id)).set('Origin',testOrigin).send({})).status).toBe(401);expect((await agent.post(endpoint(row.id)).set('Origin','https://invalid.example').send({})).status).toBe(403);expect((await agent.post(endpoint(randomUUID())).set('Origin',testOrigin).send({})).status).toBe(404);
 const user=await db.user.findUniqueOrThrow({where:{email:testEmail}}),role=await db.role.findUniqueOrThrow({where:{code:'ADMIN'}}),key={roleId:role.id,permissionKey:'registration.evidence.read'};
 const existed=await db.rolePermission.findUnique({where:{roleId_permissionKey:key}});await db.rolePermission.deleteMany({where:key});await db.user.update({where:{id:user.id},data:{roleId:role.id}});
 try{expect((await agent.post(endpoint(row.id)).set('Origin',testOrigin).send({})).status).toBe(403);}finally{await db.user.update({where:{id:user.id},data:{roleId:user.roleId}});if(existed)await db.rolePermission.create({data:key});}
});
it('origen TIENDA y referencia independiente de los teléfonos IMEI; idempotencia',async()=>{
 const input={...workflowInput(),origin:'STORE',requests:workflowInput().requests.map(r=>({...r,referencePhone:'923456789'}))};await fixture(input);await fixture(input);expect((await db.equipment.findFirstOrThrow()).origin).toBe('STORE');expect((await db.registrationRequest.findMany()).every(r=>r.referencePhone==='923456789')).toBe(true);expect(await db.registrationRequest.count()).toBe(2);
});
it('corrección explícita de nombre es transaccional, detecta versión y no cambia propietario',async()=>{
 const data=workflowInput(),client=await db.client.create({data:data.client}),fullName='NOMBRE SINTÉTICO CORREGIDO';const input={...data,clientNameCorrection:{clientId:client.id,expectedName:[client.firstName,client.lastName].join(' '),fullName}};
 await fixture(input);expect((await db.client.findUniqueOrThrow({where:{id:client.id}})).fullName).toBe(fullName);expect((await db.equipment.findFirstOrThrow()).ownerId).toBe(client.id);
 const next={...workflowInput(),imeis:[{slot:1,value:'359708765439991',type:'PHYSICAL'}],requests:[{...data.requests[0],value:'359708765439991'}],clientNameCorrection:input.clientNameCorrection};expect((await agent.post('/api/registration-operations').set('Origin',testOrigin).send(next)).status).toBe(409);expect(await db.equipment.count()).toBe(1);
});
