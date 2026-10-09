import { z } from 'zod';
import { clientSchema, equipmentEditSchema, idSchema, imeiListSchema, imeiValueSchema, listQuerySchema, moneySchema } from './validation.js';
export const operators = ['CLARO','MOVISTAR','ENTEL','BITEL'] as const;
export const requestStatuses = ['PENDING','COMPLETED','CANCELLED'] as const;
export const phoneSchema = z.string().trim().regex(/^9\d{8}$/, 'Celular: nueve dígitos, empezando por 9.');
export const occurredAtSchema = z.iso.datetime({ offset: true });
const nonempty = (max: number) => z.string().trim().min(1, 'Este campo es obligatorio.').max(max);
export const requestFieldsSchema = z.object({
  operator: z.enum(operators), phone: phoneSchema, referencePhone: phoneSchema.nullable().optional(),
  address: nonempty(300), department: nonempty(100), email: z.email().max(254),
  price: moneySchema, blockStatus: z.enum(['BLOCKED','NOT_BLOCKED']), hasBox: z.boolean(),
  conditions: z.string().trim().max(1000), occurredAt: occurredAtSchema,
}).strict();
export const operationalRegistrationSchema = z.object({
  idempotencyKey: idSchema, client: clientSchema, imeis: imeiListSchema,
  equipment: equipmentEditSchema.optional(), expectedEquipmentId: idSchema.optional(),
  confirmAddImei: z.boolean().default(false),
  requests: z.array(requestFieldsSchema.extend({ value: imeiValueSchema, status: z.enum(['PENDING','COMPLETED']).default('PENDING') }).strict()).min(1).max(2),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.requests.map(r => r.value)).size !== value.requests.length || value.requests.some(r => !value.imeis.some(i => i.value === r.value))) ctx.addIssue({ code:'custom', path:['requests'], message:'Seleccione únicamente IMEIs distintos del equipo.' });
  if (new Set(value.requests.map(r => r.phone)).size !== value.requests.length) ctx.addIssue({ code:'custom', path:['requests',1,'phone'], message:'Los celulares de ambos IMEIs deben ser distintos.' });
  if (!value.expectedEquipmentId && !value.equipment?.commercialName) ctx.addIssue({ code:'custom', path:['equipment','commercialName'], message:'Complete el nombre comercial.' });
});
export const requestEditSchema = requestFieldsSchema.partial().strict().refine(value => Object.keys(value).length > 0, 'Indique una corrección.');
export const requestTransitionSchema = z.object({ confirm:z.literal(true), status:z.enum(['COMPLETED','CANCELLED']), reason:nonempty(500) }).strict();
export const requestQuerySchema = listQuerySchema.omit({ownerId:true}).extend({ status:z.enum(requestStatuses).optional(), blockStatus:z.enum(['BLOCKED','NOT_BLOCKED']).optional(), equipmentId:idSchema.optional(), clientId:idSchema.optional() });
export const requestBulkSchema = z.object({ confirm:z.literal(true), ids:z.array(idSchema).min(1).max(100).refine(ids => new Set(ids).size === ids.length), reason:nonempty(500) }).strict();
export type OperationalRegistrationInput = z.infer<typeof operationalRegistrationSchema>;
