import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import AIProviderStatusBadge from "./ai/AIProviderStatusBadge";
import AIStatsSnapshotCard from "./ai/AIStatsSnapshotCard";
import AIOperationResultCard from "./ai/AIOperationResultCard";

const BUDGET_SCOPE_TYPES = [
  "GLOBAL",
  "GROUP",
  "CAPABILITY",
  "MODULE",
  "COMPANY",
  "PROVIDER",
  "MODEL",
];
const AI_MODEL_MANAGEMENT_PRESET_STORAGE_KEY = "ai-model-management-preset";
const PROVIDER_RUNTIME_OPTIONS = [
  {
    value: "gemini",
    label: "Gemini Runtime",
    type: "text",
    billingMode: "token",
    envKeys: ["GEMINI_API_KEY", "API_KEY"],
  },
  {
    value: "openai-text",
    label: "OpenAI Compatible",
    type: "text",
    billingMode: "token",
    envKeys: ["OPENAI_API_KEY"],
  },
  {
    value: "claude-text",
    label: "Claude Runtime",
    type: "text",
    billingMode: "token",
    envKeys: ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY"],
  },
  {
    value: "glm-text",
    label: "GLM Text Runtime",
    type: "text",
    billingMode: "token",
    envKeys: ["GLM_OCR_API_KEY", "ZHIPU_API_KEY"],
  },
  {
    value: "qwen-text",
    label: "Qwen Runtime",
    type: "text",
    billingMode: "token",
    envKeys: ["QWEN_API_KEY", "DASHSCOPE_API_KEY"],
  },
  {
    value: "deepseek-text",
    label: "DeepSeek Runtime",
    type: "text",
    billingMode: "token",
    envKeys: ["DEEPSEEK_API_KEY"],
  },
  {
    value: "glm-ocr",
    label: "GLM OCR Runtime",
    type: "ocr",
    billingMode: "page",
    envKeys: ["GLM_OCR_API_KEY", "ZHIPU_API_KEY"],
  },
  {
    value: "paddle-ocr",
    label: "Paddle OCR Runtime",
    type: "ocr",
    billingMode: "page",
    envKeys: [],
  },
];

function formatStatsSummary(summary: any) {
  if (!summary) return "";
  const parts = [
    `重建完成：${summary.days ?? 0} 天`,
    `${summary.totalCalls ?? 0} 次调用`,
    `${summary.successCalls ?? 0} 成功`,
    `${summary.failedCalls ?? 0} 失败`,
  ];
  if (summary.dateRange?.start || summary.dateRange?.end) {
    parts.push(
      `范围 ${summary.dateRange?.start || "-"} ~ ${summary.dateRange?.end || "-"}`,
    );
  }
  return parts.join(" · ");
}

function formatConsistencyReportSummary(report: any) {
  if (!report?.checkedAt) return "-";
  return `${new Date(report.checkedAt).toLocaleString("zh-CN", { hour12: false })} · ${report.success ? "通过" : "失败"}`;
}

function getCurrentActor() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "admin";
    const user = JSON.parse(raw);
    return user?.id || user?.username || user?.name || "admin";
  } catch {
    return "admin";
  }
}

