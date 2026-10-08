import type { Prisma } from '@prisma/client';
import type { Db } from '../repositories/pos.repository.js';
export interface AuditContext { userId?: string; ip?: string; userAgent?: string }
export function writeAudit(db: Db, ctx: AuditContext, action: string, entityType?: string, entityId?: string, metadata?: Prisma.InputJsonValue) {
  return db.auditLog.create({ data: { ...ctx, action, entityType: entityType ?? 'Auth', entityId, metadata } });
}
