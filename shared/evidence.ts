import {z} from 'zod';
import {idSchema,imeiValueSchema} from './validation.js';
export const photoEvidenceCategories=['DNI_FRONT','DNI_BACK','DEVICE_BOX','PURCHASE_RECEIPT','LOGICAL_IMEI'] as const;
export const movistarDeclarationCategory='MOVISTAR_DECLARATION';
export const evidenceCategories=[...photoEvidenceCategories,movistarDeclarationCategory] as const;
export type EvidenceCategory=typeof evidenceCategories[number];
export const evidenceLabels:Record<EvidenceCategory,string>={DNI_FRONT:'DNI FRONTAL',DNI_BACK:'DNI POSTERIOR',DEVICE_BOX:'CAJA DEL EQUIPO',PURCHASE_RECEIPT:'BOLETA DE VENTA',LOGICAL_IMEI:'IMEI LÓGICO',MOVISTAR_DECLARATION:'Declaración jurada de Movistar'};
export const movistarDeclarationInvalid='Adjunta una declaración jurada en PDF válido.';
export const maxEvidenceBytes=10*1024*1024,maxEvidencePixels=20_000_000;
export const evidenceLinkSchema=z.object({assetId:idSchema,category:z.enum(evidenceCategories),imeiValues:z.array(imeiValueSchema).min(1).max(2)}).strict();
export const evidenceLinksSchema=z.array(evidenceLinkSchema).max(10).superRefine((rows,ctx)=>{const pairs=new Set<string>(),assets=new Set<string>();for(const [index,row] of rows.entries()){if(assets.has(row.assetId)||new Set(row.imeiValues).size!==row.imeiValues.length)ctx.addIssue({code:'custom',path:[index],message:'ASOCIACIÓN DE EVIDENCIA INVÁLIDA.'});assets.add(row.assetId);for(const value of row.imeiValues){const key=row.category+value;if(pairs.has(key))ctx.addIssue({code:'custom',path:[index],message:'SOLO UNA IMAGEN POR CATEGORÍA Y SOLICITUD.'});pairs.add(key);}}});
export const uploadInitSchema=z.object({idempotencyKey:idSchema,operationKey:idSchema.optional(),requestId:idSchema.optional(),category:z.enum(evidenceCategories),mimeType:z.enum(['image/jpeg','image/png','image/webp','application/pdf']),fileSize:z.int32().min(1),checksum:z.string().regex(/^[a-f0-9]{64}$/)}).strict()
 .refine(v=>!!v.operationKey!==!!v.requestId,'INDICA UNA OPERACIÓN O SOLICITUD.')
 .refine(v=>v.mimeType!=='application/pdf'||v.category==='PURCHASE_RECEIPT'||v.category===movistarDeclarationCategory,'Esta evidencia requiere una imagen.')
 .superRefine((value,ctx)=>{
  if(value.category!==movistarDeclarationCategory){
   if(value.fileSize>maxEvidenceBytes)ctx.addIssue({code:'custom',path:['fileSize'],message:'El archivo debe pesar hasta 10 MB.'});
   return;
  }
  if(value.mimeType!=='application/pdf')ctx.addIssue({code:'custom',path:['mimeType'],message:movistarDeclarationInvalid});
 });
export const evidenceVerifySchema=z.object({receiptPage:z.number().int().min(1).max(30).optional()}).strict();
export const evidenceAttachSchema=z.object({assetId:idSchema,category:z.enum(photoEvidenceCategories),expectedEvidenceId:idSchema.nullable(),confirm:z.literal(true)}).strict();
export const evidenceDeleteSchema=z.object({confirm:z.literal(true)}).strict();
export interface PreparedEvidence {assetId:string;category:EvidenceCategory;fileSize:number;width:number|null;height:number|null}
export interface EvidenceView {id:string;category:EvidenceCategory;asset:{id:string;fileSize:number;mimeType:string;width:number|null;height:number|null;originalPdf?:boolean;receiptPage?:number|null}}
export interface EvidenceUpload {assetId:string;uploadUrl:string;headers:Record<string,string>;expiresIn:number}
