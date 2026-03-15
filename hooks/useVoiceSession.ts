import { useState, useRef, useCallback, useEffect } from "react";
import type {
  VoiceMessage,
  VoiceSessionState,
  VoiceChatMessage,
  TextPayload,
  AudioPayload,
  EventPayload,
} from "../types/voice";

interface UseVoiceSessionProps {
  sessionId: string;
  wsUrl: string;
  onSessionEnd?: (summary: any) => void;
}

interface UseVoiceSessionReturn {
  state: VoiceSessionState;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendBargeIn: () => void;
}

export function useVoiceSession({
  sessionId,
  wsUrl,
  onSessionEnd,
}: UseVoiceSessionProps): UseVoiceSessionReturn {
  const [state, setState] = useState<VoiceSessionState>({
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    transcript: "",
    messages: [],
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const receivedAudioChunkCountRef = useRef(0);
  const playedAudioBufferCountRef = useRef(0);

  const startListening = useCallback(() => {
    if (!audioContextRef.current || !mediaStreamRef.current) {
      console.error(
        "[useVoiceSession] Cannot start listening: AudioContext or MediaStream not initialized",
      );
      return;
    }

    console.log("[useVoiceSession] Starting to listen...");

    const ctx = audioContextRef.current;
    const stream = mediaStreamRef.current;
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);

    // 先设置状态为 listening
    setState((prev) => ({ ...prev, isListening: true }));

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = floatTo16BitPCM(inputData);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "audio",
            payload: {
              data: arrayBufferToBase64(pcmData),
              seq: Date.now(),
              isFinal: false,
            },
          }),
        );
      }
    };

    source.connect(processor);
    processor.connect(ctx.destination);
    processorRef.current = processor;

    console.log("[useVoiceSession] Listening started");
  }, []);

  const connect = useCallback(async () => {
    try {
      // Initialize AudioContext
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });

      // Get microphone permission
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Connect WebSocket
      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.binaryType = "arraybuffer";

      wsRef.current.onopen = () => {
        setState((prev) => ({ ...prev, isConnected: true }));
        // 连接成功后自动开始监听
        setTimeout(() => startListening(), 100);
      };

      wsRef.current.onmessage = handleServerMessage;
      wsRef.current.onerror = handleError;
      wsRef.current.onclose = () => {
        console.log("[useVoiceSession] WebSocket closed, stopping audio capture");
        // 断开时停止所有音频采集
        if (processorRef.current) {
          processorRef.current.disconnect();
          processorRef.current = null;
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        if (audioContextRef.current) {
          if (audioContextRef.current.state !== "closed") {
            audioContextRef.current.close();
          }
          audioContextRef.current = null;
        }
        setState((prev) => ({
          ...prev,
          isConnected: false,
          isListening: false,
          isSpeaking: false,
        }));
      };
    } catch (error) {
      console.error("Failed to connect:", error);
      setState((prev) => ({
        ...prev,
        error: "连接失败，请检查麦克风权限",
      }));
    }
  }, [wsUrl, startListening]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
    }
  }, []);

  const handleServerMessage = useCallback((event: MessageEvent) => {
    const message: VoiceMessage = JSON.parse(event.data);
    if (message.type === "audio") {
      console.log("[useVoiceSession] Received audio message from server");
    } else if (message.type === "text") {
      const payload = message.payload as TextPayload;
      console.log(
        `[useVoiceSession] Received text message, source=${payload.source}, final=${payload.isFinal}`,
      );
    } else if (message.type === "event") {
      const payload = message.payload as EventPayload;
      console.log(`[useVoiceSession] Received event: ${payload.event}`);
    }

    switch (message.type) {
      case "text":
        handleTextMessage(message.payload as TextPayload);
        break;
      case "audio":
        handleAudioMessage(message.payload as AudioPayload);
        break;
      case "event":
        handleEventMessage(message.payload as EventPayload);
        break;
    }
  }, []);

  const handleTextMessage = useCallback((payload: TextPayload) => {
    if (payload.source === "stt") {
      if (payload.isFinal && payload.content.trim()) {
        // 最终识别结果：提交为用户消息，清空实时转写
        setState((prev) => ({
          ...prev,
          transcript: "",
          messages: [
            ...prev.messages,
            {
              role: "user" as const,
              content: payload.content,
              timestamp: Date.now(),
            },
          ],
        }));
      } else {
        // 实时转写中间结果
        setState((prev) => ({ ...prev, transcript: payload.content }));
      }
    } else if (payload.source === "llm") {
      setState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content: payload.content,
            timestamp: Date.now(),
          },
        ],
      }));
    }
  }, []);

  const handleAudioMessage = useCallback(
    async (payload: AudioPayload) => {
      if (!audioContextRef.current) return;

      if (!payload.data || payload.data.length === 0) {
        console.warn('[useVoiceSession] Empty audio data received');
        return;
      }

      try {
        const audioData = base64ToArrayBuffer(payload.data);
        const uint8Array = new Uint8Array(audioData);
        receivedAudioChunkCountRef.current += 1;
        if (
          receivedAudioChunkCountRef.current <= 3 ||
          receivedAudioChunkCountRef.current % 10 === 0
        ) {
          console.log(
            `[useVoiceSession] Decoding audio chunk ${receivedAudioChunkCountRef.current}, bytes=${uint8Array.byteLength}`,
          );
        }
        
        const audioBuffer = decodePCMToAudioBuffer(
          uint8Array,
          audioContextRef.current,
          16000,
          1
        );

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        audioQueueRef.current.push(audioBuffer);
        console.log(
          `[useVoiceSession] Queued audio buffer, frames=${audioBuffer.length}, queueSize=${audioQueueRef.current.length}`,
        );

        if (!state.isSpeaking) {
          playAudioQueue();
        }
      } catch (error) {
        console.error('[useVoiceSession] Failed to decode audio:', error);
      }
    },
    [state.isSpeaking],
  );

  const playAudioQueue = useCallback(async () => {
    console.log(
      `[useVoiceSession] Starting audio playback, queueSize=${audioQueueRef.current.length}`,
    );
    setState((prev) => ({ ...prev, isSpeaking: true }));

    while (audioQueueRef.current.length > 0 && audioContextRef.current) {
      const buffer = audioQueueRef.current.shift()!;
      playedAudioBufferCountRef.current += 1;
      console.log(
        `[useVoiceSession] Playing audio buffer ${playedAudioBufferCountRef.current}, frames=${buffer.length}, remainingQueue=${audioQueueRef.current.length}`,
      );
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);

      await new Promise<void>((resolve) => {
        source.onended = resolve;
        source.start();
      });
    }

    console.log("[useVoiceSession] Audio playback completed");
    setState((prev) => ({ ...prev, isSpeaking: false }));
  }, []);

  const handleEventMessage = useCallback(
    (payload: EventPayload) => {
      switch (payload.event) {
        case "tool_call_start":
          setState((prev) => ({ ...prev, currentTool: payload.data.toolName }));
          break;
        case "tool_call_end":
          setState((prev) => ({ ...prev, currentTool: undefined }));
          break;
        case "session_ended":
          onSessionEnd?.(payload.data);
          break;
      }
    },
    [onSessionEnd],
  );

  const sendBargeIn = useCallback(() => {
    audioQueueRef.current = [];
    setState((prev) => ({ ...prev, isSpeaking: false }));

    wsRef.current?.send(
      JSON.stringify({
        type: "control",
        payload: { action: "barge_in" },
      }),
    );
  }, []);

  const handleError = useCallback((error: Event) => {
    console.error("WebSocket error:", error);
    setState((prev) => ({ ...prev, error: "连接错误" }));
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    state,
    connect,
    disconnect,
    sendBargeIn,
  };
}

// Utility functions
function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

function decodePCMToAudioBuffer(
  pcmData: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 16000,
  numChannels: number = 1
): AudioBuffer {
  const dataInt16 = new Int16Array(pcmData.buffer);
  const frameCount = dataInt16.length / numChannels;
  const audioBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }

  return audioBuffer;
}
