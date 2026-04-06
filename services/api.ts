// Generic fetch wrapper
const apiFetch = async <T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> => {
  const headers = new Headers(options?.headers);
  if (!headers.has("x-user-id")) {
    try {
      const user = localStorage.getItem("user");
      if (user) {
        const parsed = JSON.parse(user);
        headers.set("x-user-id", parsed.id || parsed.username || "anonymous");
      } else {
        headers.set("x-user-id", "anonymous");
      }
    } catch {
      headers.set("x-user-id", "anonymous");
    }
  }
  const response = await fetch(`/api/${endpoint}`, { ...options, headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API Error: ${response.statusText}`);
  }
  return response.json();
};

// Generic CRUD helpers
const getList = <T>(resource: string) => apiFetch<T[]>(resource);
const getById = <T>(resource: string, id: string) =>
  apiFetch<T>(`${resource}/${encodeURIComponent(id)}`);
const saveList = <T>(resource: string, data: T[]) =>
  apiFetch<{ success: true; count: number }>(resource, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
const addItem = <T>(resource: string, item: T) =>
  apiFetch<{ success: true; data: T }>(resource, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
const updateItem = <T>(resource: string, id: string, data: Partial<T>) =>
  apiFetch<{ success: true; data: T }>(
    `${resource}/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
const deleteItem = (resource: string, id: string) =>
  apiFetch<{ success: true; data: any }>(
    `${resource}/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );

// Helper to build a full CRUD resource API
const buildResource = (resource: string) => ({
  list: () => getList(resource),
  getById: (id: string) => getById(resource, id),
  saveAll: (data: any[]) => saveList(resource, data),
  add: (item: any) => addItem(resource, item),
  update: (id: string, data: any) => updateItem(resource, id, data),
  delete: (id: string) => deleteItem(resource, id),
});

// Resource-specific exports
export const api = {
  products: buildResource("products"),
  clauses: buildResource("clauses"),
  strategies: buildResource("strategies"),
  companies: buildResource("companies"),
  industryData: buildResource("industry-data"),
  insuranceTypes: buildResource("insurance-types"),
  responsibilities: buildResource("responsibilities"),
  claimsMaterials: buildResource("claims-materials"),
  claimItems: buildResource("claim-items"),
  factCatalog: buildResource("fact-catalog"),
  materialTypeCatalog: buildResource("material-type-catalog"),
  materialValidationRules: buildResource("material-validation-rules"),
  claimCases: buildResource("claim-cases"),
  claimDocuments: {
    getByClaimCaseId: async (claimCaseId: string) => {
      const response = await fetch(
        `/api/claim-documents?claimCaseId=${encodeURIComponent(claimCaseId)}`,
      );
      if (!response.ok) throw new Error("Failed to get claim documents");
      return response.json();
    },
    saveFieldCorrection: async (correction: Record<string, unknown>) => {
      const response = await fetch("/api/claim-documents/field-corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correction }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save field correction");
      }
      return response.json();
    },
  },
  claimMaterials: {
    saveFieldCorrection: async (correction: Record<string, unknown>) => {
      const response = await fetch("/api/claim-materials/field-corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correction }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save field correction");
      }
      return response.json();
    },
  },
  claims: {
    fullReview: async (params: {
      claimCaseId?: string;
      productCode?: string;
      ocrData?: Record<string, unknown>;
      invoiceItems?: Array<Record<string, unknown>>;
      validationFacts?: Record<string, boolean | null>;
      ruleset?: Record<string, unknown>;
    }) => {
      const response = await fetch("/api/claim/full-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error("Full review failed");
      return response.json();
    },
  },
  rulesets: buildResource("rulesets"),
  productClaimConfigs: buildResource("product-claim-configs"),
  categoryMaterialConfigs: buildResource("category-material-configs"),
  accidentCauseConfigs: buildResource("accident-cause-configs"),
  endUsers: buildResource("end-users"),
  users: buildResource("users"),
  mappingData: buildResource("mapping-data"),
  medicalInsuranceCatalog: buildResource("medical-insurance-catalog"),
  hospitalInfo: buildResource("hospital-info"),
  invoiceAudits: buildResource("invoice-audits"),
  userOperationLogs: buildResource("user-operation-logs"),
  ai: {
    getInventory: async () =>
      apiFetch<{ capabilities: any[]; config: any }>("ai/inventory"),
    getConfig: async () => apiFetch<any>("ai/config"),
    getDashboard: async (params: Record<string, string | undefined> = {}) => {
      const search = new URLSearchParams();
      Object.entries(params).forEach(
        ([key, value]) => value && search.set(key, value),
      );
      return apiFetch<any>(`ai/dashboard?${search.toString()}`);
    },
    getStatsOverview: async () => apiFetch<any>("ai/stats/overview"),
    getStorageStatus: async () => apiFetch<any>("ai/storage-status"),
    getProviders: async () => apiFetch<any[]>("ai/providers"),
    getModels: async () => apiFetch<any[]>("ai/models"),
    updateModels: async (payload: any) =>
      apiFetch<any>("ai/models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    getCapabilities: async () => apiFetch<any[]>("ai/capabilities"),
    getProviderHealth: async () => apiFetch<any[]>("ai/provider-health"),
    checkProviderHealth: async (providerId?: string) =>
      apiFetch<any>("ai/provider-health/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      }),
    getBudgets: async () => apiFetch<any>("ai/budgets"),
    updateBudgets: async (payload: any) =>
      apiFetch<any>("ai/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    getPricingRules: async () => apiFetch<any>("ai/model-pricing"),
    updatePricingRules: async (payload: any) =>
      apiFetch<any>("ai/model-pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    getCostAnalytics: async (
      params: Record<string, string | undefined> = {},
    ) => {
      const search = new URLSearchParams();
      Object.entries(params).forEach(
        ([key, value]) => value && search.set(key, value),
      );
      return apiFetch<any>(`ai/cost-analytics?${search.toString()}`);
    },
    getBusinessStats: async (
      params: Record<string, string | undefined> = {},
    ) => {
      const search = new URLSearchParams();
      Object.entries(params).forEach(
        ([key, value]) => value && search.set(key, value),
      );
      return apiFetch<any>(`ai/business-stats?${search.toString()}`);
    },
    rebuildStats: async () =>
      apiFetch<any>("ai/stats/rebuild", {
        method: "POST",
      }),
    runConsistencyCheck: async () =>
      apiFetch<any>("ai/stats/consistency-check", {
        method: "POST",
      }),
    getConsistencyChecks: async (limit = 10) =>
      apiFetch<any>(
        `ai/stats/consistency-check?limit=${encodeURIComponent(String(limit))}`,
      ),
    getModelComparison: async (
      params: Record<string, string | undefined> = {},
    ) => {
      const search = new URLSearchParams();
      Object.entries(params).forEach(
        ([key, value]) => value && search.set(key, value),
      );
      return apiFetch<any>(`ai/model-comparison?${search.toString()}`);
    },
    getAlerts: async () => apiFetch<any>("ai/alerts"),
    saveAlertRules: async (payload: any) =>
      apiFetch<any>("ai/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    updateIncidentStatus: async (incidentId: string, status: string) =>
      apiFetch<any>("ai/alerts/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId, status }),
      }),
    repairBrokenAlertTraceRefs: async () =>
      apiFetch<any>("ai/alerts/repair-broken-traces", {
        method: "POST",
      }),
    getLogViews: async () => apiFetch<any[]>("ai/log-views"),
    saveLogView: async (payload: any) =>
      apiFetch<any>("ai/log-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    deleteLogView: async (id: string) =>
      apiFetch<any>(`ai/log-views?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    getBindingHistory: async (capabilityId?: string) =>
      apiFetch<any>(
        `ai/capability-bindings/history${capabilityId ? `?capabilityId=${encodeURIComponent(capabilityId)}` : ""}`,
      ),
    publishBinding: async (payload: any) =>
      apiFetch<any>("ai/capability-bindings/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    rollbackBinding: async (payload: any) =>
      apiFetch<any>("ai/capability-bindings/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    getPromptHistory: async (templateId?: string) =>
      apiFetch<any>(
        `ai/prompts/history${templateId ? `?templateId=${encodeURIComponent(templateId)}` : ""}`,
      ),
    publishPrompt: async (payload: any) =>
      apiFetch<any>("ai/prompts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    getTraces: async (params: Record<string, string | undefined> = {}) => {
      const search = new URLSearchParams();
      Object.entries(params).forEach(
        ([key, value]) => value && search.set(key, value),
      );
      return apiFetch<any>(`ai/traces?${search.toString()}`);
    },
    getTraceById: async (traceId: string) =>
      apiFetch<any>(`ai/traces/${encodeURIComponent(traceId)}`),
    getInvocationById: async (id: string) =>
      apiFetch<any>(`ai/invocations/${encodeURIComponent(id)}`),
    updateConfig: async (config: any) =>
      apiFetch<any>("ai/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      }),
  },
  aiInteractionLogs: {
    query: async (
      params: Record<string, string | number | boolean | undefined>,
    ) => {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          search.set(key, String(value));
        }
      });
      return apiFetch<{
        logs: any[];
        total: number;
        limit: number;
        offset: number;
      }>(`ai/interaction-logs?${search.toString()}`);
    },
    getById: async (logId: string) =>
      apiFetch<{ logs: any[]; total: number; limit: number; offset: number }>(
        `ai/interaction-logs?logId=${encodeURIComponent(logId)}&view=detail&limit=1`,
      ),
  },
  getClaimProcessTimeline: async (claimId: string) => {
    const response = await fetch(
      `/api/claim-process-timeline?claimId=${encodeURIComponent(claimId)}`,
    );
    if (!response.ok) throw new Error("Failed to get claim process timeline");
    return response.json();
  },
  // 询价及保单管理
  quotes: buildResource("quotes"),
  policies: buildResource("policies"),
  // 报案字段预设模板
  intakeFieldPresets: buildResource("intake-field-presets"),
  // Utils
  getUploadToken: async () => {
    const response = await fetch("/api/upload-token");
    if (!response.ok) throw new Error("Failed to get upload token");
    return response.json();
  },
  // 新增专用 API
  auditInvoice: async (ocrData: any, ossUrl: string, province: string) => {
    const response = await fetch("/api/audit-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ocrData, ossUrl, province }),
    });
    if (!response.ok) throw new Error("Invoice audit failed");
    return response.json();
  },
  // 询价及保单专用 API
  // 保费计算
  calculatePremium: async (quoteData: any) => {
    const response = await fetch("/api/calculate-premium", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quoteData),
    });
    if (!response.ok) throw new Error("Premium calculation failed");
    return response.json();
  },
  // 询价单转保单
  convertQuoteToPolicy: async (quoteId: string) => {
    const response = await fetch(
      `/api/quotes/${encodeURIComponent(quoteId)}/convert`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
    if (!response.ok) throw new Error("Quote conversion failed");
    return response.json();
  },
  // 生成保单明细表
  generatePolicySchedule: async (policyId: string) => {
    const response = await fetch(
      `/api/policies/${encodeURIComponent(policyId)}/schedule`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
    if (!response.ok) throw new Error("Schedule generation failed");
    return response.json();
  },
  // ============ 定损理算专用 API ============
  // 执行定损
  assessDamage: async (params: any) => {
    const response = await fetch("/api/assess-damage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error("Damage assessment failed");
    return response.json();
  },
  // 执行理算
  calculate: async (formulaType: string, context: any) => {
    const response = await fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formulaType, context }),
    });
    if (!response.ok) throw new Error("Calculation failed");
    return response.json();
  },
  // 费用分类
  classifyExpense: async (params: any) => {
    const response = await fetch("/api/classify-expense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error("Expense classification failed");
    return response.json();
  },
  // 获取费用类型列表
  getExpenseCategories: async () => {
    const response = await fetch("/api/expense-categories");
    if (!response.ok) throw new Error("Failed to get expense categories");
    return response.json();
  },
  // 获取社保类型列表
  getSocialSecurityTypes: async () => {
    const response = await fetch("/api/social-security-types");
    if (!response.ok) throw new Error("Failed to get social security types");
    return response.json();
  },
  // 获取伤害标准列表
  getInjuryStandards: async () => {
    const response = await fetch("/api/jury-standards");
    if (!response.ok) throw new Error("Failed to get injury standards");
    return response.json();
  },
  // 获取支持的险种类型
  getInsuranceTypes: async () => {
    const response = await fetch("/api/insurance-types");
    if (!response.ok) throw new Error("Failed to get insurance types");
    return response.json();
  },
  // 公式管理 API
  formulas: {
    list: async () => {
      const response = await fetch("/api/formulas");
      if (!response.ok) throw new Error("Failed to get formulas");
      return response.json();
    },
    getById: async (code: string) => {
      const response = await fetch(`/api/formulas/${encodeURIComponent(code)}`);
      if (!response.ok) throw new Error("Failed to get formula");
      return response.json();
    },
    save: async (code: string, config: any) => {
      const response = await fetch(
        `/api/formulas/${encodeURIComponent(code)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        },
      );
      if (!response.ok) throw new Error("Failed to save formula");
      return response.json();
    },
  },

  // 人工介入 API
  interventions: {
    /** 查询介入列表（工作台用，默认只返回未解决的） */
    list: (filters?: {
      claimCaseId?: string;
      interventionType?: string;
      priority?: string;
      stageKey?: string;
      resolved?: boolean | "all";
    }) => {
      const params = new URLSearchParams();
      if (filters?.claimCaseId) params.set("claimCaseId", filters.claimCaseId);
      if (filters?.interventionType)
        params.set("interventionType", filters.interventionType);
      if (filters?.priority) params.set("priority", filters.priority);
      if (filters?.stageKey) params.set("stageKey", filters.stageKey);
      if (filters?.resolved !== undefined)
        params.set("resolved", String(filters.resolved));
      const qs = params.toString();
      return apiFetch<any[]>(`claim-interventions${qs ? `?${qs}` : ""}`);
    },
    /** 获取单个介入实例 */
    getById: (id: string) =>
      apiFetch<any>(`claim-interventions/${encodeURIComponent(id)}`),
    /** 触发状态转移 */
    transition: (
      id: string,
      event: string,
      payload?: Record<string, unknown>,
    ) =>
      apiFetch<{ success: true; data: any }>(
        `claim-interventions/${encodeURIComponent(id)}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, payload }),
        },
      ),
    /** 手动解决介入 */
    resolve: (
      id: string,
      resolution: string,
      payload?: Record<string, unknown>,
    ) =>
      apiFetch<{ success: true; data: any }>(
        `claim-interventions/${encodeURIComponent(id)}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolution, payload }),
        },
      ),
    /** 手动创建介入实例 */
    create: (data: Record<string, unknown>) =>
      apiFetch<{ success: true; data: any }>("claim-interventions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  },
};