const AIModelManagementPage: React.FC = () => {
  const [providers, setProviders] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [highlightedProviderId, setHighlightedProviderId] =
    useState<string>("");
  const [savingPricing, setSavingPricing] = useState(false);
  const [savingBudgets, setSavingBudgets] = useState(false);
  const [rebuildingStats, setRebuildingStats] = useState(false);
  const [message, setMessage] = useState("");
  const [savingModelCatalog, setSavingModelCatalog] = useState(false);
  const [statsRebuildSummary, setStatsRebuildSummary] = useState<any>(null);
  const [statsOverview, setStatsOverview] = useState<any>(null);
  const [storageStatus, setStorageStatus] = useState<any>(null);
  const [consistencyMonitor, setConsistencyMonitor] = useState<any>(null);
  const [latestManualConsistencyReport, setLatestManualConsistencyReport] =
    useState<any>(null);
  const [latestAutoConsistencyReport, setLatestAutoConsistencyReport] =
    useState<any>(null);
  const [lastRebuildDurationMs, setLastRebuildDurationMs] = useState<
    number | null
  >(null);
  const [lastOperation, setLastOperation] = useState<any>(null);
  const [checkingProviders, setCheckingProviders] = useState<Set<string>>(
    new Set(),
  );
  const [providerCheckResults, setProviderCheckResults] = useState<
    Map<string, { status: "success" | "error"; detail: string }>
  >(new Map());
  const [selectedCapabilityIds, setSelectedCapabilityIds] = useState<string[]>(
    [],
  );
  const [modelBindingReason, setModelBindingReason] = useState<string>("");
  const [newProvider, setNewProvider] = useState<any>({
    id: "",
    name: "",
    runtime: "openai-text",
    type: "text",
    billingMode: "token",
    defaultModel: "",
    supportsCustomModel: true,
    envKeys: "OPENAI_API_KEY",
    defaultTimeout: 90000,
    retryMaxRetries: 1,
    retryBackoffMs: 1000,
  });
  const [newModel, setNewModel] = useState<any>({
    providerId: "",
    modelId: "",
    displayName: "",
    type: "text",
    contextLength: 128000,
    supportsImages: false,
    supportsTools: true,
    supportsJsonMode: true,
    supportsStreaming: true,
    billingMode: "token",
    inputPer1M: 0,
    outputPer1M: 0,
    currency: "USD",
    effectiveDate: new Date().toISOString().slice(0, 10),
  });

  const loadData = () => {
    Promise.all([
      api.ai.getProviders(),
      api.ai.getModels(),
      api.ai.getProviderHealth(),
      api.ai.getPricingRules(),
      api.ai.getBudgets(),
      api.ai.getCapabilities(),
      api.companies.list().catch(() => []),
    ])
      .then(
        ([
          providerList,
          modelList,
          healthList,
          pricingList,
          budgetList,
          capabilityList,
          companyList,
        ]) => {
          setProviders(providerList);
          setModels(modelList);
          setHealth(healthList);
          setPricingRules(pricingList);
          setBudgets(budgetList);
          setCapabilities(capabilityList);
          setCompanies(companyList);
        },
      )
      .catch(console.error);
  };

  useEffect(() => {
    loadData();
    api.ai.getStatsOverview().then(setStatsOverview).catch(console.error);
    api.ai.getStorageStatus().then(setStorageStatus).catch(console.error);
    api.ai
      .getConsistencyChecks(10)
      .then((result) => {
        setConsistencyMonitor(result?.monitor || null);
        const reports = result?.reports || [];
        setLatestManualConsistencyReport(
          reports.find(
            (item: any) => (item?.trigger || "manual") === "manual",
          ) || null,
        );
        setLatestAutoConsistencyReport(
          reports.find(
            (item: any) => (item?.trigger || "manual") !== "manual",
          ) || null,
        );
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    try {
      const rawPreset = sessionStorage.getItem(
        AI_MODEL_MANAGEMENT_PRESET_STORAGE_KEY,
      );
      if (!rawPreset) return;
      const preset = JSON.parse(rawPreset);
      sessionStorage.removeItem(AI_MODEL_MANAGEMENT_PRESET_STORAGE_KEY);
      if (preset.providerId) {
        setHighlightedProviderId(String(preset.providerId));
      }
      if (preset.focusAction === "rebuild_stats") {
        setMessage("已从 AI 巡检建议跳转，可直接重建统计快照。");
        setLastOperation({
          type: "巡检建议",
          target: "ai-stats-daily",
          detail: "当前快照可能滞后或不一致，建议先执行一次重建统计快照。",
          status: "info",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Failed to restore AI model management preset:", error);
      sessionStorage.removeItem(AI_MODEL_MANAGEMENT_PRESET_STORAGE_KEY);
    }
  }, []);

  const healthMap = new Map(health.map((item) => [item.providerId, item]));
  const pricingMap = new Map(
    pricingRules.map((item) => [`${item.providerId}:${item.modelId}`, item]),
  );
  const displayPricingRules = useMemo(
    () =>
      providers.flatMap((provider) =>
        (provider.availableModels || [provider.defaultModel]).map(
          (model: string) => {
            const key = `${provider.id}:${model}`;
            return (
              pricingMap.get(key) || {
                id: `${provider.id}:${model}:${new Date().toISOString().slice(0, 10)}`,
                providerId: provider.id,
                modelId: model,
                billingMode: provider.billingMode || "token",
                currency: "USD",
                inputPer1M: 0,
                outputPer1M: 0,
                effectiveDate: new Date().toISOString().slice(0, 10),
              }
            );
          },
        ),
      ),
    [providers, pricingMap],
  );

  const displayProviders = useMemo(() => {
    if (!highlightedProviderId) return providers;
    return [...providers].sort((a, b) => {
      if (a.id === highlightedProviderId) return -1;
      if (b.id === highlightedProviderId) return 1;
      return String(a.name || a.id).localeCompare(
        String(b.name || b.id),
        "zh-CN",
      );
    });
  }, [highlightedProviderId, providers]);

  const capabilityOptions = useMemo(
    () =>
      capabilities
        .map((item) => ({
          value: item.id,
          label: `${item.id}${item.group ? ` · ${item.group}` : ""}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "zh-CN")),
    [capabilities],
  );

  const groupOptions = useMemo(
    () =>
      Array.from(
        new Set(capabilities.map((item) => item.group).filter(Boolean)),
      )
        .sort((a, b) => String(a).localeCompare(String(b), "zh-CN"))
        .map((item) => ({ value: item, label: item })),
    [capabilities],
  );

  const moduleOptions = useMemo(
    () =>
      Array.from(
        new Set(capabilities.map((item) => item.module).filter(Boolean)),
      )
        .sort((a, b) => String(a).localeCompare(String(b), "zh-CN"))
        .map((item) => ({ value: item, label: item })),
    [capabilities],
  );

  const companyOptions = useMemo(
    () =>
      companies
        .map((item) => {
          const companyId =
            item.code || item.id || item.basicInfo?.companyCode || "";
          const companyName =
            item.shortName ||
            item.fullName ||
            item.basicInfo?.companyName ||
            companyId;
          return {
            value: companyId,
            label: companyName
              ? `${companyName}${companyId && companyId !== companyName ? ` (${companyId})` : ""}`
              : companyId,
          };
        })
        .filter((item) => item.value)
        .sort((a, b) => a.label.localeCompare(b.label, "zh-CN")),
    [companies],
  );

  const providerOptions = useMemo(
    () =>
      providers.map((provider) => ({
        value: provider.id,
        label: provider.name || provider.id,
      })),
    [providers],
  );
  const textProviderOptions = useMemo(
    () =>
      providerOptions.filter((item) =>
        String(item.value || "").includes("-text"),
      ),
    [providerOptions],
  );
  const eligibleCapabilitiesForNewModel = useMemo(
    () =>
      capabilities
        .filter((item) =>
          (item.supportedProviders || []).includes(newModel.providerId),
        )
        .sort((a, b) =>
          String(a.id || "").localeCompare(String(b.id || ""), "zh-CN"),
        ),
    [capabilities, newModel.providerId],
  );
  const modelsByProvider = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const model of models) {
      const list = map.get(model.providerId) || [];
      list.push(model);
      map.set(model.providerId, list);
    }
    return map;
  }, [models]);

  const modelOptions = useMemo(
    () =>
      Array.from(
        new Set(
          providers.flatMap((provider) =>
            (provider.availableModels || [provider.defaultModel])
              .filter(Boolean)
              .map((model: string) => `${provider.id}:${model}`),
          ),
        ),
      )
        .sort((a, b) => a.localeCompare(b, "zh-CN"))
        .map((value) => ({ value, label: value })),
    [providers],
  );

  const scopeOptionsByType = useMemo(
    () => ({
      GLOBAL: [],
      GROUP: groupOptions,
      CAPABILITY: capabilityOptions,
      MODULE: moduleOptions,
      COMPANY: companyOptions,
      PROVIDER: providerOptions,
      MODEL: modelOptions,
    }),
    [
      capabilityOptions,
      companyOptions,
      groupOptions,
      modelOptions,
      moduleOptions,
      providerOptions,
    ],
  );

  const handlePricingChange = (
    providerId: string,
    modelId: string,
    field: string,
    value: string,
  ) => {
    setPricingRules((current) =>
      current.map((rule) =>
        rule.providerId === providerId && rule.modelId === modelId
          ? { ...rule, [field]: value === "" ? null : Number(value) }
          : rule,
      ),
    );
  };

  const handleBudgetChange = (index: number, field: string, value: string) => {
    setBudgets((current) =>
      current.map((budget, budgetIndex) =>
        budgetIndex === index
          ? {
              ...budget,
              ...(field === "scopeType"
                ? { scopeId: value === "GLOBAL" ? "" : budget.scopeId || "" }
                : {}),
              [field]:
                field === "budgetAmount"
                  ? Number(value)
                  : field === "alertThresholds"
                    ? value
                        .split(",")
                        .map((item) => Number(item.trim()))
                        .filter((item) => !Number.isNaN(item))
                    : value,
            }
          : budget,
      ),
    );
  };

  const addBudget = () => {
    setBudgets((current) => [
      ...current,
      {
        id: `budget-${Date.now()}`,
        scopeType: "GLOBAL",
        scopeId: "",
        periodType: "daily",
        budgetAmount: 10,
        currency: "USD",
        alertThresholds: [0.7, 0.9, 1],
        actionType: "notify_only",
        status: "active",
      },
    ]);
  };

  const removeBudget = (index: number) => {
    setBudgets((current) =>
      current.filter((_, budgetIndex) => budgetIndex !== index),
    );
  };

  const toggleBudgetStatus = (index: number) => {
    setBudgets((current) =>
      current.map((budget, budgetIndex) =>
        budgetIndex === index
          ? {
              ...budget,
              status: budget.status === "paused" ? "active" : "paused",
            }
          : budget,
      ),
    );
  };

  const getScopeOptions = (scopeType: string) =>
    scopeOptionsByType[scopeType as keyof typeof scopeOptionsByType] || [];
  const periodOptions = ["daily", "monthly"];
  const actionOptions = ["notify_only", "soft_block", "hard_block"];
  const statusOptions = ["active", "paused"];

  const savePricing = async () => {
    setSavingPricing(true);
    setMessage("");
    try {
      await api.ai.updatePricingRules(displayPricingRules);
      setPricingRules(displayPricingRules);
      setMessage("定价规则已保存");
      setLastOperation({
        type: "保存定价",
        target: `${displayPricingRules.length} 个模型`,
        detail: "模型定价规则已更新。",
        status: "success",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存定价失败");
      setLastOperation({
        type: "保存定价",
        detail: error instanceof Error ? error.message : "保存定价失败",
        status: "error",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSavingPricing(false);
    }
  };

  const registerModel = async () => {
    if (!newModel.providerId || !newModel.modelId || !newModel.displayName) {
      setMessage("请先填写 provider、模型 ID 和展示名称");
      return;
    }
    setSavingModelCatalog(true);
    setMessage("");
    try {
      const nextModels = [
        ...models.filter(
          (item) =>
            !(
              item.providerId === newModel.providerId &&
              item.modelId === newModel.modelId
            ),
        ),
        {
          providerId: newModel.providerId,
          modelId: newModel.modelId,
          displayName: newModel.displayName,
          type: newModel.type,
          contextLength: Number(newModel.contextLength || 0),
          supportsImages: Boolean(newModel.supportsImages),
          supportsTools: Boolean(newModel.supportsTools),
          supportsJsonMode: Boolean(newModel.supportsJsonMode),
          supportsStreaming: Boolean(newModel.supportsStreaming),
          deprecated: false,
        },
      ];
      const nextPricingRules = [
        ...pricingRules.filter(
          (item) =>
            !(
              item.providerId === newModel.providerId &&
              item.modelId === newModel.modelId
            ),
        ),
        {
          id: `${newModel.providerId}:${newModel.modelId}:${newModel.effectiveDate}`,
          providerId: newModel.providerId,
          modelId: newModel.modelId,
          billingMode: newModel.billingMode,
          currency: newModel.currency,
          inputPer1M: Number(newModel.inputPer1M || 0),
          outputPer1M: Number(newModel.outputPer1M || 0),
          effectiveDate: newModel.effectiveDate,
        },
      ];
      const nextProviders = providers.map((provider) =>
        provider.id === newModel.providerId
          ? {
              ...provider,
              availableModels: Array.from(
                new Set([
                  ...(provider.availableModels || []),
                  newModel.modelId,
                ]),
              ),
            }
          : provider,
      );
      const selectedCapabilitySet = new Set(selectedCapabilityIds);
      const nextCapabilities = capabilities.map((capability) =>
        selectedCapabilitySet.has(capability.id)
          ? {
              ...capability,
              binding: {
                ...capability.binding,
                provider: newModel.providerId,
                model: newModel.modelId,
              },
              currentProvider: newModel.providerId,
              currentModel: newModel.modelId,
            }
          : capability,
      );
      const changedCapabilities = nextCapabilities.filter((capability) =>
        selectedCapabilitySet.has(capability.id),
      );
      const actor = getCurrentActor();
      const bindingReason =
        modelBindingReason.trim() ||
        `model registration: ${newModel.providerId}/${newModel.modelId}`;

      await api.ai.updateModels(nextModels);
      await api.ai.updatePricingRules(nextPricingRules);
      await api.ai.updateConfig({
        providers: nextProviders,
        capabilities: nextCapabilities.map((capability) => ({
          id: capability.id,
          binding: capability.binding,
        })),
      });
      if (changedCapabilities.length > 0) {
        await Promise.all(
          changedCapabilities.map((capability) =>
            api.ai.publishBinding({
              capabilityId: capability.id,
              binding: capability.binding,
              promptTemplateId: capability.promptTemplateId || null,
              publishedBy: actor,
              reason: bindingReason,
            }),
          ),
        );
      }
      const refreshedCapabilities = await api.ai
        .getCapabilities()
        .catch(() => nextCapabilities);

      setModels(nextModels);
      setPricingRules(nextPricingRules);
      setProviders(nextProviders);
      setCapabilities(refreshedCapabilities);
      setMessage(
        changedCapabilities.length > 0
          ? `已注册模型 ${newModel.modelId}，并切换 ${changedCapabilities.length} 个能力`
          : `已注册模型 ${newModel.modelId}`,
      );
      setLastOperation({
        type: "注册模型",
        target: `${newModel.providerId} / ${newModel.modelId}`,
        detail:
          changedCapabilities.length > 0
            ? `模型目录、定价规则、Provider 可用模型列表已更新，并切换 ${changedCapabilities.length} 个 capability 绑定。原因：${bindingReason}`
            : "模型目录、定价规则和 Provider 可用模型列表已更新。",
        status: "success",
        timestamp: new Date().toISOString(),
      });
      setNewModel((current: any) => ({
        ...current,
        modelId: "",
        displayName: "",
        inputPer1M: 0,
        outputPer1M: 0,
      }));
      setSelectedCapabilityIds([]);
      setModelBindingReason("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "注册模型失败");
      setLastOperation({
        type: "注册模型",
        target: `${newModel.providerId || "-"} / ${newModel.modelId || "-"}`,
        detail: error instanceof Error ? error.message : "注册模型失败",
        status: "error",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSavingModelCatalog(false);
    }
  };

  const registerProvider = async () => {
    if (!newProvider.id || !newProvider.name || !newProvider.defaultModel) {
      setMessage("请先填写 provider ID、名称和默认模型");
      return;
    }
    if (providers.some((provider) => provider.id === newProvider.id)) {
      setMessage(`Provider ${newProvider.id} 已存在`);
      return;
    }
    setSavingModelCatalog(true);
    setMessage("");
    try {
      const nextProviders = [
        ...providers,
        {
          id: newProvider.id,
          name: newProvider.name,
          type: newProvider.type,
          runtime: newProvider.runtime,
          status: "active",
          defaultModel: newProvider.defaultModel,
          availableModels: [newProvider.defaultModel],
          supportsCustomModel: Boolean(newProvider.supportsCustomModel),
          envKeys: String(newProvider.envKeys || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          healthCheckMode: "runtime",
          billingMode: newProvider.billingMode,
          defaultTimeout: Number(newProvider.defaultTimeout || 90000),
          retryStrategy: {
            maxRetries: Number(newProvider.retryMaxRetries || 1),
            backoffMs: Number(newProvider.retryBackoffMs || 1000),
          },
          description: `${newProvider.name}（自定义 Provider）`,
        },
      ];
      await api.ai.updateConfig({ providers: nextProviders });
      setProviders(nextProviders);
      setMessage(`已新增 Provider ${newProvider.id}`);
      setLastOperation({
        type: "新增 Provider",
        target: newProvider.id,
        detail: `runtime=${newProvider.runtime}，默认模型=${newProvider.defaultModel}`,
        status: "success",
        timestamp: new Date().toISOString(),
      });
      setNewProvider({
        id: "",
        name: "",
        runtime: "openai-text",
        type: "text",
        billingMode: "token",
        defaultModel: "",
        supportsCustomModel: true,
        envKeys: "OPENAI_API_KEY",
        defaultTimeout: 90000,
        retryMaxRetries: 1,
        retryBackoffMs: 1000,
      });
      void loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "新增 Provider 失败");
      setLastOperation({
        type: "新增 Provider",
        target: newProvider.id || "-",
        detail: error instanceof Error ? error.message : "新增 Provider 失败",
        status: "error",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSavingModelCatalog(false);
    }
  };

  const syncModelState = async (
    nextModels: any[],
    nextPricingRules: any[],
    nextProviders: any[],
    operation: any,
  ) => {
    await api.ai.updateModels(nextModels);
    await api.ai.updatePricingRules(nextPricingRules);
    await api.ai.updateConfig({ providers: nextProviders });
    setModels(nextModels);
    setPricingRules(nextPricingRules);
    setProviders(nextProviders);
    setLastOperation({
      ...operation,
      timestamp: new Date().toISOString(),
    });
  };

  const toggleModelDeprecated = async (target: any) => {
    setSavingModelCatalog(true);
    setMessage("");
    try {
      const nextModels = models.map((item) =>
        item.providerId === target.providerId && item.modelId === target.modelId
          ? { ...item, deprecated: !item.deprecated }
          : item,
      );
      await api.ai.updateModels(nextModels);
      setModels(nextModels);
      setMessage(`${target.modelId} 已${target.deprecated ? "恢复" : "废弃"}`);
      setLastOperation({
        type: target.deprecated ? "恢复模型" : "废弃模型",
        target: `${target.providerId} / ${target.modelId}`,
        detail: `模型目录状态已更新为 ${target.deprecated ? "active" : "deprecated"}。`,
        status: "success",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新模型状态失败");
      setLastOperation({
        type: "模型状态更新",
        target: `${target.providerId} / ${target.modelId}`,
        detail: error instanceof Error ? error.message : "更新模型状态失败",
        status: "error",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSavingModelCatalog(false);
    }
  };

  const deleteModel = async (target: any) => {
    const provider = providers.find((item) => item.id === target.providerId);
    if (provider?.defaultModel === target.modelId) {
      setMessage("默认模型不能直接删除，请先调整 Provider 默认模型");
      return;
    }
    setSavingModelCatalog(true);
    setMessage("");
    try {
      const nextModels = models.filter(
        (item) =>
          !(
            item.providerId === target.providerId &&
            item.modelId === target.modelId
          ),
      );
      const nextPricingRules = pricingRules.filter(
        (item) =>
          !(
            item.providerId === target.providerId &&
            item.modelId === target.modelId
          ),
      );
      const nextProviders = providers.map((item) =>
        item.id === target.providerId
          ? {
              ...item,
              availableModels: (item.availableModels || []).filter(
                (modelId: string) => modelId !== target.modelId,
              ),
            }
          : item,
      );
      await syncModelState(nextModels, nextPricingRules, nextProviders, {
        type: "删除模型",
        target: `${target.providerId} / ${target.modelId}`,
        detail: "模型目录、定价规则和 Provider 可用模型列表已同步删除。",
        status: "success",
      });
      setMessage(`已删除模型 ${target.modelId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除模型失败");
      setLastOperation({
        type: "删除模型",
        target: `${target.providerId} / ${target.modelId}`,
        detail: error instanceof Error ? error.message : "删除模型失败",
        status: "error",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSavingModelCatalog(false);
    }
  };

  const saveBudgets = async () => {
    setSavingBudgets(true);
    setMessage("");
    try {
      await api.ai.updateBudgets(budgets);
      setMessage("预算配置已保存");
      setLastOperation({
        type: "保存预算",
        target: `${budgets.length} 条规则`,
        detail: "预算配置已更新。",
        status: "success",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存预算失败");
      setLastOperation({
        type: "保存预算",
        detail: error instanceof Error ? error.message : "保存预算失败",
        status: "error",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSavingBudgets(false);
    }
  };

  const runHealthCheck = async (providerId: string) => {
    setCheckingProviders((prev) => new Set(prev).add(providerId));
    setProviderCheckResults((prev) => {
      const next = new Map(prev);
      next.delete(providerId);
      return next;
    });
    try {
      const result = await api.ai.checkProviderHealth(providerId);
      loadData();
      const detail = `状态 ${result?.runtimeStatus || result?.status || "unknown"}${result?.avgLatencyMs != null ? ` · ${result.avgLatencyMs}ms` : ""}`;
      setProviderCheckResults((prev) =>
        new Map(prev).set(providerId, { status: "success", detail }),
      );
      setLastOperation({
        type: "健康检查",
        target: providerId,
        detail,
        status: "success",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "健康检查失败";
      setProviderCheckResults((prev) =>
        new Map(prev).set(providerId, { status: "error", detail }),
      );
      setLastOperation({
        type: "健康检查",
        target: providerId,
        detail,
        status: "error",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setCheckingProviders((prev) => {
        const next = new Set(prev);
        next.delete(providerId);
        return next;
      });
    }
  };

  const rebuildStats = async () => {
    setRebuildingStats(true);
    setMessage("");
    try {
      const result = await api.ai.rebuildStats();
      setStatsRebuildSummary(result?.summary || null);
      setLastRebuildDurationMs(
        typeof result?.durationMs === "number" ? result.durationMs : null,
      );
      const latestOverview = await api.ai.getStatsOverview().catch(() => null);
      setStatsOverview(latestOverview);
      setMessage(
        [
          formatStatsSummary(result?.summary),
          typeof result?.durationMs === "number"
            ? `耗时 ${result.durationMs}ms`
            : "",
        ]
          .filter(Boolean)
          .join(" · ") || "统计快照已重建",
      );
      setLastOperation({
        type: "重建快照",
        target: "ai-stats-daily",
        detail:
          [
            formatStatsSummary(result?.summary),
            typeof result?.durationMs === "number"
              ? `耗时 ${result.durationMs}ms`
              : "",
          ]
            .filter(Boolean)
            .join(" · ") || "统计快照已重建",
        status: "success",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "重建统计快照失败");
      setLastOperation({
        type: "重建快照",
        target: "ai-stats-daily",
        detail: error instanceof Error ? error.message : "重建统计快照失败",
        status: "error",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setRebuildingStats(false);
    }
  };

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-full">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            模型与供应商管理
          </h1>
          <div className="mt-1 text-sm text-slate-500">
            Provider、定价、预算和统计快照统一管理。
          </div>
        </div>
        <div className="flex items-center gap-3">
          {message ? (
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
              {message}
            </div>
          ) : null}
        </div>
      </div>
      <AIStatsSnapshotCard
        overview={statsOverview}
        actionLabel="重建统计快照"
        actionPending={rebuildingStats}
        onAction={() => void rebuildStats()}
        actionHint={
          [
            statsRebuildSummary
              ? `最近一次结果：${formatStatsSummary(statsRebuildSummary)}`
              : "",
            lastRebuildDurationMs != null
              ? `最近一次重建耗时 ${lastRebuildDurationMs}ms`
              : "",
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-900">自动巡检状态</div>
        <div className="mt-2 grid gap-2 text-xs text-slate-500 md:grid-cols-3 xl:grid-cols-6">
          <div>状态：{consistencyMonitor?.enabled ? "已启用" : "未启用"}</div>
          <div>
            上次自动巡检：
            {consistencyMonitor?.lastAutoCheckAt
              ? new Date(consistencyMonitor.lastAutoCheckAt).toLocaleString(
                  "zh-CN",
                  { hour12: false },
                )
              : "-"}
          </div>
          <div>上次结果：{consistencyMonitor?.lastResult || "-"}</div>
          <div>触发来源：{consistencyMonitor?.lastTrigger || "-"}</div>
          <div>
            每日执行：
            {String(consistencyMonitor?.targetHour ?? "-").padStart(2, "0")}:00
          </div>
          <div>
            下一次计划：
            {consistencyMonitor?.nextRunAt
              ? new Date(consistencyMonitor.nextRunAt).toLocaleString("zh-CN", {
                  hour12: false,
                })
              : "-"}
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            最近手动巡检：
            {formatConsistencyReportSummary(latestManualConsistencyReport)}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            最近自动巡检：
            {formatConsistencyReportSummary(latestAutoConsistencyReport)}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-900">AI 存储状态</div>
        <div className="mt-2 grid gap-2 text-xs text-slate-500 md:grid-cols-3">
          <div>当前后端：{storageStatus?.backend || "-"}</div>
          <div>当前 driver：{storageStatus?.driver || "-"}</div>
          <div>
            统一抽象：{storageStatus?.migrationReady ? "已就绪" : "未就绪"}
          </div>
          <div>
            托管资源：
            {storageStatus?.resources
              ? Object.keys(storageStatus.resources).length
              : 0}{" "}
            项
          </div>
          <div>
            支持 driver：
            {Array.isArray(storageStatus?.supportedDrivers)
              ? storageStatus.supportedDrivers
                  .map((item: any) => item.id)
                  .join(" / ")
              : "-"}
          </div>
        </div>
      </div>
      <AIOperationResultCard title="最近管理操作" result={lastOperation} />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              新增 Provider
            </h2>
            <div className="mt-1 text-sm text-slate-500">
              支持接入已有 runtime 范式下的新 Provider。新协议仍需后端补
              adapter。
            </div>
          </div>
          <button
            type="button"
            onClick={() => void registerProvider()}
            disabled={savingModelCatalog}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {savingModelCatalog ? "提交中..." : "新增 Provider"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={newProvider.id}
            onChange={(event) =>
              setNewProvider((current: any) => ({
                ...current,
                id: event.target.value,
              }))
            }
            placeholder="Provider ID"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <input
            value={newProvider.name}
            onChange={(event) =>
              setNewProvider((current: any) => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="Provider 名称"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <select
            value={newProvider.runtime}
            onChange={(event) => {
              const option = PROVIDER_RUNTIME_OPTIONS.find(
                (item) => item.value === event.target.value,
              );
              setNewProvider((current: any) => ({
                ...current,
                runtime: event.target.value,
                type: option?.type || current.type,
                billingMode: option?.billingMode || current.billingMode,
                envKeys: (option?.envKeys || []).join(","),
              }));
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {PROVIDER_RUNTIME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={newProvider.defaultModel}
            onChange={(event) =>
              setNewProvider((current: any) => ({
                ...current,
                defaultModel: event.target.value,
              }))
            }
            placeholder="默认模型"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <input
            value={newProvider.envKeys}
            onChange={(event) =>
              setNewProvider((current: any) => ({
                ...current,
                envKeys: event.target.value,
              }))
            }
            placeholder="环境变量，逗号分隔"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-2"
          />
          <input
            type="number"
            value={newProvider.defaultTimeout}
            onChange={(event) =>
              setNewProvider((current: any) => ({
                ...current,
                defaultTimeout: Number(event.target.value),
              }))
            }
            placeholder="默认超时(ms)"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(newProvider.supportsCustomModel)}
              onChange={(event) =>
                setNewProvider((current: any) => ({
                  ...current,
                  supportsCustomModel: event.target.checked,
                }))
              }
            />
            支持自定义模型
          </label>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">注册新模型</h2>
            <div className="mt-1 text-sm text-slate-500">
              适用于已有 Provider 下新增可选模型，不处理新协议接入。
            </div>
          </div>
          <button
            type="button"
            onClick={() => void registerModel()}
            disabled={savingModelCatalog}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {savingModelCatalog ? "注册中..." : "注册模型"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            value={newModel.providerId}
            onChange={(event) => {
              const providerId = event.target.value;
              setNewModel((current: any) => ({ ...current, providerId }));
              setSelectedCapabilityIds((current) =>
                current.filter((capabilityId) =>
                  capabilities.some(
                    (capability) =>
                      capability.id === capabilityId &&
                      (capability.supportedProviders || []).includes(
                        providerId,
                      ),
                  ),
                ),
              );
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">选择 Provider</option>
            {textProviderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={newModel.modelId}
            onChange={(event) =>
              setNewModel((current: any) => ({
                ...current,
                modelId: event.target.value,
              }))
            }
            placeholder="模型 ID"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <input
            value={newModel.displayName}
            onChange={(event) =>
              setNewModel((current: any) => ({
                ...current,
                displayName: event.target.value,
              }))
            }
            placeholder="展示名称"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={newModel.contextLength}
            onChange={(event) =>
              setNewModel((current: any) => ({
                ...current,
                contextLength: Number(event.target.value),
              }))
            }
            placeholder="上下文长度"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={newModel.inputPer1M}
            onChange={(event) =>
              setNewModel((current: any) => ({
                ...current,
                inputPer1M: Number(event.target.value),
              }))
            }
            placeholder="输入 / 1M"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={newModel.outputPer1M}
            onChange={(event) =>
              setNewModel((current: any) => ({
                ...current,
                outputPer1M: Number(event.target.value),
              }))
            }
            placeholder="输出 / 1M"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(newModel.supportsImages)}
              onChange={(event) =>
                setNewModel((current: any) => ({
                  ...current,
                  supportsImages: event.target.checked,
                }))
              }
            />
            支持图片
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(newModel.supportsJsonMode)}
              onChange={(event) =>
                setNewModel((current: any) => ({
                  ...current,
                  supportsJsonMode: event.target.checked,
                }))
              }
            />
            支持 JSON
          </label>
        </div>
        <div className="mt-3">
          <input
            value={modelBindingReason}
            onChange={(event) => setModelBindingReason(event.target.value)}
            placeholder="绑定变更原因（可选，如：接入新模型做审核效果对比）"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-900">
                注册后同步切换能力绑定
              </div>
              <div className="mt-1 text-xs text-slate-500">
                只展示支持当前 Provider 的
                capability。勾选后，注册成功会直接把这些能力绑定到新模型，并写入绑定历史。
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() =>
                  setSelectedCapabilityIds(
                    eligibleCapabilitiesForNewModel.map((item) => item.id),
                  )
                }
                disabled={
                  !newModel.providerId ||
                  eligibleCapabilitiesForNewModel.length === 0
                }
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600 disabled:opacity-50"
              >
                全选
              </button>
              <button
                type="button"
                onClick={() => setSelectedCapabilityIds([])}
                disabled={selectedCapabilityIds.length === 0}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600 disabled:opacity-50"
              >
                清空
              </button>
            </div>
          </div>
          {!newModel.providerId ? (
            <div className="mt-3 text-xs text-slate-500">
              请先选择 Provider。
            </div>
          ) : eligibleCapabilitiesForNewModel.length === 0 ? (
            <div className="mt-3 text-xs text-slate-500">
              当前 Provider 暂无可直接绑定的 capability。
            </div>
          ) : (
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {eligibleCapabilitiesForNewModel.map((capability) => {
                const checked = selectedCapabilityIds.includes(capability.id);
                return (
                  <label
                    key={capability.id}
                    className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-sm transition ${
                      checked
                        ? "border-slate-900 bg-white"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setSelectedCapabilityIds((current) =>
                          event.target.checked
                            ? Array.from(new Set([...current, capability.id]))
                            : current.filter((item) => item !== capability.id),
                        )
                      }
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800">
                        {capability.id}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {capability.group ? `${capability.group} · ` : ""}
                        当前 {capability.binding?.provider || "-"} /{" "}
                        {capability.binding?.model || "-"}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-900">
              当前模型目录
            </div>
            <div className="mt-2 space-y-3 text-xs text-slate-500">
              {providers.map((provider) => {
                const providerModels = modelsByProvider.get(provider.id) || [];
                if (providerModels.length === 0) return null;
                return (
                  <div
                    key={provider.id}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="text-xs font-medium text-slate-800">
                      {provider.name}
                    </div>
                    <div className="mt-2 space-y-2">
                      {providerModels.map((item) => (
                        <div
                          key={`${item.providerId}:${item.modelId}`}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs font-medium text-slate-800">
                                {item.modelId}
                                {provider.defaultModel === item.modelId
                                  ? " · 默认"
                                  : ""}
                                {item.deprecated ? " · 已废弃" : ""}
                              </div>
                              <div className="mt-1 text-[11px] text-slate-500">
                                {item.displayName}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void toggleModelDeprecated(item)}
                                disabled={savingModelCatalog}
                                className="rounded-full border border-amber-200 px-2 py-1 text-[11px] text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
                              >
                                {item.deprecated ? "恢复" : "废弃"}
                              </button>
                              {provider.defaultModel !== item.modelId ? (
                                <button
                                  type="button"
                                  onClick={() => void deleteModel(item)}
                                  disabled={savingModelCatalog}
                                  className="rounded-full border border-rose-200 px-2 py-1 text-[11px] text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                                >
                                  删除
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-900">注册说明</div>
            <div className="mt-2 space-y-1 text-xs text-slate-500">
              <div>1. 只支持给已有 Provider 增加新模型。</div>
              <div>
                2. 会同步更新模型目录、定价规则和 Provider 的 availableModels。
              </div>
              <div>
                3. 新模型注册后，可在 AI 配置中心直接绑定到 capability。
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {displayProviders.map((provider) => {
          const item = healthMap.get(provider.id);
          return (
            <div
              key={provider.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
                provider.id === highlightedProviderId
                  ? "border-brand-blue-300 ring-2 ring-brand-blue-100"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-semibold text-slate-900">
                    {provider.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {provider.defaultModel}
                  </div>
                </div>
                <AIProviderStatusBadge
                  status={item?.runtimeStatus || provider.status}
                />
              </div>
              {provider.id === highlightedProviderId ? (
                <div className="mt-3 rounded-xl bg-brand-blue-50 px-3 py-2 text-xs text-brand-blue-700">
                  已从驾驶舱健康概览跳转定位到该 Provider
                </div>
              ) : null}
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <div>Runtime: {provider.runtime}</div>
                <div>
                  Models: {(provider.availableModels || []).join(", ") || "-"}
                </div>
                <div>Config: {item?.configStatus || "unknown"}</div>
                <div>
                  1h 成功率:{" "}
                  {item?.successRate1h != null
                    ? `${(item.successRate1h * 100).toFixed(1)}%`
                    : "-"}
                </div>
                <div>
                  平均延迟:{" "}
                  {item?.avgLatencyMs != null ? `${item.avgLatencyMs}ms` : "-"}
                </div>
              </div>
              {(() => {
                const checkResult = providerCheckResults.get(provider.id);
                return checkResult ? (
                  <div
                    className={`mt-3 rounded-xl px-3 py-2 text-xs ${
                      checkResult.status === "success"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {checkResult.status === "success" ? "✓ " : "✕ "}
                    {checkResult.detail}
                  </div>
                ) : null;
              })()}
              <div className="mt-4 flex items-center justify-end gap-2">
                <div className="group relative">
                  <svg
                    className="h-4 w-4 cursor-default text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <div className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 w-56 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    <div className="font-medium text-slate-800 mb-1">
                      健康检查
                    </div>
                    向该 Provider 发送探测请求，验证 API
                    连通性，并刷新当前状态与延迟数据。
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void runHealthCheck(provider.id)}
                  disabled={checkingProviders.has(provider.id)}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkingProviders.has(provider.id) ? "检查中…" : "健康检查"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">模型定价</h2>
            <button
              type="button"
              onClick={() => void savePricing()}
              disabled={savingPricing}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {savingPricing ? "保存中..." : "保存定价"}
            </button>
          </div>
          <div className="mt-4 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Provider / Model</th>
                  <th className="px-3 py-2 text-right">输入/1M</th>
                  <th className="px-3 py-2 text-right">输出/1M</th>
                </tr>
              </thead>
              <tbody>
                {displayPricingRules.map((rule) => {
                  const key = `${rule.providerId}:${rule.modelId}`;
                  return (
                    <tr key={key} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        {rule.providerId} / {rule.modelId}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={rule.inputPer1M ?? 0}
                          onChange={(event) =>
                            handlePricingChange(
                              rule.providerId,
                              rule.modelId,
                              "inputPer1M",
                              event.target.value,
                            )
                          }
                          className="w-24 rounded-xl border border-slate-200 px-3 py-1.5 text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={rule.outputPer1M ?? 0}
                          onChange={(event) =>
                            handlePricingChange(
                              rule.providerId,
                              rule.modelId,
                              "outputPer1M",
                              event.target.value,
                            )
                          }
                          className="w-24 rounded-xl border border-slate-200 px-3 py-1.5 text-right"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">预算配置</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addBudget}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                新增预算
              </button>
              <button
                type="button"
                onClick={() => void saveBudgets()}
                disabled={savingBudgets}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-700 disabled:opacity-60"
              >
                {savingBudgets ? "保存中..." : "保存预算"}
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {budgets.map((budget, index) => (
              <div
                key={budget.id || index}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-900">
                    {budget.scopeType}
                    {budget.scopeId ? ` / ${budget.scopeId}` : ""}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleBudgetStatus(index)}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:bg-white"
                    >
                      {budget.status === "paused" ? "恢复" : "暂停"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBudget(index)}
                      className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600 transition hover:bg-rose-50"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={budget.scopeType}
                    onChange={(event) =>
                      handleBudgetChange(index, "scopeType", event.target.value)
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {BUDGET_SCOPE_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                  {budget.scopeType === "GLOBAL" ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-sm text-slate-400">
                      全局预算无需 scopeId
                    </div>
                  ) : getScopeOptions(budget.scopeType).length > 0 ? (
                    <select
                      value={budget.scopeId || ""}
                      onChange={(event) =>
                        handleBudgetChange(index, "scopeId", event.target.value)
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">请选择范围</option>
                      {getScopeOptions(budget.scopeType).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={budget.scopeId || ""}
                      onChange={(event) =>
                        handleBudgetChange(index, "scopeId", event.target.value)
                      }
                      placeholder="scopeId"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  )}
                  <input
                    type="number"
                    value={budget.budgetAmount}
                    onChange={(event) =>
                      handleBudgetChange(
                        index,
                        "budgetAmount",
                        event.target.value,
                      )
                    }
                    placeholder="预算金额"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    value={(budget.alertThresholds || []).join(",")}
                    onChange={(event) =>
                      handleBudgetChange(
                        index,
                        "alertThresholds",
                        event.target.value,
                      )
                    }
                    placeholder="0.7,0.9,1"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                  <select
                    value={budget.periodType || "daily"}
                    onChange={(event) =>
                      handleBudgetChange(
                        index,
                        "periodType",
                        event.target.value,
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {periodOptions.map((value) => (
                      <option key={value} value={value}>
                        {value === "daily" ? "日预算" : "月预算"}
                      </option>
                    ))}
                  </select>
                  <select
                    value={budget.actionType || "notify_only"}
                    onChange={(event) =>
                      handleBudgetChange(
                        index,
                        "actionType",
                        event.target.value,
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {actionOptions.map((value) => (
                      <option key={value} value={value}>
                        {value === "notify_only"
                          ? "仅通知"
                          : value === "soft_block"
                            ? "软阻断"
                            : "硬阻断"}
                      </option>
                    ))}
                  </select>
                  <select
                    value={budget.status || "active"}
                    onChange={(event) =>
                      handleBudgetChange(index, "status", event.target.value)
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {statusOptions.map((value) => (
                      <option key={value} value={value}>
                        {value === "active" ? "启用" : "暂停"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  预算 ID: {budget.id || "-"} · 当前状态:{" "}
                  {budget.status === "paused" ? "暂停" : "启用"}
                </div>
              </div>
            ))}
            {budgets.length === 0 ? (
              <div className="text-sm text-slate-500">暂无预算配置</div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AIModelManagementPage;
