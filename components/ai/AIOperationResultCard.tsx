import React from "react";

function formatDateTime(value?: string | null) {
  if (!value) return "刚刚";
  try {
    return new Date(value).toLocaleString("zh-CN");
  } catch {
    return String(value);
  }
}

export default function AIOperationResultCard({
  title = "最近操作结果",
  result,
}: {
  title?: string;
  result?: {
    type?: string;
    target?: string;
    detail?: string;
    status?: "success" | "error";
    timestamp?: string;
  } | null;
}) {
  const isError = result?.status === "error";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-base font-semibold text-slate-900">{title}</div>
      {result ? (
        <div className={`mt-4 rounded-2xl border px-4 py-3 ${isError ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
          <div className={`text-sm font-medium ${isError ? "text-rose-700" : "text-emerald-700"}`}>
            {result.type || "操作"}{result.target ? ` · ${result.target}` : ""}
          </div>
          {result.detail ? (
            <div className={`mt-1 text-sm ${isError ? "text-rose-600" : "text-emerald-600"}`}>{result.detail}</div>
          ) : null}
          <div className="mt-2 text-xs text-slate-400">{formatDateTime(result.timestamp)}</div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          暂无最近操作记录。
        </div>
      )}
    </div>
  );
}
