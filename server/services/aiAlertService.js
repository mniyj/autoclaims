import { readAIStorage, writeAIStorage } from "./aiStorageService.js";
import { aggregateAICosts } from "./aiCostAggregator.js";
import { createAIIncidentMessage } from "../messageCenter/messageService.js";
import { evaluateBudgetUsage } from "./aiBudgetService.js";
import { queryLogs } from "./aiInteractionLogger.js";
import { clearAIStatsCache } from "./aiStatsCache.js";

const RESOURCE = "ai-alerts";
const MAX_INCIDENTS = 50;

function load() {
  const data = readAIStorage("alerts", {});
  if (!data || Array.isArray(data)) {
    return { rules: [], incidents: [] };
  }
  return { rules: data.rules || [], incidents: data.incidents || [] };
}

function save(data) {
  writeAIStorage("alerts", data);
}

function dedupeIncidents(incidents = []) {
  return incidents.slice(0, MAX_INCIDENTS);
}

function buildIncidentKey(ruleId, scopeKey = "") {
  return `${String(ruleId || "").trim()}::${String(scopeKey || "").trim()}`;
}

export function getAIAlerts() {
  return load();
}

export function saveAlertRules(rules) {
  const current = load();
  const next = { ...current, rules: Array.isArray(rules) ? rules : [] };
  save(next);
  clearAIStatsCache();
  return next;
}

export function updateIncidentStatus(incidentId, status) {
  const current = load();
  const incidents = (current.incidents || []).map((incident) =>
    incident.id === incidentId
      ? {
          ...incident,
          status,
          resolvedAt: status === "resolved" ? new Date().toISOString() : incident.resolvedAt,
        }
      : incident,
  );
  const next = { ...current, incidents };
  save(next);
  clearAIStatsCache();
  return incidents.find((incident) => incident.id === incidentId) || null;
}

export function repairBrokenIncidentTraceReferences() {
  const current = load();
  const { logs } = queryLogs({
    view: "summary",
    limit: 100000,
    offset: 0,
  });
  const validTraceIds = new Set(
    (logs || [])
      .filter((log) => log.success !== null && log.success !== undefined)
      .map((log) => log.traceId)
      .filter(Boolean),
  );

  let affectedIncidents = 0;
  let removedTraceRefs = 0;
  const incidents = (current.incidents || []).map((incident) => {
    const original = Array.isArray(incident.affectedTraceIds) ? incident.affectedTraceIds : [];
    const nextTraceIds = original.filter((traceId) => traceId && validTraceIds.has(traceId));
    if (nextTraceIds.length !== original.length) {
      affectedIncidents += 1;
      removedTraceRefs += original.length - nextTraceIds.length;
      return {
        ...incident,
        affectedTraceIds: nextTraceIds,
        updatedAt: new Date().toISOString(),
      };
    }
    return incident;
  });

  const next = { ...current, incidents };
  save(next);
  clearAIStatsCache();
  return {
    success: true,
    affectedIncidents,
    removedTraceRefs,
  };
}

export function upsertAIIncident(incidentInput, userId = "anonymous") {
  const current = load();
  const scopeKey = incidentInput?.scopeKey || "";
  const dedupeKey = buildIncidentKey(incidentInput?.ruleId, scopeKey);
  const incidents = [...(current.incidents || [])];
  const existingIndex = incidents.findIndex(
    (incident) =>
      incident.status !== "resolved" &&
      buildIncidentKey(incident.ruleId, incident.scopeKey) === dedupeKey,
  );

  if (existingIndex >= 0) {
    const updated = {
      ...incidents[existingIndex],
      ...incidentInput,
      id: incidents[existingIndex].id,
      triggeredAt: incidentInput.triggeredAt || incidents[existingIndex].triggeredAt,
      updatedAt: new Date().toISOString(),
    };
    incidents[existingIndex] = updated;
    const next = { ...current, incidents: dedupeIncidents(incidents) };
    save(next);
    clearAIStatsCache();
    return updated;
  }

  const incident = {
    id: incidentInput.id || `incident-${Date.now()}`,
    triggeredAt: incidentInput.triggeredAt || new Date().toISOString(),
    status: "open",
    ...incidentInput,
    scopeKey,
  };
  incidents.unshift(incident);
  const next = { ...current, incidents: dedupeIncidents(incidents) };
  save(next);
  clearAIStatsCache();
  createAIIncidentMessage(userId, incident);
  return incident;
}

