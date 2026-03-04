/**
 * 文件处理 Worker (新版)
 * 使用 UnifiedMaterialService 进行完整的分类和提取
 */

import { updateFileStatus } from './queue.js';
import { writeAuditLog } from '../middleware/index.js';
import { readData } from '../utils/fileStore.js';
import { unifiedMaterialService } from '../services/material/index.js';

const RETRYABLE_ERRORS = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'API_RATE_LIMIT',
  'TIMEOUT',
  'socket hang up',
  'network error',
];

const MAX_RETRIES = 3;

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

async function processWithTimeout(processFn, timeoutMs = 120000) {
  return Promise.race([
    processFn(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
    }),
  ]);
}

/**
 * 将 base64 数据转换为 File 对象
 */
async function base64ToFile(base64Data, fileName, mimeType) {
  // 移除 data URL 前缀（如果存在）
  const base64 = base64Data.includes(',') 
    ? base64Data.split(',')[1] 
    : base64Data;
  
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new File([byteArray], fileName, { type: mimeType });
}

export async function processFileWithRetry(taskId, file, fileIndex, retryCount = 0) {
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
    
    const processResult = await processWithTimeout(async () => {
      // Step 1: 分类
      console.log(`[Worker] Step 1: Classifying ${file.fileName}`);
      const materials = readData('claims-materials');
      const fileObj = await base64ToFile(file.base64Data, file.fileName, file.mimeType);
      
      const classification = await unifiedMaterialService.classify(
        fileObj,
        materials
      );
      
      console.log(`[Worker] Classified as: ${classification.materialName} (${classification.confidence})`);
      
      // 如果置信度低，记录日志但不停止
      if (!classification.isConfident) {
        console.warn(`[Worker] Low confidence for ${file.fileName}, will use fallback`);
      }

      // Step 2: 获取材料配置并提取
      console.log(`[Worker] Step 2: Extracting fields for ${file.fileName}`);
      const materialConfig = materials.find(m => m.id === classification.materialId);
      
      let extractionResult = null;
      let auditConclusion = null;
      
      if (materialConfig) {
        const processResult = await unifiedMaterialService.process(
          fileObj,
          materialConfig,
          {
            claimCaseId: taskId,
            province: file.province,
          }
        );
        
        if (processResult.success) {
          extractionResult = processResult.extraction;
          auditConclusion = processResult.auditConclusion;
        }
      }

      return {
        classification,
        extraction: extractionResult,
        auditConclusion,
      };
    }, 120000);

    const duration = Date.now() - startTime;

    console.log(`[Worker] Updating file status to completed for ${file.fileName}`);
    const updatedTask = await updateFileStatus(taskId, fileIndex, {
      status: 'completed',
      result: {
        classification: processResult.classification,
        extractedData: processResult.extraction?.extractedData || {},
        rawOcrText: processResult.extraction?.rawOcrText || '',
        auditConclusion: processResult.auditConclusion,
        confidence: processResult.classification.confidence,
        processingDuration: duration,
      },
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
    const shouldRetry = isRetryableError(error) && retryCount < MAX_RETRIES;

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
      console.log(`[Worker] Retrying ${file.fileName} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, getRetryDelay(retryCount)));
      return processFileWithRetry(taskId, file, fileIndex, retryCount + 1);
    }

    console.log(`[Worker] Updating file status to failed for ${file.fileName}`);
    await updateFileStatus(taskId, fileIndex, {
      status: 'failed',
      error: errorMessage,
      completedAt: new Date().toISOString(),
    });

    return {
      success: false,
      error: errorMessage,
      duration,
    };
  }
}
