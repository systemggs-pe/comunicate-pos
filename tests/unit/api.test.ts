import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../server/app';
import { prisma } from '../../server/db/prisma';
afterEach(() => vi.unstubAllEnvs());
afterAll(() => prisma.$disconnect());
describe('Frontera API', () => {
  it('health es público y no revela credenciales', async () => { const result = await request(app).get('/api/health'); expect(result.status).toBe(200); expect(result.body).toEqual({ name: 'COMUNIC@TE POS', status: 'ok' }); });
  it('falla cerrado si no hay configuración', async () => { vi.stubEnv('API_ACCESS_TOKEN', ''); expect((await request(app).get('/api/clients')).status).toBe(503); });
  it('rechaza el token placeholder de .env.example', async () => { vi.stubEnv('API_ACCESS_TOKEN', 'replace-with-a-random-token-at-least-32-characters'); expect((await request(app).get('/api/clients')).status).toBe(503); });
  it('no acepta token ausente o incorrecto', async () => { vi.stubEnv('API_ACCESS_TOKEN', 'a'.repeat(32)); expect((await request(app).get('/api/clients')).status).toBe(401); expect((await request(app).get('/api/clients').set('Authorization', `Bearer ${'b'.repeat(32)}`)).status).toBe(401); });
  it('valida cuerpo de nuevo cliente en servidor', async () => { const token = 'a'.repeat(32); vi.stubEnv('API_ACCESS_TOKEN', token); const result = await request(app).post('/api/clients').set('Authorization', `Bearer ${token}`).send({ dni: 'abc' }); expect(result.status).toBe(400); });
  it('ruta no encontrada produce JSON 404', async () => { const token = 'a'.repeat(32); vi.stubEnv('API_ACCESS_TOKEN', token); expect((await request(app).get('/api/missing').set('Authorization', `Bearer ${token}`)).status).toBe(404); });
});
