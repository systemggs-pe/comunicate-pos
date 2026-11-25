import {acceptPhotoEdit,advanceRegistration,uploadRegistrationReceipt} from '../helpers/browser-registration';
import {test,expect,type Page} from '@playwright/test';
import sharp from 'sharp';
import {finishMvp,mvpDb,resetMvp,loginMvp,registerContact} from '../helpers/mvp-browser';
import {fixtureImei} from '../helpers/imei';

test.beforeEach(async({page})=>{
 await resetMvp();await loginMvp(page);
 await page.request.post('/api/_test/control',{data:{photo:'ok',photoDelay:0,photoCalls:0}});
});
test.afterAll(finishMvp);

async function equipment(page:Page,index:number){
 const imei=fixtureImei(82000+index);
 await page.getByLabel('IMEI 1',{exact:true}).fill(imei);
 await page.getByLabel('Marca',{exact:true}).fill('MARCA FICTICIA');
 await page.getByLabel('Modelo',{exact:true}).fill('TEST');
 await page.getByLabel('Nombre del equipo',{exact:true}).fill('EQUIPO DE PRUEBA');
 await page.getByRole('radio',{name:new RegExp(`IMEI 1: ${imei}`)}).check();
 await advanceRegistration(page);
 await expect(page.getByRole('button',{name:'Confirmar operador IMEI 1',exact:true})).toBeVisible();
 await advanceRegistration(page);
 return imei;
}
async function submit(page:Page,imei:string,expectedSides:number){
 await uploadRegistrationReceipt(page);
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();
 await expect(page.getByRole('heading',{name:'REGISTRO GUARDADO CORRECTAMENTE'})).toBeVisible();
 expect((await download).suggestedFilename()).toMatch(/^RECO-.*\.pdf$/);
 const request=await mvpDb.registrationRequest.findFirstOrThrow({where:{imei:{value:imei}}});
 const links=await mvpDb.registrationEvidence.findMany({where:{registrationRequestId:request.id,category:{in:['DNI_FRONT','DNI_BACK']}}});
 expect(links).toHaveLength(expectedSides);
 return links;
}
async function extract(page:Page){
 await page.getByLabel('Tengo permiso para consultar y guardar estas fotos del DNI.').check();
 await page.getByRole('button',{name:'Extraer fotos del DNI desde CODART',exact:true}).click();
}

test('permite guardar sin fotos cuando falla CODART',async({page})=>{
 await page.request.post('/api/_test/control',{data:{photo:'credits'}});
 await registerContact(page);const imei=await equipment(page,1);
 await extract(page);
 await expect(page.getByRole('button',{name:'Reintentar extracción desde CODART'})).toBeVisible();
 await expect(page.getByRole('alert')).toContainText('No hay saldo disponible');
 await submit(page,imei,0);
 expect(await mvpDb.clientDocument.count()).toBe(0);
});

test('guarda una cara manual, reutiliza y conserva la versión anterior al reemplazarla',async({page})=>{
 const upload=async(color:string)=>{
  const buffer=await sharp({create:{width:80,height:120,channels:3,background:color}}).png().toBuffer();
  await page.getByLabel('Galería DNI FRONTAL IMEI 1',{exact:true}).setInputFiles({name:'dni-sintetico.png',mimeType:'image/png',buffer}); await acceptPhotoEdit(page);
  await expect(page.locator('.evidence-card').filter({has:page.getByLabel('Galería DNI FRONTAL IMEI 1',{exact:true})}).getByText('ADJUNTADA',{exact:true})).toBeVisible();
 };
 await registerContact(page);const initial=await equipment(page,2);await upload('#647b84');
 const [first]=await submit(page,initial,1);
 await registerContact(page);const second=await equipment(page,3);
 await expect(page.getByText('Una foto del DNI guardada · se adjuntará al registro')).toBeVisible();
 const [reused]=await submit(page,second,1);expect(reused.evidenceAssetId).toBe(first.evidenceAssetId);
 await registerContact(page);const third=await equipment(page,4);
 await page.getByRole('button',{name:'Confirmar reemplazo de DNI frontal',exact:true}).click();await upload('#3a7091');
 const [replacement]=await submit(page,third,1);expect(replacement.evidenceAssetId).not.toBe(first.evidenceAssetId);
 expect((await mvpDb.registrationEvidence.findUniqueOrThrow({where:{id:first.id}})).evidenceAssetId).toBe(first.evidenceAssetId);
 expect(await mvpDb.clientDocument.count({where:{category:'DNI_FRONT',status:'CURRENT',evidenceAssetId:replacement.evidenceAssetId}})).toBe(1);
});

test('revisa una foto de CODART, la guarda con el registro y la muestra en la ficha',async({page})=>{
 await page.request.post('/api/_test/control',{data:{photo:'one'}});
 await registerContact(page);const imei=await equipment(page,5);
 await page.setViewportSize({width:390,height:850});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await extract(page);await page.getByRole('button',{name:'Usar como reverso',exact:true}).click();
 expect(await mvpDb.clientDocument.count({where:{status:'CURRENT'}})).toBe(0);
 const [link]=await submit(page,imei,1);expect(link.category).toBe('DNI_BACK');
 const client=await mvpDb.client.findUniqueOrThrow({where:{dni:'70876543'}});
 const docs=await page.request.get(`/api/clients/${client.id}/documents`);
 expect((await docs.json()).documents).toEqual([expect.objectContaining({category:'DNI_BACK',status:'CURRENT',asset:expect.objectContaining({id:link.evidenceAssetId})})]);
 await page.goto(`/clientes/${client.id}`);
 await page.locator('.client-document-access > summary').click();
 await expect(page.locator('.dni-photo-card').getByRole('heading',{name:'Reverso',exact:true})).toBeVisible();
});

test('descarta la respuesta tardía al cambiar el DNI',async({page})=>{
 await mvpDb.client.create({data:{dni:'71012345',firstName:'OTRA',lastName:'PERSONA FICTICIA'}});
 await page.request.post('/api/_test/control',{data:{photo:'one',photoDelay:2500}});
 await registerContact(page);await equipment(page,6);
 await extract(page);
 await expect.poll(async()=>((await (await page.request.get('/api/_test/control')).json()).photoCalls)).toBe(1);
 await page.getByRole('button',{name:'1 Datos del cliente completado',exact:true}).click();
 await page.locator('.dni-client-fields').getByLabel('DNI',{exact:false}).fill('71012345');
 await expect.poll(()=>mvpDb.clientDocument.count({where:{status:'REVIEW'}})).toBe(1);
 await registerContact(page,'71012345');const imei=await equipment(page,7);
 await expect(page.getByRole('button',{name:'Usar como reverso',exact:true})).toHaveCount(0);
 await submit(page,imei,0);
 expect(await mvpDb.clientDocument.count({where:{status:'CURRENT'}})).toBe(0);
});
