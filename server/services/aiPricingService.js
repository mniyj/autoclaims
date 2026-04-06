import { readAIStorage, writeAIStorage } from "./aiStorageService.js";
import { clearAIStatsCache } from "./aiStatsCache.js";

const RESOURCE = "ai-pricing-rules";

function normalizeRule(rule) {
  return {
    id: rule.id,
    providerId: rule.providerId,
    modelId: rule.modelId,
    billingMode: rule.billingMode || "token",
    currency: rule.currency || "USD",
    inputPer1M: rule.inputPer1M ?? null,
    outputPer1M: rule.outputPer1M ?? null,
    perRequestFee: rule.perRequestFee ?? null,
    ocrPerPage: rule.ocrPerPage ?? null,
    audioPerMinute: rule.audioPerMinute ?? null,
    effectiveDate: rule.effectiveDate || "2026-01-01",
  };
}

export function getPricingRules() {
  return (readAIStorage("pricingRules", []) || []).map(normalizeRule);
}

export function savePricingRules(rules) {
  writeAIStorage("pricingRules", (rules || []).map(normalizeRule));
  clearAIStatsCache();
  return getPricingRules();
}

export function resolvePricingRule(providerId, modelId) {
  const rules = getPricingRules()
    .filter((rule) => rule.providerId === providerId && rule.modelId === modelId)
    .sort((a, b) => String(b.effectiveDate).localeCompare(String(a.effectiveDate)));
  return rules[0] || null;
}

export function estimateCost({
  providerId,
  modelId,
  inputTokens,
  outputTokens,
  totalTokens,
  ocrPages,
  audioSeconds,
  requestCount = 1,
}) {
  const rule = resolvePricingRule(providerId, modelId);
  if (!rule) {
    return { pricingRuleId: null, estimatedCost: 0, currency: "USD" };
  }

  let estimatedCost = 0;
  if (rule.billingMode === "token") {
    estimatedCost += ((inputTokens || 0) / 1000000) * (rule.inputPer1M || 0);
    estimatedCost += ((outputTokens || 0) / 1000000) * (rule.outputPer1M || 0);
    if (!inputTokens && !outputTokens && totalTokens && rule.inputPer1M != null) {
      estimatedCost += (totalTokens / 1000000) * rule.inputPer1M;
    }
  } else if (rule.billingMode === "page") {
    estimatedCost += (ocrPages || requestCount || 0) * (rule.ocrPerPage || 0);
  } else if (rule.billingMode === "second") {
    estimatedCost += ((audioSeconds || 0) / 60) * (rule.audioPerMinute || 0);
  } else if (rule.billingMode === "request") {
    estimatedCost += (requestCount || 1) * (rule.perRequestFee || 0);
  }

  return {
    pricingRuleId: rule.id,
    estimatedCost: Number(estimatedCost.toFixed(6)),
    currency: rule.currency,
  };
}
