import React, { useState, useEffect, useRef } from "react";
import {
  type ClaimCase,
  ClaimStatus,
  type UserOperationLog,
  UserOperationType,
  type ProcessedFile,
  type CompletenessResult,
  type SourceAnchor,
  type AnyDocumentSummary,
} from "../types";
import OfflineMaterialImportButton from "./OfflineMaterialImportButton";
import OfflineMaterialImportDialog from "./OfflineMaterialImportDialog";
import DocumentViewer, { type DocumentViewerRef } from "./ui/DocumentViewer";
import AnchoredField, { AnchoredSection } from "./ui/AnchoredField";

type ActiveTab = "case_info" | "material_review" | "damage_report";

interface SmartReviewResult {
  decision: "APPROVE" | "REJECT" | "MANUAL_REVIEW";
  amount: number | null;
  reasoning: string;
  eligibility?: {
    eligible: boolean;
    matchedRules: string[];
    rejectionReasons: any[];
    warnings: any[];
  };
  calculation?: {
    totalClaimable: number;
    deductible: number;
    reimbursementRatio: number;
    finalAmount: number;
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

interface ClaimCaseDetailPageProps {
  claim: ClaimCase;
  onBack: () => void;
}

const ClaimCaseDetailPage: React.FC<ClaimCaseDetailPageProps> = ({
  claim,
  onBack,
}) => {
  const [openFiles, setOpenFiles] = useState<Record<string, boolean>>({
    医疗费用: true,
  });
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<SmartReviewResult | null>(
    null,
  );
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [operationLogs, setOperationLogs] = useState<UserOperationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importedDocuments, setImportedDocuments] = useState<
    Array<{
      documentId: string;
      fileName: string;
      fileType: string;
      ossUrl?: string;
      classification: {
        materialId: string;
        materialName: string;
        confidence: number;
      };
      status: string;
      importedAt: string;
    }>
  >([]);
  const [importedCompleteness, setImportedCompleteness] =
    useState<CompletenessResult | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{
    fileName: string;
    fileType?: string;
    ossUrl?: string;
    classification: { materialName: string };
    structuredData?: Record<string, unknown>;
  } | null>(null);

  // --- 材料审核 Tab 状态 ---
  const [activeTab, setActiveTab] = useState<ActiveTab>("case_info");
  const [reviewDocuments, setReviewDocuments] = useState<
    Array<
      ProcessedFile & {
        batchId?: string;
        importedAt?: string;
        documentSummary?: AnyDocumentSummary;
        duplicateWarning?: { message: string; similarity: number } | null;
      }
    >
  >([]);
  const [reviewSummaries, setReviewSummaries] = useState<AnyDocumentSummary[]>(
    [],
  );
  const [aggregationResult, setAggregationResult] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [damageReport, setDamageReport] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  /** 当前在右栏展示的文件 */
  const [selectedViewerDoc, setSelectedViewerDoc] = useState<{
    fileUrl: string;
    fileType: "pdf" | "image" | "word" | "excel" | "other";
    fileName: string;
  } | null>(null);
  /** 触发跳转的锚点 */
  const [activeAnchor, setActiveAnchor] = useState<SourceAnchor | undefined>(
    undefined,
  );
  /** 已手动通过的字段集合 key = `${docId}.${fieldName}` */
  const [approvedFields, setApprovedFields] = useState<Set<string>>(new Set());

  const viewerRef = useRef<DocumentViewerRef>(null);

  // 加载已导入的材料
  const fetchImportedDocuments = async () => {
    try {
      const response = await fetch(
        `/api/claim-documents?claimCaseId=${claim.id}`,
      );
      if (response.ok) {
        const data = await response.json();
        setImportedDocuments(data.documents || []);
        if (data.completeness) {
          setImportedCompleteness({
            isComplete: data.completeness.isComplete ?? false,
            score:
              data.completeness.completenessScore ??
              data.completeness.score ??
              0,
            requiredMaterials: data.completeness.requiredMaterials ?? [],
            providedMaterials: data.completeness.providedMaterials ?? [],
            missingMaterials: data.completeness.missingMaterials ?? [],
            warnings: data.completeness.warnings ?? [],
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch imported documents:", error);
    }
  };

  useEffect(() => {
    fetchImportedDocuments();
  }, [claim.id]);

  const handleSmartReview = async () => {
    setReviewing(true);
    setReviewResult(null);
    try {
      const response = await fetch("/api/ai/smart-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimCaseId: claim.id,
          productCode: claim.productCode || "PROD001",
          ocrData: claim.ocrData || {},
          invoiceItems: claim.calculationItems || [],
        }),
      });
      const result = await response.json();
      setReviewResult(result);
    } catch (error) {
      console.error("Smart review failed:", error);
      setReviewResult({
        decision: "MANUAL_REVIEW",
        amount: null,
        reasoning: "智能审核服务异常，请人工处理",
        ruleTrace: [],
        duration: 0,
      });
    } finally {
      setReviewing(false);
    }
  };

  const handleImportComplete = (result: {
    documents: ProcessedFile[];
    completeness: CompletenessResult;
  }) => {
    // Refresh the imported documents list from backend
    fetchImportedDocuments();
    loadReviewData();
  };

  // 加载材料审核数据（批量导入结果 + 摘要 + 聚合）
  const loadReviewData = async () => {
    try {
      const resp = await fetch(`/api/claim-documents?claimCaseId=${claim.id}`);
      if (!resp.ok) return;
      const data = await resp.json();

      // 合并所有批次的文档
      const allDocs: typeof reviewDocuments = [];
      const allSummaries: AnyDocumentSummary[] = [];

      for (const record of data.records || data.allRecords || []) {
        for (const doc of record.documents || []) {
          allDocs.push(doc);
          if (doc.documentSummary) {
            allSummaries.push(doc.documentSummary as AnyDocumentSummary);
          }
        }
        if (record.aggregation) {
          setAggregationResult(record.aggregation);
        }
      }

      setReviewDocuments(allDocs);
      setReviewSummaries(allSummaries);
    } catch {
      // 静默失败
    }
  };

  // 生成定损报告
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const resp = await fetch("/api/generate-damage-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimCaseId: claim.id }),
      });
      if (resp.ok) {
        const report = await resp.json();
        setDamageReport(report);
        setActiveTab("damage_report");
      }
    } catch {
      // 静默失败
    } finally {
      setGeneratingReport(false);
    }
  };

  // 跳转到文件并高亮锚点
  const handleJumpTo = (
    doc: { ossUrl?: string; fileType: string; fileName: string },
    anchor: SourceAnchor,
  ) => {
    if (!doc.ossUrl) return;
    const fileCategory = doc.fileType?.startsWith("image/")
      ? "image"
      : doc.fileType?.includes("pdf")
        ? "pdf"
        : doc.fileType?.includes("word")
          ? "word"
          : doc.fileType?.includes("excel")
            ? "excel"
            : "other";
    setSelectedViewerDoc({
      fileUrl: doc.ossUrl,
      fileType: fileCategory as "pdf" | "image" | "word" | "excel" | "other",
      fileName: doc.fileName,
    });
    setActiveAnchor(anchor);
    // 如果 ref 已挂载，直接调用
    setTimeout(() => viewerRef.current?.jumpTo(anchor), 100);
  };

  const approveField = (docId: string, fieldName: string) => {
    setApprovedFields((prev) => new Set([...prev, `${docId}.${fieldName}`]));
  };

  const isFieldApproved = (docId: string, fieldName: string) =>
    approvedFields.has(`${docId}.${fieldName}`);

  // 批量通过所有高置信度字段
  const batchApproveHighConfidence = () => {
    const newApproved = new Set(approvedFields);
    for (const summary of reviewSummaries) {
      if (!summary || summary.confidence < 0.9) continue;
      for (const key of Object.keys(summary.sourceAnchors || {})) {
        newApproved.add(`${summary.docId}.${key}`);
      }
    }
    setApprovedFields(newApproved);
  };

  const toggleFileCategory = (name: string) => {
    setOpenFiles((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  // 获取操作日志
  const fetchOperationLogs = async () => {
    setLogsLoading(true);
    try {
      const response = await fetch(`/api/operation-logs?claimId=${claim.id}`);
      if (response.ok) {
        const logs = await response.json();
        setOperationLogs(logs);
      } else {
        // 如果 API 返回错误，使用模拟数据
        setOperationLogs(getMockLogs());
      }
    } catch (error) {
      console.error("Failed to fetch operation logs:", error);
      // 使用模拟数据
      setOperationLogs(getMockLogs());
    } finally {
      setLogsLoading(false);
    }
  };

  // 模拟操作日志数据
  const getMockLogs = (): UserOperationLog[] => [
    {
      logId: `log-${Date.now()}-001`,
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      userName: "张伟",
      operationType: UserOperationType.REPORT_CLAIM,
      operationLabel: "提交报案",
      claimId: claim.id,
      claimReportNumber: claim.reportNumber,
      currentStatus: "待审核",
      success: true,
      duration: 1250,
    },
    {
      logId: `log-${Date.now()}-002`,
      timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      userName: "张伟",
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: "上传文件: 发票1.jpg",
      claimId: claim.id,
      claimReportNumber: claim.reportNumber,
      inputData: { fileName: "发票1.jpg", fileSize: "2.3MB" },
      success: true,
      duration: 3200,
    },
    {
      logId: `log-${Date.now()}-003`,
      timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
      userName: "张伟",
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: "上传文件: 发票2.jpg",
      claimId: claim.id,
      claimReportNumber: claim.reportNumber,
      inputData: { fileName: "发票2.jpg", fileSize: "1.8MB" },
      success: true,
      duration: 2800,
    },
    {
      logId: `log-${Date.now()}-004`,
      timestamp: new Date(Date.now() - 3600000 * 0.5).toISOString(),
      userName: "admin",
      operationType: UserOperationType.VIEW_CLAIM_DETAIL,
      operationLabel: "查看赔案详情",
      claimId: claim.id,
      claimReportNumber: claim.reportNumber,
      currentStatus: "待审核",
      success: true,
      duration: 150,
    },
    {
      logId: `log-${Date.now()}-005`,
      timestamp: new Date(Date.now() - 3600000 * 0.25).toISOString(),
      userName: "admin",
      operationType: UserOperationType.ANALYZE_DOCUMENT,
      operationLabel: "AI智能审核",
      claimId: claim.id,
      claimReportNumber: claim.reportNumber,
      outputData: { decision: "APPROVE", amount: 132 },
      success: true,
      duration: 4500,
    },
  ];

  const handleShowLogs = () => {
    setShowLogsModal(true);
    fetchOperationLogs();
  };

  // 格式化时间
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // 获取操作类型标签样式
  const getOperationStyle = (type: UserOperationType) => {
    switch (type) {
      case UserOperationType.REPORT_CLAIM:
        return "bg-blue-100 text-blue-700";
      case UserOperationType.UPLOAD_FILE:
        return "bg-green-100 text-green-700";
      case UserOperationType.DELETE_FILE:
        return "bg-red-100 text-red-700";
      case UserOperationType.VIEW_CLAIM_DETAIL:
      case UserOperationType.VIEW_FILE:
      case UserOperationType.VIEW_PROGRESS:
        return "bg-gray-100 text-gray-700";
      case UserOperationType.ANALYZE_DOCUMENT:
      case UserOperationType.QUICK_ANALYZE:
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-[#2d3a8c]">索赔向导</h1>
        </div>
        <div className="flex items-center space-x-3">
          <span className="bg-[#eef2ff] text-[#4338ca] px-4 py-1.5 rounded-full text-sm font-medium border border-[#e0e7ff]">
            索赔编号: {claim.reportNumber}
          </span>
          <button
            onClick={handleShowLogs}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
            操作日志
          </button>
          <button
            onClick={handleSmartReview}
            disabled={reviewing}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-md text-sm font-medium hover:from-indigo-700 hover:to-purple-700 shadow-sm disabled:opacity-50"
          >
            {reviewing ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                AI 审核中...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                AI 智能审核
              </>
            )}
          </button>
          <button className="flex items-center px-4 py-2 bg-[#4f46e5] text-white rounded-md text-sm font-medium hover:bg-[#4338ca] shadow-sm">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            处理索赔
          </button>
        </div>
      </div>
      {/* Tab Navigation */}
      <div className="max-w-[1400px] mx-auto px-8 mt-4">
        <div className="flex border-b border-gray-200">
          {(
            ["case_info", "material_review", "damage_report"] as ActiveTab[]
          ).map((tabId) => {
            const labels: Record<ActiveTab, string> = {
              case_info: "案件信息",
              material_review: "材料审核",
              damage_report: "定损报告",
            };
            return (
              <button
                key={tabId}
                onClick={() => {
                  setActiveTab(tabId);
                  if (tabId === "material_review") loadReviewData();
                }}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tabId
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {labels[tabId]}
                {tabId === "material_review" && reviewDocuments.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                    {reviewDocuments.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {/* 案件信息 Tab */}
      {activeTab === "case_info" && (
        <div className="max-w-[1400px] mx-auto px-8 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overview Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">索赔概览</h2>
              <div className="grid grid-cols-3 gap-8">
                <div>
                  <p className="text-sm text-gray-500 mb-1">状态</p>
                  <div className="flex items-center">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>
                    <span className="text-sm font-bold text-gray-900">
                      {claim.status}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">索赔金额</p>
                  <p className="text-lg font-bold text-gray-900">
                    ¥{claim.claimAmount?.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">核准金额</p>
                  <p className="text-lg font-bold text-blue-600">
                    ¥{claim.approvedAmount?.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* AI Review Result */}
            {reviewResult && (
              <div
                className={`bg-white rounded-xl shadow-sm border-2 p-6 ${
                  reviewResult.decision === "APPROVE"
                    ? "border-green-200 bg-green-50/30"
                    : reviewResult.decision === "REJECT"
                      ? "border-red-200 bg-red-50/30"
                      : "border-amber-200 bg-amber-50/30"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    🤖 AI 智能审核结果
                  </h2>
                  <span className="text-sm text-gray-500">
                    耗时: {reviewResult.duration}ms
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-6 mb-6">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">审核建议</p>
                    <p
                      className={`text-lg font-bold ${
                        reviewResult.decision === "APPROVE"
                          ? "text-green-600"
                          : reviewResult.decision === "REJECT"
                            ? "text-red-600"
                            : "text-amber-600"
                      }`}
                    >
                      {reviewResult.decision === "APPROVE"
                        ? "✅ 建议通过"
                        : reviewResult.decision === "REJECT"
                          ? "❌ 建议拒赔"
                          : "🔍 需人工复核"}
                    </p>
                  </div>
                  {reviewResult.amount !== null && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">建议金额</p>
                      <p className="text-lg font-bold text-indigo-600">
                        ¥{reviewResult.amount.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {reviewResult.eligibility && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">责任判断</p>
                      <p
                        className={`text-lg font-bold ${reviewResult.eligibility.eligible ? "text-green-600" : "text-red-600"}`}
                      >
                        {reviewResult.eligibility.eligible
                          ? "符合责任"
                          : "不符合"}
                      </p>
                    </div>
                  )}
                </div>

                {reviewResult.eligibility?.matchedRules &&
                  reviewResult.eligibility.matchedRules.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-2">匹配规则</p>
                      <div className="flex flex-wrap gap-2">
                        {reviewResult.eligibility.matchedRules.map(
                          (rule, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-mono"
                            >
                              {rule}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                <div className="bg-white/60 rounded-lg p-4 border border-gray-100">
                  <p className="text-sm text-gray-500 mb-2">审核意见</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                    {reviewResult.reasoning}
                  </p>
                </div>
              </div>
            )}

            {/* Policy Info Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-900">保单信息</h2>
                <button className="text-blue-600 text-sm font-medium hover:underline">
                  查看完整保单
                </button>
              </div>
              <div className="grid grid-cols-2 gap-y-6 gap-x-12">
                <div>
                  <p className="text-sm text-gray-500 mb-1">投保人</p>
                  <p className="text-sm font-bold text-gray-900">
                    {claim.policyholder || "张伟"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">被保险人</p>
                  <p className="text-sm font-bold text-gray-900">
                    {claim.insured || "李娜"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">保险期间</p>
                  <p className="text-sm font-bold text-gray-900">
                    {claim.policyPeriod || "2024年1月1日 - 2024年12月31日"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">保单号</p>
                  <p className="text-sm font-bold text-gray-900">
                    {claim.policyNumber || "POL-2024-7890"}
                  </p>
                </div>
              </div>
            </div>

            {/* Accident Details Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">事故详情</h2>
              <div className="grid grid-cols-2 gap-y-6 gap-x-12 border-b border-gray-100 pb-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">报案人</p>
                  <p className="text-sm font-bold text-gray-900">
                    {claim.reporter}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">报案时间</p>
                  <p className="text-sm font-bold text-gray-900">
                    {claim.reportTime}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">事故时间</p>
                  <p className="text-sm font-bold text-gray-900">
                    {claim.accidentTime}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">索赔金额</p>
                  <p className="text-sm font-bold text-gray-900">
                    ¥{claim.claimAmount?.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="mt-6">
                <p className="text-sm text-gray-500 mb-1">事故地点</p>
                <p className="text-sm font-bold text-gray-900">
                  {claim.accidentLocation || "中国北京市朝阳区主街123号"}
                </p>
              </div>
            </div>

            {/* Claim Calculation Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900">理赔计算</h2>
                <button className="flex items-center px-4 py-2 bg-[#4f46e5] text-white rounded-md text-sm font-medium hover:bg-[#4338ca]">
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  编辑表格
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        责任类型
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        文件名
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        日期
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        项目
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        金额 (¥)
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        理赔 (¥)
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        依据
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {/* Group 1: 医疗费用 */}
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        医疗费用
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        发票1.jpg
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        2025-1-1
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        色甘酸钠
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        17
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        17
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        乙类药，保险覆盖，100%报销
                      </td>
                    </tr>
                    <tr>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        急诊诊疗
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        25
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        25
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        甲类药，保险覆盖，100%报销
                      </td>
                    </tr>
                    <tr>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        氯胆乳膏
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        30
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        24
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        丙类药，不属保险范围，80%报销
                      </td>
                    </tr>
                    <tr className="bg-gray-50/50 font-bold">
                      <td colSpan={3}></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        小计
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        72
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        66
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        单日限额¥200，总限额¥10,000
                      </td>
                    </tr>

                    {/* Group 2: Medical */}
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        Medical
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        Invoice 2.jpg
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        2025-1-2
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        Sodium Cromoglicate
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        17
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        17
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        Class B, covered by insurance, 100% reimbursement
                      </td>
                    </tr>
                    <tr>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        Emergency Consultation
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        25
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        25
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        Class A, covered by insurance, 100% reimbursement
                      </td>
                    </tr>
                    <tr>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        Hydroquinone Cream
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        30
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        24
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        Class C, not covered by insurance, 80% reimbursement
                      </td>
                    </tr>
                    <tr className="bg-gray-50/50 font-bold">
                      <td colSpan={3}></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        Subtotal
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        72
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        66
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        Daily limit within ¥200, total limit within ¥10,000
                      </td>
                    </tr>

                    {/* Grand Total */}
                    <tr className="bg-[#f8f9fc] font-bold">
                      <td colSpan={3}></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#2d3a8c]">
                        总计
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#2d3a8c]">
                        144
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#2d3a8c]">
                        132
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Claim Files Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">索赔文件</h2>

              {/* Original files (mock) */}
              <div className="space-y-2 mb-4">
                {[
                  { name: "医疗费用", count: 3 },
                  { name: "伤残费用", count: 0 },
                  { name: "误工费", count: 1 },
                ].map((cat, i) => (
                  <div
                    key={i}
                    className="border border-gray-100 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleFileCategory(cat.name)}
                      className="w-full flex justify-between items-center px-4 py-3 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
                    >
                      <span>
                        {cat.name} ({cat.count}个文件)
                      </span>
                      <svg
                        className={`w-4 h-4 text-gray-400 transform transition-transform ${openFiles[cat.name] ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {openFiles[cat.name] && cat.count > 0 && (
                      <div className="px-4 py-2 space-y-2 bg-gray-50/30">
                        {Array.from({ length: cat.count }).map((_, idx) => (
                          <div
                            key={idx}
                            className="flex items-center space-x-2 text-xs text-blue-600 hover:underline cursor-pointer"
                          >
                            <svg
                              className="w-4 h-4 text-gray-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 00-2 2z"
                              />
                            </svg>
                            <span>
                              {cat.name === "医疗费用"
                                ? `发票${idx + 1}.jpg`
                                : "请假条.jpg"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Imported documents */}
              {importedDocuments.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-indigo-700">
                      离线导入材料 ({importedDocuments.length})
                    </h3>
                    <button
                      onClick={() => toggleFileCategory("导入材料")}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      {openFiles["导入材料"] !== false ? "收起" : "展开"}
                    </button>
                  </div>
                  {openFiles["导入材料"] !== false && (
                    <div className="space-y-1.5">
                      {importedDocuments.map((doc) => (
                        <div
                          key={doc.documentId}
                          onClick={() => setPreviewDoc(doc)}
                          className="flex items-center justify-between px-3 py-2 bg-indigo-50/50 rounded-lg border border-indigo-100 cursor-pointer hover:bg-indigo-50 transition-colors"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <svg
                              className="w-4 h-4 text-indigo-400 flex-shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-700 truncate">
                                {doc.fileName}
                              </p>
                              <p className="text-[10px] text-indigo-600">
                                {doc.classification.materialName}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                              doc.status === "completed"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {doc.status === "completed" ? "已识别" : "失败"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Completeness summary from imports */}
              {importedCompleteness &&
                importedCompleteness.missingMaterials.length > 0 && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-xs font-bold text-amber-800 mb-1">
                      缺失材料提醒
                    </p>
                    <div className="space-y-0.5">
                      {importedCompleteness.missingMaterials.map((m, i) => (
                        <p
                          key={i}
                          className="text-[11px] text-amber-700 flex items-center"
                        >
                          <svg
                            className="w-3 h-3 mr-1 text-amber-500 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          {m}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Risk Indicators Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">风险指标</h2>
              <div className="space-y-4">
                <div className="flex space-x-3 p-4 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      高欺诈概率
                    </p>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                      基于图像分析，发票1.jpg显示可能被篡改的迹象。
                    </p>
                  </div>
                </div>
                <div className="flex space-x-3 p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-yellow-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      文件不完整
                    </p>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                      雇主证明缺少公章。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Claim Actions Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">索赔操作</h2>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-center py-2.5 bg-[#10b981] text-white rounded-md text-sm font-bold hover:bg-[#059669] transition-colors shadow-sm">
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  批准索赔
                </button>
                <button className="w-full flex items-center justify-center py-2.5 bg-[#ef4444] text-white rounded-md text-sm font-bold hover:bg-[#dc2626] transition-colors shadow-sm">
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  拒绝索赔
                </button>
                <button className="w-full flex items-center justify-center py-2.5 border border-gray-300 text-gray-700 bg-white rounded-md text-sm font-medium hover:bg-gray-50 transition-colors">
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                  请求补充材料
                </button>
              </div>
            </div>
          </div>
        </div>
      )}{" "}
      {/* end case_info */}
      {/* 材料审核 Tab */}
      {activeTab === "material_review" && (
        <div className="max-w-[1400px] mx-auto px-8 mt-6">
          {/* 审核操作栏 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-gray-900">材料审核</h2>
              {reviewDocuments.length > 0 && (
                <span className="text-sm text-gray-500">
                  共 {reviewDocuments.length} 份材料
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={batchApproveHighConfidence}
                className="flex items-center px-3 py-1.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded-md hover:bg-green-100"
              >
                <svg
                  className="w-4 h-4 mr-1.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                一键通过高置信项（≥90%）
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="flex items-center px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {generatingReport ? (
                  <>
                    <div className="w-4 h-4 mr-1.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 mr-1.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    生成定损报告
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 矛盾警告 */}
          {aggregationResult &&
            (aggregationResult as Record<string, unknown>).conflictsDetected &&
            (
              (aggregationResult as Record<string, unknown>)
                .conflictsDetected as unknown[]
            ).length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-4 h-4 text-red-500 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-medium text-red-700">
                    检测到{" "}
                    {
                      (
                        (aggregationResult as Record<string, unknown>)
                          .conflictsDetected as unknown[]
                      ).length
                    }{" "}
                    处材料矛盾
                  </span>
                </div>
                <div className="space-y-1">
                  {(
                    (aggregationResult as Record<string, unknown>)
                      .conflictsDetected as Array<{
                      description: string;
                      severity: string;
                    }>
                  ).map((c, i) => (
                    <div
                      key={i}
                      className={`text-xs px-2 py-1 rounded ${c.severity === "error" ? "text-red-700 bg-red-100" : "text-yellow-700 bg-yellow-100"}`}
                    >
                      {c.description}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {reviewDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg
                className="w-16 h-16 mb-4 text-gray-200"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-sm">暂未导入材料</p>
              <p className="text-xs mt-1">点击右下角按钮批量导入案件材料</p>
            </div>
          ) : (
            <div className="flex gap-4 h-[calc(100vh-220px)]">
              {/* 左栏：AI 提取结果 */}
              <div className="w-[380px] shrink-0 overflow-y-auto pr-1">
                {reviewDocuments.map((doc) => {
                  const summary = reviewSummaries.find(
                    (s) => s.docId === doc.documentId,
                  );
                  const makeJump = (anchor: SourceAnchor) =>
                    handleJumpTo(
                      {
                        ossUrl: doc.ossUrl,
                        fileType: doc.fileType || "",
                        fileName: doc.fileName,
                      },
                      anchor,
                    );
                  return (
                    <AnchoredSection
                      key={doc.documentId}
                      title={doc.classification?.materialName || doc.fileName}
                      docId={doc.documentId}
                      confidence={summary?.confidence}
                      onViewSource={
                        doc.ossUrl
                          ? () =>
                              makeJump({
                                pageIndex: 0,
                                highlightLevel: "page_only",
                              })
                          : undefined
                      }
                    >
                      {/* 重复文件警告 */}
                      {doc.duplicateWarning && (
                        <div className="text-xs text-amber-600 px-2 py-1 bg-amber-50 rounded mb-1">
                          ⚠️ {doc.duplicateWarning.message}（相似度{" "}
                          {Math.round(doc.duplicateWarning.similarity * 100)}%）
                        </div>
                      )}

                      {summary ? (
                        <>
                          {/* 交警责任认定书 */}
                          {summary.summaryType === "accident_liability" &&
                            (() => {
                              const s =
                                summary as import("../types").AccidentLiabilitySummary;
                              return (
                                <>
                                  {s.accidentDate && (
                                    <AnchoredField
                                      label="事故日期"
                                      value={s.accidentDate}
                                      anchor={
                                        summary.sourceAnchors?.accidentDate
                                      }
                                      confidence={summary.confidence}
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        "accidentDate",
                                      )}
                                      onApprove={() =>
                                        approveField(
                                          doc.documentId,
                                          "accidentDate",
                                        )
                                      }
                                    />
                                  )}
                                  {s.parties?.map((p, i) => (
                                    <AnchoredField
                                      key={i}
                                      label={`${p.role}责任`}
                                      value={`${p.liabilityPct}%`}
                                      anchor={
                                        summary.sourceAnchors?.[
                                          `liabilityPct_${i}`
                                        ]
                                      }
                                      confidence={summary.confidence}
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        `liabilityPct_${i}`,
                                      )}
                                      onApprove={() =>
                                        approveField(
                                          doc.documentId,
                                          `liabilityPct_${i}`,
                                        )
                                      }
                                    />
                                  ))}
                                  {s.liabilityBasis && (
                                    <AnchoredField
                                      label="定责依据"
                                      value={s.liabilityBasis}
                                      anchor={
                                        summary.sourceAnchors?.liabilityBasis
                                      }
                                      confidence={summary.confidence}
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        "liabilityBasis",
                                      )}
                                      onApprove={() =>
                                        approveField(
                                          doc.documentId,
                                          "liabilityBasis",
                                        )
                                      }
                                    />
                                  )}
                                </>
                              );
                            })()}

                          {/* 住院病历 */}
                          {summary.summaryType === "inpatient_record" &&
                            (() => {
                              const s =
                                summary as import("../types").InpatientRecordSummary;
                              return (
                                <>
                                  {s.admissionDate && (
                                    <AnchoredField
                                      label="入院日期"
                                      value={s.admissionDate}
                                      anchor={
                                        summary.sourceAnchors?.admissionDate
                                      }
                                      confidence={summary.confidence}
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        "admissionDate",
                                      )}
                                      onApprove={() =>
                                        approveField(
                                          doc.documentId,
                                          "admissionDate",
                                        )
                                      }
                                    />
                                  )}
                                  {s.dischargeDate && (
                                    <AnchoredField
                                      label="出院日期"
                                      value={s.dischargeDate}
                                      anchor={
                                        summary.sourceAnchors?.dischargeDate
                                      }
                                      confidence={summary.confidence}
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        "dischargeDate",
                                      )}
                                      onApprove={() =>
                                        approveField(
                                          doc.documentId,
                                          "dischargeDate",
                                        )
                                      }
                                    />
                                  )}
                                  {s.hospitalizationDays != null && (
                                    <AnchoredField
                                      label="住院天数"
                                      value={`${s.hospitalizationDays} 天`}
                                      anchor={
                                        summary.sourceAnchors
                                          ?.hospitalizationDays
                                      }
                                      confidence={summary.confidence}
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        "hospitalizationDays",
                                      )}
                                      onApprove={() =>
                                        approveField(
                                          doc.documentId,
                                          "hospitalizationDays",
                                        )
                                      }
                                    />
                                  )}
                                  {s.diagnoses?.map((d, i) => (
                                    <AnchoredField
                                      key={i}
                                      label={`诊断${i + 1}`}
                                      value={d.name}
                                      anchor={
                                        summary.sourceAnchors?.[
                                          `diagnosis_${i}`
                                        ]
                                      }
                                      confidence={summary.confidence}
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        `diagnosis_${i}`,
                                      )}
                                      onApprove={() =>
                                        approveField(
                                          doc.documentId,
                                          `diagnosis_${i}`,
                                        )
                                      }
                                    />
                                  ))}
                                  {s.surgeries?.map((op, i) => (
                                    <AnchoredField
                                      key={i}
                                      label={`手术${i + 1}`}
                                      value={op.name}
                                      anchor={
                                        summary.sourceAnchors?.[`surgery_${i}`]
                                      }
                                      confidence={summary.confidence}
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        `surgery_${i}`,
                                      )}
                                      onApprove={() =>
                                        approveField(
                                          doc.documentId,
                                          `surgery_${i}`,
                                        )
                                      }
                                    />
                                  ))}
                                </>
                              );
                            })()}

                          {/* 费用发票 */}
                          {summary.summaryType === "expense_invoice" &&
                            (() => {
                              const s =
                                summary as import("../types").ExpenseInvoiceSummary;
                              return (
                                <>
                                  {s.invoiceDate && (
                                    <AnchoredField
                                      label="开票日期"
                                      value={s.invoiceDate}
                                      anchor={
                                        summary.sourceAnchors?.invoiceDate
                                      }
                                      confidence={summary.confidence}
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        "invoiceDate",
                                      )}
                                      onApprove={() =>
                                        approveField(
                                          doc.documentId,
                                          "invoiceDate",
                                        )
                                      }
                                    />
                                  )}
                                  {s.totalAmount != null && (
                                    <AnchoredField
                                      label="发票金额"
                                      value={s.totalAmount}
                                      anchor={
                                        summary.sourceAnchors?.totalAmount
                                      }
                                      confidence={summary.confidence}
                                      format={(v) =>
                                        `¥${Number(v).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`
                                      }
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        "totalAmount",
                                      )}
                                      onApprove={() =>
                                        approveField(
                                          doc.documentId,
                                          "totalAmount",
                                        )
                                      }
                                    />
                                  )}
                                  {s.institution && (
                                    <AnchoredField
                                      label="开票机构"
                                      value={s.institution}
                                      anchor={
                                        summary.sourceAnchors?.institution
                                      }
                                      confidence={summary.confidence}
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        "institution",
                                      )}
                                      onApprove={() =>
                                        approveField(
                                          doc.documentId,
                                          "institution",
                                        )
                                      }
                                    />
                                  )}
                                </>
                              );
                            })()}

                          {/* 伤残鉴定 */}
                          {summary.summaryType === "disability_assessment" &&
                            (() => {
                              const s =
                                summary as import("../types").DisabilityAssessmentSummary;
                              return (
                                <>
                                  {s.disabilityLevel && (
                                    <AnchoredField
                                      label="伤残等级"
                                      value={s.disabilityLevel}
                                      anchor={
                                        summary.sourceAnchors?.disabilityLevel
                                      }
                                      confidence={summary.confidence}
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        "disabilityLevel",
                                      )}
                                      onApprove={() =>
                                        approveField(
                                          doc.documentId,
                                          "disabilityLevel",
                                        )
                                      }
                                    />
                                  )}
                                  {s.assessmentDate && (
                                    <AnchoredField
                                      label="鉴定日期"
                                      value={s.assessmentDate}
                                      anchor={
                                        summary.sourceAnchors?.assessmentDate
                                      }
                                      confidence={summary.confidence}
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        "assessmentDate",
                                      )}
                                      onApprove={() =>
                                        approveField(
                                          doc.documentId,
                                          "assessmentDate",
                                        )
                                      }
                                    />
                                  )}
                                  {s.assessmentInstitution && (
                                    <AnchoredField
                                      label="鉴定机构"
                                      value={s.assessmentInstitution}
                                      anchor={
                                        summary.sourceAnchors
                                          ?.assessmentInstitution
                                      }
                                      confidence={summary.confidence}
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        "assessmentInstitution",
                                      )}
                                      onApprove={() =>
                                        approveField(
                                          doc.documentId,
                                          "assessmentInstitution",
                                        )
                                      }
                                    />
                                  )}
                                </>
                              );
                            })()}

                          {/* 误工证明 */}
                          {summary.summaryType === "income_lost" &&
                            (() => {
                              const s =
                                summary as import("../types").IncomeLostSummary;
                              return (
                                <>
                                  {s.monthlyIncome != null && (
                                    <AnchoredField
                                      label="月收入"
                                      value={s.monthlyIncome}
                                      anchor={
                                        summary.sourceAnchors?.monthlyIncome
                                      }
                                      confidence={summary.confidence}
                                      format={(v) =>
                                        `¥${Number(v).toLocaleString("zh-CN")}`
                                      }
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        "monthlyIncome",
                                      )}
                                      onApprove={() =>
                                        approveField(
                                          doc.documentId,
                                          "monthlyIncome",
                                        )
                                      }
                                    />
                                  )}
                                  {s.lostWorkDays != null && (
                                    <AnchoredField
                                      label="误工天数"
                                      value={`${s.lostWorkDays} 天`}
                                      anchor={
                                        summary.sourceAnchors?.lostWorkDays
                                      }
                                      confidence={summary.confidence}
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        "lostWorkDays",
                                      )}
                                      onApprove={() =>
                                        approveField(
                                          doc.documentId,
                                          "lostWorkDays",
                                        )
                                      }
                                    />
                                  )}
                                  {s.employer && (
                                    <AnchoredField
                                      label="工作单位"
                                      value={s.employer}
                                      anchor={summary.sourceAnchors?.employer}
                                      confidence={summary.confidence}
                                      onJumpTo={makeJump}
                                      approved={isFieldApproved(
                                        doc.documentId,
                                        "employer",
                                      )}
                                      onApprove={() =>
                                        approveField(doc.documentId, "employer")
                                      }
                                    />
                                  )}
                                </>
                              );
                            })()}

                          {/* 其他类型：通用展示 sourceAnchors 中的字段 */}
                          {![
                            "accident_liability",
                            "inpatient_record",
                            "expense_invoice",
                            "disability_assessment",
                            "income_lost",
                          ].includes(summary.summaryType) &&
                            Object.keys(summary.sourceAnchors || {})
                              .slice(0, 6)
                              .map((key) => (
                                <AnchoredField
                                  key={key}
                                  label={key}
                                  value={String(
                                    (summary as Record<string, unknown>)[key] ??
                                      "—",
                                  )}
                                  anchor={summary.sourceAnchors?.[key]}
                                  confidence={summary.confidence}
                                  onJumpTo={makeJump}
                                  approved={isFieldApproved(
                                    doc.documentId,
                                    key,
                                  )}
                                  onApprove={() =>
                                    approveField(doc.documentId, key)
                                  }
                                />
                              ))}
                        </>
                      ) : (
                        <div className="text-xs text-gray-400 px-2 py-2">
                          暂无 AI 提取结果
                        </div>
                      )}
                    </AnchoredSection>
                  );
                })}
              </div>

              {/* 右栏：文件查看器 */}
              <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
                {selectedViewerDoc ? (
                  <DocumentViewer
                    ref={viewerRef}
                    fileUrl={selectedViewerDoc.fileUrl}
                    fileType={selectedViewerDoc.fileType}
                    fileName={selectedViewerDoc.fileName}
                    initialAnchor={activeAnchor}
                    className="h-full"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                    <svg
                      className="w-16 h-16 text-gray-200"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="text-sm">点击左栏字段右侧的跳转图标</p>
                    <p className="text-sm">即可在此处查看对应源文件位置</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}{" "}
      {/* end material_review */}
      {/* 定损报告 Tab */}
      {activeTab === "damage_report" && (
        <div className="max-w-[1400px] mx-auto px-8 mt-6">
          {!damageReport ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
              <svg
                className="w-16 h-16 text-gray-200"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-sm">尚未生成定损报告</p>
              <p className="text-xs text-gray-400">
                请先完成材料审核，再生成报告
              </p>
              <button
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="flex items-center px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {generatingReport ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    生成中...
                  </>
                ) : (
                  "生成定损报告"
                )}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* 报告头部 */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">定损报告</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    生成时间：
                    {new Date(
                      String(
                        (damageReport as Record<string, unknown>).generatedAt ??
                          Date.now(),
                      ),
                    ).toLocaleString("zh-CN")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${(damageReport as Record<string, unknown>).status === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {(damageReport as Record<string, unknown>).status ===
                    "confirmed"
                      ? "已确认"
                      : "草稿"}
                  </span>
                  <button
                    onClick={handleGenerateReport}
                    disabled={generatingReport}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    重新生成
                  </button>
                </div>
              </div>

              {/* 汇总金额 */}
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
                <div className="grid grid-cols-3 gap-8">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">损失总额</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ¥
                      {Number(
                        (damageReport as Record<string, unknown>).subTotal ?? 0,
                      ).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">责任调整系数</p>
                    <p className="text-2xl font-bold text-red-600">
                      ×{" "}
                      {Number(
                        (damageReport as Record<string, unknown>)
                          .liabilityAdjustment ?? 1,
                      ).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">应赔金额</p>
                    <p className="text-2xl font-bold text-indigo-700">
                      ¥
                      {Number(
                        (damageReport as Record<string, unknown>).finalAmount ??
                          0,
                      ).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* 分项明细 */}
              {Array.isArray((damageReport as Record<string, unknown>).items) &&
                ((damageReport as Record<string, unknown>).items as unknown[])
                  .length > 0 && (
                  <div className="px-6 py-4">
                    <h3 className="text-sm font-bold text-gray-700 mb-3">
                      损失明细
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                              项目
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">
                              损失金额
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">
                              核定金额
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                              计算依据
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(
                            (damageReport as Record<string, unknown>)
                              .items as Array<{
                              id: string;
                              itemName: string;
                              originalAmount: number;
                              approvedAmount: number;
                              formula: string;
                              basis: string;
                            }>
                          ).map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {item.itemName}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-600">
                                ¥
                                {item.originalAmount.toLocaleString("zh-CN", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-medium text-indigo-700">
                                ¥
                                {item.approvedAmount.toLocaleString("zh-CN", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                                <div>{item.basis}</div>
                                {item.formula && (
                                  <div className="text-gray-400 font-mono mt-0.5">
                                    {item.formula}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* HTML 报告预览（折叠） */}
              {(damageReport as Record<string, unknown>).reportHtml && (
                <div className="px-6 py-4 border-t border-gray-100">
                  <details>
                    <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                      查看完整报告 HTML 版本
                    </summary>
                    <div
                      className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: String(
                          (damageReport as Record<string, unknown>).reportHtml,
                        ),
                      }}
                    />
                  </details>
                </div>
              )}
            </div>
          )}
        </div>
      )}{" "}
      {/* end damage_report */}
      {/* 操作日志模态框 */}
      {showLogsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[700px] max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900">操作日志</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  索赔编号: {claim.reportNumber}
                </p>
              </div>
              <button
                onClick={() => setShowLogsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {logsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <span className="ml-3 text-gray-500">加载中...</span>
                </div>
              ) : operationLogs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <svg
                    className="w-12 h-12 mx-auto text-gray-300 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  暂无操作日志
                </div>
              ) : (
                <div className="space-y-3">
                  {operationLogs.map((log, index) => (
                    <div
                      key={log.logId}
                      className="relative pl-6 pb-4 border-l-2 border-gray-200 last:border-l-transparent last:pb-0"
                    >
                      {/* Timeline dot */}
                      <div
                        className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white ${
                          log.success ? "bg-green-500" : "bg-red-500"
                        }`}
                      ></div>

                      {/* Log content */}
                      <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${getOperationStyle(log.operationType)}`}
                            >
                              {log.operationLabel}
                            </span>
                            {!log.success && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                失败
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            {formatTime(log.timestamp)}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <svg
                              className="w-4 h-4 text-gray-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                            {log.userName}
                          </span>
                          {log.duration && (
                            <span className="flex items-center gap-1">
                              <svg
                                className="w-4 h-4 text-gray-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              {log.duration}ms
                            </span>
                          )}
                        </div>

                        {/* Extra data */}
                        {(log.inputData || log.outputData) && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            {log.inputData && (
                              <div className="text-xs text-gray-500">
                                <span className="font-medium">输入:</span>{" "}
                                {Object.entries(log.inputData)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(", ")}
                              </div>
                            )}
                            {log.outputData && (
                              <div className="text-xs text-gray-500">
                                <span className="font-medium">结果:</span>{" "}
                                {Object.entries(log.outputData)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(", ")}
                              </div>
                            )}
                          </div>
                        )}

                        {log.errorMessage && (
                          <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                            {log.errorMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 材料预览模态框 */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {previewDoc.fileName}
                </h3>
                <p className="text-sm text-indigo-600 mt-0.5">
                  {previewDoc.classification.materialName}
                </p>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Image preview */}
              {previewDoc.ossUrl &&
                previewDoc.fileType?.startsWith("image/") && (
                  <div className="mb-4">
                    <img
                      src={previewDoc.ossUrl}
                      alt={previewDoc.fileName}
                      className="w-full rounded-lg border border-gray-200"
                    />
                  </div>
                )}
              {/* OSS link for non-image files */}
              {previewDoc.ossUrl &&
                !previewDoc.fileType?.startsWith("image/") && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <a
                      href={previewDoc.ossUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center"
                    >
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                      在新窗口中打开文件
                    </a>
                  </div>
                )}
              {/* Structured data */}
              {previewDoc.structuredData &&
                Object.keys(previewDoc.structuredData).length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-3">
                      识别信息
                    </h4>
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-2">
                      {Object.entries(previewDoc.structuredData).map(
                        ([key, value]) => (
                          <div key={key} className="flex items-start text-sm">
                            <span className="text-gray-500 min-w-[100px] flex-shrink-0">
                              {key}:
                            </span>
                            <span className="text-gray-900 font-medium">
                              {String(value)}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
              {/* No data hint */}
              {!previewDoc.ossUrl &&
                (!previewDoc.structuredData ||
                  Object.keys(previewDoc.structuredData).length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <svg
                      className="w-12 h-12 mx-auto text-gray-300 mb-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="text-sm">该文件暂无预览内容</p>
                    <p className="text-xs text-gray-400 mt-1">
                      材料分类: {previewDoc.classification.materialName}
                    </p>
                  </div>
                )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 离线材料导入 */}
      <OfflineMaterialImportButton onClick={() => setShowImportDialog(true)} />
      <OfflineMaterialImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        claimCaseId={claim.id}
        productCode={claim.productCode || "PROD001"}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
};

export default ClaimCaseDetailPage;
