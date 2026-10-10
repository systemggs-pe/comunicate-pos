import JsBarcode from 'jsbarcode';
import type {Sale} from '../src/types/pos.js';
import type {CompanySettings} from './company.js';
import {normalizeText} from './normalization.js';
export type ReceiptFormat=48|80;
export interface ReceiptData {sale:Sale;company:CompanySettings}
export interface ReceiptRow {text:string;align?:'center'|'right';bold?:boolean}
export function price(value:string){return `S/ ${value.includes('.')?value.padEnd(value.indexOf('.')+3,'0'):value+'.00'}`;}
export function receiptRows({sale,company:c}:ReceiptData,format:ReceiptFormat):ReceiptRow[]{
 const rows:ReceiptRow[]=[],add=(text:string,align?:ReceiptRow['align'],bold=false)=>{if(text)rows.push({text,align,bold});};
 add(c.businessName,'center',true);[c.businessType,c.address,c.city,c.phone,c.email].forEach(t=>add(t,'center'));
 add('TICKET INTERNO DE VENTA','center');add('NO ES COMPROBANTE TRIBUTARIO','center');add(sale.code,'center',true);
 add(`FECHA: ${new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'short',timeStyle:'medium',hour12:false}).format(new Date(sale.occurredAt??sale.createdAt))}`);
 add(`CLIENTE: ${normalizeText(sale.buyer.firstName+' '+sale.buyer.lastName)}`);add(`DNI: ${sale.buyer.dni}`);
 if(c.showClientContact){add(sale.buyer.phone?`TEL: ${sale.buyer.phone}`:'');add(sale.buyer.address?normalizeText(sale.buyer.address):'');}
 sale.equipment?.forEach((line,index)=>{const e=line.equipment;
  add(`EQUIPO ${index+1}`,'center',true);add(normalizeText(`${e.brand} ${e.model}`),undefined,true);
  if(format===48){for(const [key,value] of [['NOMBRE',e.commercialName],['COLOR',e.color],['RAM',e.ram],['MEMORIA',e.storage]])if(value)add(`${key}: ${normalizeText(value)}`);}
  else {add([e.commercialName,e.color,e.ram?`RAM ${e.ram}`:'',e.storage?`MEMORIA ${e.storage}`:''].filter(Boolean).map(v=>normalizeText(v!)).join(' / '));}
  if(c.showSerial&&e.serialNumber)add(`SERIE: ${e.serialNumber}`);
  [...e.imeis].sort((a,b)=>a.slot-b.slot).forEach(i=>add(`IMEI ${i.slot}: ${i.value}`));add(price(line.unitPrice),'right',true);
 });
 if(sale.accessories?.length){add('ACCESORIOS','center',true);sale.accessories.forEach(a=>{add(normalizeText(a.name));add(`${a.quantity} X ${price(a.unitPrice)}`);});}
 add(`SUBTOTAL: ${price(sale.subtotal??sale.total)}`,'right');add(`DESCUENTO: ${price(sale.discount)}`,'right');
 const payments:Record<string,string>={CASH:'EFECTIVO',YAPE:'YAPE',PLIN:'PLIN',CARD:'TARJETA',TRANSFER:'TRANSFERENCIA',OTHER:'OTRO'};
 add(`PAGO: ${payments[sale.paymentMethod]}`);add(`TOTAL: ${price(sale.total)}`,'right',true);
 if(c.showSeller)add(`ATENDIDO POR: ${normalizeText(sale.createdBy?.name??'SIN OPERADOR HISTÓRICO')}`);
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
