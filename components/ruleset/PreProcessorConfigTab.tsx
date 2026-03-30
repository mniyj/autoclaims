import React, { useState } from "react";
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

  const handleUpdateLabel = (processorId: string, label: string) => {
    updateProcessors(
      processors.map((p) =>
        p.processor_id === processorId ? { ...p, label } : p,
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
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-900">
                  {proc.label}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASSES[proc.type]}`}
                >
                  {TYPE_LABELS[proc.type]}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={proc.enabled}
                    onChange={() => handleToggleEnabled(proc.processor_id)}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
                </label>
                <button
                  onClick={() =>
                    setEditingId(isEditing ? null : proc.processor_id)
                  }
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  {isEditing ? "收起" : "编辑"}
                </button>
                <button
                  onClick={() => handleDelete(proc.processor_id)}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                >
                  删除
                </button>
              </div>
            </div>

            {!isEditing && (
              <div className="mt-3 text-xs text-gray-500">
                <ConfigSummary type={proc.type} config={proc.config} />
              </div>
            )}

            {isEditing && (
              <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                <div>
                  <label className="text-xs font-medium text-gray-700">
                    处理器名称
                  </label>
                  <input
                    type="text"
                    value={proc.label}
                    onChange={(e) =>
                      handleUpdateLabel(proc.processor_id, e.target.value)
                    }
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <TypeSpecificEditor
                  type={proc.type}
                  config={proc.config}
                  onChange={(config) =>
                    handleUpdateConfig(proc.processor_id, config)
                  }
                />
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
              {TYPE_LABELS[t]}
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
      const outputField = (config.output_field as string) || "-";
      return <span>输出字段: {outputField}</span>;
    }
    case "FIELD_CASCADE": {
      const cascade = (config.field_cascade as string[]) ?? [];
      const normalize = (config.normalize as string) || "NONE";
      return (
        <span>
          级联字段: {cascade.length > 0 ? cascade.join(" > ") : "未配置"} |
          归一化: {normalize}
        </span>
      );
    }
    case "COVERAGE_ALIAS_RESOLVE": {
      const aliasMap = (config.alias_map as Record<string, string[]>) ?? {};
      const count = Object.keys(aliasMap).length;
      return <span>别名映射: {count} 条</span>;
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
      return (
        <PreExistingConditionEditor config={config} onChange={onChange} />
      );
    case "FIELD_CASCADE":
      return <FieldCascadeEditor config={config} onChange={onChange} />;
    case "COVERAGE_ALIAS_RESOLVE":
      return (
        <CoverageAliasResolveEditor config={config} onChange={onChange} />
      );
    default:
      return null;
  }
};

/* -- PRE_EXISTING_CONDITION Editor -- */

const PreExistingConditionEditor: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => {
  const skipWhen = (config.skip_when as { field?: string; operator?: string }) ?? {};

  return (
    <div className="space-y-3">
      <FieldRow label="output_field">
        <input
          type="text"
          value={(config.output_field as string) ?? ""}
          onChange={(e) =>
            onChange({ ...config, output_field: e.target.value })
          }
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </FieldRow>
      <FieldRow label="on_yes">
        <input
          type="text"
          value={String(config.on_yes ?? "true")}
          onChange={(e) => onChange({ ...config, on_yes: e.target.value })}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </FieldRow>
      <FieldRow label="on_no">
        <input
          type="text"
          value={String(config.on_no ?? "false")}
          onChange={(e) => onChange({ ...config, on_no: e.target.value })}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </FieldRow>
      <FieldRow label="on_uncertain">
        <input
          type="text"
          value={String(config.on_uncertain ?? "null")}
          onChange={(e) => onChange({ ...config, on_uncertain: e.target.value })}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </FieldRow>
      <FieldRow label="skip_when">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={skipWhen.field ?? ""}
            onChange={(e) =>
              onChange({
                ...config,
                skip_when: { ...skipWhen, field: e.target.value },
              })
            }
            placeholder="字段路径"
            className="block w-1/2 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <input
            type="text"
            value={skipWhen.operator ?? ""}
            onChange={(e) =>
              onChange({
                ...config,
                skip_when: { ...skipWhen, operator: e.target.value },
              })
            }
            placeholder="操作符"
            className="block w-1/2 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </FieldRow>
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
    <div className="space-y-3">
      <FieldRow label="output_field">
        <input
          type="text"
          value={(config.output_field as string) ?? ""}
          onChange={(e) =>
            onChange({ ...config, output_field: e.target.value })
          }
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </FieldRow>

      <div>
        <label className="text-xs font-medium text-gray-700">
          field_cascade
        </label>
        <div className="mt-1 space-y-2">
          {cascade.map((field, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={field}
                onChange={(e) => handleFieldChange(index, e.target.value)}
                placeholder={`字段 ${index + 1}`}
                className="block flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
            + 添加字段
          </button>
        </div>
      </div>

      <FieldRow label="normalize">
        <select
          value={normalize}
          onChange={(e) => onChange({ ...config, normalize: e.target.value })}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="NONE">NONE</option>
          <option value="RATIO_0_1">RATIO_0_1</option>
          <option value="PERCENTAGE">PERCENTAGE</option>
        </select>
      </FieldRow>

      <FieldRow label="default_value">
        <input
          type="number"
          value={
            config.default_value != null
              ? String(config.default_value)
              : ""
          }
          onChange={(e) =>
            onChange({
              ...config,
              default_value:
                e.target.value === "" ? null : Number(e.target.value),
            })
          }
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </FieldRow>
    </div>
  );
};

/* -- COVERAGE_ALIAS_RESOLVE Editor -- */

const CoverageAliasResolveEditor: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => {
  const aliasMap =
    (config.alias_map as Record<string, string[]>) ?? {};
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
    <div className="space-y-3">
      <FieldRow label="input_field">
        <input
          type="text"
          value={(config.input_field as string) ?? ""}
          onChange={(e) =>
            onChange({ ...config, input_field: e.target.value })
          }
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </FieldRow>
      <FieldRow label="output_field">
        <input
          type="text"
          value={(config.output_field as string) ?? ""}
          onChange={(e) =>
            onChange({ ...config, output_field: e.target.value })
          }
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </FieldRow>

      <div>
        <label className="text-xs font-medium text-gray-700">
          alias_map
        </label>
        <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                <th className="px-3 py-2">standard_code</th>
                <th className="px-3 py-2">aliases (逗号分隔)</th>
                <th className="px-3 py-2 text-right">操作</th>
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
                      className="block w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={aliases.join(", ")}
                      onChange={(e) =>
                        handleChangeAliases(code, e.target.value)
                      }
                      className="block w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
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
                    className="px-3 py-3 text-center text-xs text-gray-400"
                  >
                    暂无别名映射
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button
          onClick={handleAddEntry}
          className="mt-2 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700"
        >
          + 添加映射
        </button>
      </div>
    </div>
  );
};

/* ---------- Shared Layout ---------- */

const FieldRow: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div>
    <label className="text-xs font-medium text-gray-700">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

export default PreProcessorConfigTab;
