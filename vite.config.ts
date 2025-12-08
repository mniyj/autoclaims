import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const devPort = Number(env.DEV_PORT || 3000);
    const previewPort = Number(env.PREVIEW_PORT || 4173);
    const basePath = env.BASE_PATH ? `/${env.BASE_PATH.replace(/^\/+|\/+$/g, '')}/` : '/';
    return {
      base: basePath,
      server: {
        port: devPort,
        host: '0.0.0.0',
      },
      preview: {
        port: previewPort,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
