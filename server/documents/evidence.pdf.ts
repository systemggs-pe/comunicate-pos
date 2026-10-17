import {readFileSync} from 'node:fs';
import {jsPDF} from 'jspdf';
import {evidenceLabels,type EvidenceCategory} from '../../shared/evidence.js';
const fonts={normal:readFileSync(new URL('./fonts/Lato-Light.ttf',import.meta.url)).toString('base64'),bold:readFileSync(new URL('./fonts/Lato-Bold.ttf',import.meta.url)).toString('base64')};
export interface EvidencePdfData {businessName:string;code:string;date:string;client:string;dni:string;equipment:string;brand:string;imei:string;operator:string;status:string;responsible:string;photos:{category:EvidenceCategory;bytes:Buffer;width:number;height:number}[]}
export function createEvidencePdf(data:EvidencePdfData){
 const doc=new jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true});
 for(const style of ['normal','bold'] as const){doc.addFileToVFS(`evidence-${style}.ttf`,fonts[style]);doc.addFont(`evidence-${style}.ttf`,'Evidence',style);}
 doc.setProperties({title:`${data.code} — EXPEDIENTE DE EVIDENCIAS`,creator:'COMUNIC@TE POS',author:''});
 const header=()=>{doc.setTextColor(23,94,75);doc.setFont('Evidence','bold');doc.setFontSize(16);doc.text(doc.splitTextToSize(data.businessName,174),18,20);doc.setFontSize(12);doc.text('EXPEDIENTE DE EVIDENCIAS',18,36);doc.setTextColor(35,47,44);doc.setFont('Evidence','normal');doc.setFontSize(10);doc.text(`${data.code} · ${data.date}`,18,44);doc.setDrawColor(191,211,202);doc.line(18,49,192,49);};
 header();let y=61;
 for(const [label,value] of [['CLIENTE',data.client],['DNI',data.dni],['EQUIPO',data.equipment],['MARCA',data.brand],['IMEI',data.imei],['OPERADOR',data.operator],['ESTADO',data.status],['RESPONSABLE',data.responsible]]){
  doc.setFont('Evidence','bold');doc.text(label,18,y);doc.setFont('Evidence','normal');const lines=doc.splitTextToSize(value||'SIN DATO',127);doc.text(lines,65,y);y+=Math.max(12,lines.length*5+5);
 }
 doc.text(`${data.photos.length} EVIDENCIAS ADJUNTADAS A ESTA SOLICITUD`,18,y+8);
 if(!data.photos.length)doc.text('SIN FOTOGRAFÍAS ADJUNTADAS.',18,y+20);
 for(const photo of data.photos){doc.addPage();header();doc.setFont('Evidence','bold');doc.setFontSize(12);doc.text(evidenceLabels[photo.category],18,62);const scale=Math.min(174/photo.width,202/photo.height);const width=photo.width*scale,height=photo.height*scale;doc.addImage(new Uint8Array(photo.bytes),'JPEG',18+(174-width)/2,70+(202-height)/2,width,height);}
 const pages=doc.getNumberOfPages();for(let page=1;page<=pages;page++){doc.setPage(page);doc.setFont('Evidence','normal');doc.setFontSize(9);doc.text(`${data.code} · DOCUMENTACIÓN PRIVADA · ${page} / ${pages}`,18,287);}
 return Buffer.from(doc.output('arraybuffer'));
}
