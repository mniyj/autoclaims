/**
 * 车险定损服务
 * 用于车辆损失评估、维修成本估算、全损判定
 */

import { invokeAICapability } from "./aiRuntime.js";
import { renderPromptTemplate } from "./aiConfigService.js";

// 维修项目参考价格区间（单位：元）
const REPAIR_REFERENCE_PRICES = {
  前保险杠: { min: 500, max: 3000, typical: 1200 },
  后保险杠: { min: 500, max: 3000, typical: 1200 },
  前大灯: { min: 800, max: 5000, typical: 2000 },
  后尾灯: { min: 300, max: 2000, typical: 800 },
  挡风玻璃: { min: 1000, max: 8000, typical: 3000 },
  车门: { min: 1500, max: 6000, typical: 3000 },
  引擎盖: { min: 1500, max: 5000, typical: 2500 },
  后备箱盖: { min: 1200, max: 4000, typical: 2000 },
  翼子板: { min: 800, max: 3000, typical: 1500 },
  后视镜: { min: 300, max: 2000, typical: 600 },
  轮胎: { min: 300, max: 2000, typical: 600 },
  轮毂: { min: 500, max: 3000, typical: 1000 },
  喷漆: { min: 300, max: 1500, typical: 600 },
  钣金修复: { min: 500, max: 3000, typical: 1200 },
  发动机: { min: 5000, max: 80000, typical: 20000 },
  变速箱: { min: 3000, max: 50000, typical: 15000 },
  底盘: { min: 2000, max: 20000, typical: 5000 },
  安全气囊: { min: 2000, max: 8000, typical: 4000 },
};

// 全损判定阈值（维修费/车辆价值）
const TOTAL_LOSS_THRESHOLD = 0.75;

/**
 * 根据损失描述匹配参考维修项目
 * @param {string} damageDescription - 损失描述
 * @returns {Array<{ part: string, priceRange: object, confidence: number }>}
 */
function matchRepairItems(damageDescription) {
  const normalizedDesc = (damageDescription || "").toLowerCase();
  const matches = [];

  for (const [part, prices] of Object.entries(REPAIR_REFERENCE_PRICES)) {
    if (normalizedDesc.includes(part)) {
      matches.push({
        part,
        priceRange: { ...prices },
        confidence: 0.8,
      });
    }
  }

  return matches;
}

/**
 * 评估是否构成全损
 * @param {number} repairCost - 维修估算费用
 * @param {number} actualValue - 车辆实际价值
 * @returns {{ isTotalLoss: boolean, ratio: number, threshold: number }}
 */
function evaluateTotalLoss(repairCost, actualValue) {
  if (!actualValue || actualValue <= 0) {
    return { isTotalLoss: false, ratio: 0, threshold: TOTAL_LOSS_THRESHOLD };
  }

  const ratio = repairCost / actualValue;
  return {
    isTotalLoss: ratio >= TOTAL_LOSS_THRESHOLD,
    ratio: Number(ratio.toFixed(4)),
    threshold: TOTAL_LOSS_THRESHOLD,
  };
}

/**
 * 评估车辆损失
 * @param {object} params - 评估参数
 * @param {string} params.damageDescription - 损失描述
 * @param {number} params.repairEstimate - 维修估算金额（可选，外部提供）
 * @param {number} params.actualValue - 车辆实际价值（可选）
 * @param {string} params.vehicleInfo - 车辆信息（品牌、型号、年份等）
 * @param {boolean} params.useAI - 是否使用 AI 辅助（默认 true）
 * @returns {Promise<object>} 评估结果
 */
