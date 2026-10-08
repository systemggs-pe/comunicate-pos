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
const flow = { client, imeis: external.imeis, equipment: { brand: 'Samsung', model: 'Galaxy S25 Ultra' }, selectedImeis: [imei1], registration: { status: 'REGISTERED' } };
describe('Phase 2: clientes y registro atómico', () => {
  it('cliente válido normalizado', async () => { const result = await service.createClient({ ...client, dni: ' 0012 3456 ', firstName: ' Ana   María ' }); expect(result.dni).toBe(client.dni); expect(result.firstName).toBe('Ana María'); });
  it('cliente duplicado revierte auditoría', async () => { await service.createClient(client); const before = await counts(); await expect(service.createClient(client)).rejects.toBeDefined(); expect(await counts()).toEqual(before); });
  it('edita contacto, mantiene DNI', async () => { const result = await service.createClient(client); const edited = await service.updateClient(result.id, { firstName: 'Brand', lastName: 'Peralta', phone: '999999999', email: 'brand@example.com' }); expect(edited.dni).toBe(client.dni); expect(edited.firstName).toBe('Brand'); });
  it('rechaza edición de DNI', async () => { const result = await service.createClient(client); expect(() => service.updateClient(result.id, { firstName: 'A', lastName: 'B', dni: '87654321' })).toThrow(); expect((await service.getClientById(result.id)).dni).toBe(client.dni); });
  it('detalle obtiene equipos por ownerId', async () => { const equipment = await service.submitRegistration(flow); const details = await service.getClientById(equipment.ownerId!); expect(details.equipment.map(e => e.id)).toEqual([equipment.id]); });
  it('búsqueda por DNI y nombre completo', async () => { await service.createClient(client); expect(await service.listClients({ q: 'Ana Pérez' })).toHaveLength(1); expect(await service.listClients({ q: '00123456' })).toHaveLength(1); expect(await service.listClients({ q: 'Otro' })).toHaveLength(0); });
  it('paginación y conteo de equipos', async () => { await service.submitRegistration(flow); const result = await service.listClients({ limit: 1 }); expect(result[0].equipmentCount).toBe(1); expect(await service.listClients({ offset: 1 })).toHaveLength(0); });
  it('equipo externo con un IMEI', async () => { const result = await service.submitRegistration({ ...flow, imeis: external.imeis.slice(0, 1) }); expect(result.imeis).toHaveLength(1); expect(result.registrationStatus).toBe('REGISTERED'); });
  it('equipo externo con dos IMEIs, propietario y código', async () => { const result = await service.submitRegistration(flow); expect(result.origin).toBe('EXTERNAL'); expect(result.status).toBe('ACTIVE'); expect(result.owner?.dni).toBe(client.dni); expect(result.code).toMatch(/^EQ-\d{6,}$/); expect(result.imeis.map(i => i.slot)).toEqual([1, 2]); });
  it('edición segura y evento de equipo', async () => { const result = await service.submitRegistration(flow); const edited = await service.updateEquipment(result.id, { brand: ' SAMSUNG ', model: ' Galaxy   S25 ', serialNumber: 'SERIAL' }); expect(edited.model).toBe('Galaxy S25'); expect(edited.ownerId).toBe(result.ownerId); expect((await service.getEquipmentHistory(result.id)).some(e => e.eventType === 'EQUIPMENT_UPDATED')).toBe(true); });
  it.each(['ownerId', 'id', 'code', 'imeis'])('rechaza campo sensible %s', async field => { const result = await service.submitRegistration(flow); expect(() => service.updateEquipment(result.id, { brand: 'A', model: 'B', [field]: result.id })).toThrow(); expect((await service.getEquipmentById(result.id)).brand).toBe('Samsung'); });
  it('búsqueda de equipo por código e IMEI y ownerId', async () => { const result = await service.submitRegistration(flow); expect((await service.listEquipment({ q: result.code }))[0].id).toBe(result.id); expect((await service.listEquipment({ q: imei2, ownerId: result.ownerId }))[0].id).toBe(result.id); });
  it('IMEI inválido no deja cliente ni equipo', async () => { expect(() => service.submitRegistration({ ...flow, imeis: [{ slot: 1, value: 'ABC' }] })).toThrow(); expect((await counts()).clients).toBe(0); });
  it('dos IMEIs iguales fallan antes de escribir', async () => { expect(() => service.submitRegistration({ ...flow, imeis: [{ slot: 1, value: imei1 }, { slot: 2, value: imei1 }] })).toThrow(); expect((await counts()).equipment).toBe(0); });
  it('slot 3 falla', async () => { expect(() => service.submitRegistration({ ...flow, imeis: [{ slot: 3, value: imei1 }] })).toThrow(); expect((await counts()).imeis).toBe(0); });
  it('selección ajena falla', async () => { expect(() => service.submitRegistration({ ...flow, selectedImeis: ['353333333333333'] })).toThrow(); expect((await counts()).clients).toBe(0); });
  it('criterio completo: parcial, búsqueda segundo, posterior y sin duplicados', async () => {
    const first = await service.submitRegistration(flow); expect(first.registrationStatus).toBe('PARTIALLY_REGISTERED'); expect(first.imeis[1].registrationStatus).toBe('NOT_REGISTERED');
    const found = await service.findEquipmentByImei(imei2); expect(found?.id).toBe(first.id); expect(found?.ownerId).toBe(first.ownerId);
    const second = await service.submitRegistration({ ...flow, imeis: [{ slot: 1, value: imei2 }], selectedImeis: [imei2], expectedEquipmentId: first.id }); expect(second.registrationStatus).toBe('REGISTERED');
    const total = await counts(); expect(total).toMatchObject({ clients: 1, equipment: 1, imeis: 2, sales: 0 });
    const history = await service.getEquipmentHistory(first.id); expect(history.filter(e => e.eventType === 'IMEI_REGISTERED').map(e => e.imeiId).sort()).toEqual(first.imeis.map(i => i.id).sort()); expect(history.filter(e => e.eventType === 'IMEI_REGISTRATION_STARTED')).toHaveLength(2);
  });
  it('cliente existente + nuevo equipo conserva contactos', async () => { const owner = await service.createClient({ ...client, phone: '999999999' }); const result = await service.submitRegistration(flow); expect(result.ownerId).toBe(owner.id); expect(result.owner?.phone).toBe('999999999'); expect(await db.client.count()).toBe(1); });
  it('equipo existente reutilizado y repetición sin historial duplicado', async () => { const first = await service.submitRegistration(flow); const before = await counts(); const second = await service.submitRegistration({ ...flow, expectedEquipmentId: first.id }); expect(second.id).toBe(first.id); expect(await counts()).toEqual(before); });
  it('preflight comprueba ambos IMEIs y no escribe', async () => { const before = await counts(); expect((await service.resolveRegistration({ dni: client.dni, imeis: external.imeis })).kind).toBe('NEW'); expect(await counts()).toEqual(before); });
  it('IMEIs de equipos distintos bloqueados', async () => { await service.createExternalEquipment({ ...external, imeis: external.imeis.slice(0, 1) }); await service.createExternalEquipment({ ...external, imeis: [{ slot: 1, value: imei2 }] }); const before = await counts(); await expect(service.resolveRegistration({ dni: client.dni, imeis: external.imeis })).rejects.toMatchObject({ code: 'IMEI_EQUIPMENT_CONFLICT' }); expect(await counts()).toEqual(before); });
  it('propietario diferente bloquea sin crear cliente', async () => { await service.submitRegistration(flow); const before = await counts(); await expect(service.submitRegistration({ ...flow, client: { ...client, dni: '87654321' } })).rejects.toMatchObject({ code: 'OWNER_MISMATCH' }); expect(await counts()).toEqual(before); });
  it('ownerId manipulado bloquea incluso dentro de registro', async () => { const result = await service.submitRegistration(flow); await expect(service.submitRegistration({ ...flow, registration: { status: 'REJECTED', ownerId: '00000000-0000-4000-8000-000000000001' } })).rejects.toMatchObject({ code: 'OWNER_MISMATCH' }); expect((await service.getEquipmentById(result.id)).imeis[0].registrationStatus).toBe('REGISTERED'); });
  it('registro individual protege ownerId', async () => { await service.submitRegistration(flow); await expect(service.updateImeiRegistrationStatus(imei2, { status: 'REGISTERED', ownerId: '00000000-0000-4000-8000-000000000001' })).rejects.toMatchObject({ code: 'OWNER_MISMATCH' }); });
  it('legacy protege DNI del propietario', async () => { await service.submitRegistration(flow); await expect(service.registerExternalImei({ value: imei2, registration: { status: 'REGISTERED' }, newEquipment: { ...external, client: { ...client, dni: '87654321' } } })).rejects.toMatchObject({ code: 'OWNER_MISMATCH' }); });
  it('IMEI conocido más nuevo exige confirmación', async () => { const first = await service.submitRegistration({ ...flow, imeis: external.imeis.slice(0, 1) }); const before = await counts(); const resolved = await service.resolveRegistration({ dni: client.dni, imeis: external.imeis }); expect(resolved.requiresConfirmation).toBe(true); await expect(service.submitRegistration({ ...flow, expectedEquipmentId: first.id })).rejects.toMatchObject({ code: 'IMEI_ASSOCIATION_CONFIRMATION_REQUIRED' }); expect(await counts()).toEqual(before); });
  it('confirmación agrega slot disponible al mismo equipo', async () => { const first = await service.submitRegistration({ ...flow, imeis: external.imeis.slice(0, 1) }); const second = await service.submitRegistration({ ...flow, selectedImeis: [imei2], expectedEquipmentId: first.id, confirmAddImei: true }); expect(second.id).toBe(first.id); expect(second.registrationStatus).toBe('REGISTERED'); expect(await db.equipment.count()).toBe(1); expect(second.imeis).toHaveLength(2); });
  it('slot ocupado no se sobrescribe', async () => { await service.submitRegistration(flow); await expect(service.resolveRegistration({ dni: client.dni, imeis: [{ slot: 1, value: imei1 }, { slot: 2, value: '353333333333333' }] })).rejects.toMatchObject({ code: 'IMEI_SLOT_OCCUPIED' }); expect(await db.imei.count()).toBe(2); });
  it('equipo esperado equivocado falla', async () => { await service.submitRegistration(flow); await expect(service.submitRegistration({ ...flow, expectedEquipmentId: '00000000-0000-4000-8000-000000000001' })).rejects.toMatchObject({ code: 'IMEI_EQUIPMENT_CONFLICT' }); });
  it('rollback completo por FK actor inexistente', async () => { const before = await counts(); await expect(service.submitRegistration({ ...flow, registration: { status: 'REGISTERED', userId: '00000000-0000-4000-8000-000000000001' } })).rejects.toBeDefined(); expect(await counts()).toEqual(before); });
  it('concurrencia de registro no crea duplicados', async () => { const result = await Promise.allSettled([service.submitRegistration(flow), service.submitRegistration(flow)]); expect(result.some(r => r.status === 'fulfilled')).toBe(true); expect(await counts()).toMatchObject({ clients: 1, equipment: 1, imeis: 2, sales: 0 }); expect(await db.equipmentHistory.count({ where: { eventType: 'IMEI_REGISTERED' } })).toBe(1); });
  it('historial creado, propietario, IMEI y rechazo inicial', async () => { const result = await service.submitRegistration({ ...flow, registration: { status: 'REJECTED' } }); const events = (await service.getEquipmentHistory(result.id)).map(e => e.eventType); expect(events).toContain('EQUIPMENT_CREATED'); expect(events).toContain('OWNER_ASSIGNED'); expect(events.filter(e => e === 'IMEI_ADDED')).toHaveLength(2); expect(events).toContain('IMEI_REGISTRATION_STARTED'); expect(events).toContain('IMEI_REGISTRATION_REJECTED'); });
  it.each(['NOT_REGISTERED', 'PENDING', 'PROCESSING', 'REGISTERED', 'REJECTED', 'CANCELLED'])('conserva estado %s', async status => { const result = await service.submitRegistration({ ...flow, registration: { status } }); expect(result.imeis[0].registrationStatus).toBe(status); expect(result.imeis[1].registrationStatus).toBe('NOT_REGISTERED'); });
  it('método se puede limpiar sin alterar segundo IMEI', async () => { await service.submitRegistration({ ...flow, registration: { status: 'REGISTERED', method: 'MOVISTAR' } }); const result = await service.updateImeiRegistrationStatus(imei1, { status: 'REGISTERED', method: null }); expect(result.imeis[0].registrationMethod).toBeNull(); expect(result.imeis[1].registrationStatus).toBe('NOT_REGISTERED'); });
});
describe('PostgreSQL real: reglas comerciales', () => {
  it('Phase 2 HTTP: errores únicos y ausentes con códigos concretos', async () => {
    const previous = process.env.API_ACCESS_TOKEN; const token = 'phase-two-local-integration-token-32chars'; process.env.API_ACCESS_TOKEN = token;
    try {
      const app = createApp(db); const auth = `Bearer ${token}`; const equipment = await service.submitRegistration(flow);
      const duplicate = await request(app).post('/api/clients').set('Authorization', auth).send(client); expect(duplicate.status).toBe(409); expect(duplicate.body.error.code).toBe('CLIENT_DNI_EXISTS');
      const duplicateImei = await request(app).post('/api/equipment/external').set('Authorization', auth).send(external); expect(duplicateImei.status).toBe(409); expect(duplicateImei.body.error.code).toBe('IMEI_ALREADY_EXISTS');
      const missing = '00000000-0000-4000-8000-000000000001';
      for (const [path, code] of [[`/api/clients/${missing}`, 'CLIENT_NOT_FOUND'], [`/api/equipment/${missing}`, 'EQUIPMENT_NOT_FOUND'], ['/api/equipment/by-imei/353333333333333', 'IMEI_NOT_FOUND']]) { const response = await request(app).get(path).set('Authorization', auth); expect(response.status).toBe(404); expect(response.body.error.code).toBe(code); expect(response.headers['cache-control']).toBe('no-store'); }
      const mismatch = await request(app).post('/api/registrations').set('Authorization', auth).send({ ...flow, client: { ...client, dni: '87654321' } }); expect(mismatch.status).toBe(409); expect(mismatch.body.error.code).toBe('OWNER_MISMATCH');
      const edited = await request(app).patch(`/api/equipment/${equipment.id}`).set('Authorization', auth).send({ brand: 'Samsung', model: 'S25', serialNumber: null }); expect(edited.status).toBe(200); expect(edited.body.ownerId).toBe(equipment.ownerId);
    } finally { if (previous === undefined) delete process.env.API_ACCESS_TOKEN; else process.env.API_ACCESS_TOKEN = previous; }
  });
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
    const result = await service.registerExternalImei({ value: imei1, registration: { status: 'REGISTERED' }, newEquipment: external });
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
