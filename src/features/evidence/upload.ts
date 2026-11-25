import type {ApiClient} from '../../services/api';
import {maxEvidenceBytes,maxEvidencePixels,movistarDeclarationCategory,movistarDeclarationInvalid,
 type EvidenceCategory,type EvidenceUpload,type PreparedEvidence} from '../../../shared/evidence';

export async function decodePhoto(file:File){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('USA JPEG, PNG O WEBP. HEIC/HEIF NO ESTÁ HABILITADO.');
 if(!file.size||file.size>maxEvidenceBytes)throw new Error('EL ARCHIVO DEBE PESAR HASTA 10 MB.');
 const magic=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const type=magic[0]===255&&magic[1]===216&&magic[2]===255?'image/jpeg':magic.slice(0,8).join(',')==='137,80,78,71,13,10,26,10'?'image/png':String.fromCharCode(...magic.slice(0,4))==='RIFF'&&String.fromCharCode(...magic.slice(8,12))==='WEBP'?'image/webp':null;
 if(type!==file.type)throw new Error('EL CONTENIDO DEL ARCHIVO NO COINCIDE CON SU TIPO.');
 const bitmap=await createImageBitmap(file);
 if(bitmap.width<32||bitmap.height<32||bitmap.width>12000||bitmap.height>12000||bitmap.width*bitmap.height>maxEvidencePixels){
  bitmap.close();
  throw new Error('USA UNA FOTO DE 32 PX O MÁS Y HASTA 20 MILLONES DE PÍXELES.');
 }
 return bitmap;
}
export async function validatePhoto(file:File){
 const bitmap=await decodePhoto(file);
 bitmap.close();
}
export async function uploadPhoto(api:ApiClient,file:File,category:EvidenceCategory,scope:{operationKey:string}|{requestId:string},progress:(percent:number)=>void,signal:AbortSignal,onAsset:(id:string)=>void,receiptPage?:number){
 if(category===movistarDeclarationCategory){
  if(file.type!=='application/pdf'||await file.slice(0,5).text()!=='%PDF-')throw new Error(movistarDeclarationInvalid);
 }else if(category==='PURCHASE_RECEIPT'&&file.type==='application/pdf'){
  if(file.size<5||file.size>maxEvidenceBytes||await file.slice(0,5).text()!=='%PDF-')throw new Error('Sube un PDF válido de hasta 10 MB.');
 }else await validatePhoto(file);
 const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
 const checksum=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const upload=await api.post<EvidenceUpload>('/evidence/uploads',{...scope,category,idempotencyKey:crypto.randomUUID(),mimeType:file.type,fileSize:file.size,checksum});onAsset(upload.assetId);
 if(signal.aborted)throw new Error('CARGA CANCELADA.');
 await new Promise<void>((resolve,reject)=>{const xhr=new XMLHttpRequest();const abort=()=>xhr.abort();signal.addEventListener('abort',abort,{once:true});xhr.open('PUT',upload.uploadUrl);xhr.timeout=120000;for(const [key,value] of Object.entries(upload.headers))xhr.setRequestHeader(key,value);xhr.upload.onprogress=e=>{if(e.lengthComputable)progress(Math.round(e.loaded/e.total*100));};const finish=(error?:Error)=>{signal.removeEventListener('abort',abort);if(error)reject(error);else resolve();};xhr.onload=()=>finish(xhr.status>=200&&xhr.status<300?undefined:new Error('NO SE PUDO SUBIR LA FOTO. REINTENTA.'));xhr.onerror=()=>finish(new Error('ERROR DE CONEXIÓN CON EL ALMACENAMIENTO.'));xhr.ontimeout=()=>finish(new Error('LA CARGA EXCEDIÓ EL TIEMPO DE ESPERA.'));xhr.onabort=()=>finish(new Error('CARGA CANCELADA.'));xhr.send(file);});
 return api.post<PreparedEvidence>(`/evidence/uploads/${upload.assetId}/verify`,receiptPage?{receiptPage}:{});
}
