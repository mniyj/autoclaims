import {
  ExecutionDomain,
  sortRulesByPriority,
  filterRulesByDomain,
  executeSingleRule,
} from "../../rules/runtime.js";
import { evaluateFacts } from "../assessment/evaluator.js";
import { getCoverageConfig } from "../../rules/context.js";
import { inferCoverageCode } from "../coverageInference.js";
import {
  determineSettlementMode,
  runLossLedger,
  runBenefitLedger,
} from "./ledger.js";

function applyPostProcessRules(postProcessRules, context, state) {
  const executionResults = [];
  for (const rule of postProcessRules) {
    executionResults.push(executeSingleRule(rule, context, state));
  }
  return executionResults;
}

function appendWarning(
  warnings,
  message,
  category = "SYSTEM",
  ruleId = "SYSTEM",
) {
  warnings.push({ rule_id: ruleId, message, category });
}

function appendManualReviewReason(
  reasons,
  {
    code,
    source = "SYSTEM",
    category = "SYSTEM",
    stage = "SETTLEMENT",
    message,
    metadata = undefined,
  },
) {
  reasons.push({
    code,
    source,
    category,
    stage,
    message,
    ...(metadata ? { metadata } : {}),
  });
}

function roundAmount(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function summarizeCoverageResults(results = []) {
  return results.reduce(
    (sum, item) => sum + (Number(item?.approvedAmount) || 0),
    0,
  );
}

function mergeCoverageResults(...groups) {
  return groups.flat().filter(Boolean);
}

function hasDualOutpatientCoverage(context) {
  const coverageCodes = new Set(
    (context?.policy?.coverages || []).map((item) => item?.coverage_code),
  );
  return (
    coverageCodes.has("HLT_OPD_SOCIAL") &&
    coverageCodes.has("HLT_OPD_NON_SOCIAL")
  );
}

function getCoverageLimitAmount(coverageConfig) {
  const sumInsured = coverageConfig?.sum_insured;
  if (typeof sumInsured === "number") return sumInsured;
  if (
    sumInsured &&
    typeof sumInsured === "object" &&
    typeof sumInsured.amount === "number"
  ) {
    return sumInsured.amount;
  }
  return Number(coverageConfig?.limit || 0) || 0;
}

function getCoverageRatio(coverageConfig, fallbackRatio = 1) {
  const ruleRatio = Number(coverageConfig?.reimbursement_rules?.base_ratio);
  if (Number.isFinite(ruleRatio)) {
    return ruleRatio;
  }
  const explicitRatio = Number(coverageConfig?.reimbursement_ratio);
  if (
    Number.isFinite(explicitRatio) &&
    explicitRatio > 0 &&
    explicitRatio <= 1
  ) {
    return explicitRatio;
  }
  if (Number.isFinite(explicitRatio) && explicitRatio > 1) {
    return explicitRatio / 100;
  }
  return fallbackRatio;
}

function applyDualOutpatientCoverageSettlement({
  context,
  productCode,
  adjustedLossSettlement,
  needsManualReview,
  warnings,
}) {
  const socialConfig = getCoverageConfig(
    productCode || context.policy?.product_code,
    "HLT_OPD_SOCIAL",
  );
  const nonSocialConfig = getCoverageConfig(
    productCode || context.policy?.product_code,
    "HLT_OPD_NON_SOCIAL",
  );
  if (!socialConfig || !nonSocialConfig) {
    return null;
  }

  const socialClaimed = roundAmount(
    Number(context?.claim?.social_medical_amount || 0),
  );
  const nonSocialClaimed = roundAmount(
    Number(context?.claim?.non_social_medical_amount || 0),
  );
  const otherReimbursement = roundAmount(
    Number(context?.claim?.other_reimbursement_received || 0),
  );
  const totalClaimed = roundAmount(socialClaimed + nonSocialClaimed);
  const socialShare = totalClaimed > 0 ? socialClaimed / totalClaimed : 0;
  const socialOtherDeduction = roundAmount(otherReimbursement * socialShare);
  const nonSocialOtherDeduction = roundAmount(
    otherReimbursement - socialOtherDeduction,
  );
  const defaultRatio = Number.isFinite(
    Number(adjustedLossSettlement?.reimbursementRatio),
  )
    ? Number(adjustedLossSettlement.reimbursementRatio)
    : 1;

  const buildCoverage = (
    coverageCode,
    claimedAmount,
    coverageConfig,
    allocatedDeduction,
  ) => {
    const preDeductedAmount = Math.max(
      0,
      roundAmount(claimedAmount - allocatedDeduction),
    );
    const deductible = Number(coverageConfig?.deductible || 0);
    const afterDeductible = Math.max(
      0,
      roundAmount(preDeductedAmount - deductible),
    );
    const ratio = getCoverageRatio(coverageConfig, defaultRatio);
    const afterRatio = roundAmount(afterDeductible * ratio);
    const sumInsured = getCoverageLimitAmount(coverageConfig) || Infinity;
    const approvedAmount = Math.min(afterRatio, sumInsured);
    return {
      coverageCode,
      claimedAmount,
      approvedAmount,
      deductible,
      reimbursementRatio: ratio,
      sumInsured,
      status: needsManualReview
        ? "MANUAL_REVIEW"
        : approvedAmount > 0
          ? "PAYABLE"
          : "ZERO_PAY",
      warnings,
    };
  };

  const coverageResults = [
    buildCoverage(
      "HLT_OPD_SOCIAL",
      socialClaimed,
      socialConfig,
      socialOtherDeduction,
    ),
    buildCoverage(
      "HLT_OPD_NON_SOCIAL",
      nonSocialClaimed,
      nonSocialConfig,
      nonSocialOtherDeduction,
    ),
  ];

  return {
    coverageResults,
    totalPayableAmount: roundAmount(
      coverageResults.reduce((sum, item) => sum + item.approvedAmount, 0),
    ),
  };
}

function rebalanceLossSettlement(lossSettlement, targetAmount) {
  const currentAmount = roundAmount(lossSettlement?.lossPayableAmount || 0);
  const normalizedTarget = roundAmount(targetAmount);
  if (!Number.isFinite(normalizedTarget) || normalizedTarget < 0) {
    return lossSettlement;
  }
  if (currentAmount === normalizedTarget) {
    return lossSettlement;
  }

  // 当前金额为0时无法按比例缩放，直接返回原始结果
  if (currentAmount === 0) {
    return lossSettlement;
  }

  const ledger = Array.isArray(lossSettlement?.lossLedger)
    ? lossSettlement.lossLedger
    : [];
  const factor = normalizedTarget / currentAmount;

  const scaledLedger = ledger.map((item) => {
    const scaledAmount = roundAmount(
      (Number(item?.payableAmount) || 0) * factor,
    );
    return {
      ...item,
      payableAmount: scaledAmount,
      status: scaledAmount > 0 ? item.status : "ZERO_PAY",
    };
  });

  const scaledCoverageResults = (lossSettlement?.coverageResults || []).map(
    (item) => ({
      ...item,
      approvedAmount: normalizedTarget,
      status: normalizedTarget > 0 ? item.status : "ZERO_PAY",
    }),
  );

  const scaledBreakdown = scaledLedger.map((item) => ({
    item: item.itemName,
    claimed: item.claimedAmount,
    approved: item.payableAmount,
    reason:
      item.entries?.[item.entries.length - 1]?.message ||
      (item.status === "PAYABLE" ? "通过" : "需人工复核"),
  }));

  return {
    ...lossSettlement,
    lossLedger: scaledLedger,
    coverageResults: scaledCoverageResults,
    lossPayableAmount: normalizedTarget,
    legacyItemBreakdown: scaledBreakdown,
  };
}

function deriveLegacyCoverageResult(coverageResults) {
  return coverageResults.length > 0 ? coverageResults[0] : null;
}

function deriveReimbursementRatio(mode, lossSettlement, benefitSettlement) {
  if (mode === "BENEFIT") return benefitSettlement?.reimbursementRatio ?? 1;
  if (mode === "LOSS") return lossSettlement?.reimbursementRatio ?? 1;
  return (
    lossSettlement?.reimbursementRatio ??
    benefitSettlement?.reimbursementRatio ??
    1
  );
}

export function calculateSettlement({
  claimCaseId,
  productCode,
  eligibilityResult,
  invoiceItems = [],
  ocrData = {},
  validationFacts = null,
  rulesetOverride = null,
}) {
  const startTime = Date.now();

  if (
    eligibilityResult &&
    !eligibilityResult.eligible &&
    !eligibilityResult.needsManualReview
  ) {
    return {
      totalClaimable: 0,
      deductible: 0,
      reimbursementRatio: 0,
      finalAmount: 0,
      claimType: eligibilityResult.context?.product_line || "UNKNOWN",
      coverageCode: null,
      coverageResult: null,
      coverageResults: [],
      settlementDecision: "ZERO_PAY",
      settlementMode: "LOSS",
      lossLedger: [],
      benefitLedger: [],
      settlementBreakdown: {
        lossPayableAmount: 0,
        benefitPayableAmount: 0,
        totalPayableAmount: 0,
      },
      itemBreakdown: [],
      warnings: [],
      needsManualReview: false,
      reason: "责任判断未通过",
      rejectionReasons: eligibilityResult.rejectionReasons,
      duration: Date.now() - startTime,
    };
  }

  const factResult = evaluateFacts({
    claimCaseId,
    productCode,
    invoiceItems,
    ocrData,
    validationFacts,
    rulesetOverride,
  });
  const { context, state, coverageCode } = factResult;
  const rules = context.ruleset.rules;
  const postProcessRules = sortRulesByPriority(
    filterRulesByDomain(rules, ExecutionDomain.POST_PROCESS),
  );
  const executionResults = [...(factResult.executionDetails || [])];
  const warnings = [];
  const manualReviewReasons = [
    ...(eligibilityResult?.manualReviewReasons || []),
  ];
  let needsManualReview = Boolean(eligibilityResult?.needsManualReview);
  executionResults.push(
    ...applyPostProcessRules(postProcessRules, context, state),
  );

  const claimType =
    context.ruleset?.product_line || context.policy?.insuranceType || "UNKNOWN";
  const coverageConfig = getCoverageConfig(
    productCode || context.policy?.product_code,
    coverageCode,
    rulesetOverride,
  );
  if (!coverageConfig) {
    needsManualReview = true;
    const message = `未找到责任 ${coverageCode} 对应的保障配置，需人工复核产品责任映射`;
    appendWarning(warnings, message, "COVERAGE_CONFIG");
    appendManualReviewReason(manualReviewReasons, {
      code: "COVERAGE_CONFIG_MISSING",
      source: coverageCode || "UNKNOWN_COVERAGE",
      category: "COVERAGE_CONFIG",
      message,
      metadata: { coverageCode },
    });
  }

  const settlementMode = determineSettlementMode({
    claimType,
    coverageCode,
    expenseItems: factResult.expenseItems,
    context,
  });

  const baseLedgerParams = {
    productCode: productCode || context.policy?.product_code,
    context,
    factResult,
    coverageCode,
    coverageConfig,
    claimType,
    warnings,
    needsManualReview,
  };

  const lossSettlement =
    settlementMode === "BENEFIT"
      ? {
          lossLedger: [],
          coverageResults: [],
          lossPayableAmount: 0,
          deductible: 0,
          reimbursementRatio: 1,
          totalClaimable: 0,
          legacyItemBreakdown: [],
          capApplied: false,
        }
      : runLossLedger(baseLedgerParams);

  const postProcessBaseAmount = Number.isFinite(Number(state.calculatedAmount))
    ? Number(state.calculatedAmount)
    : null;
  const postProcessRatio = Number.isFinite(Number(state.payoutRatio))
    ? Number(state.payoutRatio)
    : null;
  const postProcessTargetAmount =
    postProcessBaseAmount === null
      ? null
      : roundAmount(postProcessBaseAmount * (postProcessRatio ?? 1));
  // LIABILITY 类型有自己的分类帐计算逻辑，不应被 post-process 规则缩放覆盖
  const adjustedLossSettlement =
    settlementMode === "BENEFIT" ||
    postProcessTargetAmount === null ||
    claimType === "LIABILITY"
      ? lossSettlement
      : rebalanceLossSettlement(lossSettlement, postProcessTargetAmount);

  const benefitSettlement =
    settlementMode === "LOSS"
      ? {
          benefitLedger: [],
          coverageResults: [],
          benefitPayableAmount: 0,
          totalClaimable: 0,
          reimbursementRatio: 1,
        }
      : runBenefitLedger({
          context,
          coverageCode,
          coverageConfig,
          claimType,
          eligibilityResult,
          warnings,
          needsManualReview,
        });

  const settlementManualReviewReasons = [
    ...(adjustedLossSettlement.manualReviewReasons || []),
    ...(benefitSettlement.manualReviewReasons || []),
  ];
  if (settlementManualReviewReasons.length > 0) {
    manualReviewReasons.push(...settlementManualReviewReasons);
    needsManualReview = true;
  }

  const dualOutpatientSettlement =
    claimType === "HEALTH" && hasDualOutpatientCoverage(context)
      ? applyDualOutpatientCoverageSettlement({
          context,
          productCode: productCode || context.policy?.product_code,
          adjustedLossSettlement,
          needsManualReview,
          warnings,
        })
      : null;

  let coverageResults = mergeCoverageResults(
    adjustedLossSettlement.coverageResults,
    benefitSettlement.coverageResults,
  );
  let lossPayableAmount = roundAmount(
    adjustedLossSettlement.lossPayableAmount || 0,
  );
  if (dualOutpatientSettlement) {
    coverageResults = mergeCoverageResults(
      dualOutpatientSettlement.coverageResults,
      benefitSettlement.coverageResults,
    );
    lossPayableAmount = dualOutpatientSettlement.totalPayableAmount;
  }
  const benefitPayableAmount = roundAmount(
    benefitSettlement.benefitPayableAmount || 0,
  );
  let finalAmount = roundAmount(lossPayableAmount + benefitPayableAmount);
  const totalClaimable = roundAmount(
    (adjustedLossSettlement.totalClaimable || 0) +
      (benefitSettlement.totalClaimable || 0),
  );
  const itemBreakdown = adjustedLossSettlement.legacyItemBreakdown || [];
  const coverageResult = deriveLegacyCoverageResult(coverageResults);

  const policyBinding = {
    policyNumber:
      context.claim?.bound_policy_number ||
      context.policy?.bound_policy_number ||
      context.policy?.policy_no ||
      null,
    insuredMatched: context.claim?.bound_policy_insured_match ?? null,
    insuredName:
      context.claim?.bound_policy_insured_name ||
      context.claim?.insured ||
      null,
    productCode: context.policy?.product_code || null,
    rulesetId: context.ruleset?.ruleset_id || null,
    productSource: context.policy?.product_source || "CLAIM_CASE",
  };

  if (policyBinding.insuredMatched === false) {
    finalAmount = 0;
    coverageResults = coverageResults.map((item) => ({
      ...item,
      approvedAmount: 0,
      status: "MANUAL_REVIEW",
    }));
    lossPayableAmount = 0;
  }

  return {
    totalClaimable,
    deductible: roundAmount(adjustedLossSettlement.deductible || 0),
    reimbursementRatio: deriveReimbursementRatio(
      settlementMode,
      lossSettlement,
      benefitSettlement,
    ),
    finalAmount,
    capApplied: Boolean(
      adjustedLossSettlement.capApplied ||
      coverageResults.some(
        (item) =>
          item.sumInsured !== null &&
          Number.isFinite(item.sumInsured) &&
          item.sumInsured > 0 &&
          roundAmount(item.approvedAmount) >= roundAmount(item.sumInsured),
      ),
    ),
    sumInsured: coverageResult?.sumInsured ?? null,
    claimType,
    coverageCode,
    coverageResult,
    coverageResults,
    settlementMode,
    lossLedger: adjustedLossSettlement.lossLedger || [],
    benefitLedger: benefitSettlement.benefitLedger || [],
    settlementBreakdown: {
      lossPayableAmount,
      benefitPayableAmount,
      totalPayableAmount: finalAmount,
    },
    settlementDecision: needsManualReview
      ? "MANUAL_REVIEW"
      : finalAmount > 0
        ? "PAY"
        : "ZERO_PAY",
    itemBreakdown,
    factAssessment: {
      coverageCode,
      faultRatio: factResult.faultRatio,
      totalApproved: summarizeCoverageResults(coverageResults),
      itemBreakdown,
      executionDetails: factResult.executionDetails,
      lossLedger: adjustedLossSettlement.lossLedger || [],
      benefitLedger: benefitSettlement.benefitLedger || [],
      medicalReview: adjustedLossSettlement.medicalReview || null,
      policyBinding,
      duration: factResult.duration,
    },
    warnings,
    manualReviewReasons,
    needsManualReview,
    policyBinding,
    executionDetails: executionResults,
    context: {
      claim_id: claimCaseId,
      product_code: context.policy?.product_code,
      coverage_code: coverageCode,
      claim_type: claimType,
    },
    duration: Date.now() - startTime,
  };
}
