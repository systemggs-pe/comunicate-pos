import { z } from 'zod';
import { clientSchema, equipmentEditSchema, idSchema, imeiSchema, listQuerySchema, moneySchema, saleSchema } from './validation.js';
import { occurredAtSchema } from './workflow.js';
export const accessorySchema = z.object({ name:z.string().trim().min(1).max(100), quantity:z.number().int().min(1).max(10000), unitPrice:moneySchema }).strict();
export const paymentMethods = ['CASH', 'YAPE', 'PLIN', 'CARD', 'TRANSFER', 'OTHER'] as const;
export const clientReferenceSchema = z.union([z.object({ id: idSchema }).strict(), z.object({ client: clientSchema }).strict()]);
export const saleEquipmentInputSchema = equipmentEditSchema.extend({ imeis: z.array(imeiSchema).min(1).max(2) });
export const saleFlowSchema = z.object({
  buyer: clientReferenceSchema,
  items: z.array(z.object({ equipment: saleEquipmentInputSchema.optional(), equipmentId: idSchema.optional(), owner: clientReferenceSchema.optional(), unitPrice: moneySchema, confirmResale:z.boolean().optional() }).strict().refine(v => !!v.equipment !== !!v.equipmentId, 'Seleccione un equipo existente o complete uno nuevo.')).min(1, 'Agregue al menos un equipo.').max(20),
  paymentMethod: z.enum(paymentMethods), discount: moneySchema.default('0'), notes: z.string().trim().max(1000).optional(),
  status: z.enum(['PENDING', 'COMPLETED']).default('COMPLETED'), createdById: idSchema.optional(),
  accessories:z.array(accessorySchema).max(100).default([]), occurredAt:occurredAtSchema.optional(), idempotencyKey:idSchema.optional(),
}).strict().superRefine((value,ctx)=>{if(value.idempotencyKey){if(!value.occurredAt)ctx.addIssue({code:'custom',path:['occurredAt'],message:'Indica la fecha operativa.'});value.items.forEach((item,index)=>{if(item.equipment&&!item.equipment.commercialName)ctx.addIssue({code:'custom',path:['items',index,'equipment','commercialName'],message:'Complete el nombre comercial.'});});}});
export const saleRequestSchema = z.union([saleFlowSchema, saleSchema]);
export const cancelSaleSchema = z.object({ confirm: z.literal(true, { error: 'Confirme la cancelación.' }), reason: z.string().trim().min(1, 'Indique el motivo.').max(500) }).strict();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(`${v}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; }, 'Fecha inválida.');
export const salesQuerySchema = listQuerySchema.omit({ ownerId: true }).extend({ status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED']).optional(), from: date.optional(), to: date.optional() }).refine(v => !v.from || !v.to || v.from <= v.to, 'Revise el rango de fechas.');
// BigInt en céntimos para el resumen React; el servidor recalcula con Prisma.Decimal.
export function cents(value: string): bigint { const parsed = moneySchema.parse(value); const [whole, fraction = ''] = parsed.split('.'); return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')); }
export function decimalMoney(value: bigint): string { const sign = value < 0n ? '-' : ''; const abs = value < 0n ? -value : value; return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`; }
