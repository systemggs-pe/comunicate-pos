import {createHash} from 'node:crypto';
import type {PrismaClient} from '@prisma/client';
import type {Express,Request,Response} from 'express';
import {authState,requestContext,requestIp,requirePermission} from '../auth/middleware.js';
import {DomainError} from '../lib/errors.js';
import {foreignReceipts} from '../services/foreign-receipts.service.js';

export function registerPublicForeignReceiptRoutes(app:Express,db:PrismaClient){
 app.post('/api/public/foreign-receipts/verify',async(req,res)=>{
  const key=createHash('sha256').update(`foreign-receipt-verify:${requestIp(req)}`).digest('hex');
  const [row]=await db.$queryRaw<{attempts:number;retry:number}[]>`
   INSERT INTO "AuthRateLimit" (key,attempts,"expiresAt") VALUES (${key},1,now()+interval '1 minute')
   ON CONFLICT (key) DO UPDATE SET
     attempts=CASE WHEN "AuthRateLimit"."expiresAt"<=now() THEN 1 ELSE "AuthRateLimit".attempts+1 END,
     "expiresAt"=CASE WHEN "AuthRateLimit"."expiresAt"<=now() THEN now()+interval '1 minute' ELSE "AuthRateLimit"."expiresAt" END
   RETURNING attempts,ceil(extract(epoch FROM "expiresAt"-now()))::int AS retry`;
  if(row.attempts>12){
   res.set('Retry-After',String(Math.max(1,row.retry)));
   throw new DomainError(429,'Demasiadas consultas. Inténtalo en un minuto.','FOREIGN_RECEIPT_RATE_LIMIT');
  }
  res.json(await foreignReceipts(db).verify(req.body));
 });
}

export function registerForeignReceiptRoutes(app:Express,db:PrismaClient){
 const service=(req:Request,res:Response)=>foreignReceipts(db,requestContext(req,authState(res).user.id));
 const read=requirePermission('foreign-receipts.read');
 app.get('/api/foreign-receipts/sales',read,requirePermission('sales.read'),async(req,res)=>{
  res.json(await service(req,res).lookupSales(req.query.document));
 });
 app.get('/api/foreign-receipts/lookup',read,requirePermission('clients.read','equipment.read'),async(req,res)=>{
  res.json(await service(req,res).manualLookup(req.query));
 });
 app.get('/api/foreign-receipts/issuers',read,async(req,res)=>res.json(await service(req,res).issuers()));
 app.patch('/api/foreign-receipts/issuers/:format',read,requirePermission('foreign-receipts.issuers'),async(req,res)=>{
  res.json(await service(req,res).setIssuer(req.params.format,req.body));
 });
 app.get('/api/foreign-receipts',read,async(req,res)=>res.json(await service(req,res).list(req.query)));
 app.get('/api/foreign-receipts/:id',read,async(req,res)=>res.json(await service(req,res).get(req.params.id)));
 app.post('/api/foreign-receipts',read,requirePermission('foreign-receipts.create'),async(req,res)=>{
  if(req.body?.source==='SALE'&&!authState(res).user.permissions.includes('sales.read')){
   throw new DomainError(403,'Se requiere acceso a Ventas.','PERMISSION_REQUIRED');
  }
  const result=await service(req,res).create(req.body);
  res.status(result.existing?200:201).json(result);
 });
 app.patch('/api/foreign-receipts/:id',read,requirePermission('foreign-receipts.update'),async(req,res)=>{
  res.json(await service(req,res).update(req.params.id,req.body));
 });
}
