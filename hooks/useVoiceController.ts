import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  TurnState,
  TurnStateEventData,
  VoiceMessage,
} from "../types/voice";
import { TTSPlayer } from "../smartclaim-ai-agent/voice/ttsPlayer";
import { MicCapture } from "../smartclaim-ai-agent/voice/micCapture";
import { VadDetector, type VadState } from "../smartclaim-ai-agent/voice/vadDetector";

export interface VoiceServiceStatus {
  geminiConfigured: boolean;
  nlsMode: "aliyun" | "mock";
  ttsMode: "aliyun" | "mock";
}

export interface UseVoiceControllerOptions {
  userName?: string;
  sessionStartUrl?: string;
  onSttText?: (text: string, isFinal: boolean) => void;
  onLlmText?: (text: string) => void;
  onError?: (message: string) => void;
  onToolCallStart?: (toolName: string) => void;
  onToolCallEnd?: (toolName: string) => void;
  onSessionEnded?: (data: any) => void;
  /** Called with the greeting-or-status message derived from service availability. */
  onServiceMessage?: (message: string) => void;
}

export interface VoiceController {
  turnState: TurnState;
  turnId: string | null;
  isActive: boolean;
  statusText: string;
  services: VoiceServiceStatus | null;
  start: () => Promise<boolean>;
  stop: () => Promise<void>;
  bargeIn: () => void;
}

const DEFAULT_SESSION_START_URL = "/api/voice/session/start";

const STATUS_TEXT_BY_STATE: Record<TurnState, string> = {
  IDLE: "请直接描述您的事故情况",
  LISTENING: "正在聆听...",
  THINKING: "正在处理...",
  SPEAKING: "正在播报...",
};

function describeServiceStatus(services?: VoiceServiceStatus): string {
  if (!services) return "当前语音服务处于降级模式，建议使用文字输入以获得更好体验。";
  const { nlsMode, ttsMode } = services;
  if (nlsMode === "aliyun" && ttsMode === "aliyun") {
    return "阿里云语音服务已连接，当前播报使用阿里云音色。";
  }
  if (nlsMode === "aliyun") {
    return "语音识别已接入阿里云，但语音播报未启用阿里云 TTS，当前会退回默认播报。";
  }
  if (ttsMode === "aliyun") {
    return "语音播报已接入阿里云 TTS，但语音识别仍处于模拟模式。";
  }
  return "当前语音服务处于降级模式，建议使用文字输入以获得更好体验。";
}

/**
 * Single-source-of-truth voice controller backed by the turn-state protocol.
 *
 * This hook replaces the ~20 scattered voice refs and the imperative
 * start/stop/handleServerVoiceMessage functions in App.tsx. The React
 * component only sees `{ turnState, statusText, start, stop, bargeIn }`
 * and receives STT / LLM text via callbacks.
 */
