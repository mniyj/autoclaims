/**
 * 文档类型化摘要提取器
 *
 * 根据文档分类（materialId）调用对应的 Gemini 提取器，
 * 输出带 sourceAnchors 的结构化摘要。
 *
 * 摘要类型与 ClaimsMaterial materialId 的映射：
 *   accident_liability  ← mat-8  交通事故责任认定书
 *   inpatient_record    ← mat-12 住院病历/病案
 *   diagnosis_proof     ← mat-13 诊断证明书
 *   expense_invoice     ← mat-20 医疗费发票 / mat-21 费用明细清单
 *   disability_assessment ← mat-35 伤残鉴定意见书 / mat-36 劳动能力鉴定结论
 *   income_lost         ← mat-29 误工证明 / mat-30 收入证明
 */

import { GoogleGenAI } from "@google/genai";

const getApiKey = () =>
  process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.API_KEY;

// 材料 ID 到摘要类型的映射
const MATERIAL_TO_SUMMARY_TYPE = {
  "mat-8": "accident_liability",
  "mat-12": "inpatient_record",
  "mat-11": "diagnosis_proof",  // 门诊病历也用 diagnosis_proof
  "mat-13": "diagnosis_proof",
  "mat-14": "diagnosis_proof",  // 转院证明
  "mat-20": "expense_invoice",
  "mat-21": "expense_invoice",
  "mat-22": "expense_invoice",  // 购药发票
  "mat-23": "expense_invoice",  // 辅助器具发票
  "mat-24": "expense_invoice",  // 护理费发票
  "mat-35": "disability_assessment",
  "mat-36": "disability_assessment",
  "mat-38": "disability_assessment",  // 护理依赖鉴定
  "mat-29": "income_lost",
  "mat-30": "income_lost",
};

