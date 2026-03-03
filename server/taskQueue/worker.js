/**
 * 文件处理 Worker
 * 处理单个文件的 OCR、分类，支持重试机制
 */

import { processFile } from '../services/fileProcessor.js';
import { updateFileStatus } from './queue.js';
import { writeAuditLog } from '../middleware/index.js';
import { readData } from '../utils/fileStore.js';
import { GoogleGenAI } from '@google/genai';

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

async function classifyMaterial(result, fileName) {
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

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: { parts: [{ text: prompt }] },
      config: { temperature: 0.1 },
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
    console.error('[Worker] classifyMaterial error:', error);
    return {
      materialId: 'unknown',
      materialName: '未识别',
      confidence: 0,
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
      console.log(`[Worker] Calling processFile for ${file.fileName}`);
      const result = await processFile({
        fileName: file.fileName,
        mimeType: file.mimeType,
        options: {
          base64Data: file.base64Data,
          extractText: true,
        },
      });
      console.log(`[Worker] processFile completed for ${file.fileName}, result:`, result.parseStatus);

      console.log(`[Worker] Calling classifyMaterial for ${file.fileName}`);
      const classification = await classifyMaterial(result, file.fileName);
      console.log(`[Worker] classifyMaterial completed for ${file.fileName}:`, classification.materialName);

      return {
        ...result,
        classification,
      };
    }, 60000);

    const duration = Date.now() - startTime;

    console.log(`[Worker] Updating file status to completed for ${file.fileName}`);
    const updatedTask = await updateFileStatus(taskId, fileIndex, {
      status: 'completed',
      result: {
        extractedText: processResult.extractedText,
        structuredData: processResult.structuredData,
        classification: processResult.classification,
        parseDuration: processResult.parseDuration,
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
      return processFileWithRetry(taskId, file, fileIndex, retryCount + 1);
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

export default {
  processFileWithRetry,
};
