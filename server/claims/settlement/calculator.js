import { ExecutionDomain, sortRulesByPriority, filterRulesByDomain, executeSingleRule } from '../../rules/runtime.js';
import { evaluateFacts } from '../assessment/evaluator.js';
import { getAccidentCoverageConfig } from '../accident/engine.js';
import { getMedicalCoverageConfig, isMedicalCoverageCode } from '../medical/engine.js';
import { getAutoCoverageConfig, isAutoCoverageCode } from '../auto/engine.js';
import { determineSettlementMode, runLossLedger, runBenefitLedger } from './ledger.js';

function applyPostProcessRules(postProcessRules, context, state) {
  const executionResults = [];
  for (const rule of postProcessRules) {
    executionResults.push(executeSingleRule(rule, context, state));
  }
  return executionResults;
}

function appendWarning(warnings, message, category = 'SYSTEM', ruleId = 'SYSTEM') {
  warnings.push({ rule_id: ruleId, message, category });
}

function appendManualReviewReason(reasons, { code, source = 'SYSTEM', category = 'SYSTEM', stage = 'SETTLEMENT', message, metadata = undefined }) {
  reasons.push({
    code,
    source,
    category,
    stage,
    message,
    ...(metadata ? { metadata } : {})
  });
}

function inferClaimType(context) {
  return context.ruleset?.product_line || context.policy?.insuranceType || 'UNKNOWN';
}

function getCoverageConfigByClaimType(productCode, claimType, coverageCode, rulesetOverride = null) {
  if (claimType === 'AUTO' || isAutoCoverageCode(coverageCode)) {
    return getAutoCoverageConfig(productCode, coverageCode, rulesetOverride);
  }
  if (claimType === 'HEALTH' || isMedicalCoverageCode(coverageCode)) {
    return getMedicalCoverageConfig(productCode, coverageCode, rulesetOverride);
  }
  return getAccidentCoverageConfig(productCode, coverageCode, rulesetOverride);
}

