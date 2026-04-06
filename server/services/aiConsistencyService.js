import { readAIStorage, writeAIStorage } from "./aiStorageService.js";
import { queryLogs } from "./aiInteractionLogger.js";
import { summarizeAIStatsDaily, getAIStatsDailyStatus } from "./aiStatsDailyService.js";
import { createMessage } from "../messageCenter/messageService.js";
import { resolveAIIncidentByRule, upsertAIIncident } from "./aiAlertService.js";

const REPORT_RESOURCE = "ai-consistency-reports";
const MAX_REPORTS = 20;
const CONSISTENCY_RULE_ID = "system-ai-consistency-check";

function toDay(value) {
  return String(value || "").slice(0, 10);
}

function roundCost(value) {
  return Number(Number(value || 0).toFixed(6));
}

function aggregateLogsByDay(logs = []) {
  const buckets = new Map();
  for (const log of logs) {
    if (log.success === null || log.success === undefined) continue;
    const day = toDay(log.timestamp);
    const bucket = buckets.get(day) || {
      date: day,
      totals: {
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        totalCost: 0,
      },
    };
    bucket.totals.totalCalls += 1;
    bucket.totals.successCalls += log.success ? 1 : 0;
    bucket.totals.failedCalls += log.success === false ? 1 : 0;
    bucket.totals.totalCost = roundCost(bucket.totals.totalCost + (log.tokenUsage?.estimatedCost || 0));
    buckets.set(day, bucket);
  }
  return Array.from(buckets.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function buildCheck(name, ok, detail, severity = "error") {
  return {
    name,
    status: ok ? "pass" : severity === "warn" ? "warn" : "fail",
    detail,
  };
}

function compareDayTotals(snapshotDays = [], recomputedDays = []) {
  const mismatches = [];
  const recomputedMap = new Map(recomputedDays.map((item) => [item.date, item]));
  const snapshotMap = new Map(snapshotDays.map((item) => [item.date, item]));
  const allDays = Array.from(new Set([...snapshotMap.keys(), ...recomputedMap.keys()])).sort();

  for (const day of allDays) {
    const snapshot = snapshotMap.get(day);
    const recomputed = recomputedMap.get(day);
    if (!snapshot || !recomputed) {
      mismatches.push({
        date: day,
        reason: snapshot ? "missing_in_recomputed" : "missing_in_snapshot",
      });
      continue;
    }
    for (const field of ["totalCalls", "successCalls", "failedCalls", "totalCost"]) {
      const left = field === "totalCost" ? roundCost(snapshot.totals?.[field]) : snapshot.totals?.[field] || 0;
      const right = field === "totalCost" ? roundCost(recomputed.totals?.[field]) : recomputed.totals?.[field] || 0;
      if (left !== right) {
        mismatches.push({ date: day, field, snapshot: left, recomputed: right });
      }
    }
  }

  return mismatches;
}

function checkIncidentTraceReferences(incidents = [], traceIdSet = new Set()) {
  const broken = [];
  for (const incident of incidents) {
    const missingTraceIds = (incident.affectedTraceIds || []).filter((traceId) => traceId && !traceIdSet.has(traceId));
    if (missingTraceIds.length > 0) {
      broken.push({
        incidentId: incident.id,
        ruleId: incident.ruleId,
        missingTraceIds,
      });
    }
  }
  return broken;
}

function readConsistencyReports() {
  const reports = readAIStorage("consistencyReports", []);
  return Array.isArray(reports) ? reports : [];
}

function summarizeCheckCounts(checks = []) {
  return checks.reduce(
    (summary, item) => {
      if (item.status === "pass") summary.passed += 1;
      if (item.status === "warn") summary.warned += 1;
      if (item.status === "fail") summary.failed += 1;
      return summary;
    },
    { passed: 0, warned: 0, failed: 0 },
  );
}

function toStoredReport(report) {
  return {
    id: `consistency-${Date.now()}`,
    checkedAt: report.checkedAt,
    trigger: report.trigger || "manual",
    success: report.success,
    summary: summarizeCheckCounts(report.checks || []),
    logs: report.logs,
    snapshot: {
      freshnessStatus: report.snapshot?.status?.freshnessStatus || "unknown",
      freshnessLagMs: report.snapshot?.status?.freshnessLagMs ?? null,
      lastUpdatedAt: report.snapshot?.status?.lastUpdatedAt || null,
      lastRebuiltAt: report.snapshot?.status?.lastRebuiltAt || null,
      dateRange: report.snapshot?.status?.dateRange || null,
      totals: report.snapshot?.summary || null,
    },
    alerts: report.alerts,
    checks: report.checks || [],
    recommendations: report.recommendations || [],
  };
}

function persistConsistencyReport(report) {
  const current = readConsistencyReports();
  const next = [toStoredReport(report), ...current].slice(0, MAX_REPORTS);
  writeAIStorage("consistencyReports", next);
  return next;
}

export function listAIConsistencyReports(limit = 10) {
  return readConsistencyReports().slice(0, Math.max(1, limit));
}

export function runAIDataConsistencyCheck(trigger = "manual") {
  const checkedAt = new Date().toISOString();
  const snapshotDays = readAIStorage("statsDaily", []) || [];
  const alerts = readAIStorage("alerts", {}) || { rules: [], incidents: [] };
  const { logs } = queryLogs({
    view: "summary",
    limit: 100000,
    offset: 0,
  });
  const finalizedLogs = logs.filter((log) => log.success !== null && log.success !== undefined);
  const recomputedDays = aggregateLogsByDay(finalizedLogs);
  const snapshotSummary = summarizeAIStatsDaily(snapshotDays);
  const recomputedSummary = summarizeAIStatsDaily(recomputedDays);
  const snapshotStatus = getAIStatsDailyStatus();
  const mismatches = compareDayTotals(snapshotDays, recomputedDays);
  const traceIdSet = new Set(finalizedLogs.map((log) => log.traceId).filter(Boolean));
  const brokenIncidentRefs = checkIncidentTraceReferences(alerts.incidents || [], traceIdSet);

  const checks = [
    buildCheck("snapshot_exists", snapshotDays.length > 0, snapshotDays.length > 0 ? `存在 ${snapshotDays.length} 个日分片` : "未发现 ai-stats-daily 快照数据"),
    buildCheck(
      "summary_totals_match",
      snapshotSummary.totalCalls === recomputedSummary.totalCalls &&
        snapshotSummary.successCalls === recomputedSummary.successCalls &&
        snapshotSummary.failedCalls === recomputedSummary.failedCalls &&
        roundCost(snapshotSummary.totalCost) === roundCost(recomputedSummary.totalCost),
      `快照 totals=${snapshotSummary.totalCalls}/${snapshotSummary.successCalls}/${snapshotSummary.failedCalls}/${roundCost(snapshotSummary.totalCost)}，重算 totals=${recomputedSummary.totalCalls}/${recomputedSummary.successCalls}/${recomputedSummary.failedCalls}/${roundCost(recomputedSummary.totalCost)}`,
    ),
    buildCheck("per_day_totals_match", mismatches.length === 0, mismatches.length === 0 ? "所有日期汇总一致" : `发现 ${mismatches.length} 处日级汇总不一致`),
    buildCheck(
      "snapshot_covers_latest_log_day",
      !snapshotStatus.latestLogTimestamp || snapshotStatus.dateRange?.end === toDay(snapshotStatus.latestLogTimestamp),
      `快照结束日=${snapshotStatus.dateRange?.end || "-"}，最新日志日=${toDay(snapshotStatus.latestLogTimestamp) || "-"}`,
    ),
    buildCheck("meta_timestamps_present", Boolean(snapshotStatus.lastRebuiltAt && snapshotStatus.lastUpdatedAt), `lastRebuiltAt=${snapshotStatus.lastRebuiltAt || "-"}，lastUpdatedAt=${snapshotStatus.lastUpdatedAt || "-"}`),
    buildCheck("snapshot_freshness", snapshotStatus.freshnessStatus !== "stale", `freshness=${snapshotStatus.freshnessStatus || "unknown"}，lagMs=${snapshotStatus.freshnessLagMs ?? "n/a"}`, "warn"),
    buildCheck("incident_trace_refs_valid", brokenIncidentRefs.length === 0, brokenIncidentRefs.length === 0 ? "告警事件引用 trace 正常" : `发现 ${brokenIncidentRefs.length} 条告警引用了不存在的 trace`, "warn"),
  ];

  const failedChecks = checks.filter((item) => item.status === "fail");
  const warnChecks = checks.filter((item) => item.status === "warn");
  const recommendations = [];
  if (failedChecks.some((item) => item.name === "summary_totals_match" || item.name === "per_day_totals_match")) {
    recommendations.push("先执行 `node server/scripts/rebuildAIStatsDaily.js` 重建快照，再重新巡检。");
  }
  if (warnChecks.some((item) => item.name === "snapshot_freshness")) {
    recommendations.push("当前快照偏旧，查看驾驶舱或成本报表前建议先重建统计快照。");
  }
  if (warnChecks.some((item) => item.name === "incident_trace_refs_valid")) {
    recommendations.push("检查 ai-alerts.json 中的 affectedTraceIds，清理已失效引用。");
  }

  const report = {
    trigger,
    success: failedChecks.length === 0,
    checkedAt,
    logs: {
      finalizedCount: finalizedLogs.length,
      latestTimestamp: finalizedLogs[0]?.timestamp || null,
    },
    snapshot: {
      status: snapshotStatus,
      summary: snapshotSummary,
    },
    recomputed: {
      summary: recomputedSummary,
    },
    alerts: {
      rulesCount: (alerts.rules || []).length,
      incidentsCount: (alerts.incidents || []).length,
      openIncidents: (alerts.incidents || []).filter((item) => item.status !== "resolved").length,
      brokenIncidentRefs,
    },
    checks,
    mismatches: mismatches.slice(0, 20),
    recommendations,
  };
  persistConsistencyReport(report);
  if (report.success) {
    resolveAIIncidentByRule(CONSISTENCY_RULE_ID);
  } else {
    const failed = (report.checks || []).filter((item) => item.status === "fail");
    const warned = (report.checks || []).filter((item) => item.status === "warn");
    upsertAIIncident({
      ruleId: CONSISTENCY_RULE_ID,
      triggeredAt: report.checkedAt,
      severity: failed.length > 0 ? "critical" : "warning",
      summary: `AI 数据巡检异常：${failed.length} 个失败项${warned.length ? `，${warned.length} 个告警项` : ""}`,
      affectedTraceIds: [],
      status: "open",
      scopeKey: "",
      data: {
        checkedAt: report.checkedAt,
        failedChecks: failed.map((item) => item.name),
        warnedChecks: warned.map((item) => item.name),
        recommendations: report.recommendations || [],
      },
    });
  }
  return report;
}

export function notifyAIDataConsistencyFailure(report, userId = "anonymous") {
  if (!report || report.success) return null;
  const failed = (report.checks || []).filter((item) => item.status === "fail");
  const warned = (report.checks || []).filter((item) => item.status === "warn");
  const title = `AI 数据巡检异常：${failed.length} 个失败项${warned.length ? `，${warned.length} 个告警项` : ""}`;
  const content = [
    failed.length ? `失败项：${failed.map((item) => item.name).join("、")}` : "",
    warned.length ? `告警项：${warned.map((item) => item.name).join("、")}` : "",
    report.recommendations?.[0] || "",
  ]
    .filter(Boolean)
    .join("；");
  return createMessage(userId, "system_notice", title, content, {
    action: "ai_consistency_check",
    reportSummary: {
      checkedAt: report.checkedAt,
      failedChecks: failed.map((item) => item.name),
      warnedChecks: warned.map((item) => item.name),
    },
  });
}
