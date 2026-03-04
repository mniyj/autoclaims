import { useState, useRef, useCallback, useEffect } from 'react';
import type { 
  VoiceMessage, 
  VoiceSessionState, 
  VoiceChatMessage,
  TextPayload,
  AudioPayload,
  EventPayload 
} from '../types/voice';

interface UseVoiceSessionProps {
  sessionId: string;
  wsUrl: string;
  onSessionEnd?: (summary: any) => void;
}

interface UseVoiceSessionReturn {
  state: VoiceSessionState;
  connect: () => Promise<void>;
  disconnect: () => void;
  startListening: () => void;
  stopListening: () => void;
  sendBargeIn: () => void;
}

export function useVoiceSession({ 
  sessionId, 
  wsUrl, 
  onSessionEnd 
}: UseVoiceSessionProps): UseVoiceSessionReturn {
  const [state, setState] = useState<VoiceSessionState>({
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    transcript: '',
    messages: []
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);

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
          noiseSuppression: true
        }
      });

      // Connect WebSocket
      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.binaryType = 'arraybuffer';

      wsRef.current.onopen = () => {
        setState(prev => ({ ...prev, isConnected: true }));
      };

      wsRef.current.onmessage = handleServerMessage;
      wsRef.current.onerror = handleError;
      wsRef.current.onclose = () => {
        setState(prev => ({ 
          ...prev, 
          isConnected: false,
          isListening: false 
        }));
      };

    } catch (error) {
      console.error('Failed to connect:', error);
      setState(prev => ({ 
        ...prev, 
        error: '连接失败，请检查麦克风权限'
      }));
    }
  }, [wsUrl]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  }, []);

  const handleServerMessage = useCallback((event: MessageEvent) => {
    const message: VoiceMessage = JSON.parse(event.data);

    switch (message.type) {
      case 'text':
        handleTextMessage(message.payload as TextPayload);
        break;
      case 'audio':
        handleAudioMessage(message.payload as AudioPayload);
        break;
      case 'event':
        handleEventMessage(message.payload as EventPayload);
        break;
    }
  }, []);

  const handleTextMessage = useCallback((payload: TextPayload) => {
    if (payload.source === 'stt') {
      setState(prev => ({ 
        ...prev, 
        transcript: payload.content 
      }));
    } else if (payload.source === 'llm') {
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, {
          role: 'assistant',
          content: payload.content,
          timestamp: Date.now()
        }]
      }));
    }
  }, []);

  const handleAudioMessage = useCallback(async (payload: AudioPayload) => {
    if (!audioContextRef.current) return;
    
    const audioData = base64ToArrayBuffer(payload.data);
    const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
    audioQueueRef.current.push(audioBuffer);

    if (!state.isSpeaking) {
      playAudioQueue();
    }
  }, [state.isSpeaking]);

  const playAudioQueue = useCallback(async () => {
    setState(prev => ({ ...prev, isSpeaking: true }));

    while (audioQueueRef.current.length > 0 && audioContextRef.current) {
      const buffer = audioQueueRef.current.shift()!;
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      
      await new Promise<void>(resolve => {
        source.onended = resolve;
        source.start();
      });
    }

    setState(prev => ({ ...prev, isSpeaking: false }));
  }, []);

  const handleEventMessage = useCallback((payload: EventPayload) => {
    switch (payload.event) {
      case 'tool_call_start':
        setState(prev => ({ ...prev, currentTool: payload.data.toolName }));
        break;
      case 'tool_call_end':
        setState(prev => ({ ...prev, currentTool: undefined }));
        break;
      case 'session_ended':
        onSessionEnd?.(payload.data);
        break;
    }
  }, [onSessionEnd]);

  const startListening = useCallback(() => {
    if (!audioContextRef.current || !mediaStreamRef.current) return;

    const ctx = audioContextRef.current;
    const stream = mediaStreamRef.current;
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      if (!state.isListening) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = floatTo16BitPCM(inputData);
      
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'audio',
          payload: {
            data: arrayBufferToBase64(pcmData),
            seq: Date.now(),
            isFinal: false
          }
        }));
      }
    };

    source.connect(processor);
    processor.connect(ctx.destination);
    processorRef.current = processor;

    setState(prev => ({ ...prev, isListening: true }));
  }, [state.isListening]);

  const stopListening = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
    }
    setState(prev => ({ ...prev, isListening: false }));
  }, []);

  const sendBargeIn = useCallback(() => {
    audioQueueRef.current = [];
    setState(prev => ({ ...prev, isSpeaking: false }));
    
    wsRef.current?.send(JSON.stringify({
      type: 'control',
      payload: { action: 'barge_in' }
    }));
  }, []);

  const handleError = useCallback((error: Event) => {
    console.error('WebSocket error:', error);
    setState(prev => ({ ...prev, error: '连接错误' }));
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
    startListening,
    stopListening,
    sendBargeIn
  };
}

// Utility functions
function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
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
