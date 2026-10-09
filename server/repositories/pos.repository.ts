import type { Prisma } from '@prisma/client';
import { DomainError } from '../lib/errors.js';
export type Db = Prisma.TransactionClient;
export const saleSummaryInclude = { buyer: true, createdBy: { select: { id: true, name: true } }, _count: { select: { equipment: true } } } satisfies Prisma.SaleInclude;
export const equipmentInclude = { owner: true, imeis: { include: { requests: { orderBy: { createdAt: 'desc' as const } } }, orderBy: { slot: 'asc' as const } }, saleEquipment: { include: { sale: { include: saleSummaryInclude } }, orderBy: { createdAt: 'desc' as const } } } satisfies Prisma.EquipmentInclude;
export const repository = {
  findClientByDni: (db: Db, dni: string) => db.client.findUnique({ where: { dni } }),
  getClientById: async (db: Db, id: string) => {
    const client = await db.client.findUnique({ where: { id }, include: { equipment: { include: equipmentInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }, purchases: { include: saleSummaryInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] } } });
    if (!client) throw new DomainError(404, 'Cliente no encontrado.', 'CLIENT_NOT_FOUND');
    return client;
  },
  getEquipmentById: async (db: Db, id: string) => {
    const equipment = await db.equipment.findUnique({ where: { id }, include: equipmentInclude });
    if (!equipment) throw new DomainError(404, 'Equipo no encontrado.', 'EQUIPMENT_NOT_FOUND');
    return equipment;
  },
  findImei: (db: Db, value: string) => db.imei.findUnique({ where: { value }, include: { equipment: { include: equipmentInclude } } }),
  getSaleById: async (db: Db, id: string) => { const sale = await db.sale.findUnique({ where: { id }, include: { ...saleSummaryInclude, accessories: true, equipment: { include: { equipment: { include: equipmentInclude } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } } }); if (!sale) throw new DomainError(404, 'Venta no encontrada.', 'SALE_NOT_FOUND'); return sale; },
  getHistory: (db: Db, equipmentId: string) => db.equipmentHistory.findMany({ where: { equipmentId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
};
