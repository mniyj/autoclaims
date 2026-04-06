import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3006);
const HOST = process.env.HOST || "0.0.0.0";
const API_TARGET = process.env.API_TARGET || "http://127.0.0.1:3005";
const VOICE_API_TARGET =
  process.env.VOICE_API_TARGET || process.env.API_TARGET || "http://127.0.0.1:3005";
const DIST_DIR = path.join(__dirname, "dist");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendError(res, status, message) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: message }));
}

function pipeProxy(req, res, targetBase) {
  const targetUrl = new URL(req.url, targetBase);
  const transport = targetUrl.protocol === "https:" ? https : http;
  const headers = { ...req.headers, host: targetUrl.host };

  const proxyReq = transport.request(
    targetUrl,
    {
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (error) => {
    console.error("[smartclaim-ai-agent] Proxy failed:", targetUrl.href, error.message);
    if (!res.headersSent) {
      sendError(res, 502, "Upstream service unavailable");
    } else {
      res.end();
    }
  });

  req.pipe(proxyReq);
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname);
  let requestedPath = path.normalize(path.join(DIST_DIR, urlPath));

  if (!requestedPath.startsWith(DIST_DIR)) {
    sendError(res, 403, "Forbidden");
    return;
  }

  if (urlPath === "/" || urlPath === "") {
    requestedPath = path.join(DIST_DIR, "index.html");
  }

  fs.stat(requestedPath, (statError, stats) => {
    const finalPath =
      !statError && stats.isFile() ? requestedPath : path.join(DIST_DIR, "index.html");

    fs.readFile(finalPath, (readError, data) => {
      if (readError) {
        console.error("[smartclaim-ai-agent] Static file error:", finalPath, readError.message);
        sendError(res, 500, "Failed to read static asset");
        return;
      }

      const ext = path.extname(finalPath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control":
          finalPath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
      });
      res.end(data);
    });
  });
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    sendError(res, 400, "Missing request URL");
    return;
  }

  if (req.url.startsWith("/api/voice")) {
    pipeProxy(req, res, VOICE_API_TARGET);
    return;
  }

  if (req.url.startsWith("/api/")) {
    pipeProxy(req, res, API_TARGET);
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`[smartclaim-ai-agent] listening on http://${HOST}:${PORT}`);
  console.log(`[smartclaim-ai-agent] api proxy -> ${API_TARGET}`);
  console.log(`[smartclaim-ai-agent] voice proxy -> ${VOICE_API_TARGET}`);
});
