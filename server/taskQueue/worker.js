/**
 * 文件处理 Worker
 * 处理单个文件的 OCR、分类，支持重试机制
 */

import fs from 'fs';
import { processFile } from '../services/fileProcessor.js';
import { updateFileStatus } from './queue.js';
import { writeAuditLog } from '../middleware/index.js';
import { readData } from '../utils/fileStore.js';
import OSS from 'ali-oss';
import { ensureFreshSignedUrl } from '../middleware/urlRefresher.js';
import { logInteraction } from '../services/aiInteractionLogger.js';
import { invokeAICapability } from '../services/aiRuntime.js';
import { renderPromptTemplate } from '../services/aiConfigService.js';
import { classifyMaterialByRules } from '../services/materialClassificationService.js';
import { processClaimMaterial } from '../services/claimMaterialPipeline.js';

const RETRYABLE_ERRORS = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'API_RATE_LIMIT',
  'TIMEOUT',
  'socket hang up',
  'network error',
  'fetch failed',
  'OSS_URL_EXPIRED',
  'EAI_AGAIN',
];

const MAX_RETRIES = 3;
const BATCH_CONCURRENCY = 3;
const DEFAULT_FILE_PROCESS_TIMEOUT_MS = Number(process.env.FILE_PROCESS_TIMEOUT_MS || 180000);

function getRetryDelay(retryCount) {
  return Math.pow(2, retryCount) * 1000;
}

function isRetryableError(error) {
  if (!error) return false;
  const errorMessage = error.message || String(error);
  return RETRYABLE_ERRORS.some(code => 
    errorMessage.includes(code) || 
    (error.code && error.code === code)
  );
}

function normalizeErrorMessage(error) {
  const raw = error?.message || String(error || '未知错误');
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || raw;
  } catch {
    return raw;
  }
}

