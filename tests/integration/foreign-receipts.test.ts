import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {afterAll,beforeAll,expect,it} from 'vitest';
import request from 'supertest';
import {createApp} from '../../server/app';
import {importForeignReceipts} from '../../server/services/foreign-receipts-import';
import {receiptDateFromPurchase} from '../../shared/foreign-receipts';
import {isValidImeiLuhn} from '../../shared/imei';
import {loginAgent,seedTestAdmin,testOrigin,testPassword} from '../helpers/auth';
import {clearEvidenceFixtures} from '../helpers/evidence';

const url=process.env.TEST_DATABASE_URL!,target=new URL(url);
if(!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/communicate_pos_test')throw Error('DB dedicada requerida');
const db=new PrismaClient({datasources:{db:{url}}}),app=createApp(db);
const endpoint='/api/foreign-receipts',verification='/api/public/foreign-receipts/verify';
const imei=Array.from({length:5},(_,index)=>Array.from({length:10},(_,digit)=>`5970876544880${index}${digit}`).find(isValidImeiLuhn)!);
const issuer={nombre:'Emisor de prueba',rut:'DEMO-12345',tipoCambioPenUsd:'4'};
const client={dni:'70876543',firstName:'Cliente',lastName:'Prueba'};
let agent:Awaited<ReturnType<typeof loginAgent>>;

beforeAll(async()=>{
 await clearEvidenceFixtures(db);
 await db.$transaction([db.foreignReceipt.deleteMany(),db.foreignReceiptIssuer.deleteMany(),db.foreignReceiptCounter.update({where:{id:1},data:{last:999}}),
  db.authRateLimit.deleteMany(),db.saleAccessory.deleteMany(),db.saleEquipment.deleteMany(),db.sale.deleteMany(),
  db.registrationRequestHistory.deleteMany(),db.registrationRequest.deleteMany(),db.registrationOperation.deleteMany(),
  db.equipmentHistory.deleteMany(),db.imei.deleteMany(),db.equipment.deleteMany()]);
 await seedTestAdmin(db);agent=await loginAgent(app);
});
afterAll(async()=>{await db.$disconnect();});

it('resta un día de calendario a la fecha más reciente y cruza el año',()=>{
 const result=receiptDateFromPurchase([new Date('2026-12-31T09:12:00-05:00'),new Date('2027-01-01T11:11:00-05:00')]);
 expect(result.purchaseAt.toISOString()).toBe('2027-01-01T16:11:00.000Z');
 expect(result.issuedAt.toISOString()).toBe('2026-12-31T16:11:00.000Z');
});

it('emite desde líneas de distintas ventas, deduplica ambos IMEIs, edita el folio y limita la consulta pública',async()=>{
 const buyer=await db.client.upsert({where:{dni:client.dni},create:client,update:{}});
 const [first,second]=await Promise.all([
  db.equipment.create({data:{brand:'MARCA',model:'MODELO',origin:'STORE',imeis:{create:[{slot:1,value:imei[0]},{slot:2,value:imei[1]}]}}}),
  db.equipment.create({data:{brand:'MARCA',model:'SEGUNDO',origin:'STORE',imeis:{create:{slot:1,value:imei[2]}}}}),
 ]);
 const [oldSale,newSale]=await Promise.all([
  db.sale.create({data:{buyerId:buyer.id,paymentMethod:'CASH',total:800,occurredAt:new Date('2026-10-03T11:00:00-05:00'),
   equipment:{create:{equipmentId:first.id,unitPrice:300}},accessories:{create:{name:'ACCESORIO PRUEBA',quantity:1,unitPrice:500}}},include:{equipment:true}}),
  db.sale.create({data:{buyerId:buyer.id,paymentMethod:'CASH',total:900,occurredAt:new Date('2026-11-01T11:11:00-05:00'),
   equipment:{create:{equipmentId:second.id,unitPrice:400}},accessories:{create:{name:'ACCESORIO PRUEBA',quantity:1,unitPrice:500}}},include:{equipment:true}}),
 ]);
 expect((await request(app).get(endpoint)).status).toBe(401);
 expect((await agent.patch(`${endpoint}/issuers/4`).set('Origin',testOrigin).send(issuer)).status).toBe(200);
 const lookup=await agent.get(`${endpoint}/sales`).query({document:client.dni});
 expect(lookup.body.lines).toEqual(expect.arrayContaining([expect.objectContaining({id:oldSale.equipment[0].id}),expect.objectContaining({id:newSale.equipment[0].id})]));
 const input={source:'SALE',format:4,document:client.dni,saleLineIds:[oldSale.equipment[0].id,newSale.equipment[0].id],requestKey:randomUUID()};
 const issue=(key:string)=>agent.post(endpoint).set('Origin',testOrigin).send({...input,requestKey:key});
 const [one,two]=await Promise.all([issue(input.requestKey),issue(randomUUID())]);
 expect([one.status,two.status].sort()).toEqual([200,201]);
 const receipt=one.body.receipt;
 expect(receipt).toMatchObject({id:two.body.receipt.id,totalPen:'700',totalUsd:'175',
  purchaseAt:'2026-11-01T16:11:00.000Z',issuedAt:'2026-10-31T16:11:00.000Z'});
 const winner=one.status===201?input.requestKey:(await db.foreignReceipt.findUniqueOrThrow({where:{id:receipt.id}})).requestKey!;
 expect((await issue(winner)).body.receipt.id).toBe(receipt.id);
 const history=await agent.get(endpoint).query({by:'imei',q:imei[1]});
 expect(history.body.rows.map((row:{id:string})=>row.id)).toEqual([receipt.id]);
 const edited=await agent.patch(`${endpoint}/${receipt.id}`).set('Origin',testOrigin)
  .send({format:4,expectedUpdatedAt:receipt.updatedAt,issuedAt:'2026-10-30T10:00'});
 expect(edited.status,JSON.stringify(edited.body)).toBe(200);
 expect(edited.body).toMatchObject({folio:receipt.folio,issuedAt:'2026-10-30T15:00:00.000Z',purchaseAt:receipt.purchaseAt});
 const verify=(amount:string)=>request(app).post(verification).set('Origin',testOrigin)
  .send({issuerDocument:issuer.rut,folio:receipt.folio,date:'2026-10-30',amount});
 expect((await verify('175')).body).toEqual({found:true,folio:receipt.folio,issuer:issuer.nombre});
 expect((await verify('174.99')).body).toEqual({found:false});
 for(let i=0;i<10;i++)await verify('174');
 const limited=await verify('175');
 expect(limited.status).toBe(429);expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
});

it('permite emisión manual con fecha declarada y conserva montos y folios al importar dos veces',async()=>{
 expect((await agent.patch(`${endpoint}/issuers/4`).set('Origin',testOrigin).send(issuer)).status).toBe(200);
 const manual=await agent.post(endpoint).set('Origin',testOrigin).send({source:'MANUAL',format:4,requestKey:randomUUID(),
  issuedAt:'2026-11-08T10:22',customer:{type:'DNI',document:'72000000',fullName:'Cliente de prueba'},
  devices:[{imei1:imei[3],commercialName:'Modelo de prueba',price:'120.00'}]});
 expect(manual.status,JSON.stringify(manual.body)).toBe(201);
 expect(manual.body.receipt.issuedAt).toBe('2026-11-08T15:22:00.000Z');
 const row={id:'fixture-historical-1',nBoleta:5555,formato:4,totalPen:320,totalUsd:89.95,totalClp:85000,boletaData:{
  cliente:{nombre:'Cliente histórico',dni:'72000001',tipoDocumento:'DNI'},ventas:[{imeiEquipo:imei[4],nombreComercial:'MODELO HISTÓRICO',precio:'320'}],
  fechaHora:'2025-01-01T12:07:09',emisor:issuer,
 }};
 const dry=await importForeignReceipts(db,{boletas:[row,row]});
 expect(dry).toMatchObject({mode:'dry-run',ready:1,nextFolio:5556,review:expect.arrayContaining([expect.objectContaining({reason:'DUPLICADO_EN_EXPORTACIÓN'})])});
 expect(await db.foreignReceipt.count({where:{folio:5555}})).toBe(0);
 expect(await importForeignReceipts(db,[row],true)).toMatchObject({ready:1,nextFolio:5556});
 expect(await importForeignReceipts(db,[row],true)).toMatchObject({existing:1,ready:0,nextFolio:5556});
 const saved=await db.foreignReceipt.findUniqueOrThrow({where:{folio:5555}});
 expect(saved.totalUsd.toFixed(2)).toBe('89.95');expect(saved.issuedAt.toISOString()).toBe('2025-01-01T17:07:09.000Z');
});

it('un vendedor consulta y emite, con edición y emisores reservados por permiso',async()=>{
 const role=await db.role.findUniqueOrThrow({where:{code:'SELLER'}});
 const email=`foreign-receipts-${randomUUID()}@example.test`;
 const user=await agent.post('/api/users').set('Origin',testOrigin)
  .send({roleId:role.id,name:'Vendedor de prueba',email,password:testPassword,status:'ACTIVE'});
 expect(user.status).toBe(201);
 const seller=await loginAgent(app,email);
 expect((await seller.get(endpoint)).status).toBe(200);
 expect((await seller.post(endpoint).set('Origin',testOrigin).send({})).status).toBe(400);
 expect((await seller.patch(`${endpoint}/${randomUUID()}`).set('Origin',testOrigin).send({})).status).toBe(403);
 expect((await seller.patch(`${endpoint}/issuers/4`).set('Origin',testOrigin).send(issuer)).status).toBe(403);
});
