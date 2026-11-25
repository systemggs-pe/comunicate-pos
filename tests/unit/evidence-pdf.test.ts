import {it,expect} from 'vitest';
import sharp from 'sharp';
import {createEvidencePdf,type EvidencePdfData} from '../../server/documents/evidence.pdf';
import {inspectEvidencePdf} from '../helpers/evidence-pdf';
import layout from '../../shared/evidence-layout.json';
const data:EvidencePdfData={businessName:'COMUNIC@TE PRUEBA',code:'RECO-000001',date:'17/10/2026',client:'CLIENTE SINTÉTICO',dni:'70876543',equipment:'EQUIPO SINTÉTICO',brand:'MARCA',imei:'597087654480017',operator:'BITEL',status:'REGISTRO PENDIENTE',responsible:'AGENTE SINTÉTICO',photos:[]};
it('sin fotos conserva una página A4 de la plantilla sin portada ni datos añadidos',()=>{const parsed=inspectEvidencePdf(createEvidencePdf(data));expect(parsed.pages).toHaveLength(1);expect(parsed.text.trim()).toBe('');expect(parsed.pages.every(p=>p.images.length===0)).toBe(true);});
it.each([[50,180],[180,50],[100,100]])('fotografía %ix%i cabe completa y proporcionada en su espacio sin mover la plantilla',async(width,height)=>{
 const bytes=await sharp({create:{width,height,channels:3,background:'#123456'}}).jpeg().toBuffer();
 const parsed=inspectEvidencePdf(createEvidencePdf({...data,photos:[{category:'DNI_BACK',bytes,width,height}]}));expect(parsed.pages).toHaveLength(1);expect(parsed.pages[0].images).toHaveLength(1);
 const image=parsed.pages[0].images[0],slot=layout.slots[1];expect(image).toMatchObject({width,height});expect(image.drawWidth/image.drawHeight).toBeCloseTo(width/height,5);expect(image.x+image.drawWidth/2).toBeCloseTo(slot.x+slot.width/2,4);expect(image.y+image.drawHeight/2).toBeCloseTo(slot.y+slot.height/2,4);
 expect(image.drawWidth).toBeLessThanOrEqual(slot.width+.001);expect(image.drawHeight).toBeLessThanOrEqual(slot.height+.001);
});
it('cinco categorías reproducen posiciones y orden del PDF de referencia sin imágenes ni textos privados copiados',async()=>{
 const sizes=[[963,603],[647,410],[1400,453],[618,1400],[653,1400]],categories=['DNI_FRONT','DNI_BACK','DEVICE_BOX','LOGICAL_IMEI','PURCHASE_RECEIPT'] as const;
 const photos=await Promise.all(categories.map(async(category,index)=>{const [width,height]=sizes[index];return {category,width,height,bytes:await sharp({create:{width,height,channels:3,background:['#225588','#226644','#778899','#887755','#555577'][index]}}).jpeg().toBuffer()};}));
 const parsed=inspectEvidencePdf(createEvidencePdf({...data,photos}));expect(parsed.pages).toHaveLength(1);expect(parsed.pages.map(p=>p.images.length)).toEqual([5]);expect(parsed.text.trim()).toBe('');
 for(const [index,slot] of layout.slots.entries()){
  const image=parsed.pages[0].images.find(i=>i.width===sizes[index][0]&&i.height===sizes[index][1]);expect(image).toBeDefined();const scale=Math.min(slot.width/sizes[index][0],slot.height/sizes[index][1]);const width=sizes[index][0]*scale,height=sizes[index][1]*scale;expect(image!.x).toBeCloseTo(slot.x+(slot.width-width)/2,4);expect(image!.y).toBeCloseTo(slot.y+(slot.height-height)/2,4);expect(image!.drawWidth).toBeCloseTo(width,4);expect(image!.drawHeight).toBeCloseTo(height,4);
 }
});
