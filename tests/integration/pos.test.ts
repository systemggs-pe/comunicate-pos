import 'dotenv/config';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createPosService } from '../../server/services/pos.service';
import { createApp } from '../../server/app';
import request from 'supertest';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL requerido. Ejecute npm run db:test:prepare.');
const target = new URL(url);
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/communicate_pos_test') throw new Error('Tests sólo permitidos en communicate_pos_test local');
const db = new PrismaClient({ datasources: { db: { url } } });
const service = createPosService(db);
const client = { dni: '00123456', firstName: 'Ana', lastName: 'Pérez' };
const imei1 = '351111111111111', imei2 = '352222222222222';
const external = { client, brand: 'Samsung', model: 'S26 Ultra', imeis: [{ slot: 1, value: imei1 }, { slot: 2, value: imei2 }] };
async function counts() { return { clients: await db.client.count(), equipment: await db.equipment.count(), imeis: await db.imei.count(), history: await db.equipmentHistory.count(), audit: await db.auditLog.count(), sales: await db.sale.count() }; }

beforeAll(() => db.$connect());
beforeEach(async () => {
  // Base dedicada y comprobada arriba; nunca resetear la base de desarrollo.
  // DELETE transaccional evita recrear archivos de cada tabla con TRUNCATE
  // en Docker Desktop, y mantiene todas las FKs y los triggers activados.
  await db.$transaction([
    db.equipmentHistory.deleteMany(), db.auditLog.deleteMany(),
    db.saleEquipment.deleteMany(), db.sale.deleteMany(),
    db.imei.deleteMany(), db.equipment.deleteMany(),
    db.client.deleteMany(), db.user.deleteMany(),
  ]);
});
afterAll(() => db.$disconnect());
describe('PostgreSQL real: reglas comerciales', () => {
  it('1. DNI único incluso fuera de API', async () => { await service.createClient(client); await expect(db.client.create({ data: client })).rejects.toMatchObject({ code: 'P2002' }); expect(await db.client.count()).toBe(1); });
  it('2. IMEI único incluso fuera de API', async () => {
    const equipment = await service.createExternalEquipment(external);
    await expect(db.imei.create({ data: { equipmentId: equipment.id, slot: 2, value: imei1 } })).rejects.toMatchObject({ code: 'P2002' });
    const other = await db.equipment.create({ data: { origin: 'STORE', brand: 'Otro', model: 'Otro' } });
    await expect(db.imei.create({ data: { equipmentId: other.id, slot: 1, value: imei1 } })).rejects.toMatchObject({ code: 'P2002' });
  });
  it('3. IMEIs tienen estados diferentes', async () => { await service.createExternalEquipment(external); const equipment = await service.updateImeiRegistrationStatus(imei1, { status: 'REGISTERED', method: 'MANUAL' }); expect(equipment.imeis.map(i => i.registrationStatus)).toEqual(['REGISTERED', 'NOT_REGISTERED']); expect(equipment.registrationStatus).toBe('PARTIALLY_REGISTERED'); });
  it('4. equipo externo reutiliza cliente y tiene propietario', async () => { const owner = await service.createClient(client); const equipment = await service.createExternalEquipment(external); expect(equipment.ownerId).toBe(owner.id); expect(equipment.origin).toBe('EXTERNAL'); expect(await db.client.count()).toBe(1); });
  it('5. búsqueda por ambos IMEIs devuelve equipo correcto', async () => { const equipment = await service.createExternalEquipment(external); expect((await service.findEquipmentByImei(imei1))?.id).toBe(equipment.id); expect((await service.findEquipmentByImei(imei2))?.id).toBe(equipment.id); });
  it('6. registrar existente no crea cliente, equipo ni venta', async () => {
    const equipment = await service.createExternalEquipment(external);
    const result = await service.registerExternalImei({ value: imei1, registration: { status: 'REGISTERED' }, newEquipment: { ...external, client: { ...client, dni: '87654321' } } });
    expect(result.id).toBe(equipment.id); expect(await db.equipment.count()).toBe(1); expect(await db.client.count()).toBe(1); expect(await db.sale.count()).toBe(0);
  });
  it('7. segundo IMEI puede registrarse después; repetición es idempotente', async () => {
    const first = await service.registerExternalImei({ value: imei1, registration: { status: 'REGISTERED' }, newEquipment: external });
    const second = await service.registerExternalImei({ value: imei2, registration: { status: 'REGISTERED' } });
    expect(second.id).toBe(first.id); expect(second.registrationStatus).toBe('REGISTERED');
    const before = await counts(); await service.updateImeiRegistrationStatus(imei2, { status: 'REGISTERED' }); expect(await counts()).toEqual(before);
  });
  it('8. rollback ante fallo posterior a altas de cliente/equipo/historial', async () => {
    const before = await counts();
    await expect(service.registerExternalImei({ value: imei1, registration: { status: 'REGISTERED', userId: '00000000-0000-4000-8000-000000000001' }, newEquipment: external })).rejects.toBeDefined();
    expect(await counts()).toEqual(before);
  });
  it('PostgreSQL rechaza DNI/IMEI/slot inválidos y FK inexistente', async () => {
    await expect(db.client.create({ data: { ...client, dni: '1234567X' } })).rejects.toBeDefined();
    const equipment = await service.createExternalEquipment({ ...external, imeis: [{ slot: 1, value: imei1 }] });
    await expect(db.imei.create({ data: { equipmentId: equipment.id, slot: 3, value: imei2 } })).rejects.toBeDefined();
    await expect(db.imei.create({ data: { equipmentId: equipment.id, slot: 2, value: '11111111111111A' } })).rejects.toBeDefined();
    await expect(db.equipment.create({ data: { origin: 'EXTERNAL', brand: 'A', model: 'B' } })).rejects.toBeDefined();
    await expect(db.imei.create({ data: { equipmentId: '00000000-0000-4000-8000-000000000001', slot: 1, value: imei2 } })).rejects.toBeDefined();
  });
  it('concurrencia: mismo DNI produce sólo una persona', async () => { const results = await Promise.allSettled([service.createClient(client), service.createClient(client)]); expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(await db.client.count()).toBe(1); });
  it('concurrencia: IMEI duplicado no deja equipo parcial', async () => { const results = await Promise.allSettled([service.createExternalEquipment(external), service.createExternalEquipment(external)]); expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(await db.equipment.count()).toBe(1); expect(await db.imei.count()).toBe(2); });
  it('comprador y propietario distintos, monto exacto, venta exclusiva', async () => {
    const owner = await service.createClient(client); const buyer = await service.createClient({ ...client, dni: '87654321' });
    const equipment = await service.createEquipment({ ownerId: owner.id, origin: 'STORE', brand: 'A', model: 'B', imeis: [{ slot: 1, value: imei1 }] });
    const input = { buyerId: buyer.id, paymentMethod: 'CASH', items: [{ equipmentId: equipment.id, unitPrice: '120.50' }] };
    const sale = await service.createSale(input); expect(sale.total.toFixed(2)).toBe('120.50'); expect(sale.buyerId).not.toBe(equipment.ownerId);
    await expect(service.createSale(input)).rejects.toBeDefined(); expect(await db.sale.count()).toBe(1);
    await db.sale.update({ where: { id: sale.id }, data: { status: 'CANCELLED' } });
    await service.createSale(input);
    await expect(db.sale.update({ where: { id: sale.id }, data: { status: 'PENDING' } })).rejects.toBeDefined();
  });
  it('concurrencia: un equipo no tiene dos ventas activas', async () => {
    const owner = await service.createClient(client);
    const equipment = await service.createEquipment({ ownerId: owner.id, origin: 'STORE', brand: 'A', model: 'B', imeis: [{ slot: 1, value: imei1 }] });
    const input = { buyerId: owner.id, paymentMethod: 'CASH', items: [{ equipmentId: equipment.id, unitPrice: '100' }] };
    const result = await Promise.allSettled([service.createSale(input), service.createSale(input)]);
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(await db.sale.count()).toBe(1);
  });
  it('códigos por secuencia únicos bajo concurrencia', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => service.createClient({ ...client, dni: `1234567${i}` })));
    expect(new Set(results.map(r => r.code)).size).toBe(8); expect(results.every(r => /^CL-\d{6,}$/.test(r.code))).toBe(true);
  });
  it('códigos crecen después de seis dígitos sin truncarse', async () => {
    await db.$queryRaw`SELECT setval('client_code_seq', 999998)`;
    const first = await service.createClient(client);
    const second = await service.createClient({ ...client, dni: '87654321' });
    expect(first.code).toBe('CL-999999'); expect(second.code).toBe('CL-1000000');
  });
  it('registro sin propietario se rechaza en servicio y base', async () => {
    const equipment = await service.createEquipment({ origin: 'STORE', brand: 'A', model: 'B', imeis: [{ slot: 1, value: imei1 }] });
    await expect(service.updateImeiRegistrationStatus(imei1, { status: 'REGISTERED' })).rejects.toMatchObject({ status: 409 });
    await expect(db.imei.update({ where: { value: imei1 }, data: { registrationStatus: 'REGISTERED', registeredAt: new Date() } })).rejects.toBeDefined();
    expect((await service.getEquipmentById(equipment.id)).registrationStatus).toBe('NOT_REGISTERED');
  });
  it('historial apunta al IMEI del mismo equipo', async () => {
    const first = await service.createExternalEquipment(external);
    const other = await db.equipment.create({ data: { origin: 'STORE', brand: 'A', model: 'B' } });
    await expect(db.equipmentHistory.create({ data: { equipmentId: other.id, imeiId: first.imeis[0].id, eventType: 'IMEI_REGISTERED' } })).rejects.toBeDefined();
    expect((await service.getEquipmentHistory(first.id)).length).toBe(4);
  });
  it('total de venta inconsistente rechazado por PostgreSQL', async () => {
    const owner = await service.createClient(client);
    await expect(db.sale.create({ data: { buyerId: owner.id, total: '100', paymentMethod: 'CASH' } })).rejects.toBeDefined();
  });
  it('HTTP → validación → servicios → PostgreSQL → respuesta', async () => {
    const previous = process.env.API_ACCESS_TOKEN;
    const token = 'integration-access-token-at-least-32-characters';
    process.env.API_ACCESS_TOKEN = token;
    try {
      const app = createApp(db);
      const created = await request(app).post('/api/registrations/external').set('Authorization', `Bearer ${token}`).send({ value: imei1, registration: { status: 'REGISTERED' }, newEquipment: external });
      expect(created.status).toBe(200); expect(created.body.registrationStatus).toBe('PARTIALLY_REGISTERED');
      const found = await request(app).get(`/api/equipment/by-imei/${imei1}`).set('Authorization', `Bearer ${token}`);
      expect(found.status).toBe(200); expect(found.body.id).toBe(created.body.id);
      const duplicate = await request(app).post('/api/clients').set('Authorization', `Bearer ${token}`).send(client);
      expect(duplicate.status).toBe(409);
      const updated = await request(app).patch(`/api/imeis/${imei2}/registration`).set('Authorization', `Bearer ${token}`).send({ status: 'REGISTERED' });
      expect(updated.status).toBe(200); expect(updated.body.registrationStatus).toBe('REGISTERED');
      expect(await db.equipment.count()).toBe(1);
    } finally { if (previous === undefined) delete process.env.API_ACCESS_TOKEN; else process.env.API_ACCESS_TOKEN = previous; }
  });
});
