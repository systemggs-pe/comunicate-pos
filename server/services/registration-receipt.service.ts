import {randomUUID} from 'node:crypto';
import type {Prisma,PrismaClient} from '@prisma/client';
import {z} from 'zod';
import {foreignReceiptDevice,foreignReceiptIssuer,receiptDateFromPurchase,type ForeignReceiptSnapshot} from '../../shared/foreign-receipts.js';
import {limaDateTimeIso} from '../../shared/operational-date.js';
import type {ReceiptCandidate,RegistrationReceiptChoice,RegistrationReceiptOptions} from '../../shared/registration-receipt.js';
import {dniSchema,idSchema,imeiSchema} from '../../shared/validation.js';
import type {prepareEvidenceImage} from '../evidence/image.js';
import {attachOperationEvidence,cleanupEvidence,lockAsset} from '../evidence/lifecycle.js';
import {writeAudit,type AuditContext} from '../lib/audit.js';
import {DomainError} from '../lib/errors.js';
import type {EvidenceStorageProvider} from '../storage/provider.js';
import {createEvidenceStorage,S3EvidenceStorage} from '../storage/s3.js';
import {issueForeignReceipt,mapSaleLine,requireIssuer,saleLineInclude} from './foreign-receipts.service.js';

type Db=Prisma.TransactionClient;
type RequestRef={id:string;value:string};
const changed=()=>new DomainError(409,'La boleta o la venta cambió. Vuelve a consultar la boleta del equipo.','REGISTRATION_RECEIPT_CHANGED');
const snapshotOf=(value:unknown)=>value as ForeignReceiptSnapshot;

async function context(tx:Db,equipmentId:string|null,entered:string[]){
 const device=equipmentId?await tx.equipment.findUnique({where:{id:equipmentId},include:{owner:true,imeis:{orderBy:{slot:'asc'}}}}):null;
 if(equipmentId&&!device)throw changed();
 const imeis=[...new Set([...entered,...(device?.imeis.map(imei=>imei.value)??[])])];
 const foreign=await tx.foreignReceipt.findMany({where:{
  OR:[{imeis:{some:{imei:{in:imeis}}}},...(equipmentId?[{lines:{some:{equipmentId}}}]:[])],
  AND:{OR:[{lines:{none:{}}},{lines:{some:{equipmentId:null}}},...(equipmentId?[{lines:{some:{equipmentId}}}]:[])]},
 },orderBy:{folio:'desc'},take:12});
 const stored=equipmentId?await tx.equipmentReceiptEvidence.findMany({where:{equipmentId,foreignReceiptId:null,evidenceAsset:{status:'READY'}},
  include:{evidenceAsset:true},orderBy:{evidenceAsset:{createdAt:'desc'}},take:12}):[];
 const sale=equipmentId?await tx.saleEquipment.findUnique({where:{equipmentId},include:saleLineInclude}):null;
 return {device,imeis,foreign,stored,sale};
}

const lookupSchema=z.object({dni:dniSchema,imeis:z.array(imeiSchema).min(1).max(2),equipmentId:idSchema.optional()}).strict();
export async function registrationReceiptOptions(db:PrismaClient,raw:unknown,permissions:{foreign:boolean;issue:boolean;sales:boolean}):Promise<RegistrationReceiptOptions>{
 const input=lookupSchema.parse(raw),imeis=input.imeis.map(imei=>imei.value);
 const matches=await db.imei.findMany({where:{value:{in:imeis}},select:{equipmentId:true,equipment:{select:{owner:{select:{dni:true}}}}}});
 if(new Set(matches.map(row=>row.equipmentId)).size>1)throw new DomainError(409,'Los IMEIs pertenecen a equipos distintos.','IMEI_EQUIPMENT_CONFLICT');
 if(matches[0]&&matches[0].equipment.owner?.dni!==input.dni)throw new DomainError(409,'El equipo pertenece a otro cliente.','OWNER_MISMATCH');
 const equipmentId=matches[0]?.equipmentId??null;
 if(input.equipmentId&&input.equipmentId!==equipmentId)throw changed();
 const {foreign,stored,sale}=await context(db,equipmentId,imeis);
 const candidates:ReceiptCandidate[]=[
  ...(permissions.foreign?foreign:[]).map(row=>({kind:'FOREIGN' as const,id:row.id,version:row.updatedAt.toISOString(),folio:row.folio,
   issuer:snapshotOf(row.snapshot).issuer.nombre??'',date:row.issuedAt.toISOString(),format:row.format,
   needsReview:row.source==='IMPORTED'&&row.document!==input.dni})),
  ...stored.map(row=>({kind:'STORED' as const,id:row.evidenceAssetId,date:row.evidenceAsset.createdAt.toISOString(),
   originalPdf:!!row.evidenceAsset.originalStorageKey})),
 ];
 const formats=permissions.issue&&(!sale||permissions.sales)?(await db.foreignReceiptIssuer.findMany({orderBy:{format:'asc'}})).flatMap(row=>{
  const parsed=foreignReceiptIssuer.safeParse(row.config);
  return parsed.success&&(!(row.format>=4&&row.format<=6)||parsed.data.tipoCambioPenUsd)?[row.format]:[];
 }):[];
 const date=sale&&receiptDateFromPurchase([sale.sale.occurredAt]);
 return {candidates,formats,sold:!!sale,sale:permissions.sales&&sale&&date?{code:sale.sale.code,price:sale.unitPrice.toFixed(2),
  purchaseAt:date.purchaseAt.toISOString(),issuedAt:date.issuedAt.toISOString()}:null};
}

