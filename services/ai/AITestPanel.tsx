import React, { useState, useEffect } from 'react';
import { aiService, aiConfigManager, aiInvocationStore, AIInvocationRecord, AIProviderType } from './aiService';
import { GeminiProvider } from './providers/geminiProvider';
import { ClaudeProvider } from './providers/claudeProvider';

// 注册 Provider
aiService.registerProvider(new GeminiProvider());
aiService.registerProvider(new ClaudeProvider());

interface AITestPanelProps {
  onClose: () => void;
}

export const AITestPanel: React.FC<AITestPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'config' | 'test' | 'records' | 'stats'>('config');
  const [records, setRecords] = useState<AIInvocationRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  // Config state
  const [geminiKey, setGeminiKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [currentProvider, setCurrentProvider] = useState<AIProviderType>('gemini');
  const [abTestEnabled, setAbTestEnabled] = useState(false);
  
  // Test state
  const [testPrompt, setTestPrompt] = useState('识别这张医疗发票，提取患者姓名、金额、医院名称');
  const [testImage, setTestImage] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  useEffect(() => {
    // Load initial data
    setRecords(aiInvocationStore.getRecords());
    setStats(aiInvocationStore.getStats());
    
    // Subscribe to updates
    const unsubscribe = aiInvocationStore.subscribe((newRecords) => {
      setRecords(newRecords);
      setStats(aiInvocationStore.getStats());
    });
    
    // Load saved config
    const geminiConfig = aiConfigManager.getProviderConfig('gemini');
    const claudeConfig = aiConfigManager.getProviderConfig('claude');
    if (geminiConfig) setGeminiKey(geminiConfig.apiKey);
    if (claudeConfig) setClaudeKey(claudeConfig.apiKey);
    setCurrentProvider(aiConfigManager.getCurrentProvider());
    setAbTestEnabled(aiConfigManager.isABTestMode());
    
    return unsubscribe;
  }, []);

  const saveConfig = () => {
    aiConfigManager.setProviderConfig({
      name: 'gemini',
      apiKey: geminiKey,
      model: 'gemini-2.5-flash',
    });
    aiConfigManager.setProviderConfig({
      name: 'claude',
      apiKey: claudeKey,
      model: 'claude-3-sonnet-20250219',
    });
    aiConfigManager.setCurrentProvider(currentProvider);
    
    if (abTestEnabled) {
      aiConfigManager.enableABTest(['gemini', 'claude']);
    } else {
      aiConfigManager.disableABTest();
    }
    
    alert('配置已保存');
  };

  const runTest = async () => {
    setIsTesting(true);
    setTestResults(null);
    
    try {
      const result = await aiService.invoke('test', testPrompt, {
        compareWith: abTestEnabled ? ['claude'] : undefined,
      });
      setTestResults(result);
    } catch (error) {
      alert('测试失败: ' + (error as Error).message);
    } finally {
      setIsTesting(false);
    }
  };

  const exportCSV = () => {
    const csv = aiInvocationStore.exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-test-records-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const updateAccuracy = (recordId: string, accuracy: number) => {
    aiInvocationStore.updateAccuracy(recordId, accuracy);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold">AI 测试与对比面板</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {[
            { id: 'config', label: '配置' },
            { id: 'test', label: '测试' },
            { id: 'records', label: '记录' },
            { id: 'stats', label: '统计' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 font-medium ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Config Tab */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-4">Gemini 配置</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                      <input
                        type="password"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="输入 Gemini API Key"
                      />
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-4">Claude 配置</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                      <input
                        type="password"
                        value={claudeKey}
                        onChange={(e) => setClaudeKey(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="输入 Claude API Key"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-4">测试模式</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">当前 Provider</label>
                    <select
                      value={currentProvider}
                      onChange={(e) => setCurrentProvider(e.target.value as AIProviderType)}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="gemini">Gemini</option>
                      <option value="claude">Claude</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="abTest"
                      checked={abTestEnabled}
                      onChange={(e) => setAbTestEnabled(e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor="abTest" className="text-sm">
                      启用 A/B 测试模式（同时调用多个 AI 进行对比）
                    </label>
                  </div>
                </div>
              </div>

              <button
                onClick={saveConfig}
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                保存配置
              </button>
            </div>
          )}

          {/* Test Tab */}
          {activeTab === 'test' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">测试 Prompt</label>
                <textarea
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md h-24"
                  placeholder="输入测试用的 prompt"
                />
              </div>

              <button
                onClick={runTest}
                disabled={isTesting}
                className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
              >
                {isTesting ? '测试中...' : '运行测试'}
              </button>

              {testResults && (
                <div className="space-y-4">
                  <h3 className="font-semibold">测试结果</h3>
                  
                  {testResults.comparison && (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {testResults.comparison.providers.map((p: any, idx: number) => (
                        <div key={idx} className="border rounded-lg p-4">
                          <h4 className="font-medium">{p.provider}</h4>
                          <div className="text-sm text-gray-600 mt-2">
                            <p>耗时: {p.latency}ms</p>
                            <p>成本: ${p.cost.toFixed(6)}</p>
                            <p>状态: {p.success ? '成功' : '失败'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border rounded-lg p-4 bg-gray-50">
                    <h4 className="font-medium mb-2">输出结果</h4>
                    <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(testResults.result, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Records Tab */}
          {activeTab === 'records' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">调用记录 ({records.length})</h3>
                <button
                  onClick={exportCSV}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                  导出 CSV
                </button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">时间</th>
                      <th className="px-4 py-2 text-left">Provider</th>
                      <th className="px-4 py-2 text-left">任务</th>
                      <th className="px-4 py-2 text-left">耗时</th>
                      <th className="px-4 py-2 text-left">成本</th>
                      <th className="px-4 py-2 text-left">准确性</th>
                      <th className="px-4 py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(-20).reverse().map((record) => (
                      <tr key={record.id} className="border-t">
                        <td className="px-4 py-2">{new Date(record.timestamp).toLocaleTimeString()}</td>
                        <td className="px-4 py-2">{record.provider}</td>
                        <td className="px-4 py-2">{record.task}</td>
                        <td className="px-4 py-2">{record.metrics.latency}ms</td>
                        <td className="px-4 py-2">${record.metrics.cost.toFixed(6)}</td>
                        <td className="px-4 py-2">
                          {record.accuracy !== undefined ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                              {record.accuracy}/5
                            </span>
                          ) : (
                            <span className="text-gray-400">未评分</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <select
                            onChange={(e) => updateAccuracy(record.id, parseInt(e.target.value))}
                            className="text-xs border rounded"
                            defaultValue=""
                          >
                            <option value="" disabled>评分</option>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>{n}分</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-gray-500">总调用次数</div>
                  <div className="text-2xl font-bold">{stats.totalCalls}</div>
                </div>
              </div>

              {Object.keys(stats.byProvider).length > 0 && (
                <div>
                  <h3 className="font-semibold mb-4">Provider 对比</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(stats.byProvider).map(([provider, data]: [string, any]) => (
                      <div key={provider} className="border rounded-lg p-4">
                        <h4 className="font-medium capitalize">{provider}</h4>
                        <div className="mt-2 space-y-1 text-sm">
                          <p>调用次数: {data.calls}</p>
                          <p>平均耗时: {data.avgLatency}ms</p>
                          <p>平均成本: ${data.avgCost.toFixed(6)}</p>
                          <p>成功率: {data.successRate.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(stats.byTask).length > 0 && (
                <div>
                  <h3 className="font-semibold mb-4">任务准确性</h3>
                  <div className="border rounded-lg p-4">
                    {Object.entries(stats.byTask).map(([task, data]: [string, any]) => (
                      <div key={task} className="flex justify-between py-2 border-b last:border-0">
                        <span>{task}</span>
                        <span className="text-sm text-gray-600">
                          {data.calls} 次调用
                          {data.avgAccuracy > 0 && ` · 平均准确性 ${data.avgAccuracy.toFixed(1)}/5`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
