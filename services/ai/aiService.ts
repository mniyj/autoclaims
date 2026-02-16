import { AIInteractionLog, MedicalInvoiceData } from '../types';

export type AIProviderType = 'gemini' | 'claude' | 'openai' | 'glm';

// AI 提供商配置接口
export interface AIProviderConfig {
  name: AIProviderType;
  apiKey: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

// 调用指标
export interface AIMetrics {
  provider: AIProviderType;
  model: string;
  startTime: number;
  endTime: number;
  latency: number; // ms
  inputTokens: number;
  outputTokens: number;
  cost: number; // USD
  success: boolean;
  error?: string;
}

// 调用记录（用于对比分析）
export interface AIInvocationRecord {
  id: string;
  timestamp: number;
  provider: AIProviderType;
  model: string;
  task: string; // 'ocr', 'chat', 'audit'
  input: string; // 输入摘要或 hash
  output: any;
  metrics: AIMetrics;
  accuracy?: number; // 人工标注的准确性评分
  notes?: string;
}

// AI 提供商抽象接口
export interface AIProvider {
  readonly name: AIProviderType;
  readonly model: string;
  
  // 核心调用方法
  invoke(prompt: string, options?: any): Promise<{ content: string; usage: any }>;
  
  // 计算成本
  calculateCost(inputTokens: number, outputTokens: number): number;
  
  // 提取 token 使用量
  extractUsage(response: any): { inputTokens: number; outputTokens: number };
}

// 全局配置（可以来自 localStorage、环境变量或后端）
class AIConfigManager {
  private static instance: AIConfigManager;
  private configs: Map<AIProviderType, AIProviderConfig> = new Map();
  private currentProvider: AIProviderType = 'gemini';
  private abTestMode: boolean = false;
  private abTestProviders: AIProviderType[] = [];

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): AIConfigManager {
    if (!AIConfigManager.instance) {
      AIConfigManager.instance = new AIConfigManager();
    }
    return AIConfigManager.instance;
  }

  // 从 localStorage 加载配置
  private loadFromStorage() {
    try {
      const saved = localStorage.getItem('ai_provider_configs');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.configs = new Map(Object.entries(parsed.configs));
        this.currentProvider = parsed.currentProvider || 'gemini';
        this.abTestMode = parsed.abTestMode || false;
        this.abTestProviders = parsed.abTestProviders || [];
      }
    } catch (e) {
      console.warn('Failed to load AI configs from storage');
    }
  }

  // 保存到 localStorage
  private saveToStorage() {
    const data = {
      configs: Object.fromEntries(this.configs),
      currentProvider: this.currentProvider,
      abTestMode: this.abTestMode,
      abTestProviders: this.abTestProviders,
    };
    localStorage.setItem('ai_provider_configs', JSON.stringify(data));
  }

  // 设置提供商配置
  setProviderConfig(config: AIProviderConfig) {
    this.configs.set(config.name, config);
    this.saveToStorage();
  }

  // 获取提供商配置
  getProviderConfig(name: AIProviderType): AIProviderConfig | undefined {
    return this.configs.get(name);
  }

  // 设置当前使用的提供商
  setCurrentProvider(provider: AIProviderType) {
    this.currentProvider = provider;
    this.saveToStorage();
  }

  getCurrentProvider(): AIProviderType {
    return this.currentProvider;
  }

  // 启用 A/B 测试模式（同时调用多个提供商对比）
  enableABTest(providers: AIProviderType[]) {
    this.abTestMode = true;
    this.abTestProviders = providers;
    this.saveToStorage();
  }

  disableABTest() {
    this.abTestMode = false;
    this.abTestProviders = [];
    this.saveToStorage();
  }

  isABTestMode(): boolean {
    return this.abTestMode;
  }

  getABTestProviders(): AIProviderType[] {
    return this.abTestProviders;
  }

  // 获取所有已配置的提供商
  getAllConfigs(): AIProviderConfig[] {
    return Array.from(this.configs.values());
  }
}

