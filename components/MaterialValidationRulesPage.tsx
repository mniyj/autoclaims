import React, { useEffect, useMemo, useState } from "react";
import type {
  ClaimsMaterial,
  FactCatalogField,
  MaterialFieldRef,
  MaterialValidationRule,
} from "../types";
import Modal from "./ui/Modal";
import { api } from "../services/api";

const CATEGORY_OPTIONS: Array<{ value: MaterialValidationRule["category"]; label: string }> = [
  { value: "identity", label: "身份一致性" },
  { value: "amount_consistency", label: "金额一致性" },
  { value: "date_consistency", label: "日期一致性" },
  { value: "timeline", label: "时间线合理性" },
  { value: "custom", label: "自定义" },
];

const OPERATOR_OPTIONS = [
  { value: "EQ", label: "等于" },
  { value: "NE", label: "不等于" },
  { value: "GT", label: "大于" },
  { value: "GTE", label: "大于等于" },
  { value: "LT", label: "小于" },
  { value: "LTE", label: "小于等于" },
  { value: "CONTAINS", label: "包含" },
  { value: "NOT_CONTAINS", label: "不包含" },
] as const;

const FAILURE_ACTION_OPTIONS = [
  { value: "WARNING", label: "仅告警" },
  { value: "MANUAL_REVIEW", label: "转人工复核" },
  { value: "BLOCK", label: "阻断通过" },
] as const;

const SEVERITY_OPTIONS = [
  { value: "info", label: "提示" },
  { value: "warning", label: "警告" },
  { value: "error", label: "错误" },
] as const;

function collectMaterialSchemaPaths(
  fields: Array<{
    field_key: string;
    field_label: string;
    data_type: string;
    children?: any[];
    item_fields?: any[];
    fact_id?: string;
  }>,
  prefix = "",
): Array<{ field_key: string; field_label: string; fact_id?: string }> {
  const results: Array<{ field_key: string; field_label: string; fact_id?: string }> = [];

  fields.forEach((field) => {
    const key = String(field.field_key || "").trim();
    if (!key) return;
    const path = prefix ? `${prefix}.${key}` : key;
    results.push({
      field_key: path,
      field_label: field.field_label || key,
      fact_id: field.fact_id,
    });

    if (field.data_type === "OBJECT") {
      results.push(...collectMaterialSchemaPaths((field.children || []) as any[], path));
    }

    if (field.data_type === "ARRAY") {
      results.push(
        ...collectMaterialSchemaPaths(
          (field.item_fields || []) as any[],
          `${path}[]`,
        ),
      );
    }
  });

  return results;
}

function createEmptyRule(): MaterialValidationRule {
  const now = new Date().toISOString();
  return {
    id: `mv-${Date.now()}`,
    name: "",
    description: "",
    enabled: true,
    category: "identity",
    left: {
      material_id: "",
      fact_id: "",
      field_key: "",
    },
    operator: "EQ",
    right: {
      material_id: "",
      fact_id: "",
      field_key: "",
    },
    failure_action: "MANUAL_REVIEW",
    severity: "warning",
    reason_code: "",
    message_template: "",
    output_fact_id: "",
    created_at: now,
    updated_at: now,
  };
}

