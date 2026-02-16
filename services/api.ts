
// Generic fetch wrapper
const apiFetch = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(`/api/${endpoint}`, options);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API Error: ${response.statusText}`);
    }
    return response.json();
};

// Generic CRUD helpers
const getList = <T>(resource: string) => apiFetch<T[]>(resource);
const getById = <T>(resource: string, id: string) => apiFetch<T>(`${resource}/${encodeURIComponent(id)}`);
const saveList = <T>(resource: string, data: T[]) => apiFetch<{ success: true; count: number }>(resource, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
const addItem = <T>(resource: string, item: T) => apiFetch<{ success: true; data: T }>(resource, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
});
const updateItem = <T>(resource: string, id: string, data: Partial<T>) => apiFetch<{ success: true; data: T }>(`${resource}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
const deleteItem = (resource: string, id: string) => apiFetch<{ success: true; data: any }>(`${resource}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
});

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
    products: buildResource('products'),
    clauses: buildResource('clauses'),
    strategies: buildResource('strategies'),
    companies: buildResource('companies'),
    industryData: buildResource('industry-data'),
    insuranceTypes: buildResource('insurance-types'),
    responsibilities: buildResource('responsibilities'),
    claimsMaterials: buildResource('claims-materials'),
    claimItems: buildResource('claim-items'),
    claimCases: buildResource('claim-cases'),
    rulesets: buildResource('rulesets'),
    productClaimConfigs: buildResource('product-claim-configs'),
    endUsers: buildResource('end-users'),
    users: buildResource('users'),
    mappingData: buildResource('mapping-data'),
    medicalInsuranceCatalog: buildResource('medical-insurance-catalog'),
    hospitalInfo: buildResource('hospital-info'),
    invoiceAudits: buildResource('invoice-audits'),
    userOperationLogs: buildResource('user-operation-logs'),
    // Utils
    getUploadToken: async () => {
        const response = await fetch('/api/upload-token');
        if (!response.ok) throw new Error('Failed to get upload token');
        return response.json();
    },
    // 新增专用 API
    auditInvoice: async (ocrData: any, ossUrl: string, province: string) => {
        const response = await fetch('/api/audit-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ocrData, ossUrl, province })
        });
        if (!response.ok) throw new Error('Invoice audit failed');
        return response.json();
    }
};
