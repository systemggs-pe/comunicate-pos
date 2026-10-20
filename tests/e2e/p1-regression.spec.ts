import {test,expect,type Page} from '@playwright/test';
import sharp from 'sharp';
import {finishMvp,mvpDb,resetMvp,loginMvp,registerContact} from '../helpers/mvp-browser';
import {fixtureImei} from '../helpers/imei';
import {saleClient,saveSale} from '../helpers/sale-form';
test.beforeEach(async({page})=>{await resetMvp();await loginMvp(page);});
test.afterAll(finishMvp);
const next=(page:Page)=>page.getByRole('button',{name:'Siguiente',exact:true}).click();
async function equipment(page:Page,seed:number){
 await page.getByLabel('IMEI 1',{exact:true}).fill(fixtureImei(seed));await page.getByLabel('IMEI 2',{exact:true}).fill(fixtureImei(seed+1));
 await page.getByLabel('Marca',{exact:true}).fill('Samsung');await page.getByLabel('Modelo',{exact:true}).fill('SYNTHETIC');await page.getByLabel('Nombre del equipo',{exact:true}).fill('Equipo sintético');
 await page.getByRole('group',{name:'¿REGISTRAR DOS IMEIs?',exact:true}).getByRole('radio',{name:'Sí',exact:true}).check();
}
test('DNI obligatorio, segundo celular y reutilización automática en el siguiente trámite',async({page})=>{
 await registerContact(page);await equipment(page,88000);
 await next(page);await expect(page.getByRole('status').filter({hasText:'Paso 2 de 4'})).toBeVisible();expect(await mvpDb.registrationRequest.count()).toBe(0);
 await page.getByLabel('Celular del IMEI 2',{exact:true}).fill('912345678');await next(page);await expect(page.locator('.imei-validation-feedback').filter({hasText:'El celular del IMEI 2 debe ser distinto del IMEI 1.'})).toBeVisible();
 await page.getByLabel('Celular del IMEI 2',{exact:true}).fill('987654321');await next(page);await expect(page.getByLabel('Celular IMEI 2',{exact:true})).toHaveValue('987654321');await next(page);
 await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();await expect(page.getByText('Adjunta el DNI frontal para continuar.',{exact:true})).toBeVisible();expect(await mvpDb.equipment.count()).toBe(0);
 for(const [side,color] of [['DNI FRONTAL','#123456'],['DNI REVERSO','#654321']]){
  const buffer=await sharp({create:{width:80,height:120,channels:3,background:color}}).png().toBuffer();await page.getByLabel(`Galería ${side} IMEI 1`,{exact:true}).setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer});
  await expect(page.getByText('ADJUNTADA',{exact:true})).toHaveCount(side==='DNI FRONTAL'?1:2);
  if(side==='DNI FRONTAL'){await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();await expect(page.getByText('Adjunta el DNI posterior para continuar.',{exact:true})).toBeVisible();expect(await mvpDb.registrationRequest.count()).toBe(0);}
 }
 await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();await expect(page.getByRole('heading',{name:'REGISTRO GUARDADO CORRECTAMENTE',exact:true})).toBeVisible();
 await expect(page.getByRole('dialog',{name:'Expediente de evidencias A4',exact:true})).toBeVisible();expect(await mvpDb.registrationRequest.count()).toBe(2);expect(await mvpDb.registrationEvidence.count()).toBe(4);expect(await mvpDb.clientDocument.count()).toBe(2);expect(await mvpDb.evidenceAsset.count()).toBe(2);
 await page.getByRole('button',{name:'CERRAR PDF',exact:true}).click();await registerContact(page);await equipment(page,88100);await page.getByLabel('Celular del IMEI 2',{exact:true}).fill('987654321');await next(page);await next(page);
 await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();await expect(page.getByRole('heading',{name:'REGISTRO GUARDADO CORRECTAMENTE',exact:true})).toBeVisible();expect(await mvpDb.registrationRequest.count()).toBe(4);expect(await mvpDb.registrationEvidence.count()).toBe(8);expect(await mvpDb.evidenceAsset.count()).toBe(2);expect(await mvpDb.clientDocument.count()).toBe(2);
});
test('venta de dos pasos valida Luhn y conserva vista automática, edición y ticket',async({page})=>{
 await page.goto('/ventas/nueva');await saleClient(page,'70876543');const item=page.getByTestId('sale-item-0');
 await item.getByLabel('Nombre comercial',{exact:true}).fill('Equipo sintético');await item.getByLabel('Marca',{exact:true}).fill('Samsung');await item.getByLabel('Modelo',{exact:true}).fill('SYNTHETIC');
 await item.getByLabel('IMEI 1 del equipo 1',{exact:true}).fill('123456789012345');await item.getByLabel('Precio del equipo 1 (S/)',{exact:true}).fill('100.10');await expect(page.getByRole('button',{name:'Confirmar y guardar',exact:true})).toBeDisabled();expect(await mvpDb.sale.count()).toBe(0);
 await item.getByLabel('IMEI 1 del equipo 1',{exact:true}).fill(fixtureImei(88900));await item.getByLabel('IMEI 2 del equipo 1',{exact:true}).fill(fixtureImei(88901));await saveSale(page);
 expect(await mvpDb.sale.count()).toBe(1);expect(await mvpDb.imei.count()).toBe(2);await page.getByRole('button',{name:'Editar venta',exact:true}).click();await expect(page.getByRole('heading',{name:/Editar venta/})).toBeVisible();
});
