import {seedTestAdmin,testEmail,testPassword} from '../helpers/auth';
import 'dotenv/config';
import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { mkdir } from 'node:fs/promises';

const url = process.env.TEST_DATABASE_URL!;
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname) || new URL(url).pathname !== '/communicate_pos_test') throw new Error('DB de prueba requerida');
const db = new PrismaClient({ datasources: { db: { url } } });
const dni = '60987654', imei1 = '359609876540001', imei2 = '359609876540002';
test.beforeAll(async () => { await db.$transaction([db.session.deleteMany(), db.authRateLimit.deleteMany(), db.registrationRequestHistory.deleteMany(), db.registrationRequest.deleteMany(), db.registrationOperation.deleteMany(), db.saleAccessory.deleteMany(), db.equipmentHistory.deleteMany(), db.auditLog.deleteMany(), db.saleEquipment.deleteMany(), db.sale.deleteMany(), db.imei.deleteMany(), db.equipment.deleteMany(), db.client.deleteMany(), db.user.deleteMany()]); await seedTestAdmin(db); await mkdir('.test-results/visual', { recursive: true }); });
test.afterAll(() => db.$disconnect());
async function login(page: Page) { await page.goto('/'); await page.getByLabel('Correo', {exact:true}).fill(testEmail); await page.getByLabel('Contraseña', {exact:true}).fill(testPassword); await page.getByRole('button', { name: 'Iniciar sesión', exact:true }).click(); await expect(page.getByRole('heading', { name: 'Registro de equipos', exact: true })).toBeVisible(); }
async function next(page: Page) { await page.getByRole('button', { name: 'Continuar', exact: true }).click(); }
async function screenshot(page: Page, label: string, width: number) { await expect(page.getByRole('status').filter({ hasText: 'Cargando...' })).toHaveCount(0); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await page.screenshot({ path: `.test-results/visual/${width}-${label}.png`, fullPage: true }); }
test('criterio completo, relaciones canónicas, reutilización y revisión responsive', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()); });
  await login(page); await page.goto('/registros/tecnico');
  await page.getByLabel('DNI', { exact: false }).fill(dni); await page.getByLabel('Nombres').fill('Brand'); await page.getByLabel('Apellidos').fill('Peralta'); await next(page);
  await page.getByLabel('IMEI 1', { exact: false }).first().fill(imei1); await page.getByLabel('El equipo tiene un segundo IMEI').check(); await page.getByLabel('IMEI 2', { exact: false }).first().fill(imei2); await next(page);
  await page.getByLabel('Marca', { exact: true }).fill('Samsung'); await page.getByLabel('Modelo', { exact: true }).fill('Galaxy S25 Ultra'); await next(page);
  await page.getByLabel('Estado de registro').selectOption('REGISTERED'); await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(page.getByRole('heading', { name: 'Samsung Galaxy S25 Ultra', exact: true })).toBeVisible();
  const originalPath = new URL(page.url()).pathname; const id = originalPath.split('/').pop()!;
  await expect(page.getByText('Registro parcial', { exact: true })).toBeVisible();
  await expect(page.getByTestId('imei-card-1').getByText('Registrado', { exact: true })).toBeVisible(); await expect(page.getByTestId('imei-card-2').getByText('No registrado', { exact: true })).toBeVisible();
  const first = await db.equipment.findUniqueOrThrow({ where: { id }, include: { imeis: true, owner: true } });
  await page.getByRole('link', { name: 'Inicio', exact: true }).click(); await page.getByLabel('Buscar por IMEI', { exact: true }).fill(imei2); await page.getByRole('button', { name: 'Buscar IMEI', exact: true }).click(); await expect(page.getByText(`IMEI 2:`, { exact: false })).toBeVisible(); await page.getByRole('link', { name: 'Ver equipo y registrar' }).click(); expect(new URL(page.url()).pathname).toBe(originalPath);
  await page.getByRole('button', { name: 'Actualizar IMEI 2' }).click(); await page.getByTestId('imei-card-2').getByLabel('Estado de registro').selectOption('REGISTERED'); await page.getByRole('button', { name: 'Guardar IMEI 2' }).click(); await expect(page.getByText('IMEI 2 actualizado.', { exact: true })).toBeVisible();
  await expect(page.getByTestId('imei-card-2').getByText('Registrado', { exact: true })).toBeVisible();
  const second = await db.equipment.findUniqueOrThrow({ where: { id }, include: { imeis: true } }); expect(second.ownerId).toBe(first.ownerId); expect(second.imeis.every(i => i.registrationStatus === 'REGISTERED')).toBe(true); expect(await db.client.count()).toBe(1); expect(await db.equipment.count()).toBe(1); expect(await db.imei.count()).toBe(2); expect(await db.sale.count()).toBe(0);
  const history = await db.equipmentHistory.findMany({ where: { equipmentId: id, eventType: 'IMEI_REGISTERED' } }); expect(history).toHaveLength(2); expect(new Set(history.map(h => h.imeiId)).size).toBe(2);
  // Existing client + new equipment through the actual wizard.
  await page.goto('/registros/tecnico'); await page.getByLabel('DNI').fill(dni); await expect(page.getByText('Cliente encontrado', { exact: true })).toBeVisible(); await next(page); await page.getByLabel('IMEI 1', { exact: false }).first().fill('359609876540003'); await next(page); await page.getByLabel('Marca', { exact: true }).fill('Apple'); await page.getByLabel('Modelo', { exact: true }).fill('iPhone'); await next(page); await page.getByRole('button', { name: 'Guardar registro' }).click(); await expect(page.getByRole('heading', { name: 'Apple iPhone', exact: true })).toBeVisible(); expect(await db.client.count()).toBe(1); expect(await db.equipment.count()).toBe(2);
  // Existing IMEI + existing equipment through the actual wizard, no duplication.
  await page.goto('/registros/tecnico'); await page.getByLabel('DNI').fill(dni); await expect(page.getByText('Cliente encontrado', { exact: true })).toBeVisible(); await next(page); await page.getByLabel('IMEI 1', { exact: false }).first().fill(imei2); await next(page); await expect(page.getByText(`Equipo encontrado: ${first.code}`, { exact: true })).toBeVisible(); await next(page); await page.getByLabel('Estado de registro').selectOption('REGISTERED'); await page.getByRole('button', { name: 'Guardar registro' }).click(); await expect(page.getByRole('heading', { name: 'Samsung Galaxy S25 Ultra', exact: true })).toBeVisible(); expect(await db.equipment.count()).toBe(2); expect(await db.imei.count()).toBe(3);
  for (const width of [1280, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 900 });
    await screenshot(page, 'equipment-history', width); await page.getByRole('button', { name: 'Actualizar IMEI 2' }).click(); await screenshot(page, 'imei-form', width); await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Editar equipo' }).click(); await screenshot(page, 'equipment-edit', width); await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('link', { name: 'Clientes', exact: true }).first().click(); await expect(page.getByRole('link', { name: 'Ver cliente', exact: true })).toBeVisible(); await screenshot(page, 'clients-table', width); await page.getByRole('link', { name: 'Ver cliente', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Brand Peralta' })).toBeVisible(); await screenshot(page, 'client-detail', width); await page.getByRole('button', { name: 'Editar cliente' }).click(); await screenshot(page, 'client-edit', width); await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('link', { name: 'Equipos', exact: true }).first().click(); await expect(page.getByRole('link', { name: 'Ver equipo', exact: true })).toHaveCount(2); await screenshot(page, 'equipment-table', width);
    await page.goto('/registros/tecnico'); await page.getByLabel('DNI').fill('60987655'); await page.getByLabel('Nombres').fill('Visual'); await page.getByLabel('Apellidos').fill('Prueba'); await screenshot(page, 'wizard-client', width); await next(page); await page.getByLabel('IMEI 1', { exact: false }).first().fill('359609876540004'); await page.getByLabel('El equipo tiene un segundo IMEI').check(); await page.getByLabel('IMEI 2', { exact: false }).first().fill('359609876540005'); await screenshot(page, 'wizard-imeis', width); await next(page); await page.getByLabel('Marca', { exact: true }).fill('Samsung'); await page.getByLabel('Modelo', { exact: true }).fill('Galaxy'); await screenshot(page, 'wizard-equipment', width); await next(page); await screenshot(page, 'wizard-registration', width);
    // Navegación SPA y sesión persistente por cookie HttpOnly.
    await page.getByRole('link', { name: 'Equipos', exact: true }).first().click(); await page.getByRole('row').filter({ hasText: 'Samsung Galaxy S25 Ultra' }).getByRole('link', { name: 'Ver equipo', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Samsung Galaxy S25 Ultra', exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Samsung Galaxy S25 Ultra',exact:true })).toBeVisible(); expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
});
