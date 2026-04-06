/**
 * 责任险定损服务
 * 用于责任险的赔偿金额评估（人身伤害、财产损失、死亡赔偿）
 */

import { invokeAICapability } from "./aiRuntime.js";
import { renderPromptTemplate } from "./aiConfigService.js";

/**
 * 根据责任类型确定赔偿分类
 * @param {object} params - 定损参数
 * @returns {string} 赔偿分类
 */
function classifyLiabilityType(params) {
  const { deathConfirmed, propertyDamage, injuryDescription } = params;
  if (deathConfirmed) return "LIABILITY_DEATH";
  if (propertyDamage) return "LIABILITY_PROPERTY";
  if (injuryDescription) return "LIABILITY_INJURY";
  return "LIABILITY_INJURY";
}

/**
 * 计算参考赔偿金额
 * @param {string} liabilityType - 赔偿分类
 * @param {object} params - 定损参数
 * @returns {number} 参考金额
 */
function calculateReferenceAmount(liabilityType, params) {
  const { claimedAmount = 0, medicalExpense = 0, propertyLoss = 0 } = params;

  if (liabilityType === "LIABILITY_DEATH") {
    return claimedAmount > 0 ? claimedAmount : 0;
  }
  if (liabilityType === "LIABILITY_PROPERTY") {
    return propertyLoss > 0 ? propertyLoss : claimedAmount;
  }
  // LIABILITY_INJURY
  return medicalExpense > 0 ? medicalExpense : claimedAmount;
}

/**
 * 责任险定损评估
 * @param {object} params - 定损参数
 * @param {string} params.injuryDescription - 伤害描述
 * @param {boolean} params.deathConfirmed - 是否确认死亡
 * @param {boolean} params.propertyDamage - 是否财产损失
 * @param {number} params.claimedAmount - 申报金额
 * @param {number} params.medicalExpense - 医疗费用
 * @param {number} params.propertyLoss - 财产损失金额
 * @param {number} params.liabilityRatio - 责任比例（0-1）
 * @param {boolean} params.useAI - 是否使用 AI 辅助（默认 true）
 * @returns {Promise<object>} 评估结果
 */
export async function assess(params = {}) {
  const {
    injuryDescription = "",
    deathConfirmed = false,
    propertyDamage = false,
    claimedAmount = 0,
    medicalExpense = 0,
    propertyLoss = 0,
    liabilityRatio = 1,
    useAI = true,
  } = params;

  const liabilityType = classifyLiabilityType(params);
  const referenceAmount = calculateReferenceAmount(liabilityType, params);
  const adjustedAmount =
    Math.round(referenceAmount * liabilityRatio * 100) / 100;

  let aiResult = null;
  if (useAI && referenceAmount <= 0 && injuryDescription) {
    try {
      const prompt = renderPromptTemplate("liability_assessment", {
        injuryDescription: injuryDescription || "未提供",
        deathConfirmed,
        propertyDamage,
        claimedAmount,
        liabilityRatio,
      });

      const { response } = await invokeAICapability({
        capabilityId: "admin.claim.risk_assessment",
        request: { contents: { parts: [{ text: prompt }] } },
        meta: {
          sourceApp: "admin-system",
          module: "liabilityAssessment.assess",
          operation: "liability_assessment",
          context: { injuryDescription, liabilityType },
        },
      });
      aiResult = response;
    } catch (error) {
      console.warn("AI 辅助责任险定损失败，使用规则定损:", error.message);
    }
  }

  return {
    liabilityType,
    referenceAmount,
    liabilityRatio,
    recommendedAmount: adjustedAmount,
    confidence: referenceAmount > 0 ? "HIGH" : aiResult ? "MEDIUM" : "LOW",
    aiAssisted: Boolean(aiResult),
    aiResult,
    details: {
      claimedAmount,
      medicalExpense,
      propertyLoss,
      deathConfirmed,
      injuryDescription: injuryDescription || null,
    },
  };
}
