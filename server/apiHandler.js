import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OSS from "ali-oss";
import crypto from "crypto";
import {
  checkEligibility,
  calculateAmount,
  executeFullReview,
} from "./rules/engine.js";
import {
  normalizeRulesetPayload,
  validateRulesetPayload,
} from "./rules/schema.js";
import {
  logAIReview,
  AuditLogType,
  aiCostTracker,
  writeAuditLog,
  readAuditLogs,
} from "./middleware/index.js";
import { reviewTaskService } from "./services/reviewTaskService.js";

// 导入多文件处理服务
import {
  processFile,
  processFiles,
  getFileCategory,
  inferDocumentType,
} from "./services/fileProcessor.js";
import { readData, writeData } from "./utils/fileStore.js";
import {
  analyzeMultiFiles,
  checkDocumentCompleteness,
} from "./services/multiFileAnalyzer.js";

// 导入定损理算服务
import {
  executeCalculation,
  getAvailableFormulas,
  getFormulaDetail,
  saveFormula as saveFormulaConfig,
} from "./services/calculationEngine.js";
import {
  assessDamage,
  getSupportedInsuranceTypes,
} from "./services/assessmentFactory.js";
import {
  classify,
  getExpenseCategories,
  getSocialSecurityTypes,
} from "./services/expenseClassifier.js";
import { getAllStandards as getInjuryStandards } from "./services/injuryAssessment.js";

// 导入人伤案件处理服务
import {
  preprocessFiles,
  isContainerFormat,
  getContainerType,
} from "./services/preprocessor.js";
import { checkDuplicatesBatch } from "./services/duplicateDetector.js";
import { extractDocumentSummaries } from "./services/summaryExtractors/index.js";
import { aggregateCase } from "./services/caseAggregator.js";

// 导入任务队列和消息中心
import {
  createTask,
  getTask,
  getUserTasks,
  updateTask,
  resetFileForRetry,
  deleteTask,
  getQueueStats,
} from "./taskQueue/queue.js";
import { processFileWithRetry } from "./taskQueue/worker.js";
import scheduler from "./taskQueue/scheduler.js";
import {
  createTaskCompleteMessage,
  classifyTaskRecoveryIssue,
  createTaskRecoveredMessage,
  getMessages,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteMessage,
  deleteAllRead,
} from "./messageCenter/messageService.js";
import { generateDamageReport } from "./services/reportGenerator.js";
import { buildCaseValidationChecklist } from "./services/caseValidationService.js";
import { buildDecisionTrace } from "./services/decisionTraceService.js";
import { summarizeHandlingProfile } from "./services/handlingProfileService.js";
import {
  generateGeminiContent,
  invokeAICapability,
  toLegacyAIInteractionLog,
} from "./services/aiRuntime.js";
import { queryLogs as queryAIInteractionLogs } from "./services/aiInteractionLogger.js";
import { buildClaimProcessTimeline } from "./services/claimTimelineService.js";
import {
  loadBufferForClaimMaterial,
  processClaimMaterial,
} from "./services/claimMaterialPipeline.js";
import {
  getAIInventory,
  getAISettingsSnapshot,
  renderPromptTemplate,
  resolveAICapability,
  updateAISettings,
} from "./services/aiConfigService.js";
import { loadEnvConfig as loadEnvFromFile } from "./utils/loadEnvConfig.js";

// ============ 操作日志辅助函数 ============

/**
 * 将审计日志类型映射为操作类型
 */
function mapAuditTypeToOperationType(auditType) {
  const typeMap = {
    'RULE_EXECUTION': 'AI_REVIEW',
    'AI_REVIEW': 'AI_REVIEW',
    'CLAIM_ACTION': 'CLAIM_ACTION',
    'API_CALL': 'SYSTEM_CALL',
    'TASK_CREATE': 'TASK_CREATE',
    'TASK_RETRY': 'TASK_RETRY',
    'IMPORT_TASK_CREATE': 'IMPORT_MATERIALS',
  };
  return typeMap[auditType] || 'SYSTEM_CALL';
}

/**
 * 格式化审计日志为可读标签
 */
function formatAuditLogLabel(log) {
  const labels = {
    'RULE_EXECUTION': `规则执行: ${log.rulesetId || '未知规则'}`,
    'AI_REVIEW': `AI智能审核${log.decision ? ` - ${log.decision}` : ''}`,
    'CLAIM_ACTION': `案件操作: ${log.action || '未知操作'}`,
    'API_CALL': `系统调用: ${log.endpoint || log.type}`,
    'TASK_CREATE': `创建处理任务 (${log.fileCount || 0}个文件)`,
    'TASK_RETRY': `重试处理任务`,
    'IMPORT_TASK_CREATE': `导入离线材料 (${log.fileCount || 0}个文件)`,
  };
  return labels[log.type] || log.type;
}

function rebuildDecisionTraceForClaim({ claimCaseId, aggregation, latestRecord }) {
  const claimCase = (readData("claim-cases") || []).find((item) => item.id === claimCaseId) || null;
  const materials = (readData("claim-materials") || [])
    .filter((item) => item.claimCaseId === claimCaseId)
    .map((item) => ({
      ...item,
      documentId: item.documentId || item.id,
    }));
  const summaries = (latestRecord?.documents || [])
    .map((doc) => doc.documentSummary)
    .filter(Boolean);
  const operationLogs = (readData("user-operation-logs") || []).filter(
    (item) => item.claimId === claimCaseId
  );
  const enrichedAggregation = {
    ...aggregation,
  };
  enrichedAggregation.handlingProfile = summarizeHandlingProfile({
    claimCase,
    aggregation: enrichedAggregation,
    materials,
  });
  enrichedAggregation.domainModel = enrichedAggregation.handlingProfile?.domainModel || null;

  return buildDecisionTrace({
    claimCaseId,
    claimCase,
    materials,
    summaries,
    aggregation: enrichedAggregation,
    operationLogs,
  });
}

function normalizeIfRulesetResource(resource, payload) {
  if (resource !== "rulesets") {
    return payload;
  }
  return normalizeRulesetPayload(payload);
}

function normalizeIfClaimsMaterialsResource(resource, payload) {
  if (resource !== "claims-materials") {
    return payload;
  }
  return normalizeClaimsMaterialPayload(payload);
}

function normalizeFieldKey(value) {
  return String(value || "").trim();
}

function getAllowedMaterialIdsForFact(fact, materials) {
  if (Array.isArray(fact?.allowed_material_ids) && fact.allowed_material_ids.length > 0) {
    return fact.allowed_material_ids;
  }
  if (Array.isArray(fact?.allowed_material_categories) && fact.allowed_material_categories.length > 0) {
    return (materials || [])
      .filter((material) => material?.category && fact.allowed_material_categories.includes(material.category))
      .map((material) => material.id);
  }
  return [];
}

function collectSchemaFieldPaths(fields = [], prefix = "") {
  const paths = [];
  for (const field of fields || []) {
    const key = normalizeFieldKey(field?.field_key);
    if (!key) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push({
      path,
      factId: field?.fact_id || "",
    });
    if (field?.data_type === "OBJECT") {
      paths.push(...collectSchemaFieldPaths(field.children || [], path));
    }
    if (field?.data_type === "ARRAY") {
      paths.push(...collectSchemaFieldPaths(field.item_fields || [], `${path}[]`));
    }
  }
  return paths;
}

function normalizeSchemaFields(material = {}) {
  return ((material?.schemaFields || [])).map((field) => ({ ...field }));
}

function collectFactBindingsFromSchemaFields(fields = [], prefix = "") {
  const bindings = [];
  for (const field of fields || []) {
    const key = normalizeFieldKey(field?.field_key);
    if (!key) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (field?.fact_id) {
      bindings.push({
        fact_id: field.fact_id,
        field_key: path,
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

function buildJsonSchemaFromFields(fields = []) {
  const properties = {};
  const required = [];

  for (const field of fields || []) {
    const key = normalizeFieldKey(field?.field_key);
    if (!key) continue;
    if (field?.required) {
      required.push(key);
    }

    const typeMap = {
      STRING: "string",
      NUMBER: "number",
      BOOLEAN: "boolean",
      DATE: "string",
    };

    if (field?.data_type === "OBJECT") {
      properties[key] = JSON.parse(buildJsonSchemaFromFields(field.children || []));
      continue;
    }

    if (field?.data_type === "ARRAY") {
      properties[key] = {
        type: "array",
        description: field?.description || field?.field_label || key,
        items: JSON.parse(buildJsonSchemaFromFields(field.item_fields || [])),
      };
      continue;
    }

    properties[key] = {
      type: typeMap[field?.data_type] || "string",
      description: field?.description || field?.field_label || key,
    };

    if (field?.data_type === "DATE") {
      properties[key].format = "date";
    }
  }

  const schema = {
    type: "object",
    properties,
  };
  if (required.length > 0) {
    schema.required = required;
  }
  return JSON.stringify(schema, null, 2);
}

function normalizeClaimsMaterialPayload(payload) {
  const normalizeOne = (item = {}) => {
    const schemaFields = normalizeSchemaFields(item);
    return {
      ...item,
      schemaFields,
      jsonSchema: buildJsonSchemaFromFields(schemaFields),
    };
  };

  return Array.isArray(payload) ? payload.map(normalizeOne) : normalizeOne(payload);
}

function validateClaimsMaterialItem(item, facts, allMaterials) {
  const errors = [];
  const factMap = new Map((facts || []).map((fact) => [fact.fact_id, fact]));
  const schemaFields = item?.schemaFields || [];
  const schemaPaths = collectSchemaFieldPaths(schemaFields);
  const schemaFieldKeys = schemaPaths
    .map((field) => normalizeFieldKey(field.path))
    .filter(Boolean);
  const bindingFieldKeys = collectFactBindingsFromSchemaFields(schemaFields)
    .map((binding) => normalizeFieldKey(binding.field_key))
    .filter(Boolean);

  const materialFieldKeys = schemaFieldKeys;
  const duplicateMaterialFieldKeys = materialFieldKeys.filter((key, index) => materialFieldKeys.indexOf(key) !== index);
  if (duplicateMaterialFieldKeys.length > 0) {
    errors.push(`材料 ${item?.name || item?.id || "unknown"} 的 schema 字段存在重复路径：${[...new Set(duplicateMaterialFieldKeys)].join("、")}`);
  }

  const duplicateBindingFieldKeys = bindingFieldKeys.filter((key, index) => bindingFieldKeys.indexOf(key) !== index);
  if (duplicateBindingFieldKeys.length > 0) {
    errors.push(`材料 ${item?.name || item?.id || "unknown"} 的事实绑定存在重复 schema 字段：${[...new Set(duplicateBindingFieldKeys)].join("、")}`);
  }

  const allBindings = collectFactBindingsFromSchemaFields(schemaFields);

  for (const binding of allBindings) {
    const factId = binding?.fact_id;
    const fact = factMap.get(factId);
    if (!fact) {
      errors.push(`材料 ${item?.name || item?.id || "unknown"} 绑定了不存在的标准事实字段：${factId}`);
      continue;
    }

    const allowedMaterialIds = getAllowedMaterialIdsForFact(fact, allMaterials);
    if (fact?.source_type === "material" && allowedMaterialIds.length > 0 && !allowedMaterialIds.includes(item?.id)) {
      errors.push(`标准事实 ${factId} 不允许绑定到材料模板 ${item?.name || item?.id}`);
    }
  }

  return errors;
}

function validateIfClaimsMaterialsResource(resource, payload) {
  if (resource !== "claims-materials") {
    return [];
  }

  const facts = readData("fact-catalog") || [];
  const normalizedPayload = normalizeClaimsMaterialPayload(payload);
  const allMaterials = Array.isArray(normalizedPayload) ? normalizedPayload : [normalizedPayload];
  return allMaterials.flatMap((item) => validateClaimsMaterialItem(item, facts, allMaterials));
}

function validateIfRulesetResource(resource, payload) {
  if (resource !== "rulesets") {
    return [];
  }
  return validateRulesetPayload(payload);
}

/**
 * 检测设备类型
 */
function detectDeviceType(userAgent) {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod/.test(ua)) {
    if (/ipad/.test(ua)) return 'tablet';
    return 'mobile';
  }
  if (/tablet|ipad/.test(ua)) return 'tablet';
  return 'desktop';
}

/**
 * 根据文件名推断 MIME 类型
 */
function inferFileType(fileName) {
  if (!fileName) return 'application/octet-stream';
  const ext = fileName.split('.').pop()?.toLowerCase();
  const typeMap = {
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
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'webm': 'video/webm',
    'txt': 'text/plain',
    'csv': 'text/csv',
  };
  return typeMap[ext] || 'application/octet-stream';
}

function resolveLocalImportPath(inputPath) {
  if (!inputPath || typeof inputPath !== "string") {
    throw new Error("Missing directoryPath");
  }

  const candidate = path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(projectRoot, inputPath);
  const normalized = path.normalize(candidate);
  if (!normalized.startsWith(projectRoot)) {
    throw new Error("directoryPath must stay within the current project");
  }
  if (!fs.existsSync(normalized)) {
    throw new Error("directoryPath does not exist");
  }
  if (!fs.statSync(normalized).isDirectory()) {
    throw new Error("directoryPath must be a directory");
  }
  return normalized;
}

function collectLocalCaseFiles(directoryPath) {
  const supportedExtensions = new Set([
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".mp4", ".mov", ".avi", ".mkv", ".webm",
    ".txt", ".csv",
  ]);
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!supportedExtensions.has(ext)) continue;

      const relativePath = path.relative(directoryPath, fullPath);
      files.push({
        fileName: relativePath,
        mimeType: inferFileType(entry.name),
        localPath: fullPath,
      });
    }
  }

  walk(directoryPath);
  files.sort((a, b) => a.fileName.localeCompare(b.fileName, "zh-CN"));
  return files;
}

function createOSSClient() {
  const region = process.env.ALIYUN_OSS_REGION || "oss-cn-beijing";
  const bucket = process.env.ALIYUN_OSS_BUCKET;
  const accessKeyId = process.env.ALIYUN_OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_OSS_ACCESS_KEY_SECRET;

  if (!bucket || !accessKeyId || !accessKeySecret) {
    throw new Error("OSS credentials not configured");
  }

  return new OSS({
    region,
    accessKeyId,
    accessKeySecret,
    bucket,
  });
}

function buildLocalCaseOssKey(claimCaseId, relativeFileName) {
  const normalizedPath = String(relativeFileName || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) =>
      segment
        .replace(/[^\u4e00-\u9fa5a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 120) || "file"
    )
    .join("/");

  return `claims/${claimCaseId}/offline-import/${crypto.randomUUID()}-${normalizedPath}`;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const currentIndex = cursor++;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length || 1)) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

async function uploadLocalCaseFilesToOSS(files, { claimCaseId }) {
  const client = createOSSClient();

  return mapWithConcurrency(files, 3, async (file) => {
    const buffer = await fs.promises.readFile(file.localPath);
    const ossKey = buildLocalCaseOssKey(claimCaseId, file.fileName);
    const result = await client.put(ossKey, buffer, {
      mime: file.mimeType || inferFileType(file.fileName),
    });

    return {
      ...file,
      ossKey,
      publicUrl: result.url,
      url: client.signatureUrl(ossKey, { expires: 3600 }),
    };
  });
}

