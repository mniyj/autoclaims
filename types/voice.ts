export interface VoiceMessage {
  type: 'audio' | 'text' | 'control' | 'event';
  direction?: 'client_to_server' | 'server_to_client';
  timestamp?: number;
  payload: AudioPayload | TextPayload | ControlPayload | EventPayload;
}

export interface AudioPayload {
  format: 'pcm' | 'opus';
  data: string;
  seq: number;
  isFinal: boolean;
  /** Server-assigned turn identifier. Client drops audio with a mismatched turnId. */
  turnId?: string;
}

export interface TextPayload {
  source: 'stt' | 'llm' | 'system';
  content: string;
  isFinal: boolean;
  confidence?: number;
  turnId?: string;
}

/**
 * Voice turn-taking state shared between client and server.
 * Server is authoritative; client mirrors it via `turn_state` events.
 */
export type TurnState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';

export interface TurnStateEventData {
  state: TurnState;
  turnId: string;
  /** Optional human-readable reason for the transition (e.g. "greeting", "stt_final", "barge_in"). */
  reason?: string;
}

export interface ControlPayload {
  action:
    | 'start'
    | 'stop'
    | 'barge_in'
    | 'pause'
    | 'resume'
    /** Client-announced: TTS audio playback has fully drained on the client. */
    | 'playback_ended'
    /** Client-announced: VAD speech/silence hint (used to adapt end-of-utterance timing). */
    | 'client_vad';
  /** Turn id this control message refers to (for playback_ended / barge_in / client_vad). */
  turnId?: string;
  metadata?: Record<string, any>;
}

export interface EventPayload {
  event:
    | 'session_started'
    | 'session_ended'
    | 'error'
    | 'tool_call_start'
    | 'tool_call_end'
    | 'thinking'
    /** Authoritative turn-state broadcast — single source of truth for both sides. */
    | 'turn_state'
    /** First TTS audio chunk for a turn is about to be sent. */
    | 'speech_start'
    /** Server finished streaming TTS audio for the current turn. */
    | 'speech_end'
    /** NLS stream is being reconnected (backoff in progress). */
    | 'nls_reconnecting'
    /** NLS stream has re-connected and is accepting audio again. */
    | 'nls_ready'
    /**
     * @deprecated replaced by `turn_state → LISTENING, reason: "barge_in"`.
     * Kept in the union for compatibility with old clients during phase 1 rollout.
     */
    | 'barge_in_acknowledged';
  data: any;
}

export interface VoiceSessionConfig {
  sessionId: string;
  wsUrl: string;
  userId: string;
  policyNumber?: string;
}

export interface VoiceSessionState {
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  messages: VoiceChatMessage[];
  currentTool?: string;
  error?: string;
}

export interface VoiceChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isFinal?: boolean;
  confidence?: number;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
  id: string;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

// Slot filling types
export interface SlotDefinition {
  name: string;
  type: 'string' | 'number' | 'date' | 'enum';
  required: boolean;
  description: string;
  enumValues?: string[];
}

export interface ExtractedSlot {
  name: string;
  value: any;
  confidence: number;
}

export interface SlotStore {
  [key: string]: any;
}

// Policy types for voice interaction
export interface VoicePolicyInfo {
  policyNumber: string;
  productName: string;
  policyholderName: string;
  insuredName: string;
  effectiveDate: string;
  expiryDate: string;
  status: string;
}

export interface VoiceClaimInfo {
  claimId: string;
  reportNumber: string;
  status: string;
  statusLabel: string;
  accidentReason: string;
  claimAmount: number;
  approvedAmount?: number;
  submitTime: string;
  nextStep?: string;
}
