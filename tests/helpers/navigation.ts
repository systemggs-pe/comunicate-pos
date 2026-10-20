import type {Page} from '@playwright/test';
export async function openModule(page:Page,name:string){
 // Native modal dialogs make the background navigation inert. Close through its visible control first.
 while(await page.locator('dialog[open] .reference-close').count())await page.locator('dialog[open] .reference-close').last().click();
 const link=page.getByRole('navigation').getByRole('link',{name,exact:true});
 if(!await link.isVisible()){
  await page.getByRole('button',{name:'Más',exact:true}).click();
  if(!await link.isVisible())await page.locator('.more-admin>summary').click();
 }
 await link.click();
}
