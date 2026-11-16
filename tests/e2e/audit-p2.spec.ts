import {advanceRegistration} from '../helpers/browser-registration';
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
test('datos obligatorios del equipo se validan en su paso y no bloquean después precio y condiciones',async({page})=>{
 await db.client.create({data:{dni:'70000001',firstName:'ANA',lastName:'PRUEBA',phone:'912345678',email:'fixture@example.test',address:'AV. PRUEBA 1',department:'LIMA'}});
 await page.goto('/registros/nuevo');await page.getByLabel('DNI',{exact:true}).fill('70000001');await expect(page.getByText('Cliente encontrado',{exact:true})).toBeVisible();
 await advanceRegistration(page);await expect(page.getByRole('heading',{name:'Datos del equipo',exact:true})).toBeVisible();
 await page.getByLabel('IMEI 1',{exact:true}).fill('597087654480017');await page.getByLabel('IMEI 2',{exact:true}).fill('597087654480025');
 await expect(page.getByText('Buscando equipo...',{exact:true})).toHaveCount(0);
 await page.getByLabel('Nombre del equipo',{exact:true}).fill('REDMI NOTE 15');await page.getByLabel('Marca',{exact:true}).fill('XIAOMI');
 await page.getByRole('group',{name:'¿REGISTRAR DOS IMEIs?',exact:true}).getByRole('radio',{name:'Sí',exact:true}).check();await page.getByLabel('Celular del IMEI 2',{exact:true}).fill('935151010');
 await advanceRegistration(page);
 await expect(page.getByRole('heading',{name:'Datos del equipo',exact:true})).toBeVisible();await expect(page.getByLabel('Modelo',{exact:true})).toBeFocused();await expect(page.getByLabel('Modelo',{exact:true})).toHaveAttribute('aria-invalid','true');
 await expect(page.getByRole('alert').filter({hasText:'Modelo del equipo:'}).first()).toBeVisible();expect(await db.registrationRequest.count()).toBe(0);
 await page.getByLabel('Modelo',{exact:true}).fill('SM-PRUEBA');await advanceRegistration(page);
 await expect(page.getByRole('heading',{name:'PRECIO Y CONDICIONES DEL REGISTRO',exact:true})).toBeVisible();
 await page.getByLabel('Precio IMEI 1 (S/)',{exact:true}).fill('10');await page.getByLabel('Precio IMEI 2 (S/)',{exact:true}).fill('10');await expect(page.getByLabel('Celular IMEI 2',{exact:true})).toHaveValue('935151010');
 await advanceRegistration(page);await expect(page.getByRole('heading',{name:'EVIDENCIAS FOTOGRÁFICAS',exact:true})).toBeVisible();
 await expect(page.getByText('Este campo es obligatorio.',{exact:true})).toHaveCount(0);expect(await db.registrationRequest.count()).toBe(0);
});
test('formulario pide sólo dirección y departamento en desktop y móvil',async({page})=>{
 await page.goto('/registros/nuevo');
 await expect(page.getByLabel('Provincia',{exact:true})).toHaveCount(0);await page.getByLabel('Departamento',{exact:true}).selectOption('LIMA');await page.getByLabel('Dirección de atención',{exact:true}).fill('Av. Prueba 1');
 await expect(page.locator('.combined-address')).toContainText('AV. PRUEBA 1 - LIMA');
 for(const width of [1280,390]){await page.setViewportSize({width,height:900});await expect(page.getByLabel('Provincia',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Departamento',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
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
