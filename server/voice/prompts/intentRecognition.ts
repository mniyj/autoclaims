import type { SessionState } from "../intents/IntentTypes.js";
import { renderPromptTemplate } from "../../services/aiConfigService.js";

interface PromptContext {
  currentState: SessionState;
  userText: string;
  selectedPolicy?: Record<string, unknown> | null;
  selectedClaim?: Record<string, unknown> | null;
  collectedFields?: Record<string, unknown>;
  missingRequiredFields?: Array<{ fieldId: string; label: string; type: string }>;
  recentHistory?: Array<{ role: string; content: string }>;
  lastUserGoal?: string | null;
  conversationPhase?: string;
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

export function buildIntentRecognitionPrompt(context: PromptContext): string {
  return renderPromptTemplate("voice_intent_recognition", {
    currentState: context.currentState,
    conversationPhase: context.conversationPhase || "idle",
    lastUserGoal: context.lastUserGoal || "unknown",
    selectedPolicy: stringifyJson(context.selectedPolicy),
    selectedClaim: stringifyJson(context.selectedClaim),
    collectedFields: stringifyJson(context.collectedFields),
    missingRequiredFields: stringifyJson(context.missingRequiredFields),
    recentHistory: stringifyJson(context.recentHistory),
    userText: context.userText,
  });
}
