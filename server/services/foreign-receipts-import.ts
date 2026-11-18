import {Prisma,type PrismaClient} from '@prisma/client';
import {z} from 'zod';
import {foreignIssuerFields,foreignReceiptIssuer,normalizeReceiptDocument,type ForeignReceiptSnapshot} from '../../shared/foreign-receipts.js';
import {lockForeignReceiptCounter} from './foreign-receipts.service.js';

const record=z.record(z.string(),z.unknown());
const rowSchema=z.object({id:z.string().trim().min(1).max(200),nBoleta:z.coerce.number().int().positive().max(2147483646).optional(),
 formato:z.coerce.number().int().min(1).max(7).default(1),boletaData:record}).passthrough();
const exportSchema=z.object({boletas:z.array(z.unknown()),emisores:record.optional(),
 ultimoFolio:z.coerce.number().int().min(0).max(2147483646).optional()});
const obj=(value:unknown)=>record.safeParse(value).data??{};
const str=(value:unknown,max:number)=>typeof value==='string'||typeof value==='number'?String(value).trim().slice(0,max):'';
const num=(value:unknown)=>/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(str(value,30))?new Prisma.Decimal(String(value)):null;

function historicDate(value:unknown){
 const raw=str(value,40);
 const time=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(raw)?`${raw}-05:00`:raw;
 if(!/^\d{4}-\d{2}-\d{2}T/.test(time)||!z.iso.date().safeParse(time.slice(0,10)).success)return null;
 const result=new Date(time);
 return Number.isFinite(result.getTime())?result:null;
}
function configFrom(value:unknown){
 const issuer=obj(value);
 const values=Object.fromEntries(Object.keys(foreignIssuerFields).flatMap(key=>{
  const text=str(issuer[key],400);
  return text?[[key,text]]:[];
 }));
 const logo=typeof issuer.logoDataUrl==='string'&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(issuer.logoDataUrl)?issuer.logoDataUrl:undefined;
 return {...values,...(logo?{logoDataUrl:logo}:{})};
}

function normalize(raw:unknown){
 const row=rowSchema.parse(raw),data=row.boletaData,customer=obj(data.cliente),map=obj(data.equiposMap);
 const folio=z.coerce.number().int().positive().max(2147483646).parse(row.nBoleta??data.nBoleta);
 const issuedAt=historicDate(data.fechaHora??row.fechaHora);
 const document=normalizeReceiptDocument(str(customer.dni??row.clienteDni,40));
 const fullName=str(customer.nombre??row.clienteNombre,201);
 const rawType=str(customer.tipoDocumento??row.tipoDocumento,15).toUpperCase();
 const type=rawType==='RUT'||rawType==='CE'||rawType==='PASAPORTE'||rawType==='DNI'?rawType:/^\d{8}$/.test(document)?'DNI':'RUT';
 const devices=(Array.isArray(data.ventas)?data.ventas:[]).map(item=>{
  const line=obj(item),imei1=str(line.imeiEquipo,30),equipment=obj(map[imei1]),imei2=str(line.imei2Equipo||equipment.imei2,30);
  const price=num(line.precio);
  if(!/^\d{15}$/.test(imei1)||imei2&&!/^\d{15}$/.test(imei2)||!price)throw Error('EQUIPO_INCOMPLETO');
  return {imei1,imei2,price:price.toFixed(2),serialNumber:str(equipment.sn||line.sn,80),brand:str(equipment.marca||line.marcaEquipo,80),
   model:str(equipment.modelo||line.modeloEquipo,100),commercialName:str(equipment.nombreComercial||line.nombreComercial||line.modeloEquipo,140),
   storage:str(equipment.memoria||line.memoria,40),color:str(equipment.color||line.color,80)};
 });
 if(!issuedAt||!fullName||!/^[A-Z0-9]{3,20}$/.test(document)||!devices.length||devices.length>20)throw Error('DATOS_INCOMPLETOS');
 const imeis=devices.flatMap(item=>item.imei2?[item.imei1,item.imei2]:[item.imei1]);
 if(new Set(imeis).size!==imeis.length)throw Error('IMEI_REPETIDO_EN_ORIGEN');
 const issuer=configFrom(data.emisor??row.emisor);
 const totalPen=num(row.totalPen??data.totalPen)??devices.reduce((total,item)=>total.plus(item.price),new Prisma.Decimal(0));
 const totalClp=num(row.totalClp??data.totalClp)??new Prisma.Decimal(0);
 const recordedUsd=num(row.totalUsd??data.totalUsd);
 const rate=num((issuer as {tipoCambioPenUsd?:string}).tipoCambioPenUsd);
 const totalUsd=recordedUsd??(rate&&rate.gt(0)?totalPen.div(rate).toDecimalPlaces(2):new Prisma.Decimal(0));
 const snapshot:ForeignReceiptSnapshot={customer:{type,document,fullName},devices,issuer};
 return {row,folio,issuedAt,imeis,snapshot,totalPen,totalClp,totalUsd};
}

