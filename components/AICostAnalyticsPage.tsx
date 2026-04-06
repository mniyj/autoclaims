import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import AISvgBarChart from "./ai/AISvgBarChart";
import AIStatsSnapshotCard from "./ai/AIStatsSnapshotCard";

const TABS = [
  { label: "按模型", value: "model" },
  { label: "按能力", value: "capability" },
  { label: "按模块", value: "module" },
  { label: "按公司", value: "company" },
];

const AICostAnalyticsPage: React.FC = () => {
  const [groupBy, setGroupBy] = useState("model");
  const [rows, setRows] = useState<any[]>([]);
  const [statsOverview, setStatsOverview] = useState<any>(null);

  useEffect(() => {
    api.ai.getCostAnalytics({ groupBy }).then(setRows).catch(console.error);
  }, [groupBy]);

  useEffect(() => {
    api.ai.getStatsOverview().then(setStatsOverview).catch(console.error);
  }, []);

  const chartItems = rows.slice(0, 8).map((row) => ({
    label: row.model || row.capabilityId || row.module || row.companyName || row.companyId || row.provider || row.date,
    value: row.totalCost || 0,
  }));

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-full">
      <AIStatsSnapshotCard
        title="成本报表快照状态"
        overview={statsOverview}
        actionLabel="去模型管理"
        onAction={() => window.dispatchEvent(new CustomEvent("app:navigate", { detail: { view: "ai_model_management" } }))}
        actionHint="成本与业务分析优先读取日级预聚合快照；如需刷新最新数据，可进入模型与供应商管理页面重建。"
      />
      {statsOverview?.freshnessStatus && statsOverview.freshnessStatus !== "fresh" ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
            statsOverview.freshnessStatus === "stale"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          当前成本报表基于{statsOverview.freshnessStatus === "stale" ? "明显滞后" : "轻微滞后"}的统计快照。
          {statsOverview.freshnessStatus === "stale" ? "建议先重建快照，再查看费用排行和各维度消耗。" : "如需核对最新成本变化，建议执行一次快照重建。"}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setGroupBy(tab.value)}
            className={`rounded-full px-4 py-2 text-sm ${groupBy === tab.value ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr,1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">成本与业务分析</h1>
          <div className="mt-4 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">维度</th>
                  <th className="px-3 py-2 text-right">调用</th>
                  <th className="px-3 py-2 text-right">费用</th>
                  <th className="px-3 py-2 text-right">平均耗时</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${groupBy}-${index}`} className="border-t border-slate-100">
                    <td className="px-3 py-2">{row.model || row.capabilityId || row.module || row.companyName || row.companyId || row.provider || row.date}</td>
                    <td className="px-3 py-2 text-right">{row.totalCalls}</td>
                    <td className="px-3 py-2 text-right">${(row.totalCost || 0).toFixed(4)}</td>
                    <td className="px-3 py-2 text-right">{row.avgLatencyMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">费用排行</h2>
          <div className="mt-4">
            <AISvgBarChart items={chartItems} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AICostAnalyticsPage;
