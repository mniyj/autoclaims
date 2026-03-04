import type { ClaimsMaterial, ClassificationResult, MaterialAuditConclusion } from '../types';
import type { StrategyResult, StrategyContext } from './strategies/baseStrategy';
import { materialClassifier } from './materialClassifier';
import { materialExtractor } from './materialExtractor';
import { materialValidator } from './materialValidator';

/**
 * 处理结果
 */
export interface ProcessResult {
  /** 是否成功 */
  success: boolean;
  /** 分类结果 */
  classification: ClassificationResult;
  /** 提取结果 */
  extraction?: StrategyResult;
  /** 审核结论 */
  auditConclusion?: MaterialAuditConclusion;
  /** 错误信息 */
  error?: string;
  /** 总耗时 */
  duration: number;
}

/**
 * 统一材料处理服务
 * 协调分类、提取、验证的完整流程
 */
export class UnifiedMaterialService {
  /**
   * 仅分类材料
   * @param fileSource - 文件源
   * @param availableMaterials - 可用的材料类型列表
   * @param targetMaterialId - 可选，指定的目标材料类型
   * @returns 分类结果
   */
  async classify(
    fileSource: File | Blob | string,
    availableMaterials: ClaimsMaterial[],
    targetMaterialId?: string
  ): Promise<ClassificationResult> {
    return materialClassifier.classify(fileSource, availableMaterials, targetMaterialId);
  }

  /**
   * 完整处理流程：分类 → 提取 → 验证
   * @param fileSource - 文件源
   * @param materialConfig - 材料类型配置
   * @param context - 额外上下文
   * @returns 完整处理结果
   */
  async process(
    fileSource: File | Blob | string,
    materialConfig: ClaimsMaterial,
    context?: Partial<StrategyContext>
  ): Promise<ProcessResult> {
    const startTime = Date.now();

    try {
      // 步骤1：提取
      const extraction = await materialExtractor.extract(
        fileSource,
        materialConfig,
        context
      );

      if (!extraction.success) {
        return {
          success: false,
          classification: {
            materialId: materialConfig.id,
            materialName: materialConfig.name,
            confidence: 0,
            category: materialConfig.category || 'other',
            isConfident: false,
          },
          extraction,
          error: extraction.error,
          duration: Date.now() - startTime,
        };
      }

      // 步骤2：验证
      const auditConclusion = materialValidator.validate(
        extraction.extractedData || {},
        materialConfig.extractionConfig
      );

      return {
        success: true,
        classification: {
          materialId: materialConfig.id,
          materialName: materialConfig.name,
          confidence: extraction.confidence || 0,
          category: materialConfig.category || 'other',
          isConfident: (extraction.confidence || 0) >= 0.85,
        },
        extraction,
        auditConclusion,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        classification: {
          materialId: materialConfig.id,
          materialName: materialConfig.name,
          confidence: 0,
          category: materialConfig.category || 'other',
          isConfident: false,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 批量处理
   * @param files - 文件列表
   * @param getMaterialConfig - 根据分类结果获取材料配置的函数
   * @param context - 额外上下文
   * @returns 处理结果列表
   */
  async batchProcess(
    files: Array<{ file: File | Blob | string; targetMaterialId?: string }>,
    getMaterialConfig: (materialId: string) => ClaimsMaterial | undefined,
    context?: Partial<StrategyContext>
  ): Promise<ProcessResult[]> {
    const CONCURRENCY = 3; // 最大并发数
    const results: ProcessResult[] = [];

    // 分批处理
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = files.slice(i, i + CONCURRENCY);
      
      const batchResults = await Promise.all(
        batch.map(async ({ file, targetMaterialId }) => {
          if (targetMaterialId) {
            // 如果指定了材料类型，直接处理
            const materialConfig = getMaterialConfig(targetMaterialId);
            if (!materialConfig) {
              return {
                success: false,
                classification: {
                  materialId: targetMaterialId,
                  materialName: '未知材料',
                  confidence: 0,
                  category: 'other' as any,
                  isConfident: false,
                },
                error: `Material config not found for ID: ${targetMaterialId}`,
                duration: 0,
              };
            }
            return this.process(file, materialConfig, context);
          } else {
            // 否则先分类（这里简化处理，实际应该先分类再处理）
            return {
              success: false,
              classification: {
                materialId: '',
                materialName: '',
                confidence: 0,
                category: 'other' as any,
                isConfident: false,
              },
              error: 'Batch processing requires targetMaterialId. Use classify() first.',
              duration: 0,
            };
          }
        })
      );

      results.push(...batchResults);
    }

    return results;
  }
}

/**
 * 全局统一服务实例
 */
export const unifiedMaterialService = new UnifiedMaterialService();
