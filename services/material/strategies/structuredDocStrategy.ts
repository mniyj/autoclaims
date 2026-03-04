import type { ProcessingStrategy, StrategyContext, StrategyResult } from './baseStrategy';
import { uploadToOSS } from '../../services/ossService';

/**
 * 结构化文档处理策略
 * 适用于有明确 schema 的材料类型（如身份证、病历等）
 * 3步流程：上传 → OCR+Schema提取 → 返回结果
 */
export class StructuredDocStrategy implements ProcessingStrategy {
  readonly name = 'structured_doc';

  async process(
    fileSource: File | Blob | string,
    context: StrategyContext
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    const timings: StrategyResult['stepTimings'] = [];

    try {
      // Step 1: 上传到 OSS
      timings.push({ step: 'upload', label: '文件上传', startTime: Date.now() });
      let ossUrl: string;
      let ossKey: string;

      if (typeof fileSource === 'string' && fileSource.startsWith('http')) {
        ossUrl = fileSource;
        ossKey = new URL(fileSource).pathname.replace(/^\//, '');
      } else {
        const file = fileSource instanceof File ? fileSource : new File([fileSource], 'document.jpg');
        const result = await uploadToOSS(file, 'materials');
        ossUrl = result.url;
        ossKey = result.objectKey;
      }
      timings[0].endTime = Date.now();
      timings[0].duration = timings[0].endTime - timings[0].startTime;

      // Step 2: OCR + Schema提取
      timings.push({ step: 'ocr', label: 'OCR识别', startTime: Date.now() });
      const extractionConfig = context.extractionConfig;
      if (!extractionConfig) {
        throw new Error('ExtractionConfig is required for structured document processing');
      }

      const ocrResult = await this.performOcrWithSchema(
        ossUrl,
        extractionConfig.jsonSchema,
        extractionConfig.aiAuditPrompt,
        context.materialName
      );
      timings[1].endTime = Date.now();
      timings[1].duration = timings[1].endTime - timings[1].startTime;

      return {
        success: true,
        extractedData: ocrResult.extractedData,
        rawOcrText: ocrResult.rawText,
        confidence: ocrResult.confidence,
        duration: Date.now() - startTime,
        stepTimings: timings,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        stepTimings: timings,
      };
    }
  }

  supports(materialId: string, category?: string): boolean {
    // 支持大部分结构化文档类型
    // 排除明确的发票类型（mat-20, mat-21）
    if (materialId === 'mat-20' || materialId === 'mat-21') {
      return false;
    }
    return true;
  }

  /**
   * 执行OCR并根据Schema提取字段
   */
  private async performOcrWithSchema(
    imageUrl: string,
    jsonSchema: Record<string, any>,
    aiAuditPrompt: string,
    materialName?: string
  ): Promise<{
    extractedData: Record<string, any>;
    rawText: string;
    confidence: number;
  }> {
    const geminiModel = 'gemini-2.5-flash';

    // 下载图片并转为 base64
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const base64 = await this.blobToBase64(blob);

    const prompt = `你是一个专业的保险理赔材料识别系统。请对「${materialName || '文档'}」进行OCR识别和字段提取。

## 提取要求
请严格根据图片中可见的文字内容提取信息，按以下JSON Schema结构提取：
${JSON.stringify(jsonSchema, null, 2)}

## 审核要求
${aiAuditPrompt || '提取所有可见字段，确保信息准确'}

## 重要规则
1. 只提取图片中**明确可见**的文字和数字，严禁补充、推测或编造任何信息
2. 如果某个区域模糊不清或被遮挡，对应字段返回空字符串，**不要猜测**
3. 数字必须严格按图片显示提取
4. 日期格式统一为 YYYY-MM-DD
5. 无法识别的字段：字符串用空字符串""，数字用0

## 输出格式
请严格返回以下JSON格式（不要包含markdown代码块标记）：
{
  "extractedData": { ... 按schema提取的字段 },
  "rawText": "原始识别的完整文本",
  "confidence": 0.95
}`;

    const apiResponse = await fetch('/api/invoice-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'gemini',
        base64Data: base64,
        mimeType: blob.type || 'image/jpeg',
        prompt,
        geminiModel,
      }),
    });

    if (!apiResponse.ok) {
      const error = await apiResponse.json().catch(() => ({}));
      throw new Error(error.message || 'OCR recognition failed');
    }

    const result = await apiResponse.json();
    const responseText = result.text || '{}';

    try {
      const parsed = JSON.parse(responseText);
      return {
        extractedData: parsed.extractedData || {},
        rawText: parsed.rawText || responseText,
        confidence: parsed.confidence || 0.8,
      };
    } catch {
      return {
        extractedData: {},
        rawText: responseText,
        confidence: 0.5,
      };
    }
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
