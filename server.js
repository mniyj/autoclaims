import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { readFileSync } from "fs";
import { handleApiRequest } from "./server/apiHandler.js";
// 后台服务仅在主实例启动（通过 ENABLE_BACKGROUND_SERVICES=true 或 默认 PORT=3005）
const enableBackground =
  process.env.ENABLE_BACKGROUND_SERVICES !== "false" &&
  (process.env.ENABLE_BACKGROUND_SERVICES === "true" ||
    !process.env.PORT ||
    process.env.PORT === "3005");

let startScheduler,
  stopScheduler,
  startAIConsistencyMonitor,
  stopAIConsistencyMonitor;
if (enableBackground) {
  ({ startScheduler, stopScheduler } =
    await import("./server/taskQueue/scheduler.js"));
  ({ startAIConsistencyMonitor, stopAIConsistencyMonitor } =
    await import("./server/services/aiConsistencyMonitor.js"));
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local (Vite loads this in dev, but production server needs to do it manually)
try {
  const envContent = readFileSync(path.join(__dirname, ".env.local"), "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
  console.log("[Server] Loaded environment from .env.local");
} catch {
  // .env.local not found - rely on system environment variables
}

const app = express();
const server = http.createServer(app);

// 从环境变量获取端口，默认 3000
// 在阿里云部署时，可以通过 PORT=8080 node server.js 来指定端口
const PORT = process.env.PORT || 3000;

// 从环境变量获取子路径，默认为空（即根路径）
// 如果 BASE_PATH 设置为 /insurance-config，则应用将挂载在该路径下
const BASE_PATH = process.env.BASE_PATH || "/";

// 构建产物目录
const distPath = path.join(__dirname, "dist");

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// JSON body 解析中间件（用于 API 请求）
app.use(express.json({ limit: "10mb" }));

try {
  const voiceRoutesModule =
    await import("./dist-server/server/routes/voice.js");
  voiceRoutesModule.initializeVoiceRoutes(server);
  app.use("/api/voice", voiceRoutesModule.default);
  console.log("[Server] 语音 API 路由已初始化");
} catch (err) {
  console.warn("[Server] 语音 API 路由未启动:", err.message);
  console.warn("[Server] 提示：请先运行 npm run build:server 编译后端代码");
}

// 知识库 API 路由
try {
  const knowledgeRoutes = await import("./server/knowledge/api/routes.js");
  app.use("/api/knowledge", knowledgeRoutes.default);
  console.log("[Server] 知识库 API 路由已初始化");
} catch (err) {
  console.warn("[Server] 知识库 API 路由未启动:", err.message);
}

// API 路由 — 优先于静态文件和 SPA 路由
app.all(/^\/api\/(.*)$/, (req, res) => {
  handleApiRequest(req, res);
});

// 静态资源服务
// 如果有 BASE_PATH，则挂载到该路径；否则挂载到根路径
if (BASE_PATH !== "/") {
  // 去除首尾斜杠以确保路径格式正确
  const cleanBasePath = `/${BASE_PATH.replace(/^\/+|\/+$/g, "")}`;

  console.log(`Mounting app at ${cleanBasePath}`);

  app.use(cleanBasePath, express.static(distPath));
  // Serve uploads directory
  app.use(
    `${cleanBasePath}/uploads`,
    express.static(path.join(__dirname, "uploads")),
  );

  // 处理 SPA 路由重定向 (HTML5 History Mode)
  // 所有非静态资源的请求都返回 index.html
  app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  // 根路径重定向到子路径（可选）
  app.get("/", (req, res) => {
    res.redirect(cleanBasePath);
  });
} else {
  app.use(express.static(distPath));
  // Serve uploads directory
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));

  // 处理 SPA 路由重定向
  app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Server is running on http://0.0.0.0:${PORT}${BASE_PATH !== "/" ? BASE_PATH : ""}`,
  );
  console.log(`Environment: Production`);
  console.log(`Serving static files from: ${distPath}`);
  console.log(`API routes: /api/* → JSON file storage`);
  console.log(`Voice WebSocket: ws://localhost:${PORT}/voice/ws/:sessionId`);

  if (enableBackground) {
    startScheduler();
    startAIConsistencyMonitor();
    console.log("[Server] 后台服务已启动 (scheduler + AI monitor)");
  } else {
    console.log("[Server] 后台服务已跳过 (仅 API + 静态文件)");
  }
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  if (enableBackground) {
    stopScheduler();
    stopAIConsistencyMonitor();
  }
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  if (enableBackground) {
    stopScheduler();
    stopAIConsistencyMonitor();
  }
  process.exit(0);
});
