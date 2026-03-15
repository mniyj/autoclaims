import { summarizeHandlingProfile } from "./handlingProfileService.js";

function createIssue({
  code,
  severity = "warning",
  title,
  description,
  relatedDocIds = [],
  relatedMaterialIds = [],
  action = "",
}) {
  return {
    code,
    severity,
    title,
    description,
    relatedDocIds,
    relatedMaterialIds,
    action,
  };
}

export function buildCaseValidationChecklist({
  materials = [],
  aggregation = null,
  completeness = null,
  materialValidationResults = [],
  claimCase = null,
} = {}) {
  const issues = [];
  const unknownMaterials = materials.filter((item) => !item.materialId || item.materialId === "unknown");
  const materialsWithSummary = materials.filter((item) => item.documentSummary);
  const paymentEvidence = aggregation?.paymentEvidence || [];
  const paymentEvidenceNormalized = aggregation?.paymentEvidenceNormalized || [];
  const paymentSummary = aggregation?.paymentSummary || null;
  const liabilityApportionment = aggregation?.liabilityApportionment || null;
  const compulsoryInsuranceOffset = aggregation?.compulsoryInsuranceOffset || null;
  const regionalStandards = aggregation?.regionalStandards || null;
  const manualReviewItems = aggregation?.manualReviewItems || [];
  const conflicts = aggregation?.conflictsDetected || [];
  const failedMaterialValidations = (materialValidationResults || []).filter((item) => !item.passed);
  const handlingProfile = summarizeHandlingProfile({
    claimCase,
    aggregation,
    materials,
  });
  const domainModel = handlingProfile.domainModel || null;
  const isMedicalScenario = Boolean(domainModel?.isMedicalScenario);
  const isLiabilityScenario = Boolean(domainModel?.isLiabilityScenario);
  const isAutoScenario = Boolean(domainModel?.isAutoScenario);

  if (unknownMaterials.length > 0) {
    issues.push(
      createIssue({
        code: "UNKNOWN_MATERIALS",
        severity: unknownMaterials.length > 10 ? "warning" : "info",
        title: "存在未识别材料",
        description: `共有 ${unknownMaterials.length} 份材料尚未完成类型识别，可能影响后续事实归纳和赔偿项目匹配。`,
        relatedMaterialIds: unknownMaterials.map((item) => item.id).filter(Boolean),
        action: "优先补录责任依据、付款凭证、关系证明等关键材料类型。",
      })
    );
  }

  if (materials.length > 0 && materialsWithSummary.length === 0) {
    issues.push(
      createIssue({
        code: "NO_SUMMARIES",
        severity: "warning",
        title: "暂无结构化摘要",
        description: "材料已入库但尚未形成可用于聚合的结构化摘要，定责定损结果可能不完整。",
        action: "重跑关键材料摘要提取或手工录入关键字段。",
      })
    );
  }

  if (paymentEvidence.length > paymentEvidenceNormalized.length && isLiabilityScenario) {
    issues.push(
      createIssue({
        code: "PAYMENT_DUPLICATES_MERGED",
        severity: "info",
        title: "付款凭证已自动归并",
        description: `识别到 ${paymentEvidence.length} 条付款截图，其中 ${paymentEvidenceNormalized.length} 条被归并为唯一付款记录。`,
        relatedDocIds: paymentEvidence.map((item) => item.sourceDocId).filter(Boolean),
        action: "保留原始凭证，同时按归并结果汇总金额。",
      })
    );
  }

  if (paymentSummary?.confirmedPaidAmount > 0 && paymentSummary?.deductionTotal === 0 && domainModel?.requiresDeductionAssessment) {
    issues.push(
      createIssue({
        code: "PAYMENT_DEDUCTION_PENDING",
        severity: "warning",
        title: "已付款抵扣待确认",
        description: `已识别付款 ¥${paymentSummary.confirmedPaidAmount.toLocaleString("zh-CN")}，但当前未自动抵扣。`,
        relatedDocIds: paymentEvidenceNormalized.map((item) => item.sourceDocId).filter(Boolean),
        action: "核对付款主体、赔付路径和是否应从保险赔款中抵扣。",
      })
    );
  }

  if (liabilityApportionment?.source === "public_adjuster_report" && domainModel?.requiresLiabilityAssessment) {
    issues.push(
      createIssue({
        code: "LIABILITY_FROM_ADJUSTER",
        severity: "warning",
        title: "责任比例来自公估报告",
        description: `当前按第三方责任 ${liabilityApportionment.thirdPartyLiabilityPct}% 试算，来源为公估报告口径。`,
        relatedDocIds: [liabilityApportionment.sourceDocId].filter(Boolean),
        action: "如后续取得正式责任文书，应优先用正式文书覆盖该比例。",
      })
    );
  } else if (domainModel?.requiresLiabilityAssessment && !aggregation?.liabilityResult) {
    issues.push(
      createIssue({
        code: "NO_LIABILITY_RATIO",
        severity: "warning",
        title: "缺少责任比例依据",
        description: "当前案件尚未形成可直接折算的责任比例，定损结果可能只能作为未折减草案。",
        action: "补充责任认定书、事故调查结论或人工确认责任比例。",
      })
    );
  }

  if (regionalStandards && regionalStandards.source !== "configured_standard" && (isLiabilityScenario || isAutoScenario)) {
    issues.push(
      createIssue({
        code: "STANDARDS_NOT_CONFIGURED",
        severity: "warning",
        title: "赔偿标准未走配置库",
        description: `当前赔偿标准来自${regionalStandards.source === "material_extraction" ? "案卷材料提取" : "默认兜底"}，不是后台配置标准。`,
        action: "将地区标准录入标准库，避免后续案件口径漂移。",
      })
    );
  }

  if (compulsoryInsuranceOffset?.applicable === false && isAutoScenario) {
    issues.push(
      createIssue({
        code: "COMPULSORY_OFFSET_DISABLED",
        severity: "info",
        title: "交强险扣减已禁用",
        description: compulsoryInsuranceOffset.reason || "当前案件不适用交强险扣减。",
      })
    );
  }

  if (completeness?.missingMaterials?.length > 0) {
    issues.push(
      createIssue({
        code: "MISSING_REQUIRED_MATERIALS",
        severity: "warning",
        title: "存在缺失材料",
        description: `仍有 ${completeness.missingMaterials.length} 项材料未补齐。`,
        action: `优先补齐：${completeness.missingMaterials.slice(0, 4).join("、")}`,
      })
    );
  }

  if (failedMaterialValidations.length > 0) {
    issues.push(
      createIssue({
        code: "FAILED_CROSS_VALIDATIONS",
        severity: "warning",
        title: "跨材料校验未全部通过",
        description: `现有规则校验中有 ${failedMaterialValidations.length} 项未通过。`,
        relatedDocIds: failedMaterialValidations.flatMap((item) => item.details?.relatedDocuments || []).filter(Boolean),
        action: "核对规则未通过项，确认是否为材料冲突、抽取错误或确有争议。",
      })
    );
  }

  if (conflicts.length > 0) {
    issues.push(
      createIssue({
        code: "AGGREGATION_CONFLICTS",
        severity: conflicts.some((item) => item.severity === "error") ? "error" : "warning",
        title: "聚合阶段检测到材料冲突",
        description: `聚合逻辑识别到 ${conflicts.length} 处冲突，需要人工确认事实口径。`,
        relatedDocIds: conflicts.flatMap((item) => item.docIds || []).filter(Boolean),
        action: "在材料审核页逐条核对冲突来源。",
      })
    );
  }

  if (isMedicalScenario) {
    const hasInvoiceSummary = materialsWithSummary.some((item) => item.documentSummary?.summaryType === "expense_invoice");
    const hasMedicalRecordSummary = materialsWithSummary.some((item) =>
      ["inpatient_record", "outpatient_record"].includes(item.documentSummary?.summaryType),
    );
    if (!hasInvoiceSummary) {
      issues.push(
        createIssue({
          code: "MEDICAL_INVOICE_MISSING",
          severity: "warning",
          title: "缺少可用医疗发票摘要",
          description: "当前医疗案件尚未形成可用于金额核定的发票摘要。",
          action: "检查发票类材料分类与结构化提取结果。",
        }),
      );
    }
    if (!hasMedicalRecordSummary) {
      issues.push(
        createIssue({
          code: "MEDICAL_RECORD_MISSING",
          severity: "warning",
          title: "缺少病历摘要",
          description: "当前医疗案件尚未形成病历或就诊记录摘要，可能影响责任与就医事实判定。",
          action: "补充病历资料或重跑病历摘要提取。",
        }),
      );
    }
  }

  for (const item of manualReviewItems) {
    issues.push(
      createIssue({
        code: `MANUAL_${issues.length + 1}`,
        severity: "warning",
        title: "人工复核提醒",
        description: item,
      })
    );
  }

  for (const task of handlingProfile.reviewTasks || []) {
    issues.push(
      createIssue({
        code: `PROFILE_${task.code}`,
        severity: task.severity || "warning",
        title: task.title,
        description: task.question,
        action: task.blocking ? "该项建议在出具正式结论前完成确认。" : "建议人工确认后再固化为最终结论。",
      })
    );
  }

  const severityRank = { error: 3, warning: 2, info: 1 };
  issues.sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0));

  return {
    handlingProfile,
    domainModel,
    summary: {
      total: issues.length,
      errorCount: issues.filter((item) => item.severity === "error").length,
      warningCount: issues.filter((item) => item.severity === "warning").length,
      infoCount: issues.filter((item) => item.severity === "info").length,
    },
    issues,
  };
}