function upsertPendingOfflineImportMaterials({
  claimCaseId,
  taskId,
  importId,
  importedAt,
  files,
}) {
  const allMaterials = readData("claim-materials");

  for (const file of files) {
    const existingIndex = allMaterials.findIndex(
      (item) =>
        item.claimCaseId === claimCaseId &&
        item.fileName === file.fileName &&
        item.source === "offline_import"
    );

    const nextMaterial = {
      id:
        existingIndex !== -1
          ? allMaterials[existingIndex].id
          : `mat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      claimCaseId,
      fileName: file.fileName,
      fileType: file.mimeType || inferFileType(file.fileName),
      url: file.url || "#",
      ossKey: file.ossKey,
      category:
        existingIndex !== -1
          ? allMaterials[existingIndex].category || "待识别"
          : "待识别",
      materialName:
        existingIndex !== -1
          ? allMaterials[existingIndex].materialName || "待识别"
          : "待识别",
      materialId:
        existingIndex !== -1
          ? allMaterials[existingIndex].materialId || "unknown"
          : "unknown",
      source: "offline_import",
      status: "processing",
      uploadedAt: importedAt,
      taskId,
      sourceDetail: {
        importId,
        importedAt,
        taskId,
      },
    };

    if (existingIndex !== -1) {
      allMaterials[existingIndex] = {
        ...allMaterials[existingIndex],
        ...nextMaterial,
      };
    } else {
      allMaterials.push(nextMaterial);
    }
  }

  writeData("claim-materials", allMaterials);
}

function upsertPendingImportRecord({
  claimCaseId,
  productCode,
  taskId,
  importId,
  importedAt,
  files,
}) {
  const allClaimDocs = readData("claim-documents");
  const documents = files.map((file, index) => ({
    documentId: `${taskId}-${index}`,
    fileName: file.fileName,
    fileType: file.mimeType,
    mimeType: file.mimeType,
    ossKey: file.ossKey,
    ossUrl: file.url || null,
    classification: {
      materialId: "unknown",
      materialName: "待识别",
      confidence: 0,
    },
    status: "processing",
    extractedText: "",
    structuredData: {},
    errorMessage: null,
  }));

  const record = {
    id: importId,
    taskId,
    claimCaseId,
    productCode,
    importedAt,
    documents,
    aggregation: null,
    completeness: {
      isComplete: false,
      completenessScore: 0,
      requiredMaterials: [],
      providedMaterials: [],
      missingMaterials: [],
      warnings: ["材料已上传至 OSS，后台识别处理中"],
    },
  };

  const existingIndex = allClaimDocs.findIndex((item) => item.taskId === taskId);
  if (existingIndex !== -1) {
    allClaimDocs[existingIndex] = {
      ...allClaimDocs[existingIndex],
      ...record,
    };
  } else {
    allClaimDocs.push(record);
  }

  writeData("claim-documents", allClaimDocs);
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
    !["PENDING_MATERIAL", "MANUAL_REVIEW", "UNABLE_TO_ASSESS"].includes(stageDecision)
  );
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
    coverageResults,
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

  if (
    reviewResult.decision === "APPROVE" &&
    reviewResult.settlementDecision === "PAY"
  ) {
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

function syncClaimStageFields(claimCaseId, reviewResult, options = {}) {
  if (!claimCaseId || !reviewResult) {
    return;
  }

  const claimCases = readData("claim-cases") || [];
  const claimIndex = claimCases.findIndex((item) => item.id === claimCaseId);
  if (claimIndex === -1) {
    return;
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

  if (
    options.parseCompleted &&
    (!claimCase.parsedAt || !claimCase.parsedBy)
  ) {
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
      (claimCase.approvedAmount == null && getNormalizedReviewAmount(reviewResult) != null))
  ) {
    patch.assessmentCompletedAt = claimCase.assessmentCompletedAt || nowIso;
    patch.assessmentCompletedBy =
      claimCase.assessmentCompletedBy ||
      getAutoCompletedBy(options.assessmentStatus);
    if (!claimCase.assessmentDecision) {
      patch.assessmentDecision = reviewResult.assessmentDecision;
    }
    if (claimCase.approvedAmount == null && getNormalizedReviewAmount(reviewResult) != null) {
      patch.approvedAmount = getNormalizedReviewAmount(reviewResult);
    }
  }

  if (Object.keys(patch).length === 0) {
    return;
  }

  claimCases[claimIndex] = {
    ...claimCase,
    ...patch,
  };
  writeData("claim-cases", claimCases);
}

/**
 * 将 fileCategories 同步到 claim-materials
 * @param {string} claimCaseId - 案件 ID
 * @param {Array} fileCategories - 文件分类数组
 */
function syncFileCategoriesToMaterials(claimCaseId, fileCategories) {
  try {
    const allMaterials = readData("claim-materials");
    const materialCatalog = readData("claims-materials") || [];
    const now = new Date().toISOString();

    const resolveMaterialConfig = (categoryName) => {
      if (!categoryName || !Array.isArray(materialCatalog)) return null;
      return (
        materialCatalog.find((item) => item.name === categoryName) ||
        materialCatalog.find(
          (item) => categoryName.includes(item.name) || item.name.includes(categoryName),
        ) ||
        null
      );
    };

    for (const category of fileCategories || []) {
      for (const file of category.files || []) {
        const matchedMaterialConfig = resolveMaterialConfig(category.name);
        const existingIndex = allMaterials.findIndex(
          (m) => m.claimCaseId === claimCaseId &&
                 m.fileName === file.name &&
                 m.source === "direct_upload"
        );
        if (!file.name) {
          continue;
        }

        const nextMaterial = {
          id:
            existingIndex >= 0
              ? allMaterials[existingIndex].id
              : `mat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          claimCaseId,
          fileName: file.name,
          fileType: inferFileType(file.name),
          url: file.url || "#",
          ossKey: file.ossKey,
          category: category.name,
          materialId:
            matchedMaterialConfig?.id ||
            (existingIndex >= 0 ? allMaterials[existingIndex].materialId : undefined),
          materialName:
            matchedMaterialConfig?.name ||
            category.name ||
            (existingIndex >= 0 ? allMaterials[existingIndex].materialName : undefined),
          source: "direct_upload",
          status:
            existingIndex >= 0
              ? allMaterials[existingIndex].status || "pending"
              : "pending",
          uploadedAt:
            existingIndex >= 0
              ? allMaterials[existingIndex].uploadedAt || now
              : now,
          updatedAt: now,
        };

        if (existingIndex >= 0) {
          allMaterials[existingIndex] = {
            ...allMaterials[existingIndex],
            ...nextMaterial,
          };
        } else {
          allMaterials.push({
            ...nextMaterial,
            processedAt: null,
          });
        }
      }
    }

    writeData("claim-materials", allMaterials);
    console.log(`[Sync] Synced fileCategories to claim-materials for claim ${claimCaseId}`);
  } catch (error) {
    console.error("[Sync] Failed to sync fileCategories:", error);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, "jsonlist");

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const getFilePath = (resource) => path.join(dataDir, `${resource}.json`);

loadEnvFromFile({
  forceKeys: [
    "ALIYUN_OSS_REGION",
    "ALIYUN_OSS_ACCESS_KEY_ID",
    "ALIYUN_OSS_ACCESS_KEY_SECRET",
    "ALIYUN_OSS_BUCKET",
  ],
});

// ID field candidates for matching records
const ID_FIELDS = [
  "id",
  "productCode",
  "code",
  "ruleset_id",
  "field_id",
  "reportNumber",
];

const findItemIndex = (data, id) => {
  if (!Array.isArray(data)) return -1;
  return data.findIndex((item) => {
    for (const field of ID_FIELDS) {
      if (item[field] !== undefined && String(item[field]) === String(id)) {
        return true;
      }
    }
    return false;
  });
};

// Parse request body helper (works with both raw and pre-parsed bodies)
const parseBody = (req) => {
  return new Promise((resolve, reject) => {
    // If body is already parsed (e.g. by express.json()), use it directly
    if (req.body !== undefined && req.body !== null) {
      resolve(req.body);
      return;
    }
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
};

const GLM_OCR_URL = "https://open.bigmodel.cn/api/paas/v4/layout_parsing";
const GLM_CHAT_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
// RapidOCR 服务地址（启动: python server/paddle_ocr_server.py）
const PADDLE_OCR_URL =
  process.env.PADDLE_OCR_URL || "http://localhost:8866/predict/ocr_system";

const getGeminiApiKey = () =>
  process.env.GEMINI_API_KEY ||
  process.env.VITE_GEMINI_API_KEY ||
  process.env.API_KEY;

const loadGraphEngines = async () => {
  const module = await import("./ai/graph.js");
  return {
    executeSmartReviewGraph: module.executeSmartReviewGraph,
    executeSmartReviewGraphV2: module.executeSmartReviewGraphV2,
  };
};

const loadGraphCheckpointer = async () => {
  const module = await import("./ai/graph-with-checkpointer.js");
  return {
    executeSmartReviewWithState: module.executeSmartReviewWithState,
    getReviewState: module.getReviewState,
    submitHumanReview: module.submitHumanReview,
    clearReviewState: module.clearReviewState,
  };
};

const formatErrorMessage = (error) => {
  if (error instanceof Error) {
    const causeMessage =
      error.cause instanceof Error ? error.cause.message : "";
    return causeMessage
      ? `${error.message} | Cause: ${causeMessage}`
      : error.message;
  }
  return "Unknown error";
};

const extractJsonFromText = (text) => {
  if (!text || typeof text !== "string") return "";
  const cleaned = text
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return cleaned.slice(first, last + 1);
  }
  return cleaned;
};

const callGlmChat = async ({ apiKey, model, messages, temperature = 0 }) => {
  const response = await fetch(GLM_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GLM Chat Failed: ${errorText}`);
  }

  return response.json();
};

const hasInlineData = (contents) => {
  const parts = Array.isArray(contents?.parts) ? contents.parts : [];
  return parts.some(
    (part) => part && typeof part === "object" && part.inlineData,
  );
};

const getGeminiModelCandidates = (requested, contents) => {
  const candidates = [];
  if (requested) candidates.push(requested);
  const envDefault =
    process.env.GEMINI_MODEL || process.env.DEFAULT_GEMINI_MODEL;
  if (envDefault && !candidates.includes(envDefault))
    candidates.push(envDefault);
  const visionFallbacks = ["gemini-2.5-flash", "gemini-2.5-pro"];
  const textFallbacks = ["gemini-2.5-flash", "gemini-2.5-pro"];
  const fallbackList = hasInlineData(contents)
    ? visionFallbacks
    : textFallbacks;
  fallbackList.forEach((model) => {
    if (!candidates.includes(model)) candidates.push(model);
  });
  return candidates;
};

const callGemini = async ({ model, contents, temperature = 0.1 }) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API Key not found");
  }
  const candidates = getGeminiModelCandidates(model, contents);
  let lastError;
  for (const candidate of candidates) {
    try {
      const { response } = await generateGeminiContent({
        apiKey,
        request: {
          model: candidate,
          contents,
          config: {
            responseMimeType: "application/json",
            temperature,
          },
        },
        meta: {
          sourceApp: "admin-system",
          module: "apiHandler",
          operation: "api_handler_call_gemini",
          context: {},
        },
      });
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Gemini request failed: ${formatErrorMessage(lastError)}`);
};

/**
 * 使用 AI 对材料进行分类
 * @param {object} result - processFile 的结果
 * @param {string} fileName - 文件名
 * @returns {Promise<object>} 分类结果
 */
async function classifyMaterial(result, fileName) {
  if (result.parseStatus !== "completed") {
    return {
      materialId: "unknown",
      materialName: "未识别",
      confidence: 0,
    };
  }

  try {
    const materials = readData("claims-materials");
    if (materials.length === 0) {
      return {
        materialId: "unknown",
        materialName: "未识别",
        confidence: 0,
      };
    }

    // 构建紧凑目录（避免 prompt 过长）
    const catalog = materials
      .map((m) => `${m.id}|${m.name}|${m.description.slice(0, 60)}`)
      .join("\n");

    const ocrText = result.extractedText || "";
    const prompt = [
      {
        role: "user",
        parts: [
          {
            text: `你是保险理赔材料分类专家。请根据以下 OCR 文字内容，从材料目录中选出最匹配的材料类型。\n\n【OCR 文字】\n${ocrText.slice(0, 1200)}\n\n【文件名参考】${fileName}\n\n【材料目录（格式: id|名称|说明摘要）】\n${catalog}\n\n请返回 JSON：{"materialId":"...","materialName":"...","confidence":0.0到1.0之间的小数,"reason":"简短说明"}。若无匹配则 materialId 填 "unknown"，materialName 填 "未识别"，confidence 填 0。`,
          },
        ],
      },
    ];

    const response = await callGemini({
      model: "gemini-2.5-flash",
      contents: prompt,
      temperature: 0.1,
    });

    const raw =
      response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed = {};
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      // JSON 解析失败则保持 unknown
    }

    const classification = {
      materialId: parsed.materialId || "unknown",
      materialName: parsed.materialName || "未识别",
      confidence:
        typeof parsed.confidence === "number" ? parsed.confidence : 0,
    };
    console.log(
      `[classify] ${fileName} → ${classification.materialName} (${(classification.confidence * 100).toFixed(0)}%)`,
    );
    return classification;
  } catch (classifyErr) {
    console.warn("[classify] 分类失败，跳过:", classifyErr.message);
    return {
      materialId: "unknown",
      materialName: "未识别",
      confidence: 0,
    };
  }
}

// Supported resources
const allowedResources = [
  "products",
  "clauses",
  "strategies",
  "companies",
  "industry-data",
  "insurance-types",
  "responsibilities",
  "claims-materials",
  "claim-items",
  "fact-catalog",
  "material-validation-rules",
  "claim-cases",
  "rulesets",
  "product-claim-configs",
  "category-material-configs",
  "accident-cause-configs",
  "end-users",
  "users",
  "mapping-data",
  "medical-insurance-catalog",
  "hospital-info",
  "invoice-audits",
  "user-operation-logs",
  "quotes",
  "policies",
  "claim-documents",
  "system-logs",
  "review-tasks",
  "ai",
  "batch-upload-oss",
  "batch-classify",
  "import-offline-materials-v2",
  "intake-field-presets",
];

