import { createDeletionService } from './deletion.service.js';
import { createRegistrationRequestsService } from './registration-requests.service.js';
import { Prisma, type PrismaClient, type EquipmentEventType } from '@prisma/client';
import { clientSchema, clientEditSchema, dniSchema, equipmentSchema, equipmentEditSchema, externalEquipmentSchema, idSchema, imeiSchema, imeiValueSchema, listQuerySchema, registrationFlowSchema, registrationSchema, resolveRegistrationSchema } from '../../shared/validation.js';
import { deriveRegistrationStatus } from '../../shared/registration.js';
import { repository, type Db } from '../repositories/pos.repository.js';
import { createSalesService } from './sales.service.js';
import { writeAudit, type AuditContext } from '../lib/audit.js';
import { DomainError } from '../lib/errors.js';

export function createPosService(db: PrismaClient, actor: AuditContext = {}) {
  // Reintentos acotados sólo cuando PostgreSQL aborta la transacción serializable.
  async function transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 20000 }); }
      catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt >= 2) throw error;
      }
    }
  }
  const audit = (tx: Db, action: string, entityType: string, entityId: string, userId?: string, metadata?: Prisma.InputJsonValue) => {
    const actions: Record<string,string> = { 'CREATE:Client':'CLIENT_CREATED','UPDATE:Client':'CLIENT_UPDATED','CREATE:Equipment':'EQUIPMENT_CREATED','UPDATE:Equipment':'EQUIPMENT_UPDATED','REGISTRATION_UPDATE:Imei':'IMEI_REGISTRATION_UPDATED','CREATE:Sale':'SALE_CREATED' };
    return writeAudit(tx,{...actor,userId:actor.userId ?? userId},actions[`${action}:${entityType}`] ?? `${entityType.toUpperCase()}_${action}`,entityType,entityId,metadata);
  };
  const history = (tx: Db, equipmentId: string, eventType: EquipmentEventType, imeiId?: string, userId?: string, metadata?: Prisma.InputJsonValue) => tx.equipmentHistory.create({ data: { equipmentId, eventType, imeiId, userId: actor.userId ?? userId, metadata, createdAt: new Date() } });
  function decorated<T extends { imeis: { registrationStatus: string|null }[] }>(equipment: T) {
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
  async function updateRegistrationInTx(tx: Db, value: string, input: ReturnType<typeof registrationSchema.parse>, managed = false) {
    const found = await repository.findImei(tx, value);
    if (!found) throw new DomainError(404, 'IMEI no encontrado.', 'IMEI_NOT_FOUND');
    if (!managed && await tx.registrationRequest.findFirst({where:{imeiId:found.id}})) throw new DomainError(409,'Actualiza la solicitud vinculada a este IMEI.','REQUEST_MANAGED_IMEI');
    // Ambos IMEI comparten el mismo lock de equipo, también en registros individuales.
    await lockEquipmentInTx(tx, found.equipmentId);
    if (!found.equipment.ownerId) throw new DomainError(409, 'Asigne un propietario antes de registrar el equipo.');
    if (input.ownerId && input.ownerId !== found.equipment.ownerId) throw new DomainError(409, 'Este equipo ya está asociado a otro cliente.', 'OWNER_MISMATCH');
    if (found.registrationStatus === input.status && (input.method === undefined || input.method === found.registrationMethod)) return decorated(found.equipment);
    const events: Record<string, EquipmentEventType> = {
      PENDING: 'IMEI_REGISTRATION_STARTED', BLOCKED: 'IMEI_REGISTRATION_UPDATED',
      REGISTERED: 'IMEI_REGISTERED',
    };
    const now = new Date();
    await tx.imei.update({ where: { id: found.id }, data: {
      registrationStatus: input.status,
      registrationMethod: input.method,
      registrationStartedAt: found.registrationStartedAt ?? now,
      registeredAt: input.status === 'REGISTERED' ? found.registeredAt ?? now : null,
      registeredById: input.status === 'REGISTERED' ? actor.userId ?? input.userId ?? found.registeredById : null,
    } });
    if (!found.registrationStartedAt && ['REGISTERED'].includes(input.status)) await history(tx, found.equipmentId, 'IMEI_REGISTRATION_STARTED', found.id, input.userId);
    await history(tx, found.equipmentId, events[input.status], found.id, input.userId, { from: found.registrationStatus, to: input.status, previousMethod: found.registrationMethod, method: input.method === undefined ? found.registrationMethod : input.method });
    await audit(tx, 'REGISTRATION_UPDATE', 'Imei', found.id, input.userId, { from: found.registrationStatus, to: input.status });
    return decorated(await repository.getEquipmentById(tx, found.equipmentId));
  }
  async function lockEquipmentInTx(tx: Db, equipmentId: string) {
    await tx.$queryRaw`SELECT id FROM "Equipment" WHERE id = ${equipmentId}::uuid FOR UPDATE`;
  }
  async function resolveInTx(tx: Db, raw: ReturnType<typeof resolveRegistrationSchema.parse>) {
    const matches = await tx.imei.findMany({ where: { value: { in: raw.imeis.map(i => i.value) } }, include: { equipment: { include: { owner: true } } } });
    const ids = new Set(matches.map(i => i.equipmentId));
    if (ids.size > 1) throw new DomainError(409, 'Los IMEIs pertenecen a equipos distintos. No se pueden combinar.', 'IMEI_EQUIPMENT_CONFLICT');
    if (!matches.length) return { kind: 'NEW' as const, equipment: null, additions: raw.imeis, requiresConfirmation: false };
    const equipment = decorated(await repository.getEquipmentById(tx, matches[0].equipmentId));
    if (!equipment.owner || equipment.owner.dni !== raw.dni) throw new DomainError(409, 'Este equipo ya está asociado a otro cliente. No se cambiará su propietario.', 'OWNER_MISMATCH');
    const additions = raw.imeis.filter(i => !matches.some(match => match.value === i.value));
    for (const imei of additions) {
      if (equipment.imeis.some(existing => existing.slot === imei.slot)) throw new DomainError(409, `El slot ${imei.slot} ya está ocupado. Revise los IMEIs del equipo.`, 'IMEI_SLOT_OCCUPIED');
    }
    if (equipment.imeis.length + additions.length > 2) throw new DomainError(409, 'El equipo ya tiene sus dos IMEIs.', 'IMEI_SLOT_OCCUPIED');
    return { kind: 'EXISTING' as const, equipment, additions, requiresConfirmation: additions.length > 0 };
  }
  return {
    ...createDeletionService(db,actor,transaction),
    findClientByDni: (dni: unknown) => repository.findClientByDni(db, dniSchema.parse(dni)),
    getClientById: async (id: unknown) => { const client = await repository.getClientById(db, idSchema.parse(id)); return { ...client, equipment: client.equipment.map(decorated) }; },
    createClient: (raw: unknown) => {
      const data = clientSchema.parse(raw);
      return transaction(async tx => { const client = await tx.client.create({ data }); await audit(tx, 'CREATE', 'Client', client.id); return client; });
    },
    updateClient: (id: unknown, raw: unknown) => {
      const clientId = idSchema.parse(id), data = clientEditSchema.parse(raw);
      return transaction(async tx => { await repository.getClientById(tx, clientId); const client = await tx.client.update({ where: { id: clientId }, data }); await audit(tx, 'UPDATE', 'Client', clientId); return client; });
    },
    updateEquipment: (id: unknown, raw: unknown) => {
      const equipmentId = idSchema.parse(id), data = equipmentEditSchema.parse(raw);
      return transaction(async tx => {
        await repository.getEquipmentById(tx, equipmentId);
        await tx.equipment.update({ where: { id: equipmentId }, data });
        await history(tx, equipmentId, 'EQUIPMENT_UPDATED', undefined, undefined, { fields: Object.keys(data) });
        await audit(tx, 'UPDATE', 'Equipment', equipmentId);
        return decorated(await repository.getEquipmentById(tx, equipmentId));
      });
    },
    resolveRegistration: (raw: unknown) => {
      const input = resolveRegistrationSchema.parse(raw);
      return transaction(tx => resolveInTx(tx, input));
    },
    submitRegistration: (raw: unknown) => {
      const input = registrationFlowSchema.parse(raw);
      return transaction(async tx => {
        // Revalidar dentro de la transacción; el preflight de UI nunca es autoridad.
        const resolved = await resolveInTx(tx, { dni: input.client.dni, imeis: input.imeis });
        if (input.expectedEquipmentId && input.expectedEquipmentId !== resolved.equipment?.id) throw new DomainError(409, 'El equipo encontrado cambió. Vuelva a buscar los IMEIs.', 'IMEI_EQUIPMENT_CONFLICT');
        if (resolved.requiresConfirmation && (!input.confirmAddImei || input.expectedEquipmentId !== resolved.equipment?.id)) throw new DomainError(409, 'Confirme explícitamente que el nuevo IMEI pertenece al equipo encontrado.', 'IMEI_ASSOCIATION_CONFIRMATION_REQUIRED');
        let equipment = resolved.equipment;
        if (!equipment) {
          if (!input.equipment) throw new DomainError(400, 'Complete marca y modelo del equipo nuevo.', 'VALIDATION_ERROR');
          let client = await repository.findClientByDni(tx, input.client.dni);
          if (!client) { client = await tx.client.create({ data: input.client }); await audit(tx, 'CREATE', 'Client', client.id); }
          equipment = await createEquipmentInTx(tx, equipmentSchema.parse({ ...input.equipment, serialNumber: input.equipment.serialNumber ?? undefined, ownerId: client.id, origin: 'EXTERNAL', imeis: input.imeis }));
        } else {
          await lockEquipmentInTx(tx, equipment.id);
          for (const imei of resolved.additions) {
            const created = await tx.imei.create({ data: { ...imei, equipmentId: equipment.id } });
            await history(tx, equipment.id, 'IMEI_ADDED', created.id);
            await audit(tx, 'CREATE', 'Imei', created.id);
          }
        }
        if (input.registration.ownerId && input.registration.ownerId !== equipment.ownerId) throw new DomainError(409, 'Este equipo ya está asociado a otro cliente.', 'OWNER_MISMATCH');
        for (const value of input.selectedImeis) await updateRegistrationInTx(tx, value, { ...input.registration, ownerId: equipment.ownerId ?? undefined });
        return decorated(await repository.getEquipmentById(tx, equipment.id));
      });
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
        if (existing) throw new DomainError(409, 'IMEI existente: busque su equipo y actualice únicamente ese IMEI.', 'IMEI_ALREADY_EXISTS');
        let client = await repository.findClientByDni(tx, input.client.dni);
        if (!client) { client = await tx.client.create({ data: input.client }); await audit(tx, 'CREATE', 'Client', client.id); }
        return createEquipmentInTx(tx, equipmentSchema.parse({ ownerId: client.id, origin: 'EXTERNAL', brand: input.brand, model: input.model, serialNumber: input.serialNumber, imeis: input.imeis }));
      });
    },
    getEquipmentById: async (id: unknown) => decorated(await repository.getEquipmentById(db, idSchema.parse(id))),
    findEquipmentByImei: async (value: unknown) => { const imei = await repository.findImei(db, imeiValueSchema.parse(value)); return imei ? decorated(imei.equipment) : null; },
    addImeiToEquipment: (id: unknown, raw: unknown) => {
      const equipmentId = idSchema.parse(id); const input = imeiSchema.parse(raw);
      return transaction(async tx => { await lockEquipmentInTx(tx, equipmentId); await repository.getEquipmentById(tx, equipmentId); const imei = await tx.imei.create({ data: { equipmentId, ...input } }); await history(tx, equipmentId, 'IMEI_ADDED', imei.id); await audit(tx, 'CREATE', 'Imei', imei.id); return decorated(await repository.getEquipmentById(tx, equipmentId)); });
    },
    updateImeiRegistrationStatus: (value: unknown, raw: unknown) => {
      const normalized = imeiValueSchema.parse(value); const input = registrationSchema.parse(raw);
      return transaction(tx => updateRegistrationInTx(tx, normalized, input));
    },
    // Lookup-first: un IMEI conocido ignora cualquier alta y sólo actualiza su registro.
    registerExternalImei: (raw: unknown) => {
      const envelope = registrationRequestSchema.parse(raw);
      return transaction(async tx => {
        const existing = await repository.findImei(tx, envelope.value);
        if (existing && envelope.newEquipment && existing.equipment.owner?.dni !== envelope.newEquipment.client.dni) throw new DomainError(409, 'Este equipo ya está asociado a otro cliente.', 'OWNER_MISMATCH');
        if (!existing) {
          if (!envelope.newEquipment) throw new DomainError(404, 'IMEI no encontrado. Proporcione cliente y equipo externo.', 'IMEI_NOT_FOUND');
          const input = externalEquipmentSchema.parse(envelope.newEquipment);
          if (!input.imeis.some(i => i.value === envelope.value)) throw new DomainError(400, 'El equipo nuevo debe incluir el IMEI solicitado.', 'VALIDATION_ERROR');
          let client = await repository.findClientByDni(tx, input.client.dni);
          if (!client) { client = await tx.client.create({ data: input.client }); await audit(tx, 'CREATE', 'Client', client.id); }
          await createEquipmentInTx(tx, equipmentSchema.parse({ ownerId: client.id, origin: 'EXTERNAL', brand: input.brand, model: input.model, serialNumber: input.serialNumber, imeis: input.imeis }));
        }
        return updateRegistrationInTx(tx, envelope.value, envelope.registration);
      });
    },
    getEquipmentHistory: async (id: unknown) => { const equipmentId = idSchema.parse(id); await repository.getEquipmentById(db, equipmentId); return repository.getHistory(db, equipmentId); },
    listClients: async (raw: unknown = {}) => {
      const { q, offset, limit } = listQuerySchema.parse(raw);
      const rows = await db.client.findMany({ where: { AND: q.split(/\s+/).filter(Boolean).map(term => ({ OR: [{ dni: { contains: term } }, { code: { contains: term, mode: 'insensitive' as const } }, { firstName: { contains: term, mode: 'insensitive' as const } }, { lastName: { contains: term, mode: 'insensitive' as const } }, { email: { contains: term, mode: 'insensitive' as const } }] })) }, include: { _count: { select: { equipment: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: offset, take: limit });
      return rows.map(({ _count, ...client }) => ({ ...client, equipmentCount: _count.equipment }));
    },
    listEquipment: async (raw: unknown = {}) => {
      const { q, ownerId, offset, limit } = listQuerySchema.parse(raw);
      return (await db.equipment.findMany({ where: { ownerId, ...(q ? { OR: [{ code: { contains: q, mode: 'insensitive' } }, { brand: { contains: q, mode: 'insensitive' } }, { model: { contains: q, mode: 'insensitive' } }, { imeis: { some: { value: q.replace(/\s/g, '') } } }] } : {}) }, include: { owner: true, imeis: { orderBy: { slot: 'asc' } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: offset, take: limit })).map(decorated);
    },
    ...createRegistrationRequestsService(db, actor, { transaction, resolveInTx, createEquipmentInTx, updateRegistrationInTx }),
    ...createSalesService(db, { transaction, history, audit, createEquipmentInTx, actor }),
  };
}
import { z } from 'zod';
export const registrationRequestSchema = z.object({ value: imeiValueSchema, registration: registrationSchema, newEquipment: externalEquipmentSchema.optional() }).strict();
