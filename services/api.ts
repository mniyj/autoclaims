// Generic fetch wrapper
const apiFetch = async <T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> => {
  const response = await fetch(`/api/${endpoint}`, options);
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
  claimCases: buildResource("claim-cases"),
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
  // 询价及保单管理
  quotes: buildResource("quotes"),
  policies: buildResource("policies"),
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
};
