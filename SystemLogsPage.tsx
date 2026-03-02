import React, { useState, useEffect, useCallback } from "react";

interface AuditLogEntry {
  timestamp: string;
  type: "API_CALL" | "AI_REVIEW" | "RULE_EXECUTION" | "CLAIM_ACTION";
  endpoint?: string;
  claimCaseId?: string;
  fileName?: string;
  mimeType?: string;
  parseStatus?: string;
  classificationResult?: string;
  batchId?: string;
  fileCount?: number;
  successCount?: number;
  failCount?: number;
  skippedDuplicates?: number;
  reportId?: string;
  finalAmount?: number;
  itemCount?: number;
  // AI_REVIEW fields
  productCode?: string;
  decision?: string;
  amount?: number;
  toolCalls?: number;
  tokenUsage?: { input: number; output: number } | null;
  // RULE_EXECUTION fields
  rulesetId?: string;
  // CLAIM_ACTION fields
  action?: string;
  operator?: string;
  // common
  duration?: number;
  success: boolean;
  error?: string | null;
}

interface LogsResponse {
  date: string;
  total: number;
  returned: number;
  logs: AuditLogEntry[];
}

interface StatsResponse {
  date: string;
  totalCalls: number;
  totalTokens: { input: number; output: number };
  totalDuration: number;
  errors: number;
}

const LOG_TYPES = [
  { value: "", label: "全部类型" },
  { value: "API_CALL", label: "API 调用" },
  { value: "AI_REVIEW", label: "AI 审核" },
  { value: "RULE_EXECUTION", label: "规则执行" },
  { value: "CLAIM_ACTION", label: "案件操作" },
];

const TYPE_COLORS: Record<string, string> = {
  API_CALL: "bg-blue-100 text-blue-700",
  AI_REVIEW: "bg-purple-100 text-purple-700",
  RULE_EXECUTION: "bg-orange-100 text-orange-700",
  CLAIM_ACTION: "bg-teal-100 text-teal-700",
};

const TYPE_LABELS: Record<string, string> = {
  API_CALL: "API调用",
  AI_REVIEW: "AI审核",
  RULE_EXECUTION: "规则执行",
  CLAIM_ACTION: "案件操作",
};

function formatDuration(ms?: number) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function LogDetail({ log }: { log: AuditLogEntry }) {
  const rows: Array<{ label: string; value: string }> = [];

  if (log.endpoint) rows.push({ label: "端点", value: log.endpoint });
  if (log.fileName) rows.push({ label: "文件名", value: log.fileName });
  if (log.classificationResult) rows.push({ label: "分类结果", value: log.classificationResult });
  if (log.parseStatus) rows.push({ label: "解析状态", value: log.parseStatus });
  if (log.batchId) rows.push({ label: "Batch ID", value: log.batchId });
  if (log.fileCount != null)
    rows.push({
      label: "文件统计",
      value: `共 ${log.fileCount} 个，成功 ${log.successCount ?? 0}，失败 ${log.failCount ?? 0}${log.skippedDuplicates ? `，跳过重复 ${log.skippedDuplicates}` : ""}`,
    });
  if (log.reportId) rows.push({ label: "报告 ID", value: log.reportId });
  if (log.finalAmount != null)
    rows.push({ label: "定损金额", value: `¥${log.finalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}` });
  if (log.decision) rows.push({ label: "审核决定", value: log.decision });
  if (log.amount != null) rows.push({ label: "建议金额", value: `¥${log.amount.toLocaleString()}` });
  if (log.tokenUsage)
    rows.push({ label: "Token 用量", value: `入 ${log.tokenUsage.input} / 出 ${log.tokenUsage.output}` });
  if (log.rulesetId) rows.push({ label: "规则集", value: log.rulesetId });
  if (log.action) rows.push({ label: "操作", value: log.action });
  if (log.operator) rows.push({ label: "操作人", value: log.operator });
  if (log.error) rows.push({ label: "错误信息", value: log.error });

  if (rows.length === 0) return null;

  return (
    <div className="mt-2 ml-6 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex gap-1.5">
          <span className="text-gray-400 shrink-0">{label}:</span>
          <span className={label === "错误信息" ? "text-red-600 break-all" : "break-all"}>{value}</span>
        </div>
      ))}
    </div>
  );
}

