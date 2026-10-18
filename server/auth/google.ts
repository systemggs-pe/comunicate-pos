import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import type {Express} from 'express';
import type {PrismaClient} from '@prisma/client';
import {cookieName,cookieOptions,requestContext,requestIp} from './middleware.js';
import {hashToken,publicUser,sessionHours,userSelect} from '../services/auth.service.js';
import {writeAudit} from '../lib/audit.js';
import {authorizedOrigins} from '../ops/security.js';
import {DomainError} from '../lib/errors.js';

const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'),{timeoutDuration:8000});
const transactionCookie=()=>process.env.NODE_ENV==='production'?'__Host-pos_google':'pos_google';
function configuration(){
 const clientId=process.env.GOOGLE_OIDC_CLIENT_ID,secret=process.env.GOOGLE_OIDC_CLIENT_SECRET,redirect=process.env.GOOGLE_OIDC_REDIRECT_URI,origin=process.env.GOOGLE_OIDC_APP_ORIGIN;
 if(!clientId||!secret||!redirect||!origin)return null;
 try{const uri=new URL(redirect),app=new URL(origin);const production=process.env.NODE_ENV==='production';
  if(app.origin!==origin||!authorizedOrigins(process.env.AUTH_ALLOWED_ORIGINS,production).includes(origin)||uri.origin!==origin||uri.pathname!=='/api/auth/google/callback'||uri.search||uri.hash||uri.username||uri.password)return null;
  if(production&&uri.protocol!=='https:')return null;
  if(!production&&uri.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(uri.hostname))return null;
  return {clientId,secret,redirect,origin};
 }catch{return null;}
}
function grants():Record<string,string>{try{const raw:unknown=JSON.parse(process.env.GOOGLE_OIDC_AUTHORIZED_ACCOUNTS??'{}');if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};return Object.fromEntries(Object.entries(raw).filter(([email,sub])=>email===email.trim().toLowerCase()&&typeof sub==='string'&&/^[A-Za-z0-9_-]{1,255}$/.test(sub)));}catch{return {};}}

export function registerGoogleAuth(app:Express,db:PrismaClient){
 app.get('/api/auth/google/config',(_req,res)=>res.json({enabled:!!configuration()&&Object.keys(grants()).length>0}));
 app.post('/api/auth/google/start',async(req,res)=>{
  const config=configuration();if(!config||!Object.keys(grants()).length)throw new DomainError(503,'Google aún no está configurado. Usa tu acceso administrativo.','GOOGLE_NOT_CONFIGURED');
  const rateKey=hashToken('google-start:'+requestIp(req));
  const rates=await db.$queryRaw<{attempts:number}[]>`INSERT INTO "AuthRateLimit"(key,attempts,"expiresAt") VALUES(${rateKey},1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN "AuthRateLimit"."expiresAt"<=now() THEN 1 ELSE "AuthRateLimit".attempts+1 END,"expiresAt"=CASE WHEN "AuthRateLimit"."expiresAt"<=now() THEN now()+interval '15 minutes' ELSE "AuthRateLimit"."expiresAt" END RETURNING attempts`;
  if(rates[0].attempts>20)throw new DomainError(429,'Demasiados intentos. Reintenta en 15 minutos.','LOGIN_RATE_LIMITED');
  const state=randomBytes(32).toString('base64url'),browser=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
  await db.googleAuthAttempt.deleteMany({where:{expiresAt:{lt:new Date()}}});
  await db.googleAuthAttempt.create({data:{stateHash:hashToken(state),browserHash:hashToken(browser),nonce,verifier,expiresAt:new Date(Date.now()+600000)}});
  res.cookie(transactionCookie(),browser,{...cookieOptions(),maxAge:600000});
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirect,response_type:'code',scope:'openid email',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'}).toString();
  res.json({url:url.href});
 });
 app.get('/api/auth/google/callback',async(req,res)=>{
  const config=configuration();res.set('Referrer-Policy','no-referrer');
  res.clearCookie(transactionCookie(),cookieOptions());
  if(!config){res.status(503).send('Google no está configurado. Vuelve al acceso administrativo.');return;}
  try{
   const state=req.query.state,code=req.query.code;if(typeof state!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(state))throw Error('state');
   const browser=(req.headers.cookie??'').split(';').map(v=>v.trim()).find(v=>v.startsWith(transactionCookie()+'='))?.slice(transactionCookie().length+1);
   if(!browser||!/^[A-Za-z0-9_-]{43}$/.test(browser))throw Error('browser');
   const attempt=await db.googleAuthAttempt.findUnique({where:{stateHash:hashToken(state)}});
   if(!attempt||attempt.expiresAt<=new Date()||!timingSafeEqual(Buffer.from(attempt.browserHash),Buffer.from(hashToken(browser))))throw Error('attempt');
   const consumed=await db.googleAuthAttempt.deleteMany({where:{stateHash:attempt.stateHash,browserHash:hashToken(browser)}});if(consumed.count!==1)throw Error('consumed');
   if(req.query.error||typeof code!=='string'||code.length>4096)throw Error('code');
   const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.secret,redirect_uri:config.redirect,grant_type:'authorization_code',code,code_verifier:attempt.verifier}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('exchange');const tokens=await response.json() as {id_token?:unknown};if(typeof tokens.id_token!=='string')throw Error('token');
   const {payload}=await jwtVerify(tokens.id_token,keys,{issuer:['https://accounts.google.com','accounts.google.com'],audience:config.clientId,algorithms:['RS256'],maxTokenAge:'10m',clockTolerance:30,requiredClaims:['sub','exp','iat','nonce','email','email_verified']});
   if(payload.nonce!==attempt.nonce||payload.email_verified!==true||typeof payload.email!=='string'||!payload.sub||(payload.azp!==undefined&&payload.azp!==config.clientId))throw Error('identity');
   const email=payload.email.toLowerCase();if(grants()[email]!==payload.sub)throw Error('authorization');
   const token=randomBytes(32).toString('base64url'),expiresAt=new Date(Date.now()+sessionHours*3600000),ctx=requestContext(req);
   await db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(403204)`;
    const user=await tx.user.findUnique({where:{email},select:{...userSelect,googleSubject:true}});
    if(!user||user.status!=='ACTIVE'||!user.role||user.googleSubject&&user.googleSubject!==payload.sub)throw Error('user');
    const linked=await tx.user.findUnique({where:{googleSubject:payload.sub}});if(linked&&linked.id!==user.id)throw Error('link');
    const updated=await tx.user.update({where:{id:user.id},data:{googleSubject:payload.sub,lastLoginAt:new Date()},select:userSelect});publicUser(updated);
    await tx.session.create({data:{userId:user.id,tokenHash:hashToken(token),expiresAt,ip:ctx.ip,userAgent:ctx.userAgent}});
    await writeAudit(tx,{...ctx,userId:user.id},'LOGIN','User',user.id,{method:'GOOGLE'});
   });
   res.cookie(cookieName(),token,{...cookieOptions(),expires:expiresAt});res.redirect(303,config.origin+'/dashboard');
  }catch{await writeAudit(db,requestContext(req),'LOGIN_FAILED','Auth',undefined,{reason:'GOOGLE_REJECTED'}).catch(()=>undefined);res.redirect(303,config.origin+'/login?google=failed');}
 });
}