export async function reserveRegistrationReceipt(db:PrismaClient,operationKey:string,actor:AuditContext,sessionId:string|undefined,provider?:EvidenceStorageProvider){
 const id=randomUUID();
 const staged=await db.evidenceAsset.create({data:{
  id,storageKey:`evidence/${id}.webp`,category:'PURCHASE_RECEIPT',operationKey,
  idempotencyKey:randomUUID(),createdById:actor.userId,ownerSessionId:sessionId,expectedMimeType:'image/webp',
  expectedChecksum:'0'.repeat(64),expectedSize:1,expiresAt:new Date(Date.now()+3600000),uploadExpiresAt:new Date(),
 }});
 let owned:EvidenceStorageProvider|undefined;
 let wrote=false;
 return {
  id,
  async prepare(tx:Db,{bytes,...image}:Awaited<ReturnType<typeof prepareEvidenceImage>>){
   const locked=await lockAsset(tx,staged.id);
   if(!locked||locked.status!=='PENDING')throw changed();
   const storage=provider??(owned??=createEvidenceStorage());
   wrote=true;
   try{
    await storage.upload(staged.storageKey,bytes);
   }catch{throw new DomainError(503,'No se pudo guardar la boleta. Conserva el formulario y vuelve a intentar.','REGISTRATION_RECEIPT_STORAGE');}
   await tx.evidenceAsset.update({where:{id:staged.id},data:{...image,verifiedAt:new Date(),
    expectedChecksum:image.checksum,expectedSize:image.fileSize}});
  },
  async release(){
   try{
    if(!wrote){await db.evidenceAsset.deleteMany({where:{id,status:'PENDING'}});return;}
    const abandoned=await db.evidenceAsset.updateMany({where:{id,status:'PENDING'},data:{status:'DELETING'}});
    if(abandoned.count)await cleanupEvidence(db,provider??owned,[id]);
   }finally{if(owned instanceof S3EvidenceStorage)owned.client.destroy();}
  },
 };
}

type StagedReceipt=Awaited<ReturnType<typeof reserveRegistrationReceipt>>;

async function requireStoredObjects(asset:{storageKey:string;originalStorageKey:string|null},provider?:EvidenceStorageProvider){
 let owned:EvidenceStorageProvider|undefined;
 try{
  const storage=provider??(owned=createEvidenceStorage());
  const keys=asset.originalStorageKey?[asset.storageKey,asset.originalStorageKey]:[asset.storageKey];
  if((await Promise.all(keys.map(key=>storage.exists(key)))).every(Boolean))return;
 }catch{/* The draft must survive either missing objects or storage downtime. */}
 finally{if(owned instanceof S3EvidenceStorage)owned.client.destroy();}
 throw new DomainError(503,'La boleta guardada no está disponible. Reintenta o adjunta el original.','REGISTRATION_RECEIPT_STORAGE');
}

