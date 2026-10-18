import {normalizeText,normalizeEmail} from './normalization.js';
import { z } from 'zod';
import { clientSchema, equipmentEditSchema, idSchema, imeiListSchema, imeiValueSchema, listQuerySchema, moneySchema } from './validation.js';
import { occurredAtSchema } from './workflow.js';
export const accessorySchema = z.object({ name:z.string().transform(normalizeText).pipe(z.string().min(1).max(100)), quantity:z.number().int().min(1).max(10000), unitPrice:moneySchema }).strict();
export const paymentMethods = ['CASH', 'YAPE', 'PLIN', 'CARD', 'TRANSFER', 'OTHER'] as const;
export const clientReferenceSchema = z.union([z.object({ id: idSchema }).strict(), z.object({ client: clientSchema }).strict()]);
export const saleEquipmentInputSchema = equipmentEditSchema.extend({ imeis: imeiListSchema, origin:z.enum(['STORE','EXTERNAL']).optional() });
export const saleFlowSchema = z.object({
  buyer: clientReferenceSchema,
  buyerPhone:z.string().trim().max(30).optional(), buyerEmail:z.union([z.literal(''),z.string().transform(normalizeEmail).pipe(z.email().max(254))]).optional(),
  items: z.array(z.object({ equipment: saleEquipmentInputSchema, owner: clientReferenceSchema.optional(), unitPrice: moneySchema,  }).strict()).min(1, 'Agregue al menos un equipo.').max(20),
  paymentMethod: z.enum(paymentMethods), discount: moneySchema.default('0'), notes: z.string().max(1000).transform(normalizeText).optional(),

  accessories:z.array(accessorySchema).max(100).default([]), occurredAt:occurredAtSchema.optional(), idempotencyKey:idSchema.optional(),
}).strict().superRefine((value,ctx)=>{if(value.idempotencyKey){if(!value.occurredAt)ctx.addIssue({code:'custom',path:['occurredAt'],message:'Indica la fecha operativa.'});value.items.forEach((item,index)=>{if(item.equipment&&!item.equipment.commercialName)ctx.addIssue({code:'custom',path:['items',index,'equipment','commercialName'],message:'Complete el nombre comercial.'});});}});
export const saleRequestSchema = z.union([saleFlowSchema]);
export const saleEditSchema=z.object({
 expectedUpdatedAt:z.iso.datetime({offset:true}).optional(),
 buyer:clientReferenceSchema.optional(),buyerPhone:z.string().trim().max(30).nullable().optional(),
 buyerEmail:z.union([z.literal(''),z.string().transform(normalizeEmail).pipe(z.email().max(254))]).nullable().optional(),
 occurredAt:occurredAtSchema.optional(),paymentMethod:z.enum(paymentMethods).optional(),discount:moneySchema.optional(),
 notes:z.string().max(1000).transform(normalizeText).optional(),accessories:z.array(accessorySchema).max(100).optional(),
 items:z.array(z.object({id:idSchema,unitPrice:moneySchema,equipment:equipmentEditSchema.optional(),origin:z.enum(['STORE','EXTERNAL']).optional(),imeis:z.array(z.object({id:idSchema.optional(),expectedValue:z.string().min(1).max(100).optional(),slot:z.number().int().min(1).max(2),value:imeiValueSchema,type:z.enum(['PHYSICAL','ESIM'])}).strict()).min(1).max(2).optional(),expectedEquipmentUpdatedAt:z.iso.datetime({offset:true}).optional()}).strict()).max(20).optional(),
}).strict().superRefine((value,ctx)=>{
 if(!Object.keys(value).some(key=>key!=='expectedUpdatedAt'))ctx.addIssue({code:'custom',message:'Indica los datos que deseas corregir.'});
 if(value.items&&new Set(value.items.map(item=>item.id)).size!==value.items.length)ctx.addIssue({code:'custom',path:['items'],message:'No repitas equipos en la venta.'});
 if(Object.keys(value).some(key=>!['notes','expectedUpdatedAt'].includes(key))&&!value.expectedUpdatedAt)ctx.addIssue({code:'custom',path:['expectedUpdatedAt'],message:'Actualiza la venta antes de editarla.'});
 if(value.items)value.items.forEach((item,index)=>{if((item.equipment||item.origin||item.imeis)&&!item.expectedEquipmentUpdatedAt)ctx.addIssue({code:'custom',path:['items',index,'expectedEquipmentUpdatedAt'],message:'Actualiza el equipo antes de editarlo.'});if(item.imeis&&(new Set(item.imeis.map(imei=>imei.slot)).size!==item.imeis.length||new Set(item.imeis.map(imei=>imei.value)).size!==item.imeis.length))ctx.addIssue({code:'custom',path:['items',index,'imeis'],message:'Los IMEI y sus posiciones deben ser diferentes.'});});
});
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(`${v}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; }, 'Fecha inválida.');
export const salesQuerySchema = listQuerySchema.omit({ ownerId: true }).extend({ from: date.optional(), to: date.optional() }).refine(v => !v.from || !v.to || v.from <= v.to, 'Revise el rango de fechas.');
// BigInt en céntimos para el resumen React; el servidor recalcula con Prisma.Decimal.
export function cents(value: string): bigint { const parsed = moneySchema.parse(value); const [whole, fraction = ''] = parsed.split('.'); return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')); }
export function decimalMoney(value: bigint): string { const sign = value < 0n ? '-' : ''; const abs = value < 0n ? -value : value; return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`; }
