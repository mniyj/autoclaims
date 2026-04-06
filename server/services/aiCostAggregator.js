import { aggregateFromDailyStats } from "./aiStatsDailyService.js";

function toDay(value) {
  return String(value || "").slice(0, 10);
}

function createBucket(log, groupBy) {
  const context = log.context || {};
  return {
    date: toDay(log.timestamp),
    provider: log.provider || null,
    model: log.model || null,
    capabilityId: log.capabilityId || context.capabilityId || null,
    group: context.group || null,
    module: log.module || null,
    companyId: context.companyId || null,
    companyName: context.companyName || null,
    totalCalls: 0,
    successCalls: 0,
    failedCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    totalLatencyMs: 0,
    avgLatencyMs: 0,
    _groupBy: groupBy,
  };
}

function getGroupKey(log, groupBy) {
  const context = log.context || {};
  const map = {
    day: toDay(log.timestamp),
    provider: log.provider || "unknown",
    model: log.model || "unknown",
    capability: log.capabilityId || context.capabilityId || "unknown",
    group: context.group || "unknown",
    module: log.module || "unknown",
    company: context.companyId || context.companyName || "unassigned",
    sourceApp: log.sourceApp || "unknown",
  };
  return map[groupBy] || map.day;
}

export function aggregateAICosts({ groupBy = "day", startTime, endTime } = {}) {
  return aggregateFromDailyStats({ groupBy, startTime, endTime });
}
