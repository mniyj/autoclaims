import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 8081,
      host: '0.0.0.0',
      hmr: false,
    },
    plugins: [tailwindcss(), react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.ALIYUN_OSS_REGION': JSON.stringify(env.ALIYUN_OSS_REGION),
      'process.env.ALIYUN_OSS_ACCESS_KEY_ID': JSON.stringify(env.ALIYUN_OSS_ACCESS_KEY_ID),
      'process.env.ALIYUN_OSS_ACCESS_KEY_SECRET': JSON.stringify(env.ALIYUN_OSS_ACCESS_KEY_SECRET),
      'process.env.ALIYUN_OSS_BUCKET': JSON.stringify(env.ALIYUN_OSS_BUCKET),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
