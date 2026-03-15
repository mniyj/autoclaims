import React, { useEffect, useMemo, useState } from 'react';
import Input from './ui/Input';
import Select from './ui/Select';
import Pagination from './ui/Pagination';
import Modal from './ui/Modal';
import { api } from '../services/api';

const ITEMS_PER_PAGE = 20;

type LogSummary = {
  id: string;
  timestamp: string;
  traceId?: string | null;
  sessionId?: string | null;
  sourceApp?: string | null;
  module?: string | null;
  runtime?: string | null;
  provider?: string | null;
  model?: string | null;
  operation?: string | null;
  success?: boolean | null;
  error?: { name?: string | null; message?: string | null } | null;
  performance?: {
    durationMs?: number | null;
  } | null;
  tokenUsage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
  } | null;
  context?: {
    claimCaseId?: string | null;
    taskId?: string | null;
    fileIndex?: number | null;
    voiceSessionId?: string | null;
  } | null;
};

type LogDetail = LogSummary & {
  request?: {
    summary?: unknown;
    raw?: unknown;
  } | null;
  response?: {
    text?: string | null;
    finishReason?: string | null;
    toolCalls?: unknown;
    grounding?: unknown;
    raw?: unknown;
  } | null;
  sanitized?: {
    context?: unknown;
    request?: unknown;
    response?: unknown;
  } | null;
};

const SOURCE_OPTIONS = [
  { label: '全部来源', value: '' },
  { label: '服务端', value: 'server' },
  { label: 'SmartClaim AI', value: 'smartclaim-ai-agent' },
  { label: '前端', value: 'web' },
];

const STATUS_OPTIONS = [
  { label: '全部结果', value: '' },
  { label: '成功', value: 'true' },
  { label: '失败', value: 'false' },
];

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN');
};

const formatDuration = (duration?: number | null) => {
  if (duration === undefined || duration === null) return '-';
  if (duration < 1000) return `${Math.round(duration)}ms`;
  return `${(duration / 1000).toFixed(2)}s`;
};

const formatTokenUsage = (tokenUsage?: LogSummary['tokenUsage']) => {
  if (!tokenUsage) return '-';
  if (tokenUsage.totalTokens != null) return tokenUsage.totalTokens.toLocaleString('zh-CN');
  if (tokenUsage.inputTokens != null || tokenUsage.outputTokens != null) {
    return `${tokenUsage.inputTokens ?? 0}/${tokenUsage.outputTokens ?? 0}`;
  }
  return '-';
};

