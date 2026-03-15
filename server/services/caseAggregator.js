/**
 * 案件级数据聚合服务
 *
 * 将多份文档摘要聚合为案件级的：
 * - 伤情概况（InjuryProfile）
 * - 费用汇总（ExpenseAggregation）
 * - 矛盾检测（ConflictItem[]）
 *
 * 定责（LiabilityResult）直接从 accident_liability 摘要提取，无需单独计算。
 */

import crypto from "crypto";
import { readData } from "../utils/fileStore.js";

function getNestedValue(source, path) {
  if (!source || !path) return undefined;
  const segments = String(path)
    .split(".")
    .flatMap((segment) => {
      if (segment.endsWith("[]")) {
        return [segment.slice(0, -2), "[]"];
      }
      return [segment];
    });

  let current = [source];
  for (const segment of segments) {
    if (segment === "[]") {
      current = current.flatMap((item) => (Array.isArray(item) ? item : []));
      continue;
    }
    current = current
      .map((item) => (item && typeof item === "object" ? item[segment] : undefined))
      .filter((item) => item !== undefined && item !== null);
  }

  if (current.length === 0) return undefined;
  return current.length === 1 ? current[0] : current;
}

function collectFactBindingsFromSchemaFields(fields = [], prefix = "") {
  const bindings = [];
  for (const field of fields || []) {
    const key = String(field?.field_key || "").trim();
    if (!key) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (field?.fact_id) {
      bindings.push({
        factId: field.fact_id,
        path,
      });
    }
    if (field?.data_type === "OBJECT") {
      bindings.push(...collectFactBindingsFromSchemaFields(field.children || [], path));
    }
    if (field?.data_type === "ARRAY") {
      bindings.push(...collectFactBindingsFromSchemaFields(field.item_fields || [], `${path}[]`));
    }
  }
  return bindings;
}

function hydrateSchemaFields(materialConfig = {}) {
  return ((materialConfig?.schemaFields || [])).map((field) => ({ ...field }));
}

function normalizeFactValue(value) {
  if (Array.isArray(value)) {
    const compact = value.filter((item) => item !== undefined && item !== null && item !== "");
    if (compact.length === 0) return undefined;
    return compact.length === 1 ? compact[0] : compact;
  }
  return value === "" ? undefined : value;
}

function extractCanonicalFactsFromDocuments(documents = []) {
  const materialConfigs = readData("claims-materials") || [];
  const canonicalFacts = {};
  const canonicalFactSources = {};

  for (const document of documents || []) {
    const materialId = document?.classification?.materialId || document?.materialId;
    if (!materialId) continue;
    const materialConfig = materialConfigs.find((item) => item.id === materialId);
    if (!materialConfig) continue;

    const bindings = collectFactBindingsFromSchemaFields(hydrateSchemaFields(materialConfig));

    for (const binding of bindings) {
      const sources = [
        document?.structuredData,
        document?.ocrData,
        document?.documentSummary,
      ].filter(Boolean);
      for (const source of sources) {
        const value = normalizeFactValue(getNestedValue(source, binding.path));
        if (value === undefined) continue;
        if (canonicalFacts[binding.factId] === undefined) {
          canonicalFacts[binding.factId] = value;
          canonicalFactSources[binding.factId] = {
            documentId: document.documentId || null,
            materialId,
            path: binding.path,
          };
        }
        break;
      }
    }
  }

  return {
    canonicalFacts,
    canonicalFactSources,
  };
}

/**
 * 从多份摘要中聚合伤情概况
 *
 * @param {Array} summaries - 文档摘要列表
 * @returns {object|null} InjuryProfile
 */