// AI 调用记录存储
class AIInvocationStore {
  private static instance: AIInvocationStore;
  private records: AIInvocationRecord[] = [];
  private listeners: ((records: AIInvocationRecord[]) => void)[] = [];

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): AIInvocationStore {
    if (!AIInvocationStore.instance) {
      AIInvocationStore.instance = new AIInvocationStore();
    }
    return AIInvocationStore.instance;
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem('ai_invocation_records');
      if (saved) {
        this.records = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load AI records from storage');
    }
  }

  private saveToStorage() {
    // 只保留最近 1000 条记录
    const trimmed = this.records.slice(-1000);
    localStorage.setItem('ai_invocation_records', JSON.stringify(trimmed));
  }

  // 添加记录
  addRecord(record: AIInvocationRecord) {
    this.records.push(record);
    this.saveToStorage();
    this.notifyListeners();
  }

  // 获取所有记录
  getRecords(): AIInvocationRecord[] {
    return [...this.records];
  }

  // 按条件筛选记录
  filterRecords(filters: {
    provider?: AIProviderType;
    task?: string;
    startTime?: number;
    endTime?: number;
    minAccuracy?: number;
  }): AIInvocationRecord[] {
    return this.records.filter(r => {
      if (filters.provider && r.provider !== filters.provider) return false;
      if (filters.task && r.task !== filters.task) return false;
      if (filters.startTime && r.timestamp < filters.startTime) return false;
      if (filters.endTime && r.timestamp > filters.endTime) return false;
      if (filters.minAccuracy && (r.accuracy === undefined || r.accuracy < filters.minAccuracy)) return false;
      return true;
    });
  }

  // 获取统计信息
  getStats(): {
    totalCalls: number;
    byProvider: Record<AIProviderType, { calls: number; avgLatency: number; avgCost: number; successRate: number }>;
    byTask: Record<string, { calls: number; avgAccuracy: number }>;
  } {
    const byProvider: any = {};
    const byTask: any = {};

    this.records.forEach(r => {
      // Provider stats
      if (!byProvider[r.provider]) {
        byProvider[r.provider] = { calls: 0, totalLatency: 0, totalCost: 0, successes: 0 };
      }
      byProvider[r.provider].calls++;
      byProvider[r.provider].totalLatency += r.metrics.latency;
      byProvider[r.provider].totalCost += r.metrics.cost;
      if (r.metrics.success) byProvider[r.provider].successes++;

      // Task stats
      if (!byTask[r.task]) {
        byTask[r.task] = { calls: 0, totalAccuracy: 0, accuracyCount: 0 };
      }
      byTask[r.task].calls++;
      if (r.accuracy !== undefined) {
        byTask[r.task].totalAccuracy += r.accuracy;
        byTask[r.task].accuracyCount++;
      }
    });

    // Calculate averages
    Object.keys(byProvider).forEach(key => {
      const p = byProvider[key];
      byProvider[key] = {
        calls: p.calls,
        avgLatency: p.calls > 0 ? Math.round(p.totalLatency / p.calls) : 0,
        avgCost: p.calls > 0 ? p.totalCost / p.calls : 0,
        successRate: p.calls > 0 ? (p.successes / p.calls) * 100 : 0,
      };
    });

    Object.keys(byTask).forEach(key => {
      const t = byTask[key];
      byTask[key] = {
        calls: t.calls,
        avgAccuracy: t.accuracyCount > 0 ? t.totalAccuracy / t.accuracyCount : 0,
      };
    });

    return {
      totalCalls: this.records.length,
      byProvider,
      byTask,
    };
  }

  // 更新准确性评分（人工标注）
  updateAccuracy(recordId: string, accuracy: number, notes?: string) {
    const record = this.records.find(r => r.id === recordId);
    if (record) {
      record.accuracy = accuracy;
      if (notes) record.notes = notes;
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  // 导出记录（用于分析）
  exportToCSV(): string {
    const headers = ['ID', 'Timestamp', 'Provider', 'Model', 'Task', 'Latency(ms)', 'Cost(USD)', 'Success', 'Accuracy', 'Notes'];
    const rows = this.records.map(r => [
      r.id,
      new Date(r.timestamp).toISOString(),
      r.provider,
      r.model,
      r.task,
      r.metrics.latency,
      r.metrics.cost.toFixed(6),
      r.metrics.success,
      r.accuracy ?? '',
      r.notes ?? '',
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  // 订阅更新
  subscribe(listener: (records: AIInvocationRecord[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.records));
  }

  // 清空记录
  clear() {
    this.records = [];
    this.saveToStorage();
    this.notifyListeners();
  }
}

// 生成唯一 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 主 AI 服务类
export class AIService {
  private configManager = AIConfigManager.getInstance();
  private store = AIInvocationStore.getInstance();
  private providers: Map<AIProviderType, AIProvider> = new Map();

  // 注册 AI 提供商
  registerProvider(provider: AIProvider) {
    this.providers.set(provider.name, provider);
  }

  // 获取当前提供商实例
  private getProvider(name: AIProviderType): AIProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`AI provider '${name}' not registered`);
    }
    return provider;
  }

  // 主调用方法（支持 A/B 测试）
  async invoke(
    task: string,
    prompt: string,
    options?: {
      provider?: AIProviderType;
      compareWith?: AIProviderType[]; // A/B 测试时对比的提供商
      parseOutput?: (content: string) => any;
    }
  ): Promise<{ result: any; records: AIInvocationRecord[]; comparison?: any }> {
    const records: AIInvocationRecord[] = [];

    // A/B 测试模式
    if (options?.compareWith && options.compareWith.length > 0) {
      const providers = [options.provider || this.configManager.getCurrentProvider(), ...options.compareWith];
      const results = await Promise.all(
        providers.map(p => this.invokeSingle(task, prompt, p, options.parseOutput))
      );

      results.forEach(r => records.push(r.record));

      return {
        result: results[0].result,
        records,
        comparison: {
          providers: results.map(r => ({
            provider: r.record.provider,
            latency: r.record.metrics.latency,
            cost: r.record.metrics.cost,
            success: r.record.metrics.success,
          })),
        },
      };
    }

    // 普通模式
    const provider = options?.provider || this.configManager.getCurrentProvider();
    const { result, record } = await this.invokeSingle(task, prompt, provider, options?.parseOutput);
    records.push(record);

    return { result, records };
  }

  // 单次调用
  private async invokeSingle(
    task: string,
    prompt: string,
    providerName: AIProviderType,
    parseOutput?: (content: string) => any
  ): Promise<{ result: any; record: AIInvocationRecord }> {
    const provider = this.getProvider(providerName);
    const config = this.configManager.getProviderConfig(providerName);
    
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    let content: string = '';
    let usage: any;

    try {
      const response = await provider.invoke(prompt, config);
      content = response.content;
      usage = response.usage;
      success = true;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      console.error(`AI invoke failed [${providerName}]:`, error);
    }

    const endTime = Date.now();
    const { inputTokens, outputTokens } = success ? provider.extractUsage(usage) : { inputTokens: 0, outputTokens: 0 };
    const cost = success ? provider.calculateCost(inputTokens, outputTokens) : 0;

    const metrics: AIMetrics = {
      provider: providerName,
      model: provider.model,
      startTime,
      endTime,
      latency: endTime - startTime,
      inputTokens,
      outputTokens,
      cost,
      success,
      error,
    };

    let result: any;
    if (success && parseOutput) {
      try {
        result = parseOutput(content);
      } catch (e) {
        result = { raw: content, parseError: true };
      }
    } else {
      result = success ? content : null;
    }

    const record: AIInvocationRecord = {
      id: generateId(),
      timestamp: startTime,
      provider: providerName,
      model: provider.model,
      task,
      input: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''), // 输入摘要
      output: result,
      metrics,
    };

    this.store.addRecord(record);

    return { result, record };
  }

  // 便捷方法：OCR
  async ocr(imageBase64: string, schema: any, options?: { provider?: AIProviderType; compareWith?: AIProviderType[] }) {
    const prompt = `识别医疗发票，按以下 JSON Schema 返回：\n${JSON.stringify(schema, null, 2)}\n\n图片数据：${imageBase64.substring(0, 100)}...`;
    
    return this.invoke('ocr', prompt, {
      ...options,
      parseOutput: (content) => {
        try {
          // 尝试从 markdown code block 中提取 JSON
          const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
          const jsonStr = jsonMatch ? jsonMatch[1] : content;
          return JSON.parse(jsonStr);
        } catch (e) {
          return { raw: content, parseError: true };
        }
      },
    });
  }

  // 便捷方法：Chat
  async chat(message: string, context?: string, options?: { provider?: AIProviderType }) {
    const prompt = context ? `Context: ${context}\n\nUser: ${message}` : message;
    return this.invoke('chat', prompt, options);
  }

  // 获取记录存储（用于 UI 展示）
  getStore() {
    return this.store;
  }

  // 获取配置管理器
  getConfigManager() {
    return this.configManager;
  }
}

// 单例导出
export const aiService = new AIService();
export const aiConfigManager = AIConfigManager.getInstance();
export const aiInvocationStore = AIInvocationStore.getInstance();
