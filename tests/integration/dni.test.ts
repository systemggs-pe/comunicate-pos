import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { MockDniProvider } from '../../server/dni/providers';
import { DniProviderError } from '../../server/dni/provider';
import { hashPassword } from '../../server/lib/password';
import { seedTestAdmin, loginAgent, testOrigin, testPassword } from '../helpers/auth';

const url = process.env.TEST_DATABASE_URL!;
const target = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.pathname !== '/communicate_pos_test') throw new Error('Sólo base local de prueba');
const db = new PrismaClient({ datasources: { db: { url } } });
const provider = { lookup: vi.fn(new MockDniProvider().lookup.bind(new MockDniProvider())) };
const app = createApp(db, { dniProvider: provider, dniOptions: { timeoutMs: 40, backoffMs: 1 } });
beforeEach(async () => {
  await db.$transaction([db.session.deleteMany(), db.authRateLimit.deleteMany(), db.equipmentHistory.deleteMany(), db.auditLog.deleteMany(), db.saleEquipment.deleteMany(), db.sale.deleteMany(), db.imei.deleteMany(), db.equipment.deleteMany(), db.client.deleteMany(), db.user.deleteMany()]);
  await db.rolePermission.deleteMany({ where: { role: { code: 'DNI_TEST' } } }); await db.role.deleteMany({ where: { code: 'DNI_TEST' } });
  provider.lookup.mockReset().mockImplementation(new MockDniProvider().lookup.bind(new MockDniProvider()));
  await seedTestAdmin(db);
});
afterAll(async () => {
  await db.session.deleteMany({ where: { user: { role: { code: 'DNI_TEST' } } } });
  await db.auditLog.deleteMany({ where: { user: { role: { code: 'DNI_TEST' } } } });
  await db.user.deleteMany({ where: { role: { code: 'DNI_TEST' } } });
  await db.rolePermission.deleteMany({ where: { role: { code: 'DNI_TEST' } } }); await db.role.deleteMany({ where: { code: 'DNI_TEST' } });
  await db.$disconnect();
});
describe('DNI API, PostgreSQL y flujos comerciales', () => {
  it('sin sesión y DNI inválido no consultan proveedor', async () => {
    expect((await request(app).get('/api/dni/12345678')).status).toBe(401);
    const agent = await loginAgent(app); const invalid = await agent.get('/api/dni/abc'); expect(invalid.status).toBe(400); expect(invalid.body.error.code).toBe('DNI_INVALID'); expect(provider.lookup).not.toHaveBeenCalled();
  });
  it('local-first, nombres corregidos y DNI normalizado', async () => {
    const existing = await db.client.create({ data: { dni: '12345678', firstName: 'Nombre local corregido', lastName: 'Peña', phone: '999000111' } });
    const agent = await loginAgent(app); const result = await agent.get('/api/dni/%201234%205678%20');
    expect(result.status).toBe(200); expect(result.body).toMatchObject({ source: 'LOCAL', client: { id: existing.id, firstName: existing.firstName } }); expect(provider.lookup).not.toHaveBeenCalled();
  });
  it('consulta externa no crea cliente ni auditoría; confirmar crea e impide duplicado', async () => {
    const agent = await loginAgent(app); const auditCount = await db.auditLog.count();
    const result = await agent.get('/api/dni/12345678'); expect(result.body).toMatchObject({ source: 'EXTERNAL', data: { firstName: 'Ana María', lastName: 'Muñoz Álvarez' } });
    expect(await db.client.count()).toBe(0); expect(await db.auditLog.count()).toBe(auditCount);
    const created = await agent.post('/api/clients').set('Origin', testOrigin).send({ ...result.body.data, phone: '999111222', email: 'fixture@example.test' }); expect(created.status).toBe(201);
    expect((await agent.post('/api/clients').set('Origin', testOrigin).send(result.body.data)).status).toBe(409);
    const local = await agent.get('/api/dni/12345678'); expect(local.body.source).toBe('LOCAL'); expect(provider.lookup).toHaveBeenCalledTimes(1);
    const actor = await db.user.findUniqueOrThrow({ where: { email: 'test-admin@example.com' } });
    expect(await db.auditLog.count({ where: { action: 'CLIENT_CREATED', userId: actor.id } })).toBe(1);
  });
  it('fallo proveedor permite creación manual', async () => {
    const failure = { lookup: vi.fn().mockRejectedValue(new Error('private-token raw-private-payload')) };
    const failedApp = createApp(db, { dniProvider: failure, dniOptions: { backoffMs: 1 } }); const agent = await loginAgent(failedApp);
    const result = await agent.get('/api/dni/12345680'); expect(result.status).toBe(200); expect(result.body).toMatchObject({ source: 'NONE', error: { code: 'DNI_PROVIDER_UNAVAILABLE' } }); expect(JSON.stringify(result.body)).not.toContain('private');
    expect((await agent.post('/api/clients').set('Origin', testOrigin).send({ dni: '12345680', firstName: 'Manual', lastName: 'Ñúñez' })).status).toBe(201);
  });
  it('registro externo confirmado crea cliente, equipo y dos IMEI sin duplicación posterior', async () => {
    const freshApp = createApp(db, { dniProvider: provider }); const agent = await loginAgent(freshApp);
    const lookup = await agent.get('/api/dni/12345678'); expect(lookup.body.source).toBe('EXTERNAL'); expect(await db.client.count()).toBe(0);
    const body = { client: { ...lookup.body.data, phone: '999111222' }, imeis: [{ slot: 1, value: '359123456780001' }, { slot: 2, value: '359123456780002' }], equipment: { brand: 'Honor', model: 'Dual' }, selectedImeis: ['359123456780001'], registration: { status: 'REGISTERED' } };
    const registered = await agent.post('/api/registrations').set('Origin', testOrigin).send(body); expect(registered.status).toBe(200); expect(registered.body.registrationStatus).toBe('PARTIALLY_REGISTERED');
    expect((await agent.get('/api/dni/12345678')).body.source).toBe('LOCAL'); expect(provider.lookup).toHaveBeenCalledTimes(1);
    expect((await agent.post('/api/registrations').set('Origin', testOrigin).send({ ...body, expectedEquipmentId: registered.body.id })).status).toBe(200);
    expect(await db.client.count()).toBe(1); expect(await db.equipment.count()).toBe(1); expect(await db.imei.count()).toBe(2);
  });
  it('provider caído no bloquea registro manual', async () => {
    const failedApp = createApp(db, { dniProvider: { lookup: async () => { throw new DniProviderError('DNI_PROVIDER_UNAVAILABLE'); } }, dniOptions: { backoffMs: 1 } }); const agent = await loginAgent(failedApp);
    expect((await agent.get('/api/dni/99999999')).body.source).toBe('NONE');
    const result = await agent.post('/api/registrations').set('Origin', testOrigin).send({ client: { dni: '99999999', firstName: 'Manual', lastName: 'Pérez' }, imeis: [{ slot: 1, value: '359999999990001' }], equipment: { brand: 'Motorola', model: 'Single' }, selectedImeis: ['359999999990001'], registration: { status: 'PENDING' } });
    expect(result.status).toBe(200); expect(await db.client.count()).toBe(1); expect(await db.imei.count()).toBe(1);
  });
  it('venta con buyer externo y owner distinto reutiliza el mismo sistema', async () => {
    const freshApp = createApp(db, { dniProvider: provider }); const agent = await loginAgent(freshApp);
    const buyer = (await agent.get('/api/dni/12345678')).body.data, owner = (await agent.get('/api/dni/12345679')).body.data;
    expect(await db.client.count()).toBe(0);
    const body = { buyer: { client: buyer }, items: [{ owner: { client: owner }, equipment: { brand: 'Xiaomi', model: 'Dual', imeis: [{ slot: 1, value: '359123456780001' }, { slot: 2, value: '359123456780002' }] }, unitPrice: '1000' }], paymentMethod: 'CASH' };
    expect((await agent.post('/api/sales/resolve').set('Origin', testOrigin).send(body)).status).toBe(200); expect(await db.client.count()).toBe(0);
    const sale = await agent.post('/api/sales').set('Origin', testOrigin).send(body); expect(sale.status).toBe(201); expect(sale.body.buyerId).not.toBe(sale.body.equipment[0].equipment.ownerId); expect(await db.client.count()).toBe(2);
  });
  it('venta manual sin resultado proveedor continúa', async () => {
    const agent = await loginAgent(app); expect((await agent.get('/api/dni/99999999')).body.source).toBe('NONE');
    const sale = await agent.post('/api/sales').set('Origin', testOrigin).send({ buyer: { client: { dni: '99999999', firstName: 'Manual', lastName: 'Venta' } }, items: [{ equipment: { brand: 'Apple', model: 'iPhone', imeis: [{ slot: 1, value: '359999999990001' }] }, unitPrice: '1000' }], paymentMethod: 'YAPE' });
    expect(sale.status).toBe(201); expect(await db.client.count()).toBe(1);
  });
  it.each(['clients.create', 'sales.create', 'registration.create', 'clients.read'])('permiso %s respeta acceso OR', async permission => {
    const role = await db.role.create({ data: { code: 'DNI_TEST', permissions: { create: { permissionKey: permission } } } });
    await db.user.create({ data: { email: 'dni-fixture@example.test', name: 'DNI fixture', roleId: role.id, status: 'ACTIVE', passwordHash: await hashPassword(testPassword) } });
    const agent = await loginAgent(app, 'dni-fixture@example.test'); const result = await agent.get('/api/dni/87654321');
    expect(result.status).toBe(permission === 'clients.read' ? 403 : 200);
    if (permission === 'clients.read') expect(provider.lookup).not.toHaveBeenCalled();
  });
});