function aggregateInjuryProfile(summaries) {
  const inpatientRecords = summaries.filter(
    (s) => s?.summaryType === "inpatient_record"
  );
  const disabilitySummaries = summaries.filter(
    (s) => s?.summaryType === "disability_assessment"
  );
  const diagnosisProofs = summaries.filter(
    (s) => s?.summaryType === "diagnosis_proof"
  );

  if (inpatientRecords.length === 0 && diagnosisProofs.length === 0) return null;

  // 合并所有诊断
  const allDiagnoses = [
    ...inpatientRecords.flatMap((s) => s.diagnoses || []),
    ...diagnosisProofs.flatMap((s) => s.diagnoses || []),
  ];
  // 去重（按诊断名称）
  const uniqueDiagnoses = [...new Map(allDiagnoses.map((d) => [d.name, d])).values()];
  const diagnosisNames = uniqueDiagnoses
    .map((item) => item?.name)
    .filter(Boolean);
  const diagnosisDateCandidates = diagnosisProofs
    .map((item) => item?.issueDate)
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)));
  const primaryDiagnosisDate = diagnosisDateCandidates[0] || null;

  // 总住院天数（多次住院累加）
  const hospitalizationDays = inpatientRecords.reduce(
    (sum, s) => sum + (s.hospitalizationDays || 0),
    0
  );

  // 伤残等级（取首个有效值）
  const disabilityLevel = disabilitySummaries.find(
    (s) => s.disabilityLevel
  )?.disabilityLevel;

  // 构建治疗时间线
  const timeline = [];
  for (const record of inpatientRecords) {
    if (record.admissionDate) {
      timeline.push({ date: record.admissionDate, event: `入院（${record.ward || ""}）`, sourceDocId: record.docId });
    }
    for (const surgery of record.surgeries || []) {
      if (surgery.date) {
        timeline.push({ date: surgery.date, event: `手术：${surgery.name}`, sourceDocId: record.docId });
      }
    }
    if (record.dischargeDate) {
      timeline.push({ date: record.dischargeDate, event: "出院", sourceDocId: record.docId });
    }
  }
  for (const assessment of disabilitySummaries) {
    if (assessment.assessmentDate) {
      timeline.push({
        date: assessment.assessmentDate,
        event: `伤残鉴定：${assessment.disabilityLevel || ""}`,
        sourceDocId: assessment.docId,
      });
    }
  }
  timeline.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  return {
    injuryDescription: uniqueDiagnoses.map((d) => d.name).join("；") || "待补充",
    diagnoses: uniqueDiagnoses,
    diagnosisNames,
    primaryDiagnosisDate,
    disabilityLevel: disabilityLevel || null,
    hospitalizationDays,
    treatmentTimeline: timeline,
  };
}

/**
 * 从费用发票摘要中聚合费用总额
 *
 * @param {Array} summaries
 * @param {Array} documents - 完整文档列表（用于溯源 docId）
 * @returns {object|null} ExpenseAggregation
 */
function aggregateExpenses(summaries) {
  const invoiceSummaries = summaries.filter(
    (s) => s?.summaryType === "expense_invoice"
  );
  const incomeLostSummaries = summaries.filter(
    (s) => s?.summaryType === "income_lost"
  );
  const inpatientRecords = summaries.filter(
    (s) => s?.summaryType === "inpatient_record"
  );

  const sourceDocIds = [
    ...invoiceSummaries.map((s) => s.docId),
    ...incomeLostSummaries.map((s) => s.docId),
    ...inpatientRecords.map((s) => s.docId),
  ].filter(Boolean);

  if (sourceDocIds.length === 0) return null;

  // 医疗费总额：所有发票金额求和
  const medicalTotal = invoiceSummaries.reduce(
    (sum, s) => sum + (s.totalAmount || 0),
    0
  );

  // 住院天数
  const hospitalizationDays = inpatientRecords.reduce(
    (sum, s) => sum + (s.hospitalizationDays || 0),
    0
  );

  // 护理天数（无专用字段，按住院天数估算）
  const nursingDays = hospitalizationDays;

  // 误工天数（取第一份有效的误工证明）
  const incomeLost = incomeLostSummaries.find((s) => s.lostWorkDays || s.monthlyIncome);
  const lostWorkDays = incomeLost?.lostWorkDays || 0;
  const monthlyIncome = incomeLost?.monthlyIncome || 0;

  // 交通费（单独的票据摘要，此处暂无专用提取器，设为 0 等待手动补充）
  const transportationTotal = 0;
  const assessmentFees = 0;

  return {
    medicalTotal: parseFloat(medicalTotal.toFixed(2)),
    nursingDays,
    lostWorkDays,
    monthlyIncome,
    transportationTotal,
    assessmentFees,
    sourceDocIds,
  };
}

/**
 * 从 accident_liability 摘要提取定责结果
 *
 * @param {Array} summaries
 * @returns {object|null} LiabilityResult
 */
