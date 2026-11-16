import {advanceRegistration} from '../helpers/browser-registration';
import {uploadRegistrationEvidence} from '../helpers/browser-registration';
import {saleClient,saveSale} from '../helpers/sale-form';
import sharp from 'sharp';
import {clearEvidenceFixtures} from '../helpers/evidence';
import 'dotenv/config';
import { test,expect,type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { mkdir } from 'node:fs/promises';
import { seedTestAdmin,testEmail,testPassword } from '../helpers/auth';
const url=process.env.TEST_DATABASE_URL!,target=new URL(url);
if(!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/communicate_pos_test')throw new Error('DB de prueba requerida');
const db=new PrismaClient({datasources:{db:{url}}});
const dni='70876543',first='597087654300017',second='597087654300025';
test.beforeEach(async({page})=>{
 await clearEvidenceFixtures(db);await db.$transaction([db.session.deleteMany(),db.authRateLimit.deleteMany(),db.registrationRequestHistory.deleteMany(),db.registrationRequest.deleteMany(),db.registrationOperation.deleteMany(),db.saleAccessory.deleteMany(),db.equipmentHistory.deleteMany(),db.auditLog.deleteMany(),db.saleEquipment.deleteMany(),db.sale.deleteMany(),db.imei.deleteMany(),db.equipment.deleteMany(),db.client.deleteMany(),db.user.deleteMany()]);await seedTestAdmin(db);await mkdir('.test-results/workflow',{recursive:true});
 await page.goto('/login');await page.getByLabel('Correo',{exact:true}).fill(testEmail);await page.getByLabel('Contraseña',{exact:true}).fill(testPassword);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.locator('.home-reference')).toBeVisible();
});
test.afterAll(async()=>{await clearEvidenceFixtures(db);await db.$disconnect();});
async function visual(page:Page,name:string){for(const width of [1280,375,390,430]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:`.test-results/workflow/${width}-${name}.png`,fullPage:true});}await page.setViewportSize({width:1280,height:900});}
async function next(page:Page){await advanceRegistration(page);}
async function contact(page:Page){await page.getByLabel('Celular de este registro',{exact:true}).fill('912345678');await page.getByLabel('Dirección de atención',{exact:true}).fill('Dirección ficticia');await page.getByRole('combobox',{name:'Departamento',exact:true}).selectOption('LIMA');await page.getByLabel('Correo de atención',{exact:true}).fill('operation@example.test');}
async function clientStep(page:Page,document=dni){await page.goto('/registros/nuevo');await page.locator('.dni-client-fields').getByLabel('DNI',{exact:false}).fill(document);await expect(page.getByText('Consultando DNI...',{exact:true})).toHaveCount(0);await contact(page);}
test('A: venta con accesorios y doble solicitud del mismo equipo, transición independiente y ficha',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/ventas/nueva');await saleClient(page,dni,'Brand Prueba');
 const item=page.getByTestId('sale-item-0');await item.getByLabel('Marca',{exact:true}).fill('Samsung');await item.getByLabel('Modelo',{exact:true}).fill('S25');await item.getByLabel('Nombre comercial',{exact:true}).fill('Galaxy S25');await item.getByLabel('Color',{exact:true}).fill('Azul');await item.getByLabel('RAM (GB)',{exact:true}).fill('12 GB');await item.getByLabel('Memoria (GB)',{exact:true}).fill('256 GB');await item.getByLabel('IMEI 1 del equipo 1',{exact:true}).fill(first);await item.getByLabel('IMEI 2 del equipo 1',{exact:true}).fill(second);await item.getByLabel('Precio del equipo 1 (S/)',{exact:true}).fill('1000');
 await page.getByRole('button',{name:'+ Ítem',exact:true}).click();await page.getByLabel('Nombre accesorio 1',{exact:true}).fill('Cargador');await page.getByLabel('Cantidad accesorio 1',{exact:true}).fill('2');await page.getByLabel('Precio accesorio 1 (S/)',{exact:true}).fill('30');await page.getByLabel('Descuento de la venta (S/)',{exact:true}).fill('10');await page.getByLabel('Método de pago').selectOption('YAPE');await visual(page,'sale-editor');
 expect(await db.sale.count()).toBe(0);await visual(page,'sale-final');await saveSale(page);await expect(page.getByRole('dialog',{name:'Detalle de venta',exact:true})).toBeVisible();const sale=await db.sale.findFirstOrThrow();expect(sale.total.toFixed(2)).toBe('1050.00');await visual(page,'sale-detail');
 await clientStep(page);await expect(page.getByText('Cliente encontrado',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Equipos vinculados a este documento',exact:true})).toBeVisible();await visual(page,'registration-client');await next(page);
 await page.getByLabel('IMEI 1',{exact:true}).fill(first);await expect(page.getByText('Equipo encontrado:',{exact:false})).toBeVisible();await expect(page.getByLabel('RAM',{exact:true})).toHaveValue('12 GB');await page.getByRole('button',{name:'Recuperar ambos IMEIs del equipo',exact:true}).click();await expect(page.getByLabel('IMEI 2',{exact:true})).toHaveValue(second);
 await page.getByRole('group',{name:'¿REGISTRAR DOS IMEIs?',exact:true}).getByRole('radio',{name:'Sí',exact:true}).check();await page.getByLabel('Celular del IMEI 2',{exact:true}).fill('987654321');await visual(page,'registration-equipment');await next(page);
 await page.getByLabel('Celular IMEI 2',{exact:true}).fill('912345678');await expect(page.getByRole('button',{name:'Siguiente',exact:true})).toBeDisabled();await page.getByLabel('Celular IMEI 2',{exact:true}).fill('987654321');await page.getByLabel('Operador IMEI 2',{exact:true}).selectOption('ENTEL');await visual(page,'registration-conditions');await next(page);
 const image=await sharp({create:{width:80,height:120,channels:3,background:'#175e91'}}).png().toBuffer();await page.getByLabel('Galería DNI FRONTAL IMEI 1',{exact:true}).setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:image});await expect(page.getByText('ADJUNTADA',{exact:true})).toBeVisible();await expect(page.getByAltText('DNI FRONTAL IMEI 1',{exact:true})).toBeVisible();await page.getByRole('button',{name:'QUITAR FOTO',exact:true}).click();await expect(page.getByAltText('DNI FRONTAL IMEI 1',{exact:true})).toHaveCount(0);await visual(page,'registration-evidence');
 await page.locator('.final-review>summary').click();await expect(page.locator('.final-review')).toContainText('Resumen del registro');expect(await db.registrationRequest.count()).toBe(0);await visual(page,'registration-review');await uploadRegistrationEvidence(page);await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();await expect(page.getByRole('heading',{name:'REGISTRO GUARDADO CORRECTAMENTE',exact:true})).toBeVisible();const requests=await db.registrationRequest.findMany({orderBy:{code:'asc'}});expect(requests).toHaveLength(2);
 await page.goto('/registros');await page.getByRole('row').filter({hasText:requests[0].code}).getByRole('button',{name:'Marcar realizado',exact:true}).click();await page.getByLabel('CONFIRMO MARCAR COMO REGISTRADAS LAS SOLICITUDES SELECCIONADAS',{exact:true}).check();await page.getByRole('button',{name:'MARCAR COMO REGISTRADOS',exact:true}).click();await expect(page.getByRole('status').filter({hasText:`${requests[0].code}: REGISTRADO`})).toBeVisible();expect((await db.imei.findUniqueOrThrow({where:{id:requests[1].imeiId}})).registrationStatus).toBe('PENDING');await page.goto(`/registros/${requests[0].id}`);await visual(page,'request-detail');
 await page.goto('/registros');await page.getByRole('row').filter({hasText:requests[1].code}).getByRole('button',{name:'Marcar realizado',exact:true}).click();await page.getByLabel('CONFIRMO MARCAR COMO REGISTRADAS LAS SOLICITUDES SELECCIONADAS',{exact:true}).check();await page.getByRole('button',{name:'MARCAR COMO REGISTRADOS',exact:true}).click();await expect(page.getByRole('status').filter({hasText:`${requests[1].code}: REGISTRADO`})).toBeVisible();await visual(page,'request-list');
 const client=await db.client.findFirstOrThrow();await page.goto(`/clientes/${client.id}`);await expect(page.locator('.client-profile-counts').locator('strong')).toHaveText(['1','2','1']);await visual(page,'client-consolidated');const equipment=await db.equipment.findFirstOrThrow();await page.goto(`/equipos/${equipment.id}`);await visual(page,'equipment-consolidated');expect(await db.equipment.count()).toBe(1);expect(await db.imei.count()).toBe(2);expect(await db.client.count()).toBe(1);expect(errors).toEqual([]);
});
test('B: equipo externo, solo IMEI 2, boleta adjunta y precio cero',async({page})=>{
 await db.client.create({data:{dni,firstName:'Brand',lastName:'Prueba'}});await clientStep(page);await next(page);await page.getByLabel('IMEI 1',{exact:true}).fill(first);await page.getByLabel('IMEI 2',{exact:true}).fill(second);await expect(page.getByText('Buscando equipo...',{exact:true})).toHaveCount(0);await page.getByLabel('Marca',{exact:true}).fill('Honor');await page.getByLabel('Modelo',{exact:true}).fill('Magic');await page.getByLabel('Nombre del equipo',{exact:true}).fill('Magic');await page.getByRole('radio',{name:new RegExp(`IMEI 2: ${second}`)}).check();await next(page);await page.getByRole('group',{name:'¿Tiene caja? *',exact:true}).getByRole('radio',{name:'No',exact:true}).check();await next(page);await expect(page.getByLabel('Galería CAJA DEL EQUIPO',{exact:true})).toBeDisabled();expect(await db.registrationRequest.count()).toBe(0);await uploadRegistrationEvidence(page);await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();await expect(page.getByRole('heading',{name:'REGISTRO GUARDADO CORRECTAMENTE',exact:true})).toBeVisible();expect(await db.registrationRequest.count()).toBe(1);expect((await db.equipment.findFirstOrThrow()).origin).toBe('EXTERNAL');expect((await db.imei.findUniqueOrThrow({where:{value:first}})).registrationStatus).toBeNull();const saved=await db.registrationRequest.findFirstOrThrow();expect(saved.price.toFixed(2)).toBe('0.00');await page.getByRole('link',{name:saved.code,exact:true}).click();await page.getByRole('button',{name:'EDITAR DATOS OPERATIVOS',exact:true}).click();
 await expect(page).toHaveURL(/\?edit=1$/);
 await expect(page.getByRole('heading',{name:`Editar registro ${saved.code}`,exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'DNI',exact:true})).toHaveValue(dni);
 const phone=page.getByLabel('Celular de este registro',{exact:true});
 await expect(phone).toHaveValue('912345678');
 await visual(page,'registration-edit-client');
 await phone.fill('123');
 await next(page);
 await expect(phone).toBeFocused();
 await expect(phone).toHaveAttribute('aria-invalid','true');
 await phone.fill('912345678');
 await next(page);
 await expect(page.getByRole('heading',{name:'Datos del equipo',exact:true})).toBeFocused();
 const imei=page.getByLabel('IMEI 2',{exact:true});
 await expect(imei).toHaveValue(second);
 await expect(imei).toHaveAttribute('readonly','');
 await next(page);
 const price=page.getByLabel('Precio (S/)',{exact:true});
 await price.fill('12.30');
 await page.getByRole('button',{name:'Atrás',exact:true}).click();
 await next(page);
 await expect(price).toHaveValue('12.30');
 await next(page);
 await expect(page.getByRole('heading',{name:'EVIDENCIAS FOTOGRÁFICAS',exact:true})).toBeFocused();
 await expect(page.locator('.evidence-card').filter({hasText:'DNI FRONTAL'}).getByText('GUARDADA')).toBeVisible();
 await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();
 await expect(page.getByText('Datos operativos corregidos.',{exact:true})).toBeVisible();expect((await db.registrationRequest.findUniqueOrThrow({where:{id:saved.id}})).price.toFixed(2)).toBe('12.30');
 await page.goto('/registros');
 await page.getByRole('link',{name:`Editar ${saved.code}`,exact:true}).click();
 await expect(page.getByRole('heading',{name:'Datos del cliente',exact:true})).toBeVisible();
 await phone.fill('999999999');
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Detalle del registro',exact:true})).toBeVisible();
 expect((await db.registrationRequest.findUniqueOrThrow({where:{id:saved.id}})).phone).toBe('912345678');
 await page.goto('/registros/nuevo');await page.locator('.dni-client-fields').getByLabel('DNI',{exact:false}).fill(dni);await contact(page);await expect(page.getByText('Cliente encontrado',{exact:true})).toBeVisible();await next(page);await page.getByLabel('IMEI 1',{exact:true}).fill(second);await expect(page.getByText('Equipo encontrado:',{exact:false})).toBeVisible();await expect(page.getByRole('radio',{name:new RegExp(`IMEI 2: ${second}`)})).toBeDisabled();expect(await db.equipment.count()).toBe(1);
});
test('C: identidad cambia, limpia datos y descarta búsquedas tardías',async({page})=>{
 const client=await db.client.create({data:{dni,firstName:'Brand',lastName:'Prueba'}});for(const [value,brand] of [[first,'Samsung'],[second,'Motorola']])await db.equipment.create({data:{ownerId:client.id,origin:'EXTERNAL',brand,model:'Modelo',commercialName:brand,color:brand==='Samsung'?'Azul':'Rojo',imeis:{create:{slot:1,value}}}});
 await clientStep(page);await next(page);await page.getByLabel('IMEI 1',{exact:true}).fill(first);await expect(page.getByText('SAMSUNG MODELO',{exact:false})).toBeVisible();await page.getByLabel('IMEI 1',{exact:true}).fill('599999999900012');await expect(page.getByLabel('Marca',{exact:true})).toHaveValue('');await expect(page.getByLabel('Color',{exact:true})).toHaveValue('');await expect(page.getByText('Buscando equipo...',{exact:true})).toHaveCount(0);
 await page.route(`**/api/equipment/by-imei/${first}`,async route=>{await new Promise(resolve=>setTimeout(resolve,700));await route.continue().catch(()=>{});});await page.getByLabel('IMEI 1',{exact:true}).fill(first);await expect(page.getByText('Buscando equipo...',{exact:true})).toBeVisible();await page.waitForTimeout(300);await page.getByLabel('IMEI 1',{exact:true}).fill(second);await expect(page.getByText('MOTOROLA MODELO',{exact:false})).toBeVisible();await page.waitForTimeout(800);await expect(page.getByText('SAMSUNG MODELO',{exact:false})).toHaveCount(0);await page.getByLabel('IMEI 2',{exact:true}).fill(first);await expect(page.getByText('Los IMEIs pertenecen a equipos distintos. Corrige la selección.',{exact:true})).toBeVisible();expect(await db.registrationRequest.count()).toBe(0);
});
test('venta activa se advierte antes de revisar; salir requiere confirmar cambios',async({page})=>{
 const client=await db.client.create({data:{dni,firstName:'Brand',lastName:'Prueba'}});const equipment=await db.equipment.create({data:{ownerId:client.id,origin:'STORE',brand:'Samsung',model:'S25',imeis:{create:{slot:1,value:first}}}});await db.sale.create({data:{buyerId:client.id,paymentMethod:'CASH',total:'100',equipment:{create:{equipmentId:equipment.id,unitPrice:'100'}}}});
 await page.goto('/ventas/nueva');await saleClient(page,dni);await page.getByTestId('sale-item-0').getByLabel('IMEI 1 del equipo 1',{exact:true}).fill(first);await expect(page.getByText('ESTE IMEI YA ESTÁ REGISTRADO EN EL SISTEMA. NO SE PUEDE REALIZAR OTRA VENTA CON EL MISMO IMEI.',{exact:true})).toBeVisible();
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('link',{name:'Ventas',exact:true}).click();await expect(page.getByRole('heading',{name:'Registrar venta',exact:true})).toBeVisible();page.once('dialog',dialog=>dialog.accept());await page.getByRole('link',{name:'Ventas',exact:true}).click();await expect(page.getByRole('heading',{name:'Ventas',exact:true})).toBeVisible();expect(await db.sale.count()).toBe(1);
});

