import React, { useState, useEffect, useRef } from "react";
import {
  type ClaimCase,
  type ClaimProcessTimeline,
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
import Modal from "./ui/Modal";
import {
  MaterialManagementPanel,
  StageDecisionPanel,
} from "./claim-adjuster/ClaimAdjusterPanels";
import DecisionBadge from "./ruleset/DecisionBadge";
import ItemLedgerTimeline from "./ruleset/ItemLedgerTimeline";
import ManualReviewReasonList from "./ruleset/ManualReviewReasonList";
import { getPreviewUrl, getSignedUrl } from "../services/ossService";
import { api } from "../services/api";
import {
  type SmartReviewResultView as SmartReviewResult,
  formatCoverageCode,
  formatManualReviewCode,
  getCoverageResults,
  getReviewExplanationCards,
  getReviewOutcome,
  getReviewSummary,
  groupManualReviewReasons,
  mergeSmartReviewResults,
} from "../utils/claimReviewPresentation";
import {
  formatTimelineEventTime,
  getStageViews,
  getTimelineEventActorLabel,
  getTimelineEventBadge,
  groupTimelineEvents,
} from "../utils/claimTimelinePresentation";

type ActiveTab = "case_info" | "material_review" | "damage_report";

type MaterialValidationResult = {
  type: string;
  passed: boolean;
  severity: string;
  message: string;
  details?: {
    ruleId?: string;
    reasonCode?: string;
    field?: string;
    failureAction?: string;
    expected?: unknown;
    actual?: unknown;
  };
};

type LedgerTimelineItem = {
  id: string;
  title: string;
  claimedAmount: number;
  payableAmount: number;
  status: "PAYABLE" | "ZERO_PAY" | "MANUAL_REVIEW";
  entries: Array<{
    step: string;
    beforeAmount: number;
    afterAmount: number;
    reason: string;
    ruleId?: string;
  }>;
};

function buildLedgerTimelineItems(reviewResult: SmartReviewResult | null): LedgerTimelineItem[] {
  if (!reviewResult?.calculation) return [];

  const lossLedger = reviewResult.calculation.lossLedger || [];
  const benefitLedger = reviewResult.calculation.benefitLedger || [];

  if (lossLedger.length > 0 || benefitLedger.length > 0) {
    return [
      ...lossLedger.map((item) => ({
        id: item.itemKey,
        title: item.coverageCode ? `${item.itemName} · ${formatCoverageCode(item.coverageCode)}` : item.itemName,
        claimedAmount: Number(item.claimedAmount || 0),
        payableAmount: Number(item.payableAmount || 0),
        status: item.status,
        entries: (item.entries || []).map((entry) => ({
          step: entry.step,
          beforeAmount: Number(entry.beforeAmount || 0),
          afterAmount: Number(entry.afterAmount || 0),
          reason: entry.message || entry.reasonCode || "账本步骤",
          ruleId: entry.ruleId,
        })),
      })),
      ...benefitLedger.map((item, index) => ({
        id: `${item.coverageCode}_${index}`,
        title: formatCoverageCode(item.coverageCode),
        claimedAmount: Number(item.claimedAmount || 0),
        payableAmount: Number(item.payableAmount || 0),
        status: item.status,
        entries: (item.entries || []).map((entry) => ({
          step: entry.step,
          beforeAmount: Number(entry.beforeAmount || 0),
          afterAmount: Number(entry.afterAmount || 0),
          reason: entry.message || entry.reasonCode || "账本步骤",
          ruleId: entry.ruleId,
        })),
      })),
    ];
  }

  return reviewResult.calculation.itemBreakdown?.map((item, index) => ({
    id: `review-ledger-${index}`,
    title: item.item,
    claimedAmount: Number(item.claimed || 0),
    payableAmount: Number(item.approved || 0),
    status:
      reviewResult.decision === "MANUAL_REVIEW"
        ? "MANUAL_REVIEW"
        : Number(item.approved || 0) > 0
          ? "PAYABLE"
          : "ZERO_PAY",
    entries: [
      {
        step: "申报",
        beforeAmount: Number(item.claimed || 0),
        afterAmount: Number(item.claimed || 0),
        reason: "案件申报金额",
      },
      {
        step: "核定",
        beforeAmount: Number(item.claimed || 0),
        afterAmount: Number(item.approved || 0),
        reason: item.reason || "规则核定结果",
      },
    ],
  })) || [];
}

function normalizeFileCategories(fileCategories: ClaimCase["fileCategories"]) {
  if (!Array.isArray(fileCategories)) return [];
  return fileCategories.map((category) => ({
    name:
      typeof category?.name === "string" && category.name.trim()
        ? category.name.trim()
        : "未分类",
    files: Array.isArray(category?.files) ? category.files.filter(Boolean) : [],
  }));
}

function getCategoryFiles(category: { files?: Array<{ name: string; url: string; ossKey?: string }> }) {
  return Array.isArray(category.files) ? category.files : [];
}

function getImportedDocumentClassification(
  classification?: {
    materialName?: string;
    materialId?: string;
    errorMessage?: string;
  } | null,
) {
  return {
    materialName: classification?.materialName || "未分类",
    materialId: classification?.materialId || "unknown",
    errorMessage: classification?.errorMessage,
  };
}

function formatDateTime(timestamp?: string | null) {
  if (!timestamp) return "待处理";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "待处理";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildParsedResultsFromMaterials(materials: ClaimMaterial[]) {
  const nextResults: Record<string, any> = {};

  for (const material of materials) {
    if (material.source !== "direct_upload") continue;
    if (!material.fileName) continue;

    const fileKey = `${material.category || material.materialName || "未分类"}-${material.fileName}`;
    nextResults[fileKey] = {
      extractedData: material.extractedData || {},
      structuredData: material.extractedData || {},
      auditConclusion: material.auditConclusion,
      confidence: material.confidence,
      materialName: material.materialName,
      materialId: material.materialId,
      parsedAt: material.processedAt,
    };
  }

  return nextResults;
}

function buildLegacyParsedResults(fileParseResults?: Record<string, any> | null) {
  const nextResults: Record<string, any> = {};
  if (!fileParseResults || typeof fileParseResults !== "object") {
    return nextResults;
  }

  Object.entries(fileParseResults).forEach(([key, value]: [string, any]) => {
    if (!value || typeof value !== "object") return;
    nextResults[key] = {
      extractedData: value.extractedData || {},
      structuredData: value.extractedData || {},
      auditConclusion: value.auditConclusion,
      confidence: value.confidence,
      materialName: value.materialName,
      materialId: value.materialId,
      parsedAt: value.parsedAt,
    };
  });

  return nextResults;
}

interface ClaimCaseDetailPageProps {
  claim: ClaimCase;
  onBack: () => void;
}

function toPersistedReviewResult(claim: ClaimCase): SmartReviewResult | null {
  const snapshot = claim.latestReviewSnapshot;
  if (!snapshot) {
    return null;
  }

  const normalizedAmount =
    typeof snapshot.payableAmount === "number"
      ? snapshot.payableAmount
      : typeof snapshot.amount === "number"
        ? snapshot.amount
        : null;

  return {
    decision: snapshot.decision || "MANUAL_REVIEW",
    amount: normalizedAmount,
    payableAmount: normalizedAmount,
    intakeDecision: snapshot.intakeDecision,
    liabilityDecision: snapshot.liabilityDecision,
    assessmentDecision: snapshot.assessmentDecision,
    settlementDecision: snapshot.settlementDecision,
    missingMaterials: snapshot.missingMaterials || [],
    coverageResults: snapshot.coverageResults || [],
    reasoning: "展示最近一次自动审核快照",
    ruleTrace: [],
    duration: 0,
  };
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

function pickFirstNonEmpty(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function formatClaimFactCurrency(value: unknown) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return `¥${numeric.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;
}

type ClaimFactCard = {
  code: string;
  title: string;
  tone: "sky" | "amber" | "emerald" | "indigo" | "slate";
  content: string;
  meta: string | null;
  sourceDocIds: string[];
  confirmKey?: "liability_apportionment" | "third_party_identity_chain";
  confirmed?: boolean;
  confirmedAt?: string | null;
  editableRatio?: number | null;
};

function getClaimDomainPresentation(domainModel: Record<string, unknown> | null) {
  const scenario = String(domainModel?.claimScenario || "unknown");
  switch (scenario) {
    case "medical_expense":
      return {
        reportActionLabel: "生成审核报告",
        reportTabLabel: "审核报告",
        reportSummaryLabels: ["核定费用", "抵扣金额", "报告结论金额"],
        reportDetailTitle: "费用明细",
        decisionTraceHint: "用于审计医疗费用审核过程，并作为审核报告生成的结构化依据。",
        validationHint: "这里汇总票据完整性、病历摘要、目录匹配等医疗案件级校验结果。",
        reviewActionLabel: "责任 / 审核",
        stageAssessmentLabel: "审核",
      };
    case "accident_benefit":
      return {
        reportActionLabel: "生成给付审核报告",
        reportTabLabel: "给付审核报告",
        reportSummaryLabels: ["核定金额", "扣减金额", "给付结论金额"],
        reportDetailTitle: "给付项目",
        decisionTraceHint: "用于审计给付责任成立、受益人关系和给付结论的形成过程。",
        validationHint: "这里汇总受益人关系、保险期间、身故事实等给付型案件校验结果。",
        reviewActionLabel: "责任 / 给付",
        stageAssessmentLabel: "给付核定",
      };
    case "auto_property_damage":
    case "auto_injury":
      return {
        reportActionLabel: "生成车险损失报告",
        reportTabLabel: "车险损失报告",
        reportSummaryLabels: ["损失总额", "责任系数", "报告结论金额"],
        reportDetailTitle: "损失项目",
        decisionTraceHint: "用于审计事故责任、损失核定和险种赔付试算过程。",
        validationHint: "这里汇总事故责任、维修/人伤资料、交强险或商业险口径等车险校验结果。",
        reviewActionLabel: "责任 / 损失",
        stageAssessmentLabel: "损失核定",
      };
    default:
      return {
        reportActionLabel: "生成定损报告",
        reportTabLabel: "定损报告",
        reportSummaryLabels: ["损失总额", "责任调整系数", "应赔金额"],
        reportDetailTitle: "损失明细",
        decisionTraceHint: "用于审计系统处理过程，并作为理算报告生成的结构化依据。",
        validationHint: "这里汇总材料归并、责任依据、赔偿标准、已付款抵扣等案件级校验结果。",
        reviewActionLabel: "定责 / 定损",
        stageAssessmentLabel: "定损",
      };
  }
}

function buildClaimFactCards(aggregationResult: Record<string, unknown> | null) {
  if (!aggregationResult) return [] as ClaimFactCard[];

  const incidentStatements = Array.isArray(aggregationResult.incidentStatements)
    ? (aggregationResult.incidentStatements as Array<Record<string, unknown>>)
    : [];
  const identityChainEvidence = Array.isArray(aggregationResult.identityChainEvidence)
    ? (aggregationResult.identityChainEvidence as Array<Record<string, unknown>>)
    : Array.isArray(aggregationResult.employmentEvidence)
      ? (aggregationResult.employmentEvidence as Array<Record<string, unknown>>)
      : [];
  const policeCallRecords = Array.isArray(aggregationResult.policeCallRecords)
    ? (aggregationResult.policeCallRecords as Array<Record<string, unknown>>)
    : [];
  const paymentEvidenceNormalized = Array.isArray(aggregationResult.paymentEvidenceNormalized)
    ? (aggregationResult.paymentEvidenceNormalized as Array<Record<string, unknown>>)
    : [];
  const liabilitySuggestion =
    aggregationResult.liabilitySuggestion &&
    typeof aggregationResult.liabilitySuggestion === "object"
      ? (aggregationResult.liabilitySuggestion as Record<string, unknown>)
      : null;
  const paymentSummary =
    aggregationResult.paymentSummary && typeof aggregationResult.paymentSummary === "object"
      ? (aggregationResult.paymentSummary as Record<string, unknown>)
      : null;
  const factConfirmations =
    aggregationResult.factConfirmations && typeof aggregationResult.factConfirmations === "object"
      ? (aggregationResult.factConfirmations as Record<string, Record<string, unknown>>)
      : {};
  const factModel =
    aggregationResult.factModel && typeof aggregationResult.factModel === "object"
      ? (aggregationResult.factModel as Record<string, unknown>)
      : undefined;
  const legacyFactAliases =
    factModel?.legacyAliases && typeof factModel.legacyAliases === "object"
      ? (factModel.legacyAliases as Record<string, unknown>)
      : undefined;
  const handlingProfile =
    aggregationResult.handlingProfile && typeof aggregationResult.handlingProfile === "object"
      ? (aggregationResult.handlingProfile as Record<string, unknown>)
      : null;
  const claimDomainModel =
    aggregationResult.domainModel && typeof aggregationResult.domainModel === "object"
      ? (aggregationResult.domainModel as Record<string, unknown>)
      : handlingProfile?.domainModel && typeof handlingProfile.domainModel === "object"
        ? (handlingProfile.domainModel as Record<string, unknown>)
        : null;
  const enabledFactCards = Array.isArray((handlingProfile?.uiModules as Record<string, unknown> | undefined)?.factCards)
    ? new Set(
        ((((handlingProfile?.uiModules as Record<string, unknown> | undefined)?.factCards as unknown[]) || []).map((item) =>
          String(item),
        )),
      )
    : null;

  const leadIncident = incidentStatements[0] || null;
  const leadIdentityChain = identityChainEvidence[0] || null;
  const leadPayment = paymentEvidenceNormalized[0] || null;
  const leadPolice = policeCallRecords[0] || null;
  const injuryProfile =
    aggregationResult.injuryProfile && typeof aggregationResult.injuryProfile === "object"
      ? (aggregationResult.injuryProfile as Record<string, unknown>)
      : null;
  const expenseAggregation =
    aggregationResult.expenseAggregation && typeof aggregationResult.expenseAggregation === "object"
      ? (aggregationResult.expenseAggregation as Record<string, unknown>)
      : null;
  const deathProfile =
    aggregationResult.deathProfile && typeof aggregationResult.deathProfile === "object"
      ? (aggregationResult.deathProfile as Record<string, unknown>)
      : null;

  return [
    {
      code: "medical_summary",
      title: "就医摘要",
      tone: "sky",
      content:
        pickFirstNonEmpty([
          injuryProfile?.injuryDescription,
          Array.isArray(injuryProfile?.diagnosisNames)
            ? (injuryProfile?.diagnosisNames as string[]).join("、")
            : null,
        ]) || "暂未形成就医摘要",
      meta: pickFirstNonEmpty([
        Number.isFinite(Number(injuryProfile?.hospitalizationDays ?? NaN))
          ? `住院 ${Number(injuryProfile?.hospitalizationDays || 0)} 天`
          : null,
        injuryProfile?.primaryDiagnosisDate
          ? `首个诊断日期 ${String(injuryProfile.primaryDiagnosisDate)}`
          : null,
      ]),
      sourceDocIds: Array.isArray(expenseAggregation?.sourceDocIds)
        ? (expenseAggregation?.sourceDocIds as string[]).filter(Boolean)
        : [],
    },
    {
      code: "expense_summary",
      title: "费用摘要",
      tone: "indigo",
      content:
        Number(expenseAggregation?.medicalTotal || 0) > 0
          ? `已识别医疗费用 ${formatClaimFactCurrency(expenseAggregation?.medicalTotal) || "¥0.00"}`
          : "暂未识别可核定的医疗费用",
      meta: pickFirstNonEmpty([
        Number(expenseAggregation?.transportationTotal || 0) > 0
          ? `交通费 ${formatClaimFactCurrency(expenseAggregation?.transportationTotal) || "¥0.00"}`
          : null,
        Number(expenseAggregation?.assessmentFees || 0) > 0
          ? `鉴定费 ${formatClaimFactCurrency(expenseAggregation?.assessmentFees) || "¥0.00"}`
          : null,
      ]),
      sourceDocIds: Array.isArray(expenseAggregation?.sourceDocIds)
        ? (expenseAggregation?.sourceDocIds as string[]).filter(Boolean)
        : [],
    },
    {
      code: "incident_summary",
      title: "事故经过",
      tone: "sky",
      content:
        pickFirstNonEmpty([
          leadIncident?.incidentSummary,
          aggregationResult.aggregationSummary,
        ]) || "暂未形成案件经过摘要",
      meta: pickFirstNonEmpty([
        leadIncident?.issuingAuthority,
        leadIncident?.issueDate ? `出具日期 ${String(leadIncident.issueDate)}` : null,
      ]),
      sourceDocIds: incidentStatements
        .map((item) => String(item.docId || ""))
        .filter(Boolean),
    },
    {
      code: "liability_clue",
      title: "责任线索",
      tone: "amber",
      content:
        pickFirstNonEmpty([
          liabilitySuggestion?.conclusion,
          leadIncident?.liabilityHint,
        ]) || "暂未形成明确责任线索",
      meta: pickFirstNonEmpty([
        liabilitySuggestion?.status ? `状态 ${String(liabilitySuggestion.status)}` : null,
      ]),
      sourceDocIds: [
        ...((Array.isArray(liabilitySuggestion?.basis)
          ? (liabilitySuggestion?.basis as Array<Record<string, unknown>>)
              .map((item) => String(item.sourceDocId || ""))
              .filter(Boolean)
          : []) as string[]),
        ...incidentStatements.map((item) => String(item.docId || "")).filter(Boolean),
      ],
      confirmKey: "liability_apportionment",
      confirmed: Boolean(
        factConfirmations.liability_apportionment?.confirmed ||
          (aggregationResult.liabilityApportionment as Record<string, unknown> | undefined)?.confirmed,
      ),
      confirmedAt: pickFirstNonEmpty([
        factConfirmations.liability_apportionment?.confirmedAt,
        (aggregationResult.liabilityApportionment as Record<string, unknown> | undefined)?.confirmedAt,
      ]),
      editableRatio: Number(
        (aggregationResult.liabilityApportionment as Record<string, unknown> | undefined)
          ?.thirdPartyLiabilityPct ?? 0,
      ),
    },
    {
      code: "third_party_identity_chain",
      title: "第三者身份与责任链",
      tone: "emerald",
      content:
        pickFirstNonEmpty([
          leadIdentityChain?.relationHint,
          leadIdentityChain?.taskSummary,
        ]) || "暂未形成明确第三者身份及责任链摘要",
      meta:
        Array.isArray(leadIdentityChain?.participants) &&
        (leadIdentityChain?.participants as unknown[]).length > 0
          ? `参与人 ${String((leadIdentityChain?.participants as string[]).join("、"))}`
          : null,
      sourceDocIds: identityChainEvidence
        .map((item) => String(item.docId || ""))
        .filter(Boolean),
      confirmKey: "third_party_identity_chain",
      confirmed: Boolean(
        factConfirmations.third_party_identity_chain?.confirmed ||
          factConfirmations.employment_relation?.confirmed ||
          factModel?.thirdPartyIdentityChainConfirmed ||
          legacyFactAliases?.employmentRelationConfirmed,
      ),
      confirmedAt: pickFirstNonEmpty([
        factConfirmations.third_party_identity_chain?.confirmedAt,
        factConfirmations.employment_relation?.confirmedAt,
        factModel?.thirdPartyIdentityChainConfirmedAt,
        legacyFactAliases?.employmentRelationConfirmedAt,
      ]),
    },
    {
      code: "claimant_relationship",
      title: "索赔关系",
      tone: "emerald",
      content:
        Array.isArray(deathProfile?.claimants) && (deathProfile?.claimants as Array<Record<string, unknown>>).length > 0
          ? (deathProfile?.claimants as Array<Record<string, unknown>>)
              .map((item) => `${String(item.name || "关系人")}(${String(item.relationship || item.beneficiaryType || "待确认")})`)
              .join("、")
          : "暂未形成索赔关系摘要",
      meta: deathProfile?.deceasedName ? `关联死者 ${String(deathProfile.deceasedName)}` : null,
      sourceDocIds: Array.isArray(deathProfile?.sourceDocIds)
        ? (deathProfile?.sourceDocIds as string[]).filter(Boolean)
        : [],
    },
    {
      code: "beneficiary_summary",
      title: "受益人摘要",
      tone: "amber",
      content:
        Array.isArray(deathProfile?.claimants) && (deathProfile?.claimants as Array<Record<string, unknown>>).length > 0
          ? (deathProfile?.claimants as Array<Record<string, unknown>>)
              .map((item) => String(item.beneficiaryType || item.relationship || "待确认"))
              .join("、")
          : "暂未形成受益人口径摘要",
      meta: deathProfile?.deathDate ? `死亡日期 ${String(deathProfile.deathDate)}` : null,
      sourceDocIds: Array.isArray(deathProfile?.sourceDocIds)
        ? (deathProfile?.sourceDocIds as string[]).filter(Boolean)
        : [],
    },
    {
      code: "payment_summary",
      title: "已付款",
      tone: "indigo",
      content:
        pickFirstNonEmpty([
          paymentSummary
            ? `已识别付款 ${formatClaimFactCurrency(paymentSummary.confirmedPaidAmount) || "¥0.00"}，当前抵扣 ${formatClaimFactCurrency(
                (aggregationResult.deductionSummary as Record<string, unknown> | undefined)?.deductionTotal,
              ) || "¥0.00"}`
            : null,
          leadPayment
            ? `${formatClaimFactCurrency(leadPayment.amount) || ""} ${String(leadPayment.description || "").trim()}`
            : null,
        ]) || "暂未识别赔偿支付记录",
      meta: pickFirstNonEmpty([
        leadPayment?.payee ? `收款人 ${String(leadPayment.payee)}` : null,
        leadPayment?.paidAt ? `付款日期 ${String(leadPayment.paidAt)}` : null,
      ]),
      sourceDocIds: paymentEvidenceNormalized
        .map((item) => String(item.sourceDocId || ""))
        .filter(Boolean),
    },
    {
      code: "police_record",
      title: "报警/接警",
      tone: "slate",
      content:
        pickFirstNonEmpty([
          leadPolice?.incidentSummary,
          "暂未识别报警或接警事实",
        ]) || "暂未识别报警或接警事实",
      meta: pickFirstNonEmpty([
        leadPolice?.handlingUnit ? `处理单位 ${String(leadPolice.handlingUnit)}` : null,
        leadPolice?.callTime ? `报警时间 ${String(leadPolice.callTime)}` : null,
      ]),
      sourceDocIds: policeCallRecords
        .map((item) => String(item.docId || ""))
        .filter(Boolean),
    },
  ].filter((card) => !enabledFactCards || enabledFactCards.has(card.code)) as ClaimFactCard[];
}

function getDecisionTraceStages(aggregationResult: Record<string, unknown> | null) {
  const trace =
    aggregationResult?.decisionTrace && typeof aggregationResult.decisionTrace === "object"
      ? (aggregationResult.decisionTrace as Record<string, unknown>)
      : null;
  return Array.isArray(trace?.stages)
    ? (trace?.stages as Array<Record<string, unknown>>)
    : [];
}

const ClaimCaseDetailPage: React.FC<ClaimCaseDetailPageProps> = ({
  claim,
  onBack,
}) => {
  const [openFiles, setOpenFiles] = useState<Record<string, boolean>>({
    医疗费用: true,
  });
  const [localFileCategories, setLocalFileCategories] = useState<
    { name: string; files: { name: string; url: string; ossKey?: string }[] }[]
  >(() => normalizeFileCategories(claim.fileCategories));
  const [fileCategoriesLoading, setFileCategoriesLoading] = useState(false);
  
  // 文件解析相关状态
  const [parsingFiles, setParsingFiles] = useState<Set<string>>(new Set());
  const [parsedResults, setParsedResults] = useState<Record<string, any>>({});
  const [materialList, setMaterialList] = useState<ClaimsMaterial[]>([]);
  
  // 当 claim.fileCategories 变化时，更新 localFileCategories
  useEffect(() => {
    const normalizedCategories = normalizeFileCategories(claim.fileCategories);
    setLocalFileCategories(normalizedCategories);
    console.log(
      "[FileCategories] Updated from claim:",
      normalizedCategories.length,
      "categories",
    );
  }, [claim.fileCategories]);
  
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<SmartReviewResult | null>(
    () => toPersistedReviewResult(claim),
  );
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [operationLogs, setOperationLogs] = useState<UserOperationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [processTimeline, setProcessTimeline] =
    useState<ClaimProcessTimeline | null>(null);
  const [manualStageNote, setManualStageNote] = useState("");
  const [manualStageSubmitting, setManualStageSubmitting] = useState<
    "liability" | "assessment" | null
  >(null);
  const [stageDecisionModalMode, setStageDecisionModalMode] = useState<
    "liability" | "assessment" | null
  >(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [suggestedImportMaterials, setSuggestedImportMaterials] = useState<string[]>([]);
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
        errorMessage?: string;
      };
      status: string;
      importedAt: string;
    }>
  >([]);
  const [importedCompleteness, setImportedCompleteness] =
    useState<CompletenessResult | null>(null);
  const [latestImportMeta, setLatestImportMeta] = useState<{
    id: string;
    taskId: string | null;
    importedAt: string | null;
    taskStatus: string | null;
    postProcessedAt: string | null;
    failureCategory?: string | null;
    failureHint?: string | null;
  } | null>(null);
  const [recoveringImportTask, setRecoveringImportTask] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{
    fileName: string;
    fileType?: string;
    ossUrl?: string;
    ossKey?: string;
    classification: { materialName: string };
    structuredData?: Record<string, unknown>;
    auditConclusion?: string;
    confidence?: number;
  } | null>(null);

  useEffect(() => {
    if (!previewDoc?.ossKey) return;
    let cancelled = false;

    void (async () => {
      try {
        const previewUrl = await getPreviewUrl(
          previewDoc.ossKey,
          previewDoc.fileType,
          3600,
        );
        if (cancelled) return;
        setPreviewDoc((current) => {
          if (!current || current.ossKey !== previewDoc.ossKey) return current;
          return {
            ...current,
            ossUrl: previewUrl,
          };
        });
      } catch (error) {
        console.error("[PreviewModal] Failed to refresh preview URL:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewDoc?.ossKey]);

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
  const [selectedReviewDocumentId, setSelectedReviewDocumentId] = useState<
    string | null
  >(null);
  const [aggregationResult, setAggregationResult] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [validationFacts, setValidationFacts] = useState<Record<string, unknown>>(
    {},
  );
  const [materialValidationResults, setMaterialValidationResults] = useState<
    MaterialValidationResult[]
  >([]);
  const [validationChecklist, setValidationChecklist] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [damageReport, setDamageReport] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [updatingDeduction, setUpdatingDeduction] = useState(false);
  const [updatingFactKey, setUpdatingFactKey] = useState<string | null>(null);
  const [liabilityPctDraft, setLiabilityPctDraft] = useState("50");
  const [deductionAmountDraft, setDeductionAmountDraft] = useState("0");
  /** 当前在右栏展示的文件 */
  const [selectedViewerDoc, setSelectedViewerDoc] = useState<{
    fileUrl: string;
    fileType: "pdf" | "image" | "word" | "excel" | "video" | "other";
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
        setAggregationResult(data.aggregation || null);
        setValidationFacts(data.validationFacts || {});
        setMaterialValidationResults(data.materialValidationResults || []);
        setValidationChecklist(data.validationChecklist || null);
        setDamageReport(data.damageReport || null);
        if (data.reviewResult) {
          setReviewResult(data.reviewResult as SmartReviewResult);
        }
        setLatestImportMeta(data.latestImport || null);
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
      } else {
        setAggregationResult(null);
        setValidationFacts({});
        setMaterialValidationResults([]);
        setValidationChecklist(null);
        setDamageReport(null);
        setLatestImportMeta(null);
      }
    } catch (error) {
      console.error("Failed to fetch imported documents:", error);
      setAggregationResult(null);
      setValidationFacts({});
      setMaterialValidationResults([]);
      setValidationChecklist(null);
      setDamageReport(null);
      setLatestImportMeta(null);
    }
  };

  const handleRecoverImportTask = async () => {
    if (!latestImportMeta?.taskId || recoveringImportTask) return;

    setRecoveringImportTask(true);
    try {
      const response = await fetch("/api/offline-import/recover-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: latestImportMeta.taskId }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || "恢复任务失败");
      }

      await fetchImportedDocuments();
      await loadReviewData();
      const latestTimeline = await fetchProcessTimeline();
      await syncClaimMilestonesFromTimeline(latestTimeline);
    } catch (error) {
      console.error("Recover import task failed:", error);
      alert(error instanceof Error ? error.message : "恢复任务失败");
    } finally {
      setRecoveringImportTask(false);
    }
  };

  const fetchFileCategories = async () => {
    setFileCategoriesLoading(true);
    try {
      const resp = await fetch(`/api/claim-cases/${claim.id}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.fileCategories) {
          const normalizedCategories = normalizeFileCategories(data.fileCategories);
          setLocalFileCategories(normalizedCategories);
          console.log("[FileCategories] Loaded:", normalizedCategories.length, "categories");
        }
        if (data?.fileParseResults) {
          console.log("[FileCategories] Found legacy fileParseResults:", Object.keys(data.fileParseResults));
        }
      }
    } catch (err) {
      console.error("Failed to fetch file categories:", err);
    } finally {
      setFileCategoriesLoading(false);
    }
  };

  const fetchProcessTimeline = async () => {
    setTimelineLoading(true);
    try {
      const data = await api.getClaimProcessTimeline(claim.id);
      const nextTimeline = data.processTimeline || null;
      setProcessTimeline(nextTimeline);
      return nextTimeline;
    } catch (error) {
      console.error("Failed to fetch claim process timeline:", error);
      setProcessTimeline(null);
      return null;
    } finally {
      setTimelineLoading(false);
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
        const normalizedCategories = normalizeFileCategories(freshClaim.fileCategories);
        setLocalFileCategories(normalizedCategories);
        console.log(
          "[Claim] Updated localFileCategories:",
          normalizedCategories.length,
          "categories",
        );
      }
      
      if (freshClaim?.fileParseResults) {
        console.log(
          "[Claim] Legacy fileParseResults still present:",
          Object.keys(freshClaim.fileParseResults),
        );
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

  const syncClaimMilestonesFromTimeline = async (
    timeline: ClaimProcessTimeline | null,
    latestReviewResult?: SmartReviewResult | null,
  ) => {
    if (!timeline?.stages?.length) {
      return;
    }

    try {
      const currentClaim = await api.claimCases.getById(claim.id);
      const patch: Partial<ClaimCase> = {};
      const stageMap = new Map(timeline.stages.map((stage) => [stage.key, stage]));
      const getCompletedBy = (
        status?: string,
      ): "system" | "manual" | undefined => {
        if (status === "manual_completed") {
          return "manual";
        }
        if (status === "completed") {
          return "system";
        }
        return undefined;
      };

      const intakeStage = stageMap.get("intake");
      if (
        intakeStage?.completedAt &&
        (!currentClaim.acceptedAt || !currentClaim.acceptedBy)
      ) {
        patch.acceptedAt = currentClaim.acceptedAt || intakeStage.completedAt;
        patch.acceptedBy =
          currentClaim.acceptedBy ||
          getCompletedBy(intakeStage.status) ||
          "system";
      }

      const parseStage = stageMap.get("parse");
      if (
        parseStage?.completedAt &&
        (!currentClaim.parsedAt || !currentClaim.parsedBy)
      ) {
        patch.parsedAt = currentClaim.parsedAt || parseStage.completedAt;
        patch.parsedBy =
          currentClaim.parsedBy ||
          getCompletedBy(parseStage.status) ||
          "system";
      }

      const liabilityStage = stageMap.get("liability");
      if (
        liabilityStage?.completedAt &&
        (!currentClaim.liabilityCompletedAt ||
          !currentClaim.liabilityCompletedBy ||
          !currentClaim.liabilityDecision)
      ) {
        patch.liabilityCompletedAt =
          currentClaim.liabilityCompletedAt || liabilityStage.completedAt;
        patch.liabilityCompletedBy =
          currentClaim.liabilityCompletedBy ||
          getCompletedBy(liabilityStage.status) ||
          "system";
        if (!currentClaim.liabilityDecision && latestReviewResult?.liabilityDecision) {
          patch.liabilityDecision = latestReviewResult.liabilityDecision;
        }
      }

      const assessmentStage = stageMap.get("assessment");
      if (
        assessmentStage?.completedAt &&
        (!currentClaim.assessmentCompletedAt ||
          !currentClaim.assessmentCompletedBy ||
          !currentClaim.assessmentDecision ||
          (currentClaim.approvedAmount == null &&
            latestReviewResult?.amount != null))
      ) {
        patch.assessmentCompletedAt =
          currentClaim.assessmentCompletedAt || assessmentStage.completedAt;
        patch.assessmentCompletedBy =
          currentClaim.assessmentCompletedBy ||
          getCompletedBy(assessmentStage.status) ||
          "system";
        if (!currentClaim.assessmentDecision && latestReviewResult?.assessmentDecision) {
          patch.assessmentDecision = latestReviewResult.assessmentDecision;
        }
        if (
          currentClaim.approvedAmount == null &&
          latestReviewResult?.amount != null
        ) {
          patch.approvedAmount = Number(latestReviewResult.amount);
        }
      }

      if (Object.keys(patch).length > 0) {
        await api.claimCases.update(claim.id, patch);
      }
    } catch (error) {
      console.error("Failed to sync claim milestones:", error);
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
        
        const savedResults = buildLegacyParsedResults(currentClaim.fileParseResults);
        setParsedResults(prev => {
          const merged = { ...savedResults, ...prev };
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
    setReviewResult(toPersistedReviewResult(claim));
  }, [claim.id, claim.latestReviewSnapshot]);

  useEffect(() => {
    const init = async () => {
      console.log("[ClaimDetail] Initializing with claim.id:", claim.id);
      console.log("[ClaimDetail] Starting data fetch sequence");
      fetchImportedDocuments();
      await loadReviewData();
      const initialTimeline = await fetchProcessTimeline();
      await syncClaimMilestonesFromTimeline(initialTimeline);
      // 先刷新 claim 数据，兼容旧的 fileParseResults 存量数据
      await refreshClaimData();
      // 然后再加载已保存的解析结果（仅作为后备）
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
      const payload = {
        claimCaseId: claim.id,
        productCode: claim.productCode || "PROD001",
        ocrData: claim.ocrData || {},
        invoiceItems: claim.calculationItems || [],
      };
      const [smartReviewResponse, fullReviewResponse] = await Promise.all([
        fetch("/api/ai/smart-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        fetch("/api/claim/full-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      ]);
      const smartReviewResult = await smartReviewResponse.json();
      const fullReviewResult = fullReviewResponse.ok
        ? await fullReviewResponse.json()
        : {};
      const result = mergeSmartReviewResults(
        smartReviewResult,
        fullReviewResult,
      );
      setReviewResult(result);
      // 记录 AI 审核操作
      await logOperation({
        operationType: UserOperationType.ANALYZE_DOCUMENT,
        operationLabel: `AI智能审核 - ${result.decision === "APPROVE" ? "通过" : result.decision === "REJECT" ? "拒赔" : "需人工复核"}`,
        outputData: {
          decision: result.decision,
          amount: result.amount,
          reasoning: result.reasoning?.slice(0, 500), // 限制长度
          intakeDecision: result.intakeDecision,
          liabilityDecision: result.liabilityDecision,
          assessmentDecision: result.assessmentDecision,
          settlementDecision: result.settlementDecision,
          manualReviewReasons: result.manualReviewReasons || [],
          missingMaterials: result.missingMaterials || [],
          coverageResults: result.coverageResults || [],
        },
        success: true,
        duration: Date.now() - startTime,
      });
      const latestTimeline = await fetchProcessTimeline();
      await syncClaimMilestonesFromTimeline(latestTimeline, result);
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
      const latestTimeline = await fetchProcessTimeline();
      await syncClaimMilestonesFromTimeline(latestTimeline);
    } finally {
      setReviewing(false);
    }
  };

  const handleImportComplete = (result: {
    documents: ProcessedFile[];
    completeness: CompletenessResult;
    validationFacts?: Record<string, unknown>;
    materialValidationResults?: MaterialValidationResult[];
  }) => {
    const nowIso = new Date().toISOString();
    setImportedDocuments((result.documents || []).map((d) => ({
      documentId: d.documentId,
      fileName: d.fileName,
      fileType: d.fileType,
      ossUrl: d.ossUrl,
      classification: d.classification || {
        materialId: "unknown",
        materialName: "未识别",
        confidence: 0,
      },
      status: d.status,
      importedAt: nowIso,
    })));
    setImportedCompleteness(result.completeness || null);
    setValidationFacts(result.validationFacts || {});
    setMaterialValidationResults(result.materialValidationResults || []);
    setShowImportDialog(false);

    // Refresh the imported documents list from backend
    fetchImportedDocuments();
    loadReviewData();
    setTimeout(() => {
      void (async () => {
        fetchImportedDocuments();
        loadReviewData();
        const latestTimeline = await fetchProcessTimeline();
        await syncClaimMilestonesFromTimeline(latestTimeline);
        await handleSmartReview();
      })();
    }, 1500);
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

  const groupedManualReviewReasons = reviewResult
    ? groupManualReviewReasons(
        (reviewResult.manualReviewReasons || []).filter(
          (reason) => reason.code !== "MISSING_REQUIRED_MATERIALS",
        ),
      )
    : [];
  const coverageResults = reviewResult ? getCoverageResults(reviewResult) : [];
  const explanationCards = reviewResult ? getReviewExplanationCards(reviewResult) : [];
  const reviewSummary = reviewResult ? getReviewSummary(reviewResult) : null;
  const reviewOutcome = reviewResult ? getReviewOutcome(reviewResult) : null;
  const stageViews = getStageViews(processTimeline, reviewResult);
  const ruleAuditLedger = buildLedgerTimelineItems(reviewResult);
  const timelineEventGroups = groupTimelineEvents(processTimeline);
  const liabilityStage = processTimeline?.stages.find(
    (stage) => stage.key === "liability",
  );
  const assessmentStage = processTimeline?.stages.find(
    (stage) => stage.key === "assessment",
  );
  const settlementStageView = stageViews.find((stage) => stage.key === "settlement");
  const canShowAssessmentAmount =
    settlementStageView == null ||
    settlementStageView.status === "completed" ||
    settlementStageView.status === "manual_completed";
  const canManualCompleteLiability = liabilityStage?.status === "processing";
  const canManualCompleteAssessment =
    assessmentStage?.status === "processing" &&
    (liabilityStage?.status === "completed" ||
      liabilityStage?.status === "manual_completed");

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
            errorMessage: m.classificationError,
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
      setParsedResults((prev) => ({
        ...prev,
        ...buildParsedResultsFromMaterials((data.materials || []) as ClaimMaterial[]),
      }));
    } catch {
      // 静默失败
    }
  };

  // 生成案件审核/定损报告
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
          operationLabel: reportActionLabel,
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

  const handleTogglePaymentDeduction = async (
    applyDeduction: boolean,
    customAmount?: number | null,
  ) => {
    const startTime = Date.now();
    const beforeDeduction = Number(
      ((aggregationResult as Record<string, unknown> | null)?.deductionSummary as Record<string, unknown> | undefined)
        ?.deductionTotal || 0,
    );
    setUpdatingDeduction(true);
    try {
      const resp = await fetch("/api/claim-payment-deduction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimCaseId: claim.id,
          applyDeduction,
          deductionAmount: customAmount,
        }),
      });
      if (!resp.ok) {
        const error = await resp.json().catch(() => ({}));
        throw new Error(error.error || "更新抵扣状态失败");
      }

      const data = await resp.json();
      setAggregationResult(data.aggregation || null);
      setDamageReport(data.report || null);
      await fetchImportedDocuments();
      setActiveTab("damage_report");
      await logOperation({
        operationType: UserOperationType.CLAIM_ACTION,
        operationLabel: "更新抵扣金额",
        inputData: {
          applyDeduction,
          deductionAmount: customAmount ?? null,
          beforeDeduction,
        },
        outputData: {
          afterDeduction: Number(
            (data.aggregation?.deductionSummary as Record<string, unknown> | undefined)?.deductionTotal || 0,
          ),
          finalAmount: data.report?.finalAmount,
        },
        success: true,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      console.error("[payment deduction] Failed:", error);
      alert((error as Error).message || "更新抵扣状态失败");
      await logOperation({
        operationType: UserOperationType.CLAIM_ACTION,
        operationLabel: "更新抵扣金额失败",
        inputData: {
          applyDeduction,
          deductionAmount: customAmount ?? null,
          beforeDeduction,
        },
        outputData: {
          error: error instanceof Error ? error.message : "更新抵扣状态失败",
        },
        success: false,
        duration: Date.now() - startTime,
      });
    } finally {
      setUpdatingDeduction(false);
    }
  };

  const handleUpdateDeductionAmount = async () => {
    const amount = Number(deductionAmountDraft);
    if (!Number.isFinite(amount) || amount < 0) {
      alert("抵扣金额必须是大于等于 0 的数字");
      return;
    }
    await handleTogglePaymentDeduction(amount > 0, amount);
  };

  const openViewerForDocument = async (
    doc: { ossUrl?: string; ossKey?: string; fileType: string; fileName: string },
    anchor?: SourceAnchor,
  ) => {
    if (!doc.ossUrl && !doc.ossKey) return;
    
    // 获取文件预览 URL（优先使用 ossKey 获取实时签名 URL）
    let fileUrl = doc.ossUrl;
    if (doc.ossKey) {
      try {
        fileUrl = await getPreviewUrl(doc.ossKey, doc.fileType, 3600);
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
      : doc.fileType?.startsWith("video/")
        ? "video"
      : doc.fileType?.includes("pdf")
        ? "pdf"
        : doc.fileType?.includes("word")
          ? "word"
          : doc.fileType?.includes("excel")
            ? "excel"
            : "other";
    setSelectedViewerDoc({
      fileUrl,
      fileType: fileCategory as "pdf" | "image" | "word" | "excel" | "video" | "other",
      fileName: doc.fileName,
    });
    setActiveAnchor(anchor);
    if (anchor) {
      setTimeout(() => viewerRef.current?.jumpTo(anchor), 100);
    }
  };

  // 跳转到文件并高亮锚点
  const handleJumpTo = async (
    doc: { ossUrl?: string; ossKey?: string; fileType: string; fileName: string },
    anchor: SourceAnchor,
  ) => {
    await openViewerForDocument(doc, anchor);
  };

  const approveField = (docId: string, fieldName: string) => {
    setApprovedFields((prev) => new Set([...prev, `${docId}.${fieldName}`]));
  };

  useEffect(() => {
    const ratio = Number(
      (aggregationResult as Record<string, unknown> | null)?.liabilityApportionment &&
        ((aggregationResult as Record<string, unknown>).liabilityApportionment as Record<string, unknown>)
          ?.thirdPartyLiabilityPct,
    );
    if (Number.isFinite(ratio)) {
      setLiabilityPctDraft(String(ratio));
    }
  }, [aggregationResult]);

  useEffect(() => {
    const deduction = Number(
      (aggregationResult as Record<string, unknown> | null)?.deductionSummary &&
        ((aggregationResult as Record<string, unknown>).deductionSummary as Record<string, unknown>)
          ?.deductionTotal,
    );
    const recommended = Number(
      (aggregationResult as Record<string, unknown> | null)?.paymentSummary &&
        ((aggregationResult as Record<string, unknown>).paymentSummary as Record<string, unknown>)
          ?.deductionRecommendedAmount,
    );
    if (Number.isFinite(deduction) && deduction > 0) {
      setDeductionAmountDraft(String(deduction));
    } else if (Number.isFinite(recommended)) {
      setDeductionAmountDraft(String(recommended));
    }
  }, [aggregationResult]);

  const handleConfirmFact = async (
    factKey: "liability_apportionment" | "third_party_identity_chain",
    confirmed: boolean,
  ) => {
    const startTime = Date.now();
    try {
      setUpdatingFactKey(factKey);
      const resp = await fetch("/api/claim-fact-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimCaseId: claim.id,
          factKey,
          confirmed,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || "更新事实确认失败");
      }
      setAggregationResult((data.aggregation as Record<string, unknown>) || null);
      setDamageReport((data.report as Record<string, unknown>) || null);
      await logOperation({
        operationType: UserOperationType.CLAIM_ACTION,
        operationLabel: `人工确认案件事实 - ${factKey}`,
        inputData: { factKey, confirmed },
        outputData: {
          factConfirmations: data.aggregation?.factConfirmations || null,
          finalAmount: data.report?.finalAmount,
        },
        success: true,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      console.error("[FactConfirmation] Failed to update:", error);
      alert(error instanceof Error ? error.message : "更新事实确认失败");
      await logOperation({
        operationType: UserOperationType.CLAIM_ACTION,
        operationLabel: `人工确认案件事实失败 - ${factKey}`,
        inputData: { factKey, confirmed },
        outputData: {
          error: error instanceof Error ? error.message : "更新事实确认失败",
        },
        success: false,
        duration: Date.now() - startTime,
      });
    } finally {
      setUpdatingFactKey(null);
    }
  };

  const handleUpdateLiabilityApportionment = async () => {
    const startTime = Date.now();
    const beforeRatio = Number(
      ((aggregationResult as Record<string, unknown> | null)?.liabilityApportionment as Record<string, unknown> | undefined)
        ?.thirdPartyLiabilityPct || 0,
    );
    try {
      setUpdatingFactKey("liability_apportionment_ratio");
      const ratio = Number(liabilityPctDraft);
      if (!Number.isFinite(ratio) || ratio < 0 || ratio > 100) {
        throw new Error("责任比例必须是 0 到 100 之间的数字");
      }
      const resp = await fetch("/api/claim-liability-apportionment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimCaseId: claim.id,
          thirdPartyLiabilityPct: ratio,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || "更新责任比例失败");
      }
      setAggregationResult((data.aggregation as Record<string, unknown>) || null);
      setDamageReport((data.report as Record<string, unknown>) || null);
      await logOperation({
        operationType: UserOperationType.CLAIM_ACTION,
        operationLabel: "更新责任比例",
        inputData: {
          beforeRatio,
          afterRatio: ratio,
        },
        outputData: {
          liabilityApportionment: data.aggregation?.liabilityApportionment || null,
          finalAmount: data.report?.finalAmount,
        },
        success: true,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      console.error("[LiabilityApportionment] Failed to update:", error);
      alert(error instanceof Error ? error.message : "更新责任比例失败");
      await logOperation({
        operationType: UserOperationType.CLAIM_ACTION,
        operationLabel: "更新责任比例失败",
        inputData: {
          beforeRatio,
          attemptedRatio: liabilityPctDraft,
        },
        outputData: {
          error: error instanceof Error ? error.message : "更新责任比例失败",
        },
        success: false,
        duration: Date.now() - startTime,
      });
    } finally {
      setUpdatingFactKey(null);
    }
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

  useEffect(() => {
    if (reviewDocuments.length === 0) {
      setSelectedReviewDocumentId(null);
      return;
    }

    const fallbackDocument =
      reviewDocuments.find((doc) => doc.documentId === selectedReviewDocumentId) ||
      reviewDocuments[0];

    if (!fallbackDocument) return;

    if (fallbackDocument.documentId !== selectedReviewDocumentId) {
      setSelectedReviewDocumentId(fallbackDocument.documentId);
    }

    if (selectedViewerDoc?.fileName === fallbackDocument.fileName) return;

    void openViewerForDocument(
      {
        ossUrl: fallbackDocument.ossUrl,
        ossKey: fallbackDocument.ossKey,
        fileType: fallbackDocument.fileType || "",
        fileName: fallbackDocument.fileName,
      },
      {
        pageIndex: 0,
        highlightLevel: "page_only",
      },
    );
  }, [reviewDocuments, selectedReviewDocumentId, selectedViewerDoc?.fileName]);

  const failedMaterialValidations = materialValidationResults.filter(
    (item) => !item.passed,
  );
  const passedMaterialValidations = materialValidationResults.filter(
    (item) => item.passed,
  );
  const claimDomainModel =
    aggregationResult?.domainModel && typeof aggregationResult.domainModel === "object"
      ? (aggregationResult.domainModel as Record<string, unknown>)
      : aggregationResult?.handlingProfile &&
          typeof aggregationResult.handlingProfile === "object" &&
          (aggregationResult.handlingProfile as Record<string, unknown>).domainModel &&
          typeof (aggregationResult.handlingProfile as Record<string, unknown>).domainModel === "object"
        ? ((aggregationResult.handlingProfile as Record<string, unknown>).domainModel as Record<string, unknown>)
        : null;
  const claimFactCards = buildClaimFactCards(aggregationResult);
  const decisionTraceStages = getDecisionTraceStages(aggregationResult);
  const isMedicalScenario = Boolean(claimDomainModel?.isMedicalScenario);
  const domainPresentation = getClaimDomainPresentation(claimDomainModel);
  const requiresDeductionAssessment = Boolean(
    claimDomainModel?.requiresDeductionAssessment,
  );
  const reportActionLabel = domainPresentation.reportActionLabel;
  const reportTabLabel = domainPresentation.reportTabLabel;
  const recognizedReviewDocuments = reviewDocuments.filter(
    (doc) => doc.classification?.materialId && doc.classification.materialId !== "unknown",
  );
  const unknownReviewDocuments = reviewDocuments.filter(
    (doc) => !doc.classification?.materialId || doc.classification.materialId === "unknown",
  );

  const toggleFileCategory = (name: string) => {
    setOpenFiles((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const openImportDialogWithSuggestions = (materials: string[] = []) => {
    setSuggestedImportMaterials(materials.filter(Boolean));
    setActiveTab("material_review");
    setShowImportDialog(true);
  };

  const openRulesetManagementForCurrentProduct = (coverageCode?: string) => {
    const productCode = claim.productCode || "";
    if (productCode) {
      window.sessionStorage.setItem("ruleset_management_search", productCode);
      window.sessionStorage.setItem(
        "ruleset_management_focus",
        JSON.stringify({
          productCode,
          coverageCode,
        }),
      );
    }
    window.dispatchEvent(
      new CustomEvent("app:navigate", {
        detail: { view: "ruleset_management" },
      }),
    );
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
      
      console.log("[Parse] Calling unified parse pipeline for:", file.name, "type:", isImage ? "image" : isPdf ? "pdf" : "unknown");

      const materialsResp = await fetch(`/api/claim-materials?claimCaseId=${claim.id}`);
      const materialsData = materialsResp.ok ? await materialsResp.json() : { materials: [] };
      let existingMaterial = materialsData.materials?.find(
        (m: ClaimMaterial) => m.fileName === file.name && m.source === 'direct_upload'
      );

      if (!existingMaterial) {
        const createResp = await fetch('/api/claim-materials', {
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
            source: 'direct_upload',
            status: 'pending',
            uploadedAt: new Date().toISOString(),
          }),
        });

        if (!createResp.ok) {
          const error = await createResp.json().catch(() => ({}));
          throw new Error(error.error || "创建材料记录失败");
        }

        const createData = await createResp.json();
        existingMaterial = createData.material;
      }

      const response = await fetch(`/api/claim-materials/${existingMaterial.id}/parse`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: materialConfig.id,
          materialName: materialConfig.name,
          category: categoryName,
          fileUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || "解析失败");
      }

      const responseData = await response.json();
      const result = responseData.parseResult || {};
      
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
      
      console.log("[Parse] Unified pipeline result saved to material:", existingMaterial.id);
      await loadReviewData();
      
      // 记录操作日志
      await logOperation({
        operationType: UserOperationType.ANALYZE_DOCUMENT,
        operationLabel: `解析文件 - ${file.name} (${materialConfig.name})`,
        inputData: { fileName: file.name, category: categoryName, materialId: materialConfig.id },
        outputData: { success: true, hasExtractedData: !!result.extractedData },
        success: true,
      });
      const latestTimeline = await fetchProcessTimeline();
      await syncClaimMilestonesFromTimeline(latestTimeline);
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

  const handleManualStageComplete = async (
    stageKey: "liability" | "assessment",
  ) => {
    const stageLabel =
      stageKey === "liability" ? "定责" : domainPresentation.stageAssessmentLabel;
    setManualStageSubmitting(stageKey);
    try {
      const currentUser = getCurrentUser();
      const completedAt = new Date().toISOString();
      await api.claimCases.update(claim.id, {
        ...(stageKey === "liability"
          ? {
              liabilityCompletedAt: completedAt,
              liabilityCompletedBy: "manual",
              liabilityDecision: reviewResult?.liabilityDecision || "MANUAL_REVIEW",
            }
          : {
              assessmentCompletedAt: completedAt,
              assessmentCompletedBy: "manual",
              assessmentDecision:
                reviewResult?.assessmentDecision || "ASSESSED",
              approvedAmount:
                reviewResult?.amount != null ? Number(reviewResult.amount) : undefined,
            }),
      });
      await logOperation({
        operationType: UserOperationType.CLAIM_ACTION,
        operationLabel: `人工完成${stageLabel}`,
        inputData: {
          stageKey,
        },
        outputData: {
          actionType:
            stageKey === "liability"
              ? "MANUAL_LIABILITY_COMPLETED"
              : "MANUAL_ASSESSMENT_COMPLETED",
          manualReviewNotes: manualStageNote,
          completedAt,
          reviewerName: currentUser.userName || "人工处理",
          liabilityDecision:
            stageKey === "liability" ? reviewResult?.liabilityDecision || null : null,
          assessmentDecision:
            stageKey === "assessment"
              ? reviewResult?.assessmentDecision || null
              : null,
        },
        success: true,
      });
      setManualStageNote("");
      await fetchOperationLogs();
      await fetchProcessTimeline();
    } catch (error) {
      console.error(`Failed to save manual ${stageKey}:`, error);
      alert(`人工${stageLabel}记录失败`);
    } finally {
      setManualStageSubmitting(null);
    }
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
          <button
            onClick={() => setStageDecisionModalMode("liability")}
            className="flex items-center px-4 py-2 bg-[#4f46e5] text-white rounded-md text-sm font-medium hover:bg-[#4338ca] shadow-sm"
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            {domainPresentation.reviewActionLabel}
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
              material_review: "材料管理",
              damage_report: reportTabLabel,
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

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">阶段进度</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    受理 → 解析/OCR → 责任判定 → 事实核定 → 赔付计算 → 案件结论
                  </p>
                </div>
                {timelineLoading && (
                  <div className="flex items-center text-sm text-gray-500">
                    <div className="w-4 h-4 mr-2 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    更新中
                  </div>
                )}
              </div>

              {stageViews.length > 0 ? (
                <>
                  <div className="hidden lg:flex items-center mb-6 px-6">
                    {stageViews.map((stage, index) => (
                      <React.Fragment key={stage.key}>
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-5 h-5 rounded-full border-4 ${stage.dotClass}`}
                          ></div>
                          <div className="mt-2 text-xs font-medium text-gray-600">
                            {stage.label}
                          </div>
                        </div>
                        {index < stageViews.length - 1 && (
                          <div className="flex-1 h-1 mx-3 rounded-full bg-gray-200 overflow-hidden">
                            <div className={`h-full ${stage.lineClass}`}></div>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {stageViews.map((stage) => {
                      const isDecisionStage =
                        stage.key === "liability" ||
                        stage.key === "fact_assessment";
                      const displayLabel = stage.label;
                      return (
                      <div
                        key={stage.key}
                        className={`rounded-xl border p-4 ${stage.toneClass} ${
                          isDecisionStage
                            ? "cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-sm"
                            : ""
                        }`}
                        onClick={() => {
                          if (stage.key === "liability") {
                            setStageDecisionModalMode("liability");
                          }
                          if (stage.key === "fact_assessment") {
                            setStageDecisionModalMode("assessment");
                          }
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold opacity-80">
                              {displayLabel}
                            </p>
                            <p className="text-base font-bold mt-1">
                              {stage.status === "completed" && "已完成"}
                              {stage.status === "manual_completed" && "人工完成"}
                              {stage.status === "processing" && "处理中"}
                              {stage.status === "failed" && "失败"}
                              {stage.status === "pending" && "待上一阶段"}
                            </p>
                          </div>
                          <span className="text-[11px] px-2 py-1 rounded-full bg-white/70">
                            {stage.methodLabel}
                          </span>
                        </div>
                        <div className="mt-4 space-y-1 text-xs opacity-90">
                          <p>时间：{stage.displayTime}</p>
                          <p>{stage.summary || stage.blockingReason || "待处理"}</p>
                          {stage.blockingReason && stage.status !== "failed" && (
                            <p className="opacity-75">阻塞：{stage.blockingReason}</p>
                          )}
                          {isDecisionStage && (
                            <p className="font-medium opacity-100">
                              点击查看{displayLabel}面板
                            </p>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>

                  {processTimeline?.source === "derived" && (
                    <div className="mt-4 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      当前阶段时间由案件材料与处理日志推导生成，后续会逐步切换为标准落库时间。
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-gray-500 py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  暂无阶段进度数据
                </div>
              )}
            </div>

            {/* AI Review Result */}
            {reviewResult && (
              <div className="space-y-6">
                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-gray-900">责任结论卡</h2>
                        <p className="mt-1 text-sm text-gray-500">
                          查看责任结论、责任代码和命中依据。
                        </p>
                      </div>
                      <DecisionBadge decision={reviewResult.decision} />
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-lg bg-slate-50 px-4 py-3">
                        <div className="text-xs text-slate-500">责任判断</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {reviewResult.liabilityDecision || "MANUAL_REVIEW"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-4 py-3">
                        <div className="text-xs text-slate-500">适用责任代码</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {coverageResults.length > 0
                            ? coverageResults.map((item) => formatCoverageCode(item.coverageCode)).join("、")
                            : "待识别"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-4 py-3">
                        <div className="text-xs text-slate-500">命中依据</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(reviewResult.eligibility?.matchedRules || []).length > 0 ? (
                            (reviewResult.eligibility?.matchedRules || []).map((rule) => (
                              <span key={rule} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                                {rule}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-500">暂无规则命中</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-gray-900">赔付轨迹卡</h2>
                        <p className="mt-1 text-sm text-gray-500">
                          追踪责任项金额、明细核定和限价影响。
                        </p>
                      </div>
                      {reviewResult.amount !== null && (
                        <div className="text-right">
                          <div className="text-xs text-gray-500">建议金额</div>
                          <div className="text-lg font-bold text-indigo-600">
                            ¥{reviewResult.amount.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-4">
                      {reviewResult.calculation?.settlementMode && (
                        <div className="mb-4 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                            结算模式：
                            {reviewResult.calculation.settlementMode === "LOSS"
                              ? "损失补偿账本"
                              : reviewResult.calculation.settlementMode === "BENEFIT"
                                ? "给付账本"
                                : "混合账本"}
                          </span>
                          {reviewResult.calculation.settlementBreakdown && (
                            <>
                              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                                定损 ¥{Number(reviewResult.calculation.settlementBreakdown.lossPayableAmount || 0).toLocaleString()}
                              </span>
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                                给付 ¥{Number(reviewResult.calculation.settlementBreakdown.benefitPayableAmount || 0).toLocaleString()}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                      <ItemLedgerTimeline items={ruleAuditLedger} />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-gray-900">证据与缺口卡</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        汇总事实来源、缺失材料、人工复核原因和建议补件。
                      </p>
                    </div>
                    <button
                      onClick={() => openImportDialogWithSuggestions(reviewResult.missingMaterials || [])}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      补充材料
                    </button>
                  </div>
                  <div className="mt-4 grid gap-4 xl:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 px-4 py-4">
                      <div className="text-xs text-slate-500">事实来源材料</div>
                      <div className="mt-2 text-sm text-slate-800">
                        已导入 {importedDocuments.length} 份材料，已识别 {recognizedReviewDocuments.length} 份材料，已入库 {reviewSummaries.length} 份摘要
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-emerald-700">
                          已识别 {recognizedReviewDocuments.length}
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-indigo-700">
                          已摘要 {reviewSummaries.length}
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-amber-700">
                          未识别 {unknownReviewDocuments.length}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-4 py-4">
                      <div className="text-xs text-slate-500">缺失事实 / 材料</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(reviewResult.missingMaterials || []).length > 0 ? (
                          (reviewResult.missingMaterials || []).map((material, index) => (
                            <button
                              key={`${material}-${index}`}
                              type="button"
                              onClick={() => openImportDialogWithSuggestions([material])}
                              className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                            >
                              {material}
                            </button>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">暂无缺失材料</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-4 py-4">
                      <div className="text-xs text-slate-500">建议补充</div>
                      <div className="mt-2 text-sm text-slate-800">
                        {(reviewResult.missingMaterials || []).length > 0
                          ? `建议优先补充 ${reviewResult.missingMaterials.slice(0, 3).join("、")}`
                          : "当前可继续进入人工审核或赔付确认"}
                      </div>
                    </div>
                  </div>
                  {explanationCards.length > 0 && (
                    <div className="mt-4 grid gap-4 xl:grid-cols-3">
                      {explanationCards.map((card) => (
                        <div
                          key={card.id}
                          className={`rounded-xl border p-4 ${
                            card.tone === "danger"
                              ? "border-rose-200 bg-rose-50"
                              : card.tone === "warning"
                                ? "border-amber-200 bg-amber-50"
                                : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <div
                            className={`text-sm font-semibold ${
                              card.tone === "danger"
                                ? "text-rose-700"
                                : card.tone === "warning"
                                  ? "text-amber-700"
                                  : "text-slate-700"
                            }`}
                          >
                            {card.title}
                          </div>
                          <div className="mt-3 space-y-2">
                            {card.items.map((item, index) => (
                              <div
                                key={`${card.id}-${index}`}
                                className="rounded-lg bg-white/80 px-3 py-2 text-sm text-slate-700"
                              >
                                {item.actionType === "material_import" ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openImportDialogWithSuggestions([
                                        item.materialName || item.label.replace(/^缺少材料：/, "").trim(),
                                      ])
                                    }
                                    className="text-left text-sm font-medium text-slate-700 hover:text-indigo-700"
                                  >
                                    {item.label}
                                  </button>
                                ) : item.actionType === "open_ruleset" ? (
                                  <button
                                    type="button"
                                    onClick={() => openRulesetManagementForCurrentProduct(item.coverageCode)}
                                    className="text-left text-sm font-medium text-slate-700 hover:text-indigo-700"
                                  >
                                    {item.label}
                                  </button>
                                ) : (
                                  item.label
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {materialValidationResults.length > 0 && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            材料一致性校验
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            跨材料字段比对结果会先沉淀为校验事实，再供规则引擎消费。
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">通过 / 未通过</div>
                          <div className="text-sm font-semibold text-slate-900">
                            {passedMaterialValidations.length} / {failedMaterialValidations.length}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 xl:grid-cols-2">
                        {materialValidationResults.map((item, index) => (
                          <div
                            key={`${item.details?.ruleId || item.type}-${index}`}
                            className={`rounded-lg border px-3 py-3 ${
                              item.passed
                                ? "border-emerald-200 bg-white"
                                : "border-amber-200 bg-amber-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-medium text-slate-900">
                                {item.message}
                              </div>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  item.passed
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {item.passed ? "通过" : "待处理"}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1 text-xs text-slate-600">
                              {item.details?.field && <div>校验字段：{item.details.field}</div>}
                              {item.details?.reasonCode && (
                                <div>原因码：{item.details.reasonCode}</div>
                              )}
                              {item.details?.failureAction && !item.passed && (
                                <div>失败处理：{item.details.failureAction}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {Object.keys(validationFacts).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Object.entries(validationFacts).map(([factKey, value]) => (
                            <span
                              key={factKey}
                              className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                            >
                              {factKey}: {value === true ? "true" : value === false ? "false" : "待确认"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-4">
                    <ManualReviewReasonList
                      reasons={(reviewResult.manualReviewReasons || []).map((reason) => ({
                        code: reason.code,
                        message: reason.message,
                      }))}
                    />
                  </div>
                </div>

                <div
                  className={`bg-white rounded-xl shadow-sm border-2 p-6 ${
                    reviewSummary?.tone === "success"
                      ? "border-green-200 bg-green-50/30"
                      : reviewSummary?.tone === "danger"
                        ? "border-red-200 bg-red-50/30"
                        : "border-amber-200 bg-amber-50/30"
                  }`}
                >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    🤖 责任判定 / 事实核定摘要
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
                        reviewSummary?.accentClass || "text-amber-600"
                      }`}
                    >
                      {reviewSummary?.label === "建议通过" && "✅ 建议通过"}
                      {reviewSummary?.label === "建议拒赔" && "❌ 建议拒赔"}
                      {reviewSummary?.label === "补充材料" && "📎 补充材料"}
                      {reviewSummary?.label === "已初算待补件" && "🧾 已初算待补件"}
                      {reviewSummary?.label === "需人工复核" && "🔍 需人工复核"}
                    </p>
                  </div>
                  {reviewOutcome?.showEstimatedAmount &&
                    reviewResult.amount !== null &&
                    canShowAssessmentAmount && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">
                        {reviewOutcome.amountLabel}
                      </p>
                      <p
                        className={`text-lg font-bold ${
                          reviewOutcome.highlightAmount
                            ? "text-indigo-600"
                            : "text-gray-700"
                        }`}
                      >
                        ¥{reviewResult.amount.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {reviewOutcome?.showEstimatedAmount &&
                    reviewResult.amount !== null &&
                    !canShowAssessmentAmount && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">
                        {reviewOutcome.amountLabel}
                      </p>
                      <p className="text-sm font-medium text-gray-500">
                        待赔付计算完成后展示
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

                {reviewOutcome?.detail && (
                  <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-800">当前处置</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {reviewOutcome.detail}
                    </p>
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      下一步：{reviewOutcome.nextAction}
                    </p>
                  </div>
                )}

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

                {groupedManualReviewReasons.length > 0 && (
                  <div className="mb-4 rounded-lg border border-orange-100 bg-orange-50 p-4">
                    <p className="text-sm font-medium text-orange-800 mb-3">
                      🔍 人工复核原因
                    </p>
                    <div className="space-y-3">
                      {groupedManualReviewReasons.map((group) => (
                        <div key={group.stage}>
                          <p className="text-xs font-semibold text-orange-700 mb-2">
                            {group.label}
                          </p>
                          <div className="space-y-2">
                            {group.reasons.map((reason, i) => (
                              <div key={`${reason.code}-${i}`} className="text-sm text-orange-700 bg-white/70 rounded-md p-3">
                                <div className="font-medium">{reason.message}</div>
                                <div className="text-xs text-orange-600 mt-1">
                                  {formatManualReviewCode(reason.code)} · {reason.code}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reviewResult.missingMaterials &&
                  reviewResult.missingMaterials.length > 0 && (
                    <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-800 mb-2">
                            {reviewSummary?.label === "已初算待补件"
                              ? "终审前待补材料"
                              : "缺失材料"}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {reviewResult.missingMaterials.map((material, i) => (
                              <span
                                key={`${material}-${i}`}
                                className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs"
                              >
                                {material}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => setShowImportDialog(true)}
                          className="flex-shrink-0 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
                        >
                          立即补件
                        </button>
                      </div>
                    </div>
                  )}

                {coverageResults.length > 0 && canShowAssessmentAmount && (
                  <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
                    <p className="text-sm font-medium text-indigo-900 mb-3">
                      责任项赔付明细
                    </p>
                    <div className="space-y-2">
                      {coverageResults.map((item, index) => (
                        <div
                          key={`${item.coverageCode}-${index}`}
                          className="rounded-lg border border-indigo-100 bg-white p-3"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">
                                {formatCoverageCode(item.coverageCode)}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                状态: {item.status || "待确认"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-500">
                                赔付金额
                              </div>
                              <div className="text-base font-bold text-indigo-600">
                                ¥{Number(item.approvedAmount || 0).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3 text-xs text-gray-600">
                            <div>申请金额: ¥{Number(item.claimedAmount || 0).toLocaleString()}</div>
                            <div>赔付比例: {((item.reimbursementRatio || 0) * 100).toFixed(0)}%</div>
                            <div>保额上限: {item.sumInsured != null ? `¥${Number(item.sumInsured).toLocaleString()}` : "不限"}</div>
                            <div>责任编码: {item.coverageCode}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {coverageResults.length > 0 && !canShowAssessmentAmount && (
                  <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-800">
                      责任项赔付明细待赔付计算完成后展示
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      当前阶段尚未完成赔付计算，金额与责任项明细暂不展示。
                    </p>
                  </div>
                )}

                <div className="bg-white/60 rounded-lg p-4 border border-gray-100">
                  <p className="text-sm text-gray-500 mb-2">审核意见</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                    {reviewResult.reasoning}
                  </p>
                </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">处理轨迹</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    覆盖补件、完整性校验、OCR/提取、责任判定、事实核定与赔付计算全过程
                  </p>
                </div>
                <button
                  onClick={handleShowLogs}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  查看完整操作日志
                </button>
              </div>

              {timelineEventGroups.length > 0 ? (
                <div className="space-y-4">
                  {timelineEventGroups.map((group) => (
                    <details
                      key={group.key}
                      className="rounded-xl border border-gray-200 bg-gray-50/60"
                      open={group.key === "intake" || group.key === "parse"}
                    >
                      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {group.label}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {group.events.length} 条记录
                          </p>
                        </div>
                        <span className="text-xs text-gray-400">展开查看</span>
                      </summary>
                      <div className="px-4 pb-4 space-y-3">
                        {group.events.map((event) => (
                          <div
                            key={event.id}
                            className="rounded-lg border border-gray-200 bg-white p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTimelineEventBadge(event)}`}
                                  >
                                    {event.summary}
                                  </span>
                                  {event.materialName && (
                                    <span className="text-xs text-gray-500">
                                      {event.materialName}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 text-sm text-gray-700">
                                  {event.details?.missingMaterials &&
                                  Array.isArray(event.details.missingMaterials) &&
                                  event.details.missingMaterials.length > 0
                                    ? `缺失材料：${event.details.missingMaterials.join("、")}`
                                    : event.details?.error
                                      ? `失败原因：${String(event.details.error)}`
                                      : event.details?.fileName
                                        ? `文件：${String(event.details.fileName)}`
                                        : event.details?.extractedFieldCount
                                          ? `提取字段 ${String(event.details.extractedFieldCount)} 项`
                                          : "已记录处理结果"}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-xs text-gray-500">
                                  {formatTimelineEventTime(event.timestamp)}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {getTimelineEventActorLabel(event)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  暂无处理轨迹
                </div>
              )}
            </div>

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
                  {localFileCategories.map((cat, i) => {
                    const categoryFiles = getCategoryFiles(cat);
                    return (
                      <div
                        key={`${cat.name}-${i}`}
                        className="border border-gray-100 rounded-lg overflow-hidden"
                      >
                      <button
                        onClick={() => toggleFileCategory(cat.name)}
                        className="w-full flex justify-between items-center px-4 py-3 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
                      >
                        <span>
                          {cat.name} ({categoryFiles.length}个文件)
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
                        categoryFiles.length > 0 && (
                          <div className="px-4 py-2 space-y-2 bg-gray-50/30">
                            {categoryFiles.map((file, idx) => {
                              const isImage =
                                /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
                              const isVideo =
                                /\.(mp4|mov|avi|mkv|webm)$/i.test(file.name);
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
                                            previewUrl = await getPreviewUrl(
                                              file.ossKey,
                                              isPdf
                                                ? "application/pdf"
                                                : isVideo
                                                  ? "video/mp4"
                                                : isWord
                                                  ? "application/msword"
                                                  : isExcel
                                                    ? "application/vnd.ms-excel"
                                                    : "image/jpeg",
                                              3600,
                                            );
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
                                            : isVideo
                                              ? "video/mp4"
                                              : isPdf
                                                ? "application/pdf"
                                                : isWord
                                                  ? "application/msword"
                                                  : isExcel
                                                    ? "application/vnd.ms-excel"
                                                    : "application/octet-stream",
                                          ossUrl: previewUrl,
                                          ossKey: file.ossKey,
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
                                                  previewUrl = await getPreviewUrl(
                                                    file.ossKey,
                                                    isPdf
                                                      ? "application/pdf"
                                                      : isVideo
                                                        ? "video/mp4"
                                                      : isWord
                                                        ? "application/msword"
                                                        : isExcel
                                                          ? "application/vnd.ms-excel"
                                                          : "image/jpeg",
                                                    3600,
                                                  );
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
                                                  : isVideo
                                                    ? "video/mp4"
                                                    : isPdf
                                                      ? "application/pdf"
                                                      : isWord
                                                        ? "application/msword"
                                                        : isExcel
                                                          ? "application/vnd.ms-excel"
                                                          : "application/octet-stream",
                                                ossUrl: previewUrl,
                                                ossKey: file.ossKey,
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
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-4">暂无上传文件</p>
              )}

              {/* Imported documents */}
              {importedDocuments.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <h3 className="text-sm font-bold text-indigo-700">
                        离线导入材料 ({importedDocuments.length})
                      </h3>
                      {latestImportMeta?.taskId && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                            任务 {latestImportMeta.taskStatus || "未知"}
                          </span>
                          <button
                            onClick={handleRecoverImportTask}
                            disabled={recoveringImportTask}
                            className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                              recoveringImportTask
                                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                            }`}
                          >
                            {recoveringImportTask ? "恢复中..." : "恢复任务"}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {latestImportMeta?.postProcessedAt && (
                        <span className="text-[10px] text-gray-500">
                          最近刷新: {formatDateTime(latestImportMeta.postProcessedAt)}
                        </span>
                      )}
                      <button
                        onClick={() => toggleFileCategory("导入材料")}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        {openFiles["导入材料"] !== false ? "收起" : "展开"}
                      </button>
                    </div>
                  </div>
                  {latestImportMeta?.failureHint &&
                    ["failed", "partial_success"].includes(latestImportMeta.taskStatus || "") && (
                      <p className="text-[11px] text-amber-700 mb-2">
                        恢复提示: {latestImportMeta.failureHint}
                      </p>
                    )}
                  {openFiles["导入材料"] !== false && (
                    <div className="space-y-1.5">
                      {importedDocuments.map((doc) => {
                        const classification = getImportedDocumentClassification(doc.classification);
                        return (
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
                                {classification.materialName}
                              </p>
                              {classification.errorMessage && (
                                <p className="text-[10px] text-red-600 truncate">
                                  分类失败: {classification.errorMessage}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                              doc.status !== "completed"
                                ? "bg-red-100 text-red-700"
                                : classification.errorMessage
                                  ? "bg-red-100 text-red-700"
                                : classification.materialId === "unknown"
                                  ? "bg-gray-100 text-gray-600"
                                  : "bg-green-100 text-green-700"
                            }`}
                          >
                            {doc.status !== "completed"
                              ? "失败"
                              : classification.errorMessage
                                ? "分类失败"
                              : classification.materialId === "unknown"
                                ? "未识别"
                                : "已识别"}
                          </span>
                        </div>
                        );
                      })}
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-gray-900">材料管理</h2>
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
                    {reportActionLabel}
                  </>
                )}
              </button>
            </div>
          </div>

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

          {claimFactCards.length > 0 && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    案件事实摘要
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    基于已识别材料生成，方便先看案件主结论，再逐份下钻核验。
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  {reviewSummaries.length} 份摘要已入库
                </div>
              </div>
              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                {claimFactCards.map((card) => (
                  <div
                    key={card.title}
                    className={`rounded-lg border px-4 py-3 ${
                      card.tone === "sky"
                        ? "border-sky-200 bg-sky-50"
                        : card.tone === "amber"
                          ? "border-amber-200 bg-amber-50"
                          : card.tone === "emerald"
                            ? "border-emerald-200 bg-emerald-50"
                            : card.tone === "indigo"
                              ? "border-indigo-200 bg-indigo-50"
                              : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="text-sm font-medium text-slate-900">
                      {card.title}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-700">
                      {card.content}
                    </div>
                    {card.meta && (
                      <div className="mt-2 text-xs text-slate-500">
                        {card.meta}
                      </div>
                    )}
                    {card.confirmed && card.confirmedAt && (
                      <div className="mt-2 text-xs text-emerald-700">
                        已确认时间：{new Date(card.confirmedAt).toLocaleString("zh-CN")}
                      </div>
                    )}
                    {card.confirmKey === "liability_apportionment" && (
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={liabilityPctDraft}
                          onChange={(e) => setLiabilityPctDraft(e.target.value)}
                          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
                        />
                        <span className="text-sm text-slate-500">第三方责任 %</span>
                        <button
                          type="button"
                          onClick={handleUpdateLiabilityApportionment}
                          disabled={updatingFactKey === "liability_apportionment_ratio"}
                          className="rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                        >
                          {updatingFactKey === "liability_apportionment_ratio" ? "重算中..." : "更新并重算"}
                        </button>
                      </div>
                    )}
                    {card.confirmKey && (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleConfirmFact(card.confirmKey!, true)}
                          disabled={updatingFactKey === card.confirmKey || card.confirmed}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                            card.confirmed
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "bg-slate-900 text-white hover:bg-slate-800"
                          }`}
                        >
                          {card.confirmed
                            ? "已人工确认"
                            : updatingFactKey === card.confirmKey
                              ? "确认中..."
                              : "人工确认"}
                        </button>
                        {card.confirmed && (
                          <button
                            type="button"
                            onClick={() => handleConfirmFact(card.confirmKey!, false)}
                            disabled={updatingFactKey === card.confirmKey}
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            取消确认
                          </button>
                        )}
                      </div>
                    )}
                    {card.sourceDocIds.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {card.sourceDocIds.slice(0, 3).map((docId) => {
                          const sourceDoc = reviewDocuments.find(
                            (doc) => doc.documentId === docId,
                          );
                          if (!sourceDoc) return null;
                          return (
                            <button
                              key={`${card.title}-${docId}`}
                              type="button"
                              onClick={() => {
                                setSelectedReviewDocumentId(sourceDoc.documentId);
                                void openViewerForDocument(
                                  {
                                    ossUrl: sourceDoc.ossUrl,
                                    ossKey: sourceDoc.ossKey,
                                    fileType: sourceDoc.fileType || "",
                                    fileName: sourceDoc.fileName,
                                  },
                                  {
                                    pageIndex: 0,
                                    highlightLevel: "page_only",
                                  },
                                );
                              }}
                              className="rounded-md border border-white/70 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                            >
                              查看来源：{sourceDoc.fileName.length > 18
                                ? `${sourceDoc.fileName.slice(0, 18)}...`
                                : sourceDoc.fileName}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {decisionTraceStages.length > 0 && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">决策轨迹</div>
              <div className="mt-1 text-xs text-slate-500">
                {domainPresentation.decisionTraceHint}
              </div>
              <div className="mt-3 space-y-3">
                {decisionTraceStages.map((stage, index) => (
                  <div
                    key={`${String(stage.stage || "trace")}-${index}`}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-slate-900">
                        {String(stage.title || stage.stage || "决策阶段")}
                      </div>
                      <span className="text-[11px] uppercase tracking-wide text-slate-500">
                        {String(stage.status || "completed")}
                      </span>
                    </div>
                    {stage.summary && (
                      <div className="mt-1 text-sm text-slate-700">
                        {String(stage.summary)}
                      </div>
                    )}
                    {Array.isArray(stage.facts) && stage.facts.length > 0 && (
                      <div className="mt-2 grid gap-2 xl:grid-cols-2">
                        {(stage.facts as Array<Record<string, unknown>>).map((fact, factIndex) => (
                          <div
                            key={`${String(fact.label || "fact")}-${factIndex}`}
                            className="rounded-md border border-white bg-white px-3 py-2"
                          >
                            <div className="text-xs text-slate-500">
                              {String(fact.label || "字段")}
                            </div>
                            <div className="mt-1 text-sm text-slate-900 break-words">
                              {String(fact.value || "-")}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(stage.manualActions) && stage.manualActions.length > 0 && (
                      <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                        <div className="text-xs font-medium text-slate-600">人工动作</div>
                        <div className="mt-2 space-y-1.5">
                          {(stage.manualActions as Array<Record<string, unknown>>).slice(-5).map((action, actionIndex) => (
                            <div
                              key={`${String(action.label || "manual")}-${actionIndex}`}
                              className="text-xs text-slate-600"
                            >
                              <span className="font-medium text-slate-700">
                                {String(action.label || "人工处理")}
                              </span>
                              {action.detail ? `：${String(action.detail)}` : ""}
                              {action.timestamp
                                ? `（${new Date(String(action.timestamp)).toLocaleString("zh-CN")}）`
                                : ""}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {Array.isArray(stage.sourceDocIds) && stage.sourceDocIds.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(stage.sourceDocIds as string[]).slice(0, 3).map((docId) => {
                          const sourceDoc = reviewDocuments.find((doc) => doc.documentId === docId);
                          if (!sourceDoc) return null;
                          return (
                            <button
                              key={`${String(stage.stage || "trace")}-${docId}`}
                              type="button"
                              onClick={() =>
                                void openViewerForDocument(
                                  {
                                    ossUrl: sourceDoc.ossUrl,
                                    ossKey: sourceDoc.ossKey,
                                    fileType: sourceDoc.fileType || "",
                                    fileName: sourceDoc.fileName,
                                  },
                                  {
                                    pageIndex: 0,
                                    highlightLevel: "page_only",
                                  },
                                )
                              }
                              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                            >
                              查看来源：{sourceDoc.fileName.length > 18
                                ? `${sourceDoc.fileName.slice(0, 18)}...`
                                : sourceDoc.fileName}
                            </button>
                          );
                        })}
                        {(stage.sourceDocIds as string[]).length > 3 && (
                          <span className="self-center text-xs text-slate-400">
                            另有 {(stage.sourceDocIds as string[]).length - 3} 份来源材料
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {validationChecklist &&
            Array.isArray((validationChecklist as Record<string, unknown>).issues) &&
            ((validationChecklist as Record<string, unknown>).issues as unknown[]).length > 0 && (
              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      案件校验发现
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {domainPresentation.validationHint}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>
                      共{" "}
                      {((validationChecklist as Record<string, unknown>).summary as Record<string, unknown>)?.total ?? 0}{" "}
                      项
                    </div>
                    <div className="text-red-600">
                      错误{" "}
                      {((validationChecklist as Record<string, unknown>).summary as Record<string, unknown>)?.errorCount ?? 0}
                    </div>
                    <div className="text-amber-600">
                      警告{" "}
                      {((validationChecklist as Record<string, unknown>).summary as Record<string, unknown>)?.warningCount ?? 0}
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {((validationChecklist as Record<string, unknown>).handlingProfile as Record<string, unknown>) && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-slate-900">
                          当前处理画像：{String((((validationChecklist as Record<string, unknown>).handlingProfile as Record<string, unknown>).profileName) || "通用案件审核")}
                        </div>
                        <span className="text-[11px] uppercase tracking-wide text-emerald-700">
                          profile
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {String((((validationChecklist as Record<string, unknown>).handlingProfile as Record<string, unknown>).description) || "根据险种、报案原因和案件事实自动匹配的处理画像。")}
                      </div>
                      {Array.isArray((((validationChecklist as Record<string, unknown>).handlingProfile as Record<string, unknown>).reviewTasks as unknown[])) &&
                        ((((validationChecklist as Record<string, unknown>).handlingProfile as Record<string, unknown>).reviewTasks as unknown[]).length > 0) && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {((((validationChecklist as Record<string, unknown>).handlingProfile as Record<string, unknown>).reviewTasks as Array<Record<string, unknown>>) || [])
                              .slice(0, 4)
                              .map((task, index) => (
                                <span
                                  key={`${String(task.code || "task")}-${index}`}
                                  className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-[11px] text-emerald-700"
                                >
                                  {String(task.title || "待确认")}
                                  {task.blocking ? "·必核" : ""}
                                </span>
                              ))}
                          </div>
                        )}
                    </div>
                  )}
                  {(((validationChecklist as Record<string, unknown>).issues as Array<Record<string, unknown>>) || [])
                    .slice(0, 8)
                    .map((issue, index) => (
                      <div
                        key={`${issue.code || "issue"}-${index}`}
                        className={`rounded-md border px-3 py-2 ${
                          issue.severity === "error"
                            ? "border-red-200 bg-red-50"
                            : issue.severity === "warning"
                              ? "border-amber-200 bg-amber-50"
                              : "border-sky-200 bg-sky-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-slate-900">
                            {String(issue.title || "校验提醒")}
                          </div>
                          <span className="text-[11px] uppercase tracking-wide text-slate-500">
                            {String(issue.severity || "info")}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          {String(issue.description || "")}
                        </div>
                        {issue.action && (
                          <div className="mt-1 text-xs text-slate-500">
                            建议：{String(issue.action)}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
                {requiresDeductionAssessment &&
                  aggregationResult &&
                  (aggregationResult as Record<string, unknown>).paymentSummary && (
                    <div className="mt-4 rounded-md border border-indigo-200 bg-indigo-50 p-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            已付款抵扣确认
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            已识别付款{" "}
                            ¥
                            {Number(
                              ((aggregationResult as Record<string, unknown>).paymentSummary as Record<string, unknown>)
                                ?.confirmedPaidAmount || 0,
                            ).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                            ，当前实际抵扣{" "}
                            ¥
                            {Number(
                              ((aggregationResult as Record<string, unknown>).deductionSummary as Record<string, unknown>)
                                ?.deductionTotal || 0,
                            ).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                            。
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            仅在确认该付款应从本次保险赔款中扣减时开启。
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={deductionAmountDraft}
                              onChange={(e) => setDeductionAmountDraft(e.target.value)}
                              className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
                            />
                            <span className="text-xs text-slate-500">自定义抵扣金额</span>
                            <button
                              onClick={handleUpdateDeductionAmount}
                              disabled={updatingDeduction}
                              className="px-3 py-1.5 text-xs border border-indigo-200 rounded-md text-indigo-700 hover:bg-white disabled:opacity-50"
                            >
                              {updatingDeduction ? "更新中..." : "按金额重算"}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTogglePaymentDeduction(false)}
                            disabled={updatingDeduction}
                            className="px-3 py-1.5 text-xs border border-slate-300 rounded-md text-slate-700 hover:bg-white disabled:opacity-50"
                          >
                            不抵扣
                          </button>
                          <button
                            onClick={() => handleTogglePaymentDeduction(true)}
                            disabled={updatingDeduction}
                            className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {updatingDeduction ? "更新中..." : "确认抵扣"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            )}

          {materialValidationResults.length > 0 && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    材料一致性校验结果
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    这里展示跨材料规则的执行结果，例如发票姓名与病历患者姓名是否一致。
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>通过 {passedMaterialValidations.length}</div>
                  <div className="text-amber-600">未通过 {failedMaterialValidations.length}</div>
                </div>
              </div>
              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                {materialValidationResults.map((item, index) => (
                  <div
                    key={`${item.details?.ruleId || item.type}-${index}`}
                    className={`rounded-lg border px-3 py-3 ${
                      item.passed
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-slate-900">
                        {item.message}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.passed
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {item.passed ? "一致" : "不一致"}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      {item.details?.field && <div>字段对：{item.details.field}</div>}
                      {item.details?.reasonCode && <div>原因码：{item.details.reasonCode}</div>}
                      {item.details?.failureAction && !item.passed && (
                        <div>失败处理：{item.details.failureAction}</div>
                      )}
                    </div>
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
            <MaterialManagementPanel
              claim={claim}
              documents={reviewDocuments}
              selectedDocumentId={selectedReviewDocumentId}
              onSelectDocument={(documentId) => {
                setSelectedReviewDocumentId(documentId);
                const nextDocument = reviewDocuments.find(
                  (doc) => doc.documentId === documentId,
                );
                if (!nextDocument) return;
                void openViewerForDocument(
                  {
                    ossUrl: nextDocument.ossUrl,
                    ossKey: nextDocument.ossKey,
                    fileType: nextDocument.fileType || "",
                    fileName: nextDocument.fileName,
                  },
                  {
                    pageIndex: 0,
                    highlightLevel: "page_only",
                  },
                );
              }}
              onJumpTo={handleJumpTo}
              onApproveField={approveField}
              isFieldApproved={isFieldApproved}
              previewContent={
                selectedViewerDoc ? (
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
                    <p className="text-sm">点击左侧材料或结构化字段</p>
                    <p className="text-sm">即可在这里查看对应原始文件</p>
                  </div>
                )
              }
            />
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
              <p className="text-sm">尚未生成{reportTabLabel}</p>
              <p className="text-xs text-gray-400">
                请先完成材料审核，再生成{reportTabLabel}
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
                  reportActionLabel
                )}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* 报告头部 */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{reportTabLabel}</h2>
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
              {((damageReport as Record<string, unknown>).settlementSnapshot as Record<string, unknown> | undefined)?.policyBinding && (
                <div className="px-6 py-4 border-b border-gray-100 bg-slate-50">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">绑定保单：</span>
                      <span className="font-medium text-gray-900">
                        {String(
                          (((damageReport as Record<string, unknown>).settlementSnapshot as Record<string, unknown>)
                            ?.policyBinding as Record<string, unknown>)?.policyNumber ?? "-",
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">规则集：</span>
                      <span className="font-medium text-gray-900">
                        {String(
                          (((damageReport as Record<string, unknown>).settlementSnapshot as Record<string, unknown>)
                            ?.policyBinding as Record<string, unknown>)?.rulesetId ?? "-",
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">实际产品：</span>
                      <span className="font-medium text-gray-900">
                        {String(
                          (((damageReport as Record<string, unknown>).settlementSnapshot as Record<string, unknown>)
                            ?.policyBinding as Record<string, unknown>)?.productCode ?? "-",
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">承保匹配：</span>
                      <span
                        className={`font-medium ${
                          (((damageReport as Record<string, unknown>).settlementSnapshot as Record<string, unknown>)
                            ?.policyBinding as Record<string, unknown>)?.insuredMatched === false
                            ? "text-red-600"
                            : "text-gray-900"
                        }`}
                      >
                        {(((damageReport as Record<string, unknown>).settlementSnapshot as Record<string, unknown>)
                          ?.policyBinding as Record<string, unknown>)?.insuredMatched === false
                          ? "不匹配"
                          : (((damageReport as Record<string, unknown>).settlementSnapshot as Record<string, unknown>)
                              ?.policyBinding as Record<string, unknown>)?.insuredMatched === true
                            ? "已匹配"
                            : "待确认"}
                      </span>
                    </div>
                  </div>
                  {Array.isArray(
                    (((damageReport as Record<string, unknown>).settlementSnapshot as Record<string, unknown>)
                      ?.coverageBreakdown as unknown[] | undefined),
                  ) &&
                    ((((damageReport as Record<string, unknown>).settlementSnapshot as Record<string, unknown>)
                      ?.coverageBreakdown as unknown[])?.length > 0) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {((((damageReport as Record<string, unknown>).settlementSnapshot as Record<string, unknown>)
                          ?.coverageBreakdown as Array<Record<string, unknown>>)).map((item) => (
                          <span
                            key={String(item.coverageCode)}
                            className="px-2 py-1 rounded bg-white border border-slate-200 text-xs text-slate-700"
                          >
                            {String(item.coverageCode)}: 申报 ¥
                            {Number(item.claimedAmount ?? 0).toLocaleString("zh-CN", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            / 核定 ¥
                            {Number(item.approvedAmount ?? 0).toLocaleString("zh-CN", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        ))}
                      </div>
                    )}
                </div>
              )}
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
                <div className="grid grid-cols-3 gap-8">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">
                      {String(
                        ((damageReport as Record<string, unknown>).amountLabels as string[] | undefined)?.[0] ??
                          domainPresentation.reportSummaryLabels[0],
                      )}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      ¥
                      {Number(
                        (damageReport as Record<string, unknown>).subTotal ?? 0,
                      ).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">
                      {String(
                        ((damageReport as Record<string, unknown>).amountLabels as string[] | undefined)?.[1] ??
                          domainPresentation.reportSummaryLabels[1],
                      )}
                    </p>
                    <p className={`text-2xl font-bold ${isMedicalScenario ? "text-amber-600" : "text-red-600"}`}>
                      {isMedicalScenario ||
                      Boolean(claimDomainModel?.isBenefitScenario)
                        ? "¥ "
                        : "× "}
                      {Number(
                        isMedicalScenario
                          ? (damageReport as Record<string, unknown>).deductionTotal ?? 0
                          : Boolean(claimDomainModel?.isBenefitScenario)
                          ? (damageReport as Record<string, unknown>).deductionTotal ?? 0
                          : (damageReport as Record<string, unknown>).liabilityAdjustment ?? 1,
                      ).toLocaleString("zh-CN", {
                        minimumFractionDigits: isMedicalScenario ? 2 : 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">
                      {String(
                        ((damageReport as Record<string, unknown>).amountLabels as string[] | undefined)?.[2] ??
                          domainPresentation.reportSummaryLabels[2],
                      )}
                    </p>
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
                      {String(
                        (damageReport as Record<string, unknown>).detailSectionTitle ??
                          domainPresentation.reportDetailTitle,
                      )}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                              项目
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">
                              {Boolean(claimDomainModel?.isBenefitScenario)
                                ? "给付基数"
                                : isMedicalScenario
                                  ? "费用金额"
                                  : "损失金额"}
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
      <Modal
        isOpen={stageDecisionModalMode !== null}
        onClose={() => setStageDecisionModalMode(null)}
        title={
          stageDecisionModalMode === "assessment"
            ? domainPresentation.stageAssessmentLabel
            : "定责"
        }
        width="max-w-6xl"
      >
        {stageDecisionModalMode && (
          <StageDecisionPanel
            mode={stageDecisionModalMode}
            claim={claim}
            reviewResult={reviewResult}
            reviewSummary={reviewSummary}
            stageViews={stageViews}
            groupedManualReviewReasons={groupedManualReviewReasons}
            coverageResults={coverageResults}
            damageReport={damageReport}
            canSubmit={
              stageDecisionModalMode === "liability"
                ? canManualCompleteLiability
                : canManualCompleteAssessment
            }
            submitting={manualStageSubmitting === stageDecisionModalMode}
            note={manualStageNote}
            onNoteChange={setManualStageNote}
            onSubmit={() => handleManualStageComplete(stageDecisionModalMode)}
          />
        )}
      </Modal>

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
                              Array.isArray(log.outputData?.files) && (
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
                  {previewDoc.ossUrl ? (
                    <DocumentViewer
                      fileUrl={previewDoc.ossUrl}
                      fileType={
                        previewDoc.fileType?.startsWith("image/")
                          ? "image"
                          : previewDoc.fileType?.includes("pdf")
                            ? "pdf"
                            : previewDoc.fileType?.includes("word") || previewDoc.fileType?.includes("officedocument")
                              ? "word"
                              : previewDoc.fileType?.includes("excel") || previewDoc.fileType?.includes("sheet")
                                ? "excel"
                                : "other"
                      }
                      fileName={previewDoc.fileName}
                      className="h-full w-full"
                    />
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
      <OfflineMaterialImportButton onClick={() => openImportDialogWithSuggestions([])} />
      <OfflineMaterialImportDialog
        isOpen={showImportDialog}
        onClose={() => {
          setShowImportDialog(false);
          setSuggestedImportMaterials([]);
        }}
        claimCaseId={claim.id}
        productCode={claim.productCode || "PROD001"}
        suggestedMaterials={suggestedImportMaterials}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
};

export default ClaimCaseDetailPage;
