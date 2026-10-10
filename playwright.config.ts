import 'dotenv/config';
import { defineConfig } from '@playwright/test';
const database = process.env.TEST_DATABASE_URL;
if (!database) throw new Error('TEST_DATABASE_URL requerido');
const target = new URL(database);
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/communicate_pos_test') throw new Error('E2E sólo en PostgreSQL local de prueba');
export default defineConfig({
  testDir: './tests/e2e', workers: 1, timeout: 120000, expect: { timeout: 15000 },
  outputDir: '.test-results/e2e', reporter: 'list',
  use: { actionTimeout: 15000, screenshot: 'only-on-failure', baseURL: 'http://127.0.0.1:5175', channel: 'msedge', viewport: { width: 1280, height: 900 } },
  webServer: [
    { command: 'npx tsx server/local.ts', url: 'http://127.0.0.1:3002/api/health', timeout: 120000, env: { DATABASE_URL: database, S3_BUCKET:'communicate-evidence-test', AUTH_ALLOWED_ORIGINS:'http://127.0.0.1:5175', PORT: '3002', DNI_PROVIDER: 'mock' } },
    { command: 'npx vite --host 127.0.0.1 --port 5175 --strictPort', url: 'http://127.0.0.1:5175', timeout: 120000, env: { API_PROXY_TARGET: 'http://127.0.0.1:3002' } },
  ],
});
