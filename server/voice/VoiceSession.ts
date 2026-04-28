import WebSocket from "ws";
import { VoicePipeline } from "./VoicePipeline.js";
import type { VoiceMessage } from "../../types/voice.js";
import { IntentRecognizer } from "./intents/IntentRecognizer.js";
import { IntentHandlerRegistry } from "./intents/IntentHandlerRegistry.js";
import { normalizeQueryIntent } from "./intents/QueryNormalizer.js";
import { VoiceSessionContext } from "./state/VoiceSessionContext.js";
import { executeTool } from "./tools/index.js";
import { resolveClaimSelection } from "../../shared/claimRouting.js";
import {
  buildActionSummary,
  type ActionExecutionSummary,
  VoiceReplyBuilder,
} from "./responders/voiceReplyBuilder.js";
import { TurnCoordinator } from "./turn/TurnCoordinator.js";

interface SessionConfig {
  sessionId: string;
  ws: WebSocket;
  pipeline: VoicePipeline;
  userId?: string;
  companyCode?: string;
}

const GREETING =
  '您好！我是智能理赔助手。请说"我要报案"开始办理理赔，或者说"查询进度"了解案件状态。';

export class VoiceSession {
  private sessionId: string;
  private ws: WebSocket;
  private pipeline: VoicePipeline;
  private context: VoiceSessionContext;
  private intentRecognizer: IntentRecognizer;
  private intentRegistry: IntentHandlerRegistry;
  private replyBuilder: VoiceReplyBuilder;
  private companyCode?: string;

  private coordinator: TurnCoordinator;
  private cancelled = false;

  /**
   * Abort controller for any in-flight intent-handler / tool execution.
   * Barge-in and cancel both fire this.
   */
  private ongoingOperation: AbortController | null = null;

  constructor(config: SessionConfig) {
    this.sessionId = config.sessionId;
    this.ws = config.ws;
    this.pipeline = config.pipeline;
    this.companyCode = config.companyCode;

    this.context = new VoiceSessionContext(config.userId || "anonymous");
    this.intentRecognizer = new IntentRecognizer();
    this.intentRegistry = new IntentHandlerRegistry();
    this.intentRegistry.initializeHandlers();
    this.replyBuilder = new VoiceReplyBuilder();

    // The coordinator owns the turn-state FSM, NLS stream lifecycle, and TTS
    // streaming. VoiceSession stays focused on message routing + intent handling.
    this.coordinator = new TurnCoordinator(
      this.pipeline.getNlsService(),
      this.pipeline.getTtsService(),
      {
        onTurnState: (data) => this.sendEvent("turn_state", data),
        onSttText: (text, isFinal, turnId) => {
          this.send({
            type: "text",
            payload: { source: "stt", content: text, isFinal, turnId },
          });
        },
        onFinalTranscript: (text) => this.processUserInput(text),
        onTtsAudio: (chunk, turnId) => {
          this.send({
            type: "audio",
            payload: {
              data: chunk.toString("base64"),
              format: "pcm",
              seq: Date.now(),
              isFinal: true,
              turnId,
            },
          });
        },
        onSpeechStart: (turnId) => this.sendEvent("speech_start", { turnId }),
        onSpeechEnd: (turnId) => this.sendEvent("speech_end", { turnId }),
        onNlsReconnecting: (attempt, delayMs) =>
          this.sendEvent("nls_reconnecting", { attempt, delayMs }),
        onNlsReady: () => this.sendEvent("nls_ready", {}),
        onError: (message) => this.sendEvent("error", { message }),
      },
    );

    // Kick off the greeting asynchronously. The coordinator transitions
    // IDLE → SPEAKING, streams the greeting TTS, and (once the client signals
    // playback_ended) transitions to LISTENING which opens NLS. We send the
    // greeting TEXT first so the UI can render it immediately without waiting
    // for TTS audio.
    setTimeout(() => {
      if (this.cancelled) return;
      // Send greeting text first; audio streams after.
      this.send({
        type: "text",
        payload: {
          source: "llm",
          content: GREETING,
          isFinal: true,
          turnId: this.coordinator.getTurnId(),
        },
      });
      void this.coordinator.startSession(GREETING).catch((err) => {
        console.error("[VoiceSession] greeting failed:", err);
      });
    }, 0);
  }

  async handleMessage(message: VoiceMessage): Promise<void> {
    if (this.cancelled) return;
    switch (message.type) {
      case "audio":
        this.handleAudioMessage(message.payload);
        break;
      case "text":
        await this.handleTextMessage(message.payload);
        break;
      case "control":
        await this.handleControlMessage(message.payload);
        break;
    }
  }

