import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error('Falta TEST_DATABASE_URL');
const target = new URL(testUrl);
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/communicate_pos_test') throw new Error('Sólo se permite la base local communicate_pos_test');
const adminUrl = new URL(testUrl); adminUrl.pathname = '/postgres';
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
try {
  const existing = await admin.$queryRaw<{ datname: string }[]>`SELECT datname FROM pg_database WHERE datname = 'communicate_pos_test'`;
  if (!existing.length) await admin.$executeRawUnsafe('CREATE DATABASE communicate_pos_test');
} finally { await admin.$disconnect(); }
const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'inherit', env: { ...process.env, DATABASE_URL: testUrl } });
process.exitCode = result.status ?? 1;
