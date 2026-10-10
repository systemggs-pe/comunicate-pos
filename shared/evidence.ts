import {z} from 'zod';
import {idSchema,imeiValueSchema} from './validation.js';
export const evidenceCategories=['DNI_FRONT','DNI_BACK','DEVICE_BOX','PURCHASE_RECEIPT','LOGICAL_IMEI'] as const;
export type EvidenceCategory=typeof evidenceCategories[number];
export const evidenceLabels:Record<EvidenceCategory,string>={DNI_FRONT:'DNI FRONTAL',DNI_BACK:'DNI REVERSO',DEVICE_BOX:'CAJA DEL EQUIPO',PURCHASE_RECEIPT:'BOLETA DE VENTA',LOGICAL_IMEI:'IMEI LÓGICO'};
export const maxEvidenceBytes=10*1024*1024,maxEvidencePixels=20_000_000;
export const evidenceLinkSchema=z.object({assetId:idSchema,category:z.enum(evidenceCategories),imeiValues:z.array(imeiValueSchema).min(1).max(2)}).strict();
export const evidenceLinksSchema=z.array(evidenceLinkSchema).max(10).superRefine((rows,ctx)=>{const pairs=new Set<string>(),assets=new Set<string>();for(const [index,row] of rows.entries()){if(assets.has(row.assetId)||new Set(row.imeiValues).size!==row.imeiValues.length||row.category==='LOGICAL_IMEI'&&row.imeiValues.length!==1)ctx.addIssue({code:'custom',path:[index],message:'ASOCIACIÓN DE EVIDENCIA INVÁLIDA.'});assets.add(row.assetId);for(const value of row.imeiValues){const key=row.category+value;if(pairs.has(key))ctx.addIssue({code:'custom',path:[index],message:'SOLO UNA IMAGEN POR CATEGORÍA Y SOLICITUD.'});pairs.add(key);}}});
export const uploadInitSchema=z.object({idempotencyKey:idSchema,operationKey:idSchema.optional(),requestId:idSchema.optional(),category:z.enum(evidenceCategories),mimeType:z.enum(['image/jpeg','image/png','image/webp']),fileSize:z.number().int().min(1).max(maxEvidenceBytes),checksum:z.string().regex(/^[a-f0-9]{64}$/)}).strict().refine(v=>!!v.operationKey!==!!v.requestId,'INDICA UNA OPERACIÓN O SOLICITUD.');
export const evidenceAttachSchema=z.object({assetId:idSchema,category:z.enum(evidenceCategories),expectedEvidenceId:idSchema.nullable(),confirm:z.literal(true)}).strict();
export const evidenceDeleteSchema=z.object({confirm:z.literal(true)}).strict();
export interface PreparedEvidence {assetId:string;category:EvidenceCategory;fileSize:number;width:number;height:number}
export interface EvidenceView {id:string;category:EvidenceCategory;asset:{id:string;fileSize:number;mimeType:string;width:number|null;height:number|null}}
export interface EvidenceUpload {assetId:string;uploadUrl:string;headers:Record<string,string>;expiresIn:number}
