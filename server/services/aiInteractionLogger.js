/**
 * Unified AI interaction logging.
 * Stores raw request/response for debugging and a sanitized summary for default reads.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readData, writeData } from '../utils/fileStore.js';
import { clearAIStatsCache } from './aiStatsCache.js';
import { syncAggregatedLog } from './aiStatsDailyService.js';

const LOG_FILE = 'ai-interaction-logs';
const MAX_LOG_ENTRIES = 10000;
const SENSITIVE_KEYWORDS = [
  'password',
  'token',
  'apikey',
  'api_key',
  'secret',
  'authorization',
  'idnumber',
  'id_number',
  '身份证',
  'bankaccount',
  'bank_account',
  '银行卡',
  'phone',
  'mobile',
  'email',
  'patientname',
  'insuredname',
  'claimantname',
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const dataDir = path.join(projectRoot, 'jsonlist');

function generateLogId() {
  return `ailog-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function generateTraceId() {
  return `trace-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function safeClone(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => safeClone(item));
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('base64');
  }
  if (value instanceof Error) {
    return serializeError(value);
  }
  if (typeof value === 'object') {
    if (typeof value.toJSON === 'function') {
      try {
        return safeClone(value.toJSON());
      } catch {
        // fall through
      }
    }
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = safeClone(child);
    }
    return output;
  }
  return String(value);
}

function serializeError(error) {
  const normalized = error instanceof Error ? error : new Error(String(error));
  return {
    name: normalized.name,
    message: normalized.message,
    stack: normalized.stack,
    code: normalized.code || null,
    cause: normalized.cause ? safeClone(normalized.cause) : null,
  };
}

function containsSensitiveKey(key) {
  const normalized = String(key || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
  return SENSITIVE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  if (value.length > 8000) {
    return `${value.slice(0, 4000)}...[truncated:${value.length}]...${value.slice(-1000)}`;
  }
  return value;
}

function sanitizeData(value, forceMask = false) {
  if (forceMask) return '***';
  if (value === undefined || value === null) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeData(item));

  const output = {};
  for (const [key, child] of Object.entries(value)) {
    const mask = containsSensitiveKey(key);
    output[key] = sanitizeData(child, mask);
  }
  return output;
}

function rotateLogs(logs) {
  if (logs.length <= MAX_LOG_ENTRIES) return logs;
  return logs.slice(logs.length - MAX_LOG_ENTRIES);
}

function getCurrentLogResource() {
  return `ai-logs-${new Date().toISOString().slice(0, 7)}`;
}

function listShardResources() {
  if (!fs.existsSync(dataDir)) return [LOG_FILE];
  const shardResources = fs
    .readdirSync(dataDir)
    .filter((name) => /^ai-logs-\d{4}-\d{2}\.json$/.test(name))
    .map((name) => name.replace(/\.json$/, ''))
    .sort();
  return shardResources.length > 0 ? shardResources : [LOG_FILE];
}

function readLogs() {
  const resources = new Set([LOG_FILE, ...listShardResources()]);
  const logs = [];
  for (const resource of resources) {
    const entries = readData(resource) || [];
    if (Array.isArray(entries)) {
      logs.push(...entries);
    }
  }
  return logs;
}

function writeLogs(logs, resource = getCurrentLogResource()) {
  return writeData(resource, rotateLogs(logs));
}

function writeLogEntry(entry) {
  const resource = getCurrentLogResource();
  const logs = readData(resource) || [];
  logs.push(entry);
  writeLogs(logs, resource);
  syncAggregatedLog(null, entry);
  clearAIStatsCache();
  return entry;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeTokenUsage(tokenUsage, response) {
  const rawUsageMetadata =
    safeClone(tokenUsage) ||
    safeClone(response?.usageMetadata) ||
    safeClone(response?.usage_metadata) ||
    safeClone(response?.response_metadata?.usageMetadata) ||
    safeClone(response?.response_metadata?.usage_metadata) ||
    null;

  const usage = rawUsageMetadata || {};
  const inputTokens =
    usage.promptTokenCount ??
    usage.input_tokens ??
    usage.inputTokens ??
    usage.prompt_tokens ??
    usage.prompt_tokens_count ??
    null;
  const outputTokens =
    usage.candidatesTokenCount ??
    usage.output_tokens ??
    usage.outputTokens ??
    usage.completion_tokens ??
    usage.completionTokenCount ??
    null;
  const totalTokens =
    usage.totalTokenCount ??
    usage.total_tokens ??
    usage.totalTokens ??
    (typeof inputTokens === 'number' && typeof outputTokens === 'number'
      ? inputTokens + outputTokens
      : null);

  return {
    usageType: 'token',
    inputTokens: typeof inputTokens === 'number' ? inputTokens : null,
    outputTokens: typeof outputTokens === 'number' ? outputTokens : null,
    totalTokens: typeof totalTokens === 'number' ? totalTokens : null,
    pricingRuleId:
      rawUsageMetadata?.pricingRuleId ??
      response?.pricingRuleId ??
      null,
    estimatedCost:
      typeof (rawUsageMetadata?.estimatedCost ?? response?.estimatedCost) === 'number'
        ? rawUsageMetadata?.estimatedCost ?? response?.estimatedCost
        : null,
    rawUsageMetadata,
    unavailableReason: rawUsageMetadata ? null : 'provider_did_not_return_usage_metadata',
  };
}

function summarizeRequest(request) {
  if (!request) return null;
  const contents = safeClone(request.contents);
  const textParts = [];
  const attachmentSummary = [];

  const visitPart = (part) => {
    if (!part || typeof part !== 'object') return;
    if (typeof part.text === 'string') {
      textParts.push(part.text);
    }
    if (part.inlineData) {
      attachmentSummary.push({
        mimeType: part.inlineData.mimeType || null,
        hasInlineData: true,
        size: part.inlineData.data ? String(part.inlineData.data).length : 0,
      });
    }
    if (part.fileData) {
      attachmentSummary.push({
        mimeType: part.fileData.mimeType || null,
        fileUri: part.fileData.fileUri || null,
        hasFileData: true,
      });
    }
  };

  const visitContents = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visitContents);
      return;
    }
    if (value.parts && Array.isArray(value.parts)) {
      value.parts.forEach(visitPart);
    } else {
      visitPart(value);
    }
  };

  visitContents(contents);

  return {
    systemInstruction: safeClone(request.config?.systemInstruction || request.systemInstruction || null),
    promptText: textParts.join('\n').trim() || null,
    attachmentSummary,
    tools: safeClone(request.config?.tools || request.tools || null),
    toolConfig: safeClone(request.config?.toolConfig || request.toolConfig || null),
    generationConfig: safeClone(request.config || request.generationConfig || null),
  };
}

function summarizeResponse(response) {
  if (!response) return null;
  return {
    text: response.text || response.content || null,
    finishReason:
      response.finishReason ||
      response.response_metadata?.finishReason ||
      response.response_metadata?.finish_reason ||
      response.candidates?.[0]?.finishReason ||
      null,
    toolCalls: safeClone(response.tool_calls || response.toolCalls || response.candidates?.[0]?.content?.parts?.filter((part) => part.functionCall)),
    grounding: safeClone(
      response.candidates?.[0]?.groundingMetadata ||
      response.response_metadata?.groundingMetadata ||
      null,
    ),
  };
}

function normalizeLegacyLog(logData) {
  const startTime = logData.performance?.startTime || Date.now();
  const endTime = logData.performance?.endTime || startTime;
  const response = logData.output
    ? {
        raw: safeClone(logData.output),
        ...summarizeResponse(logData.output.parsedResult || logData.output),
      }
    : null;
  const context = {
    taskId: logData.taskId || null,
    taskType: logData.taskType || null,
    fileIndex: logData.fileIndex ?? null,
  };

  return {
    id: generateLogId(),
    timestamp: nowIso(),
    traceId: logData.traceId || logData.taskId || generateTraceId(),
    sessionId: logData.sessionId || logData.taskId || null,
    requestId: logData.requestId || generateLogId(),
    sourceApp: logData.sourceApp || 'server',
    module: logData.module || logData.taskType || 'legacy',
    runtime: logData.runtime || 'server',
    provider: logData.provider || 'gemini',
    model: logData.input?.model || logData.model || 'unknown',
    operation: logData.operation || logData.taskType || 'legacy_interaction',
    capabilityId: logData.capabilityId || logData.context?.capabilityId || null,
    promptTemplateId: logData.promptTemplateId || null,
    promptSourceType: logData.promptSourceType || null,
    context,
    request: {
      raw: safeClone(logData.input),
      summary: summarizeRequest(logData.input),
    },
    response: response
      ? {
          raw: response.raw,
          ...summarizeResponse(response.raw),
        }
      : null,
    performance: {
      startedAt: new Date(startTime).toISOString(),
      endedAt: new Date(endTime).toISOString(),
      durationMs: logData.performance?.duration ?? endTime - startTime,
      attempt: logData.performance?.attempt || 1,
      retryCount: logData.performance?.retryCount || 0,
    },
    tokenUsage: normalizeTokenUsage(logData.tokenUsage, logData.output?.parsedResult),
    success: !logData.error,
    error: logData.error ? serializeError(logData.error) : null,
    fallbackInfo: logData.fallbackFrom
      ? {
          from: logData.fallbackFrom,
          reason: logData.fallbackReason || null,
        }
      : null,
    containsSensitiveData: true,
    sanitized: {
      request: sanitizeData(logData.input),
      response: sanitizeData(logData.output),
      context: sanitizeData(context),
    },
  };
}

function buildEntry(meta) {
  const request = safeClone(meta.request || {});
  const context = safeClone(meta.context || {});

  return {
    id: meta.id || generateLogId(),
    timestamp: meta.timestamp || nowIso(),
    traceId: meta.traceId || context.traceId || context.claimCaseId || context.taskId || generateTraceId(),
    sessionId: meta.sessionId || context.sessionId || context.voiceSessionId || context.taskId || null,
    requestId: meta.requestId || generateLogId(),
    sourceApp: meta.sourceApp || 'server',
    module: meta.module || 'unknown',
    runtime: meta.runtime || 'server',
    provider: meta.provider || 'gemini',
    model: meta.model || request.model || null,
    operation: meta.operation || 'generate_content',
    capabilityId: meta.capabilityId || context.capabilityId || null,
    promptTemplateId: meta.promptTemplateId || null,
    promptSourceType: meta.promptSourceType || null,
    context,
    request: {
      raw: request,
      summary: summarizeRequest(request),
    },
    response: null,
    performance: {
      startedAt: meta.startedAt || nowIso(),
      endedAt: null,
      durationMs: null,
      attempt: meta.attempt || 1,
      retryCount: meta.retryCount || 0,
    },
    tokenUsage: {
      usageType: 'token',
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      pricingRuleId: null,
      estimatedCost: null,
      rawUsageMetadata: null,
      unavailableReason: 'pending',
    },
    success: null,
    error: null,
    fallbackInfo: meta.fallbackInfo || null,
    containsSensitiveData: meta.containsSensitiveData !== false,
    sanitized: {
      context: sanitizeData(context),
      request: sanitizeData(request),
      response: null,
    },
  };
}

function updateEntry(logId, updater) {
  const resources = listShardResources();
  for (const resource of resources) {
    const logs = readData(resource) || [];
    const index = logs.findIndex((item) => item.id === logId);
    if (index === -1) continue;
    const previousEntry = logs[index];
    logs[index] = updater(logs[index]);
    writeLogs(logs, resource);
    syncAggregatedLog(previousEntry, logs[index]);
    clearAIStatsCache();
    return logs[index];
  }
  return null;
}

export function startInteraction(meta = {}) {
  const entry = buildEntry(meta);
  writeLogEntry(entry);
  return {
    logId: entry.id,
    startedAtMs: Date.now(),
    entry,
  };
}

export function finishInteraction(handle, result = {}) {
  if (!handle?.logId) return null;
  const endedAtMs = Date.now();
  return updateEntry(handle.logId, (entry) => {
    const rawResponse = safeClone(result.response || null);
    const normalizedError = result.error ? serializeError(result.error) : null;
    const tokenUsage = normalizeTokenUsage(result.tokenUsage, rawResponse);
    if (result.pricingRuleId) tokenUsage.pricingRuleId = result.pricingRuleId;
    if (typeof result.estimatedCost === 'number') tokenUsage.estimatedCost = result.estimatedCost;
    return {
      ...entry,
      response: rawResponse
        ? {
            raw: rawResponse,
            ...summarizeResponse(rawResponse),
          }
        : null,
      performance: {
        ...entry.performance,
        endedAt: new Date(endedAtMs).toISOString(),
        durationMs: result.durationMs ?? endedAtMs - handle.startedAtMs,
        attempt: result.attempt || entry.performance.attempt || 1,
        retryCount: result.retryCount ?? entry.performance.retryCount ?? 0,
      },
      tokenUsage,
      success: normalizedError ? false : result.success !== false,
      error: normalizedError,
      fallbackInfo: result.fallbackInfo || entry.fallbackInfo || null,
      sanitized: {
        ...entry.sanitized,
        response: sanitizeData(rawResponse),
      },
    };
  });
}

export function logInteraction(logData) {
  const entry = normalizeLegacyLog(logData);
  writeLogEntry(entry);
  return entry;
}

export function getLogsByTask(taskId, options = {}) {
  return queryLogs({ ...options, taskId }).logs;
}

export function getLogsByFile(taskId, fileIndex, options = {}) {
  return queryLogs({ ...options, taskId, fileIndex }).logs;
}

function matchesDateRange(timestamp, startTime, endTime) {
  const time = new Date(timestamp).getTime();
  if (startTime && time < new Date(startTime).getTime()) return false;
  if (endTime && time > new Date(endTime).getTime()) return false;
  return true;
}

function normalizeSearchTerm(value) {
  return String(value || '').trim().toLowerCase();
}

function extractTaskIdFromDocumentRef(value) {
  const match = String(value || '').match(/(task-[a-f0-9-]+)-\d+$/i);
  return match ? match[1] : null;
}

function createAssociationIndexes() {
  const claimDocuments = readData('claim-documents');
  const claimMaterials = readData('claim-materials');
  const documents = Array.isArray(claimDocuments) ? claimDocuments : [];
  const materials = Array.isArray(claimMaterials) ? claimMaterials : [];

  const documentsById = new Map();
  const documentsByTaskDocumentId = new Map();
  const documentsByFileName = new Map();
  const materialsByFileName = new Map();

  for (const doc of documents) {
    if (doc?.documentId) {
      documentsById.set(doc.documentId, doc);
      documentsByTaskDocumentId.set(String(doc.documentId), doc);
    }
    if (doc?.fileName) {
      const key = String(doc.fileName);
      if (!documentsByFileName.has(key)) documentsByFileName.set(key, []);
      documentsByFileName.get(key).push(doc);
    }
  }

  for (const material of materials) {
    if (material?.fileName) {
      const key = String(material.fileName);
      if (!materialsByFileName.has(key)) materialsByFileName.set(key, []);
      materialsByFileName.get(key).push(material);
    }
  }

  return {
    documentsById,
    documentsByTaskDocumentId,
    documentsByFileName,
    materialsByFileName,
  };
}

function pickSingleAssociation(records, predicate = null) {
  if (!Array.isArray(records) || records.length === 0) return null;
  const filtered = predicate ? records.filter(predicate) : records;
  if (filtered.length === 1) return filtered[0];
  return null;
}

function getAttachmentSignature(log) {
  const firstAttachment = log?.request?.summary?.attachmentSummary?.[0];
  if (!firstAttachment?.mimeType || !firstAttachment?.size) return null;
  return `${firstAttachment.mimeType}:${firstAttachment.size}`;
}

function enrichLogAssociation(log, indexes) {
  if (!log || !indexes) return log;

  const context = isPlainObject(log.context) ? { ...log.context } : {};
  const fileName = context.fileName || null;
  const materialId = context.materialId || null;
  const documentId = context.documentId || context.docId || null;
  const taskDocumentId = context.docId || context.documentId || null;

  let matchedDocument =
    (documentId && indexes.documentsById.get(String(documentId))) ||
    (taskDocumentId && indexes.documentsByTaskDocumentId.get(String(taskDocumentId))) ||
    null;

  if (!matchedDocument && fileName) {
    matchedDocument = pickSingleAssociation(indexes.documentsByFileName.get(String(fileName)));
  }

  let matchedMaterial = null;
  if (fileName) {
    matchedMaterial = pickSingleAssociation(
      indexes.materialsByFileName.get(String(fileName)),
      (item) => !materialId || item?.materialId === materialId
    );
  }

  const parsedTaskId =
    context.taskId ||
    extractTaskIdFromDocumentRef(documentId) ||
    extractTaskIdFromDocumentRef(taskDocumentId) ||
    null;

  const taskId =
    context.taskId ||
    matchedDocument?.taskId ||
    matchedMaterial?.taskId ||
    parsedTaskId ||
    null;

  const claimCaseId =
    context.claimCaseId ||
    matchedDocument?.claimCaseId ||
    matchedMaterial?.claimCaseId ||
    null;

  const traceId =
    log.traceId ||
    context.traceId ||
    matchedDocument?.traceId ||
    (claimCaseId ? `trace-${claimCaseId}` : null);

  return {
    ...log,
    traceId,
    context: {
      ...context,
      taskId,
      claimCaseId,
    },
  };
}

function createAttachmentAssociationIndex(logs) {
  const index = new Map();

  for (const log of logs) {
    const signature = getAttachmentSignature(log);
    if (!signature) continue;
    if (!log?.context?.fileName) continue;

    const entry = {
      fileName: log.context.fileName || null,
      taskId: log.context.taskId || null,
      claimCaseId: log.context.claimCaseId || null,
      traceId: log.traceId || null,
    };

    if (!index.has(signature)) index.set(signature, []);
    index.get(signature).push(entry);
  }

  return index;
}

function enrichLogByAttachment(log, attachmentIndex) {
  if (!log || !attachmentIndex) return log;
  if (log.context?.taskId || log.context?.claimCaseId || log.traceId) return log;

  const signature = getAttachmentSignature(log);
  if (!signature) return log;

  const candidates = attachmentIndex.get(signature) || [];
  const uniqueCandidates = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueCandidates.push(candidate);
  }

  if (uniqueCandidates.length !== 1) return log;
  const matched = uniqueCandidates[0];
  if (!matched?.taskId && !matched?.claimCaseId && !matched?.traceId) return log;

  return {
    ...log,
    traceId: log.traceId || matched.traceId || (matched.claimCaseId ? `trace-${matched.claimCaseId}` : null),
    context: {
      ...(isPlainObject(log.context) ? log.context : {}),
      fileName: log.context?.fileName || matched.fileName || null,
      taskId: log.context?.taskId || matched.taskId || null,
      claimCaseId: log.context?.claimCaseId || matched.claimCaseId || null,
    },
  };
}

function buildSearchHaystack(log) {
  return [
    log.id,
    log.traceId,
    log.sessionId,
    log.requestId,
    log.module,
    log.operation,
    log.model,
    log.capabilityId,
    log.sourceApp,
    log.context?.group,
    log.context?.companyId,
    log.context?.companyName,
    log.context?.claimCaseId,
    log.context?.taskId,
    log.context?.voiceSessionId,
    log.context?.fileName,
    log.context?.documentId,
    log.request?.summary?.promptText,
    log.response?.text,
    log.sanitized?.context ? JSON.stringify(log.sanitized.context) : null,
    log.sanitized?.request ? JSON.stringify(log.sanitized.request) : null,
    log.sanitized?.response ? JSON.stringify(log.sanitized.response) : null,
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

function mapForRead(log, includeRaw = false) {
  if (includeRaw) return log;
  return {
    ...log,
    request: {
      summary: log.request?.summary || null,
      raw: null,
    },
    response: {
      text: log.response?.text || null,
      finishReason: log.response?.finishReason || null,
      toolCalls: log.response?.toolCalls || null,
      grounding: log.response?.grounding || null,
      raw: null,
    },
    sanitized: log.sanitized,
  };
}

function mapForSummary(log) {
  return {
    id: log.id,
    timestamp: log.timestamp,
    traceId: log.traceId,
    sessionId: log.sessionId,
    requestId: log.requestId,
    sourceApp: log.sourceApp,
    module: log.module,
    runtime: log.runtime,
    provider: log.provider,
    model: log.model,
    operation: log.operation,
    capabilityId: log.capabilityId,
    promptTemplateId: log.promptTemplateId,
    promptSourceType: log.promptSourceType,
    group: log.context?.group || null,
    success: log.success,
    error: log.error
      ? {
          name: log.error.name || null,
          message: log.error.message || String(log.error),
        }
      : null,
    performance: {
      startedAt: log.performance?.startedAt || null,
      endedAt: log.performance?.endedAt || null,
      durationMs: log.performance?.durationMs ?? null,
      attempt: log.performance?.attempt ?? null,
      retryCount: log.performance?.retryCount ?? null,
    },
    tokenUsage: {
      usageType: log.tokenUsage?.usageType ?? 'token',
      inputTokens: log.tokenUsage?.inputTokens ?? null,
      outputTokens: log.tokenUsage?.outputTokens ?? null,
      totalTokens: log.tokenUsage?.totalTokens ?? null,
      pricingRuleId: log.tokenUsage?.pricingRuleId ?? null,
      estimatedCost: log.tokenUsage?.estimatedCost ?? null,
      unavailableReason: log.tokenUsage?.unavailableReason ?? null,
    },
    context: {
      claimCaseId: log.context?.claimCaseId || null,
      taskId: log.context?.taskId || null,
      fileIndex: log.context?.fileIndex ?? null,
      voiceSessionId: log.context?.voiceSessionId || null,
      capabilityId: log.context?.capabilityId || null,
      group: log.context?.group || null,
      companyId: log.context?.companyId || null,
      companyName: log.context?.companyName || null,
      businessObjectId: log.context?.businessObjectId || null,
    },
    request: {
      summary: log.request?.summary || null,
    },
    response: {
      text: log.response?.text || null,
      finishReason: log.response?.finishReason || null,
      toolCalls: log.response?.toolCalls || null,
    },
    fallbackInfo: log.fallbackInfo || null,
  };
}

export function queryLogs(options = {}) {
  const {
    logId,
    keyword,
    claimRef,
    fileName,
    claimCaseId,
    taskId,
    fileIndex,
    sessionId,
    traceId,
    sourceApp,
    module,
    provider,
    model,
    capabilityId,
    group,
    companyId,
    companyName,
    success,
    startTime,
    endTime,
    includeRaw = false,
    view = 'detail',
    limit = 50,
    offset = 0,
  } = options;

  let logs = readLogs();
  const associationIndexes = createAssociationIndexes();
  logs = logs.map((log) => enrichLogAssociation(log, associationIndexes));
  const attachmentIndex = createAttachmentAssociationIndex(logs);
  logs = logs.map((log) => enrichLogByAttachment(log, attachmentIndex));
  logs = logs.filter((log) => {
    if (logId && log.id !== logId) return false;
    if (claimCaseId && log.context?.claimCaseId !== claimCaseId) return false;
    if (taskId && log.context?.taskId !== taskId) return false;
    if (fileIndex !== undefined && log.context?.fileIndex !== fileIndex) return false;
    if (sessionId && log.sessionId !== sessionId) return false;
    if (traceId && log.traceId !== traceId) return false;
    if (sourceApp && log.sourceApp !== sourceApp) return false;
    if (module && log.module !== module) return false;
    if (provider && log.provider !== provider) return false;
    if (model && log.model !== model) return false;
    if (capabilityId && log.capabilityId !== capabilityId && log.context?.capabilityId !== capabilityId) return false;
    if (group && log.context?.group !== group) return false;
    if (companyId && log.context?.companyId !== companyId) return false;
    if (companyName && log.context?.companyName !== companyName) return false;
    if (success !== undefined && log.success !== success) return false;
    if (!matchesDateRange(log.timestamp, startTime, endTime)) return false;
    if (keyword || claimRef || fileName) {
      const haystack = buildSearchHaystack(log);
      if (keyword && !haystack.includes(normalizeSearchTerm(keyword))) return false;
      if (claimRef && !haystack.includes(normalizeSearchTerm(claimRef))) return false;
      if (fileName && !haystack.includes(normalizeSearchTerm(fileName))) return false;
    }
    return true;
  });

  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const total = logs.length;
  const paginatedLogs = logs
    .slice(offset, offset + limit)
    .map((item) => (view === 'summary' ? mapForSummary(item) : mapForRead(item, includeRaw)));

  return {
    logs: paginatedLogs,
    total,
    limit,
    offset,
  };
}

export function withLogging(fn, meta = {}) {
  return async function wrappedWithLogging(...args) {
    const handle = startInteraction(meta);
    try {
      const response = await fn(...args);
      finishInteraction(handle, {
        success: true,
        response,
      });
      return response;
    } catch (error) {
      finishInteraction(handle, {
        success: false,
        error,
      });
      throw error;
    }
  };
}