function extractLiabilityResult(summaries) {
  const accidentSummary = summaries.find(
    (s) => s?.summaryType === "accident_liability" && s.parties?.length > 0
  );
  if (!accidentSummary) return null;

  // 找伤者/被保险人（通常角色包含"行人"、"乘客"、"非机动车"）
  const claimantRoles = ["行人", "乘客", "非机动车", "被保险人", "受害人"];
  const claimant = accidentSummary.parties.find((p) =>
    claimantRoles.some((r) => p.role?.includes(r))
  );

  if (!claimant) {
    // 无法自动识别，取责任比例最小的一方作为被保险人
    const sorted = [...accidentSummary.parties].sort((a, b) => a.liabilityPct - b.liabilityPct);
    const assumed = sorted[0];
    return {
      claimantLiabilityPct: assumed?.liabilityPct || 0,
      thirdPartyLiabilityPct: 100 - (assumed?.liabilityPct || 0),
      basis: accidentSummary.liabilityBasis || "",
      sourceDocId: accidentSummary.docId,
    };
  }

  return {
    claimantLiabilityPct: claimant.liabilityPct,
    thirdPartyLiabilityPct: 100 - claimant.liabilityPct,
    basis: accidentSummary.liabilityBasis || "",
    sourceDocId: accidentSummary.docId,
  };
}

/**
 * 跨文档矛盾检测
 * 检查：日期一致性、身份一致性、金额一致性
 *
 * @param {Array} summaries
 * @returns {Array} ConflictItem[]
 */
function detectConflicts(summaries) {
  const conflicts = [];

  // 1. 出院日期 vs 门诊开票日期冲突
  const inpatientRecords = summaries.filter((s) => s?.summaryType === "inpatient_record");
  const invoices = summaries.filter((s) => s?.summaryType === "expense_invoice");

  for (const record of inpatientRecords) {
    if (!record.dischargeDate) continue;
    const dischargeTs = new Date(record.dischargeDate).getTime();

    for (const invoice of invoices) {
      if (!invoice.invoiceDate) continue;
      const invoiceTs = new Date(invoice.invoiceDate).getTime();
      // 发票日期早于入院日期（异常）
      if (invoice.invoiceDate < (record.admissionDate || "9999")) {
        conflicts.push({
          type: "date_mismatch",
          description: `发票开具日期（${invoice.invoiceDate}）早于入院日期（${record.admissionDate}）`,
          docIds: [record.docId, invoice.docId],
          severity: "warning",
        });
      }
    }
  }

  // 2. 多份发票金额 vs 费用清单总额是否合理
  // 若有多张发票，检查是否存在同一张单据重复上传（金额相同、日期相同）
  for (let i = 0; i < invoices.length; i++) {
    for (let j = i + 1; j < invoices.length; j++) {
      const a = invoices[i];
      const b = invoices[j];
      if (
        a.totalAmount &&
        b.totalAmount &&
        Math.abs(a.totalAmount - b.totalAmount) < 1 &&
        a.invoiceDate === b.invoiceDate &&
        a.institution === b.institution
      ) {
        conflicts.push({
          type: "amount_mismatch",
          description: `两份发票金额（¥${a.totalAmount}）、日期（${a.invoiceDate}）和机构（${a.institution}）完全一致，可能是重复上传`,
          docIds: [a.docId, b.docId],
          severity: "warning",
        });
      }
    }
  }

  // 3. 入院日期与认定书事故日期的逻辑关系
  const accidentSummary = summaries.find((s) => s?.summaryType === "accident_liability");
  if (accidentSummary?.accidentDate) {
    for (const record of inpatientRecords) {
      if (!record.admissionDate) continue;
      if (record.admissionDate < accidentSummary.accidentDate) {
        conflicts.push({
          type: "date_mismatch",
          description: `入院日期（${record.admissionDate}）早于事故发生日期（${accidentSummary.accidentDate}），请核实`,
          docIds: [record.docId, accidentSummary.docId],
          severity: "error",
        });
      }
    }
  }

  return conflicts;
}

