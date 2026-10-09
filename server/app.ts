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

export function createApp(db: PrismaClient, options: { dniProvider?: DniProvider; dniOptions?: DniLookupOptions } = {}) {
const auth = createAuthService(db);
const dniLookup = createDniLookupService(dni => db.client.findUnique({ where: { dni } }), options.dniProvider ?? createDniProvider(), options.dniOptions ?? dniLookupOptions());
const pos = (req: Request,res: Response) => createPosService(db,requestContext(req,authState(res).user.id));
const users = (req: Request,res: Response) => createUsersService(db,authState(res).user,requestContext(req,authState(res).user.id));
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '32kb' }));
app.get('/api/health', (_req, res) => res.json({ name: 'COMUNIC@TE POS', status: 'ok' }));
app.use('/api', (_req,res,next) => { res.set('Cache-Control','no-store'); next(); });
app.use('/api', originGuard);
app.post('/api/auth/login', async (req,res) => { const result=await auth.login(req.body,requestContext(req)); res.cookie(cookieName(),result.token,{...cookieOptions(),expires:result.expiresAt}); res.json(result.user); });
app.use('/api',requireAuth(auth));
app.use('/api',rejectActorInput);
app.get('/api/auth/me', (_req,res) => res.json(authState(res).user));
app.get('/api/dni/:dni', async (req,res) => {
  const permissions = authState(res).user.permissions;
  if (!['clients.create', 'sales.create', 'registration.create'].some(permission => permissions.includes(permission as typeof permissions[number]))) throw new DomainError(403,'No tienes permisos para consultar DNI.','PERMISSION_REQUIRED');
  res.json(await dniLookup.lookup(req.params.dni));
});
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
app.get('/api/dashboard', requirePermission('sales.read'), async (req, res) => res.json(await pos(req,res).dashboard()));
app.get('/api/sales', requirePermission('sales.read'), async (req, res) => res.json(await pos(req,res).listSales(req.query)));
app.post('/api/sales/resolve', requirePermission('sales.create'), async (req, res) => res.json(await pos(req,res).resolveSale(req.body)));
app.get('/api/sales/:id', requirePermission('sales.read'), async (req, res) => res.json(await pos(req,res).getSaleById(req.params.id)));
app.post('/api/sales', requirePermission('sales.create','clients.create','equipment.create'), async (req, res) => res.status(201).json(await pos(req,res).createSale(req.body)));
app.post('/api/sales/:id/cancel', requirePermission('sales.cancel'), async (req, res) => res.json(await pos(req,res).cancelSale(req.params.id, req.body)));
app.use('/api', (_req, _res, next) => next(new DomainError(404, 'Ruta no encontrada.', 'ROUTE_NOT_FOUND')));
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const result = publicError(error);
  // Sin cuerpos, credenciales, DNI, IMEI ni stack en logs públicos.
  if (result.status === 500) console.error('API_ERROR', error instanceof Error ? error.name : 'UnknownError');
  res.status(result.status).json({ error: { code: result.code, message: result.message }, message: result.message });
};
app.use(errorHandler);
return app;
}
export const app = createApp(prisma);
