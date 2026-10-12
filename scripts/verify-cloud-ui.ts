import {createServer} from 'node:https';
import {spawnSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import express from 'express';
import {chromium,expect} from '@playwright/test';
import {phase9Fixture,fixtureEmail,fixturePassword} from './lib/phase9-fixture.js';
import {createApp} from '../server/app.js';
import {MockDniProvider} from '../server/dni/providers.js';
const directory='.test-results/phase10a';await mkdir(directory,{recursive:true});
const generated=spawnSync(process.env.PDF_TEST_PYTHON??'python',['scripts/local-test-tls.py',directory],{stdio:'pipe',windowsHide:true});if(generated.status!==0)throw new Error('LOCAL_TLS_FIXTURE_FAILED');
const tls={key:await readFile(`${directory}/tls.key`),cert:await readFile(`${directory}/tls.crt`)};
const f=await phase9Fixture(),oldMode=process.env.NODE_ENV,oldOrigins=process.env.AUTH_ALLOWED_ORIGINS;
const root=resolve(`${directory}/cloud-dist`),host=express(),headers=await readFile('public/_headers','utf8');
for(const line of headers.split(/\r?\n/).filter(line=>line.startsWith('  ')&&!line.includes('Cache-Control'))){const split=line.indexOf(':');host.use((_req,res,next)=>{res.set(line.slice(2,split),line.slice(split+1).trim());next();});}
host.use((req,res,next)=>{res.set('Cache-Control',req.path.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache, max-age=0, must-revalidate');next();});
host.use(express.static(root,{dotfiles:'allow'}));
const routeRules=(await readFile('public/_redirects','utf8')).trim().split(/\r?\n/).map(line=>line.split(' ')[0]);
host.use((req,res)=>{const matches=routeRules.some(route=>route.endsWith('*')?req.path.startsWith(route.slice(0,-1)):req.path===route);if(matches)res.sendFile(root+'/index.html',{dotfiles:'allow'});else res.status(404).sendFile(root+'/404.html',{dotfiles:'allow'});});
const front=createServer(tls,host);await new Promise<void>(yes=>front.listen(0,'127.0.0.1',yes));const address=front.address();if(!address||typeof address==='string')throw new Error('TLS_FRONTEND_LISTEN');const base=`https://app.example.test:${address.port}`;
process.env.NODE_ENV='production';process.env.AUTH_ALLOWED_ORIGINS=base;
const api=createServer(tls,createApp(f.db,{evidenceStorage:f.storage,dniProvider:new MockDniProvider()}));await new Promise<void>(yes=>api.listen(0,'127.0.0.1',yes));const apiAddress=api.address();if(!apiAddress||typeof apiAddress==='string')throw new Error('TLS_API_LISTEN');const apiBase=`https://api.example.test:${apiAddress.port}/api`;
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try{
 const built=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir',root],{env:{...process.env,VITE_API_BASE_URL:apiBase},stdio:'pipe',windowsHide:true});if(built.status!==0)throw new Error('CLOUD_FRONTEND_BUILD_FAILED');
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP *.example.test 127.0.0.1','--no-proxy-server']});const context=await browser.newContext({ignoreHTTPSErrors:true}),page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.name));page.on('console',m=>{if(m.type()==='error'&&/Content Security Policy|violat.*directive/i.test(m.text()))errors.push('CSP');});
 for(const route of ['/login','/dashboard','/clientes','/registros','/ventas','/reportes','/configuracion']){const response=await page.goto(base+route);expect(response?.status()).toBe(200);await page.getByRole('heading',{name:'Iniciar sesión'}).waitFor();}
 await page.getByLabel('Correo',{exact:true}).fill(fixtureEmail);await page.getByLabel('Contraseña',{exact:true}).fill(fixturePassword);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.waitForURL('**/dashboard');
 const cookies=await context.cookies();const session=cookies.find(cookie=>cookie.name==='__Host-pos_session');expect(session).toMatchObject({httpOnly:true,secure:true,sameSite:'Lax',domain:'api.example.test',path:'/'});
 const browserStatus=await page.evaluate(async(url)=>{const response=await fetch(url+'/auth/me',{credentials:'include'});return response.status;},apiBase);expect(browserStatus).toBe(200);
 for(const route of ['/dashboard','/clientes','/registros','/ventas','/reportes','/configuracion']){await page.goto(base+route);await page.locator('main h1').first().waitFor();await page.waitForLoadState('networkidle');}
 const privatePhoto=await page.evaluate(async({apiBase,requestId,linkId})=>{const response=await fetch(`${apiBase}/registration-requests/${requestId}/evidence/${linkId}/access`,{credentials:'include'});return {status:response.status,data:await response.json()};},{apiBase,requestId:f.link.registrationRequestId,linkId:f.link.id});expect(privatePhoto.status).toBe(200);expect((await fetch(privatePhoto.data.url)).status).toBe(200);
 const csv=await page.evaluate(async(url)=>{const response=await fetch(url+'/reports/export?type=sales&preset=month',{credentials:'include'});return {status:response.status,text:await response.text()};},apiBase);expect(csv.status).toBe(200);expect(csv.text.length).toBeGreaterThan(20);
 const denied=await page.evaluate(async(url)=>{const response=await fetch(url+'/auth/logout',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Unapproved-Header':'blocked'},body:'{}'}).catch(()=>null);return response?.status??0;},apiBase);expect(denied).toBe(0);
 const missing=await page.goto(base+'/assets/does-not-exist.js');expect(missing?.status()).toBe(404);expect((await page.goto(base+'/api/health'))?.status()).toBe(404);
 await page.goto(base+'/dashboard');const logout=await page.evaluate(async(url)=>{const response=await fetch(url+'/auth/logout',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{}'});return response.status;},apiBase);expect(logout).toBe(200);expect((await context.cookies()).some(c=>c.name==='__Host-pos_session')).toBe(false);
 expect(errors).toEqual([]);await writeFile(`${directory}/final-cloud-ui.json`,JSON.stringify({status:'PASS',https:'self-signed local test only',sameSite:'two separate HTTPS subdomains',checks:['direct SPA routes','cookie Secure HttpOnly Host Lax','credentialed CORS','private session','private photo authorization','CSV export','rejected preflight header','missing asset 404','API not captured by SPA','logout','CSP and chunks'],realProviders:'NOT VERIFIED'},null,2));console.log(JSON.stringify({status:'PASS',https:true,crossOrigin:true,realProviders:'NOT VERIFIED'}));await context.close();
}finally{await browser?.close();await Promise.all([new Promise<void>(yes=>api.close(()=>yes())),new Promise<void>(yes=>front.close(()=>yes()))]);if(oldMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldMode;if(oldOrigins===undefined)delete process.env.AUTH_ALLOWED_ORIGINS;else process.env.AUTH_ALLOWED_ORIGINS=oldOrigins;await f.close();}