const SystemLogsPage: React.FC = () => {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [typeFilter, setTypeFilter] = useState("");
  const [claimIdFilter, setClaimIdFilter] = useState("");
  const [logsData, setLogsData] = useState<LogsResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set());

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (typeFilter) params.set("type", typeFilter);
      if (claimIdFilter) params.set("claimCaseId", claimIdFilter);

      const [logsRes, statsRes] = await Promise.all([
        fetch(`/api/system-logs?${params}`),
        fetch("/api/system-logs/stats"),
      ]);

      if (logsRes.ok) setLogsData(await logsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) {
      console.error("Failed to fetch logs:", e);
    } finally {
      setLoading(false);
    }
  }, [date, typeFilter, claimIdFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleExpand = (idx: number) => {
    setExpandedIdx((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const logs = logsData?.logs ?? [];

  return (
    <div className="min-h-screen bg-[#f8f9fc] pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-[#2d3a8c]">系统日志</h1>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 mt-6 space-y-5">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "今日 API 调用", value: stats.totalCalls.toString(), color: "text-blue-600" },
              {
                label: "Token 用量",
                value: `${((stats.totalTokens.input + stats.totalTokens.output) / 1000).toFixed(1)}K`,
                color: "text-purple-600",
              },
              {
                label: "平均耗时",
                value: stats.totalCalls > 0 ? formatDuration(Math.round(stats.totalDuration / stats.totalCalls)) : "—",
                color: "text-teal-600",
              },
              { label: "错误次数", value: stats.errors.toString(), color: stats.errors > 0 ? "text-red-600" : "text-green-600" },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">日期</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">类型</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {LOG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">案件ID</label>
              <input
                type="text"
                placeholder="claim-xxx"
                value={claimIdFilter}
                onChange={(e) => setClaimIdFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1.5 w-32 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>

            <button
              onClick={fetchLogs}
              disabled={loading}
              className="flex items-center px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 ml-auto"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
              ) : (
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              刷新
            </button>

            {logsData && (
              <span className="text-xs text-gray-400">
                共 {logsData.total} 条，显示最新 {logsData.returned} 条
              </span>
            )}
          </div>
        </div>

        {/* Log Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <svg className="w-12 h-12 mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">{loading ? "加载中..." : "暂无日志记录"}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* Table Header */}
              <div className="grid grid-cols-[90px_100px_160px_1fr_80px_60px] gap-3 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <span>时间</span>
                <span>类型</span>
                <span>案件 / 端点</span>
                <span>摘要</span>
                <span>耗时</span>
                <span>结果</span>
              </div>

              {logs.map((log, idx) => (
                <div key={idx}>
                  <button
                    onClick={() => toggleExpand(idx)}
                    className="w-full grid grid-cols-[90px_100px_160px_1fr_80px_60px] gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    {/* 时间 */}
                    <span className="text-xs text-gray-500 font-mono">{formatTime(log.timestamp)}</span>

                    {/* 类型 */}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-fit ${TYPE_COLORS[log.type] || "bg-gray-100 text-gray-600"}`}>
                      {TYPE_LABELS[log.type] || log.type}
                    </span>

                    {/* 案件/端点 */}
                    <span className="text-xs text-gray-600 truncate">
                      {log.claimCaseId && <span className="text-indigo-600 font-medium">{log.claimCaseId}</span>}
                      {log.claimCaseId && log.endpoint && <span className="text-gray-300 mx-1">·</span>}
                      {log.endpoint && <span className="text-gray-400 font-mono">{log.endpoint?.replace(/^(POST|GET) \/api\//, "")}</span>}
                    </span>

                    {/* 摘要 */}
                    <span className="text-xs text-gray-700 truncate">
                      {log.type === "API_CALL" && log.fileName && `${log.fileName} → ${log.classificationResult || log.parseStatus || ""}`}
                      {log.type === "API_CALL" && log.fileCount != null && `批量导入 ${log.fileCount} 个文件`}
                      {log.type === "API_CALL" && log.reportId && `定损 ¥${log.finalAmount?.toLocaleString()}`}
                      {log.type === "AI_REVIEW" && `${log.decision || "—"} ${log.amount != null ? `¥${log.amount.toLocaleString()}` : ""}`}
                      {log.type === "RULE_EXECUTION" && `规则集 ${log.rulesetId || "—"}`}
                      {log.type === "CLAIM_ACTION" && `${log.action} by ${log.operator || "—"}`}
                      {log.error && <span className="text-red-500 ml-1">· {log.error.slice(0, 40)}</span>}
                    </span>

                    {/* 耗时 */}
                    <span className="text-xs text-gray-500">{formatDuration(log.duration)}</span>

                    {/* 结果 */}
                    <span className={`text-xs font-medium ${log.success ? "text-green-600" : "text-red-600"}`}>
                      {log.success ? "✓ 成功" : "✗ 失败"}
                    </span>
                  </button>

                  {expandedIdx.has(idx) && <LogDetail log={log} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemLogsPage;
