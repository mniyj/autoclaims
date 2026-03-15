import React from "react";
import type { InsuranceRuleset } from "../../types";
import { PRODUCT_LINE_LABELS } from "../../constants";
import {
  type RulesetHealthSnapshot,
  deriveRulesetHealth,
} from "./workbenchUtils";

interface RulesetSummaryPanelProps {
  ruleset: InsuranceRuleset;
  health?: RulesetHealthSnapshot;
}

const toneClasses: Record<RulesetHealthSnapshot["validationTone"], string> = {
  passed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
};

const RulesetSummaryPanel: React.FC<RulesetSummaryPanelProps> = ({
  ruleset,
  health = deriveRulesetHealth(ruleset),
}) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {ruleset.policy_info.product_name}
          </h2>
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
            {PRODUCT_LINE_LABELS[ruleset.product_line]}
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[health.validationTone]}`}>
            {health.validationLabel}
          </span>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          产品编码 {ruleset.policy_info.product_code} · 规则集 {ruleset.ruleset_id}
        </div>
      </div>
      <div className="text-right text-sm text-gray-500">
        <div>版本 v{ruleset.metadata.version}</div>
        <div className="mt-1">{health.versionLabel}</div>
      </div>
    </div>

    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
      <Metric label="责任项" value={String(health.coverageCount)} />
      <Metric label="生效规则" value={String(health.effectiveRuleCount)} />
      <Metric label="草稿规则" value={String(health.draftRuleCount)} />
      <Metric label="字段依赖" value={String(health.dependencyCount)} />
      <Metric label="高风险问题" value={String(health.issueCount)} tone={health.issueCount > 0 ? "danger" : "normal"} />
      <Metric label="待确认" value={String(health.warningCount)} tone={health.warningCount > 0 ? "warning" : "normal"} />
    </div>
  </div>
);

const Metric: React.FC<{
  label: string;
  value: string;
  tone?: "normal" | "warning" | "danger";
}> = ({ label, value, tone = "normal" }) => (
  <div className="rounded-xl bg-slate-50 px-3 py-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div
      className={`mt-1 text-lg font-semibold ${
        tone === "danger" ? "text-rose-600" : tone === "warning" ? "text-amber-600" : "text-slate-900"
      }`}
    >
      {value}
    </div>
  </div>
);

export default RulesetSummaryPanel;
