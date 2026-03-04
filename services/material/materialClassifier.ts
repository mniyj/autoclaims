import type { ClaimsMaterial, ClassificationResult, AiClassification, MaterialCategory } from '../types';
import { CLASSIFICATION_CONFIDENCE_THRESHOLD } from '../types';

/**
 * 材料分类器
 * 使用AI + 配置匹配进行智能材料类型识别
 */
export class MaterialClassifier {
  /**
   * 分类材料
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
    // 如果指定了目标材料，直接返回
    if (targetMaterialId) {
      const material = availableMaterials.find(m => m.id === targetMaterialId);
      if (material) {
        return {
          materialId: material.id,
          materialName: material.name,
          confidence: 1.0,
          category: material.category || 'other',
          isConfident: true,
        };
      }
    }

    // AI 识别文档类型
    const aiResult = await this.aiClassifyDocument(fileSource);

    // 匹配材料配置
    return this.matchToMaterial(aiResult, availableMaterials);
  }

  /**
   * AI 快速分类文档
   */
  private async aiClassifyDocument(
    fileSource: File | Blob | string
  ): Promise<AiClassification> {
    let base64Data: string;
    let mimeType = 'image/jpeg';

    // 处理输入
    if (typeof fileSource === 'string') {
      if (fileSource.startsWith('http')) {
        const response = await fetch(fileSource);
        const blob = await response.blob();
        base64Data = await this.blobToBase64(blob);
        mimeType = blob.type || 'image/jpeg';
      } else {
        base64Data = fileSource.replace(/^data:image\/\w+;base64,/, '');
      }
    } else {
      base64Data = await this.blobToBase64(fileSource);
      mimeType = (fileSource as File).type || 'image/jpeg';
    }

    const prompt = `你是专业的保险理赔材料识别专家。请分析这张图片，判断它是什么类型的理赔材料。

请识别以下信息并返回JSON格式：
{
  "documentCategory": "文档大类（如：身份证明、医疗材料、事故材料、收入材料、其他）",
  "documentSubType": "具体类型（如：身份证正面、发票、病历、诊断证明等）",
  "keyFeatures": ["关键特征1", "关键特征2", "关键特征3"],
  "confidence": 0.95
}

注意：
1. confidence 是识别置信度（0-1之间）
2. 如果图片模糊不清，confidence 应该低于 0.5
3. keyFeatures 应该是你观察到的关键视觉特征`;

    try {
      const response = await fetch('/api/invoice-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'gemini',
          base64Data,
          mimeType,
          prompt,
          geminiModel: 'gemini-2.5-flash',
        }),
      });

      if (!response.ok) {
        throw new Error('AI classification failed');
      }

      const result = await response.json();
      const parsed = JSON.parse(result.text || '{}');

      return {
        documentCategory: parsed.documentCategory || '未知',
        documentSubType: parsed.documentSubType || '未知',
        keyFeatures: parsed.keyFeatures || [],
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      // AI 失败时返回低置信度结果
      return {
        documentCategory: '未知',
        documentSubType: '未知',
        keyFeatures: [],
        confidence: 0.3,
      };
    }
  }

  /**
   * 将AI识别结果匹配到材料配置
   */
  private matchToMaterial(
    aiResult: AiClassification,
    materials: ClaimsMaterial[]
  ): ClassificationResult {
    // 计算每个材料的匹配分数
    const scoredMaterials = materials.map(material => ({
      material,
      score: this.calculateMatchScore(aiResult, material),
    }));

    // 按分数排序
    scoredMaterials.sort((a, b) => b.score - a.score);

    const best = scoredMaterials[0];
    const isConfident = best.score >= CLASSIFICATION_CONFIDENCE_THRESHOLD;

    // 收集备选（分数接近的）
    const alternatives = scoredMaterials
      .slice(1, 4)
      .filter(s => s.score > best.score - 0.2)
      .map(s => s.material.id);

    return {
      materialId: best.material.id,
      materialName: best.material.name,
      confidence: best.score,
      category: best.material.category || 'other',
      isConfident,
      alternatives: !isConfident && alternatives.length > 0 ? alternatives : undefined,
    };
  }

  /**
   * 计算匹配分数
   */
  private calculateMatchScore(
    aiResult: AiClassification,
    material: ClaimsMaterial
  ): number {
    let score = 0;

    // 1. 名称相似度（最高 0.5 分）
    const materialKeywords = material.name.split(/[（）()]/)[0]; // 去掉括号内容
    const normalizedName = materialKeywords.toLowerCase();
    
    if (aiResult.documentSubType.toLowerCase().includes(normalizedName) ||
        normalizedName.includes(aiResult.documentSubType.toLowerCase())) {
      score += 0.5;
    } else if (aiResult.keyFeatures.some(f => 
      f.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(f.toLowerCase())
    )) {
      score += 0.3;
    }

    // 2. 分类匹配（最高 0.3 分）
    const categoryMatch = this.mapCategoryToString(material.category);
    if (aiResult.documentCategory.includes(categoryMatch) ||
        categoryMatch.includes(aiResult.documentCategory)) {
      score += 0.3;
    }

    // 3. 特征匹配（最高 0.2 分）
    const materialDesc = material.description?.toLowerCase() || '';
    const featureMatches = aiResult.keyFeatures.filter(f => 
      materialDesc.includes(f.toLowerCase())
    ).length;
    score += Math.min(featureMatches * 0.1, 0.2);

    return Math.min(score, 1.0);
  }

  /**
   * 将 MaterialCategory 映射为字符串
   */
  private mapCategoryToString(category?: MaterialCategory): string {
    const categoryMap: Record<string, string> = {
      identity: '身份证明',
      medical: '医疗',
      accident: '事故',
      income: '收入',
      other: '其他',
    };
    return category ? categoryMap[category] || category : '其他';
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1] || base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

/**
 * 全局分类器实例
 */
export const materialClassifier = new MaterialClassifier();
