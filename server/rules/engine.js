/**
 * 规则引擎核心 - 执行规则集
 * 按 ExecutionDomain 和 Priority 顺序执行规则
 */

import { evaluateEligibility } from '../claims/liability/evaluator.js';
import { calculateSettlement } from '../claims/settlement/calculator.js';
import { evaluateMaterialCompleteness } from '../claims/materials/completeness.js';
import { logRuleExecution } from '../middleware/index.js';

function dedupeManualReviewReasons(reasons = []) {
  const seen = new Set();
  return reasons.filter(reason => {
    const key = JSON.stringify([reason.code, reason.stage, reason.source, reason.message]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 执行责任判断（ELIGIBILITY域）
 * @param {object} params - 参数
 * @returns {object} 责任判断结果
 */
export async function checkEligibility({ claimCaseId, productCode, ocrData = {} }) {
  const result = evaluateEligibility({ claimCaseId, productCode, ocrData });
  
  // 记录审计日志
  logRuleExecution({
    rulesetId: result.context?.ruleset_id,
    claimCaseId,
    productCode,
    input: { ocrData },
    output: result,
    duration: result.duration,
    success: true
  });
  
  return result;
}

/**
 * 执行金额计算（ASSESSMENT域）
 * @param {object} params - 参数
 * @returns {object} 金额计算结果
 */
export async function calculateAmount({ claimCaseId, productCode, eligibilityResult, invoiceItems = [], ocrData = {} }) {
  const result = calculateSettlement({
    claimCaseId,
    productCode,
    eligibilityResult,
    invoiceItems,
    ocrData
  });
  
  // 记录审计日志
  logRuleExecution({
    rulesetId: result.context?.ruleset_id || eligibilityResult?.context?.ruleset_id,
    claimCaseId,
    productCode,
    input: { invoiceItems, ocrData },
    output: result,
    duration: result.duration,
    success: true
  });
  
  return result;
}

/**
 * 执行完整理赔审核（责任判断 + 金额计算）
 * @param {object} params - 参数
 * @returns {object} 完整审核结果
 */
export async function executeFullReview({ claimCaseId, productCode, ocrData = {}, invoiceItems = [] }) {
  const startTime = Date.now();
  
  // 1. 执行责任判断
  const eligibilityResult = await checkEligibility({ claimCaseId, productCode, ocrData });
  
  // 2. 执行金额计算
  const amountResult = await calculateAmount({
    claimCaseId,
    productCode,
    eligibilityResult,
    invoiceItems,
    ocrData
  });
  
  // 3. 构建综合结果
  const liabilityDecision = eligibilityResult.needsManualReview
    ? 'MANUAL_REVIEW'
    : (eligibilityResult.eligible ? 'ACCEPT' : 'REJECT');
  const assessmentDecision = amountResult.needsManualReview
    ? 'PARTIAL_ASSESSED'
    : 'ASSESSED';
  const settlementDecision = amountResult.settlementDecision || (amountResult.finalAmount > 0 ? 'PAY' : 'ZERO_PAY');
  const coverageResults = amountResult.coverageResults || (amountResult.coverageResult ? [amountResult.coverageResult] : []);
  const materialCompleteness = evaluateMaterialCompleteness({
    claimCaseId,
    productCode,
    claimType: amountResult.claimType || eligibilityResult.context?.product_line
  });
  const hasMissingMaterials = materialCompleteness.missingMaterials.length > 0;
  const manualReviewReasons = dedupeManualReviewReasons([
    ...(eligibilityResult.manualReviewReasons || []),
    ...(amountResult.manualReviewReasons || []),
    ...(hasMissingMaterials ? [{
      code: 'MISSING_REQUIRED_MATERIALS',
      stage: 'INTAKE',
      source: 'MATERIAL_COMPLETENESS',
      category: 'MATERIAL',
      message: `缺少材料: ${materialCompleteness.missingMaterials.map(item => item.name).join('、')}`,
      metadata: {
        missingMaterials: materialCompleteness.missingMaterials.map(item => item.name)
      }
    }] : [])
  ]);
  const warnings = [
    ...(eligibilityResult.warnings || []).map(item => item.message),
    ...(amountResult.warnings || []).map(item => item.message),
    ...(hasMissingMaterials
      ? [`缺少材料: ${materialCompleteness.missingMaterials.map(item => item.name).join('、')}`]
      : [])
  ];
  const reasonCodes = [
    ...(eligibilityResult.rejectionReasons || []).map(item => item.reason_code),
    ...manualReviewReasons.map(item => item.code),
    ...warnings.map((_, index) => `WARN_${index + 1}`)
  ];
  const finalDecision = (eligibilityResult.needsManualReview || amountResult.needsManualReview || hasMissingMaterials)
    ? 'MANUAL_REVIEW'
    : (eligibilityResult.eligible ? 'APPROVE' : 'REJECT');
  const finalIntakeDecision = hasMissingMaterials ? 'PENDING_MATERIAL' : 'PASS';
  const finalLiabilityDecision = hasMissingMaterials
    ? 'MANUAL_REVIEW'
    : liabilityDecision;
  const finalAssessmentDecision = hasMissingMaterials && assessmentDecision === 'ASSESSED'
    ? 'PARTIAL_ASSESSED'
    : assessmentDecision;
  const finalSettlementDecision = hasMissingMaterials
    ? 'MANUAL_REVIEW'
    : settlementDecision;

  return {
    // 决策结果
    decision: finalDecision,
    intakeDecision: finalIntakeDecision,
    liabilityDecision: finalLiabilityDecision,
    assessmentDecision: finalAssessmentDecision,
    settlementDecision: finalSettlementDecision,
    claimType: amountResult.claimType || eligibilityResult.context?.product_line || 'UNKNOWN',
    coverageResults,
    reasonCodes,
    warnings,
    manualReviewReasons,
    missingMaterials: materialCompleteness.missingMaterials.map(item => item.name),
    payableAmount: amountResult.finalAmount,
    currency: 'CNY',
    
    // 责任判断
    eligibility: {
      eligible: eligibilityResult.eligible,
      matchedRules: eligibilityResult.matchedRules,
      rejectionReasons: eligibilityResult.rejectionReasons,
      warnings: eligibilityResult.warnings,
      needsManualReview: eligibilityResult.needsManualReview,
      manualReviewReasons: eligibilityResult.manualReviewReasons,
      fraudFlagged: eligibilityResult.fraudFlagged
    },
    
    // 金额计算
    amount: {
      totalClaimable: amountResult.totalClaimable,
      deductible: amountResult.deductible,
      reimbursementRatio: amountResult.reimbursementRatio,
      finalAmount: amountResult.finalAmount,
      factAssessment: amountResult.factAssessment,
      itemBreakdown: amountResult.itemBreakdown,
      coverageCode: amountResult.coverageCode,
      coverageResult: amountResult.coverageResult,
      coverageResults,
      warnings: amountResult.warnings,
      needsManualReview: amountResult.needsManualReview,
      manualReviewReasons: amountResult.manualReviewReasons
    },

    completeness: materialCompleteness,
    
    // 规则追踪
    ruleTrace: [
      ...eligibilityResult.matchedRules,
      ...(amountResult.executionDetails || [])
        .filter(r => r.condition_met)
        .map(r => r.rule_id)
    ],
    
    // 上下文信息
    context: eligibilityResult.context,
    auditTrail: [
      ...(eligibilityResult.executionDetails || []).map(item => ({
        stage: 'LIABILITY',
        ruleId: item.rule_id,
        matched: item.condition_met
      })),
      ...(amountResult.executionDetails || []).map(item => ({
        stage: 'SETTLEMENT',
        ruleId: item.rule_id,
        matched: item.condition_met
      }))
    ],
    
    // 执行时长
    duration: Date.now() - startTime
  };
}
