import { buildContext } from "../../rules/context.js";
import {
  ExecutionDomain,
  sortRulesByPriority,
  filterRulesByDomain,
  executeSingleRule,
} from "../../rules/runtime.js";
import { inferCoverageCode } from "../coverageInference.js";
import { getAutoFaultRatio } from "../auto/engine.js";

function getItemAmount(item) {
  return Number(item?.totalPrice ?? item?.amount ?? 0) || 0;
}

export function evaluateFacts({
  claimCaseId,
  productCode,
  invoiceItems = [],
  ocrData = {},
  validationFacts = null,
  rulesetOverride = null,
}) {
  const startTime = Date.now();
  const context = buildContext({
    claimCaseId,
    productCode,
    ocrData,
    invoiceItems,
    validationFacts,
    rulesetOverride,
  });
  const rules = context.ruleset.rules;
  const assessmentRules = sortRulesByPriority(
    filterRulesByDomain(rules, ExecutionDomain.ASSESSMENT),
  );
  const expenseItems =
    invoiceItems.length > 0
      ? invoiceItems
      : Array.isArray(ocrData.chargeItems) && ocrData.chargeItems.length > 0
        ? ocrData.chargeItems
        : Array.isArray(context.claim?.expense_items) &&
            context.claim.expense_items.length > 0
          ? context.claim.expense_items
          : Number(context.aggregation?.expenseAggregation?.medicalTotal || 0) >
              0
            ? [
                {
                  id: "aggregated-medical-total",
                  itemName: "医疗费用汇总",
                  amount: Number(
                    context.aggregation?.expenseAggregation?.medicalTotal || 0,
                  ),
                  totalPrice: Number(
                    context.aggregation?.expenseAggregation?.medicalTotal || 0,
                  ),
                  source: "aggregation",
                },
              ]
            : [];
  const totalClaimed = expenseItems.reduce(
    (sum, item) => sum + getItemAmount(item),
    0,
  );

  const state = {
    calculatedAmount: totalClaimed,
    payoutRatio: null,
    deductible: 0,
    itemAmounts: {},
    coverageCode: null,
    totalApprovedAmount: 0,
    totalClaimedAmount: totalClaimed,
  };

  // 使用当前 state 推断初始 coverageCode（而非空对象），保证规则执行期间一致性
  state.coverageCode = inferCoverageCode(context, context.ruleset, state);

  const executionResults = [];

  for (const rule of assessmentRules) {
    const result = executeSingleRule(rule, context, state);
    executionResults.push(result);
  }

  // 如果规则执行期间修改了 coverageCode，保留规则设定值；否则重新推断
  const initialCoverageCode = inferCoverageCode(context, context.ruleset, {
    ...state,
    coverageCode: null,
  });
  const finalCoverageCode =
    state.coverageCode !== initialCoverageCode && state.coverageCode != null
      ? state.coverageCode
      : inferCoverageCode(context, context.ruleset, state);
  state.coverageCode = finalCoverageCode;

  return {
    context,
    state,
    coverageCode: finalCoverageCode,
    faultRatio:
      context.ruleset?.product_line === "AUTO"
        ? getAutoFaultRatio(context)
        : null,
    expenseItems,
    totalClaimed,
    assessmentRules,
    executionDetails: executionResults,
    duration: Date.now() - startTime,
  };
}
