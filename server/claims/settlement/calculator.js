import { ExecutionDomain, sortRulesByPriority, filterRulesByDomain, executeSingleRule } from '../../rules/runtime.js';
import { evaluateFacts } from '../assessment/evaluator.js';
import { getAccidentCoverageConfig, ACCIDENT_COVERAGE_CODES } from '../accident/engine.js';
import { getMedicalCoverageConfig, MEDICAL_COVERAGE_CODES, isMedicalCoverageCode } from '../medical/engine.js';
import { getAutoCoverageConfig, AUTO_COVERAGE_CODES, isAutoCoverageCode, getAutoLossAmount, getAutoActualValue, getCompulsoryBreakdown } from '../auto/engine.js';

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

function getCoverageConfigByClaimType(productCode, claimType, coverageCode) {
  if (claimType === 'AUTO' || isAutoCoverageCode(coverageCode)) {
    return getAutoCoverageConfig(productCode, coverageCode);
  }
  if (claimType === 'HEALTH' || isMedicalCoverageCode(coverageCode)) {
    return getMedicalCoverageConfig(productCode, coverageCode);
  }
  return getAccidentCoverageConfig(productCode, coverageCode);
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

function buildCoverageResult({ coverageCode, claimedAmount, approvedAmount, deductible, reimbursementRatio, sumInsured, status, warnings = [] }) {
  return {
    coverageCode,
    claimedAmount,
    approvedAmount,
    deductible,
    reimbursementRatio,
    sumInsured,
    status,
    warnings
  };
}

function getCoverageStatus(needsManualReview, approvedAmount) {
  if (needsManualReview) return 'MANUAL_REVIEW';
  return approvedAmount > 0 ? 'PAYABLE' : 'ZERO_PAY';
}

function getCompulsoryLimits(coverageConfig) {
  const defaults = {
    deathDisability: 180000,
    injury: 18000,
    propertyDamage: 2000
  };

  if (!coverageConfig?.limit_breakdown) {
    return defaults;
  }

  return {
    deathDisability: getConfiguredAmount(coverageConfig.limit_breakdown.death_disability) || defaults.deathDisability,
    injury: getConfiguredAmount(coverageConfig.limit_breakdown.injury) || defaults.injury,
    propertyDamage: getConfiguredAmount(coverageConfig.limit_breakdown.property_damage) || defaults.propertyDamage
  };
}

function calculateCompulsoryApprovedAmount(context, coverageConfig, totalClaimedAmount) {
  const breakdown = getCompulsoryBreakdown(context);
  const limits = getCompulsoryLimits(coverageConfig);

  if (breakdown.total <= 0) {
    return {
      claimedAmount: totalClaimedAmount,
      approvedAmount: Math.min(totalClaimedAmount, getSumInsuredAmount(coverageConfig) || totalClaimedAmount)
    };
  }

  return {
    claimedAmount: breakdown.total,
    approvedAmount:
      Math.min(breakdown.propertyDamage, limits.propertyDamage) +
      Math.min(breakdown.injury, limits.injury) +
      Math.min(breakdown.deathDisability, limits.deathDisability)
  };
}

function calculateAutoCoverageResults({ productCode, context, factResult, coverageCode, coverageConfig, warnings, needsManualReview }) {
  const faultRatio = factResult.faultRatio ?? 1;

  if (coverageCode === AUTO_COVERAGE_CODES.VEHICLE_DAMAGE) {
    const claimedAmount = getAutoLossAmount(context, factResult, coverageCode, coverageConfig);
    const actualValue = getAutoActualValue(context, coverageConfig);
    const baseAmount = actualValue > 0 ? Math.min(claimedAmount, actualValue) : claimedAmount;
    const finalAmount = Math.max(0, Math.round(baseAmount * faultRatio * 100) / 100);
    const sumInsured = getSumInsuredAmount(coverageConfig) || null;
    const approvedAmount = sumInsured ? Math.min(finalAmount, sumInsured) : finalAmount;

    return {
      totalClaimable: claimedAmount,
      deductible: 0,
      reimbursementRatio: faultRatio,
      finalAmount: approvedAmount,
      sumInsured: sumInsured || Infinity,
      coverageResults: [
        buildCoverageResult({
          coverageCode,
          claimedAmount,
          approvedAmount,
          deductible: 0,
          reimbursementRatio: faultRatio,
          sumInsured,
          status: getCoverageStatus(needsManualReview, approvedAmount),
          warnings
        })
      ]
    };
  }

  if (coverageCode === AUTO_COVERAGE_CODES.COMPULSORY) {
    const claimedAmount = getAutoLossAmount(context, factResult, coverageCode, coverageConfig);
    const sumInsured = getSumInsuredAmount(coverageConfig) || null;
    const compulsoryAmount = calculateCompulsoryApprovedAmount(context, coverageConfig, claimedAmount);
    const approvedAmount = sumInsured ? Math.min(compulsoryAmount.approvedAmount, sumInsured) : compulsoryAmount.approvedAmount;

    return {
      totalClaimable: compulsoryAmount.claimedAmount,
      deductible: 0,
      reimbursementRatio: 1,
      finalAmount: approvedAmount,
      sumInsured: sumInsured || Infinity,
      coverageResults: [
        buildCoverageResult({
          coverageCode,
          claimedAmount: compulsoryAmount.claimedAmount,
          approvedAmount,
          deductible: 0,
          reimbursementRatio: 1,
          sumInsured,
          status: getCoverageStatus(needsManualReview, approvedAmount),
          warnings
        })
      ]
    };
  }

  if (coverageCode === AUTO_COVERAGE_CODES.THIRD_PARTY) {
    const claimedAmount = getAutoLossAmount(context, factResult, coverageCode, coverageConfig);
    const compulsoryConfig = getAutoCoverageConfig(productCode, AUTO_COVERAGE_CODES.COMPULSORY);
    const compulsoryAmount = calculateCompulsoryApprovedAmount(context, compulsoryConfig, claimedAmount);
    const compulsorySumInsured = getSumInsuredAmount(compulsoryConfig) || null;
    const compulsoryApproved = compulsorySumInsured ? Math.min(compulsoryAmount.approvedAmount, compulsorySumInsured) : compulsoryAmount.approvedAmount;
    const remainingLoss = Math.max(0, claimedAmount - compulsoryApproved);
    const commercialBaseAmount = Math.max(0, Math.round(remainingLoss * faultRatio * 100) / 100);
    const commercialSumInsured = getSumInsuredAmount(coverageConfig) || null;
    const commercialApproved = commercialSumInsured ? Math.min(commercialBaseAmount, commercialSumInsured) : commercialBaseAmount;
    const coverageResults = [];

    if (compulsoryApproved > 0) {
      coverageResults.push(buildCoverageResult({
        coverageCode: AUTO_COVERAGE_CODES.COMPULSORY,
        claimedAmount: compulsoryAmount.claimedAmount,
        approvedAmount: compulsoryApproved,
        deductible: 0,
        reimbursementRatio: 1,
        sumInsured: compulsorySumInsured,
        status: getCoverageStatus(needsManualReview, compulsoryApproved),
        warnings
      }));
    } else if (!compulsoryConfig) {
      appendWarning(warnings, '未找到交强险保障配置，三者险按商业险单链路试算', 'AUTO_COMPULSORY', 'SYSTEM');
    }

    coverageResults.push(buildCoverageResult({
      coverageCode,
      claimedAmount: remainingLoss || claimedAmount,
      approvedAmount: commercialApproved,
      deductible: 0,
      reimbursementRatio: faultRatio,
      sumInsured: commercialSumInsured,
      status: getCoverageStatus(needsManualReview, commercialApproved),
      warnings
    }));

    return {
      totalClaimable: claimedAmount,
      deductible: 0,
      reimbursementRatio: faultRatio,
      finalAmount: coverageResults.reduce((sum, item) => sum + item.approvedAmount, 0),
      sumInsured: commercialSumInsured || Infinity,
      coverageResults
    };
  }

  if (coverageCode === AUTO_COVERAGE_CODES.DRIVER_PASSENGER) {
    const claimedAmount = getAutoLossAmount(context, factResult, coverageCode, coverageConfig);
    const sumInsured = getSumInsuredAmount(coverageConfig) || null;
    const approvedAmount = sumInsured ? Math.min(claimedAmount, sumInsured) : claimedAmount;

    return {
      totalClaimable: claimedAmount,
      deductible: 0,
      reimbursementRatio: 1,
      finalAmount: approvedAmount,
      sumInsured: sumInsured || Infinity,
      coverageResults: [
        buildCoverageResult({
          coverageCode,
          claimedAmount,
          approvedAmount,
          deductible: 0,
          reimbursementRatio: 1,
          sumInsured,
          status: getCoverageStatus(needsManualReview, approvedAmount),
          warnings
        })
      ]
    };
  }

  return null;
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
  const manualReviewReasons = [...(eligibilityResult?.manualReviewReasons || [])];
  let needsManualReview = Boolean(eligibilityResult?.needsManualReview);
  executionResults.push(...applyPostProcessRules(postProcessRules, context, state));
  const claimType = inferClaimType(context);
  const coverageConfig = getCoverageConfigByClaimType(productCode || context.policy?.product_code, claimType, coverageCode);

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

  if (
    coverageCode === ACCIDENT_COVERAGE_CODES.DISABILITY ||
    coverageCode === ACCIDENT_COVERAGE_CODES.DEATH ||
    coverageCode === ACCIDENT_COVERAGE_CODES.ALLOWANCE
  ) {
    state.deductible = 0;
  }

  const deductible = state.deductible || 0;
  const defaultRatio = (
    coverageCode === ACCIDENT_COVERAGE_CODES.MEDICAL ||
    coverageCode === MEDICAL_COVERAGE_CODES.INPATIENT
  ) ? getMedicalReimbursementRatio(coverageConfig) : 1;
  const reimbursementRatio = state.payoutRatio || defaultRatio;
  let baseAmount = state.calculatedAmount ?? totalApproved;
  let reportedClaimable = totalApproved;

  if (coverageCode === ACCIDENT_COVERAGE_CODES.DISABILITY) {
    baseAmount = getSumInsuredAmount(coverageConfig);
    reportedClaimable = baseAmount;
  } else if (coverageCode === ACCIDENT_COVERAGE_CODES.DEATH) {
    baseAmount = getSumInsuredAmount(coverageConfig);
    reportedClaimable = baseAmount;
  } else if (coverageCode === ACCIDENT_COVERAGE_CODES.ALLOWANCE) {
    const dailyAllowance = coverageConfig?.daily_allowance || 0;
    baseAmount = (context.claim?.hospital_days || 0) * dailyAllowance;
    reportedClaimable = baseAmount;
  } else if (
    (coverageCode === ACCIDENT_COVERAGE_CODES.MEDICAL || coverageCode === MEDICAL_COVERAGE_CODES.INPATIENT) &&
    deductible === 0 &&
    getDeductibleAmount(coverageConfig) > 0
  ) {
    const fallbackDeductible = getDeductibleAmount(coverageConfig);
    state.deductible = fallbackDeductible;
    baseAmount = Math.max(0, baseAmount - fallbackDeductible);
  }

  if (isAutoCoverageCode(coverageCode)) {
    const autoSettlement = calculateAutoCoverageResults({
      productCode: productCode || context.policy?.product_code,
      context,
      factResult,
      coverageCode,
      coverageConfig,
      warnings,
      needsManualReview
    });

    if (autoSettlement) {
      return {
        totalClaimable: autoSettlement.totalClaimable,
        deductible: autoSettlement.deductible,
        reimbursementRatio: autoSettlement.reimbursementRatio,
        finalAmount: autoSettlement.finalAmount,
        capApplied: autoSettlement.coverageResults.some(item => item.sumInsured !== null && item.approvedAmount < item.claimedAmount),
        sumInsured: autoSettlement.sumInsured,
        claimType,
        coverageCode,
        coverageResult: autoSettlement.coverageResults[0] || null,
        coverageResults: autoSettlement.coverageResults,
        settlementDecision: needsManualReview ? 'MANUAL_REVIEW' : (autoSettlement.finalAmount > 0 ? 'PAY' : 'ZERO_PAY'),
        itemBreakdown,
        factAssessment: {
          coverageCode,
          faultRatio: factResult.faultRatio,
          totalApproved,
          itemBreakdown,
          executionDetails: factResult.executionDetails,
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
  }

  const finalAmount = Math.max(0, Math.round(baseAmount * reimbursementRatio * 100) / 100);
  const configuredSumInsured = getSumInsuredAmount(coverageConfig);
  const sumInsured = configuredSumInsured || Infinity;
  const cappedAmount = Math.min(finalAmount, sumInsured);
  const coverageResult = buildCoverageResult({
    coverageCode,
    claimedAmount: reportedClaimable,
    approvedAmount: cappedAmount,
    deductible: state.deductible || 0,
    reimbursementRatio,
    sumInsured: Number.isFinite(sumInsured) ? sumInsured : null,
    status: getCoverageStatus(needsManualReview, cappedAmount),
    warnings
  });

  return {
    totalClaimable: reportedClaimable,
    deductible: state.deductible || 0,
    reimbursementRatio,
    finalAmount: cappedAmount,
    capApplied: finalAmount > sumInsured,
    sumInsured,
    claimType,
    coverageCode,
    coverageResult,
    coverageResults: [coverageResult],
    settlementDecision: needsManualReview ? 'MANUAL_REVIEW' : (cappedAmount > 0 ? 'PAY' : 'ZERO_PAY'),
    itemBreakdown,
    factAssessment: {
      coverageCode,
      faultRatio: factResult.faultRatio,
      totalApproved,
      itemBreakdown,
      executionDetails: factResult.executionDetails,
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
