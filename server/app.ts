import {createEvidenceService} from './evidence/service.js';
import { registerReportRoutes } from './routes/reports.routes.js';
import {observeHttp,maintenanceGuard,apiThrottle} from './ops/security.js';
import {HeadBucketCommand} from '@aws-sdk/client-s3';
import {createEvidenceStorage,S3EvidenceStorage} from './storage/s3.js';
import { createReportsService } from './services/reports.service.js';
import type {EvidenceStorageProvider} from './storage/provider.js';
import { normalizeOperationalResponse } from '../shared/normalization.js';
import {createCompanyService} from './services/company.service.js';
import {createDeclarationService} from './services/declaration.service.js';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { createAuthService } from './services/auth.service.js';
import { createUsersService } from './services/users.service.js';
import { authState, cookieName, cookieOptions, clearSessionCookie, originGuard, requireAuth, requirePermission, requestContext, rejectActorInput } from './auth/middleware.js';
import type { Response, Request } from 'express';
import type { PrismaClient } from '@prisma/client';
import { prisma } from './db/prisma.js';
import { createPosService } from './services/pos.service.js';
import { publicError, DomainError } from './lib/errors.js';
import { createDniProvider } from './dni/providers.js';
import { createDniLookupService, dniLookupOptions, type DniLookupOptions } from './dni/lookup.service.js';
import type { DniProvider } from './dni/provider.js';

