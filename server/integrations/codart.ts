import {dniSchema} from '../../shared/validation.js';
import {normalizeText} from '../../shared/normalization.js';
import {DniProviderError,type DniProvider} from '../dni/provider.js';
import {DomainError} from '../lib/errors.js';
import {imageSignature,prepareEvidenceImage} from '../evidence/image.js';
const origin='https://api-codart.cgrt.org';
export async function readProviderJson(response:Response,limit:number){if(Number(response.headers.get('content-length'))>limit)throw new Error('PROVIDER_SIZE');const chunks:Buffer[]=[];let size=0;if(!response.body)throw new Error('PROVIDER_EMPTY');for await(const chunk of response.body as unknown as AsyncIterable<Uint8Array>){size+=chunk.length;if(size>limit)throw new Error('PROVIDER_SIZE');chunks.push(Buffer.from(chunk));}return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;}
export class CodartProvider implements DniProvider {
 readonly retryLimit=1;
 constructor(private token=process.env.CODART_API_KEY||process.env.CODART_API_TOKEN||process.env.DNI_API_TOKEN||'',private fetcher:typeof fetch=fetch,readonly simulated=false){}
 private async get(path:string,signal?:AbortSignal,limit=32768){
  if(!this.token||process.env.CODART_ENABLED!=='true')throw new DomainError(503,'CODART NO ESTÁ CONFIGURADO. PUEDES CONTINUAR MANUALMENTE.','CODART_NOT_CONFIGURED');
  const combined=AbortSignal.any([AbortSignal.timeout(8000),...(signal?[signal]:[])]);
  let response:Response;
  try{response=await this.fetcher(origin+path,{method:'GET',redirect:'error',signal:combined,headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.token}`}});}
  catch{throw new DomainError(combined.aborted?504:503,'NO SE PUDO CONSULTAR EL PROVEEDOR. CONTINÚA MANUALMENTE.',combined.aborted?'CODART_TIMEOUT':'CODART_UNAVAILABLE');}
  if(response.status===401||response.status===403)throw new DomainError(503,'EL PROVEEDOR NO AUTORIZÓ LA CONSULTA.','CODART_AUTHORIZATION');
  if(response.status===402||response.status===429)throw new DomainError(429,'NO HAY CRÉDITOS DISPONIBLES O SE ALCANZÓ EL LÍMITE.','CODART_CREDITS');
  if(!response.ok)throw new DomainError(503,'EL PROVEEDOR NO ESTÁ DISPONIBLE.','CODART_UNAVAILABLE');
  try{return await readProviderJson(response,limit);}catch{throw new DomainError(503,'RESPUESTA DEL PROVEEDOR INVÁLIDA.','CODART_INVALID_RESPONSE');}
 }
 async lookup(dni:string,signal?:AbortSignal){dniSchema.parse(dni);try{const raw=await this.get(`/api/v1/consultas/reniec/dni/${dni}`,signal) as {success?:unknown;result?:{full_name?:unknown}};if(raw.success!==true||typeof raw.result?.full_name!=='string')throw new Error('INVALID');const fullName=normalizeText(raw.result.full_name);if(!fullName||fullName.length>201)throw new Error('INVALID');return {dni,fullName,source:'codart',...(this.simulated?{simulated:true}:{})};}catch(error){throw new DniProviderError(error instanceof DomainError&&error.code==='CODART_CREDITS'?'DNI_PROVIDER_RATE_LIMIT':error instanceof DomainError&&error.code==='CODART_AUTHORIZATION'?'DNI_PROVIDER_UNAVAILABLE':signal?.aborted?'DNI_PROVIDER_TIMEOUT':'DNI_PROVIDER_UNAVAILABLE');}}
 async photos(dni:string,type:'BLUE'|'ELECTRONIC',signal?:AbortSignal){dniSchema.parse(dni);const raw=await this.get(`/api/v1/consultas/fd/${type==='BLUE'?'dniv':'dnivel'}/${dni}`,signal,30000000) as {success?:unknown;data?:{images?:unknown};credits_deducted?:unknown};if(raw.success!==true||!Array.isArray(raw.data?.images)||!raw.data.images.length||raw.data.images.length>4)throw new DomainError(503,'EL PROVEEDOR NO DEVOLVIÓ IMÁGENES VÁLIDAS.','CODART_INVALID_IMAGES');const images=[];for(const value of raw.data.images){const uri=typeof value==='object'&&value!==null&&'data_uri' in value?value.data_uri:null;images.push(await decodeIdentityImage(uri));}return {images,creditsDeducted:typeof raw.credits_deducted==='number'&&Number.isFinite(raw.credits_deducted)&&raw.credits_deducted>=0?raw.credits_deducted:null};}
}
export interface IdentityPhotoProvider {photos(dni:string,type:'BLUE'|'ELECTRONIC',signal?:AbortSignal):Promise<{images:Awaited<ReturnType<typeof prepareEvidenceImage>>[];creditsDeducted:number|null}>}
export async function decodeIdentityImage(uri:unknown){if(typeof uri!=='string'||uri.length>14000000)throw new DomainError(400,'IMAGEN DEL PROVEEDOR INVÁLIDA.','CODART_IMAGE_INVALID');const match=uri.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/);if(!match||match[2].length%4!==0)throw new DomainError(400,'IMAGEN DEL PROVEEDOR INVÁLIDA.','CODART_IMAGE_INVALID');const bytes=Buffer.from(match[2],'base64');if(bytes.toString('base64')!==match[2]||imageSignature(bytes)!==match[1])throw new DomainError(400,'IMAGEN DEL PROVEEDOR INVÁLIDA.','CODART_IMAGE_INVALID');return prepareEvidenceImage(bytes,match[1]);}
