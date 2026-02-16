import React, { useEffect, useMemo, useState } from 'react';
import Pagination from './ui/Pagination';
import Input from './ui/Input';
import Select from './ui/Select';
import Modal from './ui/Modal';
import { api } from '../services/api';
import { UserOperationLog, UserOperationType } from '../types';

const ITEMS_PER_PAGE = 10;

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatDuration = (duration?: number) => {
  if (duration === undefined || duration === null) return '-';
  return `${Math.round(duration)}ms`;
};

const stringify = (value: any) => {
  if (!value) return '-';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const UserOperationLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<UserOperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [operationType, setOperationType] = useState('');
  const [successFilter, setSuccessFilter] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<UserOperationLog | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await api.userOperationLogs.list() as UserOperationLog[];
        const sorted = [...data].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        setLogs(sorted);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '日志加载失败');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const keyword = searchQuery.trim();
      const matchesKeyword = !keyword || [
        log.userName,
        log.operationLabel,
        log.claimId,
        log.claimReportNumber
      ].some(value => value && value.toLowerCase().includes(keyword.toLowerCase()));

      const logDate = log.timestamp?.split('T')[0] || '';
      const matchesStart = !startDate || logDate >= startDate;
      const matchesEnd = !endDate || logDate <= endDate;

      const matchesType = !operationType || log.operationType === operationType;
      const matchesSuccess = !successFilter || (successFilter === 'success' ? log.success : !log.success);
      const matchesDevice = !deviceFilter || log.deviceType === deviceFilter;

      return matchesKeyword && matchesStart && matchesEnd && matchesType && matchesSuccess && matchesDevice;
    });
  }, [logs, searchQuery, startDate, endDate, operationType, successFilter, deviceFilter]);

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, startDate, endDate, operationType, successFilter, deviceFilter]);

  const renderStatus = (success: boolean) => {
    return success ? (
      <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 text-xs">成功</span>
    ) : (
      <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100 text-xs">失败</span>
    );
  };

  const logDetails = selectedLog;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">用户操作日志</h1>

      <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            id="log-search"
            label="关键词"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="用户、操作、报案号"
          />
          <Select
            id="log-type"
            label="操作类型"
            value={operationType}
            onChange={e => setOperationType(e.target.value)}
          >
            <option value="">全部类型</option>
            {Object.values(UserOperationType).map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </Select>
          <Select
            id="log-success"
            label="执行结果"
            value={successFilter}
            onChange={e => setSuccessFilter(e.target.value)}
          >
            <option value="">全部结果</option>
            <option value="success">成功</option>
            <option value="failed">失败</option>
          </Select>
          <Select
            id="log-device"
            label="设备类型"
            value={deviceFilter}
            onChange={e => setDeviceFilter(e.target.value)}
          >
            <option value="">全部设备</option>
            <option value="desktop">桌面端</option>
            <option value="mobile">移动端</option>
            <option value="tablet">平板</option>
          </Select>
          <div className="space-y-1">
            <label htmlFor="log-start" className="block text-sm font-medium text-gray-700">开始日期</label>
            <input
              id="log-start"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full h-9 px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="log-end" className="block text-sm font-medium text-gray-700">结束日期</label>
            <input
              id="log-end"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full h-9 px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">日志列表</h2>
          <span className="text-xs text-gray-500">共 {filteredLogs.length} 条</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">时间</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">用户</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">操作类型</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">操作描述</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">案件</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">结果</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">耗时</th>
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
              ) : paginatedLogs.length > 0 ? (
                paginatedLogs.map(log => (
                  <tr key={log.logId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDateTime(log.timestamp)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{log.userName || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{log.operationType}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 max-w-[200px] truncate" title={log.operationLabel}>{log.operationLabel}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{log.claimId || log.claimReportNumber || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">{renderStatus(log.success)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDuration(log.duration)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
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
            totalItems={filteredLogs.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </div>

      <Modal
        isOpen={Boolean(logDetails)}
        onClose={() => setSelectedLog(null)}
        title="日志详情"
      >
        {logDetails && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-gray-500">时间</div>
                <div className="text-gray-900">{formatDateTime(logDetails.timestamp)}</div>
              </div>
              <div>
                <div className="text-gray-500">用户</div>
                <div className="text-gray-900">{logDetails.userName}</div>
              </div>
              <div>
                <div className="text-gray-500">操作类型</div>
                <div className="text-gray-900">{logDetails.operationType}</div>
              </div>
              <div>
                <div className="text-gray-500">操作结果</div>
                <div className="text-gray-900">{logDetails.success ? '成功' : '失败'}</div>
              </div>
              <div>
                <div className="text-gray-500">会话ID</div>
                <div className="text-gray-900 break-all">{logDetails.sessionId || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500">设备类型</div>
                <div className="text-gray-900">{logDetails.deviceType || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500">案件编号</div>
                <div className="text-gray-900">{logDetails.claimId || logDetails.claimReportNumber || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500">耗时</div>
                <div className="text-gray-900">{formatDuration(logDetails.duration)}</div>
              </div>
            </div>

            <div>
              <div className="text-gray-500 mb-1">操作描述</div>
              <div className="text-gray-900">{logDetails.operationLabel}</div>
            </div>

            <div>
              <div className="text-gray-500 mb-1">输入数据</div>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs text-gray-700 overflow-auto max-h-40">{stringify(logDetails.inputData)}</pre>
            </div>

            <div>
              <div className="text-gray-500 mb-1">输出数据</div>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs text-gray-700 overflow-auto max-h-40">{stringify(logDetails.outputData)}</pre>
            </div>

            <div>
              <div className="text-gray-500 mb-1">AI交互记录</div>
              {logDetails.aiInteractions && logDetails.aiInteractions.length > 0 ? (
                <div className="space-y-2">
                  {logDetails.aiInteractions.map((item, index) => (
                    <div key={`${item.model}-${index}`} className="border border-gray-200 rounded-md p-3 bg-white">
                      <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-2">
                        <span>模型: {item.model}</span>
                        <span>耗时: {formatDuration(item.duration)}</span>
                        <span>时间: {formatDateTime(item.timestamp)}</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div>
                          <div className="text-gray-500">Prompt</div>
                          <textarea
                            readOnly
                            value={item.prompt}
                            className="w-full bg-gray-50 border border-gray-200 rounded-md p-2 text-gray-700 overflow-auto text-xs max-h-32"
                          />
                        </div>
                        <div>
                          <div className="text-gray-500">Response</div>
                          <pre className="bg-gray-50 border border-gray-200 rounded-md p-2 text-gray-700 overflow-auto max-h-32">{item.response}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-400 text-sm">无AI调用记录</div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserOperationLogsPage;
