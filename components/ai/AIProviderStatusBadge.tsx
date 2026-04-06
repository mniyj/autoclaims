import React from "react";

export default function AIProviderStatusBadge({ status }: { status?: string | null }) {
  const palette =
    status === "healthy" || status === "configured"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "degraded"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : status === "offline" || status === "missing_env"
          ? "bg-rose-50 text-rose-700 border-rose-200"
          : "bg-slate-50 text-slate-600 border-slate-200";
  return <span className={`rounded-full border px-2.5 py-1 text-xs ${palette}`}>{status || "unknown"}</span>;
}
