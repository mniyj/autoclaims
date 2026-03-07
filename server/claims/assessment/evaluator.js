import { buildContext } from '../../rules/context.js';
import { ExecutionDomain, sortRulesByPriority, filterRulesByDomain, executeSingleRule } from '../../rules/runtime.js';

function inferCoverageCode(context, state) {
  if (state.coverageCode) {
    return state.coverageCode;
  }

  if (context.claim?.death_confirmed) {
    return 'ACC_DEATH';
  }

  if (context.claim?.disability_grade !== null && context.claim?.disability_grade !== undefined) {
    return 'ACC_DISABILITY';
  }

  if ((context.claim?.hospital_days || 0) > 0 && (context.claim?.expense_items || []).length === 0) {
    return 'ACC_HOSPITAL_ALLOWANCE';
  }

  return 'ACC_MEDICAL';
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
    coverageCode: inferCoverageCode(context, {}),
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
    coverageCode: inferCoverageCode(context, state),
    expenseItems,
    totalClaimed,
    totalApproved,
    itemBreakdown,
    executionDetails: executionResults,
    duration: Date.now() - startTime
  };
}
