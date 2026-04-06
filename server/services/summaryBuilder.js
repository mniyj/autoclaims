/**
 * 从材料管线的 extractedData 构造与 caseAggregator 兼容的 summary 对象，
 * 替代 summaryExtractors 的独立 AI 调用。
 *
 * extractedData 字段名（snake_case，来自 schemaFields）→ 聚合函数期望的字段名（camelCase）。
 */

import { MATERIAL_TO_SUMMARY_TYPE } from "./summaryExtractors/index.js";

// 按 summaryType 定义 extractedData → summary 的字段映射
// 键 = summary 期望的字段名，值 = extractedData 中可能的字段名（按优先级）
const FIELD_MAPPINGS = {
  accident_liability: {
    accidentDate: ["accident_date", "accidentDate"],
    accidentLocation: ["accident_location", "accidentLocation"],
    parties: ["parties"],
    liabilityBasis: ["liability_basis", "liabilityBasis"],
    documentNumber: ["document_number", "documentNumber"],
  },
  inpatient_record: {
    admissionDate: ["admission_date", "admissionDate"],
    dischargeDate: ["discharge_date", "dischargeDate"],
    hospitalizationDays: [
      "hospitalization_days",
      "hospital_days",
      "hospitalizationDays",
    ],
    diagnoses: ["diagnoses"],
    surgeries: ["surgeries"],
    dischargeCondition: ["discharge_condition", "dischargeCondition"],
    attendingDoctor: ["attending_doctor", "doctor_name", "attendingDoctor"],
    ward: ["ward", "department"],
    pastHistory: ["past_history", "pastHistory"],
    firstDiagnosisDate: ["first_diagnosis_date", "firstDiagnosisDate"],
  },
  diagnosis_proof: {
    diagnoses: ["diagnoses"],
    issueDate: ["issue_date", "issueDate"],
    issuingDoctor: ["doctor_name", "issuing_doctor", "issuingDoctor"],
    institution: ["hospital_name", "institution"],
    restDays: ["rest_days", "restDays"],
  },
  expense_invoice: {
    invoiceNumber: [
      "invoiceInfo.invoiceNumber",
      "invoice_number",
      "invoiceNumber",
    ],
    invoiceDate: [
      "invoiceInfo.issueDate",
      "invoice_date",
      "invoiceDate",
    ],
    totalAmount: ["totalAmount", "total_amount"],
    institution: [
      "invoiceInfo.hospitalName",
      "hospital_name",
      "institution",
    ],
    breakdown: ["chargeItems", "breakdown", "items"],
  },
  disability_assessment: {
    disabilityLevel: [
      "disability_grade",
      "disability_level",
      "disabilityLevel",
    ],
    disabilityBasis: ["disability_basis", "disabilityBasis"],
    assessmentDate: ["appraisal_date", "assessment_date", "assessmentDate"],
    assessmentInstitution: [
      "appraisal_institution",
      "assessment_institution",
      "assessmentInstitution",
    ],
    nursingDependencyLevel: [
      "nursing_dependency_level",
      "nursingDependencyLevel",
    ],
  },
  income_lost: {
    monthlyIncome: ["monthly_income", "monthlyIncome"],
    incomeType: ["income_type", "incomeType"],
    lostWorkDays: ["lost_work_days", "lostWorkDays"],
    employer: ["employer_name", "employer"],
  },
  death_record: {
    deceasedName: ["deceased_name", "deceasedName"],
    deathDate: ["death_date", "deathDate"],
    cancellationDate: ["cancellation_date", "cancellationDate"],
    deathCause: ["death_cause", "deathCause"],
    deathLocation: ["death_location", "deathLocation"],
    issuingAuthority: ["issuing_authority", "issuingAuthority"],
  },
  household_proof: {
    residentName: ["resident_name", "residentName"],
    householdType: ["household_type", "householdType"],
    householdAddress: ["household_address", "householdAddress"],
    issuingAuthority: ["issuing_authority", "issuingAuthority"],
    issueDate: ["issue_date", "issueDate"],
  },
  claimant_relationship: {
    deceasedName: ["deceased_name", "deceasedName"],
    claimantName: ["claimant_name", "claimantName"],
    relationship: ["relationship"],
    issuingAuthority: ["issuing_authority", "issuingAuthority"],
    issueDate: ["issue_date", "issueDate"],
  },
  dependent_support: {
    supporterName: ["supporter_name", "supporterName"],
    dependentName: ["dependent_name", "dependentName"],
    relationship: ["relationship"],
    otherSupportersCount: ["other_supporters_count", "otherSupportersCount"],
    issuingAuthority: ["issuing_authority", "issuingAuthority"],
    issueDate: ["issue_date", "issueDate"],
  },
  funeral_expense: {
    totalAmount: ["totalAmount", "total_amount"],
    invoiceNumber: ["invoice_number", "invoiceNumber"],
    invoiceDate: ["invoice_date", "invoiceDate"],
    institution: ["institution"],
  },
  case_report: {
    reportType: ["report_type", "reportType"],
    victimName: ["victim_name", "victimName"],
    accidentDate: ["accident_date", "accidentDate"],
    accidentLocation: ["accident_location", "accidentLocation"],
    incidentSummary: ["incident_summary", "incidentSummary"],
    deathConfirmed: ["death_confirmed", "deathConfirmed"],
    deathDate: ["death_date", "deathDate"],
    identityChainSummary: [
      "identity_chain_summary",
      "identityChainSummary",
    ],
    liabilityOpinion: ["liability_opinion", "liabilityOpinion"],
    compensationPaid: ["compensation_paid", "compensationPaid"],
    claimants: ["claimants"],
  },
};

