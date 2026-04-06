import React from "react";

export default function AITraceTimeline({
  logs,
  compareIds = [],
  onToggleCompare,
}: {
  logs: any[];
  compareIds?: string[];
  onToggleCompare?: (logId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div key={log.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium text-slate-900">
              {log.capabilityId || log.context?.capabilityId || "unknown"} · {log.provider}/{log.model}
            </div>
            <div className="text-xs text-slate-500">
              {(log.performance?.durationMs || 0).toLocaleString("zh-CN")}ms / ${(log.tokenUsage?.estimatedCost || 0).toFixed(4)}
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">{log.timestamp}</div>
          {onToggleCompare ? (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => onToggleCompare(log.id)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  compareIds.includes(log.id)
                    ? "border-brand-blue-200 bg-brand-blue-50 text-brand-blue-700"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {compareIds.includes(log.id) ? "已加入对比" : "加入对比"}
              </button>
            </div>
          ) : null}
          {log.fallbackInfo ? (
            <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Fallback: {log.fallbackInfo.from} / {log.fallbackInfo.reason}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
