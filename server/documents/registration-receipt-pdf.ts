import {createCanvas} from '@napi-rs/canvas';
import {renderForeignReceipt} from '../../src/features/foreign-receipts/receipt-download.js';
import type {ForeignReceiptSnapshot} from '../../shared/foreign-receipts.js';
import {maxEvidenceBytes,maxEvidencePixels} from '../../shared/evidence.js';
import {prepareEvidenceImage} from '../evidence/image.js';
import {DomainError} from '../lib/errors.js';

type Barcode=(value:string,width:number,height:number)=>string;
export const maxReceiptPages=30;

export async function renderReceiptDocument(row:{
 format:number;folio:number;issuedAt:Date;totalClp:{toString():string};totalUsd:{toString():string};snapshot:unknown;
},origin:string){
 const barcode417:Barcode|undefined=row.format<=3?await import('pdf417/build/index.js').then(module=>{
  const value=module.default;
  return typeof value==='function'?value:value.default;
 }):undefined;
 const data=await renderForeignReceipt({
  ...row,issuedAt:row.issuedAt.toISOString(),totalClp:row.totalClp.toString(),totalUsd:row.totalUsd.toString(),
  snapshot:row.snapshot as ForeignReceiptSnapshot,
 },{
  verificationUrl:`${origin}/boleta`,
  canvas:()=>createCanvas(1,1),
  barcode417:(value,width,height)=>{
   if(!barcode417)throw Error('PDF417 no disponible');
   // El renderizador original pide un canvas mediante document. La llamada
   // es síncrona y restaura el descriptor antes de devolver el control.
   const prior=Object.getOwnPropertyDescriptor(globalThis,'document');
   Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>createCanvas(1,1)}});
   try{return barcode417(value,width,height);}
   finally{if(prior)Object.defineProperty(globalThis,'document',prior);else Reflect.deleteProperty(globalThis,'document');}
  },
 });
 return Buffer.from(data);
}

export async function receiptPdfImage(bytes:Buffer,selectedPage?:number,imeis:string[]=[]){
 if(!bytes.length||bytes.length>maxEvidenceBytes||!bytes.subarray(0,8).toString('ascii').startsWith('%PDF-')){
  throw new DomainError(400,'Sube una boleta PDF válida de hasta 10 MB.','RECEIPT_PDF_INVALID');
 }
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const loading=pdfjs.getDocument({data:new Uint8Array(bytes),stopAtErrors:true,enableXfa:false,
  maxImageSize:maxEvidencePixels,canvasMaxAreaInBytes:maxEvidencePixels*4,useSystemFonts:true});
 try{
  const pdf=await loading.promise;
  if(pdf.numPages<1||pdf.numPages>maxReceiptPages)throw new DomainError(400,'La boleta debe tener entre 1 y 30 páginas.','RECEIPT_PDF_PAGES');
  let pageNumber=selectedPage??(pdf.numPages===1?1:0);
  if(!pageNumber&&imeis.length){
   const matches:number[]=[];
   for(let index=1;index<=pdf.numPages;index++){
    const page=await pdf.getPage(index);
    const words=(await page.getTextContent()).items.flatMap(item=>'str' in item?[item.str]:[]).join(' ');
    if(imeis.some(imei=>new RegExp(`(^|\\D)${imei}(\\D|$)`).test(words)))matches.push(index);
   }
   if(matches.length===1)pageNumber=matches[0];
  }
  if(!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>pdf.numPages){
   throw new DomainError(422,'Elige la página de la boleta que identifica al equipo.','RECEIPT_PDF_PAGE_REQUIRED');
  }
  const page=await pdf.getPage(pageNumber);
  const base=page.getViewport({scale:1});
  const viewport=page.getViewport({scale:Math.min(3,1550/Math.max(base.width,base.height))});
  const canvas=createCanvas(Math.max(32,Math.ceil(viewport.width)),Math.max(32,Math.ceil(viewport.height)));
  await page.render({canvas:canvas as unknown as HTMLCanvasElement,viewport,background:'#ffffff'}).promise;
  return {page:pageNumber,image:await prepareEvidenceImage(canvas.toBuffer('image/png'),'image/png')};
 }catch(error){
  if(error instanceof DomainError)throw error;
  throw new DomainError(400,'No se pudo abrir la boleta PDF. Revisa que el archivo no esté dañado ni protegido.','RECEIPT_PDF_INVALID');
 }finally{await loading.destroy();}
}
