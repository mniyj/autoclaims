import { GoogleGenAI } from '@google/genai';
import { AliyunNLSService, createNLSService } from './services/AliyunNLS.js';
import { AliyunTTSService, createTTSService } from './services/AliyunTTS.js';
import type { ToolResult } from './tools/index.js';

interface PipelineConfig {
  geminiApiKey: string;
  useRealServices: boolean;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class VoicePipeline {
  private genAI: GoogleGenAI;
  private config: PipelineConfig;
  private nlsService: AliyunNLSService | null = null;
  private ttsService: AliyunTTSService | null = null;
  private nlsStream: { sendAudio: (data: Buffer) => void; close: () => void } | null = null;

  constructor(config?: Partial<PipelineConfig>) {
    this.config = {
      geminiApiKey: config?.geminiApiKey || process.env.GEMINI_API_KEY || '',
      useRealServices: config?.useRealServices ?? true,
      ...config
    };
    
    this.genAI = new GoogleGenAI({ apiKey: this.config.geminiApiKey });
    
    if (this.config.useRealServices) {
      try {
        this.nlsService = createNLSService();
        this.ttsService = createTTSService();
      } catch (error) {
        console.warn('[VoicePipeline] Failed to initialize Aliyun services:', error);
      }
    }
  }

  async initializeNLSStream(
    onResult: (result: { text: string; isFinal: boolean }) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    if (!this.nlsService) {
      onError(new Error('NLS service not initialized'));
      return;
    }

    try {
      this.nlsStream = await this.nlsService.createTranscriptionStream(onResult, onError);
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Failed to initialize NLS stream'));
    }
  }

  async processAudioChunk(audioData: Buffer): Promise<void> {
    if (this.nlsStream) {
      this.nlsStream.sendAudio(audioData);
    }
  }

  closeNLSStream(): void {
    if (this.nlsStream) {
      this.nlsStream.close();
      this.nlsStream = null;
    }
  }

  // Process transcribed text
  async processTranscript(
    text: string, 
    conversationHistory: Message[]
  ): Promise<{ response: string; toolCall?: any }> {
    // Build messages for LLM
    const messages: Message[] = [
      {
        role: 'system',
        content: `你是智能理赔助手，帮助用户进行保险理赔相关操作。

你可以执行以下操作：
1. 查询保单信息
2. 提交理赔报案
3. 查询理赔进度

请用友好、专业的中文回答用户。如果需要调用工具，请明确说明。`
      },
      ...conversationHistory,
      { role: 'user', content: text }
    ];

    // Call Gemini
    try {
      const response = await this.callLLM(messages);
      
      // Check if response indicates a tool call
      const toolCall = this.parseToolCall(response);
      
      return { response, toolCall };
    } catch (error) {
      console.error('[VoicePipeline] LLM call failed:', error);
      return { 
        response: '抱歉，系统处理出错，请稍后再试。' 
      };
    }
  }

  private async callLLM(messages: Message[]): Promise<string> {
    const model = 'gemini-2.5-flash';
    
    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    
    const result = await this.genAI.models.generateContent({
      model,
      contents: prompt
    });

    return result.text || '抱歉，我没有理解您的意思。';
  }

  private parseToolCall(response: string): any | undefined {
    // Simple parsing for tool calls
    // Format: "[TOOL_CALL:toolName]{params}"
    const match = response.match(/\[TOOL_CALL:(\w+)\](.*)/);
    if (match) {
      try {
        return {
          name: match[1],
          arguments: JSON.parse(match[2] || '{}')
        };
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  // Execute tool and get result
  async executeTool(toolCall: any): Promise<ToolResult> {
    // Import tools dynamically to avoid circular dependency
    const { executeTool } = await import('./tools/index');
    return executeTool(toolCall.name, toolCall.arguments);
  }

  async synthesizeSpeech(
    text: string,
    onAudio?: (audioData: Buffer) => void
  ): Promise<Buffer | null> {
    if (!this.ttsService) {
      console.log(`[VoicePipeline] TTS (mock): ${text}`);
      return null;
    }

    try {
      if (onAudio) {
        await this.ttsService.synthesize(text, onAudio);
        return null;
      } else {
        return await this.ttsService.synthesizeOnce(text);
      }
    } catch (error) {
      console.error('[VoicePipeline] TTS error:', error);
      return null;
    }
  }
}
