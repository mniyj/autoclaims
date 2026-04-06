import React from "react";
import type { PreExistingAssessmentView } from "../../utils/claimReviewPresentation";

interface PreExistingAssessmentSummaryCardProps {
  assessment: PreExistingAssessmentView | null | undefined;
  compact?: boolean;
}

function getResultMeta(assessment: PreExistingAssessmentView) {
  const result = assessment.result;
  const action = assessment.uncertainResolution?.action;
  if (result === "YES") {
    return {
      label: "已判定既往症",
      tone: "border-rose-200 bg-rose-50 text-rose-700",
      factValue: "true",
      detail: "自动判断已确认属于既往症。",
    };
  }
  if (result === "NO") {
    return {
      label: "已判定非既往症",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      factValue: "false",
      detail: "自动判断已确认不属于既往症。",
    };
  }
  if (result === "SKIPPED") {
    return {
      label: "未执行自动判断",
      tone: "border-slate-200 bg-slate-50 text-slate-700",
      factValue: "未执行",
      detail: "本案未进入既往症自动判断流程。",
    };
  }
  if (action === "ASSUME_FALSE") {
    return {
      label: "按非既往症处理",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      factValue: "false",
      detail: "自动判断未确定，但已命中策略并按非既往症处理。",
    };
  }
  return {
    label: "待人工复核",
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    factValue: "null",
    detail: "自动判断未确定，当前按人工复核处理。",
  };
}

function getActionLabel(action?: string | null) {
  if (action === "ASSUME_FALSE") return "按非既往症处理";
  if (action === "MANUAL_REVIEW") return "转人工复核";
  return "未配置";
}

function getEffectiveFactValue(
  assessment: PreExistingAssessmentView,
  fallbackFactValue: string,
) {
  if (
    assessment.result === "UNCERTAIN" &&
    assessment.uncertainResolution?.action === "ASSUME_FALSE"
  ) {
    return "false";
  }
  return fallbackFactValue;
}

function getMatchedConditionLabel(assessment: PreExistingAssessmentView) {
  const matchedRule = assessment.uncertainResolution?.matchedRule;
  if (!matchedRule) return "默认策略";
  const parts = [
    matchedRule.when?.product_line,
    matchedRule.when?.claim_scenario,
    matchedRule.when?.max_claim_amount != null
      ? `<=${matchedRule.when.max_claim_amount}`
      : null,
  ].filter(Boolean);
  return parts.join(" + ") || "细分规则";
}

const PreExistingAssessmentSummaryCard: React.FC<
  PreExistingAssessmentSummaryCardProps
> = ({ assessment, compact = false }) => {
  if (!assessment) return null;

  const meta = getResultMeta(assessment);
  const effectiveFactValue = getEffectiveFactValue(assessment, meta.factValue);
  const autoDecisionSummary =
    assessment.result === "UNCERTAIN"
      ? `自动判断未确定${
          typeof assessment.confidence === "number"
            ? `（${(assessment.confidence * 100).toFixed(0)}%）`
            : ""
        }`
      : assessment.result === "YES"
        ? "自动判断结果：既往症"
        : assessment.result === "NO"
          ? "自动判断结果：非既往症"
          : "自动判断结果：未执行";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900">既往症判断策略</h3>
          <p className="mt-1 text-sm text-gray-500">
            展示本案既往症自动判断结果，以及最终命中的落地策略。
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-sm font-medium ${meta.tone}`}
        >
          {meta.label}
        </span>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "md:grid-cols-2" : "xl:grid-cols-4 md:grid-cols-2"}`}>
        <InfoField label="自动判断" value={autoDecisionSummary} />
        <InfoField
          label="最终事实值"
          value={`claim.pre_existing_condition = ${effectiveFactValue}`}
        />
        <InfoField
          label="未确定处理"
          value={
            assessment.result === "UNCERTAIN"
              ? getActionLabel(assessment.uncertainResolution?.action)
              : "不适用"
          }
        />
        <InfoField
          label="命中条件"
          value={
            assessment.result === "UNCERTAIN"
              ? getMatchedConditionLabel(assessment)
              : "不适用"
          }
        />
        <InfoField
          label="当前上下文"
          value={
            [
              assessment.uncertainResolution?.productLine,
              assessment.uncertainResolution?.claimScenario,
              assessment.uncertainResolution?.claimAmount != null
                ? `报案金额 ${assessment.uncertainResolution.claimAmount}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || "未提供"
          }
        />
      </div>

      {(meta.detail || assessment.reasoning) && (
        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div>{meta.detail}</div>
          {assessment.reasoning && assessment.reasoning !== meta.detail && (
            <div className="mt-1 text-slate-600">{assessment.reasoning}</div>
          )}
        </div>
      )}
    </div>
  );
};

const InfoField: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="rounded-lg bg-slate-50 px-4 py-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
  </div>
);

export default PreExistingAssessmentSummaryCard;
