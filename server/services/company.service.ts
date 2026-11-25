import {Prisma,type PrismaClient} from '@prisma/client';
import sharp from 'sharp';
import {companySchema,companyDefaults,maxReceiptLogoBytes,type ReceiptLogo} from '../../shared/company.js';
import {imageSignature} from '../evidence/image.js';
import {DomainError} from '../lib/errors.js';
import {writeAudit,type AuditContext} from '../lib/audit.js';
export function createCompanyService(db:PrismaClient,ctx:AuditContext={}) {
 const saveLogo=(logo:ReceiptLogo|null)=>db.$transaction(async tx=>{
  const receiptLogo=logo?{...logo}:Prisma.DbNull;
  const saved=await tx.companySettings.upsert({
   where:{id:1},
   create:{id:1,...companyDefaults,receiptLogo,updatedById:ctx.userId},
   update:{receiptLogo,updatedById:ctx.userId},
  });
  await writeAudit(tx,ctx,'COMPANY_SETTINGS_UPDATE','CompanySettings',undefined,{configurationId:1,fields:['receiptLogo']});
  return saved;
 });
 return {
  setReceiptLogo:async(bytes:unknown)=>{
   if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>maxReceiptLogoBytes||!imageSignature(bytes)){
    throw new DomainError(400,'Selecciona un logo PNG, JPEG o WebP de hasta 2 MB.','RECEIPT_LOGO_INVALID');
   }
   let logo:ReceiptLogo;
   try{
    const image=sharp(bytes,{limitInputPixels:20_000_000,failOn:'warning'});
    if(((await image.metadata()).pages??1)!==1)throw new Error('Invalid image');
    const {data,info}=await image.autoOrient().resize({width:480,height:240,fit:'inside',withoutEnlargement:true})
     .flatten({background:'#ffffff'}).jpeg({quality:88}).toBuffer({resolveWithObject:true});
    logo={dataUrl:`data:image/jpeg;base64,${data.toString('base64')}`,width:info.width,height:info.height};
   }catch{
    throw new DomainError(400,'No se pudo leer el logo. Prueba con otra imagen PNG, JPEG o WebP.','RECEIPT_LOGO_INVALID');
   }
   return saveLogo(logo);
  },
  removeReceiptLogo:()=>saveLogo(null),
  get:async()=>{await db.companySettings.createMany({data:[{id:1,...companyDefaults}],skipDuplicates:true});return db.companySettings.findUniqueOrThrow({where:{id:1}});},
  update:(raw:unknown)=>{const input=companySchema.parse(raw);return db.$transaction(async tx=>{
   const saved=await tx.companySettings.upsert({where:{id:1},create:{id:1,...input,updatedById:ctx.userId},update:{...input,updatedById:ctx.userId}});
   await writeAudit(tx,ctx,'COMPANY_SETTINGS_UPDATE','CompanySettings',undefined,{configurationId:1,fields:Object.keys(input)});return saved;
  });},
 };
}
