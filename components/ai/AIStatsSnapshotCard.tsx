import React from "react";

function formatDateTime(value?: string | null) {
  if (!value) return "未记录";
  try {
    return new Date(value).toLocaleString("zh-CN");
  } catch {
    return String(value);
  }
}

function formatLag(value?: number | null) {
  if (value == null) return "未记录";
  if (value < 1000) return `${value}ms`;
  if (value < 60 * 1000) return `${Math.round(value / 1000)} 秒`;
  return `${Math.round(value / 60000)} 分钟`;
}

function getFreshnessMeta(status?: string) {
  if (status === "fresh") {
    return {
      label: "最新",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      actionClassName: "border-slate-200 text-slate-500 hover:bg-slate-50",
      actionLabel: "快照最新",
    };
  }
  if (status === "lagging") {
    return {
      label: "轻微滞后",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      actionClassName: "border-amber-300 text-amber-700 hover:bg-amber-50",
      actionLabel: "建议重建",
    };
  }
  if (status === "stale") {
    return {
      label: "需要重建",
      className: "border-rose-200 bg-rose-50 text-rose-700",
      actionClassName: "border-rose-300 bg-rose-600 text-white hover:bg-rose-700",
      actionLabel: "立即重建",
    };
  }
  return {
    label: "未知",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    actionClassName: "border-slate-300 text-slate-700 hover:bg-slate-100",
    actionLabel: "重建快照",
  };
}

export default function AIStatsSnapshotCard({
  title = "统计快照状态",
  overview,
  actionLabel,
  actionPending = false,
  onAction,
  actionHint,
}: {
  title?: string;
  overview?: any;
  actionLabel?: string;
  actionPending?: boolean;
  onAction?: (() => void) | null;
  actionHint?: string;
}) {
  const freshness = getFreshnessMeta(overview?.freshnessStatus);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">当前统计优先使用日级预聚合快照。</p>
          <div className="mt-3 inline-flex items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${freshness.className}`}>
              快照状态：{freshness.label}
            </span>
            <span className="text-xs text-slate-400">
              落后 {formatLag(overview?.freshnessLagMs)}
            </span>
          </div>
        </div>
        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            disabled={actionPending}
            className={`rounded-full border px-4 py-2 text-sm transition disabled:opacity-60 ${freshness.actionClassName}`}
          >
            {actionPending ? "处理中..." : actionLabel || freshness.actionLabel}
          </button>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <div className="text-xs text-slate-500">覆盖分片日</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{overview?.bucketCount || 0}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <div className="text-xs text-slate-500">覆盖范围</div>
          <div className="mt-1 text-sm font-medium text-slate-900">
            {overview?.dateRange?.start || "-"} ~ {overview?.dateRange?.end || "-"}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <div className="text-xs text-slate-500">最近重建</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{formatDateTime(overview?.lastRebuiltAt)}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <div className="text-xs text-slate-500">最近更新</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{formatDateTime(overview?.lastUpdatedAt)}</div>
        </div>
      </div>
      <div className="mt-3 text-xs text-slate-400">
        最新日志时间：{formatDateTime(overview?.latestLogTimestamp)}
      </div>
      {overview?.freshnessStatus === "stale" ? (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          快照已经明显落后于最新日志，建议先重建再查看驾驶舱和成本报表。
        </div>
      ) : null}
      {overview?.freshnessStatus === "fresh" ? (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          快照已覆盖到最新日志附近，当前报表可直接使用。
        </div>
      ) : null}
      {actionHint ? <div className="mt-3 text-xs text-slate-400">{actionHint}</div> : null}
    </div>
  );
}