export const handleApiRequest = async (req, res) => {
  console.log(`[API] Request: ${req.method} ${req.url}`);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const match = url.pathname.match(/^\/api\/([^/]+)(?:\/(.+))?$/);

  if (!match) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not Found" }));
    return;
  }

  const resource = match[1];
  const id = match[2] ? decodeURIComponent(match[2]) : null;

  // 批量 OSS 直传凭证 API
  if (resource === "batch-upload-oss") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const body = await parseBody(req);
      const files = (body && Array.isArray(body.files)) ? body.files : [];
      const expiresSec = Number(body?.expires ?? 3600) || 3600;

      // OSS 配置
      const region = process.env.ALIYUN_OSS_REGION || "oss-cn-beijing";
      const bucket = process.env.ALIYUN_OSS_BUCKET;
      const accessKeyId = process.env.ALIYUN_OSS_ACCESS_KEY_ID;
      const accessKeySecret = process.env.ALIYUN_OSS_ACCESS_KEY_SECRET;

      if (!bucket || !accessKeyId || !accessKeySecret) {
        throw new Error("OSS credentials not configured on server");
      }

      // 形成 host
      const regionForHost = region.startsWith("oss-") ? region.replace("oss-", "") : region;
      const host = `https://${bucket}.oss-${regionForHost}.aliyuncs.com`;

      const policyBase64For = (keyPrefix) => {
        const expiration = new Date(Date.now() + expiresSec * 1000).toISOString();
        const policy = {
          expiration,
          conditions: [
            { bucket },
            ["starts-with", "$key", keyPrefix],
            ["content-length-range", 0, 10485760], // 10MB
          ],
        };
        const policyJson = JSON.stringify(policy);
        return Buffer.from(policyJson).toString("base64");
      };

      const results = files.map((f) => {
        // 简单兜底：如果没有文件名，跳过并返回空对象
        const name = (f && f.name) || "untitled";
        // 统一生成 key，前缀设为 uploads/
        const key = `uploads/${Date.now()}_${Math.random().toString(36).slice(2)}_${name}`;
        const policy = policyBase64For("" + ("uploads/"));
        // 签名使用 policyBase64 的值
        const signature = crypto
          .createHmac("sha1", accessKeySecret)
          .update(policy)
          .digest("base64");
        return {
          name,
          key,
          policy,
          signature,
          accessid: accessKeyId,
          host,
          url: `https://${bucket}.oss-${regionForHost}.aliyuncs.com/${key}`,
          expires: new Date(Date.now() + expiresSec * 1000).toISOString(),
        };
      });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          bucket,
          endpoint: host,
          files: results.filter(r => r && r.name),
        }),
      );
    } catch (error) {
      console.error("[API] Batch OSS credentials failed:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 代理上传文件到OSS (解决CORS问题)
  if (resource === "upload-to-oss") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { fileName, fileType, base64Data } = await parseBody(req);
      
      if (!base64Data || !fileName) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing file data or filename" }));
        return;
      }

      const buffer = Buffer.from(base64Data, "base64");
      
      // 生成唯一的OSS key
      const key = `uploads/${Date.now()}_${Math.random().toString(36).slice(2)}_${fileName}`;
      
      // OSS配置
      const region = process.env.ALIYUN_OSS_REGION || "oss-cn-beijing";
      const bucket = process.env.ALIYUN_OSS_BUCKET;
      const accessKeyId = process.env.ALIYUN_OSS_ACCESS_KEY_ID;
      const accessKeySecret = process.env.ALIYUN_OSS_ACCESS_KEY_SECRET;

      if (!bucket || !accessKeyId || !accessKeySecret) {
        throw new Error("OSS credentials not configured");
      }

      const client = new OSS({
        region,
        accessKeyId,
        accessKeySecret,
        bucket,
      });

      // 上传到OSS
      const result = await client.put(key, buffer, {
        mime: fileType || "image/jpeg",
      });

      // 生成签名URL
      const signedUrl = client.signatureUrl(key, { expires: 3600 });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          ossKey: key,
          url: signedUrl,
          publicUrl: result.url,
        })
      );
    } catch (error) {
      console.error("[API] Upload to OSS failed:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 快速导入API - 仅存档，后台异步处理
  if (resource === "offline-import" && id === "quick") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const body = await parseBody(req);
      const { claimCaseId, productCode, files } = body;

      if (!claimCaseId || !files || !Array.isArray(files) || files.length === 0) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId or files" }));
        return;
      }

      // 创建任务，初始状态为 archived
      const taskFiles = files.map((file, index) => ({
        index,
        fileName: file.fileName,
        mimeType: file.mimeType || "image/jpeg",
        ossKey: file.ossKey,
        status: "archived",
        stages: {
          archive: {
            status: "completed",
            completedAt: new Date().toISOString(),
          },
          classification: {
            status: "pending",
          },
          extraction: {
            status: "pending",
          },
        },
      }));

      let task = await createTask(claimCaseId, productCode, taskFiles, null, {
        source: "offline-import-quick",
        useV2: true,
      });

      task.status = "archived";
      await updateTask(task.id, {
        status: "archived",
        files: taskFiles,
      });

      // 记录审计日志
      writeAuditLog({
        type: "IMPORT_TASK_CREATE",
        claimCaseId,
        taskId: task.id,
        fileCount: files.length,
        useQuickImport: true,
      });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          taskId: task.id,
          message: "导入成功，后台识别中",
          totalFiles: files.length,
        })
      );
    } catch (error) {
      console.error("[API] Quick import failed:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  if (resource === "offline-import" && id === "local-case-folder") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const body = await parseBody(req);
      const { claimCaseId, productCode, directoryPath } = body;

      if (!claimCaseId || !directoryPath) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId or directoryPath" }));
        return;
      }

      const resolvedPath = resolveLocalImportPath(directoryPath);
      const localFiles = collectLocalCaseFiles(resolvedPath);
      if (localFiles.length === 0) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "No supported files found in directoryPath" }));
        return;
      }

      const userId = req.headers["x-user-id"] || "local-import";
      const uploadedFiles = await uploadLocalCaseFilesToOSS(localFiles, {
        claimCaseId,
      });
      const task = await createTask(claimCaseId, productCode, uploadedFiles, userId, {
        source: "offline-import-local-case-folder-oss",
        useLocalFiles: false,
        rootDirectory: resolvedPath,
      });
      const importedAt = new Date().toISOString();
      const importId = `import-${Date.now()}`;

      upsertPendingOfflineImportMaterials({
        claimCaseId,
        taskId: task.id,
        importId,
        importedAt,
        files: uploadedFiles,
      });
      upsertPendingImportRecord({
        claimCaseId,
        productCode,
        taskId: task.id,
        importId,
        importedAt,
        files: uploadedFiles,
      });

      writeAuditLog({
        type: "IMPORT_TASK_CREATE",
        claimCaseId,
        taskId: task.id,
        fileCount: uploadedFiles.length,
        source: "local-case-folder",
        directoryPath: resolvedPath,
        timestamp: new Date().toISOString(),
      });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          taskId: task.id,
          message: "本地案卷目录已上传 OSS，并进入后台分析队列",
          totalFiles: uploadedFiles.length,
          directoryPath: resolvedPath,
          files: uploadedFiles.map((file) => ({
            fileName: file.fileName,
            mimeType: file.mimeType,
            ossKey: file.ossKey,
          })),
        }),
      );
    } catch (error) {
      console.error("[API] Local case folder import failed:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  if (resource === "offline-import" && id === "recover-task") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const body = await parseBody(req);
      const { taskId } = body;

      if (!taskId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing taskId" }));
        return;
      }

      loadEnvFromFile({
        forceKeys: [
          "ALIYUN_OSS_REGION",
          "ALIYUN_OSS_ACCESS_KEY_ID",
          "ALIYUN_OSS_ACCESS_KEY_SECRET",
          "ALIYUN_OSS_BUCKET",
        ],
      });

      const task = getTask(taskId);
      if (!task) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Task not found" }));
        return;
      }

      const recoverableFiles = task.files.filter((file) => file.status !== "completed");
      const recoveredFiles = [];

      for (const file of recoverableFiles) {
        const result = await processFileWithRetry(
          task.id,
          file,
          file.index,
          file.retryCount || 0,
          task.options || {},
        );

        recoveredFiles.push({
          index: file.index,
          fileName: file.fileName,
          success: result.success,
          error: result.error || null,
        });
      }

      const refreshedTask = getTask(taskId);
      if (!refreshedTask) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "Task refresh failed after recovery" }));
        return;
      }

      const allProcessed = refreshedTask.files.every(
        (file) => file.status === "completed" || file.status === "failed",
      );

      if (allProcessed) {
        await scheduler.completeTask(refreshedTask);
      }

      const finalTask = getTask(taskId) || refreshedTask;
      const userId = req.headers["x-user-id"] || "anonymous";

      createTaskRecoveredMessage(userId, finalTask, {
        recoveredFiles,
      });

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        success: true,
        taskId,
        claimCaseId: finalTask.claimCaseId,
        recoveredFiles,
        status: finalTask.status,
        completed: finalTask.files.filter((file) => file.status === "completed").length,
        failed: finalTask.files.filter((file) => file.status === "failed").length,
        postProcessedAt: finalTask.postProcessedAt || null,
      }));
    } catch (error) {
      console.error("[API] Recover offline task failed:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 批量材料分类 API
  if (resource === "batch-classify") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const body = await parseBody(req);
      const { ossKeys, mimeTypes } = body;

      if (!Array.isArray(ossKeys) || ossKeys.length === 0) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing or invalid ossKeys" }));
        return;
      }

      // 并发控制：最多3个并行
      const CONCURRENCY = 3;
      const results = [];

      // 批量处理函数
      async function processBatch(keys, types) {
        const batchResults = [];
        for (let i = 0; i < keys.length; i += CONCURRENCY) {
          const batch = keys.slice(i, i + CONCURRENCY);
          const batchPromises = batch.map(async (key, idx) => {
            const actualIdx = i + idx;
            try {
              // 获取签名URL
              const region = process.env.ALIYUN_OSS_REGION || "oss-cn-beijing";
              const bucket = process.env.ALIYUN_OSS_BUCKET;
              const accessKeyId = process.env.ALIYUN_OSS_ACCESS_KEY_ID;
              const accessKeySecret = process.env.ALIYUN_OSS_ACCESS_KEY_SECRET;

              if (!bucket || !accessKeyId || !accessKeySecret) {
                throw new Error("OSS credentials not configured");
              }

              const client = new OSS({
                region,
                accessKeyId,
                accessKeySecret,
                bucket,
              });

              const signedUrl = client.signatureUrl(key, { expires: 3600 });

              // 下载文件
              const response = await fetch(signedUrl);
              if (!response.ok) {
                throw new Error(`Failed to download file: ${response.status}`);
              }

              const buffer = Buffer.from(await response.arrayBuffer());
              const mimeType = (types && types[actualIdx]) || "image/jpeg";

              // 处理文件
              const processResult = await processFile({
                fileName: key.split('/').pop() || 'file',
                mimeType,
                buffer,
                options: { skipOCR: false },
              });

              // 分类
              const classification = await classifyMaterialFromAPI(processResult, key);

              return {
                ossKey: key,
                status: 'success',
                classification,
              };
            } catch (error) {
              console.error(`[Batch Classify] Error processing ${key}:`, error);
              return {
                ossKey: key,
                status: 'failed',
                error: error.message,
                classification: {
                  materialId: 'unknown',
                  materialName: '未识别',
                  confidence: 0,
                },
              };
            }
          });

          const batchResult = await Promise.all(batchPromises);
          batchResults.push(...batchResult);
        }
        return batchResults;
      }

      const classifyResults = await processBatch(ossKeys, mimeTypes);

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          data: {
            total: ossKeys.length,
            completed: classifyResults.filter(r => r.status === 'success').length,
            failed: classifyResults.filter(r => r.status === 'failed').length,
            results: classifyResults,
          },
        })
      );
    } catch (error) {
      console.error("[API] Batch classify failed:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 新版离线材料导入 API (v2 - 使用 OSS Key)
  if (resource === "import-offline-materials-v2") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const body = await parseBody(req);
      const { claimCaseId, productCode, ossKeys, mimeTypes, classifications } = body;

      if (!claimCaseId || !productCode) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId or productCode" }));
        return;
      }

      if (!Array.isArray(ossKeys) || ossKeys.length === 0) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing or invalid ossKeys" }));
        return;
      }

      // 创建任务数据
      const files = ossKeys.map((key, index) => ({
        index,
        fileName: key.split('/').pop() || `file-${index}`,
        mimeType: (mimeTypes && mimeTypes[index]) || "image/jpeg",
        ossKey: key,
        classification: (classifications && classifications[index]) || null,
        status: 'pending',
      }));

      // 创建异步任务
      const task = await createTask(claimCaseId, productCode, files, null, {
        useV2: true,
        source: 'offline-import-v2',
      });

      // 记录审计日志
      writeAuditLog({
        type: 'IMPORT_TASK_CREATE',
        claimCaseId,
        taskId: task.id,
        fileCount: files.length,
        useV2: true,
      });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          taskId: task.id,
          message: "Import task created successfully",
          totalFiles: files.length,
        })
      );
    } catch (error) {
      console.error("[API] Import offline materials v2 failed:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  if (resource === "upload-token") {
    const config = {
      region: process.env.ALIYUN_OSS_REGION,
      accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
      bucket: process.env.ALIYUN_OSS_BUCKET,
    };

    console.log("[API] Requested upload-token. Current Config:", {
      region: config.region,
      bucket: config.bucket,
      hasKeyId: !!config.accessKeyId,
      hasSecret: !!config.accessKeySecret,
    });

    if (!config.accessKeyId) {
      console.error("[API] OSS credentials missing in process.env");
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: "OSS credentials not configured on server",
          hint: "Please ensure .env.local in root is set and server restarted if needed.",
        }),
      );
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(config));
    return;
  }

  if (resource === "upload") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { fileName, fileType, base64 } = await parseBody(req);
      if (!base64) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing base64 data" }));
        return;
      }

      let config = {
        region: process.env.ALIYUN_OSS_REGION,
        accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
        bucket: process.env.ALIYUN_OSS_BUCKET,
      };

      // Fallback to local storage if OSS is not configured or upload fails
      let uploadToOssFailed = false;
      if (!config.accessKeyId || !config.accessKeySecret || !config.bucket) {
        console.warn(
          "[API] OSS credentials not configured. Falling back to local storage.",
        );
        uploadToOssFailed = true;
      }

      const buffer = Buffer.from(base64, "base64");
      // Use generating a unique filename if none provided
      // Ensure directory exists for local storage structure simulation
      const finalFileName =
        fileName ||
        `claims/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

      if (!uploadToOssFailed) {
        try {
          const client = new OSS(config);
          console.log(`[API] Uploading to OSS via Proxy: ${finalFileName}`);
          const result = await client.put(finalFileName, buffer, {
            mime: fileType || "image/jpeg",
          });

          res.setHeader("Content-Type", "application/json");
          const signedUrl = client.signatureUrl(finalFileName, {
            expires: 3600,
          });
          res.end(
            JSON.stringify({
              success: true,
              url: signedUrl,
              name: result.name,
              objectKey: finalFileName,
              publicUrl: result.url,
            }),
          );
          return;
        } catch (ossError) {
          console.error("[API] OSS Proxy Upload Failed:", ossError);
          console.warn("[API] Falling back to local storage.");
          uploadToOssFailed = true;
        }
      }

      if (uploadToOssFailed) {
        // Local storage fallback
        const uploadsDir = path.join(projectRoot, "uploads");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Strip directory from filename for local storage to avoid subdirectory issues or ensure they exist
        const localFileName = path.basename(finalFileName);
        const localFilePath = path.join(uploadsDir, localFileName);

        fs.writeFileSync(localFilePath, buffer);
        console.log(`[API] Saved to local storage: ${localFilePath}`);

        const localUrl = `/uploads/${localFileName}`;

        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            success: true,
            url: localUrl,
            name: localFileName,
            objectKey: localFileName,
            publicUrl: localUrl,
          }),
        );
        return;
      }
    } catch (error) {
      console.error("[API] Upload Failed:", error);
      res.statusCode = 500;
      res.end(
        JSON.stringify({ error: "Upload failed", message: error.message }),
      );
    }

    return;
  }

  if (resource === "oss-url") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const key = url.searchParams.get("key");
      const expires = Number(url.searchParams.get("expires") || 3600);
      const mode = url.searchParams.get("mode") || "download";
      if (!key) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing key" }));
        return;
      }

      const config = {
        region: process.env.ALIYUN_OSS_REGION,
        accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
        bucket: process.env.ALIYUN_OSS_BUCKET,
      };

      if (!config.accessKeyId) {
        throw new Error("OSS credentials not configured on server");
      }

      const client = new OSS(config);
      const responseHeaders =
        mode === "preview"
          ? {
              "content-disposition": "inline",
            }
          : undefined;
      const signedUrl = client.signatureUrl(key, {
        expires,
        ...(responseHeaders ? { response: responseHeaders } : {}),
      });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, url: signedUrl }));
    } catch (error) {
      console.error("[API] OSS Signed URL Failed:", error);
      res.statusCode = 500;
      res.end(
        JSON.stringify({ error: "Signed URL failed", message: error.message }),
      );
    }
    return;
  }

  if (resource === "oss-preview") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const key = url.searchParams.get("key");
      if (!key) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing key" }));
        return;
      }

      const config = {
        region: process.env.ALIYUN_OSS_REGION,
        accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
        bucket: process.env.ALIYUN_OSS_BUCKET,
      };

      if (!config.accessKeyId) {
        throw new Error("OSS credentials not configured on server");
      }

      const client = new OSS(config);
      const result = await client.getStream(key);
      const fileName = key.split("/").pop() || "preview.pdf";
      const mimeType =
        result?.res?.headers?.["content-type"] ||
        inferFileType(fileName) ||
        "application/octet-stream";

      res.statusCode = 200;
      res.setHeader("Content-Type", Array.isArray(mimeType) ? mimeType[0] : mimeType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`
      );
      res.setHeader("Cache-Control", "private, max-age=300");

      if (result?.res?.headers?.["content-length"]) {
        res.setHeader("Content-Length", result.res.headers["content-length"]);
      }

      result.stream.on("error", (streamError) => {
        console.error("[API] OSS Preview Stream Error:", streamError);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("OSS preview stream failed");
        } else {
          res.destroy(streamError);
        }
      });
      result.stream.pipe(res);
    } catch (error) {
      console.error("[API] OSS Preview Failed:", error);
      res.statusCode = 500;
      res.end(
        JSON.stringify({ error: "Preview failed", message: error.message }),
      );
    }
    return;
  }

  // 文档解析 API - 根据已配置的材料 schema 和 prompt 提取结构化内容
  if (resource === "parse-document") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { fileUrl, fileName, materialName, jsonSchema, aiAuditPrompt } = await parseBody(req);
      
      if (!fileUrl) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing fileUrl" }));
        return;
      }

      const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
      
      const startTime = Date.now();
      let result = {
        success: true,
        text: "",
        extractedData: {},
        auditConclusion: "",
        confidence: 0,
      };

      // 下载文件内容
      let fileBuffer;
      let mimeType = "image/jpeg";
      
      try {
        // 使用 AbortController 实现超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(fileUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.status}`);
        }
        fileBuffer = Buffer.from(await response.arrayBuffer());
        mimeType = response.headers.get("content-type") || mimeType;
      } catch (e) {
        console.error("[ParseDocument] Failed to download:", e);
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Failed to download file", message: e.message }));
        return;
      }

      // 根据文件类型选择处理方式
      const isImage = mimeType.startsWith("image/");
      const isPdf = mimeType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
      
      if (isImage || isPdf) {
        // 使用 Gemini Vision 进行提取
        const base64Data = fileBuffer.toString("base64");
        
        // 构造提示词：融合材料的 aiAuditPrompt 和 jsonSchema
        const prompt = `你是一个专业的保险理赔材料审核系统。请对上传的「${materialName || '理赔材料'}」进行 OCR 识别和审核。

## 提取要求
请严格根据图片中可见的文字内容提取信息，按以下 JSON Schema 结构提取：
${jsonSchema || '{}'}

## 审核要求
${aiAuditPrompt || '请提取图片中的关键信息并进行校验'}

## 重要规则
1. 只提取图片中**明确可见**的文字和数字，严禁补充、推测或编造任何信息
2. 如果某个区域模糊不清或被遮挡，对应字段返回空字符串，**不要猜测**
3. 数字必须严格按图片显示提取
4. 日期格式统一为 YYYY-MM-DD
5. 无法识别的字段：字符串用空字符串 ""，数字用 0

## 输出格式
请严格返回以下 JSON 格式（不要包含 markdown 代码块标记）：
{
  "extractedData": { ... 按 schema 提取的字段 },
  "auditConclusion": "审核结论文本，包含提取摘要和校验结果",
  "confidence": 0.95
}`;
        
        const { response: geminiResponse } = await generateGeminiContent({
          apiKey: getGeminiApiKey(),
          request: {
            model,
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType, data: base64Data } },
                ],
              },
            ],
          },
          meta: {
            sourceApp: "admin-system",
            module: "apiHandler.parse-document",
            operation: "parse_document",
            context: {
              route: "/api/parse-document",
              fileName,
              materialName,
            },
          },
        });
        
        const responseText = geminiResponse.text || "";
        
        // 提取 JSON
        let extractedData = {};
        let auditConclusion = "";
        let confidence = 0;
        
        try {
          // 尝试解析整个响应为 JSON
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            extractedData = parsed.extractedData || parsed;
            auditConclusion = parsed.auditConclusion || "识别完成";
            confidence = parsed.confidence || 0.8;
          }
        } catch (e) {
          console.error("[ParseDocument] Failed to parse JSON:", e);
          // 如果解析失败，返回原始文本
          auditConclusion = responseText.slice(0, 500);
        }
        
        result = {
          success: true,
          text: responseText,
          extractedData,
          auditConclusion,
          confidence,
          model,
          parseTime: Date.now() - startTime,
        };
      } else {
        // 对于非图片/PDF，返回基本信息
        result = {
          success: true,
          text: `文件类型 ${mimeType} 暂不支持自动解析`,
          extractedData: { fileType: mimeType, fileSize: fileBuffer.length },
          auditConclusion: "不支持的文件类型",
          confidence: 0,
          parseTime: Date.now() - startTime,
        };
      }

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[API] Parse document failed:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Parse failed", message: error.message }));
    }
    return;
  }

  if (resource === "invoice-ocr") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { mode, base64Data, mimeType, prompt, geminiModel, invoiceSchema } =
        await parseBody(req);
      if (!base64Data || !mimeType) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing base64 data or mimeType" }));
        return;
      }

      const rawCapability = resolveAICapability("admin.invoice_ocr.raw_engine");
      const structuringCapability = resolveAICapability("admin.invoice_ocr.structuring");
      const configuredMode = (() => {
        if (mode) return mode;
        switch (rawCapability.binding.provider) {
          case "glm-ocr":
            return "glm-ocr";
          case "paddle-ocr":
            return "paddle-ocr";
          default:
            return "gemini";
        }
      })();
      const structuringProvider =
        mode === "glm-ocr-structured"
          ? "glm-text"
          : structuringCapability.binding.provider;
      const structuringModel =
        structuringProvider === "glm-text"
          ? (process.env.GLM_TEXT_MODEL || process.env.ZHIPU_MODEL || structuringCapability.binding.model || "glm-4.7-flash")
          : (geminiModel || structuringCapability.binding.model || "gemini-2.5-flash");

      const buildStructuringPrompt = (ocrText) =>
        renderPromptTemplate("invoice_structuring", {
          ocrText,
          schemaText: JSON.stringify(invoiceSchema || {}, null, 2),
        });

      // PaddleOCR 模式
      if (configuredMode === "paddle-ocr") {
        const ocrStartTime = Date.now();
        let paddleResponse;
        try {
          paddleResponse = await fetch(PADDLE_OCR_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              images: [`data:${mimeType};base64,${base64Data}`],
            }),
          });
        } catch (error) {
          res.statusCode = 502;
          res.end(
            JSON.stringify({
              error: `Paddle OCR fetch failed: ${formatErrorMessage(error)}`,
            }),
          );
          return;
        }

        if (!paddleResponse.ok) {
          const errorText = await paddleResponse.text();
          res.statusCode = paddleResponse.status;
          res.end(JSON.stringify({ error: `Paddle OCR Failed: ${errorText}` }));
          return;
        }

        const paddleResult = await paddleResponse.json();
        const ocrDuration = Date.now() - ocrStartTime;

        // Paddle OCR 返回结果格式: { results: [{ data: [{ text, confidence, text_region }] }] }
        const ocrTexts = (paddleResult.results?.[0]?.data || [])
          .map((item) => item.text)
          .filter(Boolean);
        const ocrText = ocrTexts.join("\n");
        const parsePrompt = buildStructuringPrompt(ocrText);

        const parsingStartTime = Date.now();
        const parseResponse =
          structuringProvider === "glm-text"
            ? await callGlmChat({
                apiKey: process.env.GLM_OCR_API_KEY || process.env.ZHIPU_API_KEY,
                model: structuringModel,
                messages: [{ role: "user", content: parsePrompt }],
                temperature: 0,
              })
            : await callGemini({
                model: structuringModel,
                contents: { parts: [{ text: parsePrompt }] },
                temperature: 0,
              });
        const parsingDuration = Date.now() - parsingStartTime;
        const parseText =
          structuringProvider === "glm-text"
            ? extractJsonFromText(parseResponse?.choices?.[0]?.message?.content || "")
            : (parseResponse.text || "{}");
        const parseUsage =
          structuringProvider === "glm-text"
            ? parseResponse?.usage
            : parseResponse.usageMetadata;

        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            text: parseText || "{}",
            usageMetadata: {
              ocr: { textLength: ocrText.length },
              parsing: parseUsage,
            },
            timing: {
              ocrDuration,
              parsingDuration,
              totalDuration: ocrDuration + parsingDuration,
            },
          }),
        );
        return;
      }

      if (configuredMode === "glm-ocr" || configuredMode === "glm-ocr-structured") {
        const glmApiKey =
          process.env.GLM_OCR_API_KEY || process.env.ZHIPU_API_KEY;
        if (!glmApiKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "GLM OCR API Key not found" }));
          return;
        }

        const ocrStartTime = Date.now();
        const dataUri = `data:${mimeType};base64,${base64Data}`;
        let glmResponse;
        try {
          glmResponse = await fetch(GLM_OCR_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${glmApiKey}`,
            },
            body: JSON.stringify({
              model: "glm-ocr",
              file: dataUri,
            }),
          });
        } catch (error) {
          res.statusCode = 502;
          res.end(
            JSON.stringify({
              error: `GLM OCR fetch failed: ${formatErrorMessage(error)}`,
            }),
          );
          return;
        }

        if (!glmResponse.ok) {
          const errorText = await glmResponse.text();
          res.statusCode = glmResponse.status;
          res.end(JSON.stringify({ error: `GLM OCR Failed: ${errorText}` }));
          return;
        }

        const glmResult = await glmResponse.json();
        const ocrDuration = Date.now() - ocrStartTime;
        const ocrText = glmResult.md_results || "";
        const parsePrompt = buildStructuringPrompt(ocrText);

        const parsingStartTime = Date.now();
        const parseResponse =
          structuringProvider === "glm-text"
            ? await callGlmChat({
                apiKey: glmApiKey,
                model: structuringModel,
                messages: [{ role: "user", content: parsePrompt }],
                temperature: 0,
              })
            : await callGemini({
                model: structuringModel,
                contents: {
                  parts: [{ text: parsePrompt }],
                },
                temperature: 0,
              });
        const parsingDuration = Date.now() - parsingStartTime;
        const parseText =
          structuringProvider === "glm-text"
            ? extractJsonFromText(parseResponse?.choices?.[0]?.message?.content || "")
            : (parseResponse.text || "{}");
        const parseUsage =
          structuringProvider === "glm-text"
            ? parseResponse?.usage
            : parseResponse.usageMetadata;

        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            text: parseText || "{}",
            usageMetadata: {
              ocr: glmResult.usage,
              parsing: parseUsage,
            },
            timing: {
              ocrDuration,
              parsingDuration,
              totalDuration: ocrDuration + parsingDuration,
            },
          }),
        );
        return;
      }

      const response = await callGemini({
        model: geminiModel || rawCapability.binding.model || "gemini-2.5-flash",
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: prompt || "" },
          ],
        },
        temperature: 0.1,
      });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          text: response.text || "{}",
          usageMetadata: response.usageMetadata,
        }),
      );
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // ============ 规则引擎 API ============

  // 责任判断 API
  if (resource === "claim" && id === "check-eligibility") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { claimCaseId, productCode, ocrData, validationFacts, ruleset } = await parseBody(req);
      if (!claimCaseId && !productCode) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({ error: "Missing claimCaseId or productCode" }),
        );
        return;
      }

      const result = await checkEligibility({
        claimCaseId,
        productCode,
        ocrData,
        validationFacts,
        rulesetOverride: ruleset ? normalizeRulesetPayload(ruleset) : null,
      });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 金额计算 API
  if (resource === "claim" && id === "calculate-amount") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const {
        claimCaseId,
        productCode,
        eligibilityResult,
        invoiceItems,
        ocrData,
        validationFacts,
        ruleset,
      } = await parseBody(req);

      const result = await calculateAmount({
        claimCaseId,
        productCode,
        eligibilityResult,
        invoiceItems,
        ocrData,
        validationFacts,
        rulesetOverride: ruleset ? normalizeRulesetPayload(ruleset) : null,
      });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 完整审核 API（责任判断 + 金额计算）
  if (resource === "claim" && id === "full-review") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { claimCaseId, productCode, ocrData, invoiceItems, validationFacts, ruleset } =
        await parseBody(req);
      if (!claimCaseId && !productCode) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({ error: "Missing claimCaseId or productCode" }),
        );
        return;
      }

      const result = await executeFullReview({
        claimCaseId,
        productCode,
        ocrData,
        invoiceItems,
        validationFacts,
        rulesetOverride: ruleset ? normalizeRulesetPayload(ruleset) : null,
      });
      if (claimCaseId) {
        const claimCases = readData("claim-cases") || [];
        const claimCase = claimCases.find((item) => item.id === claimCaseId);
        if (claimCase) {
          const claimMaterials = (readData("claim-materials") || []).filter(
            (material) => material.claimCaseId === claimCaseId,
          );
          const reviewTasks = (readData("review-tasks") || []).filter(
            (task) => task.claimCaseId === claimCaseId,
          );
          const userLogs = (readData("user-operation-logs") || [])
            .filter((log) => log.claimId === claimCaseId || log.claimCaseId === claimCaseId)
            .map((log) => ({ ...log, logSource: "user" }));
          const auditLogs = readAuditLogs("all", { claimCaseId }).map((log) => ({
            logId: `audit-${log.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: log.timestamp,
            userName: log.operator || "系统",
            operationType: mapAuditTypeToOperationType(log.type),
            operationLabel: formatAuditLogLabel(log),
            claimId: log.claimCaseId,
            claimReportNumber: null,
            currentStatus: log.newStatus || null,
            inputData: log.input || null,
            outputData: log.output || null,
            success: log.success !== false,
            duration: log.duration || null,
            logSource: "system",
          }));
          const timeline = buildClaimProcessTimeline({
            claimCase,
            claimMaterials,
            logs: [...userLogs, ...auditLogs].sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
            ),
            reviewTasks,
          });
          syncClaimStageFields(claimCaseId, result, {
            parseCompleted: ["completed", "manual_completed"].includes(
              timeline?.stages?.find((stage) => stage.key === "parse")?.status,
            ),
            liabilityStatus: timeline?.stages?.find((stage) => stage.key === "liability")?.status,
            assessmentStatus: timeline?.stages?.find((stage) => stage.key === "assessment")?.status,
          });
        }
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // ============ AI 智能审核 API ============

  if (resource === "ai" && id === "inventory") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        capabilities: getAIInventory(),
        config: getAISettingsSnapshot(),
      }));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  if (resource === "ai" && id === "config") {
    if (req.method === "GET") {
      try {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(getAISettingsSnapshot()));
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: formatErrorMessage(error) }));
      }
      return;
    }

    if (req.method === "PUT") {
      try {
        const payload = await parseBody(req);
        const updated = updateAISettings(payload, payload?.metadata?.updatedBy || "admin");
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(updated));
      } catch (error) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: formatErrorMessage(error) }));
      }
      return;
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  // AI 智能审核（LangGraph 版本，默认）
  // 使用环境变量 AI_ENGINE 选择: 'agent' (旧版) | 'graph' (新版) | 'graph-checkpointer' (带状态持久化)
  if (resource === "ai" && id === "smart-review") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const srStartTime = Date.now();
      const { claimCaseId, productCode, ocrData, invoiceItems, engine } =
        await parseBody(req);
      if (!claimCaseId && !productCode) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({ error: "Missing claimCaseId or productCode" }),
        );
        return;
      }

      // 选择 AI 引擎
      const aiEngine = engine || process.env.AI_ENGINE || "graph";

      let result;
      switch (aiEngine) {
        case "agent":
          // 使用旧的 LangChain Agent
          console.log(`[AI] Using agent engine for case ${claimCaseId}`);
          result = await executeSmartReview({
            claimCaseId,
            productCode,
            ocrData,
            invoiceItems,
          });
          break;

        case "graph-checkpointer":
          // 使用 LangGraph + 状态持久化
          console.log(
            `[AI] Using graph-checkpointer engine for case ${claimCaseId}`,
          );
          {
            const { executeSmartReviewWithState } =
              await loadGraphCheckpointer();
            result = await executeSmartReviewWithState({
              claimCaseId,
              productCode,
              ocrData,
              invoiceItems,
            });
          }
          break;

        case "graph":
        default:
          // 使用 LangGraph (推荐)
          console.log(`[AI] Using graph engine for case ${claimCaseId}`);
          {
            const { executeSmartReviewGraph } = await loadGraphEngines();
            result = await executeSmartReviewGraph({
              claimCaseId,
              productCode,
              ocrData,
              invoiceItems,
            });
          }
          break;
      }

      // 添加使用的引擎信息
      result.engine = aiEngine;

      if (claimCaseId) {
        const claimCases = readData("claim-cases") || [];
        const claimCase = claimCases.find((item) => item.id === claimCaseId);
        if (claimCase) {
          const claimMaterials = (readData("claim-materials") || []).filter(
            (material) => material.claimCaseId === claimCaseId,
          );
          const reviewTasks = (readData("review-tasks") || []).filter(
            (task) => task.claimCaseId === claimCaseId,
          );
          const userLogs = (readData("user-operation-logs") || [])
            .filter((log) => log.claimId === claimCaseId || log.claimCaseId === claimCaseId)
            .map((log) => ({ ...log, logSource: "user" }));
          const auditLogs = readAuditLogs("all", { claimCaseId }).map((log) => ({
            logId: `audit-${log.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: log.timestamp,
            userName: log.operator || "系统",
            operationType: mapAuditTypeToOperationType(log.type),
            operationLabel: formatAuditLogLabel(log),
            claimId: log.claimCaseId,
            claimReportNumber: null,
            currentStatus: log.newStatus || null,
            inputData: log.input || null,
            outputData: log.output || null,
            success: log.success !== false,
            duration: log.duration || null,
            logSource: "system",
          }));
          const timeline = buildClaimProcessTimeline({
            claimCase,
            claimMaterials,
            logs: [...userLogs, ...auditLogs].sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
            ),
            reviewTasks,
          });
          syncClaimStageFields(claimCaseId, result, {
            parseCompleted: ["completed", "manual_completed"].includes(
              timeline?.stages?.find((stage) => stage.key === "parse")?.status,
            ),
            liabilityStatus: timeline?.stages?.find((stage) => stage.key === "liability")?.status,
            assessmentStatus: timeline?.stages?.find((stage) => stage.key === "assessment")?.status,
          });
        }
      }

      // 写审计日志
      logAIReview({
        claimCaseId,
        productCode,
        decision: result.decision,
        amount: result.amount,
        toolCalls: result.ruleTrace,
        duration: Date.now() - srStartTime,
        success: true,
      });

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[AI Smart Review Error]", error);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: formatErrorMessage(error),
          decision: "MANUAL_REVIEW",
          reasoning: "智能审核服务异常，请转人工处理",
        }),
      );
    }
    return;
  }

  // 获取审核状态（带状态持久化的版本）
  if (resource === "ai" && id === "review-state") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const claimCaseId = url.searchParams.get("claimCaseId");
      if (!claimCaseId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId" }));
        return;
      }

      const { getReviewState } = await loadGraphCheckpointer();
      const state = await getReviewState(claimCaseId);

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          claimCaseId,
          exists: !!state,
          state,
        }),
      );
    } catch (error) {
      console.error("[AI Review State Error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 提交人工审核（带状态持久化的版本）
  if (resource === "ai" && id === "human-review") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { claimCaseId, decision, auditor, comment } = await parseBody(req);

      if (!claimCaseId || !decision) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId or decision" }));
        return;
      }

      if (!["APPROVE", "REJECT"].includes(decision)) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: "Invalid decision, must be APPROVE or REJECT",
          }),
        );
        return;
      }

      const { submitHumanReview } = await loadGraphCheckpointer();
      const result = await submitHumanReview({
        claimCaseId,
        decision,
        auditor,
        comment,
      });

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[AI Human Review Error]", error);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: formatErrorMessage(error),
          decision: "MANUAL_REVIEW",
          reasoning: "人工审核提交失败",
        }),
      );
    }
    return;
  }

  // 清除审核状态
  if (resource === "ai" && id === "clear-state") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { claimCaseId } = await parseBody(req);
      if (!claimCaseId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId" }));
        return;
      }

      const { clearReviewState } = await loadGraphCheckpointer();
      clearReviewState(claimCaseId);

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, claimCaseId }));
    } catch (error) {
      console.error("[AI Clear State Error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 审计日志查询
  if (resource === "ai" && id === "audit-logs") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const date =
        url.searchParams.get("date") || new Date().toISOString().split("T")[0];
      const type = url.searchParams.get("type") || null;
      const claimCaseId = url.searchParams.get("claimCaseId") || null;

      const logs = readAuditLogs(date, { type, claimCaseId });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          date,
          count: logs.length,
          logs,
        }),
      );
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // AI 调用统计
  if (resource === "ai" && id === "stats") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const stats = aiCostTracker.getStats();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(stats));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  if (resource === "ai" && id === "proxy") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const body = await parseBody(req);
      const {
        model,
        contents: rawContents,
        config,
        meta,
        capabilityId,
        promptTemplateId,
        systemPromptTemplateId,
        templateVariables,
      } = body || {};
      if (!capabilityId && (!model || !rawContents)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing required fields: capabilityId or model+contents" }));
        return;
      }

      let contents = rawContents;
      let mergedConfig = { ...(config || {}) };
      let resolvedCapability = null;
      let resolvedPromptTemplateId = promptTemplateId || null;

      if (capabilityId) {
        resolvedCapability = resolveAICapability(capabilityId);
        if (!contents) {
          const capabilityPromptId = promptTemplateId || resolvedCapability.capability.promptTemplateId;
          if (!capabilityPromptId) {
            throw new Error(`Capability '${capabilityId}' requires contents or promptTemplateId`);
          }
          contents = [{ parts: [{ text: renderPromptTemplate(capabilityPromptId, templateVariables || {}) }] }];
          resolvedPromptTemplateId = capabilityPromptId;
        }

        const effectiveSystemTemplateId = systemPromptTemplateId || null;
        if (effectiveSystemTemplateId && !mergedConfig.systemInstruction) {
          mergedConfig.systemInstruction = renderPromptTemplate(
            effectiveSystemTemplateId,
            templateVariables || {},
          );
        }
      }

      const runtimeMeta = {
        sourceApp: meta?.sourceApp || "frontend-proxy",
        module: meta?.module || "apiHandler.ai-proxy",
        operation: meta?.operation || "frontend_proxy_generate_content",
        context: {
          ...(meta?.context || {}),
          route: "/api/ai/proxy",
          userAgent: req.headers["user-agent"] || null,
        },
        traceId: meta?.traceId,
        sessionId: meta?.sessionId,
        requestId: meta?.requestId,
        containsSensitiveData: meta?.containsSensitiveData !== false,
        capabilityId: capabilityId || null,
        promptTemplateId: resolvedPromptTemplateId,
        promptSourceType: resolvedCapability?.capability?.promptSourceType || null,
      };

      const request = {
        model: model || resolvedCapability?.binding?.model,
        contents,
        config: mergedConfig,
      };

      const { response, logEntry } = capabilityId
        ? await invokeAICapability({
            capabilityId,
            request,
            meta: runtimeMeta,
          })
        : await generateGeminiContent({
            apiKey: getGeminiApiKey(),
            request,
            meta: runtimeMeta,
          });

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        response,
        aiLog: toLegacyAIInteractionLog(logEntry),
      }));
    } catch (error) {
      console.error("[AI Proxy Error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  if (resource === "ai" && id === "interaction-logs") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const params = new URL(req.url, "http://x").searchParams;
      const result = queryAIInteractionLogs({
        logId: params.get("logId") || undefined,
        keyword: params.get("keyword") || undefined,
        claimRef: params.get("claimRef") || undefined,
        fileName: params.get("fileName") || undefined,
        claimCaseId: params.get("claimCaseId") || undefined,
        taskId: params.get("taskId") || undefined,
        fileIndex: params.get("fileIndex") !== null ? Number(params.get("fileIndex")) : undefined,
        sessionId: params.get("sessionId") || undefined,
        traceId: params.get("traceId") || undefined,
        sourceApp: params.get("sourceApp") || undefined,
        module: params.get("module") || undefined,
        success: params.get("success") !== null ? params.get("success") === "true" : undefined,
        startTime: params.get("startTime") || undefined,
        endTime: params.get("endTime") || undefined,
        view: params.get("view") || undefined,
        includeRaw: params.get("includeRaw") === "true",
        limit: params.get("limit") ? Number(params.get("limit")) : undefined,
        offset: params.get("offset") ? Number(params.get("offset")) : undefined,
      });
      if ((params.get("logId") || "").trim() && result.logs.length === 0) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "AI interaction log not found" }));
        return;
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[AI Interaction Logs Error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // ============ 多文件处理 API ============

  // 单文件处理 API
  if (resource === "process-file") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const pfStartTime = Date.now();
      const {
        ossKey,
        ossUrl,
        fileName,
        mimeType,
        base64Data,
        buffer,
        options,
      } = await parseBody(req);

      if (!ossKey && !fileName) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing ossKey or fileName" }));
        return;
      }

      // 处理文件（OCR + 结构化提取）
      const result = await processFile({
        ossKey,
        ossUrl,
        fileName,
        mimeType,
        buffer: buffer ? Buffer.from(buffer, "base64") : null,
        options: {
          ...options,
          base64Data,
        },
      });

      // 如果要求分类且 OCR 成功，调用 AI 对照 claims-materials 目录进行材料类型识别
      if (options?.classify && result.parseStatus === "completed") {
        result.classification = await classifyMaterial(result, fileName);
      }

      // 写审计日志
      writeAuditLog({
        type: AuditLogType.API_CALL,
        endpoint: "POST /api/process-file",
        fileName,
        mimeType,
        parseStatus: result.parseStatus,
        classificationResult: result.classification
          ? `${result.classification.materialName}(${(result.classification.confidence * 100).toFixed(0)}%)`
          : "未分类",
        duration: Date.now() - pfStartTime,
        success: result.parseStatus === "completed",
        error: result.errorMessage || null,
      });

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[process-file error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 多文件联合分析 API
  if (resource === "analyze-multi-files") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { claimCaseId, productCode, documents, options } =
        await parseBody(req);

      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({ error: "Missing or invalid documents array" }),
        );
        return;
      }

      const startTime = Date.now();

      // 1. 处理所有文件
      const parsedDocuments = await processFiles(documents, {
        skipOCR: options?.skipOCR || false,
        skipAI: options?.skipAI || false,
        concurrency: options?.concurrency || 3,
      });

      // 2. 联合分析
      const analysisResult = await analyzeMultiFiles(parsedDocuments, {
        claimCaseId,
        productCode,
        claimInfo: options?.claimInfo,
      });

      const processingTime = Date.now() - startTime;

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          claimCaseId,
          documents: parsedDocuments,
          crossValidation: analysisResult.crossValidation,
          materialValidationResults: analysisResult.materialValidationResults,
          validationFacts: analysisResult.validationFacts,
          completeness: analysisResult.completeness,
          interventionPoints: analysisResult.interventionPoints,
          summary: analysisResult.summary,
          processingTime,
        }),
      );
    } catch (error) {
      console.error("[analyze-multi-files error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 增强版智能审核 API（支持多文件）
  if (resource === "ai" && id === "smart-review-v2") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const {
        claimCaseId,
        productCode,
        ocrData,
        invoiceItems,
        documents,
        engine,
      } = await parseBody(req);

      if (!claimCaseId && !productCode) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({ error: "Missing claimCaseId or productCode" }),
        );
        return;
      }

      // 使用增强版图引擎
      const { executeSmartReviewGraphV2 } = await loadGraphEngines();
      const result = await executeSmartReviewGraphV2({
        claimCaseId,
        productCode,
        ocrData: ocrData || {},
        invoiceItems: invoiceItems || [],
        documents: documents || [],
      });

      result.engine = engine || "graph-v2";

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[AI Smart Review V2 Error]", error);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: formatErrorMessage(error),
          decision: "MANUAL_REVIEW",
          reasoning: "智能审核服务异常，请转人工处理",
        }),
      );
    }
    return;
  }

  // 赔案材料查询 API
  if (resource === "claim-documents" && req.method === "GET") {
    const claimCaseId = url.searchParams.get("claimCaseId");
    const allDocs = readData("claim-documents");
    const taskMap = new Map(
      ((readData("processing-tasks") || {}).tasks || []).map((task) => [task.id, task]),
    );

    if (claimCaseId) {
      // Return all import records for this claim, flattened into a single document list
      const records = allDocs
        .filter((r) => r.claimCaseId === claimCaseId)
        .sort(
          (a, b) =>
            new Date(a.importedAt || 0).getTime() -
            new Date(b.importedAt || 0).getTime(),
        );
      const documents = records.flatMap((r) =>
        (r.documents || []).map((d) => ({
          ...d,
          importedAt: r.importedAt,
          importId: r.id,
        })),
      );
      const latestCompleteness =
        records.length > 0 ? records[records.length - 1].completeness : null;
      const latestAggregation =
        records.length > 0 ? records[records.length - 1].aggregation || null : null;
      const latestValidationFacts =
        records.length > 0 ? records[records.length - 1].validationFacts || {} : {};
      const latestMaterialValidationResults =
        records.length > 0
          ? records[records.length - 1].materialValidationResults || []
          : [];
      const latestRecord = records.length > 0 ? records[records.length - 1] : null;
      const latestTask = latestRecord?.taskId ? getTask(latestRecord.taskId) : null;
      const latestRecoveryIssue = latestTask ? classifyTaskRecoveryIssue(latestTask) : null;
      const claimCase = (readData("claim-cases") || []).find((item) => item.id === claimCaseId) || null;
      const claimMaterials = (readData("claim-materials") || []).filter(
        (item) => item.claimCaseId === claimCaseId,
      );
      const enrichedAggregation = latestAggregation
        ? { ...latestAggregation }
        : null;
      if (enrichedAggregation) {
        enrichedAggregation.handlingProfile =
          summarizeHandlingProfile({
            claimCase,
            aggregation: enrichedAggregation,
            materials: claimMaterials,
          });
        enrichedAggregation.domainModel = enrichedAggregation.handlingProfile?.domainModel || null;
        enrichedAggregation.decisionTrace = buildDecisionTrace({
          claimCaseId,
          claimCase,
          materials: claimMaterials,
          summaries: documents.map((doc) => doc.documentSummary).filter(Boolean),
          aggregation: enrichedAggregation,
          operationLogs: (readData("user-operation-logs") || []).filter(
            (item) => item.claimId === claimCaseId,
          ),
        });
      }
      const validationChecklist = buildCaseValidationChecklist({
        materials: claimMaterials,
        aggregation: enrichedAggregation,
        completeness: latestCompleteness,
        materialValidationResults: latestMaterialValidationResults,
        claimCase,
      });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          claimCaseId,
          documents,
          completeness: latestCompleteness,
          aggregation: enrichedAggregation,
          validationFacts: latestValidationFacts,
          materialValidationResults: latestMaterialValidationResults,
          validationChecklist,
          latestImport: latestRecord
            ? {
                id: latestRecord.id,
                taskId: latestRecord.taskId || null,
                importedAt: latestRecord.importedAt || null,
                taskStatus: latestTask?.status || null,
                postProcessedAt: latestTask?.postProcessedAt || null,
                failureCategory: latestRecoveryIssue?.category || null,
                failureHint: latestRecoveryIssue?.hint || null,
              }
            : null,
          totalImports: records.length,
        }),
      );
    } else {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(
        allDocs.map((record) => {
          const task = record?.taskId ? taskMap.get(record.taskId) : null;
          const recoveryIssue = task ? classifyTaskRecoveryIssue(task) : null;
          return {
            ...record,
            taskStatus: task?.status || null,
            postProcessedAt: task?.postProcessedAt || null,
            failureCategory: recoveryIssue?.category || null,
            failureHint: recoveryIssue?.hint || null,
          };
        }),
      ));
    }
    return;
  }

  // ==================== 统一材料管理 API ====================

  // GET /api/claim-materials - 查询案件材料
  if (resource === "claim-materials" && !id && req.method === "GET") {
    const claimCaseId = url.searchParams.get("claimCaseId");
    const source = url.searchParams.get("source");
    const allMaterials = readData("claim-materials");
    const tasksData = readData("processing-tasks");
    const tasks = Array.isArray(tasksData?.tasks) ? tasksData.tasks : [];
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    let materials = allMaterials;

    // 按案件 ID 过滤
    if (claimCaseId) {
      materials = materials.filter((m) => m.claimCaseId === claimCaseId);
    }

    // 按来源过滤（支持多个来源，逗号分隔）
    if (source) {
      const sources = source.split(",");
      materials = materials.filter((m) => sources.includes(m.source));
    }

    // Runtime backfill for historical offline-import records missing ossKey/url.
    materials = materials.map((m) => {
      if (m.source !== "offline_import" || m.ossKey) return m;
      if (!m.taskId) return m;
      const task = taskMap.get(m.taskId);
      if (!task?.files || !Array.isArray(task.files)) return m;

      const taskFile = task.files.find((f) => f.fileName === m.fileName);
      if (!taskFile?.ossKey) return m;

      return {
        ...m,
        ossKey: taskFile.ossKey,
        url: m.url && m.url !== "#" ? m.url : (taskFile.result?.ossUrl || m.url || "#"),
      };
    });

    // 统计信息
    const bySource = materials.reduce((acc, m) => {
      acc[m.source] = (acc[m.source] || 0) + 1;
      return acc;
    }, {});

    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        claimCaseId,
        materials,
        total: materials.length,
        bySource,
      }),
    );
    return;
  }

  // POST /api/claim-materials - 添加新材料
  if (resource === "claim-materials" && !id && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const {
        claimCaseId,
        fileName,
        fileType,
        url,
        ossKey,
        category,
        materialId,
        materialName,
        source = "direct_upload",
        status,
        uploadedAt,
        metadata,
        sourceDetail,
      } = body;

      if (!claimCaseId || !fileName) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing required fields: claimCaseId, fileName" }));
        return;
      }

      const allMaterials = readData("claim-materials");

      // 检查是否已存在（去重）
      const exists = allMaterials.some(
        (m) => m.claimCaseId === claimCaseId && m.fileName === fileName && m.source === source
      );

      if (exists) {
        res.statusCode = 409;
        res.end(JSON.stringify({ error: "Material already exists", fileName, source }));
        return;
      }

      // 创建新材料记录
      const newMaterial = {
        id: `mat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        claimCaseId,
        fileName,
        fileType: fileType || inferFileType(fileName),
        url: url || "#",
        ossKey,
        category,
        materialId,
        materialName: materialName || category,
        source,
        status: status || "pending",
        uploadedAt: uploadedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: metadata || {},
        sourceDetail: sourceDetail || {},
      };

      allMaterials.push(newMaterial);
      writeData("claim-materials", allMaterials);

      res.statusCode = 201;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, material: newMaterial }));
    } catch (error) {
      console.error("[API] Create material error:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // PUT /api/claim-materials/:id/parse - 触发解析
  if (resource === "claim-materials" && id && req.method === "PUT" && url.pathname.endsWith("/parse")) {
    try {
      const materialId = id;
      const payload = await parseBody(req).catch(() => ({}));
      const allMaterials = readData("claim-materials");
      const materialIndex = allMaterials.findIndex((m) => m.id === materialId);
      const material = materialIndex >= 0 ? allMaterials[materialIndex] : null;

      if (!material) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Material not found" }));
        return;
      }

      // 更新状态为处理中
      const nextMaterial = {
        ...material,
        materialId: payload.materialId || material.materialId,
        materialName: payload.materialName || material.materialName,
        category: payload.category || material.category || payload.materialName || material.materialName,
        status: "processing",
      };
      allMaterials[materialIndex] = nextMaterial;
      writeData("claim-materials", allMaterials);

      const { buffer, mimeType } = await loadBufferForClaimMaterial(nextMaterial);
      const pipelineResult = await processClaimMaterial({
        fileName: nextMaterial.fileName,
        mimeType: nextMaterial.fileType || mimeType || inferFileType(nextMaterial.fileName),
        buffer,
        materialRecord: nextMaterial,
        preferredMaterialId: payload.materialId || nextMaterial.materialId,
        preferredMaterialName: payload.materialName || nextMaterial.materialName || nextMaterial.category,
      });
      if (!pipelineResult.success) {
        throw new Error(
          pipelineResult.classification?.errorMessage ||
            pipelineResult.parseResult?.errorMessage ||
            "材料解析失败"
        );
      }

      const updatedMaterial = {
        ...nextMaterial,
        materialId: pipelineResult.classification?.materialId || nextMaterial.materialId,
        materialName: pipelineResult.classification?.materialName || nextMaterial.materialName,
        category:
          pipelineResult.classification?.materialName ||
          nextMaterial.category ||
          nextMaterial.materialName,
        classificationError: pipelineResult.classification?.errorMessage || null,
        extractedData: pipelineResult.extractedData || {},
        auditConclusion: pipelineResult.auditConclusion || "",
        confidence: pipelineResult.confidence ?? pipelineResult.classification?.confidence ?? 0,
        ocrText: pipelineResult.extractedText || nextMaterial.ocrText || "",
        status: pipelineResult.success ? "completed" : "failed",
        processedAt: new Date().toISOString(),
      };
      allMaterials[materialIndex] = updatedMaterial;
      writeData("claim-materials", allMaterials);

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          message: "Parse task completed",
          materialId,
          material: updatedMaterial,
          parseResult: {
            extractedData: updatedMaterial.extractedData,
            auditConclusion: updatedMaterial.auditConclusion,
            confidence: updatedMaterial.confidence,
            materialId: updatedMaterial.materialId,
            materialName: updatedMaterial.materialName,
            extractedText: updatedMaterial.ocrText || "",
          },
        }),
      );
    } catch (error) {
      console.error("[API] Parse material error:", error);
      try {
        const allMaterials = readData("claim-materials");
        const materialIndex = allMaterials.findIndex((m) => m.id === id);
        if (materialIndex >= 0) {
          allMaterials[materialIndex] = {
            ...allMaterials[materialIndex],
            status: "failed",
            classificationError: error.message,
            processedAt: new Date().toISOString(),
          };
          writeData("claim-materials", allMaterials);
        }
      } catch {
        // ignore material status rollback failure
      }
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // ==================== 任务队列 API ====================

  if (resource === "tasks" && req.method === "POST") {
    try {
      const { claimCaseId, productCode, files } = await parseBody(req);

      if (!claimCaseId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId" }));
        return;
      }

      if (!files || !Array.isArray(files) || files.length === 0) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing or empty files array" }));
        return;
      }

      const userId = req.headers["x-user-id"] || "anonymous";
      const task = await createTask(claimCaseId, productCode, files, userId);

      writeAuditLog({
        type: "TASK_CREATE",
        taskId: task.id,
        claimCaseId,
        userId,
        fileCount: files.length,
        timestamp: new Date().toISOString(),
      });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          taskId: task.id,
          message: "任务已创建，正在后台处理",
          totalFiles: files.length,
        }),
      );
    } catch (error) {
      console.error("[API] Create task error:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (resource === "tasks" && id && req.method === "GET") {
    try {
      const task = await getTask(id);
      if (!task) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Task not found" }));
        return;
      }

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, data: task }));
    } catch (error) {
      console.error("[API] Get task error:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (resource === "tasks" && id && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const { action, fileIndex } = body;

      if (action === "retry" && fileIndex !== undefined) {
        const task = await resetFileForRetry(id, fileIndex);
        if (!task) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Task or file not found" }));
          return;
        }

        writeAuditLog({
          type: "TASK_RETRY",
          taskId: id,
          fileIndex,
          timestamp: new Date().toISOString(),
        });

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: true, data: task }));
        return;
      }

      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Invalid action" }));
    } catch (error) {
      console.error("[API] Task action error:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // ==================== 消息中心 API ====================

  if (resource === "messages" && req.method === "GET" && !id) {
    try {
      const userId = req.headers["x-user-id"] || "anonymous";
      const url = new URL(req.url, `http://${req.headers.host}`);
      const isRead = url.searchParams.get("isRead");
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const offset = parseInt(url.searchParams.get("offset") || "0");

      const result = await getMessages(userId, {
        isRead: isRead === null ? undefined : isRead === "true",
        limit,
        offset,
      });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          data: result.messages,
          meta: {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            hasMore: result.hasMore,
          },
        }),
      );
    } catch (error) {
      console.error("[API] Get messages error:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (resource === "messages" && id === "unread-count" && req.method === "GET") {
    try {
      const userId = req.headers["x-user-id"] || "anonymous";
      const count = await getUnreadCount(userId);

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, data: { count } }));
    } catch (error) {
      console.error("[API] Get unread count error:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (resource === "messages" && id && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const userId = req.headers["x-user-id"] || "anonymous";

      if (body.action === "read-all") {
        const result = await markAllAsRead(userId);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      const message = await markAsRead(id);
      if (!message) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Message not found" }));
        return;
      }

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, data: message }));
    } catch (error) {
      console.error("[API] Mark read error:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (resource === "messages" && id && req.method === "DELETE") {
    try {
      const success = await deleteMessage(id);
      if (!success) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Message not found" }));
        return;
      }

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      console.error("[API] Delete message error:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // ==================== 离线材料导入 API (异步模式) ====================

  if (resource === "import-offline-materials") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const {
        claimCaseId,
        productCode,
        files: uploadedFiles,
      } = await parseBody(req);

      if (!claimCaseId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId" }));
        return;
      }

      if (
        !uploadedFiles ||
        !Array.isArray(uploadedFiles) ||
        uploadedFiles.length === 0
      ) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing or empty files array" }));
        return;
      }

      const userId = req.headers["x-user-id"] || "anonymous";
      const task = await createTask(claimCaseId, productCode, uploadedFiles, userId);
      
      writeAuditLog({
        type: "IMPORT_TASK_CREATE",
        taskId: task.id,
        claimCaseId,
        userId,
        fileCount: uploadedFiles.length,
        timestamp: new Date().toISOString(),
      });

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        success: true,
        taskId: task.id,
        message: "任务已创建，正在后台处理",
        totalFiles: uploadedFiles.length,
      }));

    } catch (error) {
      console.error("[import-offline-materials] Error:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // ==================== 遗留：同步导入 API (保留兼容) ====================
  if (resource === "import-offline-materials-sync") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const {
        claimCaseId,
        productCode,
        files: uploadedFiles,
      } = await parseBody(req);

      if (!claimCaseId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId" }));
        return;
      }

      if (
        !uploadedFiles ||
        !Array.isArray(uploadedFiles) ||
        uploadedFiles.length === 0
      ) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing or empty files array" }));
        return;
      }

      const startTime = Date.now();

      // 1. Process all files (OCR + classification)
      const documents = [];
      for (const file of uploadedFiles) {
        try {
          const result = await processFile({
            fileName: file.fileName,
            mimeType: file.mimeType,
            options: {
              base64Data: file.base64Data,
              extractText: true,
            },
          });

          // 使用 AI 进行材料分类
          const classification = await classifyMaterial(result, file.fileName);

          documents.push({
            documentId: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fileName: file.fileName,
            fileType: file.mimeType,
            ossUrl: result.ossUrl || null,
            extractedText: result.extractedText || "",
            structuredData: result.structuredData || {},
            classification,
            status: "completed",
          });
        } catch (fileError) {
          console.error(
            `[import-offline-materials] Failed to process ${file.fileName}:`,
            fileError,
          );
          documents.push({
            documentId: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fileName: file.fileName,
            fileType: file.mimeType,
            classification: {
              materialId: "unknown",
              materialName: "处理失败",
              confidence: 0,
            },
            status: "failed",
            errorMessage: fileError.message || "处理失败",
          });
        }
      }

      const completedDocs = documents.filter((d) => d.status === "completed");
      const summaries = await extractDocumentSummaries(completedDocs, {
        skipImages: true,
      });
      completedDocs.forEach((doc, index) => {
        if (summaries[index]) {
          doc.documentSummary = summaries[index];
        }
      });
      let analysisResult = null;
      try {
        analysisResult = await analyzeMultiFiles(documents, {
          claimCaseId,
          productCode,
        });
      } catch (analysisError) {
        console.error(
          "[import-offline-materials] Multi file analysis failed:",
          analysisError,
        );
      }

      const aggregationResult = aggregateCase({
        summaries,
        claimCaseId,
        validationFacts: analysisResult?.validationFacts || {},
        validationResults: analysisResult?.materialValidationResults || [],
        documents,
      });

      // 2. Check completeness
      let completeness = {
        isComplete: false,
        completenessScore: 0,
        requiredMaterials: [],
        providedMaterials: [],
        missingMaterials: [],
        warnings: [],
      };

      try {
        if (!analysisResult) {
          analysisResult = await analyzeMultiFiles(documents, {
            claimCaseId,
            productCode,
          });
        }
        completeness = analysisResult.completeness || completeness;
      } catch (analysisError) {
        console.error(
          "[import-offline-materials] Completeness check failed:",
          analysisError,
        );
        completeness.warnings.push("完整性检查失败，请手动核实");
      }

      const processingTime = Date.now() - startTime;

      // 3. 检查置信度并创建人工复核工单
      const claimCase = readData("claim-cases").find(c => c.id === claimCaseId);
      const reportNumber = claimCase?.reportNumber || claimCaseId;
      const createdReviewTasks = [];
      
      // 获取材料配置以检查置信度阈值
      const materialsConfig = readData("claims-materials");
      
      for (const doc of documents) {
        if (doc.status !== "completed" || !doc.classification?.materialId) continue;
        
        const materialConfig = materialsConfig.find(m => m.id === doc.classification.materialId);
        const threshold = materialConfig?.confidenceThreshold ?? 0.9;
        const aiConfidence = (doc.classification?.confidence || 0) / 100; // 转换为0-1范围
        
        // 如果置信度低于阈值，创建工单
        if (aiConfidence < threshold) {
          try {
            const task = await reviewTaskService.checkAndCreateTask({
              claimCaseId,
              reportNumber,
              materialId: doc.classification.materialId,
              materialName: doc.classification.materialName || materialConfig?.name || "未知材料",
              documentId: doc.documentId,
              ossUrl: doc.ossUrl,
              ossKey: doc.ossKey,
              aiConfidence,
              threshold,
              aiExtractedData: doc.structuredData,
              createdBy: "system",
            });
            
            if (task) {
              createdReviewTasks.push({
                taskId: task.id,
                documentId: doc.documentId,
                materialName: task.materialName,
                aiConfidence,
                threshold,
              });
            }
          } catch (taskError) {
            console.error("[import-offline-materials] Failed to create review task:", taskError);
          }
        }
      }

      // 4. Persist documents to claim-documents.json
      const allClaimDocs = readData("claim-documents");
      const importRecord = {
        id: `import-${Date.now()}`,
        claimCaseId,
        productCode,
        importedAt: new Date().toISOString(),
        documents: documents.map((d) => ({
          ...d,
          extractedText: undefined,
        })),
        aggregation: aggregationResult,
        validationFacts: analysisResult?.validationFacts || {},
        materialValidationResults: analysisResult?.materialValidationResults || [],
        completeness,
        reviewTasks: createdReviewTasks.map(t => t.taskId),
      };
      allClaimDocs.push(importRecord);
      writeData("claim-documents", allClaimDocs);

      // 4.5. 同步到 claim-materials
      try {
        const allMaterials = readData("claim-materials");
        const batchMaterials = documents.map((doc) => ({
          id: doc.documentId || `mat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          claimCaseId,
          fileName: doc.fileName,
          fileType: doc.fileType || inferFileType(doc.fileName),
          url: doc.ossUrl || "#",
          ossKey: undefined,
          category: doc.classification?.materialName,
          materialId: doc.classification?.materialId,
          materialName: doc.classification?.materialName,
          extractedData: doc.structuredData,
          auditConclusion: undefined,
          confidence: doc.classification?.confidence,
          documentSummary: doc.documentSummary,
          source: "batch_import",
          sourceDetail: {
            importId: importRecord.id,
            importedAt: importRecord.importedAt,
            taskId: importRecord.taskId,
          },
          status: doc.status === "completed" ? "completed" : doc.status === "failed" ? "failed" : "pending",
          uploadedAt: importRecord.importedAt,
          processedAt: doc.status === "completed" ? importRecord.importedAt : undefined,
          metadata: doc.duplicateWarning ? { duplicateWarning: doc.duplicateWarning } : undefined,
        }));

        allMaterials.push(...batchMaterials);
        writeData("claim-materials", allMaterials);
        console.log(`[Import] Synced ${batchMaterials.length} materials to claim-materials`);
      } catch (syncError) {
        console.error("[Import] Failed to sync to claim-materials:", syncError);
      }

      // 5. Build summary
      const successCount = documents.filter(
        (d) => d.status === "completed",
      ).length;
      const failCount = documents.filter((d) => d.status === "failed").length;
      let summary = `成功处理 ${successCount} 个文件${failCount > 0 ? `，${failCount} 个失败` : ""}，耗时 ${processingTime}ms`;
      
      if (createdReviewTasks.length > 0) {
        summary += `。已创建 ${createdReviewTasks.length} 个人工复核工单`;
      }

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          claimCaseId,
          documents,
          completeness,
          reviewTasks: createdReviewTasks,
          summary,
          processingTime,
        }),
      );
    } catch (error) {
      console.error("[import-offline-materials error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 文件类型推断 API
  if (resource === "infer-file-type") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { fileName, mimeType, context } = await parseBody(req);

      const category = getFileCategory(mimeType, fileName);
      const documentType = inferDocumentType(fileName, context);

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          fileName,
          mimeType,
          category,
          documentType,
        }),
      );
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // ============ 询价及保单管理专用 API ============

  // 保费计算 API
  if (resource === "calculate-premium") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { productCode, planId, insureds, clauses } = await parseBody(req);

      // 简单的保费计算逻辑（实际应根据费率表计算）
      // 这里返回模拟数据，实际项目应接入费率计算引擎
      const basePremium =
        clauses?.reduce((sum, c) => sum + (c.premium || 0), 0) || 1000;
      const totalPremium = basePremium * (insureds?.length || 1);

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          premium: totalPremium,
          breakdown:
            clauses?.map((c) => ({
              clauseCode: c.clauseCode,
              clauseName: c.clauseName,
              premium: c.premium || basePremium / (clauses?.length || 1),
            })) || [],
        }),
      );
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 询价单转保单 API
  if (resource === "quotes" && id && id.endsWith("/convert")) {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const quoteId = id.replace("/convert", "");
      const quotes = readData("quotes");
      const quoteIdx = findItemIndex(quotes, quoteId);

      if (quoteIdx === -1) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Quote not found" }));
        return;
      }

      const quote = quotes[quoteIdx];

      // 创建保单
      const policies = readData("policies");
      const newPolicyNumber = `POL${Date.now()}`;
      const selectedPlan =
        quote.plans?.find((p) => p.id === quote.selectedPlanId) ||
        quote.plans?.[0];

      const newPolicy = {
        id: `policy-${Date.now()}`,
        policyNumber: newPolicyNumber,
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        status: "草稿",
        productCode: selectedPlan?.productCode || "",
        productName: selectedPlan?.productName || "",
        companyName: selectedPlan?.companyName || "",
        policyholder: quote.policyholder,
        insureds: quote.insureds,
        mainClause:
          selectedPlan?.clauses?.find((c) => c.clauseType === "主险") || {},
        riderClauses:
          selectedPlan?.clauses?.filter((c) => c.clauseType === "附加险") || [],
        specialAgreements: [],
        deductionRules: [],
        effectiveDate: quote.effectiveDate || "",
        expiryDate: quote.expiryDate || "",
        issueDate: new Date().toISOString().split("T")[0],
        totalPremium: selectedPlan?.premium || 0,
        paymentFrequency: "年缴",
        claimCount: 0,
        totalClaimAmount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        operator: quote.operator,
      };

      policies.push(newPolicy);
      writeData("policies", policies);

      // 更新询价单状态
      quotes[quoteIdx] = {
        ...quote,
        status: "已转保单",
        updatedAt: new Date().toISOString(),
      };
      writeData("quotes", quotes);

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, policy: newPolicy }));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 生成保单明细表 API
  if (resource === "policies" && id && id.endsWith("/schedule")) {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const policyId = id.replace("/schedule", "");
      const policies = readData("policies");
      const policyIdx = findItemIndex(policies, policyId);

      if (policyIdx === -1) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Policy not found" }));
        return;
      }

      const policy = policies[policyIdx];

      // 生成明细表
      const scheduleItems = [];

      // 主险明细
      if (policy.mainClause?.clauseCode) {
        scheduleItems.push({
          id: `schedule-${Date.now()}-1`,
          category: "主险",
          itemName: policy.mainClause.clauseName,
          sumInsured: policy.mainClause.sumInsured || 0,
          deductible: 0,
          reimbursementRatio: 100,
          remarks: "",
        });
      }

      // 附加险明细
      policy.riderClauses?.forEach((clause, idx) => {
        scheduleItems.push({
          id: `schedule-${Date.now()}-${idx + 2}`,
          category: "附加险",
          itemName: clause.clauseName,
          sumInsured: clause.sumInsured || 0,
          deductible: 0,
          reimbursementRatio: 100,
          remarks: "",
        });
      });

      const schedule = {
        version: "1.0",
        generatedAt: new Date().toISOString(),
        items: scheduleItems,
        totalSumInsured: scheduleItems.reduce(
          (sum, item) => sum + item.sumInsured,
          0,
        ),
        totalPremium: policy.totalPremium || 0,
      };

      // 更新保单
      policies[policyIdx] = {
        ...policy,
        schedule,
        updatedAt: new Date().toISOString(),
      };
      writeData("policies", policies);

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, schedule }));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // ============ 理赔材料计算 API ============

  // 计算理赔材料清单
  if (resource === "claim-materials" && id === "calculate") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { calculateMaterials } = await import("./services/materialCalculator.js");
      const params = await parseBody(req);
      const result = await calculateMaterials(params);

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[calculate-materials error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({
        success: false,
        error: formatErrorMessage(error),
        materials: [],
        summary: { totalCount: 0, requiredCount: 0, optionalCount: 0 }
      }));
    }
    return;
  }

  // ============ 定损理算 API ============

  // 执行定损（通用接口，按险种区分）
  if (resource === "assess-damage") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const params = await parseBody(req);
      const result = await assessDamage(params);

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[assess-damage error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // ============ 人伤案件专用 API ============

  // 批量导入人伤材料（含预处理、去重、摘要提取、聚合）
  if (resource === "import-injury-case") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const {
        claimCaseId,
        productCode,
        files: uploadedFiles,
        operator = "系统",
      } = await parseBody(req);

      if (!claimCaseId || !uploadedFiles?.length) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId or files" }));
        return;
      }

      const startTime = Date.now();

      // 1. 预处理：格式验证 + SHA-256 指纹
      const preprocessResults = await preprocessFiles(uploadedFiles);

      // 收集预处理警告
      const preprocessWarnings = preprocessResults.flatMap((r, i) =>
        r.warnings.map((w) => `[${uploadedFiles[i].fileName}] ${w}`),
      );

      // 2. 获取案件中已有的文件（用于去重）
      const allClaimDocs = readData("claim-documents");
      const existingRecords = allClaimDocs.filter(
        (r) => r.claimCaseId === claimCaseId,
      );
      const existingDocs = existingRecords.flatMap((r) => r.documents || []);

      // 3. 为每个文件附加 sha256 指纹，执行去重检测
      const filesWithHash = uploadedFiles.map((f, i) => ({
        ...f,
        sha256: preprocessResults[i]?.sha256,
        exifRotation: preprocessResults[i]?.exifRotation,
        preprocessWarnings: preprocessResults[i]?.warnings || [],
      }));

      const duplicateResults = checkDuplicatesBatch(
        filesWithHash,
        existingDocs,
      );

      // 过滤：仅处理非精确重复文件（相似文件保留，由前端决定）
      const exactDuplicateFiles = filesWithHash.filter(
        (_, i) => duplicateResults[i]?.duplicateType === "exact",
      );
      const filesToProcess = filesWithHash.filter(
        (_, i) => duplicateResults[i]?.duplicateType !== "exact",
      );

      // 生成 batchId
      const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // 4. OCR + 文档分类（复用现有 processFile）
      const documents = [];
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const dupeResult = duplicateResults[filesWithHash.indexOf(file)];

        try {
          const result = await processFile({
            fileName: file.fileName,
            mimeType: file.mimeType,
            options: {
              base64Data: file.base64Data,
              extractText: true,
              classify: true,
            },
          });

          documents.push({
            documentId: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            batchId,
            fileName: file.fileName,
            fileType: file.mimeType,
            ossUrl: result.ossUrl || null,
            extractedText: result.extractedText || "",
            structuredData: result.structuredData || {},
            classification: result.classification || {
              materialId: result.documentType?.id || "unknown",
              materialName: result.documentType?.name || "未识别",
              confidence: result.documentType?.confidence || 0,
            },
            status: "completed",
            sha256: file.sha256,
            exifRotation: file.exifRotation,
            preprocessWarnings: file.preprocessWarnings,
            // 相似文件标记（非精确重复但相似）
            duplicateWarning: dupeResult?.isDuplicate ? dupeResult : null,
            importedAt: new Date().toISOString(),
          });
        } catch (fileError) {
          console.error(
            `[import-injury-case] Failed to process ${file.fileName}:`,
            fileError,
          );
          documents.push({
            documentId: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            batchId,
            fileName: file.fileName,
            fileType: file.mimeType,
            classification: {
              materialId: "unknown",
              materialName: "处理失败",
              confidence: 0,
            },
            status: "failed",
            errorMessage: fileError.message || "处理失败",
            sha256: file.sha256,
            importedAt: new Date().toISOString(),
          });
        }
      }

      // 5. 类型化摘要提取（仅 completed 文件）
      const completedDocs = documents.filter((d) => d.status === "completed");
      const summaries = await extractDocumentSummaries(completedDocs);
      // 将摘要附加到对应文档
      completedDocs.forEach((doc, i) => {
        if (summaries[i]) {
          doc.documentSummary = summaries[i];
        }
      });

      // 6. 完整性检查（复用现有服务）
      let completeness = {
        isComplete: false,
        completenessScore: 0,
        requiredMaterials: [],
        providedMaterials: [],
        missingMaterials: [],
        warnings: [...preprocessWarnings],
      };
      let analysisResult = null;
      try {
        analysisResult = await analyzeMultiFiles(documents, {
          claimCaseId,
          productCode,
        });
        completeness = {
          ...(analysisResult.completeness || completeness),
          warnings: [
            ...preprocessWarnings,
            ...(analysisResult.completeness?.warnings || []),
          ],
        };
      } catch (e) {
        completeness.warnings.push("完整性检查失败，请手动核实");
      }

      // 7. 案件级数据聚合
      const aggregationResult = aggregateCase({
        summaries,
        claimCaseId,
        validationFacts: analysisResult?.validationFacts || {},
        validationResults: analysisResult?.materialValidationResults || [],
        documents,
      });

      // 8. 持久化
      const importRecord = {
        id: `import-${Date.now()}`,
        batchId,
        claimCaseId,
        productCode,
        importedAt: new Date().toISOString(),
        importedBy: operator,
        fileCount: uploadedFiles.length,
        successCount: documents.filter((d) => d.status === "completed").length,
        failCount: documents.filter((d) => d.status === "failed").length,
        exactDuplicateCount: exactDuplicateFiles.length,
        sourceType: "manual",
        documents: documents.map((d) => ({ ...d, extractedText: undefined })),
        completeness,
        aggregation: { ...aggregationResult, summaries: undefined },
        validationFacts: analysisResult?.validationFacts || {},
        materialValidationResults: analysisResult?.materialValidationResults || [],
      };
      allClaimDocs.push(importRecord);
      writeData("claim-documents", allClaimDocs);

      const processingTime = Date.now() - startTime;
      const summary = `成功处理 ${importRecord.successCount} 个文件${importRecord.failCount > 0 ? `，${importRecord.failCount} 个失败` : ""}${exactDuplicateFiles.length > 0 ? `，${exactDuplicateFiles.length} 个跳过（重复）` : ""}，耗时 ${processingTime}ms`;

      // 写审计日志
      writeAuditLog({
        type: AuditLogType.API_CALL,
        endpoint: "POST /api/import-injury-case",
        claimCaseId,
        batchId,
        fileCount: importRecord.fileCount,
        successCount: importRecord.successCount,
        failCount: importRecord.failCount,
        skippedDuplicates: exactDuplicateFiles.length,
        duration: processingTime,
        success: true,
      });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          batchId,
          claimCaseId,
          documents,
          summaries,
          completeness,
          aggregation: aggregationResult,
          validationFacts: analysisResult?.validationFacts || {},
          materialValidationResults: analysisResult?.materialValidationResults || [],
          duplicateSkipped: exactDuplicateFiles.map((f) => f.fileName),
          duplicateWarnings: duplicateResults.filter(
            (r) => r.isDuplicate && r.duplicateType === "similar",
          ),
          preprocessWarnings,
          summary,
          processingTime,
        }),
      );
    } catch (error) {
      console.error("[import-injury-case error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 生成定损报告
  if (resource === "generate-damage-report") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const grStartTime = Date.now();
      const { claimCaseId, standards, claimantAge } = await parseBody(req);
      if (!claimCaseId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId" }));
        return;
      }

      // 读取最新的聚合数据
      const allClaimDocs = readData("claim-documents");
      const latestImport = allClaimDocs
        .filter((r) => r.claimCaseId === claimCaseId && r.aggregation)
        .sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt))[0];

      if (!latestImport?.aggregation) {
        res.statusCode = 404;
        res.end(
          JSON.stringify({ error: "未找到该案件的聚合数据，请先执行批量导入" }),
        );
        return;
      }

      // 读取案件基础信息
      const claimCases = readData("claim-cases");
      const claimCase = claimCases.find((c) => c.id === claimCaseId) || {};

      const report = generateDamageReport({
        claimCaseId,
        aggregationResult: latestImport.aggregation,
        claimCase,
        standards: standards || {},
        claimantAge: claimantAge || 35,
      });

      // 保存报告
      const reports = readData("damage-reports") || [];
      reports.push({ ...report, reportHtml: undefined }); // 不存 HTML 到 JSON
      writeData("damage-reports", reports);

      // 写审计日志
      writeAuditLog({
        type: AuditLogType.API_CALL,
        endpoint: "POST /api/generate-damage-report",
        claimCaseId,
        reportId: report.reportId,
        finalAmount: report.finalAmount,
        itemCount: report.items?.length || 0,
        duration: Date.now() - grStartTime,
        success: true,
      });

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(report));
    } catch (error) {
      console.error("[generate-damage-report error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  if (resource === "claim-payment-deduction") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { claimCaseId, applyDeduction, deductionAmount } = await parseBody(req);
      if (!claimCaseId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId" }));
        return;
      }

      const allClaimDocs = readData("claim-documents");
      const latestIndex = allClaimDocs
        .map((record, index) => ({ record, index }))
        .filter(({ record }) => record.claimCaseId === claimCaseId && record.aggregation)
        .sort((a, b) => new Date(b.record.importedAt || 0) - new Date(a.record.importedAt || 0))[0];

      if (!latestIndex?.record?.aggregation) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "未找到可更新的聚合结果" }));
        return;
      }

      const aggregation = { ...latestIndex.record.aggregation };
      const deductionSummary = {
        ...(aggregation.deductionSummary || aggregation.paymentSummary || {}),
      };
      const deductionRecommendedAmount = Number(deductionSummary.deductionRecommendedAmount || 0);
      const parsedDeductionAmount =
        deductionAmount === undefined || deductionAmount === null || deductionAmount === ""
          ? null
          : Number(deductionAmount);
      if (parsedDeductionAmount !== null && (!Number.isFinite(parsedDeductionAmount) || parsedDeductionAmount < 0)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "抵扣金额必须是大于等于 0 的数字" }));
        return;
      }
      const resolvedDeductionAmount =
        parsedDeductionAmount !== null
          ? Math.min(parsedDeductionAmount, deductionRecommendedAmount || parsedDeductionAmount)
          : applyDeduction
            ? deductionRecommendedAmount
            : 0;
      deductionSummary.deductionTotal = resolvedDeductionAmount;
      deductionSummary.confirmed = Boolean(applyDeduction || resolvedDeductionAmount > 0);
      deductionSummary.confirmedAt = new Date().toISOString();
      aggregation.deductionSummary = deductionSummary;
      aggregation.decisionTrace = rebuildDecisionTraceForClaim({
        claimCaseId,
        aggregation,
        latestRecord: latestIndex.record,
      });

      const allClaimCases = readData("claim-cases");
      const claimCase = allClaimCases.find((item) => item.id === claimCaseId) || {};
      const report = generateDamageReport({
        claimCaseId,
        aggregationResult: aggregation,
        claimCase,
      });

      allClaimDocs[latestIndex.index] = {
        ...latestIndex.record,
        aggregation,
      };
      writeData("claim-documents", allClaimDocs);

      const reports = (readData("damage-reports") || []).filter((item) => item.claimCaseId !== claimCaseId);
      reports.push({ ...report, reportHtml: undefined });
      writeData("damage-reports", reports);

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          aggregation,
          report,
        }),
      );
    } catch (error) {
      console.error("[claim-payment-deduction error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  if (resource === "claim-fact-confirmation") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { claimCaseId, factKey, confirmed } = await parseBody(req);
      if (!claimCaseId || !factKey) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId or factKey" }));
        return;
      }

      const normalizedFactKey =
        factKey === "employment_relation" ? "third_party_identity_chain" : factKey;
      const allowedFactKeys = new Set(["liability_apportionment", "third_party_identity_chain"]);
      if (!allowedFactKeys.has(normalizedFactKey)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Unsupported factKey" }));
        return;
      }

      const allClaimDocs = readData("claim-documents");
      const latestIndex = allClaimDocs
        .map((record, index) => ({ record, index }))
        .filter(({ record }) => record.claimCaseId === claimCaseId && record.aggregation)
        .sort((a, b) => new Date(b.record.importedAt || 0) - new Date(a.record.importedAt || 0))[0];

      if (!latestIndex?.record?.aggregation) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "未找到可更新的聚合结果" }));
        return;
      }

      const aggregation = { ...latestIndex.record.aggregation };
      const factConfirmations = {
        ...(aggregation.factConfirmations || {}),
        [normalizedFactKey]: {
          confirmed: Boolean(confirmed),
          confirmedAt: new Date().toISOString(),
        },
      };
      aggregation.factConfirmations = factConfirmations;

      if (normalizedFactKey === "liability_apportionment" && aggregation.liabilityApportionment) {
        aggregation.liabilityApportionment = {
          ...aggregation.liabilityApportionment,
          confirmed: Boolean(confirmed),
          confirmedAt: new Date().toISOString(),
        };
      }

      if (normalizedFactKey === "third_party_identity_chain") {
        aggregation.factModel = {
          ...(aggregation.factModel || {}),
          thirdPartyIdentityChainConfirmed: Boolean(confirmed),
          thirdPartyIdentityChainConfirmedAt: new Date().toISOString(),
          legacyAliases: {
            ...(((aggregation.factModel || {}).legacyAliases) || {}),
            employmentRelationConfirmed: Boolean(confirmed),
            employmentRelationConfirmedAt: new Date().toISOString(),
          },
        };
      }
      aggregation.decisionTrace = rebuildDecisionTraceForClaim({
        claimCaseId,
        aggregation,
        latestRecord: latestIndex.record,
      });

      const allClaimCases = readData("claim-cases");
      const claimCase = allClaimCases.find((item) => item.id === claimCaseId) || {};
      const report = generateDamageReport({
        claimCaseId,
        aggregationResult: aggregation,
        claimCase,
      });

      allClaimDocs[latestIndex.index] = {
        ...latestIndex.record,
        aggregation,
      };
      writeData("claim-documents", allClaimDocs);

      const reports = (readData("damage-reports") || []).filter((item) => item.claimCaseId !== claimCaseId);
      reports.push({ ...report, reportHtml: undefined });
      writeData("damage-reports", reports);

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          aggregation,
          report,
        }),
      );
    } catch (error) {
      console.error("[claim-fact-confirmation error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  if (resource === "claim-liability-apportionment") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { claimCaseId, thirdPartyLiabilityPct } = await parseBody(req);
      const ratio = Number(thirdPartyLiabilityPct);
      if (!claimCaseId || !Number.isFinite(ratio)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId or invalid thirdPartyLiabilityPct" }));
        return;
      }
      if (ratio < 0 || ratio > 100) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "责任比例必须在 0 到 100 之间" }));
        return;
      }

      const allClaimDocs = readData("claim-documents");
      const latestIndex = allClaimDocs
        .map((record, index) => ({ record, index }))
        .filter(({ record }) => record.claimCaseId === claimCaseId && record.aggregation)
        .sort((a, b) => new Date(b.record.importedAt || 0) - new Date(a.record.importedAt || 0))[0];

      if (!latestIndex?.record?.aggregation) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "未找到可更新的聚合结果" }));
        return;
      }

      const aggregation = { ...latestIndex.record.aggregation };
      const existing = aggregation.liabilityApportionment || {};
      aggregation.liabilityApportionment = {
        ...existing,
        claimantLiabilityPct: 100 - ratio,
        thirdPartyLiabilityPct: ratio,
        source: "manual_adjustment",
        basis: `人工确认责任比例 ${ratio}%`,
        confirmed: true,
        confirmedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      aggregation.factConfirmations = {
        ...(aggregation.factConfirmations || {}),
        liability_apportionment: {
          confirmed: true,
          confirmedAt: new Date().toISOString(),
        },
      };
      aggregation.decisionTrace = rebuildDecisionTraceForClaim({
        claimCaseId,
        aggregation,
        latestRecord: latestIndex.record,
      });

      const allClaimCases = readData("claim-cases");
      const claimCase = allClaimCases.find((item) => item.id === claimCaseId) || {};
      const report = generateDamageReport({
        claimCaseId,
        aggregationResult: aggregation,
        claimCase,
      });

      allClaimDocs[latestIndex.index] = {
        ...latestIndex.record,
        aggregation,
      };
      writeData("claim-documents", allClaimDocs);

      const reports = (readData("damage-reports") || []).filter((item) => item.claimCaseId !== claimCaseId);
      reports.push({ ...report, reportHtml: undefined });
      writeData("damage-reports", reports);

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          aggregation,
          report,
        }),
      );
    } catch (error) {
      console.error("[claim-liability-apportionment error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 获取案件定损报告
  if (resource === "damage-reports") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    const caseId = new URL(req.url, "http://x").searchParams.get("claimCaseId");
    const reports = readData("damage-reports") || [];
    const filtered = caseId
      ? reports.filter((r) => r.claimCaseId === caseId)
      : reports;

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(filtered));
    return;
  }

  // 系统日志查询
  if (resource === "system-logs") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    const params = new URL(req.url, "http://x").searchParams;

    // GET /api/system-logs/stats → 返回今日 AI 成本统计
    if (id === "stats") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(aiCostTracker.getStats()));
      return;
    }

    // GET /api/system-logs?date=YYYY-MM-DD|all&type=...&claimCaseId=...
    // date='all' 表示读取全部日期的日志
    const dateParam = params.get("date") || "all";
    const date = dateParam === "all" ? "all" : dateParam;
    const type = params.get("type") || null;
    const claimCaseId = params.get("claimCaseId") || null;
    const limit = Math.min(parseInt(params.get("limit") || "500", 10), 1000);

    const filters = {};
    if (type) filters.type = type;
    if (claimCaseId) filters.claimCaseId = claimCaseId;

    const logs = readAuditLogs(date, filters);
    const limited = date === "all" 
      ? logs.slice(0, limit) // 全部日志已按时间排序
      : logs.slice(-limit).reverse(); // 单天日志最新的在前

    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        date: date === "all" ? "all" : date,
        total: logs.length,
        returned: limited.length,
        filters: { type, claimCaseId },
        logs: limited,
      }),
    );
    return;
  }

  // ============ 案件操作日志查询 API ============
  // 查询指定案件的操作日志（合并用户操作日志和审计日志）
  if (resource === "operation-logs") {
    if (req.method === "GET") {
      const params = new URL(req.url, "http://x").searchParams;
      const claimId = params.get("claimId");

      if (!claimId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimId parameter" }));
        return;
      }

      try {
        // 1. 从 user-operation-logs.json 查询（用户操作日志）
        const userLogs = readData("user-operation-logs") || [];
        const filteredUserLogs = userLogs.filter(
          (log) => log.claimId === claimId || log.claimCaseId === claimId
        ).map((log) => ({
          ...log,
          logSource: "user", // 标记来源
        }));

        // 2. 从审计日志查询（系统操作日志）
        const auditLogs = readAuditLogs("all", { claimCaseId: claimId });
        const formattedAuditLogs = auditLogs.map((log) => ({
          logId: `audit-${log.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: log.timestamp,
          userName: log.operator || "系统",
          operationType: mapAuditTypeToOperationType(log.type),
          operationLabel: formatAuditLogLabel(log),
          claimId: log.claimCaseId,
          claimReportNumber: null,
          currentStatus: log.newStatus || null,
          inputData: log.input || null,
          outputData: log.output || null,
          success: log.success !== false,
          duration: log.duration || null,
          logSource: "system",
        }));

        const aiLogs = queryAIInteractionLogs({ claimCaseId: claimId, limit: 200, includeRaw: false }).logs;
        const formattedAILogs = aiLogs.map((log) => ({
          logId: log.id,
          timestamp: log.timestamp,
          userName: "AI系统",
          operationType: "AI_REVIEW",
          operationLabel: `AI交互: ${log.module || log.operation || "unknown"}`,
          claimId: log.context?.claimCaseId || claimId,
          claimReportNumber: null,
          currentStatus: null,
          inputData: log.sanitized?.request || log.request?.summary || null,
          outputData: log.sanitized?.response || { text: log.response?.text || null },
          success: log.success !== false,
          duration: log.performance?.durationMs || null,
          aiInteractionId: log.id,
          aiTraceId: log.traceId,
          logSource: "ai",
        }));

        // 3. 合并并按时间排序（最新的在前）
        const allLogs = [...filteredUserLogs, ...formattedAuditLogs, ...formattedAILogs].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            claimId,
            total: allLogs.length,
            userLogsCount: filteredUserLogs.length,
            systemLogsCount: formattedAuditLogs.length,
            aiLogsCount: formattedAILogs.length,
            logs: allLogs,
          })
        );
      } catch (error) {
        console.error("[operation-logs] Error:", error);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "Failed to fetch operation logs" }));
      }
      return;
    }

    // 记录案件操作日志 API
    if (req.method === "POST") {
      try {
        const body = await parseBody(req);
        const { claimId, operationType, operationLabel, inputData, outputData, success = true, duration, userName } = body;

        if (!claimId || !operationType) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Missing required fields: claimId, operationType" }));
          return;
        }

        // 创建日志条目
        const logEntry = {
          logId: `log-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          userName: userName || req.headers["x-user-id"] || "system",
          operationType,
          operationLabel: operationLabel || operationType,
          claimId,
          claimReportNumber: body.claimReportNumber || null,
          currentStatus: body.currentStatus || null,
          inputData: inputData || null,
          outputData: outputData || null,
          success,
          duration: duration || null,
          userAgent: req.headers["user-agent"] || null,
          deviceType: detectDeviceType(req.headers["user-agent"]),
        };

        // 保存到 user-operation-logs.json
        const logs = readData("user-operation-logs") || [];
        logs.push(logEntry);
        writeData("user-operation-logs", logs);

        res.setHeader("Content-Type", "application/json");
        res.statusCode = 201;
        res.end(JSON.stringify({ success: true, logId: logEntry.logId }));
      } catch (error) {
        console.error("[operation-logs] POST Error:", error);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "Failed to save operation log" }));
      }
      return;
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  if (resource === "claim-process-timeline") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    const params = new URL(req.url, "http://x").searchParams;
    const claimId = params.get("claimId");

    if (!claimId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Missing claimId parameter" }));
      return;
    }

    try {
      const claimCases = readData("claim-cases") || [];
      const claimCase = claimCases.find((item) => item.id === claimId);
      if (!claimCase) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Claim not found" }));
        return;
      }

      const claimMaterials = (readData("claim-materials") || []).filter(
        (material) => material.claimCaseId === claimId,
      );
      const claimDocuments = readData("claim-documents") || [];
      const latestImportRecord = [...claimDocuments]
        .filter((record) => record.claimCaseId === claimId)
        .sort(
          (a, b) =>
            new Date(b.importedAt || 0).getTime() - new Date(a.importedAt || 0).getTime(),
        )[0] || null;
      const latestImportTask = latestImportRecord?.taskId
        ? getTask(latestImportRecord.taskId)
        : null;
      const reviewTasks = (readData("review-tasks") || []).filter(
        (task) => task.claimCaseId === claimId,
      );
      const userLogs = (readData("user-operation-logs") || [])
        .filter((log) => log.claimId === claimId || log.claimCaseId === claimId)
        .map((log) => ({ ...log, logSource: "user" }));
      const auditLogs = readAuditLogs("all", { claimCaseId: claimId }).map((log) => ({
        logId: `audit-${log.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: log.timestamp,
        userName: log.operator || "系统",
        operationType: mapAuditTypeToOperationType(log.type),
        operationLabel: formatAuditLogLabel(log),
        claimId: log.claimCaseId,
        claimReportNumber: null,
        currentStatus: log.newStatus || null,
        inputData: log.input || null,
        outputData: log.output || null,
        success: log.success !== false,
        duration: log.duration || null,
        logSource: "system",
      }));

      const logs = [...userLogs, ...auditLogs].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      const processTimeline = buildClaimProcessTimeline({
        claimCase,
        claimMaterials,
        logs,
        reviewTasks,
        latestImportTask,
      });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          claimId,
          processTimeline,
        }),
      );
    } catch (error) {
      console.error("[claim-process-timeline] Error:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Failed to build claim process timeline" }));
    }
    return;
  }

  // 执行理算（通用接口，按公式类型区分）
  if (resource === "calculate") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { formulaType, context } = await parseBody(req);
      if (!formulaType) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing formulaType" }));
        return;
      }

      const result = executeCalculation(formulaType, context || {});

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[calculate error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 获取公式列表
  // 获取公式列表
  if (resource === "formulas" && !id) {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const formulas = getAvailableFormulas();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(formulas));
    } catch (error) {
      console.error("[formulas error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 获取/保存公式详情
  if (resource === "formulas" && id) {
    if (req.method === "GET") {
      try {
        const formula = getFormulaDetail(id);
        if (!formula) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Formula not found" }));
        } else {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(formula));
        }
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: formatErrorMessage(error) }));
      }
      return;
    }

    if (req.method === "PUT") {
      try {
        const config = await parseBody(req);
        const success = saveFormulaConfig(id, config);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success }));
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: formatErrorMessage(error) }));
      }
      return;
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  // 费用分类
  if (resource === "classify-expense") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const params = await parseBody(req);
      const result = classify(params);

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[classify-expense error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 获取费用类型列表
  if (resource === "expense-categories") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const categories = getExpenseCategories();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(categories));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 获取社保类型列表
  if (resource === "social-security-types") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const types = getSocialSecurityTypes();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(types));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 获取伤害标准列表
  if (resource === "injury-standards") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const standards = getInjuryStandards();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(standards));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  if (resource === "review-tasks") {
    res.setHeader("Content-Type", "application/json");
    try {
      if (req.method === "GET") {
        if (id) {
          const task = await reviewTaskService.getById(id);
          if (!task) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Task not found" }));
          } else {
            res.end(JSON.stringify(task));
          }
        } else {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const filters = {};
          if (url.searchParams.get("status")) filters.status = url.searchParams.get("status");
          if (url.searchParams.get("claimCaseId")) filters.claimCaseId = url.searchParams.get("claimCaseId");
          if (url.searchParams.get("priority")) filters.priority = url.searchParams.get("priority");
          if (url.searchParams.get("reviewerId")) filters.reviewerId = url.searchParams.get("reviewerId");
          
          const tasks = await reviewTaskService.list(filters);
          res.end(JSON.stringify(tasks));
        }
      } else if (req.method === "POST") {
        const body = await parseBody(req);
        
        if (body.action === "check-and-create") {
          const task = await reviewTaskService.checkAndCreateTask(body);
          res.statusCode = 201;
          res.end(JSON.stringify({ success: true, data: task }));
        } else if (body.action === "stats") {
          const stats = await reviewTaskService.getStats();
          res.end(JSON.stringify(stats));
        } else {
          const task = await reviewTaskService.create(body);
          res.statusCode = 201;
          res.end(JSON.stringify({ success: true, data: task }));
        }
      } else if (req.method === "PUT" && id) {
        const body = await parseBody(req);
        const task = await reviewTaskService.update(id, body);
        if (!task) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Task not found" }));
        } else {
          if (body.status === "已完成") {
            const logs = readData("user-operation-logs") || [];
            logs.push({
              logId: `log-${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`,
              timestamp: task.completedAt || new Date().toISOString(),
              userName: body.reviewerName || task.reviewerName || "人工处理",
              operationType: "CLAIM_ACTION",
              operationLabel: `人工完成材料复核 - ${task.materialName}`,
              claimId: task.claimCaseId,
              claimReportNumber: task.reportNumber || null,
              currentStatus: null,
              inputData: {
                taskId: task.id,
                materialId: task.materialId,
                materialName: task.materialName,
                taskType: task.taskType,
              },
              outputData: {
                actionType: "MANUAL_MATERIAL_REVIEW_COMPLETED",
                manualReviewNotes: body.manualReviewNotes || task.manualReviewNotes || "",
                manualInputData: body.manualInputData || task.manualInputData || {},
                reviewerId: body.reviewerId || task.reviewerId || null,
                reviewerName: body.reviewerName || task.reviewerName || "人工处理",
              },
              success: true,
              duration: null,
              userAgent: req.headers["user-agent"] || null,
              deviceType: detectDeviceType(req.headers["user-agent"]),
            });
            writeData("user-operation-logs", logs);
          }
          res.end(JSON.stringify({ success: true, data: task }));
        }
      } else if (req.method === "DELETE" && id) {
        const success = await reviewTaskService.delete(id);
        if (!success) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Task not found" }));
        } else {
          res.end(JSON.stringify({ success: true }));
        }
      } else {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: "Method Not Allowed" }));
      }
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 报案字段预设模板管理（对象结构，不是数组）
  if (resource === "intake-field-presets") {
    res.setHeader("Content-Type", "application/json");
    try {
      if (req.method === "GET") {
        // 返回整个预设对象或单个预设
        const data = readData(resource);
        if (id) {
          // 返回特定预设
          if (data[id]) {
            res.end(JSON.stringify(data[id]));
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Preset not found" }));
          }
        } else {
          // 返回所有预设（转换为数组格式便于前端使用）
          const presetsArray = Object.values(data);
          res.end(JSON.stringify(presetsArray));
        }
      } else if (req.method === "PUT") {
        const payload = await parseBody(req);
        const data = readData(resource);
        
        if (id) {
          // 更新单个预设
          if (!data[id]) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Preset not found" }));
            return;
          }
          data[id] = { ...data[id], ...payload };
          writeData(resource, data);
          res.end(JSON.stringify({ success: true, data: data[id] }));
        } else {
          // 批量更新所有预设（对象格式）
          writeData(resource, payload);
          res.end(JSON.stringify({ success: true, count: Object.keys(payload).length }));
        }
      } else if (req.method === "POST") {
        // 创建新预设
        const newItem = await parseBody(req);
        const data = readData(resource);
        
        if (!newItem.id) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Preset id is required" }));
          return;
        }
        
        data[newItem.id] = newItem;
        writeData(resource, data);
        res.statusCode = 201;
        res.end(JSON.stringify({ success: true, data: newItem }));
      } else if (req.method === "DELETE") {
        if (!id) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "DELETE requires an ID" }));
          return;
        }
        const data = readData(resource);
        if (!data[id]) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Preset not found" }));
        } else {
          delete data[id];
          writeData(resource, data);
          res.end(JSON.stringify({ success: true }));
        }
      } else {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: "Method Not Allowed" }));
      }
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  if (resource === "materials" && id === "classify") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const body = await parseBody(req);
      const { fileSource, mimeType } = body;

      if (!fileSource) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing fileSource" }));
        return;
      }

      const buffer = Buffer.from(fileSource, "base64");

      const processResult = await processFile({
        fileName: "uploaded-file",
        mimeType: mimeType || "image/jpeg",
        buffer: buffer,
        options: {
          base64Data: fileSource,
          skipOCR: false,
        },
      });

      const classification = await classifyMaterial(
        processResult,
        "uploaded-file"
      );

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          data: classification,
        })
      );
    } catch (error) {
      console.error("[materials/classify error]", error);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: formatErrorMessage(error),
        })
      );
    }
    return;
  }

  // 材料 Schema 查询 API
  if (resource === "materials" && id && id !== "classify") {
    if (req.method === "GET") {
      try {
        const materials = readData("claims-materials");
        const material = materials.find((m) => m.id === id);

        if (!material) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Material not found" }));
          return;
        }

        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            success: true,
            data: {
              materialId: material.id,
              materialName: material.name,
              category: material.category,
              extractionConfig: material.extractionConfig || null,
            },
          }),
        );
      } catch (error) {
        console.error("[materials/schema error]", error);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: formatErrorMessage(error) }));
      }
      return;
    }
  }

  if (!allowedResources.includes(resource)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: `Invalid Resource: ${resource}` }));
    return;
  }

  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method === "GET") {
      const data = readData(resource);
      if (id) {
        const idx = findItemIndex(data, id);
        if (idx === -1) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Item not found" }));
        } else {
          res.end(JSON.stringify(data[idx]));
        }
      } else {
        res.end(JSON.stringify(data));
      }
    } else if (req.method === "POST") {
      let newItem = await parseBody(req);
      newItem = normalizeIfRulesetResource(resource, newItem);
      newItem = normalizeIfClaimsMaterialsResource(resource, newItem);
      const validationErrors = validateIfRulesetResource(resource, newItem);
      const materialValidationErrors = validateIfClaimsMaterialsResource(resource, newItem);
      if (validationErrors.length > 0 || materialValidationErrors.length > 0) {
        res.statusCode = 400;
        const details = [...validationErrors, ...materialValidationErrors];
        res.end(JSON.stringify({ error: details[0], details }));
        return;
      }
      const data = readData(resource);

      // 特殊处理：批量日志插入
      if (
        resource === "user-operation-logs" &&
        newItem.logs &&
        Array.isArray(newItem.logs)
      ) {
        data.push(...newItem.logs);
        writeData(resource, data);
        res.statusCode = 201;
        res.end(JSON.stringify({ success: true, count: newItem.logs.length }));
      } else {
        // 原有逻辑：单个插入
        data.push(newItem);
        writeData(resource, data);

        // 新建赔案时同步 fileCategories 到 claim-materials
        if (resource === "claim-cases" && newItem?.id && newItem?.fileCategories) {
          syncFileCategoriesToMaterials(newItem.id, newItem.fileCategories);
        }

        res.statusCode = 201;
        res.end(JSON.stringify({ success: true, data: newItem }));
      }
    } else if (req.method === "PUT") {
      let payload = await parseBody(req);
      payload = normalizeIfRulesetResource(resource, payload);
      payload = normalizeIfClaimsMaterialsResource(resource, payload);
      const validationErrors = validateIfRulesetResource(resource, payload);
      const materialValidationErrors = validateIfClaimsMaterialsResource(resource, payload);
      if (validationErrors.length > 0 || materialValidationErrors.length > 0) {
        res.statusCode = 400;
        const details = [...validationErrors, ...materialValidationErrors];
        res.end(JSON.stringify({ error: details[0], details }));
        return;
      }
      if (id) {
        const data = readData(resource);
        const idx = findItemIndex(data, id);
        if (idx === -1) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Item not found" }));
        } else {
          const merged = normalizeIfClaimsMaterialsResource(
            resource,
            normalizeIfRulesetResource(resource, { ...data[idx], ...payload }),
          );
          const mergedErrors = validateIfRulesetResource(resource, merged);
          const mergedMaterialErrors = validateIfClaimsMaterialsResource(resource, merged);
          if (mergedErrors.length > 0 || mergedMaterialErrors.length > 0) {
            res.statusCode = 400;
            const details = [...mergedErrors, ...mergedMaterialErrors];
            res.end(JSON.stringify({ error: details[0], details }));
            return;
          }
          data[idx] = merged;
          writeData(resource, data);

          // 同步 fileCategories 到 claim-materials
          if (resource === "claim-cases" && payload.fileCategories) {
            syncFileCategoriesToMaterials(id, payload.fileCategories);
          }

          res.end(JSON.stringify({ success: true, data: data[idx] }));
        }
      } else {
        const batchMaterialErrors = validateIfClaimsMaterialsResource(resource, payload);
        if (batchMaterialErrors.length > 0) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: batchMaterialErrors[0], details: batchMaterialErrors }));
          return;
        }
        writeData(resource, payload);
        res.end(
          JSON.stringify({
            success: true,
            count: Array.isArray(payload) ? payload.length : 1,
          }),
        );
      }
    } else if (req.method === "DELETE") {
      if (!id) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "DELETE requires an ID" }));
        return;
      }
      const data = readData(resource);
      const idx = findItemIndex(data, id);
      if (idx === -1) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Item not found" }));
      } else {
        const removed = data.splice(idx, 1)[0];
        writeData(resource, data);
        res.end(JSON.stringify({ success: true, data: removed }));
      }
    } else {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
    }
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: e.message || "Bad Request" }));
  }
};

