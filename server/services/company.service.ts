import type {PrismaClient} from '@prisma/client';
import {companySchema,companyDefaults} from '../../shared/company.js';
import {writeAudit,type AuditContext} from '../lib/audit.js';
export function createCompanyService(db:PrismaClient,ctx:AuditContext={}) {
 return {
  get:async()=>{await db.companySettings.createMany({data:[{id:1,...companyDefaults}],skipDuplicates:true});return db.companySettings.findUniqueOrThrow({where:{id:1}});},
  update:(raw:unknown)=>{const input=companySchema.parse(raw);return db.$transaction(async tx=>{
   const saved=await tx.companySettings.upsert({where:{id:1},create:{id:1,...input,updatedById:ctx.userId},update:{...input,updatedById:ctx.userId}});
   await writeAudit(tx,ctx,'COMPANY_SETTINGS_UPDATE','CompanySettings',undefined,{configurationId:1,fields:Object.keys(input)});return saved;
  });},
 };
}
