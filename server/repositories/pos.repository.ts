import type { Prisma } from '@prisma/client';
export type Db = Prisma.TransactionClient;
export const equipmentInclude = { owner: true, imeis: { orderBy: { slot: 'asc' as const } } } satisfies Prisma.EquipmentInclude;
export const repository = {
  findClientByDni: (db: Db, dni: string) => db.client.findUnique({ where: { dni } }),
  getClientById: (db: Db, id: string) => db.client.findUniqueOrThrow({ where: { id } }),
  getEquipmentById: (db: Db, id: string) => db.equipment.findUniqueOrThrow({ where: { id }, include: equipmentInclude }),
  findImei: (db: Db, value: string) => db.imei.findUnique({ where: { value }, include: { equipment: { include: equipmentInclude } } }),
  getSaleById: (db: Db, id: string) => db.sale.findUniqueOrThrow({ where: { id }, include: { buyer: true, equipment: { include: { equipment: { include: equipmentInclude } } } } }),
  getHistory: (db: Db, equipmentId: string) => db.equipmentHistory.findMany({ where: { equipmentId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
};
