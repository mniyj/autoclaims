import WebSocket from "ws";
import { VoicePipeline } from "./VoicePipeline.js";
import type { VoiceMessage } from "../../types/voice.js";
import { IntentRecognizer } from "./intents/IntentRecognizer.js";
import { IntentHandlerRegistry } from "./intents/IntentHandlerRegistry.js";
import { VoiceSessionContext } from "./state/VoiceSessionContext.js";
import { executeTool } from "./tools/index.js";
import { resolveClaimSelection } from "../../shared/claimRouting.js";
import {
  buildActionSummary,
  type ActionExecutionSummary,
  VoiceReplyBuilder,
} from "./responders/voiceReplyBuilder.js";

interface SessionConfig {
  sessionId: string;
  ws: WebSocket;
  pipeline: VoicePipeline;
  userId?: string;
  companyCode?: string;
}

export class VoiceSession {
  private sessionId: string;
  private ws: WebSocket;
  private pipeline: VoicePipeline;
  private context: VoiceSessionContext;
  private intentRecognizer: IntentRecognizer;
  private intentRegistry: IntentHandlerRegistry;
  private replyBuilder: VoiceReplyBuilder;
  private companyCode?: string;
  
  private isSpeaking = false;
  private currentResponseText = "";
  private isNLSStreamInitialized = false;
  private cancelled = false;
  private silenceTimer: NodeJS.Timeout | null = null;
  private lastAudioTime = 0;
  private SILENCE_THRESHOLD = 700;
  private audioBuffer: Buffer[] = [];
  
  // 操作取消控制器
  private ongoingOperation: AbortController | null = null;

  constructor(config: SessionConfig) {
    this.sessionId = config.sessionId;
    this.ws = config.ws;
    this.pipeline = config.pipeline;
    this.companyCode = config.companyCode;
    
    // 初始化意图驱动组件
    this.context = new VoiceSessionContext(config.userId || 'anonymous');
    this.intentRecognizer = new IntentRecognizer();
    this.intentRegistry = new IntentHandlerRegistry();
    this.intentRegistry.initializeHandlers();
    this.replyBuilder = new VoiceReplyBuilder();

    // 初始化 NLS 流 - 即使失败也不关闭连接，允许纯文本交互
    this.initializeNLSStream().catch((error) => {
      console.error("[VoiceSession] Failed to initialize NLS stream:", error);
      this.sendEvent("error", { message: "语音识别服务暂不可用，您可以通过文字输入与我对话" });
    });
    
    // 发送欢迎消息
    setTimeout(() => {
      this.sendResponse("您好！我是智能理赔助手。请说\"我要报案\"开始办理理赔，或者说\"查询进度\"了解案件状态。");
    }, 500);
  }

  private async initializeNLSStream(): Promise<void> {
    if (this.cancelled) return;

    try {
      console.log("[VoiceSession] Initializing NLS stream...");
      await this.pipeline.initializeNLSStream(
        (result) => this.handleRecognitionResult(result),
        (error) => this.handleRecognitionError(error),
      );

      if (this.cancelled) {
        console.log("[VoiceSession] Session cancelled during NLS init");
        this.pipeline.closeNLSStream();
        return;
      }

      this.isNLSStreamInitialized = true;
      console.log("[VoiceSession] NLS stream initialized");

      // 发送缓冲的音频数据
      if (this.audioBuffer.length > 0) {
        for (const audioData of this.audioBuffer) {
          if (this.cancelled) break;
          await this.pipeline.processAudioChunk(audioData);
        }
        this.audioBuffer = [];
      }
    } catch (error) {
      if (!this.cancelled) {
        console.error("[VoiceSession] NLS init error:", error);
      }
    }
  }

  async handleMessage(message: VoiceMessage): Promise<void> {
    switch (message.type) {
      case "audio":
        await this.handleAudioMessage(message.payload);
        break;
      case "text":
        await this.handleTextMessage(message.payload);
        break;
      case "control":
        await this.handleControlMessage(message.payload);
        break;
    }
  }