  private handleAudioMessage(payload: any): void {
    if (!payload?.data) return;
    const audioData = Buffer.from(payload.data, "base64");
    this.coordinator.handleClientAudio(audioData);
  }

  private async handleTextMessage(payload: any): Promise<void> {
    // Text coming from the client (e.g. user typed a message instead of speaking).
    if (payload.source === "stt" && payload.isFinal) {
      await this.processUserInput(payload.content);
    }
  }

  private async handleControlMessage(payload: any): Promise<void> {
    switch (payload.action) {
      case "barge_in":
        this.coordinator.handleClientBargeIn(payload.turnId ?? this.coordinator.getTurnId());
        // Also abort any ongoing intent tool execution.
        this.ongoingOperation?.abort();
        this.ongoingOperation = null;
        break;
      case "playback_ended":
        this.coordinator.handleClientPlaybackEnded(payload.turnId ?? this.coordinator.getTurnId());
        break;
      case "client_vad":
        this.coordinator.handleClientVad(
          payload.metadata?.state === "speech" ? "speech" : "silence",
          payload.turnId ?? this.coordinator.getTurnId(),
        );
        break;
      case "stop":
        this.cleanup();
        break;
      // start / pause / resume: not used in the current flow
    }
  }

  /**
   * Core: intent-driven handling of a final user transcript.
   *
   * Called by TurnCoordinator.onFinalTranscript when a final STT result lands.
   * The coordinator has already transitioned to THINKING; once this method
   * produces a reply it calls coordinator.speakReply(), which transitions
   * to SPEAKING and streams TTS.
   */
  private async processUserInput(text: string): Promise<void> {
    if (this.cancelled) return;
    console.log(`[VoiceSession] Processing: "${text}"`);

    this.context.addToHistory("user", text);

    try {
      const recognizedIntent = await this.intentRecognizer.recognize(text, this.context);
      const intent = normalizeQueryIntent(recognizedIntent, this.context);
      console.log(
        `[VoiceSession] Intent: ${intent.type}, confidence: ${intent.confidence}`,
      );
      if (intent.entities?.normalizedQuery) {
        console.log("[VoiceSession] normalizedQuery:", intent.entities.normalizedQuery);
      }
      this.context.setLastUserGoal(intent.conversationGoal || intent.type);

      if (intent.type === "cancel" && this.ongoingOperation) {
        this.ongoingOperation.abort();
        this.ongoingOperation = null;
        this.coordinator.handleCancel();
      }

      const result = await this.intentRegistry.handle(intent, this.context);

      if (result.newState) {
        this.context.setState(result.newState as any);
      }

      const actionResults: ActionExecutionSummary[] = [];
      if (result.actions) {
        for (const action of result.actions) {
          const summaries = await this.executeAction(action);
          actionResults.push(...summaries);
        }
      }

      const finalResponse = await this.replyBuilder.buildReply({
        intent,
        result,
        context: this.context,
        actionResults,
        userText: text,
      });
      this.context.setLastSummary(finalResponse);
      this.context.setLastAssistantQuestion(
        finalResponse.includes("？") ? finalResponse : null,
      );
      this.context.addToHistory("assistant", finalResponse);

      // Forward the raw reply text to the client *before* TTS (so the UI can
      // show it immediately). TurnCoordinator.speakReply will then transition
      // to SPEAKING and stream the audio.
      this.send({
        type: "text",
        payload: {
          source: "llm",
          content: finalResponse,
          isFinal: true,
          turnId: this.coordinator.getTurnId(),
        },
      });

      await this.coordinator.speakReply(finalResponse, intent.type);

      if (result.shouldTerminate) {
        setTimeout(() => this.cleanup(), 500);
      }
    } catch (error) {
      console.error("[VoiceSession] Processing error:", error);
      const msg = "抱歉，处理出错了，请重试。";
      this.send({
        type: "text",
        payload: {
          source: "llm",
          content: msg,
          isFinal: true,
          turnId: this.coordinator.getTurnId(),
        },
      });
      await this.coordinator.speakReply(msg, "error");
    }
  }

  // ---- Tool / action execution (unchanged behavior from previous implementation) ----