export function resolveAIIncidentByRule(ruleId, scopeKey = "") {
  const current = load();
  let changed = false;
  const dedupeKey = buildIncidentKey(ruleId, scopeKey);
  const incidents = (current.incidents || []).map((incident) => {
    if (
      incident.status !== "resolved" &&
      buildIncidentKey(incident.ruleId, incident.scopeKey) === dedupeKey
    ) {
      changed = true;
      return {
        ...incident,
        status: "resolved",
        resolvedAt: new Date().toISOString(),
      };
    }
    return incident;
  });
  if (!changed) return null;
  const next = { ...current, incidents };
  save(next);
  clearAIStatsCache();
  return incidents.find((incident) => buildIncidentKey(incident.ruleId, incident.scopeKey) === dedupeKey) || null;
}

export function detectIncidents() {
  const current = load();
  const dailyCosts = aggregateAICosts({ groupBy: "day" });
  const latest = dailyCosts[0];
  if (!latest) return current;
  const dayStart = `${latest.date}T00:00:00.000Z`;
  const dayEnd = `${latest.date}T23:59:59.999Z`;
  const { logs: todayLogs } = queryLogs({
    view: "summary",
    startTime: dayStart,
    endTime: dayEnd,
    limit: 100000,
    offset: 0,
  });
  const incidents = [...current.incidents];
  const existingOpenKeys = new Set(
    incidents.filter((item) => item.status === "open").map((item) => item.ruleId),
  );
  if (latest.failedCalls > 10) {
    if (!existingOpenKeys.has("auto-error-rate")) {
      const affectedTraceIds = Array.from(
        new Set(
          todayLogs
            .filter((log) => log.success === false)
            .map((log) => log.traceId)
            .filter(Boolean),
        ),
      ).slice(0, 10);
      const incident = {
        ruleId: "auto-error-rate",
        triggeredAt: new Date().toISOString(),
        severity: "warning",
        summary: `AI 失败调用偏高：${latest.failedCalls} 次`,
        affectedTraceIds,
        status: "open",
      };
      incidents.unshift({
        id: `incident-${Date.now()}`,
        scopeKey: "",
        ...incident,
      });
      createAIIncidentMessage("anonymous", incidents[0]);
    }
  }
  if (latest.totalCost > 5) {
    if (!existingOpenKeys.has("auto-cost-surge")) {
      const affectedTraceIds = Array.from(
        new Set(
          [...todayLogs]
            .sort((a, b) => (b.tokenUsage?.estimatedCost || 0) - (a.tokenUsage?.estimatedCost || 0))
            .map((log) => log.traceId)
            .filter(Boolean),
        ),
      ).slice(0, 10);
      const incident = {
        ruleId: "auto-cost-surge",
        triggeredAt: new Date().toISOString(),
        severity: "warning",
        summary: `AI 日成本偏高：$${latest.totalCost.toFixed(4)}`,
        affectedTraceIds,
        status: "open",
      };
      incidents.unshift({
        id: `incident-${Date.now()}-cost`,
        scopeKey: "",
        ...incident,
      });
      createAIIncidentMessage("anonymous", incidents[0]);
    }
  }
  const budgetEvaluations = evaluateBudgetUsage();
  for (const budget of budgetEvaluations) {
    const highestThreshold = [...(budget.triggeredThresholds || [])].sort((a, b) => b - a)[0];
    if (!highestThreshold) continue;
    const ruleId = `budget-${budget.id}-${highestThreshold}`;
    if (existingOpenKeys.has(ruleId)) continue;
    const incident = {
      id: `incident-${Date.now()}-${budget.id}-${String(highestThreshold).replace(".", "_")}`,
      ruleId,
      triggeredAt: new Date().toISOString(),
      severity: highestThreshold >= 1 ? "critical" : "warning",
      summary: `AI 预算触发：${budget.scopeType}${budget.scopeId ? `/${budget.scopeId}` : ""} 已使用 $${budget.actualAmount.toFixed(4)} / $${Number(budget.budgetAmount || 0).toFixed(4)}`,
      affectedTraceIds: Array.from(new Set(todayLogs.map((log) => log.traceId).filter(Boolean))).slice(0, 10),
      status: "open",
      scopeKey: budget.scopeId || budget.scopeType || "",
    };
    incidents.unshift(incident);
    createAIIncidentMessage("anonymous", incident);
  }
  const deduped = dedupeIncidents(incidents);
  const next = { ...current, incidents: deduped };
  save(next);
  clearAIStatsCache();
  return next;
}
