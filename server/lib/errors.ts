import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class DomainError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function publicError(error: unknown): { status: number; message: string } {
  if (error instanceof DomainError) return { status: error.status, message: error.message };
  if (error instanceof ZodError) return { status: 400, message: error.issues.map(i => i.message).join('; ') };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return { status: 409, message: 'DNI, IMEI, código o slot ya existe.' };
    if (error.code === 'P2003') return { status: 409, message: 'La relación indicada no es válida.' };
    if (error.code === 'P2025') return { status: 404, message: 'Registro no encontrado.' };
    if (error.code === 'P2034') return { status: 409, message: 'Conflicto concurrente. Reintente la operación.' };
    if (error.code === 'P2004' || error.code === 'P2010') return { status: 409, message: 'La operación incumple una restricción de integridad.' };
  }
  const status = typeof error === 'object' && error && 'status' in error ? error.status : null;
  if (status === 400 || status === 413) return { status, message: status === 413 ? 'Solicitud demasiado grande.' : 'JSON inválido.' };
  return { status: 500, message: 'No se pudo completar la operación.' };
}
