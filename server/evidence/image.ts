import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {maxEvidenceBytes,maxEvidencePixels} from '../../shared/evidence.js';
import {DomainError} from '../lib/errors.js';
export const checksum=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
export function imageSignature(bytes:Uint8Array){
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(Buffer.from(bytes.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(Buffer.from(bytes.subarray(0,4)).toString()==='RIFF'&&Buffer.from(bytes.subarray(8,12)).toString()==='WEBP')return 'image/webp';
 return null;
}
export async function prepareEvidenceImage(bytes:Buffer,mimeType:string){
 const limit=Math.min(maxEvidenceBytes,Number(process.env.MAX_EVIDENCE_FILE_SIZE)||maxEvidenceBytes);
 if(!bytes.length||bytes.length>limit)throw new DomainError(400,'IMAGEN DEMASIADO GRANDE; MÁXIMO 10 MB.','EVIDENCE_SIZE_INVALID');
 if(imageSignature(bytes)!==mimeType)throw new DomainError(400,'EL ARCHIVO NO ES UN JPEG, PNG O WEBP VÁLIDO. HEIC/HEIF NO ESTÁ HABILITADO.','EVIDENCE_TYPE_INVALID');
 try{
  const image=sharp(bytes,{limitInputPixels:maxEvidencePixels,failOn:'warning',animated:false}),metadata=await image.metadata();
  if(!metadata.width||!metadata.height||metadata.width<32||metadata.height<32||metadata.width>12000||metadata.height>12000||metadata.width*metadata.height>maxEvidencePixels||(metadata.pages??1)!==1)throw new Error('DIMENSIONS_INVALID');
  // Lossless output: no resizing/OCR or alteration of documentary pixels.
  // autoOrient applies EXIF orientation; absence of keepMetadata strips EXIF/GPS.
  const output=await image.autoOrient().webp({lossless:true,effort:4}).toBuffer({resolveWithObject:true});
  if(output.data.length>limit)throw new Error('OUTPUT_TOO_LARGE');
  return {bytes:output.data,width:output.info.width,height:output.info.height,mimeType:'image/webp',fileSize:output.data.length,checksum:checksum(output.data)};
 }catch{throw new DomainError(400,'NO SE PUDO DECODIFICAR LA IMAGEN. USA UNA FOTO DE 32 PX O MÁS Y HASTA 20 MILLONES DE PÍXELES.','EVIDENCE_IMAGE_INVALID');}
}
