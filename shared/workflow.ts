import { z } from 'zod';
import {documentReuseSchema,identitySide} from './client-documents.js';
import {registrationReceiptChoice} from './registration-receipt.js';
import {evidenceLinksSchema} from './evidence.js';
import { normalizeText,normalizeEmail } from './normalization.js';
import { clientSchema,equipmentEditSchema,idSchema,imeiListSchema,imeiValueSchema,listQuerySchema,moneySchema } from './validation.js';
export const operators=['BITEL','CLARO','MOVISTAR','ENTEL'] as const;
export const requestStatuses=['BLOCKED','PENDING','REGISTERED'] as const;
export const phoneSchema=z.string().trim().regex(/^9\d{8}$/,'CELULAR: NUEVE DÍGITOS, EMPEZANDO POR 9.');
export const occurredAtSchema=z.iso.datetime({offset:true});
const nonempty=(max:number)=>z.string().transform(normalizeText).pipe(z.string().min(1,'ESTE CAMPO ES OBLIGATORIO.').max(max));
export const requestFieldsSchema=z.object({operator:z.enum(operators).default('BITEL'),phone:phoneSchema,referencePhone:z.preprocess(v=>v===''?null:v,phoneSchema.nullable().optional()),address:nonempty(300),province:z.string().max(100).transform(normalizeText).nullable().optional(),department:nonempty(100),email:z.string().transform(normalizeEmail).pipe(z.email().max(254)),price:moneySchema,hasBox:z.boolean(),occurredAt:occurredAtSchema}).strict();
export const operationalRegistrationSchema=z.object({idempotencyKey:idSchema,requireIdentityPhotos:z.boolean().optional(),requireReceipt:z.boolean().optional(),documentEvidence:documentReuseSchema,evidence:evidenceLinksSchema.optional(),identityChanges:z.array(z.object({category:identitySide,documentId:idSchema.optional(),expectedIds:z.array(idSchema).max(100)}).strict()).max(2).optional(),receipt:registrationReceiptChoice.optional(),client:clientSchema,imeis:imeiListSchema,equipment:equipmentEditSchema.optional(),origin:z.enum(['STORE','EXTERNAL']).optional(),clientNameCorrection:z.object({clientId:idSchema,expectedName:z.string().max(201),fullName:nonempty(201)}).strict().optional(),expectedEquipmentId:idSchema.optional(),confirmAddImei:z.boolean().default(false),requests:z.array(requestFieldsSchema.extend({value:imeiValueSchema,mode:z.enum(['REGISTRATION','BLOCKED']).default('REGISTRATION')}).strict()).min(1).max(2)}).strict().superRefine((value,ctx)=>{
 if(new Set(value.identityChanges?.map(row=>row.category)).size!==(value.identityChanges?.length??0)||new Set(value.identityChanges?.flatMap(row=>row.documentId?[row.documentId]:[])).size!==(value.identityChanges?.filter(row=>row.documentId).length??0))ctx.addIssue({code:'custom',path:['identityChanges'],message:'Elige una foto diferente para cada lado del DNI.'});
 if(new Set(value.documentEvidence.map(row=>row.documentId)).size!==value.documentEvidence.length||value.documentEvidence.some(row=>new Set(row.imeiValues).size!==row.imeiValues.length||row.imeiValues.some(imei=>!value.requests.some(request=>request.value===imei))))ctx.addIssue({code:'custom',path:['documentEvidence'],message:'SELECCIONA DOCUMENTOS ÚNICOS Y SOLO LOS IMEIS DE ESTAS SOLICITUDES.'});
 if(value.receipt&&value.evidence?.some(row=>row.category==='PURCHASE_RECEIPT'))ctx.addIssue({code:'custom',path:['receipt'],message:'Elige una sola boleta para el expediente.'});
 if(value.requireReceipt&&!value.receipt&&!value.evidence?.some(row=>row.category==='PURCHASE_RECEIPT'&&value.requests.every(request=>row.imeiValues.includes(request.value))))ctx.addIssue({code:'custom',path:['receipt'],message:'Adjunta una boleta de venta para todos los IMEIs de este trámite.'});
 if(value.evidence?.some(row=>row.imeiValues.some(imei=>!value.requests.some(request=>request.value===imei))))ctx.addIssue({code:'custom',path:['evidence'],message:'LA EVIDENCIA DEBE CORRESPONDER A LOS IMEIS SELECCIONADOS.'});
 if(new Set(value.requests.map(r=>r.value)).size!==value.requests.length||value.requests.some(r=>!value.imeis.some(i=>i.value===r.value)))ctx.addIssue({code:'custom',path:['requests'],message:'SELECCIONA SOLO IMEIS DISTINTOS DEL EQUIPO.'});
 if(new Set(value.requests.map(r=>r.phone)).size!==value.requests.length)ctx.addIssue({code:'custom',path:['requests',1,'phone'],message:'LOS CELULARES DE AMBOS IMEIS DEBEN SER DISTINTOS.'});
 if(!value.expectedEquipmentId&&!value.equipment?.commercialName)ctx.addIssue({code:'custom',path:['equipment','commercialName'],message:'COMPLETA EL NOMBRE COMERCIAL.'});
});
export const requestEditSchema=requestFieldsSchema.omit({operator:true}).partial().extend({operator:z.enum(operators).optional(),declarationAssetId:idSchema.optional()}).strict().refine(v=>Object.keys(v).length>0,'INDICA UNA CORRECCIÓN.');
export const requestTransitionSchema=z.object({confirm:z.literal(true),action:z.enum(['MARK_REGISTERED','UNBLOCK']),reason:nonempty(500)}).strict();
export const requestQuerySchema=listQuerySchema.omit({ownerId:true}).extend({status:z.enum(requestStatuses).optional(),equipmentId:idSchema.optional(),clientId:idSchema.optional(),missingMovistarDeclaration:z.literal('true').optional()});
export const requestBulkSchema=z.object({confirm:z.literal(true),ids:z.array(idSchema).min(1).max(100).refine(ids=>new Set(ids).size===ids.length),reason:nonempty(500)}).strict();
export const deletionSchema=z.object({confirm:z.literal('ELIMINAR'),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),reason:nonempty(500),removeOrphanEquipment:z.boolean().default(false)}).strict();
// requireIdentityPhotos is accepted for older clients. Photos are optional.
export type OperationalRegistrationInput=z.infer<typeof operationalRegistrationSchema>;
