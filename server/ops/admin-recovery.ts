import type {PrismaClient} from '@prisma/client';
import {loginSchema,resetPasswordSchema} from '../../shared/auth.js';
import {writeAudit} from '../lib/audit.js';
import {DomainError} from '../lib/errors.js';
import {hashPassword} from '../lib/password.js';
import {hashToken} from '../services/auth.service.js';

export async function recoverSuperadmin(db:PrismaClient,rawEmail:unknown,rawPassword:unknown){
 const {email}=loginSchema.pick({email:true}).parse({email:rawEmail});
 const {password}=resetPasswordSchema.parse({password:rawPassword});
 const passwordHash=await hashPassword(password);
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(403204)`;
  const user=await tx.user.findUnique({where:{email},select:{id:true,status:true,role:{select:{code:true}}}});
  if(user?.status!=='ACTIVE'||user.role?.code!=='SUPERADMIN')throw new DomainError(404,'Se requiere un superadministrador activo existente.','SUPERADMIN_RECOVERY_TARGET');
  await tx.user.update({where:{id:user.id},data:{passwordHash}});
  const sessions=await tx.session.deleteMany({where:{userId:user.id}});
  await tx.authRateLimit.deleteMany({where:{key:hashToken(`email:${email}`)}});
  await writeAudit(tx,{},'USER_PASSWORD_RESET','User',user.id,{method:'HOST_RECOVERY',revokedSessions:sessions.count});
  return {revokedSessions:sessions.count};
 });
}
