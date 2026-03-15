/**
 * 意外伤害定损服务
 * 用于意外险的伤残等级判定、伤害程度评估
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { invokeAICapability } from './aiRuntime.js';
import { renderPromptTemplate } from './aiConfigService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 缓存标准数据
let standardsCache = null;

/**
 * 加载伤害/伤残标准知识库
 */
function loadInjuryStandards() {
  if (standardsCache) {
    return standardsCache;
  }

  const configPath = join(__dirname, '../../jsonlist/injury-standards.json');
  if (!existsSync(configPath)) {
    console.warn('伤害标准配置文件不存在，将返回空列表');
    return { items: [] };
  }

  const content = readFileSync(configPath, 'utf-8');
  standardsCache = JSON.parse(content);
  return standardsCache;
}

/**
 * 基于关键词匹配伤害标准
 * @param {string} text - 诊断文本或伤害描述
 * @param {object} standards - 标准知识库
 * @returns {Array} 匹配到的标准条目
 */
function matchByKeywords(text, standards) {
  const keywords = text.replace(/[，。；;、]/g, ' ').split(/\s+/).filter(w => w);
  const matches = [];

  for (const item of standards.items || []) {
    const itemText = item.description || '';
    let matchCount = 0;

    for (const keyword of keywords) {
      if (keyword.length < 2) continue; // 跳过单字
      if (itemText.includes(keyword)) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      matches.push({
        ...item,
        matchCount,
        confidence: Math.min(0.5 + matchCount * 0.15, 0.95), // 基础0.5，每匹配一个词+0.15，上限0.95
      });
    }
  }

  // 按匹配度排序
  return matches.sort((a, b) => b.matchCount - a.matchCount);
}

/**
 * 调用 AI 辅助判断
 * @param {string} diagnosisText - 诊断文本
 * @param {string} injuryDescription - 伤害描述
 * @returns {Promise<object>} AI 判断结果
 */
async function aiAssistedJudgment(diagnosisText, injuryDescription) {
  try {
    const prompt = renderPromptTemplate('injury_assessment', {
      diagnosisText: diagnosisText || '未提供',
      injuryDescription: injuryDescription || '未提供',
    });

    const { response } = await invokeAICapability({
      capabilityId: 'admin.claim.risk_assessment',
      request: {
        contents: { parts: [{ text: prompt }] },
      },
      meta: {
        sourceApp: 'admin-system',
        module: 'injuryAssessment.aiAssistedJudgment',
        operation: 'injury_assessment',
        context: {
          diagnosisText,
          injuryDescription,
        },
      },
    });
    const responseText = response.text || '';

    // 提取 JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return null;
  } catch (error) {
    console.error('AI 辅助判断失败:', error);
    return null;
  }
}

/**
 * 评估意外伤害/伤残等级
 * @param {object} params - 评估参数
 * @param {string} params.diagnosisText - 诊断文本
 * @param {string} params.injuryDescription - 伤害描述
 * @param {boolean} params.useAI - 是否使用 AI 辅助（默认 true）
 * @returns {Promise<object>} 评估结果
 *
 * @example
 * const result = await assess({
 *   diagnosisText: '左拇指指间关节离断',
 *   injuryDescription: '工作中被机器夹伤'
 * });
 *
 * // 返回:
 * // {
 * //   suggestedGrade: 7,
 * //   confidence: 0.85,
 * //   matchingItems: [{ code: '2.1', description: '一拇指指间关节离断', grade: 7 }],
 * //   needsManualReview: false,
 * //   aiResult: null
 * // }
 */
export async function assess(params = {}) {
  const {
    diagnosisText = '',
    injuryDescription = '',
    useAI = true,
  } = params;

  // 加载标准
  const standards = loadInjuryStandards();

  // 关键词匹配
  const keywordText = `${diagnosisText} ${injuryDescription}`;
  const keywordMatches = matchByKeywords(keywordText, standards);

  // AI 辅助判断
  let aiResult = null;
  if (useAI && keywordMatches.length < 3) {
    // 当关键词匹配较少时使用 AI
    aiResult = await aiAssistedJudgment(diagnosisText, injuryDescription);
  }

  // 综合判断
  let suggestedGrade = null;
  let confidence = 0;
  let needsManualReview = false;

  if (keywordMatches.length > 0) {
    // 优先使用关键词匹配结果
    const bestMatch = keywordMatches[0];
    suggestedGrade = bestMatch.grade;
    confidence = bestMatch.confidence;

    // 置信度较低时标记需要人工复核
    if (confidence < 0.7) {
      needsManualReview = true;
    }

    // 如果 AI 也有结果，进行交叉验证
    if (aiResult && Math.abs(aiResult.suggestedGrade - suggestedGrade) > 2) {
      // 等级差异大，标记需要复核
      needsManualReview = true;
    }
  } else if (aiResult) {
    // 无关键词匹配，使用 AI 结果
    suggestedGrade = aiResult.suggestedGrade;
    confidence = aiResult.confidence * 0.8; // AI 结果置信度打折
    needsManualReview = true; // AI 结果需要人工复核
  } else {
    // 无匹配结果
    suggestedGrade = null;
    confidence = 0;
    needsManualReview = true;
  }

  return {
    insuranceType: 'ACCIDENT',
    assessmentType: 'INJURY',
    diagnosisText,
    injuryDescription,
    suggestedGrade,
    confidence: Number(confidence.toFixed(2)),
    matchingItems: keywordMatches.slice(0, 5).map(m => ({
      code: m.code,
      description: m.description,
      grade: m.grade,
      matchConfidence: m.confidence,
    })),
    needsManualReview,
    aiResult,
    assessmentTime: new Date().toISOString(),
  };
}

/**
 * 批量评估多个诊断
 * @param {Array<{diagnosisText, injuryDescription}>} items - 诊断列表
 * @returns {Promise<Array>} 评估结果列表
 */
export async function batchAssess(items) {
  return Promise.all(items.map(item => assess(item)));
}

/**
 * 获取所有伤害标准（用于管理页面展示）
 * @returns {Array} 标准条目列表
 */
export function getAllStandards() {
  const standards = loadInjuryStandards();
  return standards.items || [];
}

/**
 * 清空标准缓存
 */
export function clearStandardsCache() {
  standardsCache = null;
}

export default {
  assess,
  batchAssess,
  getAllStandards,
  clearStandardsCache,
};
