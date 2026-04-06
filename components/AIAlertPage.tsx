import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";

const DEFAULT_RULE = {
  id: "",
  name: "",
  type: "error_rate",
  scope: "global",
  scopeId: "",
  threshold: 1,
  windowMinutes: 5,
  enabled: true,
};

const RULE_TYPE_OPTIONS = [
  { value: "error_rate", label: "失败率" },
  { value: "latency_spike", label: "耗时突增" },
  { value: "cost_surge", label: "成本暴涨" },
  { value: "provider_timeout", label: "Provider 超时" },
];

const RULE_SCOPE_OPTIONS = [
  { value: "global", label: "全局" },
  { value: "capability", label: "能力" },
  { value: "provider", label: "Provider" },
];

const INCIDENT_SORT_OPTIONS = [
  { value: "latest", label: "按最近时间" },
  { value: "severity", label: "按严重度" },
];
const CONSISTENCY_RULE_ID = "system-ai-consistency-check";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-CN", {
    hour12: false,
  });
}

function formatLag(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  if (value < 1000) return `${value}ms`;
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.round(minutes / 60);
  return `${hours} 小时`;
}

function formatConsistencyResult(report: any) {
  if (!report) return "-";
  return report.success ? "通过" : "失败";
}

function getRuleHelpText(rule: any) {
  const scopeLabel = RULE_SCOPE_OPTIONS.find((item) => item.value === rule.scope)?.label || rule.scope || "当前范围";
  if (rule.type === "error_rate") {
    return `${scopeLabel}在 ${rule.windowMinutes || 5} 分钟窗口内，失败次数或失败率超过阈值时触发。`;
  }
  if (rule.type === "latency_spike") {
    return `${scopeLabel}在 ${rule.windowMinutes || 5} 分钟窗口内，平均耗时超过阈值时触发。`;
  }
  if (rule.type === "cost_surge") {
    return `${scopeLabel}在 ${rule.windowMinutes || 5} 分钟窗口内，成本增幅或累计成本超过阈值时触发。`;
  }
  if (rule.type === "provider_timeout") {
    return `${scopeLabel}在 ${rule.windowMinutes || 5} 分钟窗口内，Provider 超时次数超过阈值时触发。`;
  }
  return "该规则会在指定窗口内持续检查目标范围的异常指标。";
}

function getIncidentDetailSummary(incident: any) {
  if (incident?.ruleId !== CONSISTENCY_RULE_ID) {
    return {
      title: "",
      chips: [],
      lines: [],
    };
  }

  const failedChecks = incident?.data?.failedChecks || [];
  const warnedChecks = incident?.data?.warnedChecks || [];
  const recommendations = incident?.data?.recommendations || [];

  return {
    title: "巡检详情",
    chips: [
      failedChecks.length ? `失败项 ${failedChecks.length}` : "",
      warnedChecks.length ? `告警项 ${warnedChecks.length}` : "",
    ].filter(Boolean),
    lines: [
      failedChecks.length ? `失败检查：${failedChecks.join("、")}` : "",
      warnedChecks.length ? `告警检查：${warnedChecks.join("、")}` : "",
      recommendations[0] ? `建议动作：${recommendations[0]}` : "",
    ].filter(Boolean),
  };
}

