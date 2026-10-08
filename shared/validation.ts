import { z } from 'zod';

const digits = (length: number, label: string) => z.string().transform(v => v.replace(/\s/g, '')).pipe(z.string().regex(new RegExp(`^[0-9]{${length}}$`), `${label}: ${length} dígitos exactos`));
export const dniSchema = digits(8, 'DNI');
export const imeiValueSchema = digits(15, 'IMEI');
export const idSchema = z.uuid();
const text = z.string().trim().min(1).max(100);
export const clientSchema = z.object({ dni: dniSchema, firstName: text, lastName: text, phone: z.string().trim().max(30).optional(), email: z.email().max(254).optional() }).strict();
export const imeiSchema = z.object({ slot: z.number().int().min(1).max(2), value: imeiValueSchema, type: z.enum(['PHYSICAL', 'ESIM']).default('PHYSICAL') }).strict();
export const equipmentSchema = z.object({ ownerId: idSchema.optional(), origin: z.enum(['STORE', 'EXTERNAL']), brand: text, model: text, serialNumber: text.optional(), imeis: z.array(imeiSchema).min(1).max(2) }).strict().superRefine((v, ctx) => {
  if (v.origin === 'EXTERNAL' && !v.ownerId) ctx.addIssue({ code: 'custom', message: 'Equipo externo requiere propietario', path: ['ownerId'] });
  if (new Set(v.imeis.map(i => i.value)).size !== v.imeis.length) ctx.addIssue({ code: 'custom', message: 'Los IMEIs deben ser diferentes', path: ['imeis'] });
  if (new Set(v.imeis.map(i => i.slot)).size !== v.imeis.length) ctx.addIssue({ code: 'custom', message: 'Los slots deben ser diferentes', path: ['imeis'] });
});
export const externalEquipmentSchema = z.object({ client: clientSchema, brand: text, model: text, serialNumber: text.optional(), imeis: z.array(imeiSchema).min(1).max(2) }).strict().superRefine((v, ctx) => {
  if (new Set(v.imeis.map(i => i.value)).size !== v.imeis.length || new Set(v.imeis.map(i => i.slot)).size !== v.imeis.length) ctx.addIssue({ code: 'custom', message: 'IMEIs y slots deben ser diferentes', path: ['imeis'] });
});
export const registrationSchema = z.object({ status: z.enum(['NOT_REGISTERED', 'PENDING', 'PROCESSING', 'REGISTERED', 'REJECTED', 'CANCELLED']), method: text.optional(), userId: idSchema.optional() }).strict();
// Montos como cadenas decimales: nunca calcular dinero con float de JavaScript.
export const moneySchema = z.string().regex(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/);
export const saleSchema = z.object({ buyerId: idSchema, status: z.enum(['PENDING', 'COMPLETED']).default('PENDING'), paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']), createdById: idSchema.optional(), items: z.array(z.object({ equipmentId: idSchema, unitPrice: moneySchema }).strict()).min(1).max(100) }).strict().superRefine((v, ctx) => {
  if (new Set(v.items.map(i => i.equipmentId)).size !== v.items.length) ctx.addIssue({ code: 'custom', message: 'Equipo repetido en venta', path: ['items'] });
});
