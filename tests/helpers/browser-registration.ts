import {expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {checksum} from '../../server/evidence/image';
import {testOrigin} from './auth';
export async function postBrowserRegistration(page:Page,input:object){
 const body=input as {idempotencyKey:string;requests:{value:string}[]};const evidence=[];
 for(const category of ['DNI_FRONT','DNI_BACK']){
  const buffer=await sharp({create:{width:80,height:120,channels:3,background:category==='DNI_FRONT'?'#123456':'#654321'}}).png().toBuffer();
  const init=await page.request.post('/api/evidence/uploads',{headers:{Origin:testOrigin},data:{operationKey:body.idempotencyKey,idempotencyKey:randomUUID(),category,mimeType:'image/png',fileSize:buffer.length,checksum:checksum(buffer)}});expect(init.status()).toBe(201);const draft=await init.json();
  expect((await fetch(draft.uploadUrl,{method:'PUT',headers:draft.headers,body:new Uint8Array(buffer)})).status).toBe(200);expect((await page.request.post(`/api/evidence/uploads/${draft.assetId}/verify`,{headers:{Origin:testOrigin},data:{}})).status()).toBe(200);
  evidence.push({assetId:draft.assetId,category,imeiValues:body.requests.map(r=>r.value)});
 }return page.request.post('/api/registration-operations',{headers:{Origin:testOrigin},data:{...input,evidence}});
}

export async function uploadMissingRegistrationIdentity(page:Page){
 if(!await page.getByRole('heading',{name:'EVIDENCIAS FOTOGRÁFICAS',exact:true}).count())return;
 for(const [side,color] of [['DNI FRONTAL','#123456'],['DNI REVERSO','#654321']]){
  const input=page.getByLabel(new RegExp(`^Galería ${side} IMEI [12]$`));if(!await input.count())continue;
  const card=page.locator('.evidence-card').filter({has:input});if(await card.getByText('ADJUNTADA',{exact:true}).count())continue;
  const buffer=await sharp({create:{width:80,height:120,channels:3,background:color}}).png().toBuffer();await input.setInputFiles({name:'synthetic-dni.png',mimeType:'image/png',buffer});await expect(card.getByText('ADJUNTADA',{exact:true})).toBeVisible();
 }
}