function getNestedValue(source, path) {
  if (!source || !path) return undefined;
  return String(path)
    .split(".")
    .reduce(
      (current, segment) =>
        current && typeof current === "object" ? current[segment] : undefined,
      source,
    );
}

/**
 * 从 extractedData 中按优先级查找字段值
 */
function resolveField(data, candidateKeys) {
  for (const key of candidateKeys) {
    const value =
      key.includes(".") ? getNestedValue(data, key) : data[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

/**
 * 将 extractedData 的字段映射为聚合函数期望的 camelCase 字段名
 */
function mapFields(data, summaryType) {
  const mapping = FIELD_MAPPINGS[summaryType];
  if (!mapping) return { ...data };

  const result = {};
  for (const [targetKey, candidateKeys] of Object.entries(mapping)) {
    const value = resolveField(data, candidateKeys);
    if (value !== undefined) {
      result[targetKey] = value;
    }
  }

  // 保留 sourceAnchors（如果存在）
  if (data.sourceAnchors) {
    result.sourceAnchors = data.sourceAnchors;
  }

  return result;
}

/**
 * 从材料管线的 extractedData 构造与 summaryExtractors 兼容的 summary 对象
 *
 * @param {object} params
 * @param {string} params.docId - 文档 ID
 * @param {string} params.materialId - 材料模板 ID（如 "mat-8"）
 * @param {object} params.extractedData - 材料管线提取的数据
 * @param {number} [params.confidence] - 置信度
 * @returns {object|null} 兼容的 summary 对象，或 null（无映射的材料类型）
 */
export function buildSummaryFromExtraction({
  docId,
  materialId,
  extractedData,
  confidence,
}) {
  const summaryType = MATERIAL_TO_SUMMARY_TYPE[materialId];
  if (!summaryType || !extractedData) return null;

  const mappedFields = mapFields(extractedData, summaryType);

  return {
    docId,
    summaryType,
    extractedAt: new Date().toISOString(),
    confidence: confidence || 0.5,
    sourceAnchors: mappedFields.sourceAnchors || {},
    ...mappedFields,
  };
}

/**
 * 批量构造 summaries（替代 extractDocumentSummaries）
 *
 * @param {Array} documents - 文档列表，需有 documentId, classification.materialId, structuredData/extractedData, confidence
 * @returns {Array} summary 列表（含 null 项）
 */
export function buildSummariesFromDocuments(documents) {
  return documents.map((doc) =>
    buildSummaryFromExtraction({
      docId: doc.documentId,
      materialId: doc.classification?.materialId,
      extractedData: doc.structuredData || doc.extractedData || {},
      confidence: doc.confidence,
    }),
  );
}