  private async executeAction(action: { type: string; payload: any }): Promise<ActionExecutionSummary[]> {
    this.ongoingOperation = new AbortController();
    this.coordinator.registerOngoingOperation(this.ongoingOperation);
    const signal = this.ongoingOperation.signal;
    const summaries: ActionExecutionSummary[] = [];

    try {
      switch (action.type) {
        case "LOAD_POLICIES":
          summaries.push(await this.loadPolicies(signal));
          break;
        case "LOAD_CLAIMS":
          summaries.push(...(await this.loadClaims(signal)));
          break;
        case "ANNOUNCE_CLAIM_PROGRESS":
          summaries.push(await this.announceClaimProgress(action.payload, signal));
          break;
        case "LOAD_CLAIM_MATERIALS":
          summaries.push(await this.loadClaimMaterials(action.payload, signal));
          break;
        case "LOAD_MISSING_CLAIM_MATERIALS":
          summaries.push(await this.loadMissingClaimMaterials(action.payload, signal));
          break;
        case "LOAD_COVERAGE_INFO":
          summaries.push(await this.loadCoverageInfo(action.payload, signal));
          break;
        case "LOAD_SETTLEMENT_ESTIMATE":
          summaries.push(await this.loadSettlementEstimate(action.payload, signal));
          break;
        case "LOAD_INTAKE_CONFIG":
          summaries.push(await this.loadIntakeConfig(action.payload.productCode, signal));
          break;
        case "SUBMIT_CLAIM":
          summaries.push(await this.submitClaim(action.payload, signal));
          break;
        case "REFRESH_SUMMARY":
          break;
      }
      return summaries.filter((item) => Boolean(item));
    } finally {
      this.ongoingOperation = null;
      this.coordinator.clearOngoingOperation();
    }
  }

  private async loadPolicies(signal: AbortSignal): Promise<ActionExecutionSummary> {
    this.sendEvent("tool_call_start", { toolName: "查询保单" });
    try {
      const result = await executeTool("listUserPolicies", {}, {
        userId: this.context.getUserId(),
        companyCode: this.companyCode,
      });

      if (signal.aborted) {
        return { type: "LOAD_POLICIES", success: false, error: "操作已取消" };
      }

      if (!result.success) {
        return {
          type: "LOAD_POLICIES",
          success: false,
          error: result.error || "查询保单失败",
          summary: buildActionSummary("LOAD_POLICIES", undefined, result.error || "查询保单失败"),
        };
      }

      const policies = Array.isArray(result.data) ? result.data : [];
      this.context.setAvailablePolicies(policies);

      if (policies.length === 0) {
        this.context.setState("IDLE");
        return {
          type: "LOAD_POLICIES",
          success: true,
          data: { mode: "missing" },
          summary: buildActionSummary("LOAD_POLICIES", { mode: "missing" }),
        };
      }

      if (policies.length === 1) {
        const selectedPolicy = policies[0];
        this.context.setSelectedPolicy(selectedPolicy);
        this.context.setState("COLLECTING_FIELDS");
        const intakeSummary = await this.loadIntakeConfig(selectedPolicy.productCode, signal);
        return {
          type: "LOAD_POLICIES",
          success: true,
          data: { mode: "auto_selected", selectedPolicy },
          summary:
            buildActionSummary("LOAD_POLICIES", { mode: "auto_selected", selectedPolicy }) +
            (intakeSummary.summary || ""),
        };
      }

      this.context.setState("SELECTING_POLICY");
      return {
        type: "LOAD_POLICIES",
        success: true,
        data: { mode: "selection", policies },
        summary: buildActionSummary("LOAD_POLICIES", { mode: "selection", policies }),
      };
    } finally {
      this.sendEvent("tool_call_end", { toolName: "查询保单" });
    }
  }

