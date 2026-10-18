import {jsPDF} from 'jspdf';
import {receiptRows,receiptBarcode,receiptSaleCode,type ReceiptData,type ReceiptFormat} from '../../../shared/receipt';
export function createReceiptPdf(data:ReceiptData,format:ReceiptFormat){
 const margin=format===48?data.company.margin48:data.company.margin80,available=format-2*margin,font=format===48?7:9,step=font*0.352778*1.35;
 const measure=new jsPDF({unit:'mm',format:[format,100]});measure.setFontSize(font);
 const layout=receiptRows(data,format).map(row=>{
  measure.setFont('courier',row.bold?'bold':'normal');
  const width=row.right?Math.max(available*.25,available-measure.getTextWidth(row.right)-2):available;
  return {row,lines:measure.splitTextToSize(row.text||' ',width) as string[],barcode:row.barcode?receiptBarcode(row.barcode,available):null};
 });
 const height=Math.max(40,margin*2+step+layout.reduce((sum,item)=>sum+item.lines.length*step+1.3+(item.barcode?16:0),0)+2);
 const pageHeight=Math.min(height,1000),doc=new jsPDF({unit:'mm',format:[format,pageHeight],compress:true});let y=margin+step;
 doc.setFontSize(font);
 function newPage(){doc.addPage([format,pageHeight]);y=margin+step;}
 for(const {row,lines,barcode} of layout){
  if(barcode){
   if(y+16+step*lines.length>pageHeight-margin)newPage();
   const x=(format-barcode.width)/2+barcode.quiet;
   Array.from(barcode.bits).forEach((bit,index)=>{if(bit==='1')doc.rect(x+index*barcode.module,y,barcode.module,barcode.height,'F');});y+=16;
  }
  doc.setFont('courier',row.bold?'bold':'normal');
  for(const [index,line] of lines.entries()){
   if(y>pageHeight-margin-step)newPage();
   doc.text(line,row.align==='center'?format/2:row.align==='right'?format-margin:margin,y,{align:row.align??'left'});
   if(row.right&&index===0)doc.text(row.right,format-margin,y,{align:'right'});
   y+=step;
  }
  y+=1.3;
 }
 return doc;
}
export async function downloadReceiptPdf(data:ReceiptData,format:ReceiptFormat){createReceiptPdf(data,format).save(`${receiptSaleCode(data.sale.code)}-${format}mm.pdf`);}
