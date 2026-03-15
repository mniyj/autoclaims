import React from "react";
import type { InsuranceRuleset } from "../../types";

interface VersionDiffViewerProps {
  current: InsuranceRuleset;
  previous: InsuranceRuleset | null;
}

const VersionDiffViewer: React.FC<VersionDiffViewerProps> = ({
  current,
  previous,
}) => {
  if (!previous) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        暂无可对比的上一版本
      </div>
    );
  }

  const currentRuleIds = new Set(current.rules.map((rule) => rule.rule_id));
  const previousRuleIds = new Set(previous.rules.map((rule) => rule.rule_id));
  const addedRules = current.rules.filter((rule) => !previousRuleIds.has(rule.rule_id));
  const removedRules = previous.rules.filter((rule) => !currentRuleIds.has(rule.rule_id));
  const changedRules = current.rules.filter((rule) => {
    const prev = previous.rules.find((item) => item.rule_id === rule.rule_id);
    return prev && JSON.stringify(prev) !== JSON.stringify(rule);
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <MetricCard label="新增规则" value={String(addedRules.length)} tone="success" />
        <MetricCard label="变更规则" value={String(changedRules.length)} tone="warning" />
        <MetricCard label="移除规则" value={String(removedRules.length)} tone="danger" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DiffSection title="新增规则" tone="success" items={addedRules.map((rule) => `${rule.rule_id} · ${rule.rule_name}`)} />
        <DiffSection title="变更规则" tone="warning" items={changedRules.map((rule) => `${rule.rule_id} · ${rule.rule_name}`)} />
        <DiffSection title="移除规则" tone="danger" items={removedRules.map((rule) => `${rule.rule_id} · ${rule.rule_name}`)} />
      </div>
    </div>
  );
};

const toneMap = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

const MetricCard: React.FC<{ label: string; value: string; tone: keyof typeof toneMap }> = ({
  label,
  value,
  tone,
}) => (
  <div className={`rounded-xl border px-4 py-4 ${toneMap[tone]}`}>
    <div className="text-xs">{label}</div>
    <div className="mt-1 text-2xl font-semibold">{value}</div>
  </div>
);

const DiffSection: React.FC<{ title: string; tone: keyof typeof toneMap; items: string[] }> = ({
  title,
  tone,
  items,
}) => (
  <div className={`rounded-xl border p-4 ${toneMap[tone]}`}>
    <div className="text-sm font-semibold">{title}</div>
    <div className="mt-3 space-y-2">
      {items.length === 0 ? (
        <div className="text-sm opacity-80">无</div>
      ) : (
        items.map((item) => (
          <div key={item} className="rounded-lg bg-white/70 px-3 py-2 text-sm">
            {item}
          </div>
        ))
      )}
    </div>
  </div>
);

export default VersionDiffViewer;
