import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {expect,type Page} from '@playwright/test';
import {clearEvidenceFixtures} from './evidence';
import {seedTestAdmin,testEmail,testPassword} from './auth';
import {permissionKeys} from '../../shared/auth';
const target=new URL(process.env.TEST_DATABASE_URL!);
if(target.pathname!=='/communicate_pos_test'||!['127.0.0.1','localhost'].includes(target.hostname))throw Error('ISOLATED TEST DB ONLY');
export const mvpDb=new PrismaClient({datasources:{db:{url:target.toString()}}});
export async function resetMvp(){
 await clearEvidenceFixtures(mvpDb);
 await mvpDb.$transaction([mvpDb.companySettings.deleteMany(),mvpDb.session.deleteMany(),mvpDb.authRateLimit.deleteMany(),mvpDb.registrationRequestHistory.deleteMany(),mvpDb.registrationRequest.deleteMany(),mvpDb.registrationOperation.deleteMany(),mvpDb.saleAccessory.deleteMany(),mvpDb.equipmentHistory.deleteMany(),mvpDb.auditLog.deleteMany(),mvpDb.saleEquipment.deleteMany(),mvpDb.sale.deleteMany(),mvpDb.imei.deleteMany(),mvpDb.equipment.deleteMany(),mvpDb.client.deleteMany(),mvpDb.user.deleteMany()]);
 const role=await mvpDb.role.findUniqueOrThrow({where:{code:'SUPERADMIN'}});await mvpDb.rolePermission.deleteMany({where:{roleId:role.id}});await mvpDb.rolePermission.createMany({data:permissionKeys.map(permissionKey=>({roleId:role.id,permissionKey}))});
 await seedTestAdmin(mvpDb);await mvpDb.client.create({data:{dni:'70876543',firstName:'Cliente',lastName:'Sintético',phone:'912345678',address:'Dirección ficticia',department:'Lima',email:'fixture@example.test'}});
}
export async function loginMvp(page:Page){await page.goto('/login');await page.getByLabel('Correo',{exact:true}).fill(testEmail);await page.getByLabel('Contraseña',{exact:true}).fill(testPassword);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Registro de equipos',exact:true})).toBeVisible();}
export async function registerContact(page:Page,dni='70876543'){
 await page.goto('/registros/nuevo');await page.locator('.dni-client-fields').getByLabel('DNI',{exact:false}).fill(dni);await expect(page.getByText('Cliente encontrado',{exact:true})).toBeVisible();
 await page.getByLabel('Celular de este registro',{exact:true}).fill('912345678');await page.getByLabel('Dirección de atención',{exact:true}).fill('Dirección ficticia');await page.getByRole('textbox',{name:'Departamento',exact:true}).last().fill('Lima');await page.getByLabel('Correo de atención',{exact:true}).fill('fixture@example.test');await page.getByRole('button',{name:'Continuar',exact:true}).click();
}
export async function widthsMvp(page:Page){for(const width of [1280,375,390,430]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);expect(await page.locator('.document-actions button,.document-actions a,.document-actions label,.document-picker label,.identity-photo-panel button').evaluateAll(elements=>elements.every(element=>{const r=element.getBoundingClientRect();return !r.width||!r.height||(r.left>=0&&r.right<=window.innerWidth); }))).toBe(true);const route=new URL(page.url()).pathname.replace(/[^a-zA-Z0-9-]/g,'_');await page.screenshot({path:`.test-results/mvp-responsive/${route}-${width}.png`,fullPage:true});const view=page.locator('.document-actions').getByRole('button',{name:'VER',exact:true}).first();if(await view.count()){await view.click();await expect(page.locator('.document-modal[open]')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.locator('.document-modal[open]').getByRole('button',{name:'CERRAR DOCUMENTO',exact:true}).click();}}await page.setViewportSize({width:1280,height:900});}

export async function finishMvp(){await clearEvidenceFixtures(mvpDb);await mvpDb.$disconnect();}
