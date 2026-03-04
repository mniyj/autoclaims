import type { ProcessingStrategy, StrategyContext, StrategyResult } from './baseStrategy';
import { uploadToOSS } from '../../services/ossService';
import { api } from '../../services/api';

/**
 * 医疗发票处理策略
 * 8步完整流程：OCR → 医院校验 → 目录匹配 → 汇总
 * 独立设计，不依赖现有 InvoiceAuditPage 代码
 */
export class InvoiceStrategy implements ProcessingStrategy {
  readonly name = 'invoice';

  async process(
    fileSource: File | Blob | string,
    context: StrategyContext
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    const timings: StrategyResult['stepTimings'] = [];

    try {
      // Step 1: 上传
      timings.push({ step: 'upload', label: '文件上传', startTime: Date.now() });
      const { ossUrl, ossKey } = await this.uploadFile(fileSource);
      timings[0].endTime = Date.now();
      timings[0].duration = timings[0].endTime - timings[0].startTime;

      // Step 2: OCR识别
      timings.push({ step: 'ocr', label: 'OCR识别', startTime: Date.now() });
      const ocrResult = await this.performOcr(ossUrl);
      timings[1].endTime = Date.now();
      timings[1].duration = timings[1].endTime - timings[1].startTime;

      // Step 3: 医院校验
      timings.push({ step: 'hospital', label: '医院校验', startTime: Date.now() });
      const hospitalValidation = await this.validateHospital(
        ocrResult.hospitalName,
        context.province
      );
      timings[2].endTime = Date.now();
      timings[2].duration = timings[2].endTime - timings[2].startTime;

      // Step 4: 获取医保目录
      timings.push({ step: 'catalog_fetch', label: '获取医保目录', startTime: Date.now() });
      const catalogData = await this.fetchCatalog(context.province);
      timings[3].endTime = Date.now();
      timings[3].duration = timings[3].endTime - timings[3].startTime;

      // Step 5 & 6: 目录匹配
      timings.push({ step: 'catalog_match', label: '目录匹配', startTime: Date.now() });
      const matchedItems = await this.matchCatalogItems(
        ocrResult.chargeItems,
        catalogData
      );
      timings[4].endTime = Date.now();
      timings[4].duration = timings[4].endTime - timings[4].startTime;

      // Step 7: 汇总
      timings.push({ step: 'summary', label: '汇总计算', startTime: Date.now() });
      const summary = this.calculateSummary(matchedItems, ocrResult.totalAmount);
      timings[5].endTime = Date.now();
      timings[5].duration = timings[5].endTime - timings[5].startTime;

      return {
        success: true,
        extractedData: {
          invoiceInfo: ocrResult.invoiceInfo,
          basicInfo: ocrResult.basicInfo,
          chargeItems: matchedItems,
          hospitalValidation,
          summary,
          insurancePayment: ocrResult.insurancePayment,
        },
        rawOcrText: JSON.stringify(ocrResult),
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

  supports(materialId: string): boolean {
    // 只支持发票类型：mat-20 (医疗费发票), mat-21 (费用明细清单)
    return materialId === 'mat-20' || materialId === 'mat-21';
  }

  // ============ 私有方法 ============

  private async uploadFile(fileSource: File | Blob | string): Promise<{ ossUrl: string; ossKey: string }> {
    if (typeof fileSource === 'string' && fileSource.startsWith('http')) {
      return {
        ossUrl: fileSource,
        ossKey: new URL(fileSource).pathname.replace(/^\//, ''),
      };
    }
    const file = fileSource instanceof File ? fileSource : new File([fileSource], 'invoice.jpg');
    const result = await uploadToOSS(file, 'invoices');
    return { ossUrl: result.url, ossKey: result.objectKey };
  }

  private async performOcr(imageUrl: string): Promise<{
    invoiceInfo: any;
    basicInfo: any;
    chargeItems: any[];
    insurancePayment: any;
    hospitalName: string;
    totalAmount: number;
    confidence: number;
    documentType: string;
  }> {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const base64 = await this.blobToBase64(blob);

    const schema = {
      documentType: "string ('summary_invoice' | 'detail_list' | 'single_invoice')",
      basicInfo: {
        name: "string (患者姓名)",
        gender: "string (性别)",
        age: "string (年龄)",
        admissionDate: "string (入院日期 YYYY-MM-DD)",
        dischargeDate: "string (出院日期 YYYY-MM-DD)",
        department: "string (科室)",
      },
      chargeItems: [{
        itemName: "string (费用项目名称)",
        specifications: "string (规格)",
        quantity: "number (数量)",
        unitPrice: "number (单价)",
        totalPrice: "number (总价)",
      }],
      totalAmount: "number (总金额)",
      insurancePayment: {
        governmentFundPayment: "number (统筹基金支付)",
        personalPayment: "number (个人支付)",
        personalSelfPayment: "number (个人自付)",
        personalSelfExpense: "number (个人自费)",
      },
      invoiceInfo: {
        invoiceCode: "string (发票代码)",
        invoiceNumber: "string (发票号码)",
        issueDate: "string (开票日期)",
        hospitalName: "string (医院名称)",
      },
    };

    const prompt = `你是专业的医疗发票OCR识别系统。请识别图片中的医疗发票信息。

重要规则：
1. 首先判断文档类型：summary_invoice(汇总发票), detail_list(明细清单), single_invoice(单张发票)
2. 只提取图片中明确可见的文字，不要猜测
3. 数字必须准确，注意小数点
4. 日期格式：YYYY-MM-DD
5. 所有金额单位为元

请按以下JSON格式返回：
${JSON.stringify(schema, null, 2)}`;

    const apiResponse = await fetch('/api/invoice-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'gemini',
        base64Data: base64,
        mimeType: blob.type || 'image/jpeg',
        prompt,
        geminiModel: 'gemini-2.5-flash',
      }),
    });

    if (!apiResponse.ok) {
      throw new Error('OCR recognition failed');
    }

    const result = await apiResponse.json();
    const parsed = JSON.parse(result.text || '{}');

    return {
      invoiceInfo: parsed.invoiceInfo || {},
      basicInfo: parsed.basicInfo || {},
      chargeItems: parsed.chargeItems || [],
      insurancePayment: parsed.insurancePayment || {},
      hospitalName: parsed.invoiceInfo?.hospitalName || '',
      totalAmount: parsed.totalAmount || 0,
      confidence: 0.85,
      documentType: parsed.documentType || 'single_invoice',
    };
  }

  private async validateHospital(hospitalName: string, province?: string): Promise<{
    isQualified: boolean;
    hospitalName: string;
    matchedHospital?: any;
    reason?: string;
  }> {
    if (!hospitalName) {
      return { isQualified: false, hospitalName: '', reason: '未识别到医院名称' };
    }

    try {
      const hospitals = await api.hospitalInfo.list() as any[];
      const matched = hospitals.find(h => 
        hospitalName.includes(h.name) || h.name.includes(hospitalName)
      );

      if (!matched) {
        return { isQualified: false, hospitalName, reason: '未在医院数据库中找到' };
      }

      if (!matched.qualifiedForInsurance) {
        return {
          isQualified: false,
          hospitalName,
          matchedHospital: matched,
          reason: '该医院不符合保险理赔要求',
        };
      }

      return { isQualified: true, hospitalName, matchedHospital: matched };
    } catch {
      return { isQualified: false, hospitalName, reason: '医院数据库查询失败' };
    }
  }

  private async fetchCatalog(province?: string): Promise<any[]> {
    try {
      return await api.medicalInsuranceCatalog.list() as any[];
    } catch {
      return [];
    }
  }

  private async matchCatalogItems(chargeItems: any[], catalogData: any[]): Promise<any[]> {
    // 简化版目录匹配
    return chargeItems.map(item => {
      const normalizedName = this.normalizeItemName(item.itemName);
      const matched = catalogData.find(c => 
        this.normalizeItemName(c.name) === normalizedName
      );

      return {
        ...item,
        catalogMatch: matched ? {
          matched: true,
          itemName: matched.name,
          type: matched.type, // A/B/C
          matchConfidence: 90,
        } : {
          matched: false,
          matchConfidence: 0,
        },
        isQualified: matched?.type === 'A' || matched?.type === 'B',
      };
    });
  }

  private calculateSummary(matchedItems: any[], totalAmount: number): {
    totalAmount: number;
    qualifiedAmount: number;
    unqualifiedAmount: number;
    qualifiedItemCount: number;
    unqualifiedItemCount: number;
  } {
    const qualified = matchedItems.filter(i => i.isQualified);
    const unqualified = matchedItems.filter(i => !i.isQualified);

    return {
      totalAmount,
      qualifiedAmount: qualified.reduce((sum, i) => sum + (i.totalPrice || 0), 0),
      unqualifiedAmount: unqualified.reduce((sum, i) => sum + (i.totalPrice || 0), 0),
      qualifiedItemCount: qualified.length,
      unqualifiedItemCount: unqualified.length,
    };
  }

  private normalizeItemName(name: string): string {
    return name?.toLowerCase().replace(/\s+/g, '') || '';
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
