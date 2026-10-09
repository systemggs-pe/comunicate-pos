import { z } from 'zod';

const digits = (length: number, label: string) => z.string().transform(v => v.replace(/\s/g, '')).pipe(z.string().regex(new RegExp(`^[0-9]{${length}}$`), `${label}: ${length} dígitos exactos`));
export const dniSchema = digits(8, 'DNI');
export const imeiValueSchema = digits(15, 'IMEI');
export const idSchema = z.uuid();
const text = z.string().trim().transform(v => v.replace(/\s+/g, ' ')).pipe(z.string().min(1, 'Este campo es obligatorio.').max(100, 'Máximo 100 caracteres.'));
export const clientSchema = z.object({ dni: dniSchema, firstName: text, lastName: text, phone: z.string().trim().max(30).optional(), email: z.email().max(254).optional() }).strict();
export const imeiSchema = z.object({ slot: z.number().int().min(1).max(2), value: imeiValueSchema, type: z.enum(['PHYSICAL', 'ESIM']).default('PHYSICAL') }).strict();
// Un segundo campo vacío no crea un IMEI. Un valor no vacío inválido se rechaza.
export const imeiListSchema = z.preprocess(value => Array.isArray(value) && value.length <= 2
  ? value.filter(imei => !(imei?.slot === 2 && typeof imei.value === 'string' && !imei.value.trim()))
  : value, z.array(imeiSchema).min(1).max(2).superRefine((imeis, ctx) => {
  if (new Set(imeis.map(i => i.value)).size !== imeis.length) ctx.addIssue({ code: 'custom', message: 'Los IMEIs deben ser diferentes.' });
  if (new Set(imeis.map(i => i.slot)).size !== imeis.length) ctx.addIssue({ code: 'custom', message: 'Los slots deben ser diferentes.' });
}));
export const equipmentSchema = z.object({ ownerId: idSchema.optional(), origin: z.enum(['STORE', 'EXTERNAL']), brand: text, model: text, serialNumber: text.optional(), commercialName: z.preprocess(value => value === '' ? null : value, text.nullable().optional()), color: z.preprocess(value => value === '' ? null : value, text.nullable().optional()), ram: z.preprocess(value => value === '' ? null : value, text.nullable().optional()), storage: z.preprocess(value => value === '' ? null : value, text.nullable().optional()), imeis: imeiListSchema }).strict().superRefine((v, ctx) => {
  if (v.origin === 'EXTERNAL' && !v.ownerId) ctx.addIssue({ code: 'custom', message: 'Equipo externo requiere propietario', path: ['ownerId'] });
});
export const externalEquipmentSchema = z.object({ client: clientSchema, brand: text, model: text, serialNumber: text.optional(), commercialName: z.preprocess(value => value === '' ? null : value, text.nullable().optional()), color: z.preprocess(value => value === '' ? null : value, text.nullable().optional()), ram: z.preprocess(value => value === '' ? null : value, text.nullable().optional()), storage: z.preprocess(value => value === '' ? null : value, text.nullable().optional()), imeis: imeiListSchema }).strict();
export const registrationSchema = z.object({ status: z.enum(['NOT_REGISTERED', 'PENDING', 'PROCESSING', 'REGISTERED', 'REJECTED', 'CANCELLED']), method: text.nullable().optional(), userId: idSchema.optional(), ownerId: idSchema.optional() }).strict();
export const clientEditSchema = z.object({ firstName: text, lastName: text, phone: z.string().trim().max(30).nullable().optional(), email: z.string().trim().pipe(z.email().max(254)).nullable().optional() }).strict();
export const equipmentEditSchema = z.object({ brand: text, model: text, serialNumber: text.nullable().optional(), commercialName: z.preprocess(value => value === '' ? null : value, text.nullable().optional()), color: z.preprocess(value => value === '' ? null : value, text.nullable().optional()), ram: z.preprocess(value => value === '' ? null : value, text.nullable().optional()), storage: z.preprocess(value => value === '' ? null : value, text.nullable().optional()) }).strict();
export const listQuerySchema = z.object({ q: z.string().trim().max(100).default(''), ownerId: idSchema.optional(), offset: z.coerce.number().int().min(0).max(1000000).default(0), limit: z.coerce.number().int().min(1).max(100).default(20) }).strict();
const imeisInput = imeiListSchema;
export const resolveRegistrationSchema = z.object({ dni: dniSchema, imeis: imeisInput }).strict();
export const registrationFlowSchema = z.object({
  client: clientSchema,
  imeis: imeisInput,
  selectedImeis: z.array(imeiValueSchema).min(1, 'Seleccione al menos un IMEI.').max(2),
  registration: registrationSchema,
  equipment: equipmentEditSchema.optional(),
  expectedEquipmentId: idSchema.optional(),
  confirmAddImei: z.boolean().default(false),
}).strict().superRefine((input, ctx) => {
  if (new Set(input.selectedImeis).size !== input.selectedImeis.length || input.selectedImeis.some(value => !input.imeis.some(i => i.value === value))) ctx.addIssue({ code: 'custom', message: 'Seleccione únicamente IMEIs incluidos en el equipo.', path: ['selectedImeis'] });
});
// Montos como cadenas decimales: nunca calcular dinero con float de JavaScript.
export const moneySchema = z.string().regex(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/);
export const saleSchema = z.object({ buyerId: idSchema, status: z.enum(['PENDING', 'COMPLETED']).default('PENDING'), paymentMethod: z.enum(['CASH', 'YAPE', 'PLIN', 'CARD', 'TRANSFER', 'OTHER']), discount: moneySchema.default('0'), notes: z.string().trim().max(1000).optional(), createdById: idSchema.optional(), items: z.array(z.object({ equipmentId: idSchema, unitPrice: moneySchema }).strict()).min(1).max(100) }).strict().superRefine((v, ctx) => {
  if (new Set(v.items.map(i => i.equipmentId)).size !== v.items.length) ctx.addIssue({ code: 'custom', message: 'Equipo repetido en venta', path: ['items'] });
});
