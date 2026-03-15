import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const voiceDevPort = Number(env.VOICE_DEV_PORT || 8092);

  if (env.ALIYUN_OSS_REGION) process.env.ALIYUN_OSS_REGION = env.ALIYUN_OSS_REGION;
  if (env.ALIYUN_OSS_ACCESS_KEY_ID) process.env.ALIYUN_OSS_ACCESS_KEY_ID = env.ALIYUN_OSS_ACCESS_KEY_ID;
  if (env.ALIYUN_OSS_ACCESS_KEY_SECRET) process.env.ALIYUN_OSS_ACCESS_KEY_SECRET = env.ALIYUN_OSS_ACCESS_KEY_SECRET;
  if (env.ALIYUN_OSS_BUCKET) process.env.ALIYUN_OSS_BUCKET = env.ALIYUN_OSS_BUCKET;
  if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (env.ALIYUN_ACCESS_KEY_ID) process.env.ALIYUN_ACCESS_KEY_ID = env.ALIYUN_ACCESS_KEY_ID;
  if (env.ALIYUN_ACCESS_KEY_SECRET) process.env.ALIYUN_ACCESS_KEY_SECRET = env.ALIYUN_ACCESS_KEY_SECRET;
  if (env.ALIYUN_NLS_APP_KEY) process.env.ALIYUN_NLS_APP_KEY = env.ALIYUN_NLS_APP_KEY;
  if (env.ALIYUN_TTS_APP_KEY) process.env.ALIYUN_TTS_APP_KEY = env.ALIYUN_TTS_APP_KEY;

  const devPort = Number(env.DEV_PORT || 3000);
  const previewPort = Number(env.PREVIEW_PORT || 4173);
  const basePath = env.BASE_PATH ? `/${env.BASE_PATH.replace(/^\/+|\/+$/g, '')}/` : '/';
  
  return {
    base: basePath,
    server: {
      port: devPort,
      host: '0.0.0.0',
      proxy: {
        '/api/voice': {
          target: `http://127.0.0.1:${voiceDevPort}`,
          changeOrigin: true,
        },
        '/voice/ws': {
          target: `ws://127.0.0.1:${voiceDevPort}`,
          ws: true,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: previewPort,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'server-middleware',
        configureServer(server) {
          // Voice WebSocket is served by a dedicated dev server and proxied via Vite.
          // This keeps it isolated from Vite's HMR socket.

          // 启动任务调度器（开发模式）
          import('./server/taskQueue/scheduler.js').then(({ startScheduler }) => {
            startScheduler();
            console.log('[Vite Dev] Task scheduler started');
          }).catch(err => {
            console.error('[Vite Dev] Failed to start scheduler:', err);
          });

          // 注意：在 configureServer 中注册的中间件会在 Vite 内部中间件之前执行
          // 知识库 API 路由
          server.middlewares.use((req, res, next) => {
            if (req.url?.startsWith('/api/knowledge')) {
              import('./server/knowledge/api/routes.js').then((knowledgeRoutes) => {
                const router = knowledgeRoutes.default;
                router(req, res, next);
              }).catch(err => {
                console.error('Knowledge API error:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Server Error', message: err.message }));
              });
            } else {
              next();
            }
          });

          server.middlewares.use((req, res, next) => {
            if (req.url?.startsWith('/api/')) {
              import('./server/apiHandler.js').then(({ handleApiRequest }) => {
                handleApiRequest(req, res);
              }).catch(err => {
                console.error('API handler error:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Server Error', message: err.message }));
              });
            } else {
              next();
            }
          });

          server.middlewares.use((req, res, next) => {
            if (req.url?.startsWith('/uploads/')) {
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
        }
      }
    ],
    define: {
      __VOICE_DEV_PORT__: JSON.stringify(voiceDevPort),
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