export function useVoiceController(options: UseVoiceControllerOptions = {}): VoiceController {
  const [turnState, setTurnState] = useState<TurnState>("IDLE");
  const [turnId, setTurnId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [services, setServices] = useState<VoiceServiceStatus | null>(null);

  // Options are stored in a ref so that changing callbacks doesn't trigger
  // reconnects (the WebSocket lifetime is managed imperatively).
  const optsRef = useRef(options);
  optsRef.current = options;

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const vadRef = useRef<VadDetector | null>(null);
  const ttsPlayerRef = useRef<TTSPlayer | null>(null);
  const turnStateRef = useRef<TurnState>("IDLE");
  const turnIdRef = useRef<string | null>(null);
  const activeRef = useRef(false);
  // Barge-in bookkeeping: which turnId we've already fired barge_in for.
  const bargeInFiredForTurnRef = useRef<string | null>(null);
  // Continuous-speech counter while SPEAKING (frames since last silence).
  // 1 frame ≈ 128ms @ 16kHz/2048; need ~3 consecutive frames for ~300ms.
  const speakingSpeechFramesRef = useRef(0);
  // Last client_vad we emitted while LISTENING, to avoid spam.
  const lastEmittedVadStateRef = useRef<VadState | null>(null);

  const setActive = useCallback((v: boolean) => {
    activeRef.current = v;
    setIsActive(v);
  }, []);

  const applyTurnState = useCallback((data: TurnStateEventData) => {
    const prevState = turnStateRef.current;
    turnStateRef.current = data.state;
    turnIdRef.current = data.turnId;
    setTurnState(data.state);
    setTurnId(data.turnId);
    console.log(`[VoiceController] turn_state → ${data.state} (reason=${data.reason ?? "—"}, turnId=${data.turnId})`);

    // Reset barge-in bookkeeping on every transition.
    speakingSpeechFramesRef.current = 0;
    if (data.state !== "SPEAKING") {
      bargeInFiredForTurnRef.current = null;
      // Defensive: if we moved to LISTENING via barge_in, cancel playback.
      if (data.reason === "barge_in") {
        ttsPlayerRef.current?.cancel();
        ttsPlayerRef.current?.reset();
      }
    }
    // Entering LISTENING from a non-LISTENING state — reset VAD to avoid
    // the SPEAKING-era mic level carrying over as a false "speech".
    if (data.state === "LISTENING" && prevState !== "LISTENING") {
      vadRef.current?.reset();
      lastEmittedVadStateRef.current = null;
    }
  }, []);

  const sendJson = useCallback((msg: VoiceMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(msg));
  }, []);

  const sendPlaybackEnded = useCallback(() => {
    const currentTurnId = turnIdRef.current;
    if (!currentTurnId) return;
    console.log(`[VoiceController] sending playback_ended turnId=${currentTurnId}`);
    sendJson({
      type: "control",
      payload: { action: "playback_ended", turnId: currentTurnId },
    });
  }, [sendJson]);

  const bargeIn = useCallback(() => {
    const currentTurnId = turnIdRef.current;
    if (!currentTurnId) return;
    if (turnStateRef.current !== "SPEAKING" && turnStateRef.current !== "THINKING") return;
    console.log(`[VoiceController] sending barge_in turnId=${currentTurnId}`);
    // Optimistic: stop local playback immediately; server confirms with turn_state.
    ttsPlayerRef.current?.cancel();
    ttsPlayerRef.current?.reset();
    sendJson({
      type: "control",
      payload: { action: "barge_in", turnId: currentTurnId },
    });
  }, [sendJson]);

  const handleServerMessage = useCallback(
    (raw: string) => {
      let msg: VoiceMessage;
      try {
        msg = JSON.parse(raw);
      } catch (err) {
        console.error("[VoiceController] failed to parse server msg:", err);
        return;
      }
      if (msg.type === "audio") {
        const payload = msg.payload as any;
        // Drop audio from stale turns (e.g. chunks still arriving after barge-in).
        if (
          payload.turnId &&
          turnIdRef.current &&
          payload.turnId !== turnIdRef.current
        ) {
          return;
        }
        ttsPlayerRef.current?.push(payload.data);
        return;
      }

      if (msg.type === "text") {
        const payload = msg.payload as any;
        if (payload.source === "stt") {
          optsRef.current.onSttText?.(payload.content ?? "", !!payload.isFinal);
        } else if (payload.source === "llm") {
          optsRef.current.onLlmText?.(payload.content ?? "");
        }
        return;
      }

      if (msg.type === "event") {
        const payload = msg.payload as any;
        switch (payload.event) {
          case "turn_state":
            applyTurnState(payload.data as TurnStateEventData);
            break;
          case "speech_start":
            // first chunk incoming — nothing to do client-side
            break;
          case "speech_end":
            ttsPlayerRef.current?.markSpeechEnd();
            break;
          case "nls_reconnecting":
            console.log(
              `[VoiceController] nls_reconnecting attempt=${payload.data?.attempt} delay=${payload.data?.delayMs}`,
            );
            break;
          case "nls_ready":
            console.log("[VoiceController] nls_ready");
            break;
          case "tool_call_start":
            optsRef.current.onToolCallStart?.(payload.data?.toolName ?? "");
            break;
          case "tool_call_end":
            optsRef.current.onToolCallEnd?.(payload.data?.toolName ?? "");
            break;
          case "session_ended":
            optsRef.current.onSessionEnded?.(payload.data);
            break;
          case "error": {
            const message =
              typeof payload.data?.message === "string"
                ? payload.data.message
                : "语音服务暂不可用，请稍后重试。";
            optsRef.current.onError?.(message);
            break;
          }
        }
      }
    },
    [applyTurnState],
  );

  const teardown = useCallback(async () => {
    console.log("[VoiceController] teardown");
    const ws = wsRef.current;
    wsRef.current = null;
    sessionIdRef.current = null;

    if (micRef.current) {
      try {
        await micRef.current.stop();
      } catch {
        /* ignore */
      }
      micRef.current = null;
    }
    vadRef.current = null;
    bargeInFiredForTurnRef.current = null;
    speakingSpeechFramesRef.current = 0;
    lastEmittedVadStateRef.current = null;

    if (ttsPlayerRef.current) {
      try {
        await ttsPlayerRef.current.dispose();
      } catch {
        /* ignore */
      }
      ttsPlayerRef.current = null;
    }

    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      try {
        ws.send(
          JSON.stringify({ type: "control", payload: { action: "stop" } }),
        );
      } catch {
        /* ignore */
      }
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }

    setActive(false);
    turnStateRef.current = "IDLE";
    turnIdRef.current = null;
    setTurnState("IDLE");
    setTurnId(null);
  }, [setActive]);

  const start = useCallback(async (): Promise<boolean> => {
    if (activeRef.current) return true;

    const sessionStartUrl = optsRef.current.sessionStartUrl ?? DEFAULT_SESSION_START_URL;
    const userName = optsRef.current.userName ?? "anonymous";
    console.log("[VoiceController] start()");

    try {
      const res = await fetch(sessionStartUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userName }),
      });
      if (!res.ok) {
        console.warn("[VoiceController] session/start failed:", res.status);
        return false;
      }
      const data = await res.json();
      const wsUrl = data?.wsUrl as string | undefined;
      const sessionId = data?.sessionId as string | undefined;
      if (!wsUrl || !sessionId) {
        console.warn("[VoiceController] session/start missing wsUrl or sessionId");
        return false;
      }
      sessionIdRef.current = sessionId;

      const svc = (data?.services as VoiceServiceStatus | undefined) ?? null;
      setServices(svc);
      optsRef.current.onServiceMessage?.(describeServiceStatus(svc ?? undefined));

      // ---- VAD ----
      // During SPEAKING we count consecutive speech frames; once we cross
      // the threshold we fire barge_in. We also mirror VAD state to the
      // server via `client_vad` control messages during LISTENING so the
      // future UtteranceSegmenter can use it.
      const vad = new VadDetector({
        threshold: 0.015,
        minSpeechMs: 60,
        hangoverMs: 250,
        onStateChange: (state) => {
          if (turnStateRef.current === "LISTENING") {
            if (state !== lastEmittedVadStateRef.current) {
              lastEmittedVadStateRef.current = state;
              sendJson({
                type: "control",
                payload: {
                  action: "client_vad",
                  turnId: turnIdRef.current ?? undefined,
                  metadata: { state },
                },
              });
            }
          }
        },
      });
      vadRef.current = vad;

      // ---- Mic capture via AudioWorklet ----
      const mic = new MicCapture({
        onError: (err) => {
          console.error("[VoiceController] mic error:", err);
          optsRef.current.onError?.(err.message);
        },
        onFrame: ({ pcm, rms }) => {
          const nowTurnState = turnStateRef.current;
          // Always feed VAD — it's cheap and we need it to track state
          // transitions even during SPEAKING (for barge-in detection).
          vad.feed(rms);

          if (nowTurnState === "SPEAKING") {
            // Count sustained speech frames. Each frame is ~128ms.
            // ~3 consecutive speech frames ≈ 384ms ≥ target 300ms.
            if (rms >= 0.015) {
              speakingSpeechFramesRef.current += 1;
            } else {
              speakingSpeechFramesRef.current = 0;
            }
            const currentTurn = turnIdRef.current;
            if (
              currentTurn &&
              speakingSpeechFramesRef.current >= 3 &&
              bargeInFiredForTurnRef.current !== currentTurn
            ) {
              bargeInFiredForTurnRef.current = currentTurn;
              console.log(
                `[VoiceController] VAD barge_in trigger (rms=${rms.toFixed(4)}, turnId=${currentTurn})`,
              );
              ttsPlayerRef.current?.cancel();
              ttsPlayerRef.current?.reset();
              sendJson({
                type: "control",
                payload: { action: "barge_in", turnId: currentTurn },
              });
            }
            return; // Do NOT forward mic audio to the server during SPEAKING.
          }

          if (nowTurnState !== "LISTENING") return;

          const socketLocal = wsRef.current;
          if (!socketLocal || socketLocal.readyState !== WebSocket.OPEN) return;
          const base64 = pcm16ToBase64(pcm);
          socketLocal.send(
            JSON.stringify({
              type: "audio",
              payload: {
                format: "pcm",
                data: base64,
                seq: Date.now(),
                isFinal: false,
                turnId: turnIdRef.current,
              },
            }),
          );
        },
      });
      micRef.current = mic;

      let micMeta: { sampleRate: number; trackLabel: string };
      try {
        micMeta = await mic.start();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[VoiceController] mic start failed:", msg);
        optsRef.current.onError?.(`麦克风启动失败：${msg}`);
        return false;
      }
      console.log(
        `[VoiceController] mic ready: sampleRate=${micMeta.sampleRate}, label=${micMeta.trackLabel}`,
      );

      const socket = new WebSocket(
        `${wsUrl}${wsUrl.includes("?") ? "&" : "?"}userId=${encodeURIComponent(userName)}`,
      );
      wsRef.current = socket;

      // Tts player instance
      ttsPlayerRef.current = new TTSPlayer({ sampleRate: 16000, numChannels: 1 });
      ttsPlayerRef.current.onEnded(() => {
        sendPlaybackEnded();
      });

      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => {
          console.log("[VoiceController] WebSocket opened");
          resolve();
        };
        socket.onerror = (err) => {
          console.error("[VoiceController] WebSocket error during connect:", err);
          reject(new Error("voice_socket_connect_failed"));
        };
      });

      socket.onmessage = (evt) => handleServerMessage(evt.data as string);
      socket.onclose = () => {
        console.log("[VoiceController] WebSocket closed");
        void teardown();
      };
      socket.onerror = (err) => {
        console.error("[VoiceController] WebSocket error:", err);
      };

      setActive(true);
      return true;
    } catch (err) {
      console.error("[VoiceController] start failed:", err);
      await teardown();
      return false;
    }
  }, [handleServerMessage, sendPlaybackEnded, setActive, teardown]);

  const stop = useCallback(async () => {
    await teardown();
  }, [teardown]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  const statusText = useMemo(() => STATUS_TEXT_BY_STATE[turnState], [turnState]);

  return { turnState, turnId, isActive, statusText, services, start, stop, bargeIn };
}

// ---- audio helpers ----

function pcm16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(sub) as any);
  }
  return btoa(binary);
}
