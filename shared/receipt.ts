import JsBarcode from 'jsbarcode';
import type {Sale} from '../src/types/pos.js';
import type {CompanySettings} from './company.js';
import {normalizeText} from './normalization.js';
import {cents,decimalMoney} from './sales.js';
export type ReceiptFormat=48|80;
export interface ReceiptData {sale:Sale;company:CompanySettings}
export interface ReceiptRow {text:string;align?:'center'|'right';bold?:boolean;right?:string;barcode?:string}
export function price(value:string){return `S/ ${value.includes('.')?value.padEnd(value.indexOf('.')+3,'0'):value+'.00'}`;}
export function receiptSaleCode(code:string){return `VEN-${code.replace(/^(?:VENTA|SALE|VEN)[-\s]*/i,'')}`;}
export function receiptRows({sale,company:c}:ReceiptData,_format:ReceiptFormat):ReceiptRow[]{
 const rows:ReceiptRow[]=[],add=(text:string,align?:ReceiptRow['align'],bold=false)=>{rows.push({text,align,bold});};
 const pair=(text:string,right:string,bold=false)=>rows.push({text,right,bold});
 add('COMUNIC@TE','center',true);add('Recibo de Venta','center',true);add(receiptSaleCode(sale.code),'center');
 add('VENTA DE CELULARES Y ACCESORIOS','center');
 add(`DIRECCIÓN: ${c.address||'—'}`,'center');add(`LOCAL: ${c.city||'—'}`,'center');add(`NÚMERO: ${c.phone||'—'}`,'center');
 add('');add('CLIENTE',undefined,true);
 add(`NOMBRE: ${normalizeText(sale.buyer.fullName||[sale.buyer.firstName,sale.buyer.lastName].filter(Boolean).join(' '))}`);add(`DNI: ${sale.buyer.dni}`);
 const equipment=sale.equipment??[];
 equipment.forEach((line,index)=>{const e=line.equipment;
  add('');add(equipment.length>1?`EQUIPO ${index+1}`:'EQUIPO',undefined,true);
  add(`MARCA: ${normalizeText(e.brand)}`);add(`MODELO: ${normalizeText(e.commercialName||e.model)}`);
  add(`COLOR: ${e.color?normalizeText(e.color):'—'}`);add(`RAM: ${e.ram?normalizeText(e.ram):'—'}`);add(`MEMORIA: ${e.storage?normalizeText(e.storage):'—'}`);
  [...e.imeis].sort((a,b)=>a.slot-b.slot).forEach(imei=>add(`IMEI ${imei.slot}: ${imei.value}`));
  add(`S/N: ${e.serialNumber||'NO CONSIGNADO'}`);
 });
 add('');add('PAGO',undefined,true);
 const payments:Record<string,string>={CASH:'EFECTIVO',YAPE:'YAPE',PLIN:'PLIN',CARD:'TARJETA',TRANSFER:'TRANSFERENCIA',OTHER:'OTRO'};
 add(`PAGO: ${payments[sale.paymentMethod]}`);pair('EQUIPO','PRECIO',true);
 equipment.forEach(line=>pair(normalizeText(line.equipment.commercialName||`${line.equipment.brand} ${line.equipment.model}`),price(line.unitPrice)));
 if(sale.accessories?.length){add('ACCESORIOS',undefined,true);sale.accessories.forEach(line=>pair(`${normalizeText(line.name)} X ${line.quantity}`,price(decimalMoney(cents(line.unitPrice)*BigInt(line.quantity)))));}
 add('');pair('TOTAL:',price(sale.total),true);add('');
 const serials=[...new Set(equipment.map(line=>line.equipment.serialNumber).filter((serial):serial is string=>!!serial))];
 serials.forEach(serial=>rows.push({text:`S/N: ${serial}`,barcode:serial,align:'center'}));
 if(!serials.length)add('S/N: NO CONSIGNADO','center');
 add('');const occurredAt=new Date(sale.occurredAt??sale.createdAt);
 pair('FECHA',new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'2-digit',year:'numeric'}).format(occurredAt));
 pair('HORA',new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}).format(occurredAt));
 add('');['NO SE ACEPTAN CAMBIOS NI','DEVOLUCIONES','EL CLIENTE ESTUVO CONFORME CON EL','PRODUCTO ADQUIRIDO','CONSULTAS SOLO CON CAJA Y RECIBO','OTORGADO'].forEach(text=>add(text,'center'));
 return rows;
}
// Preserve at least 0.25 mm per module and 10-module quiet zones on each side.
export function receiptBarcode(code:string,availableMm:number){
 if(!/^[\x20-\x7E]+$/.test(code))return null;
 const target:{encodings?:{data:string}[]}={};
 try{JsBarcode(target,code,{format:'CODE128',displayValue:false});}catch{return null;}
 const bits=target.encodings?.map(e=>e.data).join('')??'';
 const width=(bits.length+20)*0.25;
 return bits&&width<=availableMm?{bits,width,module:0.25,quiet:2.5,height:12}:null;
}
