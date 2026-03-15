function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean).map((item) => String(item)))];
}

function normalizeFacts(facts = []) {
  return facts
    .filter((item) => item && item.label)
    .map((item) => ({
      label: String(item.label),
      value: item.value === undefined || item.value === null ? "-" : String(item.value),
    }));
}

function extractManualActions({ aggregation = {}, operationLogs = [] }) {
  const actions = [];
  const seen = new Set();
  const pushAction = (action) => {
    if (!action?.label || !action?.timestamp) return;
    const dedupeKey = `${action.label}|${action.timestamp}|${action.detail || ""}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    actions.push({
      label: action.label,
      timestamp: action.timestamp,
      detail: action.detail || "",
      actor: action.actor || "系统用户",
    });
  };

  for (const log of operationLogs) {
    if (log?.operationType !== "CLAIM_ACTION" || log?.success === false) continue;
    pushAction({
      label: log.operationLabel || "人工处理",
      timestamp: log.timestamp,
      detail:
        log.outputData?.finalAmount !== undefined
          ? `重算后金额 ¥${Number(log.outputData.finalAmount || 0).toFixed(2)}`
          : log.inputData?.afterRatio !== undefined
            ? `责任比例调整为 ${log.inputData.afterRatio}%`
            : log.inputData?.deductionAmount !== undefined
              ? `抵扣金额调整为 ¥${Number(log.inputData.deductionAmount || 0).toFixed(2)}`
              : "",
      actor: log.userName || "系统用户",
    });
  }

  if (aggregation?.factConfirmations?.liability_apportionment?.confirmedAt) {
    pushAction({
      label: "人工确认责任比例",
      timestamp: aggregation.factConfirmations.liability_apportionment.confirmedAt,
      detail: Number.isFinite(aggregation?.liabilityApportionment?.thirdPartyLiabilityPct)
        ? `确认第三方责任比例 ${aggregation.liabilityApportionment.thirdPartyLiabilityPct}%`
        : "已确认责任比例口径",
    });
  }

  const identityChainConfirmation =
    aggregation?.factConfirmations?.third_party_identity_chain ||
    aggregation?.factConfirmations?.employment_relation;
  if (identityChainConfirmation?.confirmedAt) {
    pushAction({
      label: "人工确认第三者身份与责任链",
      timestamp: identityChainConfirmation.confirmedAt,
      detail: "已确认第三者身份及被保险人责任链事实",
    });
  }

  if (
    aggregation?.deductionSummary?.confirmedAt &&
    Number.isFinite(aggregation?.deductionSummary?.deductionTotal)
  ) {
    pushAction({
      label: "人工确认抵扣金额",
      timestamp: aggregation.deductionSummary.confirmedAt,
      detail: `当前抵扣金额 ¥${Number(aggregation.deductionSummary.deductionTotal || 0).toFixed(2)}`,
    });
  }

  if (
    aggregation?.liabilityApportionment?.updatedAt &&
    aggregation?.liabilityApportionment?.updatedAt !== aggregation?.liabilityApportionment?.confirmedAt
  ) {
    pushAction({
      label: "更新责任比例",
      timestamp: aggregation.liabilityApportionment.updatedAt,
      detail: Number.isFinite(aggregation?.liabilityApportionment?.thirdPartyLiabilityPct)
        ? `第三方责任比例调整为 ${aggregation.liabilityApportionment.thirdPartyLiabilityPct}%`
        : "已调整责任比例",
    });
  }

  return actions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export function buildDecisionTrace({
  claimCaseId,
  claimCase = null,
  materials = [],
  summaries = [],
  aggregation = {},
  operationLogs = [],
  generatedAt,
}) {
  const domainModel =
    aggregation?.domainModel && typeof aggregation.domainModel === "object"
      ? aggregation.domainModel
      : aggregation?.handlingProfile?.domainModel && typeof aggregation.handlingProfile.domainModel === "object"
        ? aggregation.handlingProfile.domainModel
        : null;
  const scenario = domainModel?.claimScenario || "unknown";
  const identityChainEvidence = Array.isArray(aggregation?.identityChainEvidence)
    ? aggregation.identityChainEvidence
    : Array.isArray(aggregation?.employmentEvidence)
      ? aggregation.employmentEvidence
      : [];
  const recognizedMaterials = materials.filter(
    (item) => item.materialId && item.materialId !== "unknown"
  );
  const paymentSummary = aggregation.paymentSummary || {};
  const deathProfile = aggregation.factModel?.deathProfile || aggregation.deathProfile || {};
  const injuryProfile = aggregation?.injuryProfile || {};
  const expenseAggregation = aggregation?.expenseAggregation || {};
  const manualActions = extractManualActions({ aggregation, operationLogs });
  const commonStages = [
    {
      stage: "material_recognition",
      title: "材料识别",
      status: "completed",
      summary: `共识别 ${recognizedMaterials.length}/${materials.length || recognizedMaterials.length} 份材料，形成 ${summaries.length} 份结构化摘要`,
      sourceDocIds: uniqueValues(recognizedMaterials.map((item) => item.documentId || item.id)),
      facts: normalizeFacts([
        { label: "材料总数", value: materials.length || recognizedMaterials.length },
        { label: "已识别材料", value: recognizedMaterials.length },
        { label: "摘要数量", value: summaries.length },
      ]),
    },
  ];
  let traceStages = [...commonStages];

  if (scenario === "medical_expense") {
    traceStages.push(
      {
        stage: "medical_fact_aggregation",
        title: "医疗事实归纳",
        status: "completed",
        summary: aggregation.aggregationSummary || "已完成就医与费用事实归纳",
        sourceDocIds: uniqueValues([
          ...(expenseAggregation.sourceDocIds || []),
          ...summaries
            .filter((item) => ["expense_invoice", "inpatient_record", "outpatient_record"].includes(item?.summaryType))
            .map((item) => item.docId),
        ]),
        facts: normalizeFacts([
          { label: "诊断", value: injuryProfile?.injuryDescription || "-" },
          { label: "医疗费用", value: expenseAggregation.medicalTotal || 0 },
          { label: "住院天数", value: injuryProfile?.hospitalizationDays || 0 },
          { label: "发票张数", value: summaries.filter((item) => item?.summaryType === "expense_invoice").length },
        ]),
      },
      {
        stage: "expense_assessment",
        title: "费用核定",
        status: "completed",
        summary:
          Number(expenseAggregation.medicalTotal || 0) > 0
            ? `已归集医疗费用 ¥${Number(expenseAggregation.medicalTotal || 0).toFixed(2)}`
            : "尚未识别可核定的医疗费用",
        sourceDocIds: uniqueValues(expenseAggregation.sourceDocIds || []),
        facts: normalizeFacts([
          { label: "医疗费用合计", value: expenseAggregation.medicalTotal || 0 },
          { label: "交通费", value: expenseAggregation.transportationTotal || 0 },
          { label: "护理天数", value: expenseAggregation.nursingDays || 0 },
          { label: "误工天数", value: expenseAggregation.lostWorkDays || 0 },
        ]),
      },
    );
  } else {
    traceStages.push(
      {
        stage: "fact_aggregation",
        title: "案件事实归纳",
        status: "completed",
        summary: aggregation.aggregationSummary || "已完成案件事实归纳",
        sourceDocIds: uniqueValues([
          ...(deathProfile?.sourceDocIds || []),
          ...identityChainEvidence.map((item) => item.docId),
          ...(aggregation.incidentStatements || []).map((item) => item.docId),
          ...(aggregation.policeCallRecords || []).map((item) => item.docId),
          ...(aggregation.interviewRecords || []).map((item) => item.docId),
          ...summaries
            .filter((item) => ["case_report", "death_record", "claimant_relationship"].includes(item?.summaryType))
            .map((item) => item.docId),
        ]),
        facts: normalizeFacts([
          { label: "死亡事实", value: deathProfile?.deathConfirmed ? "已确认死亡" : "未确认" },
          { label: "死者姓名", value: deathProfile?.deceasedName || "-" },
          { label: "关系人", value: (deathProfile?.claimants || []).map((item) => item.name).join("、") || "-" },
          { label: "责任链证据", value: identityChainEvidence.length },
          {
            label: "报警/笔录",
            value: (aggregation.policeCallRecords || []).length + (aggregation.interviewRecords || []).length,
          },
        ]),
      },
    );
  }

  if (domainModel?.requiresLiabilityAssessment) {
    traceStages.push({
      stage: "liability_assessment",
      title: "责任评估",
      status: aggregation.liabilityApportionment ? "completed" : "manual_review",
      summary: aggregation.liabilitySuggestion?.conclusion || "责任比例待人工确认",
      sourceDocIds: uniqueValues([
        aggregation.liabilityApportionment?.sourceDocId,
        ...(aggregation.liabilityEvidence || []).map((item) => item.sourceDocId),
        ...((aggregation.liabilitySuggestion?.basis || []).map((item) => item.sourceDocId)),
      ]),
      facts: normalizeFacts([
        {
          label: "责任比例",
          value: aggregation.liabilityApportionment
            ? `${aggregation.liabilityApportionment.thirdPartyLiabilityPct}%`
            : "待确认",
        },
        {
          label: "责任来源",
          value: aggregation.liabilityApportionment?.source || aggregation.liabilitySuggestion?.status || "-",
        },
        {
          label: "确认状态",
          value: aggregation.liabilityApportionment?.confirmed ? "已人工确认" : "未确认",
        },
      ]),
    });
  }

  if (domainModel?.requiresDeductionAssessment) {
    traceStages.push({
      stage: "deduction_assessment",
      title: "抵扣评估",
      status: "completed",
      summary: paymentSummary.note || "已完成已付款抵扣评估",
      sourceDocIds: uniqueValues([
        ...(aggregation.paymentEvidenceNormalized || []).map((item) => item.sourceDocId),
        ...(aggregation.paymentEvidence || []).map((item) => item.sourceDocId),
      ]),
      facts: normalizeFacts([
        { label: "已识别付款", value: paymentSummary.confirmedPaidAmount || 0 },
        { label: "推荐抵扣", value: paymentSummary.deductionRecommendedAmount || 0 },
        { label: "当前抵扣", value: (aggregation.deductionSummary || {}).deductionTotal || 0 },
      ]),
    });
  }

  if (manualActions.length > 0) {
    traceStages.push({
      stage: "manual_review",
      title: "人工确认与调整",
      status: "completed",
      summary: `已记录 ${manualActions.length} 项人工确认/调整动作`,
      sourceDocIds: uniqueValues([
        aggregation.liabilityApportionment?.sourceDocId,
        ...identityChainEvidence.map((item) => item.docId),
        ...(aggregation.paymentEvidenceNormalized || []).map((item) => item.sourceDocId),
      ]),
      facts: normalizeFacts(
        manualActions.slice(-5).map((item) => ({
          label: `${item.label} (${item.actor})`,
          value: `${item.detail || "已处理"} ${item.timestamp ? `@ ${new Date(item.timestamp).toLocaleString("zh-CN")}` : ""}`.trim(),
        }))
      ),
      manualActions,
    });
  }

  return {
    traceId: `trace-${claimCaseId}`,
    generatedAt: generatedAt || new Date().toISOString(),
    domainModel: domainModel || null,
    claimScenario: scenario,
    stages: traceStages,
  };
}

export function buildDecisionTraceForReport({ aggregationResult = {}, report }) {
  const baseTrace = aggregationResult.decisionTrace || {
    traceId: `trace-${report.claimCaseId}`,
    generatedAt: report.generatedAt,
    stages: [],
  };
  const stages = Array.isArray(baseTrace.stages) ? [...baseTrace.stages] : [];
  const reportItems = Array.isArray(report.items) ? report.items : [];
  stages.push({
    stage: "damage_calculation",
    title: "定损计算",
    status: "completed",
    summary: `损失合计 ${report.subTotal.toFixed(2)}，责任系数 ${report.liabilityAdjustment.toFixed(2)}，最终金额 ${report.finalAmount.toFixed(2)}`,
    sourceDocIds: uniqueValues(reportItems.flatMap((item) => item.sourceDocIds || [])),
    facts: normalizeFacts([
      { label: "损失合计", value: `¥${report.subTotal.toFixed(2)}` },
      { label: "责任系数", value: `${(report.liabilityAdjustment * 100).toFixed(0)}%` },
      { label: "抵扣金额", value: `¥${report.deductionTotal.toFixed(2)}` },
      { label: "最终金额", value: `¥${report.finalAmount.toFixed(2)}` },
    ]),
  });
  return {
    traceId: baseTrace.traceId || `trace-${report.claimCaseId}`,
    generatedAt: baseTrace.generatedAt || report.generatedAt,
    stages,
  };
}
