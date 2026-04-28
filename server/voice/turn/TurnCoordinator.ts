import type { AliyunNLSService } from "../services/AliyunNLS.js";
import type { AliyunTTSService } from "../services/AliyunTTS.js";
import type { TurnState, TurnStateEventData } from "../../../types/voice.js";

import { TurnStateMachine, type TransitionEvent } from "./TurnStateMachine.js";
import { NLSStreamManager, type TranscriptionResult } from "../audio/NLSStreamManager.js";
import { TTSStreamController } from "../audio/TTSStreamController.js";

export interface TurnCoordinatorCallbacks {
  /** Emit authoritative turn_state event to the client. */
  onTurnState: (data: TurnStateEventData) => void;
  /** Forward STT text (interim or final) to the client. */
  onSttText: (text: string, isFinal: boolean, turnId: string) => void;
  /** A final transcript arrived — run the intent pipeline. Caller invokes speakReply() when ready. */
  onFinalTranscript: (text: string, turnId: string) => Promise<void>;
  /** Forward a TTS audio chunk to the client. */
  onTtsAudio: (chunk: Buffer, turnId: string) => void;
  /** Server is starting to stream TTS for a turn. */
  onSpeechStart: (turnId: string) => void;
  /** Server finished streaming TTS for a turn (does not mean client finished playing). */
  onSpeechEnd: (turnId: string) => void;
  /** NLS backoff state. */
  onNlsReconnecting: (attempt: number, delayMs: number) => void;
  onNlsReady: () => void;
  /** Non-fatal user-surfaceable error. */
  onError: (message: string) => void;
}

/** If the client never sends playback_ended, force-transition back to LISTENING after this timeout. */
const PLAYBACK_ENDED_TIMEOUT_MS = 30_000;

/**
 * Glue layer that owns the turn-state FSM and orchestrates NLS + TTS + client
 * notifications. Replaces the tangled `isSpeaking / isNLSStreamInitialized /
 * nlsStreamGeneration / nlsWasEverInitialized / silenceTimer / audioBuffer`
 * flags previously scattered across VoiceSession.
 *
 * Lifecycle contract:
 *  - Caller constructs, then calls startSession(greeting)
 *  - Caller routes incoming client messages to handleClientAudio / handleClientControl
 *  - Caller implements onFinalTranscript to run the intent pipeline and eventually
 *    call speakReply(text) with the response text.
 */
export class TurnCoordinator {
  private fsm = new TurnStateMachine();
  private nls: NLSStreamManager;
  private tts: TTSStreamController;
  private callbacks: TurnCoordinatorCallbacks;

  private currentTurnId = this.generateTurnId();
  private currentReplyAbort: AbortController | null = null;
  private playbackEndedTimer: NodeJS.Timeout | null = null;
  private disposed = false;

  constructor(
    nlsService: AliyunNLSService | null,
    ttsService: AliyunTTSService | null,
    callbacks: TurnCoordinatorCallbacks,
  ) {
    this.callbacks = callbacks;
    this.tts = new TTSStreamController(ttsService);
    this.nls = new NLSStreamManager(nlsService, {
      onResult: (r) => this.handleNlsResult(r),
      onError: (e) => this.handleNlsError(e),
      onReconnecting: (attempt, delay) => this.callbacks.onNlsReconnecting(attempt, delay),
      onReady: () => this.callbacks.onNlsReady(),
    });
    // Phase 2: one persistent NLS stream for the whole session lifetime,
    // kept warm with silence-frame keepalive. The stream continues running
    // across THINKING/SPEAKING states; client audio is gated by FSM state
    // (see handleClientAudio), but keepalive frames flow continuously so
    // Aliyun never hits IDLE_TIMEOUT.
    this.nls.enableKeepalive();
    void this.nls.start().catch((err) => {
      console.error("[TurnCoordinator] initial NLS start failed:", err);
      this.callbacks.onError(
        `语音识别服务暂不可用（${err instanceof Error ? err.message : String(err)}），您可以通过文字输入继续对话`,
      );
    });

    this.fsm.onTransition((event) => this.onTransition(event));
  }

  getState(): TurnState {
    return this.fsm.getState();
  }

  getTurnId(): string {
    return this.currentTurnId;
  }

  // -------- entry points called by VoiceSession --------

