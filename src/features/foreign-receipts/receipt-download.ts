import {receiptDateInLima,type ForeignReceiptView} from '../../../shared/foreign-receipts';
import type {ReceiptRenderResult,ReceiptRenderRuntime} from './receipt-renderers.js';

type RenderableReceipt=Pick<ForeignReceiptView,'format'|'snapshot'|'totalClp'|'totalUsd'|'folio'|'issuedAt'>;
export function renderForeignReceipt(receipt:RenderableReceipt):Promise<ReceiptRenderResult>;
export function renderForeignReceipt(receipt:RenderableReceipt,runtime:ReceiptRenderRuntime):Promise<ArrayBuffer>;
export async function renderForeignReceipt(receipt:RenderableReceipt,runtime?:ReceiptRenderRuntime){
 const pdf=await import('./receipt-renderers.js');
 const renderers=[pdf.generarBoletaExtranjera,pdf.generarBoletaExtranjera2,pdf.generarBoletaExtranjera3,
  pdf.generarBoletaExtranjera4,pdf.generarBoletaExtranjera5,pdf.generarBoletaExtranjera6,pdf.generarBoletaExtranjera7];
 const renderer=renderers[receipt.format-1];
 if(!renderer)throw new Error('Formato PDF no disponible.');
 const {customer,devices,issuer}=receipt.snapshot;
 const data={
  cliente:{nombre:customer.fullName,dni:customer.document,tipoDocumento:customer.type},
  ventas:devices.map(item=>({imeiEquipo:item.imei1,imei2Equipo:item.imei2,sn:item.serialNumber,
   marcaEquipo:item.brand,modeloEquipo:item.model,nombreComercial:item.commercialName,
   memoria:item.storage,color:item.color,precio:item.price})),
  equiposMap:Object.fromEntries(devices.map(item=>[item.imei1,{imei2:item.imei2,sn:item.serialNumber,
   marca:item.brand,modelo:item.model,nombreComercial:item.commercialName,memoria:item.storage,color:item.color}])),
  totalClp:Number(receipt.totalClp),totalUsd:Number(receipt.totalUsd),fechaHora:receiptDateInLima(receipt.issuedAt,true),
  nBoleta:receipt.folio,emisor:issuer,
 };
 return runtime?renderer({...data,output:'bytes',runtime}):renderer({...data,output:'bloburl'});
}

export async function deliverForeignReceipt(receipt:ForeignReceiptView,print=false){
 // Abrir durante el clic para que el navegador permita la vista PDF de impresión.
 const tab=print?window.open('','_blank'):null;
 if(print&&!tab)throw new Error('Permite abrir la pestaña de impresión e inténtalo de nuevo.');
 if(tab)tab.opener=null;
 try{
  const {url,nombre}=await renderForeignReceipt(receipt);
  if(tab)tab.location.href=url;
  else{
   const link=document.createElement('a');
   link.href=url;link.download=nombre;link.click();
  }
  window.setTimeout(()=>URL.revokeObjectURL(url),tab?120000:15000);
 }catch(error){tab?.close();throw error;}
}
