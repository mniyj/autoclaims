import React from "react";
import type { RulesetRule } from "../../types";
import { RULE_STATUS_COLORS, RULE_STATUS_LABELS } from "../../constants";
import {
  getCoverageCodes,
  getRuleFields,
  getRuleSemantic,
  summarizeAction,
} from "./workbenchUtils";

interface RuleCardProps {
  rule: RulesetRule;
  mode: "business" | "technical";
  onEdit: (rule: RulesetRule) => void;
  onToggleStatus: (ruleId: string) => void;
  onFocusField?: (field: string) => void;
}

const RuleCard: React.FC<RuleCardProps> = ({
  rule,
  mode,
  onEdit,
  onToggleStatus,
  onFocusField,
}) => {
  const semantic = getRuleSemantic(rule);
  const fields = getRuleFields(rule);
  const coverageCodes = getCoverageCodes(rule);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-900">{rule.rule_name}</h4>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
              {semantic.label}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${RULE_STATUS_COLORS[rule.status]}`}>
              {RULE_STATUS_LABELS[rule.status]}
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {rule.rule_id} · 优先级 {rule.priority.level}.{rule.priority.rank}
          </div>
          <div className="mt-2 text-sm text-gray-700">{rule.description || semantic.description}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onEdit(rule)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            编辑
          </button>
          <button
            onClick={() => onToggleStatus(rule.rule_id)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {rule.status === "EFFECTIVE" ? "禁用" : "启用"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <InfoBlock label="动作摘要" value={summarizeAction(rule)} />
        <InfoBlock
          label="适用责任"
          value={coverageCodes.length > 0 ? coverageCodes.join("、") : "案件级规则"}
        />
        <InfoBlock
          label="关键字段"
          value={fields.length > 0 ? `${fields.length} 个字段` : "无字段依赖"}
        />
      </div>

      {mode === "technical" && fields.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {fields.map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => onFocusField?.(field)}
              className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              {field}
            </button>
          ))}
        </div>
      )}

      {mode === "business" && (
        <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {semantic.label}规则，{coverageCodes.length > 0 ? `作用于 ${coverageCodes.join("、")}` : "作用于案件级"}，命中后{summarizeAction(rule)}。
        </div>
      )}
    </div>
  );
};

const InfoBlock: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg bg-slate-50 px-3 py-2">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
  </div>
);

export default RuleCard;