  private async handleAudioMessage(payload: any): Promise<void> {
    if (this.isSpeaking) return;

    if (payload.data) {
      const audioData = Buffer.from(payload.data, "base64");

      if (this.isNLSStreamInitialized) {
        await this.pipeline.processAudioChunk(audioData);
        this.lastAudioTime = Date.now();

        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        this.silenceTimer = setTimeout(() => {
          this.handleSilenceDetected();
        }, this.SILENCE_THRESHOLD);
      } else {
        this.audioBuffer.push(audioData);
      }
    }
  }

  private handleSilenceDetected(): void {
    this.pipeline.closeNLSStream();
    setTimeout(() => this.initializeNLSStream(), 100);
  }

  private handleRecognitionResult(result: { text: string; isFinal: boolean }): void {
    this.sendText("stt", result.text, result.isFinal);

    if (result.isFinal && result.text.trim()) {
      this.processUserInput(result.text);
    }
  }

  private handleRecognitionError(error: Error): void {
    console.error("[VoiceSession] Recognition error:", error);
    // 不关闭连接，只是通知用户
    this.sendEvent("error", { message: "语音识别暂不可用，请尝试文字输入" });
  }

  private async handleTextMessage(payload: any): Promise<void> {
    if (payload.source === "stt" && payload.isFinal) {
      await this.processUserInput(payload.content);
    }
  }

  private async handleControlMessage(payload: any): Promise<void> {
    if (payload.action === "barge_in") {
      await this.handleBargeIn();
    } else if (payload.action === "stop") {
      this.cleanup();
    }
  }

