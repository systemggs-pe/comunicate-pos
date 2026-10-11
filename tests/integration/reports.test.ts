import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { beforeEach, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { createReportsService } from '../../server/services/reports.service';
import { createPosService } from '../../server/services/pos.service';
import { seedTestAdmin, loginAgent, testEmail, testPassword, testOrigin } from '../helpers/auth';
import { workflowInput } from '../helpers/workflow';
import { permissionKeys, adminPermissions, sellerPermissions } from '../../shared/auth';
import { clearEvidenceFixtures } from '../helpers/evidence';
const url = process.env.TEST_DATABASE_URL!, target = new URL(url);
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/communicate_pos_test') throw new Error('DB DEDICADA REQUERIDA');
const db = new PrismaClient({ datasources: { db: { url } } }), app = createApp(db), reports = createReportsService(db);
let agent: Awaited<ReturnType<typeof loginAgent>>, actor: string;
const range = { preset: 'custom', from: '2026-10-01', to: '2026-10-31' };
beforeEach(async () => {
  await clearEvidenceFixtures(db);
  await db.$transaction([db.session.deleteMany(), db.authRateLimit.deleteMany(), db.registrationRequestHistory.deleteMany(), db.registrationRequest.deleteMany(), db.registrationOperation.deleteMany(), db.saleAccessory.deleteMany(), db.equipmentHistory.deleteMany(), db.auditLog.deleteMany(), db.saleEquipment.deleteMany(), db.sale.deleteMany(), db.imei.deleteMany(), db.equipment.deleteMany(), db.client.deleteMany(), db.user.deleteMany()]);
  for (const [code, permissions] of [['SUPERADMIN', permissionKeys], ['ADMIN', adminPermissions], ['SELLER', sellerPermissions]] as const) {
    const role = await db.role.findUniqueOrThrow({ where: { code } }); await db.rolePermission.deleteMany({ where: { roleId: role.id } }); await db.rolePermission.createMany({ data: permissions.map(permissionKey => ({ roleId: role.id, permissionKey })) });
  }
  await seedTestAdmin(db); agent = await loginAgent(app); actor = (await db.user.findUniqueOrThrow({ where: { email: testEmail } })).id;
});
afterAll(() => db.$disconnect());
async function sale(two = false, date = '2026-10-10T23:30:00-05:00') {
  const input = workflowInput();
  const result = await agent.post('/api/sales').set('Origin', testOrigin).send({ buyer: { client: input.client }, items: [{ equipment: { ...input.equipment, imeis: input.imeis }, unitPrice: '100.10' }, ...(two ? [{ equipment: { ...input.equipment, brand: 'Apple', imeis: [{ slot: 1, value: '359708765430003' }] }, unitPrice: '50.20' }] : [])], accessories: [{ name: 'CABLE', quantity: 2, unitPrice: '0.10' }], discount: '0.05', occurredAt: date, paymentMethod: 'YAPE' });
  expect(result.status, JSON.stringify(result.body)).toBe(201); return result.body as { id: string; code: string };
}
async function registration(blocked = false) {
  const input = workflowInput();
  const result = await agent.post('/api/registration-operations').set('Origin', testOrigin).send({ ...input, requests: input.requests.map((r, i) => ({ ...r, price: i ? '0.20' : '0.10', mode: blocked && i === 1 ? 'BLOCKED' : 'REGISTRATION', operator: i ? 'CLARO' : 'BITEL' })) });
  expect(result.status, JSON.stringify(result.body)).toBe(201); return result.body as { requests: { id: string; code: string }[] };
}
it('dashboard vacío: seis métricas cero, importes exactos y grupos vacíos reales', async () => {
  const data = await reports.read('general', range); expect(data.summary).toEqual({ salesCount: 0, salesRevenue: '0.00', equipmentSold: 0, registrationCount: 0, registrationAmount: '0.00', newClients: 0 }); expect(data.series).toHaveLength(31); expect(data.series.every(r => r.count === 0 && r.amount === '0.00')).toBe(true); expect(data.evolution).toEqual([]);
});
it('venta simple con dos IMEI y accesorios cuenta una vez sin duplicar total', async () => {
  await sale(); const data = await reports.read('general', range); expect(data.summary).toMatchObject({ salesCount: 1, salesRevenue: '100.25', equipmentSold: 1, newClients: 1 }); expect(data.series.find(r => r.date === '2026-10-10')).toMatchObject({ count: 1, amount: '100.25' });
});
it('venta con dos equipos: una venta, dos equipos, tres IMEI, total exacto', async () => {
  await sale(true); const data = await reports.read('general', range); expect(data.summary).toMatchObject({ salesCount: 1, salesRevenue: '150.45', equipmentSold: 2 }); expect(await db.imei.count()).toBe(3); const equipment = await reports.read('equipment', range); expect(equipment.summary).toMatchObject({ equipmentCount: 2, singleImei: 1, doubleImei: 1, imeiCount: 3 });
});
it('doble registro: un cliente, un equipo, dos solicitudes e importes 0.30', async () => {
  await registration(); expect((await reports.read('general', range)).summary).toMatchObject({ registrationCount: 2, registrationAmount: '0.30', newClients: 1 }); expect((await reports.read('equipment', range)).summary).toMatchObject({ equipmentCount: 1, doubleImei: 1, imeiCount: 2, externalEquipment: 1 }); expect((await reports.read('clients', range)).summary).toMatchObject({ totalClients: 1, registrationClients: 1, repeatClients: 0 });
});
it('un solo IMEI atendido cuenta una solicitud sin multiplicar equipos', async () => {
  const input = workflowInput(); input.requests = [input.requests[0]]; const result = await agent.post('/api/registration-operations').set('Origin', testOrigin).send(input); expect(result.status).toBe(201); expect((await reports.read('registrations', range)).summary.registrationCount).toBe(1); expect((await reports.read('equipment', range)).summary.equipmentCount).toBe(1);
});
it('estados pendientes bloqueados y registrados y porcentajes reales', async () => {
  const row = await registration(true); let data = await reports.read('registrations', range); expect(data.tables[0].rows).toEqual([{ name: 'BLOQUEADO', count: 1, percent: '50.00' }, { name: 'REGISTRO PENDIENTE', count: 1, percent: '50.00' }, { name: 'REGISTRADO', count: 0, percent: '0.00' }]);
  expect((await agent.post(`/api/registration-requests/${row.requests[0].id}/transition`).set('Origin', testOrigin).send({ action: 'MARK_REGISTERED', confirm: true, reason: 'Prueba' })).status).toBe(200);
  data = await reports.read('registrations', range); expect(data.tables[0].rows.find(r => r.name === 'REGISTRADO')?.count).toBe(1);
});
it('operador histórico de cada solicitud y filtros operador/estado', async () => {
  await registration(true); const data = await reports.read('registrations', { ...range, operator: 'CLARO', status: 'BLOCKED' }); expect(data.total).toBe(1); expect(data.summary.registrationAmount).toBe('0.20'); expect(data.rows[0]).toMatchObject({ operator: 'CLARO', status: 'BLOCKED' }); expect(data.tables[1].rows.find(r => r.name === 'CLARO')).toMatchObject({ count: 1, blocked: 1 });
});
it('creación septiembre y finalización octubre: fechas y actores independientes', async () => {
  const row = await registration(); const creator = await db.user.create({ data: { email: 'creator@example.test', name: 'CREADOR INACTIVO', status: 'DISABLED', roleId: (await db.role.findUniqueOrThrow({ where: { code: 'SELLER' } })).id } });
  await db.registrationRequest.updateMany({ data: { createdById: creator.id, createdAt: new Date('2026-09-15T12:00:00-05:00') } });
  expect((await agent.post(`/api/registration-requests/${row.requests[0].id}/transition`).set('Origin', testOrigin).send({ action: 'MARK_REGISTERED', confirm: true, reason: 'Prueba' })).status).toBe(200);
  const october = await reports.read('registrations', range); expect(october.evolution.some(r => Number(r.completed) === 1)).toBe(true); expect(october.evolution.every(r => r.created === 0)).toBe(true);
  const september = await reports.read('registrations', { ...range, from: '2026-09-01', to: '2026-09-30' }); expect(september.evolution[0]).toMatchObject({ created: 2, pending: 1, completed: 0 });
  const workers = await reports.read('users', range); expect(workers.rows.find(r => r.id === actor)).toMatchObject({ completed: 1, created: 0 }); expect(workers.rows.find(r => r.id === creator.id)).toMatchObject({ created: 0, completed: 0, serviceAmount: '0.30', status: 'DISABLED' });
  const sepWorkers = await reports.read('users', { ...range, from: '2026-09-01', to: '2026-09-30' }); expect(sepWorkers.rows.find(r => r.id === creator.id)?.created).toBe(2);
});
it('creador de venta atribuido con ingreso exacto y filtro trabajador', async () => {
  await sale(); const data = await reports.read('users', { ...range, userId: actor }); expect(data.total).toBe(1); expect(data.rows[0]).toMatchObject({ id: actor, sales: 1, amount: '100.25' }); expect((await reports.read('sales', { ...range, userId: actor })).total).toBe(1);
});
it('suma Decimal 0.10 + 0.20 sin error de redondeo', async () => { await registration(); const data = await reports.read('registrations', range); expect(data.summary.registrationAmount).toBe('0.30'); expect(data.labels.registrationAmount).toBe('IMPORTE REGISTRADO DE SERVICIOS'); });
it('agregados monetarios superan el límite de una fila sin overflow ni redondeo', async () => {
  const input = workflowInput();
  for (let index = 0; index < 2; index++) {
    const response = await agent.post('/api/sales').set('Origin', testOrigin).send({ buyer: { client: input.client }, items: [{ equipment: { ...input.equipment, imeis: [{ slot: 1, value: `35970876543000${index + 1}` }] }, unitPrice: '9000000000.11' }], paymentMethod: 'CASH', occurredAt: '2026-10-10T12:00:00-05:00' }); expect(response.status, JSON.stringify(response.body)).toBe(201);
  }
  expect((await reports.read('sales', range)).summary.salesRevenue).toBe('18000000000.22');
});
it.each([
  ['2026-10-01T04:59:59.999Z', 0], ['2026-10-01T05:00:00.000Z', 1], ['2026-11-01T04:59:59.999Z', 1], ['2026-11-01T05:00:00.000Z', 0],
])('límites Lima inicio incluido/final excluido %s', async (date, expected) => { await sale(false, date); expect((await reports.read('sales', range)).summary.salesCount).toBe(expected); });
it('23:30 Lima cuenta en día local, agrupación diaria semanal y mensual', async () => {
  await sale(); const daily = await reports.read('sales', { ...range, from: '2026-10-10', to: '2026-10-10' }); expect(daily.summary.salesCount).toBe(1); expect(daily.series[0]).toMatchObject({ date: '2026-10-10', amount: '100.25' });
  expect((await reports.read('sales', { ...range, group: 'week' })).series.find(r => r.count === 1)?.date).toBe('2026-10-05'); expect((await reports.read('sales', { ...range, group: 'month' })).series[0]).toMatchObject({ date: '2026-10-01', count: 1 });
});
it('cambio de año y último día completo', async () => { await sale(false, '2025-12-31T23:59:59-05:00'); expect((await reports.read('sales', { ...range, from: '2025-12-31', to: '2025-12-31' })).summary.salesCount).toBe(1); expect((await reports.read('sales', { ...range, from: '2026-01-01', to: '2026-01-01' })).summary.salesCount).toBe(0); });
it('eliminación autorizada borra totales series y filas y conserva cliente', async () => {
  const saved = await sale(true); const pos = createPosService(db, { userId: actor }); const preview = await pos.deletionPreview('sale', saved.id); await pos.deletePermanently('sale', saved.id, { confirm: 'ELIMINAR', fingerprint: preview.fingerprint, reason: 'Prueba de reportes' });
  const data = await reports.read('sales', range); expect(data.total).toBe(0); expect(data.summary).toMatchObject({ salesCount: 0, salesRevenue: '0.00', equipmentSold: 0 }); expect(data.series.every(r => r.count === 0)).toBe(true); expect((await reports.read('clients', range)).summary.totalClients).toBe(1);
});
it('clientes compras y registros no duplicados, DNI no se entrega', async () => {
  await registration(); const data = await reports.read('clients', range); expect(data.total).toBe(1); expect(data.rows[0]).toMatchObject({ requests: 2, purchases: 0 }); expect(JSON.stringify(data)).not.toContain('70876543');
});
it('compra más atención doble equivale a dos operaciones del cliente', async () => {
  await sale(); const input = workflowInput(); input.imeis = input.imeis.map((row, i) => ({ ...row, value: `35970876543001${i}` })); input.requests = input.requests.map((row, i) => ({ ...row, value: input.imeis[i].value })); expect((await agent.post('/api/registration-operations').set('Origin', testOrigin).send(input)).status).toBe(201); expect((await reports.read('clients', range)).summary).toMatchObject({ totalClients: 1, buyingClients: 1, registrationClients: 1, repeatClients: 1 });
});
it('marcas normalizadas agrupadas sin modificar nombres históricos', async () => {
  await sale(true); await db.equipment.updateMany({ where: { brand: 'SAMSUNG' }, data: { brand: '  samsung  ' } }); const data = await reports.read('equipment', { ...range, brand: 'SAMSUNG' }); expect(data.total).toBe(1); expect(data.tables[0].rows).toEqual([{ name: 'SAMSUNG', count: 1 }]); expect((await db.equipment.findFirstOrThrow({ where: { brand: '  samsung  ' } })).brand).toBe('  samsung  ');
});
it('método de pago real sin pagos ficticios de registros', async () => {
  await sale(); const data = await reports.read('sales', { ...range, paymentMethod: 'YAPE' }); expect(data.tables[0].rows.find(r => r.name === 'YAPE')).toMatchObject({ count: 1, amount: '100.25', percent: '100.00' }); expect((await reports.read('sales', { ...range, paymentMethod: 'CASH' })).summary.salesRevenue).toBe('0.00');
});
it('paginación conserva total y nunca devuelve todas las filas', async () => { await registration(); const data = await reports.read('registrations', { ...range, limit: 1, page: 2 }); expect(data.total).toBe(2); expect(data.rows).toHaveLength(1); expect((await reports.read('registrations', { ...range, limit: 1, page: 3 })).total).toBe(2); });
it('CSV exacto con filtros y auditoría mínima, consultas no auditan', async () => {
  await registration(true); const before = await db.auditLog.count(); await reports.read('general', range); expect(await db.auditLog.count()).toBe(before);
  const result = await agent.get('/api/reports/export').query({ type: 'registrations', ...range, operator: 'CLARO', status: 'BLOCKED' }); expect(result.status, result.text).toBe(200); expect(result.headers['content-type']).toContain('text/csv'); expect(result.text.charCodeAt(0)).toBe(0xfeff); expect(result.text).toContain('0.20'); expect(result.text).toContain('BLOQUEADO'); expect(result.text).not.toContain('70876543'); expect(result.text).not.toContain('fixture@example.test');
  const audit = await db.auditLog.findFirstOrThrow({ where: { action: 'REPORT_EXPORTED' } }); expect(audit.userId).toBe(actor); expect(audit.metadata).toMatchObject({ type: 'registrations', rowCount: 1 }); expect(JSON.stringify(audit.metadata)).not.toContain('RECO-');
});
it('CSV neutraliza fórmulas reales de un nombre de trabajador', async () => {
  await sale(); await db.user.update({ where: { id: actor }, data: { name: '=HYPERLINK("https://example.test","Á,Ñ")' } }); const result = await agent.get('/api/reports/export').query({ type: 'sales', ...range }); expect(result.status).toBe(200); expect(result.text).toContain('"\'=HYPERLINK(""HTTPS://EXAMPLE.TEST"",""Á,Ñ"")"');
});
it('exportación de más de 5000 filas se rechaza sin truncar ni auditar éxito', async () => {
  await db.client.createMany({ data: Array.from({ length: 5001 }, (_, index) => ({ dni: String(80000000 + index), firstName: 'PRUEBA', lastName: 'LÍMITE CSV', createdAt: new Date('2026-10-10T12:00:00-05:00') })) }); const result = await agent.get('/api/reports/export').query({ type: 'clients', ...range }); expect(result.status).toBe(413); expect(result.body.error.code).toBe('REPORT_EXPORT_LIMIT'); expect(await db.auditLog.count({ where: { action: 'REPORT_EXPORTED' } })).toBe(0); expect((await reports.read('clients', { ...range, limit: 25 })).rows).toHaveLength(25);
});
it.each(['/api/dashboard', '/api/dashboard/summary', '/api/reports/general', '/api/reports/sales', '/api/reports/registrations', '/api/reports/clients', '/api/reports/equipment', '/api/reports/users', '/api/reports/actors', '/api/reports/export?type=sales'])('401 sin sesión %s', async path => expect((await request(app).get(path)).status).toBe(401));
it('SELLER 403 en todo reporte y dashboard anterior, sin poder omitir autorización', async () => {
  const result = await agent.post('/api/users').set('Origin', testOrigin).send({ name: 'VENDEDOR', email: 'reports-seller@example.test', password: testPassword, status: 'ACTIVE', roleId: (await db.role.findUniqueOrThrow({ where: { code: 'SELLER' } })).id }); expect(result.status).toBe(201);
  const seller = await loginAgent(app, 'reports-seller@example.test'); for (const path of ['/api/dashboard', '/api/dashboard/summary', '/api/reports/sales', '/api/reports/export?type=sales']) expect((await seller.get(path)).status).toBe(403);
});
it('ADMIN habilitado explícitamente puede leer pero no exportar sin permiso adicional', async () => {
  const role = await db.role.findUniqueOrThrow({ where: { code: 'ADMIN' } }); await db.rolePermission.create({ data: { roleId: role.id, permissionKey: 'reports.read' } }); await agent.post('/api/users').set('Origin', testOrigin).send({ name: 'ADMIN REPORTES', email: 'reports-reader@example.test', password: testPassword, status: 'ACTIVE', roleId: role.id }); const reader = await loginAgent(app, 'reports-reader@example.test'); expect((await reader.get('/api/reports/sales')).status).toBe(200); expect((await reader.get('/api/reports/export?type=sales')).status).toBe(403);
});
it('400 fechas/enum/actor inválidos y brand SQL injection parametrizada', async () => {
  for (const query of [{ userId: "' OR TRUE --" }, { status: 'CANCELLED' }, { from: '2026-02-30', to: '2026-03-01' }, { createdById: actor }]) expect((await agent.get('/api/reports/registrations').query(query)).status).toBe(400);
  await sale(); const injection = await agent.get('/api/reports/sales').query({ ...range, brand: "' OR TRUE; DROP TABLE \"Sale\"; --" }); expect(injection.status).toBe(200); expect(injection.body.total).toBe(0); expect(await db.sale.count()).toBe(1);
});
it('respuestas no exponen sesiones credenciales fotos ni información de contacto', async () => {
  await registration(); for (const type of ['general', 'sales', 'registrations', 'clients', 'equipment', 'users']) { const result = await agent.get(`/api/reports/${type}`).query(range); expect(result.status, JSON.stringify(result.body)).toBe(200); const text = JSON.stringify(result.body); for (const field of ['passwordHash', 'tokenHash', 'storageKey', 'ownerSessionId', 'fixture@example.test', '70876543', '912345678']) expect(text).not.toContain(field); }
});
