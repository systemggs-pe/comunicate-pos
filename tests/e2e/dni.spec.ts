import {clearEvidenceFixtures} from '../helpers/evidence';
import {saveSale} from '../helpers/sale-form';
import 'dotenv/config';
import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { mkdir } from 'node:fs/promises';
import { seedTestAdmin, testEmail, testPassword } from '../helpers/auth';

const url = process.env.TEST_DATABASE_URL!;
const target = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.pathname !== '/communicate_pos_test') throw new Error('Sólo DB local de prueba');
const db = new PrismaClient({ datasources: { db: { url } } });
test.beforeEach(async ({ page }) => {await clearEvidenceFixtures(db);
  await db.$transaction([db.session.deleteMany(), db.authRateLimit.deleteMany(), db.registrationRequestHistory.deleteMany(), db.registrationRequest.deleteMany(), db.registrationOperation.deleteMany(), db.saleAccessory.deleteMany(), db.equipmentHistory.deleteMany(), db.auditLog.deleteMany(), db.saleEquipment.deleteMany(), db.sale.deleteMany(), db.imei.deleteMany(), db.equipment.deleteMany(), db.client.deleteMany(), db.user.deleteMany()]);
  await seedTestAdmin(db); await mkdir('.test-results/phase-5-dni', { recursive: true });
  await page.goto('/login'); await page.getByLabel('Correo', { exact: true }).fill(testEmail); await page.getByLabel('Contraseña', { exact: true }).fill(testPassword);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click(); await expect(page.locator('.home-reference')).toBeVisible();
});
test.afterAll(() => db.$disconnect());
async function openDraft(page: Page, path: string) {
  await page.goto(path);
  return page.locator('.dni-client-fields').first();
}
async function completeRegistration(page: Page, imei: string) {
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('IMEI 1', { exact: false }).first().fill(imei);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Marca', { exact: true }).fill('Honor'); await page.getByLabel('Modelo', { exact: true }).fill('DNI Fixture');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'HONOR DNI FIXTURE', exact: true })).toBeVisible();
}
test('A: cliente externo editable, sin alta anticipada, contacto manual y confirmación', async ({ page }) => {
  const fields = await openDraft(page, '/clientes/nuevo'); await fields.getByLabel('DNI', { exact: false }).fill('12345678');
  await expect(fields.getByLabel('Nombres', { exact: true })).toHaveValue('ANA MARÍA'); await expect(fields.getByLabel('Apellidos', { exact: true })).toHaveValue('MUÑOZ ÁLVAREZ');
  expect(await db.client.count()).toBe(0); await expect(fields.getByLabel('Celular', { exact: false })).toHaveValue(''); await expect(fields.getByLabel('Correo', { exact: false })).toHaveValue('');
  await fields.getByLabel('Nombres', { exact: true }).fill('Ana María revisada'); await fields.getByLabel('Celular', { exact: false }).fill('999111222'); await fields.getByLabel('Correo', { exact: false }).fill('dni-fixture@example.test');
  await page.getByRole('button', { name: 'Crear cliente', exact: true }).click(); await expect(page.getByRole('heading', { name: 'ANA MARÍA REVISADA MUÑOZ ÁLVAREZ', exact: true })).toBeVisible();
  expect(await db.client.count()).toBe(1); expect(await db.auditLog.count({ where: { action: 'CLIENT_CREATED' } })).toBe(1);
});
test('B: local tiene prioridad y Usar cliente no duplica', async ({ page }) => {
  const client = await db.client.create({ data: { dni: '12345678', firstName: 'Nombre corregido', lastName: 'Local', phone: '999111222', email:'local@example.test',address:'av. españa 123',department:'junín' } });
  const fields = await openDraft(page, '/clientes/nuevo'); const response = page.waitForResponse(res => res.url().endsWith('/api/dni/12345678'));
  await fields.getByLabel('DNI', { exact: false }).fill('12345678'); expect((await (await response).json()).source).toBe('LOCAL');
  await expect(fields.getByText('Cliente encontrado', { exact: true })).toBeVisible(); await expect(fields.getByLabel('Nombres', { exact: true })).toHaveValue('NOMBRE CORREGIDO'); await expect(fields.getByLabel('Nombres', { exact: true })).toHaveAttribute('readonly', '');await expect(fields.getByLabel('Celular', {exact:false})).toHaveValue('999111222');await expect(fields.getByLabel('Correo', {exact:false})).toHaveValue('local@example.test');await expect(fields.getByLabel('Dirección', {exact:false})).toHaveValue('AV. ESPAÑA 123');await expect(fields.getByLabel('Departamento', {exact:false})).toHaveValue('JUNÍN');
  await page.getByRole('button', { name: 'Usar cliente', exact: true }).click(); await expect(page).toHaveURL(new RegExp(`/clientes/${client.id}`)); expect(await db.client.count()).toBe(1);
});
test('C: provider caído permite crear cliente manual', async ({ page }) => {
  const fields = await openDraft(page, '/clientes/nuevo'); await fields.getByLabel('DNI', { exact: false }).fill('99999999');
  await expect(fields.getByText('No pudimos consultar el DNI', { exact: false })).toBeVisible(); await fields.getByLabel('Nombres', { exact: true }).fill('Manual'); await fields.getByLabel('Apellidos', { exact: true }).fill('Pérez');
  await page.getByRole('button', { name: 'Crear cliente', exact: true }).click(); await expect(page.getByRole('heading', { name: 'MANUAL PÉREZ', exact: true })).toBeVisible(); expect(await db.client.count()).toBe(1);
});
test('criterio principal: registro por DNI externo, contactos, equipo/IMEI y posterior reutilización local', async ({ page }) => {
  const fields = await openDraft(page, '/registros/tecnico'); await fields.getByLabel('DNI', { exact: false }).fill('12345678');
  await expect(fields.getByLabel('Nombres', { exact: true })).toHaveValue('ANA MARÍA'); await fields.getByLabel('Celular', { exact: false }).fill('999111222'); await fields.getByLabel('Correo', { exact: false }).fill('registration-fixture@example.test');
  expect(await db.client.count()).toBe(0); await completeRegistration(page, '591234567800016');
  const client = await db.client.findUniqueOrThrow({ where: { dni: '12345678' } }); expect(client.phone).toBe('999111222'); expect(client.email).toBe('registration-fixture@example.test');
  expect(await db.equipment.count()).toBe(1); expect(await db.imei.count()).toBe(1);
  const repeated = await openDraft(page, '/registros/tecnico'); const response = page.waitForResponse(res => res.url().endsWith('/api/dni/12345678'));
  await repeated.getByLabel('DNI', { exact: false }).fill('12345678'); expect((await (await response).json()).source).toBe('LOCAL');
  await expect(repeated.getByText('Cliente encontrado', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('IMEI 1', { exact: false }).first().fill('591234567800016'); await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Equipo encontrado:', { exact: false })).toBeVisible(); await page.getByRole('button', { name: 'Continuar', exact: true }).click(); await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'HONOR DNI FIXTURE', exact: true })).toBeVisible(); expect(await db.client.count()).toBe(1); expect(await db.equipment.count()).toBe(1);
});
test('registro manual funciona con provider caído', async ({ page }) => {
  const fields = await openDraft(page, '/registros/tecnico'); await fields.getByLabel('DNI', { exact: false }).fill('99999999');
  await expect(fields.getByText('No pudimos consultar el DNI', { exact: false })).toBeVisible(); await fields.getByLabel('Nombres', { exact: true }).fill('Manual'); await fields.getByLabel('Apellidos', { exact: true }).fill('Registro');
  await completeRegistration(page, '599999999900012'); expect(await db.client.count()).toBe(1); expect(await db.imei.count()).toBe(1);
});
test('ventas reutiliza consulta para comprador nuevo y propietario diferente', async ({ page }) => {
  const buyer = await openDraft(page, '/ventas/nueva'); await buyer.getByLabel('DNI', { exact: false }).fill('12345678'); await expect(buyer.getByLabel('Nombre completo', { exact: true })).toHaveValue('ANA MARÍA MUÑOZ ÁLVAREZ');await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  const item = page.getByTestId('sale-item-0'); await item.getByLabel('Nombre comercial',{exact:true}).fill('Equipo fixture');await item.getByLabel('Marca', { exact: true }).fill('Xiaomi'); await item.getByLabel('Modelo', { exact: true }).fill('DNI Venta'); await item.getByLabel('IMEI 1 del equipo 1', { exact: true }).fill('591234567800016'); await item.getByLabel('Precio del equipo 1 (S/)', { exact: true }).fill('1000');
  await page.getByTestId('sale-item-0').locator('.sale-owner-options>summary').click();await item.getByLabel('PROPIETARIO DISTINTO DEL COMPRADOR PARA EQUIPO 1').check(); await item.getByRole('button', { name: 'Crear propietario del equipo 1 nuevo', exact: true }).click();
  const owner = item.locator('.dni-client-fields'); await owner.getByLabel('DNI', { exact: false }).fill('12345679'); await expect(owner.getByLabel('Nombres', { exact: true })).toHaveValue('LUIS ANDRÉS');
  expect(await db.client.count()).toBe(0); expect(await db.client.count()).toBe(0);await saveSale(page); await expect(page.getByRole('dialog',{name:'Detalle de venta',exact:true})).toBeVisible();
  const sale = await db.sale.findFirstOrThrow({ include: { equipment: { include: { equipment: true } } } }); expect(sale.buyerId).not.toBe(sale.equipment[0].equipment.ownerId); expect(await db.client.count()).toBe(2);
});
test('venta manual sigue operativa ante caída del provider', async ({ page }) => {
  const buyer = await openDraft(page, '/ventas/nueva'); await buyer.getByLabel('DNI', { exact: false }).fill('99999999'); await expect(buyer.getByText('No pudimos consultar el DNI', { exact: false })).toBeVisible();
  await buyer.getByLabel('Nombre completo', { exact: true }).fill('Manual Venta');await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  const item = page.getByTestId('sale-item-0'); await item.getByLabel('Nombre comercial',{exact:true}).fill('Equipo fixture');await item.getByLabel('Marca', { exact: true }).fill('Apple'); await item.getByLabel('Modelo', { exact: true }).fill('iPhone'); await item.getByLabel('IMEI 1 del equipo 1', { exact: true }).fill('599999999900012'); await item.getByLabel('Precio del equipo 1 (S/)', { exact: true }).fill('1000');
  await saveSale(page); await expect(page.getByRole('dialog',{name:'Detalle de venta',exact:true})).toBeVisible(); expect(await db.client.count()).toBe(1);
});
test('consulta tardía no sobrescribe correcciones manuales ni datos de otro DNI', async ({ page }) => {
  await page.route('**/api/dni/*', async route => { await new Promise(resolve => setTimeout(resolve, 600)); await route.continue().catch(() => {}); });
  const fields = await openDraft(page, '/clientes/nuevo'); await fields.getByLabel('DNI', { exact: false }).fill('12345678'); await expect(fields.getByText('Consultando DNI...', { exact: true })).toBeVisible();
  await fields.getByLabel('Nombres', { exact: true }).fill('Corrección manual'); await expect(fields.getByText('Datos encontrados.', { exact: false })).toBeVisible(); await expect(fields.getByLabel('Nombres', { exact: true })).toHaveValue('CORRECCIÓN MANUAL');
  await fields.getByLabel('DNI', { exact: false }).fill('12345679'); await expect(fields.getByText('Consultando DNI...', { exact: true })).toBeVisible(); await fields.getByLabel('DNI', { exact: false }).fill('12345680');
  await expect(fields.getByLabel('Nombres', { exact: true })).toHaveValue('LUCÍA ELENA'); await expect(fields.getByLabel('Apellidos', { exact: true })).toHaveValue('PEÑA DEL RÍO');
});
test('DNI compartido responsive: loading, autofill y fallback en los tres formularios', async ({ page }) => {
  // Esta matriz abandona borradores intencionalmente; aceptar la advertencia de salida.
  page.on('dialog',dialog=>dialog.accept());
  await page.route('**/api/dni/*', async route => { await new Promise(resolve => setTimeout(resolve, 800)); await route.continue().catch(() => {}); });
  for (const width of [1280, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [['clients', '/clientes/nuevo'], ['registrations', '/registros/nuevo'], ['sales', '/ventas/nueva']]) {
      const fields = await openDraft(page, path); await fields.getByLabel('DNI', { exact: false }).fill('12345678'); await expect(fields.getByText('Consultando DNI...', { exact: true })).toBeVisible();
      await page.screenshot({ path: `.test-results/phase-5-dni/${width}-${name}-loading.png`, fullPage: true });
      await expect(fields.getByLabel(name==='clients'?'Nombres':'Nombre completo', { exact: true })).toHaveValue(name==='clients'?'ANA MARÍA':'ANA MARÍA MUÑOZ ÁLVAREZ'); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `.test-results/phase-5-dni/${width}-${name}-autofill.png`, fullPage: true });
      await fields.getByLabel('DNI', { exact: false }).fill('99999999'); await expect(fields.getByText('No pudimos consultar el DNI', { exact: false })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await page.screenshot({ path: `.test-results/phase-5-dni/${width}-${name}-fallback.png`, fullPage: true });
    }
  }
  expect(await db.client.count()).toBe(0);
});
