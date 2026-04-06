import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../services/api";
import AIOperationResultCard from "./ai/AIOperationResultCard";
import InfoTooltip from "./ui/InfoTooltip";
import type {
  AICapabilityDefinition,
  AICapabilityBindingVersion,
  AIPromptVariable,
  AIProviderCatalogItem,
  AIPromptTemplate,
  AIPromptTemplateVersion,
  AISettingsSnapshot,
  ClaimsMaterial,
} from "../types";

// ─── Jinja 变量来源配置 ───────────────────────────────────────────────────────
const SOURCE_LABELS: Record<AIPromptVariable["source"], string> = {
  claim_case: "理赔案件",
  policy: "保单信息",
  document: "文档内容",
  system: "系统内置",
};

const SOURCE_COLORS: Record<AIPromptVariable["source"], string> = {
  claim_case: "text-blue-600 bg-blue-50",
  policy: "text-emerald-600 bg-emerald-50",
  document: "text-violet-600 bg-violet-50",
  system: "text-slate-500 bg-slate-100",
};

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/** 从模板内容中提取所有 {{varName}} 变量名 */
function extractTemplateVars(content: string): string[] {
  const matches = content.matchAll(/\{\{\s*(\w+)\s*\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

/** HTML 转义，防止高亮层 XSS */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 将 Jinja 语法染色，返回 HTML 字符串 */
function applyJinjaHighlight(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(
      /\{\{[\s\S]*?\}\}/g,
      (m) => `<span style="color:#93c5fd;font-weight:500">${m}</span>`,
    )
    .replace(
      /\{%-?[\s\S]*?-?%\}/g,
      (m) => `<span style="color:#fbbf24">${m}</span>`,
    )
    .replace(
      /\{#[\s\S]*?#\}/g,
      (m) => `<span style="color:#86efac">${m}</span>`,
    );
}

/** 用变量示例值渲染模板预览（简单替换，不处理控制流） */
function renderPreview(content: string, variables: AIPromptVariable[]): string {
  let result = content;
  for (const v of variables) {
    const regex = new RegExp(`\\{\\{\\s*${v.name}\\s*\\}\\}`, "g");
    result = result.replace(regex, `[${v.example}]`);
  }
  return result;
}

// ─── Jinja 高亮编辑器组件 ──────────────────────────────────────────────────────
interface JinjaEditorProps {
  value: string;
  onChange: (v: string) => void;
  onInsertRef?: (fn: (text: string) => void) => void;
}

const JinjaEditor: React.FC<JinjaEditorProps> = ({
  value,
  onChange,
  onInsertRef,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  const highlighted = applyJinjaHighlight(value);

  const syncScroll = useCallback(() => {
    if (highlightRef.current && textareaRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // 暴露插入函数给父组件，用于从变量目录点击插入
  useEffect(() => {
    if (!onInsertRef) return;
    onInsertRef((text: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = value.slice(0, start) + text + value.slice(end);
      onChange(next);
      // 延迟聚焦并设置光标位置
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + text.length, start + text.length);
      });
    });
  }, [onInsertRef, value, onChange]);

  const sharedStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
    fontSize: "0.8125rem",
    lineHeight: "1.6",
    padding: "12px 16px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowWrap: "break-word",
    tabSize: 2,
  };

  return (
    <div className="relative mt-4 min-h-[220px] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 focus-within:border-sky-500">
      {/* 高亮层 */}
      <pre
        ref={highlightRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-0 overflow-hidden text-slate-100"
        style={sharedStyle}
        dangerouslySetInnerHTML={{ __html: highlighted + "\n" }}
      />
      {/* 编辑层（透明文字，光标可见） */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
        className="relative z-10 min-h-[220px] w-full resize-y bg-transparent outline-none"
        style={{
          ...sharedStyle,
          color: "transparent",
          caretColor: "#e2e8f0",
        }}
      />
    </div>
  );
};

// ─── 变量目录侧栏组件 ──────────────────────────────────────────────────────────
interface VariableCatalogProps {
  variables: AIPromptVariable[];
  unknownVars: string[];
  onInsert: (snippet: string) => void;
}

const VariableCatalog: React.FC<VariableCatalogProps> = ({
  variables,
  unknownVars,
  onInsert,
}) => {
  const groups = useMemo(() => {
    const map = new Map<AIPromptVariable["source"], AIPromptVariable[]>();
    for (const v of variables) {
      const list = map.get(v.source) ?? [];
      list.push(v);
      map.set(v.source, list);
    }
    return map;
  }, [variables]);

  if (variables.length === 0 && unknownVars.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-400">
        此模板为静态提示词，无运行时变量。
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        可用变量
      </div>
      {[...groups.entries()].map(([source, vars]) => (
        <div key={source}>
          <div className="mb-1.5 text-xs font-medium text-slate-400">
            {SOURCE_LABELS[source]}
          </div>
          <div className="space-y-1">
            {vars.map((v) => (
              <div
                key={v.name}
                className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs text-sky-600">
                      {`{{${v.name}}}`}
                    </span>
                    <span
                      className={`rounded px-1 py-0.5 text-[10px] font-medium ${SOURCE_COLORS[v.source]}`}
                    >
                      {v.type}
                    </span>
                    {!v.required && (
                      <span className="rounded px-1 py-0.5 text-[10px] text-slate-400">
                        可选
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 leading-tight">
                    {v.description}
                  </div>
                </div>
                <button
                  type="button"
                  title="插入到光标处"
                  onClick={() => onInsert(`{{${v.name}}}`)}
                  className="shrink-0 rounded px-2 py-0.5 text-[10px] font-medium text-sky-600 opacity-0 transition hover:bg-sky-50 group-hover:opacity-100"
                >
                  插入
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {unknownVars.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-medium text-red-400">
            未定义变量（使用了但未在目录中声明）
          </div>
          <div className="space-y-1">
            {unknownVars.map((name) => (
              <div
                key={name}
                className="flex items-center gap-1.5 rounded-lg bg-red-50 px-2 py-1.5"
              >
                <span className="font-mono text-xs text-red-600">{`{{${name}}}`}</span>
                <span className="text-[10px] text-red-400">
                  未在变量目录中声明
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

type TabKey =
  | "overview"
  | "bindings"
  | "binding_history"
  | "templates"
  | "template_history"
  | "materials";
type AIConfigPreset = {
  activeTab?: TabKey;
  capabilityId?: string;
  templateId?: string;
  returnNavigation?: {
    view: "ruleset_management";
    rulesetId: string;
    productCode: string;
    targetView: "validation";
  };
};

const AI_CONFIG_PRESET_STORAGE_KEY = "ai_config_center_preset";

interface AIConfigCenterPageProps {
  currentUsername?: string;
}

const tabLabels: Record<TabKey, string> = {
  overview: "概览",
  bindings: "能力绑定",
  binding_history: "绑定历史",
  templates: "模板中心",
  template_history: "模板历史",
  materials: "材料模板",
};

const sectionCard = "rounded-2xl border border-slate-200 bg-white shadow-sm";

const stringifyDiffValue = (value: unknown) => {
  if (value === undefined || value === null) return "-";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const buildDiffRows = (leftValue: unknown, rightValue: unknown) => {
  const leftLines = stringifyDiffValue(leftValue).split("\n");
  const rightLines = stringifyDiffValue(rightValue).split("\n");
  const maxLength = Math.max(leftLines.length, rightLines.length);
  return Array.from({ length: maxLength }, (_, index) => {
    const leftLine = leftLines[index] ?? "";
    const rightLine = rightLines[index] ?? "";
    return {
      index,
      leftLine,
      rightLine,
      changed: leftLine !== rightLine,
    };
  });
};

const AIConfigCenterPage: React.FC<AIConfigCenterPageProps> = ({
  currentUsername,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [settings, setSettings] = useState<AISettingsSnapshot | null>(null);
  const [capabilities, setCapabilities] = useState<AICapabilityDefinition[]>(
    [],
  );
  const [providers, setProviders] = useState<AIProviderCatalogItem[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<AIPromptTemplate[]>(
    [],
  );
  const [materials, setMaterials] = useState<ClaimsMaterial[]>([]);
  const [materialSavingId, setMaterialSavingId] = useState<string>("");
  const [bindingHistory, setBindingHistory] = useState<
    AICapabilityBindingVersion[]
  >([]);
  const [promptHistory, setPromptHistory] = useState<AIPromptTemplateVersion[]>(
    [],
  );
  const [changeReason, setChangeReason] = useState<string>("");
  const [lastOperation, setLastOperation] = useState<any>(null);
  const [highlightCapabilityId, setHighlightCapabilityId] = useState("");
  const [highlightTemplateId, setHighlightTemplateId] = useState("");
  const [returnNavigation, setReturnNavigation] = useState<
    AIConfigPreset["returnNavigation"] | null
  >(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string>("");
  const [previewTemplateId, setPreviewTemplateId] = useState<string>("");
  // 每个模板的插入函数，由 JinjaEditor 通过 onInsertRef 注册
  const insertFnsRef = useRef<Map<string, (text: string) => void>>(new Map());
  // 已编辑但未保存的模板 ID 集合
  const [dirtyTemplateIds, setDirtyTemplateIds] = useState<Set<string>>(
    new Set(),
  );
  // 当前打开保存确认框的模板 ID（空字符串表示关闭）
  const [savingTemplateId, setSavingTemplateId] = useState<string>("");
  // 单模板保存时填写的变更原因
  const [templateSaveReason, setTemplateSaveReason] = useState<string>("");
  // 展开版本历史面板的模板 ID（空字符串表示全部收起）
  const [historyExpandedId, setHistoryExpandedId] = useState<string>("");

  useEffect(() => {
    try {
      const rawPreset = window.sessionStorage.getItem(
        AI_CONFIG_PRESET_STORAGE_KEY,
      );
      if (!rawPreset) return;
      const preset = JSON.parse(rawPreset) as AIConfigPreset;
      if (preset.activeTab) {
        setActiveTab(preset.activeTab);
      }
      if (preset.capabilityId) {
        setHighlightCapabilityId(preset.capabilityId);
      }
      if (preset.templateId) {
        setHighlightTemplateId(preset.templateId);
      }
      if (preset.returnNavigation) {
        setReturnNavigation(preset.returnNavigation);
      }
    } catch (error) {
      console.warn("Failed to parse AI config preset", error);
    } finally {
      window.sessionStorage.removeItem(AI_CONFIG_PRESET_STORAGE_KEY);
    }
  }, []);

  const navigateBackToRulesetValidation = () => {
    if (!returnNavigation) return;
    window.sessionStorage.setItem(
      "ruleset_management_search",
      returnNavigation.productCode,
    );
    window.sessionStorage.setItem(
      "ruleset_management_navigation",
      JSON.stringify({
        rulesetId: returnNavigation.rulesetId,
        productCode: returnNavigation.productCode,
        targetView: returnNavigation.targetView,
      }),
    );
    window.dispatchEvent(
      new CustomEvent("app:navigate", {
        detail: { view: returnNavigation.view },
      }),
    );
  };

  useEffect(() => {
    if (!highlightCapabilityId) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`ai-capability-${highlightCapabilityId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [activeTab, highlightCapabilityId]);

  useEffect(() => {
    if (!highlightTemplateId) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`ai-template-${highlightTemplateId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [activeTab, highlightTemplateId]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [
        inventoryResult,
        materialsResult,
        bindingHistoryResult,
        promptHistoryResult,
      ] = await Promise.all([
        api.ai.getInventory(),
        api.claimsMaterials.list(),
        api.ai.getBindingHistory(),
        api.ai.getPromptHistory(),
      ]);
      const nextSettings = inventoryResult.config as AISettingsSnapshot;
      setSettings(nextSettings);
      setCapabilities(inventoryResult.capabilities as AICapabilityDefinition[]);
      setProviders(nextSettings.providers || []);
      setPromptTemplates(nextSettings.promptTemplates || []);
      setMaterials(materialsResult as ClaimsMaterial[]);
      setBindingHistory(
        (bindingHistoryResult || []) as AICapabilityBindingVersion[],
      );
      setPromptHistory(
        (promptHistoryResult || []) as AIPromptTemplateVersion[],
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "加载 AI 配置失败",
      );
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

  const handleGenerationConfigChange = (
    capabilityId: string,
    field: "temperature" | "maxOutputTokens" | "topP",
    value: string,
  ) => {
    setCapabilities((current) =>
      current.map((capability) =>
        capability.id === capabilityId
          ? {
              ...capability,
              binding: {
                ...capability.binding,
                generationConfig: {
                  ...(capability.binding?.generationConfig || {}),
                  [field]: value === "" ? undefined : Number(value),
                },
              },
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
    setDirtyTemplateIds((prev) => new Set([...prev, templateId]));
  };

  const handleSaveTemplate = async (templateId: string, reason: string) => {
    const template = promptTemplates.find((t) => t.id === templateId);
    if (!template) return;
    setSaving(true);
    setError("");
    try {
      // 1. 持久化内容变更
      const payload = {
        capabilities,
        promptTemplates,
        providers,
        metadata: {
          updatedAt: new Date().toISOString(),
          updatedBy: currentUsername || "admin",
          changeReason: reason.trim() || "manual update",
        },
      };
      await api.ai.updateConfig(payload);

      // 2. 发布版本记录
      await api.ai.publishPrompt({
        templateId: template.id,
        content: template.content,
        variables: template.requiredVariables || [],
        applicableCapabilities: capabilities
          .filter(
            (c) =>
              c.promptTemplateId === template.id ||
              c.secondaryPromptTemplateId === template.id,
          )
          .map((c) => c.id),
        publishedBy: currentUsername || "admin",
        reason: reason.trim() || "manual update",
      });

      // 3. 刷新版本历史
      const nextHistory = await api.ai.getPromptHistory();
      setPromptHistory((nextHistory || []) as AIPromptTemplateVersion[]);

      // 4. 清除 dirty 标记
      setDirtyTemplateIds((prev) => {
        const next = new Set(prev);
        next.delete(templateId);
        return next;
      });

      setSuccessMessage(`"${template.name}" 已保存新版本`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "保存失败，请重试",
      );
    } finally {
      setSaving(false);
      setSavingTemplateId("");
      setTemplateSaveReason("");
    }
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
      const previousCapabilities = new Map(
        (settings?.capabilities || []).map((capability) => [
          capability.id,
          capability,
        ]),
      );
      const previousTemplates = new Map(
        (settings?.promptTemplates || []).map((template) => [
          template.id,
          template,
        ]),
      );
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
          changeReason: changeReason.trim() || "manual update",
        },
      };
      const updated = await api.ai.updateConfig(payload);
      const changedCapabilities = capabilities.filter((capability) => {
        const previous = previousCapabilities.get(capability.id);
        return (
          previous?.binding?.provider !== capability.binding.provider ||
          previous?.binding?.model !== capability.binding.model ||
          JSON.stringify(previous?.binding?.generationConfig || null) !==
            JSON.stringify(capability.binding?.generationConfig || null)
        );
      });
      const changedTemplates = promptTemplates.filter((template) => {
        const previous = previousTemplates.get(template.id);
        return previous?.content !== template.content;
      });

      await Promise.all([
        ...changedCapabilities.map((capability) =>
          api.ai.publishBinding({
            capabilityId: capability.id,
            binding: capability.binding,
            promptTemplateId: capability.promptTemplateId || null,
            generationConfig: capability.binding?.generationConfig || null,
            publishedBy: currentUsername || "admin",
            reason: changeReason.trim() || "manual update",
          }),
        ),
        ...changedTemplates.map((template) =>
          api.ai.publishPrompt({
            templateId: template.id,
            content: template.content,
            variables: template.requiredVariables || [],
            applicableCapabilities: capabilities
              .filter(
                (capability) =>
                  capability.promptTemplateId === template.id ||
                  capability.secondaryPromptTemplateId === template.id,
              )
              .map((capability) => capability.id),
            publishedBy: currentUsername || "admin",
            reason: changeReason.trim() || "manual update",
          }),
        ),
      ]);

      setSettings(updated);
      setProviders(updated.providers || []);
      setPromptTemplates(updated.promptTemplates || []);
      setCapabilities(updated.capabilities || []);
      const [nextBindingHistory, nextPromptHistory] = await Promise.all([
        api.ai.getBindingHistory(),
        api.ai.getPromptHistory(),
      ]);
      setBindingHistory(
        (nextBindingHistory || []) as AICapabilityBindingVersion[],
      );
      setPromptHistory((nextPromptHistory || []) as AIPromptTemplateVersion[]);
      setSuccessMessage("AI 配置已保存");
      setLastOperation({
        type: "保存 AI 配置",
        target: `${changedCapabilities.length} 个能力 / ${changedTemplates.length} 个模板`,
        detail: changeReason.trim() || "manual update",
        status: "success",
        timestamp: new Date().toISOString(),
      });
      setChangeReason("");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "保存 AI 配置失败",
      );
      setLastOperation({
        type: "保存 AI 配置",
        detail:
          saveError instanceof Error ? saveError.message : "保存 AI 配置失败",
        status: "error",
        timestamp: new Date().toISOString(),
      });
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
      setLastOperation({
        type: "保存材料模板",
        target: material.name,
        detail: "材料模板已更新。",
        status: "success",
        timestamp: new Date().toISOString(),
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "保存材料模板失败",
      );
      setLastOperation({
        type: "保存材料模板",
        target: material.name,
        detail:
          saveError instanceof Error ? saveError.message : "保存材料模板失败",
        status: "error",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setMaterialSavingId("");
    }
  };

  const handleRollbackBinding = async (entry: AICapabilityBindingVersion) => {
    setSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const nextCapabilities = capabilities.map((capability) =>
        capability.id === entry.capabilityId
          ? {
              ...capability,
              binding: {
                provider: entry.binding.provider,
                model: entry.binding.model,
                generationConfig: entry.generationConfig || {},
              },
              currentProvider: entry.binding.provider,
              currentModel: entry.binding.model,
            }
          : capability,
      );
      const updated = await api.ai.updateConfig({
        capabilities: nextCapabilities.map((capability) => ({
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
      });
      await api.ai.rollbackBinding({
        capabilityId: entry.capabilityId,
        version: entry.version,
        publishedBy: currentUsername || "admin",
        reason: "ui rollback",
      });
      setSettings(updated);
      setCapabilities(updated.capabilities || []);
      setBindingHistory(
        ((await api.ai.getBindingHistory()) ||
          []) as AICapabilityBindingVersion[],
      );
      setSuccessMessage(`已回滚能力绑定：${entry.capabilityId}`);
      setLastOperation({
        type: "回滚能力绑定",
        target: entry.capabilityId,
        detail: `${entry.binding.provider} / ${entry.binding.model}`,
        status: "success",
        timestamp: new Date().toISOString(),
      });
    } catch (rollbackError) {
      setError(
        rollbackError instanceof Error
          ? rollbackError.message
          : "回滚能力绑定失败",
      );
      setLastOperation({
        type: "回滚能力绑定",
        target: entry.capabilityId,
        detail:
          rollbackError instanceof Error
            ? rollbackError.message
            : "回滚能力绑定失败",
        status: "error",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRollbackPrompt = async (entry: AIPromptTemplateVersion) => {
    setSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const nextTemplates = promptTemplates.map((template) =>
        template.id === entry.templateId
          ? { ...template, content: entry.content }
          : template,
      );
      const updated = await api.ai.updateConfig({
        capabilities: capabilities.map((capability) => ({
          id: capability.id,
          binding: capability.binding,
        })),
        promptTemplates: nextTemplates.map((template) => ({
          id: template.id,
          content: template.content,
        })),
        metadata: {
          updatedBy: currentUsername || "admin",
        },
      });
      await api.ai.publishPrompt({
        templateId: entry.templateId,
        content: entry.content,
        variables: entry.variables || [],
        applicableCapabilities: entry.applicableCapabilities || [],
        publishedBy: currentUsername || "admin",
      });
      setSettings(updated);
      setPromptTemplates(updated.promptTemplates || []);
      setPromptHistory(
        ((await api.ai.getPromptHistory()) || []) as AIPromptTemplateVersion[],
      );
      // 回滚已自动发布新版本，清除 dirty 标记
      setDirtyTemplateIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.templateId);
        return next;
      });
      setSuccessMessage(`已回滚模板：${entry.templateId}`);
      setLastOperation({
        type: "回滚模板",
        target: entry.templateId,
        detail: `版本 ${entry.version}`,
        status: "success",
        timestamp: new Date().toISOString(),
      });
    } catch (rollbackError) {
      setError(
        rollbackError instanceof Error ? rollbackError.message : "回滚模板失败",
      );
      setLastOperation({
        type: "回滚模板",
        target: entry.templateId,
        detail:
          rollbackError instanceof Error
            ? rollbackError.message
            : "回滚模板失败",
        status: "error",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };

  const bindingHistoryMap = useMemo(() => {
    const map = new Map<string, AICapabilityBindingVersion[]>();
    bindingHistory.forEach((entry) => {
      const list = map.get(entry.capabilityId) || [];
      list.push(entry);
      map.set(entry.capabilityId, list);
    });
    return map;
  }, [bindingHistory]);

  const promptHistoryMap = useMemo(() => {
    const map = new Map<string, AIPromptTemplateVersion[]>();
    promptHistory.forEach((entry) => {
      const list = map.get(entry.templateId) || [];
      list.push(entry);
      map.set(entry.templateId, list);
    });
    return map;
  }, [promptHistory]);

  const renderSideBySideDiff = (
    title: string,
    leftValue: unknown,
    rightValue: unknown,
  ) => {
    const rows = buildDiffRows(leftValue, rightValue);
    if (!rows.some((row) => row.changed)) return null;
    return (
      <div className="mt-3 rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </div>
        <div className="grid gap-px bg-slate-200 lg:grid-cols-2">
          <div className="bg-white">
            <div className="border-b border-slate-200 px-3 py-2 text-xs font-medium text-slate-500">
              上一版
            </div>
            <div className="max-h-48 overflow-auto font-mono text-xs">
              {rows.map((row) => (
                <div
                  key={`${title}-left-${row.index}`}
                  className={`whitespace-pre-wrap break-all px-3 py-1.5 ${
                    row.changed
                      ? "bg-amber-50 text-slate-900"
                      : "bg-white text-slate-500"
                  }`}
                >
                  {row.leftLine || " "}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white">
            <div className="border-b border-slate-200 px-3 py-2 text-xs font-medium text-slate-500">
              当前版本
            </div>
            <div className="max-h-48 overflow-auto font-mono text-xs">
              {rows.map((row) => (
                <div
                  key={`${title}-right-${row.index}`}
                  className={`whitespace-pre-wrap break-all px-3 py-1.5 ${
                    row.changed
                      ? "bg-amber-50 text-slate-900"
                      : "bg-white text-slate-500"
                  }`}
                >
                  {row.rightLine || " "}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-500">正在加载 AI 配置中心...</div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eff6ff_45%,#fefce8_100%)] p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">
                AI Config Center
              </p>
              <h1 className="text-3xl font-semibold text-slate-900">
                AI 配置中心
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                平台全局管理模型服务商、能力绑定、中心提示词和材料模板。当前展示的是后端实时解析后的能力清单。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {returnNavigation ? (
                <button
                  type="button"
                  onClick={navigateBackToRulesetValidation}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
                >
                  返回规则验证页
                </button>
              ) : null}
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
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
            <label className="block text-sm font-medium text-slate-700">
              本次变更原因
            </label>
            <textarea
              value={changeReason}
              onChange={(event) => setChangeReason(event.target.value)}
              placeholder="填写本次模型切换、Prompt 调整或配置发布原因，便于版本追踪与回滚审计"
              className="mt-2 min-h-[88px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
            />
          </div>
        </div>

        <AIOperationResultCard title="最近配置操作" result={lastOperation} />

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
                <div className="mt-2 text-3xl font-semibold text-slate-900">
                  {capabilities.length}
                </div>
              </div>
              <div className={`${sectionCard} p-5`}>
                <div className="text-sm text-slate-500">可用 Provider</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">
                  {providers.filter((provider) => provider.available).length}
                </div>
              </div>
              <div className={`${sectionCard} p-5`}>
                <div className="text-sm text-slate-500">中心模板</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">
                  {promptTemplates.length}
                </div>
              </div>
            </div>

            <div className={`${sectionCard} overflow-hidden`}>
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  全仓 AI 环节清单
                </h2>
              </div>
              <div className="divide-y divide-slate-200">
                {capabilities.map((capability) => (
                  <div
                    key={capability.id}
                    className="grid gap-4 px-5 py-4 lg:grid-cols-[2fr,1fr,1fr]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-slate-900">
                          {capability.name}
                        </h3>
                        <InfoTooltip
                          title={capability.name}
                          description={capability.description}
                          details={[
                            { label: "能力 ID", value: capability.id },
                            { label: "分组", value: capability.group || "-" },
                            {
                              label: "支持 Provider",
                              value:
                                (capability.supportedProviders || []).join(
                                  "、",
                                ) || "-",
                            },
                            {
                              label: "Prompt 来源",
                              value: capability.promptSourceType || "-",
                            },
                            ...(capability.promptTemplateId
                              ? [
                                  {
                                    label: "模板 ID",
                                    value: capability.promptTemplateId,
                                  },
                                ]
                              : []),
                            ...(capability.lockReason
                              ? [
                                  {
                                    label: "锁定原因",
                                    value: capability.lockReason,
                                  },
                                ]
                              : []),
                          ]}
                          placement="bottom"
                        />
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {capability.id}
                        </span>
                        {!capability.editable ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                            固定能力
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {capability.description}
                      </p>
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
                      <div>
                        {capability.currentProvider ||
                          capability.binding.provider}
                      </div>
                      <div className="font-mono text-xs text-slate-500">
                        {capability.currentModel || capability.binding.model}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="font-medium text-slate-900">
                        Prompt 来源
                      </div>
                      <div>
                        {capability.promptSource?.type ||
                          capability.promptSourceType}
                      </div>
                      <div className="font-mono text-xs text-slate-500">
                        {capability.promptSource?.promptTemplateId ||
                          capability.promptTemplateId ||
                          "-"}
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
                  <h2 className="text-lg font-semibold text-slate-900">
                    {groupName}
                  </h2>
                </div>
                <div className="divide-y divide-slate-200">
                  {groupCapabilities.map((capability) => {
                    const currentProvider = providerMap.get(
                      capability.binding.provider,
                    );
                    return (
                      <div
                        key={capability.id}
                        id={`ai-capability-${capability.id}`}
                        className={`grid gap-4 px-5 py-4 lg:grid-cols-[1.4fr,1fr,1fr,1.2fr] ${
                          highlightCapabilityId === capability.id
                            ? "bg-amber-50 ring-1 ring-amber-300"
                            : ""
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-slate-900">
                              {capability.name}
                            </h3>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                              {capability.id}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {capability.description}
                          </p>
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
                              handleProviderChange(
                                capability.id,
                                event.target.value,
                              )
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
                                {!item.available
                                  ? `（缺少 ${item.missingEnvKeys?.join(", ")}）`
                                  : ""}
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
                            disabled={
                              capability.editable === false ||
                              !currentProvider?.supportsCustomModel
                            }
                            onChange={(event) =>
                              handleModelChange(
                                capability.id,
                                event.target.value,
                              )
                            }
                            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-900 disabled:bg-slate-100"
                          />
                          {currentProvider ? (
                            <p className="text-xs leading-5 text-slate-500">
                              默认模型：{currentProvider.defaultModel}
                              {currentProvider.available
                                ? ""
                                : `，缺少 ${currentProvider.missingEnvKeys?.join(", ")}`}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-3">
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Generation Config
                          </label>
                          <div className="grid gap-2">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="2"
                              value={
                                capability.binding?.generationConfig
                                  ?.temperature ?? ""
                              }
                              disabled={capability.editable === false}
                              onChange={(event) =>
                                handleGenerationConfigChange(
                                  capability.id,
                                  "temperature",
                                  event.target.value,
                                )
                              }
                              placeholder="Temperature"
                              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-900 disabled:bg-slate-100"
                            />
                            <input
                              type="number"
                              min="1"
                              value={
                                capability.binding?.generationConfig
                                  ?.maxOutputTokens ?? ""
                              }
                              disabled={capability.editable === false}
                              onChange={(event) =>
                                handleGenerationConfigChange(
                                  capability.id,
                                  "maxOutputTokens",
                                  event.target.value,
                                )
                              }
                              placeholder="Max Tokens"
                              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-900 disabled:bg-slate-100"
                            />
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="1"
                              value={
                                capability.binding?.generationConfig?.topP ?? ""
                              }
                              disabled={capability.editable === false}
                              onChange={(event) =>
                                handleGenerationConfigChange(
                                  capability.id,
                                  "topP",
                                  event.target.value,
                                )
                              }
                              placeholder="Top P"
                              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-900 disabled:bg-slate-100"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {activeTab === "templates" &&
          (() => {
            const currentTemplateId =
              activeTemplateId || promptTemplates[0]?.id || "";
            const currentTemplate = promptTemplates.find(
              (t) => t.id === currentTemplateId,
            );
            const templateVars: AIPromptVariable[] =
              currentTemplate?.variables ?? [];
            const usedVarNames = currentTemplate
              ? extractTemplateVars(currentTemplate.content)
              : [];
            const definedVarNames = new Set(templateVars.map((v) => v.name));
            const unknownVars = usedVarNames.filter(
              (n) => !definedVarNames.has(n),
            );
            const coveredCount = usedVarNames.filter((n) =>
              definedVarNames.has(n),
            ).length;
            const usedVarSet = new Set(usedVarNames);
            const totalDefined = templateVars.filter((v) => v.required).length;
            const allRequiredUsed =
              totalDefined === 0 ||
              templateVars.every((v) => !v.required || usedVarSet.has(v.name));

            const templateHistory = (
              promptHistoryMap.get(currentTemplateId) || []
            )
              .slice()
              .sort((a, b) => b.version - a.version)
              .slice(0, 10); // 最多显示 10 个版本

            const previewTemplate = promptTemplates.find(
              (t) => t.id === previewTemplateId,
            );

            return (
              <>
                {/* 预览 Modal */}
                {previewTemplate && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                    onClick={() => setPreviewTemplateId("")}
                  >
                    <div
                      className="relative max-h-[80vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            预览渲染效果
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-500">
                            以下是用示例值替换变量后的效果。
                            {`{% if %}`} 等控制块在实际运行时由后端 Jinja2
                            引擎处理。
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPreviewTemplateId("")}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          ✕
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap break-words p-6 font-mono text-sm leading-relaxed text-slate-800">
                        {renderPreview(
                          previewTemplate.content,
                          previewTemplate.variables ?? [],
                        )}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="grid gap-6 xl:grid-cols-[260px,1fr]">
                  {/* 左侧导航 */}
                  <div
                    className={`${sectionCard} divide-y divide-slate-200 self-start`}
                  >
                    {promptTemplates.map((template) => {
                      const isActive = template.id === currentTemplateId;
                      const vars = template.variables ?? [];
                      const used = extractTemplateVars(template.content);
                      const hasUnknown = used.some(
                        (n) => !vars.find((v) => v.name === n),
                      );
                      return (
                        <button
                          key={template.id}
                          id={`ai-template-nav-${template.id}`}
                          type="button"
                          onClick={() => {
                            setActiveTemplateId(template.id);
                            document
                              .getElementById(`ai-template-${template.id}`)
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                          }}
                          className={`w-full px-4 py-3 text-left transition ${
                            isActive
                              ? "bg-sky-50 border-l-2 border-sky-500"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-medium text-sm ${isActive ? "text-sky-700" : "text-slate-900"}`}
                            >
                              {template.name}
                            </span>
                            {hasUnknown && (
                              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                                变量缺失
                              </span>
                            )}
                            {template.templateEngine === "jinja2" &&
                              vars.length > 0 &&
                              !hasUnknown && (
                                <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-600">
                                  jinja2
                                </span>
                              )}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                            {template.id}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* 右侧编辑区 */}
                  {currentTemplate && (
                    <section
                      id={`ai-template-${currentTemplate.id}`}
                      className={`${sectionCard} p-5 ${
                        highlightTemplateId === currentTemplate.id
                          ? "ring-1 ring-amber-300 bg-amber-50/40"
                          : ""
                      }`}
                    >
                      {/* 头部 */}
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold text-slate-900">
                              {currentTemplate.name}
                            </h2>
                            {currentTemplate.templateEngine === "jinja2" ? (
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-600">
                                Jinja2
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                                纯文本
                              </span>
                            )}
                            <InfoTooltip
                              title={currentTemplate.name}
                              description={currentTemplate.description}
                              details={[
                                { label: "模板 ID", value: currentTemplate.id },
                                {
                                  label: "使用能力",
                                  value:
                                    capabilities
                                      .filter(
                                        (c) =>
                                          c.promptTemplateId ===
                                            currentTemplate.id ||
                                          c.secondaryPromptTemplateId ===
                                            currentTemplate.id,
                                      )
                                      .map((c) => c.name)
                                      .join("、") || "未绑定",
                                },
                              ]}
                              placement="bottom"
                            />
                          </div>
                          <div className="mt-1 font-mono text-xs text-slate-500">
                            {currentTemplate.id}
                          </div>
                          {currentTemplate.description && (
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {currentTemplate.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 编辑区：变量目录 + 高亮编辑器（jinja2 时展示） */}
                      {currentTemplate.templateEngine === "jinja2" &&
                      templateVars.length > 0 ? (
                        <div className="mt-4 grid gap-4 lg:grid-cols-[220px,1fr]">
                          <VariableCatalog
                            variables={templateVars}
                            unknownVars={unknownVars}
                            onInsert={(snippet) => {
                              const insertFn = insertFnsRef.current.get(
                                currentTemplate.id,
                              );
                              if (insertFn) insertFn(snippet);
                            }}
                          />
                          <div>
                            <JinjaEditor
                              value={currentTemplate.content}
                              onChange={(v) =>
                                handleTemplateChange(currentTemplate.id, v)
                              }
                              onInsertRef={(fn) => {
                                insertFnsRef.current.set(
                                  currentTemplate.id,
                                  fn,
                                );
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <JinjaEditor
                          value={currentTemplate.content}
                          onChange={(v) =>
                            handleTemplateChange(currentTemplate.id, v)
                          }
                          onInsertRef={(fn) => {
                            insertFnsRef.current.set(currentTemplate.id, fn);
                          }}
                        />
                      )}

                      {/* 底部状态栏 */}
                      <div className="mt-3 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          {/* 变量覆盖率 */}
                          {currentTemplate.templateEngine === "jinja2" &&
                          templateVars.length > 0 ? (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-500">
                                变量覆盖率：
                              </span>
                              <span
                                className={
                                  unknownVars.length > 0
                                    ? "font-medium text-red-600"
                                    : allRequiredUsed
                                      ? "font-medium text-emerald-600"
                                      : "font-medium text-amber-600"
                                }
                              >
                                {coveredCount}/{usedVarNames.length} 已定义
                              </span>
                              {unknownVars.length > 0 && (
                                <span className="text-red-500">
                                  ({unknownVars.length} 个未声明)
                                </span>
                              )}
                            </div>
                          ) : (
                            <div />
                          )}

                          <div className="flex items-center gap-2">
                            {/* 预览按钮 */}
                            {currentTemplate.templateEngine === "jinja2" &&
                              templateVars.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewTemplateId(currentTemplate.id)
                                  }
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-sky-600"
                                >
                                  预览渲染效果
                                </button>
                              )}
                            {/* 保存此版本按钮 */}
                            <button
                              type="button"
                              onClick={() => {
                                setSavingTemplateId(currentTemplate.id);
                                setTemplateSaveReason("");
                              }}
                              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium shadow-sm transition ${
                                dirtyTemplateIds.has(currentTemplate.id)
                                  ? "border border-sky-300 bg-sky-600 text-white hover:bg-sky-700"
                                  : "border border-slate-200 bg-white text-slate-400 hover:text-slate-600"
                              }`}
                            >
                              {dirtyTemplateIds.has(currentTemplate.id) && (
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-300" />
                              )}
                              保存此版本
                            </button>
                          </div>
                        </div>

                        {/* 保存确认内联框 */}
                        {savingTemplateId === currentTemplate.id && (
                          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                            <div className="mb-2 text-sm font-medium text-sky-900">
                              保存「{currentTemplate.name}」新版本
                            </div>
                            <textarea
                              value={templateSaveReason}
                              onChange={(e) =>
                                setTemplateSaveReason(e.target.value)
                              }
                              placeholder="填写本次修改的原因（可选，便于追溯）"
                              rows={2}
                              className="w-full resize-none rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-400"
                            />
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSavingTemplateId("");
                                  setTemplateSaveReason("");
                                }}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  void handleSaveTemplate(
                                    currentTemplate.id,
                                    templateSaveReason,
                                  )
                                }
                                className="rounded-xl bg-sky-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-sky-700 disabled:opacity-60"
                              >
                                {saving ? "保存中..." : "确认保存"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 内联版本历史 */}
                      {templateHistory.length > 0 && (
                        <div className="mt-4 border-t border-slate-200 pt-4">
                          <button
                            type="button"
                            onClick={() =>
                              setHistoryExpandedId(
                                historyExpandedId === currentTemplate.id
                                  ? ""
                                  : currentTemplate.id,
                              )
                            }
                            className="flex w-full items-center justify-between text-xs font-medium text-slate-500 hover:text-slate-700"
                          >
                            <span>
                              版本历史（{templateHistory.length} 个版本）
                            </span>
                            <span className="text-slate-400">
                              {historyExpandedId === currentTemplate.id
                                ? "▲ 收起"
                                : "▼ 展开"}
                            </span>
                          </button>

                          {historyExpandedId === currentTemplate.id && (
                            <div className="mt-3 space-y-2">
                              {templateHistory.map((entry, idx) => (
                                <div
                                  key={entry.id}
                                  className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${
                                    idx === 0
                                      ? "border border-emerald-200 bg-emerald-50"
                                      : "border border-slate-100 bg-slate-50"
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`font-mono text-xs font-semibold ${
                                          idx === 0
                                            ? "text-emerald-700"
                                            : "text-slate-600"
                                        }`}
                                      >
                                        v{entry.version}
                                      </span>
                                      {idx === 0 && (
                                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                          当前版本
                                        </span>
                                      )}
                                      <span className="text-[10px] text-slate-400">
                                        {new Date(
                                          entry.publishedAt,
                                        ).toLocaleString("zh-CN", {
                                          month: "2-digit",
                                          day: "2-digit",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        {entry.publishedBy}
                                      </span>
                                    </div>
                                    {entry.reason &&
                                      entry.reason !== "manual update" && (
                                        <div className="mt-0.5 text-[11px] text-slate-500">
                                          {entry.reason}
                                        </div>
                                      )}
                                  </div>
                                  {idx > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleRollbackPrompt(entry)
                                      }
                                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 transition hover:bg-slate-100"
                                    >
                                      回滚
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  )}
                </div>
              </>
            );
          })()}

        {activeTab === "binding_history" && (
          <div className="space-y-6">
            {capabilities.map((capability) => {
              const history = (bindingHistoryMap.get(capability.id) || [])
                .slice()
                .sort((a, b) => b.version - a.version);
              return (
                <section key={capability.id} className={`${sectionCard} p-5`}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {capability.name}
                      </h2>
                      <div className="mt-1 font-mono text-xs text-slate-500">
                        {capability.id}
                      </div>
                    </div>
                    <div className="text-sm text-slate-500">
                      当前：{capability.binding.provider}/
                      {capability.binding.model}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {history.length > 0 ? (
                      history.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          {(() => {
                            const previousEntry = history.find(
                              (item) => item.version === entry.version - 1,
                            );
                            return (
                              <>
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="font-medium text-slate-900">
                                      v{entry.version}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {entry.publishedAt} · {entry.publishedBy}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleRollbackBinding(entry)
                                    }
                                    className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                                  >
                                    回滚
                                  </button>
                                </div>
                                <div className="mt-3 text-sm text-slate-700">
                                  {entry.binding.provider}/{entry.binding.model}
                                </div>
                                <div className="mt-2 text-xs text-slate-500">
                                  原因：{entry.reason || "-"}
                                </div>
                                {previousEntry
                                  ? renderSideBySideDiff(
                                      "绑定差异",
                                      {
                                        provider:
                                          previousEntry.binding.provider,
                                        model: previousEntry.binding.model,
                                        generationConfig:
                                          previousEntry.generationConfig ||
                                          null,
                                        promptTemplateId:
                                          previousEntry.promptTemplateId ||
                                          null,
                                      },
                                      {
                                        provider: entry.binding.provider,
                                        model: entry.binding.model,
                                        generationConfig:
                                          entry.generationConfig || null,
                                        promptTemplateId:
                                          entry.promptTemplateId || null,
                                      },
                                    )
                                  : null}
                              </>
                            );
                          })()}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-500">暂无版本历史</div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {activeTab === "template_history" && (
          <div className="space-y-6">
            {promptTemplates.map((template) => {
              const history = (promptHistoryMap.get(template.id) || [])
                .slice()
                .sort((a, b) => b.version - a.version);
              return (
                <section key={template.id} className={`${sectionCard} p-5`}>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {template.name}
                    </h2>
                    <div className="mt-1 font-mono text-xs text-slate-500">
                      {template.id}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {history.length > 0 ? (
                      history.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          {(() => {
                            const previousEntry = history.find(
                              (item) => item.version === entry.version - 1,
                            );
                            return (
                              <>
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="font-medium text-slate-900">
                                      v{entry.version}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {entry.publishedAt} · {entry.publishedBy}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleRollbackPrompt(entry)
                                    }
                                    className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                                  >
                                    回滚
                                  </button>
                                </div>
                                <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
                                  {entry.content}
                                </pre>
                                <div className="mt-2 text-xs text-slate-500">
                                  原因：{entry.reason || "-"}
                                </div>
                                {previousEntry
                                  ? renderSideBySideDiff(
                                      "模板差异",
                                      previousEntry.content,
                                      entry.content,
                                    )
                                  : null}
                              </>
                            );
                          })()}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-500">
                        暂无模板版本历史
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {activeTab === "materials" && (
          <div className="space-y-6">
            {materials.map((material) => (
              <section key={material.id} className={`${sectionCard} p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">
                        {material.name}
                      </h2>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                        {material.id}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {material.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveMaterialTemplate(material)}
                    disabled={materialSavingId === material.id}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
                  >
                    {materialSavingId === material.id
                      ? "保存中..."
                      : "保存材料模板"}
                  </button>
                </div>
                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      AI 审核提示词
                    </label>
                    <textarea
                      value={material.aiAuditPrompt || ""}
                      onChange={(event) =>
                        handleMaterialChange(
                          material.id,
                          "aiAuditPrompt",
                          event.target.value,
                        )
                      }
                      className="min-h-[220px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      JSON Schema
                    </label>
                    <textarea
                      value={material.jsonSchema || ""}
                      onChange={(event) =>
                        handleMaterialChange(
                          material.id,
                          "jsonSchema",
                          event.target.value,
                        )
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
