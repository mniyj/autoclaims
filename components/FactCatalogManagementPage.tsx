import React, { useEffect, useMemo, useState } from "react";
import type { ClaimsMaterial, FactCatalogField } from "../types";
import { ExecutionDomain } from "../types";
import Modal from "./ui/Modal";
import InfoTooltip from "./ui/InfoTooltip";
import { api } from "../services/api";
import { FIELD_DATA_TYPE_LABELS, FIELD_SOURCE_TYPE_LABELS } from "../constants";

const FACT_SCOPE_OPTIONS = [
  { value: "policy", label: "保单" },
  { value: "claim", label: "案件" },
  { value: "expense_item", label: "费用项" },
  { value: "insured", label: "被保险人" },
];

const FACT_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "启用" },
  { value: "DRAFT", label: "草稿" },
  { value: "DISABLED", label: "停用" },
];

const DOMAIN_OPTIONS = [
  { value: ExecutionDomain.ELIGIBILITY, label: "定责" },
  { value: ExecutionDomain.ASSESSMENT, label: "定损" },
  { value: ExecutionDomain.POST_PROCESS, label: "后处理" },
];

const FACT_ID_PATTERN = /^(policy|claim|expense_item|insured)\.[a-z0-9_]+$/;

function collectSchemaFactBindings(
  fields: NonNullable<ClaimsMaterial["schemaFields"]> = [],
  prefix = "",
): Array<{ fact_id: string; field_key: string }> {
  const bindings: Array<{ fact_id: string; field_key: string }> = [];
  fields.forEach((field) => {
    const key = String(field.field_key || "").trim();
    if (!key) return;
    const path = prefix ? `${prefix}.${key}` : key;
    if (field.fact_id) {
      bindings.push({ fact_id: field.fact_id, field_key: path });
    }
    if (field.data_type === "OBJECT" && field.children) {
      bindings.push(
        ...collectSchemaFactBindings(
          field.children as NonNullable<ClaimsMaterial["schemaFields"]>,
          path,
        ),
      );
    }
    if (field.data_type === "ARRAY" && field.item_fields) {
      bindings.push(
        ...collectSchemaFactBindings(
          field.item_fields as NonNullable<ClaimsMaterial["schemaFields"]>,
          `${path}[]`,
        ),
      );
    }
  });
  return bindings;
}

const emptyFact = (): FactCatalogField => ({
  fact_id: "claim.new_fact",
  label: "",
  description: "",
  data_type: "STRING",
  scope: "claim",
  source: "fact_catalog",
  source_type: "manual",
  applicable_domains: [ExecutionDomain.ELIGIBILITY],
  status: "DRAFT",
  required_evidence: false,
});

function getAllowedMaterialIds(
  fact: FactCatalogField,
  materials: ClaimsMaterial[],
) {
  if (fact.allowed_material_ids && fact.allowed_material_ids.length > 0) {
    return fact.allowed_material_ids;
  }
  if (
    fact.allowed_material_categories &&
    fact.allowed_material_categories.length > 0
  ) {
    return materials
      .filter(
        (material) =>
          material.category &&
          fact.allowed_material_categories?.includes(material.category),
      )
      .map((material) => material.id);
  }
  return [];
}

