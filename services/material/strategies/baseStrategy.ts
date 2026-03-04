import type { ExtractionConfig, MaterialCategory } from '../../types';

/**
 * 策略上下文 - 传递给策略的共享上下文
 */
export interface StrategyContext {
  /** 材料类型ID */
  materialId?: string;
  /** 材料名称 */
  materialName?: string;
  /** 材料分类 */
  materialCategory?: MaterialCategory;
  /** 提取配置 */
  extractionConfig?: ExtractionConfig;
  /** 省份（用于医保目录匹配） */
  province?: string;
  /** 理赔案件ID */
  claimCaseId?: string;
  /** OSS存储路径 */
  ossKey?: string;
  /** OSS访问URL */
  ossUrl?: string;
}

/**
 * 策略处理结果
 */
export interface StrategyResult {
  /** 是否成功 */
  success: boolean;
  /** 提取的数据 */
  extractedData?: Record<string, any>;
  /** 原始OCR文本 */
  rawOcrText?: string;
  /** 置信度 (0-1) */
  confidence?: number;
  /** 错误信息 */
  error?: string;
  /** 处理耗时（毫秒） */
  duration?: number;
  /** 步骤计时 */
  stepTimings?: Array<{
    step: string;
    label: string;
    startTime: number;
    endTime?: number;
    duration?: number;
  }>;
}

/**
 * 处理策略接口
 * 所有材料处理策略必须实现此接口
 */
export interface ProcessingStrategy {
  /** 策略名称 */
  readonly name: string;

  /**
   * 处理材料
   * @param fileSource - 文件源（File, Blob, 或 OSS URL）
   * @param context - 策略上下文
   * @returns 处理结果
   */
  process(
    fileSource: File | Blob | string,
    context: StrategyContext
  ): Promise<StrategyResult>;

  /**
   * 检查此策略是否支持给定的材料类型
   * @param materialId - 材料类型ID
   * @param category - 材料分类
   * @returns 是否支持
   */
  supports(materialId: string, category?: MaterialCategory): boolean;
}

/**
 * 策略工厂
 * 注册和管理所有处理策略
 */
export class StrategyFactory {
  private strategies: Map<string, new () => ProcessingStrategy> = new Map();

  /**
   * 注册策略
   * @param name - 策略名称
   * @param StrategyClass - 策略类构造函数
   */
  register(name: string, StrategyClass: new () => ProcessingStrategy): void {
    this.strategies.set(name, StrategyClass);
  }

  /**
   * 创建策略实例
   * @param name - 策略名称
   * @returns 策略实例
   * @throws 如果策略未注册
   */
  create(name: string): ProcessingStrategy {
    const StrategyClass = this.strategies.get(name);
    if (!StrategyClass) {
      throw new Error(`Strategy '${name}' not found. Available strategies: ${this.getAvailableStrategies().join(', ')}`);
    }
    return new StrategyClass();
  }

  /**
   * 获取所有可用的策略名称
   * @returns 策略名称列表
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * 检查策略是否已注册
   * @param name - 策略名称
   * @returns 是否已注册
   */
  has(name: string): boolean {
    return this.strategies.has(name);
  }
}

/**
 * 全局策略工厂实例
 */
export const strategyFactory = new StrategyFactory();

/**
 * 处理策略类型
 */
export type ProcessingStrategyType =
  | 'invoice'           // 发票类：8步流程
  | 'structured_doc'    // 结构化文档：OCR+Schema提取
  | 'general_doc'       // 通用文档：OCR+AI分析
  | 'image_only';       // 纯图片：仅OCR
