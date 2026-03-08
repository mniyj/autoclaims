import React, { useState, useEffect } from 'react';
import { type ClaimCase, type ReviewTask, ReviewTaskStatus, ReviewTaskPriority } from '../types';
import { api } from '../services/api';

interface SmartReviewResult {
  decision: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';
  amount: number | null;
  reasoning: string;
  missingMaterials?: string[];
  manualReviewReasons?: Array<{
    code: string;
    stage: string;
    source: string;
    category: string;
    message: string;
  }>;
  eligibility?: {
    eligible: boolean;
    matchedRules: string[];
    rejectionReasons: any[];
    warnings: any[];
    manualReviewReasons?: Array<{
      code: string;
      stage: string;
      source: string;
      category: string;
      message: string;
    }>;
  };
  calculation?: {
    totalClaimable: number;
    deductible: number;
    reimbursementRatio: number;
    finalAmount: number;
    manualReviewReasons?: Array<{
      code: string;
      stage: string;
      source: string;
      category: string;
      message: string;
    }>;
    itemBreakdown: Array<{
      item: string;
      claimed: number;
      approved: number;
      reason: string;
    }>;
  };
  ruleTrace: string[];
  duration: number;
}

interface ClaimWorkbenchPageProps {
  onViewClaim: (claim: ClaimCase) => void;
}

