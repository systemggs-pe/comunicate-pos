import 'dotenv/config';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { fileParallelism: false, projects: [
    { test: { name: 'unit', env:{DATABASE_URL:process.env.TEST_DATABASE_URL??'',GEMINI_ENABLED:'false',GEMINI_API_KEY:'',CODART_API_KEY:'',DNI_PROVIDER:'mock'}, include: ['tests/unit/**/*.test.ts'], testTimeout: 30000, hookTimeout: 30000 } },
    { test: { name: 'integration', env:{DATABASE_URL:process.env.TEST_DATABASE_URL??'',GEMINI_ENABLED:'false',GEMINI_API_KEY:'',CODART_API_KEY:'',DNI_PROVIDER:'mock'}, include: ['tests/integration/**/*.test.ts'], testTimeout: 30000, hookTimeout: 30000 } },
  ] },
});
