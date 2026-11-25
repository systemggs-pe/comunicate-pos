import {z} from 'zod';
import {idSchema,imeiValueSchema,moneySchema} from './validation.js';

export const foreignReceiptFormats=[
 {id:1,label:'Térmica 80 mm · Formato 1',currency:'CLP'},
 {id:2,label:'Térmica 80 mm · Formato 2',currency:'CLP'},
 {id:3,label:'Térmica 80 mm · Pizarro',currency:'CLP'},
 {id:4,label:'Página completa · Letter',currency:'USD'},
 {id:5,label:'Marketplace · A4',currency:'USD'},
 {id:6,label:'Tienda · Letter',currency:'USD'},
 {id:7,label:'Thermer · 48 mm',currency:'CLP'},
] as const;
export const foreignReceiptFormat=z.coerce.number().int().min(1).max(7);
export const activeForeignReceiptFormats=foreignReceiptFormats.filter(({id})=>id!==4&&id!==5&&id!==6);
export const isActiveForeignReceiptFormat=(id:number)=>activeForeignReceiptFormats.some(format=>format.id===id);
export const activeForeignReceiptFormat=foreignReceiptFormat.refine(isActiveForeignReceiptFormat,'Este formato ya no está disponible para emisión.');
export const normalizeReceiptDocument=(value:string)=>value.trim().toUpperCase().replace(/[.\s-]/g,'');
const document=z.string().max(40).transform(normalizeReceiptDocument).pipe(z.string().regex(/^[A-Z0-9]{3,20}$/,'Ingresa un documento válido.'));
const amount=moneySchema.refine(value=>Number(value)>0,'El importe debe ser mayor que cero.');
const opt=(max:number)=>z.string().trim().max(max).optional();
export const foreignReceiptLocalDateTime=z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,'Indica una fecha y hora válidas.').refine(value=>{
 const time=new Date(`${value}:00Z`);
 return Number.isFinite(time.getTime())&&time.toISOString().slice(0,16)===value;
},'Indica una fecha y hora válidas.');

export const foreignReceiptCustomer=z.object({
 type:z.enum(['DNI','RUT','CE','PASAPORTE']),
 document,
 fullName:z.string().trim().min(1,'Ingresa el nombre del cliente.').max(201),
}).strict().refine(value=>value.type!=='DNI'||/^\d{8}$/.test(value.document),'El DNI debe tener 8 dígitos.');

export const foreignReceiptDevice=z.object({
 imei1:imeiValueSchema,
 imei2:z.union([imeiValueSchema,z.literal('')]).optional(),
 serialNumber:opt(80),brand:opt(80),model:opt(100),commercialName:z.string().trim().min(1).max(140),
 storage:opt(40),color:opt(80),price:amount,
}).strict().refine(item=>item.imei1!==item.imei2,'Los IMEIs deben ser diferentes.');

const manual=z.object({
 customer:foreignReceiptCustomer,
 devices:z.array(foreignReceiptDevice).min(1).max(20),
 issuedAt:foreignReceiptLocalDateTime,
}).strict();
export const foreignReceiptCreate=z.discriminatedUnion('source',[
 z.object({source:z.literal('SALE'),format:activeForeignReceiptFormat,requestKey:idSchema,document,saleLineIds:z.array(idSchema).min(1).max(20)}).strict(),
 manual.extend({source:z.literal('MANUAL'),format:activeForeignReceiptFormat,requestKey:idSchema}).strict(),
]);
export const foreignReceiptUpdate=z.object({
 expectedUpdatedAt:z.iso.datetime({offset:true}),
 format:foreignReceiptFormat,
 issuedAt:foreignReceiptLocalDateTime.optional(),
 manual:manual.optional(),
}).strict();
export const foreignReceiptHistoryQuery=z.object({
 by:z.enum(['document','imei','folio']).optional(),
 q:z.string().trim().max(40).optional(),
 before:z.coerce.number().int().positive().max(2147483647).optional(),
}).strict();
export const foreignReceiptVerify=z.object({
 issuerDocument:document,
 folio:z.coerce.number().int().positive().max(2147483647),
 date:z.iso.date(),
 amount:z.string().regex(/^\d{1,14}(\.\d{1,2})?$/),
}).strict();

