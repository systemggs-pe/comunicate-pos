import {test,expect} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {clearEvidenceFixtures} from '../helpers/evidence';
import {seedTestAdmin,testEmail,testPassword} from '../helpers/auth';
const target=new URL(process.env.TEST_DATABASE_URL!);
if(!['localhost','127.0.0.1'].includes(target.hostname)||target.pathname!=='/communicate_pos_test')throw Error('TEST DB ONLY');
const db=new PrismaClient({datasources:{db:{url:target.toString()}}});
test.beforeEach(async({page})=>{
 await clearEvidenceFixtures(db);
 await db.$transaction([db.companySettings.deleteMany(),db.session.deleteMany(),db.authRateLimit.deleteMany(),db.registrationRequestHistory.deleteMany(),db.registrationRequest.deleteMany(),db.registrationOperation.deleteMany(),db.saleAccessory.deleteMany(),db.equipmentHistory.deleteMany(),db.auditLog.deleteMany(),db.saleEquipment.deleteMany(),db.sale.deleteMany(),db.imei.deleteMany(),db.equipment.deleteMany(),db.client.deleteMany(),db.user.deleteMany()]);
 await seedTestAdmin(db);await page.goto('/login');await page.getByLabel('Correo',{exact:true}).fill(testEmail);await page.getByLabel('Contraseña',{exact:true}).fill(testPassword);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.locator('.home-reference')).toBeVisible();
});
test.afterAll(()=>db.$disconnect());
test('AUD-06 provincia visible y dirección compartida coherente en desktop y móvil',async({page})=>{
 await page.goto('/registros/nuevo');
 await page.getByLabel('Provincia',{exact:true}).fill('Tacna');await page.getByLabel('Departamento',{exact:true}).selectOption('LIMA');await page.getByLabel('Dirección de atención',{exact:true}).fill('Av. Prueba 1');
 await expect(page.locator('.combined-address')).toContainText('AV. PRUEBA 1 - TACNA');await expect(page.locator('.combined-address')).not.toContainText('LIMA');
 for(const width of [1280,390]){await page.setViewportSize({width,height:900});await expect(page.getByLabel('Provincia',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
});
test('AUD-08 consultar fotos guardadas no envía confirmación automática; el lado requiere elección',async({page})=>{
 const id='00000000-0000-4000-8000-000000000001';
 const documents=[1,2].map(n=>({id:`00000000-0000-4000-8000-00000000000${n+1}`,category:'IDENTITY_IMAGE',documentType:'BLUE',source:'CODART_DNIV',sourceOrdinal:n,status:'CURRENT',retentionDue:false,createdAt:'2026-10-20T00:00:00Z',expiresAt:'2027-10-20T00:00:00Z',asset:{id:`asset-${n}`,width:100,height:150,fileSize:100}}));
 const mutations:string[]=[];
 await page.route('**/api/clients/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(request.method()!=='GET')mutations.push(url.pathname);
  if(url.pathname.endsWith('/by-dni/70000001'))return route.fulfill({json:{id,dni:'70000001',firstName:'ANA',lastName:'PRUEBA'}});
  if(url.pathname.endsWith('/documents'))return route.fulfill({json:{documents,history:[]}});
  if(url.pathname.endsWith('/access'))return route.fulfill({json:{url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='}});
  if(url.pathname.endsWith('/side')){const body=request.postDataJSON();expect(body).toEqual({category:'DNI_FRONT',confirm:true});return route.fulfill({json:{category:'DNI_FRONT'}});}
  return route.continue();
 });
 await page.goto('/foto-dni');await page.getByLabel('DNI de ocho dígitos').fill('70000001');await page.getByRole('button',{name:'Buscar fotos',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Sin lado asignado'})).toHaveCount(2);expect(mutations).toEqual([]);
 await expect(page.getByRole('button',{name:'Guardar lado'}).first()).toBeDisabled();await page.getByLabel('Lado de la imagen 2',{exact:true}).selectOption('DNI_FRONT');await page.getByRole('button',{name:'Guardar lado'}).nth(1).click();
 await expect(page.getByRole('heading',{name:'Anverso',exact:true})).toBeVisible();expect(mutations).toEqual([`/api/clients/${id}/documents/${documents[1].id}/side`]);
});
