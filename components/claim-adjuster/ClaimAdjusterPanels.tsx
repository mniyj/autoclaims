import React, { useEffect, useState } from "react";
import type {
  AnyDocumentSummary,
  ClaimCase,
  FieldCorrection,
  InterventionInstance,
  ProcessedFile,
  ReviewTask,
} from "../../types";
import type { SourceAnchor } from "../../types";
import type { SmartReviewResultView as SmartReviewResult } from "../../utils/claimReviewPresentation";
import type { ClaimTimelineStageView } from "../../utils/claimTimelinePresentation";
import { api } from "../../services/api";

type ReviewDocumentItem = ProcessedFile & {
  batchId?: string;
  importedAt?: string;
  documentSummary?: AnyDocumentSummary;
  duplicateWarning?: { message: string; similarity: number } | null;
  source?: string;
};

type DecisionMode = "liability" | "assessment";
type MaterialDisplayMode = "upload" | "type" | "event" | "source";
type MaterialAiResultSource = "structured" | "log";

type MaterialAiField = {
  label: string;
  value: string;
};

type MaterialAiResultView = {
  source: MaterialAiResultSource;
  materialType: string;
  confidence?: number;
  summaryText?: string;
  keyFields: MaterialAiField[];
  anomalies: string[];
  rawOutput?: string;
  generatedAt?: string;
  logCount?: number;
  unknownReason?: string;
};

interface MaterialManagementPanelProps {
  claim: ClaimCase;
  documents: ReviewDocumentItem[];
  selectedDocumentId: string | null;
  onSelectDocument: (documentId: string) => void;
  onJumpTo: (
    doc: Pick<
      ReviewDocumentItem,
      "ossUrl" | "ossKey" | "fileType" | "fileName"
    >,
    anchor: SourceAnchor,
  ) => void;
  onCorrectField: (
    docId: string,
    fieldKey: string,
    fieldLabel: string,
    originalValue: string,
    correctedValue: string,
  ) => void | Promise<void>;
  isFieldCorrected: (docId: string, fieldKey: string) => boolean;
  getFieldDisplayValue: (
    docId: string,
    fieldKey: string,
    originalValue: string,
  ) => string;
  isCaseClosed: boolean;
  fieldCorrections: Map<string, FieldCorrection>;
  previewContent: React.ReactNode;
  completeness?: {
    isComplete: boolean;
    score: number;
    missingMaterials: string[];
  } | null;
  importTaskMeta?: {
    id: string;
    taskId: string | null;
    taskStatus: string | null;
    postProcessedAt: string | null;
  } | null;
  onRecoverImportTask?: () => void;
  recoveringImportTask?: boolean;
}

interface ManualProcessingPanelProps {
  tasks: ReviewTask[];
  selectedTask: ReviewTask | null;
  onSelectTask: (task: ReviewTask) => void;
  manualInputText: string;
  onManualInputTextChange: (value: string) => void;
  manualReviewNotes: string;
  onManualReviewNotesChange: (value: string) => void;
  onSaveTask: () => void;
  onClearSelection: () => void;
  processingTask: boolean;
}

interface StageDecisionPanelProps {
  mode: DecisionMode;
  claim: ClaimCase;
  reviewResult: SmartReviewResult | null;
  reviewSummary: {
    label: string;
    tone: "success" | "danger" | "warning";
    accentClass: string;
  } | null;
  stageViews: ClaimTimelineStageView[];
  groupedManualReviewReasons: Array<{
    stage: string;
    label: string;
    reasons: Array<{ code: string; message: string }>;
  }>;
  coverageResults: Array<{
    coverageCode: string;
    status?: string;
    approvedAmount?: number;
    claimedAmount?: number;
    reimbursementRatio?: number;
    sumInsured?: number;
  }>;
  damageReport: Record<string, unknown> | null;
  canSubmit: boolean;
  submitting: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
}

function formatDateTime(value?: string) {
  if (!value) return "待处理";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "--";
  return Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function confidenceTone(confidence?: number) {
  if ((confidence || 0) >= 0.9) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if ((confidence || 0) >= 0.75) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-rose-50 text-rose-700 border-rose-200";
}

function documentStatusTone(status: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700";
    case "processing":
      return "bg-blue-50 text-blue-700";
    case "failed":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-amber-50 text-amber-700";
  }
}

function materialSourceLabel(source?: string): string {
  switch (source) {
    case "claim_report":
      return "报案上传";
    case "batch_import":
    case "offline_import":
      return "批量导入";
    case "direct_upload":
    case "manual_backfill":
      return "管理员上传";
    case "api_sync":
      return "API同步";
    default:
      return source ? `其他(${source})` : "未知来源";
  }
}

