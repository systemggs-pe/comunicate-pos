import {it,expect} from 'vitest';
import sharp from 'sharp';
import {randomUUID} from 'node:crypto';
import {phase9Fixture} from '../../scripts/lib/phase9-fixture';
import {scannerService} from '../../server/integrations/scanner-service';
import {scanFields} from '../../shared/scanner';
const image=(color:string)=>sharp({create:{width:80,height:80,channels:3,background:color}}).png().toBuffer();
const detected=()=>Object.fromEntries(scanFields.map(k=>[k,k==='brand'?'SAMSUNG':null]));
it('cuota persistente impide el segundo trabajo sin repetir la petición externa',async()=>{
 const f=await phase9Fixture(),old=process.env.GEMINI_DAILY_LIMIT;process.env.GEMINI_DAILY_LIMIT='1';let calls=0;
 try{const user=randomUUID(),service=scannerService(f.db,{scan:async()=>{calls++;return detected();}});await service(user,await image('#123456'),'image/png',new AbortController().signal);await expect(service(user,await image('#654321'),'image/png',new AbortController().signal)).rejects.toMatchObject({code:'EXTERNAL_QUOTA_REACHED'});expect(calls).toBe(1);}
 finally{if(old===undefined)delete process.env.GEMINI_DAILY_LIMIT;else process.env.GEMINI_DAILY_LIMIT=old;await f.close();}
});
it('solicitudes concurrentes de usuarios distintos nunca comparten la respuesta ni la cuota',async()=>{
 const f=await phase9Fixture();let calls=0;
 try{const service=scannerService(f.db,{scan:async()=>{calls++;return detected();}}),bytes=await image('#987654');await Promise.all([randomUUID(),randomUUID()].map(user=>service(user,bytes,'image/png',new AbortController().signal)));expect(calls).toBe(2);}
 finally{await f.close();}
});
it('cancelación termina la espera de un proveedor que ignora AbortSignal',async()=>{
 const f=await phase9Fixture();try{const controller=new AbortController(),service=scannerService(f.db,{scan:async()=>new Promise(()=>{})},2000);const promise=service(randomUUID(),await image('#abcdef'),'image/png',controller.signal);controller.abort();await expect(promise).rejects.toMatchObject({code:'SCANNER_TIMEOUT'});}finally{await f.close();}
});
it('configuración incompleta no consume presupuesto ni inicia una llamada al proveedor',async()=>{
 const f=await phase9Fixture(),old={enabled:process.env.GEMINI_ENABLED,key:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL};
 try{process.env.GEMINI_ENABLED='true';delete process.env.GEMINI_API_KEY;delete process.env.GEMINI_MODEL;const before=await f.db.authRateLimit.count();await expect(scannerService(f.db)(randomUUID(),await image('#222222'),'image/png',new AbortController().signal)).rejects.toMatchObject({code:'SCANNER_NOT_CONFIGURED'});expect(await f.db.authRateLimit.count()).toBe(before);}
 finally{for(const [key,value]of Object.entries({GEMINI_ENABLED:old.enabled,GEMINI_API_KEY:old.key,GEMINI_MODEL:old.model})){if(value===undefined)delete process.env[key];else process.env[key]=value;}await f.close();}
});
it('una respuesta inválida no queda cacheada y permite reintentar con una respuesta parcial válida',async()=>{
 const f=await phase9Fixture();let calls=0;try{const service=scannerService(f.db,{scan:async()=>++calls===1?{brand:3}:detected()}),bytes=await image('#fedcba'),user=randomUUID();await expect(service(user,bytes,'image/png',new AbortController().signal)).rejects.toMatchObject({code:'SCANNER_INVALID_RESPONSE'});expect((await service(user,bytes,'image/png',new AbortController().signal)).data.brand).toBe('SAMSUNG');expect(calls).toBe(2);}finally{await f.close();}
});
