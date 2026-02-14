
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

// Resource-specific exports
export const api = {
    products: {
        list: () => getList('products'),
        saveAll: (data: any[]) => saveList('products', data),
        add: (item: any) => addItem('products', item),
    },
    clauses: {
        list: () => getList('clauses'),
        saveAll: (data: any[]) => saveList('clauses', data),
        add: (item: any) => addItem('clauses', item),
    },
    strategies: {
        list: () => getList('strategies'),
        saveAll: (data: any[]) => saveList('strategies', data),
        add: (item: any) => addItem('strategies', item),
    },
    companies: {
        list: () => getList('companies'),
        saveAll: (data: any[]) => saveList('companies', data),
        add: (item: any) => addItem('companies', item),
    },
    industryData: {
        list: () => getList('industry-data'),
        saveAll: (data: any[]) => saveList('industry-data', data),
        add: (item: any) => addItem('industry-data', item),
    },
    insuranceTypes: {
        list: () => getList('insurance-types'),
        saveAll: (data: any[]) => saveList('insurance-types', data),
        add: (item: any) => addItem('insurance-types', item),
    },
    responsibilities: {
        list: () => getList('responsibilities'),
        saveAll: (data: any[]) => saveList('responsibilities', data),
        add: (item: any) => addItem('responsibilities', item),
    },
    claimsMaterials: {
        list: () => getList('claims-materials'),
        saveAll: (data: any[]) => saveList('claims-materials', data),
        add: (item: any) => addItem('claims-materials', item),
    }
};
