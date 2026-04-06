/**
 * 健康险定损服务
 * 用于健康险的疾病严重程度评估、重疾分期判定、医疗费用合理性评估
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { invokeAICapability } from "./aiRuntime.js";
import { renderPromptTemplate } from "./aiConfigService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 缓存 ICD-10 疾病数据
let diseaseCache = null;

// 重大疾病关键词及分期映射
const CRITICAL_ILLNESS_KEYWORDS = {
  重度: [
    "恶性肿瘤",
    "急性心肌梗塞",
    "脑中风后遗症",
    "重大器官移植",
    "冠状动脉搭桥术",
    "终末期肾病",
    "多个肢体缺失",
    "急性或亚急性重症肝炎",
    "良性脑肿瘤",
    "慢性肝功能衰竭失代偿期",
    "脑炎后遗症",
    "深度昏迷",
    "双耳失聪",
    "双目失明",
    "瘫痪",
    "心脏瓣膜手术",
    "严重阿尔茨海默病",
    "严重脑损伤",
    "严重帕金森病",
    "严重原发性肺动脉高压",
    "严重运动神经元病",
    "语言能力丧失",
    "重型再生障碍性贫血",
    "主动脉手术",
  ],
  中度: [
    "中度脑损伤",
    "中度帕金森病",
    "中度阿尔茨海默病",
    "中度脑中风",
    "中度运动神经元病",
    "较小面积Ⅲ度烧伤",
    "轻度脑中风后遗症",
    "中度溃疡性结肠炎",
    "中度类风湿性关节炎",
    "中度慢性呼吸功能衰竭",
  ],
  轻度: [
    "轻度恶性肿瘤",
    "较轻急性心肌梗塞",
    "轻度脑中风",
    "冠状动脉介入手术",
    "轻度帕金森病",
    "轻度阿尔茨海默病",
    "原位癌",
    "早期恶性肿瘤",
    "不典型急性心肌梗塞",
    "微创冠状动脉搭桥术",
    "轻度运动神经元病",
  ],
};

/**
 * 加载 ICD-10 疾病分类数据
 */
function loadDiseaseData() {
  if (diseaseCache) {
    return diseaseCache;
  }

  const diseasesPath = join(__dirname, "../../jsonlist/icd10/diseases.json");
  const categoriesPath = join(
    __dirname,
    "../../jsonlist/icd10/categories.json",
  );

  const diseases = existsSync(diseasesPath)
    ? JSON.parse(readFileSync(diseasesPath, "utf-8"))
    : [];
  const categories = existsSync(categoriesPath)
    ? JSON.parse(readFileSync(categoriesPath, "utf-8"))
    : [];

  diseaseCache = { diseases, categories };
  return diseaseCache;
}

/**
 * 根据诊断文本匹配重疾分期
 * @param {string} diagnosisText - 诊断描述
 * @returns {{ stage: string|null, confidence: number, matchedKeywords: string[] }}
 */
function matchCriticalIllnessStage(diagnosisText) {
  const normalizedText = (diagnosisText || "").toLowerCase();
  const result = { stage: null, confidence: 0, matchedKeywords: [] };

  for (const [stage, keywords] of Object.entries(CRITICAL_ILLNESS_KEYWORDS)) {
    const matched = keywords.filter((kw) => normalizedText.includes(kw));
    if (matched.length > 0) {
      const stageConfidence = Math.min(0.5 + matched.length * 0.2, 0.95);
      if (stageConfidence > result.confidence) {
        result.stage = stage;
        result.confidence = stageConfidence;
        result.matchedKeywords = matched;
      }
    }
  }

  return result;
}

/**
 * 根据诊断文本匹配 ICD-10 疾病编码
 * @param {string} diagnosisText - 诊断描述
 * @returns {Array<{ code: string, name: string, confidence: number }>}
 */
