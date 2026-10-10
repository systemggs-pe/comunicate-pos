import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { mkdir } from 'node:fs/promises';
import { seedTestAdmin, testEmail, testPassword } from '../helpers/auth';

const url = process.env.TEST_DATABASE_URL!;
const target = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.pathname !== '/communicate_pos_test') throw new Error('Sólo base local de prueba');
const db = new PrismaClient({ datasources: { db: { url } } });
test.beforeAll(async () => {
  await db.$transaction([db.session.deleteMany(), db.authRateLimit.deleteMany(), db.registrationRequestHistory.deleteMany(), db.registrationRequest.deleteMany(), db.registrationOperation.deleteMany(), db.saleAccessory.deleteMany(), db.equipmentHistory.deleteMany(), db.auditLog.deleteMany(), db.saleEquipment.deleteMany(), db.sale.deleteMany(), db.imei.deleteMany(), db.equipment.deleteMany(), db.client.deleteMany(), db.user.deleteMany()]);
  await seedTestAdmin(db);
  await mkdir('.test-results/dual-imei', { recursive: true });
});
test.afterAll(() => db.$disconnect());

for (const [index, brand] of ['Samsung', 'Honor', 'Xiaomi', 'Motorola', 'Apple', 'Desconocida'].entries()) {
  test(`${brand}: dual, selección independiente y búsqueda del segundo`, async ({ page }) => {
    const dni = `6090000${index}`;
    const first = `3596090000${index}0001`, second = `3596090000${index}0002`;
    await page.goto('/login');
    await page.getByLabel('Correo', { exact: true }).fill(testEmail);
    await page.getByLabel('Contraseña', { exact: true }).fill(testPassword);
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Registro de equipos', exact: true })).toBeVisible();
    await page.goto('/registros/tecnico');
    await page.getByLabel('DNI', { exact: false }).fill(dni);
    await page.getByLabel('Nombres').fill('Prueba'); await page.getByLabel('Apellidos').fill(brand);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByLabel('IMEI 1', { exact: false }).first().fill(first);
    await page.getByLabel('El equipo tiene un segundo IMEI').check();
    await page.getByLabel('IMEI 2', { exact: false }).first().fill(second);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByLabel('Marca', { exact: true }).fill(brand); await page.getByLabel('Modelo', { exact: true }).fill('Dual');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Registrar ambos IMEI', exact: true })).toBeVisible();
    // Mantener el comportamiento anterior: IMEI 1 seleccionado por defecto.
    await page.getByLabel('Estado de registro').selectOption('REGISTERED');
    await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
    await expect(page.getByRole('heading', { name: `${brand.toUpperCase()} DUAL`, exact: true })).toBeVisible();
    const id = new URL(page.url()).pathname.split('/').pop()!;
    await expect(page.getByTestId('imei-card-1').getByText('Registrado', { exact: true })).toBeVisible();
    await expect(page.getByTestId('imei-card-2').getByText('SIN SOLICITUD', { exact: true })).toBeVisible();
    // Buscar únicamente IMEI 2 debe ofrecer también IMEI 1 ya asociado.
    await page.goto('/registros/tecnico'); await page.getByLabel('DNI', { exact: false }).fill(dni);
    await expect(page.getByText('Cliente encontrado', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByLabel('IMEI 1', { exact: false }).first().fill(second);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByText('Equipo encontrado:', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.locator('.selection-row')).toHaveCount(2);
    await expect(page.locator('.selection-row').filter({ hasText: first }).getByText('Registrado', { exact: true })).toBeVisible();
    await expect(page.locator('.selection-row').filter({ hasText: second }).getByText('SIN SOLICITUD', { exact: true })).toBeVisible();
    if (brand === 'Honor') {
      for (const width of [375, 390, 430]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.getByRole('button', { name: 'Registrar ambos IMEI', exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await page.screenshot({ path: `.test-results/dual-imei/${width}-selection.png`, fullPage: true });
      }
    }
    await page.getByRole('button', { name: 'Registrar ambos IMEI', exact: true }).click();
    await expect(page.locator('.selection-row input:checked')).toHaveCount(2);
    await page.getByLabel('Estado de registro').selectOption('REGISTERED');
    await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
    await expect(page.getByRole('heading', { name: `${brand.toUpperCase()} DUAL`, exact: true })).toBeVisible();
    const equipment = await db.equipment.findUniqueOrThrow({ where: { id }, include: { imeis: true } });
    expect(equipment.imeis).toHaveLength(2); expect(equipment.imeis.every(i => i.registrationStatus === 'REGISTERED')).toBe(true);
    expect(await db.equipmentHistory.count({ where: { equipmentId: id, eventType: 'IMEI_REGISTERED' } })).toBe(2);
  });
}
