import React, { useState, useRef, useEffect } from "react";
import {
  type InsuranceRuleset,
  type PreProcessorConfig,
  type PreProcessorType,
} from "../../types";

interface PreProcessorConfigTabProps {
  ruleset: InsuranceRuleset;
  onUpdateRuleset: (updated: InsuranceRuleset) => void;
}

const TYPE_LABELS: Record<PreProcessorType, string> = {
  PRE_EXISTING_CONDITION: "既往症评估",
  FIELD_CASCADE: "字段级联",
  COVERAGE_ALIAS_RESOLVE: "别名解析",
};

const TYPE_DESCRIPTIONS: Record<PreProcessorType, string> = {
  PRE_EXISTING_CONDITION:
    "在执行规则前，自动调用 AI 判断案件是否涉及既往症（投保前已有的疾病）。判断结果会写入案件数据，供后续规则决定是否拒赔或转人工。",
  FIELD_CASCADE:
    "从多个候选字段中按优先级取值。典型场景：不同来源的理赔数据把同一个信息存在不同字段名中，需要统一提取。",
  COVERAGE_ALIAS_RESOLVE:
    "将不同来源使用的险种名称（中文名、英文缩写等）统一转换为系统标准代码。",
};

const TYPE_BADGE_CLASSES: Record<PreProcessorType, string> = {
  PRE_EXISTING_CONDITION: "bg-blue-100 text-blue-700",
  FIELD_CASCADE: "bg-green-100 text-green-700",
  COVERAGE_ALIAS_RESOLVE: "bg-amber-100 text-amber-700",
};

const DEFAULT_CONFIGS: Record<PreProcessorType, Record<string, unknown>> = {
  PRE_EXISTING_CONDITION: {
    skip_when: {
      field: "ocrData.pre_existing_condition",
      operator: "IS_NOT_NULL",
    },
    output_field: "pre_existing_condition",
    on_yes: true,
    on_no: false,
    on_uncertain: null,
  },
  FIELD_CASCADE: {
    output_field: "",
    field_cascade: [],
    normalize: "NONE",
    default_value: null,
  },
  COVERAGE_ALIAS_RESOLVE: {
    input_field: "",
    output_field: "",
    alias_map: {},
  },
};

const ALL_TYPES: PreProcessorType[] = [
  "PRE_EXISTING_CONDITION",
  "FIELD_CASCADE",
  "COVERAGE_ALIAS_RESOLVE",
];