const stringify = (value: unknown) => {
  if (value === undefined || value === null) return '-';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const moduleLabel = (value?: string | null) => value || '-';

const AIInteractionLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogDetail | null>(null);

  const [keyword, setKeyword] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [successFilter, setSuccessFilter] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const result = await api.aiInteractionLogs.query({
          view: 'summary',
          limit: ITEMS_PER_PAGE,
          offset,
          keyword: keyword.trim() || undefined,
          module: moduleFilter || undefined,
          sourceApp: sourceFilter || undefined,
          success: successFilter || undefined,
          startTime: startTime ? `${startTime}T00:00:00.000Z` : undefined,
          endTime: endTime ? `${endTime}T23:59:59.999Z` : undefined,
        });
        setLogs(result.logs as LogSummary[]);
        setTotalCount(result.total || 0);
        setErrorMessage(null);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'AI 交互日志加载失败');
        setLogs([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [offset, keyword, moduleFilter, sourceFilter, successFilter, startTime, endTime]);

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, moduleFilter, sourceFilter, successFilter, startTime, endTime]);

  const fetchDetail = async (logId: string) => {
    setSelectedLog(null);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const result = await api.aiInteractionLogs.getById(logId);
      const detail = (result.logs?.[0] || null) as LogDetail | null;
      setSelectedLog(detail);
      if (!detail) {
        setDetailError('未找到对应日志详情');
      }
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : '日志详情加载失败');
      setSelectedLog(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const totalPages = useMemo(() => {
    if (totalCount === 0) return 0;
    return Math.ceil(totalCount / ITEMS_PER_PAGE);
  }, [totalCount]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">AI 交互日志</h1>

      <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Input
            id="ai-log-keyword"
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="日志ID、案件ID、任务ID、traceId"
          />
          <Input
            id="ai-log-module"
            label="模块"
            value={moduleFilter}
            onChange={(event) => setModuleFilter(event.target.value)}
            placeholder="如 classification / claim_review"
          />
          <Select
            id="ai-log-source"
            label="来源应用"
            value={sourceFilter}
            options={SOURCE_OPTIONS}
            onChange={setSourceFilter}
          />
          <Select
            id="ai-log-success"
            label="执行结果"
            value={successFilter}
            options={STATUS_OPTIONS}
            onChange={setSuccessFilter}
          />
          <div className="space-y-1">
            <label htmlFor="ai-log-start" className="block text-sm font-medium text-gray-700">开始日期</label>
            <input
              id="ai-log-start"
              type="date"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="ai-log-end" className="block text-sm font-medium text-gray-700">结束日期</label>
            <input
              id="ai-log-end"
              type="date"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">日志列表</h2>
          <span className="text-xs text-gray-500">共 {totalCount} 条</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">时间</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">模块 / 操作</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">模型</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">关联信息</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">结果</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">耗时</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Token</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-500">加载中...</td>
                </tr>
              ) : errorMessage ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-red-500">{errorMessage}</td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDateTime(log.timestamp)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 min-w-[220px]">
                      <div className="font-medium text-gray-900">{moduleLabel(log.module)}</div>
                      <div className="text-xs text-gray-500 mt-1">{log.operation || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 min-w-[180px]">
                      <div>{log.model || '-'}</div>
                      <div className="text-xs text-gray-400 mt-1">{log.sourceApp || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 min-w-[220px]">
                      <div>案件: {log.context?.claimCaseId || '-'}</div>
                      <div className="text-xs text-gray-500 mt-1">任务: {log.context?.taskId || '-'}</div>
                      <div className="text-xs text-gray-400 mt-1">Trace: {log.traceId || '-'}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {log.success === false ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100 text-xs">失败</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 text-xs">成功</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDuration(log.performance?.durationMs)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatTokenUsage(log.tokenUsage)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        onClick={() => fetchDetail(log.id)}
                        className="text-brand-blue-600 hover:text-brand-blue-700 text-sm font-medium"
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-500">暂无日志数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-200">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalCount}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </div>

      <Modal
        isOpen={Boolean(selectedLog) || detailLoading || Boolean(detailError)}
        onClose={() => {
          setSelectedLog(null);
          setDetailError(null);
        }}
        title="AI 交互日志详情"
        width="max-w-5xl"
      >
        {detailLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">详情加载中...</div>
        ) : detailError ? (
          <div className="py-8 text-center text-sm text-red-500">{detailError}</div>
        ) : selectedLog ? (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-gray-500">日志ID</div>
                <div className="text-gray-900 break-all">{selectedLog.id}</div>
              </div>
              <div>
                <div className="text-gray-500">时间</div>
                <div className="text-gray-900">{formatDateTime(selectedLog.timestamp)}</div>
              </div>
              <div>
                <div className="text-gray-500">模块</div>
                <div className="text-gray-900">{selectedLog.module || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500">操作</div>
                <div className="text-gray-900">{selectedLog.operation || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500">模型</div>
                <div className="text-gray-900">{selectedLog.model || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500">结果</div>
                <div className="text-gray-900">{selectedLog.success === false ? '失败' : '成功'}</div>
              </div>
              <div>
                <div className="text-gray-500">Trace ID</div>
                <div className="text-gray-900 break-all">{selectedLog.traceId || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500">Session ID</div>
                <div className="text-gray-900 break-all">{selectedLog.sessionId || '-'}</div>
              </div>
            </div>

            {selectedLog.error?.message && (
              <div className="rounded-md border border-red-200 bg-red-50 p-4">
                <div className="text-sm font-semibold text-red-700">错误信息</div>
                <div className="mt-2 text-sm text-red-600 whitespace-pre-wrap break-all">{selectedLog.error.message}</div>
              </div>
            )}

            <div className="rounded-md border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 font-medium text-gray-900">请求摘要</div>
              <pre className="p-4 text-xs text-gray-700 whitespace-pre-wrap break-all overflow-x-auto">{stringify(selectedLog.request?.summary)}</pre>
            </div>

            <div className="rounded-md border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 font-medium text-gray-900">脱敏上下文</div>
              <pre className="p-4 text-xs text-gray-700 whitespace-pre-wrap break-all overflow-x-auto">{stringify(selectedLog.sanitized?.context)}</pre>
            </div>

            <div className="rounded-md border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 font-medium text-gray-900">脱敏请求</div>
              <pre className="p-4 text-xs text-gray-700 whitespace-pre-wrap break-all overflow-x-auto">{stringify(selectedLog.sanitized?.request)}</pre>
            </div>

            <div className="rounded-md border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 font-medium text-gray-900">脱敏响应</div>
              <pre className="p-4 text-xs text-gray-700 whitespace-pre-wrap break-all overflow-x-auto">{stringify(selectedLog.sanitized?.response)}</pre>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default AIInteractionLogsPage;