function aggregateDeathProfile(summaries) {
  const deathSummaries = summaries.filter((s) => s?.summaryType === "death_record");
  const funeralSummaries = summaries.filter((s) => s?.summaryType === "funeral_expense");
  const householdProof = summaries.find((s) => s?.summaryType === "household_proof");
  const relationshipSummaries = summaries.filter((s) => s?.summaryType === "claimant_relationship");
  const dependentSummaries = summaries.filter((s) => s?.summaryType === "dependent_support");

  if (
    deathSummaries.length === 0 &&
    funeralSummaries.length === 0 &&
    !householdProof &&
    relationshipSummaries.length === 0 &&
    dependentSummaries.length === 0
  ) {
    return null;
  }

  const primaryDeath = deathSummaries.find((s) => s.deathDate || s.deathCause) || deathSummaries[0] || null;
  const funeralExpenseTotal = funeralSummaries.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  const claimants = relationshipSummaries.map((item) => ({
    name: item.claimantName,
    relationship: item.relationship,
    sourceDocId: item.docId,
  })).filter((item) => item.name || item.relationship);
  const dependents = dependentSummaries.map((item) => ({
    supporterName: item.supporterName,
    dependentName: item.dependentName,
    relationship: item.relationship,
    otherSupportersCount: item.otherSupportersCount || 0,
    sourceDocId: item.docId,
  })).filter((item) => item.dependentName || item.relationship);

  return {
    deathConfirmed: deathSummaries.length > 0,
    deceasedName: primaryDeath?.deceasedName || householdProof?.residentName || null,
    deathDate: primaryDeath?.deathDate || null,
    deathCause: primaryDeath?.deathCause || null,
    deathLocation: primaryDeath?.deathLocation || null,
    cancellationDate: deathSummaries.find((s) => s.cancellationDate)?.cancellationDate || null,
    householdType: householdProof?.householdType || null,
    householdAddress: householdProof?.householdAddress || null,
    funeralExpenseTotal: parseFloat(funeralExpenseTotal.toFixed(2)),
    claimants,
    dependents,
    sourceDocIds: [
      ...deathSummaries.map((item) => item.docId),
      ...funeralSummaries.map((item) => item.docId),
      ...(householdProof ? [householdProof.docId] : []),
      ...relationshipSummaries.map((item) => item.docId),
      ...dependentSummaries.map((item) => item.docId),
    ].filter(Boolean),
  };
}

function aggregateCaseReports(summaries) {
  return summaries
    .filter((s) => s?.summaryType === "case_report")
    .map((item) => ({
      reportType: item.reportType || "other",
      victimName: item.victimName || null,
      accidentDate: item.accidentDate || null,
      accidentLocation: item.accidentLocation || null,
      incidentSummary: item.incidentSummary || null,
      deathConfirmed: item.deathConfirmed === true,
      deathDate: item.deathDate || null,
      identityChainSummary: item.identityChainSummary || item.employmentRelationship || null,
      liabilityOpinion: item.liabilityOpinion || null,
      compensationPaid: typeof item.compensationPaid === "number" ? item.compensationPaid : null,
      claimants: Array.isArray(item.claimants) ? item.claimants : [],
      sourceDocId: item.docId,
    }));
}

function buildFactModel({ injuryProfile, liabilityResult, expenseAggregation, deathProfile, caseReports, conflictsDetected, validationFacts = {}, validationResults = [], documents = [] }) {
  const { canonicalFacts, canonicalFactSources } = extractCanonicalFactsFromDocuments(documents);
  return {
    generatedAt: new Date().toISOString(),
    injuryProfile,
    liabilityResult,
    expenseAggregation,
    deathProfile,
    caseReports,
    conflictsDetected,
    validationFacts,
    validationResults,
    canonicalFacts,
    canonicalFactSources,
  };
}

function buildLiabilitySuggestion(liabilityResult, conflictsDetected = []) {
  if (!liabilityResult) {
    return {
      status: "MANUAL_REVIEW",
      conclusion: "缺少责任认定依据，需人工确认",
      confidence: 0.3,
      basis: [],
    };
  }

  const hasHardConflict = conflictsDetected.some((item) => item.severity === "error");
  return {
    status: hasHardConflict ? "MANUAL_REVIEW" : "REFERENCE_READY",
    conclusion: `建议按第三方责任 ${liabilityResult.thirdPartyLiabilityPct}% 作为定损折算比例`,
    confidence: hasHardConflict ? 0.55 : 0.85,
    basis: [
      {
        type: "accident_liability",
        sourceDocId: liabilityResult.sourceDocId,
        text: liabilityResult.basis || "事故责任认定书责任划分",
      },
    ],
  };
}