// 各摘要类型的提取 Prompt
const EXTRACTION_PROMPTS = {
  accident_liability: `你是一位专业的保险理赔员，请从以下交通事故责任认定书中提取关键信息。

提取要求：
1. 提取事故发生时间（accidentDate，格式 YYYY-MM-DD）
2. 提取事故发生地点（accidentLocation）
3. 提取所有当事人（parties数组）：包括角色（role）、姓名（name）、责任比例（liabilityPct，0-100的整数）
4. 提取认定依据（liabilityBasis，简要描述）
5. 提取文书编号（documentNumber，如有）
6. 对每个提取的字段，提供在原文中的关键文字片段（rawText）和大约的页码（pageIndex，0-based）

请以 JSON 格式返回，格式如下：
{
  "accidentDate": "2024-03-14",
  "accidentLocation": "上海市浦东新区XX路",
  "parties": [
    {"role": "机动车驾驶人", "name": "张某", "liabilityPct": 70},
    {"role": "行人", "name": "王某", "liabilityPct": 30}
  ],
  "liabilityBasis": "张某未按规定让行",
  "documentNumber": "沪公交认字[2024]0123号",
  "sourceAnchors": {
    "accidentDate": {"pageIndex": 0, "rawText": "2024年3月14日", "highlightLevel": "text_search"},
    "liabilityBasis": {"pageIndex": 1, "rawText": "张某未按规定让行", "highlightLevel": "text_search"},
    "liabilityPct_0": {"pageIndex": 1, "rawText": "负主要责任（70%）", "highlightLevel": "text_search"}
  },
  "confidence": 0.92
}

注意：
- 如果某字段无法确认，设为 null
- liabilityPct 必须是数字，所有当事人责任比例之和应为 100
- highlightLevel 固定为 "text_search"（除非你能确认精确坐标，则用 "precise"）`,

  inpatient_record: `你是一位专业的保险理赔员，请从以下住院病历/病案中提取关键信息。

提取要求：
1. 入院日期（admissionDate，格式 YYYY-MM-DD）
2. 出院日期（dischargeDate，格式 YYYY-MM-DD）
3. 住院天数（hospitalizationDays，整数）
4. 诊断列表（diagnoses数组）：name 和 icdCode（如有）
5. 手术列表（surgeries数组）：name 和 date（格式 YYYY-MM-DD）
6. 出院情况（dischargeCondition，如"好转"、"治愈"）
7. 主治医生（attendingDoctor）
8. 科室（ward）
9. 对每个关键字段提供 sourceAnchors

请以 JSON 格式返回：
{
  "admissionDate": "2024-03-15",
  "dischargeDate": "2024-04-02",
  "hospitalizationDays": 18,
  "diagnoses": [{"name": "左股骨粗隆间骨折", "icdCode": "S72.100"}],
  "surgeries": [{"name": "PFNA内固定术", "date": "2024-03-17"}],
  "dischargeCondition": "好转",
  "attendingDoctor": "李明",
  "ward": "骨科",
  "sourceAnchors": {
    "admissionDate": {"pageIndex": 0, "rawText": "2024年3月15日入院", "highlightLevel": "text_search"},
    "hospitalizationDays": {"pageIndex": 0, "rawText": "共住院18天", "highlightLevel": "text_search"}
  },
  "confidence": 0.88
}`,

  diagnosis_proof: `你是一位专业的保险理赔员，请从以下诊断证明书/门诊病历中提取关键信息。

提取要求：
1. 诊断列表（diagnoses）：每项包含 name 和 icdCode（如有）
2. 开具日期（issueDate，格式 YYYY-MM-DD）
3. 开具医生（issuingDoctor）
4. 医疗机构（institution）
5. 建议休息天数（restDays，如有）
6. 对关键字段提供 sourceAnchors

请以 JSON 格式返回：
{
  "diagnoses": [{"name": "左踝关节扭伤", "icdCode": "S93.4"}],
  "issueDate": "2024-03-20",
  "issuingDoctor": "王医生",
  "institution": "上海市第一人民医院",
  "restDays": 14,
  "sourceAnchors": {
    "issueDate": {"pageIndex": 0, "rawText": "2024年3月20日", "highlightLevel": "text_search"}
  },
  "confidence": 0.90
}`,

  expense_invoice: `你是一位专业的保险理赔员，请从以下医疗费用发票/清单中提取关键信息。

提取要求：
1. 发票号码（invoiceNumber）
2. 开票日期（invoiceDate，格式 YYYY-MM-DD）
3. 合计金额（totalAmount，数字，单位元）
4. 开票机构（institution）
5. 费用明细（breakdown数组）：每项包含 category（费用类别）、itemName（项目名称）、amount（金额）
   常见费用类别：手术费、床位费、护理费、检查费、药品费、材料费、诊疗费
6. 对关键字段提供 sourceAnchors

请以 JSON 格式返回：
{
  "invoiceNumber": "沪医票202400892341",
  "invoiceDate": "2024-04-02",
  "totalAmount": 28450.60,
  "institution": "上海市第六人民医院",
  "breakdown": [
    {"category": "手术费", "itemName": "PFNA内固定术", "amount": 12800.00},
    {"category": "药品费", "itemName": "药品合计", "amount": 4320.50},
    {"category": "床位费", "itemName": "普通病床", "amount": 1800.00}
  ],
  "sourceAnchors": {
    "totalAmount": {"pageIndex": 0, "rawText": "合计金额：28450.60元", "highlightLevel": "text_search"},
    "invoiceNumber": {"pageIndex": 0, "rawText": "发票号: 沪医票202400892341", "highlightLevel": "text_search"}
  },
  "confidence": 0.94
}

注意：breakdown 中的金额加总应等于 totalAmount，如有出入请如实提取`,

  disability_assessment: `你是一位专业的保险理赔员，请从以下伤残鉴定报告/劳动能力鉴定结论中提取关键信息。

提取要求：
1. 伤残等级（disabilityLevel，如"十级伤残"、"工伤十级"）
2. 鉴定依据（disabilityBasis，主要依据简述）
3. 鉴定日期（assessmentDate，格式 YYYY-MM-DD）
4. 鉴定机构（assessmentInstitution）
5. 护理依赖等级（nursingDependencyLevel，如有）
6. 对关键字段提供 sourceAnchors

请以 JSON 格式返回：
{
  "disabilityLevel": "十级伤残",
  "disabilityBasis": "左股骨骨折内固定术后，功能受限",
  "assessmentDate": "2024-06-10",
  "assessmentInstitution": "上海XX司法鉴定中心",
  "nursingDependencyLevel": null,
  "sourceAnchors": {
    "disabilityLevel": {"pageIndex": 1, "rawText": "伤残等级：十级", "highlightLevel": "text_search"},
    "assessmentDate": {"pageIndex": 0, "rawText": "鉴定日期：2024年6月10日", "highlightLevel": "text_search"}
  },
  "confidence": 0.91
}`,

  income_lost: `你是一位专业的保险理赔员，请从以下误工证明/收入证明中提取关键信息。

提取要求：
1. 月收入（monthlyIncome，数字，单位元）
2. 收入类型（incomeType）：salary=工资收入，self_employed=个体/自营，average=参照平均工资
3. 建议误工天数（lostWorkDays，整数，如有）
4. 雇主/单位名称（employer）
5. 对关键字段提供 sourceAnchors

请以 JSON 格式返回：
{
  "monthlyIncome": 8500.00,
  "incomeType": "salary",
  "lostWorkDays": 180,
  "employer": "上海XX科技有限公司",
  "sourceAnchors": {
    "monthlyIncome": {"pageIndex": 0, "rawText": "月工资8500元", "highlightLevel": "text_search"},
    "lostWorkDays": {"pageIndex": 0, "rawText": "休息180天", "highlightLevel": "text_search"}
  },
  "confidence": 0.87
}

注意：
- 如果证明文件只写了年收入，请换算为月收入
- 如果无法确认收入数额，monthlyIncome 设 null，incomeType 设 "average"`,
};

