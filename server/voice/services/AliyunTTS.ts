import WebSocket from 'ws';
import { getTokenManager } from './AliyunTokenManager.js';

interface TTSServiceConfig {
  accessKeyId: string;
  accessKeySecret: string;
  appKey: string;
  defaultVoice: string;
}

function generateUUID(): string {
  return "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

export class AliyunTTSService {
  private config: TTSServiceConfig;

  constructor(config: TTSServiceConfig) {
    this.config = config;
  }

  async synthesize(
    text: string,
    onAudio: (audioData: Buffer) => void,
    options?: {
      voice?: string;
      format?: string;
      sampleRate?: number;
      speechRate?: number;
      pitchRate?: number;
      volume?: number;
    }
  ): Promise<void> {
    try {
      console.log(
        `[AliyunTTS] Starting synthesis, textLength=${text.length}, voice=${options?.voice || this.config.defaultVoice}`,
      );
      const token = await getTokenManager().getToken();
      const wsUrl = `wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1?token=${token}`;
      
      const ws = new WebSocket(wsUrl);
      const taskId = generateUUID();
      let chunkCount = 0;
      let totalBytes = 0;

      return new Promise((resolve, reject) => {
        ws.on('open', () => {
          console.log(`[AliyunTTS] WebSocket connected for task ${taskId}`);
          const request = {
            header: {
              message_id: generateUUID(),
              task_id: taskId,
              namespace: 'SpeechSynthesizer',
              name: 'StartSynthesis',
              appkey: this.config.appKey
            },
            payload: {
              text,
              voice: options?.voice || this.config.defaultVoice,
              format: options?.format || 'pcm',
              sample_rate: options?.sampleRate || 16000,
              speech_rate: options?.speechRate || 0,
              pitch_rate: options?.pitchRate || 0,
              volume: options?.volume || 50
            },
            context: {
              sdk: {
                name: 'nls-sdk-nodejs',
                version: '1.0.0',
                language: 'nodejs'
              }
            }
          };

          ws.send(JSON.stringify(request));
          console.log(`[AliyunTTS] StartSynthesis sent for task ${taskId}`);
        });

        ws.on('message', (data: WebSocket.Data, isBinary: boolean) => {
          if (isBinary) {
            const audioData = Buffer.isBuffer(data)
              ? data
              : Buffer.from(data as ArrayBuffer);
            chunkCount += 1;
            totalBytes += audioData.length;
            if (chunkCount <= 3 || chunkCount % 10 === 0) {
              console.log(
                `[AliyunTTS] Binary audio chunk ${chunkCount} received, bytes=${audioData.length}, totalBytes=${totalBytes}`,
              );
            }
            onAudio(audioData);
            return;
          }

          try {
            const response = JSON.parse(data.toString());
            const messageName = response.header?.name;
            if (messageName) {
              console.log(`[AliyunTTS] Received message: ${messageName}`);
            }

            if (response.header?.name === 'TaskFailed') {
              console.error(
                '[AliyunTTS] Task failed:',
                JSON.stringify(response, null, 2),
              );
              reject(
                new Error(
                  response.header?.status_text ||
                    response.payload?.message ||
                    'TTS task failed',
                ),
              );
              ws.close();
              return;
            }
            
            if (response.header.name === 'SynthesisCompleted') {
              console.log(
                `[AliyunTTS] Synthesis completed for task ${taskId}, chunks=${chunkCount}, totalBytes=${totalBytes}`,
              );
              resolve();
              ws.close();
            } else if (response.payload?.audio) {
              const audioData = Buffer.from(response.payload.audio, 'base64');
              chunkCount += 1;
              totalBytes += audioData.length;
              if (chunkCount <= 3 || chunkCount % 10 === 0) {
                console.log(
                  `[AliyunTTS] Audio chunk ${chunkCount} received, bytes=${audioData.length}, totalBytes=${totalBytes}`,
                );
              }
              onAudio(audioData);
            }
          } catch (error) {
            console.error('[AliyunTTS] Failed to parse message:', error);
          }
        });

        ws.on('error', (error) => {
          console.error('[AliyunTTS] WebSocket error:', error);
          reject(error);
        });

        ws.on('close', () => {
          console.log(
            `[AliyunTTS] WebSocket closed for task ${taskId}, chunks=${chunkCount}, totalBytes=${totalBytes}`,
          );
          if (chunkCount > 0) {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('[AliyunTTS] Failed to synthesize:', error);
      throw error;
    }
  }

  async synthesizeOnce(
    text: string,
    options?: {
      voice?: string;
      format?: string;
      sampleRate?: number;
    }
  ): Promise<Buffer> {
    const audioChunks: Buffer[] = [];

    await this.synthesize(text, (chunk) => {
      audioChunks.push(chunk);
    }, options);

    return Buffer.concat(audioChunks);
  }

  getAvailableVoices(): Array<{ name: string; description: string; gender: string }> {
    return [
      { name: 'xiaoyun', description: '小云', gender: 'female' },
      { name: 'xiaogang', description: '小刚', gender: 'male' },
      { name: 'ruoxi', description: '若兮', gender: 'female' },
      { name: 'sicheng', description: '思诚', gender: 'male' },
      { name: 'aiqi', description: '艾琪', gender: 'female' },
      { name: 'aishuo', description: '艾硕', gender: 'male' },
      { name: 'ailing', description: '艾灵', gender: 'female' },
      { name: 'aimo', description: '艾默', gender: 'male' },
      { name: 'aiya', description: '艾雅', gender: 'female' },
      { name: 'aiying', description: '艾颖', gender: 'female' },
      { name: 'aimei', description: '艾美', gender: 'female' },
      { name: 'aiyu', description: '艾雨', gender: 'male' },
      { name: 'aixia', description: '艾夏', gender: 'male' }
    ];
  }
}

export function createTTSService(): AliyunTTSService {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const appKey = process.env.ALIYUN_TTS_APP_KEY;
  const defaultVoice = process.env.ALIYUN_TTS_VOICE || 'xiaoyun';

  if (!accessKeyId || !accessKeySecret || !appKey) {
    throw new Error('阿里云 TTS 配置不完整');
  }

  return new AliyunTTSService({
    accessKeyId,
    accessKeySecret,
    appKey,
    defaultVoice,
  });
}
