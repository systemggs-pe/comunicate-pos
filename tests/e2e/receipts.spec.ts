import 'dotenv/config';
import {test,expect} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {mkdir,readFile} from 'node:fs/promises';
import {clearEvidenceFixtures} from '../helpers/evidence';
import {companyDefaults} from '../../shared/company';
import {seedTestAdmin,testEmail,testPassword,testOrigin} from '../helpers/auth';
import {workflowInput} from '../helpers/workflow';
const url=process.env.TEST_DATABASE_URL!,target=new URL(url);
if(!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/communicate_pos_test')throw new Error('DB dedicada requerida');
const db=new PrismaClient({datasources:{db:{url}}});
test.beforeEach(async({page})=>{await clearEvidenceFixtures(db);await db.$transaction([db.companySettings.deleteMany(),db.session.deleteMany(),db.authRateLimit.deleteMany(),db.registrationRequestHistory.deleteMany(),db.registrationRequest.deleteMany(),db.registrationOperation.deleteMany(),db.saleAccessory.deleteMany(),db.equipmentHistory.deleteMany(),db.auditLog.deleteMany(),db.saleEquipment.deleteMany(),db.sale.deleteMany(),db.imei.deleteMany(),db.equipment.deleteMany(),db.client.deleteMany(),db.user.deleteMany()]);await seedTestAdmin(db);await mkdir('.test-results/phase6a',{recursive:true});await page.goto('/login');await page.getByLabel('Correo',{exact:true}).fill(testEmail);await page.getByLabel('Contraseña',{exact:true}).fill(testPassword);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.locator('.home-reference')).toBeVisible();});
test.afterAll(async()=>{await clearEvidenceFixtures(db);await db.$disconnect();});
async function createSale(page:import('@playwright/test').Page){const input=workflowInput();const r=await page.request.post('/api/sales',{headers:{Origin:testOrigin},data:{buyer:{client:input.client},items:[{equipment:{...input.equipment,serialNumber:'SN1234',imeis:input.imeis},unitPrice:'100.00'},{equipment:{brand:'NOKIA',model:'C20',imeis:[{slot:1,value:'597087654399993'}]},unitPrice:'50.00'}],accessories:[{name:'Cable USB',quantity:2,unitPrice:'0.10'}],discount:'0.05',paymentMethod:'YAPE'}});expect(r.status()).toBe(201);return r.json();}

test('configuración editable persiste y es responsive 375 390 430',async({page})=>{
 await page.goto('/configuracion/empresa');await expect(page.getByLabel('NOMBRE COMERCIAL',{exact:true})).toBeVisible();
 for(const width of [375,390,430]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
 await page.getByLabel('NOMBRE COMERCIAL',{exact:true}).fill('mi tienda');await page.getByLabel('DIRECCIÓN',{exact:true}).fill('av. españa 123');await page.getByLabel('TELÉFONO O CELULAR',{exact:true}).fill('952123456');await page.getByRole('button',{name:'GUARDAR CONFIGURACIÓN',exact:true}).click();await expect(page.getByRole('status')).toContainText('CONFIGURACIÓN GUARDADA');await page.reload();await expect(page.getByLabel('NOMBRE COMERCIAL',{exact:true})).toHaveValue('MI TIENDA');expect((await db.companySettings.findUniqueOrThrow({where:{id:1}})).phone).toBe('952123456');
});
for(const format of [58,80])test(`ticket ${format} mm: vista automática, descarga exacta e impresión`,async({page})=>{
 const sale=await createSale(page);const settings=await page.request.patch('/api/settings/company',{headers:{Origin:testOrigin},data:{...companyDefaults,address:'AV. ESPAÑA 123',phone:'952123456'}});expect(settings.status()).toBe(200);
 await page.goto(`/ventas/${sale.id}?saved=1`);const saved=page.getByRole('dialog',{name:'Ticket de venta',exact:true});await expect(saved).toBeVisible();
 expect(await saved.getByLabel('Formato del ticket').locator('option').allTextContents()).toEqual(['58 mm','80 mm']);await saved.getByLabel('Formato del ticket').selectOption(String(format));
 const receipt=saved.getByRole('article');await expect(receipt).toHaveAttribute('data-format',String(format));await expect(receipt).toHaveCSS('text-transform','none');
 for(const text of ['COMUNIC@TE','RECIBO DE VENTA','AV. ESPAÑA 123','952123456','TOTAL','S/. 150.15','NOKIA','CABLE USB'])await expect(receipt).toContainText(text);
 await expect(receipt).not.toContainText('IMPORTADO');await expect(receipt).not.toContainText('Notas');
 for(const line of sale.equipment)for(const imei of line.equipment.imeis)await expect(receipt).toContainText(imei.value);
 await expect(receipt.getByRole('img',{name:'Código de barras del número de serie SN1234',exact:true})).toBeVisible();
 const downloading=page.waitForEvent('download');await saved.getByRole('button',{name:'Descargar PDF',exact:true}).click();const download=await downloading;
 const path=`.test-results/phase6a/${format}.pdf`;await download.saveAs(path);const pdf=await readFile(path);expect(pdf.subarray(0,5).toString()).toBe('%PDF-');const box=pdf.toString('latin1').match(/\/MediaBox \[0 0 ([\d.]+)/);expect(Number(box?.[1])/72*25.4).toBeCloseTo(format,2);
 await saved.getByRole('link',{name:'Imprimir ticket',exact:true}).click();await expect(page.getByRole('heading',{name:`TICKET ${format} MM`,exact:true})).toBeVisible();
 for(const width of [375,390,430]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
 await page.evaluate(()=>{window.print=()=>{document.documentElement.dataset.printCalled='yes';};});await page.getByRole('button',{name:'IMPRIMIR',exact:true}).click();expect(await page.locator('html').getAttribute('data-print-called')).toBe('yes');await page.emulateMedia({media:'print'});await expect(page.locator('.receipt-controls')).toBeHidden();await expect(page.locator('.sidebar')).toHaveCount(0);await page.emulateMedia({media:'screen'});
 const other=format===58?80:58;await page.getByRole('link',{name:`Cambiar a ${other} mm`,exact:true}).click();await expect(page.getByRole('article')).toHaveAttribute('data-format',String(other));
});
test('selector ofrece sólo 58/80, descarga al seleccionar y permite cancelar',async({page})=>{
 const sale=await createSale(page);await page.goto(`/ventas/${sale.id}`);await page.getByRole('button',{name:'Ticket',exact:true}).click();const dialog=page.getByRole('dialog',{name:'SELECCIONAR FORMATO DE IMPRESIÓN',exact:true});
 await expect(dialog.locator('.printer-format-options button')).toHaveText(['58 mm','80 mm']);await expect(dialog.getByRole('button',{name:'48 mm',exact:true})).toHaveCount(0);
 const downloading=page.waitForEvent('download');await dialog.getByRole('button',{name:'58 mm',exact:true}).click();expect((await downloading).suggestedFilename()).toContain('58mm.pdf');await expect(dialog).toBeHidden();
 await page.getByRole('button',{name:'Ticket',exact:true}).click();await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(dialog).toBeHidden();
});
