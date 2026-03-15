const STAGE_LABELS = {
  intake: "受理",
  parse: "解析/OCR",
  liability: "定责",
  assessment: "定损",
};

function toTime(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function sortByTimeAsc(items = []) {
  return [...items].sort((a, b) => (toTime(a.timestamp) || 0) - (toTime(b.timestamp) || 0));
}

function sortByTimeDesc(items = []) {
  return [...items].sort((a, b) => (toTime(b.timestamp) || 0) - (toTime(a.timestamp) || 0));
}

function latestBy(items = [], predicate) {
  return sortByTimeDesc(items.filter(predicate))[0] || null;
}

function earliestDate(values = []) {
  const valid = values.filter(Boolean).sort((a, b) => (toTime(a) || 0) - (toTime(b) || 0));
  return valid[0];
}

function latestDate(values = []) {
  const valid = values.filter(Boolean).sort((a, b) => (toTime(b) || 0) - (toTime(a) || 0));
  return valid[0];
}

function mapMaterialActor(source) {
  if (source === "direct_upload") return "customer";
  if (source === "offline_import") return "manual";
  return "system";
}

function createEvent(base) {
  return {
    id: base.id,
    type: base.type,
    timestamp: base.timestamp,
    actorType: base.actorType,
    actorName: base.actorName,
    claimId: base.claimId,
    materialId: base.materialId,
    materialName: base.materialName,
    documentId: base.documentId,
    success: base.success !== false,
    summary: base.summary,
    details: base.details || {},
  };
}

function extractReviewSnapshot(log) {
  const output = log?.outputData || {};
  return {
    intakeDecision: output.intakeDecision,
    liabilityDecision: output.liabilityDecision,
    assessmentDecision: output.assessmentDecision,
    settlementDecision: output.settlementDecision,
    manualReviewReasons: output.manualReviewReasons || [],
    missingMaterials: output.missingMaterials || [],
    coverageResults: output.coverageResults || [],
  };
}

function buildStageTimeline({
  claimCase,
  claimMaterials,
  logs,
  reviewTasks,
  latestImportTask = null,
}) {
  const reportTimestamp = claimCase?.reportTime || claimCase?.createdAt || null;

  const completenessLogs = sortByTimeDesc(
    logs.filter(
      (log) =>
        log.operationType === "UPLOAD_FILE" &&
        log.outputData?.completeness,
    ),
  );
  const latestCompletenessLog = completenessLogs[0] || null;
  const latestCompleteness = latestCompletenessLog?.outputData?.completeness || null;

  const processedMaterials = claimMaterials.filter((material) => material.processedAt);
  const failedMaterials = claimMaterials.filter((material) => material.status === "failed");
  const successfulMaterials = claimMaterials.filter(
    (material) => material.status === "completed",
  );

  const latestReviewLog = latestBy(
    logs,
    (log) =>
      log.operationType === "ANALYZE_DOCUMENT" ||
      log.operationType === "QUICK_ANALYZE",
  );
  const reviewSnapshot = extractReviewSnapshot(latestReviewLog);
  const completedReviewTasks = sortByTimeDesc(
    reviewTasks.filter((task) => task.status === "已完成" && task.completedAt),
  );
  const latestManualLiabilityLog = latestBy(
    logs,
    (log) =>
      log.operationType === "CLAIM_ACTION" &&
      log.outputData?.actionType === "MANUAL_LIABILITY_COMPLETED",
  );
  const latestManualAssessmentLog = latestBy(
    logs,
    (log) =>
      log.operationType === "CLAIM_ACTION" &&
      log.outputData?.actionType === "MANUAL_ASSESSMENT_COMPLETED",
  );

  const intakeStage = {
    key: "intake",
    label: STAGE_LABELS.intake,
    status: "pending",
    startedAt:
      earliestDate([
        reportTimestamp,
        earliestDate(claimMaterials.map((material) => material.uploadedAt)),
      ]) || undefined,
    completedAt: undefined,
    completedBy: undefined,
    summary: "待提交并校验材料",
    blockingReason: undefined,
  };

  if (latestCompleteness?.isComplete) {
    intakeStage.status = "completed";
    intakeStage.completedAt = latestCompletenessLog.timestamp;
    intakeStage.completedBy = "system";
    intakeStage.summary = "材料齐全，已完成受理";
  } else if (claimMaterials.length > 0) {
    intakeStage.status = "processing";
    intakeStage.summary = "已收到材料，等待完整性校验";
    if (latestCompleteness?.missingMaterials?.length) {
      intakeStage.blockingReason = `缺少 ${latestCompleteness.missingMaterials.join("、")}`;
      intakeStage.summary = "材料待补齐";
    }
  }

  if (claimCase?.acceptedAt) {
    intakeStage.status = claimCase.acceptedBy === "manual" ? "manual_completed" : "completed";
    intakeStage.completedAt = claimCase.acceptedAt;
    intakeStage.completedBy = claimCase.acceptedBy || "system";
    intakeStage.summary =
      claimCase.acceptedBy === "manual" ? "人工已完成受理" : "材料齐全，已完成受理";
  }

  const parseStage = {
    key: "parse",
    label: STAGE_LABELS.parse,
    status: "pending",
    startedAt: intakeStage.completedAt || undefined,
    completedAt: undefined,
    completedBy: undefined,
    summary: "待进入解析/OCR",
    blockingReason: undefined,
  };

  if (intakeStage.status === "completed") {
    if (
      latestImportTask &&
      ["pending", "processing", "archived"].includes(latestImportTask.status)
    ) {
      const completedCount = latestImportTask.progress?.completed || 0;
      const totalCount = latestImportTask.progress?.total || claimMaterials.length || 0;
      parseStage.status = "processing";
      parseStage.summary =
        totalCount > 0
          ? `离线导入处理中，已完成 ${completedCount}/${totalCount} 份材料`
          : "离线导入任务处理中";
    } else if (
      latestImportTask &&
      ["failed", "partial_success"].includes(latestImportTask.status)
    ) {
      const failedCount = latestImportTask.progress?.failed || failedMaterials.length || 0;
      parseStage.status = "failed";
      parseStage.completedAt = latestImportTask.completedAt || undefined;
      parseStage.completedBy = "system";
      parseStage.summary =
        latestImportTask.status === "partial_success"
          ? `离线导入部分完成，${failedCount} 份材料待恢复`
          : "离线导入失败，待恢复";
      parseStage.blockingReason = "可在案件详情或赔案清单中执行恢复任务";
    } else if (claimMaterials.length === 0) {
      parseStage.status = "pending";
      parseStage.summary = "暂无待解析材料";
    } else if (
      completedReviewTasks.length > 0 &&
      successfulMaterials.length + failedMaterials.length >= claimMaterials.length
    ) {
      parseStage.status = "manual_completed";
      parseStage.completedAt = completedReviewTasks[0].completedAt;
      parseStage.completedBy = "manual";
      parseStage.summary = `人工完成 ${completedReviewTasks.length} 项材料复核`;
    } else if (failedMaterials.length > 0) {
      parseStage.status = "failed";
      parseStage.completedAt = latestDate(
        failedMaterials.map((material) => material.processedAt || material.uploadedAt),
      );
      parseStage.completedBy = "system";
      parseStage.summary = `${failedMaterials.length} 份材料解析失败`;
      parseStage.blockingReason = failedMaterials
        .map((material) => material.fileName)
        .slice(0, 3)
        .join("、");
    } else if (processedMaterials.length === claimMaterials.length) {
      parseStage.status = "completed";
      parseStage.completedAt = latestDate(processedMaterials.map((material) => material.processedAt));
      parseStage.completedBy = "system";
      parseStage.summary = `已完成 ${processedMaterials.length} 份材料解析`;
    } else if (processedMaterials.length > 0) {
      parseStage.status = "processing";
      parseStage.summary = `已解析 ${processedMaterials.length}/${claimMaterials.length} 份材料`;
    } else {
      parseStage.status = "processing";
      parseStage.summary = "材料已受理，正在解析/OCR";
    }
  } else if (intakeStage.status === "processing") {
    parseStage.blockingReason = "待受理完成";
  }

  if (claimCase?.parsedAt) {
    parseStage.status = claimCase.parsedBy === "manual" ? "manual_completed" : "completed";
    parseStage.completedAt = claimCase.parsedAt;
    parseStage.completedBy = claimCase.parsedBy || "system";
    parseStage.summary =
      claimCase.parsedBy === "manual" ? "人工已完成解析" : parseStage.summary;
  }

  const liabilityStage = {
    key: "liability",
    label: STAGE_LABELS.liability,
    status: "pending",
    startedAt: parseStage.completedAt || undefined,
    completedAt: undefined,
    completedBy: undefined,
    summary: "待进入定责",
    blockingReason: undefined,
  };

  if (parseStage.status === "completed") {
    if (latestManualLiabilityLog) {
      liabilityStage.status = "manual_completed";
      liabilityStage.completedAt = latestManualLiabilityLog.timestamp;
      liabilityStage.completedBy = "manual";
      liabilityStage.summary = "人工已完成定责";
    } else if (reviewSnapshot.liabilityDecision) {
      if (reviewSnapshot.liabilityDecision === "MANUAL_REVIEW") {
        liabilityStage.status = "processing";
        liabilityStage.summary = "已触发人工复核";
        liabilityStage.blockingReason = "等待责任确认";
      } else {
        liabilityStage.status = "completed";
        liabilityStage.completedAt = latestReviewLog?.timestamp;
        liabilityStage.completedBy = "system";
        liabilityStage.summary =
          reviewSnapshot.liabilityDecision === "ACCEPT"
            ? "系统已完成定责"
            : "系统已完成拒赔判定";
      }
    } else {
      liabilityStage.status = "processing";
      liabilityStage.summary = "解析完成，等待定责";
    }
  } else if (parseStage.status === "failed") {
    liabilityStage.blockingReason = "解析失败，无法进入定责";
  } else {
    liabilityStage.blockingReason = "待解析/OCR完成";
  }

  if (claimCase?.liabilityCompletedAt) {
    liabilityStage.status =
      claimCase.liabilityCompletedBy === "manual" ? "manual_completed" : "completed";
    liabilityStage.completedAt = claimCase.liabilityCompletedAt;
    liabilityStage.completedBy = claimCase.liabilityCompletedBy || "system";
    liabilityStage.summary =
      claimCase.liabilityCompletedBy === "manual"
        ? "人工已完成定责"
        : claimCase.liabilityDecision === "REJECT"
          ? "系统已完成拒赔判定"
          : "系统已完成定责";
  }

  const assessmentStage = {
    key: "assessment",
    label: STAGE_LABELS.assessment,
    status: "pending",
    startedAt: liabilityStage.completedAt || undefined,
    completedAt: undefined,
    completedBy: undefined,
    summary: "待进入定损",
    blockingReason: undefined,
  };

  if (liabilityStage.status === "completed") {
    if (latestManualAssessmentLog) {
      assessmentStage.status = "manual_completed";
      assessmentStage.completedAt = latestManualAssessmentLog.timestamp;
      assessmentStage.completedBy = "manual";
      assessmentStage.summary = "人工已完成定损";
    } else if (reviewSnapshot.assessmentDecision) {
      if (["ASSESSED", "PARTIAL_ASSESSED"].includes(reviewSnapshot.assessmentDecision)) {
        assessmentStage.status =
          reviewSnapshot.assessmentDecision === "PARTIAL_ASSESSED"
            ? "processing"
            : "completed";
        assessmentStage.completedAt =
          reviewSnapshot.assessmentDecision === "ASSESSED"
            ? latestReviewLog?.timestamp
            : undefined;
        assessmentStage.completedBy =
          reviewSnapshot.assessmentDecision === "ASSESSED" ? "system" : undefined;
        assessmentStage.summary =
          reviewSnapshot.assessmentDecision === "ASSESSED"
            ? "系统已完成定损"
            : "系统已完成部分定损";
      } else if (reviewSnapshot.assessmentDecision === "UNABLE_TO_ASSESS") {
        assessmentStage.status = "failed";
        assessmentStage.summary = "无法完成定损";
      } else {
        assessmentStage.status = "processing";
        assessmentStage.summary = "等待定损完成";
      }
    } else {
      assessmentStage.status = "processing";
      assessmentStage.summary = "定责完成，等待定损";
    }
  } else if (liabilityStage.status === "processing") {
    assessmentStage.blockingReason = "待定责完成";
  } else if (liabilityStage.status === "manual_completed") {
    if (latestManualAssessmentLog) {
      assessmentStage.status = "manual_completed";
      assessmentStage.completedAt = latestManualAssessmentLog.timestamp;
      assessmentStage.completedBy = "manual";
      assessmentStage.summary = "人工已完成定损";
    } else {
      assessmentStage.status = "processing";
      assessmentStage.summary = "人工定责完成，等待定损";
    }
  } else {
    assessmentStage.blockingReason = "待上一阶段";
  }

  if (claimCase?.assessmentCompletedAt) {
    assessmentStage.status =
      claimCase.assessmentCompletedBy === "manual" ? "manual_completed" : "completed";
    assessmentStage.completedAt = claimCase.assessmentCompletedAt;
    assessmentStage.completedBy = claimCase.assessmentCompletedBy || "system";
    assessmentStage.summary =
      claimCase.assessmentCompletedBy === "manual"
        ? "人工已完成定损"
        : "系统已完成定损";
  }

  return {
    stages: [intakeStage, parseStage, liabilityStage, assessmentStage],
    latestReviewLog,
    reviewSnapshot,
    latestCompletenessLog,
    completedReviewTasks,
    latestManualLiabilityLog,
    latestManualAssessmentLog,
  };
}

function buildEvents({
  claimCase,
  claimMaterials,
  logs,
  latestReviewLog,
  reviewSnapshot,
  latestCompletenessLog,
  reviewTasks,
}) {
  const events = [];

  if (claimCase?.reportTime || claimCase?.createdAt) {
    events.push(
      createEvent({
        id: `claim-reported-${claimCase.id}`,
        type: "CLAIM_REPORTED",
        timestamp: claimCase.reportTime || claimCase.createdAt,
        actorType: "customer",
        actorName: claimCase.reporter || "报案人",
        claimId: claimCase.id,
        success: true,
        summary: "提交报案",
        details: {
          reportNumber: claimCase.reportNumber,
          status: claimCase.status,
        },
      }),
    );
  }

  claimMaterials.forEach((material) => {
    events.push(
      createEvent({
        id: `material-uploaded-${material.id}`,
        type: "MATERIAL_UPLOADED",
        timestamp: material.uploadedAt,
        actorType: mapMaterialActor(material.source),
        claimId: material.claimCaseId,
        materialId: material.materialId,
        materialName: material.materialName || material.fileName,
        documentId: material.id,
        success: true,
        summary: `上传材料：${material.fileName}`,
        details: {
          fileName: material.fileName,
          source: material.source,
          status: material.status,
        },
      }),
    );

    if (material.processedAt) {
      events.push(
        createEvent({
          id: `ocr-completed-${material.id}`,
          type: "OCR_COMPLETED",
          timestamp: material.processedAt,
          actorType: "system",
          claimId: material.claimCaseId,
          materialId: material.materialId,
          materialName: material.materialName || material.fileName,
          documentId: material.id,
          success: material.status === "completed",
          summary:
            material.status === "completed"
              ? `OCR完成：${material.fileName}`
              : `OCR失败：${material.fileName}`,
          details: {
            fileName: material.fileName,
            ocrEngine: material.metadata?.ocrEngine,
            confidence: material.confidence,
            error: material.classificationError,
          },
        }),
      );

      if (material.extractedData && Object.keys(material.extractedData).length > 0) {
        events.push(
          createEvent({
            id: `extract-completed-${material.id}`,
            type: "STRUCTURED_EXTRACTION_COMPLETED",
            timestamp: material.processedAt,
            actorType: "system",
            claimId: material.claimCaseId,
            materialId: material.materialId,
            materialName: material.materialName || material.fileName,
            documentId: material.id,
            success: true,
            summary: `结构化提取完成：${material.fileName}`,
            details: {
              extractedFieldCount: Object.keys(material.extractedData).length,
            },
          }),
        );
      }
    }
  });

  if (latestCompletenessLog?.outputData?.completeness) {
    const completeness = latestCompletenessLog.outputData.completeness;
    events.push(
      createEvent({
        id: `completeness-${latestCompletenessLog.logId}`,
        type: completeness.isComplete
          ? "MATERIAL_COMPLETENESS_PASSED"
          : "MATERIAL_COMPLETENESS_FAILED",
        timestamp: latestCompletenessLog.timestamp,
        actorType: "system",
        actorName: "系统",
        claimId: latestCompletenessLog.claimId,
        success: !!completeness.isComplete,
        summary: completeness.isComplete
          ? "材料齐全，受理完成"
          : "完整性校验未通过",
        details: {
          score: completeness.score,
          missingMaterials: completeness.missingMaterials || [],
        },
      }),
    );
  }

  if (latestReviewLog && reviewSnapshot.liabilityDecision) {
    events.push(
      createEvent({
        id: `liability-${latestReviewLog.logId}`,
        type:
          reviewSnapshot.liabilityDecision === "MANUAL_REVIEW"
            ? "MANUAL_REVIEW_REQUESTED"
            : "LIABILITY_AUTO_COMPLETED",
        timestamp: latestReviewLog.timestamp,
        actorType: "system",
        actorName: "系统",
        claimId: latestReviewLog.claimId,
        success: reviewSnapshot.liabilityDecision !== "MANUAL_REVIEW",
        summary:
          reviewSnapshot.liabilityDecision === "ACCEPT"
            ? "系统完成定责"
            : reviewSnapshot.liabilityDecision === "REJECT"
              ? "系统判定拒赔"
              : "系统转人工复核",
        details: {
          liabilityDecision: reviewSnapshot.liabilityDecision,
          missingMaterials: reviewSnapshot.missingMaterials,
          manualReviewReasons: reviewSnapshot.manualReviewReasons,
        },
      }),
    );
  }

  if (
    latestReviewLog &&
    reviewSnapshot.assessmentDecision &&
    ["ASSESSED", "PARTIAL_ASSESSED"].includes(reviewSnapshot.assessmentDecision)
  ) {
    events.push(
      createEvent({
        id: `assessment-${latestReviewLog.logId}`,
        type: "ASSESSMENT_AUTO_COMPLETED",
        timestamp: latestReviewLog.timestamp,
        actorType: "system",
        actorName: "系统",
        claimId: latestReviewLog.claimId,
        success: true,
        summary:
          reviewSnapshot.assessmentDecision === "ASSESSED"
            ? "系统完成定损"
            : "系统完成部分定损",
        details: {
          assessmentDecision: reviewSnapshot.assessmentDecision,
          coverageResults: reviewSnapshot.coverageResults,
        },
      }),
    );
  }

  logs
    .filter(
      (log) =>
        log.operationType === "CLAIM_ACTION" &&
        [
          "MANUAL_MATERIAL_REVIEW_COMPLETED",
          "MANUAL_LIABILITY_COMPLETED",
          "MANUAL_ASSESSMENT_COMPLETED",
        ].includes(log.outputData?.actionType),
    )
    .forEach((log) => {
      const actionType = log.outputData?.actionType;
      events.push(
        createEvent({
          id: `claim-action-${log.logId}`,
          type:
            actionType === "MANUAL_LIABILITY_COMPLETED"
              ? "LIABILITY_MANUAL_COMPLETED"
              : actionType === "MANUAL_ASSESSMENT_COMPLETED"
                ? "ASSESSMENT_MANUAL_COMPLETED"
                : "STRUCTURED_EXTRACTION_COMPLETED",
          timestamp: log.timestamp,
          actorType: "manual",
          actorName: log.userName || log.outputData?.reviewerName || "人工处理",
          claimId: log.claimId,
          materialId: log.inputData?.materialId,
          materialName: log.inputData?.materialName,
          success: true,
          summary:
            actionType === "MANUAL_LIABILITY_COMPLETED"
              ? "人工完成定责"
              : actionType === "MANUAL_ASSESSMENT_COMPLETED"
                ? "人工完成定损"
                : `人工完成材料复核：${log.inputData?.materialName || "材料"}`,
          details: {
            manualReviewNotes: log.outputData?.manualReviewNotes || "",
            assessmentDecision: log.outputData?.assessmentDecision,
            liabilityDecision: log.outputData?.liabilityDecision,
          },
        }),
      );
    });

  reviewTasks.forEach((task) => {
    events.push(
      createEvent({
        id: `manual-review-requested-${task.id}`,
        type: "MANUAL_REVIEW_REQUESTED",
        timestamp: task.createdAt,
        actorType: "system",
        actorName: task.createdBy || "系统",
        claimId: task.claimCaseId,
        materialId: task.materialId,
        materialName: task.materialName,
        documentId: task.documentId,
        success: true,
        summary: `发起人工复核：${task.materialName}`,
        details: {
          taskType: task.taskType,
          priority: task.priority,
          status: task.status,
        },
      }),
    );

    if (task.completedAt) {
      events.push(
        createEvent({
          id: `manual-review-completed-${task.id}`,
          type: "STRUCTURED_EXTRACTION_COMPLETED",
          timestamp: task.completedAt,
          actorType: "manual",
          actorName: task.reviewerName || "人工处理",
          claimId: task.claimCaseId,
          materialId: task.materialId,
          materialName: task.materialName,
          documentId: task.documentId,
          success: true,
          summary: `人工完成材料复核：${task.materialName}`,
          details: {
            taskType: task.taskType,
            manualReviewNotes: task.manualReviewNotes || "",
          },
        }),
      );
    }
  });

  return sortByTimeDesc(events);
}

export function buildClaimProcessTimeline({
  claimCase,
  claimMaterials = [],
  logs = [],
  reviewTasks = [],
  latestImportTask = null,
}) {
  const orderedLogs = sortByTimeAsc(logs);
  const {
    stages,
    latestReviewLog,
    reviewSnapshot,
    latestCompletenessLog,
  } =
    buildStageTimeline({
      claimCase,
      claimMaterials,
      logs: orderedLogs,
      reviewTasks,
      latestImportTask,
    });

  const events = buildEvents({
    claimCase,
    claimMaterials,
    logs: orderedLogs,
    latestReviewLog,
    reviewSnapshot,
    latestCompletenessLog,
    reviewTasks,
  });

  return {
    stages,
    events,
    source: "derived",
  };
}
