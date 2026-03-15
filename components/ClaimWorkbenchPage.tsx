import React, { useState, useEffect } from 'react';
import { type ClaimCase, type ReviewTask, ReviewTaskStatus } from '../types';
import { api } from '../services/api';
import { ManualProcessingPanel } from './claim-adjuster/ClaimAdjusterPanels';
import {
  type SmartReviewResultView as SmartReviewResult,
  formatManualReviewCode,
  getReviewOutcome,
  getReviewSummary,
  getStageCards,
  getStageToneClasses,
  mergeSmartReviewResults,
} from '../utils/claimReviewPresentation';

interface ClaimWorkbenchPageProps {
  onViewClaim: (claim: ClaimCase) => void;
}

function toPersistedReviewResult(claim: ClaimCase | null): SmartReviewResult | null {
  const snapshot = claim?.latestReviewSnapshot;
  if (!snapshot) {
    return null;
  }

  const normalizedAmount =
    typeof snapshot.payableAmount === 'number'
      ? snapshot.payableAmount
      : typeof snapshot.amount === 'number'
        ? snapshot.amount
        : null;

  return {
    decision: snapshot.decision || 'MANUAL_REVIEW',
    amount: normalizedAmount,
    payableAmount: normalizedAmount,
    intakeDecision: snapshot.intakeDecision,
    liabilityDecision: snapshot.liabilityDecision,
    assessmentDecision: snapshot.assessmentDecision,
    settlementDecision: snapshot.settlementDecision,
    missingMaterials: snapshot.missingMaterials || [],
    coverageResults: snapshot.coverageResults || [],
    reasoning: '展示最近一次自动审核快照',
    ruleTrace: [],
    duration: 0,
  };
}

function getClaimOutcome(
  claim: ClaimCase,
  selectedClaim: ClaimCase | null,
  reviewOutcome: ReturnType<typeof getReviewOutcome> | null,
) {
  if (selectedClaim?.id === claim.id && reviewOutcome) {
    return reviewOutcome;
  }

  const persistedResult = toPersistedReviewResult(claim);
  return persistedResult ? getReviewOutcome(persistedResult) : null;
}

