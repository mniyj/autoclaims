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

export function evaluateFacts({ claimCaseId, productCode, invoiceItems = [], ocrData = {} }) {
  const startTime = Date.now();
  const context = buildContext({ claimCaseId, productCode, ocrData, invoiceItems });
  const rules = context.ruleset.rules;
  const assessmentRules = sortRulesByPriority(filterRulesByDomain(rules, ExecutionDomain.ASSESSMENT));
  const expenseItems = invoiceItems.length > 0 ? invoiceItems : (ocrData.chargeItems || []);
  const totalClaimed = expenseItems.reduce((sum, item) => sum + (item.totalPrice || item.amount || 0), 0);

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
  const itemBreakdown = [];

  for (const rule of assessmentRules) {
    const result = executeSingleRule(rule, context, state);
    executionResults.push(result);

    if (!result.item_results || result.item_results.length === 0) {
      continue;
    }

    for (const itemResult of result.item_results) {
      const item = itemResult.item;
      const itemName = item.itemName || item.name || `项目${itemResult.itemIndex + 1}`;
      const originalAmount = item.totalPrice || item.amount || 0;

      let approvedAmount = originalAmount;
      let reason = '通过';

      if (!itemResult.conditionMet) {
        approvedAmount = 0;
        reason = '不符合赔付条件';
      } else if (itemResult.actionResult?.data?.reduction_ratio) {
        const reduction = itemResult.actionResult.data.reduction_ratio;
        approvedAmount = originalAmount * (1 - reduction);
        reason = `调减 ${reduction * 100}%`;
      } else if (itemResult.actionResult?.data?.item_ratio) {
        const ratio = itemResult.actionResult.data.item_ratio;
        approvedAmount = originalAmount * ratio;
        reason = `按 ${ratio * 100}% 赔付`;
      }

      const existingIndex = itemBreakdown.findIndex(entry => entry.item === itemName);
      if (existingIndex >= 0) {
        itemBreakdown[existingIndex].approved = approvedAmount;
        itemBreakdown[existingIndex].reason = reason;
      } else {
        itemBreakdown.push({
          item: itemName,
          claimed: originalAmount,
          approved: approvedAmount,
          reason
        });
      }
    }
  }

  if (itemBreakdown.length === 0 && expenseItems.length > 0) {
    for (const item of expenseItems) {
      const itemName = item.itemName || item.name || '费用项目';
      const originalAmount = item.totalPrice || item.amount || 0;
      itemBreakdown.push({
        item: itemName,
        claimed: originalAmount,
        approved: originalAmount,
        reason: '通过'
      });
    }
  }

  const totalApproved = itemBreakdown.reduce((sum, item) => sum + item.approved, 0);
  state.totalApprovedAmount = totalApproved;
  state.calculatedAmount = totalApproved;

  return {
    context,
    state,
    coverageCode: inferCoverageCodeByClaimType(context, state),
    faultRatio: context.ruleset?.product_line === 'AUTO' ? getAutoFaultRatio(context) : null,
    expenseItems,
    totalClaimed,
    totalApproved,
    itemBreakdown,
    executionDetails: executionResults,
    duration: Date.now() - startTime
  };
}
