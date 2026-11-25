import {createHash} from 'node:crypto';
import {Prisma,type PrismaClient} from '@prisma/client';
import {z} from 'zod';
import {
 foreignReceiptCreate,activeForeignReceiptFormat,isActiveForeignReceiptFormat,foreignReceiptFormats,foreignReceiptHistoryQuery,
 foreignReceiptIssuer,foreignReceiptUpdate,foreignReceiptVerify,normalizeReceiptDocument,
 receiptDateFromPurchase,receiptDateInLima,receiptTotals,
 type ForeignReceiptCustomer,type ForeignReceiptDevice,type ForeignReceiptSnapshot,
} from '../../shared/foreign-receipts.js';
import {limaDateTimeIso} from '../../shared/operational-date.js';
import {isValidImeiLuhn} from '../../shared/imei.js';
import {cents} from '../../shared/sales.js';
import {idSchema} from '../../shared/validation.js';
import {writeAudit,type AuditContext} from '../lib/audit.js';
import {DomainError} from '../lib/errors.js';

type Db=Prisma.TransactionClient;
type Device=ForeignReceiptDevice;
type Link={equipmentId:string|null;saleEquipmentId:string|null};
const equipmentSelect={id:true,brand:true,model:true,commercialName:true,storage:true,color:true,serialNumber:true,
 imeis:{select:{slot:true,value:true},orderBy:{slot:'asc'}}} as const;
export const saleLineInclude={sale:{select:{code:true,buyerId:true,occurredAt:true}},equipment:{select:equipmentSelect}} as const;
type SaleLine=Prisma.SaleEquipmentGetPayload<{include:typeof saleLineInclude}>;

const snapshotOf=(row:{snapshot:Prisma.JsonValue})=>row.snapshot as unknown as ForeignReceiptSnapshot;
const customerName=(row:{fullName:string|null;firstName:string;lastName:string})=>row.fullName?.trim()||[row.firstName,row.lastName].filter(Boolean).join(' ');
const imeisFor=(devices:Device[])=>devices.flatMap(device=>device.imei2?[device.imei1,device.imei2]:[device.imei1]);
const fail=(status:number,message:string,code:string):never=>{throw new DomainError(status,message,code);};

export async function lockForeignReceiptCounter(tx:Db){
 await tx.$queryRaw`SELECT id FROM "ForeignReceiptCounter" WHERE id = 1 FOR UPDATE`;
}

export function mapSaleLine(line:SaleLine):Device {
 const item=line.equipment;
 return {imei1:item.imeis[0]?.value??'',imei2:item.imeis[1]?.value??'',brand:item.brand,model:item.model,
  commercialName:item.commercialName||item.model||item.brand,storage:item.storage??'',color:item.color??'',
  serialNumber:item.serialNumber??'',price:line.unitPrice.toFixed(2)};
}

async function resolveManualLinks(tx:Db,devices:Device[],clientId:string|null,allowSold=false){
 const matches=await tx.imei.findMany({where:{value:{in:imeisFor(devices)}},select:{value:true,equipmentId:true,equipment:{select:{
  imeis:{select:{value:true,slot:true},orderBy:{slot:'asc'}},saleEquipment:{select:{id:true,sale:{select:{buyerId:true}}}},
 }}}});
 const index=new Map(matches.map(match=>[match.value,match]));
 return devices.map(device=>{
  const a=index.get(device.imei1),b=device.imei2?index.get(device.imei2):undefined;
  if(a&&b&&a.equipmentId!==b.equipmentId)fail(409,'Los IMEIs pertenecen a equipos distintos.','FOREIGN_RECEIPT_DEVICE_CONFLICT');
  const match=a??b;
  if(match&&device.imei2&&(!a||!b))fail(409,'El segundo IMEI no coincide con los datos del equipo.','FOREIGN_RECEIPT_DEVICE_CONFLICT');
  if(!allowSold&&match?.equipment.saleEquipment.length)fail(409,'Este equipo tiene una venta asociada. Usa Desde venta.','FOREIGN_RECEIPT_HAS_SALE');
  const [first,second]=match?.equipment.imeis??[];
  const sale=clientId?match?.equipment.saleEquipment.find(line=>line.sale.buyerId===clientId):undefined;
  return {device:{...device,imei1:first?.value??device.imei1,imei2:second?.value??device.imei2??''},
   link:{equipmentId:match?.equipmentId??null,saleEquipmentId:sale?.id??null}};
 });
}