  /**
   * Kick off the session with a greeting. Transitions IDLE → SPEAKING, streams
   * TTS to the client. The client will signal `playback_ended` when audio finishes
   * playing; that will transition us to LISTENING and open NLS.
   */
  async startSession(greetingText: string): Promise<void> {
    if (this.disposed) return;
    if (this.fsm.getState() !== "IDLE") {
      console.warn(
        `[TurnCoordinator] startSession called in state ${this.fsm.getState()}, ignoring`,
      );
      return;
    }
    this.beginNewTurn();
    this.fsm.dispatch("GREETING_SENT", { turnId: this.currentTurnId, reason: "greeting" });
    await this.streamTts(greetingText);
  }

  /**
   * Caller (VoiceSession.processUserInput) has produced a reply. Transitions
   * THINKING → SPEAKING and streams TTS.
   */
  async speakReply(text: string, reason = "reply"): Promise<void> {
    if (this.disposed) return;
    if (this.fsm.getState() !== "THINKING") {
      console.warn(
        `[TurnCoordinator] speakReply called in state ${this.fsm.getState()}, dispatching anyway if legal`,
      );
    }
    const transitioned = this.fsm.tryDispatch("REPLY_READY", {
      turnId: this.currentTurnId,
      reason,
    });
    if (!transitioned) {
      console.warn("[TurnCoordinator] REPLY_READY transition rejected, skipping TTS");
      return;
    }
    await this.streamTts(text);
  }

  /** Route an inbound audio chunk from the client to the NLS stream. */
  handleClientAudio(buf: Buffer): void {
    if (this.disposed) return;
    // Only forward during LISTENING. In other states we discard (e.g. user
    // mic chatter slipping in while TTS is playing). The NLS stream itself is
    // persistent — see NLSStreamManager keepalive.
    if (this.fsm.getState() !== "LISTENING") return;
    this.nls.sendAudio(buf);
  }

  /** Client confirmed that all TTS audio has finished playing. */
  handleClientPlaybackEnded(turnId: string): void {
    if (this.disposed) return;
    if (turnId !== this.currentTurnId) {
      console.log(
        `[TurnCoordinator] ignoring playback_ended for stale turnId=${turnId} (current=${this.currentTurnId})`,
      );
      return;
    }
    if (this.playbackEndedTimer) {
      clearTimeout(this.playbackEndedTimer);
      this.playbackEndedTimer = null;
    }
    const transitioned = this.fsm.tryDispatch("PLAYBACK_ENDED", {
      turnId: this.currentTurnId,
      reason: "playback_ended",
    });
    if (!transitioned) {
      console.log(
        `[TurnCoordinator] playback_ended in state ${this.fsm.getState()}, no-op`,
      );
    }
  }

  /** Client detected user speech during SPEAKING → stop TTS, return to LISTENING. */
  handleClientBargeIn(turnId: string): void {
    if (this.disposed) return;
    if (turnId !== this.currentTurnId) {
      console.log(
        `[TurnCoordinator] ignoring barge_in for stale turnId=${turnId} (current=${this.currentTurnId})`,
      );
      return;
    }
    if (this.fsm.getState() !== "SPEAKING" && this.fsm.getState() !== "THINKING") {
      console.log(
        `[TurnCoordinator] barge_in in state ${this.fsm.getState()}, no-op`,
      );
      return;
    }
    console.log("[TurnCoordinator] barge_in received, aborting TTS");
    this.abortCurrentReply();
    this.fsm.tryDispatch("BARGE_IN", {
      turnId: this.currentTurnId,
      reason: "barge_in",
    });
  }

  /** User said "取消" / cancel intent. Returns to LISTENING from any state. */
  handleCancel(): void {
    if (this.disposed) return;
    console.log("[TurnCoordinator] cancel received");
    this.abortCurrentReply();
    this.fsm.tryDispatch("CANCEL", {
      turnId: this.currentTurnId,
      reason: "cancel",
    });
  }

  /** Caller started running an intent handler; expose the AbortSignal so barge_in can cancel it. */
  registerOngoingOperation(abort: AbortController): void {
    this.currentReplyAbort = abort;
  }

  /** Caller finished running an intent handler. */
  clearOngoingOperation(): void {
    this.currentReplyAbort = null;
  }

  /** Advisory VAD state from the client. Reserved for UtteranceSegmenter. */
  handleClientVad(_state: "speech" | "silence", turnId: string): void {
    if (this.disposed) return;
    if (turnId !== this.currentTurnId) return;
    // Reserved for future UtteranceSegmenter integration.
  }