function materialSourceTone(source?: string): string {
  switch (source) {
    case "claim_report":
      return "bg-green-50 text-green-700";
    case "batch_import":
    case "offline_import":
      return "bg-indigo-50 text-indigo-700";
    case "direct_upload":
    case "manual_backfill":
      return "bg-blue-50 text-blue-700";
    case "api_sync":
      return "bg-purple-50 text-purple-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function taskTypeLabel(task: ReviewTask) {
  if (task.aiErrorMessage) return "AI识别失败";
  return task.taskType || "人工处理";
}

function taskTypeTone(task: ReviewTask) {
  if (task.aiErrorMessage) return "bg-rose-50 text-rose-700 border-rose-200";
  if (task.aiConfidence < task.threshold) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function extractSummaryFields(summary: AnyDocumentSummary | undefined) {
  if (!summary) return [];
  switch (summary.summaryType) {
    case "case_report":
      return [
        summary.accidentDate
          ? {
              key: "accidentDate",
              label: "事故日期",
              value: summary.accidentDate,
            }
          : null,
        summary.accidentLocation
          ? {
              key: "accidentLocation",
              label: "事故地点",
              value: summary.accidentLocation,
            }
          : null,
        summary.victimName
          ? { key: "victimName", label: "死者/伤者", value: summary.victimName }
          : null,
        summary.incidentSummary
          ? {
              key: "incidentSummary",
              label: "事故经过",
              value: summary.incidentSummary,
            }
          : null,
        summary.liabilityOpinion
          ? {
              key: "liabilityOpinion",
              label: "责任意见",
              value: summary.liabilityOpinion,
            }
          : null,
        summary.compensationPaid != null
          ? {
              key: "compensationPaid",
              label: "报告理算金额",
              value: `¥${formatCurrency(summary.compensationPaid)}`,
            }
          : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;
    case "accident_liability":
      return [
        summary.accidentDate
          ? {
              key: "accidentDate",
              label: "事故日期",
              value: summary.accidentDate,
            }
          : null,
        summary.accidentLocation
          ? {
              key: "accidentLocation",
              label: "事故地点",
              value: summary.accidentLocation,
            }
          : null,
        ...(summary.parties || []).map((party, index) => ({
          key: `liabilityPct_${index}`,
          label: `${party.role}责任`,
          value: `${party.name || "当事人"} · ${party.liabilityPct}%`,
        })),
        summary.liabilityBasis
          ? {
              key: "liabilityBasis",
              label: "定责依据",
              value: summary.liabilityBasis,
            }
          : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;
    case "inpatient_record":
      return [
        summary.admissionDate
          ? {
              key: "admissionDate",
              label: "入院日期",
              value: summary.admissionDate,
            }
          : null,
        summary.dischargeDate
          ? {
              key: "dischargeDate",
              label: "出院日期",
              value: summary.dischargeDate,
            }
          : null,
        summary.hospitalizationDays != null
          ? {
              key: "hospitalizationDays",
              label: "住院天数",
              value: `${summary.hospitalizationDays} 天`,
            }
          : null,
        ...(summary.diagnoses || []).map((item, index) => ({
          key: `diagnosis_${index}`,
          label: `诊断 ${index + 1}`,
          value: item.name,
        })),
        ...(summary.surgeries || []).map((item, index) => ({
          key: `surgery_${index}`,
          label: `手术 ${index + 1}`,
          value: item.name,
        })),
      ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;
    case "expense_invoice":
      return [
        summary.invoiceNumber
          ? {
              key: "invoiceNumber",
              label: "发票号码",
              value: summary.invoiceNumber,
            }
          : null,
        summary.invoiceDate
          ? {
              key: "invoiceDate",
              label: "开票日期",
              value: summary.invoiceDate,
            }
          : null,
        summary.totalAmount != null
          ? {
              key: "totalAmount",
              label: "发票金额",
              value: `¥${formatCurrency(summary.totalAmount)}`,
            }
          : null,
        summary.institution
          ? {
              key: "institution",
              label: "开票机构",
              value: summary.institution,
            }
          : null,
        ...(summary.breakdown || []).slice(0, 6).map((item, index) => ({
          key: `breakdown_${index}`,
          label: item.category,
          value: `${item.itemName} · ¥${formatCurrency(item.amount)}`,
        })),
      ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;
    case "disability_assessment":
      return [
        summary.disabilityLevel
          ? {
              key: "disabilityLevel",
              label: "伤残等级",
              value: summary.disabilityLevel,
            }
          : null,
        summary.disabilityBasis
          ? {
              key: "disabilityBasis",
              label: "鉴定依据",
              value: summary.disabilityBasis,
            }
          : null,
        summary.assessmentDate
          ? {
              key: "assessmentDate",
              label: "鉴定日期",
              value: summary.assessmentDate,
            }
          : null,
        summary.assessmentInstitution
          ? {
              key: "assessmentInstitution",
              label: "鉴定机构",
              value: summary.assessmentInstitution,
            }
          : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;
    case "income_lost":
      return [
        summary.monthlyIncome != null
          ? {
              key: "monthlyIncome",
              label: "月收入",
              value: `¥${formatCurrency(summary.monthlyIncome)}`,
            }
          : null,
        summary.lostWorkDays != null
          ? {
              key: "lostWorkDays",
              label: "误工天数",
              value: `${summary.lostWorkDays} 天`,
            }
          : null,
        summary.employer
          ? { key: "employer", label: "工作单位", value: summary.employer }
          : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;
    case "diagnosis_proof":
      return [
        ...(summary.diagnoses || []).map((item, index) => ({
          key: `diagnosis_${index}`,
          label: `诊断 ${index + 1}`,
          value: item.name,
        })),
        summary.issueDate
          ? { key: "issueDate", label: "出具日期", value: summary.issueDate }
          : null,
        summary.issuingDoctor
          ? {
              key: "issuingDoctor",
              label: "医师",
              value: summary.issuingDoctor,
            }
          : null,
        summary.institution
          ? { key: "institution", label: "机构", value: summary.institution }
          : null,
        summary.restDays != null
          ? {
              key: "restDays",
              label: "建议休养",
              value: `${summary.restDays} 天`,
            }
          : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;
    case "death_record":
      return [
        summary.deceasedName
          ? {
              key: "deceasedName",
              label: "死者姓名",
              value: summary.deceasedName,
            }
          : null,
        summary.deathDate
          ? { key: "deathDate", label: "死亡日期", value: summary.deathDate }
          : null,
        summary.deathCause
          ? { key: "deathCause", label: "死亡原因", value: summary.deathCause }
          : null,
        summary.issuingAuthority
          ? {
              key: "issuingAuthority",
              label: "出具机构",
              value: summary.issuingAuthority,
            }
          : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;
    case "claimant_relationship":
      return [
        summary.deceasedName
          ? { key: "deceasedName", label: "死者", value: summary.deceasedName }
          : null,
        summary.claimantName
          ? {
              key: "claimantName",
              label: "关系人",
              value: summary.claimantName,
            }
          : null,
        summary.relationship
          ? { key: "relationship", label: "关系", value: summary.relationship }
          : null,
        summary.issuingAuthority
          ? {
              key: "issuingAuthority",
              label: "出具机构",
              value: summary.issuingAuthority,
            }
          : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;
    case "household_proof":
      return [
        summary.residentName
          ? {
              key: "residentName",
              label: "户籍姓名",
              value: summary.residentName,
            }
          : null,
        summary.householdType
          ? {
              key: "householdType",
              label: "户别",
              value: summary.householdType,
            }
          : null,
        summary.householdAddress
          ? {
              key: "householdAddress",
              label: "户籍地址",
              value: summary.householdAddress,
            }
          : null,
        summary.issuingAuthority
          ? {
              key: "issuingAuthority",
              label: "登记机关",
              value: summary.issuingAuthority,
            }
          : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;
    case "police_call_record":
      return [
        summary.callTime
          ? { key: "callTime", label: "报警时间", value: summary.callTime }
          : null,
        summary.handlingUnit
          ? {
              key: "handlingUnit",
              label: "处理单位",
              value: summary.handlingUnit,
            }
          : null,
        summary.incidentSummary
          ? {
              key: "incidentSummary",
              label: "接警摘要",
              value: summary.incidentSummary,
            }
          : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;
    case "incident_interview":
      return [
        summary.recordPerson
          ? {
              key: "recordPerson",
              label: "笔录对象",
              value: summary.recordPerson,
            }
          : null,
        summary.recordingUnit
          ? {
              key: "recordingUnit",
              label: "制作单位",
              value: summary.recordingUnit,
            }
          : null,
        summary.incidentStatement
          ? {
              key: "incidentStatement",
              label: "事故陈述",
              value: summary.incidentStatement,
            }
          : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;
    case "employment_chat":
    case "identity_chain_evidence":
      return [
        summary.communicationDate
          ? {
              key: "communicationDate",
              label: "沟通日期",
              value: summary.communicationDate,
            }
          : null,
        Array.isArray(summary.participants) && summary.participants.length > 0
          ? {
              key: "participants",
              label: "参与人",
              value: summary.participants.join("、"),
            }
          : null,
        summary.taskSummary
          ? {
              key: "taskSummary",
              label: "责任链摘要",
              value: summary.taskSummary,
            }
          : null,
        summary.relationHint
          ? {
              key: "relationHint",
              label: "第三者身份/责任链线索",
              value: summary.relationHint,
            }
          : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;
    case "payment_voucher":
      return [
        summary.paidAmount != null
          ? {
              key: "paidAmount",
              label: "付款金额",
              value: `¥${formatCurrency(summary.paidAmount)}`,
            }
          : null,
        summary.payeeName
          ? { key: "payeeName", label: "收款人", value: summary.payeeName }
          : null,
        summary.paidAt
          ? { key: "paidAt", label: "付款日期", value: summary.paidAt }
          : null,
        summary.voucherNumber
          ? {
              key: "voucherNumber",
              label: "凭证号",
              value: summary.voucherNumber,
            }
          : null,
        summary.paymentNote
          ? { key: "paymentNote", label: "附言", value: summary.paymentNote }
          : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;
    case "incident_statement":
      return [
        summary.issueDate
          ? { key: "issueDate", label: "出具日期", value: summary.issueDate }
          : null,
        summary.issuingAuthority
          ? {
              key: "issuingAuthority",
              label: "出具机构",
              value: summary.issuingAuthority,
            }
          : null,
        summary.incidentSummary
          ? {
              key: "incidentSummary",
              label: "事故摘要",
              value: summary.incidentSummary,
            }
          : null,
        summary.liabilityHint
          ? {
              key: "liabilityHint",
              label: "责任线索",
              value: summary.liabilityHint,
            }
          : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;
    default:
      return [];
  }
}

function stringifyFieldValue(value: unknown) {
  if (value == null || value === "") return "--";
  if (Array.isArray(value)) {
    return value.map((item) => stringifyFieldValue(item)).join("、");
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function parseJsonSafely(text: string) {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function formatAiFieldLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildStructuredAiResult(
  doc: ReviewDocumentItem,
): MaterialAiResultView | null {
  const summaryFields = extractSummaryFields(doc.documentSummary);
  const structuredData =
    doc.structuredData && typeof doc.structuredData === "object"
      ? (doc.structuredData as Record<string, unknown>)
      : null;
  const structuredFields = structuredData
    ? Object.entries(structuredData).map(([key, value]) => ({
        label: formatAiFieldLabel(key),
        value: stringifyFieldValue(value),
      }))
    : [];
  const keyFields =
    summaryFields.length > 0
      ? summaryFields.map((field) => ({
          label: field.label,
          value: field.value,
        }))
      : structuredFields;

  if (keyFields.length === 0 && !doc.documentSummary && !structuredData) {
    return null;
  }

  const summaryText =
    doc.auditConclusion ||
    (doc.documentSummary
      ? summaryFields
          .map((field) => `${field.label}: ${field.value}`)
          .join("；")
      : undefined);
  const rawOutput =
    doc.documentSummary != null
      ? JSON.stringify(doc.documentSummary, null, 2)
      : structuredData != null
        ? JSON.stringify(structuredData, null, 2)
        : undefined;

  return {
    source: "structured",
    materialType: doc.classification?.materialName || "未分类",
    confidence: doc.classification?.confidence,
    summaryText,
    keyFields,
    anomalies: doc.classification?.errorMessage
      ? [doc.classification.errorMessage]
      : [],
    rawOutput,
  };
}

function buildLogAiResult(
  logs: Array<Record<string, any>>,
  doc: ReviewDocumentItem,
): MaterialAiResultView | null {
  if (!logs.length) return null;

  const classifyLog = logs.find(
    (log) => log.module === "taskQueue.worker.classifyMaterial",
  );
  const analysisLog = logs.find(
    (log) => log.module === "fileProcessor.analyzeDocumentContent",
  );
  const fallbackLog = analysisLog || classifyLog || logs[0];
  const classifyPayload = classifyLog?.response?.text
    ? parseJsonSafely(classifyLog.response.text)
    : null;
  const analysisText =
    analysisLog?.response?.text || fallbackLog?.response?.text || "";
  const analysisPayload = analysisText ? parseJsonSafely(analysisText) : null;

  const typeCandidates = [
    classifyPayload?.materialName,
    analysisPayload?.["检查类型"],
    analysisPayload?.document_type,
    analysisPayload?.documentType,
    doc.classification?.materialName,
  ].filter(Boolean);
  const summaryCandidates = [
    analysisPayload?.["检查结果"],
    analysisPayload?.summary,
    analysisPayload?.result,
    analysisPayload?.document_summary,
    analysisPayload?.key_information &&
      stringifyFieldValue(analysisPayload.key_information),
  ].filter(Boolean);
  const anomalyCandidates = [
    ...(Array.isArray(analysisPayload?.["异常指标详情"])
      ? analysisPayload["异常指标详情"]
      : []),
    ...(Array.isArray(analysisPayload?.anomalies)
      ? analysisPayload.anomalies
      : []),
    ...(Array.isArray(analysisPayload?.warnings)
      ? analysisPayload.warnings
      : []),
  ].map((item) => stringifyFieldValue(item));

  const keyFields: MaterialAiField[] = [];
  if (analysisPayload && typeof analysisPayload === "object") {
    Object.entries(analysisPayload).forEach(([key, value]) => {
      if (
        key === "检查结果" ||
        key === "异常指标详情" ||
        key === "warnings" ||
        key === "anomalies" ||
        key === "document_type" ||
        key === "documentType" ||
        key === "检查类型"
      ) {
        return;
      }
      keyFields.push({
        label: formatAiFieldLabel(key),
        value: stringifyFieldValue(value),
      });
    });
  }

  return {
    source: "log",
    materialType: String(typeCandidates[0] || "未识别"),
    confidence:
      typeof classifyPayload?.confidence === "number"
        ? classifyPayload.confidence
        : doc.classification?.confidence,
    summaryText: summaryCandidates[0]
      ? String(summaryCandidates[0])
      : undefined,
    keyFields,
    anomalies: anomalyCandidates,
    rawOutput: analysisText || classifyLog?.response?.text || undefined,
    generatedAt: fallbackLog?.timestamp,
    logCount: logs.length,
    unknownReason:
      classifyPayload?.materialName === "未识别" ||
      classifyPayload?.materialId === "unknown"
        ? String(classifyPayload?.reason || "")
        : undefined,
  };
}

function buildRawText(
  doc: ReviewDocumentItem,
  summary: AnyDocumentSummary | undefined,
  fields: Array<{ label: string; value: string }>,
) {
  if (typeof doc.extractedText === "string" && doc.extractedText.trim()) {
    return doc.extractedText.trim();
  }
  if (doc.structuredData && Object.keys(doc.structuredData).length > 0) {
    return JSON.stringify(doc.structuredData, null, 2);
  }
  if (fields.length > 0) {
    return fields.map((field) => `${field.label}：${field.value}`).join("\n");
  }
  if (summary) {
    return JSON.stringify(summary, null, 2);
  }
  return "暂无识别结果";
}

function getRecognitionStatusLabel(
  doc: ReviewDocumentItem,
  hasAiResult: boolean,
) {
  if (doc.status === "failed") return "识别失败";
  if (doc.status === "processing") return "处理中";
  if (doc.status !== "completed") return "待处理";
  if (hasAiResult) return "已完成结构化";
  if (typeof doc.extractedText === "string" && doc.extractedText.trim()) {
    return "仅 OCR 完成";
  }
  return "待补识别";
}

function findStageView(
  stageViews: ClaimTimelineStageView[],
  key: ClaimTimelineStageView["key"],
) {
  return stageViews.find((stage) => stage.key === key) || null;
}

function toTimestamp(value?: string) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getRecordValue(
  record: Record<string, unknown> | undefined,
  keys: string[],
) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function getEventTimeInfo(doc: ReviewDocumentItem) {
  const summary = doc.documentSummary;
  const structuredData =
    doc.structuredData && typeof doc.structuredData === "object"
      ? (doc.structuredData as Record<string, unknown>)
      : undefined;

  const serviceTime =
    getRecordValue(structuredData, [
      "serviceDate",
      "service_date",
      "visitDate",
      "visit_date",
      "treatmentDate",
      "treatment_date",
      "medicalDate",
      "medical_date",
      "encounterDate",
      "encounter_date",
    ]) ||
    (summary &&
    "serviceDate" in summary &&
    typeof summary.serviceDate === "string"
      ? summary.serviceDate
      : undefined);

  if (serviceTime) {
    return {
      value: serviceTime,
      sourceLabel: "就医时间",
      sortTime: toTimestamp(serviceTime),
    };
  }

  if (summary?.summaryType === "inpatient_record" && summary.admissionDate) {
    return {
      value: summary.admissionDate,
      sourceLabel: "入院日期",
      sortTime: toTimestamp(summary.admissionDate),
    };
  }

  if (summary?.summaryType === "diagnosis_proof" && summary.issueDate) {
    return {
      value: summary.issueDate,
      sourceLabel: "出具日期",
      sortTime: toTimestamp(summary.issueDate),
    };
  }

  if (summary?.summaryType === "expense_invoice" && summary.invoiceDate) {
    return {
      value: summary.invoiceDate,
      sourceLabel: "开票日期",
      sortTime: toTimestamp(summary.invoiceDate),
    };
  }

  if (summary?.summaryType === "case_report" && summary.accidentDate) {
    return {
      value: summary.accidentDate,
      sourceLabel: "事故日期",
      sortTime: toTimestamp(summary.accidentDate),
    };
  }

  if (summary?.summaryType === "death_record" && summary.deathDate) {
    return {
      value: summary.deathDate,
      sourceLabel: "死亡日期",
      sortTime: toTimestamp(summary.deathDate),
    };
  }

  if (summary?.summaryType === "police_call_record" && summary.callTime) {
    return {
      value: summary.callTime,
      sourceLabel: "报警时间",
      sortTime: toTimestamp(summary.callTime),
    };
  }

  if (summary?.summaryType === "incident_statement" && summary.issueDate) {
    return {
      value: summary.issueDate,
      sourceLabel: "出具日期",
      sortTime: toTimestamp(summary.issueDate),
    };
  }

  if (
    (summary?.summaryType === "employment_chat" ||
      summary?.summaryType === "identity_chain_evidence") &&
    summary.communicationDate
  ) {
    return {
      value: summary.communicationDate,
      sourceLabel: "沟通日期",
      sortTime: toTimestamp(summary.communicationDate),
    };
  }

  if (summary?.summaryType === "payment_voucher" && summary.paidAt) {
    return {
      value: summary.paidAt,
      sourceLabel: "付款日期",
      sortTime: toTimestamp(summary.paidAt),
    };
  }

  if (doc.importedAt) {
    return {
      value: doc.importedAt,
      sourceLabel: "上传时间",
      sortTime: toTimestamp(doc.importedAt),
    };
  }

  return {
    value: "未识别事件时间",
    sourceLabel: "上传时间",
    sortTime: 0,
  };
}

function getDateGroupLabel(value?: string) {
  if (!value || value === "未识别事件时间") return "未识别日期";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10) || value;
  }
  return date.toLocaleDateString("zh-CN");
}

export function MaterialManagementPanel({
  claim,
  documents,
  selectedDocumentId,
  onSelectDocument,
  onJumpTo,
  onCorrectField,
  isFieldCorrected,
  getFieldDisplayValue,
  isCaseClosed,
  fieldCorrections,
  previewContent,
  completeness,
  importTaskMeta,
  onRecoverImportTask,
  recoveringImportTask,
}: MaterialManagementPanelProps) {
  const [displayMode, setDisplayMode] = useState<MaterialDisplayMode>("upload");
  const [contentTab, setContentTab] = useState<
    "fields" | "ai" | "validation" | "raw"
  >("fields");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");
  const [aiResultCache, setAiResultCache] = useState<
    Record<string, MaterialAiResultView | null>
  >({});
  const [aiResultLoading, setAiResultLoading] = useState(false);

  const normalizedDocuments = documents
    .filter((doc) => !!doc.fileName)
    .map((doc) => ({
      doc,
      uploadSortTime: toTimestamp(doc.importedAt),
      uploadGroupLabel: getDateGroupLabel(doc.importedAt),
      eventTime: getEventTimeInfo(doc),
      typeGroupLabel: doc.classification?.materialName || "未分类",
      sourceGroupLabel: materialSourceLabel(doc.source),
    }));

  const groupedDocuments = (() => {
    const groups: Record<
      string,
      {
        label: string;
        sortTime: number;
        secondaryLabel?: string;
        items: typeof normalizedDocuments;
      }
    > = {};

    for (const item of normalizedDocuments) {
      const { doc } = item;
      let groupKey = item.uploadGroupLabel;
      let groupLabel = item.uploadGroupLabel;
      let sortTime = item.uploadSortTime;
      let secondaryLabel = "按上传时间展示";

      if (displayMode === "type") {
        groupKey = item.typeGroupLabel;
        groupLabel = item.typeGroupLabel;
        sortTime = item.uploadSortTime;
        secondaryLabel = "按材料类型分类";
      }

      if (displayMode === "event") {
        groupKey = getDateGroupLabel(item.eventTime.value);
        groupLabel = groupKey;
        sortTime = item.eventTime.sortTime;
        secondaryLabel = item.eventTime.sourceLabel;
      }

      if (displayMode === "source") {
        groupKey = item.sourceGroupLabel;
        groupLabel = item.sourceGroupLabel;
        sortTime = item.uploadSortTime;
        secondaryLabel = "按材料来源分类";
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          label: groupLabel,
          sortTime,
          secondaryLabel,
          items: [],
        };
      }

      groups[groupKey].items.push(item);

      if (sortTime > groups[groupKey].sortTime) {
        groups[groupKey].sortTime = sortTime;
      }
    }

    return Object.values(groups)
      .map((group) => ({
        ...group,
        items: group.items.sort((left, right) => {
          if (displayMode === "type" || displayMode === "source") {
            return right.uploadSortTime - left.uploadSortTime;
          }
          if (displayMode === "event") {
            return right.eventTime.sortTime - left.eventTime.sortTime;
          }
          return right.uploadSortTime - left.uploadSortTime;
        }),
      }))
      .sort((left, right) => {
        if (displayMode === "type" || displayMode === "source") {
          return left.label.localeCompare(right.label, "zh-CN");
        }
        return right.sortTime - left.sortTime;
      });
  })();

  const selectedDocument =
    documents.find((doc) => doc.documentId === selectedDocumentId) ||
    documents[0] ||
    null;
  const selectedSummary = selectedDocument?.documentSummary;
  const selectedEventTime = selectedDocument
    ? getEventTimeInfo(selectedDocument)
    : null;
  const summaryFields = extractSummaryFields(selectedSummary);
  const correctedCount = selectedDocument
    ? summaryFields.filter((f) =>
        isFieldCorrected(selectedDocument.documentId, f.key),
      ).length
    : 0;
  const rawText = selectedDocument
    ? buildRawText(selectedDocument, selectedSummary, summaryFields)
    : "暂无识别结果";
  const selectedAiResult = selectedDocument
    ? (aiResultCache[selectedDocument.documentId] ?? null)
    : null;
  const recognitionStatusLabel = selectedDocument
    ? getRecognitionStatusLabel(selectedDocument, Boolean(selectedAiResult))
    : "待处理";

  useEffect(() => {
    if (!selectedDocument) return;

    const structuredResult = buildStructuredAiResult(selectedDocument);
    if (structuredResult) {
      setAiResultCache((current) => {
        if (current[selectedDocument.documentId]) {
          return current;
        }
        return {
          ...current,
          [selectedDocument.documentId]: structuredResult,
        };
      });
      return;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        aiResultCache,
        selectedDocument.documentId,
      )
    ) {
      return;
    }

    let cancelled = false;
    setAiResultLoading(true);

    api.aiInteractionLogs
      .query({
        claimRef: claim.reportNumber || claim.id,
        fileName: selectedDocument.fileName,
        success: true,
        limit: 12,
      })
      .then((result) => {
        if (cancelled) return;
        const logs = Array.isArray(result.logs) ? result.logs : [];
        const nextResult = buildLogAiResult(
          logs as Array<Record<string, any>>,
          selectedDocument,
        );
        setAiResultCache((current) => ({
          ...current,
          [selectedDocument.documentId]: nextResult,
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setAiResultCache((current) => ({
          ...current,
          [selectedDocument.documentId]: null,
        }));
      })
      .finally(() => {
        if (!cancelled) {
          setAiResultLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [aiResultCache, claim.id, claim.reportNumber, selectedDocument]);

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[680px]">
      <aside className="w-[260px] shrink-0 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-4 border-b border-slate-200 bg-white">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
            Materials
          </p>
          <h3 className="mt-2 text-lg font-bold text-slate-900">材料管理</h3>
          <p className="mt-1 text-xs text-slate-500">
            {claim.reportNumber} · {documents.length} 份材料
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2">
            {[
              {
                key: "upload" as const,
                label: "按上传时间",
                desc: "默认展示方式",
              },
              {
                key: "type" as const,
                label: "按材料类型",
                desc: "按分类聚合材料",
              },
              {
                key: "event" as const,
                label: "按事件时间",
                desc: "按就医/事件时间聚合",
              },
              {
                key: "source" as const,
                label: "按来源",
                desc: "区分材料提交渠道",
              },
            ].map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => setDisplayMode(mode.key)}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
                  displayMode === mode.key
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="text-sm font-semibold">{mode.label}</span>
                <span className="text-[11px]">{mode.desc}</span>
              </button>
            ))}
          </div>
        </div>
        {/* 完整性警告 */}
        {completeness && completeness.missingMaterials.length > 0 && (
          <div className="mx-3 my-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs font-semibold text-amber-800">
              缺失材料 ({completeness.missingMaterials.length})
            </p>
            <ul className="mt-1 space-y-0.5">
              {completeness.missingMaterials.map((name) => (
                <li key={name} className="text-[11px] text-amber-700">
                  · {name}
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* 批量导入任务恢复 */}
        {importTaskMeta?.taskId && (
          <div className="mx-3 my-2 flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
              导入任务 {importTaskMeta.taskStatus || "未知"}
            </span>
            <button
              type="button"
              onClick={onRecoverImportTask}
              disabled={recoveringImportTask}
              className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                recoveringImportTask
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
              }`}
            >
              {recoveringImportTask ? "恢复中..." : "恢复任务"}
            </button>
            {importTaskMeta.postProcessedAt && (
              <span className="text-[10px] text-slate-500 ml-auto">
                {importTaskMeta.postProcessedAt}
              </span>
            )}
          </div>
        )}
        <div className="overflow-y-auto flex-1">
          {groupedDocuments.map((group) => (
            <div
              key={group.label}
              className="border-b border-slate-200/70 last:border-b-0"
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-1">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-400">
                  {group.label}
                </p>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">
                  {group.items.length}
                </span>
              </div>
              <div className="px-4 pb-2 text-[11px] text-slate-400">
                {group.secondaryLabel}
              </div>
              <div className="pb-3">
                {group.items.map(({ doc, eventTime }, index) => {
                  const isActive =
                    doc.documentId === selectedDocument?.documentId;
                  return (
                    <button
                      key={doc.documentId}
                      type="button"
                      onClick={() => onSelectDocument(doc.documentId)}
                      className={`w-full text-left px-4 py-3 transition-colors border-l-4 ${
                        isActive
                          ? "bg-white border-l-blue-600"
                          : "border-l-transparent hover:bg-white/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {group.items.length > 1 && (
                              <span className="text-xs font-semibold text-blue-600">
                                #{index + 1}
                              </span>
                            )}
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {doc.fileName}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {displayMode === "event"
                              ? `${eventTime.sourceLabel} ${formatDateTime(eventTime.value)}`
                              : displayMode === "type"
                                ? `${formatDateTime(doc.importedAt)} · ${doc.fileType?.toUpperCase() || "FILE"}`
                                : `${formatDateTime(doc.importedAt)} · ${doc.fileType?.toUpperCase() || "FILE"}`}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${documentStatusTone(
                            doc.status,
                          )}`}
                        >
                          {doc.status === "completed"
                            ? "已采纳"
                            : doc.status === "processing"
                              ? "处理中"
                              : doc.status === "failed"
                                ? "异常"
                                : "待处理"}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {displayMode !== "event" &&
                          eventTime.value !== "未识别事件时间" && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                              {eventTime.sourceLabel}{" "}
                              {formatDateTime(eventTime.value)}
                            </span>
                          )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${confidenceTone(
                            doc.classification?.confidence,
                          )}`}
                        >
                          置信度{" "}
                          {Math.round(
                            (doc.classification?.confidence || 0) * 100,
                          )}
                          %
                        </span>
                        {displayMode !== "source" && doc.source && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${materialSourceTone(doc.source)}`}
                          >
                            {materialSourceLabel(doc.source)}
                          </span>
                        )}
                        {doc.duplicateWarning && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold">
                            重复提醒
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
        {selectedDocument ? (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc,white_55%,#eff6ff)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-slate-900">
                      {selectedDocument.fileName}
                    </h3>
                    <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                      {selectedDocument.classification.materialName}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${confidenceTone(
                        selectedDocument.classification.confidence,
                      )}`}
                    >
                      AI{" "}
                      {Math.round(
                        selectedDocument.classification.confidence * 100,
                      )}
                      %
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {claim.insured || claim.reporter || "被保人"} · 导入时间{" "}
                    {formatDateTime(selectedDocument.importedAt)}
                  </p>
                  {selectedEventTime && (
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedEventTime.sourceLabel}{" "}
                      {formatDateTime(selectedEventTime.value)}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 min-w-[320px]">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 border border-slate-200">
                    <p className="text-xs text-slate-500">识别状态</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {recognitionStatusLabel}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 border border-slate-200">
                    <p className="text-xs text-slate-500">人工订正</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {correctedCount > 0 ? `${correctedCount} 项` : "无"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 border border-slate-200">
                    <p className="text-xs text-slate-500">异常提醒</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {selectedDocument.duplicateWarning ? "1 项" : "无"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Inner tab bar */}
            <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-1 bg-slate-50/50">
              {[
                { key: "fields" as const, label: "结构化字段" },
                { key: "ai" as const, label: "AI 识别" },
                { key: "validation" as const, label: "校验" },
                { key: "raw" as const, label: "原文" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setContentTab(tab.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    contentTab === tab.key
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Tab: 结构化字段 */}
              {contentTab === "fields" && (
                <div className="divide-y divide-slate-100">
                  {summaryFields.length > 0 ? (
                    summaryFields.map((field) => {
                      // 数组字段的 key（如 diagnosis_0）在 sourceAnchors 里存的是父数组 key（如 diagnoses）
                      const parentKeyMap: Record<string, string> = {
                        diagnosis: "diagnoses",
                        surgery: "surgeries",
                        liabilityPct: "parties",
                        breakdown: "breakdownItems",
                      };
                      const parentKey = Object.entries(parentKeyMap).find(
                        ([prefix]) => field.key.startsWith(`${prefix}_`),
                      )?.[1];
                      const anchor =
                        selectedSummary?.sourceAnchors?.[field.key] ??
                        (parentKey
                          ? selectedSummary?.sourceAnchors?.[parentKey]
                          : undefined);
                      const corrected = isFieldCorrected(
                        selectedDocument.documentId,
                        field.key,
                      );
                      const displayValue = getFieldDisplayValue(
                        selectedDocument.documentId,
                        field.key,
                        field.value,
                      );
                      const correction = fieldCorrections.get(
                        `${selectedDocument.documentId}.${field.key}`,
                      );
                      const isEditing =
                        editingField ===
                        `${selectedDocument.documentId}.${field.key}`;

                      return (
                        <div
                          key={field.key}
                          className="px-5 py-4 hover:bg-slate-50/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-400">
                                  {field.label}
                                </span>
                                {corrected && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                    已修改
                                  </span>
                                )}
                              </div>
                              {isEditing ? (
                                <div className="mt-2 flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editDraft}
                                    onChange={(e) =>
                                      setEditDraft(e.target.value)
                                    }
                                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (
                                        e.key === "Enter" &&
                                        editDraft.trim() &&
                                        editDraft !== field.value
                                      ) {
                                        onCorrectField(
                                          selectedDocument.documentId,
                                          field.key,
                                          field.label,
                                          field.value,
                                          editDraft.trim(),
                                        );
                                        setEditingField(null);
                                      } else if (e.key === "Escape") {
                                        setEditingField(null);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        editDraft.trim() &&
                                        editDraft !== field.value
                                      ) {
                                        onCorrectField(
                                          selectedDocument.documentId,
                                          field.key,
                                          field.label,
                                          field.value,
                                          editDraft.trim(),
                                        );
                                      }
                                      setEditingField(null);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                                  >
                                    保存
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingField(null)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                                  >
                                    取消
                                  </button>
                                </div>
                              ) : (
                                <div className="mt-1.5 text-sm font-medium text-slate-900 break-words">
                                  {displayValue}
                                </div>
                              )}
                              {/* 已订正时显示原始值 */}
                              {corrected && !isEditing && correction && (
                                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                                  <span className="line-through">
                                    {correction.originalValue}
                                  </span>
                                  <span>·</span>
                                  <span>
                                    {new Date(
                                      correction.correctedAt,
                                    ).toLocaleString("zh-CN")}
                                  </span>
                                  <span>·</span>
                                  <span>{correction.correctedBy}</span>
                                </div>
                              )}
                            </div>
                            {!isEditing && (
                              <div className="flex items-center gap-2 shrink-0 pt-3">
                                {anchor && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onJumpTo(
                                        {
                                          ossUrl: selectedDocument.ossUrl,
                                          ossKey: selectedDocument.ossKey,
                                          fileType: selectedDocument.fileType,
                                          fileName: selectedDocument.fileName,
                                        },
                                        anchor,
                                      )
                                    }
                                    className="px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-50"
                                  >
                                    定位
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const editKey = `${selectedDocument.documentId}.${field.key}`;
                                    setEditingField(editKey);
                                    setEditDraft(displayValue);
                                  }}
                                  disabled={isCaseClosed}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                                    isCaseClosed
                                      ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                                      : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                                  }`}
                                  title={
                                    isCaseClosed
                                      ? "案件已结案，不可修改"
                                      : "修改此字段"
                                  }
                                >
                                  修改
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-5 py-12 text-sm text-slate-400 text-center">
                      暂无结构化字段
                    </div>
                  )}
                </div>
              )}

              {/* Tab: AI 识别 */}
              {contentTab === "ai" && (
                <div className="px-5 py-5">
                  {aiResultLoading && !selectedAiResult ? (
                    <div className="py-12 text-sm text-slate-400 text-center">
                      AI 日志查询中...
                    </div>
                  ) : selectedAiResult ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            selectedAiResult.source === "structured"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {selectedAiResult.source === "structured"
                            ? "已结构化入库"
                            : "日志识别结果（未回填）"}
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                          {selectedAiResult.materialType}
                        </span>
                        {selectedAiResult.confidence !== undefined && (
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${confidenceTone(
                              selectedAiResult.confidence,
                            )}`}
                          >
                            AI {Math.round(selectedAiResult.confidence * 100)}%
                          </span>
                        )}
                        {selectedAiResult.logCount ? (
                          <span className="text-xs text-slate-400">
                            共 {selectedAiResult.logCount} 次识别
                          </span>
                        ) : null}
                      </div>

                      {selectedAiResult.summaryText ? (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                          <p className="text-xs font-semibold text-slate-500">
                            识别摘要
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-800">
                            {selectedAiResult.summaryText}
                          </p>
                        </div>
                      ) : null}

                      {selectedAiResult.keyFields.length > 0 ? (
                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                          <div className="px-4 py-2.5 bg-slate-50 text-xs font-semibold text-slate-500">
                            关键字段
                          </div>
                          <div className="divide-y divide-slate-100">
                            {selectedAiResult.keyFields.map((field) => (
                              <div
                                key={`${field.label}:${field.value}`}
                                className="px-4 py-3"
                              >
                                <div className="text-xs font-medium text-slate-400">
                                  {field.label}
                                </div>
                                <div className="mt-1 text-sm text-slate-900 whitespace-pre-wrap break-words">
                                  {field.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-2.5 bg-slate-50 text-xs font-semibold text-slate-500">
                          异常与风险提示
                        </div>
                        {selectedAiResult.anomalies.length > 0 ||
                        selectedAiResult.unknownReason ? (
                          <div className="px-4 py-3 space-y-2">
                            {selectedAiResult.anomalies.map((item, index) => (
                              <div
                                key={`${item}-${index}`}
                                className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800"
                              >
                                {item}
                              </div>
                            ))}
                            {selectedAiResult.unknownReason ? (
                              <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800">
                                当前无匹配材料模板：
                                {selectedAiResult.unknownReason}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="px-4 py-3 text-sm text-slate-400">
                            未发现异常
                          </div>
                        )}
                      </div>

                      {selectedAiResult.rawOutput ? (
                        <details className="rounded-xl border border-slate-200 overflow-hidden">
                          <summary className="px-4 py-2.5 bg-slate-50 text-xs font-semibold text-slate-500 cursor-pointer">
                            原始 AI 输出
                          </summary>
                          <pre className="px-4 py-3 text-xs leading-6 text-slate-700 whitespace-pre-wrap overflow-x-auto">
                            {selectedAiResult.rawOutput}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  ) : (
                    <div className="py-12 text-sm text-slate-400 text-center">
                      暂无 AI 识别结果
                    </div>
                  )}
                </div>
              )}

              {/* Tab: 校验 */}
              {contentTab === "validation" && (
                <div className="px-5 py-5 space-y-4">
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 text-xs font-semibold text-slate-500">
                      交叉校验
                    </div>
                    <div className="divide-y divide-slate-100">
                      {[
                        {
                          label: "分类结果",
                          value: selectedDocument.classification.materialName,
                        },
                        {
                          label: "分类置信度",
                          value: `${Math.round(selectedDocument.classification.confidence * 100)}%`,
                        },
                        {
                          label: "重复文件提醒",
                          value: selectedDocument.duplicateWarning
                            ? `${selectedDocument.duplicateWarning.message} (${Math.round(selectedDocument.duplicateWarning.similarity * 100)}%)`
                            : "未发现",
                        },
                        {
                          label: "识别异常",
                          value:
                            selectedDocument.classification.errorMessage ||
                            "无",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="px-4 py-3 flex items-start justify-between gap-4"
                        >
                          <span className="text-sm text-slate-500">
                            {item.label}
                          </span>
                          <span className="text-sm text-slate-900 text-right">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {selectedDocument.duplicateWarning && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                      检测到疑似重复材料，建议重点核对文件内容与上传时间。
                    </div>
                  )}
                  {selectedDocument.status === "failed" && (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800">
                      当前材料解析失败，需结合右侧原文进行人工核实。
                    </div>
                  )}
                </div>
              )}

              {/* Tab: 原文 */}
              {contentTab === "raw" && (
                <div className="px-5 py-5">
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">
                        OCR 识别原文
                      </span>
                      <span className="text-xs text-slate-400">
                        按当前结构化结果生成
                      </span>
                    </div>
                    <pre className="px-4 py-4 text-xs leading-6 text-slate-700 whitespace-pre-wrap bg-white overflow-x-auto max-h-[60vh]">
                      {rawText}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            暂无材料
          </div>
        )}
      </section>

      <section className="w-[420px] shrink-0 bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-200">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
            Preview
          </p>
          <h3 className="mt-2 text-lg font-bold text-slate-900">
            原始材料预览
          </h3>
        </div>
        <div className="h-[calc(100%-88px)]">{previewContent}</div>
      </section>
    </div>
  );
}

export function ManualProcessingPanel({
  tasks,
  selectedTask,
  onSelectTask,
  manualInputText,
  onManualInputTextChange,
  manualReviewNotes,
  onManualReviewNotesChange,
  onSaveTask,
  onClearSelection,
  processingTask,
}: ManualProcessingPanelProps) {
  const pendingTasks = tasks.filter((task) => task.status !== "已完成");
  const completedTasks = tasks.filter((task) => task.status === "已完成");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6">
      <aside className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-white">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
            Worklist
          </p>
          <h2 className="mt-2 text-lg font-bold text-slate-900">人工处理</h2>
          <p className="mt-1 text-xs text-slate-500">
            共 {tasks.length} 个工单
          </p>
        </div>
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
          {[
            { title: "待处理", items: pendingTasks, accent: "text-rose-600" },
            {
              title: "已完成",
              items: completedTasks,
              accent: "text-slate-500",
            },
          ].map((group) => (
            <div
              key={group.title}
              className="border-b border-slate-200 last:border-b-0"
            >
              <div
                className={`px-5 pt-4 pb-2 text-[11px] font-semibold tracking-[0.2em] ${group.accent}`}
              >
                {group.title} ({group.items.length})
              </div>
              {group.items.length > 0 ? (
                group.items.map((task) => {
                  const active = selectedTask?.id === task.id;
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onSelectTask(task)}
                      className={`w-full text-left px-5 py-4 border-l-4 transition-colors ${
                        active
                          ? "bg-white border-l-blue-600"
                          : "border-l-transparent hover:bg-white/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-400">
                              {task.reportNumber}
                            </span>
                            <span className="text-xs font-semibold text-slate-700">
                              {task.priority}优先级
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-900 truncate">
                            {task.materialName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                            {task.aiErrorMessage || "AI 识别结果需要人工确认"}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${taskTypeTone(
                            task,
                          )}`}
                        >
                          {taskTypeLabel(task)}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-5 pb-4 text-sm text-slate-400">暂无工单</div>
              )}
            </div>
          ))}
        </div>
      </aside>

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden min-h-[680px]">
        {selectedTask ? (
          <div className="h-full overflow-y-auto">
            <div className="px-6 py-5 border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc,white_55%,#eff6ff)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-slate-900">
                      {selectedTask.materialName}
                    </h3>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${taskTypeTone(
                        selectedTask,
                      )}`}
                    >
                      {taskTypeLabel(selectedTask)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    工单 {selectedTask.id} · 创建于{" "}
                    {formatDateTime(selectedTask.createdAt)}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 min-w-[360px]">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 border border-slate-200">
                    <p className="text-xs text-slate-500">AI置信度</p>
                    <p className="mt-1 text-base font-bold text-slate-900">
                      {Math.round(selectedTask.aiConfidence * 100)}%
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 border border-slate-200">
                    <p className="text-xs text-slate-500">系统阈值</p>
                    <p className="mt-1 text-base font-bold text-slate-900">
                      {Math.round(selectedTask.threshold * 100)}%
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 border border-slate-200">
                    <p className="text-xs text-slate-500">处理状态</p>
                    <p className="mt-1 text-base font-bold text-slate-900">
                      {selectedTask.status}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 xl:grid-cols-[260px,1fr] gap-5">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    关联材料
                  </p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-slate-500">案件号</span>
                      <span className="text-right text-slate-900">
                        {selectedTask.reportNumber}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-slate-500">材料 ID</span>
                      <span className="text-right text-slate-900">
                        {selectedTask.materialId}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-slate-500">创建人</span>
                      <span className="text-right text-slate-900">
                        {selectedTask.createdBy}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-slate-500">当前处理人</span>
                      <span className="text-right text-slate-900">
                        {selectedTask.reviewerName || "待认领"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    处理说明
                  </p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                      当前界面沿用现有工单保存逻辑，仅迁移为附件中的人工处理布局。
                    </div>
                    {selectedTask.aiErrorMessage && (
                      <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800">
                        AI 返回异常：{selectedTask.aiErrorMessage}
                      </div>
                    )}
                    {!selectedTask.aiErrorMessage && (
                      <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700">
                        当前工单主要因 AI
                        识别置信度低于阈值，需要人工补录或确认识别结果。
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedTask.aiExtractedData && (
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <span className="text-sm font-semibold text-slate-900">
                      AI 识别结果
                    </span>
                  </div>
                  <pre className="px-4 py-4 text-xs leading-6 text-slate-700 whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(selectedTask.aiExtractedData, null, 2)}
                  </pre>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <span className="text-sm font-semibold text-slate-900">
                    人工处理
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      修正后的数据（JSON）
                    </label>
                    <textarea
                      value={manualInputText}
                      onChange={(event) =>
                        onManualInputTextChange(event.target.value)
                      }
                      className="w-full h-56 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      处理备注
                    </label>
                    <textarea
                      value={manualReviewNotes}
                      onChange={(event) =>
                        onManualReviewNotesChange(event.target.value)
                      }
                      className="w-full h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="记录人工核查结论、修正原因和特殊说明..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={onSaveTask}
                  disabled={processingTask}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {processingTask ? "保存中..." : "完成处理"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-2xl">
              ▣
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              选择一个工单开始处理
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              左侧列表已切换为附件中的人工处理结构，保存仍使用现有工单接口。
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export function StageDecisionPanel({
  mode,
  claim,
  reviewResult,
  reviewSummary,
  stageViews,
  groupedManualReviewReasons,
  coverageResults,
  damageReport,
  canSubmit,
  submitting,
  note,
  onNoteChange,
  onSubmit,
}: StageDecisionPanelProps) {
  const liabilityStage = findStageView(stageViews, "liability");
  const assessmentStage = findStageView(stageViews, "fact_assessment");
  const damageReportItems = Array.isArray(damageReport?.items)
    ? (damageReport.items as Array<Record<string, unknown>>)
    : [];
  const totalClaimed =
    coverageResults.reduce(
      (sum, item) => sum + Number(item.claimedAmount || 0),
      0,
    ) || Number((damageReport?.subTotal as number) || claim.claimAmount || 0);
  const totalApproved =
    coverageResults.reduce(
      (sum, item) => sum + Number(item.approvedAmount || 0),
      0,
    ) ||
    Number(
      (damageReport?.finalAmount as number) ||
        reviewResult?.amount ||
        claim.approvedAmount ||
        0,
    );
  const totalReduced = Math.max(totalClaimed - totalApproved, 0);

  if (mode === "liability") {
    const liabilityCards = [
      {
        label: "责任判断",
        value: reviewResult?.eligibility?.eligible ? "符合责任" : "待人工确认",
        note: liabilityStage?.summary || "解析完成后进入定责",
      },
      {
        label: "审核建议",
        value: reviewSummary?.label || "待处理",
        note: reviewResult?.liabilityDecision || "无自动结论",
      },
      {
        label: "规则命中",
        value: `${reviewResult?.eligibility?.matchedRules?.length || 0} 条`,
        note: "用于支撑当前定责结论",
      },
      {
        label: "阶段状态",
        value: liabilityStage?.summary || "待处理",
        note: `${liabilityStage?.methodLabel || "待处理"} · ${liabilityStage?.displayTime || "待处理"}`,
      },
    ];

    return (
      <div className="grid grid-cols-1 xl:grid-cols-[280px,1fr] gap-5">
        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
            Eligibility
          </p>
          <h3 className="mt-2 text-lg font-bold text-slate-900">定责</h3>
          <div className="mt-5 space-y-3">
            {liabilityCards.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl bg-white border border-slate-200 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-500">{item.label}</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {item.value}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400 leading-5">
                  {item.note}
                </p>
              </div>
            ))}
          </div>
        </aside>

        <section className="space-y-5">
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
              <span className="text-sm font-semibold text-slate-900">
                定责摘要
              </span>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-2xl bg-blue-50 border border-blue-200 px-4 py-3">
                <div className="text-sm font-semibold text-blue-900">
                  {reviewResult?.eligibility?.eligible
                    ? "ELIGIBILITY 通过"
                    : "等待人工确认"}
                </div>
                <div className="mt-1 text-sm text-blue-800">
                  {reviewResult?.reasoning ||
                    "当前暂无自动定责摘要，可补充人工处理说明。"}
                </div>
              </div>
              {reviewResult?.eligibility?.matchedRules &&
                reviewResult.eligibility.matchedRules.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-900 mb-3">
                      规则命中
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {reviewResult.eligibility.matchedRules.map((rule) => (
                        <span
                          key={rule}
                          className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium"
                        >
                          {rule}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              {groupedManualReviewReasons.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-900 mb-3">
                    人工复核原因
                  </p>
                  <div className="space-y-3">
                    {groupedManualReviewReasons.map((group) => (
                      <div
                        key={group.stage}
                        className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                      >
                        <p className="text-sm font-semibold text-amber-800">
                          {group.label}
                        </p>
                        <div className="mt-2 space-y-2">
                          {group.reasons.map((reason) => (
                            <div
                              key={`${group.stage}-${reason.code}`}
                              className="rounded-xl bg-white/80 px-3 py-2 text-sm text-amber-900"
                            >
                              {reason.message}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
              <span className="text-sm font-semibold text-slate-900">
                人工处理备注
              </span>
            </div>
            <div className="p-5">
              <textarea
                value={note}
                onChange={(event) => onNoteChange(event.target.value)}
                className="w-full h-32 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="填写责任认定依据、人工核查说明、例外情况等..."
              />
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!canSubmit || submitting}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {submitting ? "登记中..." : "人工完成定责"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-xs text-slate-500">申请金额</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            ¥{formatCurrency(totalClaimed)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-xs text-slate-500">认定金额</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            ¥{formatCurrency(totalApproved)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-xs text-slate-500">扣减金额</p>
          <p className="mt-2 text-2xl font-bold text-rose-700">
            ¥{formatCurrency(totalReduced)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-xs text-slate-500">阶段状态</p>
          <p className="mt-2 text-base font-bold text-slate-900">
            {assessmentStage?.summary || "待处理"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {assessmentStage?.methodLabel || "待处理"} ·{" "}
            {assessmentStage?.displayTime || "待处理"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">定损明细</span>
          <span className="text-xs text-slate-400">
            参考附件右侧定责定损布局
          </span>
        </div>
        {coverageResults.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {coverageResults.map((item, index) => (
              <div key={`${item.coverageCode}-${index}`} className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.coverageCode}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      状态：{item.status || "待确认"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">认定金额</p>
                    <p className="text-lg font-bold text-emerald-700">
                      ¥{formatCurrency(item.approvedAmount || 0)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-slate-500">
                  <div>
                    申请金额：¥{formatCurrency(item.claimedAmount || 0)}
                  </div>
                  <div>
                    赔付比例：
                    {((item.reimbursementRatio || 0) * 100).toFixed(0)}%
                  </div>
                  <div>
                    保额上限：
                    {item.sumInsured != null
                      ? `¥${formatCurrency(item.sumInsured)}`
                      : "不限"}
                  </div>
                  <div>责任编码：{item.coverageCode}</div>
                </div>
              </div>
            ))}
          </div>
        ) : damageReportItems.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {damageReportItems.map((item, index) => (
              <div
                key={`${item.id || index}`}
                className="px-5 py-4 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {String(item.itemName || `项目 ${index + 1}`)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {String(item.basis || "按已有报告结果展示")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">核定金额</p>
                  <p className="text-lg font-bold text-emerald-700">
                    ¥{formatCurrency(Number(item.approvedAmount || 0))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-sm text-slate-400">
            当前没有票据级逐项定损明细，保留汇总视图展示，不新增业务假数据。
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
          <span className="text-sm font-semibold text-slate-900">
            人工处理备注
          </span>
        </div>
        <div className="p-5">
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            className="w-full h-32 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="填写定损依据、金额确认说明、扣减原因等..."
          />
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit || submitting}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? "登记中..." : "人工完成定损"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ 校验失败操作面板（介入点2） ============

interface ValidationFailurePanelProps {
  intervention: InterventionInstance;
  onOverride: (reason: string) => void;
  onRequestReupload: (materialIds: string[]) => void;
}

export function ValidationFailurePanel({
  intervention,
  onOverride,
  onRequestReupload,
}: ValidationFailurePanelProps) {
  const [overrideReason, setOverrideReason] = useState("");
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"initial" | "override" | "reupload">(
    "initial",
  );

  const reason = intervention.reason;

  return (
    <div className="bg-white border border-purple-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-purple-500" />
        <h3 className="text-sm font-bold text-purple-900">校验规则不通过</h3>
      </div>

      {/* 规则信息 */}
      <div className="bg-purple-50 rounded-lg p-4 space-y-2">
        <div className="text-sm text-purple-800 font-medium">
          规则: {reason?.sourceRuleName || reason?.sourceRuleId || "未知"}
        </div>
        <div className="text-sm text-purple-700">
          {reason?.detail || reason?.summary}
        </div>
        {/* 字段对比 */}
        {(reason?.leftValue || reason?.rightValue) && (
          <div className="flex items-center gap-4 mt-2 text-xs">
            <div className="flex-1 bg-white rounded px-3 py-2 border border-purple-100">
              <span className="text-gray-500">左字段值: </span>
              <span className="font-medium text-gray-900">
                {reason.leftValue || "N/A"}
              </span>
            </div>
            <span className="text-purple-400 font-bold">≠</span>
            <div className="flex-1 bg-white rounded px-3 py-2 border border-purple-100">
              <span className="text-gray-500">右字段值: </span>
              <span className="font-medium text-gray-900">
                {reason.rightValue || "N/A"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 操作选择 */}
      {mode === "initial" && (
        <div className="flex gap-3">
          <button
            onClick={() => setMode("override")}
            className="flex-1 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100"
          >
            放行（人工判断通过）
          </button>
          <button
            onClick={() => setMode("reupload")}
            className="flex-1 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100"
          >
            下发重新上传
          </button>
        </div>
      )}

      {/* 放行表单 */}
      {mode === "override" && (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-700">
            放行理由（必填）
          </label>
          <textarea
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="请说明放行理由，例如：经核实，两处姓名因简繁体差异造成不一致，实为同一人..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none h-20 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setMode("initial")}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
            >
              取消
            </button>
            <button
              onClick={() => onOverride(overrideReason)}
              disabled={!overrideReason.trim()}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              确认放行
            </button>
          </div>
        </div>
      )}

      {/* 重传表单 */}
      {mode === "reupload" && (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-700">
            选择需要重新上传的材料
          </label>
          {(intervention.validationRuleIds || []).map((ruleId) => (
            <label key={ruleId} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedMaterialIds.includes(ruleId)}
                onChange={(e) =>
                  setSelectedMaterialIds((prev) =>
                    e.target.checked
                      ? [...prev, ruleId]
                      : prev.filter((id) => id !== ruleId),
                  )
                }
                className="rounded border-gray-300"
              />
              {ruleId}
            </label>
          ))}
          <div className="flex gap-2">
            <button
              onClick={() => setMode("initial")}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
            >
              取消
            </button>
            <button
              onClick={() => onRequestReupload(selectedMaterialIds)}
              disabled={selectedMaterialIds.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              下发重传通知
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
