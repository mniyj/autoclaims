import { executeFullReview } from "../rules/engine.js";
import { readData, writeData } from "../utils/fileStore.js";
import { generateDamageReport } from "./reportGenerator.js";
import {
  buildCalculationContext,
  inferFormulaTypes,
} from "./calculationContextBuilder.js";
import { executeCalculation } from "./calculationEngine.js";
import { createIntervention } from "./interventionStateMachine.js";

function uniqueStrings(values = []) {
  return [
    ...new Set(
      values
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];
}

function normalizeDateInput(value) {
  if (!value) {
    return undefined;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString().split("T")[0];
}

function extractReviewFactsFromDocuments(record = {}) {
  const documents = Array.isArray(record?.documents) ? record.documents : [];
  const invoiceItems = [];
  const hospitalNames = [];
  const diagnosisNames = [];
  let admissionDate;
  let dischargeDate;
  let hospitalDays;

  documents.forEach((doc, docIndex) => {
    const summary = doc?.documentSummary || {};
    if (summary.institution) {
      hospitalNames.push(summary.institution);
    }
    if (summary.hospitalName) {
      hospitalNames.push(summary.hospitalName);
    }
    if (Array.isArray(summary.breakdown)) {
      summary.breakdown.forEach((item, itemIndex) => {
        const amount = Number(item?.amount ?? item?.totalPrice ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) {
          return;
        }
        invoiceItems.push({
          id: `${doc.id || `doc-${docIndex}`}-item-${itemIndex}`,
          itemName: item?.itemName || item?.name || `费用项${itemIndex + 1}`,
          name: item?.itemName || item?.name || `费用项${itemIndex + 1}`,
          amount,
          totalPrice: amount,
          category: item?.category || null,
          source: "claim_document_summary",
          documentId: doc.id || null,
        });
      });
    }

    const diagnosisValues = [
      summary.diagnosis,
      summary.primaryDiagnosis,
      summary.dischargeDiagnosis,
    ];
    diagnosisValues.forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => diagnosisNames.push(entry?.name || entry));
      } else if (value) {
        diagnosisNames.push(value?.name || value);
      }
    });

    admissionDate = admissionDate || normalizeDateInput(summary.admissionDate);
    dischargeDate = dischargeDate || normalizeDateInput(summary.dischargeDate);
    if (
      hospitalDays == null &&
      Number.isFinite(Number(summary.hospitalizationDays))
    ) {
      hospitalDays = Number(summary.hospitalizationDays);
    }
  });

  return {
    invoiceItems,
    hospitalName: uniqueStrings(hospitalNames)[0],
    diagnosisNames: uniqueStrings(diagnosisNames),
    admissionDate,
    dischargeDate,
    hospitalDays,
  };
}

function getNormalizedReviewAmount(reviewResult) {
  const directAmount = Number(reviewResult?.payableAmount);
  if (Number.isFinite(directAmount)) {
    return directAmount;
  }

  const amountObject = reviewResult?.amount;
  if (amountObject && typeof amountObject === "object") {
    const nestedFinalAmount = Number(
      amountObject.finalAmount ??
        amountObject.totalPayableAmount ??
        amountObject.settlementBreakdown?.totalPayableAmount,
    );
    if (Number.isFinite(nestedFinalAmount)) {
      return nestedFinalAmount;
    }
  }

  const scalarAmount = Number(reviewResult?.amount);
  if (Number.isFinite(scalarAmount)) {
    return scalarAmount;
  }

  const calculationAmount = Number(
    reviewResult?.calculation?.finalAmount ??
      reviewResult?.calculation?.settlementBreakdown?.totalPayableAmount,
  );
  return Number.isFinite(calculationAmount) ? calculationAmount : null;
}

function buildLatestReviewSnapshot(reviewResult, timestamp) {
  if (!reviewResult) {
    return null;
  }

  const coverageResults = Array.isArray(reviewResult.coverageResults)
    ? reviewResult.coverageResults
    : Array.isArray(reviewResult.calculation?.coverageResults)
      ? reviewResult.calculation.coverageResults
      : [];
  const normalizedAmount = getNormalizedReviewAmount(reviewResult);

  return {
    updatedAt: timestamp,
    decision: reviewResult.decision,
    amount: normalizedAmount,
    payableAmount: normalizedAmount,
    intakeDecision: reviewResult.intakeDecision,
    liabilityDecision: reviewResult.liabilityDecision,
    assessmentDecision: reviewResult.assessmentDecision,
    settlementDecision: reviewResult.settlementDecision,
    missingMaterials: Array.isArray(reviewResult.missingMaterials)
      ? reviewResult.missingMaterials
      : [],
    preExistingAssessment: reviewResult.preExistingAssessment || null,
    coverageResults,
  };
}