const AIAlertPage: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [consistencyReports, setConsistencyReports] = useState<any[]>([]);
  const [consistencyMonitor, setConsistencyMonitor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingRules, setSavingRules] = useState(false);
  const [checkingConsistency, setCheckingConsistency] = useState(false);
  const [repairingBrokenRefs, setRepairingBrokenRefs] = useState(false);
  const [updatingIncidentId, setUpdatingIncidentId] = useState("");
  const [message, setMessage] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ruleTypeFilter, setRuleTypeFilter] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [sortBy, setSortBy] = useState("latest");
  const [expandedReportId, setExpandedReportId] = useState("");
  const [highlightedIncidentIds, setHighlightedIncidentIds] = useState<string[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [result, providerList, capabilityList, consistencyResult] = await Promise.all([
        api.ai.getAlerts(),
        api.ai.getProviders().catch(() => []),
        api.ai.getCapabilities().catch(() => []),
        api.ai.getConsistencyChecks(6).catch(() => ({ reports: [] })),
      ]);
      setRules(result?.rules || []);
      setIncidents(result?.incidents || []);
      setProviders(providerList || []);
      setCapabilities(capabilityList || []);
      setConsistencyReports(consistencyResult?.reports || []);
      setConsistencyMonitor(consistencyResult?.monitor || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载 AI 告警失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openIncidents = useMemo(
    () => incidents.filter((item) => item.status !== "resolved"),
    [incidents],
  );

  const latestConsistencyReport = consistencyReports[0] || null;
  const latestManualConsistencyReport = useMemo(
    () => consistencyReports.find((item) => (item?.trigger || "manual") === "manual") || null,
    [consistencyReports],
  );
  const latestAutoConsistencyReport = useMemo(
    () => consistencyReports.find((item) => (item?.trigger || "manual") !== "manual") || null,
    [consistencyReports],
  );

  const capabilityOptions = useMemo(
    () =>
      capabilities.map((item) => ({
        value: item.id,
        label: item.name || item.id,
      })),
    [capabilities],
  );

  const providerOptions = useMemo(
    () =>
      providers.map((item) => ({
        value: item.id,
        label: item.name || item.id,
      })),
    [providers],
  );

  const filteredIncidents = useMemo(
    () => {
      const next = incidents.filter((item) => {
        if (onlyOpen && item.status === "resolved") return false;
        if (severityFilter && item.severity !== severityFilter) return false;
        if (statusFilter && item.status !== statusFilter) return false;
        if (ruleTypeFilter && !String(item.ruleId || "").includes(ruleTypeFilter)) return false;
        return true;
      });
      return next.sort((a, b) => {
        if (sortBy === "severity") {
          const score = (value: string) => (value === "critical" ? 2 : value === "warning" ? 1 : 0);
          const diff = score(b.severity) - score(a.severity);
          if (diff !== 0) return diff;
        }
        return new Date(b.triggeredAt || 0).getTime() - new Date(a.triggeredAt || 0).getTime();
      });
    },
    [incidents, onlyOpen, ruleTypeFilter, severityFilter, sortBy, statusFilter],
  );

  const handleRuleChange = (index: number, field: string, value: string | boolean) => {
    setRules((current) =>
      current.map((rule, ruleIndex) =>
        ruleIndex === index
          ? {
              ...rule,
              [field]:
                field === "threshold" || field === "windowMinutes"
                  ? Number(value)
                  : value,
            }
          : rule,
      ),
    );
  };

  const addRule = () => {
    setRules((current) => [
      ...current,
      {
        ...DEFAULT_RULE,
        id: `rule-${Date.now()}`,
        name: `新规则 ${current.length + 1}`,
      },
    ]);
  };

  const removeRule = (index: number) => {
    setRules((current) => current.filter((_, ruleIndex) => ruleIndex !== index));
  };

  const getScopeOptions = (scope: string) => {
    if (scope === "provider") return providerOptions;
    if (scope === "capability") return capabilityOptions;
    return [];
  };

  const saveRules = async () => {
    setSavingRules(true);
    setMessage("");
    try {
      await api.ai.saveAlertRules(rules);
      setMessage(`已保存 ${rules.length} 条告警规则`);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存告警规则失败");
    } finally {
      setSavingRules(false);
    }
  };

  const runConsistencyCheck = async () => {
    setCheckingConsistency(true);
    setMessage("");
    try {
      const report = await api.ai.runConsistencyCheck();
      const failed = (report?.checks || []).filter((item: any) => item.status === "fail").length;
      const warned = (report?.checks || []).filter((item: any) => item.status === "warn").length;
      setMessage(
        report?.success
          ? "数据巡检通过"
          : `数据巡检发现 ${failed} 个失败项${warned ? `，${warned} 个告警项` : ""}`,
      );
      setConsistencyReports((current) => [report, ...current].slice(0, 6));
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "运行数据巡检失败");
    } finally {
      setCheckingConsistency(false);
    }
  };

  const updateIncidentStatus = async (incidentId: string, status: string) => {
    setUpdatingIncidentId(incidentId);
    setMessage("");
    try {
      await api.ai.updateIncidentStatus(incidentId, status);
      setMessage(status === "resolved" ? "告警已关闭" : "告警已确认");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新告警状态失败");
    } finally {
      setUpdatingIncidentId("");
    }
  };

  const openTrace = (traceIds: string[] = []) => {
    sessionStorage.setItem(
      "ai-log-preset",
      JSON.stringify({
        traceIds,
        traceId: traceIds[0] || "",
      }),
    );
    window.dispatchEvent(new CustomEvent("app:navigate", { detail: { view: "ai_interaction_logs" } }));
  };

  const navigateToModelManagementRebuild = () => {
    sessionStorage.setItem(
      "ai-model-management-preset",
      JSON.stringify({
        focusAction: "rebuild_stats",
      }),
    );
    window.dispatchEvent(new CustomEvent("app:navigate", { detail: { view: "ai_model_management" } }));
  };

  const focusBrokenReferenceIncidents = (report: any) => {
    const brokenIncidentIds = (report?.alerts?.brokenIncidentRefs || [])
      .map((item: any) => item?.incidentId)
      .filter(Boolean);
    if (brokenIncidentIds.length === 0) return;
    setOnlyOpen(false);
    setStatusFilter("");
    setSeverityFilter("");
    setRuleTypeFilter("");
    setHighlightedIncidentIds(brokenIncidentIds);
    setMessage(`已定位 ${brokenIncidentIds.length} 条坏引用告警，请在下方告警事件中处理。`);
    window.setTimeout(() => {
      const target = document.getElementById("ai-alert-incidents");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const repairBrokenReferenceIncidents = async () => {
    setRepairingBrokenRefs(true);
    setMessage("");
    try {
      const result = await api.ai.repairBrokenAlertTraceRefs();
      const report = await api.ai.runConsistencyCheck();
      const failed = (report?.checks || []).filter((item: any) => item.status === "fail").length;
      const warned = (report?.checks || []).filter((item: any) => item.status === "warn").length;
      setMessage(
        [
          `已清理 ${result?.affectedIncidents ?? 0} 条告警中的 ${result?.removedTraceRefs ?? 0} 个失效 Trace 引用`,
          report?.success
            ? "复跑巡检通过"
            : `复跑巡检发现 ${failed} 个失败项${warned ? `，${warned} 个告警项` : ""}`,
        ]
          .filter(Boolean)
          .join("；"),
      );
      setHighlightedIncidentIds([]);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "清理坏引用失败");
    } finally {
      setRepairingBrokenRefs(false);
    }
  };

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-full">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">AI 告警中心</h1>
          <div className="mt-1 text-sm text-slate-500">集中查看未处理告警、关闭异常事件，并维护一期技术指标规则。</div>
        </div>
        <div className="flex items-center gap-3">
          {message ? <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">{message}</div> : null}
          <button
            type="button"
            onClick={() => void runConsistencyCheck()}
            disabled={checkingConsistency}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            {checkingConsistency ? "巡检中..." : "运行数据巡检"}
          </button>
          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            刷新
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">未关闭告警</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{openIncidents.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">规则总数</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{rules.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">高优先级告警</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {openIncidents.filter((item) => item.severity === "critical").length}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">数据巡检状态</h2>
            <div className="mt-1 text-sm text-slate-500">保留最近几次 AI 数据一致性巡检结果，并展示自动巡检的运行状态。</div>
          </div>
          {latestConsistencyReport ? (
            <span
              className={`rounded-full px-3 py-1 text-xs ${
                latestConsistencyReport.success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}
            >
              {latestConsistencyReport.success ? "最近一次通过" : "最近一次失败"}
            </span>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-900">最近一次巡检</div>
                <div className="mt-1 text-xs text-slate-500">{formatDateTime(latestConsistencyReport?.checkedAt)}</div>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>通过 {latestConsistencyReport?.summary?.passed ?? 0}</div>
                <div>告警 {latestConsistencyReport?.summary?.warned ?? 0}</div>
                <div>失败 {latestConsistencyReport?.summary?.failed ?? 0}</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">快照新鲜度</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {latestConsistencyReport?.snapshot?.freshnessStatus || "-"}
                </div>
                <div className="mt-1 text-xs text-slate-500">落后 {formatLag(latestConsistencyReport?.snapshot?.freshnessLagMs)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">原始日志</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {latestConsistencyReport?.logs?.finalizedCount ?? 0} 条
                </div>
                <div className="mt-1 text-xs text-slate-500">最新日志 {formatDateTime(latestConsistencyReport?.logs?.latestTimestamp)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">开放告警</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {latestConsistencyReport?.alerts?.openIncidents ?? 0} 条
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  坏引用 {latestConsistencyReport?.alerts?.brokenIncidentRefs?.length ?? 0}
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {(latestConsistencyReport?.checks || []).slice(0, 4).map((item: any) => (
                <div key={item.name} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{item.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      item.status === "pass"
                        ? "bg-emerald-100 text-emerald-700"
                        : item.status === "warn"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
              {!latestConsistencyReport ? <div className="text-sm text-slate-500">还没有巡检记录。</div> : null}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="text-sm font-medium text-slate-900">自动巡检</div>
              <div className="mt-2 space-y-1 text-xs text-slate-500">
                <div>状态：{consistencyMonitor?.enabled ? "已启用" : "未启用"}</div>
                <div>上次自动巡检：{formatDateTime(consistencyMonitor?.lastAutoCheckAt)}</div>
                <div>上次结果：{consistencyMonitor?.lastResult || "-"}</div>
                <div>上次触发来源：{consistencyMonitor?.lastTrigger || "-"}</div>
                <div>计划执行时间：每天 {String(consistencyMonitor?.targetHour ?? "-").padStart(2, "0")}:00</div>
                <div>下一次计划：{formatDateTime(consistencyMonitor?.nextRunAt)}</div>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                <div className="text-xs font-medium text-slate-800">最近手动巡检</div>
                <div className="mt-2 text-xs text-slate-500">时间：{formatDateTime(latestManualConsistencyReport?.checkedAt)}</div>
                <div className="mt-1 text-xs text-slate-500">结果：{formatConsistencyResult(latestManualConsistencyReport)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                <div className="text-xs font-medium text-slate-800">最近自动巡检</div>
                <div className="mt-2 text-xs text-slate-500">时间：{formatDateTime(latestAutoConsistencyReport?.checkedAt)}</div>
                <div className="mt-1 text-xs text-slate-500">结果：{formatConsistencyResult(latestAutoConsistencyReport)}</div>
              </div>
            </div>
            <div className="text-sm font-medium text-slate-900">最近巡检记录</div>
            <div className="mt-3 space-y-2">
              {consistencyReports.length === 0 ? <div className="text-sm text-slate-500">暂无巡检记录</div> : null}
              {consistencyReports.map((report) => (
                <div key={report.id || report.checkedAt} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{formatDateTime(report.checkedAt)}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        通过 {report.summary?.passed ?? 0} · 告警 {report.summary?.warned ?? 0} · 失败 {report.summary?.failed ?? 0}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {(report.trigger || "manual") === "manual" ? "手动" : "自动"} · 快照 {report.snapshot?.freshnessStatus || "-"} · 日志 {report.logs?.finalizedCount ?? 0} 条
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          report.success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {report.success ? "通过" : "失败"}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedReportId((current) =>
                            current === (report.id || report.checkedAt) ? "" : (report.id || report.checkedAt),
                          )
                        }
                        className="rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-600 transition hover:bg-slate-50"
                      >
                        {expandedReportId === (report.id || report.checkedAt) ? "收起详情" : "查看详情"}
                      </button>
                    </div>
                  </div>
                  {expandedReportId === (report.id || report.checkedAt) ? (
                    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                      <div className="space-y-2">
                        {(report.checks || []).map((item: any) => (
                          <div
                            key={`${report.id || report.checkedAt}-${item.name}`}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs font-medium text-slate-800">{item.name}</div>
                              <span
                                className={`rounded-full px-2 py-1 text-[11px] ${
                                  item.status === "pass"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : item.status === "warn"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-rose-100 text-rose-700"
                                }`}
                              >
                                {item.status}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
                          </div>
                        ))}
                      </div>
                      {(report.recommendations || []).length > 0 ? (
                        <div className="rounded-xl border border-brand-blue-100 bg-brand-blue-50 px-3 py-2">
                          <div className="text-xs font-medium text-brand-blue-800">建议动作</div>
                          <div className="mt-1 space-y-1">
                            {(report.recommendations || []).map((item: string) => (
                              <div key={item} className="text-xs text-brand-blue-700">
                                {item}
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(report.summary?.failed ?? 0) > 0 ? (
                              <button
                                type="button"
                                onClick={navigateToModelManagementRebuild}
                                className="rounded-full border border-brand-blue-200 bg-white px-3 py-1.5 text-xs text-brand-blue-700 transition hover:bg-brand-blue-50"
                              >
                                去模型管理重建快照
                              </button>
                            ) : null}
                            {(report.alerts?.brokenIncidentRefs || []).length > 0 ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => focusBrokenReferenceIncidents(report)}
                                  className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs text-amber-700 transition hover:bg-amber-50"
                                >
                                  查看坏引用告警
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void repairBrokenReferenceIncidents()}
                                  disabled={repairingBrokenRefs}
                                  className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                                >
                                  {repairingBrokenRefs ? "清理中..." : "一键清理坏引用"}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="ai-alert-incidents" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">告警事件</h2>
          <span className="text-xs text-slate-400">共 {filteredIncidents.length} / {incidents.length} 条</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">全部严重度</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">全部状态</option>
            <option value="open">open</option>
            <option value="acknowledged">acknowledged</option>
            <option value="resolved">resolved</option>
          </select>
          <select
            value={ruleTypeFilter}
            onChange={(event) => setRuleTypeFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">全部规则类型</option>
            {RULE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={(event) => setOnlyOpen(event.target.checked)}
            />
            只看未关闭告警
          </label>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {INCIDENT_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="mt-4 space-y-3">
          {loading ? <div className="text-sm text-slate-500">加载中...</div> : null}
          {!loading && filteredIncidents.length === 0 ? <div className="text-sm text-slate-500">暂无符合条件的告警事件</div> : null}
          {filteredIncidents.map((incident) => (
            <div
              key={incident.id}
              className={`rounded-2xl border p-4 ${
                highlightedIncidentIds.includes(incident.id)
                  ? "border-amber-300 bg-amber-50 ring-2 ring-amber-100"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        incident.severity === "critical" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {incident.severity}
                    </span>
                    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-600">{incident.status}</span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-900">{incident.summary}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {incident.ruleId} · {incident.triggeredAt}
                  </div>
                  {incident.affectedTraceIds?.length ? (
                    <div className="mt-2 text-xs text-slate-500">
                      关联 Trace {incident.affectedTraceIds.length} 条
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {incident.affectedTraceIds?.length ? (
                    <button
                      type="button"
                      onClick={() => openTrace(incident.affectedTraceIds)}
                      className="rounded-full border border-brand-blue-200 px-3 py-1 text-xs text-brand-blue-700 transition hover:bg-brand-blue-50"
                    >
                      查看 Trace
                    </button>
                  ) : null}
                  {incident.status !== "acknowledged" && incident.status !== "resolved" ? (
                    <button
                      type="button"
                      disabled={updatingIncidentId === incident.id}
                      onClick={() => void updateIncidentStatus(incident.id, "acknowledged")}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                    >
                      确认
                    </button>
                  ) : null}
                  {incident.status !== "resolved" ? (
                    <button
                      type="button"
                      disabled={updatingIncidentId === incident.id}
                      onClick={() => void updateIncidentStatus(incident.id, "resolved")}
                      className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                    >
                      关闭
                    </button>
                  ) : null}
                </div>
              </div>
              {(() => {
                const detail = getIncidentDetailSummary(incident);
                if (!detail.lines.length) return null;
                return (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-medium text-slate-700">{detail.title}</div>
                      {detail.chips.map((chip) => (
                        <span key={chip} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                          {chip}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 space-y-1">
                      {detail.lines.map((line) => (
                        <div key={line} className="text-xs text-slate-600">
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">告警规则</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addRule}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              新增规则
            </button>
            <button
              type="button"
              onClick={() => void saveRules()}
              disabled={savingRules}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {savingRules ? "保存中..." : "保存规则"}
            </button>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          {rules.length === 0 ? <div className="text-sm text-slate-500">暂无规则</div> : null}
          {rules.map((rule, index) => (
            <div key={rule.id || index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">{rule.name || `规则 ${index + 1}`}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {RULE_TYPE_OPTIONS.find((item) => item.value === rule.type)?.label || rule.type} ·
                    {" "}
                    {RULE_SCOPE_OPTIONS.find((item) => item.value === rule.scope)?.label || rule.scope}
                    {rule.scopeId ? ` / ${rule.scopeId}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={rule.enabled !== false}
                      onChange={(event) => handleRuleChange(index, "enabled", event.target.checked)}
                    />
                    启用
                  </label>
                  <button
                    type="button"
                    onClick={() => removeRule(index)}
                    className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600 transition hover:bg-rose-50"
                  >
                    删除
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-500">规则名称</div>
                  <input
                    value={rule.name || ""}
                    onChange={(event) => handleRuleChange(index, "name", event.target.value)}
                    placeholder="规则名称"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-500">告警类型</div>
                  <select
                    value={rule.type || "error_rate"}
                    onChange={(event) => handleRuleChange(index, "type", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {RULE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-500">作用范围</div>
                  <select
                    value={rule.scope || "global"}
                    onChange={(event) => handleRuleChange(index, "scope", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {RULE_SCOPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                {rule.scope === "global" ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-sm text-slate-400">
                    全局规则无需 scopeId
                  </div>
                ) : getScopeOptions(rule.scope).length > 0 ? (
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500">作用对象</div>
                    <select
                      value={rule.scopeId || ""}
                      onChange={(event) => handleRuleChange(index, "scopeId", event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">请选择</option>
                      {getScopeOptions(rule.scope).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500">作用对象</div>
                    <input
                      value={rule.scopeId || ""}
                      onChange={(event) => handleRuleChange(index, "scopeId", event.target.value)}
                      placeholder="scopeId"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                )}
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-500">阈值</div>
                  <input
                    type="number"
                    value={rule.threshold ?? 1}
                    onChange={(event) => handleRuleChange(index, "threshold", event.target.value)}
                    placeholder="阈值"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-500">检测窗口（分钟）</div>
                  <input
                    type="number"
                    value={rule.windowMinutes ?? 5}
                    onChange={(event) => handleRuleChange(index, "windowMinutes", event.target.value)}
                    placeholder="窗口分钟"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                {getRuleHelpText(rule)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AIAlertPage;
