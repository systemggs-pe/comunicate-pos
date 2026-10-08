import { Prisma, type PrismaClient } from '@prisma/client';
import { newUserSchema, updateUserSchema, resetPasswordSchema, roleUpdateSchema, auditQuerySchema, type AuthUser } from '../../shared/auth.js';
import { idSchema, listQuerySchema } from '../../shared/validation.js';
import { hashPassword } from '../lib/password.js';
import { writeAudit, type AuditContext } from '../lib/audit.js';
import { userSelect, publicUser } from './auth.service.js';
import { DomainError } from '../lib/errors.js';
import type { Db } from '../repositories/pos.repository.js';
export function createUsersService(db: PrismaClient, actor: AuthUser, ctx: AuditContext) {
  const locked = <T>(fn: (tx: Db) => Promise<T>) => db.$transaction(async tx => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(403204)`; return fn(tx); }, { timeout: 20000 });
  async function get(tx: Db, id: string) { const user = await tx.user.findUnique({ where: { id }, select: userSelect }); if (!user) throw new DomainError(404, 'Usuario no encontrado.', 'USER_NOT_FOUND'); return user; }
  async function role(tx: Db, id: string) { const found = await tx.role.findUnique({ where: { id } }); if (!found) throw new DomainError(404, 'Rol no encontrado.', 'ROLE_NOT_FOUND'); return found; }
  // Único límite jerárquico administrativo: ADMIN no puede editar/crear SUPERADMIN.
  function protect(code?: string) { if (code === 'SUPERADMIN' && actor.role.code !== 'SUPERADMIN') throw new DomainError(403, 'La gestión del superadministrador está protegida.', 'FORBIDDEN'); }
  async function update(rawId: unknown, raw: unknown, forceStatus?: 'ACTIVE'|'DISABLED') {
    const id = idSchema.parse(rawId), fields = updateUserSchema.parse(forceStatus ? { status: forceStatus } : raw);
    return locked(async tx => {
      const current = await get(tx,id); protect(current.role?.code);
      const nextRole = fields.roleId ? await role(tx,fields.roleId) : current.role; protect(nextRole?.code);
      const nextStatus = fields.status ?? current.status;
      if (nextStatus === 'ACTIVE' && (!nextRole || !(await tx.user.findUniqueOrThrow({ where: { id }, select: { passwordHash: true } })).passwordHash)) throw new DomainError(409, 'Asigna rol y contraseña antes de habilitar.', 'INVALID_PASSWORD');
      if (current.status === 'ACTIVE' && current.role?.code === 'SUPERADMIN' && (nextStatus !== 'ACTIVE' || nextRole?.code !== 'SUPERADMIN')) {
        if (await tx.user.count({ where: { status: 'ACTIVE', role: { code: 'SUPERADMIN' }, id: { not: id } } }) === 0) throw new DomainError(409, 'No se puede dejar el sistema sin superadministrador activo.', 'LAST_SUPERADMIN');
      }
      const result = await tx.user.update({ where: { id }, data: fields, select: userSelect });
      if (fields.status === 'DISABLED' || (fields.roleId && fields.roleId !== current.role?.id) || (fields.email && fields.email !== current.email)) await tx.session.deleteMany({ where: { userId: id } });
      await writeAudit(tx,ctx,'USER_UPDATED','User',id,{ fields: Object.keys(fields) });
      if (fields.status && fields.status !== current.status) await writeAudit(tx,ctx,fields.status === 'ACTIVE' ? 'USER_ENABLED' : 'USER_DISABLED','User',id);
      if (fields.roleId && current.role?.id !== fields.roleId) await writeAudit(tx,ctx,'USER_ROLE_CHANGED','User',id,{ from: current.role?.code ?? null, to: nextRole?.code ?? null });
      return safe(result);
    });
  }
  // Usuarios históricos sin rol son visibles para que el administrador pueda rehabilitarlos.
  const safe = (row: Prisma.UserGetPayload<{ select: typeof userSelect }>) => row.role ? publicUser(row) : { ...row, permissions: [] };
  return {
    list: async (raw: unknown) => { const { q,offset,limit } = listQuerySchema.parse(raw); return (await db.user.findMany({ where: { OR: [{ name: { contains:q,mode:'insensitive' } }, { email: { contains:q,mode:'insensitive' } }, { code: { contains:q,mode:'insensitive' } }] }, select:userSelect, orderBy:[{createdAt:'desc'},{id:'asc'}], skip:offset,take:limit })).map(safe); },
    get: async (id: unknown) => safe(await get(db,idSchema.parse(id))),
    create: async (raw: unknown) => { const { password,...fields } = newUserSchema.parse(raw); const passwordHash = await hashPassword(password); return locked(async tx => { protect((await role(tx,fields.roleId)).code); const user = await tx.user.create({ data: { ...fields,passwordHash }, select:userSelect }); await writeAudit(tx,ctx,'USER_CREATED','User',user.id); return safe(user); }); },
    update,
    disable: (id: unknown) => update(id,{},'DISABLED'),
    enable: (id: unknown) => update(id,{},'ACTIVE'),
    reset: async (rawId: unknown,raw: unknown) => { const id = idSchema.parse(rawId), { password } = resetPasswordSchema.parse(raw); const passwordHash = await hashPassword(password); return locked(async tx => { protect((await get(tx,id)).role?.code); await tx.user.update({ where:{id},data:{passwordHash} }); await tx.session.deleteMany({where:{userId:id}}); await writeAudit(tx,ctx,'USER_PASSWORD_RESET','User',id); return { reset:true }; }); },
    roles: async () => (await db.role.findMany({ include:{permissions:{select:{permissionKey:true}}},orderBy:{code:'asc'} })).map(r => ({...r,permissions:r.permissions.map(p=>p.permissionKey)})),
    updateRole: async (rawId: unknown,raw: unknown) => { const id=idSchema.parse(rawId), input=roleUpdateSchema.parse(raw); return locked(async tx => { const current=await role(tx,id); if(current.code==='SUPERADMIN') throw new DomainError(409,'SUPERADMIN conserva todos los permisos.','ROLE_PROTECTED'); if(actor.role.code!=='SUPERADMIN') throw new DomainError(403,'Sólo el superadministrador puede editar permisos.','FORBIDDEN'); await tx.rolePermission.deleteMany({where:{roleId:id}}); await tx.rolePermission.createMany({data:input.permissions.map(permissionKey=>({roleId:id,permissionKey}))}); await tx.session.deleteMany({where:{user:{roleId:id}}}); await writeAudit(tx,ctx,'ROLE_PERMISSIONS_UPDATED','Role',id,{permissions:input.permissions}); return {updated:true}; }); },
    audit: async (raw: unknown) => { const {offset,limit,userId,action,from,to}=auditQuerySchema.parse(raw); return db.auditLog.findMany({where:{userId,action,createdAt:{...(from?{gte:new Date(`${from}T00:00:00-05:00`)}:{}),...(to?{lt:new Date(new Date(`${to}T00:00:00-05:00`).getTime()+86400000)}:{})}},include:{user:{select:{id:true,code:true,name:true,email:true}}},orderBy:[{createdAt:'desc'},{id:'asc'}],skip:offset,take:limit}); },
  };
}