const PreProcessorConfigTab: React.FC<PreProcessorConfigTabProps> = ({
  ruleset,
  onUpdateRuleset,
}) => {
  const processors = ruleset.pre_processors ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingType, setAddingType] = useState<PreProcessorType | null>(null);

  const updateProcessors = (next: PreProcessorConfig[]) => {
    onUpdateRuleset({ ...ruleset, pre_processors: next });
  };

  const handleToggleEnabled = (processorId: string) => {
    updateProcessors(
      processors.map((p) =>
        p.processor_id === processorId ? { ...p, enabled: !p.enabled } : p,
      ),
    );
  };

  const handleDelete = (processorId: string) => {
    updateProcessors(processors.filter((p) => p.processor_id !== processorId));
    if (editingId === processorId) setEditingId(null);
  };

  const handleUpdateConfig = (
    processorId: string,
    config: Record<string, unknown>,
  ) => {
    updateProcessors(
      processors.map((p) =>
        p.processor_id === processorId ? { ...p, config } : p,
      ),
    );
  };

  const handleAdd = () => {
    if (!addingType) return;
    const newProcessor: PreProcessorConfig = {
      processor_id: `proc_${Date.now()}`,
      type: addingType,
      label: TYPE_LABELS[addingType],
      enabled: true,
      config: { ...DEFAULT_CONFIGS[addingType] },
    };
    updateProcessors([...processors, newProcessor]);
    setEditingId(newProcessor.processor_id);
    setAddingType(null);
  };

  return (
    <div className="space-y-4">
      {processors.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center text-sm text-gray-500 shadow-sm">
          暂无前处理器配置，点击下方按钮添加。
        </div>
      )}

      {processors.map((proc) => {
        const isEditing = editingId === proc.processor_id;
        return (
          <div
            key={proc.processor_id}
            className="rounded-2xl border border-gray-200 bg-white shadow-sm"
          >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASSES[proc.type]}`}
                >
                  {TYPE_LABELS[proc.type]}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {proc.label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={proc.enabled}
                    onChange={() => handleToggleEnabled(proc.processor_id)}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
                  <span className="text-xs text-gray-500">
                    {proc.enabled ? "已启用" : "已禁用"}
                  </span>
                </label>
                <button
                  onClick={() =>
                    setEditingId(isEditing ? null : proc.processor_id)
                  }
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  {isEditing ? "收起" : "查看详情"}
                </button>
                <button
                  onClick={() => handleDelete(proc.processor_id)}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                >
                  删除
                </button>
              </div>
            </div>

            {/* Collapsed summary */}
            {!isEditing && (
              <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3 text-xs text-gray-500">
                <ConfigSummary type={proc.type} config={proc.config} />
              </div>
            )}

            {/* Expanded detail */}
            {isEditing && (
              <div className="border-t border-gray-100 px-5 pb-5 pt-4">
                {/* Description */}
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {TYPE_DESCRIPTIONS[proc.type]}
                </div>

                {/* Type-specific editor */}
                <div className="mt-4">
                  <TypeSpecificEditor
                    type={proc.type}
                    config={proc.config}
                    onChange={(config) =>
                      handleUpdateConfig(proc.processor_id, config)
                    }
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <select
          value={addingType ?? ""}
          onChange={(e) =>
            setAddingType(
              e.target.value ? (e.target.value as PreProcessorType) : null,
            )
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">选择前处理器类型...</option>
          {ALL_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]} — {TYPE_DESCRIPTIONS[t].slice(0, 30)}...
            </option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          disabled={!addingType}
          className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          添加前处理器
        </button>
      </div>
    </div>
  );
};

/* ---------- Config Summary (collapsed view) ---------- */

const ConfigSummary: React.FC<{
  type: PreProcessorType;
  config: Record<string, unknown>;
}> = ({ type, config }) => {
  switch (type) {
    case "PRE_EXISTING_CONDITION":
      return (
        <span>
          自动评估既往症 → 是既往症则标记为 true，否则标记为
          false，不确定时转人工
        </span>
      );
    case "FIELD_CASCADE": {
      const cascade = (config.field_cascade as string[]) ?? [];
      const outputField = (config.output_field as string) || "?";
      const defaultVal = config.default_value;
      return (
        <span>
          依次尝试 {cascade.length} 个字段 → 写入「{outputField}」
          {defaultVal != null && `（默认值 ${defaultVal}）`}
        </span>
      );
    }
    case "COVERAGE_ALIAS_RESOLVE": {
      const aliasMap = (config.alias_map as Record<string, string[]>) ?? {};
      return <span>已配置 {Object.keys(aliasMap).length} 组别名映射</span>;
    }
    default:
      return <span>-</span>;
  }
};

/* ---------- Type-Specific Editors ---------- */

const TypeSpecificEditor: React.FC<{
  type: PreProcessorType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ type, config, onChange }) => {
  switch (type) {
    case "PRE_EXISTING_CONDITION":
      return <PreExistingConditionEditor config={config} onChange={onChange} />;
    case "FIELD_CASCADE":
      return <FieldCascadeEditor config={config} onChange={onChange} />;
    case "COVERAGE_ALIAS_RESOLVE":
      return <CoverageAliasResolveEditor config={config} onChange={onChange} />;
    default:
      return null;
  }
};

/* -- PRE_EXISTING_CONDITION Editor -- */

const PreExistingConditionEditor: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config }) => {
  // 既往症评估的所有 config 都是系统固定值，用户只需要启用/禁用
  // 这里只做只读展示，解释系统行为

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-gray-900">处理流程</div>

      <div className="relative space-y-0">
        {/* Step 1 */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
              1
            </div>
            <div className="h-full w-px bg-gray-200" />
          </div>
          <div className="pb-6">
            <div className="text-sm font-medium text-gray-900">
              检查是否已有结论
            </div>
            <div className="mt-1 text-xs text-gray-500">
              如果案件数据中已经明确标注了既往症结论（true 或
              false），则跳过自动评估，直接使用已有结论。
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
              2
            </div>
            <div className="h-full w-px bg-gray-200" />
          </div>
          <div className="pb-6">
            <div className="text-sm font-medium text-gray-900">AI 自动评估</div>
            <div className="mt-1 text-xs text-gray-500">
              根据病历中的既往病史、首次确诊日期、保单生效日期等信息，调用 AI
              模型综合判断。
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
              3
            </div>
          </div>
          <div className="pb-2">
            <div className="text-sm font-medium text-gray-900">
              写入评估结果
            </div>
            <div className="mt-1 text-xs text-gray-500">
              评估结果写入案件数据，供后续规则使用：
            </div>
            <div className="mt-2 space-y-1.5">
              <ResultRow
                label="确认是既往症"
                value="true"
                effect="触发既往症拒赔规则"
                tone="rose"
              />
              <ResultRow
                label="确认非既往症"
                value="false"
                effect="正常进入赔付流程"
                tone="emerald"
              />
              <ResultRow
                label="无法确定"
                value="null"
                effect="触发转人工复核规则"
                tone="amber"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Technical info (collapsed) */}
      <details className="rounded-lg border border-gray-200">
        <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-700">
          查看技术参数（通常不需要修改）
        </summary>
        <div className="space-y-2 border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>结果写入字段</span>
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">
              {(config.output_field as string) || "pre_existing_condition"}
            </code>
          </div>
          <div className="flex justify-between">
            <span>跳过条件</span>
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">
              {(config.skip_when as { field?: string })?.field || "-"}{" "}
              已有值时跳过
            </code>
          </div>
        </div>
      </details>
    </div>
  );
};

const ResultRow: React.FC<{
  label: string;
  value: string;
  effect: string;
  tone: "rose" | "emerald" | "amber";
}> = ({ label, value, effect, tone }) => {
  const toneClasses = {
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${toneClasses[tone]}`}
    >
      <span className="font-medium">
        {label} → 写入 {value}
      </span>
      <span>{effect}</span>
    </div>
  );
};

