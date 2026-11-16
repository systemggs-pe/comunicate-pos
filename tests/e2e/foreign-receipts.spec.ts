import 'dotenv/config';
import {test,expect} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {mkdir,readFile} from 'node:fs/promises';
import {isValidImeiLuhn} from '../../shared/imei';
import {seedTestAdmin,testEmail,testPassword,testOrigin} from '../helpers/auth';

const url=process.env.TEST_DATABASE_URL!,target=new URL(url);
if(!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/communicate_pos_test')throw Error('DB dedicada requerida');
const db=new PrismaClient({datasources:{db:{url}}});
const files='.test-results/foreign-receipts';
const dni='72400126';
const demoImei=(index:number)=>Array.from({length:10},(_,digit)=>`5970876544990${index}${digit}`).find(isValidImeiLuhn)!;

test.afterAll(async()=>{await db.$disconnect();});
test('emite desde Ventas, conserva el folio al editar, descarga los siete formatos y permite verificar públicamente',async({page,browser})=>{
 await mkdir(files,{recursive:true});
 await db.$transaction([db.foreignReceipt.deleteMany(),db.foreignReceiptIssuer.deleteMany(),db.authRateLimit.deleteMany()]);
 const buyer=await db.client.upsert({where:{dni},update:{},create:{dni,firstName:'CLIENTE',lastName:'DE PRUEBA'}});
 const equipment=await db.imei.findUnique({where:{value:demoImei(1)},include:{equipment:{include:{saleEquipment:true}}}});
 if(!equipment){
  const device=await db.equipment.create({data:{ownerId:buyer.id,brand:'MARCA DEMO',model:'X1',commercialName:'MODELO DE PRUEBA',
   serialNumber:'SERIE-DEMO-24',color:'NEGRO',storage:'256 GB',origin:'STORE',imeis:{create:[{slot:1,value:demoImei(1)},{slot:2,value:demoImei(2)}]}}});
  await db.sale.create({data:{buyerId:buyer.id,paymentMethod:'CASH',total:900,
   occurredAt:new Date('2026-11-01T16:11:00Z'),equipment:{create:{equipmentId:device.id,unitPrice:700}},
   accessories:{create:{name:'ACCESORIO PRUEBA',quantity:1,unitPrice:200}}}});
 }
 await seedTestAdmin(db);
 await page.goto('/login');
 await page.getByLabel('Correo',{exact:true}).fill(testEmail);
 await page.getByLabel('Contraseña',{exact:true}).fill(testPassword);
 await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
 await page.getByRole('button',{name:'Más',exact:true}).click();
 await page.getByRole('link',{name:'Boletas extranjeras',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Boletas extranjeras',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Emisores',exact:true}).click();
 await page.getByLabel('Nombre del emisor',{exact:true}).fill('EMISOR DE PRUEBA');
 await page.getByLabel('Documento del emisor',{exact:true}).fill('DEMO12345');
 await page.getByLabel('Dirección',{exact:true}).fill('AV. DE PRUEBA 101');
 await page.getByRole('button',{name:'Guardar emisor',exact:true}).click();
 await expect.poll(()=>db.foreignReceiptIssuer.count()).toBe(1);
 for(let format=2;format<=7;format++){
  const response=await page.request.patch(`/api/foreign-receipts/issuers/${format}`,{headers:{Origin:testOrigin},
   data:{nombre:'EMISOR DE PRUEBA',rut:'DEMO12345',direccion:'AV. DE PRUEBA 101',ciudad:'CIUDAD DE PRUEBA',
    giro1:'EQUIPOS Y ACCESORIOS',tipoCambioPenUsd:'4',impuestoPorcentaje:'8'}});
  expect(response.status(),await response.text()).toBe(200);
 }
 await page.reload();
 await page.getByLabel('DNI del cliente',{exact:true}).fill(dni);
 await page.getByRole('button',{name:'Buscar ventas',exact:true}).click();
 await page.getByRole('checkbox',{name:/MODELO DE PRUEBA/}).check();
 await expect(page.locator('.foreign-totals')).toContainText('700.00');
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:`${files}/ventas-${width}.png`,fullPage:true});
 }
 const first=page.waitForEvent('download');
 await page.getByRole('button',{name:'Generar boleta',exact:true}).click();
 await (await first).saveAs(`${files}/FORMATO-1.pdf`);
 const row=await db.foreignReceipt.findFirstOrThrow();
 expect(row.issuedAt.toISOString()).toBe('2026-10-31T16:11:00.000Z');
 for(let format=2;format<=7;format++){
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  await page.getByLabel('Formato PDF',{exact:true}).selectOption(String(format));
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await expect(page.getByRole('heading',{name:`Boleta ${row.folio}`,exact:true})).toBeVisible();
  const downloading=page.waitForEvent('download');
  await page.getByRole('button',{name:'Descargar PDF',exact:true}).click();
  const path=`${files}/FORMATO-${format}.pdf`;
  await (await downloading).saveAs(path);
  expect((await readFile(path)).subarray(0,5).toString()).toBe('%PDF-');
 }
 expect(await db.foreignReceipt.count()).toBe(1);
 const result=await db.foreignReceipt.findUniqueOrThrow({where:{id:row.id}});
 expect(result.issuedAt).toEqual(row.issuedAt);expect(result.folio).toBe(row.folio);
 const publicContext=await browser.newContext({viewport:{width:390,height:900}});
 try{
  const publicPage=await publicContext.newPage();
  await publicPage.goto(new URL('/boleta',page.url()).href);
  await publicPage.getByLabel('Documento del emisor',{exact:true}).fill('DEMO12345');
  await publicPage.getByLabel('Folio',{exact:true}).fill(String(row.folio));
  await publicPage.getByLabel('Fecha de la boleta',{exact:true}).fill('2026-10-31');
  await publicPage.getByLabel('Importe en la moneda de la boleta',{exact:true}).fill(result.totalClp.toFixed(0));
  await publicPage.getByRole('button',{name:'Consultar boleta',exact:true}).click();
  await expect(publicPage.getByRole('status')).toContainText(`Boleta ${row.folio} encontrada`);
  expect(await publicPage.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await publicPage.screenshot({path:`${files}/consulta-390.png`,fullPage:true});
 }finally{await publicContext.close();}
 await page.getByRole('button',{name:'Registro manual',exact:true}).click();
 await page.getByLabel('Documento',{exact:true}).fill(dni);
 await page.getByRole('button',{name:'Buscar cliente',exact:true}).click();
 await expect(page.getByLabel('Nombre completo',{exact:true})).toHaveValue('CLIENTE DE PRUEBA');
 await page.getByLabel('Fecha y hora de la boleta',{exact:true}).fill('2026-11-02T12:34');
 await page.getByLabel('IMEI 1',{exact:true}).fill(demoImei(3));
 await page.getByLabel('Nombre comercial',{exact:true}).fill('MODELO EXTERNO DE PRUEBA');
 await page.getByLabel('Precio (S/)',{exact:true}).fill('200');
 const manual=page.waitForEvent('download');
 await page.getByRole('button',{name:'Generar boleta',exact:true}).click();
 await manual;
 expect((await db.foreignReceipt.findFirstOrThrow({where:{source:'MANUAL'}})).issuedAt.toISOString()).toBe('2026-11-02T17:34:00.000Z');
});
