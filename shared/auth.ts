import { z } from 'zod';
import { idSchema, listQuerySchema } from './validation.js';
export const permissionKeys = [
  'clients.read', 'clients.create', 'clients.update',
  'equipment.read', 'equipment.create', 'equipment.update',
  'registration.read', 'registration.create', 'registration.update',
  'sales.read', 'sales.create', 'sales.cancel',
  'users.read', 'users.create', 'users.update', 'users.disable',
  'roles.read', 'roles.update', 'audit.read', 'settings.read', 'settings.update',
] as const;
export type PermissionKey = typeof permissionKeys[number];
export const sellerPermissions = permissionKeys.filter(p => ['clients.read','clients.create','clients.update','equipment.read','equipment.create','registration.read','registration.create','registration.update','sales.read','sales.create'].includes(p));
export const adminPermissions = permissionKeys.filter(p => !['roles.update','settings.update'].includes(p));
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(10, 'Usa al menos 10 caracteres.').max(128, 'Usa como máximo 128 caracteres.');
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict();
export const userFieldsSchema = z.object({ name: z.string().trim().min(1).max(100), email: emailSchema, roleId: idSchema, status: z.enum(['ACTIVE','DISABLED']) });
export const newUserSchema = userFieldsSchema.extend({ password: passwordSchema }).strict();
export const updateUserSchema = userFieldsSchema.partial().strict().refine(v => Object.keys(v).length > 0, 'Indica los cambios.');
export const resetPasswordSchema = z.object({ password: passwordSchema }).strict();
export const roleUpdateSchema = z.object({ permissions: z.array(z.enum(permissionKeys)).max(permissionKeys.length).refine(v => new Set(v).size === v.length, 'Permisos repetidos.') }).strict();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(`${v}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === v; }, 'Fecha inválida.');
export const auditQuerySchema = listQuerySchema.omit({ ownerId: true }).extend({ userId: idSchema.optional(), action: z.string().trim().max(100).optional(), from: day.optional(), to: day.optional() }).refine(v => !v.from || !v.to || v.from <= v.to, 'Rango de fechas inválido.');
export interface AuthUser { id: string; code: string; name: string; email: string; status: 'ACTIVE' | 'DISABLED'; role: { id: string; code: string }; permissions: PermissionKey[]; lastLoginAt: string | null; createdAt: string }
export interface RoleView { id: string; code: string; permissions: PermissionKey[] }