function deriveClaimStatus(reviewResult, currentStatus) {
  if (!reviewResult) {
    return currentStatus;
  }

  const missingMaterials = Array.isArray(reviewResult.missingMaterials)
    ? reviewResult.missingMaterials
    : [];

  if (missingMaterials.length > 0) {
    return "待补传";
  }

  if (
    reviewResult.liabilityDecision === "REJECT" ||
    reviewResult.decision === "REJECT"
  ) {
    return "已结案-拒赔";
  }

  // APPROVE 时即使 settlementDecision 缺失也推进（与前端 deriveClaimStatus 对齐）
  if (reviewResult.decision === "APPROVE") {
    return "已结案-给付";
  }

  if (
    reviewResult.liabilityDecision === "ACCEPT" ||
    ["ASSESSED", "PARTIAL_ASSESSED"].includes(reviewResult.assessmentDecision)
  ) {
    return "处理中";
  }

  return currentStatus || "已报案";
}

function getAutoCompletedBy(status, fallback = "system") {
  if (status === "manual_completed") {
    return "manual";
  }
  if (status === "completed") {
    return "system";
  }
  return fallback;
}

function shouldWriteAutoStage(stageDecision) {
  return (
    typeof stageDecision === "string" &&
    !["PENDING_MATERIAL", "MANUAL_REVIEW", "UNABLE_TO_ASSESS"].includes(
      stageDecision,
    )
  );
}

function syncClaimStageFields(claimCaseId, reviewResult, options = {}) {
  if (!claimCaseId || !reviewResult) {
    return null;
  }

  const claimCases = readData("claim-cases") || [];
  const claimIndex = claimCases.findIndex((item) => item.id === claimCaseId);
  if (claimIndex === -1) {
    return null;
  }

  const claimCase = claimCases[claimIndex];
  const nowIso = options.timestamp || new Date().toISOString();
  const patch = {
    latestReviewSnapshot: buildLatestReviewSnapshot(reviewResult, nowIso),
    status: deriveClaimStatus(reviewResult, claimCase.status),
  };

  if (
    reviewResult.intakeDecision === "PASS" &&
    (!claimCase.acceptedAt || !claimCase.acceptedBy)
  ) {
    patch.acceptedAt = claimCase.acceptedAt || nowIso;
    patch.acceptedBy = claimCase.acceptedBy || "system";
  }

  if (options.parseCompleted && (!claimCase.parsedAt || !claimCase.parsedBy)) {
    patch.parsedAt = claimCase.parsedAt || nowIso;
    patch.parsedBy = claimCase.parsedBy || "system";
  }

  if (
    shouldWriteAutoStage(reviewResult.liabilityDecision) &&
    (!claimCase.liabilityCompletedAt ||
      !claimCase.liabilityCompletedBy ||
      !claimCase.liabilityDecision)
  ) {
    patch.liabilityCompletedAt = claimCase.liabilityCompletedAt || nowIso;
    patch.liabilityCompletedBy =
      claimCase.liabilityCompletedBy ||
      getAutoCompletedBy(options.liabilityStatus);
    if (!claimCase.liabilityDecision) {
      patch.liabilityDecision = reviewResult.liabilityDecision;
    }
  }

  if (
    shouldWriteAutoStage(reviewResult.assessmentDecision) &&
    (!claimCase.assessmentCompletedAt ||
      !claimCase.assessmentCompletedBy ||
      !claimCase.assessmentDecision ||
      (claimCase.approvedAmount == null &&
        getNormalizedReviewAmount(reviewResult) != null))
  ) {
    patch.assessmentCompletedAt = claimCase.assessmentCompletedAt || nowIso;
    patch.assessmentCompletedBy =
      claimCase.assessmentCompletedBy ||
      getAutoCompletedBy(options.assessmentStatus);
    if (!claimCase.assessmentDecision) {
      patch.assessmentDecision = reviewResult.assessmentDecision;
    }
    if (
      claimCase.approvedAmount == null &&
      getNormalizedReviewAmount(reviewResult) != null
    ) {
      patch.approvedAmount = getNormalizedReviewAmount(reviewResult);
    }
  }

  claimCases[claimIndex] = {
    ...claimCase,
    ...patch,
  };
  writeData("claim-cases", claimCases);

  // 当定责/定损决策为人工审核时，创建介入点3实例
  tryCreateRuleManualIntervention(claimCaseId, reviewResult);

  return claimCases[claimIndex];
}

