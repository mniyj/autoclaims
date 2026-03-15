import { buildContext } from '../../rules/context.js';
import { ExecutionDomain, sortRulesByPriority, filterRulesByDomain, executeSingleRule } from '../../rules/runtime.js';
import { inferAccidentCoverageCode } from '../accident/engine.js';
import { inferMedicalCoverageCode } from '../medical/engine.js';
import { inferAutoCoverageCode, getAutoFaultRatio } from '../auto/engine.js';

function inferCoverageCodeByClaimType(context, state = {}) {
  const claimType = context.ruleset?.product_line || context.policy?.insuranceType;
  if (claimType === 'AUTO') {
    return inferAutoCoverageCode(context, state);
  }
  if (claimType === 'HEALTH') {
    return inferMedicalCoverageCode(context, state);
  }
  return inferAccidentCoverageCode(context, state);
}

function getItemAmount(item) {
  return Number(item?.totalPrice ?? item?.amount ?? 0) || 0;
}

export function evaluateFacts({ claimCaseId, productCode, invoiceItems = [], ocrData = {}, validationFacts = null, rulesetOverride = null }) {
  const startTime = Date.now();
  const context = buildContext({ claimCaseId, productCode, ocrData, invoiceItems, validationFacts, rulesetOverride });
  const rules = context.ruleset.rules;
  const assessmentRules = sortRulesByPriority(filterRulesByDomain(rules, ExecutionDomain.ASSESSMENT));
  const expenseItems =
    invoiceItems.length > 0
      ? invoiceItems
      : Array.isArray(ocrData.chargeItems) && ocrData.chargeItems.length > 0
        ? ocrData.chargeItems
        : Number(context.aggregation?.expenseAggregation?.medicalTotal || 0) > 0
          ? [
              {
                id: 'aggregated-medical-total',
                itemName: '医疗费用汇总',
                amount: Number(context.aggregation?.expenseAggregation?.medicalTotal || 0),
                totalPrice: Number(context.aggregation?.expenseAggregation?.medicalTotal || 0),
                source: 'aggregation',
              },
            ]
          : [];
  const totalClaimed = expenseItems.reduce((sum, item) => sum + getItemAmount(item), 0);

  const state = {
    calculatedAmount: totalClaimed,
    payoutRatio: null,
    deductible: 0,
    itemAmounts: {},
    coverageCode: inferCoverageCodeByClaimType(context, {}),
    totalApprovedAmount: 0,
    totalClaimedAmount: totalClaimed
  };

  const executionResults = [];

  for (const rule of assessmentRules) {
    const result = executeSingleRule(rule, context, state);
    executionResults.push(result);
  }

  return {
    context,
    state,
    coverageCode: inferCoverageCodeByClaimType(context, state),
    faultRatio: context.ruleset?.product_line === 'AUTO' ? getAutoFaultRatio(context) : null,
    expenseItems,
    totalClaimed,
    assessmentRules,
    executionDetails: executionResults,
    duration: Date.now() - startTime
  };
}