/**
 * 综合聚合：将所有文档摘要聚合为案件级数据
 *
 * @param {object} params
 * @param {Array} params.summaries - 文档摘要列表（含 null 项）
 * @param {string} params.claimCaseId
 * @returns {object} 聚合结果 { injuryProfile, liabilityResult, expenseAggregation, conflictsDetected }
 */
export function aggregateCase({ summaries, claimCaseId, validationFacts = {}, validationResults = [], documents = [] }) {
  const validSummaries = (summaries || []).filter(Boolean);

  const injuryProfile = aggregateInjuryProfile(validSummaries);
  const liabilityResult = extractLiabilityResult(validSummaries);
  const expenseAggregation = aggregateExpenses(validSummaries);
  const conflictsDetected = detectConflicts(validSummaries);
  const deathProfile = aggregateDeathProfile(validSummaries);
  const caseReports = aggregateCaseReports(validSummaries);
  const factModel = buildFactModel({
    injuryProfile,
    liabilityResult,
    expenseAggregation,
    deathProfile,
    caseReports,
    conflictsDetected,
    validationFacts,
    validationResults,
    documents,
  });
  const liabilitySuggestion = buildLiabilitySuggestion(liabilityResult, conflictsDetected);

  return {
    claimCaseId,
    aggregatedAt: new Date().toISOString(),
    injuryProfile,
    liabilityResult,
    expenseAggregation,
    deathProfile,
    caseReports,
    conflictsDetected,
    validationFacts,
    validationResults,
    factModel,
    liabilitySuggestion,
    /** 用于前端展示的聚合摘要文本 */
    aggregationSummary: buildAggregationSummary({
      injuryProfile,
      liabilityResult,
      expenseAggregation,
      deathProfile,
      caseReports,
      conflictsDetected,
      validationResults,
    }),
  };
}

function buildAggregationSummary({ injuryProfile, liabilityResult, expenseAggregation, deathProfile, caseReports, conflictsDetected, validationResults = [] }) {
  const parts = [];
  if (injuryProfile) {
    parts.push(`伤情：${injuryProfile.injuryDescription}，住院 ${injuryProfile.hospitalizationDays} 天${injuryProfile.disabilityLevel ? `，${injuryProfile.disabilityLevel}` : ""}`);
  }
  if (deathProfile?.deathConfirmed) {
    parts.push(`死亡事实：${deathProfile.deceasedName || "死者"}${deathProfile.deathDate ? `于 ${deathProfile.deathDate}` : ""}死亡`);
  }
  if (liabilityResult) {
    parts.push(`责任：伤者 ${liabilityResult.claimantLiabilityPct}%，第三方 ${liabilityResult.thirdPartyLiabilityPct}%`);
  }
  if (expenseAggregation && expenseAggregation.medicalTotal > 0) {
    parts.push(`医疗费：¥${expenseAggregation.medicalTotal.toLocaleString("zh-CN")}`);
  }
  if (deathProfile?.funeralExpenseTotal > 0) {
    parts.push(`丧葬票据：¥${deathProfile.funeralExpenseTotal.toLocaleString("zh-CN")}`);
  }
  if (caseReports?.length > 0) {
    const reportNames = caseReports
      .map((item) => {
        if (item.reportType === "public_adjuster") return "公估报告";
        if (item.reportType === "initial") return "初期报告";
        return "调查报告";
      })
      .join("、");
    parts.push(`报告参考：已提取 ${reportNames}`);
  }
  if (conflictsDetected.length > 0) {
    const errors = conflictsDetected.filter((c) => c.severity === "error").length;
    const warnings = conflictsDetected.filter((c) => c.severity === "warning").length;
    parts.push(`检测到 ${errors} 个错误、${warnings} 个警告`);
  }
  if (validationResults.length > 0) {
    const failed = validationResults.filter((item) => !item.passed).length;
    if (failed > 0) {
      parts.push(`材料校验规则异常 ${failed} 项`);
    }
  }
  return parts.join("；") || "聚合完成，请手动核实详情";
}
