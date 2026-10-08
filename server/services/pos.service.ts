import { Prisma, type PrismaClient, type EquipmentEventType } from '@prisma/client';
import { clientSchema, dniSchema, equipmentSchema, externalEquipmentSchema, idSchema, imeiSchema, imeiValueSchema, registrationSchema, saleSchema } from '../../shared/validation.js';
import { deriveRegistrationStatus } from '../../shared/registration.js';
import { repository, type Db } from '../repositories/pos.repository.js';
import { DomainError } from '../lib/errors.js';

export function createPosService(db: PrismaClient) {
  // Reintentos acotados sólo cuando PostgreSQL aborta la transacción serializable.
  async function transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 20000 }); }
      catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt >= 2) throw error;
      }
    }
  }
  const audit = (tx: Db, action: string, entityType: string, entityId: string, userId?: string) => tx.auditLog.create({ data: { action, entityType, entityId, userId } });
  const history = (tx: Db, equipmentId: string, eventType: EquipmentEventType, imeiId?: string, userId?: string, metadata?: Prisma.InputJsonValue) => tx.equipmentHistory.create({ data: { equipmentId, eventType, imeiId, userId, metadata } });
  function decorated<T extends { imeis: { registrationStatus: string }[] }>(equipment: T) {
    return { ...equipment, registrationStatus: deriveRegistrationStatus(equipment.imeis) };
  }
  async function createEquipmentInTx(tx: Db, input: ReturnType<typeof equipmentSchema.parse>) {
    const { imeis, ...fields } = input;
    const equipment = await tx.equipment.create({ data: { ...fields, imeis: { create: imeis } }, include: { imeis: true } });
    await history(tx, equipment.id, 'EQUIPMENT_CREATED');
    if (equipment.ownerId) await history(tx, equipment.id, 'OWNER_ASSIGNED', undefined, undefined, { ownerId: equipment.ownerId });
    for (const imei of equipment.imeis) await history(tx, equipment.id, 'IMEI_ADDED', imei.id);
    await audit(tx, 'CREATE', 'Equipment', equipment.id);
    return decorated(await repository.getEquipmentById(tx, equipment.id));
  }
  async function updateRegistrationInTx(tx: Db, value: string, input: ReturnType<typeof registrationSchema.parse>) {
    const found = await repository.findImei(tx, value);
    if (!found) throw new DomainError(404, 'IMEI no encontrado.');
    if (!found.equipment.ownerId) throw new DomainError(409, 'Asigne un propietario antes de registrar el equipo.');
    if (found.registrationStatus === input.status && (!input.method || input.method === found.registrationMethod)) return decorated(found.equipment);
    const events: Record<string, EquipmentEventType> = {
      PENDING: 'IMEI_REGISTRATION_STARTED', PROCESSING: 'IMEI_REGISTRATION_STARTED',
      REGISTERED: 'IMEI_REGISTERED', REJECTED: 'IMEI_REGISTRATION_REJECTED', CANCELLED: 'IMEI_REGISTRATION_CANCELLED', NOT_REGISTERED: 'IMEI_REGISTRATION_UPDATED',
    };
    const now = new Date();
    await tx.imei.update({ where: { id: found.id }, data: {
      registrationStatus: input.status,
      registrationMethod: input.method,
      registrationStartedAt: input.status === 'NOT_REGISTERED' ? null : found.registrationStartedAt ?? now,
      registeredAt: input.status === 'REGISTERED' ? found.registeredAt ?? now : null,
      registeredById: input.status === 'REGISTERED' ? input.userId ?? null : null,
    } });
    await history(tx, found.equipmentId, events[input.status], found.id, input.userId, { from: found.registrationStatus, to: input.status });
    await audit(tx, 'REGISTRATION_UPDATE', 'Imei', found.id, input.userId);
    return decorated(await repository.getEquipmentById(tx, found.equipmentId));
  }
  return {
    findClientByDni: (dni: unknown) => repository.findClientByDni(db, dniSchema.parse(dni)),
    getClientById: (id: unknown) => repository.getClientById(db, idSchema.parse(id)),
    createClient: (raw: unknown) => {
      const data = clientSchema.parse(raw);
      return transaction(async tx => { const client = await tx.client.create({ data }); await audit(tx, 'CREATE', 'Client', client.id); return client; });
    },
    createEquipment: (raw: unknown) => {
      const data = equipmentSchema.parse(raw);
      return transaction(tx => createEquipmentInTx(tx, data));
    },
    createExternalEquipment: (raw: unknown) => {
      const input = externalEquipmentSchema.parse(raw);
      return transaction(async tx => {
        // Un IMEI existente se registra por /imeis/:value/registration.
        // No asumir que dos IMEIs desconocidos representan el mismo dispositivo.
        const existing = await tx.imei.findFirst({ where: { value: { in: input.imeis.map(i => i.value) } } });
        if (existing) throw new DomainError(409, 'IMEI existente: busque su equipo y actualice únicamente ese IMEI.');
        let client = await repository.findClientByDni(tx, input.client.dni);
        if (!client) { client = await tx.client.create({ data: input.client }); await audit(tx, 'CREATE', 'Client', client.id); }
        return createEquipmentInTx(tx, equipmentSchema.parse({ ownerId: client.id, origin: 'EXTERNAL', brand: input.brand, model: input.model, serialNumber: input.serialNumber, imeis: input.imeis }));
      });
    },
    getEquipmentById: async (id: unknown) => decorated(await repository.getEquipmentById(db, idSchema.parse(id))),
    findEquipmentByImei: async (value: unknown) => { const imei = await repository.findImei(db, imeiValueSchema.parse(value)); return imei ? decorated(imei.equipment) : null; },
    addImeiToEquipment: (id: unknown, raw: unknown) => {
      const equipmentId = idSchema.parse(id); const input = imeiSchema.parse(raw);
      return transaction(async tx => { await repository.getEquipmentById(tx, equipmentId); const imei = await tx.imei.create({ data: { equipmentId, ...input } }); await history(tx, equipmentId, 'IMEI_ADDED', imei.id); await audit(tx, 'CREATE', 'Imei', imei.id); return decorated(await repository.getEquipmentById(tx, equipmentId)); });
    },
    updateImeiRegistrationStatus: (value: unknown, raw: unknown) => {
      const normalized = imeiValueSchema.parse(value); const input = registrationSchema.parse(raw);
      return transaction(tx => updateRegistrationInTx(tx, normalized, input));
    },
    // Lookup-first: un IMEI conocido ignora cualquier alta y sólo actualiza su registro.
    registerExternalImei: (raw: unknown) => {
      const envelope = registrationRequestSchema.parse(raw);
      return transaction(async tx => {
        if (!await repository.findImei(tx, envelope.value)) {
          if (!envelope.newEquipment) throw new DomainError(404, 'IMEI no encontrado. Proporcione cliente y equipo externo.');
          const input = externalEquipmentSchema.parse(envelope.newEquipment);
          if (!input.imeis.some(i => i.value === envelope.value)) throw new DomainError(400, 'El equipo nuevo debe incluir el IMEI solicitado.');
          let client = await repository.findClientByDni(tx, input.client.dni);
          if (!client) { client = await tx.client.create({ data: input.client }); await audit(tx, 'CREATE', 'Client', client.id); }
          await createEquipmentInTx(tx, equipmentSchema.parse({ ownerId: client.id, origin: 'EXTERNAL', brand: input.brand, model: input.model, serialNumber: input.serialNumber, imeis: input.imeis }));
        }
        return updateRegistrationInTx(tx, envelope.value, envelope.registration);
      });
    },
    createSale: (raw: unknown) => {
      const input = saleSchema.parse(raw);
      return transaction(async tx => {
        const total = input.items.reduce((sum, i) => sum.add(new Prisma.Decimal(i.unitPrice)), new Prisma.Decimal(0));
        if (total.greaterThan('9999999999.99')) throw new DomainError(400, 'Total supera el máximo permitido.');
        for (const item of input.items) {
          const equipment = await repository.getEquipmentById(tx, item.equipmentId);
          if (equipment.origin !== 'STORE' || equipment.status !== 'ACTIVE') throw new DomainError(409, 'Sólo se venden equipos de tienda activos.');
        }
        const sale = await tx.sale.create({ data: { buyerId: input.buyerId, status: input.status, paymentMethod: input.paymentMethod, createdById: input.createdById, total, equipment: { create: input.items } } });
        for (const item of input.items) await history(tx, item.equipmentId, 'SOLD', undefined, input.createdById, { saleId: sale.id, status: sale.status });
        await audit(tx, 'CREATE', 'Sale', sale.id, input.createdById);
        return repository.getSaleById(tx, sale.id);
      });
    },
    getSaleById: (id: unknown) => repository.getSaleById(db, idSchema.parse(id)),
    getEquipmentHistory: async (id: unknown) => { const equipmentId = idSchema.parse(id); await repository.getEquipmentById(db, equipmentId); return repository.getHistory(db, equipmentId); },
    listClients: () => db.client.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    listEquipment: async () => (await db.equipment.findMany({ include: { owner: true, imeis: { orderBy: { slot: 'asc' } } }, orderBy: { createdAt: 'desc' }, take: 100 })).map(decorated),
    listSales: () => db.sale.findMany({ include: { buyer: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
  };
}
import { z } from 'zod';
export const registrationRequestSchema = z.object({ value: imeiValueSchema, registration: registrationSchema, newEquipment: externalEquipmentSchema.optional() }).strict();
