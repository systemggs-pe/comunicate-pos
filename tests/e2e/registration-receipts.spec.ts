import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile} from 'node:fs/promises';
import {PrismaClient} from '@prisma/client';
import {test,expect,type Page} from '@playwright/test';
import {jsPDF} from 'jspdf';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
import {isValidImeiLuhn} from '../../shared/imei';
import {clearEvidenceFixtures,evidenceTestStorage} from '../helpers/evidence';
import {uploadMissingRegistrationIdentity,uploadRegistrationReceipt} from '../helpers/browser-registration';
import {seedTestAdmin,testEmail,testPassword,testOrigin} from '../helpers/auth';

const target=new URL(process.env.TEST_DATABASE_URL!);
if(!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/communicate_pos_test')throw Error('DB dedicada requerida');
const db=new PrismaClient({datasources:{db:{url:target.toString()}}});
const dni='72712340',folder='.test-results/registration-receipts';
const deviceImei=(id:number)=>Array.from({length:10},(_,digit)=>`597087654736${String(id).padStart(2,'0')}${digit}`).find(isValidImeiLuhn)!;
const issuer={nombre:'EMISOR DE PRUEBA',rut:'DEMO12345',direccion:'DIRECCIÓN DE PRUEBA',tipoCambioPenUsd:'4'};
const customer={type:'DNI',document:dni,fullName:'CLIENTE DE PRUEBA'};
const headers={Origin:testOrigin};

async function uploadRecoEvidence(page:Page,large=true){
 const noise=Buffer.alloc(1500*1100*3);
 let state=12345;
 for(let i=0;i<noise.length;i++){
  state=(Math.imul(state,1664525)+1013904223)>>>0;
  noise[i]=state>>>24;
 }
 const documents=[
  ['DNI FRONTAL IMEI 1','DNI FICTICIO · 72712340'],
  ['DNI REVERSO IMEI 1','NOMBRE · CLIENTE DE PRUEBA'],
  ['CAJA DEL EQUIPO','CAJA · EQUIPO DE PRUEBA'],
  ['BOLETA DE VENTA','BOLETA · TOTAL S/ 700.00'],
  ['IMEI LÓGICO',`IMEI · ${deviceImei(large?8:7)}`],
 ];
 for(const [category,caption] of documents){
  const label=Buffer.from(`<svg width="1500" height="240"><rect width="1500" height="240" fill="white"/><text x="75" y="120" font-family="sans-serif" font-size="64">${caption}</text><text x="75" y="191" font-family="sans-serif" font-size="40">DOCUMENTO FICTICIO PARA PRUEBAS</text></svg>`);
  const source=large?sharp(noise,{raw:{width:1500,height:1100,channels:3}}):sharp({create:{width:1500,height:460,channels:3,background:'#edf1f6'}});
  const buffer=await source.composite([{input:label,top:0,left:0}]).jpeg({quality:95}).toBuffer();
  const input=page.getByLabel(`Galería ${category}`,{exact:true});
  await input.setInputFiles({name:'evidencia-ficticia.jpg',mimeType:'image/jpeg',buffer});
  await expect(page.locator('.evidence-card').filter({has:input}).getByText('ADJUNTADA',{exact:true})).toBeVisible();
 }
}

async function login(page:Page,email=testEmail){
 await page.goto('/login');await page.getByLabel('Correo',{exact:true}).fill(email);
 await page.getByLabel('Contraseña',{exact:true}).fill(testPassword);
 await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
 await expect(page.locator('.home-reference')).toBeVisible();
}
async function next(page:Page){await page.getByRole('button',{name:'Siguiente',exact:true}).click();}
async function start(page:Page){
 await page.goto('/registros/nuevo');
 await page.locator('.dni-client-fields').getByLabel('DNI',{exact:false}).fill(dni);
 await expect(page.getByText('Cliente encontrado',{exact:true})).toBeVisible();
 await page.getByLabel('Celular de este registro',{exact:true}).fill('912345678');
 await page.getByLabel('Dirección de atención',{exact:true}).fill('Dirección de prueba');
 await page.getByRole('combobox',{name:'Departamento',exact:true}).selectOption('LIMA');
 await page.getByLabel('Correo de atención',{exact:true}).fill('registro@example.test');
 await next(page);
}
async function chooseKnown(page:Page,name:string,slot:number|2,dual=false,operatorChoices:string[]=['BITEL','BITEL']){
 await page.getByRole('button',{name:new RegExp(name)}).click();
 if(dual){
  await page.getByRole('group',{name:'¿REGISTRAR DOS IMEIs?',exact:true}).getByRole('radio',{name:'Sí',exact:true}).check();
  await page.getByLabel('Celular del IMEI 2',{exact:true}).fill('987654321');
 }else await page.getByRole('radio',{name:new RegExp(`IMEI ${slot}:`)}).check();
 await next(page);
 const slots=dual?[1,2]:[slot];
 await expect(page.getByRole('button',{name:'Siguiente',exact:true})).toBeDisabled();
 for(const [index,slotNumber] of slots.entries()){
  await page.getByLabel(`Operador IMEI ${slotNumber}`,{exact:true}).selectOption(operatorChoices[index]);
  await page.getByRole('button',{name:`Confirmar operador IMEI ${slotNumber}`,exact:true}).click();
 }
 await next(page);
}
async function known(name:string,ids:number[],origin:'STORE'|'EXTERNAL'='EXTERNAL'){
 const owner=await db.client.findUniqueOrThrow({where:{dni}});
 return db.equipment.create({data:{ownerId:owner.id,origin,brand:'MARCA DEMO',model:'X1',commercialName:name,
  imeis:{create:ids.map((id,index)=>({slot:index+1,value:deviceImei(id)}))}}});
}
async function submit(page:Page,count:number){
 const pending:import('@playwright/test').Download[]=[];
 const capture=(file:import('@playwright/test').Download)=>pending.push(file);
 page.on('download',capture);
 try{
  await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();
  await expect(page.getByRole('heading',{name:'REGISTRO GUARDADO CORRECTAMENTE',exact:true})).toBeVisible();
  await expect.poll(()=>pending.length).toBe(count);
  await expect(page.getByRole('dialog',{name:'Expediente de evidencias A4',exact:true})).toHaveCount(0);
  return pending;
 }finally{page.off('download',capture);}
}

test.beforeEach(async({page})=>{
 await clearEvidenceFixtures(db);
 await db.$transaction([db.foreignReceipt.deleteMany(),db.foreignReceiptIssuer.deleteMany(),db.session.deleteMany(),db.authRateLimit.deleteMany(),
  db.registrationRequestHistory.deleteMany(),db.registrationRequest.deleteMany(),db.registrationOperation.deleteMany(),
  db.saleAccessory.deleteMany(),db.equipmentHistory.deleteMany(),db.auditLog.deleteMany(),db.saleEquipment.deleteMany(),
  db.sale.deleteMany(),db.imei.deleteMany(),db.equipment.deleteMany(),db.client.deleteMany(),db.user.deleteMany()]);
 await db.client.create({data:{dni,fullName:customer.fullName,firstName:'',lastName:''}});
 await seedTestAdmin(db);await mkdir(folder,{recursive:true});
 await login(page);
 expect((await page.request.patch('/api/foreign-receipts/issuers/1',{headers,data:issuer})).status()).toBe(200);
});
test.afterAll(async()=>{await clearEvidenceFixtures(db);await db.$disconnect();});

for(const [title,operators,expected] of [
 ['un IMEI',['MOVISTAR'],[1]],
 ['dos IMEIs Movistar',['MOVISTAR','MOVISTAR'],[1,2]],
 ['operadores mixtos',['CLARO','MOVISTAR'],[2]],
 ['cambio a Entel',['MOVISTAR'],[]],
] as const){
 test(`declaración Movistar: ${title}`,async({page})=>{
  const device=await known('EQUIPO DEMO MOVISTAR',operators.length===2?[7,8]:[7]);
  await start(page);await chooseKnown(page,'EQUIPO DEMO MOVISTAR',1,operators.length===2,[...operators]);
  const declarations=page.getByLabel(/^Subir declaración jurada de Movistar para IMEI [12]$/);
  const firstSlot=operators[0]==='MOVISTAR'?1:2;
  const declaration=page.getByLabel(`Subir declaración jurada de Movistar para IMEI ${firstSlot}`,{exact:true});
  const secondDeclaration=page.getByLabel('Subir declaración jurada de Movistar para IMEI 2',{exact:true});
  await expect(declarations).toHaveCount(operators.filter(operator=>operator==='MOVISTAR').length);
  const gallery=page.getByLabel('Galería BOLETA DE VENTA',{exact:true});
  await expect(gallery).toBeHidden();
  const pdf=new jsPDF();pdf.text(`DECLARACIÓN FICTICIA DE PRUEBA IMEI ${firstSlot}`,20,20);
  pdf.addPage();pdf.text('SEGUNDA PÁGINA DE LA DECLARACIÓN',20,20);
  if(title==='un IMEI'){
   const width=1300,height=900;
   const noise=Buffer.alloc(width*height*3);
   let state=9876;
   for(let index=0;index<noise.length;index++){
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    noise[index]=state>>>24;
   }
   const label=Buffer.from('<svg width="1300" height="900"><rect x="60" y="70" width="1180" height="760" fill="white"/><g font-family="sans-serif" font-size="44" fill="black"><text x="115" y="190">DECLARACIÓN JURADA DE PRUEBA</text><text x="115" y="300">DNI FICTICIO 72712340</text><text x="115" y="410">Equipo de prueba Movistar</text><text x="115" y="520">Firma ficticia para verificación visual</text></g></svg>');
   const scan=await sharp(noise,{raw:{width,height,channels:3}}).composite([{input:label}]).jpeg({quality:100}).toBuffer();
   pdf.addImage(new Uint8Array(scan),'JPEG',20,35,170,118);
  }
  const base=Buffer.from(pdf.output('arraybuffer'));
  const file=(buffer:Buffer)=>({name:'declaracion.pdf',mimeType:'application/pdf',buffer});
  const largeSize=11*1024*1024;
  function largeDeclaration(){
   const trailer=base.lastIndexOf('startxref');
   const padding=Buffer.alloc(largeSize-base.length,32);
   padding[0]=37; // PDF comment before the trailer, preserving the cross-reference offsets.
   padding[padding.length-1]=10;
   return Buffer.concat([base.subarray(0,trailer),padding,base.subarray(trailer)]);
  }
  if(title==='un IMEI'){
   await page.setViewportSize({width:390,height:850});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
   await declaration.setInputFiles(file(Buffer.from('%PDF-1.7\narchivo inválido\n%%EOF')));
   await expect(page.getByRole('alert')).toContainText('Adjunta una declaración jurada en PDF válido.');
   await expect(gallery).toBeHidden();
  }
  await declaration.setInputFiles(file(title==='un IMEI'?largeDeclaration():base));
  await expect(page.getByText('Validada',{exact:true})).toHaveCount(1);
  if(title==='dos IMEIs Movistar'){
   await expect(gallery).toBeHidden();
   await secondDeclaration.setInputFiles(file(base));
   await expect(page.getByText('Validada',{exact:true})).toHaveCount(2);
  }
  await expect(gallery).toBeVisible();
  if(operators.length===2||title==='un IMEI')await uploadRecoEvidence(page,operators.length===2);
  else{await uploadMissingRegistrationIdentity(page);await uploadRegistrationReceipt(page);}
  if(!expected.length){
   await page.getByRole('button',{name:'Atrás',exact:true}).click();
   await page.getByLabel('Operador IMEI 1',{exact:true}).selectOption('ENTEL');
   await expect(page.getByRole('button',{name:'Siguiente',exact:true})).toBeDisabled();
   await page.getByRole('button',{name:'Confirmar operador IMEI 1',exact:true}).click();await next(page);
   await expect(declaration).toHaveCount(0);
   await expect(page.locator('.evidence-preview')).toHaveCount(3);
  }
  if(title==='un IMEI'){
   await page.route('**/api/registration-operations',async route=>{
    const payload=route.request().postDataJSON();
    payload.evidence=payload.evidence.filter((entry:{category:string})=>entry.category!=='MOVISTAR_DECLARATION');
    await route.continue({postData:JSON.stringify(payload)});
   },{times:1});
   await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();
   await expect(page.getByText('Adjunta una declaración jurada válida por cada IMEI de Movistar.',{exact:true})).toBeVisible();
   await page.route('**/api/registration-operations',route=>route.fulfill({status:503,json:{error:{code:'TEST_RETRY',message:'Reintento de prueba'}}}),{times:1});
   await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();
   await expect(page.getByText('Reintento de prueba',{exact:true})).toBeVisible();
   expect(await db.registrationOperation.count()).toBe(0);
  }
  if(title==='dos IMEIs Movistar'){
   await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();
   await expect(page.getByText('Sube un PDF distinto para cada IMEI de Movistar.',{exact:true})).toBeVisible();
   expect(await db.registrationOperation.count()).toBe(0);
   const secondPdf=new jsPDF();
   secondPdf.text('DECLARACIÓN DEL IMEI 2',20,20);
   secondPdf.addPage();secondPdf.text('SEGUNDA PÁGINA DE LA DECLARACIÓN DEL IMEI 2',20,20);
   await secondDeclaration.setInputFiles(file(Buffer.from(secondPdf.output('arraybuffer'))));
   await expect(page.getByText('Validada',{exact:true})).toHaveCount(2);
  }
  let downloads:import('@playwright/test').Download[];
  if(title==='un IMEI'){
   await page.route('**/api/registration-requests/*/evidence-pdf',route=>route.fulfill({status:503,json:{error:{code:'EVIDENCE_PDF_MOVISTAR_SIZE',message:'No se pudo generar un PDF legible de menos de 400 KB'}}}),{times:1});
   await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();
   await expect(page.getByText('No se pudo generar un PDF legible de menos de 400 KB',{exact:true})).toBeVisible();
   expect(await db.registrationOperation.count()).toBe(1);
   const download=page.waitForEvent('download');
   await page.getByRole('button',{name:'Reintentar descarga del PDF',exact:true}).click();
   downloads=[await download];
   expect(await db.registrationOperation.count()).toBe(1);
  }else downloads=await submit(page,operators.length);
  const requests=await db.registrationRequest.findMany({where:{imei:{equipmentId:device.id}},include:{imei:true,evidence:true}});
  const links=requests.flatMap(row=>row.evidence.filter(link=>link.category==='MOVISTAR_DECLARATION').map(link=>({slot:row.imei.slot,link})));
  expect(links.map(row=>row.slot).sort()).toEqual([...expected]);
  expect(new Set(links.map(row=>row.link.evidenceAssetId)).size).toBe(expected.length);
  expect(await db.evidenceAsset.count({where:{category:'MOVISTAR_DECLARATION',status:'READY'}})).toBe(expected.length);
  for(const download of downloads){
   const row=requests.find(request=>`${request.code}.pdf`===download.suggestedFilename())!;
   const file=await readFile((await download.path())!);
   const task=getDocument({data:new Uint8Array(file),useSystemFonts:true});
   try{
    const packet=await task.promise;
    expect(packet.numPages).toBe(row.operator==='MOVISTAR'?4:2);
    if(row.operator==='MOVISTAR'){
     expect(file.length).toBeLessThan(400_000);
     const first=await (await packet.getPage(1)).getTextContent();
     const second=await (await packet.getPage(2)).getTextContent();
     const pageText=(content:typeof first)=>content.items.map(item=>'str' in item?item.str:'').join(' ');
     expect(pageText(first)).toContain(title==='dos IMEIs Movistar'&&row.imei.slot===2?'DECLARACIÓN DEL IMEI 2':`DECLARACIÓN FICTICIA DE PRUEBA IMEI ${row.imei.slot}`);
     expect(pageText(second)).toContain('SEGUNDA PÁGINA');
     const audit=await db.auditLog.findFirstOrThrow({where:{action:'EVIDENCE_PDF_GENERATED',entityId:row.id}});
     expect(audit.metadata).toMatchObject({declarationIncluded:true,downloadBytes:file.length});
     console.log(`PDF Movistar ${title}, IMEI ${row.imei.slot}: ${JSON.stringify(audit.metadata)}`);
    }
   }finally{await task.destroy();}
   if(title==='operadores mixtos'){
    if(row.operator==='CLARO')expect(file.length).toBeGreaterThan(400000);
    await download.saveAs(`${folder}/reco-movistar-${row.operator.toLowerCase()}.pdf`);
    console.log(`RECO ${row.operator}: ${file.length} bytes`);
   }
  }
  if(title==='operadores mixtos'){
   const claro=requests.find(row=>row.operator==='CLARO')!;
   const originals=await db.evidenceAsset.findMany({where:{id:{in:claro.evidence.map(link=>link.evidenceAssetId)}}});
   const storage=evidenceTestStorage();
   try{
    const before=await Promise.all(originals.map(asset=>storage.download(asset.storageKey,asset.fileSize)));
    await page.goto(`/registros/${claro.id}`);
    await page.getByRole('button',{name:'Ticket',exact:true}).click();
    await page.route('**/api/registration-requests/*/evidence-pdf',async route=>{
     expect(route.request().postDataJSON()).toEqual({compressed:true});
     await route.fulfill({status:503,json:{error:{code:'EVIDENCE_PDF_SIZE',message:'No se pudo generar un PDF legible de menos de 400 KB'}}});
    },{times:1});
    await page.getByRole('button',{name:'Descargar RECO comprimido',exact:true}).click();
    await expect(page.getByText('No se pudo generar un PDF legible de menos de 400 KB',{exact:true})).toBeVisible();
    const compressedDownload=page.waitForEvent('download');
    await page.getByRole('button',{name:'Reintentar descarga del RECO comprimido',exact:true}).click();
    const compressed=await compressedDownload;
    expect(compressed.suggestedFilename()).toBe(`${claro.code}-comprimido.pdf`);
    const bytes=await readFile((await compressed.path())!);
    expect(bytes.length).toBeLessThan(400_000);
    const task=getDocument({data:new Uint8Array(bytes)});
    try{expect((await task.promise).numPages).toBe(2);}finally{await task.destroy();}
    const standardSize=(await readFile(`${folder}/reco-movistar-claro.pdf`)).length;
    const audit=await db.auditLog.findFirstOrThrow({where:{action:'EVIDENCE_PDF_GENERATED',entityId:claro.id,metadata:{path:['declarationIncluded'],equals:false}}});
    expect(audit.metadata).toMatchObject({originalBytes:standardSize,downloadBytes:bytes.length});
    console.log(`RECO Claro comprimido: ${standardSize} -> ${bytes.length} bytes`);
    const standardDownload=page.waitForEvent('download');
    await page.getByRole('button',{name:'Descargar PDF',exact:true}).click();
    expect((await readFile((await (await standardDownload).path())!)).length).toBe(standardSize);
    expect(await db.registrationOperation.count()).toBe(1);
    for(const [index,asset] of originals.entries()){
     const bytes=await storage.download(asset.storageKey,asset.fileSize);
     expect(bytes.equals(before[index])).toBe(true);
    }
   }finally{storage.client.destroy();}
  }
  if(title==='un IMEI'){
   const request=requests[0];
   await downloads[0].saveAs(`${folder}/movistar-expediente-prueba.pdf`);
   await page.goto(`/registros/${request.id}`);
   await page.getByRole('button',{name:'Ticket',exact:true}).click();
   const fromDetails=page.waitForEvent('download');
   await page.getByRole('button',{name:'Descargar PDF',exact:true}).click();
   expect((await readFile((await (await fromDetails).path())!)).length).toBeLessThan(400_000);
   await page.getByRole('button',{name:'Cerrar documentos',exact:true}).click();
   const download=page.waitForEvent('download');
   await page.getByRole('button',{name:'Descargar declaración jurada',exact:true}).click();
   const original=await download;
   expect(original.suggestedFilename()).toBe('declaracion-jurada-movistar.pdf');
   expect((await readFile((await original.path())!)).equals(largeDeclaration())).toBe(true);
   expect((await db.evidenceAsset.findUniqueOrThrow({where:{id:links[0].link.evidenceAssetId}})).fileSize).toBe(largeSize);
  }
 });
}

test('editar a Movistar exige la declaración y permite descargar el RECO unido',async({page})=>{
 const device=await known('EQUIPO DEMO EDICIÓN',[7]);
 await start(page);await chooseKnown(page,'EQUIPO DEMO EDICIÓN',1,false,['CLARO']);
 await uploadRegistrationReceipt(page);
 await submit(page,1);
 const row=await db.registrationRequest.findFirstOrThrow({where:{imei:{equipmentId:device.id}}});
 const endpoint=`/api/registration-requests/${row.id}`;
 const declined=await page.request.patch(endpoint,{headers,data:{operator:'MOVISTAR',price:'200'}});
 expect(declined.status()).toBe(400);
 expect((await declined.json()).error.code).toBe('MOVISTAR_DECLARATION_REQUIRED');
 expect(await db.registrationRequest.findUnique({where:{id:row.id}})).toMatchObject({operator:'CLARO',price:row.price});
 await page.goto(`/registros/${row.id}?edit=1`);
 await next(page);await next(page);
 await page.getByLabel('Operador',{exact:true}).selectOption('MOVISTAR');
 await next(page);
 const save=page.getByRole('button',{name:'Confirmar y guardar',exact:true});
 await expect(save).toBeDisabled();
 const pdf=new jsPDF();pdf.text('DECLARACIÓN DE EDICIÓN DEMO',20,25);
 await page.getByLabel('Subir declaración jurada de Movistar para IMEI 1',{exact:true}).setInputFiles({
  name:'declaracion-edicion.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf.output('arraybuffer')),
 });
 await expect(page.getByText('Validada',{exact:true})).toBeVisible();
 await save.click();
 await expect(page).toHaveURL(new RegExp('/registros/'+row.id+'$'));
 const saved=await db.registrationRequest.findUniqueOrThrow({where:{id:row.id},include:{evidence:true}});
 const related=saved.evidence.find(link=>link.category==='MOVISTAR_DECLARATION')!;
 expect(saved.operator).toBe('MOVISTAR');
 expect((await page.request.patch(endpoint,{headers,data:{operator:'MOVISTAR',declarationAssetId:related.evidenceAssetId}})).status()).toBe(200);
 expect((await page.request.delete(`${endpoint}/evidence/${related.id}`,{headers,data:{confirm:true}})).status()).toBe(409);
 expect(await db.registrationOperation.count()).toBe(1);
 const reco=await page.request.post(endpoint+'/evidence-pdf',{headers,data:{}});
 expect(reco.status()).toBe(200);
 const bytes=Buffer.from((await reco.json()).pdfBase64,'base64');
 expect(bytes.length).toBeLessThan(400_000);
 const task=getDocument({data:new Uint8Array(bytes)});
 try{expect((await task.promise).numPages).toBe(3);}finally{await task.destroy();}
});

test('venta de dos equipos: toma la línea correcta, fecha menos un día, reintento y dos RECO con un solo folio',async({page})=>{
 const selected=await known('EQUIPO VENDIDO DEMO',[1,2],'STORE'),other=await known('OTRO EQUIPO DE VENTA',[3],'STORE');
 const buyer=await db.client.findUniqueOrThrow({where:{dni}});
 await db.sale.create({data:{buyerId:buyer.id,paymentMethod:'CASH',total:1000,occurredAt:new Date('2026-11-01T16:11:00Z'),
  equipment:{create:[{equipmentId:selected.id,unitPrice:700},{equipmentId:other.id,unitPrice:300}]}}});
 await start(page);await chooseKnown(page,'EQUIPO VENDIDO DEMO',1,true);
 await expect(page.getByText('Se generará desde la venta',{exact:true})).toBeVisible();
 await expect(page.locator('.registration-receipt-match')).toContainText('700.00');
 await expect(page.locator('.registration-receipt-match')).toContainText('31/10/26');
 await uploadMissingRegistrationIdentity(page);
 const receiptCard=page.locator('.evidence-card').filter({has:page.getByRole('heading',{name:'BOLETA DE VENTA',exact:true})});
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await receiptCard.screenshot({path:`${folder}/boleta-${width}.png`});
 }
 await page.route('**/api/registration-operations',route=>route.fulfill({status:503,contentType:'application/json',
  body:JSON.stringify({error:{code:'REGISTRATION_RECEIPT_STORAGE',message:'Falla recuperable de prueba'}})}),{times:1});
 await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();
 await expect(page.getByText('Falla recuperable de prueba',{exact:true})).toBeVisible();
 expect(await db.foreignReceipt.count()).toBe(0);
 const downloads=await submit(page,2);
 const first=downloads.sort((a,b)=>a.suggestedFilename().localeCompare(b.suggestedFilename()))[0];
 await first.saveAs(`${folder}/${first.suggestedFilename()}`);
 const saved=await db.foreignReceipt.findFirstOrThrow({include:{lines:true,imeis:true}});
 expect(saved.issuedAt.toISOString()).toBe('2026-10-31T16:11:00.000Z');
 expect(saved.purchaseAt?.toISOString()).toBe('2026-11-01T16:11:00.000Z');
 expect(saved.totalPen.toFixed(2)).toBe('700.00');
 expect(saved.lines).toHaveLength(1);expect(saved.lines[0].equipmentId).toBe(selected.id);
 expect(saved.imeis).toHaveLength(2);
 const evidence=await db.registrationEvidence.findMany({where:{category:'PURCHASE_RECEIPT'}});
 expect(evidence).toHaveLength(2);expect(new Set(evidence.map(row=>row.evidenceAssetId)).size).toBe(1);
 const asset=await db.evidenceAsset.findUniqueOrThrow({where:{id:evidence[0].evidenceAssetId}});
 expect(asset.originalStorageKey).toBeNull();
 const evidencePath=`/api/registration-requests/${evidence[0].registrationRequestId}/evidence`;
 expect((await page.request.get(`${evidencePath}/${evidence[0].id}/access?original=true`)).status()).toBe(404);
 const update=await page.request.patch(`/api/foreign-receipts/${saved.id}`,{headers,data:{format:1,issuedAt:'2026-10-30T11:11',expectedUpdatedAt:saved.updatedAt.toISOString()}});
 expect(update.status(),await update.text()).toBe(200);
 expect((await update.json()).issuedAt).toBe('2026-10-30T16:11:00.000Z');
 expect((await db.evidenceAsset.findUniqueOrThrow({where:{id:asset.id}})).checksum).toBe(asset.checksum);
 expect(await db.equipmentReceiptEvidence.findFirstOrThrow({where:{evidenceAssetId:asset.id}})).toMatchObject({version:saved.updatedAt});
});

