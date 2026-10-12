import { defineConfig, loadEnv } from 'vite';
import {publicEnvironment} from './shared/cloud';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({mode}) => {
 publicEnvironment({...loadEnv(mode, process.cwd(), 'VITE_'), ...Object.fromEntries(Object.entries(process.env).filter(([key])=>key.startsWith('VITE_')))}, mode === 'production');
 return {
  plugins: [react(), tailwindcss()],
  build:{manifest:true},
  server: {
    watch: { ignored: ['**/.local/**', '**/.local-admin.txt'] },
    proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001' },
  },
};
});
