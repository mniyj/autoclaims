import type {
  Intent,
  IntentHandlerResult,
} from "../intents/IntentTypes.js";
import { buildReplyPlannerPrompt } from "../prompts/replyPlanner.js";
import type { VoiceSessionContext } from "../state/VoiceSessionContext.js";
import {
  summarizeCoverageForVoice,
  summarizeMaterialsForVoice,
  summarizeMissingMaterialsForVoice,
  summarizeProgressForVoice,
  summarizeSettlementForVoice,
} from "./querySummaryBuilder.js";
import { invokeAICapability } from "../../services/aiRuntime.js";

export interface ActionExecutionSummary {
  type: string;
  success: boolean;
  data?: any;
  error?: string;
  summary?: string;
}

function normalizeFactLabel(fieldId: string): string {
  const labels: Record<string, string> = {
    accident_date: "出险时间",
    accident_time: "出险时间",
    accident_reason: "原因",
    accident_location: "地点",
    hospital_name: "医院",
    claim_amount: "金额",
    treatment_type: "治疗方式",
    discharge_date: "出院时间",
  };
  return labels[fieldId] || fieldId;
}

function normalizeMissingField(fieldId: string): string {
  const prompts: Record<string, string> = {
    accident_date: "出险时间",
    accident_time: "具体时间",
    accident_reason: "出险原因",
    accident_location: "出险地点",
    hospital_name: "就诊医院",
    claim_amount: "大概金额",
    treatment_type: "治疗方式",
    discharge_date: "出院日期",
  };
  return prompts[fieldId] || "关键信息";
}

function buildFallbackReply(input: {
  intent: Intent;
  result: IntentHandlerResult;
  context: VoiceSessionContext;
  actionResults: ActionExecutionSummary[];
  userText: string;
}): string {
  const { intent, result, context, actionResults } = input;
  const summaries = actionResults
    .map((item) => item.summary)
    .filter((item): item is string => Boolean(item));

  if (result.responseData?.scene === "repeat_last") {
    return context.getLastSummary() || context.getLastAssistantQuestion() || "我再说一遍，您直接说下您现在想办报案还是查进度。";
  }

  if (summaries.length > 0) {
    if (result.responseData?.nextStep) {
      return `${summaries.join("")}${result.responseData.nextStep}`;
    }
    return summaries.join("");
  }

  if (result.responseData?.scene === "policy_selected") {
    return `好，我已经帮您锁定这张保单。您直接说下发生了什么，我边听边帮您记。`;
  }

  if (result.responseData?.scene === "start_claim") {
    return result.responseData?.summary || result.response;
  }

  if (result.responseData?.scene === "collecting_fields") {
    const facts = result.responseData.acknowledgedFacts || [];
    const missing = result.responseData.missingFields || [];
    if (facts.length > 0 && missing.length > 0) {
      return `我先记下：${facts.join("，")}。还差${normalizeMissingField(missing[0])}，您接着说一下。`;
    }
    if (facts.length > 0) {
      return `我记下了：${facts.join("，")}。`;
    }
    if (missing.length > 0) {
      return `还差${normalizeMissingField(missing[0])}，您接着说一下。`;
    }
  }

  if (result.responseData?.scene === "confirm_submission") {
    return result.responseData.summary
      ? `我先帮您确认一下，${result.responseData.summary}。如果这些都对，您说确认提交就行。`
      : "信息已经差不多齐了。没问题的话，您说确认提交就行。";
  }

  if (result.responseData?.scene === "modify_info") {
    return result.responseData.summary || result.response;
  }

  if (intent.replyStrategy === "ack_then_answer" && result.responseData?.summary) {
    return result.responseData.summary;
  }

  return result.response;
}