function validateFact(
  fact: FactCatalogField,
  materials: ClaimsMaterial[],
): string[] {
  const errors: string[] = [];

  if (!FACT_ID_PATTERN.test(fact.fact_id)) {
    errors.push(
      "fact_id 必须符合 `scope.field_name` 格式，例如 `claim.accident_date`。",
    );
  }
  if (!fact.label.trim()) {
    errors.push("字段名称不能为空。");
  }
  if (!FACT_SCOPE_OPTIONS.some((option) => option.value === fact.scope)) {
    errors.push("作用域必须从预设枚举中选择。");
  }
  if (!fact.applicable_domains.length) {
    errors.push("至少需要选择一个适用域。");
  }
  if (fact.source_type === "derived" && !fact.derivation?.trim()) {
    errors.push("派生事实必须填写派生逻辑。");
  }
  if (fact.source_type !== "derived" && fact.derivation?.trim()) {
    errors.push("只有派生事实可以填写派生逻辑。");
  }
  if (fact.source_type === "system" && !fact.system_source?.trim()) {
    errors.push("系统字段必须填写系统来源。");
  }
  if (fact.source_type !== "system" && fact.system_source?.trim()) {
    errors.push("只有系统字段可以填写系统来源。");
  }
  const allowedMaterialIds = getAllowedMaterialIds(fact, materials);
  if (fact.source_type === "material" && allowedMaterialIds.length === 0) {
    errors.push("材料字段至少需要选择一个允许绑定的理赔材料模板。");
  }
  if (
    fact.source_type !== "material" &&
    ((fact.allowed_material_ids || []).length > 0 ||
      (fact.allowed_material_categories || []).length > 0)
  ) {
    errors.push("只有材料字段可以设置允许绑定的理赔材料模板。");
  }

  const [scopePrefix] = fact.fact_id.split(".");
  if (scopePrefix && scopePrefix !== fact.scope) {
    errors.push("fact_id 前缀必须与作用域一致。");
  }

  return errors;
}

type MetadataTab = "all" | "material" | "derived" | "system" | "manual";

const METADATA_TABS: Array<{
  id: MetadataTab;
  label: string;
  description: string;
}> = [
  { id: "all", label: "全部", description: "所有元数据字段" },
  {
    id: "material",
    label: "材料提取",
    description:
      "从理赔材料（发票、病历、定损单等）中通过 OCR 或结构化解析提取的字段",
  },
  {
    id: "derived",
    label: "派生计算",
    description: "由其他基础字段经过公式或逻辑计算得出的字段",
  },
  {
    id: "system",
    label: "系统配置",
    description: "来自保单表、产品表等系统内部数据源的字段",
  },
  {
    id: "manual",
    label: "人工录入",
    description: "需要理赔员在工作台中手动填写的字段",
  },
];

const TAB_SOURCE_TYPE_MAP: Record<MetadataTab, string[]> = {
  all: [],
  material: ["material", "ocr"],
  derived: ["derived"],
  system: ["system"],
  manual: ["manual"],
};

