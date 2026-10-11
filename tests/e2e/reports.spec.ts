import 'dotenv/config';
import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { mkdir, readFile } from 'node:fs/promises';
import { seedTestAdmin, testEmail, testPassword } from '../helpers/auth';
import { clearEvidenceFixtures } from '../helpers/evidence';
import { permissionKeys, adminPermissions, sellerPermissions } from '../../shared/auth';
import { workflowInput } from '../helpers/workflow';
const url = process.env.TEST_DATABASE_URL!, target = new URL(url);
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/communicate_pos_test') throw new Error('DB TEST DEDICADA REQUERIDA');
const db = new PrismaClient({ datasources: { db: { url } } });
test.beforeEach(async ({ page }) => {
  await clearEvidenceFixtures(db);
  await db.$transaction([db.session.deleteMany(), db.authRateLimit.deleteMany(), db.registrationRequestHistory.deleteMany(), db.registrationRequest.deleteMany(), db.registrationOperation.deleteMany(), db.saleAccessory.deleteMany(), db.equipmentHistory.deleteMany(), db.auditLog.deleteMany(), db.saleEquipment.deleteMany(), db.sale.deleteMany(), db.imei.deleteMany(), db.equipment.deleteMany(), db.client.deleteMany(), db.user.deleteMany()]);
  for (const [code, permissions] of [['SUPERADMIN', permissionKeys], ['ADMIN', adminPermissions], ['SELLER', sellerPermissions]] as const) {
    const role = await db.role.findUniqueOrThrow({ where: { code } }); await db.rolePermission.deleteMany({ where: { roleId: role.id } }); await db.rolePermission.createMany({ data: permissions.map(permissionKey => ({ roleId: role.id, permissionKey })) });
  }
  await seedTestAdmin(db); await mkdir('.test-results/reports', { recursive: true }); await login(page);
});
test.afterAll(async () => {
  for (const [code, permissions] of [['SUPERADMIN', permissionKeys], ['ADMIN', adminPermissions], ['SELLER', sellerPermissions]] as const) {
    const role = await db.role.findUniqueOrThrow({ where: { code } }); await db.rolePermission.deleteMany({ where: { roleId: role.id } }); await db.rolePermission.createMany({ data: permissions.map(permissionKey => ({ roleId: role.id, permissionKey })) });
  }
  await db.$disconnect();
});
async function login(page: Page, email = testEmail) {
  await page.goto('/login'); await page.getByLabel('Correo', { exact: true }).fill(email); await page.getByLabel('Contraseña', { exact: true }).fill(testPassword); await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Registro de equipos', exact: true })).toBeVisible();
}
async function reg(page: Page) {
  const input = workflowInput(); const response = await page.request.post('/api/registration-operations', { headers: { Origin: 'http://127.0.0.1:5175' }, data: { ...input, requests: input.requests.map(r => ({ ...r, operator: 'BITEL', price: '0.10' })) } }); expect(response.status()).toBe(201); return await response.json() as { requests: { id: string; code: string }[] };
}
async function visual(page: Page, name: string) {
  for (const width of [1280, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 900 }); await expect(page.locator('.analytics-workspace .loading')).toHaveCount(0); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await page.screenshot({ path: `.test-results/reports/${width}-${name}.png`, fullPage: true });
  }
}
test('A SUPERADMIN: mes, últimos siete días, actualizar y responsive vacío', async ({ page }) => {
  await expect(page.getByTestId('metric-salesRevenue')).toContainText('S/ 0.00'); await expect(page.getByLabel('PERIODO', { exact: true })).toHaveValue('month'); await page.getByLabel('PERIODO', { exact: true }).selectOption('last7'); await expect(page.getByTestId('metric-salesCount')).toContainText('0'); await page.getByRole('button', { name: 'ACTUALIZAR DATOS' }).click(); await expect(page.getByTestId('metric-registrationCount')).toContainText('0'); await visual(page, 'dashboard-empty');
});
test('B REGISTROS: BITEL registrado, CSV descargado con filtros y totales', async ({ page }) => {
  const row = await reg(page); const response = await page.request.post(`/api/registration-requests/${row.requests[0].id}/transition`, { headers: { Origin: 'http://127.0.0.1:5175' }, data: { action: 'MARK_REGISTERED', confirm: true, reason: 'Prueba E2E' } }); expect(response.status()).toBe(200);
  await page.goto('/reportes?type=registrations'); await page.getByLabel('OPERADOR', { exact: true }).selectOption('BITEL'); await page.getByLabel('ESTADO', { exact: true }).selectOption('REGISTERED'); await expect(page.getByTestId('metric-registrationCount')).toContainText('1');
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'EXPORTAR CSV' }).click(); const file = await downloaded; const path = `.test-results/reports/${file.suggestedFilename()}`; await file.saveAs(path); const csv = await readFile(path, 'utf8'); expect(csv.charCodeAt(0)).toBe(0xfeff); expect(csv).toContain(row.requests[0].code); expect(csv).not.toContain(row.requests[1].code); expect(csv).toContain('0.10'); expect(csv).not.toContain('70876543'); await visual(page, 'registrations-filtered');
});
test('C SELLER: menú oculto y URL/API protegidas', async ({ page }) => {
  const role = await db.role.findUniqueOrThrow({ where: { code: 'SELLER' } }); const response = await page.request.post('/api/users', { headers: { Origin: 'http://127.0.0.1:5175' }, data: { name: 'VENDEDOR REPORTES', email: 'e2e-reports-seller@example.test', password: testPassword, roleId: role.id, status: 'ACTIVE' } }); expect(response.status()).toBe(201);
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click(); await login(page, 'e2e-reports-seller@example.test'); await expect(page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'REPORTES', exact: true })).toHaveCount(0); await expect(page.getByTestId('metric-salesRevenue')).toHaveCount(0); await page.goto('/reportes'); await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible(); expect((await page.request.get('/api/reports/sales')).status()).toBe(403); expect((await page.request.get('/api/dashboard')).status()).toBe(403);
});
test('D doble IMEI: dos RECO y un equipo con gráficos reales', async ({ page }) => {
  await reg(page); await page.goto('/dashboard'); await expect(page.getByTestId('metric-registrationCount')).toContainText('2'); await expect(page.getByTestId('metric-registrationAmount')).toContainText('S/ 0.20'); await visual(page, 'dashboard-data'); await page.goto('/reportes?type=equipment'); await expect(page.getByTestId('metric-equipmentCount')).toContainText('1'); await expect(page.getByTestId('metric-doubleImei')).toContainText('1'); await visual(page, 'equipment');
});
test('E venta con dos equipos: reportes se actualizan después de eliminación por UI', async ({ page }) => {
  const input = workflowInput(); const response = await page.request.post('/api/sales', { headers: { Origin: 'http://127.0.0.1:5175' }, data: { buyer: { client: input.client }, items: [{ equipment: { ...input.equipment, imeis: input.imeis }, unitPrice: '100.10' }, { equipment: { ...input.equipment, imeis: [{ slot: 1, value: '359708765430003' }] }, unitPrice: '50.20' }], paymentMethod: 'YAPE' } }); expect(response.status()).toBe(201); const sale = await response.json() as { id: string; code: string };
  await page.goto('/reportes?type=sales'); await expect(page.getByTestId('metric-salesRevenue')).toContainText('S/ 150.30'); await expect(page.getByTestId('metric-salesCount')).toContainText('1'); await expect(page.getByTestId('metric-equipmentSold')).toContainText('2'); await visual(page, 'sales');
  await page.goto(`/ventas/${sale.id}`); await page.getByRole('button', { name: `ELIMINAR DEFINITIVAMENTE ${sale.code}`, exact: true }).click(); await page.getByLabel('MOTIVO DE ELIMINACIÓN', { exact: true }).fill('Prueba reportes'); await page.getByLabel('ESCRIBE ELIMINAR', { exact: true }).fill('ELIMINAR'); await page.getByRole('button', { name: 'CONFIRMAR ELIMINACIÓN DEFINITIVA' }).click(); await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible(); await page.goto('/reportes?type=sales'); await expect(page.getByTestId('metric-salesRevenue')).toContainText('S/ 0.00'); await expect(page.getByTestId('metric-salesCount')).toContainText('0'); expect(await db.client.count()).toBe(1);
});
test('F personalizados: filtros persisten al cambiar pestaña y navegar atrás', async ({ page }) => {
  await reg(page); await page.goto('/reportes?type=registrations'); await page.getByLabel('PERIODO', { exact: true }).selectOption('custom'); await page.getByLabel('FECHA INICIAL', { exact: true }).fill('2026-10-09'); await page.getByLabel('FECHA FINAL', { exact: true }).fill('2026-10-09'); await expect(page.getByTestId('metric-registrationCount')).toContainText('2');
  await page.getByRole('navigation', { name: 'TIPO DE REPORTE' }).getByRole('button', { name: 'CLIENTES', exact: true }).click(); await expect(page.getByTestId('metric-registrationClients')).toContainText('1'); await expect(page.getByLabel('FECHA INICIAL', { exact: true })).toHaveValue('2026-10-09'); await page.goBack(); await expect(page.getByTestId('metric-registrationCount')).toContainText('2'); await expect(page.getByLabel('FECHA FINAL', { exact: true })).toHaveValue('2026-10-09');
});
test('G clientes y trabajadores inactivos: identidad mínima y responsive', async ({ page }) => {
  await reg(page); const inactive = await db.user.create({ data: { name: 'TRABAJADOR HISTÓRICO', email: 'inactive@example.test', status: 'DISABLED', roleId: (await db.role.findUniqueOrThrow({ where: { code: 'SELLER' } })).id } }); await db.registrationRequest.updateMany({ data: { createdById: inactive.id } });
  await page.goto('/reportes?type=clients'); await expect(page.getByTestId('metric-totalClients')).toContainText('1'); await expect(page.locator('.report-table-scroll')).not.toContainText('70876543'); await visual(page, 'clients');
  await page.goto('/reportes?type=users'); await expect(page.getByLabel('TRABAJADOR', { exact: true }).getByRole('option', { name: /TRABAJADOR HISTÓRICO/ })).toHaveCount(1); await page.getByLabel('TRABAJADOR', { exact: true }).selectOption(inactive.id); await expect(page.getByTestId('metric-requestsCreated')).toContainText('2'); await expect(page.getByTestId('metric-registrationAmount')).toContainText('S/ 0.20'); await expect(page.locator('.report-table-scroll')).toContainText('DESACTIVADO'); await visual(page, 'users');
});
test('H permisos de reportes se conceden explícitamente desde la matriz de roles', async ({ page }) => {
  const role = await db.role.findUniqueOrThrow({ where: { code: 'ADMIN' } }); const created = await page.request.post('/api/users', { headers: { Origin: 'http://127.0.0.1:5175' }, data: { name: 'ADMIN REPORTES', email: 'e2e-authorized-reports@example.test', password: testPassword, roleId: role.id, status: 'ACTIVE' } }); expect(created.status()).toBe(201);
  await page.goto('/roles'); const editor = page.locator('form').filter({ has: page.getByRole('heading', { name: 'ADMIN', exact: true }) }); const reports = editor.locator('section').filter({ has: page.getByRole('heading', { name: 'Reportes', exact: true }) }); await expect(reports.getByLabel('Consultar', { exact: true })).not.toBeChecked(); await expect(reports.getByLabel('Exportar CSV', { exact: true })).not.toBeChecked(); await reports.getByLabel('Consultar', { exact: true }).check(); await reports.getByLabel('Exportar CSV', { exact: true }).check(); await editor.getByLabel('Confirmo actualizar permisos y cerrar las sesiones de este rol').check(); await editor.getByRole('button', { name: 'Guardar permisos', exact: true }).click(); await expect(page.getByText('Permisos guardados. Las sesiones de este rol fueron invalidadas.', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click(); await login(page, 'e2e-authorized-reports@example.test'); await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'REPORTES', exact: true }).click(); await expect(page.getByRole('button', { name: 'EXPORTAR CSV' })).toBeEnabled();
});
