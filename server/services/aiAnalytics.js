import { aggregateAICosts } from "./aiCostAggregator.js";
import { getAIAlerts, detectIncidents } from "./aiAlertService.js";
import { getBindingHistory } from "./aiBindingVersionService.js";
import { evaluateBudgetUsage } from "./aiBudgetService.js";
import { getProviderHealthSummary } from "./aiHealthMonitor.js";
import { queryLogs } from "./aiInteractionLogger.js";
import { getCachedAIStats } from "./aiStatsCache.js";

const DASHBOARD_TTL_MS = 30 * 1000;
const ANALYTICS_TTL_MS = 60 * 1000;

function topBy(logs, key) {
  const buckets = new Map();
  for (const log of logs) {
    const bucketKey = key(log);
    if (!bucketKey) continue;
    const bucket = buckets.get(bucketKey) || { key: bucketKey, calls: 0, cost: 0, latency: 0 };
    bucket.calls += 1;
    bucket.cost += log.tokenUsage?.estimatedCost || 0;
    bucket.latency += log.performance?.durationMs || 0;
    buckets.set(bucketKey, bucket);
  }
  return Array.from(buckets.values())
    .map((item) => ({
      ...item,
      avgLatencyMs: item.calls > 0 ? Math.round(item.latency / item.calls) : 0,
      cost: Number(item.cost.toFixed(6)),
    }))
    .sort((a, b) => b.cost - a.cost);
}

export function getAIDashboardOverview({ startTime, endTime } = {}) {
  return getCachedAIStats(["dashboard", startTime || null, endTime || null], DASHBOARD_TTL_MS, () => {
    const { logs } = queryLogs({ view: "summary", limit: 100000, offset: 0, startTime, endTime });
    const incidents = detectIncidents().incidents.filter((item) => item.status !== "resolved");
    const totalCalls = logs.length;
    const successCalls = logs.filter((item) => item.success).length;
    const totalCost = logs.reduce((sum, item) => sum + (item.tokenUsage?.estimatedCost || 0), 0);
    const activeModels = new Set(logs.map((item) => `${item.provider}:${item.model}`)).size;
    const topCapabilities = topBy(logs, (log) => log.capabilityId || log.context?.capabilityId).slice(0, 5).map((item) => ({
      id: item.key,
      name: item.key,
      calls: item.calls,
      cost: item.cost,
    }));
    const topModels = topBy(logs, (log) => `${log.provider}:${log.model}`).slice(0, 5).map((item) => ({
      model: item.key,
      calls: item.calls,
      cost: item.cost,
      avgLatencyMs: item.avgLatencyMs,
    }));
    const topModules = topBy(logs, (log) => log.module).slice(0, 5).map((item) => ({
      module: item.key,
      calls: item.calls,
      cost: item.cost,
    }));
    const topCompanies = topBy(logs, (log) => log.context?.companyId || log.context?.companyName).slice(0, 5).map((item) => ({
      companyId: item.key,
      companyName: item.key,
      calls: item.calls,
      cost: item.cost,
    }));
    const daily = aggregateAICosts({ groupBy: "day", startTime, endTime }).reverse();

    return {
      period: { start: startTime || null, end: endTime || null },
      totalCalls,
      successRate: totalCalls > 0 ? Number((successCalls / totalCalls).toFixed(4)) : 0,
      totalCost: Number(totalCost.toFixed(6)),
      activeModels,
      topCapabilities,
      topModels,
      topModules,
      topCompanies,
      recentConfigChanges: getBindingHistory().slice(-5).reverse().map((item) => ({
        capabilityId: item.capabilityId,
        changedAt: item.publishedAt,
        changedBy: item.publishedBy,
      })),
      openIncidents: incidents,
      budgetUsage: evaluateBudgetUsage(),
      providerHealth: getProviderHealthSummary(),
      trends: {
        calls: daily.map((item) => ({ date: item.date, count: item.totalCalls })),
        costs: daily.map((item) => ({ date: item.date, amount: item.totalCost })),
        errorRate: daily.map((item) => ({
          date: item.date,
          rate: item.totalCalls > 0 ? Number((item.failedCalls / item.totalCalls).toFixed(4)) : 0,
        })),
      },
    };
  });
}

export function getAIModelRuntimeComparison({ capabilityId, startTime, endTime } = {}) {
  return getCachedAIStats(["model-comparison", capabilityId || null, startTime || null, endTime || null], ANALYTICS_TTL_MS, () => {
    const { logs } = queryLogs({
      view: "summary",
      limit: 100000,
      offset: 0,
      startTime,
      endTime,
      capabilityId,
    });
    const grouped = new Map();
    for (const log of logs) {
      const key = `${log.provider}:${log.model}`;
      const bucket = grouped.get(key) || {
        provider: log.provider,
        model: log.model,
        totalCalls: 0,
        successCount: 0,
        latency: [],
        totalTokens: 0,
        totalCost: 0,
        fallbackCount: 0,
      };
      bucket.totalCalls += 1;
      bucket.successCount += log.success ? 1 : 0;
      bucket.latency.push(log.performance?.durationMs || 0);
      bucket.totalTokens += log.tokenUsage?.totalTokens || 0;
      bucket.totalCost += log.tokenUsage?.estimatedCost || 0;
      bucket.fallbackCount += log.fallbackInfo ? 1 : 0;
      grouped.set(key, bucket);
    }
    return {
      capabilityId,
      dateRange: { start: startTime || null, end: endTime || null },
      models: Array.from(grouped.values()).map((item) => {
        const sortedLatency = [...item.latency].sort((a, b) => a - b);
        const p95LatencyMs = sortedLatency[Math.max(0, Math.floor(sortedLatency.length * 0.95) - 1)] || 0;
        return {
          provider: item.provider,
          model: item.model,
          totalCalls: item.totalCalls,
          successRate: item.totalCalls > 0 ? Number((item.successCount / item.totalCalls).toFixed(4)) : 0,
          avgLatencyMs: item.totalCalls > 0 ? Math.round(item.latency.reduce((a, b) => a + b, 0) / item.totalCalls) : 0,
          p95LatencyMs,
          avgTokensPerCall: item.totalCalls > 0 ? Math.round(item.totalTokens / item.totalCalls) : 0,
          totalCost: Number(item.totalCost.toFixed(6)),
          costPerCall: item.totalCalls > 0 ? Number((item.totalCost / item.totalCalls).toFixed(6)) : 0,
          fallbackCount: item.fallbackCount,
        };
      }),
    };
  });
}

export function getAICostAnalytics({ groupBy = "day", startTime, endTime } = {}) {
  return getCachedAIStats(["cost-analytics", groupBy, startTime || null, endTime || null], ANALYTICS_TTL_MS, () =>
    aggregateAICosts({ groupBy, startTime, endTime }),
  );
}

export function getAIBusinessStats({ startTime, endTime } = {}) {
  return getCachedAIStats(["business-stats", startTime || null, endTime || null], ANALYTICS_TTL_MS, () => ({
    byModule: aggregateAICosts({ groupBy: "module", startTime, endTime }),
    byCompany: aggregateAICosts({ groupBy: "company", startTime, endTime }),
    alerts: getAIAlerts(),
  }));
}