const FactCatalogManagementPage: React.FC = () => {
  const [facts, setFacts] = useState<FactCatalogField[]>([]);
  const [materials, setMaterials] = useState<ClaimsMaterial[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<MetadataTab>("all");
  const [editing, setEditing] = useState<FactCatalogField | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchFacts = async () => {
      try {
        const [data, materialData] = await Promise.all([
          api.factCatalog.list(),
          api.claimsMaterials.list(),
        ]);
        setFacts(data as FactCatalogField[]);
        setMaterials(materialData as ClaimsMaterial[]);
      } catch (error) {
        console.error("Failed to fetch fact catalog:", error);
      }
    };
    void fetchFacts();
  }, []);

  const filtered = useMemo(() => {
    const sourceTypes = TAB_SOURCE_TYPE_MAP[activeTab];
    let result = facts;
    if (sourceTypes.length > 0) {
      result = result.filter((fact) =>
        sourceTypes.includes(fact.source_type || "manual"),
      );
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (fact) =>
          fact.fact_id.toLowerCase().includes(q) ||
          fact.label.toLowerCase().includes(q) ||
          (fact.description || "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [facts, search, activeTab]);

  const validationErrors = useMemo(
    () => (editing ? validateFact(editing, materials) : []),
    [editing, materials],
  );

  const persist = async (nextFacts: FactCatalogField[]) => {
    await api.factCatalog.saveAll(nextFacts as unknown as any[]);
    setFacts(nextFacts);
  };

  const handleSave = async () => {
    if (!editing) return;
    const errors = validateFact(editing, materials);
    if (errors.length > 0) {
      alert(errors[0]);
      return;
    }

    const normalized: FactCatalogField = {
      ...editing,
      derivation:
        editing.source_type === "derived"
          ? editing.derivation?.trim() || undefined
          : undefined,
      system_source:
        editing.source_type === "system"
          ? editing.system_source?.trim() || undefined
          : undefined,
      allowed_material_ids:
        editing.source_type === "material"
          ? getAllowedMaterialIds(editing, materials).filter(Boolean)
          : undefined,
      allowed_material_categories: undefined,
      source_refs: (editing.source_refs || []).filter(Boolean),
    };

    const nextFacts = facts.some((fact) => fact.fact_id === normalized.fact_id)
      ? facts.map((fact) =>
          fact.fact_id === normalized.fact_id ? normalized : fact,
        )
      : [normalized, ...facts];

    try {
      await persist(nextFacts);
      setOpen(false);
      setEditing(null);
    } catch (error) {
      console.error("Failed to save fact:", error);
      alert("保存失败");
    }
  };

  const isExistingFact = Boolean(
    editing && facts.some((fact) => fact.fact_id === editing.fact_id),
  );

  const tabCounts = useMemo(() => {
    const counts: Record<MetadataTab, number> = {
      all: facts.length,
      material: 0,
      derived: 0,
      system: 0,
      manual: 0,
    };
    for (const fact of facts) {
      const st = fact.source_type || "manual";
      if (st === "material" || st === "ocr") counts.material++;
      else if (st === "derived") counts.derived++;
      else if (st === "system") counts.system++;
      else counts.manual++;
    }
    return counts;
  }, [facts]);

  const activeTabMeta = METADATA_TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">元数据中心</h1>
          <p className="mt-1 text-sm text-slate-500">
            统一维护标准元数据字段。规则引擎、材料提取、系统来源都只能引用这里登记过的字段。
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(emptyFact());
            setOpen(true);
          }}
          className="rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-700"
        >
          新增元数据字段
        </button>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
        {METADATA_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-white text-brand-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === tab.id
                  ? "bg-brand-blue-50 text-brand-blue-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {tabCounts[tab.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Tab description */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <div className="font-medium">{activeTabMeta.label}</div>
        <div className="mt-1">{activeTabMeta.description}</div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索 fact_id / 名称 / 说明"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                元数据字段
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                类型
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                来源
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                适用域
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                材料引用
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                状态
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((fact) => (
              <tr key={fact.fact_id}>
                <td className="px-4 py-3">
                  <div className="flex items-center font-medium text-slate-900">
                    {fact.label}
                    <InfoTooltip
                      title={fact.label}
                      description={fact.description}
                      details={[
                        { label: "字段 ID", value: fact.fact_id },
                        {
                          label: "数据类型",
                          value:
                            FIELD_DATA_TYPE_LABELS[fact.data_type] ||
                            fact.data_type,
                        },
                        { label: "作用域", value: fact.scope },
                        {
                          label: "来源类型",
                          value:
                            FIELD_SOURCE_TYPE_LABELS[
                              fact.source_type || "manual"
                            ],
                        },
                        {
                          label: "适用域",
                          value: fact.applicable_domains.join(" / "),
                        },
                        ...(fact.derivation
                          ? [{ label: "派生逻辑", value: fact.derivation }]
                          : []),
                        ...(fact.system_source
                          ? [{ label: "系统来源", value: fact.system_source }]
                          : []),
                      ]}
                    />
                  </div>
                  <div className="text-xs text-slate-500">{fact.fact_id}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {FIELD_DATA_TYPE_LABELS[fact.data_type] || fact.data_type} ·{" "}
                  {fact.scope}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {FIELD_SOURCE_TYPE_LABELS[fact.source_type || "manual"]}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {fact.applicable_domains.join(" / ")}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {
                    materials.filter((material) =>
                      collectSchemaFactBindings(
                        (material.schemaFields || []) as NonNullable<
                          ClaimsMaterial["schemaFields"]
                        >,
                      ).some((binding) => binding.fact_id === fact.fact_id),
                    ).length
                  }{" "}
                  个材料
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {fact.status || "ACTIVE"}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => {
                      setEditing(fact);
                      setOpen(true);
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
        isOpen={open}
        onClose={() => setOpen(false)}
        title="元数据字段维护"
        width="max-w-3xl"
        isDirty={editing !== null}
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setOpen(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
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
        {editing && (
          <div className="space-y-5">
            {/* 基础信息 */}
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                基础信息
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputRow
                  label="fact_id"
                  value={editing.fact_id}
                  disabled={isExistingFact}
                  hint="格式：scope.field_name，例如 claim.accident_date"
                  onChange={(value) =>
                    setEditing({ ...editing, fact_id: value })
                  }
                />
                <InputRow
                  label="字段名称"
                  value={editing.label}
                  onChange={(value) => setEditing({ ...editing, label: value })}
                />
              </div>
              <div className="mt-4">
                <InputRow
                  label="说明"
                  value={editing.description || ""}
                  onChange={(value) =>
                    setEditing({ ...editing, description: value })
                  }
                />
              </div>
            </section>

            {/* 分类配置 */}
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                分类配置
              </div>
              <div className="grid grid-cols-4 gap-4">
                <SelectRow
                  label="作用域"
                  value={editing.scope}
                  onChange={(value) => {
                    const suffix = editing.fact_id.includes(".")
                      ? editing.fact_id.split(".").slice(1).join(".")
                      : "new_fact";
                    setEditing({
                      ...editing,
                      scope: value,
                      fact_id: `${value}.${suffix || "new_fact"}`,
                    });
                  }}
                  options={FACT_SCOPE_OPTIONS}
                />
                <SelectRow
                  label="数据类型"
                  value={editing.data_type}
                  onChange={(value) =>
                    setEditing({ ...editing, data_type: value })
                  }
                  options={Object.entries(FIELD_DATA_TYPE_LABELS).map(
                    ([value, label]) => ({ value, label }),
                  )}
                />
                <SelectRow
                  label="来源类型"
                  value={editing.source_type || "manual"}
                  onChange={(value) =>
                    setEditing({
                      ...editing,
                      source_type: value as FactCatalogField["source_type"],
                      derivation:
                        value === "derived" ? editing.derivation : undefined,
                      system_source:
                        value === "system" ? editing.system_source : undefined,
                      allowed_material_ids:
                        value === "material"
                          ? getAllowedMaterialIds(editing, materials)
                          : undefined,
                      allowed_material_categories: undefined,
                    })
                  }
                  options={Object.entries(FIELD_SOURCE_TYPE_LABELS).map(
                    ([value, label]) => ({ value, label }),
                  )}
                />
                <SelectRow
                  label="状态"
                  value={editing.status || "DRAFT"}
                  onChange={(value) =>
                    setEditing({
                      ...editing,
                      status: value as FactCatalogField["status"],
                    })
                  }
                  options={FACT_STATUS_OPTIONS}
                />
              </div>
              <div className="mt-4">
                <MultiSelectRow
                  label="适用域"
                  options={DOMAIN_OPTIONS}
                  values={editing.applicable_domains}
                  onChange={(values) =>
                    setEditing({ ...editing, applicable_domains: values })
                  }
                />
              </div>
            </section>

            {/* 来源配置（条件显示）*/}
            {(editing.source_type === "derived" ||
              editing.source_type === "system" ||
              editing.source_type === "material") && (
              <section className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-500">
                  来源配置
                </div>
                {editing.source_type === "derived" && (
                  <InputRow
                    label="派生逻辑"
                    value={editing.derivation || ""}
                    hint="说明该事实由哪些基础事实计算得出。"
                    onChange={(value) =>
                      setEditing({ ...editing, derivation: value })
                    }
                  />
                )}
                {editing.source_type === "system" && (
                  <InputRow
                    label="系统来源"
                    value={editing.system_source || ""}
                    hint="例如：产品表、保单表、责任配置。"
                    onChange={(value) =>
                      setEditing({ ...editing, system_source: value })
                    }
                  />
                )}
                {editing.source_type === "material" && (
                  <MultiSelectRow
                    label="允许绑定的理赔材料模板"
                    options={materials.map((material) => ({
                      value: material.id,
                      label: `${material.name} (${material.id})`,
                    }))}
                    values={getAllowedMaterialIds(editing, materials)}
                    onChange={(values) =>
                      setEditing({
                        ...editing,
                        allowed_material_ids: values,
                        allowed_material_categories: undefined,
                      })
                    }
                  />
                )}
              </section>
            )}

            {/* 引用信息 */}
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                引用信息
              </div>
              <div className="grid grid-cols-2 gap-4 items-end">
                <InputRow
                  label="来源登记"
                  value={(editing.source_refs || []).join(", ")}
                  hint="多个值用逗号分隔，记录来源编号或登记信息。"
                  onChange={(value) =>
                    setEditing({
                      ...editing,
                      source_refs: value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.required_evidence)}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        required_evidence: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 text-brand-blue-600"
                  />
                  需要材料证据
                </label>
              </div>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm font-medium text-slate-700">
                  材料 schema 绑定
                </div>
                <div className="mt-2 space-y-2">
                  {materials.filter((material) =>
                    collectSchemaFactBindings(
                      (material.schemaFields || []) as NonNullable<
                        ClaimsMaterial["schemaFields"]
                      >,
                    ).some((binding) => binding.fact_id === editing.fact_id),
                  ).length === 0 ? (
                    <div className="text-xs text-slate-500">
                      当前还没有材料字段映射到这个标准事实。
                    </div>
                  ) : (
                    materials
                      .filter((material) =>
                        collectSchemaFactBindings(
                          (material.schemaFields || []) as NonNullable<
                            ClaimsMaterial["schemaFields"]
                          >,
                        ).some(
                          (binding) => binding.fact_id === editing.fact_id,
                        ),
                      )
                      .map((material) => {
                        const bindings = collectSchemaFactBindings(
                          (material.schemaFields || []) as NonNullable<
                            ClaimsMaterial["schemaFields"]
                          >,
                        ).filter(
                          (binding) => binding.fact_id === editing.fact_id,
                        );
                        return (
                          <div
                            key={material.id}
                            className="rounded-md border border-white bg-white px-3 py-2"
                          >
                            <div className="text-sm font-medium text-slate-900">
                              {material.name}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              schema 字段：
                              {bindings
                                .map(
                                  (binding) =>
                                    binding.field_key ||
                                    binding.alias ||
                                    binding.fact_id.split(".").pop() ||
                                    binding.fact_id,
                                )
                                .join(" / ")}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </section>

            {validationErrors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-semibold text-amber-800">
                  保存前校验
                </div>
                <ul className="mt-2 space-y-1 text-sm text-amber-700">
                  {validationErrors.map((error) => (
                    <li key={error}>- {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

const InputRow: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, hint, disabled }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-gray-600">
      {label}
    </label>
    <input
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
    />
    {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
  </div>
);

const SelectRow: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}> = ({ label, value, onChange, options }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-gray-600">
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const MultiSelectRow: React.FC<{
  label: string;
  options: Array<{ value: string; label: string }>;
  values: string[];
  onChange: (values: string[]) => void;
}> = ({ label, options, values, onChange }) => (
  <div>
    <div className="mb-1 block text-xs font-medium text-gray-600">{label}</div>
    <div className="grid gap-2 rounded-lg border border-gray-300 p-3 md:grid-cols-2">
      {options.map((option) => {
        const checked = values.includes(option.value);
        return (
          <label
            key={option.value}
            className="flex items-center gap-2 text-sm text-gray-700"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...values, option.value]
                    : values.filter((value) => value !== option.value),
                )
              }
              className="rounded border-gray-300 text-brand-blue-600"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  </div>
);

export default FactCatalogManagementPage;