test('errores de venta junto al campo y foco, edición completa sin notas, Atrás conserva el borrador',async({page})=>{
 await db.client.create({data:{dni,firstName:'Brand',lastName:'Prueba'}});await page.goto('/ventas/nueva');await saleClient(page,dni);const item=page.getByTestId('sale-item-0');await item.getByLabel('Nombre comercial',{exact:true}).fill('Galaxy');await item.getByLabel('Marca',{exact:true}).fill('Samsung');await item.getByLabel('Modelo',{exact:true}).fill('S25');await item.getByLabel('IMEI 1 del equipo 1',{exact:true}).fill(first);const price=item.getByLabel('Precio del equipo 1 (S/)',{exact:true});await price.fill('-1');await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();await expect(item.getByRole('alert').filter({hasText:'Usa un precio no negativo con hasta dos decimales.'})).toBeVisible();await expect(price).toBeFocused();expect(await db.sale.count()).toBe(0);await price.fill('100');await saveSale(page);await expect(page.getByRole('dialog',{name:'Detalle de venta',exact:true})).toBeVisible();const sale=await db.sale.findFirstOrThrow();await page.getByRole('button',{name:'Editar venta',exact:true}).click();await expect(page.getByLabel('Notas de la venta',{exact:true})).toHaveCount(0);await page.getByLabel('Celular de esta venta',{exact:true}).fill('999888777');await advanceRegistration(page);await expect(page.getByLabel('Descuento (S/)',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();await expect(page.getByText('Venta actualizada.',{exact:true})).toBeVisible();expect((await db.sale.findUniqueOrThrow({where:{id:sale.id}})).buyerPhone).toBe('999888777');expect((await db.sale.findUniqueOrThrow({where:{id:sale.id}})).notes).toBe(sale.notes);
 await page.getByRole('button',{name:'Cerrar Detalle de venta',exact:true}).click();await page.getByRole('link',{name:'Nueva venta',exact:true}).click();await saleClient(page,dni);await page.getByTestId('sale-item-0').getByLabel('IMEI 1 del equipo 1',{exact:true}).fill(second);page.once('dialog',dialog=>dialog.dismiss());await page.goBack();await expect(page.getByRole('heading',{name:'Registrar venta',exact:true})).toBeVisible();await expect(page.getByTestId('sale-item-0').getByLabel('IMEI 1 del equipo 1',{exact:true})).toHaveValue(second);page.once('dialog',dialog=>dialog.accept());await page.goBack();await expect(page.getByRole('heading',{name:'Ventas',exact:true})).toBeVisible();await expect(page.locator('tbody')).toContainText(sale.code);expect(await db.sale.count()).toBe(1);
});
