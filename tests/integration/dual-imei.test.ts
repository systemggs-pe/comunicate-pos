import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createPosService } from '../../server/services/pos.service';

const url = process.env.TEST_DATABASE_URL!;
const target = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.pathname !== '/communicate_pos_test') throw new Error('Sólo base local de prueba');
const db = new PrismaClient({ datasources: { db: { url } } });
const service = createPosService(db);
const client = { dni: '00123456', firstName: 'Ana', lastName: 'Pérez' };
const values = ['351111111111111', '352222222222222'];
const imeis = values.map((value, index) => ({ slot: index + 1, value }));
const flow = { client, imeis, equipment: { brand: 'Honor', model: 'Dual' }, selectedImeis: values, registration: { status: 'REGISTERED', method: 'MANUAL' } };
beforeEach(async () => {
  await db.$transaction([db.session.deleteMany(), db.authRateLimit.deleteMany(), db.registrationRequestHistory.deleteMany(), db.registrationRequest.deleteMany(), db.registrationOperation.deleteMany(), db.saleAccessory.deleteMany(), db.equipmentHistory.deleteMany(), db.auditLog.deleteMany(), db.saleEquipment.deleteMany(), db.sale.deleteMany(), db.imei.deleteMany(), db.equipment.deleteMany(), db.client.deleteMany(), db.user.deleteMany()]);
});
afterAll(() => db.$disconnect());