  private async loadClaims(signal: AbortSignal): Promise<ActionExecutionSummary[]> {
    this.sendEvent("tool_call_start", { toolName: "查询案件" });
    try {
      const result = await executeTool("查询理赔进度", {}, {
        userId: this.context.getUserId(),
        companyCode: this.companyCode,
      });

      if (signal.aborted) {
        return [{ type: "LOAD_CLAIMS", success: false, error: "操作已取消" }];
      }

      if (!result.success) {
        return [
          {
            type: "LOAD_CLAIMS",
            success: false,
            error: result.error || "未查询到理赔案件",
            summary: result.error || "未查询到理赔案件",
          },
        ];
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

      if (resolution.kind === "missing") {
        this.context.setState("IDLE");
        return [
          {
            type: "LOAD_CLAIMS",
            success: true,
            data: { mode: "missing" },
            summary: buildActionSummary("LOAD_CLAIMS", { mode: "missing" }),
          },
        ];
      }

      if (resolution.kind === "resolved") {
        const selectedClaim =
          claims.find((claim: any) => claim.claimId === resolution.claim.id) || claims[0];
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
          this.context.setState("IDLE");
          return [
            {
              type: "LOAD_CLAIMS",
              success: true,
              data: { mode: "resolved", selectedClaim },
              summary: "",
            },
            ...followUp,
          ];
        }
        this.context.setState("IDLE");
        return [
          {
            type: "LOAD_CLAIMS",
            success: true,
            data: { mode: "resolved", selectedClaim },
            summary: buildActionSummary("ANNOUNCE_CLAIM_PROGRESS", selectedClaim),
          },
        ];
      }

      const claimList = resolution.claims
        .map((claimMeta, index) => {
          const claim = claims.find((item: any) => item.claimId === claimMeta.id) || claims[index];
          return `第${claim.index}个，案件${claim.claimId}，${claim.statusLabel}`;
        })
        .join("；");
      this.context.setState("SELECTING_CLAIM");
      return [
        {
          type: "LOAD_CLAIMS",
          success: true,
          data: { mode: "selection", claims: resolution.claims },
          summary: `我查到${resolution.claims.length}个案件。${claimList}。您说第几个就行。`,
        },
      ];
    } finally {
      this.sendEvent("tool_call_end", { toolName: "查询案件" });
    }
  }

  private async loadClaimMaterials(
    payload: { productCode?: string; claimType?: string },
    signal: AbortSignal,
  ): Promise<ActionExecutionSummary> {
    this.sendEvent("tool_call_start", { toolName: "查询材料清单" });
    try {
      const result = await executeTool("查询材料清单", payload);
      if (signal.aborted) {
        return { type: "LOAD_CLAIM_MATERIALS", success: false, error: "操作已取消" };
      }
      if (!result.success) {
        return {
          type: "LOAD_CLAIM_MATERIALS",
          success: false,
          error: result.error || "查询材料清单失败",
          summary: result.error || "查询材料清单失败",
        };
      }
      return {
        type: "LOAD_CLAIM_MATERIALS",
        success: true,
        data: result.data,
        summary: buildActionSummary("LOAD_CLAIM_MATERIALS", result.data),
      };
    } finally {
      this.sendEvent("tool_call_end", { toolName: "查询材料清单" });
    }
  }

  private async announceClaimProgress(
    payload: { claimId: string; claimType?: string; productCode?: string },
    signal: AbortSignal,
  ): Promise<ActionExecutionSummary> {
    this.sendEvent("tool_call_start", { toolName: "播报案件进度" });
    try {
      if (signal.aborted) return { type: "ANNOUNCE_CLAIM_PROGRESS", success: false };
      const selectedClaim = this.context.getSelectedClaim();
      if (!selectedClaim || selectedClaim.claimId !== payload.claimId) {
        return {
          type: "ANNOUNCE_CLAIM_PROGRESS",
          success: false,
          error: "暂时无法定位到该案件进度，请稍后重试。",
          summary: "暂时无法定位到该案件进度，请稍后重试。",
        };
      }
      return {
        type: "ANNOUNCE_CLAIM_PROGRESS",
        success: true,
        data: selectedClaim,
        summary: buildActionSummary("ANNOUNCE_CLAIM_PROGRESS", selectedClaim),
      };
    } finally {
      this.sendEvent("tool_call_end", { toolName: "播报案件进度" });
    }
  }

  private async loadMissingClaimMaterials(
    payload: { claimId: string; productCode?: string; claimType?: string },
    signal: AbortSignal,
  ): Promise<ActionExecutionSummary> {
    this.sendEvent("tool_call_start", { toolName: "查询缺失材料" });
    try {
      const result = await executeTool("查询缺失材料", payload);
      if (signal.aborted) {
        return { type: "LOAD_MISSING_CLAIM_MATERIALS", success: false, error: "操作已取消" };
      }
      if (!result.success) {
        return {
          type: "LOAD_MISSING_CLAIM_MATERIALS",
          success: false,
          error: result.error || "查询缺失材料失败",
          summary: result.error || "查询缺失材料失败",
        };
      }
      return {
        type: "LOAD_MISSING_CLAIM_MATERIALS",
        success: true,
        data: result.data,
        summary: buildActionSummary("LOAD_MISSING_CLAIM_MATERIALS", result.data),
      };
    } finally {
      this.sendEvent("tool_call_end", { toolName: "查询缺失材料" });
    }
  }

