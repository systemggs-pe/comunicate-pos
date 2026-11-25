import {jsPDF} from 'jspdf';
import layout from '../../shared/evidence-layout.json';
import type {EvidenceCategory} from '../../shared/evidence.js';
export interface EvidencePdfData {businessName:string;code:string;date:string;client:string;dni:string;equipment:string;brand:string;imei:string;operator:string;status:string;responsible:string;photos:{category:EvidenceCategory;bytes:Buffer;width:number;height:number}[]}
/** Single-page evidence layout. The reference rectangles mark the image bounds. */
export function createEvidencePdf(data:EvidencePdfData){
 const doc=new jsPDF({unit:'mm',format:[layout.paper.width,layout.paper.height],orientation:'portrait',compress:true});
 doc.setProperties({title:data.code,creator:'COMUNIC@TE POS',author:'',subject:''});
 for(const slot of layout.slots){
  const photo=data.photos.find(image=>image.category===slot.category);
  if(!photo)continue;
  const scale=Math.min(slot.width/photo.width,slot.height/photo.height),width=photo.width*scale,height=photo.height*scale;
  doc.addImage(new Uint8Array(photo.bytes),'JPEG',slot.x+(slot.width-width)/2,slot.y+(slot.height-height)/2,width,height);
 }
 return Buffer.from(doc.output('arraybuffer'));
}
