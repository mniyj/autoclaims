import { OCRResult, CorrectionRecord } from '../types';

/**
 * OCR 审核服务
 */
export class OCRReviewService {
  /**
   * 获取文档的 OCR 识别结果
   */
  static async getOCRResult(documentId: string): Promise<OCRResult | null> {
    try {
      const response = await fetch(`/api/ocr-results/${documentId}`);
      if (!response.ok) throw new Error('Failed to fetch OCR result');
      const data = await response.json();
      return data.data || null;
    } catch (error) {
      console.error('Error fetching OCR result:', error);
      return null;
    }
  }

  /**
   * 保存修正记录
   */
  static async saveCorrections(
    documentId: string,
    corrections: Partial<CorrectionRecord>[]
  ): Promise<CorrectionRecord[]> {
    const response = await fetch(`/api/ocr-results/${documentId}/corrections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ corrections }),
    });

    if (!response.ok) throw new Error('Failed to save corrections');
    const data = await response.json();
    return data.data || [];
  }

  /**
   * 获取修正历史
   */
  static async getCorrectionHistory(documentId: string): Promise<CorrectionRecord[]> {
    try {
      const response = await fetch(`/api/ocr-results/${documentId}/corrections`);
      if (!response.ok) throw new Error('Failed to fetch correction history');
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching correction history:', error);
      return [];
    }
  }

  /**
   * 批量通过高置信度字段
   */
  static async approveAllFields(
    documentId: string,
    fieldKeys: string[]
  ): Promise<void> {
    const response = await fetch(`/api/ocr-results/${documentId}/approve-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeys }),
    });

    if (!response.ok) throw new Error('Failed to approve fields');
  }
}

export default OCRReviewService;