/**
 * 调用 Gemini 从文档中提取类型化摘要
 *
 * @param {object} params
 * @param {string} params.docId - 文档 ID
 * @param {string} params.summaryType - 摘要类型
 * @param {string} params.extractedText - OCR 提取的文本
 * @param {string} [params.base64Data] - 图片的 Base64 数据（图片类文件）
 * @param {string} [params.mimeType] - 图片 MIME 类型
 * @returns {object} 类型化摘要
 */
async function extractSummaryWithGemini({ docId, summaryType, extractedText, base64Data, mimeType }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = EXTRACTION_PROMPTS[summaryType];
  if (!prompt) {
    throw new Error(`No prompt defined for summaryType: ${summaryType}`);
  }

  const contents = [];
  const hasImage = base64Data && mimeType?.startsWith("image/");

  if (hasImage) {
    contents.push({
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        { text: prompt },
      ],
    });
  } else if (extractedText && extractedText.length > 20) {
    contents.push({
      parts: [{ text: `${prompt}\n\n文档内容：\n${extractedText}` }],
    });
  } else {
    return null;
  }

  const modelCandidates = hasImage
    ? ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"]
    : ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"];

  let lastError;
  for (const model of modelCandidates) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsed = JSON.parse(text);

      return {
        docId,
        summaryType,
        extractedAt: new Date().toISOString(),
        ...parsed,
        confidence: parsed.confidence || 0.5,
        sourceAnchors: parsed.sourceAnchors || {},
      };
    } catch (error) {
      lastError = error;
      console.warn(`[summaryExtractor] Model ${model} failed:`, error.message);
    }
  }

  console.error(`[summaryExtractor] All models failed for ${summaryType}:`, lastError?.message);
  return null;
}

/**
 * 根据材料 ID 和文档内容提取类型化摘要
 *
 * @param {object} params
 * @param {string} params.docId
 * @param {string} params.materialId - ClaimsMaterial 的 ID
 * @param {string} [params.extractedText]
 * @param {string} [params.base64Data]
 * @param {string} [params.mimeType]
 * @returns {object|null} 摘要对象，或 null（若该材料类型无摘要提取器）
 */
export async function extractDocumentSummary({ docId, materialId, extractedText, base64Data, mimeType }) {
  const summaryType = MATERIAL_TO_SUMMARY_TYPE[materialId];
  if (!summaryType) return null;

  return extractSummaryWithGemini({ docId, summaryType, extractedText, base64Data, mimeType });
}

/**
 * 批量提取文档摘要
 *
 * @param {Array} documents - 文档列表，每项需有 {documentId, classification, extractedText, fileType}
 * @param {object} [options]
 * @param {boolean} [options.skipImages] - 是否跳过图片类（图片 base64 需调用方自行传入）
 * @returns {Array} 摘要列表（含 null 项，代表无对应提取器）
 */
export async function extractDocumentSummaries(documents, options = {}) {
  const results = await Promise.allSettled(
    documents.map((doc) =>
      extractDocumentSummary({
        docId: doc.documentId,
        materialId: doc.classification?.materialId,
        extractedText: doc.extractedText,
        base64Data: options.skipImages ? undefined : doc.base64Data,
        mimeType: doc.fileType || doc.mimeType,
      })
    )
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    console.error(`[summaryExtractors] Failed for doc ${documents[i].documentId}:`, r.reason?.message);
    return null;
  });
}

export { MATERIAL_TO_SUMMARY_TYPE };