  private async loadCoverageInfo(
    payload: { productCode?: string; claimType?: string },
    signal: AbortSignal,
  ): Promise<ActionExecutionSummary> {
    this.sendEvent("tool_call_start", { toolName: "查询保障范围" });
    try {
      const result = await executeTool("查询保障范围", payload);
      if (signal.aborted) return { type: "LOAD_COVERAGE_INFO", success: false };
      if (!result.success) {
        return {
          type: "LOAD_COVERAGE_INFO",
          success: false,
          error: result.error || "查询保障范围失败",
          summary: result.error || "查询保障范围失败",
        };
      }
      return {
        type: "LOAD_COVERAGE_INFO",
        success: true,
        data: result.data,
        summary: buildActionSummary("LOAD_COVERAGE_INFO", result.data),
      };
    } finally {
      this.sendEvent("tool_call_end", { toolName: "查询保障范围" });
    }
  }

  private async loadSettlementEstimate(
    payload: { claimId?: string; productCode?: string; claimType?: string },
    signal: AbortSignal,
  ): Promise<ActionExecutionSummary> {
    this.sendEvent("tool_call_start", { toolName: "查询赔付预估" });
    try {
      const result = await executeTool("查询赔付预估", payload);
      if (signal.aborted) return { type: "LOAD_SETTLEMENT_ESTIMATE", success: false };
      if (!result.success) {
        return {
          type: "LOAD_SETTLEMENT_ESTIMATE",
          success: false,
          error: result.error || "查询赔付预估失败",
          summary: result.error || "查询赔付预估失败",
        };
      }
      return {
        type: "LOAD_SETTLEMENT_ESTIMATE",
        success: true,
        data: result.data,
        summary: buildActionSummary("LOAD_SETTLEMENT_ESTIMATE", result.data),
      };
    } finally {
      this.sendEvent("tool_call_end", { toolName: "查询赔付预估" });
    }
  }

  private async loadIntakeConfig(productCode: string, signal: AbortSignal): Promise<ActionExecutionSummary> {
    this.sendEvent("tool_call_start", { toolName: "加载配置" });
    try {
      const result = await executeTool("getProductIntakeConfig", { productCode });
      if (signal.aborted) return { type: "LOAD_INTAKE_CONFIG", success: false };
      if (result.success) {
        this.context.setIntakeConfig(result.data);
        return {
          type: "LOAD_INTAKE_CONFIG",
          success: true,
          data: { mode: "loaded", fields: result.data?.fields || [] },
          summary: "",
        };
      }
      this.context.setState("IDLE");
      return {
        type: "LOAD_INTAKE_CONFIG",
        success: false,
        error: result.error || "未加载到报案配置",
        data: { mode: "missing_config" },
        summary: buildActionSummary("LOAD_INTAKE_CONFIG", { mode: "missing_config" }),
      };
    } finally {
      this.sendEvent("tool_call_end", { toolName: "加载配置" });
    }
  }

  private async submitClaim(data: any, signal: AbortSignal): Promise<ActionExecutionSummary> {
    this.sendEvent("tool_call_start", { toolName: "提交报案" });
    try {
      const result = await executeTool("submitClaim", data);
      if (signal.aborted) return { type: "SUBMIT_CLAIM", success: false };
      if (result.success) {
        this.sendEvent("session_ended", {
          claimId: result.data.claimId,
          reportNumber: result.data.reportNumber,
        });
        return {
          type: "SUBMIT_CLAIM",
          success: true,
          data: result.data,
          summary: buildActionSummary("SUBMIT_CLAIM", result.data),
        };
      }
      return {
        type: "SUBMIT_CLAIM",
        success: false,
        error: result.error || "提交失败",
        summary: `提交失败：${result.error || "请稍后重试"}`,
      };
    } finally {
      this.sendEvent("tool_call_end", { toolName: "提交报案" });
    }
  }

  // ---- Low-level send helpers ----

  /** Public so VoiceGateway can send the initial `session_started` event. */
  sendEvent(event: string, data: any): void {
    this.send({
      type: "event",
      payload: { event, data } as any,
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
    if (this.cancelled) return;
    this.cancelled = true;
    this.ongoingOperation?.abort();
    this.ongoingOperation = null;
    this.coordinator.dispose();
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
    console.log(`[VoiceSession] Session ${this.sessionId} cleaned up`);
  }
}
