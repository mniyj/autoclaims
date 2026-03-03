import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Inject env vars into process.env for server-side code (apiHandler)
  if (env.ALIYUN_OSS_REGION) process.env.ALIYUN_OSS_REGION = env.ALIYUN_OSS_REGION;
  if (env.ALIYUN_OSS_ACCESS_KEY_ID) process.env.ALIYUN_OSS_ACCESS_KEY_ID = env.ALIYUN_OSS_ACCESS_KEY_ID;
  if (env.ALIYUN_OSS_ACCESS_KEY_SECRET) process.env.ALIYUN_OSS_ACCESS_KEY_SECRET = env.ALIYUN_OSS_ACCESS_KEY_SECRET;
  if (env.ALIYUN_OSS_BUCKET) process.env.ALIYUN_OSS_BUCKET = env.ALIYUN_OSS_BUCKET;
  if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  
  // Start task scheduler in dev mode
  if (mode === 'development') {
    import('./server/taskQueue/scheduler.js').then(({ startScheduler }) => {
      startScheduler();
      console.log('[Vite] Task scheduler started in development mode');
    }).catch(err => {
      console.error('[Vite] Failed to start task scheduler:', err);
    });
  }

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
    plugins: [
      react(),
      {
        name: 'api-middleware',
        configureServer(server) {
          // Serve uploaded files
          server.middlewares.use((req, res, next) => {
            if (req.url?.startsWith('/uploads/')) {
               // Safe path resolution preventing directory traversal
               const safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
               const filePath = path.join(__dirname, safePath);
               
               if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                  const ext = path.extname(filePath).toLowerCase();
                  const mimeTypes: Record<string, string> = {
                      '.jpg': 'image/jpeg',
                      '.jpeg': 'image/jpeg', 
                      '.png': 'image/png',
                      '.gif': 'image/gif',
                      '.pdf': 'application/pdf',
                      '.txt': 'text/plain'
                  };
                  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
                  fs.createReadStream(filePath).pipe(res);
                  return;
               }
            }
            next();
          });

          server.middlewares.use((req, res, next) => {
            if (req.url?.startsWith('/api/')) {
              import('./server/apiHandler.js').then(({ handleApiRequest }) => {
                handleApiRequest(req, res);
              }).catch(err => {
                console.error('Failed to load API handler:', err);
                res.statusCode = 500;
                res.end('Internal Server Error');
              });
            } else {
              next();
            }
          });
        }
      }
    ],
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
