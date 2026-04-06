import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import AIStatsSnapshotCard from "./ai/AIStatsSnapshotCard";

const AIModelComparisonPage: React.FC = () => {
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [capabilityId, setCapabilityId] = useState("");
  const [data, setData] = useState<any>(null);
  const [statsOverview, setStatsOverview] = useState<any>(null);

  useEffect(() => {
    api.ai.getCapabilities().then((items) => {
      setCapabilities(items);
      if (items[0]?.id) setCapabilityId(items[0].id);
    });
    api.ai.getStatsOverview().then(setStatsOverview).catch(console.error);
  }, []);

  useEffect(() => {
    if (!capabilityId) return;
    api.ai.getModelComparison({ capabilityId }).then(setData).catch(console.error);
  }, [capabilityId]);

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">模型运行对比</h1>
        <select
          value={capabilityId}
          onChange={(e) => setCapabilityId(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          {capabilities.map((capability) => (
            <option key={capability.id} value={capability.id}>
              {capability.name}
            </option>
          ))}
        </select>
      </div>
      <AIStatsSnapshotCard
        title="对比数据快照状态"
        overview={statsOverview}
        actionLabel="去模型管理"
        onAction={() => window.dispatchEvent(new CustomEvent("app:navigate", { detail: { view: "ai_model_management" } }))}
        actionHint="模型运行对比依赖统计快照；如快照滞后，建议先重建后再判断模型优劣。"
      />
      {statsOverview?.freshnessStatus && statsOverview.freshnessStatus !== "fresh" ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
            statsOverview.freshnessStatus === "stale"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          当前模型运行对比基于{statsOverview.freshnessStatus === "stale" ? "明显滞后" : "轻微滞后"}的统计快照。
          {statsOverview.freshnessStatus === "stale" ? "建议先重建快照，再比较成本、延迟和成功率。" : "如需核对最新运行表现，建议先执行一次快照重建。"}
        </div>
      ) : null}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Provider/Model</th>
              <th className="px-3 py-2 text-right">调用量</th>
              <th className="px-3 py-2 text-right">成功率</th>
              <th className="px-3 py-2 text-right">平均耗时</th>
              <th className="px-3 py-2 text-right">P95</th>
              <th className="px-3 py-2 text-right">平均 Token</th>
              <th className="px-3 py-2 text-right">总费用</th>
            </tr>
          </thead>
          <tbody>
            {(data?.models || []).map((item: any) => (
              <tr key={`${item.provider}:${item.model}`} className="border-t border-slate-100">
                <td className="px-3 py-2">{item.provider}/{item.model}</td>
                <td className="px-3 py-2 text-right">{item.totalCalls}</td>
                <td className="px-3 py-2 text-right">{(item.successRate * 100).toFixed(1)}%</td>
                <td className="px-3 py-2 text-right">{item.avgLatencyMs}ms</td>
                <td className="px-3 py-2 text-right">{item.p95LatencyMs}ms</td>
                <td className="px-3 py-2 text-right">{item.avgTokensPerCall}</td>
                <td className="px-3 py-2 text-right">${item.totalCost.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AIModelComparisonPage;
