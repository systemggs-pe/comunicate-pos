import {z} from 'zod';
import {idSchema,imeiValueSchema} from './validation.js';
export const documentTypes=['BLUE','ELECTRONIC','MANUAL'] as const;
export const documentAuthorization=z.object({purpose:z.string().trim().min(3).max(200),authorizationReference:z.string().trim().min(3).max(200),confirmed:z.literal(true)});
export const photoLookupSchema=documentAuthorization.extend({documentType:z.enum(['BLUE','ELECTRONIC']),refresh:z.boolean().default(false)}).strict();
export const documentReuseSchema=z.array(z.object({documentId:idSchema,imeiValues:z.array(imeiValueSchema).min(1).max(2)}).strict()).max(4).default([]);
export interface ClientDocumentView {id:string;category:string;documentType:string;source:string;sourceOrdinal:number|null;status:string;createdAt:string;expiresAt:string;retentionDue:boolean;asset:{id:string;fileSize:number;width:number|null;height:number|null}}
