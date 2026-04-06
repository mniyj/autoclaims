import { MedicalInvoiceData, AIInteractionLog } from '../types';
import { normalizeImageForOcr } from './imageNormalizationService';

/**
 * 识别医疗发票
 * @param imageSource - 可以是 base64 字符串、Blob 对象或 OSS URL
 * @returns 识别出的医疗发票数据及 AI 交互日志
 */
export const recognizeMedicalInvoice = async (
  imageSource: string | Blob,
  model?: 'gemini' | 'glm-ocr' | 'glm-ocr-structured' | 'paddle-ocr'
): Promise<{ data: MedicalInvoiceData; log: AIInteractionLog }> => {
  const geminiModel = 'gemini-2.5-flash';

  const { base64Data, mimeType } = await normalizeImageForOcr(imageSource);

  // 定义医疗发票的 JSON Schema
  const invoiceSchema = {
    documentType: "string ('summary_invoice' | 'detail_list' | 'single_invoice' — 文档类型分类，见下方规则)",
    basicInfo: {
      name: "string (患者姓名)",
      gender: "string (性别)",
      age: "string (年龄)",
      admissionDate: "string (入院日期 YYYY-MM-DD)",
      dischargeDate: "string (出院日期 YYYY-MM-DD)",
      department: "string (科室)",
      hospitalizationNumber: "string (住院号)",
      bedCode: "string (床号)",
      dischargeDiagnosis: "string (出院诊断)",
      otherInfo: "string (其他信息)"
    },
    chargeItems: [
      {
        itemName: "string (费用项目名称)",
        specifications: "string (规格)",
        quantity: "number (数量)",
        unitPrice: "number (单价)",
        totalPrice: "number (总价)"
      }
    ],
    totalAmount: "number (总金额/金额合计)",
    insurancePayment: {
      governmentFundPayment: "number (统筹基金支付)",
      personalPayment: "number (个人支付总额)",
      personalSelfPayment: "number (个人自付——医保目录范围内由个人承担的部分)",
      personalSelfExpense: "number (个人自费——医保目录范围外全额由个人承担的部分)",
      otherPayment: "number (其他支付)",
      personalAccountPayment: "number (个人账户支付)",
      personalCashPayment: "number (个人现金支付)"
    },
    invoiceInfo: {
      invoiceCode: "string (发票代码)",
      invoiceNumber: "string (发票号码)",
      verificationCode: "string (校验码)",
      issueDate: "string (开票日期 YYYY-MM-DD)",
      hospitalName: "string (医院名称——优先取票头印刷文字，非印章)",
      hospitalType: "string (医院类型)"
    },
    medicalInsurance: {
      insuranceType: "string (医保类型，如：城镇职工、居民医保、自费等，按票面原文提取)",
      insuranceNumber: "string (医保号)",
      outpatientNumber: "string (门诊号)",
      visitDate: "string (就诊日期 YYYY-MM-DD)",
      businessSerialNumber: "string (业务流水号)"
    }
  };

  const prompt = `你是一个专业的中国医疗发票OCR识别系统。请严格根据图片中可见的文字内容提取信息。

## 重要识别规则

### 文档类型识别（最高优先级）
0. 首先判断这张图片的文档类型，填入 documentType 字段：
   - **summary_invoice**（住院费用汇总发票/结算单）：费用项目是大类汇总名称（如"西药费""中成药费""检查费""化验费""治疗费""床位费""护理费""手术费""材料费"等），不会出现具体的药品名称或检查项目名称。通常有医保支付信息（统筹支付、个人支付等）
   - **detail_list**（费用明细清单/一览表）：费用项目列出了具体的药品名（如"阿莫西林胶囊 0.25g"）、检查项目（如"血常规检验"）、耗材名等明细信息
   - **single_invoice**（单张完整发票）：同时包含汇总和明细信息，或者是门诊发票等不需要区分的情况

### 防幻觉约束
1. 只提取图片中**明确可见**的文字和数字，严禁补充、推测或编造任何信息
2. 如果某个区域模糊不清或被遮挡（如印章覆盖文字），对应字段返回空字符串，**不要猜测**
3. 费用明细项目**不要重复**，每一行只提取一次。如果同一项目出现在不同位置（如明细区和汇总区），只取明细区的数据
4. 数字必须严格按图片显示提取，注意区分：小数点"."与千分位","、数字"0"与字母"O"、数字"1"与字母"l"

### 医院名称识别
5. 医院名称优先从票面印刷文字提取（如票头），印章中的文字仅作参考但**不优先采用**（印章文字常因旋转/重叠难以准确识别）
6. 如果票头和印章的医院名称不一致，以票头印刷文字为准

### 金额识别
7. totalAmount（总金额/金额合计）取票面最终的合计金额，通常在票据底部或右下角
8. 每个 chargeItem 的 totalPrice 应该等于 quantity × unitPrice，如果计算不符，以票面打印的 totalPrice 为准
9. 所有 chargeItems 的 totalPrice 之和应接近 totalAmount，如果差异超过 1 元，请仔细核查是否遗漏或重复了项目

### 医保信息识别
10. insuranceType（医保类型）：按票面原文提取，如"城镇职工""居民医保""自费"等
11. 注意区分"个人自付"（personalSelfPayment，医保目录范围内由个人承担）和"个人自费"（personalSelfExpense，医保目录范围外全额自费）——两者含义不同，请分别填入对应字段
12. 如票面未区分自付和自费，将"个人支付"/"个人负担"金额填入 personalPayment

## 提取要求

请提取以下信息并严格按照 JSON 格式返回：
1. 基本信息（basicInfo）：患者姓名、性别、年龄、入院/出院日期、科室、住院号、床号、出院诊断
2. 费用明细（chargeItems）：每一项的名称、规格、数量、单价、总价（提取所有费用项目，不要重复）
3. 金额汇总（totalAmount + insurancePayment）：总金额、统筹基金支付、个人支付、个人自付、个人自费、其他支付、个人账户支付、个人现金支付
4. 发票信息（invoiceInfo）：发票代码、发票号码、校验码、开票日期、医院名称、医院类型
5. 医保信息（medicalInsurance）：医保类型、医保号、门诊号、就诊日期、业务流水号

## JSON 格式
${JSON.stringify(invoiceSchema, null, 2)}

## 输出规范
- 日期格式统一为 YYYY-MM-DD
- 数字类型的字段请返回纯数字，不要包含货币符号或千分位逗号
- 费用明细数组包含所有识别出的项目，每项只出现一次
- 无法识别的字段：字符串用空字符串 ""，数字用 0`;

  try {
    const start = Date.now();
    let responseText: string;
    let usageMetadata: any;

    console.group('Invoice OCR Request');
    console.log('Model:', model === 'glm-ocr' ? `glm-ocr + ${geminiModel}` : model === 'glm-ocr-structured' ? 'glm-ocr + glm' : model === 'paddle-ocr' ? `rapid-ocr + ${geminiModel}` : model === 'gemini' ? geminiModel : 'configured-by-server');
    console.groupEnd();

    const response = await fetch('/api/invoice-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(model ? { mode: model } : {}),
        base64Data,
        mimeType,
        prompt,
        geminiModel,
        invoiceSchema
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error || payload?.message || response.statusText || '发票识别服务异常';
      throw new Error(message);
    }

    responseText = payload.text || '{}';
    usageMetadata = payload.usageMetadata;
    const timing = payload.timing; // OCR + 格式化分步耗时

    const duration = Date.now() - start;
    
    // 记录大模型出参
    console.group('OCR Final Response');
    console.log('Duration:', duration, 'ms');
    console.log('Raw JSON:', responseText);
    console.groupEnd();

    const result = JSON.parse(responseText);

    // 验证和清理数据
    if (!result.documentType) result.documentType = 'single_invoice';
    if (!result.basicInfo) result.basicInfo = {};
    if (!result.chargeItems) result.chargeItems = [];
    if (!result.insurancePayment) result.insurancePayment = {};
    if (!result.invoiceInfo) result.invoiceInfo = {};
    if (!result.medicalInsurance) result.medicalInsurance = {};

    return {
      data: result as MedicalInvoiceData,
      log: {
        model,
        prompt,
        response: responseText,
        duration,
        timestamp: new Date().toISOString(),
        usageMetadata,
        timing
      }
    };
  } catch (error) {
    console.error('Medical invoice recognition failed:', error);
    throw new Error(`发票识别失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
};

/**
 * 批量识别多张发票图片
 * 每张图片独立调用 OCR，返回各自的识别结果（含 documentType 分类）
 *
 * @param images - 图片列表，每张包含 source 和 fileName
 * @param model - AI 模型选择
 * @param onImageProgress - 单张图片完成回调 (completedCount, total)
 * @returns 每张图片的独立 OCR 结果
 */
export const recognizeMultipleInvoiceImages = async (
  images: Array<{ source: File | string | Blob; fileName: string }>,
  model?: 'gemini' | 'glm-ocr' | 'glm-ocr-structured' | 'paddle-ocr',
  onImageProgress?: (completedCount: number, total: number) => void
): Promise<Array<{ data: MedicalInvoiceData; log: AIInteractionLog; fileName: string }>> => {
  const CONCURRENCY = 2; // 最大并发数（避免触发 API 限流）
  const results: Array<{ data: MedicalInvoiceData; log: AIInteractionLog; fileName: string } | null> = new Array(images.length).fill(null);
  let completed = 0;

  // 分批并发处理
  for (let i = 0; i < images.length; i += CONCURRENCY) {
    const batch = images.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async ({ source, fileName }) => {
        const result = await recognizeMedicalInvoice(source, model);
        completed++;
        onImageProgress?.(completed, images.length);
        return { ...result, fileName };
      })
    );
    batchResults.forEach((r, j) => { results[i + j] = r; });
  }

  return results as Array<{ data: MedicalInvoiceData; log: AIInteractionLog; fileName: string }>;
};

/**
 * 通用理赔材料 OCR 识别 + 审核
 * 使用材料自身的 aiAuditPrompt 和 jsonSchema 驱动 AI 识别
 *
 * @param imageSource - 图片来源（base64 / Blob / OSS URL）
 * @param materialName - 材料名称
 * @param aiAuditPrompt - 材料定义中的 AI 审核提示词
 * @param jsonSchema - 材料定义中的 JSON Schema（字符串）
 * @param model - AI 模型选择
 * @returns 提取的结构化数据、审核结论和 AI 交互日志
 */
export const recognizeClaimMaterial = async (
  imageSource: string | Blob,
  materialName: string,
  aiAuditPrompt: string,
  jsonSchema: string,
  model?: 'gemini' | 'glm-ocr' | 'paddle-ocr'
): Promise<{ extractedData: Record<string, any>; auditConclusion: string; log: AIInteractionLog }> => {
  const geminiModel = 'gemini-2.5-flash';

  const { base64Data, mimeType } = await normalizeImageForOcr(imageSource);

  // 构造提示词：融合材料的 aiAuditPrompt 和 jsonSchema
  const prompt = `你是一个专业的保险理赔材料审核系统。请对上传的「${materialName}」进行 OCR 识别和审核。

## 提取要求
请严格根据图片中可见的文字内容提取信息，按以下 JSON Schema 结构提取：
${jsonSchema}

## 审核要求
${aiAuditPrompt}

## 重要规则
1. 只提取图片中**明确可见**的文字和数字，严禁补充、推测或编造任何信息
2. 如果某个区域模糊不清或被遮挡，对应字段返回空字符串，**不要猜测**
3. 数字必须严格按图片显示提取
4. 日期格式统一为 YYYY-MM-DD
5. 无法识别的字段：字符串用空字符串 ""，数字用 0

## 输出格式
请严格返回以下 JSON 格式（不要包含 markdown 代码块标记）：
{
  "extractedData": { ... 按 schema 提取的字段 },
  "auditConclusion": "审核结论文本，包含提取摘要和校验结果"
}`;

  try {
    const start = Date.now();

    console.group('Material OCR Request');
    console.log('Material:', materialName);
    console.log('Model:', model);
    console.groupEnd();

    const response = await fetch('/api/invoice-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(model ? { mode: model } : {}),
        base64Data,
        mimeType,
        prompt,
        geminiModel,
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error || payload?.message || response.statusText || '材料识别服务异常';
      throw new Error(message);
    }

    const responseText = payload.text || '{}';
    const usageMetadata = payload.usageMetadata;
    const timing = payload.timing;
    const duration = Date.now() - start;

    console.group('Material OCR Response');
    console.log('Duration:', duration, 'ms');
    console.log('Raw JSON:', responseText);
    console.groupEnd();

    const result = JSON.parse(responseText);

    return {
      extractedData: result.extractedData || result,
      auditConclusion: result.auditConclusion || '识别完成',
      log: {
        model,
        prompt,
        response: responseText,
        duration,
        timestamp: new Date().toISOString(),
        usageMetadata,
        timing,
      }
    };
  } catch (error) {
    console.error('Claim material recognition failed:', error);
    throw new Error(`材料识别失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
};

/**
 * 快速识别发票类型（用于批量处理时的预筛选）
 * @param imageSource - 图片来源
 * @returns 发票类型和是否需要深度分析
 */
export const quickRecognizeInvoiceType = async (
  imageSource: string | Blob
): Promise<{ category: string; needsDeepAnalysis: boolean }> => {
  const model = 'gemini-2.5-flash';

  const { base64Data, mimeType } = await normalizeImageForOcr(imageSource);

  const prompt = `快速识别这张票据的类型，返回 JSON 格式：
{
  "category": "类型（医疗发票/门诊发票/住院结算单/药店小票/其他）",
  "needsDeepAnalysis": true/false
}`;

  try {
    const start = Date.now();
    const response = await fetch('/api/invoice-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'quick',
        base64Data,
        mimeType,
        prompt,
        geminiModel: model
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error || payload?.message || response.statusText || '发票识别服务异常';
      throw new Error(message);
    }

    const duration = Date.now() - start;
    const responseText = payload.text || '{"category":"未知","needsDeepAnalysis":false}';
    console.group('Gemini Quick Recognize Response');
    console.log('Duration:', duration, 'ms');
    console.log('Raw Text:', responseText);
    console.groupEnd();

    return JSON.parse(responseText);
  } catch (error) {
    console.error('Quick invoice type recognition failed:', error);
    return { category: '未知', needsDeepAnalysis: false };
  }
};
