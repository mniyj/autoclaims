import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync } from "fs";
import { VoiceGateway } from "./voice/VoiceGateway.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveProjectRoot() {
  const candidates = [
    path.resolve(__dirname, ".."),
    path.resolve(__dirname, "..", ".."),
  ];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, ".env.local"))) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1];
}

const projectRoot = resolveProjectRoot();

function loadEnvConfig() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) {
      continue;
    }

    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvConfig();

const app = express();
const server = http.createServer(app);
const voiceGateway = new VoiceGateway(server);
const port = Number(process.env.VOICE_DEV_PORT || 8092);

app.use(express.json({ limit: "2mb" }));

app.get("/api/voice/health", (_req, res) => {
  res.json({
    success: true,
    status: "running",
    port,
    services: voiceGateway.getServiceStatus(),
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/voice/session/start", (req, res) => {
  const userId = req.body?.userId || "anonymous";
  const sessionId = voiceGateway.createSession(userId);
  const host = req.headers.host || `localhost:${port}`;
  const wsProtocol = req.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";

  res.json({
    success: true,
    sessionId,
    wsUrl: `${wsProtocol}://${host}/voice/ws/${sessionId}`,
    services: voiceGateway.getServiceStatus(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
});

app.post("/api/voice/session/:sessionId/end", (req, res) => {
  const { sessionId } = req.params;
  voiceGateway.endSession(sessionId);
  res.json({
    success: true,
    sessionId,
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[DevVoiceServer] Voice dev server listening on http://127.0.0.1:${port}`);
  console.log(`[DevVoiceServer] Voice WebSocket proxy target: ws://127.0.0.1:${port}/voice/ws/:sessionId`);
});
