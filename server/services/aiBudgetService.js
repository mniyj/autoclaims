import { readData, writeData } from "../utils/fileStore.js";
import { aggregateAICosts } from "./aiCostAggregator.js";
import { clearAIStatsCache } from "./aiStatsCache.js";

const RESOURCE = "ai-budgets";

export function getBudgets() {
  return readData(RESOURCE) || [];
}

export function updateBudgets(items) {
  writeData(RESOURCE, Array.isArray(items) ? items : []);
  clearAIStatsCache();
  return getBudgets();
}

function buildScopeFilter(budget) {
  const scopeType = budget.scopeType;
  const scopeId = budget.scopeId;
  if (!scopeType || scopeType === "GLOBAL") {
    return { groupBy: "day", match: () => true };
  }
  if (scopeType === "MODULE") {
    return { groupBy: "module", match: (row) => row.module === scopeId };
  }
  if (scopeType === "COMPANY") {
    return {
      groupBy: "company",
      match: (row) => row.companyId === scopeId || row.companyName === scopeId,
    };
  }
  if (scopeType === "CAPABILITY") {
    return { groupBy: "capability", match: (row) => row.capabilityId === scopeId };
  }
  if (scopeType === "GROUP") {
    return { groupBy: "group", match: (row) => row.group === scopeId };
  }
  if (scopeType === "PROVIDER") {
    return { groupBy: "provider", match: (row) => row.provider === scopeId };
  }
  if (scopeType === "MODEL") {
    return { groupBy: "model", match: (row) => row.model === scopeId };
  }
  return { groupBy: "day", match: () => true };
}

export function evaluateBudgetUsage({ startTime, endTime } = {}) {
  return getBudgets()
    .filter((budget) => budget.status !== "paused")
    .map((budget) => {
      const { groupBy, match } = buildScopeFilter(budget);
      const rows = aggregateAICosts({ groupBy, startTime, endTime });
      const matchedRows = rows.filter(match);
      const actualAmount = matchedRows.reduce((sum, row) => sum + (row.totalCost || 0), 0);
      const ratio = budget.budgetAmount > 0 ? actualAmount / budget.budgetAmount : 0;
      const triggeredThresholds = (budget.alertThresholds || []).filter((value) => ratio >= value);
      return {
        ...budget,
        actualAmount: Number(actualAmount.toFixed(6)),
        ratio: Number(ratio.toFixed(4)),
        triggeredThresholds,
        matchedRows,
      };
    });
}
