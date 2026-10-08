import type { Prisma } from '@prisma/client';
import { DomainError } from '../lib/errors.js';
export type Db = Prisma.TransactionClient;
export const equipmentInclude = { owner: true, imeis: { orderBy: { slot: 'asc' as const } } } satisfies Prisma.EquipmentInclude;
export const repository = {
  findClientByDni: (db: Db, dni: string) => db.client.findUnique({ where: { dni } }),
  getClientById: async (db: Db, id: string) => {
    const client = await db.client.findUnique({ where: { id }, include: { equipment: { include: equipmentInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] } } });
    if (!client) throw new DomainError(404, 'Cliente no encontrado.', 'CLIENT_NOT_FOUND');
    return client;
  },
  getEquipmentById: async (db: Db, id: string) => {
    const equipment = await db.equipment.findUnique({ where: { id }, include: equipmentInclude });
    if (!equipment) throw new DomainError(404, 'Equipo no encontrado.', 'EQUIPMENT_NOT_FOUND');
    return equipment;
  },
  findImei: (db: Db, value: string) => db.imei.findUnique({ where: { value }, include: { equipment: { include: equipmentInclude } } }),
  getSaleById: (db: Db, id: string) => db.sale.findUniqueOrThrow({ where: { id }, include: { buyer: true, equipment: { include: { equipment: { include: equipmentInclude } } } } }),
  getHistory: (db: Db, equipmentId: string) => db.equipmentHistory.findMany({ where: { equipmentId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
};