test('detecta una boleta por cualquiera de los IMEIs, limpia la selección al cambiar y exige elegir si hay dos folios',async({page})=>{
 const existing=await known('EQUIPO CON BOLETA',[1,2]);
 const issue=await page.request.post('/api/foreign-receipts',{headers,data:{source:'MANUAL',format:1,requestKey:randomUUID(),
  customer,issuedAt:'2026-10-28T12:00',devices:[{imei1:deviceImei(1),commercialName:'EQUIPO CON BOLETA',price:'700'}]}});
 expect(issue.status(),await issue.text()).toBe(201);
 const receipt=(await issue.json()).receipt;
 for(const slot of [1,2]){
  const lookup=await page.request.post('/api/registration-receipts/resolve',{headers,data:{dni,equipmentId:existing.id,imeis:[{slot,value:deviceImei(slot),type:'PHYSICAL'}]}});
  expect(lookup.status(),await lookup.text()).toBe(200);
  expect((await lookup.json()).candidates[0]).toMatchObject({id:receipt.id});
 }
 const ambiguous=await known('EQUIPO AMBIGUO DEMO',[3,4]);
 for(const id of [3,4]){
  await db.foreignReceipt.create({data:{folio:9000+id,format:1,source:'IMPORTED',issuedAt:new Date('2026-10-28T17:00Z'),
   document:dni,totalPen:700,totalClp:185000,totalUsd:175,
   snapshot:{customer,issuer,devices:[{imei1:deviceImei(id),commercialName:'EQUIPO AMBIGUO DEMO',price:'700'}]},
   lines:{create:{position:0,equipmentId:ambiguous.id}},imeis:{create:{imei:deviceImei(id)}}}});
 }
 await start(page);await chooseKnown(page,'EQUIPO CON BOLETA',2);
 await expect(page.getByText('Adjuntada automáticamente',{exact:true})).toBeVisible();
 await expect(page.locator('.registration-receipt-match')).toContainText(`Folio ${receipt.folio}`);
 await uploadRegistrationReceipt(page);
 await expect(page.getByLabel('Boleta para el expediente',{exact:true})).toHaveValue('');
 await page.getByLabel('Boleta para el expediente',{exact:true}).selectOption('upload');
 await page.getByRole('button',{name:'2 Datos del equipo completado',exact:true}).click();
 await chooseKnown(page,'EQUIPO AMBIGUO DEMO',2);
 await expect(page.getByText(`Folio ${receipt.folio}`,{exact:false})).toHaveCount(0);
 const choice=page.getByLabel('Boleta para el expediente',{exact:true});
 await expect(choice).toHaveValue('');
 await expect(page.getByRole('button',{name:'Confirmar y guardar',exact:true})).toBeDisabled();
 await choice.selectOption({label:(await choice.locator('option').allTextContents()).find(text=>text.includes('9004'))!});
 await uploadMissingRegistrationIdentity(page);await submit(page,1);
 expect(await db.foreignReceipt.count()).toBe(3);
 const historical=await known('EQUIPO HISTÓRICO DEMO',[5]);
 await db.foreignReceipt.create({data:{folio:9010,format:1,source:'IMPORTED',issuedAt:new Date('2026-10-28T17:00Z'),
  document:'72712341',totalPen:350,totalClp:92000,totalUsd:85,
  snapshot:{customer:{...customer,document:'72712341'},issuer,devices:[{imei1:deviceImei(5),commercialName:'EQUIPO HISTÓRICO DEMO',price:'350'}]},
  lines:{create:{position:0,equipmentId:historical.id}},imeis:{create:{imei:deviceImei(5)}}}});
 await start(page);await chooseKnown(page,'EQUIPO HISTÓRICO DEMO',1);
 await expect(page.getByText(/boleta histórica con un documento de cliente distinto/)).toBeVisible();
 await expect(choice).toHaveValue('');
});