function roundAmount(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function summarizeCoverageResults(results = []) {
  return results.reduce((sum, item) => sum + (Number(item?.approvedAmount) || 0), 0);
}

function mergeCoverageResults(...groups) {
  return groups.flat().filter(Boolean);
}

function deriveLegacyCoverageResult(coverageResults) {
  return coverageResults.length > 0 ? coverageResults[0] : null;
}

function deriveReimbursementRatio(mode, lossSettlement, benefitSettlement) {
  if (mode === 'BENEFIT') return benefitSettlement?.reimbursementRatio ?? 1;
  if (mode === 'LOSS') return lossSettlement?.reimbursementRatio ?? 1;
  return lossSettlement?.reimbursementRatio ?? benefitSettlement?.reimbursementRatio ?? 1;
}

export function calculateSettlement({ claimCaseId, productCode, eligibilityResult, invoiceItems = [], ocrData = {}, validationFacts = null, rulesetOverride = null }) {
  const startTime = Date.now();

  if (eligibilityResult && !eligibilityResult.eligible && !eligibilityResult.needsManualReview) {
    return {
      totalClaimable: 0,
      deductible: 0,
      reimbursementRatio: 0,
      finalAmount: 0,
      claimType: eligibilityResult.context?.product_line || 'UNKNOWN',
      coverageCode: null,
      coverageResult: null,
      coverageResults: [],
      settlementDecision: 'ZERO_PAY',
      settlementMode: 'LOSS',
      lossLedger: [],
      benefitLedger: [],
      settlementBreakdown: {
        lossPayableAmount: 0,
        benefitPayableAmount: 0,
        totalPayableAmount: 0
      },
      itemBreakdown: [],
      warnings: [],
      needsManualReview: false,
      reason: '责任判断未通过',
      rejectionReasons: eligibilityResult.rejectionReasons,
      duration: Date.now() - startTime
    };
  }

  const factResult = evaluateFacts({ claimCaseId, productCode, invoiceItems, ocrData, validationFacts, rulesetOverride });
  const { context, state, coverageCode } = factResult;
  const rules = context.ruleset.rules;
  const postProcessRules = sortRulesByPriority(filterRulesByDomain(rules, ExecutionDomain.POST_PROCESS));
  const executionResults = [...(factResult.executionDetails || [])];
  const warnings = [];
  const manualReviewReasons = [...(eligibilityResult?.manualReviewReasons || [])];
  let needsManualReview = Boolean(eligibilityResult?.needsManualReview);
  executionResults.push(...applyPostProcessRules(postProcessRules, context, state));

  const claimType = inferClaimType(context);
  const coverageConfig = getCoverageConfigByClaimType(productCode || context.policy?.product_code, claimType, coverageCode, rulesetOverride);
  if (!coverageConfig) {
    needsManualReview = true;
    const message = `未找到责任 ${coverageCode} 对应的保障配置，需人工复核产品责任映射`;
    appendWarning(warnings, message, 'COVERAGE_CONFIG');
    appendManualReviewReason(manualReviewReasons, {
      code: 'COVERAGE_CONFIG_MISSING',
      source: coverageCode || 'UNKNOWN_COVERAGE',
      category: 'COVERAGE_CONFIG',
      message,
      metadata: { coverageCode }
    });
  }

  const settlementMode = determineSettlementMode({
    claimType,
    coverageCode,
    expenseItems: factResult.expenseItems,
    context
  });

  const baseLedgerParams = {
    productCode: productCode || context.policy?.product_code,
    context,
    factResult,
    coverageCode,
    coverageConfig,
    claimType,
    warnings,
    needsManualReview
  };

  const lossSettlement = settlementMode === 'BENEFIT'
    ? {
        lossLedger: [],
        coverageResults: [],
        lossPayableAmount: 0,
        deductible: 0,
        reimbursementRatio: 1,
        totalClaimable: 0,
        legacyItemBreakdown: [],
        capApplied: false
      }
    : runLossLedger(baseLedgerParams);

  const benefitSettlement = settlementMode === 'LOSS'
    ? {
        benefitLedger: [],
        coverageResults: [],
        benefitPayableAmount: 0,
        totalClaimable: 0,
        reimbursementRatio: 1
      }
    : runBenefitLedger({
        context,
        coverageCode,
        coverageConfig,
        claimType,
        eligibilityResult,
        warnings,
        needsManualReview
      });

  const coverageResults = mergeCoverageResults(
    lossSettlement.coverageResults,
    benefitSettlement.coverageResults
  );
  const lossPayableAmount = roundAmount(lossSettlement.lossPayableAmount || 0);
  const benefitPayableAmount = roundAmount(benefitSettlement.benefitPayableAmount || 0);
  const finalAmount = roundAmount(lossPayableAmount + benefitPayableAmount);
  const totalClaimable = roundAmount((lossSettlement.totalClaimable || 0) + (benefitSettlement.totalClaimable || 0));
  const itemBreakdown = lossSettlement.legacyItemBreakdown || [];
  const coverageResult = deriveLegacyCoverageResult(coverageResults);

  return {
    totalClaimable,
    deductible: roundAmount(lossSettlement.deductible || 0),
    reimbursementRatio: deriveReimbursementRatio(settlementMode, lossSettlement, benefitSettlement),
    finalAmount,
    capApplied: Boolean(lossSettlement.capApplied || coverageResults.some(item => item.sumInsured !== null && item.approvedAmount < item.claimedAmount)),
    sumInsured: coverageResult?.sumInsured ?? null,
    claimType,
    coverageCode,
    coverageResult,
    coverageResults,
    settlementMode,
    lossLedger: lossSettlement.lossLedger || [],
    benefitLedger: benefitSettlement.benefitLedger || [],
    settlementBreakdown: {
      lossPayableAmount,
      benefitPayableAmount,
      totalPayableAmount: finalAmount
    },
    settlementDecision: needsManualReview ? 'MANUAL_REVIEW' : (finalAmount > 0 ? 'PAY' : 'ZERO_PAY'),
    itemBreakdown,
    factAssessment: {
      coverageCode,
      faultRatio: factResult.faultRatio,
      totalApproved: summarizeCoverageResults(coverageResults),
      itemBreakdown,
      executionDetails: factResult.executionDetails,
      lossLedger: lossSettlement.lossLedger || [],
      benefitLedger: benefitSettlement.benefitLedger || [],
      duration: factResult.duration
    },
    warnings,
    manualReviewReasons,
    needsManualReview,
    executionDetails: executionResults,
    context: {
      claim_id: claimCaseId,
      product_code: context.policy?.product_code,
      coverage_code: coverageCode,
      claim_type: claimType
    },
    duration: Date.now() - startTime
  };
}
