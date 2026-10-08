import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { prisma } from './db/prisma.js';
import { createPosService } from './services/pos.service.js';
import { publicError, DomainError } from './lib/errors.js';

export function createApp(db: PrismaClient) {
const service = createPosService(db);
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '32kb' }));
app.get('/api/health', (_req, res) => res.json({ name: 'COMUNIC@TE POS', status: 'ok' }));
// Guardia temporal servidor-servidor. No expone datos sin token ni cuando falta configuración.
app.use('/api', (req, _res, next) => {
  const expected = process.env.API_ACCESS_TOKEN;
  if (!expected || expected.length < 32 || expected === 'replace-with-a-random-token-at-least-32-characters') return next(new DomainError(503, 'API privada sin configurar.'));
  const actual = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
  if (Buffer.byteLength(actual) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return next(new DomainError(401, 'Acceso no autorizado.'));
  next();
});
app.get('/api/clients', async (_req, res) => res.json(await service.listClients()));
app.get('/api/clients/by-dni/:dni', async (req, res) => { const client = await service.findClientByDni(req.params.dni); if (!client) throw new DomainError(404, 'Cliente no encontrado.'); res.json(client); });
app.get('/api/clients/:id', async (req, res) => res.json(await service.getClientById(req.params.id)));
app.post('/api/clients', async (req, res) => res.status(201).json(await service.createClient(req.body)));
app.get('/api/equipment', async (_req, res) => res.json(await service.listEquipment()));
app.get('/api/equipment/by-imei/:value', async (req, res) => { const equipment = await service.findEquipmentByImei(req.params.value); if (!equipment) throw new DomainError(404, 'IMEI no encontrado.'); res.json(equipment); });
app.get('/api/equipment/:id/history', async (req, res) => res.json(await service.getEquipmentHistory(req.params.id)));
app.get('/api/equipment/:id', async (req, res) => res.json(await service.getEquipmentById(req.params.id)));
app.post('/api/equipment', async (req, res) => res.status(201).json(await service.createEquipment(req.body)));
app.post('/api/equipment/external', async (req, res) => res.status(201).json(await service.createExternalEquipment(req.body)));
app.post('/api/equipment/:id/imeis', async (req, res) => res.status(201).json(await service.addImeiToEquipment(req.params.id, req.body)));
app.patch('/api/imeis/:value/registration', async (req, res) => res.json(await service.updateImeiRegistrationStatus(req.params.value, req.body)));
app.post('/api/registrations/external', async (req, res) => res.json(await service.registerExternalImei(req.body)));
app.get('/api/sales', async (_req, res) => res.json(await service.listSales()));
app.get('/api/sales/:id', async (req, res) => res.json(await service.getSaleById(req.params.id)));
app.post('/api/sales', async (req, res) => res.status(201).json(await service.createSale(req.body)));
app.use('/api', (_req, res) => res.status(404).json({ message: 'Ruta no encontrada.' }));
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const result = publicError(error);
  // Sin cuerpos, credenciales, DNI, IMEI ni stack en logs públicos.
  if (result.status === 500) console.error('API_ERROR', error instanceof Error ? error.name : 'UnknownError');
  res.status(result.status).json({ message: result.message });
};
app.use(errorHandler);
return app;
}
export const app = createApp(prisma);