/**
 * 检测规则引擎转人工的决策，并创建介入实例
 */
function tryCreateRuleManualIntervention(claimCaseId, reviewResult) {
  if (!reviewResult) return;

  // 定责阶段转人工
  if (reviewResult.liabilityDecision === "MANUAL_REVIEW") {
    const reasons = (reviewResult.manualReviewReasons || []).filter(
      (r) => r.stage === "LIABILITY",
    );
    const reasonSummary =
      reasons.map((r) => r.message).join("；") || "定责需人工复核";
    try {
      createIntervention({
        claimCaseId,
        stageKey: "liability",
        interventionType: "RULE_MANUAL_ROUTE",
        reason: {
          code: "RULE_ROUTE_MANUAL",
          summary: reasonSummary.slice(0, 100),
          detail: `定责阶段规则转人工：${reasonSummary}`,
          sourceRuleId: reasons[0]?.source,
          sourceRuleName: reasons[0]?.ruleName,
          routeReason: reasonSummary,
        },
        priority: "HIGH",
        triggeringRuleId: reasons[0]?.source,
      });
    } catch (err) {
      console.warn("[intervention] 创建定责介入失败:", err.message);
    }
  }

  // 定损阶段转人工
  if (reviewResult.assessmentDecision === "UNABLE_TO_ASSESS") {
    const reasons = (reviewResult.manualReviewReasons || []).filter(
      (r) => r.stage === "ASSESSMENT",
    );
    const reasonSummary =
      reasons.map((r) => r.message).join("；") || "定损需人工复核";
    try {
      createIntervention({
        claimCaseId,
        stageKey: "assessment",
        interventionType: "RULE_MANUAL_ROUTE",
        reason: {
          code: "RULE_ROUTE_MANUAL",
          summary: reasonSummary.slice(0, 100),
          detail: `定损阶段规则转人工：${reasonSummary}`,
          sourceRuleId: reasons[0]?.source,
          sourceRuleName: reasons[0]?.ruleName,
          routeReason: reasonSummary,
        },
        priority: "HIGH",
        triggeringRuleId: reasons[0]?.source,
      });
    } catch (err) {
      console.warn("[intervention] 创建定损介入失败:", err.message);
    }
  }
}

export function getLatestClaimDocumentRecord(claimCaseId, allClaimDocs = null) {
  const claimDocs = Array.isArray(allClaimDocs)
    ? allClaimDocs
    : readData("claim-documents") || [];
  const indexedRecord = claimDocs
    .map((record, index) => ({ record, index }))
    .filter(
      ({ record }) => record.claimCaseId === claimCaseId && record.aggregation,
    )
    .sort(
      (a, b) =>
        new Date(b.record.importedAt || b.record.updatedAt || 0).getTime() -
        new Date(a.record.importedAt || a.record.updatedAt || 0).getTime(),
    )[0];

  return indexedRecord || null;
}

function buildAutoReviewPayload({
  claimCaseId,
  claimCase = null,
  record = null,
}) {
  const derivedFacts = extractReviewFactsFromDocuments(record);
  const existingOcrData = claimCase?.ocrData || {};
  const mergedOcrData = {
    ...existingOcrData,
    hospital_name:
      existingOcrData.hospital_name ||
      existingOcrData.hospitalName ||
      derivedFacts.hospitalName,
    hospital_days:
      existingOcrData.hospital_days ||
      existingOcrData.hospitalDays ||
      derivedFacts.hospitalDays,
    admission_date:
      existingOcrData.admission_date ||
      existingOcrData.admissionDate ||
      derivedFacts.admissionDate,
    discharge_date:
      existingOcrData.discharge_date ||
      existingOcrData.dischargeDate ||
      derivedFacts.dischargeDate,
    diagnosis_names:
      Array.isArray(existingOcrData.diagnosis_names) &&
      existingOcrData.diagnosis_names.length > 0
        ? existingOcrData.diagnosis_names
        : derivedFacts.diagnosisNames,
    diagnosis:
      existingOcrData.diagnosis ||
      derivedFacts.diagnosisNames.join("；") ||
      undefined,
  };
  const mergedInvoiceItems =
    Array.isArray(claimCase?.calculationItems) &&
    claimCase.calculationItems.length > 0
      ? claimCase.calculationItems
      : derivedFacts.invoiceItems;

  return {
    claimCaseId,
    productCode: claimCase?.productCode || record?.productCode,
    ocrData: mergedOcrData,
    invoiceItems: mergedInvoiceItems,
    validationFacts: record?.validationFacts || null,
  };
}

