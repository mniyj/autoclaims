import WebSocket from "ws";
import { getTokenManager } from "./AliyunTokenManager.js";

interface NLSServiceConfig {
  accessKeyId: string;
  accessKeySecret: string;
  appKey: string;
}

interface NLSRequest {
  header: {
    message_id: string;
    task_id: string;
    namespace: string;
    name: string;
    appkey: string;
  };
  payload: {
    format?: string;
    sample_rate?: number;
    enable_intermediate_result?: boolean;
    enable_punctuation_prediction?: boolean;
    enable_inverse_text_normalization?: boolean;
  };
  context?: {
    sdk?: {
      name: string;
      version: string;
      language: string;
    };
  };
}

function generateUUID(): string {
  return "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

export class AliyunNLSService {
  private config: NLSServiceConfig;

  constructor(config: NLSServiceConfig) {
    this.config = config;
  }

  async createTranscriptionStream(
    onResult: (result: { text: string; isFinal: boolean }) => void,
    onError: (error: Error) => void,
  ): Promise<{
    sendAudio: (audioData: Buffer) => void;
    close: () => void;
  }> {
    try {
      console.log("[AliyunNLS] Getting token...");
      const token = await getTokenManager().getToken();
      const wsUrl = `wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1?token=${token}`;

      console.log("[AliyunNLS] Connecting to NLS gateway...");
      const ws = new WebSocket(wsUrl);
      const taskId = generateUUID();
      let transcriptionStarted = false;
      const pendingAudioChunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        let settled = false;
        let transcriptionStartedTimeout: NodeJS.Timeout | null = null;

        const settle = (fn: () => void) => {
          if (!settled) {
            settled = true;
            if (transcriptionStartedTimeout) clearTimeout(transcriptionStartedTimeout);
            fn();
          }
        };

        // Timeout waiting for WebSocket to open
        const connectTimeout = setTimeout(() => {
          console.error("[AliyunNLS] Connection timeout");
          ws.close();
          settle(() => reject(new Error("NLS WebSocket connection timeout")));
        }, 10000);

        const streamInterface = {
          sendAudio: (audioData: Buffer) => {
            if (!transcriptionStarted) {
              pendingAudioChunks.push(audioData);
              return;
            }

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(audioData);
            }
          },
          close: () => {
            const stopReq = {
              header: {
                message_id: generateUUID(),
                task_id: taskId,
                namespace: "SpeechTranscriber",
                name: "StopTranscription",
                appkey: this.config.appKey,
              },
            };
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(stopReq));
            }
            setTimeout(() => ws.close(), 1000);
          },
        };

        ws.on("open", () => {
          clearTimeout(connectTimeout);
          console.log("[AliyunNLS] WebSocket connected");

          // Start a separate timeout waiting for TranscriptionStarted
          transcriptionStartedTimeout = setTimeout(() => {
            console.error("[AliyunNLS] TranscriptionStarted timeout");
            ws.close();
            settle(() => reject(new Error("NLS TranscriptionStarted timeout")));
          }, 15000);

          const startReq: NLSRequest = {
            header: {
              message_id: generateUUID(),
              task_id: taskId,
              namespace: "SpeechTranscriber",
              name: "StartTranscription",
              appkey: this.config.appKey,
            },
            payload: {
              format: "pcm",
              sample_rate: 16000,
              enable_intermediate_result: true,
              enable_punctuation_prediction: true,
              enable_inverse_text_normalization: true,
            },
            context: {
              sdk: {
                name: "nls-sdk-nodejs",
                version: "1.0.0",
                language: "nodejs",
              },
            },
          };

          ws.send(JSON.stringify(startReq));
        });

        ws.on("message", (data: WebSocket.Data) => {
          try {
            const response = JSON.parse(data.toString());
            const name = response.header?.name;

            if (name === "TaskFailed") {
              console.error(
                `[AliyunNLS] Task failed:`,
                JSON.stringify(response, null, 2),
              );
              const err = new Error(
                `NLS task failed: ${response.header?.status_text || "Unknown error"}`,
              );
              onError(err);
              ws.close();
              settle(() => reject(err));
              return;
            }

            if (name === "TranscriptionStarted") {
              console.log(`[AliyunNLS] TranscriptionStarted task=${taskId}`);
              transcriptionStarted = true;
              for (const chunk of pendingAudioChunks.splice(0)) {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(chunk);
                }
              }
              settle(() => resolve(streamInterface));
              return;
            }

            if (name === "SentenceEnd") {
              console.log(
                `[AliyunNLS] SentenceEnd task=${taskId} text=${JSON.stringify(response.payload?.result || "")}`,
              );
              onResult({
                text: response.payload?.result || "",
                isFinal: true,
              });
              return;
            }

            if (name === "TranscriptionResultChanged") {
              // Interim result — no log (fires every ~200ms, very spammy).
              onResult({
                text: response.payload?.result || "",
                isFinal: false,
              });
            }
          } catch (error) {
            console.error("[AliyunNLS] Failed to parse message:", error);
          }
        });

        ws.on("error", (error) => {
          console.error("[AliyunNLS] WebSocket error:", error);
          clearTimeout(connectTimeout);
          settle(() => reject(error));
        });

        ws.on("close", () => {
          settle(() => reject(new Error("NLS WebSocket closed before TranscriptionStarted")));
        });
      });
    } catch (error) {
      console.error("[AliyunNLS] Failed to create stream:", error);
      throw error;
    }
  }
}

export function createNLSService(): AliyunNLSService {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const appKey = process.env.ALIYUN_NLS_APP_KEY;

  if (!accessKeyId || !accessKeySecret || !appKey) {
    throw new Error("阿里云 NLS 配置不完整");
  }

  return new AliyunNLSService({
    accessKeyId,
    accessKeySecret,
    appKey,
  });
}