function matchICD10(diagnosisText) {
  const data = loadDiseaseData();
  const keywords = (diagnosisText || "")
    .replace(/[，。；;、]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  if (keywords.length === 0) return [];

  const matches = [];
  for (const disease of data.diseases) {
    const name = disease.name || disease.description || "";
    let matchCount = 0;
    for (const kw of keywords) {
      if (name.includes(kw)) matchCount++;
    }
    if (matchCount > 0) {
      matches.push({
        code: disease.code || disease.id,
        name,
        category: disease.category,
        matchCount,
        confidence: Math.min(0.4 + matchCount * 0.2, 0.9),
      });
    }
  }

  return matches.sort((a, b) => b.matchCount - a.matchCount).slice(0, 10);
}

/**
 * 评估疾病严重程度和理赔建议
 * @param {object} params - 评估参数
 * @param {string} params.diagnosisText - 诊断文本
 * @param {string} params.diseaseDescription - 疾病描述
 * @param {string} params.claimType - 理赔类型：'CRITICAL_ILLNESS' | 'MEDICAL_EXPENSE' | 'AUTO'
 * @param {boolean} params.useAI - 是否使用 AI 辅助（默认 true）
 * @returns {Promise<object>} 评估结果
 */
export async function assess(params = {}) {
  const {
    diagnosisText = "",
    diseaseDescription = "",
    claimType = "MEDICAL_EXPENSE",
    useAI = true,
  } = params;

  const combinedText = `${diagnosisText} ${diseaseDescription}`;

  // 1. ICD-10 编码匹配
  const icdMatches = matchICD10(combinedText);

  // 2. 重疾分期判定（仅重疾理赔时）
  let criticalIllnessResult = null;
  if (claimType === "CRITICAL_ILLNESS") {
    criticalIllnessResult = matchCriticalIllnessStage(combinedText);
  }

  // 3. AI 辅助判断（当匹配较少或重疾分期不确定时）
  let aiResult = null;
  if (
    useAI &&
    (icdMatches.length < 2 ||
      (claimType === "CRITICAL_ILLNESS" &&
        (!criticalIllnessResult?.stage ||
          criticalIllnessResult.confidence < 0.7)))
  ) {
    try {
      const prompt = renderPromptTemplate("disease_assessment", {
        diagnosisText: diagnosisText || "未提供",
        diseaseDescription: diseaseDescription || "未提供",
        claimType,
      });

      const { response } = await invokeAICapability({
        capabilityId: "admin.claim.risk_assessment",
        request: { contents: { parts: [{ text: prompt }] } },
        meta: {
          sourceApp: "admin-system",
          module: "diseaseAssessment.assess",
          operation: "disease_assessment",
          context: { diagnosisText, claimType },
        },
      });

      const responseText = response.text || "";
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error("AI 辅助疾病评估失败:", error);
    }
  }

  // 4. 综合判断
  let suggestedStage = null;
  let confidence = 0;
  let needsManualReview = false;

  if (claimType === "CRITICAL_ILLNESS") {
    if (criticalIllnessResult?.stage) {
      suggestedStage = criticalIllnessResult.stage;
      confidence = criticalIllnessResult.confidence;
      if (confidence < 0.7) needsManualReview = true;
    } else if (aiResult?.suggestedStage) {
      suggestedStage = aiResult.suggestedStage;
      confidence = (aiResult.confidence || 0.5) * 0.8;
      needsManualReview = true;
    } else {
      needsManualReview = true;
    }

    // AI 与关键词交叉验证
    if (
      criticalIllnessResult?.stage &&
      aiResult?.suggestedStage &&
      criticalIllnessResult.stage !== aiResult.suggestedStage
    ) {
      needsManualReview = true;
    }
  } else {
    // 医疗费用理赔：主要判断诊断是否合理
    confidence = icdMatches.length > 0 ? icdMatches[0].confidence : 0;
    needsManualReview = icdMatches.length === 0;
  }

  return {
    insuranceType: "HEALTH",
    assessmentType:
      claimType === "CRITICAL_ILLNESS" ? "CRITICAL_ILLNESS" : "MEDICAL",
    diagnosisText,
    diseaseDescription,
    claimType,
    suggestedStage,
    confidence: Number(confidence.toFixed(2)),
    icdMatches: icdMatches.slice(0, 5).map((m) => ({
      code: m.code,
      name: m.name,
      category: m.category,
      matchConfidence: m.confidence,
    })),
    criticalIllnessKeywords: criticalIllnessResult?.matchedKeywords || [],
    needsManualReview,
    aiResult,
    assessmentTime: new Date().toISOString(),
  };
}

/**
 * 批量评估多个诊断
 * @param {Array<object>} items - 诊断列表
 * @returns {Promise<Array>} 评估结果列表
 */
export async function batchAssess(items) {
  return Promise.all(items.map((item) => assess(item)));
}

/**
 * 获取所有重疾关键词（用于管理页面展示）
 * @returns {object} 按分期分组的关键词
 */
export function getAllStandards() {
  return CRITICAL_ILLNESS_KEYWORDS;
}

/**
 * 清空缓存
 */
export function clearStandardsCache() {
  diseaseCache = null;
}

export default {
  assess,
  batchAssess,
  getAllStandards,
  clearStandardsCache,
};
