import 'dotenv/config';
import {beforeEach,afterAll,it,expect} from 'vitest';
import {PrismaClient} from '@prisma/client';
import request from 'supertest';
import {createApp} from '../../server/app';
import {createClientDirectory} from '../../server/services/client-directory.service';
import {seedTestAdmin,loginAgent,testOrigin} from '../helpers/auth';
import {workflowInput} from '../helpers/workflow';
import {clearEvidenceFixtures} from '../helpers/evidence';
const target=new URL(process.env.TEST_DATABASE_URL!);
if(target.pathname!=='/communicate_pos_test'||!['127.0.0.1','localhost'].includes(target.hostname))throw Error('ISOLATED DATABASE ONLY');
const db=new PrismaClient({datasources:{db:{url:target.toString()}}}),app=createApp(db),permissions=['sales.read','registration.read','equipment.read'];
beforeEach(async()=>{await clearEvidenceFixtures(db);await db.$transaction([db.session.deleteMany(),db.authRateLimit.deleteMany(),db.registrationRequestHistory.deleteMany(),db.registrationRequest.deleteMany(),db.registrationOperation.deleteMany(),db.saleAccessory.deleteMany(),db.equipmentHistory.deleteMany(),db.auditLog.deleteMany(),db.saleEquipment.deleteMany(),db.sale.deleteMany(),db.imei.deleteMany(),db.equipment.deleteMany(),db.client.deleteMany(),db.user.deleteMany()]);await seedTestAdmin(db);});
afterAll(()=>db.$disconnect());
async function fixture(){const agent=await loginAgent(app),input=workflowInput();const sale=await agent.post('/api/sales').set('Origin',testOrigin).send({buyer:{client:input.client},buyerPhone:'923456789',buyerEmail:'sale@example.test',items:[{equipment:{...input.equipment,imeis:input.imeis},unitPrice:'100.10'}],accessories:[{name:'Cable sintético',quantity:3,unitPrice:'0.10'}],paymentMethod:'YAPE'});expect(sale.status,JSON.stringify(sale.body)).toBe(201);input.requests[0].price='20';input.requests[1].price='30';const op=await agent.post('/api/registration-operations').set('Origin',testOrigin).send(input);expect(op.status,JSON.stringify(op.body)).toBe(201);return {agent,input,sale:sale.body,op:op.body};}
it('agrega ventas una vez, dos RECO y un equipo físico, separando servicios no cobrados',async()=>{
 const {agent,sale}=await fixture();const response=await agent.get('/api/client-directory');expect(response.status).toBe(200);expect(response.body.total).toBe(1);const c=response.body.rows[0];expect(c.salesCount).toBe(1);expect(c.requestsCount).toBe(2);expect(c.equipmentCount).toBe(1);expect(c.salesRevenue).toBe('100.40');expect(c.serviceAmount).toBe('50.00');expect(c.movements).toHaveLength(3);expect(c.movements.find((m:{type:string})=>m.type==='SALE').imei).toContain('359708765430002');expect(c.phones).toContain('923456789');expect(c.emails).toContain('sale@example.test');const detail=await agent.get(`/api/client-directory/${sale.buyerId}`);expect(detail.body.salesRevenue).toBe('100.40');
});
it('búsqueda avanzada real por contacto e IMEI, sin mezclar modo persona y equipo',async()=>{
 const {input}=await fixture(),service=createClientDirectory(db,permissions);expect((await service.list({q:input.imeis[0].value,mode:'equipment'})).total).toBe(1);expect((await service.list({q:input.imeis[0].value,mode:'person'})).total).toBe(0);expect((await service.list({q:input.client.dni,mode:'person'})).total).toBe(1);expect((await service.list({q:'inexistente',mode:'all'})).total).toBe(0);expect((await service.list({q:'923456789',mode:'person'})).total).toBe(1);expect((await service.list({q:'Samsung',mode:'equipment'})).total).toBe(1);
});
it('permisos restringen métricas, movimientos y datos de equipos en servidor',async()=>{
 const {sale}=await fixture(),restricted=createClientDirectory(db,[]);const c=await restricted.detail(sale.buyerId);expect(c.salesRevenue).toBeNull();expect(c.serviceAmount).toBeNull();expect(c.salesCount).toBeNull();expect(c.requestsCount).toBeNull();expect(c.equipmentCount).toBeNull();expect(c.movements).toEqual([]);expect(c.equipment).toEqual([]);await expect(restricted.list({mode:'equipment'})).rejects.toMatchObject({status:403});expect((await request(app).get('/api/client-directory')).status).toBe(401);
});
it('comprador distinto: ventas y registros pertenecen a sus relaciones; no asigna importe al propietario',async()=>{
 const agent=await loginAgent(app),input=workflowInput(),owner=await db.client.create({data:{dni:'70876544',firstName:'Propietario',lastName:'Sintético'}});const response=await agent.post('/api/sales').set('Origin',testOrigin).send({buyer:{client:input.client},items:[{owner:{id:owner.id},equipment:{...input.equipment,imeis:input.imeis},unitPrice:'125'}],paymentMethod:'CARD'});expect(response.status).toBe(201);const service=createClientDirectory(db,permissions),buyer=await service.detail(response.body.buyerId),holder=await service.detail(owner.id);expect(buyer.salesRevenue).toBe('125.00');expect(holder.salesRevenue).toBe('0.00');expect(buyer.equipmentCount).toBe(1);expect(holder.equipmentCount).toBe(1);expect(buyer.requestsCount).toBe(0);expect(holder.salesCount).toBe(0);expect((await service.list({q:input.imeis[0].value,mode:'equipment'})).total).toBe(2);
});
it('venta eliminada desaparece de métricas; contacto propio no altera la ficha',async()=>{
 const {agent,sale}=await fixture();expect((await db.client.findUniqueOrThrow({where:{id:sale.buyerId}})).phone).toBeNull();expect((await db.sale.findUniqueOrThrow({where:{id:sale.id}})).buyerPhone).toBe('923456789');const plan=await agent.get(`/api/sales/${sale.id}/deletion-preview`);expect((await agent.delete(`/api/sales/${sale.id}`).set('Origin',testOrigin).send({confirm:'ELIMINAR',fingerprint:plan.body.fingerprint,reason:'Prueba sintética'})).status).toBe(200);const c=await createClientDirectory(db,permissions).detail(sale.buyerId);expect(c.salesRevenue).toBe('0.00');expect(c.salesCount).toBe(0);expect(c.movements).toEqual([]);expect(await db.client.count()).toBe(1);
});
