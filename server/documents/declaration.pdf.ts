import {jsPDF} from 'jspdf';
import {readFileSync} from 'node:fs';
import layout from '../../shared/declaration-layout.json';
import type {DeclarationData} from '../../shared/declaration.js';
import {DomainError} from '../lib/errors.js';
const fonts={normal:readFileSync(new URL('./fonts/Lato-Light.ttf',import.meta.url)).toString('base64'),bold:readFileSync(new URL('./fonts/Lato-Bold.ttf',import.meta.url)).toString('base64')};
const labels:Record<string,string>={applicantName:'NOMBRE DEL SOLICITANTE',documentType:'TIPO DE DOCUMENTO',clientDocument:'DOCUMENTO DEL SOLICITANTE',address:'DIRECCIÓN',phone:'CELULAR',brand:'MARCA',model:'MODELO',imei:'IMEI',applicantSignature:'NOMBRE DEL SOLICITANTE',agentName:'NOMBRE DEL AGENTE',clientSignatureDocument:'DOCUMENTO DEL SOLICITANTE',agentDocument:'DOCUMENTO DEL AGENTE',date:'FECHA'};
export function createDeclarationPdf(data:DeclarationData){
 const doc=new jsPDF({unit:'pt',format:[210/25.4*72,297/25.4*72],orientation:'portrait',precision:8,compress:true});
 for(const style of ['normal','bold'] as const){doc.addFileToVFS(`Lato-${style}.ttf`,fonts[style]);doc.addFont(`Lato-${style}.ttf`,style==='bold'?'Lato-Bold':'Lato-Light','normal');}
 const variables:Record<string,string>={...data,applicantSignature:data.applicantName,clientSignatureDocument:data.clientDocument};
 const entries=[...layout.words.map(word=>({...word,key:undefined as string|undefined})),...layout.slots.map(slot=>({...slot,text:variables[slot.key],bold:false}))].sort((a,b)=>a.y-b.y||a.x-b.x);
 for(const item of entries){
  doc.setFont(item.bold?'Lato-Bold':'Lato-Light','normal');doc.setFontSize(item.size);
  const natural=doc.getTextWidth(item.text),scale=item.width/natural;
  // The fixed word anchors reproduce JasperReports spacing. Variable glyphs
  // fit their original reserved boxes without changing point size or truncating.
  if(item.key&&(!item.text||scale<(item.key==='brand'?0.5:0.6)))throw new DomainError(422,`EL CAMPO ${labels[item.key]} NO CABE EN LA PLANTILLA ORIGINAL. NO SE EMITIÓ EL PDF; SE REQUIERE REVISIÓN DE LA PLANTILLA.`,'DECLARATION_FIELD_TOO_LONG');
  doc.text(item.text,item.x,item.y,{horizontalScale:item.key?Math.min(1,scale):scale});
 }
 doc.setDrawColor(0);doc.setLineWidth(1);doc.line(15,421.5,275,421.5);doc.line(295,421.5,555,421.5);
 doc.setProperties({title:'DECLARACIÓN JURADA DE INGRESO DE EQUIPO ADQUIRIDO EN EL EXTRANJERO',author:'',subject:'',creator:'COMUNIC@TE POS'});
 return doc;
}