export async function attachRegistrationReceipt(tx:Db,params:{
 choice:RegistrationReceiptChoice;equipmentId:string;operationKey:string;requests:RequestRef[];actor:AuditContext;
 sessionId?:string;origin:string;staged?:StagedReceipt;entered:string[];storage?:EvidenceStorageProvider;
}){
 const {choice,equipmentId,operationKey,requests,actor,sessionId,origin,staged,entered}=params;
 const {device,imeis,foreign,stored,sale}=await context(tx,equipmentId,entered);
 if(!device?.owner)throw changed();
 let assetId:string;
 let receipt;
 if(choice.kind==='STORED'){
  const reusable=stored.find(row=>row.evidenceAssetId===choice.id);
  if(!reusable)throw changed();
  assetId=reusable.evidenceAssetId;
 }else{
  if(choice.kind==='FOREIGN'){
   receipt=foreign.find(row=>row.id===choice.id&&row.updatedAt.toISOString()===choice.version);
   if(!receipt)throw changed();
  }else{
   if(foreign.length||stored.length)throw changed();
   if((choice.kind==='SALE')!==!!sale)throw changed();
   const format=choice.format,issuer=await requireIssuer(tx,format);
   if(sale&&choice.kind==='SALE'&&sale.unitPrice.lte(0))throw new DomainError(422,'La línea de venta necesita un precio mayor que cero.','REGISTRATION_RECEIPT_SALE_PRICE');
   const item=choice.kind==='SALE'&&sale?mapSaleLine(sale):foreignReceiptDevice.parse({
    imei1:device.imeis[0]?.value,imei2:device.imeis[1]?.value??'',serialNumber:device.serialNumber??'',
    brand:device.brand,model:device.model,commercialName:device.commercialName||device.model||device.brand,
    storage:device.storage??'',color:device.color??'',price:choice.kind==='MANUAL'?choice.price:'0',
   });
   const dates=choice.kind==='MANUAL'?{issuedAt:new Date(limaDateTimeIso(choice.issuedAt)),purchaseAt:null}:receiptDateFromPurchase([sale!.sale.occurredAt]);
   const customer=sale&&choice.kind==='SALE'?await tx.client.findUniqueOrThrow({where:{id:sale.sale.buyerId}}):device.owner;
   receipt=await issueForeignReceipt(tx,actor,{source:choice.kind,format,clientId:customer.id,...dates,
    snapshot:{issuer,customer:{type:'DNI',document:customer.dni,fullName:customer.fullName||[customer.firstName,customer.lastName].filter(Boolean).join(' ')},
     devices:[item]},links:[{equipmentId,saleEquipmentId:sale?.id??null}]});
  }
  const cached=await tx.equipmentReceiptEvidence.findFirst({where:{equipmentId,foreignReceiptId:receipt.id,version:receipt.updatedAt,evidenceAsset:{status:'READY'}}});
  if(cached)assetId=cached.evidenceAssetId;
  else{
   if(!staged)throw changed();
   const {renderReceiptDocument,receiptPdfImage}=await import('../documents/registration-receipt-pdf.js');
   let image:Awaited<ReturnType<typeof prepareEvidenceImage>>;
   try{({image}=await receiptPdfImage(await renderReceiptDocument(receipt,origin),undefined,imeis));}
   catch{throw new DomainError(503,'No se pudo generar la boleta. Conserva el formulario y vuelve a intentar.','REGISTRATION_RECEIPT_RENDER');}
   await staged.prepare(tx,image);
   assetId=staged.id;
  }
 }
 if(staged&&assetId===staged.id){
  await attachOperationEvidence(tx,[{assetId,category:'PURCHASE_RECEIPT',imeiValues:requests.map(row=>row.value)}],operationKey,requests,actor,sessionId);
  await tx.equipmentReceiptEvidence.create({data:{equipmentId,evidenceAssetId:assetId,foreignReceiptId:receipt?.id,version:receipt?.updatedAt}});
 }else{
  const asset=await lockAsset(tx,assetId);
  if(!asset||asset.status!=='READY')throw changed();
  await requireStoredObjects({storageKey:asset.storageKey,originalStorageKey:receipt?null:asset.originalStorageKey},params.storage);
  for(const row of requests){
   const link=await tx.registrationEvidence.create({data:{registrationRequestId:row.id,evidenceAssetId:assetId,category:'PURCHASE_RECEIPT',createdById:actor.userId}});
   await writeAudit(tx,actor,'EVIDENCE_RECEIPT_REUSED','RegistrationEvidence',link.id,{requestId:row.id,assetId,folio:receipt?.folio??null});
  }
 }
}

export async function retainUploadedReceipt(tx:Db,equipmentId:string,requests:RequestRef[]){
 const links=await tx.registrationEvidence.findMany({where:{registrationRequestId:{in:requests.map(row=>row.id)},category:'PURCHASE_RECEIPT'},select:{evidenceAssetId:true}});
 await tx.equipmentReceiptEvidence.createMany({data:[...new Set(links.map(row=>row.evidenceAssetId))].map(evidenceAssetId=>({equipmentId,evidenceAssetId})),skipDuplicates:true});
}
