import sharp from 'sharp';
import {inflateSync} from 'node:zlib';
import {PDFArray,PDFDocument,PDFName,PDFNumber,PDFRawStream,PDFRef} from 'pdf-lib';
import layout from '../../shared/evidence-layout.json';
import {maxEvidencePixels} from '../../shared/evidence.js';
import {DomainError} from '../lib/errors.js';
import {createEvidencePdf,type EvidencePdfData} from './evidence.pdf.js';

export const recoPdfByteLimit=400_000;

// Preserve more detail in the documents and identifiers than in the photo of the box.
const compressionProfiles=[
 {dpi:300,boxDpi:250,quality:85},
 {dpi:260,boxDpi:210,quality:78},
 {dpi:220,boxDpi:170,quality:72},
 {dpi:180,boxDpi:150,quality:65},
] as const;

const name=PDFName.of;
const imageKeys=['Decode','DecodeParms','Mask','SMask','ImageMask','SMaskInData','Alternates','Intent'].map(name);
type DeclarationImage={ref:PDFRef;stream:PDFRawStream};

async function compressDeclarationImages(document:PDFDocument,images:DeclarationImage[],profile:typeof compressionProfiles[number]){
 for(const {ref,stream} of images){
  const {dict}=stream;
  const width=dict.lookup(name('Width')),height=dict.lookup(name('Height'));
  const space=dict.lookup(name('ColorSpace'));
  const colorSpace=space instanceof PDFName?space.decodeText():'';
  const channels=colorSpace==='DeviceGray'?1:colorSpace==='DeviceRGB'?3:undefined;
  const bits=dict.lookup(name('BitsPerComponent'));
  if(!channels||!(width instanceof PDFNumber)||!(height instanceof PDFNumber)||!(bits instanceof PDFNumber)||bits.asNumber()!==8||imageKeys.some(key=>dict.has(key)))continue;
  const w=width.asNumber(),h=height.asNumber();
  if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||w*h>maxEvidencePixels)continue;
  const filters=dict.lookup(name('Filter'));
  const filter=filters instanceof PDFArray&&filters.size()===1?filters.lookup(0):filters;
  const bytes=Buffer.from(stream.getContents());
  try{
   const options={limitInputPixels:maxEvidencePixels};
   let image:ReturnType<typeof sharp>;
   if(filter===name('DCTDecode'))image=sharp(bytes,options);
   else if(filter===name('FlateDecode')||!filter){
    const raw=filter?inflateSync(bytes,{maxOutputLength:w*h*channels}):bytes;
    if(raw.length!==w*h*channels)continue;
    image=sharp(raw,{...options,raw:{width:w,height:h,channels}});
   }else continue;
   // Limit scan resampling to the profile's pixel budget for a full A4 page.
   const size={width:Math.max(Math.round(8.27*profile.dpi),Math.ceil(w*0.65)),height:Math.max(Math.round(11.69*profile.dpi),Math.ceil(h*0.65))};
   image=image.resize({...size,fit:'inside',withoutEnlargement:true});
   if(channels===1)image=image.toColourspace('b-w');
   const compressed=await image.jpeg({quality:profile.quality,mozjpeg:true,chromaSubsampling:'4:4:4'}).toBuffer({resolveWithObject:true});
   if(compressed.data.length>=bytes.length)continue;
   const replacement=dict.clone();
   replacement.set(name('Filter'),name('DCTDecode'));
   replacement.set(name('Width'),PDFNumber.of(compressed.info.width));
   replacement.set(name('Height'),PDFNumber.of(compressed.info.height));
   document.context.assign(ref,PDFRawStream.of(replacement,compressed.data));
  }catch{
   // Keep valid images with encodings the compressor cannot handle.
  }
 }
}

async function combine(document:PDFDocument,reco:Buffer,code:string){
 const packet=await PDFDocument.create();
 const declarationPages=await packet.copyPages(document,document.getPageIndices());
 for(const page of declarationPages)packet.addPage(page);
 const evidence=await PDFDocument.load(reco);
 for(const page of await packet.copyPages(evidence,evidence.getPageIndices()))packet.addPage(page);
 packet.setTitle(code);
 packet.setCreator('COMUNIC@TE POS');
 return Buffer.from(await packet.save({updateFieldAppearances:false}));
}

export async function compressRecoPdf(data:EvidencePdfData,reco:Buffer,sourceImages:ReadonlyMap<string,Buffer>,declaration?:Buffer){
 let document:PDFDocument|undefined,original=reco;
 if(declaration){
  try{
   document=await PDFDocument.load(declaration,{throwOnInvalidObject:true,updateMetadata:false});
   // Freeze existing form appearances on a copy so visible entered values survive the merge.
   if(document.getForm().getFields().length)document.getForm().flatten({updateFieldAppearances:false});
   original=await combine(document,reco,data.code);
  }catch{
   throw new DomainError(503,'No se pudo incorporar la declaración jurada al PDF. Reintenta la descarga.','EVIDENCE_PDF_MOVISTAR_DECLARATION');
  }
 }
 if(original.length<recoPdfByteLimit)return {bytes:original,originalSize:original.length};

 const images:DeclarationImage[]=[];
 for(const [ref,stream] of document?.context.enumerateIndirectObjects()??[]){
  if(stream instanceof PDFRawStream&&stream.dict.lookup(name('Subtype'))===name('Image'))images.push({ref,stream});
 }

 for(const profile of compressionProfiles){
  if(document){
   for(const {ref,stream} of images)document.context.assign(ref,stream);
   await compressDeclarationImages(document,images,profile);
  }
  const photos:EvidencePdfData['photos']=[];
  for(const photo of data.photos){
   const slot=layout.slots.find(slot=>slot.category===photo.category);
   const source=sourceImages.get(photo.category);
   if(!slot||!source)throw new Error('Falta una imagen del expediente.');
   const pixelsPerMm=(photo.category==='DEVICE_BOX'?profile.boxDpi:profile.dpi)/25.4;
   const bytes=await sharp(source,{limitInputPixels:maxEvidencePixels}).rotate()
    .resize({width:Math.round(slot.width*pixelsPerMm),height:Math.round(slot.height*pixelsPerMm),fit:'inside',withoutEnlargement:true})
    .flatten({background:'#ffffff'})
    .jpeg({quality:profile.quality,mozjpeg:true,chromaSubsampling:'4:4:4'}).toBuffer();
   // Use the original aspect ratio for placement, avoiding changes from pixel rounding.
   photos.push({...photo,bytes});
  }
  const compressed=createEvidencePdf({...data,photos});
  const bytes=document?await combine(document,compressed,data.code):compressed;
  if(bytes.length<recoPdfByteLimit)return {bytes,originalSize:original.length};
 }

 throw new DomainError(503,'No se pudo generar un PDF legible de menos de 400 KB',declaration?'EVIDENCE_PDF_MOVISTAR_SIZE':'EVIDENCE_PDF_SIZE');
}
