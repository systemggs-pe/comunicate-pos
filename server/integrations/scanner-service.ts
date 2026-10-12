import type {PrismaClient} from '@prisma/client';
import {DomainError} from '../lib/errors.js';
import {prepareEvidenceImage,checksum} from '../evidence/image.js';
import {externalBudget} from './budget.js';
import {GeminiBoxScanner,type BoxScannerProvider} from './gemini.js';
import {validateDetection} from '../../shared/scanner.js';
export function scannerService(db:PrismaClient,provider:BoxScannerProvider=new GeminiBoxScanner(),timeoutMs=20000){
 const requests=new Map<string,{expires:number;promise:Promise<ReturnType<typeof validateDetection>>}>();
 return async(userId:string,bytes:Buffer,mime:string,signal:AbortSignal)=>{
  if(!Buffer.isBuffer(bytes))throw new DomainError(400,'SELECCIONA UNA FOTO DE CAJA.','SCAN_IMAGE_REQUIRED');
  const image=await prepareEvidenceImage(bytes,mime),key=`${userId}:${checksum(image.bytes)}`;
  for(const [k,v] of requests)if(v.expires<Date.now())requests.delete(k);
  const existing=requests.get(key);if(existing)return existing.promise;
  if(requests.size>=100)throw new DomainError(429,'ESCANEO OCUPADO. CONTINÚA MANUALMENTE.','SCAN_BUSY');
  const promise=(async()=>{if(provider instanceof GeminiBoxScanner&&process.env.GEMINI_ENABLED!=='true')throw new DomainError(503,'ESCANEO NO CONFIGURADO. CONTINÚA MANUALMENTE.','SCANNER_NOT_CONFIGURED');await externalBudget(db,userId,'gemini',Math.max(1,Math.min(200,Number(process.env.GEMINI_DAILY_LIMIT)||20)));const timeout=AbortSignal.timeout(timeoutMs),combined=AbortSignal.any([signal,timeout]);let stop:()=>void=()=>undefined;try{const raw=await Promise.race([provider.scan(image.bytes,combined),new Promise<never>((_resolve,reject)=>{stop=()=>reject(new DomainError(504,'EL ESCANEO TARDÓ DEMASIADO. CONTINÚA MANUALMENTE.','SCANNER_TIMEOUT'));if(combined.aborted)stop();else combined.addEventListener('abort',stop,{once:true});})]);try{return validateDetection(raw);}catch{throw new DomainError(503,'NO SE IDENTIFICARON DATOS VÁLIDOS. CONTINÚA MANUALMENTE.','SCANNER_INVALID_RESPONSE');}}finally{combined.removeEventListener('abort',stop);}})();
  requests.set(key,{expires:Date.now()+60000,promise});try{return await promise;}catch(error){requests.delete(key);throw error;}
 };
}