const ClaimWorkbenchPage: React.FC<ClaimWorkbenchPageProps> = ({ onViewClaim }) => {
  const [claims, setClaims] = useState<ClaimCase[]>([]);
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<ClaimCase | null>(null);
  const [selectedTask, setSelectedTask] = useState<ReviewTask | null>(null);
  const [reviewResult, setReviewResult] = useState<SmartReviewResult | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [activeTab, setActiveTab] = useState<'claims' | 'tasks'>('claims');
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('pending');
  const [claimFilter, setClaimFilter] = useState<'all' | 'pending' | 'reviewed' | 'flagged'>('pending');
  
  // 工单处理状态
  const [processingTask, setProcessingTask] = useState(false);
  const [manualInputData, setManualInputData] = useState<Record<string, any>>({});
  const [manualReviewNotes, setManualReviewNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadClaims(), loadReviewTasks()]);
    setLoading(false);
  };

  const loadClaims = async () => {
    try {
      const data = await api.claimCases.list();
      setClaims(data as ClaimCase[]);
    } catch (error) {
      console.error('Failed to load claims:', error);
    }
  };

  const loadReviewTasks = async () => {
    try {
      const response = await fetch('/api/review-tasks');
      const data = await response.json();
      setReviewTasks(data);
    } catch (error) {
      console.error('Failed to load review tasks:', error);
    }
  };

  const handleSmartReview = async (claim: ClaimCase) => {
    setSelectedClaim(claim);
    setReviewing(true);
    setReviewResult(null);

    try {
      const response = await fetch('/api/ai/smart-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimCaseId: claim.id,
          productCode: claim.productCode || 'PROD001',
          ocrData: (claim as any).ocrData || {},
          invoiceItems: claim.calculationItems || []
        })
      });

      const result = await response.json();
      setReviewResult(result);
    } catch (error) {
      console.error('Smart review failed:', error);
      setReviewResult({
        decision: 'MANUAL_REVIEW',
        amount: null,
        reasoning: '智能审核服务异常，请人工处理',
        ruleTrace: [],
        duration: 0
      });
    } finally {
      setReviewing(false);
    }
  };

  const handleProcessTask = async (task: ReviewTask) => {
    setSelectedTask(task);
    setManualInputData(task.aiExtractedData || {});
    setManualReviewNotes('');
  };

  const handleSaveTask = async () => {
    if (!selectedTask) return;
    
    setProcessingTask(true);
    try {
      const response = await fetch(`/api/review-tasks/${selectedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: ReviewTaskStatus.COMPLETED,
          manualInputData,
          manualReviewNotes,
          reviewerId: 'current-user',
          reviewerName: '当前理赔员',
        })
      });

      if (response.ok) {
        await loadReviewTasks();
        setSelectedTask(null);
        alert('工单处理完成');
      } else {
        alert('保存失败');
      }
    } catch (error) {
      console.error('Failed to save task:', error);
      alert('保存失败');
    } finally {
      setProcessingTask(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '已报案': return 'bg-yellow-100 text-yellow-800';
      case '处理中': return 'bg-blue-100 text-blue-800';
      case '待补传': return 'bg-orange-100 text-orange-800';
      case '已结案-给付': return 'bg-green-100 text-green-800';
      case '已结案-拒赔': return 'bg-red-100 text-red-800';
      case '已撤案': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '紧急': return 'bg-red-100 text-red-800';
      case '高': return 'bg-orange-100 text-orange-800';
      case '中': return 'bg-blue-100 text-blue-800';
      case '低': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'APPROVE': return 'text-green-600 bg-green-50 border-green-200';
      case 'REJECT': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-amber-600 bg-amber-50 border-amber-200';
    }
  };

  const getDecisionLabel = (decision: string) => {
    switch (decision) {
      case 'APPROVE': return '✅ 建议通过';
      case 'REJECT': return '❌ 建议拒赔';
      default: return '🔍 需人工复核';
    }
  };

  const filteredClaims = claims.filter(c => {
    if (claimFilter === 'all') return true;
    if (claimFilter === 'pending') return c.status === '已报案' || c.status === '处理中' || c.status === '待补传';
    if (claimFilter === 'reviewed') return c.status === '已结案-给付' || c.status === '已结案-拒赔' || c.status === '已撤案';
    if (claimFilter === 'flagged') return c.fraudFlag || c.manualReviewRequired;
    return true;
  });

  const filteredTasks = reviewTasks.filter(t => {
    if (taskFilter === 'all') return true;
    if (taskFilter === 'pending') return t.status === ReviewTaskStatus.PENDING;
    if (taskFilter === 'in_progress') return t.status === ReviewTaskStatus.IN_PROGRESS;
    if (taskFilter === 'completed') return t.status === ReviewTaskStatus.COMPLETED;
    return true;
  });

  const pendingTaskCount = reviewTasks.filter(t => t.status === ReviewTaskStatus.PENDING).length;

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">理赔员工作台</h1>
            <p className="text-sm text-gray-500 mt-1">AI 智能审核 · 规则引擎驱动</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('claims')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'claims' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              案件审核
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                activeTab === 'tasks' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              人工复核工单
              {pendingTaskCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {pendingTaskCount}
                </span>
              )}
            </button>
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              刷新
            </button>
          </div>
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {activeTab === 'claims' ? (
          <>
            {/* Claims List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  案件列表 <span className="text-sm text-gray-500 font-normal">({filteredClaims.length})</span>
                </h2>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  {(['pending', 'reviewed', 'flagged', 'all'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setClaimFilter(f)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        claimFilter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {f === 'pending' && '待审核'}
                      {f === 'reviewed' && '已审核'}
                      {f === 'flagged' && '风险预警'}
                      {f === 'all' && '全部'}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="bg-white rounded-xl p-12 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-gray-500 mt-4">加载中...</p>
                </div>
              ) : filteredClaims.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center">
                  <p className="text-gray-500">暂无案件</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredClaims.map(claim => (
                    <div
                      key={claim.id}
                      className={`bg-white rounded-xl shadow-sm border p-6 cursor-pointer transition-all hover:shadow-md ${
                        selectedClaim?.id === claim.id ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200'
                      }`}
                      onClick={() => setSelectedClaim(claim)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono text-sm text-gray-500">{claim.reportNumber}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(claim.status)}`}>
                              {claim.status}
                            </span>
                            {claim.fraudFlag && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                ⚠️ 风险
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-gray-900">{claim.insured || '被保人'}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            报案时间: {claim.reportTime} · 事故时间: {claim.accidentTime}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">索赔金额</p>
                          <p className="text-xl font-bold text-gray-900">¥{typeof claim.claimAmount === 'number' ? claim.claimAmount.toLocaleString() : Number(claim.claimAmount || 0).toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSmartReview(claim);
                          }}
                          disabled={reviewing && selectedClaim?.id === claim.id}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {reviewing && selectedClaim?.id === claim.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              AI 审核中...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                              AI 智能审核
                            </>
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewClaim(claim);
                          }}
                          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                        >
                          查看详情
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Review Panel */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">AI 智能审核结论</h2>

              {!selectedClaim ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-gray-500">选择一个案件开始审核</p>
                </div>
              ) : reviewing ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-gray-900 font-medium">AI 正在分析案件...</p>
                  <p className="text-sm text-gray-500 mt-2">正在执行责任判断和金额计算规则</p>
                </div>
              ) : reviewResult ? (
                <div className="space-y-4">
                  {/* Decision Card */}
                  <div className={`rounded-xl border-2 p-6 ${getDecisionColor(reviewResult.decision)}`}>
                    <div className="text-2xl font-bold mb-2">{getDecisionLabel(reviewResult.decision)}</div>
                    {reviewResult.amount !== null && (
                      <div className="text-3xl font-bold">¥{reviewResult.amount.toLocaleString()}</div>
                    )}
                    <div className="text-sm mt-2 opacity-80">处理耗时: {reviewResult.duration}ms</div>
                  </div>

                  {/* Eligibility */}
                  {reviewResult.eligibility && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className={reviewResult.eligibility.eligible ? 'text-green-500' : 'text-red-500'}>●</span>
                        责任判断
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">是否符合责任</span>
                          <span className={`font-medium ${reviewResult.eligibility.eligible ? 'text-green-600' : 'text-red-600'}`}>
                            {reviewResult.eligibility.eligible ? '符合' : '不符合'}
                          </span>
                        </div>
                        {reviewResult.eligibility.matchedRules.length > 0 && (
                          <div>
                            <span className="text-sm text-gray-500">匹配规则:</span>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {reviewResult.eligibility.matchedRules.map((rule, i) => (
                                <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-mono">
                                  {rule}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {reviewResult.eligibility.warnings?.length > 0 && (
                          <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                            <div className="text-sm font-medium text-amber-800 mb-1">⚠️ 风险提示</div>
                            {reviewResult.eligibility.warnings.map((w: any, i: number) => (
                              <div key={i} className="text-sm text-amber-700">{w.message || w}</div>
                            ))}
                          </div>
                        )}
                        {reviewResult.manualReviewReasons && reviewResult.manualReviewReasons.length > 0 && (
                          <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                            <div className="text-sm font-medium text-orange-800 mb-2">🔍 人工复核原因</div>
                            <div className="space-y-2">
                              {reviewResult.manualReviewReasons.map((reason, i) => (
                                <div key={`${reason.code}-${i}`} className="text-sm text-orange-700">
                                  <div className="font-medium">{reason.message}</div>
                                  <div className="text-xs text-orange-600 mt-0.5">
                                    {reason.stage} · {reason.code}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {reviewResult.missingMaterials && reviewResult.missingMaterials.length > 0 && (
                          <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100">
                            <div className="text-sm font-medium text-red-800 mb-2">缺失材料</div>
                            <div className="flex flex-wrap gap-2">
                              {reviewResult.missingMaterials.map((material, i) => (
                                <span key={`${material}-${i}`} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                                  {material}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Calculation */}
                  {reviewResult.calculation && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="font-semibold text-gray-900 mb-4">💰 金额计算</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">可赔付总额</span>
                          <span className="font-medium">¥{reviewResult.calculation.totalClaimable}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">免赔额</span>
                          <span className="font-medium text-red-600">-¥{reviewResult.calculation.deductible}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">赔付比例</span>
                          <span className="font-medium">{(reviewResult.calculation.reimbursementRatio * 100).toFixed(0)}%</span>
                        </div>
                        <div className="border-t pt-3 flex justify-between">
                          <span className="font-semibold text-gray-900">最终金额</span>
                          <span className="font-bold text-lg text-indigo-600">¥{reviewResult.calculation.finalAmount}</span>
                        </div>

                        {reviewResult.calculation.itemBreakdown?.length > 0 && (
                          <div className="mt-4">
                            <div className="text-sm font-medium text-gray-700 mb-2">费用明细</div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {reviewResult.calculation.itemBreakdown.map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                                  <span className="text-gray-600 truncate flex-1">{item.item}</span>
                                  <span className="text-gray-500 mx-2">¥{item.claimed} → </span>
                                  <span className={`font-medium ${item.approved > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    ¥{item.approved}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Reasoning */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">🤖 AI 审核意见</h3>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                      {reviewResult.reasoning}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                      通过
                    </button>
                    <button className="flex-1 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">
                      拒赔
                    </button>
                    <button className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">
                      转人工
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <p className="text-gray-900 font-medium">点击「AI 智能审核」开始</p>
                  <p className="text-sm text-gray-500 mt-2">系统将自动执行责任判断和金额计算</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Review Tasks List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  人工复核工单 <span className="text-sm text-gray-500 font-normal">({filteredTasks.length})</span>
                </h2>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  {(['pending', 'in_progress', 'completed', 'all'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setTaskFilter(f)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        taskFilter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {f === 'pending' && '待处理'}
                      {f === 'in_progress' && '处理中'}
                      {f === 'completed' && '已完成'}
                      {f === 'all' && '全部'}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="bg-white rounded-xl p-12 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-gray-500 mt-4">加载中...</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center">
                  <p className="text-gray-500">暂无需人工复核的工单</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTasks.map(task => (
                    <div
                      key={task.id}
                      className={`bg-white rounded-xl shadow-sm border p-6 cursor-pointer transition-all hover:shadow-md ${
                        selectedTask?.id === task.id ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200'
                      }`}
                      onClick={() => handleProcessTask(task)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono text-sm text-gray-500">{task.reportNumber}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                              {task.status}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                              {task.priority}优先级
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-900">{task.materialName}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            创建时间: {new Date(task.createdAt).toLocaleString()}
                          </p>
                          <div className="mt-2 flex items-center gap-4 text-sm">
                            <span className="text-gray-600">
                              AI置信度: <span className="font-medium text-red-600">{(task.aiConfidence * 100).toFixed(1)}%</span>
                            </span>
                            <span className="text-gray-600">
                              阈值: {(task.threshold * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {task.status !== ReviewTaskStatus.COMPLETED && (
                        <div className="mt-4 flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProcessTask(task);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            处理工单
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Task Processing Panel */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">工单处理</h2>

              {!selectedTask ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-gray-500">选择一个工单开始处理</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Task Info */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">{selectedTask.materialName}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedTask.status)}`}>
                        {selectedTask.status}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">案件号</span>
                        <span className="font-medium">{selectedTask.reportNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">AI识别置信度</span>
                        <span className="font-medium text-red-600">{(selectedTask.aiConfidence * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">系统阈值</span>
                        <span className="font-medium">{(selectedTask.threshold * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">差距</span>
                        <span className="font-medium text-amber-600">
                          {((selectedTask.threshold - selectedTask.aiConfidence) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Document Preview */}
                  {selectedTask.ossUrl && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="font-semibold text-gray-900 mb-4">材料预览</h3>
                      <div className="border rounded-lg overflow-hidden">
                        <img
                          src={selectedTask.ossUrl}
                          alt={selectedTask.materialName}
                          className="w-full h-48 object-contain bg-gray-50"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* AI Extracted Data */}
                  {selectedTask.aiExtractedData && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="font-semibold text-gray-900 mb-4">🤖 AI 识别结果（供参考）</h3>
                      <div className="bg-gray-50 rounded-lg p-4 text-sm">
                        <pre className="whitespace-pre-wrap text-gray-700 overflow-x-auto">
                          {JSON.stringify(selectedTask.aiExtractedData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Manual Input */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">✏️ 人工识别录入</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          修正后的数据 (JSON格式)
                        </label>
                        <textarea
                          value={JSON.stringify(manualInputData, null, 2)}
                          onChange={(e) => {
                            try {
                              setManualInputData(JSON.parse(e.target.value));
                            } catch {
                              // 允许无效JSON继续编辑
                            }
                          }}
                          className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono"
                          placeholder='{"key": "value"}'
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          复核备注
                        </label>
                        <textarea
                          value={manualReviewNotes}
                          onChange={(e) => setManualReviewNotes(e.target.value)}
                          className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                          placeholder="记录审核过程中的发现、修正原因等..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveTask}
                      disabled={processingTask}
                      className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {processingTask ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          保存中...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          完成处理
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setSelectedTask(null)}
                      className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClaimWorkbenchPage;
