import {advanceRegistration} from '../helpers/browser-registration';
import {postBrowserRegistration} from '../helpers/browser-registration';
import {uploadRegistrationEvidence} from '../helpers/browser-registration';
import {testOrigin} from '../helpers/auth';
import {fixtureImei} from '../helpers/imei';
import {test,expect,type Page} from '@playwright/test';
import sharp from 'sharp';
import {finishMvp,mvpDb,resetMvp,loginMvp,registerContact,widthsMvp} from '../helpers/mvp-browser';
import {testPassword} from '../helpers/auth';
import {clearEvidenceFixtures,evidenceTestStorage} from '../helpers/evidence';
test.beforeEach(async({page})=>{await resetMvp();await page.request.post('/api/_test/control',{data:{photo:'ok',nameDelay:0,photoCalls:0}});page.on('dialog',dialog=>dialog.accept());await loginMvp(page);});
test.afterAll(finishMvp);
const image=async(color='#123456')=>({name:'synthetic-identity.png',mimeType:'image/png',buffer:await sharp({create:{width:120,height:160,channels:3,background:color}}).png().toBuffer()});
async function client(){return mvpDb.client.findUniqueOrThrow({where:{dni:'70876543'}});}
// Manual upload/lifecycle controls no longer exist in the simplified vault UI.
// Prepare documents through its authorized HTTP contract, then verify real UI reuse.
const authorization={purpose:'SYNTHETIC REGISTRATION',authorizationReference:'SYNTHETIC CONSENT',confirmed:true};
async function upload(page:Page,clientId:string,category:string,color='#123456',extra:Record<string,string>={}){
 const query=new URLSearchParams({...authorization,confirmed:'true',category,documentType:'MANUAL',...extra});
 const response=await page.request.post(`/api/clients/${clientId}/documents?${query}`,{headers:{Origin:testOrigin,'Content-Type':'image/png'},data:(await image(color)).buffer});expect(response.status()).toBe(201);return response.json();
}
async function manualDocs(page:Page){const c=await client();await upload(page,c.id,'DNI_FRONT');await upload(page,c.id,'DNI_BACK','#654321');await page.goto(`/clientes/${c.id}`);await page.locator('.client-document-access>summary').click();await expect(page.locator('.dni-photo-card')).toHaveCount(2);return c;}
test('Actualizar DNI reemplaza las fotos anteriores de la ficha',async({page})=>{
 const c=await manualDocs(page);
 const oldIds=(await mvpDb.clientDocument.findMany({where:{clientId:c.id}})).map(doc=>doc.id);
 const previous=await page.request.post(`/api/clients/${c.id}/identity-photos`,{headers:{Origin:testOrigin},data:{confirmed:true,documentType:'BLUE'}});
 expect(previous.ok()).toBe(true);
 await page.reload();
 await page.locator('.client-document-access>summary').click();
 const lookup=page.locator('.identity-photo-panel').first();
 await expect(lookup.locator('.dni-photo-card')).toHaveCount(4);
 await lookup.getByText('Actualizar DNI',{exact:true}).click();
 await lookup.getByRole('checkbox',{name:'Tengo permiso para consultar y guardar estas fotos del DNI.'}).check();
 await lookup.getByRole('button',{name:'Actualizar DNI',exact:true}).click();
 await expect(lookup.locator('.dni-photo-card .document-thumbnail')).toHaveCount(2);
 await expect.poll(()=>lookup.locator('.document-thumbnail').evaluateAll(images=>images.every(img=>(img as HTMLImageElement).naturalWidth>0))).toBe(true);
 expect(await mvpDb.clientDocument.count({where:{id:{in:oldIds}}})).toBe(0);
 expect(await mvpDb.clientDocument.count({where:{clientId:c.id,status:'CURRENT'}})).toBe(2);
 await page.reload();
 await page.locator('.client-document-access>summary').click();
 await expect(lookup.locator('.dni-photo-card')).toHaveCount(2);
});
async function createRegistration(page:Page,imei:string){
 await registerContact(page);
 await page.getByLabel('IMEI 1',{exact:true}).fill(imei);await page.getByLabel('Marca',{exact:true}).fill('SAMSUNG');await page.getByLabel('Modelo',{exact:true}).fill('MOCK-C');await page.getByLabel('Nombre del equipo',{exact:true}).fill('EQUIPO SINTÉTICO');await expect(page.getByText('Buscando equipo...',{exact:true})).toHaveCount(0);await page.getByRole('radio',{name:new RegExp('IMEI 1: '+imei)}).check();await advanceRegistration(page);await advanceRegistration(page);await expect(page.getByText('DNI guardado · se adjuntará al registro',{exact:true})).toBeVisible();await page.locator('.final-review>summary').click();await expect(page.locator('.review-document-counts').locator('div').filter({hasText:'Documentos reutilizados'}).locator('dd')).toHaveText('2');await uploadRegistrationEvidence(page);await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();await expect(page.getByRole('heading',{name:'REGISTRO GUARDADO CORRECTAMENTE',exact:true})).toBeVisible();await expect(page.getByRole('dialog',{name:'Expediente de evidencias A4',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Descargar PDF',exact:true})).toBeVisible();return mvpDb.registrationRequest.findFirstOrThrow({where:{imei:{value:imei}}});
}
async function deleteRequest(page:Page,id:string,code:string){await page.goto(`/registros/${id}`);await page.getByRole('dialog',{name:'Detalle del registro',exact:true}).getByRole('button',{name:`ELIMINAR DEFINITIVAMENTE ${code}`,exact:true}).click();await page.getByRole('dialog',{name:'¿Quieres eliminar '+code+'?',exact:true}).getByRole('button',{name:'Confirmar',exact:true}).click();await expect(page).toHaveURL(/\/registros$/);await expect(page.getByRole('heading',{name:'Registros de equipos',exact:true})).toBeVisible();}
test('expediente, cliente recurrente, reutilización, registros independientes y eliminación compartida',async({page})=>{
 const c=await manualDocs(page);await expect.poll(()=>page.locator('.dni-photo-card .document-thumbnail').evaluateAll(images=>images.every(img=>(img as HTMLImageElement).naturalWidth>0))).toBe(true);await widthsMvp(page);const a=await createRegistration(page,'597087654360011');await page.goto(`/clientes/${c.id}`);await page.locator('.client-document-access>summary').click();const vault=await(await page.request.get(`/api/clients/${c.id}/documents`)).json();expect(vault.history).toHaveLength(3);expect(vault.history).toContainEqual(expect.objectContaining({category:'PURCHASE_RECEIPT',linkedDocumentId:null}));const b=await createRegistration(page,'597087654370010');expect(await mvpDb.evidenceAsset.count({where:{category:{not:'PURCHASE_RECEIPT'}}})).toBe(2);expect(await mvpDb.registrationEvidence.count({where:{category:{not:'PURCHASE_RECEIPT'}}})).toBe(4);const assets=await mvpDb.evidenceAsset.findMany({where:{category:{not:'PURCHASE_RECEIPT'}}});await deleteRequest(page,a.id,a.code);expect(await mvpDb.clientDocument.count()).toBe(2);await page.goto(`/clientes/${c.id}`);await page.locator('.client-document-access>summary').click();await expect(page.locator('.dni-photo-card .document-thumbnail')).toHaveCount(2);await expect.poll(()=>page.locator('.dni-photo-card .document-thumbnail').evaluateAll(images=>images.every(img=>(img as HTMLImageElement).naturalWidth>0))).toBe(true);
 const docs=await mvpDb.clientDocument.findMany();for(const d of docs){const removed=await page.request.delete(`/api/clients/${c.id}/documents/${d.id}`,{headers:{Origin:testOrigin},data:{confirm:true}});expect(removed.status()).toBe(200);expect((await removed.json()).retained).toBe(true);}
 const storage=evidenceTestStorage();try{for(const asset of assets)expect(await storage.exists(asset.storageKey)).toBe(true);await deleteRequest(page,b.id,b.code);for(const asset of assets)expect(await storage.exists(asset.storageKey)).toBe(false);}finally{storage.client.destroy();}expect(await mvpDb.client.count()).toBe(1);expect(await mvpDb.evidenceAsset.count({where:{category:{not:'PURCHASE_RECEIPT'}}})).toBe(0);
});
test('CODART→cliente: identifica cada imagen con evidencia, luego permite reutilización',async({page})=>{
 await page.request.post('/api/_test/control',{data:{photo:'ambiguous'}});const c=await client();await page.goto(`/clientes/${c.id}`);await page.locator('.client-document-access>summary').click();const lookup=page.locator('.identity-photo-panel').first();await lookup.getByRole('checkbox',{name:'Tengo permiso para consultar y guardar estas fotos del DNI.'}).check();await lookup.getByRole('button',{name:'Buscar fotos',exact:true}).click();await expect(page.locator('.dni-photo-card')).toHaveCount(2);expect(await mvpDb.clientDocument.count({where:{category:'IDENTITY_IMAGE'}})).toBe(2);
 for(const [ordinal,side]of [[1,'DNI_FRONT'],[2,'DNI_BACK']] as const){const card=page.locator('.dni-photo-card').nth(ordinal-1);await card.locator('select').selectOption(side);await card.getByRole('button',{name:'Guardar lado',exact:true}).click();await expect(card.getByRole('heading',{name:side==='DNI_FRONT'?'Anverso':'Reverso',exact:true})).toBeVisible();}
 await createRegistration(page,'597087654380019');expect(await mvpDb.evidenceAsset.count({where:{category:{not:'PURCHASE_RECEIPT'}}})).toBe(2);expect(await mvpDb.registrationEvidence.count({where:{category:{not:'PURCHASE_RECEIPT'}}})).toBe(2);await page.goto(`/clientes/${c.id}`);await page.locator('.client-document-access>summary').click();await widthsMvp(page);
});
test('reemplazo por API autorizado mantiene documento antiguo en registro y nueva versión vigente',async({page})=>{
 const c=await manualDocs(page),row=await createRegistration(page,'597087654390018'),old=await mvpDb.clientDocument.findFirstOrThrow({where:{category:'DNI_FRONT'}});await page.goto(`/clientes/${c.id}`);await page.locator('.client-document-access>summary').click();await upload(page,c.id,'DNI_FRONT','#aa7788',{replace:'true',expectedDocumentId:old.id});await page.reload();await page.locator('.client-document-access>summary').click();await expect(page.locator('.dni-photo-card')).toHaveCount(2);expect(await mvpDb.clientDocument.count()).toBe(3);expect((await mvpDb.clientDocument.findUniqueOrThrow({where:{id:old.id}})).status).toBe('REPLACED');expect(await mvpDb.registrationEvidence.count({where:{registrationRequestId:row.id,evidenceAssetId:old.evidenceAssetId}})).toBe(1);await widthsMvp(page);
});
test('permiso denegado desde cliente y API, sin exponer miniaturas ni acciones',async({page})=>{
 const c=await manualDocs(page),role=await mvpDb.role.findUniqueOrThrow({where:{code:'SELLER'}});const created=await page.request.post('/api/users',{headers:{Origin:'http://127.0.0.1:5175'},data:{email:'vault-limited@example.test',name:'Sintético limitado',password:testPassword,roleId:role.id,status:'ACTIVE'}});expect(created.status()).toBe(201);await page.getByRole('button',{name:'Cerrar Ficha del cliente',exact:true}).click();await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.getByLabel('Correo',{exact:true}).fill('vault-limited@example.test');await page.getByLabel('Contraseña',{exact:true}).fill(testPassword);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.locator('.home-reference')).toBeVisible();await page.goto(`/clientes/${c.id}`);await page.locator('.client-document-access>summary').click();await expect(page.getByText('Tu rol no tiene permiso para consultar fotografías privadas.',{exact:true})).toBeVisible();await expect(page.locator('.document-thumbnail')).toHaveCount(0);expect((await page.request.get(`/api/clients/${c.id}/documents`)).status()).toBe(403);await widthsMvp(page);
});
test('caducidad bloquea reutilización y renovación por API explícita conserva el mismo archivo',async({page})=>{
 const c=await manualDocs(page),d=await mvpDb.clientDocument.findFirstOrThrow({where:{category:'DNI_FRONT'}});await mvpDb.clientDocument.update({where:{id:d.id},data:{expiresAt:new Date(0)}});await page.goto(`/clientes/${c.id}`);await page.locator('.client-document-access>summary').click();await expect(page.getByRole('heading',{name:'Anverso',exact:true})).toHaveCount(0);const listed=await(await page.request.get(`/api/clients/${c.id}/documents`)).json();expect(listed.documents.find((doc:{id:string})=>doc.id===d.id).retentionDue).toBe(true);const rejected=await page.request.post('/api/registration-operations',{headers:{Origin:testOrigin},data:{...workflowInput(),documentEvidence:[{documentId:d.id,imeiValues:workflowInput().imeis.map(i=>i.value)}]}});expect(rejected.status()).toBe(409);expect(await mvpDb.equipment.count()).toBe(0);const renewed=await page.request.patch(`/api/clients/${c.id}/documents/${d.id}`,{headers:{Origin:testOrigin},data:{...authorization,category:'DNI_FRONT'}});expect(renewed.status()).toBe(200);await page.reload();await page.locator('.client-document-access>summary').click();await expect(page.getByRole('heading',{name:'Anverso',exact:true})).toBeVisible();expect(await mvpDb.evidenceAsset.count()).toBe(2);
});
import {workflowInput} from '../helpers/workflow';
test('evidencia desde edición RECO se guarda automáticamente en cliente sin copia',async({page})=>{
 const c=await client(),input=workflowInput();input.imeis=input.imeis.map((i,index)=>({...i,value:fixtureImei(440000+index)}));input.requests=input.requests.map((r,index)=>({...r,value:input.imeis[index].value}));
 const result=await postBrowserRegistration(page,input);expect(result.status()).toBe(201);const operation=await result.json(),row=operation.requests[0];
 // Prepare a historical request without retained photos; its original creation satisfied DNI.
 await clearEvidenceFixtures(mvpDb);await page.goto(`/registros/${row.id}`);await page.getByRole('dialog',{name:'Detalle del registro',exact:true}).getByRole('button',{name:'EDITAR DATOS OPERATIVOS',exact:true}).click();
 for(let step=0;step<3;step++)await advanceRegistration(page);
 const evidence=page.locator('.evidence-card').filter({has:page.getByRole('heading',{name:'DNI FRONTAL',exact:true})});await evidence.getByLabel('Galería DNI FRONTAL',{exact:true}).setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('INVALID')});await expect(page.getByRole('alert').filter({hasText:'EL CONTENIDO DEL ARCHIVO NO COINCIDE CON SU TIPO.'})).toBeVisible();await evidence.getByLabel('Galería DNI FRONTAL',{exact:true}).setInputFiles(await image());await page.getByRole('button',{name:'CONFIRMAR FOTO',exact:true}).click();await expect(evidence.getByText('GUARDADA',{exact:true})).toBeVisible();
 await page.goto(`/clientes/${c.id}`);await page.locator('.client-document-access>summary').click();const savedVault=await(await page.request.get(`/api/clients/${c.id}/documents`)).json();expect(savedVault.history).toHaveLength(1);expect(savedVault.history[0].linkedDocumentId).toBe(savedVault.documents[0].id);await expect(page.locator('.dni-photo-card')).toHaveCount(1);await expect.poll(()=>page.locator('.dni-photo-card .document-thumbnail').evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);await expect(page.getByRole('button',{name:'INCORPORAR AL EXPEDIENTE',exact:true})).toHaveCount(0);expect(savedVault.documents[0].category).toBe('DNI_FRONT');expect(await mvpDb.evidenceAsset.count()).toBe(1);expect(await mvpDb.registrationEvidence.count()).toBe(1);await widthsMvp(page);
});
