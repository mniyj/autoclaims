import React, { useEffect, useMemo, useState } from 'react';
import Input from './ui/Input';
import Select from './ui/Select';
import Pagination from './ui/Pagination';
import Modal from './ui/Modal';
import { api } from '../services/api';
import AITraceTimeline from './ai/AITraceTimeline';

const ITEMS_PER_PAGE = 20;
const AI_LOG_PRESET_STORAGE_KEY = 'ai-log-preset';
const AI_LOG_SAVED_VIEWS_STORAGE_KEY = 'ai-log-saved-views';

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
    estimatedCost?: number | null;
  } | null;
  context?: {
    claimCaseId?: string | null;
    taskId?: string | null;
    fileIndex?: number | null;
    voiceSessionId?: string | null;
    companyId?: string | null;
    companyName?: string | null;
    group?: string | null;
  } | null;
  capabilityId?: string | null;
  group?: string | null;
  fallbackInfo?: { from?: string | null; reason?: string | null } | null;
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

const buildDiffRows = (leftValue: unknown, rightValue: unknown) => {
  const leftLines = stringify(leftValue).split('\n');
  const rightLines = stringify(rightValue).split('\n');
  const maxLength = Math.max(leftLines.length, rightLines.length);
  return Array.from({ length: maxLength }, (_, index) => {
    const leftLine = leftLines[index] ?? '';
    const rightLine = rightLines[index] ?? '';
    return {
      index,
      leftLine,
      rightLine,
      changed: leftLine !== rightLine,
    };
  });
};

const compareBadgeLabel = (count: number) => {
  if (count <= 0) return "未选择对比项";
  if (count === 1) return "已选 1 条，再选 1 条";
  return "已选 2 条，可直接查看对比";
};

const sortFocusedTraces = (traces: Array<{ traceId: string; logs: any[] }>, sortKey: string) => {
  const scored = traces.map((trace) => ({
    ...trace,
    totalCost: trace.logs.reduce((sum, item) => sum + (item.tokenUsage?.estimatedCost || 0), 0),
    totalCalls: trace.logs.length,
    latestTimestamp: trace.logs.reduce((latest, item) => {
      const timestamp = new Date(item.timestamp || 0).getTime();
      return Math.max(latest, Number.isNaN(timestamp) ? 0 : timestamp);
    }, 0),
  }));
  return scored.sort((a, b) => {
    if (sortKey === 'calls') return b.totalCalls - a.totalCalls;
    if (sortKey === 'latest') return b.latestTimestamp - a.latestTimestamp;
    return b.totalCost - a.totalCost;
  });
};

const AIInteractionLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogDetail | null>(null);
  const [traceLogs, setTraceLogs] = useState<any[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [focusedTraceIds, setFocusedTraceIds] = useState<string[]>([]);
  const [focusedTraces, setFocusedTraces] = useState<Array<{ traceId: string; logs: any[] }>>([]);
  const [focusedTraceSort, setFocusedTraceSort] = useState<'cost' | 'calls' | 'latest'>('cost');
  const [collapsedTraceIds, setCollapsedTraceIds] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareLogs, setCompareLogs] = useState<any[]>([]);

  const [keyword, setKeyword] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [capabilityFilter, setCapabilityFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [successFilter, setSuccessFilter] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [providers, setProviders] = useState<any[]>([]);
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [savedViews, setSavedViews] = useState<Array<{ id: string; name: string; filters: Record<string, string>; isDefault?: boolean; lastUsedAt?: string | null }>>([]);
  const [savedViewName, setSavedViewName] = useState('');
  const [restoredExternalPreset, setRestoredExternalPreset] = useState(false);

  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  const applyFilterPreset = (preset: Record<string, unknown>) => {
    if (preset.keyword) setKeyword(String(preset.keyword));
    else setKeyword('');
    if (preset.provider) setProviderFilter(String(preset.provider));
    else setProviderFilter('');
    if (preset.model) setModelFilter(String(preset.model));
    else setModelFilter('');
    if (preset.capabilityId) setCapabilityFilter(String(preset.capabilityId));
    else setCapabilityFilter('');
    if (preset.group) setGroupFilter(String(preset.group));
    else setGroupFilter('');
    if (preset.companyName) setCompanyFilter(String(preset.companyName));
    else setCompanyFilter('');
    if (preset.module) setModuleFilter(String(preset.module));
    else setModuleFilter('');
    if (preset.sourceApp) setSourceFilter(String(preset.sourceApp));
    else setSourceFilter('');
    if (preset.success !== undefined && preset.success !== null && preset.success !== '') setSuccessFilter(String(preset.success));
    else setSuccessFilter('');
    if (preset.startTime) setStartTime(String(preset.startTime).slice(0, 10));
    else setStartTime('');
    if (preset.endTime) setEndTime(String(preset.endTime).slice(0, 10));
    else setEndTime('');
    if (Array.isArray(preset.traceIds)) setFocusedTraceIds(preset.traceIds.map((item) => String(item)).filter(Boolean));
    else setFocusedTraceIds([]);
    if (preset.traceId) setSelectedTraceId(String(preset.traceId));
    else setSelectedTraceId(null);
  };

  const currentFilterSnapshot = useMemo(
    () => ({
      keyword,
      provider: providerFilter,
      model: modelFilter,
      capabilityId: capabilityFilter,
      group: groupFilter,
      companyName: companyFilter,
      module: moduleFilter,
      sourceApp: sourceFilter,
      success: successFilter,
      startTime,
      endTime,
    }),
    [capabilityFilter, companyFilter, endTime, groupFilter, keyword, modelFilter, providerFilter, sourceFilter, startTime, successFilter, moduleFilter],
  );

  useEffect(() => {
    Promise.all([
      api.ai.getProviders().catch(() => []),
      api.ai.getCapabilities().catch(() => []),
      api.companies.list().catch(() => []),
    ])
      .then(([providerList, capabilityList, companyList]) => {
        setProviders(providerList);
        setCapabilities(capabilityList);
        setCompanies(companyList);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    api.ai.getLogViews()
      .then((views) => {
        if (Array.isArray(views) && views.length > 0) {
          setSavedViews(views);
          localStorage.setItem(AI_LOG_SAVED_VIEWS_STORAGE_KEY, JSON.stringify(views));
          const defaultView = views.find((view) => view.isDefault);
          if (!restoredExternalPreset && defaultView) {
            applyFilterPreset(defaultView.filters || {});
          }
          return;
        }
        try {
          const rawViews = localStorage.getItem(AI_LOG_SAVED_VIEWS_STORAGE_KEY);
          if (!rawViews) return;
          const parsedViews = JSON.parse(rawViews);
          if (Array.isArray(parsedViews)) {
            setSavedViews(parsedViews);
          }
        } catch (error) {
          console.error('Failed to restore saved AI log views:', error);
          localStorage.removeItem(AI_LOG_SAVED_VIEWS_STORAGE_KEY);
        }
      })
      .catch(() => {
        try {
          const rawViews = localStorage.getItem(AI_LOG_SAVED_VIEWS_STORAGE_KEY);
          if (!rawViews) return;
          const parsedViews = JSON.parse(rawViews);
          if (Array.isArray(parsedViews)) {
            setSavedViews(parsedViews);
          }
        } catch (error) {
          console.error('Failed to restore saved AI log views:', error);
          localStorage.removeItem(AI_LOG_SAVED_VIEWS_STORAGE_KEY);
        }
      });
  }, [restoredExternalPreset]);

  useEffect(() => {
    try {
      const rawPreset = sessionStorage.getItem(AI_LOG_PRESET_STORAGE_KEY);
      if (!rawPreset) return;
      const preset = JSON.parse(rawPreset);
      sessionStorage.removeItem(AI_LOG_PRESET_STORAGE_KEY);
      setRestoredExternalPreset(true);
      applyFilterPreset(preset);
    } catch (error) {
      console.error("Failed to restore AI log preset:", error);
      sessionStorage.removeItem(AI_LOG_PRESET_STORAGE_KEY);
    }
  }, []);

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
          provider: providerFilter || undefined,
          model: modelFilter || undefined,
          capabilityId: capabilityFilter || undefined,
          group: groupFilter || undefined,
          companyName: companyFilter || undefined,
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
  }, [offset, keyword, providerFilter, modelFilter, capabilityFilter, groupFilter, companyFilter, moduleFilter, sourceFilter, successFilter, startTime, endTime]);

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, providerFilter, modelFilter, capabilityFilter, groupFilter, companyFilter, moduleFilter, sourceFilter, successFilter, startTime, endTime]);

  const fetchDetail = async (logId: string) => {
    setSelectedLog(null);
    setTraceLogs([]);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const result = await api.aiInteractionLogs.getById(logId);
      const detail = (result.logs?.[0] || null) as LogDetail | null;
      setSelectedLog(detail);
      if (!detail) {
        setDetailError('未找到对应日志详情');
      } else if (detail.traceId) {
        const traceResult = await api.ai.getTraceById(detail.traceId);
        setTraceLogs(traceResult?.logs || []);
      }
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : '日志详情加载失败');
      setSelectedLog(null);
      setTraceLogs([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const totalPages = useMemo(() => {
    if (totalCount === 0) return 0;
    return Math.ceil(totalCount / ITEMS_PER_PAGE);
  }, [totalCount]);

  const traceSummary = useMemo(() => {
    if (!traceLogs.length) return null;
    const totalCost = traceLogs.reduce((sum, item) => sum + (item.tokenUsage?.estimatedCost || 0), 0);
    const totalDuration = traceLogs.reduce((sum, item) => sum + (item.performance?.durationMs || 0), 0);
    return {
      totalCalls: traceLogs.length,
      totalCost,
      totalDuration,
      successCount: traceLogs.filter((item) => item.success !== false).length,
    };
  }, [traceLogs]);

  useEffect(() => {
    if (!selectedTraceId) {
      setTraceLogs([]);
      return;
    }
    api.ai
      .getTraceById(selectedTraceId)
      .then((result) => setTraceLogs(result?.logs || []))
      .catch(() => setTraceLogs([]));
  }, [selectedTraceId]);

  useEffect(() => {
    if (!focusedTraceIds.length) {
      setFocusedTraces([]);
      return;
    }
    Promise.all(
      focusedTraceIds.slice(0, 5).map(async (traceId) => {
        const result = await api.ai.getTraceById(traceId);
        return {
          traceId,
          logs: result?.logs || [],
        };
      }),
    )
      .then((items) => setFocusedTraces(items.filter((item) => item.logs.length > 0)))
      .catch(() => setFocusedTraces([]));
  }, [focusedTraceIds]);

  useEffect(() => {
    if (focusedTraces.length <= 2) {
      setCollapsedTraceIds([]);
      return;
    }
    setCollapsedTraceIds(focusedTraces.slice(2).map((item) => item.traceId));
  }, [focusedTraces.length]);

  useEffect(() => {
    if (compareIds.length !== 2) {
      setCompareLogs([]);
      return;
    }
    Promise.all(compareIds.map((id) => api.ai.getInvocationById(id)))
      .then((items) => setCompareLogs(items.filter(Boolean)))
      .catch(() => setCompareLogs([]));
  }, [compareIds]);

  const toggleCompare = (logId: string) => {
    setCompareIds((current) => {
      if (current.includes(logId)) return current.filter((id) => id !== logId);
      if (current.length >= 2) return [current[1], logId];
      return [...current, logId];
    });
  };

  const compareRequestRows = useMemo(() => {
    if (compareLogs.length !== 2) return [];
    return buildDiffRows(compareLogs[0]?.request?.summary, compareLogs[1]?.request?.summary);
  }, [compareLogs]);

  const compareResponseRows = useMemo(() => {
    if (compareLogs.length !== 2) return [];
    return buildDiffRows(
      compareLogs[0]?.response?.text || compareLogs[0]?.sanitized?.response,
      compareLogs[1]?.response?.text || compareLogs[1]?.sanitized?.response,
    );
  }, [compareLogs]);

  const sortedFocusedTraces = useMemo(
    () => sortFocusedTraces(focusedTraces, focusedTraceSort),
    [focusedTraces, focusedTraceSort],
  );

  const providerOptions = useMemo(
    () => [
      { label: '全部 Provider', value: '' },
      ...providers.map((provider) => ({
        label: provider.name || provider.id,
        value: provider.id,
      })),
    ],
    [providers],
  );

  const modelOptions = useMemo(
    () => {
      const seen = new Set<string>();
      const options = providers.flatMap((provider) =>
        (provider.availableModels || [provider.defaultModel])
          .filter(Boolean)
          .map((model: string) => ({
            label: `${provider.id} / ${model}`,
            value: model,
          }))
          .filter((option) => {
            if (seen.has(option.label)) return false;
            seen.add(option.label);
            return true;
          }),
      );
      return [{ label: '全部模型', value: '' }, ...options];
    },
    [providers],
  );

  const capabilityOptions = useMemo(
    () => [
      { label: '全部能力', value: '' },
      ...capabilities.map((capability) => ({
        label: `${capability.id}${capability.group ? ` · ${capability.group}` : ''}`,
        value: capability.id,
      })),
    ],
    [capabilities],
  );

  const groupOptions = useMemo(
    () => [
      { label: '全部能力组', value: '' },
      ...Array.from(new Set(capabilities.map((capability) => capability.group).filter(Boolean))).map((group) => ({
        label: String(group),
        value: String(group),
      })),
    ],
    [capabilities],
  );

  const companyOptions = useMemo(
    () => [
      { label: '全部公司', value: '' },
      ...companies
        .map((company) => {
          const companyId = company.code || company.id || company.basicInfo?.companyCode || '';
          const companyName = company.shortName || company.fullName || company.basicInfo?.companyName || companyId;
          return {
            label: companyName ? `${companyName}${companyId && companyId !== companyName ? ` (${companyId})` : ''}` : companyId,
            value: companyName || companyId,
          };
        })
        .filter((item) => item.value),
    ],
    [companies],
  );

  const moduleOptions = useMemo(
    () => [
      { label: '全部模块', value: '' },
      ...Array.from(new Set(capabilities.map((capability) => capability.module).filter(Boolean))).map((module) => ({
        label: String(module),
        value: String(module),
      })),
    ],
    [capabilities],
  );

  const toggleFocusedTraceCollapse = (traceId: string) => {
    setCollapsedTraceIds((current) =>
      current.includes(traceId)
        ? current.filter((item) => item !== traceId)
        : [...current, traceId],
    );
  };

  const syncSavedViews = (views: Array<{ id: string; name: string; filters: Record<string, string>; isDefault?: boolean; lastUsedAt?: string | null }>) => {
    setSavedViews(views);
    localStorage.setItem(AI_LOG_SAVED_VIEWS_STORAGE_KEY, JSON.stringify(views));
  };

  const saveCurrentView = () => {
    const name = savedViewName.trim();
    if (!name) return;
    const existing = savedViews.find((view) => view.name === name);
    const nextViews = [
      {
        id: existing?.id || `view-${Date.now()}`,
        name,
        filters: currentFilterSnapshot,
        isDefault: existing?.isDefault || false,
        lastUsedAt: existing?.lastUsedAt || null,
      },
      ...savedViews.filter((view) => view.name !== name),
    ].slice(0, 8);
    syncSavedViews(nextViews);
    setSavedViewName('');
    api.ai.saveLogView({ id: existing?.id, name, filters: currentFilterSnapshot, isDefault: existing?.isDefault || false }).catch((error) => {
      console.error('Failed to save AI log view to server:', error);
    });
  };

  const applySavedView = (view: { id: string; name: string; filters: Record<string, string>; isDefault?: boolean; lastUsedAt?: string | null }) => {
    applyFilterPreset(view.filters);
    const now = new Date().toISOString();
    const nextViews = savedViews
      .map((item) => (item.id === view.id ? { ...item, lastUsedAt: now } : item))
      .sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return new Date(b.lastUsedAt || 0).getTime() - new Date(a.lastUsedAt || 0).getTime();
      });
    syncSavedViews(nextViews);
    api.ai.saveLogView({ ...view, lastUsedAt: now }).catch((error) => {
      console.error('Failed to update AI log view usage:', error);
    });
  };

  const setDefaultView = (viewId: string) => {
    const nextViews = savedViews.map((view) => ({
      ...view,
      isDefault: view.id === viewId,
    }));
    syncSavedViews(nextViews);
    const target = nextViews.find((view) => view.id === viewId);
    if (target) {
      api.ai.saveLogView(target).catch((error) => {
        console.error('Failed to set default AI log view:', error);
      });
    }
  };

  const deleteSavedView = (viewId: string) => {
    const nextViews = savedViews.filter((view) => view.id !== viewId);
    syncSavedViews(nextViews);
    api.ai.deleteLogView(viewId).catch((error) => {
      console.error('Failed to delete AI log view from server:', error);
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-slate-900">AI 交互日志</h1>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          审计中心直接读取原始 AI 调用日志，不依赖统计快照。这里适合做链路排查、入参出参核对和 trace 级审计；
          驾驶舱、成本分析、模型运行对比则优先读取日级预聚合快照。
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-900">常用筛选视图</div>
            <div className="mt-1 text-xs text-slate-500">保存当前筛选条件，后续一键恢复排查视角。</div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-[220px]">
              <Input
                id="ai-log-view-name"
                label="视图名称"
                value={savedViewName}
                onChange={(event) => setSavedViewName(event.target.value)}
                placeholder="例如：高成本失败调用"
              />
            </div>
            <button
              type="button"
              onClick={saveCurrentView}
              disabled={!savedViewName.trim()}
              className="h-10 rounded-full bg-slate-900 px-4 text-sm text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              保存当前视图
            </button>
          </div>
        </div>
        {savedViews.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {savedViews.map((view) => (
              <div key={view.id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
                <button
                  type="button"
                  onClick={() => applySavedView(view)}
                  className="text-sm text-slate-700 transition hover:text-brand-blue-700"
                >
                  {view.name}{view.isDefault ? ' · 默认' : ''}
                </button>
                {view.lastUsedAt ? (
                  <span className="text-xs text-slate-400">
                    {new Date(view.lastUsedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setDefaultView(view.id)}
                  className="text-xs text-slate-400 transition hover:text-amber-600"
                >
                  {view.isDefault ? '默认中' : '设默认'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteSavedView(view.id)}
                  className="text-xs text-slate-400 transition hover:text-rose-600"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {focusedTraces.length > 0 ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-sky-900">告警关联 Trace</h2>
              <p className="mt-1 text-sm text-sky-700">已从消息中心或告警入口带入 {focusedTraces.length} 条 Trace，可直接加入对比。</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={focusedTraceSort}
                onChange={(event) => setFocusedTraceSort(event.target.value as 'cost' | 'calls' | 'latest')}
                className="rounded-full border border-sky-300 bg-white px-3 py-1 text-xs text-sky-700 outline-none"
              >
                <option value="cost">按成本排序</option>
                <option value="calls">按调用次数排序</option>
                <option value="latest">按最近时间排序</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setFocusedTraceIds([]);
                  setFocusedTraces([]);
                }}
                className="rounded-full border border-sky-300 px-3 py-1 text-xs text-sky-700 transition hover:bg-white"
              >
                清空关联 Trace
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {sortedFocusedTraces.map((trace) => {
              const totalCost = trace.logs.reduce((sum, item) => sum + (item.tokenUsage?.estimatedCost || 0), 0);
              const isCollapsed = collapsedTraceIds.includes(trace.traceId);
              return (
                <div key={trace.traceId} className="rounded-2xl border border-sky-100 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{trace.traceId}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {trace.logs.length} 次调用 · ${totalCost.toFixed(4)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleFocusedTraceCollapse(trace.traceId)}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
                      >
                        {isCollapsed ? '展开' : '折叠'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTraceId(trace.traceId)}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
                      >
                        查看 Trace 详情
                      </button>
                    </div>
                  </div>
                  {!isCollapsed ? <AITraceTimeline logs={trace.logs} compareIds={compareIds} onToggleCompare={toggleCompare} /> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Input
            id="ai-log-keyword"
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="日志ID、案件ID、任务ID、traceId"
          />
          <Select id="ai-log-provider" label="Provider" value={providerFilter} options={providerOptions} onChange={setProviderFilter} />
          <Select id="ai-log-model" label="模型" value={modelFilter} options={modelOptions} onChange={setModelFilter} />
          <Select id="ai-log-capability" label="能力" value={capabilityFilter} options={capabilityOptions} onChange={setCapabilityFilter} />
          <Select id="ai-log-group" label="能力组" value={groupFilter} options={groupOptions} onChange={setGroupFilter} />
          <Select id="ai-log-company" label="客户公司" value={companyFilter} options={companyOptions} onChange={setCompanyFilter} />
          <Select id="ai-log-module" label="模块" value={moduleFilter} options={moduleOptions} onChange={setModuleFilter} />
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
          <div>
            <h2 className="text-base font-semibold text-gray-900">日志列表</h2>
            <div className="mt-1 text-xs text-gray-500">当前列表展示的是原始调用日志明细，适合和快照报表交叉核对。</div>
          </div>
          <span className="text-xs text-gray-500">共 {totalCount} 条</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">对比</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">时间</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">模块 / 操作</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">模型</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">关联信息</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">结果</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">耗时</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Token</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">费用</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-sm text-gray-500">加载中...</td>
                </tr>
              ) : errorMessage ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-sm text-red-500">{errorMessage}</td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={compareIds.includes(log.id)}
                        onChange={() => toggleCompare(log.id)}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDateTime(log.timestamp)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 min-w-[220px]">
                      <div className="font-medium text-gray-900">{moduleLabel(log.module)}</div>
                      <div className="text-xs text-gray-500 mt-1">{log.operation || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 min-w-[180px]">
                      <div>{log.provider || '-'} / {log.model || '-'}</div>
                      <div className="text-xs text-gray-400 mt-1">{log.sourceApp || '-'} · {log.capabilityId || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 min-w-[220px]">
                      <div>案件: {log.context?.claimCaseId || '-'}</div>
                      <div className="text-xs text-gray-500 mt-1">任务: {log.context?.taskId || '-'}</div>
                      <div className="text-xs text-gray-500 mt-1">公司: {log.context?.companyName || log.context?.companyId || '-'}</div>
                      <button
                        type="button"
                        onClick={() => setSelectedTraceId(log.traceId || null)}
                        className="mt-1 text-left text-xs text-brand-blue-600 hover:text-brand-blue-700"
                      >
                        Trace: {log.traceId || '-'}
                      </button>
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
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">${(log.tokenUsage?.estimatedCost || 0).toFixed(4)}</td>
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
                  <td colSpan={10} className="px-6 py-10 text-center text-sm text-gray-500">暂无日志数据</td>
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

        {compareIds.length > 0 && (
          <div className="border-t border-gray-200 bg-slate-50 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-slate-600">
                已选择 {compareIds.length}/2 条调用用于对比
              </div>
              <button
                type="button"
                onClick={() => setCompareIds([])}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:bg-white"
              >
                清空选择
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(selectedLog) || detailLoading || Boolean(detailError)}
        onClose={() => {
          setSelectedLog(null);
          setDetailError(null);
          setTraceLogs([]);
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
                <div className="text-gray-900">{selectedLog.provider || '-'} / {selectedLog.model || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500">结果</div>
                <div className="text-gray-900">{selectedLog.success === false ? '失败' : '成功'}</div>
              </div>
              <div>
                <div className="text-gray-500">能力</div>
                <div className="text-gray-900">{selectedLog.capabilityId || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500">费用</div>
                <div className="text-gray-900">${(selectedLog.tokenUsage?.estimatedCost || 0).toFixed(4)}</div>
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

            {selectedLog.fallbackInfo ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-semibold text-amber-700">Fallback 信息</div>
                <div className="mt-2 text-sm text-amber-700 whitespace-pre-wrap break-all">
                  {selectedLog.fallbackInfo.from} / {selectedLog.fallbackInfo.reason || '-'}
                </div>
              </div>
            ) : null}

            {selectedLog.traceId ? (
              <div className="rounded-md border border-gray-200">
                <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="font-medium text-gray-900">调用链预览</div>
                  <button
                    type="button"
                    onClick={() => setSelectedTraceId(selectedLog.traceId || null)}
                    className="text-xs text-brand-blue-600 hover:text-brand-blue-700"
                  >
                    查看完整 Trace
                  </button>
                </div>
                <div className="p-4">
                  <AITraceTimeline logs={traceLogs} compareIds={compareIds} onToggleCompare={toggleCompare} />
                </div>
              </div>
            ) : null}

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

      <Modal
        isOpen={Boolean(selectedTraceId)}
        onClose={() => setSelectedTraceId(null)}
        title="Trace 详情"
        width="max-w-5xl"
      >
        {selectedTraceId ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Trace ID</div>
                <div className="mt-2 break-all text-sm font-medium text-slate-900">{selectedTraceId}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">调用次数</div>
                <div className="mt-2 text-sm font-medium text-slate-900">{traceSummary?.totalCalls || 0}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">总耗时</div>
                <div className="mt-2 text-sm font-medium text-slate-900">{traceSummary?.totalDuration || 0}ms</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">总费用</div>
                <div className="mt-2 text-sm font-medium text-slate-900">${(traceSummary?.totalCost || 0).toFixed(4)}</div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm text-slate-600">{compareBadgeLabel(compareIds.length)}</div>
              {compareIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setCompareIds([])}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:bg-white"
                >
                  清空对比
                </button>
              ) : null}
            </div>
            <AITraceTimeline logs={traceLogs} compareIds={compareIds} onToggleCompare={toggleCompare} />
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={compareLogs.length === 2}
        onClose={() => {
          setCompareIds([]);
          setCompareLogs([]);
        }}
        title="调用对比"
        width="max-w-6xl"
      >
        {compareLogs.length === 2 ? (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {compareLogs.map((log, index) => (
                <div key={log.id || index} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{log.provider || "-"} / {log.model || "-"}</div>
                      <div className="mt-1 text-xs text-slate-500">{log.capabilityId || log.context?.capabilityId || "-"}</div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>{log.performance?.durationMs || 0}ms</div>
                      <div>${(log.tokenUsage?.estimatedCost || 0).toFixed(4)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">请求摘要 Diff</div>
                <div className="text-xs text-slate-500">高亮行为存在差异的行</div>
              </div>
              <div className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 lg:grid-cols-2">
                <div className="bg-white">
                  <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">调用 A</div>
                  <div className="max-h-72 overflow-auto font-mono text-xs">
                    {compareRequestRows.map((row) => (
                      <div key={`request-left-${row.index}`} className={`whitespace-pre-wrap break-all px-3 py-1.5 ${row.changed ? 'bg-amber-50 text-slate-900' : 'bg-white text-slate-600'}`}>
                        {row.leftLine || ' '}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white">
                  <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">调用 B</div>
                  <div className="max-h-72 overflow-auto font-mono text-xs">
                    {compareRequestRows.map((row) => (
                      <div key={`request-right-${row.index}`} className={`whitespace-pre-wrap break-all px-3 py-1.5 ${row.changed ? 'bg-amber-50 text-slate-900' : 'bg-white text-slate-600'}`}>
                        {row.rightLine || ' '}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">响应文本 Diff</div>
                <div className="text-xs text-slate-500">按行并排对比输出差异</div>
              </div>
              <div className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 lg:grid-cols-2">
                <div className="bg-slate-950">
                  <div className="border-b border-slate-800 px-3 py-2 text-xs font-semibold text-slate-400">调用 A</div>
                  <div className="max-h-96 overflow-auto font-mono text-xs">
                    {compareResponseRows.map((row) => (
                      <div key={`response-left-${row.index}`} className={`whitespace-pre-wrap break-all px-3 py-1.5 ${row.changed ? 'bg-slate-900 text-amber-200' : 'bg-slate-950 text-slate-300'}`}>
                        {row.leftLine || ' '}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-950">
                  <div className="border-b border-slate-800 px-3 py-2 text-xs font-semibold text-slate-400">调用 B</div>
                  <div className="max-h-96 overflow-auto font-mono text-xs">
                    {compareResponseRows.map((row) => (
                      <div key={`response-right-${row.index}`} className={`whitespace-pre-wrap break-all px-3 py-1.5 ${row.changed ? 'bg-slate-900 text-amber-200' : 'bg-slate-950 text-slate-300'}`}>
                        {row.rightLine || ' '}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default AIInteractionLogsPage;