describe('Doble IMEI real, todas las marcas', () => {
  it.each(['Samsung', 'Honor', 'Xiaomi', 'Motorola', 'Apple', 'Desconocida'])('%s: ambos relacionados, búsqueda e idempotencia', async brand => {
    const input = { ...flow, equipment: { brand, model: 'Dual' } };
    const result = await service.submitRegistration(input);
    expect(result.imeis.map(i => [i.slot, i.equipmentId, i.registrationStatus])).toEqual([[1, result.id, 'REGISTERED'], [2, result.id, 'REGISTERED']]);
    expect(result.registrationStatus).toBe('REGISTERED');
    for (const value of values) {
      expect((await service.findEquipmentByImei(value))?.id).toBe(result.id);
      expect((await service.listEquipment({ q: value }))[0].id).toBe(result.id);
    }
    await service.submitRegistration({ ...input, expectedEquipmentId: result.id });
    expect(await db.imei.count()).toBe(2); expect(await db.equipment.count()).toBe(1);
    const history = await service.getEquipmentHistory(result.id);
    expect(history.filter(e => e.eventType === 'IMEI_REGISTERED').map(e => e.imeiId).sort()).toEqual(result.imeis.map(i => i.id).sort());
  });
  it.each([0, 1])('sólo IMEI %i deja el otro sin registrar', async selected => {
    const result = await service.submitRegistration({ ...flow, selectedImeis: [values[selected]] });
    expect(result.registrationStatus).toBe('PARTIALLY_REGISTERED');
    expect(result.imeis[selected].registrationStatus).toBe('REGISTERED');
    expect(result.imeis[1 - selected].registrationStatus).toBeNull();
  });
  it('segundo vacío es single, segundo inválido e iguales no escriben', async () => {
    for (const value of ['ABC', values[0]]) expect(() => service.submitRegistration({ ...flow, imeis: [imeis[0], { slot: 2, value }] })).toThrow();
    expect(await db.equipment.count()).toBe(0);
    const result = await service.submitRegistration({ ...flow, imeis: [imeis[0], { slot: 2, value: ' ' }], selectedImeis: [values[0]] });
    expect(result.imeis).toHaveLength(1); expect(result.registrationStatus).toBe('REGISTERED');
  });
  it.each([[0, 1], [1, 0], [0, 0], [1, 1]])('duplicado cruzado origen %i destino %i no deja equipo parcial', async (source, slot) => {
    await service.submitRegistration(flow);
    const other = ['353333333333333', '354444444444444'].map((value, index) => ({ slot: index + 1, value: index === slot ? values[source] : value }));
    await expect(service.createExternalEquipment({ client, brand: 'Motorola', model: 'Dual', imeis: other })).rejects.toMatchObject({ code: 'IMEI_ALREADY_EXISTS' });
    expect(await db.equipment.count()).toBe(1); expect(await db.imei.count()).toBe(2);
  });
  it('IMEI de dos equipos no se pueden agrupar', async () => {
    for (const imei of imeis) await service.createExternalEquipment({ client, brand: 'Xiaomi', model: 'Single', imeis: [{ ...imei, slot: 1 }] });
    await expect(service.submitRegistration(flow)).rejects.toMatchObject({ code: 'IMEI_EQUIPMENT_CONFLICT' });
    expect(await db.equipmentHistory.count({ where: { eventType: 'IMEI_REGISTERED' } })).toBe(0);
  });
  it('doble submit concurrente no duplica el par', async () => {
    const results = await Promise.allSettled([service.submitRegistration(flow), service.submitRegistration(flow)]);
    expect(results.some(r => r.status === 'fulfilled')).toBe(true);
    expect(await db.equipment.count()).toBe(1); expect(await db.imei.count()).toBe(2);
    expect(await db.equipmentHistory.count({ where: { eventType: 'IMEI_REGISTERED' } })).toBe(2);
  });
  it('operaciones concurrentes sobre IMEI diferentes conservan ambos estados', async () => {
    const first = await service.createExternalEquipment({ client, brand: 'Honor', model: 'Dual', imeis });
    await Promise.all(values.map(value => service.updateImeiRegistrationStatus(value, { status: 'REGISTERED' })));
    const result = await service.getEquipmentById(first.id);
    expect(result.registrationStatus).toBe('REGISTERED'); expect(result.imeis.every(i => i.registrationStatus === 'REGISTERED')).toBe(true);
    expect(await db.equipmentHistory.count({ where: { eventType: 'IMEI_REGISTERED' } })).toBe(2);
  });
  it.each(values)('lock del equipo bloquea registro individual %s', async value => {
    const first = await service.createExternalEquipment({ client, brand: 'Motorola', model: 'Dual', imeis });
    let pending: ReturnType<typeof service.updateImeiRegistrationStatus> | undefined;
    try { await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Equipment" WHERE id = ${first.id}::uuid FOR UPDATE`;
      pending = service.updateImeiRegistrationStatus(value, { status: 'REGISTERED' });
      // Observar espera real en PostgreSQL; no simular el mecanismo de locks.
      const deadline = Date.now() + 5000;
      let waiting = false;
      while (!waiting && Date.now() < deadline) {
        await tx.$executeRaw`SELECT pg_stat_clear_snapshot()`;
        const rows = await tx.$queryRaw<{ waiting: boolean }[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname = 'communicate_pos_test' AND wait_event_type = 'Lock' AND query LIKE '%Equipment%FOR UPDATE%') AS waiting`;
        waiting = rows[0].waiting;
        if (!waiting) await new Promise(resolve => setTimeout(resolve, 25));
      }
      expect(waiting).toBe(true);
    }, { timeout: 10000 }); } finally { await pending; }
  });
  it.each(['Samsung', 'Honor'])('equipo anterior %s sin banderas dual conserva estados', async brand => {
    const first = await service.createExternalEquipment({ client, brand, model: 'Legacy local', imeis });
    await service.registerExternalImei({ value: values[1], registration: { status: 'REGISTERED' } });
    const resolved = await service.resolveRegistration({ dni: client.dni, imeis: [{ slot: 1, value: values[1] }] });
    expect(resolved.equipment?.id).toBe(first.id); expect(resolved.equipment?.imeis.map(i => i.registrationStatus)).toEqual([null, 'REGISTERED']);
    expect(await db.equipment.count()).toBe(1);
  });
});
