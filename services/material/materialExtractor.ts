import type { ClaimsMaterial } from '../types';
import type { ProcessingStrategy, StrategyContext, StrategyResult } from './strategies/baseStrategy';
import { strategyFactory } from './strategies/baseStrategy';
import { uploadToOSS } from '../services/ossService';

// Import all strategies for registration
import { StructuredDocStrategy } from './strategies/structuredDocStrategy';
import { GeneralDocStrategy } from './strategies/generalDocStrategy';
import { ImageOnlyStrategy } from './strategies/imageOnlyStrategy';
import { InvoiceStrategy } from './strategies/invoiceStrategy';

// Register all strategies
strategyFactory.register('structured_doc', StructuredDocStrategy);
strategyFactory.register('general_doc', GeneralDocStrategy);
strategyFactory.register('image_only', ImageOnlyStrategy);
strategyFactory.register('invoice', InvoiceStrategy);

/**
 * 材料提取服务
 * 协调文件上传、策略路由和结果返回
 */
export class MaterialExtractor {
  /**
   * 提取材料信息
   * @param fileSource - 文件源（File, Blob, 或 OSS URL）
   * @param materialConfig - 材料类型配置
   * @param context - 额外上下文
   * @returns 提取结果
   */
  async extract(
    fileSource: File | Blob | string,
    materialConfig: ClaimsMaterial,
    context?: Partial<StrategyContext>
  ): Promise<StrategyResult> {
    const strategy = this.routeToStrategy(materialConfig.processingStrategy);
    
    const strategyContext: StrategyContext = {
      materialId: materialConfig.id,
      materialName: materialConfig.name,
      materialCategory: materialConfig.category,
      extractionConfig: materialConfig.extractionConfig,
      ...context,
    };

    return strategy.process(fileSource, strategyContext);
  }

  /**
   * 预处理文件（上传到OSS）
   * @param file - 文件
   * @returns OSS信息
   */
  async preprocessFile(file: File | Blob): Promise<{ ossKey: string; ossUrl: string }> {
    const result = await uploadToOSS(file, 'materials');
    return {
      ossKey: result.objectKey,
      ossUrl: result.url,
    };
  }

  /**
   * 根据处理策略路由到对应策略
   * @param processingStrategy - 处理策略类型
   * @returns 策略实例
   */
  private routeToStrategy(
    processingStrategy?: string
  ): ProcessingStrategy {
    const strategyName = processingStrategy || 'general_doc';
    
    if (!strategyFactory.has(strategyName)) {
      console.warn(`Unknown strategy '${strategyName}', falling back to general_doc`);
      return strategyFactory.create('general_doc');
    }

    return strategyFactory.create(strategyName);
  }

  /**
   * 获取所有可用的策略名称
   * @returns 策略名称列表
   */
  getAvailableStrategies(): string[] {
    return strategyFactory.getAvailableStrategies();
  }
}

/**
 * 全局提取服务实例
 */
export const materialExtractor = new MaterialExtractor();

// Re-export types
export type { StrategyResult, StrategyContext };
