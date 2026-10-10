import {jsPDF} from 'jspdf';
import {receiptRows,receiptBarcode,type ReceiptData,type ReceiptFormat} from '../../../shared/receipt';
export function createReceiptPdf(data:ReceiptData,format:ReceiptFormat){
 const margin=format===48?data.company.margin48:data.company.margin80,available=format-2*margin,font=format===48?7:9,step=font*0.352778*1.35;
 const measure=new jsPDF({unit:'mm',format:[format,100]});measure.setFont('courier');measure.setFontSize(font);
 const lines=receiptRows(data,format).map(row=>({...row,lines:measure.splitTextToSize(row.text,available) as string[]}));
 const footer=measure.splitTextToSize(data.company.receiptFooter,available) as string[],identifier=measure.splitTextToSize(data.sale.code,available) as string[];
 const barcode=receiptBarcode(data.sale.code,available),height=Math.max(40,margin*2+lines.reduce((sum,r)=>sum+r.lines.length*step+1.3,0)+(barcode?16:4)+(identifier.length+footer.length+2)*step+2);
 // Long sales continue on correctly sized pages instead of exceeding PDF page limits.
 const pageHeight=Math.min(height,1000),doc=new jsPDF({unit:'mm',format:[format,pageHeight],compress:true});let y=margin+step;
 doc.setFontSize(font);
 for(const row of lines){doc.setFont('courier',row.bold?'bold':'normal');for(const line of row.lines){if(y>pageHeight-margin-step){doc.addPage([format,pageHeight]);y=margin+step;}doc.text(line,row.align==='center'?format/2:row.align==='right'?format-margin:margin,y,{align:row.align??'left'});y+=step;}y+=1.3;}
 const extra=barcode?20:12;if(y+extra>pageHeight-margin){doc.addPage([format,pageHeight]);y=margin+step;}
 if(barcode){const x=(format-barcode.width)/2+barcode.quiet;Array.from(barcode.bits).forEach((bit,i)=>{if(bit==='1')doc.rect(x+i*barcode.module,y,barcode.module,barcode.height,'F');});y+=16;}
 else {doc.setFontSize(6);doc.text('IDENTIFICADOR EN TEXTO',format/2,y,{align:'center'});y+=4;}
 doc.setFont('courier','normal');doc.setFontSize(font);
 for(const line of [...identifier,...footer]){if(y>pageHeight-margin-step){doc.addPage([format,pageHeight]);y=margin+step;}doc.text(line,format/2,y,{align:'center'});y+=step;}return doc;
}
export async function downloadReceiptPdf(data:ReceiptData,format:ReceiptFormat){createReceiptPdf(data,format).save(`${data.sale.code}-${format}mm.pdf`);}
