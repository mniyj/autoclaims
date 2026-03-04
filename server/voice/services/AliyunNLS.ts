import WebSocket from 'ws';
import { getTokenManager } from './AliyunTokenManager.js';

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

export class AliyunNLSService {
  private config: NLSServiceConfig;

  constructor(config: NLSServiceConfig) {
    this.config = config;
  }

  async createTranscriptionStream(
    onResult: (result: { text: string; isFinal: boolean }) => void,
    onError: (error: Error) => void
  ): Promise<{
    sendAudio: (audioData: Buffer) => void;
    close: () => void;
  }> {
    try {
      const token = await getTokenManager().getToken();
      const wsUrl = `wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1?token=${token}`;
      
      const ws = new WebSocket(wsUrl);
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return new Promise((resolve, reject) => {
        ws.on('open', () => {
          const startReq: NLSRequest = {
            header: {
              message_id: `msg_${Date.now()}`,
              task_id: taskId,
              namespace: 'SpeechTranscriber',
              name: 'StartTranscription',
              appkey: this.config.appKey
            },
            payload: {
              format: 'pcm',
              sample_rate: 16000,
              enable_intermediate_result: true,
              enable_punctuation_prediction: true,
              enable_inverse_text_normalization: true
            },
            context: {
              sdk: {
                name: 'nls-sdk-nodejs',
                version: '1.0.0',
                language: 'nodejs'
              }
            }
          };

          ws.send(JSON.stringify(startReq));
        });

        ws.on('message', (data: WebSocket.Data) => {
          try {
            const response = JSON.parse(data.toString());
            
            if (response.header.name === 'TranscriptionResultChanged' || 
                response.header.name === 'SentenceEnd') {
              onResult({
                text: response.payload?.result || '',
                isFinal: response.header.name === 'SentenceEnd'
              });
            }
          } catch (error) {
            console.error('[AliyunNLS] Failed to parse message:', error);
          }
        });

        ws.on('error', (error) => {
          console.error('[AliyunNLS] WebSocket error:', error);
          onError(error);
        });

        resolve({
          sendAudio: (audioData: Buffer) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(audioData);
            }
          },
          close: () => {
            const stopReq = {
              header: {
                message_id: `msg_${Date.now()}`,
                task_id: taskId,
                namespace: 'SpeechTranscriber',
                name: 'StopTranscription',
                appkey: this.config.appKey
              }
            };
            ws.send(JSON.stringify(stopReq));
            setTimeout(() => ws.close(), 1000);
          }
        });
      });
    } catch (error) {
      console.error('[AliyunNLS] Failed to create stream:', error);
      throw error;
    }
  }
}

export function createNLSService(): AliyunNLSService {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const appKey = process.env.ALIYUN_NLS_APP_KEY;

  if (!accessKeyId || !accessKeySecret || !appKey) {
    throw new Error('阿里云 NLS 配置不完整');
  }

  return new AliyunNLSService({
    accessKeyId,
    accessKeySecret,
    appKey
  });
}