/* -- FIELD_CASCADE Editor -- */

const FieldCascadeEditor: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => {
  const cascade = ((config.field_cascade as string[]) ?? []).slice();
  const normalize = (config.normalize as string) ?? "NONE";

  const handleAddField = () => {
    onChange({ ...config, field_cascade: [...cascade, ""] });
  };

  const handleRemoveField = (index: number) => {
    onChange({
      ...config,
      field_cascade: cascade.filter((_, i) => i !== index),
    });
  };

  const handleFieldChange = (index: number, value: string) => {
    onChange({
      ...config,
      field_cascade: cascade.map((f, i) => (i === index ? value : f)),
    });
  };

  const handleSwap = (indexA: number, indexB: number) => {
    if (indexB < 0 || indexB >= cascade.length) return;
    const next = [...cascade];
    [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
    onChange({ ...config, field_cascade: next });
  };

  return (
    <div className="space-y-5">
      {/* Explanation */}
      <div className="text-sm text-gray-600">
        系统会按下面的顺序逐个检查字段，找到<strong>第一个有值</strong>
        的字段后停止，将该值写入结果。 如果所有字段都为空，则使用默认值。
      </div>

      {/* Field priority list */}
      <div>
        <div className="mb-2 text-sm font-medium text-gray-900">
          字段优先级（从上到下依次尝试）
        </div>
        <div className="space-y-2">
          {cascade.map((field, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-700">
                {index + 1}
              </span>
              <input
                type="text"
                value={field}
                onChange={(e) => handleFieldChange(index, e.target.value)}
                placeholder={`字段路径，如 claim.fault_ratio`}
                className="block flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={() => handleSwap(index, index - 1)}
                disabled={index === 0}
                className="rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-30"
              >
                &uarr;
              </button>
              <button
                onClick={() => handleSwap(index, index + 1)}
                disabled={index === cascade.length - 1}
                className="rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-30"
              >
                &darr;
              </button>
              <button
                onClick={() => handleRemoveField(index)}
                className="rounded border border-rose-200 px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
              >
                &times;
              </button>
            </div>
          ))}
          <button
            onClick={handleAddField}
            className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700"
          >
            + 添加候选字段
          </button>
        </div>
      </div>

      {/* Default value */}
      <div>
        <div className="mb-1 text-sm font-medium text-gray-900">默认值</div>
        <div className="mb-2 text-xs text-gray-500">
          所有候选字段都没有值时，使用此默认值。
        </div>
        <input
          type="number"
          step="any"
          value={
            config.default_value != null ? String(config.default_value) : ""
          }
          onChange={(e) =>
            onChange({
              ...config,
              default_value:
                e.target.value === "" ? null : Number(e.target.value),
            })
          }
          placeholder="留空表示不设默认值"
          className="block w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Normalize */}
      <div>
        <div className="mb-1 text-sm font-medium text-gray-900">数值转换</div>
        <div className="mb-2 text-xs text-gray-500">
          取到值后是否需要自动转换格式。
        </div>
        <select
          value={normalize}
          onChange={(e) => onChange({ ...config, normalize: e.target.value })}
          className="block w-60 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="NONE">不转换（保持原值）</option>
          <option value="RATIO_0_1">百分比 → 小数（如 70 → 0.7）</option>
          <option value="PERCENTAGE">小数 → 百分比（如 0.7 → 70）</option>
        </select>
      </div>

      {/* Technical info */}
      <details className="rounded-lg border border-gray-200">
        <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-700">
          查看技术参数
        </summary>
        <div className="space-y-2 border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>结果写入字段</span>
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">
              {(config.output_field as string) || "(未设置)"}
            </code>
          </div>
        </div>
      </details>
    </div>
  );
};

/* -- COVERAGE_ALIAS_RESOLVE Editor -- */

const CoverageAliasResolveEditor: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => {
  const aliasMap = (config.alias_map as Record<string, string[]>) ?? {};
  const entries = Object.entries(aliasMap);

  const handleAddEntry = () => {
    onChange({
      ...config,
      alias_map: { ...aliasMap, "": [] },
    });
  };

  const handleRemoveEntry = (code: string) => {
    const next = { ...aliasMap };
    delete next[code];
    onChange({ ...config, alias_map: next });
  };

  const handleChangeCode = (oldCode: string, newCode: string) => {
    const next: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(aliasMap)) {
      next[key === oldCode ? newCode : key] = value;
    }
    onChange({ ...config, alias_map: next });
  };

  const handleChangeAliases = (code: string, aliasesStr: string) => {
    const aliases = aliasesStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({
      ...config,
      alias_map: { ...aliasMap, [code]: aliases },
    });
  };

  return (
    <div className="space-y-4">
      {/* Explanation */}
      <div className="text-sm text-gray-600">
        不同渠道或系统对同一个险种可能使用不同的名称。下表将各种别名统一映射到系统标准代码。
      </div>

      {/* Alias table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
              <th className="px-3 py-2.5">标准代码</th>
              <th className="px-3 py-2.5">别名（逗号分隔）</th>
              <th className="px-3 py-2.5 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([code, aliases], idx) => (
              <tr key={idx} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => handleChangeCode(code, e.target.value)}
                    placeholder="如 AUTO_THIRD_PARTY"
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={aliases.join(", ")}
                    onChange={(e) => handleChangeAliases(code, e.target.value)}
                    placeholder="如 第三者责任险, TPL, THIRD_PARTY"
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleRemoveEntry(code)}
                    className="text-xs text-rose-600 hover:text-rose-800"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-4 text-center text-xs text-gray-400"
                >
                  暂无别名映射，点击下方按钮添加
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button
        onClick={handleAddEntry}
        className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700"
      >
        + 添加映射
      </button>
    </div>
  );
};

export default PreProcessorConfigTab;
