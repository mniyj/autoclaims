import { AliyunNLSService, createNLSService } from "./services/AliyunNLS.js";
import { AliyunTTSService, createTTSService } from "./services/AliyunTTS.js";

interface PipelineConfig {
  geminiApiKey: string;
  useRealServices: boolean;
}

export interface VoiceServiceStatus {
  geminiConfigured: boolean;
  nlsMode: "aliyun" | "mock";
  ttsMode: "aliyun" | "mock";
}

/**
 * Thin holder for per-session Aliyun NLS + TTS service handles.
 *
 * Legacy note: prior versions of this class implemented the full NLS/TTS
 * lifecycle and LLM dispatch. All that moved to `turn/TurnCoordinator` +
 * `audio/NLSStreamManager` + `audio/TTSStreamController` in the phase 1-3
 * refactor. This class now only builds the service instances once and exposes
 * them as accessors. The name is kept for import stability.
 */
export class VoicePipeline {
  private config: PipelineConfig;
  private nlsService: AliyunNLSService | null = null;
  private ttsService: AliyunTTSService | null = null;

  constructor(config?: Partial<PipelineConfig>) {
    this.config = {
      geminiApiKey: config?.geminiApiKey || process.env.GEMINI_API_KEY || "",
      useRealServices: config?.useRealServices ?? true,
      ...config,
    };
    if (!this.config.geminiApiKey) {
      console.warn(
        "[VoicePipeline] GEMINI_API_KEY is not set, reply generation will fall back to a mock response",
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

  getNlsService(): AliyunNLSService | null {
    return this.nlsService;
  }

  getTtsService(): AliyunTTSService | null {
    return this.ttsService;
  }

  getServiceStatus(): VoiceServiceStatus {
    return {
      geminiConfigured: Boolean(this.config.geminiApiKey),
      nlsMode: this.nlsService ? "aliyun" : "mock",
      ttsMode: this.ttsService ? "aliyun" : "mock",
    };
  }
}
