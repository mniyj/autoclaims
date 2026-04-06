import { useState, useEffect } from 'react';
import { type ClaimCase } from '../types';
import { api } from '../services/api';

interface Message {
  id: string;
  type: string;
  title: string;
  content: string;
  data: {
    taskId?: string;
    claimCaseId?: string;
    status?: string;
    action?: string;
    failureCategory?: string;
    failureHint?: string;
    incidentId?: string;
    traceIds?: string[];
  };
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

interface MessageCenterProps {
  onOpenClaim?: (claim: ClaimCase) => void | Promise<void>;
}

export function MessageCenter({ onOpenClaim }: MessageCenterProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [recoveringTaskId, setRecoveringTaskId] = useState<string | null>(null);
  const [aiIncidents, setAiIncidents] = useState<any[]>([]);
  const [incidentUpdatingId, setIncidentUpdatingId] = useState<string | null>(null);
  const pageSize = 20;
  const navigateToAIAudit = (traceIds: string[] = []) => {
    sessionStorage.setItem(
      'ai-log-preset',
      JSON.stringify({
        traceIds,
        traceId: traceIds[0] || '',
      }),
    );
    window.dispatchEvent(new CustomEvent('app:navigate', { detail: { view: 'ai_interaction_logs' } }));
    setSelectedMessage(null);
  };
  const navigateToAIAlerts = () => {
    window.dispatchEvent(new CustomEvent('app:navigate', { detail: { view: 'ai_alerts' } }));
    setSelectedMessage(null);
  };

  useEffect(() => {
    fetchMessages();
    fetchUnreadCount();
    fetchAIIncidents();
  }, [page, filter]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      const isReadParam = filter === 'unread' ? 'false' : filter === 'read' ? 'true' : '';
      const url = `/api/messages?limit=${pageSize}&offset=${offset}${isReadParam ? `&isRead=${isReadParam}` : ''}`;
      
      const res = await fetch(url, {
        headers: { 'x-user-id': getUserId() },
      });
      const data = await res.json();
      
      if (data.success) {
        setMessages(data.data);
        setTotal(data.meta.total);
      }
    } catch {}
    setLoading(false);
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('/api/messages/unread-count', {
        headers: { 'x-user-id': getUserId() },
      });
      const data = await res.json();
      if (data.success) {
        setUnreadCount(data.data.count);
      }
    } catch {}
  };

  const fetchAIIncidents = async () => {
    try {
      const result = await api.ai.getAlerts();
      setAiIncidents((result?.incidents || []).filter((item: any) => item.status !== 'resolved'));
    } catch {
      setAiIncidents([]);
    }
  };

  const handleIncidentStatus = async (incidentId: string, status: string) => {
    setIncidentUpdatingId(incidentId);
    try {
      await api.ai.updateIncidentStatus(incidentId, status);
      await fetchAIIncidents();
    } catch (error) {
      console.error("Failed to update AI incident status:", error);
    } finally {
      setIncidentUpdatingId(null);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      await fetch(`/api/messages/${messageId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': getUserId(),
        },
        body: JSON.stringify({}),
      });
      fetchMessages();
      fetchUnreadCount();
    } catch {}
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/messages/read-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': getUserId(),
        },
        body: JSON.stringify({}),
      });
      fetchMessages();
      fetchUnreadCount();
    } catch {}
  };

  const deleteMessage = async (messageId: string) => {
    try {
      await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': getUserId() },
      });
      fetchMessages();
    } catch {}
  };

  const handleOpenClaim = async (claimCaseId?: string) => {
    if (!claimCaseId || !onOpenClaim) return;

    try {
      const claim = await fetch(`/api/claim-cases/${claimCaseId}`).then((res) => res.json());
      if (claim?.id) {
        await onOpenClaim(claim as ClaimCase);
        setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Failed to open claim from message center:', error);
    }
  };

  const handleRecoverTask = async (message: Message) => {
    const taskId = message.data?.taskId;
    if (!taskId || recoveringTaskId) return;

    setRecoveringTaskId(taskId);
    try {
      const response = await fetch('/api/offline-import/recover-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': getUserId(),
        },
        body: JSON.stringify({ taskId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || '恢复任务失败');
      }
      await fetchMessages();
      await fetchUnreadCount();
      setSelectedMessage(null);
    } catch (error) {
      console.error('Failed to recover task from message center:', error);
      alert(error instanceof Error ? error.message : '恢复任务失败');
    } finally {
      setRecoveringTaskId(null);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'task_complete':
        return <span className="text-green-500">✓</span>;
      case 'task_failed':
        return <span className="text-red-500">✗</span>;
      case 'task_partial':
        return <span className="text-yellow-500">!</span>;
      case 'task_recovered':
        return <span className="text-indigo-500">↺</span>;
      case 'task_recovery_needed':
        return <span className="text-amber-500">⚠</span>;
      case 'task_recovery_escalated':
        return <span className="text-red-500">‼</span>;
      default:
        return <span className="text-blue-500">i</span>;
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {aiIncidents.length > 0 && (
          <div className="mx-6 mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-amber-900">AI 告警摘要</h2>
                <p className="mt-1 text-sm text-amber-700">当前有 {aiIncidents.length} 条未处理 AI 告警</p>
              </div>
              <button
                type="button"
                onClick={navigateToAIAlerts}
                className="rounded-full border border-amber-300 px-3 py-1 text-xs text-amber-700 transition hover:bg-white"
              >
                打开告警中心
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {aiIncidents.slice(0, 5).map((incident) => (
                <div key={incident.id} className="rounded-xl border border-amber-100 bg-white px-3 py-2 text-sm text-slate-700">
                  <div className="font-medium text-slate-900">{incident.summary}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {incident.severity} · {incident.triggeredAt}
                  </div>
                  <div className="mt-3 flex gap-2">
                    {incident.affectedTraceIds?.length ? (
                      <button
                        type="button"
                        onClick={() => navigateToAIAudit(incident.affectedTraceIds)}
                        className="rounded-full border border-brand-blue-200 px-3 py-1 text-xs text-brand-blue-700 transition hover:bg-brand-blue-50"
                      >
                        查看 Trace
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={incidentUpdatingId === incident.id}
                      onClick={() => void handleIncidentStatus(incident.id, 'acknowledged')}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                    >
                      确认
                    </button>
                    <button
                      type="button"
                      disabled={incidentUpdatingId === incident.id}
                      onClick={() => void handleIncidentStatus(incident.id, 'resolved')}
                      className="rounded-full border border-emerald-300 px-3 py-1 text-xs text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
                    >
                      关闭
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">消息中心</h1>
              <p className="text-gray-500 mt-1">共 {total} 条消息，{unreadCount} 条未读</p>
            </div>
            
            <div className="flex items-center gap-4">
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value as 'all' | 'unread' | 'read');
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">全部消息</option>
                <option value="unread">未读消息</option>
                <option value="read">已读消息</option>
              </select>
              
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  全部已读
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-12 text-center text-gray-500">加载中...</div>
          ) : messages.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p>暂无消息</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-6 hover:bg-gray-50 transition-colors cursor-pointer ${
                  !msg.isRead ? 'bg-blue-50' : ''
                }`}
                onClick={() => {
                  setSelectedMessage(msg);
                  if (!msg.isRead) markAsRead(msg.id);
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                    {getMessageTypeIcon(msg.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{msg.title}</h3>
                        <p className="text-gray-600 mt-1 line-clamp-2">{msg.content}</p>
                        <p className="text-sm text-gray-400 mt-2">{formatTime(msg.createdAt)}</p>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {!msg.isRead && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMessage(msg.id);
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="p-6 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              上一页
            </button>
            
            <span className="text-gray-600">
              第 {page} / {totalPages} 页
            </span>
            
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {selectedMessage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMessage(null)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">{selectedMessage.title}</h2>
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <p className="text-gray-700 whitespace-pre-wrap">{selectedMessage.content}</p>
            
            {selectedMessage.data?.taskId && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">关联任务: {selectedMessage.data.taskId}</p>
                <a
                  href={`#/tasks/${selectedMessage.data.taskId}`}
                  className="inline-block mt-2 text-blue-600 hover:text-blue-800"
                  onClick={() => setSelectedMessage(null)}
                >
                  查看任务详情 →
                </a>
              </div>
            )}

            {selectedMessage.data?.claimCaseId && onOpenClaim && (
              <div className="mt-4 p-4 bg-indigo-50 rounded-lg">
                <p className="text-sm text-indigo-700">
                  关联案件: {selectedMessage.data.claimCaseId}
                </p>
                <button
                  onClick={() => void handleOpenClaim(selectedMessage.data?.claimCaseId)}
                  className="inline-block mt-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                >
                  打开案件 →
                </button>
              </div>
            )}

            {(selectedMessage.type === 'task_recovery_needed' || selectedMessage.type === 'task_recovery_escalated') && selectedMessage.data?.taskId && (
              <div className="mt-4 p-4 bg-amber-50 rounded-lg">
                <p className="text-sm text-amber-700">
                  {selectedMessage.type === 'task_recovery_escalated'
                    ? '该任务已连续恢复失败，建议优先处理。'
                    : '该任务当前支持直接恢复。'}
                </p>
                {selectedMessage.data?.failureHint && (
                  <p className="text-xs text-amber-800 mt-2">
                    失败判断: {selectedMessage.data.failureHint}
                  </p>
                )}
                <button
                  onClick={() => void handleRecoverTask(selectedMessage)}
                  disabled={recoveringTaskId === selectedMessage.data.taskId}
                  className={`inline-block mt-2 text-sm font-medium ${
                    recoveringTaskId === selectedMessage.data.taskId
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-amber-700 hover:text-amber-900'
                  }`}
                >
                  {recoveringTaskId === selectedMessage.data.taskId ? '恢复中...' : '立即恢复任务 →'}
                </button>
              </div>
            )}

            {selectedMessage.data?.traceIds?.length ? (
              <div className="mt-4 rounded-lg bg-sky-50 p-4">
                <p className="text-sm text-sky-700">
                  关联 AI Trace: {selectedMessage.data.traceIds.length} 条
                </p>
                <button
                  onClick={() => navigateToAIAudit(selectedMessage.data?.traceIds || [])}
                  className="mt-2 inline-block text-sm font-medium text-sky-700 hover:text-sky-900"
                >
                  打开审计中心并查看 Trace →
                </button>
              </div>
            ) : null}
            
            <p className="text-sm text-gray-400 mt-6">
              {formatTime(selectedMessage.createdAt)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function getUserId(): string {
  const user = localStorage.getItem('user');
  if (user) {
    try {
      const parsed = JSON.parse(user);
      return parsed.id || 'anonymous';
    } catch {
      return 'anonymous';
    }
  }
  return 'anonymous';
}

export default MessageCenter;
