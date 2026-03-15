/**
 * 规则引擎核心 - 执行规则集
 * 按 ExecutionDomain 和 Priority 顺序执行规则
 */

import { evaluateEligibility } from '../claims/liability/evaluator.js';
import { calculateSettlement } from '../claims/settlement/calculator.js';
import { evaluateMaterialCompleteness } from '../claims/materials/completeness.js';
import { logRuleExecution } from '../middleware/index.js';
import { getLatestMaterialValidationResults, getRuleset } from './context.js';

function extractConditionFields(conditions, collected = new Set()) {
  if (!conditions || typeof conditions !== 'object') {
    return [...collected];
  }

  if (typeof conditions.field === 'string') {
    collected.add(conditions.field);
  }

  if (Array.isArray(conditions.expressions)) {
    for (const expression of conditions.expressions) {
      extractConditionFields(expression, collected);
    }
  }

  return [...collected];
}

function dedupeManualReviewReasons(reasons = []) {
  const seen = new Set();
  return reasons.filter(reason => {
    const key = JSON.stringify([reason.code, reason.stage, reason.source, reason.message]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildRuleMap({ context, eligibilityResult, amountResult }) {
  const ruleMap = new Map();
  const pushRule = (rule) => {
    if (!rule?.rule_id) return;
    const existing = ruleMap.get(rule.rule_id);
    if (!existing) {
      ruleMap.set(rule.rule_id, rule);
      return;
    }

    const existingScore =
      (existing.conditions ? 1 : 0) +
      (existing.rule_kind ? 1 : 0) +
      (existing.execution?.domain ? 1 : 0);
    const nextScore =
      (rule.conditions ? 1 : 0) +
      (rule.rule_kind ? 1 : 0) +
      (rule.execution?.domain ? 1 : 0);

    if (nextScore > existingScore) {
      ruleMap.set(rule.rule_id, { ...existing, ...rule });
    }
  };

  (context?.ruleset?.rules || []).forEach(pushRule);

  const fallbackRuleset = getRuleset(
    context?.product_code ||
      eligibilityResult?.context?.product_code ||
      amountResult?.context?.product_code
  );
  (fallbackRuleset?.rules || []).forEach(pushRule);

  const executionDetails = [
    ...(eligibilityResult?.executionDetails || []),
    ...(amountResult?.executionDetails || [])
  ];
  executionDetails.forEach((item) => {
    if (item?.rule_id && item?.rule_name) {
      pushRule({
        rule_id: item.rule_id,
        rule_name: item.rule_name,
        category: item.category,
        execution: { domain: item.domain || null },
        action: item.action_result ? { action_type: item.action_result.action_type || null } : null,
        source: item.source || null
      });
    }
  });

  return ruleMap;
}

function buildMatchedRuleDetails({ context, eligibilityResult, amountResult }) {
  const ruleMap = buildRuleMap({ context, eligibilityResult, amountResult });
  const detailMap = new Map();

  const register = (ruleId, detail = {}) => {
    if (!ruleId) return;
    const rule = ruleMap.get(ruleId);
    if (!rule) return;
    if (detailMap.has(ruleId)) return;
    detailMap.set(ruleId, {
      ruleId,
      ruleName: rule.rule_name,
      ruleKind: rule.rule_kind || 'AUXILIARY',
      category: rule.category,
      domain: rule.execution?.domain || detail.domain || 'UNKNOWN',
      fields: extractConditionFields(rule.conditions),
      actionType: rule.action?.action_type || null,
      effect: detail.effect || detail.message || rule.action?.action_type || '规则命中',
      sourceText: rule.source?.source_text || '',
    });
  };

  (eligibilityResult?.matchedRules || []).forEach((ruleId) => {
    const executionDetail = (eligibilityResult?.executionDetails || []).find(item => item.rule_id === ruleId);
    register(ruleId, {
      domain: 'LIABILITY',
      effect: executionDetail?.action_result?.message || executionDetail?.action_result?.action_type,
      message: executionDetail?.action_result?.message,
    });
  });

  (amountResult?.executionDetails || []).forEach((item) => {
    if (item?.condition_met) {
      register(item.rule_id, {
        domain: 'SETTLEMENT',
        effect: item.action_result?.message || item.action_result?.action_type,
        message: item.action_result?.message,
      });
    }
    if (Array.isArray(item?.item_results) && item.item_results.some(result => result?.conditionMet)) {
      register(item.rule_id, {
        domain: 'SETTLEMENT',
        effect: item.action_result?.message || item.action_result?.action_type || '费用项规则命中',
      });
    }
  });

  (eligibilityResult?.manualReviewReasons || []).forEach((reason) => {
    register(reason?.source, {
      domain: 'LIABILITY',
      effect: reason?.message || reason?.code || '触发人工复核',
      message: reason?.message,
    });
  });

  (amountResult?.manualReviewReasons || []).forEach((reason) => {
    register(reason?.source, {
      domain: 'SETTLEMENT',
      effect: reason?.message || reason?.code || '触发人工复核',
      message: reason?.message,
    });
  });

  (eligibilityResult?.rejectionReasons || []).forEach((reason) => {
    register(reason?.rule_id, {
      domain: 'LIABILITY',
      effect: reason?.reason_code || '触发拒赔',
      message: reason?.reason_code,
    });
  });

  return [...detailMap.values()];
}

/**
 * 执行责任判断（ELIGIBILITY域）
 * @param {object} params - 参数
 * @returns {object} 责任判断结果
 */
export async function checkEligibility({ claimCaseId, productCode, ocrData = {}, validationFacts = null, rulesetOverride = null }) {
  const result = evaluateEligibility({ claimCaseId, productCode, ocrData, validationFacts, rulesetOverride });
  
  // 记录审计日志
  logRuleExecution({
    rulesetId: result.context?.ruleset_id,
    claimCaseId,
    productCode,
    input: { ocrData, validationFacts, rulesetOverride },
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
export async function calculateAmount({ claimCaseId, productCode, eligibilityResult, invoiceItems = [], ocrData = {}, validationFacts = null, rulesetOverride = null }) {
  const result = calculateSettlement({
    claimCaseId,
    productCode,
    eligibilityResult,
    invoiceItems,
    ocrData,
    validationFacts,
    rulesetOverride
  });
  
  // 记录审计日志
  logRuleExecution({
    rulesetId: result.context?.ruleset_id || eligibilityResult?.context?.ruleset_id,
    claimCaseId,
    productCode,
    input: { invoiceItems, ocrData, validationFacts, rulesetOverride },
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
export async function executeFullReview({ claimCaseId, productCode, ocrData = {}, invoiceItems = [], validationFacts = null, rulesetOverride = null }) {
  const startTime = Date.now();
  
  // 1. 执行责任判断
  const eligibilityResult = await checkEligibility({ claimCaseId, productCode, ocrData, validationFacts, rulesetOverride });
  
  // 2. 执行金额计算
  const amountResult = await calculateAmount({
    claimCaseId,
    productCode,
    eligibilityResult,
    invoiceItems,
    ocrData,
    validationFacts,
    rulesetOverride
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
    claimType: amountResult.claimType || eligibilityResult.context?.product_line,
    coverageCode: amountResult.coverageCode
  });
  const materialValidationResults = getLatestMaterialValidationResults(claimCaseId);
  const failedMaterialValidations = materialValidationResults.filter(item => !item.passed);
  const hasMissingMaterials = materialCompleteness.missingMaterials.length > 0;
  const manualReviewReasons = dedupeManualReviewReasons([
    ...(eligibilityResult.manualReviewReasons || []),
    ...(amountResult.manualReviewReasons || []),
    ...failedMaterialValidations.map(item => ({
      code: item.details?.reasonCode || 'MATERIAL_VALIDATION_FAILED',
      stage: 'INTAKE',
      source: item.details?.ruleId || 'MATERIAL_VALIDATION',
      category: item.type || 'MATERIAL_VALIDATION',
      message: item.message,
      metadata: {
        field: item.details?.field,
        failureAction: item.details?.failureAction
      }
    })),
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
    ...failedMaterialValidations.map(item => item.message),
    ...(hasMissingMaterials
      ? [`缺少材料: ${materialCompleteness.missingMaterials.map(item => item.name).join('、')}`]
      : [])
  ];
  const reasonCodes = [
    ...(eligibilityResult.rejectionReasons || []).map(item => item.reason_code),
    ...manualReviewReasons.map(item => item.code),
    ...warnings.map((_, index) => `WARN_${index + 1}`)
  ];
  const hasMaterialValidationFailure = failedMaterialValidations.length > 0;
  const finalDecision = (eligibilityResult.needsManualReview || amountResult.needsManualReview || hasMissingMaterials || hasMaterialValidationFailure)
    ? 'MANUAL_REVIEW'
    : (eligibilityResult.eligible ? 'APPROVE' : 'REJECT');
  const finalIntakeDecision = hasMissingMaterials ? 'PENDING_MATERIAL' : 'PASS';
  const finalLiabilityDecision = (hasMissingMaterials || hasMaterialValidationFailure)
    ? 'MANUAL_REVIEW'
    : liabilityDecision;
  const finalAssessmentDecision = (hasMissingMaterials || hasMaterialValidationFailure) && assessmentDecision === 'ASSESSED'
    ? 'PARTIAL_ASSESSED'
    : assessmentDecision;
  const finalSettlementDecision = (hasMissingMaterials || hasMaterialValidationFailure)
    ? 'MANUAL_REVIEW'
    : settlementDecision;
  const matchedRuleDetails = buildMatchedRuleDetails({
    context: eligibilityResult.context,
    eligibilityResult,
    amountResult
  });

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
    materialValidationResults,
    matchedRuleDetails,
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
      settlementMode: amountResult.settlementMode,
      lossLedger: amountResult.lossLedger,
      benefitLedger: amountResult.benefitLedger,
      settlementBreakdown: amountResult.settlementBreakdown,
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