export async function requireIssuer(tx:Db,format:number){
 const issuer=await tx.foreignReceiptIssuer.findUnique({where:{format}});
 const parsed=foreignReceiptIssuer.safeParse(issuer?.config);
 if(!parsed.success)return fail(409,'Configura el emisor para este formato antes de generar una boleta.','FOREIGN_RECEIPT_ISSUER_REQUIRED');
 if(format>=4&&format<=6&&!parsed.data.tipoCambioPenUsd)return fail(409,'Configura el tipo de cambio PEN/USD de este emisor.','FOREIGN_RECEIPT_RATE_REQUIRED');
 return parsed.data;
}

function writeRows(devices:Device[],links:Link[]){
 const imeis=imeisFor(devices);
 if(new Set(imeis).size!==imeis.length)fail(400,'Hay IMEIs repetidos en la selección.','FOREIGN_RECEIPT_DUPLICATE_INPUT');
 return {
  lines:{create:links.map((link,position)=>({...link,position}))},
  imeis:{create:imeis.map(imei=>({imei}))},
 };
}
function totalsFor(snapshot:ForeignReceiptSnapshot){
 const total=Number(snapshot.devices.reduce((sum,device)=>sum+cents(device.price),0n))/100;
 return receiptTotals(total,Number(snapshot.issuer.tipoCambioPenUsd||3.75));
}

export async function issueForeignReceipt(tx:Db,actor:AuditContext,input:{
 format:number;source:'SALE'|'MANUAL';clientId:string|null;issuedAt:Date;purchaseAt:Date|null;
 snapshot:ForeignReceiptSnapshot;links:Link[];requestKey?:string;requestHash?:string;
}){
 // The caller holds the shared folio lock and has already checked duplicates.
 const {snapshot,links,...data}=input;
 const counter=await tx.foreignReceiptCounter.update({where:{id:1},data:{last:{increment:1}}});
 const receipt=await tx.foreignReceipt.create({data:{...data,folio:counter.last,document:snapshot.customer.document,
  snapshot,...totalsFor(snapshot),...writeRows(snapshot.devices,links)}});
 await writeAudit(tx,actor,'FOREIGN_RECEIPT_CREATED','ForeignReceipt',receipt.id,{folio:receipt.folio,source:input.source});
 return receipt;
}

