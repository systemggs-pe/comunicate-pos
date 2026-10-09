import 'dotenv/config';
import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { mkdir } from 'node:fs/promises';
import { seedTestAdmin, testEmail, testPassword } from '../helpers/auth';

const url = process.env.TEST_DATABASE_URL!;
const target = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.pathname !== '/communicate_pos_test') throw new Error('Sólo DB local de prueba');
const db = new PrismaClient({ datasources: { db: { url } } });
test.beforeEach(async ({ page }) => {
  await db.$transaction([db.session.deleteMany(), db.authRateLimit.deleteMany(), db.registrationRequestHistory.deleteMany(), db.registrationRequest.deleteMany(), db.registrationOperation.deleteMany(), db.saleAccessory.deleteMany(), db.equipmentHistory.deleteMany(), db.auditLog.deleteMany(), db.saleEquipment.deleteMany(), db.sale.deleteMany(), db.imei.deleteMany(), db.equipment.deleteMany(), db.client.deleteMany(), db.user.deleteMany()]);
  await seedTestAdmin(db); await mkdir('.test-results/phase-5-dni', { recursive: true });
  await page.goto('/login'); await page.getByLabel('Correo', { exact: true }).fill(testEmail); await page.getByLabel('Contraseña', { exact: true }).fill(testPassword);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Registro de equipos', exact: true })).toBeVisible();
});
test.afterAll(() => db.$disconnect());
async function openDraft(page: Page, path: string) {
  await page.goto(path);
  if (path === '/ventas/nueva') await page.getByRole('button', { name: 'Crear comprador nuevo', exact: true }).click();
  return page.locator('.dni-client-fields').first();
}
async function completeRegistration(page: Page, imei: string) {
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('IMEI 1', { exact: false }).first().fill(imei);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Marca', { exact: true }).fill('Honor'); await page.getByLabel('Modelo', { exact: true }).fill('DNI Fixture');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Honor DNI Fixture', exact: true })).toBeVisible();
}
test('A: cliente externo editable, sin alta anticipada, contacto manual y confirmación', async ({ page }) => {
  const fields = await openDraft(page, '/clientes/nuevo'); await fields.getByLabel('DNI', { exact: false }).fill('12345678');
  await expect(fields.getByLabel('Nombres', { exact: true })).toHaveValue('Ana María'); await expect(fields.getByLabel('Apellidos', { exact: true })).toHaveValue('Muñoz Álvarez');
  expect(await db.client.count()).toBe(0); await expect(fields.getByLabel('Celular', { exact: false })).toHaveValue(''); await expect(fields.getByLabel('Correo', { exact: false })).toHaveValue('');
  await fields.getByLabel('Nombres', { exact: true }).fill('Ana María revisada'); await fields.getByLabel('Celular', { exact: false }).fill('999111222'); await fields.getByLabel('Correo', { exact: false }).fill('dni-fixture@example.test');
  await page.getByRole('button', { name: 'Crear cliente', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Ana María revisada Muñoz Álvarez', exact: true })).toBeVisible();
  expect(await db.client.count()).toBe(1); expect(await db.auditLog.count({ where: { action: 'CLIENT_CREATED' } })).toBe(1);
});
test('B: local tiene prioridad y Usar cliente no duplica', async ({ page }) => {
  const client = await db.client.create({ data: { dni: '12345678', firstName: 'Nombre corregido', lastName: 'Local', phone: '999111222' } });
  const fields = await openDraft(page, '/clientes/nuevo'); const response = page.waitForResponse(res => res.url().endsWith('/api/dni/12345678'));
  await fields.getByLabel('DNI', { exact: false }).fill('12345678'); expect((await (await response).json()).source).toBe('LOCAL');
  await expect(fields.getByText('Cliente encontrado', { exact: true })).toBeVisible(); await expect(fields.getByLabel('Nombres', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Usar cliente', exact: true }).click(); await expect(page).toHaveURL(new RegExp(`/clientes/${client.id}`)); expect(await db.client.count()).toBe(1);
});
test('C: provider caído permite crear cliente manual', async ({ page }) => {
  const fields = await openDraft(page, '/clientes/nuevo'); await fields.getByLabel('DNI', { exact: false }).fill('99999999');
  await expect(fields.getByText('No pudimos consultar el DNI', { exact: false })).toBeVisible(); await fields.getByLabel('Nombres', { exact: true }).fill('Manual'); await fields.getByLabel('Apellidos', { exact: true }).fill('Pérez');
  await page.getByRole('button', { name: 'Crear cliente', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Manual Pérez', exact: true })).toBeVisible(); expect(await db.client.count()).toBe(1);
});
test('criterio principal: registro por DNI externo, contactos, equipo/IMEI y posterior reutilización local', async ({ page }) => {
  const fields = await openDraft(page, '/registros/nuevo'); await fields.getByLabel('DNI', { exact: false }).fill('12345678');
  await expect(fields.getByLabel('Nombres', { exact: true })).toHaveValue('Ana María'); await fields.getByLabel('Celular', { exact: false }).fill('999111222'); await fields.getByLabel('Correo', { exact: false }).fill('registration-fixture@example.test');
  expect(await db.client.count()).toBe(0); await completeRegistration(page, '359123456780001');
  const client = await db.client.findUniqueOrThrow({ where: { dni: '12345678' } }); expect(client.phone).toBe('999111222'); expect(client.email).toBe('registration-fixture@example.test');
  expect(await db.equipment.count()).toBe(1); expect(await db.imei.count()).toBe(1);
  const repeated = await openDraft(page, '/registros/nuevo'); const response = page.waitForResponse(res => res.url().endsWith('/api/dni/12345678'));
  await repeated.getByLabel('DNI', { exact: false }).fill('12345678'); expect((await (await response).json()).source).toBe('LOCAL');
  await expect(repeated.getByText('Cliente encontrado', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('IMEI 1', { exact: false }).first().fill('359123456780001'); await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Equipo encontrado:', { exact: false })).toBeVisible(); await page.getByRole('button', { name: 'Continuar', exact: true }).click(); await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Honor DNI Fixture', exact: true })).toBeVisible(); expect(await db.client.count()).toBe(1); expect(await db.equipment.count()).toBe(1);
});
test('registro manual funciona con provider caído', async ({ page }) => {
  const fields = await openDraft(page, '/registros/nuevo'); await fields.getByLabel('DNI', { exact: false }).fill('99999999');
  await expect(fields.getByText('No pudimos consultar el DNI', { exact: false })).toBeVisible(); await fields.getByLabel('Nombres', { exact: true }).fill('Manual'); await fields.getByLabel('Apellidos', { exact: true }).fill('Registro');
  await completeRegistration(page, '359999999990001'); expect(await db.client.count()).toBe(1); expect(await db.imei.count()).toBe(1);
});
test('ventas reutiliza consulta para comprador nuevo y propietario diferente', async ({ page }) => {
  const buyer = await openDraft(page, '/ventas/nueva'); await buyer.getByLabel('DNI', { exact: false }).fill('12345678'); await expect(buyer.getByLabel('Nombres', { exact: true })).toHaveValue('Ana María');
  const item = page.getByTestId('sale-item-0'); await item.getByLabel('Marca', { exact: true }).fill('Xiaomi'); await item.getByLabel('Modelo', { exact: true }).fill('DNI Venta'); await item.getByLabel('IMEI 1 del equipo 1', { exact: true }).fill('359123456780001'); await item.getByLabel('Precio del equipo 1 (S/)', { exact: true }).fill('1000');
  await item.getByLabel('Propietario distinto del comprador para equipo 1').check(); await item.getByRole('button', { name: 'Crear propietario del equipo 1 nuevo', exact: true }).click();
  const owner = item.locator('.dni-client-fields'); await owner.getByLabel('DNI', { exact: false }).fill('12345679'); await expect(owner.getByLabel('Nombres', { exact: true })).toHaveValue('Luis Andrés');
  expect(await db.client.count()).toBe(0); await page.getByRole('button', { name: 'Revisar venta', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Resumen de venta', exact: true })).toBeVisible(); expect(await db.client.count()).toBe(0);
  await page.getByRole('button', { name: 'Confirmar venta', exact: true }).click(); await expect(page.getByText('Venta registrada correctamente.', { exact: false })).toBeVisible();
  const sale = await db.sale.findFirstOrThrow({ include: { equipment: { include: { equipment: true } } } }); expect(sale.buyerId).not.toBe(sale.equipment[0].equipment.ownerId); expect(await db.client.count()).toBe(2);
});
test('venta manual sigue operativa ante caída del provider', async ({ page }) => {
  const buyer = await openDraft(page, '/ventas/nueva'); await buyer.getByLabel('DNI', { exact: false }).fill('99999999'); await expect(buyer.getByText('No pudimos consultar el DNI', { exact: false })).toBeVisible();
  await buyer.getByLabel('Nombres', { exact: true }).fill('Manual'); await buyer.getByLabel('Apellidos', { exact: true }).fill('Venta');
  const item = page.getByTestId('sale-item-0'); await item.getByLabel('Marca', { exact: true }).fill('Apple'); await item.getByLabel('Modelo', { exact: true }).fill('iPhone'); await item.getByLabel('IMEI 1 del equipo 1', { exact: true }).fill('359999999990001'); await item.getByLabel('Precio del equipo 1 (S/)', { exact: true }).fill('1000');
  await page.getByRole('button', { name: 'Revisar venta', exact: true }).click(); await page.getByRole('button', { name: 'Confirmar venta', exact: true }).click(); await expect(page.getByText('Venta registrada correctamente.', { exact: false })).toBeVisible(); expect(await db.client.count()).toBe(1);
});
test('consulta tardía no sobrescribe correcciones manuales ni datos de otro DNI', async ({ page }) => {
  await page.route('**/api/dni/*', async route => { await new Promise(resolve => setTimeout(resolve, 600)); await route.continue().catch(() => {}); });
  const fields = await openDraft(page, '/clientes/nuevo'); await fields.getByLabel('DNI', { exact: false }).fill('12345678'); await expect(fields.getByText('Consultando DNI...', { exact: true })).toBeVisible();
  await fields.getByLabel('Nombres', { exact: true }).fill('Corrección manual'); await expect(fields.getByText('Datos encontrados.', { exact: false })).toBeVisible(); await expect(fields.getByLabel('Nombres', { exact: true })).toHaveValue('Corrección manual');
  await fields.getByLabel('DNI', { exact: false }).fill('12345679'); await expect(fields.getByText('Consultando DNI...', { exact: true })).toBeVisible(); await fields.getByLabel('DNI', { exact: false }).fill('12345680');
  await expect(fields.getByLabel('Nombres', { exact: true })).toHaveValue('Lucía Elena'); await expect(fields.getByLabel('Apellidos', { exact: true })).toHaveValue('Peña del Río');
});
test('DNI compartido responsive: loading, autofill y fallback en los tres formularios', async ({ page }) => {
  await page.route('**/api/dni/*', async route => { await new Promise(resolve => setTimeout(resolve, 800)); await route.continue().catch(() => {}); });
  for (const width of [1280, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [['clients', '/clientes/nuevo'], ['registrations', '/registros/nuevo'], ['sales', '/ventas/nueva']]) {
      const fields = await openDraft(page, path); await fields.getByLabel('DNI', { exact: false }).fill('12345678'); await expect(fields.getByText('Consultando DNI...', { exact: true })).toBeVisible();
      await page.screenshot({ path: `.test-results/phase-5-dni/${width}-${name}-loading.png`, fullPage: true });
      await expect(fields.getByLabel('Nombres', { exact: true })).toHaveValue('Ana María'); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `.test-results/phase-5-dni/${width}-${name}-autofill.png`, fullPage: true });
      await fields.getByLabel('DNI', { exact: false }).fill('99999999'); await expect(fields.getByText('No pudimos consultar el DNI', { exact: false })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await page.screenshot({ path: `.test-results/phase-5-dni/${width}-${name}-fallback.png`, fullPage: true });
    }
  }
  expect(await db.client.count()).toBe(0);
});