export function createApp(db: PrismaClient, options: { dniProvider?: DniProvider; dniOptions?: DniLookupOptions; evidenceStorage?:EvidenceStorageProvider } = {}) {
const auth = createAuthService(db);
const dniLookup = createDniLookupService(dni => db.client.findUnique({ where: { dni } }), options.dniProvider ?? createDniProvider(), options.dniOptions ?? dniLookupOptions());
const pos = (req: Request,res: Response) => createPosService(db,requestContext(req,authState(res).user.id),authState(res).sessionId,authState(res).user.permissions.includes('registration.evidence.delete'));
const users = (req: Request,res: Response) => createUsersService(db,authState(res).user,requestContext(req,authState(res).user.id));
const evidence=(req:Request,res:Response)=>createEvidenceService(db,authState(res),requestContext(req,authState(res).user.id),options.evidenceStorage);
const app = express();
app.disable('x-powered-by');
app.use(observeHttp);
app.use((_req,res,next)=>{const json=res.json.bind(res);res.json=value=>json(normalizeOperationalResponse(value));next();});
app.use(helmet());
app.use(express.json({ limit: '32kb' }));
app.use('/api', (_req,res,next) => { res.set('Cache-Control','no-store'); next(); });
app.get('/api/health', (_req, res) => res.json({ name: 'COMUNIC@TE POS', status: 'ok' }));
app.use('/api', originGuard);
app.use('/api',maintenanceGuard);
app.post('/api/auth/login', async (req,res) => { const result=await auth.login(req.body,requestContext(req)); res.cookie(cookieName(),result.token,{...cookieOptions(),expires:result.expiresAt}); res.json(result.user); });
app.use('/api',requireAuth(auth));
app.use('/api',rejectActorInput);
app.use('/api',apiThrottle(db));
app.get('/api/readiness',requirePermission('settings.read'),async(_req,res)=>{
 const checks:{database:string;storage:string;deletionQueue?:number}={database:'NOT AVAILABLE',storage:'NOT AVAILABLE'};
 try{await db.$queryRaw`SELECT 1`;checks.database='PASS';checks.deletionQueue=await db.evidenceAsset.count({where:{status:'DELETING'}});}catch{res.status(503).json({status:'degraded',checks});return;}
 const storage=options.evidenceStorage??createEvidenceStorage();try{if(!(storage instanceof S3EvidenceStorage))throw new Error('STORAGE_PROBE_UNAVAILABLE');await storage.client.send(new HeadBucketCommand({Bucket:storage.config.bucket}));checks.storage='PASS';res.json({status:'ready',checks});}catch{res.status(503).json({status:'degraded',checks});}finally{if(!options.evidenceStorage&&(storage instanceof S3EvidenceStorage))storage.client.destroy();}
});
registerReportRoutes(app, db);
app.get('/api/auth/me', (_req,res) => res.json(authState(res).user));
app.post('/api/evidence/uploads',async(req,res)=>res.status(201).json(await evidence(req,res).init(req.body)));
app.post('/api/evidence/uploads/:id/verify',async(req,res)=>res.json(await evidence(req,res).verify(req.params.id)));
app.delete('/api/evidence/uploads/:id',async(req,res)=>res.json(await evidence(req,res).abandon(req.params.id)));
app.post('/api/evidence/cleanup',async(req,res)=>res.json(await evidence(req,res).cleanup()));
app.get('/api/registration-requests/:id/evidence',async(req,res)=>res.json(await evidence(req,res).list(req.params.id)));
app.get('/api/registration-requests/:id/evidence/:linkId/access',async(req,res)=>res.json(await evidence(req,res).access(req.params.id,req.params.linkId,req.query.download==='true')));
app.post('/api/registration-requests/:id/evidence',async(req,res)=>res.json(await evidence(req,res).attach(req.params.id,req.body)));
app.delete('/api/registration-requests/:id/evidence/:linkId',async(req,res)=>res.json(await evidence(req,res).remove(req.params.id,req.params.linkId,req.body)));

app.get('/api/registration-requests/:id/declaration-data',requirePermission('registration.read','registration.update'),async(req,res)=>res.json(await createDeclarationService(db,requestContext(req,authState(res).user.id)).data(req.params.id)));
app.post('/api/registration-requests/:id/declaration',requirePermission('registration.read','registration.update'),async(req,res)=>res.json(await createDeclarationService(db,requestContext(req,authState(res).user.id)).generate(req.params.id,req.body)));
app.get('/api/settings/company',requirePermission('settings.read'),async(_req,res)=>res.json(await createCompanyService(db).get()));
app.patch('/api/settings/company',requirePermission('settings.update'),async(req,res)=>res.json(await createCompanyService(db,requestContext(req,authState(res).user.id)).update(req.body)));
app.get('/api/sales/:id/receipt',requirePermission('sales.read'),async(req,res)=>{
 const sale=await pos(req,res).getSaleById(req.params.id);
 res.json({sale,company:await createCompanyService(db).get()});
});
app.get('/api/dni/:dni', async (req,res) => {
  const permissions = authState(res).user.permissions;
  if (!['clients.create', 'sales.create', 'registration.create'].some(permission => permissions.includes(permission as typeof permissions[number]))) throw new DomainError(403,'No tienes permisos para consultar DNI.','PERMISSION_REQUIRED');
  res.json(await dniLookup.lookup(req.params.dni));
});
for(const [path,kind,permission] of [['sales','sale','sales.delete'],['registration-requests','request','registration.delete'],['equipment','equipment','equipment.delete']] as const){
 app.get(`/api/${path}/:id/deletion-preview`,requirePermission(permission),async(req,res)=>res.json(await pos(req,res).deletionPreview(kind,req.params.id,req.query.removeOrphanEquipment==='true')));
 app.delete(`/api/${path}/:id`,requirePermission(permission),async(req,res)=>{const preview=await pos(req,res).deletionPreview(kind,req.params.id,req.body?.removeOrphanEquipment===true);if(preview.counts.evidence>0&&!authState(res).user.permissions.includes('registration.evidence.delete'))throw new DomainError(403,'LA ELIMINACIÓN INCLUYE FOTOS Y REQUIERE PERMISO PARA ELIMINAR EVIDENCIAS.','PERMISSION_REQUIRED');res.json(await pos(req,res).deletePermanently(kind,req.params.id,req.body));});
}
app.get('/api/registration-requests',requirePermission('registration.read'),async(req,res)=>res.json(await pos(req,res).listRegistrationRequests(req.query)));
app.post('/api/registration-operations',requirePermission('registration.create','clients.create','equipment.create'),async(req,res)=>{if(req.body?.evidence?.length&&!authState(res).user.permissions.includes('registration.evidence.upload'))throw new DomainError(403,'NO TIENES PERMISOS PARA ADJUNTAR EVIDENCIAS.','PERMISSION_REQUIRED');res.status(201).json(await pos(req,res).createRegistrationOperation(req.body));});
app.post('/api/registration-requests/complete',requirePermission('registration.update'),async(req,res)=>res.json(await pos(req,res).completeRegistrationRequests(req.body)));
app.get('/api/registration-requests/:id',requirePermission('registration.read'),async(req,res)=>res.json(await pos(req,res).getRegistrationRequest(req.params.id)));
app.patch('/api/registration-requests/:id',requirePermission('registration.update'),async(req,res)=>res.json(await pos(req,res).updateRegistrationRequest(req.params.id,req.body)));
app.post('/api/registration-requests/:id/transition',requirePermission('registration.update'),async(req,res)=>res.json(await pos(req,res).transitionRegistrationRequest(req.params.id,req.body)));
app.patch('/api/sales/:id',requirePermission('sales.update'),async(req,res)=>res.json(await pos(req,res).updateSaleNotes(req.params.id,req.body)));
app.post('/api/auth/logout', async (req,res) => { const state=authState(res); await auth.logout(state.sessionId,requestContext(req,state.user.id)); clearSessionCookie(res); res.json({logout:true}); });
app.get('/api/users',requirePermission('users.read'),async (req,res)=>res.json(await users(req,res).list(req.query)));
app.get('/api/users/:id',requirePermission('users.read'),async (req,res)=>res.json(await users(req,res).get(req.params.id)));
app.post('/api/users',requirePermission('users.create'),async (req,res)=>res.status(201).json(await users(req,res).create(req.body)));
app.patch('/api/users/:id',requirePermission('users.update'),async (req,res)=>{
  // Alterar estado por PATCH no puede saltarse users.disable.
  if(req.body && 'status' in req.body && !authState(res).user.permissions.includes('users.disable')) throw new DomainError(403,'No tienes permisos para cambiar el estado.','PERMISSION_REQUIRED');
  res.json(await users(req,res).update(req.params.id,req.body));
});
app.post('/api/users/:id/disable',requirePermission('users.disable'),async (req,res)=>res.json(await users(req,res).disable(req.params.id)));
app.post('/api/users/:id/enable',requirePermission('users.disable'),async (req,res)=>res.json(await users(req,res).enable(req.params.id)));
app.post('/api/users/:id/reset-password',requirePermission('users.update'),async (req,res)=>res.json(await users(req,res).reset(req.params.id,req.body)));
app.get('/api/roles',requirePermission('roles.read'),async (req,res)=>res.json(await users(req,res).roles()));
app.patch('/api/roles/:id',requirePermission('roles.update'),async (req,res)=>res.json(await users(req,res).updateRole(req.params.id,req.body)));
app.get('/api/audit',requirePermission('audit.read'),async (req,res)=>res.json(await users(req,res).audit(req.query)));
app.get('/api/clients', requirePermission('clients.read'), async (req, res) => res.json(await pos(req,res).listClients(req.query)));
app.get('/api/clients/by-dni/:dni', requirePermission('clients.read'), async (req, res) => { const client = await pos(req,res).findClientByDni(req.params.dni); if (!client) throw new DomainError(404, 'Cliente no encontrado.', 'CLIENT_NOT_FOUND'); res.json(client); });
app.get('/api/clients/:id', requirePermission('clients.read'), async (req, res) => res.json(await pos(req,res).getClientById(req.params.id)));
app.post('/api/clients', requirePermission('clients.create'), async (req, res) => res.status(201).json(await pos(req,res).createClient(req.body)));
app.patch('/api/clients/:id', requirePermission('clients.update'), async (req, res) => res.json(await pos(req,res).updateClient(req.params.id, req.body)));
app.get('/api/equipment', requirePermission('equipment.read'), async (req, res) => res.json(await pos(req,res).listEquipment(req.query)));
app.get('/api/equipment/by-imei/:value', requirePermission('equipment.read'), async (req, res) => { const equipment = await pos(req,res).findEquipmentByImei(req.params.value); if (!equipment) throw new DomainError(404, 'IMEI no encontrado.', 'IMEI_NOT_FOUND'); res.json(equipment); });
app.get('/api/equipment/:id/history', requirePermission('equipment.read'), async (req, res) => res.json(await pos(req,res).getEquipmentHistory(req.params.id)));
app.get('/api/equipment/:id', requirePermission('equipment.read'), async (req, res) => res.json(await pos(req,res).getEquipmentById(req.params.id)));
app.post('/api/equipment', requirePermission('equipment.create'), async (req, res) => res.status(201).json(await pos(req,res).createEquipment(req.body)));
app.patch('/api/equipment/:id', requirePermission('equipment.update'), async (req, res) => res.json(await pos(req,res).updateEquipment(req.params.id, req.body)));
app.post('/api/equipment/external', requirePermission('equipment.create','clients.create'), async (req, res) => res.status(201).json(await pos(req,res).createExternalEquipment(req.body)));
app.post('/api/equipment/:id/imeis', requirePermission('equipment.update'), async (req, res) => res.status(201).json(await pos(req,res).addImeiToEquipment(req.params.id, req.body)));
app.patch('/api/imeis/:value/registration', requirePermission('registration.update'), async (req, res) => res.json(await pos(req,res).updateImeiRegistrationStatus(req.params.value, req.body)));
app.post('/api/registrations/external', requirePermission('registration.create','registration.update','clients.create','equipment.create'), async (req, res) => res.json(await pos(req,res).registerExternalImei(req.body)));
app.post('/api/registrations/resolve', requirePermission('registration.read'), async (req, res) => res.json(await pos(req,res).resolveRegistration(req.body)));
app.post('/api/registrations', requirePermission('registration.create','registration.update','clients.create','equipment.create'), async (req, res) => res.json(await pos(req,res).submitRegistration(req.body)));
app.get('/api/dashboard', requirePermission('reports.read'), async (_req, res) => { const data = await createReportsService(db).read('general', {preset:'today'}); res.json({day:data.period.from,salesToday:data.summary.salesCount,revenueToday:data.summary.salesRevenue,equipmentSoldToday:data.summary.equipmentSold}); });
app.get('/api/sales', requirePermission('sales.read'), async (req, res) => res.json(await pos(req,res).listSales(req.query)));
app.post('/api/sales/resolve', requirePermission('sales.create'), async (req, res) => res.json(await pos(req,res).resolveSale(req.body)));
app.get('/api/sales/:id', requirePermission('sales.read'), async (req, res) => res.json(await pos(req,res).getSaleById(req.params.id)));
app.post('/api/sales', requirePermission('sales.create','clients.create','equipment.create'), async (req, res) => res.status(201).json(await pos(req,res).createSale(req.body)));
app.use('/api', (_req, _res, next) => next(new DomainError(404, 'Ruta no encontrada.', 'ROUTE_NOT_FOUND')));
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const result = publicError(error);
  res.locals.errorCode=result.code;
  // Sin cuerpos, credenciales, DNI, IMEI ni stack en logs públicos.
  if (result.status === 500) console.error(JSON.stringify({event:'api.error',requestId:res.get('X-Request-Id'),code:result.code,status:result.status}));
  res.status(result.status).json({ error: { code: result.code, message: result.message }, message: result.message });
};
app.use(errorHandler);
return app;
}
export const app = createApp(prisma);
