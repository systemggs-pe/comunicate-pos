import {z} from 'zod';
import {Prisma,type PrismaClient} from '@prisma/client';
import {listQuerySchema} from '../../shared/validation.js';
import {idSchema} from '../../shared/validation.js';
import {DomainError} from '../lib/errors.js';
export function createClientDirectory(db:PrismaClient,permissions:string[]){
 const sales=permissions.includes('sales.read'),registration=permissions.includes('registration.read'),equipment=permissions.includes('equipment.read');
 async function enrich(rows:Awaited<ReturnType<typeof db.client.findMany>>,reader:Prisma.TransactionClient=db){
  const ids=rows.map(c=>c.id);
  const [purchases,requests,devices]=await Promise.all([
   sales?reader.sale.findMany({where:{buyerId:{in:ids}},select:{id:true,code:true,buyerId:true,buyerPhone:true,buyerEmail:true,total:true,occurredAt:true,equipment:{select:{equipmentId:true,equipment:{select:{brand:true,commercialName:true,model:true,imeis:{select:{slot:true,value:true},orderBy:{slot:'asc'}}}}}}}}):[],
   registration?reader.registrationRequest.findMany({where:{OR:[{applicantId:{in:ids}},{applicantId:null,imei:{equipment:{ownerId:{in:ids}}}}]},select:{id:true,applicantId:true,code:true,price:true,occurredAt:true,phone:true,email:true,address:true,department:true,imei:{select:{value:true,slot:true,equipmentId:true,equipment:{select:{ownerId:true,brand:true,commercialName:true}}}}}}):[],
   equipment?reader.equipment.findMany({where:{OR:[{ownerId:{in:ids}},...(sales?[{saleEquipment:{some:{sale:{buyerId:{in:ids}}}}}]:[])]},select:{id:true,ownerId:true,brand:true,commercialName:true,model:true,serialNumber:true,imeis:{select:{id:true,slot:true,value:true}},saleEquipment:{select:{sale:{select:{buyerId:true}}}}}}):[]
  ]);
  return rows.map(client=>{
   const clientSales=purchases.filter(s=>s.buyerId===client.id),clientRequests=requests.filter(r=>(r.applicantId??r.imei.equipment.ownerId)===client.id),clientEquipment=devices.filter(e=>e.ownerId===client.id||e.saleEquipment.some(s=>s.sale.buyerId===client.id));
   const movements=[...clientSales.map(s=>({id:s.id,code:s.code,type:'SALE',date:s.occurredAt,amount:s.total.toFixed(2),equipment:s.equipment.map(line=>[line.equipment.brand,line.equipment.commercialName||line.equipment.model].filter(Boolean).join(' ')).join(' · '),imei:s.equipment.flatMap(line=>line.equipment.imeis.map(i=>i.value)).join(' / ')})),...clientRequests.map(r=>({id:r.id,code:r.code,type:'REGISTRATION',date:r.occurredAt,amount:r.price.toFixed(2),imei:r.imei.value,equipment:[r.imei.equipment.brand,r.imei.equipment.commercialName].filter(Boolean).join(' ')}))].sort((a,b)=>b.date.getTime()-a.date.getTime());
   const sum=(values:Prisma.Decimal[])=>values.reduce((total,value)=>total.add(value),new Prisma.Decimal(0)).toFixed(2);
   return {...client,salesCount:sales?clientSales.length:null,requestsCount:registration?clientRequests.length:null,equipmentCount:equipment?clientEquipment.length:null,salesRevenue:sales?sum(clientSales.map(s=>s.total)):null,serviceAmount:registration?sum(clientRequests.map(r=>r.price)):null,lastMovement:movements[0]?.date??null,movements,equipment:clientEquipment,phones:[...new Set([client.phone,...clientSales.map(s=>s.buyerPhone),...clientRequests.map(r=>r.phone)].filter(Boolean))],emails:[...new Set([client.email,...clientSales.map(s=>s.buyerEmail),...clientRequests.map(r=>r.email)].filter(Boolean))]};
  });
 }

 function searchWhere(q:string,mode:string):Prisma.ClientWhereInput {
  return {AND:q.split(/\s+/).filter(Boolean).map(term=>{
   const device:Prisma.EquipmentWhereInput={OR:[{brand:{contains:term,mode:'insensitive'}},{model:{contains:term,mode:'insensitive'}},{commercialName:{contains:term,mode:'insensitive'}},{serialNumber:{contains:term,mode:'insensitive'}},{imeis:{some:{value:{contains:term}}}}]};
   const people:Prisma.ClientWhereInput[]=[{dni:{contains:term}},{otherDocumentNumber:{contains:term,mode:'insensitive'}},{fullName:{contains:term,mode:'insensitive'}},{firstName:{contains:term,mode:'insensitive'}},{lastName:{contains:term,mode:'insensitive'}},{phone:{contains:term}},{email:{contains:term,mode:'insensitive'}}];
   if(sales)people.push({purchases:{some:{buyerPhone:{contains:term}}}});
   if(registration)people.push({registrationApplications:{some:{phone:{contains:term}}}},{equipment:{some:{imeis:{some:{requests:{some:{applicantId:null,phone:{contains:term}}}}}}}});
   const devices:Prisma.ClientWhereInput[]=equipment?[{equipment:{some:device}},...(sales?[{purchases:{some:{equipment:{some:{equipment:device}}}}}]:[])]:[];
   return {OR:[...(mode!=='equipment'?people:[]),...(mode!=='person'?devices:[])]};
  })};
 }
 return {
  list:async(raw:unknown)=>{
   const {q,offset,limit,mode}=listQuerySchema.extend({mode:z.enum(['all','person','equipment']).default('all')}).parse(raw);
   if(mode==='equipment'&&!equipment)throw new DomainError(403,'Sin permiso para buscar equipos.','PERMISSION_REQUIRED');
   const where=searchWhere(q,mode);
   return db.$transaction(async tx=>{
    const [rows,total]=await Promise.all([tx.client.findMany({where,skip:offset,take:limit,orderBy:[{createdAt:'desc'},{id:'desc'}]}),tx.client.count({where})]);
    return {rows:await enrich(rows,tx),total};
   },{isolationLevel:'RepeatableRead'});
  },
  detail:(id:string)=>db.$transaction(async tx=>{
   const client=await tx.client.findUnique({where:{id:idSchema.parse(id)}});
   if(!client)throw new DomainError(404,'Cliente no encontrado.','CLIENT_NOT_FOUND');
   return (await enrich([client],tx))[0];
  },{isolationLevel:'RepeatableRead'})
 };
}