const MaterialValidationRulesPage: React.FC = () => {
  const [rules, setRules] = useState<MaterialValidationRule[]>([]);
  const [materials, setMaterials] = useState<ClaimsMaterial[]>([]);
  const [factCatalog, setFactCatalog] = useState<FactCatalogField[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingRule, setEditingRule] = useState<MaterialValidationRule | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ruleData, materialData, factData] = await Promise.all([
          api.materialValidationRules.list(),
          api.claimsMaterials.list(),
          api.factCatalog.list(),
        ]);
        setRules(ruleData as MaterialValidationRule[]);
        setMaterials(materialData as ClaimsMaterial[]);
        setFactCatalog(factData as FactCatalogField[]);
      } catch (error) {
        console.error("Failed to fetch material validation rules:", error);
      }
    };
    void fetchData();
  }, []);

  const filteredRules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter((rule) =>
      rule.name.toLowerCase().includes(q) ||
      rule.reason_code.toLowerCase().includes(q) ||
      rule.output_fact_id?.toLowerCase().includes(q),
    );
  }, [rules, searchQuery]);

  const persistRules = async (nextRules: MaterialValidationRule[]) => {
    await api.materialValidationRules.saveAll(nextRules as unknown as any[]);
    setRules(nextRules);
  };

  const openCreate = () => {
    setEditingRule(createEmptyRule());
    setIsModalOpen(true);
  };

  const fieldOptionsByMaterial = useMemo(() => {
    return materials.reduce<Record<string, MaterialFieldRef[]>>((acc, material) => {
      const schemaFields = (material.schemaFields || []) as any[];
      const schemaFieldOptions = collectMaterialSchemaPaths(schemaFields).map((field) => ({
        material_id: material.id,
        material_name: material.name,
        fact_id: field.fact_id || "",
        field_key: field.field_key,
        field_label: field.fact_id
          ? `${field.field_label || field.field_key}（已映射 ${field.fact_id}）`
          : `${field.field_label || field.field_key}（材料字段）`,
      }));
      const merged = [...schemaFieldOptions].filter(
        (field, index, list) => list.findIndex((item) => item.field_key === field.field_key && item.material_id === field.material_id) === index,
      );
      acc[material.id] = merged;
      return acc;
    }, {});
  }, [materials]);

  const validationErrors = useMemo(() => {
    if (!editingRule) return [];
    const errors: string[] = [];
    if (!editingRule.name.trim()) errors.push("规则名称不能为空。");
    if (!editingRule.left.material_id || !editingRule.left.field_key) errors.push("请完整选择左侧字段。");
    if (!editingRule.right.material_id || !editingRule.right.field_key) errors.push("请完整选择右侧字段。");
    if (!editingRule.reason_code.trim()) errors.push("请填写原因码。");
    if (!editingRule.message_template.trim()) errors.push("请填写校验失败提示语。");
    if (editingRule.output_fact_id && !factCatalog.some((fact) => fact.fact_id === editingRule.output_fact_id)) {
      errors.push("输出结果字段必须引用事实元数据中心已登记的字段。");
    }
    return errors;
  }, [editingRule, factCatalog]);

  const handleSave = async () => {
    if (!editingRule || validationErrors.length > 0) {
      alert(validationErrors[0] || "请完善规则信息");
      return;
    }
    const normalized = { ...editingRule, updated_at: new Date().toISOString() };
    const nextRules = rules.some((rule) => rule.id === normalized.id)
      ? rules.map((rule) => (rule.id === normalized.id ? normalized : rule))
      : [normalized, ...rules];
    try {
      await persistRules(nextRules);
      setIsModalOpen(false);
      setEditingRule(null);
    } catch (error) {
      console.error("Failed to save material validation rule:", error);
      alert("保存失败");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">材料校验规则中心</h1>
          <p className="mt-1 text-sm text-slate-500">
            管理跨材料一致性校验规则。这里处理“字段之间怎么比”，理赔规则集只消费比对结果。
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-700"
        >
          新增校验规则
        </button>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <div>材料页面负责定义“材料能提取哪些字段”。</div>
        <div className="mt-1">本页面负责定义“不同材料字段之间怎么比”。</div>
        <div className="mt-1">规则集页面只应该引用这里产出的结果字段，例如 `claim.invoice_patient_name_consistent`。</div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索规则名称 / 原因码 / 输出结果字段"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">规则</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">比对关系</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">失败处理</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">输出结果</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRules.map((rule) => (
              <tr key={rule.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{rule.name}</div>
                  <div className="text-xs text-slate-500">{rule.reason_code}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {rule.left.material_name || rule.left.material_id} / {rule.left.field_label || rule.left.field_key}
                  <span className="mx-2 text-slate-400">{rule.operator}</span>
                  {rule.right.material_name || rule.right.material_id} / {rule.right.field_label || rule.right.field_key}
                </td>
                <td className="px-4 py-3 text-slate-600">{rule.failure_action} · {rule.severity}</td>
                <td className="px-4 py-3 text-slate-600">{rule.output_fact_id || "未落标准事实"}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => {
                      setEditingRule(rule);
                      setIsModalOpen(true);
                    }}
                    className="rounded-md bg-brand-blue-50 px-3 py-1 text-xs font-medium text-brand-blue-700 hover:bg-brand-blue-100"
                  >
                    编辑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="材料校验规则维护"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setIsModalOpen(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">取消</button>
            <button
              onClick={handleSave}
              disabled={validationErrors.length > 0}
              className="rounded-md bg-brand-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              保存
            </button>
          </div>
        }
      >
        {editingRule && (
          <div className="space-y-4">
            <InputRow label="规则名称" value={editingRule.name} onChange={(value) => setEditingRule({ ...editingRule, name: value })} />
            <InputRow label="规则说明" value={editingRule.description || ""} onChange={(value) => setEditingRule({ ...editingRule, description: value })} />

            <div className="grid gap-4 md:grid-cols-2">
              <SelectRow
                label="规则分类"
                value={editingRule.category}
                onChange={(value) => setEditingRule({ ...editingRule, category: value as MaterialValidationRule["category"] })}
                options={CATEGORY_OPTIONS}
              />
              <label className="flex items-center gap-2 pt-7 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editingRule.enabled}
                  onChange={(e) => setEditingRule({ ...editingRule, enabled: e.target.checked })}
                  className="rounded border-gray-300 text-brand-blue-600"
                />
                启用规则
              </label>
            </div>

            <ComparisonFieldEditor
              title="左侧字段"
              materials={materials}
              fieldOptionsByMaterial={fieldOptionsByMaterial}
              value={editingRule.left}
              onChange={(left) => setEditingRule({ ...editingRule, left })}
            />

            <div className="grid gap-4 md:grid-cols-3">
              <SelectRow
                label="运算符"
                value={editingRule.operator}
                onChange={(value) => setEditingRule({ ...editingRule, operator: value as MaterialValidationRule["operator"] })}
                options={OPERATOR_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
              />
              <SelectRow
                label="失败处理"
                value={editingRule.failure_action}
                onChange={(value) => setEditingRule({ ...editingRule, failure_action: value as MaterialValidationRule["failure_action"] })}
                options={FAILURE_ACTION_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
              />
              <SelectRow
                label="严重程度"
                value={editingRule.severity}
                onChange={(value) => setEditingRule({ ...editingRule, severity: value as MaterialValidationRule["severity"] })}
                options={SEVERITY_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
              />
            </div>

            <ComparisonFieldEditor
              title="右侧字段"
              materials={materials}
              fieldOptionsByMaterial={fieldOptionsByMaterial}
              value={editingRule.right}
              onChange={(right) => setEditingRule({ ...editingRule, right })}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <InputRow label="原因码" value={editingRule.reason_code} onChange={(value) => setEditingRule({ ...editingRule, reason_code: value })} />
              <SelectRow
                label="输出结果字段"
                value={editingRule.output_fact_id || ""}
                onChange={(value) => setEditingRule({ ...editingRule, output_fact_id: value })}
                options={[
                  { value: "", label: "不落标准事实" },
                  ...factCatalog.map((fact) => ({ value: fact.fact_id, label: `${fact.label} (${fact.fact_id})` })),
                ]}
              />
            </div>

            <InputRow
              label="失败提示语"
              value={editingRule.message_template}
              onChange={(value) => setEditingRule({ ...editingRule, message_template: value })}
            />

            {validationErrors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-semibold text-amber-800">保存前校验</div>
                <ul className="mt-2 space-y-1 text-sm text-amber-700">
                  {validationErrors.map((error) => <li key={error}>- {error}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

const ComparisonFieldEditor: React.FC<{
  title: string;
  materials: ClaimsMaterial[];
  fieldOptionsByMaterial: Record<string, MaterialFieldRef[]>;
  value: MaterialFieldRef;
  onChange: (next: MaterialFieldRef) => void;
}> = ({ title, materials, fieldOptionsByMaterial, value, onChange }) => {
  const options = fieldOptionsByMaterial[value.material_id] || [];
  return (
    <div className="rounded-xl border border-gray-200 bg-slate-50 p-4">
      <div className="mb-3 text-sm font-semibold text-slate-900">{title}</div>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectRow
          label="材料"
          value={value.material_id}
          onChange={(materialId) => {
            const material = materials.find((item) => item.id === materialId);
            onChange({
              material_id: materialId,
              material_name: material?.name,
              fact_id: "",
              field_key: "",
              field_label: "",
            });
          }}
          options={[
            { value: "", label: "请选择材料" },
            ...materials.map((material) => ({ value: material.id, label: material.name })),
          ]}
        />
        <SelectRow
          label="字段"
              value={value.field_key}
              onChange={(fieldKey) => {
                const field = options.find((item) => item.field_key === fieldKey);
                onChange(field || { ...value, field_key: fieldKey });
              }}
              options={[
                { value: "", label: "请选择字段" },
                ...options.map((field) => ({
                  value: field.field_key,
                  label: field.fact_id
                    ? `${field.field_label || field.field_key} (${field.fact_id})`
                    : `${field.field_label || field.field_key}`,
                })),
              ]}
        />
      </div>
    </div>
  );
};

const InputRow: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
    <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
  </div>
);

const SelectRow: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}> = ({ label, value, onChange, options }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
      {options.map((option) => (
        <option key={`${label}-${option.value}`} value={option.value}>{option.label}</option>
      ))}
    </select>
  </div>
);

export default MaterialValidationRulesPage;
