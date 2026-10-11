import {randomUUID,createHash} from 'node:crypto';
import type {RequestHandler} from 'express';
import type {PrismaClient} from '@prisma/client';
import {DomainError} from '../lib/errors.js';
import {authState} from '../auth/middleware.js';

export function authorizedOrigins(raw:string|undefined,production:boolean){
 const allowed=(raw??(production?'':'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5175')).split(',').map(s=>s.trim()).filter(Boolean);
 if(!allowed.length)throw new DomainError(503,'Configura el origen autorizado del POS.','AUTH_NOT_CONFIGURED');
 for(const value of allowed){let url:URL;try{url=new URL(value);}catch{throw new DomainError(503,'El origen autorizado no es válido.','AUTH_NOT_CONFIGURED');}if(url.origin!==value||url.username||url.password||(url.protocol!=='https:'&&!( !production&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw new DomainError(503,'El origen autorizado requiere una URL exacta y segura.','AUTH_NOT_CONFIGURED');}
 return allowed;
}
export const maintenanceGuard:RequestHandler=(_req,_res,next)=>{if(process.env.MAINTENANCE_MODE==='true')throw new DomainError(503,'Mantenimiento temporal. Conserva tus datos y reintenta en unos minutos.','MAINTENANCE_MODE');next();};
export const observeHttp:RequestHandler=(req,res,next)=>{
 const id=randomUUID(),started=performance.now();res.set('X-Request-Id',id);
 res.once('finish',()=>{const durationMs=Math.round(performance.now()-started);if(process.env.HTTP_LOGGING==='true'||(process.env.NODE_ENV==='production'&&process.env.HTTP_LOGGING!=='false')||res.statusCode>=500){
 // Never log URLs, query strings, bodies, identities, cookies or error messages.
 const route=typeof req.route?.path==='string'?req.route.path:'unmatched',errorCode=typeof res.locals.errorCode==='string'&&/^[A-Z][A-Z0-9_]{1,63}$/.test(res.locals.errorCode)?res.locals.errorCode:undefined;console.log(JSON.stringify({event:'http',requestId:id,method:req.method,route,status:res.statusCode,durationMs,errorCode}));}});next();
};
export function apiThrottle(db:PrismaClient):RequestHandler{return async(req,res,next)=>{
 if(req.path==='/auth/logout'){next();return;}
 const path=req.path,group=path==='/reports/export'?'export':path.startsWith('/dni/')?'dni':path.includes('/evidence/')||path.startsWith('/evidence')?'evidence':!['GET','HEAD','OPTIONS'].includes(req.method)?'write':'read';
 const maximum={export:10,dni:60,evidence:120,write:120,read:600}[group];const key=createHash('sha256').update(`api:${group}:${authState(res).user.id}`).digest('hex');
 const rows=await db.$queryRaw<{attempts:number;retry:number}[]>`INSERT INTO "AuthRateLimit" (key,attempts,"expiresAt") VALUES (${key},1,now()+interval '1 minute') ON CONFLICT (key) DO UPDATE SET attempts=CASE WHEN "AuthRateLimit"."expiresAt"<=now() THEN 1 ELSE "AuthRateLimit".attempts+1 END,"expiresAt"=CASE WHEN "AuthRateLimit"."expiresAt"<=now() THEN now()+interval '1 minute' ELSE "AuthRateLimit"."expiresAt" END RETURNING attempts,ceil(extract(epoch FROM "expiresAt"-now()))::int AS retry`;
 if(rows[0].attempts>maximum){res.set('Retry-After',String(Math.max(1,rows[0].retry)));throw new DomainError(429,'Demasiadas operaciones. Espera un minuto antes de reintentar.','API_RATE_LIMITED');}next();
};}
