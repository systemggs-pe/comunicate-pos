import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createAuthService } from '../../server/services/auth.service';
export const testEmail='test-admin@example.com',testPassword='test-only-admin-password-2026',testOrigin='http://127.0.0.1:5175';
export async function seedTestAdmin(db:PrismaClient){const url=new URL(process.env.TEST_DATABASE_URL!);if(!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/communicate_pos_test')throw new Error('Sólo fixtures de prueba local');await createAuthService(db).bootstrap({name:'Administrador de prueba',email:testEmail,password:testPassword});}
export async function loginAgent(app:ReturnType<typeof import('../../server/app').createApp>,email=testEmail,password=testPassword){const agent=request.agent(app);const response=await agent.post('/api/auth/login').set('Origin',testOrigin).send({email,password});if(response.status!==200)throw new Error(`Login de prueba falló: ${response.body.error?.code}`);return agent;}
