import React, { useState, useRef, useEffect } from "react";
import {
  type FactCatalogField,
  type InsuranceRuleset,
  type PreExistingConditionProcessorConfig,
  type PreExistingConditionUncertainAction,
  type PreExistingConditionUncertainRule,
  type PreProcessorConfig,
  type PreProcessorType,
} from "../../types";

interface PreProcessorConfigTabProps {
  ruleset: InsuranceRuleset;
  factCatalog: FactCatalogField[];
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
    "解决「同一个数据，不同系统叫不同名字」的问题。例如：责任比例在 A 系统叫 fault_ratio，B 系统叫 insured_liability_ratio —— 本处理器会逐个查找，把第一个有值的写入统一字段。",
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
    uncertain_resolution: {
      default: "MANUAL_REVIEW",
      rules: [
        {
          when: {
            product_line: "HEALTH",
            claim_scenario: "medical_expense",
            max_claim_amount: 5000,
          },
          action: "ASSUME_FALSE",
        },
      ],
    },
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

const UNCERTAIN_ACTION_LABELS: Record<
  PreExistingConditionUncertainAction,
  string
> = {
  MANUAL_REVIEW: "转人工复核",
  ASSUME_FALSE: "按非既往症处理",
};

const PRODUCT_LINE_OPTIONS = [
  "HEALTH",
  "CRITICAL_ILLNESS",
  "ACCIDENT",
  "AUTO",
  "LIABILITY",
] as const;

const CLAIM_SCENARIO_OPTIONS = [
  "medical_expense",
  "critical_illness",
  "accident_medical",
  "accident_benefit",
  "liability_death",
  "auto_injury",
  "auto_property_damage",
] as const;

/* ---------- InfoTip Component ---------- */

const InfoTip: React.FC<{ text: string }> = ({ text }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold leading-none text-gray-500 hover:bg-indigo-100 hover:text-indigo-600"
        title="点击查看说明"
      >
        i
      </button>
      {open && (
        <div className="absolute left-6 top-0 z-50 w-64 rounded-lg border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-600 shadow-lg">
          {text}
        </div>
      )}
    </div>
  );
};

