/**
 * 配置服务 - 从主项目 jsonlist 目录加载配置
 * 
 * 加载的配置文件：
 * - claims-materials.json: 材料定义
 * - claim-items.json: 理赔项目-材料映射
 * - calculation-formulas.json: 计算公式
 * - insurance-types.json: 险种类型定义
 */

// 材料配置接口
export interface MaterialConfig {
  id: string;
  name: string;
  description: string;
  jsonSchema?: string;
  required?: boolean;
  aiAuditPrompt?: string;
  sampleUrl?: string;
  ossKey?: string;
  confidenceThreshold?: number;
}

// 理赔项目配置接口
export interface ClaimItemConfig {
  id: string;
  name: string;
  materialIds: string[];
  responsibilityIds?: string[];
}

// 计算公式变量定义
export interface FormulaVariable {
  source: string;
  type: 'number' | 'string' | 'boolean';
  label: string;
}

// 计算公式步骤
export interface FormulaStep {
  name: string;
  expr: string;
  output: string;
}

// 计算公式配置
export interface FormulaConfig {
  description: string;
  insuranceType: string;
  formula: string;
  variables: Record<string, FormulaVariable>;
  steps: FormulaStep[];
  lookup_tables?: Record<string, Record<string, number>>;
  output: {
    field: string;
    type: string;
    label: string;
  };
}

// 险种类型配置
export interface InsuranceTypeConfig {
  code: string;
  name: string;
  definition?: string;
  features?: string;
  function?: string;
  audience?: string;
  selectionPoints?: string;
  coreMetrics?: string;
  parentCode?: string;
  faqList?: Array<{
    question: string;
    answer: string;
    isFocus?: boolean;
  }>;
}

// 产品理赔配置
export interface ProductClaimConfig {
  productCode: string;
  responsibilityConfigs: Array<{
    responsibilityId: string;
    claimItemIds: string[];
  }>;
}

/**
 * 配置服务类
 */
export class ConfigService {
  private cache = new Map<string, any>();
  private basePath = '/api/config'; // API 基础路径

  /**
   * 加载材料配置
   */
  async loadMaterials(): Promise<MaterialConfig[]> {
    return this.loadCached<MaterialConfig[]>('materials', 'claims-materials');
  }

  /**
   * 加载理赔项目配置
   */
  async loadClaimItems(): Promise<ClaimItemConfig[]> {
    return this.loadCached<ClaimItemConfig[]>('claimItems', 'claim-items');
  }

  /**
   * 加载计算公式配置
   */
  async loadFormulas(): Promise<Record<string, FormulaConfig>> {
    return this.loadCached<Record<string, FormulaConfig>>('formulas', 'calculation-formulas');
  }

  /**
   * 加载险种类型配置
   */
  async loadInsuranceTypes(): Promise<InsuranceTypeConfig[]> {
    return this.loadCached<InsuranceTypeConfig[]>('insuranceTypes', 'insurance-types');
  }

  /**
   * 加载产品理赔配置
   */
  async loadProductClaimConfigs(): Promise<ProductClaimConfig[]> {
    return this.loadCached<ProductClaimConfig[]>('productClaims', 'product-claim-configs');
  }

  /**
   * 根据 ID 获取材料配置
   */
  async getMaterialById(id: string): Promise<MaterialConfig | null> {
    const materials = await this.loadMaterials();
    return materials.find(m => m.id === id) || null;
  }

  /**
   * 根据 ID 获取理赔项目配置
   */
  async getClaimItemById(id: string): Promise<ClaimItemConfig | null> {
    const items = await this.loadClaimItems();
    return items.find(i => i.id === id) || null;
  }

  /**
   * 根据名称获取险种类型配置
   */
  async getInsuranceTypeByName(name: string): Promise<InsuranceTypeConfig | null> {
    const types = await this.loadInsuranceTypes();
    return types.find(t => t.name === name || t.code === name) || null;
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[ConfigService] Cache cleared');
  }

  /**
   * 获取缓存状态
   */
  getCacheStatus(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * 带缓存的加载方法
   */
  private async loadCached<T>(cacheKey: string, configName: string): Promise<T> {
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      console.log(`[ConfigService] Cache hit: ${cacheKey}`);
      return this.cache.get(cacheKey) as T;
    }

    console.log(`[ConfigService] Loading: ${configName}`);
    
    try {
      // 尝试从 API 加载
      const data = await this.fetchFromApi<T>(configName);
      this.cache.set(cacheKey, data);
      console.log(`[ConfigService] Loaded and cached: ${cacheKey}`);
      return data;
    } catch (error) {
      console.warn(`[ConfigService] Failed to load from API: ${configName}`, error);
      
      // 尝试从本地文件加载（开发环境）
      try {
        const data = await this.fetchFromFile<T>(configName);
        this.cache.set(cacheKey, data);
        console.log(`[ConfigService] Loaded from file: ${cacheKey}`);
        return data;
      } catch (fileError) {
        console.error(`[ConfigService] Failed to load config: ${configName}`, fileError);
        return [] as unknown as T;
      }
    }
  }

  /**
   * 从 API 获取配置
   */
  private async fetchFromApi<T>(configName: string): Promise<T> {
    const response = await fetch(`${this.basePath}/${configName}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * 从本地文件获取配置（开发环境备用）
   */
  private async fetchFromFile<T>(configName: string): Promise<T> {
    // 使用动态导入
    const path = `../jsonlist/${configName}.json`;
    
    try {
      // 尝试使用 fetch 读取本地文件
      const response = await fetch(path);
      if (response.ok) {
        return response.json();
      }
    } catch {
      // 如果 fetch 失败，返回空数据
      console.warn(`[ConfigService] Could not load from file: ${path}`);
    }
    
    return [] as unknown as T;
  }
}

// 导出单例实例
export const configService = new ConfigService();
