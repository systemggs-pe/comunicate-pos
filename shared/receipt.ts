import JsBarcode from 'jsbarcode';
import type {Sale} from '../src/types/pos.js';
import type {CompanySettings} from './company.js';
import {normalizeText} from './normalization.js';
import {cents,decimalMoney} from './sales.js';
export type ReceiptFormat=58|80;
export interface ReceiptData {sale:Sale;company:CompanySettings}
export interface ReceiptRow {
 text:string;align?:'center'|'right';bold?:boolean;right?:string;barcode?:string;
 kind?:'text'|'field'|'section'|'total'|'barcode'|'rule';label?:string;labelWidth?:number;
 font?:number;advance?:number;color?:number;before?:number;
}
export function price(value:string){return `S/ ${value.includes('.')?value.padEnd(value.indexOf('.')+3,'0'):value+'.00'}`;}
function ticketPrice(value:string){return price(value).replace('S/ ','S/. ');}
export function receiptSaleCode(code:string){return `VEN-${code.replace(/^(?:VENTA|SALE|VEN)[-\s]*/i,'')}`;}
export function receiptRows({sale,company:c}:ReceiptData,_format:ReceiptFormat):ReceiptRow[]{
 const rows:ReceiptRow[]=[],add=(text:string,options:Omit<ReceiptRow,'text'>={})=>rows.push({text,...options});
 const field=(label:string,text:string,labelWidth=15.24,advance=4.29)=>add(text,{kind:'field',label,labelWidth,font:8,advance});
 const section=(text:string)=>add(text,{kind:'section',font:7.2,bold:true,color:88});
 const header=(text:string,font=7.2,advance=3.986,bold=false)=>add(text,{align:'center',font,advance,bold,color:bold?18:88});
 const memory=(value:string|null|undefined)=>value?(/^[\d.,]+$/.test(value.trim())?`${value.trim()} GB`:normalizeText(value)):'—';
 header('COMUNIC@TE',13.8,6.494,true);header('RECIBO DE VENTA',9,4.67,true);header(receiptSaleCode(sale.code),8,5.29);
 header('VENTA DE CELULARES Y ACCESORIOS');header(c.address||'—');header(c.city||'—');header(`Tel. ${c.phone||'—'}`);
 section('CLIENTE');
 field('Nombre:',normalizeText(sale.buyer.fullName||[sale.buyer.firstName,sale.buyer.lastName].filter(Boolean).join(' ')),13.5467);
 field(sale.buyer.documentType==='OTROS'?'Otros:':'DNI:',sale.buyer.dni??sale.buyer.otherDocumentNumber??'—',13.5467);
 const equipment=sale.equipment??[];
 equipment.forEach((line,index)=>{const e=line.equipment;
  section(equipment.length>1?`EQUIPO ${index+1}`:'EQUIPO');
  field('Marca:',normalizeText(e.brand));field('Modelo:',normalizeText(e.commercialName||e.model));
  field('Color:',e.color?normalizeText(e.color):'—');field('RAM:',memory(e.ram));field('Memoria:',memory(e.storage));
  [...e.imeis].sort((a,b)=>a.slot-b.slot).forEach(imei=>field(`IMEI ${imei.slot}:`,imei.value));
  field('S/N:',e.serialNumber||'NO CONSIGNADO');
 });
 section('PAGO');
 const payments:Record<string,string>={CASH:'EFECTIVO',YAPE:'YAPE',PLIN:'PLIN',CARD:'TARJETA',TRANSFER:'TRANSFERENCIA',OTHER:'OTRO'};
 field('Pago:',payments[sale.paymentMethod],15.24,5.29);
 equipment.forEach((line,index)=>add(equipment.length===1?'Equipo':`Equipo ${index+1}`,{right:ticketPrice(line.unitPrice),font:8,advance:4.29}));
 sale.accessories?.forEach(line=>add(`${normalizeText(line.name)} X ${line.quantity}`,{right:ticketPrice(decimalMoney(cents(line.unitPrice)*BigInt(line.quantity))),font:8,advance:4.29}));
 add('TOTAL',{kind:'total',right:ticketPrice(sale.total),bold:true,before:-1.9});
 const serials=[...new Set(equipment.map(line=>line.equipment.serialNumber).filter((serial):serial is string=>!!serial))];
 serials.forEach((serial,index)=>add(serial,{kind:'barcode',barcode:serial,align:'center',font:8,before:index===0?7.5:3}));
 if(!serials.length)add('S/N: NO CONSIGNADO',{kind:'barcode',align:'center',font:8,before:7.5});
 add('',{kind:'rule',before:2.5,advance:3.4});
 const occurredAt=new Date(sale.occurredAt??sale.createdAt);
 add('Fecha',{right:new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'2-digit',year:'numeric'}).format(occurredAt),font:7.2,advance:3.986,color:88});
 add('Hora',{right:new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}).format(occurredAt),font:7.2,advance:3.986,color:88});
 add('',{kind:'rule',advance:3.2});
 ['No se aceptan cambios ni','devoluciones.','El cliente estuvo conforme con el','producto adquirido.','Consultas solo con caja y recibo','otorgado.'].forEach(text=>header(text));
 return rows;
}
const PT_MM=25.4/72;
// Courier has a fixed 0.6-em advance. Both renderers use this wrapping and geometry.
function wrapCourier(text:string,width:number,font:number){
 const limit=Math.max(1,Math.floor(width/(font*PT_MM*.6)+.001)),lines:string[]=[];
 for(const paragraph of text.split(/\r?\n/)){
  let line='';
  for(let word of paragraph.split(/\s+/).filter(Boolean)){
   if(line&&line.length+1+word.length>limit){lines.push(line);line='';}
   while(word.length>limit){if(line){lines.push(line);line='';}lines.push(word.slice(0,limit));word=word.slice(limit);}
   if(word)line=line?`${line} ${word}`:word;
  }
  lines.push(line||' ');
 }
 return lines;
}
export function receiptLayout(data:ReceiptData,format:ReceiptFormat){
 const margin=format===58?data.company.margin58:data.company.margin80;
 const width=format-2*margin,scale=width/52;
 let cursor=5*scale;
 const items=receiptRows(data,format).map(row=>{
  cursor+=(row.before??0)*scale;
  const font=(row.font??8)*scale,labelWidth=(row.labelWidth??0)*scale;
  const inset=row.kind==='total'?2*scale:0;
  const rightFont=row.kind==='total'?10.6*scale:font;
  const rightWidth=row.right?row.right.length*rightFont*PT_MM*.6+2*scale:0;
  const lines=wrapCourier(row.text,width-labelWidth-rightWidth-inset*2,row.kind==='total'?10.2*scale:font);
  const barcode=row.barcode?receiptBarcode(row.barcode,width):null;
  const y=cursor;
  const lineHeight=font*PT_MM*1.15;
  let baseline=y,height=0;
  if(row.kind==='section'){baseline=y+4.8*scale;height=9.1*scale;}
  else if(row.kind==='total'){baseline=y+4.7*scale;height=Math.max(8.4*scale,4.7*scale+(lines.length-1)*10.2*scale*PT_MM*1.15+3.7*scale);}
  else if(row.kind==='barcode'){baseline=y+15*scale;height=15.503*scale+Math.max(0,lines.length-1)*lineHeight;}
  else if(row.kind==='rule'){height=(row.advance??0)*scale;}
  else height=Math.max((row.advance??4.29)*scale*lines.length,lineHeight*lines.length);
  cursor+=height;
  return {row,y,baseline,height,font:row.kind==='total'?10.2*scale:font,rightFont,labelWidth,lines,lineHeight,barcode,inset};
 });
 return {items,width,margin,scale,height:cursor+5*scale};
}
// Preserve at least 0.25 mm per module and 10-module quiet zones on each side.
export function receiptBarcode(code:string,availableMm:number){
 if(!/^[\x20-\x7E]+$/.test(code))return null;
 const target:{encodings?:{data:string}[]}={};
 try{JsBarcode(target,code,{format:'CODE128',displayValue:false});}catch{return null;}
 const bits=target.encodings?.map(e=>e.data).join('')??'';
 const width=(bits.length+20)*0.25;
 if(!bits||width>availableMm)return null;
 const module=availableMm/(bits.length+20);
 return {bits,width:availableMm,module,quiet:10*module,height:12};
}