  private async handleBargeIn(): Promise<void> {
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.sendEvent("barge_in_acknowledged", {});
      this.sendText("llm", "好的，您请说。", true);
    }
  }

  /**
   * 核心：意图驱动的用户输入处理
   */
  private async processUserInput(text: string): Promise<void> {
    console.log(`[VoiceSession] Processing: "${text}"`);
    
    // 添加到历史
    this.context.addToHistory("user", text);

    try {
      // 1. 识别意图
      const intent = await this.intentRecognizer.recognize(text, this.context);
      console.log(`[VoiceSession] Intent: ${intent.type}, confidence: ${intent.confidence}`);
      this.context.setLastUserGoal(intent.conversationGoal || intent.type);

      // 2. 如果是取消意图，终止当前操作
      if (intent.type === 'cancel' && this.ongoingOperation) {
        this.ongoingOperation.abort();
        this.ongoingOperation = null;
      }

      // 3. 处理意图
      const result = await this.intentRegistry.handle(intent, this.context);

      // 4. 先更新状态，再执行后续动作
      if (result.newState) {
        this.context.setState(result.newState as any);
      }

      // 5. 执行动作
      const actionResults: ActionExecutionSummary[] = [];
      if (result.actions) {
        for (const action of result.actions) {
          const summaries = await this.executeAction(action);
          actionResults.push(...summaries);
        }
      }

      // 6. 统一生成更自然的语音回复
      const finalResponse = await this.replyBuilder.buildReply({
        intent,
        result,
        context: this.context,
        actionResults,
        userText: text,
      });
      this.context.setLastSummary(finalResponse);
      this.context.setLastAssistantQuestion(finalResponse.includes('？') ? finalResponse : null);
      this.context.addToHistory("assistant", finalResponse);
      await this.sendResponse(finalResponse);

      // 7. 检查是否终止
      if (result.shouldTerminate) {
        setTimeout(() => this.cleanup(), 500);
      }

    } catch (error) {
      console.error("[VoiceSession] Processing error:", error);
      await this.sendResponse("抱歉，处理出错了，请重试。");
    }
  }

  /**
   * 执行动作
   */
  private async executeAction(action: { type: string; payload: any }): Promise<ActionExecutionSummary[]> {
    this.ongoingOperation = new AbortController();
    const signal = this.ongoingOperation.signal;
    const summaries: ActionExecutionSummary[] = [];

    try {
      switch (action.type) {
        case 'LOAD_POLICIES':
          summaries.push(await this.loadPolicies(signal));
          break;

        case 'LOAD_CLAIMS':
          summaries.push(...await this.loadClaims(signal));
          break;

        case 'ANNOUNCE_CLAIM_PROGRESS':
          summaries.push(await this.announceClaimProgress(action.payload, signal));
          break;

        case 'LOAD_CLAIM_MATERIALS':
          summaries.push(await this.loadClaimMaterials(action.payload, signal));
          break;

        case 'LOAD_MISSING_CLAIM_MATERIALS':
          summaries.push(await this.loadMissingClaimMaterials(action.payload, signal));
          break;

        case 'LOAD_COVERAGE_INFO':
          summaries.push(await this.loadCoverageInfo(action.payload, signal));
          break;

        case 'LOAD_SETTLEMENT_ESTIMATE':
          summaries.push(await this.loadSettlementEstimate(action.payload, signal));
          break;

        case 'LOAD_INTAKE_CONFIG':
          summaries.push(await this.loadIntakeConfig(action.payload.productCode, signal));
          break;

        case 'SUBMIT_CLAIM':
          summaries.push(await this.submitClaim(action.payload, signal));
          break;

        case 'REFRESH_SUMMARY':
          // 摘要刷新，无需特殊处理
          break;
      }
      return summaries.filter((item) => Boolean(item));
    } finally {
      this.ongoingOperation = null;
    }
  }

  /**
   * 加载保单列表
   */
  private async loadPolicies(signal: AbortSignal): Promise<ActionExecutionSummary> {
    this.sendEvent("tool_call_start", { toolName: '查询保单' });

    try {
      const result = await executeTool('listUserPolicies', {}, {
        userId: this.context.getUserId(),
        companyCode: this.companyCode,
      });

      if (signal.aborted) {
        return {
          type: 'LOAD_POLICIES',
          success: false,
          error: '操作已取消',
        };
      }

      if (!result.success) {
        return {
          type: 'LOAD_POLICIES',
          success: false,
          error: result.error || '查询保单失败',
          summary: buildActionSummary('LOAD_POLICIES', undefined, result.error || '查询保单失败'),
        };
      }

      const policies = Array.isArray(result.data) ? result.data : [];
      this.context.setAvailablePolicies(policies);

      if (policies.length === 0) {
        this.context.setState('IDLE');
        return {
          type: 'LOAD_POLICIES',
          success: true,
          data: { mode: 'missing' },
          summary: buildActionSummary('LOAD_POLICIES', { mode: 'missing' }),
        };
      }

      if (policies.length === 1) {
        const selectedPolicy = policies[0];
        this.context.setSelectedPolicy(selectedPolicy);
        this.context.setState('COLLECTING_FIELDS');
        const intakeSummary = await this.loadIntakeConfig(selectedPolicy.productCode, signal);
        return {
          type: 'LOAD_POLICIES',
          success: true,
          data: { mode: 'auto_selected', selectedPolicy },
          summary: buildActionSummary('LOAD_POLICIES', { mode: 'auto_selected', selectedPolicy }) + (intakeSummary.summary || ''),
        };
      }

      this.context.setState('SELECTING_POLICY');
      return {
        type: 'LOAD_POLICIES',
        success: true,
        data: { mode: 'selection', policies },
        summary: buildActionSummary('LOAD_POLICIES', { mode: 'selection', policies }),
      };
    } finally {
      this.sendEvent("tool_call_end", { toolName: '查询保单' });
    }
  }

  private async loadClaims(signal: AbortSignal): Promise<ActionExecutionSummary[]> {
    this.sendEvent("tool_call_start", { toolName: '查询案件' });

    try {
      const result = await executeTool('查询理赔进度', {}, {
        userId: this.context.getUserId(),
        companyCode: this.companyCode,
      });

      if (signal.aborted) {
        return [{
          type: 'LOAD_CLAIMS',
          success: false,
          error: '操作已取消',
        }];
      }

      if (!result.success) {
        return [{
          type: 'LOAD_CLAIMS',
          success: false,
          error: result.error || '未查询到理赔案件',
          summary: result.error || '未查询到理赔案件',
        }];
      }

      const claims = Array.isArray(result.data) ? result.data : [];
      this.context.setAvailableClaims(claims);

      const resolution = resolveClaimSelection(
        claims.map((claim: any) => ({
          id: claim.claimId,
          reportNumber: claim.reportNumber,
          claimType: claim.claimType,
          productCode: claim.productCode,
        })),
      );
      const pendingClaimQuery = this.context.getPendingClaimQuery();

      if (resolution.kind === 'missing') {
        this.context.setState('IDLE');
        return [{
          type: 'LOAD_CLAIMS',
          success: true,
          data: { mode: 'missing' },
          summary: buildActionSummary('LOAD_CLAIMS', { mode: 'missing' }),
        }];
      }

      if (resolution.kind === 'resolved') {
        const selectedClaim = claims.find((claim: any) => claim.claimId === resolution.claim.id) || claims[0];
        this.context.setSelectedClaim(selectedClaim);
        if (pendingClaimQuery) {
          this.context.setPendingClaimQuery(null);
          const followUp = await this.executeAction({
            type: pendingClaimQuery.actionType,
            payload: {
              ...(pendingClaimQuery.payload || {}),
              claimId: selectedClaim.claimId,
              claimType: selectedClaim.claimType,
              productCode: selectedClaim.productCode,
            },
          });
          this.context.setState('IDLE');
          return [{
            type: 'LOAD_CLAIMS',
            success: true,
            data: { mode: 'resolved', selectedClaim },
            summary: '',
          }, ...followUp];
        }
        this.context.setState('IDLE');
        return [{
          type: 'LOAD_CLAIMS',
          success: true,
          data: { mode: 'resolved', selectedClaim },
          summary: buildActionSummary('ANNOUNCE_CLAIM_PROGRESS', selectedClaim),
        }];
      }

      const claimList = resolution.claims
        .map((claimMeta, index) => {
          const claim = claims.find((item: any) => item.claimId === claimMeta.id) || claims[index];
          return `第${claim.index}个，案件${claim.claimId}，${claim.statusLabel}`;
        })
        .join('；');
      this.context.setState('SELECTING_CLAIM');
      return [{
        type: 'LOAD_CLAIMS',
        success: true,
        data: { mode: 'selection', claims: resolution.claims },
        summary: `我查到${resolution.claims.length}个案件。${claimList}。您说第几个就行。`,
      }];
    } finally {
      this.sendEvent("tool_call_end", { toolName: '查询案件' });
    }
  }

  private async loadClaimMaterials(payload: { productCode?: string; claimType?: string }, signal: AbortSignal): Promise<ActionExecutionSummary> {
    this.sendEvent("tool_call_start", { toolName: '查询材料清单' });

    try {
      const result = await executeTool('查询材料清单', payload);
      if (signal.aborted) {
        return {
          type: 'LOAD_CLAIM_MATERIALS',
          success: false,
          error: '操作已取消',
        };
      }

      if (!result.success) {
        return {
          type: 'LOAD_CLAIM_MATERIALS',
          success: false,
          error: result.error || '查询材料清单失败',
          summary: result.error || '查询材料清单失败',
        };
      }
        return {
          type: 'LOAD_CLAIM_MATERIALS',
          success: true,
          data: result.data,
          summary: buildActionSummary('LOAD_CLAIM_MATERIALS', result.data),
        };
    } finally {
      this.sendEvent("tool_call_end", { toolName: '查询材料清单' });
    }
  }

  private async announceClaimProgress(
    payload: { claimId: string; claimType?: string; productCode?: string },
    signal: AbortSignal,
  ): Promise<ActionExecutionSummary> {
    this.sendEvent("tool_call_start", { toolName: '播报案件进度' });

    try {
      if (signal.aborted) return { type: 'ANNOUNCE_CLAIM_PROGRESS', success: false };
      const selectedClaim = this.context.getSelectedClaim();
      if (!selectedClaim || selectedClaim.claimId !== payload.claimId) {
        return {
          type: 'ANNOUNCE_CLAIM_PROGRESS',
          success: false,
          error: '暂时无法定位到该案件进度，请稍后重试。',
          summary: '暂时无法定位到该案件进度，请稍后重试。',
        };
      }
      return {
        type: 'ANNOUNCE_CLAIM_PROGRESS',
        success: true,
        data: selectedClaim,
        summary: buildActionSummary('ANNOUNCE_CLAIM_PROGRESS', selectedClaim),
      };
    } finally {
      this.sendEvent("tool_call_end", { toolName: '播报案件进度' });
    }
  }

  private async loadMissingClaimMaterials(
    payload: { claimId: string; productCode?: string; claimType?: string },
    signal: AbortSignal,
  ): Promise<ActionExecutionSummary> {
    this.sendEvent("tool_call_start", { toolName: '查询缺失材料' });

    try {
      const result = await executeTool('查询缺失材料', payload);
      if (signal.aborted) {
        return {
          type: 'LOAD_MISSING_CLAIM_MATERIALS',
          success: false,
          error: '操作已取消',
        };
      }

      if (!result.success) {
        return {
          type: 'LOAD_MISSING_CLAIM_MATERIALS',
          success: false,
          error: result.error || '查询缺失材料失败',
          summary: result.error || '查询缺失材料失败',
        };
      }
      return {
        type: 'LOAD_MISSING_CLAIM_MATERIALS',
        success: true,
        data: result.data,
        summary: buildActionSummary('LOAD_MISSING_CLAIM_MATERIALS', result.data),
      };
    } finally {
      this.sendEvent("tool_call_end", { toolName: '查询缺失材料' });
    }
  }

  private async loadCoverageInfo(payload: { productCode?: string; claimType?: string }, signal: AbortSignal): Promise<ActionExecutionSummary> {
    this.sendEvent("tool_call_start", { toolName: '查询保障范围' });

    try {
      const result = await executeTool('查询保障范围', payload);
      if (signal.aborted) return { type: 'LOAD_COVERAGE_INFO', success: false };

      if (!result.success) {
        return {
          type: 'LOAD_COVERAGE_INFO',
          success: false,
          error: result.error || '查询保障范围失败',
          summary: result.error || '查询保障范围失败',
        };
      }
      return {
        type: 'LOAD_COVERAGE_INFO',
        success: true,
        data: result.data,
        summary: buildActionSummary('LOAD_COVERAGE_INFO', result.data),
      };
    } finally {
      this.sendEvent("tool_call_end", { toolName: '查询保障范围' });
    }
  }

  private async loadSettlementEstimate(
    payload: { claimId?: string; productCode?: string; claimType?: string },
    signal: AbortSignal,
  ): Promise<ActionExecutionSummary> {
    this.sendEvent("tool_call_start", { toolName: '查询赔付预估' });

    try {
      const result = await executeTool('查询赔付预估', payload);
      if (signal.aborted) return { type: 'LOAD_SETTLEMENT_ESTIMATE', success: false };

      if (!result.success) {
        return {
          type: 'LOAD_SETTLEMENT_ESTIMATE',
          success: false,
          error: result.error || '查询赔付预估失败',
          summary: result.error || '查询赔付预估失败',
        };
      }
      return {
        type: 'LOAD_SETTLEMENT_ESTIMATE',
        success: true,
        data: result.data,
        summary: buildActionSummary('LOAD_SETTLEMENT_ESTIMATE', result.data),
      };
    } finally {
      this.sendEvent("tool_call_end", { toolName: '查询赔付预估' });
    }
  }

  /**
   * 加载报案配置
   */
  private async loadIntakeConfig(productCode: string, signal: AbortSignal): Promise<ActionExecutionSummary> {
    this.sendEvent("tool_call_start", { toolName: '加载配置' });

    try {
      const result = await executeTool('getProductIntakeConfig', { productCode });

      if (signal.aborted) return { type: 'LOAD_INTAKE_CONFIG', success: false };

      if (result.success) {
        this.context.setIntakeConfig(result.data);
        return {
          type: 'LOAD_INTAKE_CONFIG',
          success: true,
          data: { mode: 'loaded', fields: result.data?.fields || [] },
          summary: '',
        };
      }
      this.context.setState('IDLE');
      return {
        type: 'LOAD_INTAKE_CONFIG',
        success: false,
        error: result.error || '未加载到报案配置',
        data: { mode: 'missing_config' },
        summary: buildActionSummary('LOAD_INTAKE_CONFIG', { mode: 'missing_config' }),
      };
    } finally {
      this.sendEvent("tool_call_end", { toolName: '加载配置' });
    }
  }

  /**
   * 提交报案
   */
  private async submitClaim(data: any, signal: AbortSignal): Promise<ActionExecutionSummary> {
    this.sendEvent("tool_call_start", { toolName: '提交报案' });

    try {
      const result = await executeTool('submitClaim', data);

      if (signal.aborted) return { type: 'SUBMIT_CLAIM', success: false };

      if (result.success) {
        // 发送结束事件
        this.sendEvent("session_ended", {
          claimId: result.data.claimId,
          reportNumber: result.data.reportNumber
        });
        return {
          type: 'SUBMIT_CLAIM',
          success: true,
          data: result.data,
          summary: buildActionSummary('SUBMIT_CLAIM', result.data),
        };
      } else {
        return {
          type: 'SUBMIT_CLAIM',
          success: false,
          error: result.error || '提交失败',
          summary: `提交失败：${result.error || '请稍后重试'}`,
        };
      }
    } finally {
      this.sendEvent("tool_call_end", { toolName: '提交报案' });
    }
  }

  /**
   * 发送响应（含TTS）
   */
  private buildSpokenResponse(text: string): string {
    const plainText = text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();

    if (!plainText) {
      return text;
    }

    const segments = plainText
      .split(/(?<=[。！？!?；;])/u)
      .map((segment) => segment.trim())
      .filter(Boolean);

    const spokenSegments: string[] = [];
    let totalLength = 0;

    for (const segment of segments) {
      const normalized = segment.replace(/[：:]\s*/g, "，");
      if (spokenSegments.length >= 2) {
        break;
      }
      if (totalLength >= 36) {
        break;
      }

      spokenSegments.push(normalized);
      totalLength += normalized.length;
    }

    const spokenText = spokenSegments.join("");
    return spokenText || plainText.slice(0, 36);
  }

  private async sendResponse(text: string): Promise<void> {
    if (!text) return;
    
    this.isSpeaking = true;
    this.currentResponseText = text;
    const spokenText = this.buildSpokenResponse(text);
    let ttsChunkCount = 0;
    let ttsTotalBytes = 0;

    console.log(
      `[VoiceSession] Sending response, textLength=${text.length}, spokenLength=${spokenText.length}, preview="${text.slice(0, 60)}"`,
    );

    this.sendText("llm", text, true);

    try {
      await this.pipeline.synthesizeSpeech(spokenText, (audioChunk) => {
        if (this.isSpeaking) {
          ttsChunkCount += 1;
          ttsTotalBytes += audioChunk.length;
          if (ttsChunkCount <= 3 || ttsChunkCount % 10 === 0) {
            console.log(
              `[VoiceSession] Forwarding TTS chunk ${ttsChunkCount}, bytes=${audioChunk.length}, totalBytes=${ttsTotalBytes}`,
            );
          }
          this.sendAudio(audioChunk);
        }
      });
      console.log(
        `[VoiceSession] TTS forwarding completed, chunks=${ttsChunkCount}, totalBytes=${ttsTotalBytes}`,
      );
    } catch (error) {
      console.error("[VoiceSession] TTS error:", error);
    }

    this.isSpeaking = false;
  }

  sendText(source: "stt" | "llm" | "system", content: string, isFinal = true): void {
    this.send({
      type: "text",
      payload: { source, content, isFinal },
    });
  }

  sendAudio(data: Buffer): void {
    console.log(`[VoiceSession] Sending audio payload to client, bytes=${data.length}`);
    this.send({
      type: "audio",
      payload: {
        data: data.toString("base64"),
        format: "pcm",
        seq: Date.now(),
        isFinal: true,
      },
    });
  }

  sendEvent(
    event: "session_started" | "session_ended" | "error" | "tool_call_start" | "tool_call_end" | "thinking" | "barge_in_acknowledged",
    data: any,
  ): void {
    this.send({
      type: "event",
      payload: { event, data },
    });
  }

  private send(message: VoiceMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  getServiceStatus() {
    return this.pipeline.getServiceStatus();
  }

  cleanup(): void {
    this.cancelled = true;
    this.isSpeaking = false;
    
    if (this.ongoingOperation) {
      this.ongoingOperation.abort();
    }
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    
    this.pipeline.closeNLSStream();
    this.ws.close();
    
    console.log(`[VoiceSession] Session ${this.sessionId} cleaned up`);
  }
}
