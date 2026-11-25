import { createHash, randomBytes } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { loginSchema, permissionKeys, type AuthUser } from '../../shared/auth.js';
import { DomainError } from '../lib/errors.js';
import { hashPassword, verifyPassword, dummyPasswordHash } from '../lib/password.js';
import { writeAudit, type AuditContext } from '../lib/audit.js';
export const sessionHours = 12;
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const userSelect = { identityDocument:true, id: true, code: true, name: true, email: true, status: true, lastLoginAt: true, createdAt: true, role: { select: { id: true, code: true, permissions: { select: { permissionKey: true } } } } } satisfies Prisma.UserSelect;
type SafeRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;
export function publicUser(row: SafeRow) {
  const role = row.role;
  if (!role) throw new DomainError(401, 'Sesión no válida.', 'SESSION_INVALID');
  return { ...row, role: { id: role.id, code: role.code }, permissions: role.code === 'SUPERADMIN' ? [...permissionKeys] : role.permissions.map(p => p.permissionKey) };
}
export function createAuthService(db: PrismaClient) {
  async function throttle(email: string, ip: string) {
    // Contadores PostgreSQL atómicos compartidos por todas las instancias serverless.
    for (const [key, maximum] of [[hashToken(`ip:${ip}`), 30], [hashToken(`email:${email}`), 10]] as const) {
      const rows = await db.$queryRaw<{ attempts: number }[]>`INSERT INTO "AuthRateLimit" (key,attempts,"expiresAt") VALUES (${key},1,now()+interval '15 minutes') ON CONFLICT (key) DO UPDATE SET attempts = CASE WHEN "AuthRateLimit"."expiresAt" <= now() THEN 1 ELSE "AuthRateLimit".attempts+1 END, "expiresAt" = CASE WHEN "AuthRateLimit"."expiresAt" <= now() THEN now()+interval '15 minutes' ELSE "AuthRateLimit"."expiresAt" END RETURNING attempts`;
      if (rows[0].attempts > maximum) throw new DomainError(429, 'Demasiados intentos. Vuelve a intentar en 15 minutos.', 'LOGIN_RATE_LIMITED');
    }
  }
  return {
    login: async (raw: unknown, ctx: AuditContext) => {
      const input = loginSchema.parse(raw);
      try { await throttle(input.email, ctx.ip ?? 'unknown'); } catch (error) { await writeAudit(db, ctx, 'LOGIN_FAILED', 'Auth', undefined, { reason: 'RATE_LIMIT' }); throw error; }
      const record = await db.user.findUnique({ where: { email: input.email }, select: { ...userSelect, passwordHash: true } });
      const valid = await verifyPassword(record?.passwordHash ?? await dummyPasswordHash(), input.password);
      if (!record || !valid || record.status !== 'ACTIVE' || !record.role) {
        await writeAudit(db, ctx, 'LOGIN_FAILED', 'Auth', undefined, { reason: 'INVALID_CREDENTIALS' });
        throw new DomainError(401, 'Correo o contraseña incorrectos.', 'INVALID_CREDENTIALS');
      }
      const token = randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + sessionHours*3600000);
      const user = await db.$transaction(async tx => {
        // Serializar con cambios administrativos para no emitir sesión tras desactivar/resetear.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(403204)`;
        const current = await tx.user.findUniqueOrThrow({ where: { id: record.id }, select: { ...userSelect, passwordHash: true } });
        if (current.status !== 'ACTIVE' || current.passwordHash !== record.passwordHash) throw new DomainError(401, 'Correo o contraseña incorrectos.', 'INVALID_CREDENTIALS');
        await tx.session.create({ data: { userId: record.id, tokenHash: hashToken(token), expiresAt, ip: ctx.ip, userAgent: ctx.userAgent } });
        const updated = await tx.user.update({ where: { id: record.id }, data: { lastLoginAt: new Date() }, select: userSelect });
        await writeAudit(tx, { ...ctx, userId: record.id }, 'LOGIN', 'User', record.id);
        return publicUser(updated);
      });
      return { token, expiresAt, user };
    },
    authenticate: async (token?: string) => {
      if (!token) throw new DomainError(401, 'Inicia sesión para continuar.', 'AUTH_REQUIRED');
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new DomainError(401, 'Sesión no válida.', 'SESSION_INVALID');
      const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { select: userSelect } } });
      if (!session) throw new DomainError(401, 'Sesión no válida.', 'SESSION_INVALID');
      if (session.expiresAt.getTime() <= Date.now()) throw new DomainError(401, 'La sesión expiró. Inicia sesión nuevamente.', 'SESSION_EXPIRED');
      if (session.user.status !== 'ACTIVE') throw new DomainError(401, 'Usuario desactivado.', 'USER_DISABLED');
      if (!session.lastUsedAt || Date.now()-session.lastUsedAt.getTime()>300000) await db.session.updateMany({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
      return { user: publicUser(session.user) as unknown as AuthUser, sessionId: session.id };
    },
    logout: (sessionId: string, ctx: AuditContext) => db.$transaction(async tx => { await tx.session.deleteMany({ where: { id: sessionId } }); await writeAudit(tx, ctx, 'LOGOUT', 'User', ctx.userId); }),
    cleanup: () => db.$transaction([db.session.deleteMany({ where: { expiresAt: { lte: new Date() } } }), db.authRateLimit.deleteMany({ where: { expiresAt: { lte: new Date() } } })]),
    bootstrap: async (raw: { name: string; email: string; password: string }) => {
      const { userFieldsSchema, passwordSchema } = await import('../../shared/auth.js');
      const role = await db.role.findUniqueOrThrow({ where: { code: 'SUPERADMIN' } });
      const fields = userFieldsSchema.parse({ ...raw, roleId: role.id, status: 'ACTIVE' }); const passwordHash = await hashPassword(passwordSchema.parse(raw.password));
      return db.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(403204)`;
        if (await tx.user.count({ where: { role: { code: 'SUPERADMIN' }, status: 'ACTIVE' } })) return { created: false };
        if (await tx.user.findUnique({ where: { email: fields.email } })) throw new DomainError(409, 'Ese correo ya existe; el bootstrap no sobrescribe cuentas.', 'USER_EMAIL_EXISTS');
        const user = await tx.user.create({ data: { ...fields, passwordHash }, select: userSelect });
        await writeAudit(tx, { userId: user.id }, 'USER_CREATED', 'User', user.id, { bootstrap: true });
        return { created: true };
      });
    },
  };
}
