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

            {/* 文件导入类型操作的详细展示 */}
            {(logDetails.operationType === UserOperationType.UPLOAD_FILE || 
              logDetails.operationType === UserOperationType.IMPORT_MATERIALS) && 
              logDetails.outputData?.files && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                <div className="text-gray-900 font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  文件解析详情
                </div>
                
                {/* 统计摘要 */}
                {logDetails.outputData?.statusSummary && (
                  <div className="flex gap-4 mb-4 text-xs">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                      成功: {logDetails.outputData.statusSummary.completed}
                    </span>
                    {logDetails.outputData.statusSummary.failed > 0 && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                        失败: {logDetails.outputData.statusSummary.failed}
                      </span>
                    )}
                    {logDetails.outputData.statusSummary.processing > 0 && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                        处理中: {logDetails.outputData.statusSummary.processing}
                      </span>
                    )}
                  </div>
                )}

                {/* 文件列表 */}
                <div className="space-y-2 max-h-60 overflow-auto">
                  {logDetails.outputData.files.map((file: any, index: number) => (
                    <div 
                      key={file.documentId || index} 
                      className={`border rounded-md p-3 text-xs ${
                        file.status === 'completed' ? 'bg-white border-gray-200' : 
                        file.status === 'failed' ? 'bg-red-50 border-red-200' : 
                        'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-gray-900 truncate flex-1" title={file.fileName}>
                          {index + 1}. {file.fileName}
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-xs ml-2 ${
                          file.status === 'completed' ? 'bg-green-100 text-green-700' : 
                          file.status === 'failed' ? 'bg-red-100 text-red-700' : 
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {file.status === 'completed' ? '成功' : 
                           file.status === 'failed' ? '失败' : '处理中'}
                        </span>
                      </div>
                      
                      {/* 分类信息 */}
                      {file.classification && (
                        <div className="mb-2">
                          <span className="text-gray-500">分类结果:</span>
                          <span className="ml-1 font-medium text-indigo-600">
                            {file.classification.materialName}
                          </span>
                          {file.classification.confidence !== undefined && (
                            <span className="ml-2 text-gray-400">
                              (置信度: {(file.classification.confidence * 100).toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      )}

                      {/* 提取的结构化数据 */}
                      {file.extractedData && Object.keys(file.extractedData).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <div className="text-gray-500 mb-1">提取数据:</div>
                          <pre className="bg-gray-50 rounded p-2 text-xs overflow-auto max-h-24">
                            {JSON.stringify(file.extractedData, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* 错误信息 */}
                      {file.errorMessage && (
                        <div className="mt-2 text-red-600">
                          错误: {file.errorMessage}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* 完整性检查结果 */}
                {logDetails.outputData?.completeness && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-gray-900 font-medium mb-2">完整性检查</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">完整度:</span>
                        <span className={`ml-1 font-medium ${
                          logDetails.outputData.completeness.isComplete ? 'text-green-600' : 'text-yellow-600'
                        }`}>
                          {logDetails.outputData.completeness.score}%
                          {logDetails.outputData.completeness.isComplete ? ' (完整)' : ' (不完整)'}
                        </span>
                      </div>
                      {logDetails.outputData.completeness.missingMaterials?.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-gray-500">缺失材料:</span>
                          <span className="ml-1 text-red-600">
                            {logDetails.outputData.completeness.missingMaterials.join(', ')}
                          </span>
                        </div>
                      )}
                      {logDetails.outputData.completeness.warnings?.length > 0 && (
                        <div className="col-span-2 mt-1">
                          <span className="text-gray-500">警告:</span>
                          {logDetails.outputData.completeness.warnings.map((warning: string, i: number) => (
                            <div key={i} className="ml-1 text-yellow-600 text-xs">
                              • {warning}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 材料分类统计 */}
                {logDetails.outputData?.classificationSummary && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-gray-900 font-medium mb-2">材料分类统计</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(logDetails.outputData.classificationSummary as Record<string, number>).map(([name, count]) => (
                        <span key={name} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs">
                          {name}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI 审核操作的详细展示 */}
            {(logDetails.operationType === UserOperationType.ANALYZE_DOCUMENT || 
              logDetails.operationType === UserOperationType.QUICK_ANALYZE) && 
              logDetails.outputData && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                <div className="text-gray-900 font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI 审核结果
                </div>
                
                {logDetails.outputData.decision && (
                  <div className="mb-3">
                    <span className="text-gray-500">审核结论:</span>
                    <span className={`ml-2 px-2 py-1 rounded text-sm font-medium ${
                      logDetails.outputData.decision === 'APPROVE' ? 'bg-green-100 text-green-700' :
                      logDetails.outputData.decision === 'REJECT' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {logDetails.outputData.decision === 'APPROVE' ? '✓ 通过' :
                       logDetails.outputData.decision === 'REJECT' ? '✗ 拒赔' :
                       '⚠ 需人工复核'}
                    </span>
                  </div>
                )}

                {logDetails.outputData.amount !== undefined && logDetails.outputData.amount !== null && (
                  <div className="mb-3">
                    <span className="text-gray-500">建议金额:</span>
                    <span className="ml-2 text-lg font-bold text-indigo-600">
                      ¥{Number(logDetails.outputData.amount).toLocaleString()}
                    </span>
                  </div>
                )}

                {logDetails.outputData.reasoning && (
                  <div className="mb-3">
                    <div className="text-gray-500 mb-1">审核意见:</div>
                    <div className="bg-white border border-gray-200 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-32 overflow-auto">
                      {logDetails.outputData.reasoning}
                    </div>
                  </div>
                )}

                {/* 其他字段以 JSON 展示 */}
                {Object.keys(logDetails.outputData).some(k => !['decision', 'amount', 'reasoning'].includes(k)) && (
                  <div>
                    <div className="text-gray-500 mb-1">详细信息:</div>
                    <pre className="bg-white border border-gray-200 rounded p-3 text-xs overflow-auto max-h-32">
                      {JSON.stringify(
                        Object.fromEntries(
                          Object.entries(logDetails.outputData).filter(([k]) => 
                            !['decision', 'amount', 'reasoning'].includes(k)
                          )
                        ), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* 其他操作的输出数据 */}
            {!(logDetails.operationType === UserOperationType.UPLOAD_FILE || 
               logDetails.operationType === UserOperationType.IMPORT_MATERIALS ||
               logDetails.operationType === UserOperationType.ANALYZE_DOCUMENT || 
               logDetails.operationType === UserOperationType.QUICK_ANALYZE) && (
              <div>
                <div className="text-gray-500 mb-1">输出数据</div>
                <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs text-gray-700 overflow-auto max-h-40">{stringify(logDetails.outputData)}</pre>
              </div>
            )}

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