export async function syncClaimReviewArtifacts({
  claimCaseId,
  recordIndex = null,
  recordPatch = {},
  claimCase = null,
  standards = {},
  claimantAge = 35,
  stageOptions = {},
} = {}) {
  if (!claimCaseId) {
    return null;
  }

  const allClaimDocs = readData("claim-documents") || [];
  const target =
    Number.isInteger(recordIndex) && allClaimDocs[recordIndex]
      ? { index: recordIndex, record: allClaimDocs[recordIndex] }
      : getLatestClaimDocumentRecord(claimCaseId, allClaimDocs);

  if (!target?.record) {
    return null;
  }

  const nextRecord = {
    ...target.record,
    ...recordPatch,
  };

  const allClaimCases = readData("claim-cases") || [];
  const resolvedClaimCase =
    claimCase || allClaimCases.find((item) => item.id === claimCaseId) || {};

  // 没有 aggregation 时仍可执行基于 claim case 的规则审核并同步阶段字段
  if (!nextRecord.aggregation) {
    const reviewPayload = buildAutoReviewPayload({
      claimCaseId,
      claimCase: resolvedClaimCase,
      record: nextRecord,
    });
    const reviewResult = await executeFullReview(reviewPayload);
    const syncedCase = syncClaimStageFields(
      claimCaseId,
      reviewResult,
      stageOptions,
    );
    // 将 reviewResult 写入文档记录，确保后续读取不会拿到旧数据
    const updatedRecord = {
      ...nextRecord,
      reviewResult,
      updatedAt: new Date().toISOString(),
    };
    allClaimDocs[target.index] = updatedRecord;
    writeData("claim-documents", allClaimDocs);
    return {
      recordIndex: target.index,
      record: updatedRecord,
      reviewResult,
      report: null,
      claimCase: syncedCase || resolvedClaimCase,
    };
  }

  const reviewResult = await executeFullReview(
    buildAutoReviewPayload({
      claimCaseId,
      claimCase: resolvedClaimCase,
      record: nextRecord,
    }),
  );

  // 尝试使用 factSchema → calculationEngine 补充理算结果
  // 当 reviewResult 缺少 calculation 或 finalAmount 时，自动执行公式理算
  if (nextRecord.aggregation?.handlingProfile?.domainModel) {
    try {
      const domainModel = nextRecord.aggregation.handlingProfile.domainModel;
      const facts = nextRecord.aggregation.extractedFacts || {};
      const coverage = resolvedClaimCase?.coverageInfo || {};
      const context = buildCalculationContext({
        facts,
        coverage,
        aggregation: nextRecord.aggregation,
        domainModel,
      });
      const formulaTypes = inferFormulaTypes({
        claimScenario: domainModel.claimScenario,
        coverageCode: facts.coverageCode || coverage.coverageCode,
      });
      if (formulaTypes.length > 0 && !reviewResult.calculation?.finalAmount) {
        const calcResults = [];
        for (const formulaType of formulaTypes) {
          try {
            calcResults.push(executeCalculation(formulaType, context));
          } catch (calcError) {
            console.warn(`公式 ${formulaType} 执行失败:`, calcError.message);
          }
        }
        if (calcResults.length > 0) {
          reviewResult.formulaCalculations = calcResults;
          // 取第一个成功公式的 finalAmount 作为补充
          const primaryCalc = calcResults.find((r) => r.finalAmount > 0);
          if (primaryCalc && !reviewResult.amount) {
            reviewResult.amount = primaryCalc.finalAmount;
          }
        }
      }
    } catch (contextError) {
      console.warn("公式理算上下文构建失败:", contextError.message);
    }
  }

  const report = generateDamageReport({
    claimCaseId,
    aggregationResult: nextRecord.aggregation,
    claimCase: resolvedClaimCase,
    standards,
    claimantAge,
    reviewResult,
  });

  const storedReport = {
    ...report,
    reportHtml: undefined,
  };
  const storedRecord = {
    ...nextRecord,
    reviewResult,
    damageReport: storedReport,
    updatedAt: new Date().toISOString(),
  };

  allClaimDocs[target.index] = storedRecord;
  writeData("claim-documents", allClaimDocs);

  const reports = (readData("damage-reports") || []).filter(
    (item) => item.claimCaseId !== claimCaseId,
  );
  reports.push(storedReport);
  writeData("damage-reports", reports);

  const syncedClaimCase = syncClaimStageFields(
    claimCaseId,
    reviewResult,
    stageOptions,
  );

  return {
    recordIndex: target.index,
    record: storedRecord,
    reviewResult,
    report,
    claimCase: syncedClaimCase || resolvedClaimCase,
  };
}
