import { afterAll,describe,expect,it,vi } from 'vitest';
import request from 'supertest';
import { app } from '../../server/app';
import { prisma } from '../../server/db/prisma';
import { permissionKeys } from '../../shared/auth';
vi.mock('../../server/services/auth.service',async importOriginal=>{
  const actual=await importOriginal<typeof import('../../server/services/auth.service')>();
  return {...actual,createAuthService:(db:Parameters<typeof actual.createAuthService>[0])=>{
    const service=actual.createAuthService(db);return {...service,authenticate:async(token?:string)=>token==='unit-session'?{sessionId:'unit-id',user:{id:'00000000-0000-4000-8000-000000000001',name:'Unit',email:'unit@example.com',code:'USR-UNIT',status:'ACTIVE' as const,role:{id:'role-unit',code:'SUPERADMIN'},permissions:[...permissionKeys],lastLoginAt:null,createdAt:'2026-10-08'}}:service.authenticate(token)};
  }};
});
afterAll(()=>prisma.$disconnect());
const origin='http://127.0.0.1:5175',cookie='pos_session=unit-session';
describe('Frontera HTTP — validación sin DB; sesiones reales en integración',()=>{
 it('token compartido ya no autentica',async()=>{const result=await request(app).get('/api/clients').set('Authorization',`Bearer ${'a'.repeat(32)}`);expect(result.status).toBe(401);});
 it('error auth normalizado',async()=>{expect((await request(app).get('/api/clients')).body.error.code).toBe('AUTH_REQUIRED');});
 it('cuerpo inválido sin stack',async()=>{const result=await request(app).post('/api/registrations').set('Origin',origin).set('Cookie',cookie).send({client:{dni:'abc'}});expect(result.status).toBe(400);expect(result.body.error.code).toBe('VALIDATION_ERROR');expect(result.body.stack).toBeUndefined();});
 it('DNI inmutable',async()=>{const result=await request(app).patch('/api/clients/00000000-0000-4000-8000-000000000001').set('Origin',origin).set('Cookie',cookie).send({firstName:'A',lastName:'B',dni:'12345678'});expect(result.status).toBe(400);});
 it('ownerId no editable por PATCH',async()=>{const result=await request(app).patch('/api/equipment/00000000-0000-4000-8000-000000000001').set('Origin',origin).set('Cookie',cookie).send({brand:'A',model:'B',ownerId:'00000000-0000-4000-8000-000000000001'});expect(result.status).toBe(400);});
 it('paginación inválida',async()=>{expect((await request(app).get('/api/clients?limit=101&offset=-1').set('Cookie',cookie)).status).toBe(400);});
 it('health público seguro',async()=>{expect((await request(app).get('/api/health')).body).toEqual({name:'COMUNIC@TE POS',status:'ok'});});
 it('sin cookie falla cerrado',async()=>{expect((await request(app).get('/api/sales')).status).toBe(401);});
 it('origen extraño bloqueado',async()=>{expect((await request(app).post('/api/auth/login').set('Origin','https://attacker.example').send({})).status).toBe(403);});
 it('mutation sin Origin bloqueada',async()=>{expect((await request(app).post('/api/clients').set('Cookie',cookie).send({})).status).toBe(403);});
 it('nuevo cliente inválido',async()=>{expect((await request(app).post('/api/clients').set('Origin',origin).set('Cookie',cookie).send({dni:'abc'})).status).toBe(400);});
 it('ruta privada ausente normalizada',async()=>{expect((await request(app).get('/api/missing').set('Cookie',cookie)).status).toBe(404);});
});
