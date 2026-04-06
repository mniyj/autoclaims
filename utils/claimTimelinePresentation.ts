import type {
  ClaimProcessTimeline,
  ClaimStageStatus,
  ClaimTimelineEvent,
} from "../types";
import type { SmartReviewResultView } from "./claimReviewPresentation";

export interface ClaimTimelineStageView {
  key:
    | "intake"
    | "parse"
    | "liability"
    | "fact_assessment"
    | "settlement"
    | "final_decision";
  label: string;
  status: ClaimStageStatus;
  completedAt?: string;
  startedAt?: string;
  completedBy?: "system" | "manual";
  summary?: string;
  blockingReason?: string;
  toneClass: string;
  dotClass: string;
  lineClass: string;
  methodLabel: string;
  displayTime: string;
}

const EVENT_GROUP_ORDER = [
  "intake",
  "parse",
  "liability",
  "assessment",
  "other",
] as const;

function formatDateTime(timestamp?: string) {
  if (!timestamp) return "待处理";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "待处理";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStageTone(status: ClaimStageStatus) {
  switch (status) {
    case "completed":
      return {
        toneClass: "border-green-200 bg-green-50 text-green-700",
        dotClass: "bg-green-500 border-green-500",
        lineClass: "bg-green-500",
      };
    case "manual_completed":
      return {
        toneClass: "border-orange-200 bg-orange-50 text-orange-700",
        dotClass: "bg-orange-500 border-orange-500",
        lineClass: "bg-orange-500",
      };
    case "failed":
      return {
        toneClass: "border-red-200 bg-red-50 text-red-700",
        dotClass: "bg-red-500 border-red-500",
        lineClass: "bg-red-500",
      };
    case "processing":
      return {
        toneClass: "border-blue-200 bg-blue-50 text-blue-700",
        dotClass: "bg-blue-500 border-blue-500",
        lineClass: "bg-blue-500",
      };
    case "awaiting_human":
      return {
        toneClass: "border-purple-200 bg-purple-50 text-purple-700",
        dotClass: "bg-purple-500 border-purple-500",
        lineClass: "bg-purple-500",
      };
    default:
      return {
        toneClass: "border-gray-200 bg-gray-50 text-gray-600",
        dotClass: "bg-white border-gray-300",
        lineClass: "bg-gray-200",
      };
  }
}

function toStageView(
  stage: Omit<
    ClaimTimelineStageView,
    "toneClass" | "dotClass" | "lineClass" | "methodLabel" | "displayTime"
  >,
) {
  const tone = getStageTone(stage.status);
  return {
    ...stage,
    ...tone,
    methodLabel:
      stage.status === "awaiting_human"
        ? "等待人工处理"
        : stage.completedBy === "manual"
          ? "人工处理"
          : stage.completedBy === "system"
            ? "系统自动"
            : "待处理",
    displayTime: formatDateTime(stage.completedAt || stage.startedAt),
  };
}

function isFinished(status?: ClaimStageStatus) {
  return status === "completed" || status === "manual_completed";
}

export function getStageViews(
  processTimeline: ClaimProcessTimeline | null,
  reviewResult?: SmartReviewResultView | null,
): ClaimTimelineStageView[] {
  if (!processTimeline && !reviewResult) return [];

  const stageMap = new Map(
    (processTimeline?.stages || []).map((stage) => [stage.key, stage]),
  );
  const intake = stageMap.get("intake");
  const parse = stageMap.get("parse");
  const liability = stageMap.get("liability");
  const assessment = stageMap.get("assessment");

  const liabilityDecision = reviewResult?.liabilityDecision;
  const assessmentDecision = reviewResult?.assessmentDecision;
  const settlementDecision = reviewResult?.settlementDecision;
  const finalDecision = reviewResult?.decision;

  const intakeView = toStageView({
    key: "intake",
    label: "受理",
    status: intake?.status || "pending",
    completedAt: intake?.completedAt,
    startedAt: intake?.startedAt,
    completedBy: intake?.completedBy,
    summary: intake?.summary || "待受理完成",
    blockingReason: intake?.blockingReason,
  });

  const parseView = toStageView({
    key: "parse",
    label: "解析 / OCR",
    status:
      intake && !isFinished(intake.status)
        ? "pending"
        : parse?.status || "pending",
    completedAt:
      intake && !isFinished(intake.status) ? undefined : parse?.completedAt,
    startedAt:
      intake && !isFinished(intake.status) ? undefined : parse?.startedAt,
    completedBy:
      intake && !isFinished(intake.status) ? undefined : parse?.completedBy,
    summary:
      intake && !isFinished(intake.status)
        ? "受理完成后进入解析"
        : parse?.summary || "待解析材料",
    blockingReason:
      intake && !isFinished(intake.status)
        ? intake.blockingReason || "待受理完成"
        : parse?.blockingReason,
  });

  const liabilityBlocked = !isFinished(parseView.status);
  const liabilityView = toStageView({
    key: "liability",
    label: "责任判定",
    status: liabilityBlocked ? "pending" : liability?.status || "pending",
    completedAt: liabilityBlocked ? undefined : liability?.completedAt,
    startedAt: liabilityBlocked ? undefined : liability?.startedAt,
    completedBy: liabilityBlocked ? undefined : liability?.completedBy,
    summary: liabilityBlocked
      ? "解析完成后进入责任判定"
      : liabilityDecision === "ACCEPT"
        ? "责任已确认"
        : liabilityDecision === "REJECT"
          ? "责任不成立"
          : liability?.summary || "待完成责任判定",
    blockingReason: liabilityBlocked
      ? parseView.blockingReason || "待解析完成"
      : liability?.blockingReason,
  });

  const factBlocked =
    !isFinished(liabilityView.status) || liabilityDecision === "REJECT";
  const factStatus = factBlocked
    ? "pending"
    : assessment?.status === "manual_completed"
      ? "manual_completed"
      : assessmentDecision === "UNABLE_TO_ASSESS"
        ? "failed"
        : assessment?.status === "processing"
          ? "processing"
          : ["ASSESSED", "PARTIAL_ASSESSED"].includes(assessmentDecision || "")
            ? "completed"
            : assessment?.status || "pending";
  const factView = toStageView({
    key: "fact_assessment",
    label: "事实核定",
    status: factStatus,
    completedAt: factBlocked ? undefined : assessment?.completedAt,
    startedAt: factBlocked ? undefined : assessment?.startedAt,
    completedBy: factBlocked ? undefined : assessment?.completedBy,
    summary: factBlocked
      ? liabilityDecision === "REJECT"
        ? "责任未通过，不进入事实核定"
        : "责任判定完成后进入事实核定"
      : assessmentDecision === "PARTIAL_ASSESSED"
        ? "事实已部分核定"
        : assessmentDecision === "ASSESSED"
          ? "事实已核定"
          : assessmentDecision === "UNABLE_TO_ASSESS"
            ? "事实无法核定"
            : assessment?.summary || "待完成事实核定",
    blockingReason: factBlocked
      ? liabilityDecision === "REJECT"
        ? "责任不成立"
        : liabilityView.blockingReason || "待责任判定完成"
      : assessment?.blockingReason,
  });

  const settlementBlocked = !isFinished(factView.status);
  const settlementStatus = settlementBlocked
    ? "pending"
    : settlementDecision === "MANUAL_REVIEW"
      ? "processing"
      : ["PAY", "PARTIAL_PAY", "ZERO_PAY"].includes(settlementDecision || "")
        ? "completed"
        : "pending";
  const settlementView = toStageView({
    key: "settlement",
    label: "赔付计算",
    status: settlementStatus,
    completedAt: settlementBlocked ? undefined : assessment?.completedAt,
    startedAt: settlementBlocked ? undefined : assessment?.startedAt,
    completedBy: settlementBlocked ? undefined : assessment?.completedBy,
    summary: settlementBlocked
      ? factView.status === "failed"
        ? "事实核定失败，暂不进入赔付计算"
        : "事实核定完成后进入赔付计算"
      : settlementDecision === "PAY"
        ? "已生成赔付结果"
        : settlementDecision === "PARTIAL_PAY"
          ? "已生成部分赔付结果"
          : settlementDecision === "ZERO_PAY"
            ? "试算结果为不赔付"
            : "待完成赔付计算",
    blockingReason: settlementBlocked
      ? factView.blockingReason || "待事实核定完成"
      : undefined,
  });

  const finalBlocked = !isFinished(settlementView.status);
  const finalStatus = finalBlocked
    ? "pending"
    : finalDecision === "MANUAL_REVIEW"
      ? "processing"
      : ["APPROVE", "REJECT"].includes(finalDecision || "")
        ? "completed"
        : "pending";
  const finalView = toStageView({
    key: "final_decision",
    label: "案件结论",
    status: finalStatus,
    completedAt: finalBlocked ? undefined : settlementView.completedAt,
    startedAt: finalBlocked ? undefined : settlementView.startedAt,
    completedBy: finalBlocked ? undefined : settlementView.completedBy,
    summary: finalBlocked
      ? "赔付计算完成后生成案件结论"
      : finalDecision === "APPROVE"
        ? "案件建议通过"
        : finalDecision === "REJECT"
          ? "案件建议拒赔"
          : "待人工复核形成案件结论",
    blockingReason: finalBlocked
      ? settlementView.blockingReason || "待赔付计算完成"
      : undefined,
  });

  return [
    intakeView,
    parseView,
    liabilityView,
    factView,
    settlementView,
    finalView,
  ];
}

function getEventGroupKey(event: ClaimTimelineEvent) {
  switch (event.type) {
    case "CLAIM_REPORTED":
    case "MATERIAL_UPLOADED":
    case "MATERIAL_COMPLETENESS_PASSED":
    case "MATERIAL_COMPLETENESS_FAILED":
      return "intake";
    case "OCR_STARTED":
    case "OCR_COMPLETED":
    case "STRUCTURED_EXTRACTION_COMPLETED":
      return "parse";
    case "LIABILITY_AUTO_COMPLETED":
    case "LIABILITY_MANUAL_COMPLETED":
    case "MANUAL_REVIEW_REQUESTED":
      return "liability";
    case "ASSESSMENT_AUTO_COMPLETED":
    case "ASSESSMENT_MANUAL_COMPLETED":
      return "assessment";
    case "INTERVENTION_CREATED":
    case "INTERVENTION_STATE_CHANGED":
    case "INTERVENTION_RESOLVED":
    case "ADJUSTER_OVERRIDE_APPLIED":
    case "REUPLOAD_REQUESTED":
    case "REUPLOAD_RECEIVED":
    case "RE_EXTRACTION_TRIGGERED":
    case "MANUAL_DECISION_MADE":
    case "ROLLBACK_INITIATED": {
      const stageKey = (event.details as Record<string, unknown>)?.stageKey;
      if (stageKey === "liability") return "liability";
      if (stageKey === "assessment") return "assessment";
      if (stageKey === "parse") return "parse";
      return "other";
    }
    default:
      return "other";
  }
}

function getEventGroupLabel(groupKey: string) {
  switch (groupKey) {
    case "intake":
      return "受理轨迹";
    case "parse":
      return "解析 / OCR 轨迹";
    case "liability":
      return "责任判定轨迹";
    case "assessment":
      return "事实核定 / 赔付计算轨迹";
    default:
      return "其他轨迹";
  }
}

export function groupTimelineEvents(
  processTimeline: ClaimProcessTimeline | null,
) {
  if (!processTimeline) return [];
  const events = Array.isArray(processTimeline.events)
    ? processTimeline.events
    : [];
  const groups = EVENT_GROUP_ORDER.map((groupKey) => {
    const groupedEvents = events.filter(
      (event) => getEventGroupKey(event) === groupKey,
    );
    return {
      key: groupKey,
      label: getEventGroupLabel(groupKey),
      events: groupedEvents,
    };
  }).filter((group) => group.events.length > 0);

  return groups;
}

export function formatTimelineEventTime(timestamp: string) {
  return formatDateTime(timestamp);
}

export function getTimelineEventBadge(event: ClaimTimelineEvent) {
  if (event.actorType === "manual") return "bg-orange-100 text-orange-700";
  if (event.actorType === "customer") return "bg-slate-100 text-slate-700";
  if (event.success) return "bg-indigo-100 text-indigo-700";
  return "bg-red-100 text-red-700";
}

export function getTimelineEventActorLabel(event: ClaimTimelineEvent) {
  if (event.actorType === "manual") return event.actorName || "人工处理";
  if (event.actorType === "customer") return event.actorName || "用户提交";
  return event.actorName || "系统处理";
}