test('emisión manual externa y PDF original de varias páginas en un trámite posterior',async({page})=>{
 await known('EQUIPO EXTERNO MANUAL',[1]);
 await start(page);await chooseKnown(page,'EQUIPO EXTERNO MANUAL',1);
 await uploadMissingRegistrationIdentity(page);
 await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('adjunta la boleta de venta');
 expect(await db.registrationRequest.count()).toBe(0);
 await page.getByRole('button',{name:'Completar datos de la boleta',exact:true}).click();
 await page.getByLabel('Importe de compra (S/)',{exact:true}).fill('350');
 await page.getByLabel('Fecha declarada de la boleta',{exact:true}).fill('2026-11-02T12:34');
 await uploadMissingRegistrationIdentity(page);await submit(page,1);
 const issued=await db.foreignReceipt.findFirstOrThrow({where:{source:'MANUAL'}});
 expect(issued.issuedAt.toISOString()).toBe('2026-11-02T17:34:00.000Z');
 expect(await db.sale.count()).toBe(0);
 const originalDevice=await known('EQUIPO CON PDF ORIGINAL',[2,3]);
 await start(page);await chooseKnown(page,'EQUIPO CON PDF ORIGINAL',1);
 const pdf=new jsPDF();pdf.text('BOLETA FICTICIA - PORTADA',25,24);pdf.addPage();pdf.text('PAGINA DEL EQUIPO - MUESTRA',25,24);
 const bytes=Buffer.from(pdf.output('arraybuffer'));
 await page.getByLabel('Subir PDF original',{exact:true}).setInputFiles({name:'boleta-prueba.pdf',mimeType:'application/pdf',buffer:bytes});
 await page.getByLabel('Página que identifica al equipo',{exact:true}).selectOption('2');
 await page.getByRole('button',{name:'Usar esta página',exact:true}).click();
 const card=page.locator('.evidence-card').filter({has:page.getByRole('heading',{name:'BOLETA DE VENTA',exact:true})});
 await expect(card.getByText('ADJUNTADA',{exact:true})).toBeVisible();
 const [reco]=await submit(page,1);await reco.saveAs(`${folder}/original-pagina-2.pdf`);
 const stored=await db.equipmentReceiptEvidence.findFirstOrThrow({where:{equipmentId:originalDevice.id},include:{evidenceAsset:{include:{links:true}}}});
 expect(stored.evidenceAsset.receiptPage).toBe(2);
 const link=stored.evidenceAsset.links[0];
 const access=await page.request.get(`/api/registration-requests/${link.registrationRequestId}/evidence/${link.id}/access?original=true`);
 expect(access.status()).toBe(200);
 const original=await fetch((await access.json()).url);
 expect(Buffer.from(await original.arrayBuffer())).toEqual(bytes);
 const lookup=await page.request.post('/api/registration-receipts/resolve',{headers,data:{dni,imeis:[{slot:2,value:deviceImei(3),type:'PHYSICAL'}]}});
 expect((await lookup.json()).candidates).toEqual([expect.objectContaining({kind:'STORED',originalPdf:true})]);
 await start(page);await chooseKnown(page,'EQUIPO CON PDF ORIGINAL',2);
 await expect(page.getByText('Adjuntada automáticamente',{exact:true})).toBeVisible();
 await submit(page,1);
 expect(await db.registrationEvidence.count({where:{evidenceAssetId:stored.evidenceAssetId}})).toBe(2);
});

test('vendedor sin permiso de evidencias recibe 403 al buscar o adjuntar una boleta',async({page,browser})=>{
 const role=await db.role.findUniqueOrThrow({where:{code:'SELLER'}});
 const email='seller-receipt@example.test';
 const created=await page.request.post('/api/users',{headers,data:{roleId:role.id,email,name:'Vendedor de prueba',password:testPassword,status:'ACTIVE'}});
 expect(created.status()).toBe(201);
 const context=await browser.newContext();
 try{
  const limited=await context.newPage();await login(limited,email);
  expect((await limited.request.post('/api/registration-receipts/resolve',{headers,data:{dni,imeis:[]}})).status()).toBe(403);
  const denied=await limited.request.post('/api/registration-operations',{headers,data:{receipt:{kind:'STORED',id:randomUUID()}}});
  expect(denied.status()).toBe(403);
 }finally{await context.close();}
});
