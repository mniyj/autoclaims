import type { ProcessingStrategy, StrategyContext, StrategyResult } from './baseStrategy';
import { uploadToOSS } from '../../services/ossService';

/**
 * 通用文档处理策略
 * 适用于没有固定 schema 的文档，使用 AI 自由分析
 * AI-based document analysis and summarization
 */
export class GeneralDocStrategy implements ProcessingStrategy {
  readonly name = 'general_doc';

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

      if (typeof fileSource === 'string' && fileSource.startsWith('http')) {
        ossUrl = fileSource;
      } else {
        const file = fileSource instanceof File ? fileSource : new File([fileSource], 'document.jpg');
        const result = await uploadToOSS(file, 'materials');
        ossUrl = result.url;
      }
      timings[0].endTime = Date.now();
      timings[0].duration = timings[0].endTime - timings[0].startTime;

      // Step 2: AI 分析
      timings.push({ step: 'analysis', label: 'AI分析', startTime: Date.now() });
      const analysisResult = await this.performAiAnalysis(
        ossUrl,
        context.materialName
      );
      timings[1].endTime = Date.now();
      timings[1].duration = timings[1].endTime - timings[1].startTime;

      return {
        success: true,
        extractedData: {
          summary: analysisResult.summary,
          keyFields: analysisResult.keyFields,
          documentType: analysisResult.documentType,
        },
        rawOcrText: analysisResult.rawText,
        confidence: analysisResult.confidence,
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

  supports(): boolean {
    // 通用策略支持所有文档类型
    return true;
  }

  /**
   * 执行 AI 分析
   */
  private async performAiAnalysis(
    imageUrl: string,
    materialName?: string
  ): Promise<{
    summary: string;
    keyFields: Record<string, string>;
    documentType: string;
    rawText: string;
    confidence: number;
  }> {
    const geminiModel = 'gemini-2.5-flash';

    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const base64 = await this.blobToBase64(blob);

    const prompt = `你是一个专业的文档分析助手。请分析这张图片中的「${materialName || '文档'}」。

请完成以下分析：
1. 文档类型识别（如：证明、申请单、通知书、其他等）
2. 文档摘要（用2-3句话总结文档主要内容）
3. 关键信息提取（以键值对形式列出所有重要信息）
4. 原始文本识别（尽可能提取所有可见文字）
5. 置信度评估（0-1之间，评估识别的可靠程度）

## 输出格式
请严格返回以下JSON格式：
{
  "documentType": "文档类型",
  "summary": "文档摘要",
  "keyFields": {
    "字段名1": "值1",
    "字段名2": "值2"
  },
  "rawText": "提取的完整原始文本",
  "confidence": 0.85
}

注意：如果文档模糊不清无法识别，confidence 应该低于 0.5，并在 summary 中说明问题。`;

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
      throw new Error(error.message || 'AI analysis failed');
    }

    const result = await apiResponse.json();
    const responseText = result.text || '{}';

    try {
      const parsed = JSON.parse(responseText);
      return {
        documentType: parsed.documentType || '未知',
        summary: parsed.summary || '无法生成摘要',
        keyFields: parsed.keyFields || {},
        rawText: parsed.rawText || responseText,
        confidence: parsed.confidence || 0.5,
      };
    } catch {
      // 如果 JSON 解析失败，返回原始文本作为摘要
      return {
        documentType: '未知',
        summary: responseText.substring(0, 200),
        keyFields: {},
        rawText: responseText,
        confidence: 0.3,
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
