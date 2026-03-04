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
}

export interface TextPayload {
  source: 'stt' | 'llm' | 'system';
  content: string;
  isFinal: boolean;
  confidence?: number;
}

export interface ControlPayload {
  action: 'start' | 'stop' | 'barge_in' | 'pause' | 'resume';
  metadata?: Record<string, any>;
}

export interface EventPayload {
  event: 'session_started' | 'session_ended' | 'error' | 'tool_call_start' | 'tool_call_end' | 'thinking' | 'barge_in_acknowledged';
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
