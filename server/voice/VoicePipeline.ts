import { AliyunNLSService, createNLSService } from "./services/AliyunNLS.js";
import { AliyunTTSService, createTTSService } from "./services/AliyunTTS.js";
import type { ToolResult } from "./tools/index.js";
import { invokeAICapability } from "../services/aiRuntime.js";

interface PipelineConfig {
  geminiApiKey: string;
  useRealServices: boolean;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface TranscriptionStream {
  sendAudio: (data: Buffer) => void;
  close: () => void;
}

export interface VoiceServiceStatus {
  geminiConfigured: boolean;
  nlsMode: "aliyun" | "mock";
  ttsMode: "aliyun" | "mock";
}

export class VoicePipeline {
  private config: PipelineConfig;
  private nlsService: AliyunNLSService | null = null;
  private ttsService: AliyunTTSService | null = null;
  private nlsStream: TranscriptionStream | null = null;

  constructor(config?: Partial<PipelineConfig>) {
    this.config = {
      geminiApiKey: config?.geminiApiKey || process.env.GEMINI_API_KEY || "",
      useRealServices: config?.useRealServices ?? true,
      ...config,
    };
    if (!this.config.geminiApiKey) {
      console.warn(
        "[VoicePipeline] GEMINI_API_KEY is not set, falling back to a mock text response",
      );
    }

    if (this.config.useRealServices) {
      try {
        this.nlsService = createNLSService();
        this.ttsService = createTTSService();
      } catch (error) {
        console.warn(
          "[VoicePipeline] Failed to initialize Aliyun services:",
          error,
        );
      }
    }
  }

  async initializeNLSStream(
    onResult: (result: { text: string; isFinal: boolean }) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    if (!this.nlsService) {
      this.nlsStream = this.createMockTranscriptionStream(onResult);
      return;
    }

    try {
      this.nlsStream = await this.nlsService.createTranscriptionStream(
        onResult,
        onError,
      );
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new Error("Failed to initialize NLS stream");
      onError(err);
      throw err; // re-throw so VoiceSession knows initialization actually failed
    }
  }

  private createMockTranscriptionStream(
    onResult: (result: { text: string; isFinal: boolean }) => void,
  ): TranscriptionStream {
    let bufferedBytes = 0;
    let emittedIntermediate = false;

    return {
      sendAudio: (audioData: Buffer) => {
        bufferedBytes += audioData.length;

        if (!emittedIntermediate && bufferedBytes > 0) {
          emittedIntermediate = true;
          onResult({
            text: "开发环境未配置阿里云语音识别，当前使用模拟识别。",
            isFinal: false,
          });
        }
      },
      close: () => {
        if (bufferedBytes === 0) {
          return;
        }

        onResult({
          text: "开发环境未配置阿里云语音识别，无法将语音转成文本。请补充 ALIYUN_ACCESS_KEY_ID、ALIYUN_ACCESS_KEY_SECRET 和 ALIYUN_NLS_APP_KEY 后重试。",
          isFinal: true,
        });

        bufferedBytes = 0;
        emittedIntermediate = false;
      },
    };
  }

  async processAudioChunk(audioData: Buffer): Promise<void> {
    if (this.nlsStream) {
      console.log(
        `[VoicePipeline] Sending audio chunk to NLS: ${audioData.length} bytes`,
      );
      this.nlsStream.sendAudio(audioData);
    } else {
      console.warn(
        "[VoicePipeline] NLS stream not available, cannot send audio",
      );
    }
  }

  closeNLSStream(): void {
    if (this.nlsStream) {
      this.nlsStream.close();
      this.nlsStream = null;
    }
  }

  getServiceStatus(): VoiceServiceStatus {
    return {
      geminiConfigured: Boolean(this.config.geminiApiKey),
      nlsMode: this.nlsService ? "aliyun" : "mock",
      ttsMode: this.ttsService ? "aliyun" : "mock",
    };
  }

  // Process transcribed text
  async processTranscript(
    text: string,
    conversationHistory: Message[],
  ): Promise<{ response: string; toolCall?: any }> {
    // Build messages for LLM
    const messages: Message[] = [
      {
        role: "system",
        content: `你是智能理赔助手，帮助用户进行保险理赔相关操作。

你可以执行以下操作：
1. 查询保单信息
2. 提交理赔报案
3. 查询理赔进度

请用友好、专业的中文回答用户。如果需要调用工具，请明确说明。`,
      },
      ...conversationHistory,
      { role: "user", content: text },
    ];

    // Call Gemini
    try {
      const response = await this.callLLM(messages);

      // Check if response indicates a tool call
      const toolCall = this.parseToolCall(response);

      return { response, toolCall };
    } catch (error) {
      console.error("[VoicePipeline] LLM call failed:", error);
      return {
        response: "抱歉，系统处理出错，请稍后再试。",
      };
    }
  }

  private async callLLM(messages: Message[]): Promise<string> {
    const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

    const { response: result } = await invokeAICapability({
      capabilityId: "voice.chat",
      request: {
        contents: { parts: [{ text: prompt }] },
      },
      meta: {
        sourceApp: "voice",
        module: "VoicePipeline",
        operation: "call_llm",
        context: {
          messageCount: messages.length,
        },
      },
    });

    return result.text || "抱歉，我没有理解您的意思。";
  }

  private parseToolCall(response: string): any | undefined {
    // Simple parsing for tool calls
    // Format: "[TOOL_CALL:toolName]{params}"
    const match = response.match(/\[TOOL_CALL:(\w+)\](.*)/);
    if (match) {
      try {
        return {
          name: match[1],
          arguments: JSON.parse(match[2] || "{}"),
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
    const { executeTool } = await import("./tools/index");
    return executeTool(toolCall.name, toolCall.arguments);
  }

  async synthesizeSpeech(
    text: string,
    onAudio?: (audioData: Buffer) => void,
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
      console.error("[VoicePipeline] TTS error:", error);
      return null;
    }
  }
}