// ============ 批量分类辅助函数 ============

async function classifyMaterialFromAPI(result, fileName) {
  if (result.parseStatus !== 'completed') {
    return {
      materialId: 'unknown',
      materialName: '未识别',
      confidence: 0,
    };
  }

  try {
    const materials = readData('claims-materials');
    if (materials.length === 0) {
      return {
        materialId: 'unknown',
        materialName: '未识别',
        confidence: 0,
      };
    }

    const catalog = materials
      .map((m) => `${m.id}|${m.name}|${m.description?.slice(0, 60) || ''}`)
      .join('\n');

    const ocrText = result.extractedText || '';
    const prompt = `你是保险理赔材料分类专家。请根据以下 OCR 文字内容，从材料目录中选出最匹配的材料类型。

【OCR 文字】
${ocrText.slice(0, 1200)}

【文件名参考】${fileName}

【材料目录（格式: id|名称|说明摘要）】
${catalog}

请返回 JSON：{"materialId":"...","materialName":"...","confidence":0.0到1.0之间的小数,"reason":"简短说明"}。若无匹配则 materialId 填 "unknown"，materialName 填 "未识别"，confidence 填 0。`;

    const { response } = await generateGeminiContent({
      apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY,
      request: {
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }] },
        config: { temperature: 0.1 },
      },
      meta: {
        sourceApp: 'admin-system',
        module: 'apiHandler.classifyMaterial',
        operation: 'classify_material',
        context: {
          fileName,
          materialCount: materials.length,
        },
      },
    });

    const raw = response.text || '{}';
    let parsed = {};
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {}

    const classification = {
      materialId: parsed.materialId || 'unknown',
      materialName: parsed.materialName || '未识别',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    };

    return classification;
  } catch (error) {
    console.error('[API] classifyMaterialFromAPI error:', error);
    return {
      materialId: 'unknown',
      materialName: '未识别',
      confidence: 0,
    };
  }
}
