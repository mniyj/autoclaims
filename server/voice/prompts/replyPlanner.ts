import { renderPromptTemplate } from "../../services/aiConfigService.js";

interface ReplyPlannerInput {
  scene: string;
  userText: string;
  conversationGoal?: string;
  replyStrategy?: string;
  summary?: string;
  acknowledgedFacts?: string[];
  missingFields?: string[];
  nextStep?: string;
  actionSummaries?: string[];
  currentState?: string;
}

export function buildReplyPlannerPrompt(input: ReplyPlannerInput): string {
  return renderPromptTemplate("voice_reply_planner", {
    scene: input.scene,
    currentState: input.currentState || "unknown",
    userText: input.userText,
    conversationGoal: input.conversationGoal || "unknown",
    replyStrategy: input.replyStrategy || "unknown",
    summary: input.summary || "",
    acknowledgedFacts: (input.acknowledgedFacts || []).join("；"),
    missingFields: (input.missingFields || []).join("；"),
    actionSummaries: (input.actionSummaries || []).join("；"),
    nextStep: input.nextStep || "",
  });
}
