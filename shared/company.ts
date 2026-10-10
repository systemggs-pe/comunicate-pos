import {z} from 'zod';
import {normalizeText,normalizeEmail} from './normalization.js';
const text=(max:number)=>z.string().transform(normalizeText).pipe(z.string().max(max));
export const companySchema=z.object({
 businessName:text(100).pipe(z.string().min(1)),businessType:text(150),address:text(300),city:text(100),phone:z.string().trim().max(30),
 email:z.string().transform(normalizeEmail).pipe(z.union([z.literal(''),z.email().max(254)])),receiptFooter:text(500),
 defaultFormat:z.union([z.literal(48),z.literal(80),z.null()]),margin48:z.number().min(0).max(5),margin80:z.number().min(0).max(10),
 showClientContact:z.boolean(),showSerial:z.boolean(),showSeller:z.boolean(),
}).strict();
export type CompanyInput=z.infer<typeof companySchema>;
export interface CompanySettings extends CompanyInput {id:number;updatedAt:string;updatedById:string|null}
export const companyDefaults:CompanyInput={businessName:'COMUNIC@TE',businessType:'VENTA DE CELULARES Y ACCESORIOS',address:'',city:'',phone:'',email:'',receiptFooter:'GRACIAS POR SU COMPRA',defaultFormat:null,margin48:1,margin80:2,showClientContact:true,showSerial:true,showSeller:true};
