import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { handleApiRequest } from './server/apiHandler.js';
import { startScheduler, stopScheduler } from './server/taskQueue/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 从环境变量获取端口，默认 3000
// 在阿里云部署时，可以通过 PORT=8080 node server.js 来指定端口
const PORT = process.env.PORT || 3000;

// 从环境变量获取子路径，默认为空（即根路径）
// 如果 BASE_PATH 设置为 /insurance-config，则应用将挂载在该路径下
const BASE_PATH = process.env.BASE_PATH || '/';

// 构建产物目录
const distPath = path.join(__dirname, 'dist');

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// JSON body 解析中间件（用于 API 请求）
app.use(express.json({ limit: '10mb' }));

// API 路由 — 优先于静态文件和 SPA 路由
app.all(/^\/api\/(.*)$/, (req, res) => {
  handleApiRequest(req, res);
});

// 静态资源服务
// 如果有 BASE_PATH，则挂载到该路径；否则挂载到根路径
if (BASE_PATH !== '/') {
  // 去除首尾斜杠以确保路径格式正确
  const cleanBasePath = `/${BASE_PATH.replace(/^\/+|\/+$/g, '')}`;

  console.log(`Mounting app at ${cleanBasePath}`);

  app.use(cleanBasePath, express.static(distPath));
  // Serve uploads directory
  app.use(`${cleanBasePath}/uploads`, express.static(path.join(__dirname, 'uploads')));

  // 处理 SPA 路由重定向 (HTML5 History Mode)
   // 所有非静态资源的请求都返回 index.html
   app.get(/(.*)/, (req, res) => {
     res.sendFile(path.join(distPath, 'index.html'));
   });

   // 根路径重定向到子路径（可选）
   app.get('/', (req, res) => {
     res.redirect(cleanBasePath);
   });

 } else {
   app.use(express.static(distPath));
   // Serve uploads directory
   app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

   // 处理 SPA 路由重定向
   app.get(/(.*)/, (req, res) => {
     res.sendFile(path.join(distPath, 'index.html'));
   });
 }

// 创建 HTTP 服务器
const server = http.createServer(app);

// 初始化语音 WebSocket 服务（动态加载，避免 TS 文件未编译时崩溃）
import('./dist-server/voice/VoiceGateway.js').then(({ VoiceGateway }) => {
  new VoiceGateway(server);
  console.log('[Server] 语音 WebSocket 服务已初始化');
}).catch(err => {
  console.warn('[Server] 语音 WebSocket 服务未启动:', err.message);
  console.warn('[Server] 提示：请先运行 npm run build:server 编译后端代码');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}${BASE_PATH !== '/' ? BASE_PATH : ''}`);
  console.log(`Environment: Production`);
  console.log(`Serving static files from: ${distPath}`);
  console.log(`API routes: /api/* → JSON file storage`);
  console.log(`Voice WebSocket: ws://localhost:${PORT}/voice/ws/:sessionId`);
  
  startScheduler();
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  stopScheduler();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  stopScheduler();
  process.exit(0);
});