async function maybeGenerateWithModel(input: {
  intent: Intent;
  result: IntentHandlerResult;
  context: VoiceSessionContext;
  actionResults: ActionExecutionSummary[];
  userText: string;
}): Promise<string | null> {
  const actionSummaries = input.actionResults
    .map((item) => item.summary)
    .filter((item): item is string => Boolean(item));

  const prompt = buildReplyPlannerPrompt({
    scene: input.result.responseData?.scene || "default",
    userText: input.userText,
    conversationGoal: input.intent.conversationGoal,
    replyStrategy: input.intent.replyStrategy,
    summary: input.result.responseData?.summary || input.result.response,
    acknowledgedFacts: input.result.responseData?.acknowledgedFacts || [],
    missingFields: input.result.responseData?.missingFields || [],
    nextStep: input.result.responseData?.nextStep,
    actionSummaries,
    currentState: input.context.getCurrentState(),
  });

  try {
    const { response: result } = await invokeAICapability({
      capabilityId: "voice.reply_planner",
      request: {
        contents: { parts: [{ text: prompt }] },
      },
      meta: {
        sourceApp: "voice",
        module: "voiceReplyBuilder",
        operation: "build_reply",
        context: {
          scene: input.result.responseData?.scene || "default",
          userText: input.userText,
          currentState: input.context.getCurrentState(),
        },
      },
    });
    const text = (result.text || "").trim();
    return text || null;
  } catch (error) {
    console.warn("[VoiceReplyBuilder] Reply planning failed:", error);
    return null;
  }
}

export class VoiceReplyBuilder {
  async buildReply(input: {
    intent: Intent;
    result: IntentHandlerResult;
    context: VoiceSessionContext;
    actionResults: ActionExecutionSummary[];
    userText: string;
  }): Promise<string> {
    const generated = await maybeGenerateWithModel(input);
    return generated || buildFallbackReply(input);
  }
}

export function buildActionSummary(type: string, data?: any, error?: string): string {
  if (error) {
    return error;
  }

  switch (type) {
    case "ANNOUNCE_CLAIM_PROGRESS":
      return summarizeProgressForVoice(data || {});
    case "LOAD_CLAIM_MATERIALS":
      return summarizeMaterialsForVoice(data || {});
    case "LOAD_MISSING_CLAIM_MATERIALS":
      return summarizeMissingMaterialsForVoice(data || {});
    case "LOAD_COVERAGE_INFO":
      return summarizeCoverageForVoice(data || {});
    case "LOAD_SETTLEMENT_ESTIMATE":
      return summarizeSettlementForVoice(data || {});
    case "SUBMIT_CLAIM":
      if (data?.reportNumber) {
        const materials = Array.isArray(data.requiredMaterials)
          ? data.requiredMaterials.map((item: any) => item.name).filter(Boolean).slice(0, 3).join("、")
          : "";
        return `报案已经提交成功，报案号是${data.reportNumber}。${materials ? `接下来您先准备${materials}。` : ""}`;
      }
      return "报案已经提交成功。";
    case "LOAD_POLICIES":
      if (data?.mode === "missing") {
        return "我这边暂时没有查到可用保单，您可以稍后再试，或者联系人工客服。";
      }
      if (data?.mode === "auto_selected" && data.selectedPolicy) {
        return `我先帮您选好了${data.selectedPolicy.productName}这张保单。您直接说下发生了什么，我边听边帮您记。`;
      }
      if (data?.mode === "selection" && Array.isArray(data.policies)) {
        const options = data.policies
          .slice(0, 3)
          .map((item: any) => `第${item.index}张是${item.productName}`)
          .join("，");
        return `我查到${data.policies.length}张保单。${options}。您告诉我要哪一张就行。`;
      }
      return "保单已经查到了。";
    case "LOAD_CLAIMS":
      if (data?.mode === "missing") {
        return "我这边还没有查到您可查询的理赔案件。";
      }
      if (data?.mode === "selection" && Array.isArray(data.claims)) {
        const options = data.claims
          .slice(0, 3)
          .map((item: any) => `第${item.index}个是案件${item.claimId}`)
          .join("，");
        return `我查到${data.claims.length}个案件。${options}。您说第几个就行。`;
      }
      return "";
    case "LOAD_INTAKE_CONFIG":
      if (data?.mode === "missing_config") {
        return "这张保单暂时没有配置语音报案字段，建议您改用在线填单或者联系人工处理。";
      }
      return "";
    default:
      return "";
  }
}

export function buildAcknowledgedFacts(collectedFields: Record<string, any>): string[] {
  return Object.entries(collectedFields)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 4)
    .map(([key, value]) => `${normalizeFactLabel(key)}${value}`);
}
