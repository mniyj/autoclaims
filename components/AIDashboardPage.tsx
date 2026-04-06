import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import AIPeriodSelector from "./ai/AIPeriodSelector";
import AIMetricCard from "./ai/AIMetricCard";
import AISvgBarChart from "./ai/AISvgBarChart";
import AISvgLineChart from "./ai/AISvgLineChart";
import AIStatsSnapshotCard from "./ai/AIStatsSnapshotCard";

const AI_LOG_PRESET_STORAGE_KEY = "ai-log-preset";
const AI_MODEL_MANAGEMENT_PRESET_STORAGE_KEY = "ai-model-management-preset";

function getRange(period: string) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - (period === "30d" ? 29 : period === "7d" ? 6 : 0));
  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

function getFreshnessHint(overview: any) {
  if (!overview) return "";
  if (overview.freshnessStatus === "stale") {
    return "快照明显滞后，建议先重建";
  }
  if (overview.freshnessStatus === "lagging") {
    return "快照轻微滞后，建议关注";
  }
  if (overview.freshnessStatus === "fresh") {
    return "基于最新快照";
  }
  return "快照状态未知";
}

const AIDashboardPage: React.FC = () => {
  const [period, setPeriod] = useState("7d");
  const [data, setData] = useState<any>(null);
  const [statsOverview, setStatsOverview] = useState<any>(null);
  const [consistencyReports, setConsistencyReports] = useState<any[]>([]);

  useEffect(() => {
    api.ai.getDashboard(getRange(period)).then(setData).catch(console.error);
  }, [period]);

  useEffect(() => {
    api.ai.getStatsOverview().then(setStatsOverview).catch(console.error);
    api.ai.getConsistencyChecks(20).then((result) => setConsistencyReports(result?.reports || [])).catch(console.error);
  }, []);

  const topCapabilityChart = useMemo(
    () => (data?.topCapabilities || []).map((item: any) => ({ label: item.name || item.id, value: item.cost })),
    [data],
  );
  const topModuleChart = useMemo(
    () => (data?.topModules || []).map((item: any) => ({ label: item.module || "-", value: item.cost })),
    [data],
  );
  const providerHealthList = useMemo(
    () => (data?.providerHealth || []).slice(0, 5),
    [data],
  );
  const recentConfigChanges = useMemo(
    () => (data?.recentConfigChanges || []).slice(0, 5),
    [data],
  );
  const freshnessHint = getFreshnessHint(statsOverview);
  const freshnessTone =
    statsOverview?.freshnessStatus === "stale"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : statsOverview?.freshnessStatus === "lagging"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const autoConsistencyStats = useMemo(() => {
    const range = getRange(period);
    const startMs = new Date(range.startTime).getTime();
    const autoReports = (consistencyReports || []).filter((item) => (item?.trigger || "manual") !== "manual");
    const inRange = autoReports.filter((item) => new Date(item.checkedAt || 0).getTime() >= startMs);
    return {
      total: inRange.length,
      failed: inRange.filter((item) => item.success === false).length,
      warned: inRange.filter((item) => (item.summary?.warned || 0) > 0).length,
      latest: autoReports[0] || null,
    };
  }, [consistencyReports, period]);
  const autoConsistencyHint = autoConsistencyStats.latest
    ? `最近自动巡检：${autoConsistencyStats.latest.success ? "通过" : "失败"} · ${autoConsistencyStats.latest.checkedAt?.slice(5, 16) || "-"}`
    : "当前时间范围内暂无自动巡检记录";

  const navigateToAuditCenter = (preset: Record<string, unknown>) => {
    sessionStorage.setItem(AI_LOG_PRESET_STORAGE_KEY, JSON.stringify(preset));
    window.dispatchEvent(new CustomEvent("app:navigate", { detail: { view: "ai_interaction_logs" } }));
  };

  const navigateToModelManagement = (providerId: string) => {
    sessionStorage.setItem(
      AI_MODEL_MANAGEMENT_PRESET_STORAGE_KEY,
      JSON.stringify({ providerId }),
    );
    window.dispatchEvent(new CustomEvent("app:navigate", { detail: { view: "ai_model_management" } }));
  };

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">AI 总览驾驶舱</h1>
          <p className="text-sm text-slate-500 mt-1">平台级 AI 调用、成本、稳定性总览</p>
        </div>
        <AIPeriodSelector value={period} onChange={setPeriod} />
      </div>
      <AIStatsSnapshotCard
        title="统计快照概览"
        overview={statsOverview}
        actionLabel="去模型管理"
        onAction={() => window.dispatchEvent(new CustomEvent("app:navigate", { detail: { view: "ai_model_management" } }))}
        actionHint="需要手动重建或查看最近一次重建结果时，可进入模型与供应商管理页面。"
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AIMetricCard label="总调用次数" value={data?.totalCalls || 0} hint={freshnessHint} />
        <AIMetricCard label="成功率" value={`${(((data?.successRate || 0) * 100)).toFixed(1)}%`} hint={freshnessHint} />
        <AIMetricCard label="总费用" value={`$${(data?.totalCost || 0).toFixed(4)}`} hint={freshnessHint} />
        <AIMetricCard label="活跃模型数" value={data?.activeModels || 0} hint={freshnessHint} />
        <AIMetricCard
          label="自动巡检失败次数"
          value={autoConsistencyStats.failed}
          hint={autoConsistencyHint}
        />
      </div>
      {statsOverview?.freshnessStatus && statsOverview.freshnessStatus !== "fresh" ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${freshnessTone}`}>
          驾驶舱核心指标当前来自{statsOverview.freshnessStatus === "stale" ? "明显滞后" : "轻微滞后"}的统计快照。
          {statsOverview.freshnessStatus === "stale" ? "建议先在模型与供应商管理中执行重建，再查看费用趋势和成本排行。" : "如需精确核对最新数据，建议执行一次快照重建。"}
        </div>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">费用趋势</h2>
          <div className="mt-4">
            <AISvgLineChart items={(data?.trends?.costs || []).map((item: any) => ({ label: item.date?.slice(5) || "-", value: item.amount || 0 }))} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">能力消耗排行</h2>
          <div className="mt-4">
            <AISvgBarChart items={topCapabilityChart} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900">预算使用情况</h2>
            <span className="text-xs text-slate-400">{(data?.budgetUsage || []).length} 条预算规则</span>
          </div>
          <div className="mt-4 space-y-3">
            {(data?.budgetUsage || []).slice(0, 6).map((item: any) => {
              const ratio = Math.min(item.ratio || 0, 1.5);
              const palette =
                (item.ratio || 0) >= 1
                  ? "bg-rose-500"
                  : (item.ratio || 0) >= 0.9
                    ? "bg-amber-500"
                    : "bg-emerald-500";
              return (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {item.scopeType}{item.scopeId ? ` / ${item.scopeId}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        ${Number(item.actualAmount || 0).toFixed(4)} / ${Number(item.budgetAmount || 0).toFixed(4)}
                      </div>
                    </div>
                    <div className="text-sm text-slate-600">{((item.ratio || 0) * 100).toFixed(1)}%</div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full ${palette}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                  </div>
                </div>
              );
            })}
            {(data?.budgetUsage || []).length === 0 ? <div className="text-sm text-slate-500">暂无预算数据</div> : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-slate-900">自动巡检稳定性</h2>
              <span className="text-xs text-slate-400">{period} 内 {autoConsistencyStats.total} 次</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">失败次数</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{autoConsistencyStats.failed}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">告警次数</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{autoConsistencyStats.warned}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">最近结果</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {autoConsistencyStats.latest ? (autoConsistencyStats.latest.success ? "通过" : "失败") : "-"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {autoConsistencyStats.latest?.checkedAt || "-"}
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">未关闭告警</h2>
            <div className="mt-4 space-y-3">
              {(data?.openIncidents || []).slice(0, 5).map((incident: any) => (
                <button
                  key={incident.id}
                  type="button"
                  onClick={() =>
                    navigateToAuditCenter({
                      traceId: incident.affectedTraceIds?.[0] || "",
                      startTime: data?.period?.start?.slice(0, 10) || "",
                      endTime: data?.period?.end?.slice(0, 10) || "",
                    })
                  }
                  className="block w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-brand-blue-200 hover:bg-brand-blue-50/40"
                >
                  <div className="text-sm font-medium text-slate-900">{incident.summary}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {incident.severity} · {incident.status} · {incident.triggeredAt}
                  </div>
                  <div className="mt-2 text-xs text-brand-blue-600">
                    {incident.affectedTraceIds?.[0] ? "查看关联 Trace" : "跳转审计中心"}
                  </div>
                </button>
              ))}
              {(data?.openIncidents || []).length === 0 ? <div className="text-sm text-slate-500">暂无未关闭告警</div> : null}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Provider 健康概览</h2>
            <div className="mt-4 space-y-3">
              {providerHealthList.map((item: any) => (
                <button
                  key={item.providerId}
                  type="button"
                  onClick={() => navigateToModelManagement(item.providerId)}
                  className="block w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-brand-blue-200 hover:bg-brand-blue-50/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{item.providerId}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        config: {item.configStatus || "unknown"} · runtime: {item.runtimeStatus || "unknown"}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>{item.successRate1h != null ? `${(item.successRate1h * 100).toFixed(1)}%` : "-"}</div>
                      <div>{item.avgLatencyMs != null ? `${item.avgLatencyMs}ms` : "-"}</div>
                    </div>
                  </div>
                </button>
              ))}
              {providerHealthList.length === 0 ? <div className="text-sm text-slate-500">暂无健康数据</div> : null}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">模块成本排行</h2>
            <div className="mt-4">
              <AISvgBarChart items={topModuleChart} color="#1d4ed8" />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">最近配置变更</h2>
            <div className="mt-4 space-y-3">
              {recentConfigChanges.map((item: any, index: number) => (
                <div key={`${item.capabilityId}-${item.changedAt}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-medium text-slate-900">{item.capabilityId || "-"}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {item.changedBy || "unknown"} · {item.changedAt || "-"}
                  </div>
                </div>
              ))}
              {recentConfigChanges.length === 0 ? <div className="text-sm text-slate-500">暂无配置变更</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIDashboardPage;
