import WebSocket from 'ws';
import { getTokenManager } from './AliyunTokenManager.js';

interface TTSServiceConfig {
  accessKeyId: string;
  accessKeySecret: string;
  appKey: string;
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
      const token = await getTokenManager().getToken();
      const wsUrl = `wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1?token=${token}`;
      
      const ws = new WebSocket(wsUrl);
      const taskId = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return new Promise((resolve, reject) => {
        ws.on('open', () => {
          const request = {
            header: {
              message_id: `msg_${Date.now()}`,
              task_id: taskId,
              namespace: 'SpeechSynthesizer',
              name: 'StartSynthesis',
              appkey: this.config.appKey
            },
            payload: {
              text,
              voice: options?.voice || 'xiaoyun',
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
        });

        ws.on('message', (data: WebSocket.Data) => {
          try {
            const response = JSON.parse(data.toString());
            
            if (response.header.name === 'SynthesisCompleted') {
              resolve();
              ws.close();
            } else if (response.payload?.audio) {
              const audioData = Buffer.from(response.payload.audio, 'base64');
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
          resolve();
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

  if (!accessKeyId || !accessKeySecret || !appKey) {
    throw new Error('阿里云 TTS 配置不完整');
  }

  return new AliyunTTSService({
    accessKeyId,
    accessKeySecret,
    appKey
  });
}