export async function importForeignReceipts(db:PrismaClient,raw:unknown,apply=false){
 const input=exportSchema.parse(Array.isArray(raw)?{boletas:raw}:raw);
 return db.$transaction(async tx=>{
  if(apply)await lockForeignReceiptCounter(tx);
  const counter=await tx.foreignReceiptCounter.findUniqueOrThrow({where:{id:1}});
  const report={mode:apply?'apply':'dry-run',ready:0,existing:0,nextFolio:Math.max(counter.last,input.ultimoFolio??0)+1,issuers:0,
   review:[] as {row?:number;folio?:number;reason:string}[]};
  const seenFolios=new Set<number>(),seenImeis=new Set<string>(),seenLegacyIds=new Set<string>();
  for(const [index,rawRow] of input.boletas.entries()){
   let data;
   try{data=normalize(rawRow);}catch(error){
    report.review.push({row:index+1,reason:error instanceof z.ZodError?'FORMATO_DE_EXPORTACIÓN_INVALIDO':(error as Error).message});
    continue;
   }
   const {row,folio,imeis,snapshot}=data;
   if(seenLegacyIds.has(row.id)||seenFolios.has(folio)||imeis.some(imei=>seenImeis.has(imei))){
    report.review.push({row:index+1,folio,reason:'DUPLICADO_EN_EXPORTACIÓN'});continue;
   }
   seenLegacyIds.add(row.id);seenFolios.add(folio);imeis.forEach(imei=>seenImeis.add(imei));
   const [existing,occupied,locks]=await Promise.all([
    tx.foreignReceipt.findUnique({where:{legacyId:row.id}}),
    tx.foreignReceipt.findUnique({where:{folio}}),
    tx.foreignReceiptImei.count({where:{imei:{in:imeis}}}),
   ]);
   if(existing){report.existing++;continue;}
   if(occupied||locks){report.review.push({row:index+1,folio,reason:occupied?'FOLIO_OCUPADO':'IMEI_OCUPADO'});continue;}
   const [client,known]=await Promise.all([
    snapshot.customer.type==='DNI'?tx.client.findUnique({where:{dni:snapshot.customer.document},select:{id:true}}):null,
    tx.imei.findMany({where:{value:{in:imeis}},select:{value:true,equipmentId:true,
     equipment:{select:{saleEquipment:{select:{id:true,sale:{select:{buyerId:true}}}}}}}}),
   ]);
   const byImei=new Map(known.map(item=>[item.value,item]));
   const links=snapshot.devices.map((device,position)=>{
    const matches=[byImei.get(device.imei1),byImei.get(device.imei2??'')].filter(value=>value!==undefined);
    const same=matches.length&&matches.every(match=>match.equipmentId===matches[0].equipmentId)?matches[0]:undefined;
    const sales=same?.equipment.saleEquipment.filter(line=>!!client&&line.sale.buyerId===client.id)??[];
    if(!same||sales.length>1)report.review.push({row:index+1,folio,reason:'REVISAR_VINCULO_CON_EQUIPO_O_VENTA'});
    return {position,equipmentId:same?.equipmentId??null,saleEquipmentId:sales.length===1?sales[0].id:null};
   });
   if(apply)await tx.foreignReceipt.create({data:{folio,format:row.formato,source:'IMPORTED',legacyId:row.id,
    issuedAt:data.issuedAt,document:snapshot.customer.document,clientId:client?.id,snapshot,
    totalPen:data.totalPen,totalClp:data.totalClp,totalUsd:data.totalUsd,
    lines:{create:links},imeis:{create:imeis.map(imei=>({imei}))}}});
   report.ready++;report.nextFolio=Math.max(report.nextFolio,folio+1);
  }
  for(let format=1;format<=7;format++){
   const rawIssuer=input.emisores?.[`formato${format}`]??input.emisores?.[String(format)];
   if(rawIssuer===undefined)continue;
   const config=foreignReceiptIssuer.safeParse(configFrom(rawIssuer));
   if(!config.success){report.review.push({reason:`EMISOR_FORMATO_${format}_PENDIENTE`});continue;}
   if(await tx.foreignReceiptIssuer.findUnique({where:{format}}))continue;
   if(apply)await tx.foreignReceiptIssuer.create({data:{format,config:config.data}});
   report.issuers++;
  }
  if(apply&&report.nextFolio>counter.last+1)await tx.foreignReceiptCounter.update({where:{id:1},data:{last:report.nextFolio-1}});
  return report;
 },{timeout:120000});
}
