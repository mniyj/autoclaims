import { readAIStorage, writeAIStorage } from "./aiStorageService.js";
import { queryLogs } from "./aiInteractionLogger.js";

const RESOURCE = "ai-stats-daily";
const META_RESOURCE = "ai-stats-daily-meta";

function toDay(value) {
  return String(value || "").slice(0, 10);
}

function createMetric(seed = {}) {
  return {
    ...seed,
    totalCalls: 0,
    successCalls: 0,
    failedCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    totalLatencyMs: 0,
  };
}

function createDayBucket(date) {
  return {
    date,
    totals: createMetric(),
    byProvider: {},
    byModel: {},
    byCapability: {},
    byGroup: {},
    byModule: {},
    byCompany: {},
    bySourceApp: {},
  };
}

function loadStats() {
  const items = readAIStorage("statsDaily", []) || [];
  return Array.isArray(items) ? items : [];
}

function saveStats(items) {
  writeAIStorage("statsDaily", items);
}

function loadMeta() {
  const meta = readAIStorage("statsDailyMeta", {});
  return meta && !Array.isArray(meta) ? meta : {};
}

function saveMeta(meta) {
  writeAIStorage("statsDailyMeta", meta);
}

function ensureMetric(container, key, seed = {}) {
  if (!key) return null;
  if (!container[key]) {
    container[key] = createMetric(seed);
  }
  return container[key];
}

function applyMetric(metric, log, delta) {
  if (!metric || !log) return;
  metric.totalCalls += 1 * delta;
  metric.successCalls += (log.success ? 1 : 0) * delta;
  metric.failedCalls += (log.success === false ? 1 : 0) * delta;
  metric.inputTokens += (log.tokenUsage?.inputTokens || 0) * delta;
  metric.outputTokens += (log.tokenUsage?.outputTokens || 0) * delta;
  metric.totalTokens += (log.tokenUsage?.totalTokens || 0) * delta;
  metric.totalCost += (log.tokenUsage?.estimatedCost || 0) * delta;
  metric.totalLatencyMs += (log.performance?.durationMs || 0) * delta;
}

function cleanupMetricMap(container) {
  for (const [key, value] of Object.entries(container)) {
    if ((value.totalCalls || 0) <= 0) {
      delete container[key];
    }
  }
}

function isFinalizedLog(log) {
  return Boolean(log && log.timestamp && log.success !== null && log.success !== undefined);
}

function upsertDayBucket(stats, date) {
  let bucket = stats.find((item) => item.date === date);
  if (!bucket) {
    bucket = createDayBucket(date);
    stats.push(bucket);
  }
  return bucket;
}

function applyLogToBucket(bucket, log, delta) {
  const context = log.context || {};
  applyMetric(bucket.totals, log, delta);
  applyMetric(ensureMetric(bucket.byProvider, log.provider || "unknown", { provider: log.provider || "unknown" }), log, delta);
  applyMetric(ensureMetric(bucket.byModel, log.model || "unknown", { model: log.model || "unknown", provider: log.provider || null }), log, delta);
  applyMetric(ensureMetric(bucket.byCapability, log.capabilityId || context.capabilityId || "unknown", { capabilityId: log.capabilityId || context.capabilityId || "unknown" }), log, delta);
  applyMetric(ensureMetric(bucket.byGroup, context.group || "unknown", { group: context.group || "unknown" }), log, delta);
  applyMetric(ensureMetric(bucket.byModule, log.module || "unknown", { module: log.module || "unknown" }), log, delta);
  applyMetric(
    ensureMetric(bucket.byCompany, context.companyId || context.companyName || "unassigned", {
      companyId: context.companyId || null,
      companyName: context.companyName || null,
    }),
    log,
    delta,
  );
  applyMetric(ensureMetric(bucket.bySourceApp, log.sourceApp || "unknown", { sourceApp: log.sourceApp || "unknown" }), log, delta);
}