function deriveClaimStatus(reviewResult: SmartReviewResult, currentStatus: ClaimCase['status']) {
  const missingMaterials = reviewResult.missingMaterials || [];
  if (missingMaterials.length > 0) {
    return ClaimStatus.PENDING_INFO;
  }
  if (reviewResult.liabilityDecision === 'REJECT' || reviewResult.decision === 'REJECT') {
    return ClaimStatus.REJECTED;
  }
  if (reviewResult.decision === 'APPROVE' && reviewResult.settlementDecision === 'PAY') {
    return ClaimStatus.APPROVED;
  }
  if (
    reviewResult.liabilityDecision === 'ACCEPT' ||
    ['ASSESSED', 'PARTIAL_ASSESSED'].includes(reviewResult.assessmentDecision || '')
  ) {
    return ClaimStatus.PROCESSING;
  }
  return currentStatus || ClaimStatus.REPORTED;
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
  const [manualInputText, setManualInputText] = useState('{}');
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
    setReviewResult(toPersistedReviewResult(claim));

    try {
      const payload = {
        claimCaseId: claim.id,
        productCode: claim.productCode || 'PROD001',
        ocrData: (claim as any).ocrData || {},
        invoiceItems: claim.calculationItems || []
      };
      const [smartReviewResponse, fullReviewResponse] = await Promise.all([
        fetch('/api/ai/smart-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }),
        fetch('/api/claim/full-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      ]);

      const smartReviewResult = await smartReviewResponse.json();
      const fullReviewResult = fullReviewResponse.ok ? await fullReviewResponse.json() : {};
      const mergedResult = mergeSmartReviewResults(smartReviewResult, fullReviewResult);
      const nextSnapshot = {
        updatedAt: new Date().toISOString(),
        decision: mergedResult.decision,
        amount: mergedResult.amount,
        payableAmount: mergedResult.payableAmount ?? mergedResult.amount ?? null,
        intakeDecision: mergedResult.intakeDecision,
        liabilityDecision: mergedResult.liabilityDecision,
        assessmentDecision: mergedResult.assessmentDecision,
        settlementDecision: mergedResult.settlementDecision,
        missingMaterials: mergedResult.missingMaterials || [],
        coverageResults: mergedResult.coverageResults || mergedResult.calculation?.coverageResults || [],
      };
      setReviewResult(mergedResult);
      setClaims((prevClaims) =>
        prevClaims.map((item) =>
          item.id === claim.id
            ? {
                ...item,
                status: deriveClaimStatus(mergedResult, item.status),
                approvedAmount: mergedResult.amount ?? item.approvedAmount,
                liabilityDecision: mergedResult.liabilityDecision || item.liabilityDecision,
                assessmentDecision: mergedResult.assessmentDecision || item.assessmentDecision,
                latestReviewSnapshot: nextSnapshot,
              }
            : item,
        ),
      );
      setSelectedClaim((prevClaim) =>
        prevClaim?.id === claim.id
          ? {
              ...prevClaim,
              status: deriveClaimStatus(mergedResult, prevClaim.status),
              approvedAmount: mergedResult.amount ?? prevClaim.approvedAmount,
              liabilityDecision: mergedResult.liabilityDecision || prevClaim.liabilityDecision,
              assessmentDecision: mergedResult.assessmentDecision || prevClaim.assessmentDecision,
              latestReviewSnapshot: nextSnapshot,
            }
          : prevClaim,
      );
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
    setManualInputText(JSON.stringify(task.aiExtractedData || {}, null, 2));
    setManualReviewNotes('');
  };

  const handleSaveTask = async () => {
    if (!selectedTask) return;
    
    setProcessingTask(true);
    try {
      let parsedManualInputData = manualInputData;
      try {
        parsedManualInputData = JSON.parse(manualInputText || '{}');
      } catch {
        alert('修正后的数据不是有效的 JSON');
        setProcessingTask(false);
        return;
      }

      setManualInputData(parsedManualInputData);
      const response = await fetch(`/api/review-tasks/${selectedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: ReviewTaskStatus.COMPLETED,
          manualInputData: parsedManualInputData,
          manualReviewNotes,
          reviewerId: 'current-user',
          reviewerName: '当前理赔员',
        })
      });

      if (response.ok) {
        await loadReviewTasks();
        setSelectedTask(null);
        setManualInputText('{}');
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

  const stageCards = reviewResult ? getStageCards(reviewResult) : [];
  const reviewReasonsPreview = reviewResult?.manualReviewReasons?.slice(0, 2) || [];
  const reviewSummary = reviewResult ? getReviewSummary(reviewResult) : null;
  const reviewOutcome = reviewResult ? getReviewOutcome(reviewResult) : null;

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
              人工处理
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
                      onClick={() => {
                        setSelectedClaim(claim);
                        setReviewResult(toPersistedReviewResult(claim));
                      }}
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
                        {getClaimOutcome(claim, selectedClaim, reviewOutcome) && (
                          (() => {
                            const claimOutcome = getClaimOutcome(claim, selectedClaim, reviewOutcome)!;
                            return (
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                            claimOutcome.tone === 'success'
                              ? 'bg-green-50 text-green-700'
                              : claimOutcome.tone === 'danger'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-amber-50 text-amber-700'
                          }`}>
                            {claimOutcome.label}
                          </span>
                            );
                          })()
                        )}
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
                          {selectedClaim?.id === claim.id && reviewResult?.missingMaterials?.length
                            ? '查看并补件'
                            : '查看详情'}
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
                  <div className={`rounded-xl border-2 p-6 ${reviewSummary?.panelClass || 'text-amber-600 bg-amber-50 border-amber-200'}`}>
                    <div className="text-2xl font-bold mb-2">
                      {reviewSummary?.label === '建议通过' && '✅ 建议通过'}
                      {reviewSummary?.label === '建议拒赔' && '❌ 建议拒赔'}
                      {reviewSummary?.label === '补充材料' && '📎 补充材料'}
                      {reviewSummary?.label === '已初算待补件' && '🧾 已初算待补件'}
                      {reviewSummary?.label === '需人工复核' && '🔍 需人工复核'}
                    </div>
                    {reviewOutcome?.showEstimatedAmount && reviewResult.amount !== null && (
                      <div className="text-sm font-medium opacity-80">{reviewOutcome.amountLabel}</div>
                    )}
                    {reviewOutcome?.showEstimatedAmount && reviewResult.amount !== null && (
                      <div className="text-3xl font-bold">¥{reviewResult.amount.toLocaleString()}</div>
                    )}
                    {reviewOutcome?.detail && (
                      <div className="mt-3 text-sm leading-6 opacity-90">{reviewOutcome.detail}</div>
                    )}
                    {reviewOutcome?.nextAction && (
                      <div className="mt-2 text-xs font-medium uppercase tracking-wide opacity-75">
                        下一步: {reviewOutcome.nextAction}
                      </div>
                    )}
                    <div className="text-sm mt-2 opacity-80">处理耗时: {reviewResult.duration}ms</div>
                  </div>

                  {stageCards.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="font-semibold text-gray-900 mb-4">分阶段审核结果</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {stageCards.map((stage) => (
                          <div
                            key={stage.key}
                            className={`rounded-lg border p-4 ${getStageToneClasses(stage.tone)}`}
                          >
                            <div className="text-xs font-medium opacity-80">{stage.label}</div>
                            <div className="text-base font-semibold mt-1">{stage.value}</div>
                            <div className="text-xs mt-2 opacity-80">{stage.helper}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(reviewReasonsPreview.length > 0 || (reviewResult.missingMaterials?.length || 0) > 0) && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="font-semibold text-gray-900 mb-4">人工复核摘要</h3>
                      <div className="space-y-3">
                        {reviewReasonsPreview.map((reason, index) => (
                          <div key={`${reason.code}-${index}`} className="rounded-lg border border-orange-100 bg-orange-50 p-3">
                            <div className="text-sm font-medium text-orange-800">{reason.message}</div>
                            <div className="text-xs text-orange-600 mt-1">
                              {reason.stage} · {formatManualReviewCode(reason.code)}
                            </div>
                          </div>
                        ))}
                        {(reviewResult.missingMaterials?.length || 0) > 0 && (
                          <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                            <div className="text-sm font-medium text-red-800">
                              缺失材料 {reviewResult.missingMaterials?.length} 项
                            </div>
                            <div className="text-xs text-red-600 mt-1">
                              {reviewResult.missingMaterials?.slice(0, 3).join('、')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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
            <div className="lg:col-span-3">
              {loading ? (
                <div className="bg-white rounded-xl p-12 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-gray-500 mt-4">加载中...</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center">
                  <p className="text-gray-500">暂无需人工处理的工单</p>
                </div>
              ) : (
                <ManualProcessingPanel
                  tasks={filteredTasks}
                  selectedTask={selectedTask}
                  onSelectTask={handleProcessTask}
                  manualInputText={manualInputText}
                  onManualInputTextChange={setManualInputText}
                  manualReviewNotes={manualReviewNotes}
                  onManualReviewNotesChange={setManualReviewNotes}
                  onSaveTask={handleSaveTask}
                  onClearSelection={() => {
                    setSelectedTask(null);
                    setManualInputText('{}');
                  }}
                  processingTask={processingTask}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClaimWorkbenchPage;
