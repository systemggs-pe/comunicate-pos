import type {Page} from '@playwright/test';
export async function openModule(page:Page,name:string){const link=page.getByRole('navigation').getByRole('link',{name,exact:true});if(!await link.isVisible())await page.getByRole('button',{name:'Más',exact:true}).click();await link.click();}
