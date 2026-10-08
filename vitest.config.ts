import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { fileParallelism: false, projects: [
    { test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], testTimeout: 30000, hookTimeout: 30000 } },
    { test: { name: 'integration', include: ['tests/integration/**/*.test.ts'], testTimeout: 30000, hookTimeout: 30000 } },
  ] },
});