function normalizeStats(stats) {
  return stats
    .filter((item) => (item.totals?.totalCalls || 0) > 0)
    .map((item) => {
      cleanupMetricMap(item.byProvider || {});
      cleanupMetricMap(item.byModel || {});
      cleanupMetricMap(item.byCapability || {});
      cleanupMetricMap(item.byGroup || {});
      cleanupMetricMap(item.byModule || {});
      cleanupMetricMap(item.byCompany || {});
      cleanupMetricMap(item.bySourceApp || {});
      return item;
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function summarizeAIStatsDaily(stats = []) {
  const normalized = Array.isArray(stats) ? stats : [];
  return normalized.reduce(
    (summary, item) => {
      summary.days += 1;
      summary.totalCalls += item.totals?.totalCalls || 0;
      summary.successCalls += item.totals?.successCalls || 0;
      summary.failedCalls += item.totals?.failedCalls || 0;
      summary.totalCost = Number((summary.totalCost + (item.totals?.totalCost || 0)).toFixed(6));
      summary.dateRange.start =
        !summary.dateRange.start || item.date < summary.dateRange.start ? item.date : summary.dateRange.start;
      summary.dateRange.end =
        !summary.dateRange.end || item.date > summary.dateRange.end ? item.date : summary.dateRange.end;
      return summary;
    },
    {
      days: 0,
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      totalCost: 0,
      dateRange: {
        start: null,
        end: null,
      },
    },
  );
}

export function getAIStatsDailyStatus() {
  const stats = loadStats();
  const summary = summarizeAIStatsDaily(stats);
  const meta = loadMeta();
  const latestLog = queryLogs({
    view: "summary",
    limit: 1,
    offset: 0,
  }).logs?.[0] || null;
  const latestLogTimestamp = latestLog?.timestamp || null;
  const lastUpdatedAt = meta.lastUpdatedAt || null;
  const freshnessLagMs =
    latestLogTimestamp && lastUpdatedAt
      ? Math.max(0, new Date(latestLogTimestamp).getTime() - new Date(lastUpdatedAt).getTime())
      : null;
  const freshnessStatus =
    freshnessLagMs == null
      ? "unknown"
      : freshnessLagMs <= 60 * 1000
        ? "fresh"
        : freshnessLagMs <= 10 * 60 * 1000
          ? "lagging"
          : "stale";
  return {
    source: "daily_snapshot",
    resource: RESOURCE,
    metaResource: META_RESOURCE,
    bucketCount: stats.length,
    lastRebuiltAt: meta.lastRebuiltAt || null,
    lastUpdatedAt,
    latestLogTimestamp,
    freshnessLagMs,
    freshnessStatus,
    ...summary,
    hasData: stats.length > 0,
  };
}

export function syncAggregatedLog(previousLog, nextLog) {
  const stats = loadStats();
  if (isFinalizedLog(previousLog)) {
    const previousBucket = upsertDayBucket(stats, toDay(previousLog.timestamp));
    applyLogToBucket(previousBucket, previousLog, -1);
  }
  if (isFinalizedLog(nextLog)) {
    const nextBucket = upsertDayBucket(stats, toDay(nextLog.timestamp));
    applyLogToBucket(nextBucket, nextLog, 1);
  }
  saveStats(normalizeStats(stats));
  const meta = loadMeta();
  saveMeta({
    ...meta,
    lastUpdatedAt: new Date().toISOString(),
  });
}

export function rebuildAIStatsDaily() {
  const { logs } = queryLogs({
    view: "summary",
    limit: 100000,
    offset: 0,
  });
  const stats = [];
  for (const log of logs) {
    if (!isFinalizedLog(log)) continue;
    const bucket = upsertDayBucket(stats, toDay(log.timestamp));
    applyLogToBucket(bucket, log, 1);
  }
  const normalized = normalizeStats(stats);
  saveStats(normalized);
  const now = new Date().toISOString();
  saveMeta({
    ...loadMeta(),
    lastRebuiltAt: now,
    lastUpdatedAt: now,
  });
  return normalized;
}

export function aggregateFromDailyStats({ groupBy = "day", startTime, endTime } = {}) {
  let stats = loadStats();
  if (!stats.length) {
    stats = rebuildAIStatsDaily();
  }
  const startDay = startTime ? toDay(startTime) : null;
  const endDay = endTime ? toDay(endTime) : null;
  const filtered = stats.filter((item) => {
    if (startDay && item.date < startDay) return false;
    if (endDay && item.date > endDay) return false;
    return true;
  });

  if (groupBy === "day") {
    return filtered
      .map((item) => ({
        date: item.date,
        totalCalls: item.totals.totalCalls,
        successCalls: item.totals.successCalls,
        failedCalls: item.totals.failedCalls,
        inputTokens: item.totals.inputTokens,
        outputTokens: item.totals.outputTokens,
        totalTokens: item.totals.totalTokens,
        totalCost: Number(item.totals.totalCost.toFixed(6)),
        totalLatencyMs: item.totals.totalLatencyMs,
        avgLatencyMs: item.totals.totalCalls > 0 ? Math.round(item.totals.totalLatencyMs / item.totals.totalCalls) : 0,
      }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  const sectionMap = {
    provider: "byProvider",
    model: "byModel",
    capability: "byCapability",
    group: "byGroup",
    module: "byModule",
    company: "byCompany",
    sourceApp: "bySourceApp",
  };
  const sectionKey = sectionMap[groupBy];
  const buckets = new Map();

  for (const day of filtered) {
    const section = day[sectionKey] || {};
    for (const [key, value] of Object.entries(section)) {
      const existing = buckets.get(key) || createMetric({
        date: day.date,
        provider: value.provider || null,
        model: value.model || null,
        capabilityId: value.capabilityId || null,
        group: value.group || null,
        module: value.module || null,
        companyId: value.companyId || null,
        companyName: value.companyName || null,
        sourceApp: value.sourceApp || null,
      });
      existing.totalCalls += value.totalCalls || 0;
      existing.successCalls += value.successCalls || 0;
      existing.failedCalls += value.failedCalls || 0;
      existing.inputTokens += value.inputTokens || 0;
      existing.outputTokens += value.outputTokens || 0;
      existing.totalTokens += value.totalTokens || 0;
      existing.totalCost += value.totalCost || 0;
      existing.totalLatencyMs += value.totalLatencyMs || 0;
      buckets.set(key, existing);
    }
  }

  return Array.from(buckets.values())
    .map((bucket) => ({
      ...bucket,
      totalCost: Number(bucket.totalCost.toFixed(6)),
      avgLatencyMs: bucket.totalCalls > 0 ? Math.round(bucket.totalLatencyMs / bucket.totalCalls) : 0,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}
