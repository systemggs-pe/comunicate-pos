import {jsPDF} from 'jspdf';
import layout from '../../shared/evidence-layout.json';
import type {EvidenceCategory} from '../../shared/evidence.js';
export interface EvidencePdfData {businessName:string;code:string;date:string;client:string;dni:string;equipment:string;brand:string;imei:string;operator:string;status:string;responsible:string;photos:{category:EvidenceCategory;bytes:Buffer;width:number;height:number}[]}
/** Fixed two-page photo template. No personal content from the reference is embedded. */
export function createEvidencePdf(data:EvidencePdfData){
 const doc=new jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true});
 for(let page=1;page<layout.paper.pages;page++)doc.addPage();
 doc.setProperties({title:data.code,creator:'COMUNIC@TE POS',author:'',subject:''});
 for(const slot of layout.slots){
  const photo=data.photos.find(image=>image.category===slot.category);
  if(!photo)continue;
  const scale=Math.min(slot.width/photo.width,slot.height/photo.height),width=photo.width*scale,height=photo.height*scale;
  doc.setPage(slot.page);
  doc.addImage(new Uint8Array(photo.bytes),'JPEG',slot.x+(slot.width-width)/2,slot.y+(slot.height-height)/2,width,height);
 }
 return Buffer.from(doc.output('arraybuffer'));
}