export function foreignReceipts(db:PrismaClient,actor:AuditContext={}){
 const get=async(id:unknown)=>{
  const result=await db.foreignReceipt.findUnique({where:{id:idSchema.parse(id)}});
  return result??fail(404,'No encontramos esa boleta.','FOREIGN_RECEIPT_NOT_FOUND');
 };
 return {
  get,
  async lookupSales(raw:unknown){
   const document=z.string().regex(/^\d{8}$/,'Ingresa un DNI de 8 dígitos.').parse(raw);
   const client=await db.client.findUnique({where:{dni:document},select:{id:true,firstName:true,lastName:true,fullName:true}});
   if(!client)return {customer:null,lines:[]};
   const lines=await db.saleEquipment.findMany({where:{sale:{buyerId:client.id}},include:saleLineInclude,
    orderBy:[{sale:{occurredAt:'desc'}},{id:'asc'}],take:100});
   return {customer:{document,fullName:customerName(client),type:'DNI'},lines:lines.map(line=>({
    id:line.id,code:line.sale.code,purchaseAt:line.sale.occurredAt,device:mapSaleLine(line),
   }))};
  },
  async manualLookup(raw:unknown){
   const input=z.object({document:z.string().regex(/^\d{8}$/).optional(),imei:z.string().regex(/^\d{15}$/).optional()}).strict().parse(raw);
   const [client,equipment]=await Promise.all([
    input.document?db.client.findUnique({where:{dni:input.document},select:{firstName:true,lastName:true,fullName:true}}):null,
    input.imei?db.equipment.findFirst({where:{imeis:{some:{value:input.imei}}},select:{...equipmentSelect,saleEquipment:{select:{id:true}}}}):null,
   ]);
   return {fullName:client?customerName(client):null,equipment:equipment?{
    imei1:equipment.imeis[0]?.value??'',imei2:equipment.imeis[1]?.value??'',commercialName:equipment.commercialName||equipment.model,
    brand:equipment.brand,model:equipment.model,serialNumber:equipment.serialNumber??'',storage:equipment.storage??'',color:equipment.color??'',
    hasSale:equipment.saleEquipment.length>0,
   }:null};
  },
  async list(raw:unknown){
   const {by,q,before}=foreignReceiptHistoryQuery.parse(raw);
   const where:Prisma.ForeignReceiptWhereInput={};
   if(before)where.folio={lt:before};
   if(q){
    if(by==='folio'){
     if(!/^\d+$/.test(q)||Number(q)>2147483647)return {rows:[],next:null};
     where.AND=[{folio:Number(q)}];
    }else if(by==='imei')where.imeis={some:{imei:q}};
    else where.document=normalizeReceiptDocument(q);
   }
   const rows=await db.foreignReceipt.findMany({where,orderBy:{folio:'desc'},take:51});
   const page=rows.slice(0,50);
   return {rows:page,next:rows.length>50?page[page.length-1].folio:null};
  },
  async issuers(){
   return Object.fromEntries((await db.foreignReceiptIssuer.findMany()).filter(row=>isActiveForeignReceiptFormat(row.format)).map(row=>[row.format,row.config]));
  },
  async setIssuer(rawFormat:unknown,raw:unknown){
   const format=activeForeignReceiptFormat.parse(rawFormat),config=foreignReceiptIssuer.parse(raw);
   return db.$transaction(async tx=>{
    await tx.foreignReceiptIssuer.upsert({where:{format},create:{format,config},update:{config}});
    await writeAudit(tx,actor,'FOREIGN_RECEIPT_ISSUER_UPDATED','ForeignReceiptIssuer',undefined,{format});
    return config;
   });
  },
  async create(raw:unknown){
   const input=foreignReceiptCreate.parse(raw);
   const requestHash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
   return db.$transaction(async tx=>{
    await lockForeignReceiptCounter(tx);
    const repeated=await tx.foreignReceipt.findUnique({where:{requestKey:input.requestKey}});
    if(repeated){
     if(repeated.requestHash!==requestHash)return fail(409,'La solicitud ya se usó con otros datos.','FOREIGN_RECEIPT_RETRY_CONFLICT');
     return {receipt:repeated,existing:false};
    }
    let customer:ForeignReceiptCustomer,devices:Device[],links:Link[],clientId:string|null,purchaseAt:Date|null=null,issuedAt:Date;
    if(input.source==='SALE'){
     const ids=new Set(input.saleLineIds);
     if(ids.size!==input.saleLineIds.length)return fail(400,'Hay líneas de venta repetidas.','FOREIGN_RECEIPT_DUPLICATE_INPUT');
     const buyer=await tx.client.findUnique({where:{dni:input.document}});
     if(!buyer?.dni)return fail(404,'No encontramos el cliente de la venta.','FOREIGN_RECEIPT_CLIENT_NOT_FOUND');
     const lines=await tx.saleEquipment.findMany({where:{id:{in:[...ids]},sale:{buyerId:buyer.id}},include:saleLineInclude,orderBy:{id:'asc'}});
     if(lines.length!==ids.size)return fail(409,'Revisa las ventas del cliente y vuelve a seleccionarlas.','FOREIGN_RECEIPT_SALE_MISMATCH');
     devices=lines.map(mapSaleLine);
     if(devices.some(device=>!device.imei1||Number(device.price)<=0))return fail(409,'Cada equipo seleccionado requiere IMEI y un precio mayor que cero.','FOREIGN_RECEIPT_SALE_INCOMPLETE');
     links=lines.map(line=>({equipmentId:line.equipment.id,saleEquipmentId:line.id}));
     customer={type:'DNI',document:buyer.dni,fullName:customerName(buyer)};
     clientId=buyer.id;
     ({purchaseAt,issuedAt}=receiptDateFromPurchase(lines.map(line=>line.sale.occurredAt)));
    }else{
     ({customer,devices}=input);
     issuedAt=new Date(limaDateTimeIso(input.issuedAt));
     clientId=customer.type==='DNI'?(await tx.client.findUnique({where:{dni:customer.document},select:{id:true}}))?.id??null:null;
     links=devices.map(()=>({equipmentId:null,saleEquipmentId:null}));
    }
    const conflicts=await tx.foreignReceipt.findMany({where:{imeis:{some:{imei:{in:imeisFor(devices)}}}},take:2});
    if(conflicts.length===1)return {receipt:conflicts[0],existing:true};
    if(conflicts.length>1)return fail(409,'La selección contiene equipos de distintas boletas existentes. Búscalos por IMEI en el historial.','FOREIGN_RECEIPT_DUPLICATE');
    if(input.source==='MANUAL'){
     const resolved=await resolveManualLinks(tx,devices,clientId);
     devices=resolved.map(row=>row.device);links=resolved.map(row=>row.link);
     const existing=await tx.foreignReceipt.findFirst({where:{imeis:{some:{imei:{in:imeisFor(devices)}}}}});
     if(existing)return {receipt:existing,existing:true};
    }
    if(imeisFor(devices).some(imei=>!isValidImeiLuhn(imei)))return fail(409,'Corrige el IMEI del equipo antes de generar una boleta.','FOREIGN_RECEIPT_INVALID_IMEI');
    const issuer=await requireIssuer(tx,input.format);
    const snapshot={customer,devices,issuer};
    const receipt=await issueForeignReceipt(tx,actor,{format:input.format,source:input.source,clientId,issuedAt,purchaseAt,
     snapshot,links,requestKey:input.requestKey,requestHash});
    return {receipt,existing:false};
   });
  },
  async update(rawId:unknown,raw:unknown){
   const id=idSchema.parse(rawId),input=foreignReceiptUpdate.parse(raw);
   return db.$transaction(async tx=>{
    await lockForeignReceiptCounter(tx);
    const current=await tx.foreignReceipt.findUnique({where:{id}});
    if(!current)return fail(404,'No encontramos esa boleta.','FOREIGN_RECEIPT_NOT_FOUND');
    if(current.updatedAt.toISOString()!==input.expectedUpdatedAt)return fail(409,'Otra persona actualizó la boleta. Ábrela de nuevo.','FOREIGN_RECEIPT_STALE');
    if(input.format!==current.format)activeForeignReceiptFormat.parse(input.format);
    if(input.manual&&current.source==='SALE')return fail(400,'Los equipos y precios provienen de las ventas vinculadas.','FOREIGN_RECEIPT_SALE_LOCKED');
    const prior=snapshotOf(current);
    const snapshot={customer:input.manual?.customer??prior.customer,devices:input.manual?.devices??prior.devices,
     issuer:input.format===current.format?prior.issuer:await requireIssuer(tx,input.format)};
    let rows,clientId=current.clientId;
    const deviceKeys=(devices:Device[])=>JSON.stringify(devices.map(device=>[device.imei1,device.imei2||'']));
    const changedDevices=deviceKeys(snapshot.devices)!==deviceKeys(prior.devices);
    if(input.manual&&(snapshot.customer.document!==prior.customer.document||snapshot.customer.type!==prior.customer.type)){
     clientId=snapshot.customer.type==='DNI'?(await tx.client.findUnique({where:{dni:snapshot.customer.document},select:{id:true}}))?.id??null:null;
    }
    if(changedDevices){
     const resolved=await resolveManualLinks(tx,snapshot.devices,clientId,current.source==='IMPORTED');
     snapshot.devices=resolved.map(row=>row.device);
     const conflict=await tx.foreignReceiptImei.findFirst({where:{receiptId:{not:id},imei:{in:imeisFor(snapshot.devices)}}});
     if(conflict)return fail(409,'Un IMEI ya pertenece a otra boleta.','FOREIGN_RECEIPT_DUPLICATE');
     if(imeisFor(snapshot.devices).some(imei=>!isValidImeiLuhn(imei)))return fail(409,'Corrige el IMEI del equipo antes de guardar.','FOREIGN_RECEIPT_INVALID_IMEI');
     rows=writeRows(snapshot.devices,resolved.map(row=>row.link));
     await tx.foreignReceiptLine.deleteMany({where:{receiptId:id}});
     await tx.foreignReceiptImei.deleteMany({where:{receiptId:id}});
    }
    const date=input.issuedAt??input.manual?.issuedAt,issuedAt=date&&date!==receiptDateInLima(current.issuedAt)?new Date(limaDateTimeIso(date)):undefined;
    const pricesChanged=JSON.stringify(snapshot.devices.map(row=>row.price))!==JSON.stringify(prior.devices.map(row=>row.price));
    const totals=pricesChanged?totalsFor(snapshot):input.format!==current.format?
     {totalUsd:receiptTotals(current.totalPen.toNumber(),Number(snapshot.issuer.tipoCambioPenUsd||3.75)).totalUsd}:{};
    const result=await tx.foreignReceipt.update({where:{id},data:{format:input.format,clientId,document:snapshot.customer.document,
     issuedAt,snapshot,...totals,...rows}});
    await writeAudit(tx,actor,'FOREIGN_RECEIPT_UPDATED','ForeignReceipt',id,{folio:result.folio});
    return result;
   });
  },
  async verify(raw:unknown){
   const input=foreignReceiptVerify.parse(raw);
   const row=await db.foreignReceipt.findUnique({where:{folio:input.folio},select:{
    folio:true,format:true,issuedAt:true,totalClp:true,totalUsd:true,snapshot:true,
   }});
   if(!row)return {found:false};
   const {issuer}=snapshotOf(row);
   const currency=foreignReceiptFormats.find(format=>format.id===row.format)?.currency;
   const amount=currency==='USD'?row.totalUsd:row.totalClp;
   const found=normalizeReceiptDocument(issuer.rut??'')===input.issuerDocument&&receiptDateInLima(row.issuedAt).slice(0,10)===input.date&&amount.eq(input.amount);
   return found?{found:true,folio:row.folio,issuer:issuer.nombre??''}:{found:false};
  },
 };
}
