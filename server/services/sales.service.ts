import {createHash} from 'node:crypto';
import {Prisma,type PrismaClient,type EquipmentEventType} from '@prisma/client';
import {z} from 'zod';
import {normalizeText} from '../../shared/normalization.js';
import {equipmentSchema,idSchema,moneySchema} from '../../shared/validation.js';
import {saleFlowSchema,saleEditSchema,salesQuerySchema,type clientReferenceSchema} from '../../shared/sales.js';
import {repository,saleSummaryInclude,type Db} from '../repositories/pos.repository.js';
import type {AuditContext} from '../lib/audit.js';
import {DomainError} from '../lib/errors.js';
type Reference=z.infer<typeof clientReferenceSchema>;
interface Dependencies {actor?:AuditContext;transaction:<T>(fn:(tx:Db)=>Promise<T>)=>Promise<T>;createEquipmentInTx:(tx:Db,input:z.infer<typeof equipmentSchema>)=>Promise<{id:string}>;history:(tx:Db,id:string,event:EquipmentEventType,imeiId?:string,userId?:string,metadata?:Prisma.InputJsonValue)=>Promise<unknown>;audit:(tx:Db,action:string,entityType:string,id:string,userId?:string,metadata?:Prisma.InputJsonValue)=>Promise<unknown>}
const historicalEquipmentSchema=z.object({
 brand:z.string().max(100).optional(),model:z.string().max(100).optional(),commercialName:z.string().max(100).nullable().optional(),
 color:z.string().max(100).nullable().optional(),ram:z.string().max(100).nullable().optional(),
 storage:z.string().max(100).nullable().optional(),serialNumber:z.string().max(100).nullable().optional(),
}).strict();
function summary<T extends {
 total:Prisma.Decimal;discount:Prisma.Decimal;_count:{equipment:number};
 historicalBuyerName:string|null;buyer:object;equipment:{historicalEquipment:Prisma.JsonValue;equipment:object}[];
}>(sale:T){
 return {
  ...sale,
  buyer:sale.historicalBuyerName?{...sale.buyer,fullName:sale.historicalBuyerName}:sale.buyer,
  equipment:sale.equipment.map(line=>{
   const original=historicalEquipmentSchema.safeParse(line.historicalEquipment);
   return original.success?{...line,equipment:{...line.equipment,...original.data}}:line;
  }),
  subtotal:sale.total.add(sale.discount),equipmentCount:sale._count.equipment,
 };
}
function dayRange(day:string){const from=new Date(`${day}T00:00:00-05:00`);return {gte:from,lt:new Date(from.getTime()+86400000)};}
export function createSalesService(db:PrismaClient,helpers:Dependencies){
 const {transaction,history,audit,createEquipmentInTx}=helpers;
 async function client(tx:Db,ref:Reference,owner=false){if('id' in ref){const found=await tx.client.findUnique({where:{id:ref.id}});if(!found)throw new DomainError(404,'CLIENTE NO ENCONTRADO.',owner?'OWNER_NOT_FOUND':'CLIENT_NOT_FOUND');return found;}const found=await repository.findClientByDni(tx,ref.client.dni);if(found)return found;const created=await tx.client.create({data:ref.client});await audit(tx,'CREATE','Client',created.id);return created;}
 async function validate(tx:Db,input:z.infer<typeof saleFlowSchema>){const values=input.items.flatMap(line=>line.equipment.imeis.map(i=>i.value));if(new Set(values).size!==values.length||await tx.imei.findFirst({where:{value:{in:values}}}))throw new DomainError(409,'ESTE IMEI YA ESTÁ REGISTRADO EN EL SISTEMA. NO SE PUEDE REALIZAR OTRA VENTA CON EL MISMO IMEI.','IMEI_ALREADY_EXISTS');}
 function totals(input:z.infer<typeof saleFlowSchema>){const subtotal=input.accessories.reduce((sum,line)=>sum.add(new Prisma.Decimal(line.unitPrice).mul(line.quantity)),input.items.reduce((sum,line)=>sum.add(line.unitPrice),new Prisma.Decimal(0))),discount=new Prisma.Decimal(input.discount);if(discount.greaterThan(subtotal)||subtotal.greaterThan('9999999999.99'))throw new DomainError(400,'DESCUENTO O TOTAL INVÁLIDO.','INVALID_TOTAL');return {subtotal,total:subtotal.sub(discount),discount};}
 function parse(raw:unknown){if(raw&&typeof raw==='object'&&'items' in raw&&Array.isArray(raw.items)){if(!raw.items.length)throw new DomainError(400,'AGREGA UN EQUIPO.','SALE_EMPTY');for(const item of raw.items){if(!moneySchema.safeParse(item?.unitPrice).success)throw new DomainError(400,'PRECIO INVÁLIDO.','INVALID_PRICE');const values=Array.isArray(item?.equipment?.imeis)?item.equipment.imeis.map((i:{value:string})=>i?.value):undefined;if(values&&new Set(values).size!==values.length)throw new DomainError(409,'IMEI REPETIDO.','IMEI_ALREADY_EXISTS');}}return saleFlowSchema.parse(raw);}
 const detail=async(tx:Db,id:string)=>summary(await repository.getSaleById(tx,id));
 return {
 resolveSale:async(raw:unknown)=>{const input=parse(raw);return transaction(async tx=>{await validate(tx,input);const {subtotal,total}=totals(input);return {subtotal:subtotal.toFixed(2),total:total.toFixed(2)};});},
 createSale:async(raw:unknown)=>{const input=parse(raw),key=input.idempotencyKey,hash=key?createHash('sha256').update(JSON.stringify(input)).digest('hex'):undefined;
 async function replay(tx:Db){const old=key?await tx.sale.findUnique({where:{idempotencyKey:key}}):null;if(old){if(old.createdById!==helpers.actor?.userId||old.requestHash!==hash)throw new DomainError(409,'CONFIRMACIÓN DE OTRA OPERACIÓN.','IDEMPOTENCY_CONFLICT');return detail(tx,old.id);}return null;}
 try{return await transaction(async tx=>{if(key)await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;const old=await replay(tx);if(old)return old;await validate(tx,input);const {total,discount}=totals(input),buyer=await client(tx,input.buyer);const lines=[];for(const item of input.items){const owner=await client(tx,item.owner??{id:buyer.id},true);const equipment=await createEquipmentInTx(tx,equipmentSchema.parse({...item.equipment,serialNumber:item.equipment.serialNumber??undefined,ownerId:owner.id,origin:item.equipment.origin??'STORE'}));lines.push({equipmentId:equipment.id,unitPrice:item.unitPrice});}
 const sale=await tx.sale.create({data:{buyerId:buyer.id,buyerPhone:input.buyerPhone,buyerEmail:input.buyerEmail,total,discount,paymentMethod:input.paymentMethod,notes:input.notes,occurredAt:input.occurredAt?new Date(input.occurredAt):undefined,idempotencyKey:key,requestHash:hash,createdById:helpers.actor?.userId,equipment:{create:lines},accessories:{create:input.accessories}}});for(const line of lines)await history(tx,line.equipmentId,'SOLD',undefined,undefined,{saleId:sale.id});await audit(tx,'CREATE','Sale',sale.id);return detail(tx,sale.id);});}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002'){const old=await replay(db);if(old)return old;throw new DomainError(409,'IMEI YA EXISTENTE; NO SE GUARDÓ LA VENTA.','IMEI_ALREADY_EXISTS');}throw error;}},
 updateSale:(id:unknown,raw:unknown,permissions={canCreateClient:false,canEditEquipment:false})=>{
  const saleId=idSchema.parse(id),input=saleEditSchema.parse(raw);
  if(input.items?.some(item=>item.equipment||item.origin||item.imeis)&&!permissions.canEditEquipment)throw new DomainError(403,'No tienes permiso para editar equipos.','PERMISSION_REQUIRED');
  return transaction(async tx=>{
   const initial=await tx.saleEquipment.findMany({where:{saleId},select:{equipmentId:true}});
   for(const equipmentId of initial.map(line=>line.equipmentId).sort())await tx.$queryRaw`SELECT id FROM "Equipment" WHERE id=${equipmentId}::uuid FOR UPDATE`;
   await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${saleId}::uuid FOR UPDATE`;
   const old=await repository.getSaleById(tx,saleId);
   if(input.expectedUpdatedAt&&old.updatedAt.toISOString()!==input.expectedUpdatedAt)throw new DomainError(409,'La venta cambió. Vuelve a abrirla antes de guardar.','SALE_EDIT_CONFLICT');
   if(input.items&&(input.items.length!==old.equipment.length||input.items.some(item=>!old.equipment.some(line=>line.id===item.id))))throw new DomainError(409,'Los equipos de la venta cambiaron. Actualiza la ficha.','SALE_EQUIPMENT_CONFLICT');
   for(const item of input.items??[]){const line=old.equipment.find(line=>line.id===item.id)!;
    if((item.equipment||item.origin||item.imeis)&&line.equipment.updatedAt.toISOString()!==item.expectedEquipmentUpdatedAt)throw new DomainError(409,'El equipo cambió. Vuelve a abrir la venta.','EQUIPMENT_EDIT_CONFLICT');
   }
   const proposedValues:string[]=[];
   for(const line of old.equipment){const changes=input.items?.find(item=>item.id===line.id)?.imeis??[];
    for(const change of changes){const original=line.equipment.imeis.find(imei=>imei.slot===change.slot);
     if(change.id){if(!original||original.id!==change.id||original.value!==change.expectedValue)throw new DomainError(409,'El IMEI cambió. Actualiza la venta.','IMEI_CORRECTION_CONFLICT');}
     else if(original)throw new DomainError(409,'La posición del IMEI ya está ocupada.','IMEI_SLOT_OCCUPIED');
     const conflict=await tx.imei.findUnique({where:{value:change.value}});
     if(conflict&&conflict.id!==change.id)throw new DomainError(409,'El IMEI ya pertenece a un equipo.','IMEI_ALREADY_EXISTS');
    }
    if(changes.length&&!line.equipment.imeis.some(imei=>imei.slot===1)&&!changes.some(imei=>imei.slot===1))throw new DomainError(400,'El equipo debe tener IMEI 1.','INVALID_IMEI_SLOT');
    const final=line.equipment.imeis.map(imei=>changes.find(change=>change.id===imei.id)?.value??imei.value).concat(changes.filter(change=>!change.id).map(change=>change.value));
    if(final.length>2)throw new DomainError(400,'Un equipo admite como máximo dos IMEI.','IMEI_SLOT_OCCUPIED');
    proposedValues.push(...final);
   }
   if(new Set(proposedValues).size!==proposedValues.length)throw new DomainError(409,'Los IMEI de los equipos deben ser diferentes.','IMEI_ALREADY_EXISTS');
   const accessoryValues=(rows:{name:string;quantity:number;unitPrice:Prisma.Decimal|string}[])=>JSON.stringify(rows.map(row=>[row.name,row.quantity,new Prisma.Decimal(row.unitPrice).toFixed(2)]));
   const accessoriesChanged=input.accessories!==undefined&&accessoryValues(input.accessories)!==accessoryValues(old.accessories);
   const moneyChanged=accessoriesChanged||input.discount!==undefined&&!new Prisma.Decimal(input.discount).equals(old.discount)||!!input.items?.some(item=>!new Prisma.Decimal(item.unitPrice).equals(old.equipment.find(line=>line.id===item.id)!.unitPrice));
   const discount=new Prisma.Decimal(input.discount??old.discount);
   const subtotal=(input.items??old.equipment).reduce((sum,line)=>sum.add(line.unitPrice),new Prisma.Decimal(0)).add((input.accessories??old.accessories).reduce((sum,line)=>sum.add(new Prisma.Decimal(line.unitPrice).mul(line.quantity)),new Prisma.Decimal(0)));
   if(moneyChanged&&(discount.greaterThan(subtotal)||subtotal.greaterThan('9999999999.99')))throw new DomainError(400,'El descuento no puede superar el subtotal. Revisa los importes.','INVALID_TOTAL');
   let buyer:Awaited<ReturnType<typeof client>>|null=null;
   if(input.buyer){if('client' in input.buyer&&!permissions.canCreateClient){buyer=await repository.findClientByDni(tx,input.buyer.client.dni);if(!buyer)throw new DomainError(403,'No tienes permiso para crear clientes. Selecciona uno existente.','PERMISSION_REQUIRED');}else buyer=await client(tx,input.buyer);}

   for(const item of input.items??[]){const line=old.equipment.find(line=>line.id===item.id)!;
    const original=historicalEquipmentSchema.safeParse(line.historicalEquipment);
    const editedHistorical=original.success&&item.equipment?{...original.data,...item.equipment}:undefined;
    if(!line.unitPrice.equals(item.unitPrice)||editedHistorical)await tx.saleEquipment.update({where:{id:item.id},data:{unitPrice:item.unitPrice,historicalEquipment:editedHistorical}});
    const equipmentDetails=editedHistorical?undefined:item.equipment;
    if(equipmentDetails||item.origin||item.imeis){
     if(item.origin==='EXTERNAL'&&!line.equipment.ownerId)throw new DomainError(409,'Asigna un propietario antes de usar el origen externo.','OWNER_REQUIRED');
     for(const change of item.imeis??[]){
      if(change.id){await tx.imei.update({where:{id:change.id},data:{value:change.value,type:change.type}});await audit(tx,'VALUE_CORRECTED','Imei',change.id,undefined,{saleId,slot:change.slot,previousSuffix:change.expectedValue?.slice(-4),newSuffix:change.value.slice(-4)});}
      else{const added=await tx.imei.create({data:{equipmentId:line.equipmentId,slot:change.slot,value:change.value,type:change.type}});await history(tx,line.equipmentId,'IMEI_ADDED',added.id);await audit(tx,'CREATE','Imei',added.id);}
     }
     await tx.equipment.update({where:{id:line.equipmentId},data:{...equipmentDetails,origin:item.origin}});await history(tx,line.equipmentId,'EQUIPMENT_UPDATED',undefined,undefined,{saleId,fields:[...Object.keys(equipmentDetails??{}),...(item.origin?['origin']:[]),...(item.imeis?['imeis']:[])]});await audit(tx,'UPDATE','Equipment',line.equipmentId);
    }
   }
   if(accessoriesChanged){await tx.saleAccessory.deleteMany({where:{saleId}});if(input.accessories?.length)await tx.saleAccessory.createMany({data:input.accessories.map(line=>({...line,saleId}))});}
   await tx.sale.update({where:{id:saleId},data:{...(buyer?{buyerId:buyer.id}:{}),historicalBuyerName:buyer&&buyer.id!==old.buyerId?null:undefined,buyerPhone:input.buyerPhone,buyerEmail:input.buyerEmail,paymentMethod:input.paymentMethod,notes:input.notes,occurredAt:input.occurredAt?new Date(input.occurredAt):undefined,...(moneyChanged?{total:subtotal.sub(discount),discount}:{})}});
   await audit(tx,'UPDATE','Sale',saleId,undefined,{fields:Object.keys(input).filter(key=>key!=='expectedUpdatedAt'),previousTotal:old.total.toFixed(2),newTotal:moneyChanged?subtotal.sub(discount).toFixed(2):old.total.toFixed(2),buyerChanged:!!buyer&&buyer.id!==old.buyerId,
    before:{buyerId:old.buyerId,paymentMethod:old.paymentMethod,discount:old.discount.toFixed(2),occurredAt:old.occurredAt.toISOString(),prices:old.equipment.map(line=>({id:line.id,unitPrice:line.unitPrice.toFixed(2)})),...(accessoriesChanged?{accessories:old.accessories.map(line=>({name:line.name,quantity:line.quantity,unitPrice:line.unitPrice.toFixed(2)}))}:{})},
    after:{buyerId:buyer?.id??old.buyerId,paymentMethod:input.paymentMethod??old.paymentMethod,discount:discount.toFixed(2),occurredAt:input.occurredAt??old.occurredAt.toISOString(),prices:(input.items??old.equipment).map(line=>({id:line.id,unitPrice:new Prisma.Decimal(line.unitPrice).toFixed(2)})),...(accessoriesChanged?{accessories:input.accessories??[]}:{})}});
   return detail(tx,saleId);
  });
 },
 updateSaleNotes:(id:unknown,raw:unknown)=>{const saleId=idSchema.parse(id),input=z.object({notes:z.string().max(1000).transform(normalizeText)}).strict().parse(raw);return transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Sale" WHERE id=${saleId}::uuid FOR UPDATE`;await repository.getSaleById(tx,saleId);await tx.sale.update({where:{id:saleId},data:input});await audit(tx,'UPDATE','Sale',saleId,undefined,{fields:['notes']});return detail(tx,saleId);});},
 getSaleById:(id:unknown)=>detail(db,idSchema.parse(id)),
 listSales:async(raw:unknown={})=>{const {q,offset,limit,from,to}=salesQuerySchema.parse(raw);const where:Prisma.SaleWhereInput={occurredAt:{...(from?{gte:dayRange(from).gte}:{}),...(to?{lt:dayRange(to).lt}:{})},...(q?{AND:q.split(/\s+/).map(term=>({OR:[{code:{contains:term,mode:'insensitive' as const}},{historicalBuyerName:{contains:term,mode:'insensitive' as const}},{buyer:{dni:{contains:term}}},{buyer:{otherDocumentNumber:{contains:term,mode:'insensitive' as const}}},{buyer:{firstName:{contains:term,mode:'insensitive' as const}}},{buyer:{lastName:{contains:term,mode:'insensitive' as const}}},{buyer:{fullName:{contains:term,mode:'insensitive' as const}}},{equipment:{some:{equipment:{imeis:{some:{value:term}}}}}}]}))}:{})};return (await db.sale.findMany({where,include:{...saleSummaryInclude,equipment:{include:{equipment:{include:{imeis:{include:{requests:{select:{status:true}}},orderBy:{slot:'asc'}}}}}}},orderBy:[{createdAt:'desc'},{id:'asc'}],skip:offset,take:limit})).map(summary);},
 dashboard:()=>transaction(async tx=>{const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),where={occurredAt:dayRange(today)},result=await tx.sale.aggregate({where,_count:true,_sum:{total:true}});return {day:today,salesToday:result._count,revenueToday:(result._sum.total??new Prisma.Decimal(0)).toFixed(2),equipmentSoldToday:await tx.saleEquipment.count({where:{sale:where}})};})
 };
}
