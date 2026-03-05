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
  type ClaimFileCategory,
  type ClaimsMaterial,
  type ClaimMaterial,
} from "../types";
import OfflineMaterialImportButton from "./OfflineMaterialImportButton";
import OfflineMaterialImportDialog from "./OfflineMaterialImportDialog";
import DocumentViewer, { type DocumentViewerRef } from "./ui/DocumentViewer";
import AnchoredField, { AnchoredSection } from "./ui/AnchoredField";
import MaterialReviewPanel from "./material-review/MaterialReviewPanel";
import { toMaterialViewItem } from "../types/material-review";
import { getSignedUrl } from "../services/ossService";
import { api } from "../services/api";

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

// 根据文件名推断 MIME 类型
const inferFileType = (fileName: string): string => {
  if (!fileName) return 'application/octet-stream';
  const ext = fileName.split('.').pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return typeMap[ext] || 'application/octet-stream';
};

const ClaimCaseDetailPage: React.FC<ClaimCaseDetailPageProps> = ({
  claim,
  onBack,
}) => {
  const [openFiles, setOpenFiles] = useState<Record<string, boolean>>({
    医疗费用: true,
  });
  const [localFileCategories, setLocalFileCategories] = useState<
    { name: string; files: { name: string; url: string; ossKey?: string }[] }[]
  >(claim.fileCategories || []);
  const [fileCategoriesLoading, setFileCategoriesLoading] = useState(false);
  
  // 文件解析相关状态
  const [parsingFiles, setParsingFiles] = useState<Set<string>>(new Set());
  const [parsedResults, setParsedResults] = useState<Record<string, any>>({});
  const [materialList, setMaterialList] = useState<ClaimsMaterial[]>([]);
  
  // 当 claim.fileCategories 变化时，更新 localFileCategories
  useEffect(() => {
    if (claim.fileCategories) {
      setLocalFileCategories(claim.fileCategories);
      console.log("[FileCategories] Updated from claim:", claim.fileCategories.length, "categories");
    }
  }, [claim.fileCategories]);
  
  // 当 claim.fileParseResults 变化时，更新 parsedResults
  useEffect(() => {
    if (claim.fileParseResults) {
      console.log("[Parse] claim.fileParseResults changed:", Object.keys(claim.fileParseResults));
      const savedResults: Record<string, any> = {};
      Object.entries(claim.fileParseResults).forEach(([key, value]: [string, any]) => {
        savedResults[key] = {
          extractedData: value.extractedData,
          structuredData: value.extractedData,
          auditConclusion: value.auditConclusion,
          confidence: value.confidence,
          materialName: value.materialName,
          materialId: value.materialId,
          parsedAt: value.parsedAt,
        };
      });
      setParsedResults(savedResults);
    }
  }, [claim.fileParseResults]);
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
    auditConclusion?: string;
    confidence?: number;
  } | null>(null);

  // --- 材料审核 Tab 状态 ---
  const [activeTab, setActiveTab] = useState<ActiveTab>("case_info");
  // 统一材料数据（来自 claim-materials API）
  const [claimMaterials, setClaimMaterials] = useState<ClaimMaterial[]>([]);
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
  const [useNewMaterialView, setUseNewMaterialView] = useState(true);
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

  const fetchFileCategories = async () => {
    setFileCategoriesLoading(true);
    try {
      const resp = await fetch(`/api/claim-cases/${claim.id}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.fileCategories) {
          setLocalFileCategories(data.fileCategories);
          console.log("[FileCategories] Loaded:", data.fileCategories.length, "categories");
        }
        // 同时更新 claim 的 fileParseResults（如果后端返回了）
        if (data?.fileParseResults) {
          console.log("[FileCategories] Found fileParseResults:", Object.keys(data.fileParseResults));
        }
      }
    } catch (err) {
      console.error("Failed to fetch file categories:", err);
    } finally {
      setFileCategoriesLoading(false);
    }
  };

  // 加载材料类型列表
  useEffect(() => {
    api.claimsMaterials.list().then((data: any) => {
      if (data && Array.isArray(data) && data.length > 0) {
        setMaterialList(data as ClaimsMaterial[]);
      }
    }).catch(err => {
      console.warn('加载材料类型列表失败:', err);
    });
  }, []);

  // 新增函数：刷新 claim 数据（从 API 获取最新数据）
  const refreshClaimData = async () => {
    try {
      setFileCategoriesLoading(true);
      console.log("[Claim] Refreshing claim data from API for:", claim.id);
      
      const freshClaim = await api.claimCases.getById(claim.id);
      console.log("[Claim] Refreshed claim data:", freshClaim?.id, "fileParseResults:", freshClaim?.fileParseResults);
      
      // 更新本地文件分类状态
      if (freshClaim?.fileCategories) {
        setLocalFileCategories(freshClaim.fileCategories);
        console.log("[Claim] Updated localFileCategories:", freshClaim.fileCategories.length, "categories");
      }
      
      // 如果有 fileParseResults，设置到 parsedResults
      if (freshClaim?.fileParseResults) {
        const savedResults: Record<string, any> = {};
        Object.entries(freshClaim.fileParseResults).forEach(([key, value]: [string, any]) => {
          savedResults[key] = {
            extractedData: value.extractedData,
            structuredData: value.extractedData,
            auditConclusion: value.auditConclusion,
            confidence: value.confidence,
            materialName: value.materialName,
            materialId: value.materialId,
            parsedAt: value.parsedAt,
          };
        });
        setParsedResults(savedResults);
        console.log("[Claim] Set parsedResults from fresh data:", Object.keys(savedResults));
      } else {
        console.log("[Claim] No fileParseResults in fresh data");
      }
      
      return freshClaim;
    } catch (err) {
      console.error("[Claim] Failed to refresh claim data:", err);
      // 失败时使用 prop 数据作为后备
      console.log("[Claim] Falling back to prop data");
      return null;
    } finally {
      setFileCategoriesLoading(false);
    }
  };

  // 加载已保存的文件解析结果（作为 refreshClaimData 的后备）
  const loadSavedParseResults = async () => {
    try {
      console.log("[Parse] Loading saved results for claim:", claim.id);
      
      // 如果 parsedResults 已经通过 refreshClaimData 设置，则跳过
      if (Object.keys(parsedResults).length > 0) {
        console.log("[Parse] parsedResults already populated, skipping");
        return;
      }
      
      // 否则从 API 获取
      const currentClaim = await api.claimCases.getById(claim.id);
      console.log("[Parse] Current claim:", currentClaim?.id, "fileParseResults:", currentClaim?.fileParseResults);
      
      if (currentClaim?.fileParseResults) {
        // 验证 fileParseResults 不是空对象
        const resultKeys = Object.keys(currentClaim.fileParseResults);
        if (resultKeys.length === 0) {
          console.log("[Parse] fileParseResults is empty");
          return;
        }
        
        // 将保存的解析结果转换为前端状态格式
        const savedResults: Record<string, any> = {};
        Object.entries(currentClaim.fileParseResults).forEach(([key, value]: [string, any]) => {
          // 防御性检查
          if (!value || typeof value !== 'object') {
            console.warn(`[Parse] Invalid parse result for key ${key}:`, value);
            return;
          }
          
          savedResults[key] = {
            extractedData: value.extractedData || {},
            structuredData: value.extractedData || {},
            auditConclusion: value.auditConclusion,
            confidence: value.confidence,
            materialName: value.materialName,
            materialId: value.materialId,
            parsedAt: value.parsedAt,
          };
        });
        
        setParsedResults(prev => {
          const merged = { ...prev, ...savedResults };
          console.log("[Parse] Set parsedResults:", Object.keys(merged), "previous:", Object.keys(prev));
          return merged;
        });
        console.log("[Parse] Loaded saved results:", Object.keys(savedResults));
      } else {
        console.log("[Parse] No saved results found");
      }
    } catch (error) {
      console.error("[Parse] Failed to load saved results:", error);
    }
  };

  useEffect(() => {
    const init = async () => {
      console.log("[ClaimDetail] Initializing with claim.id:", claim.id);
      console.log("[ClaimDetail] Starting data fetch sequence");
      fetchImportedDocuments();
      // 先刷新 claim 数据，确保获取最新的 fileParseResults
      await refreshClaimData();
      // 然后再加载已保存的解析结果（作为后备）
      await loadSavedParseResults();
      // 记录查看赔案详情操作
      logOperation({
        operationType: UserOperationType.VIEW_CLAIM_DETAIL,
        operationLabel: "查看赔案详情",
        success: true,
      });
    };
    init();
  }, [claim.id]);

  const handleSmartReview = async () => {
    setReviewing(true);
    setReviewResult(null);
    const startTime = Date.now();
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
      // 记录 AI 审核操作
      await logOperation({
        operationType: UserOperationType.ANALYZE_DOCUMENT,
        operationLabel: `AI智能审核 - ${result.decision === "APPROVE" ? "通过" : result.decision === "REJECT" ? "拒赔" : "需人工复核"}`,
        outputData: {
          decision: result.decision,
          amount: result.amount,
          reasoning: result.reasoning?.slice(0, 500), // 限制长度
        },
        success: true,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      console.error("Smart review failed:", error);
      setReviewResult({
        decision: "MANUAL_REVIEW",
        amount: null,
        reasoning: "智能审核服务异常，请人工处理",
        ruleTrace: [],
        duration: 0,
      });
      // 记录失败的 AI 审核操作
      await logOperation({
        operationType: UserOperationType.ANALYZE_DOCUMENT,
        operationLabel: "AI智能审核 - 失败",
        success: false,
        duration: Date.now() - startTime,
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
    // 记录材料导入操作（包含详细的文件解析信息）
    const successCount = result.documents?.filter((d) => d.status === "completed").length || 0;
    const failCount = result.documents?.filter((d) => d.status === "failed").length || 0;
    
    // 构建详细的文件解析结果
    const fileDetails = result.documents?.map((doc) => ({
      documentId: doc.documentId,
      fileName: doc.fileName,
      fileType: doc.fileType,
      status: doc.status,
      classification: {
        materialId: doc.classification?.materialId,
        materialName: doc.classification?.materialName,
        confidence: doc.classification?.confidence,
        source: doc.classification?.source,
      },
      // 结构化数据（OCR/AI提取的关键信息）
      extractedData: doc.structuredData || null,
      // 错误信息
      errorMessage: doc.errorMessage || null,
      // OSS地址（用于查看）
      ossUrl: doc.ossUrl || null,
    }));

    // 完整性检查结果
    const completenessInfo = {
      isComplete: result.completeness?.isComplete,
      score: result.completeness?.score,
      requiredMaterials: result.completeness?.requiredMaterials,
      providedMaterials: result.completeness?.providedMaterials,
      missingMaterials: result.completeness?.missingMaterials,
      warnings: result.completeness?.warnings,
    };

    logOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: `导入理赔材料 (${successCount}个成功${failCount > 0 ? `, ${failCount}个失败` : ""})`,
      inputData: {
        totalFiles: result.documents?.length || 0,
        successCount,
        failCount,
      },
      outputData: {
        // 详细的文件解析列表
        files: fileDetails,
        // 完整性检查结果
        completeness: completenessInfo,
        // 材料分类统计
        classificationSummary: fileDetails?.reduce((acc, file) => {
          const materialName = file.classification?.materialName || "未分类";
          acc[materialName] = (acc[materialName] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        // 按状态统计
        statusSummary: {
          completed: successCount,
          failed: failCount,
          processing: result.documents?.filter((d) => d.status === "processing").length || 0,
        },
      },
      success: failCount === 0,
    });
  };

  // 加载材料审核数据（统一从 claim-materials API 获取）
  const loadReviewData = async () => {
    try {
      // 使用新的统一 materials API
      const resp = await fetch(`/api/claim-materials?claimCaseId=${claim.id}`);
      if (!resp.ok) return;
      const data = await resp.json();

      // 保存统一材料数据
      setClaimMaterials(data.materials || []);

      // 转换为 reviewDocuments 格式（兼容现有 UI）
      const allDocs: typeof reviewDocuments = (data.materials || []).map((m: ClaimMaterial) => {
        // 根据 materialName 查找对应的 ClaimsMaterial.id
        let resolvedMaterialId = m.materialId;
        let resolvedMaterialName = m.materialName || m.category || "未分类";
        
        if (!resolvedMaterialId || resolvedMaterialId === 'unknown') {
          // 尝试根据名称匹配材料类型
          const matchedMaterial = materialList.find((mat: ClaimsMaterial) => 
            mat.name === resolvedMaterialName || 
            resolvedMaterialName.includes(mat.name) ||
            mat.name.includes(resolvedMaterialName)
          );
          if (matchedMaterial) {
            resolvedMaterialId = matchedMaterial.id;
          }
        }
        
        return {
          documentId: m.id,
          fileName: m.fileName,
          fileType: m.fileType,
          ossUrl: m.url,
          ossKey: m.ossKey,
          classification: {
            materialId: resolvedMaterialId || "unknown",
            materialName: resolvedMaterialName,
            confidence: m.confidence || 0,
          },
          structuredData: m.extractedData,
          documentSummary: m.documentSummary,
          duplicateWarning: m.metadata?.duplicateWarning || null,
          status: m.status,
          batchId: m.sourceDetail?.importId,
          importedAt: m.uploadedAt,
        };
      });

      const allSummaries: AnyDocumentSummary[] = (data.materials || [])
        .filter((m: ClaimMaterial) => m.documentSummary)
        .map((m: ClaimMaterial) => m.documentSummary as AnyDocumentSummary);

      setReviewDocuments(allDocs);
      setReviewSummaries(allSummaries);
    } catch {
      // 静默失败
    }
  };

  // 生成定损报告
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    const startTime = Date.now();
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
        logOperation({
          operationType: UserOperationType.GENERATE_REPORT,
          operationLabel: "生成定损报告",
          outputData: {
            reportId: report.reportId,
            finalAmount: report.finalAmount,
            itemCount: report.items?.length,
          },
          success: true,
          duration: Date.now() - startTime,
        });
      }
    } catch {
      // 静默失败
    } finally {
      setGeneratingReport(false);
    }
  };

  // 跳转到文件并高亮锚点
  const handleJumpTo = async (
    doc: { ossUrl?: string; ossKey?: string; fileType: string; fileName: string },
    anchor: SourceAnchor,
  ) => {
    if (!doc.ossUrl && !doc.ossKey) return;
    
    // 获取文件预览 URL（优先使用 ossKey 获取实时签名 URL）
    let fileUrl = doc.ossUrl;
    if (doc.ossKey) {
      try {
        fileUrl = await getSignedUrl(doc.ossKey, 3600);
      } catch (e) {
        console.error("[Viewer] Failed to get signed URL:", e);
        // 如果获取失败，尝试使用现有的 ossUrl
        if (!fileUrl) {
          alert("获取文件预览链接失败，请稍后重试");
          return;
        }
      }
    }
    
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
      fileUrl,
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

  // 根据分类名称匹配材料配置
  const findMaterialConfig = (categoryName: string): ClaimsMaterial | undefined => {
    return materialList.find(m => 
      m.name === categoryName || 
      categoryName.includes(m.name) || 
      m.name.includes(categoryName)
    );
  };

  // 解析文件 - 根据已识别的材料类型和配置的 schema 提取结构化内容
  const handleParseFile = async (
    file: { name: string; url: string; ossKey?: string },
    categoryName: string
  ) => {
    const fileKey = `${categoryName}-${file.name}`;
    console.log("[Parse] Starting parse for:", fileKey);
    
    // 如果已经在解析中，则跳过
    if (parsingFiles.has(fileKey)) {
      console.log("[Parse] Already parsing, skipping:", fileKey);
      return;
    }
    
    // 查找材料配置
    const materialConfig = findMaterialConfig(categoryName);
    if (!materialConfig) {
      console.warn(`[Parse] Material config not found for: ${categoryName}`);
      alert(`未找到材料类型 "${categoryName}" 的配置，请先配置该材料类型`);
      return;
    }
    
    console.log("[Parse] Found material config:", materialConfig.name, "ID:", materialConfig.id);
    setParsingFiles((prev) => new Set(prev).add(fileKey));
    
    try {
      let fileUrl = file.url;
      
      // 如果有 ossKey 但 url 看起来像是过期的 OSS 链接，或者没有 url，则获取实时签名 URL
      if (file.ossKey && (!fileUrl || fileUrl.includes("aliyuncs.com"))) {
        try {
          fileUrl = await getSignedUrl(file.ossKey, 3600);
        } catch (e) {
          console.error("[Parse] Failed to get signed URL:", e);
          alert("获取文件链接失败，请稍后重试");
          return;
        }
      }
      
      if (!fileUrl) {
        alert("文件链接不可用");
        return;
      }

      // 确定文件类型
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
      const isPdf = /\.pdf$/i.test(file.name);
      
      console.log("[Parse] Calling parse API for:", file.name, "type:", isImage ? "image" : isPdf ? "pdf" : "unknown");
      
      // 调用解析 API，传入材料配置的 schema 和 prompt
      const response = await fetch("/api/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl,
          fileName: file.name,
          fileType: isImage ? "image" : isPdf ? "pdf" : "unknown",
          materialName: materialConfig.name,
          jsonSchema: materialConfig.jsonSchema,
          aiAuditPrompt: materialConfig.aiAuditPrompt || "请提取图片中的关键信息",
        }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "解析失败");
      }
      
      const result = await response.json();
      
      // 构建解析结果对象
      const parseResultData = {
        ...result,
        structuredData: result.extractedData, // 兼容旧代码显示
        materialName: materialConfig.name,
        materialId: materialConfig.id,
      };
      
      // 保存解析结果到本地状态
      setParsedResults((prev) => ({
        ...prev,
        [fileKey]: parseResultData,
      }));
      
      // 保存解析结果到后端（持久化）
      try {
        const currentClaim = await api.claimCases.getById(claim.id);
        const existingParseResults = currentClaim?.fileParseResults || {};
        
        await api.claimCases.update(claim.id, {
          fileParseResults: {
            ...existingParseResults,
            [fileKey]: {
              extractedData: result.extractedData || {},
              auditConclusion: result.auditConclusion,
              confidence: result.confidence,
              materialName: materialConfig.name,
              materialId: materialConfig.id,
              parsedAt: new Date().toISOString(),
            },
          },
        });
        console.log("[Parse] Result saved to backend:", fileKey);
        
        // 同步到 claim-materials（确保材料审核页能看到）
        try {
          // 先检查是否已存在
          const materialsResp = await fetch(`/api/claim-materials?claimCaseId=${claim.id}`);
          if (materialsResp.ok) {
            const materialsData = await materialsResp.json();
            const existingMaterial = materialsData.materials?.find(
              (m: ClaimMaterial) => m.fileName === file.name && m.source === 'direct_upload'
            );
            
            if (existingMaterial) {
              // 更新现有记录（添加解析结果）
              await fetch(`/api/claim-materials/${existingMaterial.id}/parse`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  extractedData: result.extractedData,
                  auditConclusion: result.auditConclusion,
                  confidence: result.confidence,
                  materialId: materialConfig.id,
                  materialName: materialConfig.name,
                  status: 'completed',
                  processedAt: new Date().toISOString(),
                }),
              });
              console.log("[Parse] Updated existing material:", existingMaterial.id);
            } else {
              // 创建新记录
              await fetch('/api/claim-materials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  claimCaseId: claim.id,
                  fileName: file.name,
                  fileType: inferFileType(file.name),
                  url: file.url || '#',
                  ossKey: file.ossKey,
                  category: categoryName,
                  materialId: materialConfig.id,
                  materialName: materialConfig.name,
                  extractedData: result.extractedData,
                  auditConclusion: result.auditConclusion,
                  confidence: result.confidence,
                  source: 'direct_upload',
                  status: 'completed',
                  uploadedAt: new Date().toISOString(),
                  processedAt: new Date().toISOString(),
                }),
              });
              console.log("[Parse] Created new material for:", file.name);
            }
          }
        } catch (syncError) {
          console.error("[Parse] Failed to sync to claim-materials:", syncError);
          // 同步失败不影响主流程
        }
      } catch (saveError) {
        console.error("[Parse] Failed to save result to backend:", saveError);
        // 保存失败不影响用户体验，继续执行
      }
      
      // 记录操作日志
      await logOperation({
        operationType: UserOperationType.ANALYZE_DOCUMENT,
        operationLabel: `解析文件 - ${file.name} (${materialConfig.name})`,
        inputData: { fileName: file.name, category: categoryName, materialId: materialConfig.id },
        outputData: { success: true, hasExtractedData: !!result.extractedData },
        success: true,
      });
    } catch (error: any) {
      console.error("[Parse] Failed:", error);
      alert(`解析失败: ${error.message || "未知错误"}`);
      
      // 记录失败日志
      await logOperation({
        operationType: UserOperationType.ANALYZE_DOCUMENT,
        operationLabel: `解析文件失败 - ${file.name}`,
        inputData: { fileName: file.name, category: categoryName, materialId: materialConfig?.id },
        outputData: { error: error.message },
        success: false,
      });
    } finally {
      setParsingFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileKey);
        return next;
      });
    }
  };

  // 获取当前用户信息
  const getCurrentUser = (): { userName?: string; userId?: string } => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        return {
          userName: user.userName || user.name || user.username || user.id,
          userId: user.id || user.userId,
        };
      }
    } catch {
      // 忽略解析错误
    }
    return { userName: "系统用户", userId: "system" };
  };

  // 记录操作日志
  const logOperation = async (params: {
    operationType: UserOperationType;
    operationLabel: string;
    inputData?: Record<string, unknown>;
    outputData?: Record<string, unknown>;
    success?: boolean;
    duration?: number;
  }) => {
    try {
      const user = getCurrentUser();
      await fetch("/api/operation-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId: claim.id,
          claimReportNumber: claim.reportNumber,
          currentStatus: claim.status,
          userName: user.userName,
          userId: user.userId,
          ...params,
        }),
      });
    } catch (error) {
      console.error("[logOperation] Failed to log:", error);
      // 静默失败，不影响主流程
    }
  };

  // 获取操作日志
  const fetchOperationLogs = async () => {
    setLogsLoading(true);
    try {
      const response = await fetch(`/api/operation-logs?claimId=${claim.id}`);
      if (response.ok) {
        const data = await response.json();
        setOperationLogs(data.logs || []);
      } else {
        console.error("[fetchOperationLogs] API error:", response.status);
        setOperationLogs([]);
      }
    } catch (error) {
      console.error("Failed to fetch operation logs:", error);
      setOperationLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

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
          <div className="flex items-center space-x-2">
            <span className="bg-[#eef2ff] text-[#4338ca] px-4 py-1.5 rounded-full text-sm font-medium border border-[#e0e7ff]">
              索赔编号: {claim.reportNumber}
            </span>
            {claim.id && claim.id.startsWith('CLM') && (
              <span className="bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full text-sm font-medium border border-orange-200" title="索赔人端看到的编号">
                前端编号: {claim.id}
              </span>
            )}
          </div>
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
                    ¥
                    {claim.claimAmount != null
                      ? Number(claim.claimAmount).toFixed(2)
                      : "--"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">核准金额</p>
                  <p className="text-lg font-bold text-blue-600">
                    ¥
                    {claim.approvedAmount != null
                      ? Number(claim.approvedAmount).toFixed(2)
                      : "--"}
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
                    ¥
                    {claim.claimAmount != null
                      ? Number(claim.claimAmount).toFixed(2)
                      : "--"}
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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">索赔文件</h2>
                  {Object.keys(parsedResults).length > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                      已解析 {Object.keys(parsedResults).length}
                    </span>
                  )}
                </div>
                <button
                  onClick={fetchFileCategories}
                  disabled={fileCategoriesLoading}
                  className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400 flex items-center gap-1"
                  title="刷新文件列表"
                >
                  <svg
                    className={`w-4 h-4 ${fileCategoriesLoading ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  刷新
                </button>
              </div>

              {/* 索赔人上传的文件（报案时提交） */}
              {localFileCategories && localFileCategories.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {localFileCategories.map((cat, i) => (
                    <div
                      key={i}
                      className="border border-gray-100 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleFileCategory(cat.name)}
                        className="w-full flex justify-between items-center px-4 py-3 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
                      >
                        <span>
                          {cat.name} ({cat.files.length}个文件)
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
                      {openFiles[cat.name] !== false &&
                        cat.files.length > 0 && (
                          <div className="px-4 py-2 space-y-2 bg-gray-50/30">
                            {cat.files.map((file, idx) => {
                              const isImage =
                                /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
                              const isPdf = /\.pdf$/i.test(file.name);
                              const isExcel = /\.(xlsx|xls)$/i.test(file.name);
                              const isWord = /\.(docx|doc)$/i.test(file.name);
                              const canParse = isImage || isPdf || isExcel || isWord;
                              const hasValidUrl =
                                file.url &&
                                (file.url.startsWith("/uploads/") ||
                                  file.url.startsWith("http"));
                              const fileKey = `${cat.name}-${file.name}`;
                              const isParsing = parsingFiles.has(fileKey);
                              const parseResult = parsedResults[fileKey];
                              
                              return (
                                <div key={idx} className="space-y-2">
                                  <div className="flex items-center justify-between group">
                                    <div
                                      className="flex items-center space-x-2 text-xs text-blue-600 hover:underline cursor-pointer flex-1"
                                      onClick={async () => {
                                        if (!hasValidUrl) return;
                                        
                                        let previewUrl = file.url;
                                        
                                        // 如果有 ossKey，实时获取新的签名 URL
                                        if (file.ossKey) {
                                          try {
                                            previewUrl = await getSignedUrl(file.ossKey, 3600);
                                          } catch (e) {
                                            console.error("[Preview] Failed to get signed URL:", e);
                                            alert("获取文件预览链接失败，请稍后重试");
                                            return;
                                          }
                                        }
                                        
                                        setPreviewDoc({
                                          fileName: file.name,
                                          fileType: isImage
                                            ? "image/jpeg"
                                            : "application/octet-stream",
                                          ossUrl: previewUrl,
                                          classification: {
                                            materialName: cat.name,
                                          },
                                        });
                                      }}
                                    >
                                      <svg
                                        className="w-4 h-4 text-gray-400 flex-shrink-0"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d={
                                            isImage
                                              ? "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 00-2 2z"
                                              : "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                          }
                                        />
                                      </svg>
                                      <span
                                        className={
                                          hasValidUrl ? "" : "text-gray-400"
                                        }
                                      >
                                        {file.name}
                                      </span>
                                    </div>
                                    {/* 解析按钮 */}
                                    {canParse && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleParseFile(file, cat.name);
                                        }}
                                        disabled={isParsing}
                                        className={`ml-2 px-2 py-0.5 text-[10px] rounded border transition-colors flex items-center space-x-1 ${
                                          isParsing
                                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-wait"
                                            : parseResult
                                              ? "bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
                                              : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                                        }`}
                                      >
                                        {isParsing ? (
                                          <>
                                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            <span>解析中</span>
                                          </>
                                        ) : parseResult ? (
                                          <>
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>已解析</span>
                                          </>
                                        ) : (
                                          <>
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6 4h8a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h6" />
                                            </svg>
                                            <span>解析</span>
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                  {/* 解析结果展示 */}
                                  {parseResult && (
                                    <div className="ml-6 p-2 bg-gray-50 rounded border border-gray-100 text-[11px]">
                                      {parseResult.structuredData && Object.keys(parseResult.structuredData).length > 0 ? (
                                        <div className="space-y-1">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <span className="text-gray-500 font-medium">提取结果:</span>
                                              {parseResult.materialName && (
                                                <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                  {parseResult.materialName}
                                                </span>
                                              )}
                                            </div>
                                            {parseResult.confidence && (
                                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                parseResult.confidence >= 0.9
                                                  ? "bg-green-100 text-green-700"
                                                  : parseResult.confidence >= 0.7
                                                    ? "bg-yellow-100 text-yellow-700"
                                                    : "bg-red-100 text-red-700"
                                              }`}>
                                                置信度 {(parseResult.confidence * 100).toFixed(0)}%
                                              </span>
                                            )}
                                          </div>
                                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 max-h-32 overflow-y-auto">
                                            {Object.entries(parseResult.structuredData).slice(0, 8).map(([key, value]: [string, any]) => {
                                              // 跳过复杂对象和数组
                                              if (typeof value === 'object' && value !== null) return null;
                                              return (
                                                <div key={key} className="flex items-start">
                                                  <span className="text-gray-400 mr-1">{key}:</span>
                                                  <span className="text-gray-700 font-medium truncate">
                                                    {String(value)}
                                                  </span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                          <button
                                            onClick={async () => {
                                              let previewUrl = file.url;
                                              
                                              // 如果有 ossKey，实时获取新的签名 URL
                                              if (file.ossKey) {
                                                try {
                                                  previewUrl = await getSignedUrl(file.ossKey, 3600);
                                                } catch (e) {
                                                  console.error("[Preview] Failed to get signed URL:", e);
                                                  alert("获取文件预览链接失败，请稍后重试");
                                                  return;
                                                }
                                              }
                                              
                                              setPreviewDoc({
                                                fileName: file.name,
                                                fileType: isImage ? "image/jpeg" : "application/octet-stream",
                                                ossUrl: previewUrl,
                                                classification: { materialName: cat.name },
                                                structuredData: parseResult.structuredData,
                                                auditConclusion: parseResult.auditConclusion,
                                                confidence: parseResult.confidence,
                                              });
                                            }}
                                            className="mt-1 text-blue-600 hover:underline"
                                          >
                                            查看完整结果 →
                                          </button>
                                        </div>
                                      ) : parseResult.text ? (
                                        <div>
                                          <span className="text-gray-500">提取文本:</span>
                                          <p className="text-gray-700 mt-1 line-clamp-3">{parseResult.text.slice(0, 150)}...</p>
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">暂无提取结果</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-4">暂无上传文件</p>
              )}

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
                              doc.status !== "completed"
                                ? "bg-red-100 text-red-700"
                                : doc.classification?.materialId === "unknown"
                                  ? "bg-gray-100 text-gray-600"
                                  : "bg-green-100 text-green-700"
                            }`}
                          >
                            {doc.status !== "completed"
                              ? "失败"
                              : doc.classification?.materialId === "unknown"
                                ? "未识别"
                                : "已识别"}
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
              <div className="text-center py-8 text-gray-400">
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm">暂无风险指标</p>
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
              <button
                onClick={() => setUseNewMaterialView(!useNewMaterialView)}
                className="flex items-center px-3 py-1.5 text-sm bg-gray-100 text-gray-700 border border-gray-200 rounded-md hover:bg-gray-200"
              >
                {useNewMaterialView ? "传统视图" : "新视图"}
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

          {useNewMaterialView ? (
            <MaterialReviewPanel
              materials={reviewDocuments.map(toMaterialViewItem)}
              claimCase={claim}
            />
          ) : reviewDocuments.length === 0 ? (
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
                        ossKey: doc.ossKey,
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
                        doc.ossUrl || doc.ossKey
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
                            {/* 文件导入类型 - 详细展示 */}
                            {(log.operationType === UserOperationType.UPLOAD_FILE || 
                              log.operationType === UserOperationType.IMPORT_MATERIALS) && 
                              log.outputData?.files && (
                              <div className="mt-2">
                                <div className="text-xs font-medium text-gray-700 mb-2">
                                  解析文件 ({log.outputData.files.length}个):
                                </div>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {log.outputData.files.map((file: any, idx: number) => (
                                    <div 
                                      key={idx} 
                                      className={`text-xs p-2 rounded ${
                                        file.status === 'completed' ? 'bg-green-50 border border-green-100' :
                                        file.status === 'failed' ? 'bg-red-50 border border-red-100' :
                                        'bg-yellow-50 border border-yellow-100'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium truncate max-w-[200px]" title={file.fileName}>
                                          {file.fileName}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                                          file.status === 'completed' ? 'bg-green-200 text-green-800' :
                                          file.status === 'failed' ? 'bg-red-200 text-red-800' :
                                          'bg-yellow-200 text-yellow-800'
                                        }`}>
                                          {file.status === 'completed' ? '✓' : 
                                           file.status === 'failed' ? '✗' : '⏳'}
                                        </span>
                                      </div>
                                      {file.classification?.materialName && (
                                        <div className="mt-1 text-gray-600">
                                          分类: <span className="text-indigo-600 font-medium">{file.classification.materialName}</span>
                                          {file.classification.confidence !== undefined && (
                                            <span className="text-gray-400 ml-1">
                                              ({(file.classification.confidence * 100).toFixed(0)}%)
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {file.extractedData && Object.keys(file.extractedData).length > 0 && (
                                        <div className="mt-1 pt-1 border-t border-gray-200/50">
                                          <details className="text-xs">
                                            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                                              查看提取数据
                                            </summary>
                                            <pre className="mt-1 p-1.5 bg-white/50 rounded text-xs overflow-auto max-h-20">
                                              {JSON.stringify(file.extractedData, null, 2)}
                                            </pre>
                                          </details>
                                        </div>
                                      )}
                                      {file.errorMessage && (
                                        <div className="mt-1 text-red-600 text-xs">
                                          错误: {file.errorMessage}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                
                                {/* 完整性检查 */}
                                {log.outputData.completeness && (
                                  <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-100">
                                    <div className="text-xs font-medium text-gray-700">
                                      完整性检查: 
                                      <span className={log.outputData.completeness.isComplete ? 'text-green-600' : 'text-yellow-600'}>
                                        {log.outputData.completeness.score}% 
                                        {log.outputData.completeness.isComplete ? '(完整)' : '(不完整)'}
                                      </span>
                                    </div>
                                    {log.outputData.completeness.missingMaterials?.length > 0 && (
                                      <div className="mt-1 text-xs text-red-600">
                                        缺失: {log.outputData.completeness.missingMaterials.join(', ')}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* AI 审核类型 - 详细展示 */}
                            {(log.operationType === UserOperationType.ANALYZE_DOCUMENT || 
                              log.operationType === UserOperationType.QUICK_ANALYZE) && 
                              log.outputData && (
                              <div className="mt-2 p-2 bg-purple-50 rounded border border-purple-100">
                                {log.outputData.decision && (
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-gray-600">审核结论:</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      log.outputData.decision === 'APPROVE' ? 'bg-green-100 text-green-700' :
                                      log.outputData.decision === 'REJECT' ? 'bg-red-100 text-red-700' :
                                      'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {log.outputData.decision === 'APPROVE' ? '✓ 通过' :
                                       log.outputData.decision === 'REJECT' ? '✗ 拒赔' :
                                       '⚠ 需人工复核'}
                                    </span>
                                  </div>
                                )}
                                {log.outputData.amount !== undefined && log.outputData.amount !== null && (
                                  <div className="text-xs mb-1">
                                    <span className="text-gray-600">建议金额:</span>
                                    <span className="ml-1 font-bold text-indigo-600">
                                      ¥{Number(log.outputData.amount).toLocaleString()}
                                    </span>
                                  </div>
                                )}
                                {log.outputData.reasoning && (
                                  <details className="text-xs mt-1">
                                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                                      查看审核意见
                                    </summary>
                                    <div className="mt-1 p-2 bg-white rounded text-gray-700 whitespace-pre-wrap max-h-24 overflow-auto">
                                      {log.outputData.reasoning}
                                    </div>
                                  </details>
                                )}
                              </div>
                            )}

                            {/* 其他类型 - 简单展示 */}
                            {!['UPLOAD_FILE', 'IMPORT_MATERIALS', 'ANALYZE_DOCUMENT', 'QUICK_ANALYZE'].includes(log.operationType) && (
                              <>
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
                              </>
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
      {/* 材料预览模态框 - 复用材料审核的双栏布局设计 */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col">
            {/* Header */}
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
            
            {/* Content - 双栏布局 */}
            <div className="flex-1 flex overflow-hidden">
              {/* 左侧：文件预览 */}
              <div className="w-1/2 border-r border-gray-200 p-4 bg-gray-50">
                <div className="h-full flex items-center justify-center">
                  {previewDoc.ossUrl && previewDoc.fileType?.startsWith("image/") ? (
                    <img
                      src={previewDoc.ossUrl}
                      alt={previewDoc.fileName}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                    />
                  ) : previewDoc.ossUrl ? (
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-500 mb-4">此文件类型不支持预览</p>
                      <a
                        href={previewDoc.ossUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        在新窗口打开
                      </a>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400">
                      <svg className="w-16 h-16 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p>文件预览</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 右侧：材料信息和解析结果 */}
              <div className="w-1/2 p-4 overflow-y-auto">
                {/* 材料信息 */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">材料信息</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">文件名：</span>
                      <span className="text-gray-900">{previewDoc.fileName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">材料类型：</span>
                      <span className="text-gray-900">{previewDoc.classification.materialName}</span>
                    </div>
                    {previewDoc.confidence !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">解析置信度：</span>
                        <span className={`font-medium ${
                          previewDoc.confidence >= 0.9
                            ? 'text-green-600'
                            : previewDoc.confidence >= 0.7
                            ? 'text-blue-600'
                            : 'text-yellow-600'
                        }`}>
                          {Math.round(previewDoc.confidence * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 审核结论 */}
                {previewDoc.auditConclusion && (
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-3">审核结论</h3>
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {previewDoc.auditConclusion}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* AI提取结果 */}
                {previewDoc.structuredData && Object.keys(previewDoc.structuredData).length > 0 ? (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">AI提取结果</h3>
                    <div className="space-y-2">
                      {Object.entries(previewDoc.structuredData).map(([key, value]) => {
                        // 跳过复杂对象和空值
                        if (value === null || value === undefined) return null;
                        
                        const displayValue = typeof value === 'object' 
                          ? JSON.stringify(value, null, 2) 
                          : String(value);
                        const isObject = typeof value === 'object';
                        
                        return (
                          <div key={key} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-500 mb-1">{key}：</span>
                              {isObject ? (
                                <pre className="text-xs font-mono text-gray-900 bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                                  {displayValue}
                                </pre>
                              ) : (
                                <span className="text-sm font-medium text-gray-900">{displayValue}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                    <p className="text-sm text-yellow-700">
                      该材料暂无AI提取结果，请在文件列表中点击"解析"按钮进行识别。
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Footer */}
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
