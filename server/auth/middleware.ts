import type { Request, Response, RequestHandler } from 'express';
import type { AuthUser, PermissionKey } from '../../shared/auth.js';
import { DomainError } from '../lib/errors.js';
import type { createAuthService } from '../services/auth.service.js';
import type { AuditContext } from '../lib/audit.js';
import {authorizedOrigins} from '../ops/security.js';
import {isIP} from 'node:net';
export const cookieName = () => process.env.NODE_ENV === 'production' ? '__Host-pos_session' : 'pos_session';
export const cookieOptions = () => ({ httpOnly:true, secure:process.env.NODE_ENV === 'production', sameSite:'lax' as const, path:'/' });
export function cookieToken(req: Request) { const pairs=(req.headers.cookie ?? '').split(';').map(v=>v.trim()); const entry=pairs.find(v=>v.startsWith(`${cookieName()}=`)); return entry?.slice(cookieName().length+1); }
export function clearSessionCookie(res: Response) { res.clearCookie(cookieName(),cookieOptions()); }
export function requestIp(req:Request){const localProxy=process.env.NODE_ENV==='production'&&process.env.TRUST_LOOPBACK_PROXY==='true'&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??'');const platform=process.env.NODE_ENV==='production'&&process.env.VERCEL==='1'?req.get('x-vercel-forwarded-for')?.split(',')[0]?.trim():localProxy?req.get('x-real-ip'):undefined;return platform&&isIP(platform)?platform:req.ip??'unknown';}
export function requestContext(req: Request, userId?: string): AuditContext { return { userId, ip:requestIp(req).slice(0,100), userAgent:req.get('user-agent')?.slice(0,300) }; }
export interface AuthState { user: AuthUser; sessionId: string }
export function authState(res: Response): AuthState { return res.locals.auth as AuthState; }
function origins() {
  return authorizedOrigins(process.env.AUTH_ALLOWED_ORIGINS,process.env.NODE_ENV==='production');
}
export const originGuard: RequestHandler = (req,res,next) => {
  const origin=req.get('origin'), allowed=origins();
  if(origin && !allowed.includes(origin)) throw new DomainError(403,'Origen no autorizado.','CSRF_ORIGIN_REJECTED');
  if(!['GET','HEAD','OPTIONS'].includes(req.method) && !origin) throw new DomainError(403,'La operación requiere un origen autorizado.','CSRF_ORIGIN_REQUIRED');
  if(origin) { res.set('Access-Control-Allow-Origin',origin); res.set('Access-Control-Allow-Credentials','true'); res.vary('Origin'); }
  if(req.method==='OPTIONS') { res.set('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS'); res.set('Access-Control-Allow-Headers','Content-Type'); res.status(204).end(); return; }
  next();
};
export function requireAuth(auth: ReturnType<typeof createAuthService>): RequestHandler { return async (req,res,next) => {
  try { res.locals.auth=await auth.authenticate(cookieToken(req)); next(); } catch(error) { if(error instanceof DomainError&&error.status===401)clearSessionCookie(res); throw error; }
}; }
export function requirePermission(...permissions: PermissionKey[]): RequestHandler { return (_req,res,next) => { const {user}=authState(res); if(permissions.some(p=>!user.permissions.includes(p))) throw new DomainError(403,'No tienes permisos para realizar esta operación.','PERMISSION_REQUIRED'); next(); }; }
export const rejectActorInput: RequestHandler = (req,_res,next) => {
  function contains(value: unknown): boolean { if(!value || typeof value!=='object') return false; return Object.entries(value).some(([key,v])=>['userId','createdById','registeredById'].includes(key)||contains(v)); }
  if(contains(req.body)) throw new DomainError(403,'La identidad del operador proviene de la sesión.','FORBIDDEN'); next();
};
