import type { ClaimsMaterial, ClassificationResult } from "../../types";
import { normalizeImageForOcr } from "../imageNormalizationService";

const CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.6;

/**
 * 材料分类器
 * 将文件发送至服务端统一分类接口，不使用文件名，基于文档内容识别材料类型
 */
export class MaterialClassifier {
  /**
   * 分类材料
   * @param fileSource - 文件源
   * @param availableMaterials - 可用的材料类型列表（用于填充备选项元数据）
   * @param targetMaterialId - 可选，指定的目标材料类型
   * @returns 分类结果
   */
  async classify(
    fileSource: File | Blob | string,
    availableMaterials: ClaimsMaterial[],
    targetMaterialId?: string,
  ): Promise<ClassificationResult> {
    // 如果指定了目标材料，直接返回
    if (targetMaterialId) {
      const material = availableMaterials.find(
        (m) => m.id === targetMaterialId,
      );
      if (material) {
        return {
          materialId: material.id,
          materialName: material.name,
          confidence: 1.0,
          category: material.category || "other",
          isConfident: true,
        };
      }
    }

    // 将文件转为 base64，发送至服务端统一分类接口
    const { base64Data, mimeType } = await normalizeImageForOcr(fileSource);

    const response = await fetch("/api/materials/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileSource: base64Data, mimeType }),
    });

    if (!response.ok) {
      return this.unknownResult();
    }

    const data = await response.json();
    if (!data.success || !data.classification) {
      return this.unknownResult();
    }

    const { materialId, materialName, confidence } = data.classification;

    // 从本地材料列表补充 category 元数据
    const matched = availableMaterials.find((m) => m.id === materialId);
    const isConfident =
      (confidence ?? 0) >= CLASSIFICATION_CONFIDENCE_THRESHOLD;

    return {
      materialId: materialId || "unknown",
      materialName: materialName || "未识别",
      confidence: confidence ?? 0,
      category: matched?.category || "other",
      isConfident,
    };
  }

  private unknownResult(): ClassificationResult {
    return {
      materialId: "unknown",
      materialName: "未识别",
      confidence: 0,
      category: "other",
      isConfident: false,
    };
  }
}

/**
 * 全局分类器实例
 */
export const materialClassifier = new MaterialClassifier();
