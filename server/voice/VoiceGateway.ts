import { WebSocketServer, WebSocket, type RawData } from "ws";
import { Server } from "http";
import { VoiceSession } from "./VoiceSession.js";
import { VoicePipeline } from "./VoicePipeline.js";

interface SessionData {
  session: VoiceSession;
  userId: string;
  createdAt: Date;
  lastActivity: Date;
}

export class VoiceGateway {
  private wss: WebSocketServer;
  private sessions: Map<string, SessionData> = new Map();
  private pipeline: VoicePipeline;

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      noServer: true,
    });

    console.log(
      "[VoiceGateway] WebSocket server initialized on path: /voice/ws",
    );

    this.pipeline = new VoicePipeline();

    // 手动处理 upgrade 事件
    server.on("upgrade", (request, socket, head) => {
      console.log(`[VoiceGateway] Upgrade request: ${request.url}`);
      if (request.url?.startsWith("/voice/ws")) {
        console.log(`[VoiceGateway] Accepting WebSocket connection`);
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit("connection", ws, request);
        });
      } else {
        console.log(
          `[VoiceGateway] Rejecting non-voice WebSocket: ${request.url}`,
        );
        socket.destroy();
      }
    });

    this.wss.on("connection", this.handleConnection.bind(this));

    // Cleanup inactive sessions every 5 minutes
    setInterval(() => this.cleanupInactiveSessions(), 5 * 60 * 1000);
  }

  private handleConnection(ws: WebSocket, req: any) {
    const sessionId = this.extractSessionId(req);
    const { userId, companyCode } = this.extractConnectionContext(req);

    console.log(
      `[VoiceGateway] New connection: ${sessionId}, userId=${userId || "anonymous"}, companyCode=${companyCode || "-"}`,
    );

    // Clean up any existing session with the same ID before creating new one
    // This prevents orphaned async operations from interfering with the new session
    if (this.sessions.has(sessionId)) {
      console.log(
        `[VoiceGateway] Cleaning up existing session before reconnect: ${sessionId}`,
      );
      this.cleanupSession(sessionId);
    }

    // Create a new pipeline per session to isolate NLS stream state
    const sessionPipeline = new VoicePipeline();

    // Create new session
    const session = new VoiceSession({
      sessionId,
      ws,
      pipeline: sessionPipeline,
      userId,
      companyCode,
    });

    this.sessions.set(sessionId, {
      session,
      userId: userId || "anonymous",
      createdAt: new Date(),
      lastActivity: new Date(),
    });

    // Handle messages
    ws.on("message", (data: RawData) => {
      this.handleMessage(sessionId, data);
    });

    // Handle close
    ws.on("close", () => {
      console.log(`[VoiceGateway] Connection closed: ${sessionId}`);
      this.cleanupSession(sessionId);
    });

    // Handle errors
    ws.on("error", (error) => {
      console.error(`[VoiceGateway] WebSocket error for ${sessionId}:`, error);
    });

    // Send welcome message
    session.sendEvent("session_started", {
      sessionId,
      message: "语音会话已启动",
      services: session.getServiceStatus(),
    });
  }

  private handleMessage(sessionId: string, data: RawData) {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) return;

    sessionData.lastActivity = new Date();

    try {
      const message = JSON.parse(data.toString());
      sessionData.session.handleMessage(message);
    } catch (error) {
      console.error(
        `[VoiceGateway] Failed to parse message from ${sessionId}:`,
        error,
      );
    }
  }

  private extractSessionId(req: any): string {
    const url = req.url || "";
    const match = url.match(/\/voice\/ws\/([^?]+)/);
    return match ? match[1] : `session_${Date.now()}`;
  }

  private extractConnectionContext(req: any): {
    userId?: string;
    companyCode?: string;
  } {
    try {
      const requestUrl = new URL(req.url || "", "http://localhost");
      return {
        userId: requestUrl.searchParams.get("userId") || undefined,
        companyCode: requestUrl.searchParams.get("companyCode") || undefined,
      };
    } catch {
      return {};
    }
  }

  private cleanupSession(sessionId: string) {
    const sessionData = this.sessions.get(sessionId);
    if (sessionData) {
      sessionData.session.cleanup();
      this.sessions.delete(sessionId);
    }
  }

  private cleanupInactiveSessions() {
    const now = new Date();
    const timeout = 10 * 60 * 1000; // 10 minutes

    for (const [sessionId, data] of this.sessions.entries()) {
      if (now.getTime() - data.lastActivity.getTime() > timeout) {
        console.log(
          `[VoiceGateway] Cleaning up inactive session: ${sessionId}`,
        );
        this.cleanupSession(sessionId);
      }
    }
  }

  // Public API for managing sessions
  createSession(userId: string): string {
    const sessionId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return sessionId;
  }

  getSession(sessionId: string): VoiceSession | undefined {
    return this.sessions.get(sessionId)?.session;
  }

  endSession(sessionId: string): void {
    this.cleanupSession(sessionId);
  }

  getServiceStatus() {
    return this.pipeline.getServiceStatus();
  }
}
