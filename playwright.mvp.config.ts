import base from './playwright.config';
import {defineConfig} from '@playwright/test';
export default defineConfig({...base,testMatch:'mvp-*.spec.ts',webServer:[
 {command:'npx tsx tests/helpers/mvp-server.ts',url:'http://127.0.0.1:3002/api/health',timeout:120000,env:{DATABASE_URL:process.env.TEST_DATABASE_URL!,S3_BUCKET:'communicate-evidence-test',AUTH_ALLOWED_ORIGINS:'http://127.0.0.1:5175',PORT:'3002',DNI_PROVIDER:'mock'}},
 {command:'npx vite --host 127.0.0.1 --port 5175 --strictPort',url:'http://127.0.0.1:5175',timeout:120000,env:{API_PROXY_TARGET:'http://127.0.0.1:3002'}},
]});