export async function assess(params = {}) {
  const {
    damageDescription = "",
    repairEstimate = 0,
    actualValue = 0,
    vehicleInfo = "",
    useAI = true,
  } = params;

  // 1. 匹配维修项目
  const matchedItems = matchRepairItems(damageDescription);

  // 2. 计算参考维修费用
  const referenceRepairCost = matchedItems.reduce(
    (sum, item) => sum + item.priceRange.typical,
    0,
  );

  // 3. 确定估算费用：优先使用外部提供的维修估价，否则使用参考价
  const estimatedRepairCost = repairEstimate > 0 ? repairEstimate : referenceRepairCost;

  // 4. 全损判定
  const totalLossEvaluation = evaluateTotalLoss(estimatedRepairCost, actualValue);

  // 5. 确定推荐理赔金额
  let recommendedAmount = 0;
  if (totalLossEvaluation.isTotalLoss && actualValue > 0) {
    // 全损：赔付车辆实际价值
    recommendedAmount = actualValue;
  } else {
    // 部分损失：赔付维修费用，不超过车辆价值
    recommendedAmount =
      actualValue > 0
        ? Math.min(estimatedRepairCost, actualValue)
        : estimatedRepairCost;
  }

  // 6. AI 辅助评估（维修项目少或无外部估价时）
  let aiResult = null;
  if (useAI && matchedItems.length === 0 && repairEstimate <= 0) {
    try {
      const prompt = renderPromptTemplate("vehicle_assessment", {
        damageDescription: damageDescription || "未提供",
        vehicleInfo: vehicleInfo || "未提供",
        actualValue: actualValue || "未提供",
      });

      const { response } = await invokeAICapability({
        capabilityId: "admin.claim.risk_assessment",
        request: { contents: { parts: [{ text: prompt }] } },
        meta: {
          sourceApp: "admin-system",
          module: "vehicleAssessment.assess",
          operation: "vehicle_assessment",
          context: { damageDescription, vehicleInfo },
        },
      });

      const responseText = response.text || "";
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
        // 如果 AI 提供了估价且没有其他来源，使用 AI 估价
        if (
          aiResult.estimatedRepairCost &&
          repairEstimate <= 0 &&
          referenceRepairCost <= 0
        ) {
          recommendedAmount =
            actualValue > 0
              ? Math.min(aiResult.estimatedRepairCost, actualValue)
              : aiResult.estimatedRepairCost;
        }
      }
    } catch (error) {
      console.error("AI 辅助车辆定损失败:", error);
    }
  }

  // 7. 判断置信度和是否需要人工复核
  let confidence = 0;
  let needsManualReview = false;

  if (repairEstimate > 0) {
    // 有外部维修估价，置信度较高
    confidence = 0.85;
    // 但如果与参考价差异过大，需要复核
    if (
      referenceRepairCost > 0 &&
      Math.abs(repairEstimate - referenceRepairCost) / referenceRepairCost > 0.5
    ) {
      needsManualReview = true;
      confidence = 0.6;
    }
  } else if (matchedItems.length > 0) {
    // 基于参考价匹配
    confidence = Math.min(0.4 + matchedItems.length * 0.1, 0.75);
    needsManualReview = true; // 无外部估价，建议复核
  } else {
    // 无匹配项目
    confidence = aiResult ? 0.3 : 0;
    needsManualReview = true;
  }

  // 全损案件强制人工复核
  if (totalLossEvaluation.isTotalLoss) {
    needsManualReview = true;
  }

  return {
    insuranceType: "AUTO",
    assessmentType: "VEHICLE",
    damageDescription,
    vehicleInfo,
    estimatedRepairCost: Number(estimatedRepairCost.toFixed(2)),
    actualValue: Number(actualValue),
    recommendedAmount: Number(recommendedAmount.toFixed(2)),
    referenceRepairCost: Number(referenceRepairCost.toFixed(2)),
    matchedItems: matchedItems.map((m) => ({
      part: m.part,
      typicalPrice: m.priceRange.typical,
      priceRange: `${m.priceRange.min}-${m.priceRange.max}`,
      confidence: m.confidence,
    })),
    totalLossEvaluation,
    confidence: Number(confidence.toFixed(2)),
    needsManualReview,
    aiResult,
    assessmentTime: new Date().toISOString(),
  };
}

/**
 * 批量评估多个车辆损失
 * @param {Array<object>} items - 损失列表
 * @returns {Promise<Array>} 评估结果列表
 */
export async function batchAssess(items) {
  return Promise.all(items.map((item) => assess(item)));
}

/**
 * 获取所有维修项目参考价格（用于管理页面展示）
 * @returns {object} 维修项目参考价格表
 */
export function getAllStandards() {
  return REPAIR_REFERENCE_PRICES;
}

/**
 * 清空缓存（车险服务暂无文件缓存，预留接口）
 */
export function clearStandardsCache() {
  // 预留接口，保持与其他定损服务一致
}

export default {
  assess,
  batchAssess,
  getAllStandards,
  clearStandardsCache,
};