  dispose(): void {
    this.disposed = true;
    this.abortCurrentReply();
    if (this.playbackEndedTimer) {
      clearTimeout(this.playbackEndedTimer);
      this.playbackEndedTimer = null;
    }
    try {
      this.fsm.tryDispatch("SESSION_END", {
        turnId: this.currentTurnId,
        reason: "dispose",
      });
    } catch {
      // already idle
    }
    this.nls.dispose();
  }

  // -------- internals --------

  private beginNewTurn(): void {
    this.currentTurnId = this.generateTurnId();
  }

  private generateTurnId(): string {
    return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private onTransition(event: TransitionEvent): void {
    console.log(
      `[TurnCoordinator] ${event.from} → ${event.to} (${event.transition}, reason=${event.reason ?? "none"}, turnId=${event.turnId})`,
    );

    // Emit to client on every state change.
    this.callbacks.onTurnState({
      state: event.to,
      turnId: event.turnId,
      reason: event.reason,
    });

    // Phase 2: NLS stream is persistent for the session lifetime. No side
    // effects are needed on state transitions — client audio is gated by
    // FSM state in handleClientAudio(), and keepalive frames flow continuously
    // to prevent Aliyun IDLE_TIMEOUT. The stream closes in dispose().
  }

  private async streamTts(text: string): Promise<void> {
    const turnId = this.currentTurnId;
    const abort = new AbortController();
    this.currentReplyAbort = abort;

    this.callbacks.onSpeechStart(turnId);

    const result = await this.tts.synthesize(
      text,
      (chunk) => this.callbacks.onTtsAudio(chunk, turnId),
      { signal: abort.signal },
    );

    // Only clear our ref if it's still ours (barge_in may have replaced it).
    if (this.currentReplyAbort === abort) this.currentReplyAbort = null;

    this.callbacks.onSpeechEnd(turnId);

    if (result.aborted || result.timedOut) {
      if (result.timedOut) {
        this.callbacks.onError("语音合成超时，请稍后重试");
        // Force transition back to LISTENING — don't wait for client playback_ended
        // because the client never got a complete audio stream.
        this.fsm.tryDispatch("PLAYBACK_ENDED", { turnId, reason: "tts_timeout" });
      }
      // For barge_in, the state machine has already been transitioned by handleClientBargeIn.
      return;
    }

    // Start the safety-net timer: if client doesn't send playback_ended in 30s,
    // assume something went wrong on their side and move to LISTENING anyway.
    if (this.playbackEndedTimer) clearTimeout(this.playbackEndedTimer);
    this.playbackEndedTimer = setTimeout(() => {
      this.playbackEndedTimer = null;
      if (this.fsm.getState() === "SPEAKING" && this.currentTurnId === turnId) {
        console.warn(
          `[TurnCoordinator] playback_ended not received within ${PLAYBACK_ENDED_TIMEOUT_MS}ms, force-advancing`,
        );
        this.fsm.tryDispatch("PLAYBACK_ENDED", {
          turnId,
          reason: "playback_ended_timeout",
        });
      }
    }, PLAYBACK_ENDED_TIMEOUT_MS);
  }

  private abortCurrentReply(): void {
    if (this.currentReplyAbort) {
      try {
        this.currentReplyAbort.abort();
      } catch (err) {
        console.warn("[TurnCoordinator] abort threw:", err);
      }
      this.currentReplyAbort = null;
    }
  }

  private handleNlsResult(result: TranscriptionResult): void {
    if (this.disposed) return;
    const turnId = this.currentTurnId;
    // Forward interim + final to client so UI can show live transcript.
    this.callbacks.onSttText(result.text, result.isFinal, turnId);

    if (result.isFinal && result.text.trim()) {
      // Advance to THINKING and invoke caller's intent pipeline.
      const transitioned = this.fsm.tryDispatch("STT_FINAL", {
        turnId,
        reason: "stt_final",
      });
      if (!transitioned) return;

      // Fire the caller's intent processor. Caller is expected to call speakReply() eventually.
      Promise.resolve(this.callbacks.onFinalTranscript(result.text, turnId)).catch(
        (err) => {
          console.error("[TurnCoordinator] onFinalTranscript threw:", err);
          // Best-effort recovery: put us back in LISTENING.
          this.fsm.tryDispatch("CANCEL", {
            turnId,
            reason: "intent_pipeline_error",
          });
        },
      );
    }
  }

  private handleNlsError(error: Error): void {
    if (this.disposed) return;
    console.error("[TurnCoordinator] NLS error:", error.message);
    // NLSStreamManager will auto-reconnect via exponential backoff; no FSM change.
  }
}
