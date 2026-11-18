import {jsPDF} from 'jspdf';
import {receiptLayout,receiptSaleCode,type ReceiptData,type ReceiptFormat} from '../../../shared/receipt';
export function createReceiptPdf(data:ReceiptData,format:ReceiptFormat){
 const layout=receiptLayout(data,format),{margin,width,scale}=layout;
 const pageHeight=Math.min(1000,Math.max(40,layout.height));
 const doc=new jsPDF({unit:'mm',format:[format,pageHeight],compress:true});
 let offset=0;
 const rule=(y:number)=>{doc.setDrawColor(176);doc.setLineWidth(.18*scale);doc.line(margin,y,format-margin,y);};
 for(const item of layout.items){
  const {row,lines,font,rightFont,lineHeight,labelWidth,inset,barcode}=item;
  const top=item.y+offset;
  if(top+item.height>pageHeight-margin&&item.y>5*scale){
   doc.addPage([format,pageHeight]);offset=margin-item.y;
  }
  const y=item.y+offset,baseline=item.baseline+offset;
  if(row.kind==='section'){
   rule(y);doc.setFillColor('#f5f5f5');doc.rect(margin,y+scale,width,5.6*scale,'F');
  }
  if(row.kind==='rule'){rule(y);continue;}
  if(row.kind==='total'){
   doc.setFillColor('#ebebeb');doc.rect(margin,y,width,item.height,'F');
  }
  if(barcode){
   doc.setFillColor('#000000');
   const x=margin+barcode.quiet;
   // Draw whole black runs to avoid hairline gaps between adjacent modules.
   for(let i=0;i<barcode.bits.length;){
    if(barcode.bits[i]!=='1'){i++;continue;}
    const start=i;while(barcode.bits[i]==='1')i++;
    doc.rect(x+start*barcode.module,y,(i-start)*barcode.module,12*scale,'F');
   }
  }
  doc.setFontSize(font);doc.setFont('courier',row.bold?'bold':'normal');
  doc.setTextColor(row.color??18);
  const textX=row.align==='center'?format/2:row.align==='right'?format-margin:margin+labelWidth+inset+(row.kind==='section'?1.4*scale:0);
  lines.forEach((line,index)=>doc.text(line,textX,baseline+index*lineHeight,{align:row.align??'left'}));
  if(row.label){
   doc.setFont('courier','bold');doc.setTextColor(88);doc.text(row.label,margin,baseline);
  }
  if(row.right){
   doc.setFont('courier',row.bold?'bold':'normal');doc.setFontSize(rightFont);doc.setTextColor(18);
   doc.text(row.right,format-margin-inset,baseline,{align:'right'});
  }
 }
 return doc;
}
export async function downloadReceiptPdf(data:ReceiptData,format:ReceiptFormat){createReceiptPdf(data,format).save(`${receiptSaleCode(data.sale.code)}-${format}mm.pdf`);}
