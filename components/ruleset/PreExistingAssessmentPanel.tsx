import React from "react";
import type { AICapabilityDefinition, AIPromptTemplate } from "../../types";
import type {
  PreExistingAssessmentTrace,
  ValidationSimulationResult,
} from "./workbenchUtils";

interface PreExistingAIConfigSummary {
  capability: Pick<
    AICapabilityDefinition,
    | "id"
    | "name"
    | "currentProvider"
    | "currentModel"
    | "promptSourceType"
    | "promptTemplateId"
    | "secondaryPromptTemplateId"
  >;
  promptTemplate: Pick<AIPromptTemplate, "id" | "name" | "description"> | null;
  secondaryPromptTemplate:
    | Pick<AIPromptTemplate, "id" | "name" | "description">
    | null;
}

interface PreExistingAssessmentPanelProps {
  assessment: PreExistingAssessmentTrace | null;
  result: ValidationSimulationResult;
  rulesetId: string;
  productCode: string;
  aiConfigSummary?: PreExistingAIConfigSummary | null;
}

function getResultTone(result?: PreExistingAssessmentTrace["result"]) {
  if (result === "YES") return "bg-rose-50 text-rose-700 border-rose-200";
  if (result === "NO") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (result === "SKIPPED") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function getResultLabel(result?: PreExistingAssessmentTrace["result"]) {
  switch (result) {
    case "YES":
      return "判断为既往症";
    case "NO":
      return "判断为非既往症";
    case "SKIPPED":
      return "未执行自动判断";
    default:
      return "结果不确定";
  }
}

function getUncertainActionLabel(action?: string | null) {
  if (action === "ASSUME_FALSE") return "按非既往症处理";
  if (action === "MANUAL_REVIEW") return "转人工复核";
  return "未配置";
}

const cardClass = "rounded-2xl border border-gray-200 bg-white p-5";

function openAIConfigPreset(preset: {
  activeTab: "bindings" | "templates";
  capabilityId?: string;
  templateId?: string;
  returnNavigation?: {
    view: "ruleset_management";
    rulesetId: string;
    productCode: string;
    targetView: "validation";
  };
}) {
  window.sessionStorage.setItem(
    "ai_config_center_preset",
    JSON.stringify(preset),
  );
  window.dispatchEvent(
    new CustomEvent("app:navigate", {
      detail: { view: "ai_config_center" },
    }),
  );
}

const PreExistingAssessmentPanel: React.FC<PreExistingAssessmentPanelProps> = ({
  assessment,
  result,
  rulesetId,
  productCode,
  aiConfigSummary,
}) => {
  if (!assessment) return null;

  const relatedRules = result.matchedRules.filter(
    (item) =>
      item.fields.includes("claim.pre_existing_condition") ||
      /既往症/.test(item.ruleName) ||
      /PRE_EXISTING/.test(item.effect),
  );
  const relatedManualReasons = result.manualReviewReasons.filter(
    (item) => /既往症|PRE_EXISTING/i.test(item.code) || /既往症/.test(item.message),
  );
  const expectedImpact =
    assessment.result === "YES"
      ? "预期会把 claim.pre_existing_condition 置为 true，并触发既往症免责拒赔规则。"
      : assessment.result === "NO"
        ? "预期会把 claim.pre_existing_condition 置为 false，不触发既往症免责，继续执行其他责任规则。"
        : assessment.result === "UNCERTAIN"
          ? "预期会把 claim.pre_existing_condition 置为 null，并由免责事实缺失规则转人工复核。"
          : "当前产品线或输入状态下未执行既往症自动判断。";
  const historyStep = assessment.steps?.history;
  const timeStep = assessment.steps?.timeLogic;
  const aiStep = assessment.steps?.ai;
  const synthesis = assessment.steps?.synthesis;
  const uncertainResolution = assessment.uncertainResolution;
  const effectiveFactValue =
    assessment.result === "YES"
      ? "true"
      : assessment.result === "NO"
        ? "false"
        : assessment.result === "UNCERTAIN" &&
            uncertainResolution?.action === "ASSUME_FALSE"
          ? "false"
          : assessment.result === "SKIPPED"
            ? "未执行"
            : "null";

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">既往症判断链路</h3>
          <p className="mt-1 text-sm text-gray-500">
            展示既往史文本、时间逻辑、AI 补判与最终三态事实，便于维护免责规则。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              openAIConfigPreset({
                activeTab: "bindings",
                capabilityId: "admin.claim.pre_existing_assessment",
                returnNavigation: {
                  view: "ruleset_management",
                  rulesetId,
                  productCode,
                  targetView: "validation",
                },
              })
            }
            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
          >
            查看 AI 能力绑定
          </button>
          <button
            type="button"
            onClick={() =>
              openAIConfigPreset({
                activeTab: "templates",
                templateId: "pre_existing_condition_assessment",
                returnNavigation: {
                  view: "ruleset_management",
                  rulesetId,
                  productCode,
                  targetView: "validation",
                },
              })
            }
            className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
          >
            查看 Prompt 模板
          </button>
          <div
            className={`rounded-full border px-3 py-1 text-sm font-medium ${getResultTone(
              assessment.result,
            )}`}
          >
            {getResultLabel(assessment.result)}
            {typeof assessment.confidence === "number"
              ? ` · 置信度 ${(assessment.confidence * 100).toFixed(0)}%`
              : ""}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">输入事实</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <InfoField
                label="既往史原文"
                value={assessment.input?.pastMedicalHistory || assessment.historyText || "未提供"}
              />
              <InfoField
                label="当前诊断"
                value={assessment.input?.diagnosis || "未提供"}
              />
              <InfoField
                label="诊断名称列表"
                value={
                  Array.isArray(assessment.input?.diagnosisNames)
                    ? assessment.input?.diagnosisNames.join("、")
                    : assessment.input?.diagnosisNames || "未提供"
                }
              />
              <InfoField
                label="首诊日期"
                value={assessment.input?.firstDiagnosisDate || "未提供"}
              />
              <InfoField
                label="保单生效日"
                value={assessment.input?.policyEffectiveDate || "未提供"}
              />
              <InfoField
                label="等待期(天)"
                value={
                  assessment.input?.waitingPeriodDays != null
                    ? String(assessment.input.waitingPeriodDays)
                    : "未提供"
                }
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">生成事实</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <InfoField
                label="claim.pre_existing_condition"
                value={effectiveFactValue}
              />
              <InfoField
                label="claim.pre_existing_condition_confidence"
                value={
                  typeof assessment.confidence === "number"
                    ? String(assessment.confidence)
                    : "未提供"
                }
              />
              <InfoField
                label="未确定命中策略"
                value={
                  assessment.result === "UNCERTAIN"
                    ? getUncertainActionLabel(uncertainResolution?.action)
                    : "不适用"
                }
              />
              <InfoField
                label="命中条件"
                value={
                  assessment.result === "UNCERTAIN"
                    ? uncertainResolution?.matchedRule
                      ? [
                          uncertainResolution.matchedRule.when?.product_line,
                          uncertainResolution.matchedRule.when?.claim_scenario,
                          uncertainResolution.matchedRule.when
                            ?.max_claim_amount != null
                            ? `<=${uncertainResolution.matchedRule.when.max_claim_amount}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" + ") || "细分规则"
                      : "默认策略"
                    : "不适用"
                }
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">当前 AI 配置</div>
              <div className="text-xs text-slate-500">
                能力 ID: {aiConfigSummary?.capability.id || "admin.claim.pre_existing_assessment"}
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <InfoField
                label="能力名称"
                value={aiConfigSummary?.capability.name || "既往症评估能力"}
              />
              <InfoField
                label="Prompt 来源"
                value={aiConfigSummary?.capability.promptSourceType || "未加载"}
              />
              <InfoField
                label="当前 Provider"
                value={aiConfigSummary?.capability.currentProvider || "未加载"}
              />
              <InfoField
                label="当前 Model"
                value={aiConfigSummary?.capability.currentModel || "未加载"}
              />
              <InfoField
                label="主模板"
                value={
                  aiConfigSummary?.promptTemplate
                    ? `${aiConfigSummary.promptTemplate.name} (${aiConfigSummary.promptTemplate.id})`
                    : aiConfigSummary?.capability.promptTemplateId || "未绑定"
                }
              />
              <InfoField
                label="辅助模板"
                value={
                  aiConfigSummary?.secondaryPromptTemplate
                    ? `${aiConfigSummary.secondaryPromptTemplate.name} (${aiConfigSummary.secondaryPromptTemplate.id})`
                    : aiConfigSummary?.capability.secondaryPromptTemplateId || "未绑定"
                }
              />
            </div>
            {(aiConfigSummary?.promptTemplate?.description ||
              aiConfigSummary?.secondaryPromptTemplate?.description) && (
              <div className="mt-3 space-y-2 rounded-lg bg-white px-3 py-3 text-sm text-slate-700">
                {aiConfigSummary?.promptTemplate?.description && (
                  <div>
                    主模板说明：{aiConfigSummary.promptTemplate.description}
                  </div>
                )}
                {aiConfigSummary?.secondaryPromptTemplate?.description && (
                  <div>
                    辅助模板说明：{aiConfigSummary.secondaryPromptTemplate.description}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <StepCard
            title="Step A：既往史文本解析"
            badge={historyStep?.certainty || "UNKNOWN"}
            tone={
              historyStep?.vote === "YES"
                ? "danger"
                : historyStep?.vote === "NO"
                  ? "success"
                  : "neutral"
            }
            lines={[
              `原文：${historyStep?.text || "未提供"}`,
              `文本判定：${historyStep?.certainty || "UNKNOWN"}`,
              historyStep?.vote
                ? `投票：${historyStep.vote}（权重 ${historyStep.weight || 0}）`
                : "未投票，交由后续步骤处理",
            ]}
          />
          <StepCard
            title="Step B：时间逻辑判断"
            badge={timeStep?.verdict || "UNKNOWN"}
            tone={
              timeStep?.vote === "YES"
                ? "danger"
                : timeStep?.vote === "NO"
                  ? "success"
                  : "neutral"
            }
            lines={[
              `首诊日期：${timeStep?.firstDiagnosisDate || "未提供"}`,
              `结论：${timeStep?.reason || "未执行"}`,
              timeStep?.vote
                ? `投票：${timeStep.vote}（权重 ${timeStep.weight || 0}）`
                : "未投票",
            ]}
          />
          <StepCard
            title="Step C：AI 辅助综合判断"
            badge={aiStep?.invoked ? aiStep.result || "已调用" : "未调用"}
            tone={
              aiStep?.result === "YES"
                ? "danger"
                : aiStep?.result === "NO"
                  ? "success"
                  : "neutral"
            }
            lines={[
              aiStep?.invoked
                ? `AI 结果：${aiStep?.result || "未返回"}`
                : `跳过原因：${aiStep?.skippedReason || "未调用"}`,
              aiStep?.invoked && typeof aiStep?.confidence === "number"
                ? `AI 置信度：${(aiStep.confidence * 100).toFixed(0)}%，折算权重 ${aiStep.voteWeight || 0}`
                : "无 AI 置信度",
              aiStep?.reasoning ? `说明：${aiStep.reasoning}` : "无 AI 推理说明",
            ]}
          />
          <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-indigo-900">综合判定</div>
              <div className="text-xs text-indigo-700">
                YES {synthesis?.yesScore ?? 0} · NO {synthesis?.noScore ?? 0} · 阈值{" "}
                {synthesis?.threshold ?? 0}
              </div>
            </div>
            <div className="mt-3 space-y-2 text-sm text-indigo-900">
              <div>
                预判结果：{synthesis?.preAiResult?.result || "UNKNOWN"}
                {typeof synthesis?.preAiResult?.confidence === "number"
                  ? `（${(synthesis.preAiResult.confidence * 100).toFixed(0)}%）`
                  : ""}
              </div>
              <div>
                最终结果：{assessment.result}
                {typeof assessment.confidence === "number"
                  ? `（${(assessment.confidence * 100).toFixed(0)}%）`
                  : ""}
              </div>
              <div>说明：{assessment.reasoning || "无"}</div>
            </div>
          </section>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">下游规则影响</div>
          <div className="mt-3 space-y-2">
            {result.executionSource !== "BACKEND" ? (
              <div className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-700">
                {expectedImpact}
              </div>
            ) : relatedRules.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                后端真实试跑中未观察到与既往症直接相关的命中规则。
              </div>
            ) : (
              relatedRules.map((item) => (
                <div key={item.ruleId} className="rounded-lg bg-slate-50 px-3 py-3 text-sm">
                  <div className="font-medium text-slate-900">{item.ruleName}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {item.ruleId} · {item.effect}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">人工复核影响</div>
          <div className="mt-3 space-y-2">
            {relatedManualReasons.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                当前没有因既往症链路直接触发的人工复核原因。
              </div>
            ) : (
              relatedManualReasons.map((item, index) => (
                <div key={`${item.code}-${index}`} className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  <div className="font-medium">{item.code}</div>
                  <div className="mt-1">{item.message}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const InfoField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg bg-white px-3 py-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="mt-1 break-words text-sm font-medium text-slate-900">{value}</div>
  </div>
);

const StepCard: React.FC<{
  title: string;
  badge: string;
  tone: "success" | "danger" | "neutral";
  lines: string[];
}> = ({ title, badge, tone, lines }) => (
  <section
    className={`rounded-xl border p-4 ${
      tone === "danger"
        ? "border-rose-200 bg-rose-50"
        : tone === "success"
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-slate-50"
    }`}
  >
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700">
        {badge}
      </div>
    </div>
    <div className="mt-3 space-y-2 text-sm text-slate-700">
      {lines.map((line, index) => (
        <div key={`${title}-${index}`}>{line}</div>
      ))}
    </div>
  </section>
);

export default PreExistingAssessmentPanel;