const PreProcessorConfigTab: React.FC<PreProcessorConfigTabProps> = ({
  ruleset,
  factCatalog,
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
              <div className="flex flex-col gap-1">
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
                <div className="text-xs text-gray-400 leading-relaxed pl-0.5">
                  {TYPE_DESCRIPTIONS[proc.type]}
                </div>
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
                    factCatalog={factCatalog}
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
    case "PRE_EXISTING_CONDITION": {
      const uncertainResolution =
        (config as PreExistingConditionProcessorConfig).uncertain_resolution ||
        {};
      const rules = uncertainResolution.rules || [];
      const defaultAction =
        uncertainResolution.default || "MANUAL_REVIEW";
      return (
        <span>
          自动评估既往症 → 不确定时默认
          {UNCERTAIN_ACTION_LABELS[defaultAction]}，已配置 {rules.length} 条细分策略
        </span>
      );
    }
    case "FIELD_CASCADE": {
      const cascade = (config.field_cascade as string[]) ?? [];
      const outputField = (config.output_field as string) || "?";
      const defaultVal = config.default_value;
      const normalizeLabel =
        config.normalize === "RATIO_0_1"
          ? "，自动转小数"
          : config.normalize === "PERCENTAGE"
            ? "，自动转百分比"
            : "";
      return (
        <span>
          从 {cascade.length} 个不同字段名中找第一个有值的 → 统一写入「
          {outputField}」{normalizeLabel}
          {defaultVal != null && `（查不到时默认 ${defaultVal}）`}
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
  factCatalog: FactCatalogField[];
  onChange: (config: Record<string, unknown>) => void;
}> = ({ type, config, factCatalog, onChange }) => {
  switch (type) {
    case "PRE_EXISTING_CONDITION":
      return <PreExistingConditionEditor config={config} onChange={onChange} />;
    case "FIELD_CASCADE":
      return (
        <FieldCascadeEditor
          config={config}
          factCatalog={factCatalog}
          onChange={onChange}
        />
      );
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
}> = ({ config, onChange }) => {
  const typedConfig = config as PreExistingConditionProcessorConfig;
  const uncertainResolution = typedConfig.uncertain_resolution || {
    default: "MANUAL_REVIEW",
    rules: [],
  };
  const defaultAction =
    uncertainResolution.default || "MANUAL_REVIEW";
  const rules = Array.isArray(uncertainResolution.rules)
    ? uncertainResolution.rules
    : [];

  const updateUncertainResolution = (
    next: PreExistingConditionProcessorConfig["uncertain_resolution"],
  ) => {
    onChange({
      ...typedConfig,
      uncertain_resolution: next,
    });
  };

  const handleRuleChange = (
    index: number,
    updater: (rule: PreExistingConditionUncertainRule) => PreExistingConditionUncertainRule,
  ) => {
    const nextRules = rules.map((rule, ruleIndex) =>
      ruleIndex === index ? updater(rule) : rule,
    );
    updateUncertainResolution({
      ...uncertainResolution,
      rules: nextRules,
    });
  };

  const handleAddRule = () => {
    updateUncertainResolution({
      ...uncertainResolution,
      rules: [
        ...rules,
        {
          when: {
            product_line: "HEALTH",
            claim_scenario: "medical_expense",
            max_claim_amount: 5000,
          },
          action: "ASSUME_FALSE",
        },
      ],
    });
  };

  const handleRemoveRule = (index: number) => {
    updateUncertainResolution({
      ...uncertainResolution,
      rules: rules.filter((_, ruleIndex) => ruleIndex !== index),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center text-sm font-medium text-gray-900">
        处理流程
        <InfoTip text="既往症评估处理器会在规则引擎执行前自动运行，通过 AI 分析病历信息判断案件是否涉及投保前已有的疾病。整个流程分为三步：检查已有结论 → AI 评估 → 写入结果。" />
      </div>

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
            <div className="flex items-center text-sm font-medium text-gray-900">
              检查是否已有结论
              <InfoTip text="系统先检查案件数据中是否已经存在既往症的判断结果。如果已有明确结论（由人工标注或上游系统传入），则跳过 AI 评估，避免重复计算和覆盖人工判断。" />
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
            <div className="flex items-center text-sm font-medium text-gray-900">
              AI 自动评估
              <InfoTip text="调用 AI 模型（如 Gemini），将病历中的既往病史、首次确诊日期与保单生效日期进行比对。如果疾病在投保前就已存在，则判定为既往症。AI 会给出「是」、「否」或「无法确定」三种结论。" />
            </div>
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
            <div className="flex items-center text-sm font-medium text-gray-900">
              写入评估结果
              <InfoTip text="AI 的评估结论会以字段值的形式写入案件数据。后续的规则引擎可以读取这个字段来决定赔付方案：true 触发拒赔规则，false 正常赔付，null 转人工复核。" />
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
                effect={`按策略处理（默认${UNCERTAIN_ACTION_LABELS[defaultAction]}）`}
                tone="amber"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex items-center text-sm font-medium text-gray-900">
          未确定时如何处理
          <InfoTip text="当 AI 只能得出“无法确定”时，系统不会直接拒赔，而是按这里的策略决定：默认转人工，或者在特定产品线/场景/金额阈值下按非既往症继续处理。" />
        </div>
        <div className="mt-1 text-xs text-gray-500">
          推荐保守默认值：转人工。仅对小额医疗这类低风险场景配置例外。
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-900">
            默认策略
          </label>
          <select
            value={defaultAction}
            onChange={(e) =>
              updateUncertainResolution({
                ...uncertainResolution,
                default: e.target.value as PreExistingConditionUncertainAction,
              })
            }
            className="block w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {Object.entries(UNCERTAIN_ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-900">细分策略</div>
            <button
              onClick={handleAddRule}
              className="rounded-lg border border-dashed border-amber-300 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100"
            >
              + 添加规则
            </button>
          </div>

          {rules.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-4 text-xs text-gray-500">
              暂未配置例外规则。当前所有“无法确定”案件都按默认策略处理。
            </div>
          )}

          {rules.map((rule, index) => {
            const when = rule.when || {};
            return (
              <div
                key={index}
                className="rounded-lg border border-amber-100 bg-white p-3"
              >
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      产品线
                    </label>
                    <select
                      value={when.product_line || ""}
                      onChange={(e) =>
                        handleRuleChange(index, (current) => ({
                          ...current,
                          when: {
                            ...(current.when || {}),
                            product_line: e.target.value || undefined,
                          },
                        }))
                      }
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">不限</option>
                      {PRODUCT_LINE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      理赔场景
                    </label>
                    <select
                      value={when.claim_scenario || ""}
                      onChange={(e) =>
                        handleRuleChange(index, (current) => ({
                          ...current,
                          when: {
                            ...(current.when || {}),
                            claim_scenario: e.target.value || undefined,
                          },
                        }))
                      }
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">不限</option>
                      {CLAIM_SCENARIO_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      最高报案金额
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        when.max_claim_amount != null
                          ? String(when.max_claim_amount)
                          : ""
                      }
                      onChange={(e) =>
                        handleRuleChange(index, (current) => ({
                          ...current,
                          when: {
                            ...(current.when || {}),
                            max_claim_amount:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          },
                        }))
                      }
                      placeholder="如 5000"
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      命中后动作
                    </label>
                    <select
                      value={rule.action}
                      onChange={(e) =>
                        handleRuleChange(index, (current) => ({
                          ...current,
                          action:
                            e.target.value as PreExistingConditionUncertainAction,
                        }))
                      }
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {Object.entries(UNCERTAIN_ACTION_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => handleRemoveRule(index)}
                    className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                  >
                    删除规则
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Technical info (collapsed) */}
      <details className="rounded-lg border border-gray-200">
        <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-700">
          查看技术参数（通常不需要修改）
        </summary>
        <div className="space-y-2 border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          <div className="flex justify-between">
            <span className="flex items-center">
              结果写入字段
              <InfoTip text="AI 评估的结果会写入案件数据的这个字段中。后续规则可以通过读取这个字段来判断是否为既往症。" />
            </span>
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">
              {(config.output_field as string) || "pre_existing_condition"}
            </code>
          </div>
          <div className="flex justify-between">
            <span className="flex items-center">
              跳过条件
              <InfoTip text="当案件数据中指定的字段已有值（非 null）时，系统会跳过 AI 评估，直接使用已有值。这避免了重复评估和覆盖人工标注。" />
            </span>
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">
              {(config.skip_when as { field?: string })?.field || "-"}{" "}
              已有值时跳过
            </code>
          </div>
          <div className="flex justify-between">
            <span className="flex items-center">
              未确定默认策略
              <InfoTip text="AI 结论为“无法确定”时，先看是否命中细分规则；若没命中，则按这个默认动作处理。" />
            </span>
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">
              {UNCERTAIN_ACTION_LABELS[defaultAction]}
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
  factCatalog: FactCatalogField[];
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, factCatalog, onChange }) => {
  const cascade = ((config.field_cascade as string[]) ?? []).slice();
  const normalize = (config.normalize as string) ?? "NONE";

  // Group facts by scope for easier browsing
  const activeFacts = factCatalog.filter((f) => f.status !== "DISABLED");
  const factsByScope = activeFacts.reduce<Record<string, FactCatalogField[]>>(
    (acc, fact) => {
      const scope = fact.fact_id.split(".")[0] || "other";
      if (!acc[scope]) acc[scope] = [];
      acc[scope].push(fact);
      return acc;
    },
    {},
  );
  const scopeLabels: Record<string, string> = {
    policy: "保单",
    claim: "案件",
    expense_item: "费用明细",
    medical: "医疗",
    vehicle: "车辆",
    other: "其他",
  };

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
      {/* Concrete example */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm text-gray-700 space-y-2">
        <div className="font-medium text-indigo-700">
          这个处理器解决什么问题？
        </div>
        <div>
          理赔数据来自不同系统（交警平台、保险公司、OCR 识别等），
          <strong>同一个信息在不同系统里的字段名不一样</strong>。
        </div>
        <div className="rounded-lg bg-white border border-indigo-100 px-3 py-2 text-xs font-mono space-y-1">
          <div className="text-gray-400">
            // 举例：「责任比例」这个值，不同系统的字段名：
          </div>
          <div>
            交警平台 →{" "}
            <span className="text-indigo-600">claim.fault_ratio</span> = 70
          </div>
          <div>
            保险公司 →{" "}
            <span className="text-gray-400">claim.insured_liability_ratio</span>{" "}
            = (空)
          </div>
          <div>
            OCR 识别 →{" "}
            <span className="text-gray-400">
              claim.thirdPartyLiabilityRatio
            </span>{" "}
            = (空)
          </div>
        </div>
        <div>
          系统会<strong>从上到下逐个查找</strong>，找到第一个有值的（这里是
          70），就把它作为统一的结果交给规则引擎。
        </div>
      </div>

      {/* Field priority list */}
      <div>
        <div className="mb-2 flex items-center text-sm font-medium text-gray-900">
          候选字段列表
          <InfoTip text="把同一个信息在不同系统中的字段名都列在这里。排在前面的优先级更高 —— 系统找到第一个有值的就停下来。用箭头按钮调整顺序。字段路径用点号分隔层级，如 claim.fault_ratio。" />
        </div>
        <div className="space-y-2">
          {cascade.map((field, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-700">
                {index + 1}
              </span>
              <select
                value={field}
                onChange={(e) => handleFieldChange(index, e.target.value)}
                className="block flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">请选择元字段...</option>
                {Object.entries(factsByScope).map(([scope, facts]) => (
                  <optgroup key={scope} label={scopeLabels[scope] || scope}>
                    {facts.map((fact) => (
                      <option key={fact.fact_id} value={fact.fact_id}>
                        {fact.label}（{fact.fact_id}）
                      </option>
                    ))}
                  </optgroup>
                ))}
                {field && !activeFacts.some((f) => f.fact_id === field) && (
                  <option value={field}>{field}（未在元字段目录中）</option>
                )}
              </select>
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

      {/* Output field */}
      <div>
        <div className="mb-1 flex items-center text-sm font-medium text-gray-900">
          结果写入字段
          <InfoTip text="从候选字段中取到的值，最终会存到这个字段里。后续规则引擎通过读取这个字段来获取统一后的值。" />
        </div>
        <div className="mb-2 text-xs text-gray-500">
          取到值后写入案件数据的哪个字段。
        </div>
        <select
          value={(config.output_field as string) || ""}
          onChange={(e) =>
            onChange({ ...config, output_field: e.target.value })
          }
          className="block w-80 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">请选择元字段...</option>
          {Object.entries(factsByScope).map(([scope, facts]) => (
            <optgroup key={scope} label={scopeLabels[scope] || scope}>
              {facts.map((fact) => (
                <option key={fact.fact_id} value={fact.fact_id}>
                  {fact.label}（{fact.fact_id}）
                </option>
              ))}
            </optgroup>
          ))}
          {(config.output_field as string) &&
            !activeFacts.some(
              (f) => f.fact_id === (config.output_field as string),
            ) && (
              <option value={config.output_field as string}>
                {config.output_field as string}（未在元字段目录中）
              </option>
            )}
        </select>
      </div>

      {/* Default value */}
      <div>
        <div className="mb-1 flex items-center text-sm font-medium text-gray-900">
          默认值
          <InfoTip text="如果上面所有候选字段都查不到值（数据缺失），系统就用这个默认值。例如：责任比例默认 100 表示「查不到就按全责处理」。留空则不设默认值，后续规则需要自行处理数据缺失的情况。" />
        </div>
        <div className="mb-2 text-xs text-gray-500">
          所有候选字段都没有值时，用这个兜底。
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
        <div className="mb-1 flex items-center text-sm font-medium text-gray-900">
          数值转换
          <InfoTip text="取到值之后，是否需要自动换算格式。举例：交警平台给的责任比例是 70（百分比），但规则引擎需要 0.7（小数）。选「百分比 → 小数」就会自动除以 100。" />
        </div>
        <div className="mb-2 text-xs text-gray-500">
          取到值后，自动换算成规则引擎需要的格式。
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
            <span className="flex items-center">
              结果写入字段
              <InfoTip text="最终取到的值会存到案件数据的这个字段名下。后续规则通过读取这个字段来获取统一后的值。" />
            </span>
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
              <th className="px-3 py-2.5">
                <span className="inline-flex items-center">
                  标准代码
                  <InfoTip text="系统内部使用的统一险种编码，如 AUTO_THIRD_PARTY。规则引擎和计算引擎都通过这个标准代码来识别险种。" />
                </span>
              </th>
              <th className="px-3 py-2.5">
                <span className="inline-flex items-center">
                  别名（逗号分隔）
                  <InfoTip text="同一险种在不同渠道、系统或文档中可能使用不同的名称。将这些名称用逗号分隔填入，系统会自动将它们统一转换为左侧的标准代码。例如：第三者责任险、TPL、三者险 都指向同一个标准代码。" />
                </span>
              </th>
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
