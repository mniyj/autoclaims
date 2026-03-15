import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import type {
  AICapabilityDefinition,
  AIProviderCatalogItem,
  AIPromptTemplate,
  AISettingsSnapshot,
  ClaimsMaterial,
} from "../types";

type TabKey = "overview" | "bindings" | "templates" | "materials";

interface AIConfigCenterPageProps {
  currentUsername?: string;
}

const tabLabels: Record<TabKey, string> = {
  overview: "概览",
  bindings: "能力绑定",
  templates: "模板中心",
  materials: "材料模板",
};

const sectionCard = "rounded-2xl border border-slate-200 bg-white shadow-sm";

const AIConfigCenterPage: React.FC<AIConfigCenterPageProps> = ({ currentUsername }) => {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [settings, setSettings] = useState<AISettingsSnapshot | null>(null);
  const [capabilities, setCapabilities] = useState<AICapabilityDefinition[]>([]);
  const [providers, setProviders] = useState<AIProviderCatalogItem[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<AIPromptTemplate[]>([]);
  const [materials, setMaterials] = useState<ClaimsMaterial[]>([]);
  const [materialSavingId, setMaterialSavingId] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [inventoryResult, materialsResult] = await Promise.all([
        api.ai.getInventory(),
        api.claimsMaterials.list(),
      ]);
      const nextSettings = inventoryResult.config as AISettingsSnapshot;
      setSettings(nextSettings);
      setCapabilities(inventoryResult.capabilities as AICapabilityDefinition[]);
      setProviders(nextSettings.providers || []);
      setPromptTemplates(nextSettings.promptTemplates || []);
      setMaterials(materialsResult as ClaimsMaterial[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载 AI 配置失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const providerMap = useMemo(
    () => new Map(providers.map((provider) => [provider.id, provider])),
    [providers],
  );

  const capabilityGroups = useMemo(() => {
    const grouped = new Map<string, AICapabilityDefinition[]>();
    capabilities.forEach((capability) => {
      const list = grouped.get(capability.group) || [];
      list.push(capability);
      grouped.set(capability.group, list);
    });
    return Array.from(grouped.entries());
  }, [capabilities]);

  const handleProviderChange = (capabilityId: string, providerId: string) => {
    const provider = providerMap.get(providerId);
    setCapabilities((current) =>
      current.map((capability) => {
        if (capability.id !== capabilityId) return capability;
        return {
          ...capability,
          binding: {
            provider: providerId,
            model: provider?.defaultModel || capability.binding.model,
          },
          currentProvider: providerId,
          currentModel: provider?.defaultModel || capability.binding.model,
        };
      }),
    );
  };

  const handleModelChange = (capabilityId: string, model: string) => {
    setCapabilities((current) =>
      current.map((capability) =>
        capability.id === capabilityId
          ? {
              ...capability,
              binding: {
                ...capability.binding,
                model,
              },
              currentModel: model,
            }
          : capability,
      ),
    );
  };

  const handleTemplateChange = (templateId: string, content: string) => {
    setPromptTemplates((current) =>
      current.map((template) =>
        template.id === templateId ? { ...template, content } : template,
      ),
    );
  };

  const handleMaterialChange = (
    materialId: string,
    field: "aiAuditPrompt" | "jsonSchema",
    value: string,
  ) => {
    setMaterials((current) =>
      current.map((material) =>
        material.id === materialId ? { ...material, [field]: value } : material,
      ),
    );
  };

  const saveConfig = async () => {
    setSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const payload = {
        capabilities: capabilities.map((capability) => ({
          id: capability.id,
          binding: capability.binding,
        })),
        promptTemplates: promptTemplates.map((template) => ({
          id: template.id,
          content: template.content,
        })),
        metadata: {
          updatedBy: currentUsername || "admin",
        },
      };
      const updated = await api.ai.updateConfig(payload);
      setSettings(updated);
      setProviders(updated.providers || []);
      setPromptTemplates(updated.promptTemplates || []);
      setCapabilities(updated.capabilities || []);
      setSuccessMessage("AI 配置已保存");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存 AI 配置失败");
    } finally {
      setSaving(false);
    }
  };

  const saveMaterialTemplate = async (material: ClaimsMaterial) => {
    setMaterialSavingId(material.id);
    setError("");
    setSuccessMessage("");
    try {
      await api.claimsMaterials.update(material.id, {
        aiAuditPrompt: material.aiAuditPrompt || "",
        jsonSchema: material.jsonSchema,
      });
      setSuccessMessage(`已保存材料模板：${material.name}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存材料模板失败");
    } finally {
      setMaterialSavingId("");
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">正在加载 AI 配置中心...</div>;
  }

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eff6ff_45%,#fefce8_100%)] p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">AI Config Center</p>
              <h1 className="text-3xl font-semibold text-slate-900">AI 配置中心</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                平台全局管理模型服务商、能力绑定、中心提示词和材料模板。当前展示的是后端实时解析后的能力清单。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
                最近更新：{settings?.metadata?.updatedAt || "-"}
              </div>
              <button
                type="button"
                onClick={() => void loadData()}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                刷新
              </button>
              <button
                type="button"
                onClick={() => void saveConfig()}
                disabled={saving}
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "保存中..." : "保存 AI 配置"}
              </button>
            </div>
          </div>
          {(error || successMessage) && (
            <div className="mt-4 flex flex-col gap-2">
              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
              {successMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {successMessage}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(tabLabels) as TabKey[]).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTab(tabKey)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tabKey
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tabLabels[tabKey]}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className={`${sectionCard} p-5`}>
                <div className="text-sm text-slate-500">能力总数</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{capabilities.length}</div>
              </div>
              <div className={`${sectionCard} p-5`}>
                <div className="text-sm text-slate-500">可用 Provider</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">
                  {providers.filter((provider) => provider.available).length}
                </div>
              </div>
              <div className={`${sectionCard} p-5`}>
                <div className="text-sm text-slate-500">中心模板</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{promptTemplates.length}</div>
              </div>
            </div>

            <div className={`${sectionCard} overflow-hidden`}>
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">全仓 AI 环节清单</h2>
              </div>
              <div className="divide-y divide-slate-200">
                {capabilities.map((capability) => (
                  <div key={capability.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[2fr,1fr,1fr]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-slate-900">{capability.name}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {capability.id}
                        </span>
                        {!capability.editable ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                            固定能力
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{capability.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(capability.codeLocations || []).map((location) => (
                          <span
                            key={location}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500"
                          >
                            {location}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="font-medium text-slate-900">当前绑定</div>
                      <div>{capability.currentProvider || capability.binding.provider}</div>
                      <div className="font-mono text-xs text-slate-500">
                        {capability.currentModel || capability.binding.model}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="font-medium text-slate-900">Prompt 来源</div>
                      <div>{capability.promptSource?.type || capability.promptSourceType}</div>
                      <div className="font-mono text-xs text-slate-500">
                        {capability.promptSource?.promptTemplateId || capability.promptTemplateId || "-"}
                      </div>
                      {!capability.editable && capability.lockReason ? (
                        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          {capability.lockReason}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "bindings" && (
          <div className="space-y-6">
            {capabilityGroups.map(([groupName, groupCapabilities]) => (
              <section key={groupName} className={sectionCard}>
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="text-lg font-semibold text-slate-900">{groupName}</h2>
                </div>
                <div className="divide-y divide-slate-200">
                  {groupCapabilities.map((capability) => {
                    const currentProvider = providerMap.get(capability.binding.provider);
                    return (
                      <div key={capability.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.4fr,1fr,1fr]">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-slate-900">{capability.name}</h3>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                              {capability.id}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{capability.description}</p>
                          {capability.lockReason ? (
                            <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                              {capability.lockReason}
                            </div>
                          ) : null}
                        </div>
                        <div className="space-y-3">
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Provider
                          </label>
                          <select
                            value={capability.binding.provider}
                            disabled={capability.editable === false}
                            onChange={(event) =>
                              handleProviderChange(capability.id, event.target.value)
                            }
                            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-900 disabled:bg-slate-100"
                          >
                            {capability.supportMatrix?.map((item) => (
                              <option
                                key={item.providerId}
                                value={item.providerId}
                                disabled={!item.available}
                              >
                                {item.providerName}
                                {!item.available ? `（缺少 ${item.missingEnvKeys?.join(", ")}）` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-3">
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Model
                          </label>
                          <input
                            type="text"
                            value={capability.binding.model}
                            disabled={capability.editable === false || !currentProvider?.supportsCustomModel}
                            onChange={(event) => handleModelChange(capability.id, event.target.value)}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-900 disabled:bg-slate-100"
                          />
                          {currentProvider ? (
                            <p className="text-xs leading-5 text-slate-500">
                              默认模型：{currentProvider.defaultModel}
                              {currentProvider.available ? "" : `，缺少 ${currentProvider.missingEnvKeys?.join(", ")}`}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {activeTab === "templates" && (
          <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
            <div className={`${sectionCard} divide-y divide-slate-200`}>
              {promptTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setActiveTab("templates")}
                  className="w-full px-5 py-4 text-left transition hover:bg-slate-50"
                >
                  <div className="font-medium text-slate-900">{template.name}</div>
                  <div className="mt-1 font-mono text-xs text-slate-500">{template.id}</div>
                </button>
              ))}
            </div>
            <div className="space-y-6">
              {promptTemplates.map((template) => (
                <section key={template.id} className={`${sectionCard} p-5`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{template.name}</h2>
                      <div className="mt-1 font-mono text-xs text-slate-500">{template.id}</div>
                      {template.description ? (
                        <p className="mt-2 text-sm leading-6 text-slate-600">{template.description}</p>
                      ) : null}
                    </div>
                    {template.requiredVariables?.length ? (
                      <div className="max-w-sm rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                        必需占位变量：{template.requiredVariables.join(", ")}
                      </div>
                    ) : null}
                  </div>
                  <textarea
                    value={template.content}
                    onChange={(event) => handleTemplateChange(template.id, event.target.value)}
                    className="mt-4 min-h-[220px] w-full rounded-2xl border border-slate-300 bg-slate-950 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition focus:border-sky-400"
                  />
                </section>
              ))}
            </div>
          </div>
        )}

        {activeTab === "materials" && (
          <div className="space-y-6">
            {materials.map((material) => (
              <section key={material.id} className={`${sectionCard} p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">{material.name}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                        {material.id}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{material.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveMaterialTemplate(material)}
                    disabled={materialSavingId === material.id}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
                  >
                    {materialSavingId === material.id ? "保存中..." : "保存材料模板"}
                  </button>
                </div>
                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">AI 审核提示词</label>
                    <textarea
                      value={material.aiAuditPrompt || ""}
                      onChange={(event) =>
                        handleMaterialChange(material.id, "aiAuditPrompt", event.target.value)
                      }
                      className="min-h-[220px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">JSON Schema</label>
                    <textarea
                      value={material.jsonSchema || ""}
                      onChange={(event) =>
                        handleMaterialChange(material.id, "jsonSchema", event.target.value)
                      }
                      className="min-h-[220px] w-full rounded-2xl border border-slate-300 bg-slate-950 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition focus:border-sky-400"
                    />
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIConfigCenterPage;
