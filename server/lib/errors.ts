import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class DomainError extends Error {
  constructor(public status: number, message: string, public code = 'OPERATION_FAILED') { super(message); }
}
export function publicError(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof DomainError) return { status: error.status, code: error.code, message: error.message };
  if (error instanceof ZodError) return { status: 400, code: 'VALIDATION_ERROR', message: error.issues.map(i => i.message).join('; ') };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = String(error.meta?.target ?? '');
      if (target.includes('email')) return { status: 409, code: 'USER_EMAIL_EXISTS', message: 'Ya existe un usuario con ese correo.' };
      if (target.includes('dni')) return { status: 409, code: 'CLIENT_DNI_EXISTS', message: 'Ya existe un cliente registrado con este DNI.' };
      if (target.includes('slot')) return { status: 409, code: 'IMEI_SLOT_OCCUPIED', message: 'El slot de IMEI ya está ocupado.' };
      if (target.includes('value')) return { status: 409, code: 'IMEI_ALREADY_EXISTS', message: 'El IMEI ya está asociado a un equipo.' };
      return { status: 409, code: 'UNIQUE_CONFLICT', message: 'El registro ya existe.' };
    }
    if (error.code === 'P2003') return { status: 409, code: 'RELATION_CONFLICT', message: 'La relación indicada no es válida.' };
    if (error.code === 'P2025') return { status: 404, code: 'NOT_FOUND', message: 'Registro no encontrado.' };
    if (error.code === 'P2034') return { status: 409, code: 'CONCURRENT_CONFLICT', message: 'Conflicto concurrente. Vuelva a buscar antes de reintentar.' };
    if (error.code === 'P2004' || error.code === 'P2010') return { status: 409, code: 'INTEGRITY_CONFLICT', message: 'La operación incumple una restricción de integridad.' };
  }
  const status = typeof error === 'object' && error && 'status' in error ? error.status : null;
  if (status === 400 || status === 413) return { status, code: 'VALIDATION_ERROR', message: status === 413 ? 'Solicitud demasiado grande.' : 'JSON inválido.' };
  return { status: 500, code: 'INTERNAL_ERROR', message: 'No se pudo completar la operación. Inténtelo nuevamente.' };
}
