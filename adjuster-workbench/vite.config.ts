import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    ...loadEnv('', { mode: 'client' }),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(process.env.API_BASE_URL || 'http://localhost:3008'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3006,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
