import { getCoverageConfig } from '../../rules/context.js';
import { ExecutionDomain, sortRulesByPriority, filterRulesByDomain, executeSingleRule } from '../../rules/runtime.js';
import { evaluateFacts } from '../assessment/evaluator.js';

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

function inferClaimType(context) {
  return context.ruleset?.product_line || context.policy?.insuranceType || 'UNKNOWN';
}

function getConfiguredAmount(value) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && typeof value.amount === 'number') {
    return value.amount;
  }
  return 0;
}

function getDeductibleAmount(coverageConfig) {
  return coverageConfig ? getConfiguredAmount(coverageConfig.deductible) : 0;
}

function getSumInsuredAmount(coverageConfig) {
  return coverageConfig ? getConfiguredAmount(coverageConfig.sum_insured) : 0;
}

function getMedicalReimbursementRatio(coverageConfig) {
  if (!coverageConfig) return 1;
  if (typeof coverageConfig.co_pay_ratio === 'number') {
    return 1 - coverageConfig.co_pay_ratio;
  }

  const rules = coverageConfig.reimbursement_rules;
  if (rules) {
    if (typeof rules.social_insurance_covered_ratio === 'number') {
      return rules.social_insurance_covered_ratio;
    }
    if (typeof rules.without_social_insurance_ratio === 'number') {
      return rules.without_social_insurance_ratio;
    }
  }

  return 1;
}

export function calculateSettlement({ claimCaseId, productCode, eligibilityResult, invoiceItems = [], ocrData = {} }) {
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
      itemBreakdown: [],
      warnings: [],
      needsManualReview: false,
      reason: '责任判断未通过',
      rejectionReasons: eligibilityResult.rejectionReasons,
      duration: Date.now() - startTime
    };
  }

  const factResult = evaluateFacts({ claimCaseId, productCode, invoiceItems, ocrData });
  const { context, state, coverageCode, totalApproved, itemBreakdown } = factResult;
  const rules = context.ruleset.rules;
  const postProcessRules = sortRulesByPriority(filterRulesByDomain(rules, ExecutionDomain.POST_PROCESS));
  const executionResults = [...(factResult.executionDetails || [])];
  const warnings = [];
  let needsManualReview = Boolean(eligibilityResult?.needsManualReview);
  executionResults.push(...applyPostProcessRules(postProcessRules, context, state));
  const coverageConfig = getCoverageConfig(productCode || context.policy?.product_code, coverageCode);

  if (!coverageConfig) {
    needsManualReview = true;
    appendWarning(warnings, `未找到责任 ${coverageCode} 对应的保障配置，需人工复核产品责任映射`, 'COVERAGE_CONFIG');
  }

  if (coverageCode === 'ACC_DISABILITY' || coverageCode === 'ACC_DEATH' || coverageCode === 'ACC_HOSPITAL_ALLOWANCE') {
    state.deductible = 0;
  }

  const deductible = state.deductible || 0;
  const defaultRatio = coverageCode === 'ACC_MEDICAL' ? getMedicalReimbursementRatio(coverageConfig) : 1;
  const reimbursementRatio = state.payoutRatio || defaultRatio;
  let baseAmount = state.calculatedAmount ?? totalApproved;
  let reportedClaimable = totalApproved;

  if (coverageCode === 'ACC_DISABILITY') {
    baseAmount = getSumInsuredAmount(coverageConfig);
    reportedClaimable = baseAmount;
  } else if (coverageCode === 'ACC_DEATH') {
    baseAmount = getSumInsuredAmount(coverageConfig);
    reportedClaimable = baseAmount;
  } else if (coverageCode === 'ACC_HOSPITAL_ALLOWANCE') {
    const dailyAllowance = coverageConfig?.daily_allowance || 0;
    baseAmount = (context.claim?.hospital_days || 0) * dailyAllowance;
    reportedClaimable = baseAmount;
  } else if (coverageCode === 'ACC_MEDICAL' && deductible === 0 && getDeductibleAmount(coverageConfig) > 0) {
    const fallbackDeductible = getDeductibleAmount(coverageConfig);
    state.deductible = fallbackDeductible;
    baseAmount = Math.max(0, baseAmount - fallbackDeductible);
  }

  const finalAmount = Math.max(0, Math.round(baseAmount * reimbursementRatio * 100) / 100);
  const configuredSumInsured = getSumInsuredAmount(coverageConfig);
  const sumInsured = configuredSumInsured || Infinity;
  const cappedAmount = Math.min(finalAmount, sumInsured);
  const coverageResult = {
    coverageCode,
    claimedAmount: reportedClaimable,
    approvedAmount: cappedAmount,
    deductible: state.deductible || 0,
    reimbursementRatio,
    sumInsured: Number.isFinite(sumInsured) ? sumInsured : null,
    status: needsManualReview ? 'MANUAL_REVIEW' : (cappedAmount > 0 ? 'PAYABLE' : 'ZERO_PAY'),
    warnings
  };

  return {
    totalClaimable: reportedClaimable,
    deductible: state.deductible || 0,
    reimbursementRatio,
    finalAmount: cappedAmount,
    capApplied: finalAmount > sumInsured,
    sumInsured,
    claimType: inferClaimType(context),
    coverageCode,
    coverageResult,
    coverageResults: [coverageResult],
    settlementDecision: needsManualReview ? 'MANUAL_REVIEW' : (cappedAmount > 0 ? 'PAY' : 'ZERO_PAY'),
    itemBreakdown,
    factAssessment: {
      coverageCode,
      totalApproved,
      itemBreakdown,
      executionDetails: factResult.executionDetails,
      duration: factResult.duration
    },
    warnings,
    needsManualReview,
    executionDetails: executionResults,
    context: {
      claim_id: claimCaseId,
      product_code: context.policy?.product_code,
      coverage_code: coverageCode,
      claim_type: inferClaimType(context)
    },
    duration: Date.now() - startTime
  };
}
