import { z } from 'zod';

export enum VoiceSessionState {
  IDLE = 'idle',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  SPEAKING = 'speaking',
  CONFIRMING = 'confirming',
  TOOL_CALLING = 'tool_calling',
  INTERRUPTED = 'interrupted',
  ERROR = 'error',
  ENDED = 'ended'
}

export interface SlotValue {
  value: any;
  confirmed: boolean;
  confidence?: number;
}

export interface ConversationContext {
  currentState: VoiceSessionState;
  currentIntent: string | null;
  slots: Map<string, SlotValue>;
  pendingToolCall: any | null;
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  interruptedContent: string | null;
  lastError?: string;
}

export class VoiceStateMachine {
  private context: ConversationContext;

  constructor() {
    this.context = {
      currentState: VoiceSessionState.IDLE,
      currentIntent: null,
      slots: new Map(),
      pendingToolCall: null,
      conversationHistory: [],
      interruptedContent: null
    };
  }

  getState(): VoiceSessionState {
    return this.context.currentState;
  }

  getContext(): ConversationContext {
    return this.context;
  }

  transition(toState: VoiceSessionState, data?: any): void {
    const validTransitions: Record<VoiceSessionState, VoiceSessionState[]> = {
      [VoiceSessionState.IDLE]: [VoiceSessionState.LISTENING],
      [VoiceSessionState.LISTENING]: [VoiceSessionState.PROCESSING, VoiceSessionState.ENDED, VoiceSessionState.ERROR],
      [VoiceSessionState.PROCESSING]: [VoiceSessionState.SPEAKING, VoiceSessionState.TOOL_CALLING, VoiceSessionState.CONFIRMING, VoiceSessionState.ERROR],
      [VoiceSessionState.SPEAKING]: [VoiceSessionState.LISTENING, VoiceSessionState.INTERRUPTED, VoiceSessionState.ERROR],
      [VoiceSessionState.INTERRUPTED]: [VoiceSessionState.LISTENING, VoiceSessionState.SPEAKING],
      [VoiceSessionState.TOOL_CALLING]: [VoiceSessionState.SPEAKING, VoiceSessionState.ERROR],
      [VoiceSessionState.CONFIRMING]: [VoiceSessionState.TOOL_CALLING, VoiceSessionState.LISTENING, VoiceSessionState.ERROR],
      [VoiceSessionState.ERROR]: [VoiceSessionState.IDLE, VoiceSessionState.LISTENING],
      [VoiceSessionState.ENDED]: [VoiceSessionState.IDLE]
    };

    const allowed = validTransitions[this.context.currentState] || [];
    if (!allowed.includes(toState)) {
      console.warn(`[VoiceStateMachine] Invalid transition: ${this.context.currentState} -> ${toState}`);
      return;
    }

    console.log(`[VoiceStateMachine] ${this.context.currentState} -> ${toState}`);
    this.context.currentState = toState;

    if (toState === VoiceSessionState.INTERRUPTED && data?.interruptedContent) {
      this.context.interruptedContent = data.interruptedContent;
    }
  }

  setIntent(intent: string): void {
    this.context.currentIntent = intent;
  }

  fillSlot(name: string, value: any, confirmed = false, confidence?: number): void {
    this.context.slots.set(name, { value, confirmed, confidence });
  }

  getSlot(name: string): SlotValue | undefined {
    return this.context.slots.get(name);
  }

  getUnconfirmedSlots(): string[] {
    return Array.from(this.context.slots.entries())
      .filter(([_, slot]) => !slot.confirmed)
      .map(([name, _]) => name);
  }

  getMissingSlots(required: string[]): string[] {
    return required.filter(name => !this.context.slots.has(name));
  }

  addToHistory(role: 'user' | 'assistant' | 'system', content: string): void {
    this.context.conversationHistory.push({ role, content });
  }

  getHistory(): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
    return this.context.conversationHistory;
  }

  clearHistory(): void {
    this.context.conversationHistory = [];
  }

  setPendingToolCall(toolCall: any): void {
    this.context.pendingToolCall = toolCall;
  }

  getPendingToolCall(): any | null {
    return this.context.pendingToolCall;
  }

  clearPendingToolCall(): void {
    this.context.pendingToolCall = null;
  }

  setError(error: string): void {
    this.context.lastError = error;
    this.transition(VoiceSessionState.ERROR);
  }

  reset(): void {
    this.context = {
      currentState: VoiceSessionState.IDLE,
      currentIntent: null,
      slots: new Map(),
      pendingToolCall: null,
      conversationHistory: [],
      interruptedContent: null
    };
  }
}