async function classifyMaterial(result, fileName) {
  if (result.parseStatus !== 'completed') {
    return {
      materialId: 'unknown',
      materialName: '未识别',
      confidence: 0,
      matchStrategy: 'fallback',
      errorMessage: '文件解析未完成，无法分类',
    };
  }

  const materials = readData('claims-materials');
  if (!Array.isArray(materials) || materials.length === 0) {
    return {
      materialId: 'unknown',
      materialName: '未识别',
      confidence: 0,
      matchStrategy: 'fallback',
      errorMessage: '材料目录为空，无法执行分类',
    };
  }

  const ocrText = result.extractedText || '';
  const ruleResult = classifyMaterialByRules(materials, fileName, ocrText);
  if (ruleResult) {
    return ruleResult;
  }

  try {
    const catalog = materials
      .map((m) => `${m.id}|${m.name}|${m.description?.slice(0, 80) || ''}`)
      .join('\n');

    const prompt = renderPromptTemplate('material_classifier', {
      ocrText: ocrText.slice(0, 1800),
      fileName,
      catalog,
    });

    const { response } = await invokeAICapability({
      capabilityId: 'admin.material.classification',
      request: {
        contents: { parts: [{ text: prompt }] },
        config: { temperature: 0.1 },
      },
      meta: {
        sourceApp: 'admin-system',
        module: 'taskQueue.worker.classifyMaterial',
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

    const parsedId = parsed.materialId || 'unknown';
    const matched = materials.find((m) => m.id === parsedId);
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
    const classification = matched
      ? {
          materialId: matched.id,
          materialName: matched.name || parsed.materialName || '未识别',
          confidence: Math.max(0, Math.min(1, confidence)),
          source: 'ai',
          matchStrategy: 'ai',
        }
      : {
          materialId: 'unknown',
          materialName: '未识别',
          confidence: 0,
          source: 'ai',
          matchStrategy: 'fallback',
          errorMessage: 'AI 未匹配到有效材料目录项',
        };

    return classification;
  } catch (error) {
    console.error('[Worker] classifyMaterial error:', error);
    return {
      materialId: 'unknown',
      materialName: '分类失败',
      confidence: 0,
      source: 'ai',
      matchStrategy: 'fallback',
      errorMessage: normalizeErrorMessage(error),
    };
  }
}

async function processWithTimeout(processFn, timeoutMs = 60000) {
  return Promise.race([
    processFn(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
    }),
  ]);
}

async function downloadFileFromOSS(ossKey, retryCount = 0) {
  try {
    const region = process.env.ALIYUN_OSS_REGION || 'oss-cn-beijing';
    const bucket = process.env.ALIYUN_OSS_BUCKET;
    const accessKeyId = process.env.ALIYUN_OSS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.ALIYUN_OSS_ACCESS_KEY_SECRET;

    if (!bucket || !accessKeyId || !accessKeySecret) {
      throw new Error('OSS credentials not configured');
    }

    const client = new OSS({
      region,
      accessKeyId,
      accessKeySecret,
      bucket,
    });

    const signedUrl = client.signatureUrl(ossKey, { expires: 3600 });
    const response = await fetch(signedUrl);
    
    if (!response.ok) {
      if (response.status === 403 && retryCount < MAX_RETRIES) {
        console.log(`[Worker] URL expired for ${ossKey}, retrying with fresh URL...`);
        const freshUrl = await ensureFreshSignedUrl(signedUrl, ossKey);
        const retryResponse = await fetch(freshUrl);
        if (!retryResponse.ok) {
          throw new Error(`Failed to download file after URL refresh: ${retryResponse.status}`);
        }
        return Buffer.from(await retryResponse.arrayBuffer());
      }
      throw new Error(`Failed to download file: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error(`[Worker] downloadFileFromOSS error for ${ossKey}:`, error);
    throw error;
  }
}

async function readLocalFile(localPath) {
  try {
    return await fs.promises.readFile(localPath);
  } catch (error) {
    console.error(`[Worker] readLocalFile error for ${localPath}:`, error);
    throw new Error(`Failed to read local file: ${error.message}`);
  }
}

export async function processFileWithRetry(taskId, file, fileIndex, retryCount = 0, taskOptions = {}) {
  const startTime = Date.now();
  
  await updateFileStatus(taskId, fileIndex, {
    status: 'processing',
    startedAt: new Date().toISOString(),
  });

  writeAuditLog({
    type: 'FILE_PROCESS_START',
    taskId,
    fileIndex,
    fileName: file.fileName,
    retryCount,
    timestamp: new Date().toISOString(),
  });

  try {
    console.log(`[Worker] Starting to process file ${file.fileName} for task ${taskId}`);
    
    let fileBuffer;
    let processOptions;
    
    if (file.ossKey) {
      console.log(`[Worker] Downloading file from OSS: ${file.ossKey}`);
      fileBuffer = await downloadFileFromOSS(file.ossKey, retryCount);
      processOptions = {
        buffer: fileBuffer,
        extractText: true,
        skipAI: taskOptions.skipAI ?? true,
        skipVideo: taskOptions.skipVideo ?? false,
      };
    } else if (file.localPath) {
      console.log(`[Worker] Reading local file: ${file.localPath}`);
      fileBuffer = await readLocalFile(file.localPath);
      processOptions = {
        buffer: fileBuffer,
        extractText: true,
        videoPath: file.localPath,
        skipAI: taskOptions.skipAI ?? true,
        skipVideo: taskOptions.skipVideo ?? false,
      };
    } else if (file.base64Data) {
      fileBuffer = Buffer.from(file.base64Data, 'base64');
      processOptions = {
        base64Data: file.base64Data,
        extractText: true,
        skipAI: taskOptions.skipAI ?? true,
        skipVideo: taskOptions.skipVideo ?? false,
      };
    } else {
      throw new Error('No file source provided (ossKey, localPath or base64Data)');
    }
    
    const processResult = await processWithTimeout(async () => {
      console.log(`[Worker] Calling processFile for ${file.fileName}`);
      const result = await processFile({
        fileName: file.fileName,
        mimeType: file.mimeType,
        buffer: fileBuffer,
        options: processOptions,
      });
      console.log(`[Worker] processFile completed for ${file.fileName}, result:`, result.parseStatus);

      if (result.parseStatus === 'failed') {
        throw new Error(result.errorMessage || '文件处理失败');
      }

      console.log(`[Worker] Running unified material pipeline for ${file.fileName}`);
      const pipelineResult = await processClaimMaterial({
        fileName: file.fileName,
        mimeType: file.mimeType,
        buffer: fileBuffer,
        parseResult: result,
        preferredMaterialId: file.classification?.materialId,
        preferredMaterialName: file.classification?.materialName,
      });
      const classification = pipelineResult.classification;
      console.log(`[Worker] unified material pipeline completed for ${file.fileName}:`, classification.materialName);

      return {
        ...result,
        structuredData: pipelineResult.extractedData,
        auditConclusion: pipelineResult.auditConclusion,
        confidence: pipelineResult.confidence,
        classification,
      };
    }, DEFAULT_FILE_PROCESS_TIMEOUT_MS);

    const duration = Date.now() - startTime;

    console.log(`[Worker] Updating file status to completed for ${file.fileName}`);
    const updatedTask = await updateFileStatus(taskId, fileIndex, {
      status: 'completed',
      result: {
        extractedText: processResult.extractedText,
        structuredData: processResult.structuredData,
        auditConclusion: processResult.auditConclusion,
        confidence: processResult.confidence,
        classification: processResult.classification,
        parseDuration: processResult.parseDuration,
      },
      classificationError: processResult.classification?.errorMessage || null,
      errorMessage: null,
      completedAt: new Date().toISOString(),
    });
    console.log(`[Worker] File status updated, task status: ${updatedTask?.status}`);

    writeAuditLog({
      type: 'FILE_PROCESS_SUCCESS',
      taskId,
      fileIndex,
      fileName: file.fileName,
      duration,
      classification: processResult.classification,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      duration,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || String(error);
    
    const isUrlExpired = errorMessage.includes('403') || errorMessage.includes('expired');
    const shouldRetry = (isRetryableError(error) || isUrlExpired) && retryCount < MAX_RETRIES;

    writeAuditLog({
      type: 'FILE_PROCESS_ERROR',
      taskId,
      fileIndex,
      fileName: file.fileName,
      error: errorMessage,
      retryCount,
      willRetry: shouldRetry,
      duration,
      timestamp: new Date().toISOString(),
    });

    if (shouldRetry) {
      const delay = getRetryDelay(retryCount);
      
      writeAuditLog({
        type: 'FILE_PROCESS_RETRY',
        taskId,
        fileIndex,
        fileName: file.fileName,
        retryCount: retryCount + 1,
        delay,
        timestamp: new Date().toISOString(),
      });

      await new Promise(resolve => setTimeout(resolve, delay));
      return processFileWithRetry(taskId, file, fileIndex, retryCount + 1, taskOptions);
    }

    await updateFileStatus(taskId, fileIndex, {
      status: 'failed',
      errorMessage,
      retryCount,
      completedAt: new Date().toISOString(),
    });

    return {
      success: false,
      error: errorMessage,
      duration,
    };
  }
}

export async function processBatchFiles(taskId, files, options = {}) {
  const { concurrency = BATCH_CONCURRENCY } = options;
  const results = [];
  
  console.log(`[Worker] Starting batch processing for ${files.length} files with concurrency ${concurrency}`);
  
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    console.log(`[Worker] Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(files.length / concurrency)}`);
    
    const batchPromises = batch.map((file, idx) => {
      const fileIndex = i + idx;
      return processFileWithRetry(taskId, file, fileIndex, 0, options);
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log(`[Worker] Batch processing completed: ${successCount} succeeded, ${failCount} failed`);
  
  return {
    total: files.length,
    succeeded: successCount,
    failed: failCount,
    results,
  };
}

export async function processStagedFile(taskId, file, fileIndex) {
  const startTime = Date.now();
  
  writeAuditLog({
    type: 'FILE_PROCESS_START',
    taskId,
    fileIndex,
    fileName: file.fileName,
    timestamp: new Date().toISOString(),
  });

  try {
    console.log(`[Worker] Starting staged processing for ${file.fileName}, taskId: ${taskId}, fileIndex: ${fileIndex}`);
    
    await updateFileStatus(taskId, fileIndex, {
      status: 'classifying',
      startedAt: new Date().toISOString(),
    });
    
    let fileBuffer;
    if (file.ossKey) {
      console.log(`[Worker] Downloading file from OSS: ${file.ossKey}`);
      try {
        fileBuffer = await downloadFileFromOSS(file.ossKey, 0);
        console.log(`[Worker] Downloaded ${fileBuffer.length} bytes from OSS`);
      } catch (downloadError) {
        console.error(`[Worker] OSS download failed:`, downloadError);
        throw new Error(`文件下载失败: ${downloadError.message}`);
      }
    } else if (file.localPath) {
      console.log(`[Worker] Reading local file: ${file.localPath}`);
      try {
        fileBuffer = await readLocalFile(file.localPath);
        console.log(`[Worker] Read ${fileBuffer.length} bytes from local file`);
      } catch (localError) {
        console.error(`[Worker] Local file read failed:`, localError);
        throw new Error(`本地文件读取失败: ${localError.message}`);
      }
    } else if (file.base64Data) {
      console.log(`[Worker] Using base64 data`);
      fileBuffer = Buffer.from(file.base64Data, 'base64');
    } else {
      throw new Error('No file source provided (no ossKey, localPath or base64Data)');
    }
    
    console.log(`[Worker] Processing file: ${file.fileName}`);
    let processResult;
    try {
      processResult = await processFile({
        fileName: file.fileName,
        mimeType: file.mimeType,
        buffer: fileBuffer,
        options: { extractText: true, videoPath: file.localPath },
      });
      console.log(`[Worker] File processed, parseStatus: ${processResult.parseStatus}`);
    } catch (processError) {
      console.error(`[Worker] File processing failed:`, processError);
      throw new Error(`文件处理失败: ${processError.message}`);
    }

    if (processResult.parseStatus === 'failed') {
      throw new Error(processResult.errorMessage || '文件解析失败');
    }

    console.log(`[Worker] Starting unified material pipeline for ${file.fileName}`);
    const classificationStart = Date.now();
    let pipelineResult;
    try {
      pipelineResult = await processClaimMaterial({
        fileName: file.fileName,
        mimeType: file.mimeType,
        buffer: fileBuffer,
        parseResult: processResult,
        preferredMaterialId: file.classification?.materialId,
        preferredMaterialName: file.classification?.materialName,
      });
      console.log(
        `[Worker] Unified material pipeline completed: ${pipelineResult.classification.materialName} (${pipelineResult.classification.confidence})`
      );
    } catch (classifyError) {
      console.error(`[Worker] Unified material pipeline failed:`, classifyError);
      pipelineResult = {
        extractedData: processResult.structuredData || {},
        auditConclusion: '',
        confidence: 0,
        classification: {
        materialId: 'unknown',
        materialName: '分类失败',
        confidence: 0,
        source: 'ai',
        matchStrategy: 'fallback',
        errorMessage: classifyError?.message || String(classifyError),
        },
      };
    }
    const classificationEnd = Date.now();
    const classification = pipelineResult.classification;
    
    logInteraction({
      taskId,
      fileIndex,
      taskType: 'classification',
      input: {
        prompt: '材料分类',
        fileName: file.fileName,
        fileType: file.mimeType,
        model: 'gemini-2.5-flash',
      },
      output: {
        response: JSON.stringify(classification),
        parsedResult: classification,
      },
      performance: {
        startTime: classificationStart,
        endTime: classificationEnd,
        duration: classificationEnd - classificationStart,
        retryCount: 0,
      },
    });

    await updateFileStatus(taskId, fileIndex, {
      status: 'extracting',
      stages: {
        archive: { status: 'completed', completedAt: new Date().toISOString() },
        classification: {
          status: classification.errorMessage ? 'failed' : 'completed',
          result: classification,
          errorMessage: classification.errorMessage || null,
          completedAt: new Date().toISOString(),
        },
        extraction: { status: 'in_progress' },
      },
    });

    const extractionStart = Date.now();
    const extraction = {
      extractedText: processResult.extractedText,
      structuredData: pipelineResult.extractedData,
      auditConclusion: pipelineResult.auditConclusion,
    };
    const extractionEnd = Date.now();
    
    logInteraction({
      taskId,
      fileIndex,
      taskType: 'extraction',
      input: {
        fileName: file.fileName,
        fileType: file.mimeType,
        model: 'gemini-2.5-flash',
      },
      output: {
        response: JSON.stringify(extraction),
        parsedResult: extraction,
      },
      performance: {
        startTime: extractionStart,
        endTime: extractionEnd,
        duration: extractionEnd - extractionStart,
        retryCount: 0,
      },
    });

    const duration = Date.now() - startTime;

    await updateFileStatus(taskId, fileIndex, {
      status: 'completed',
      result: {
        extractedText: processResult.extractedText,
        structuredData: pipelineResult.extractedData,
        auditConclusion: pipelineResult.auditConclusion,
        confidence: pipelineResult.confidence,
        classification,
        parseDuration: processResult.parseDuration,
      },
      classificationError: classification.errorMessage || null,
      stages: {
        archive: { status: 'completed', completedAt: new Date().toISOString() },
        classification: {
          status: classification.errorMessage ? 'failed' : 'completed',
          result: classification,
          errorMessage: classification.errorMessage || null,
          completedAt: new Date().toISOString(),
        },
        extraction: { status: 'completed', result: extraction, completedAt: new Date().toISOString() },
      },
      completedAt: new Date().toISOString(),
    });

    writeAuditLog({
      type: 'FILE_PROCESS_SUCCESS',
      taskId,
      fileIndex,
      fileName: file.fileName,
      duration,
      classification,
      timestamp: new Date().toISOString(),
    });

    return { success: true, duration };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || String(error);

    writeAuditLog({
      type: 'FILE_PROCESS_ERROR',
      taskId,
      fileIndex,
      fileName: file.fileName,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    await updateFileStatus(taskId, fileIndex, {
      status: 'failed',
      errorMessage,
      completedAt: new Date().toISOString(),
    });

    return { success: false, error: errorMessage, duration };
  }
}

export default {
  processFileWithRetry,
  processBatchFiles,
  downloadFileFromOSS,
  processStagedFile,
};
