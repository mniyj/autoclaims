import React from "react";
import type { RulesetRule } from "../../types";
import RuleCard from "./RuleCard";

interface RuleGroupSectionProps {
  title: string;
  description: string;
  rules: RulesetRule[];
  mode: "business" | "technical";
  emptyText: string;
  onEdit: (rule: RulesetRule) => void;
  onToggleStatus: (ruleId: string) => void;
  onFocusField?: (field: string) => void;
}

const RuleGroupSection: React.FC<RuleGroupSectionProps> = ({
  title,
  description,
  rules,
  mode,
  emptyText,
  onEdit,
  onToggleStatus,
  onFocusField,
}) => (
  <section className="space-y-3">
    <div className="flex items-end justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
        {rules.length} 条
      </span>
    </div>

    {rules.length === 0 ? (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        {emptyText}
      </div>
    ) : (
      <div className="space-y-3">
        {rules.map((rule) => (
          <RuleCard
            key={rule.rule_id}
            rule={rule}
            mode={mode}
            onEdit={onEdit}
            onToggleStatus={onToggleStatus}
            onFocusField={onFocusField}
          />
        ))}
      </div>
    )}
  </section>
);

export default RuleGroupSection;
