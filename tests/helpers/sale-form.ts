import {expect,type Page} from '@playwright/test';
export async function saleClient(page:Page,dni:string,name?:string){
 await page.locator('.sale-client-fields').getByLabel('DNI',{exact:true}).fill(dni);
 await expect(page.locator('.sale-client-fields').getByText('Consultando DNI...',{exact:true})).toHaveCount(0);
 if(name)await page.getByLabel('Nombre completo',{exact:true}).fill(name);else await expect(page.getByLabel('Nombre completo',{exact:true})).not.toHaveValue('');
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 await expect(page.getByTestId('sale-item-0')).toBeVisible();
}
export async function saveSale(page:Page){
 await page.getByRole('button',{name:'Confirmar y guardar',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Ticket de venta',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cerrar ticket',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Detalle de venta',exact:true})).toBeVisible();
}