export const foreignIssuerFields={
 nombre:'Nombre del emisor',apellido:'Apellido',rut:'Documento del emisor',direccion:'Dirección',local:'Local',
 giro1:'Giro principal',giro2:'Giro secundario',comuna:'Comuna',ciudad:'Ciudad',vendedor:'Vendedor',pais:'País',
 email:'Correo',telefono:'Teléfono',sitioWeb:'Sitio web',metodoPago:'Medio de pago',tipoCambioPenUsd:'Soles por dólar',
 impuestoPorcentaje:'Impuesto (%)',notas:'Nota del emisor',terminos:'Términos',tarjetaUltimos4:'Últimos 4 dígitos',
 codigoTerminal:'Código de terminal',applicationId:'ID de aplicación',applicationPanSequence:'Secuencia PAN',deviceId:'ID del dispositivo',
 cardType:'Tipo de tarjeta',tvr:'TVR',tsi:'TSI',diasDevolucion:'Días para devolución',partNumber:'Número de parte',
 policyUrl:'URL de la política',supportMessage:'Mensaje de soporte',
} as const;
const issuerTextFields=Object.fromEntries(Object.keys(foreignIssuerFields).map(key=>[key,opt(400)])) as Record<keyof typeof foreignIssuerFields,ReturnType<typeof opt>>;
export const foreignReceiptIssuer=z.object({
 ...issuerTextFields,
 nombre:z.string().trim().min(1,'Configura el nombre del emisor.').max(180),
 rut:document,
 logoDataUrl:z.union([z.literal(''),z.string().max(17000).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/)]).optional(),
}).strict().superRefine((config,ctx)=>{
 for(const [key,min,max] of [['tipoCambioPenUsd',0.01,1000],['impuestoPorcentaje',0,100],['diasDevolucion',0,365]] as const){
  const value=config[key];
  if(value&&(!/^\d+(\.\d+)?$/.test(value)||Number(value)<min||Number(value)>max))ctx.addIssue({code:'custom',path:[key],message:'Revisa el valor numérico.'});
 }
 if(config.tarjetaUltimos4&&!/^\d{4}$/.test(config.tarjetaUltimos4))ctx.addIssue({code:'custom',path:['tarjetaUltimos4'],message:'Ingresa cuatro dígitos.'});
});

export type ForeignReceiptCreate=z.input<typeof foreignReceiptCreate>;
export type ForeignReceiptDevice=z.output<typeof foreignReceiptDevice>;
export type ForeignReceiptCustomer=z.output<typeof foreignReceiptCustomer>;
export type ForeignReceiptIssuer=z.output<typeof foreignReceiptIssuer>;
export type ForeignReceiptSnapshot={
 customer:ForeignReceiptCustomer;
 devices:ForeignReceiptDevice[];
 issuer:Partial<ForeignReceiptIssuer>;
};
export type ForeignReceiptView={
 id:string;folio:number;format:number;source:'SALE'|'MANUAL'|'IMPORTED';
 issuedAt:string;purchaseAt:string|null;totalPen:string;totalClp:string;totalUsd:string;
 updatedAt:string;snapshot:ForeignReceiptSnapshot;
};

export function receiptDateInLima(date:Date|string,includeSeconds=false){
 // Lima usa UTC-05:00 para las fechas operativas del POS.
 return new Date(new Date(date).getTime()-5*60*60*1000).toISOString().slice(0,includeSeconds?19:16);
}

export function receiptDateFromPurchase(dates:Date[]){
 const purchaseAt=new Date(Math.max(...dates.map(date=>date.getTime())));
 const issuedAt=new Date(purchaseAt);
 issuedAt.setUTCDate(issuedAt.getUTCDate()-1);
 return {purchaseAt,issuedAt};
}

export function receiptTotals(totalPen:number,rate:number){
 return {totalPen:totalPen.toFixed(2),totalClp:(Math.round(totalPen*266.67/5000)*5000).toFixed(2),
  totalUsd:(Math.round(totalPen/rate*100)/100).toFixed(2)};
}
