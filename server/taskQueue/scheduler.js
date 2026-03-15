/**
 * 任务调度器
 * 管理任务调度、并发控制、Worker 生命周期
 */

import {
  getPendingTasks,
  getProcessingTasks,
  getTask,
  updateTask,
  getQueueStats,
  updateFileStatus,
} from './queue.js';
import { processFileWithRetry, processStagedFile } from './worker.js';
import { writeAuditLog } from '../middleware/index.js';
import { createTaskCompleteMessage } from '../messageCenter/messageService.js';
import { createTaskRecoveryNeededMessage } from '../messageCenter/messageService.js';
import {
  recordTaskCreated,
  recordTaskCompleted,
  recordFileProcessed,
  recordRetry,
  recordQueueSnapshot,
} from '../monitoring/metrics.js';
import { runAllChecks } from '../monitoring/alerts.js';
import { readData, writeData } from '../utils/fileStore.js';
import { extractDocumentSummaries } from '../services/summaryExtractors/index.js';
import { aggregateCase } from '../services/caseAggregator.js';
import { analyzeMultiFiles } from '../services/multiFileAnalyzer.js';
import { syncClaimReviewArtifacts } from '../services/claimReviewService.js';

const MAX_CONCURRENT_PER_USER = 10;
const POLL_INTERVAL = 1000;

class TaskScheduler {
  constructor() {
    this.isRunning = false;
    this.pollTimer = null;
    this.metricsTimer = null;
    this.alertTimer = null;
    this.processingFiles = new Map();
    this.isPolling = false;
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.schedulePoll();

    this.metricsTimer = setInterval(() => {
      const stats = getQueueStats();
      recordQueueSnapshot(stats);
    }, 60000);

    this.alertTimer = setInterval(() => {
      runAllChecks();
    }, 5 * 60000);

    writeAuditLog({
      type: 'SCHEDULER_START',
      timestamp: new Date().toISOString(),
    });

    console.log('[Scheduler] Task scheduler started');
  }

  stop() {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
    if (this.alertTimer) {
      clearInterval(this.alertTimer);
      this.alertTimer = null;
    }

    writeAuditLog({
      type: 'SCHEDULER_STOP',
      timestamp: new Date().toISOString(),
    });

    console.log('[Scheduler] Task scheduler stopped');
  }

  schedulePoll() {
    if (!this.isRunning) return;
    
    this.pollTimer = setTimeout(() => {
      this.poll();
    }, POLL_INTERVAL);
  }

  async poll() {
    if (this.isPolling || !this.isRunning) {
      this.schedulePoll();
      return;
    }

    this.isPolling = true;
    console.log('[Scheduler] Poll started');

    try {
      await this.processPendingTasks();
    } catch (error) {
      console.error('[Scheduler] Error in poll:', error);
    } finally {
      this.isPolling = false;
      this.schedulePoll();
    }
  }

  async processPendingTasks() {
    const pendingTasks = getPendingTasks();
    console.log(`[Scheduler] Found ${pendingTasks.length} pending tasks`);
    
    for (const task of pendingTasks) {
      if (!this.isRunning) break;
      
      const userProcessingCount = this.getUserProcessingCount(task.createdBy);
      const availableSlots = MAX_CONCURRENT_PER_USER - userProcessingCount;
      
      console.log(`[Scheduler] Task ${task.id}: user ${task.createdBy}, ${userProcessingCount} processing, ${availableSlots} slots available`);
      
      if (availableSlots <= 0) {
        console.log(`[Scheduler] No slots available for user ${task.createdBy}`);
        continue;
      }
      
      await this.processTask(task, availableSlots);
    }
  }

  getUserProcessingCount(userId) {
    const userFiles = this.processingFiles.get(userId);
    return userFiles ? userFiles.size : 0;
  }

  async processTask(task, maxSlots) {
    // 支持传统 pending 状态和新 staged 流程的 archived 状态
    const pendingFiles = task.files.filter(f => f.status === 'pending' || f.status === 'archived');
    const filesToProcess = pendingFiles.slice(0, maxSlots);

    console.log(`[Scheduler] Task ${task.id}: ${pendingFiles.length} pending/archived files, processing ${filesToProcess.length} files`);

    if (filesToProcess.length === 0) return;

    if (task.status === 'pending' || task.status === 'archived') {
      console.log(`[Scheduler] Starting task ${task.id}`);
      await updateTask(task.id, {
        status: 'processing',
        startedAt: new Date().toISOString(),
      });

      writeAuditLog({
        type: 'TASK_START',
        taskId: task.id,
        claimCaseId: task.claimCaseId,
        totalFiles: task.files.length,
        timestamp: new Date().toISOString(),
      });
    }

    const processPromises = filesToProcess.map(async (file) => {
      try {
        await this.processFile(task, file);
      } catch (error) {
        console.error(`[Scheduler] Error in processFile for ${file.fileName}:`, error);
      }
    });

    await Promise.all(processPromises);

    const updatedTask = getTask(task.id);
    if (updatedTask) {
      const allProcessed = updatedTask.files.every(
        f => f.status === 'completed' || f.status === 'failed'
      );

      // Files may finalize task status in queue layer before scheduler post-processing.
      // Always run completion hooks once when all files are finished.
      if (allProcessed && !updatedTask.postProcessedAt) {
        await this.completeTask(updatedTask);
      }
    }
  }

  async processFile(task, file) {
    console.log(`[Scheduler] Processing file ${file.fileName} (index: ${file.index}) for task ${task.id}, status: ${file.status}`);
    const fileKey = `${task.id}_${file.index}`;

    this.addProcessingFile(task.createdBy, fileKey);

    try {
      // 根据文件状态选择合适的处理方式
      if (file.status === 'archived') {
        // 使用分阶段处理流程：archived -> classifying -> extracting -> completed
        await processStagedFile(task.id, file, file.index);
      } else {
        // 使用传统处理流程
        await processFileWithRetry(task.id, file, file.index, file.retryCount || 0, task.options || {});
      }
      console.log(`[Scheduler] File ${file.fileName} processed successfully`);
    } catch (error) {
      console.error(`[Scheduler] Error processing file ${file.fileName}:`, error);
      await updateFileStatus(task.id, file.index, {
        status: 'failed',
        errorMessage: error.message || '处理失败',
        completedAt: new Date().toISOString(),
      });
    } finally {
      this.removeProcessingFile(task.createdBy, fileKey);
    }
  }

  addProcessingFile(userId, fileKey) {
    if (!this.processingFiles.has(userId)) {
      this.processingFiles.set(userId, new Set());
    }
    this.processingFiles.get(userId).add(fileKey);
  }

  removeProcessingFile(userId, fileKey) {
    const userFiles = this.processingFiles.get(userId);
    if (userFiles) {
      userFiles.delete(fileKey);
      if (userFiles.size === 0) {
        this.processingFiles.delete(userId);
      }
    }
  }

  async completeTask(task) {
    const completedFiles = task.files.filter(f => f.status === 'completed').length;
    const failedFiles = task.files.filter(f => f.status === 'failed').length;

    let finalStatus = 'completed';
    if (failedFiles > 0 && completedFiles === 0) {
      finalStatus = 'failed';
    } else if (failedFiles > 0) {
      finalStatus = 'partial_success';
    }

    await updateTask(task.id, {
      status: finalStatus,
      completedAt: new Date().toISOString(),
      postProcessedAt: new Date().toISOString(),
    });

    const duration = new Date().getTime() - new Date(task.createdAt).getTime();
    recordTaskCompleted(task.id, duration);

    task.files.forEach(file => {
      const fileDuration = file.completedAt && file.startedAt
        ? new Date(file.completedAt).getTime() - new Date(file.startedAt).getTime()
        : 0;
      recordFileProcessed(task.id, file.fileName, fileDuration, file.status === 'completed');
    });

    createTaskCompleteMessage(task.createdBy, {
      ...task,
      status: finalStatus,
      files: task.files,
    });

    if (finalStatus === 'partial_success' || finalStatus === 'failed') {
      createTaskRecoveryNeededMessage(task.createdBy, {
        ...task,
        status: finalStatus,
        files: task.files,
      });
    }

    writeAuditLog({
      type: 'TASK_COMPLETE',
      taskId: task.id,
      claimCaseId: task.claimCaseId,
      status: finalStatus,
      totalFiles: task.files.length,
      completedFiles,
      failedFiles,
      timestamp: new Date().toISOString(),
    });

    const analysis = await this.buildTaskAnalysis(task);

    await this.saveImportRecordToClaimDocuments(task, finalStatus, analysis);
    await this.saveMaterialsToClaimCase(task, analysis);
    if (analysis.aggregation) {
      try {
        await syncClaimReviewArtifacts({
          claimCaseId: task.claimCaseId,
          stageOptions: {
            parseCompleted: true,
          },
        });
      } catch (reviewSyncError) {
        console.error('[Scheduler] Failed to sync review artifacts:', reviewSyncError);
      }
    }

    this.emitTaskComplete(task);
  }

  async buildTaskAnalysis(task) {
      const documents = task.files.map((file) => ({
      documentId: `${task.id}-${file.index}`,
      fileName: file.fileName,
      fileType: file.mimeType,
      mimeType: file.mimeType,
      ossKey: file.ossKey,
      classification: file.result?.classification || {
        materialId: 'unknown',
        materialName: '未识别',
        confidence: 0,
      },
      status: file.status,
      extractedText: file.result?.extractedText || '',
      structuredData: file.result?.structuredData || {},
      auditConclusion: file.result?.auditConclusion || '',
      confidence: file.result?.confidence ?? file.result?.classification?.confidence ?? 0,
      errorMessage: file.errorMessage || file.result?.classification?.errorMessage || null,
    }));

    const completedDocs = documents.filter((doc) => doc.status === 'completed');
    const summaries = completedDocs.length > 0
      ? await extractDocumentSummaries(completedDocs, { skipImages: true })
      : [];

    completedDocs.forEach((doc, index) => {
      if (summaries[index]) {
        doc.documentSummary = summaries[index];
      }
    });

    const analysisResult = completedDocs.length > 0
      ? await analyzeMultiFiles(documents, {
          claimCaseId: task.claimCaseId,
          productCode: task.productCode,
        })
      : null;

    const aggregation = completedDocs.length > 0
      ? aggregateCase({
          summaries,
          claimCaseId: task.claimCaseId,
          validationFacts: analysisResult?.validationFacts || {},
          validationResults: analysisResult?.materialValidationResults || [],
          documents,
        })
      : null;

    return {
      documents,
      completedDocs,
      summaries,
      aggregation,
      analysisResult,
    };
  }

  async saveMaterialsToClaimCase(task, analysis = {}) {
    try {
      const allMaterials = readData('claim-materials');
      const newMaterials = [];
      let updatedCount = 0;
      const documentsById = new Map((analysis.documents || []).map((doc) => [doc.documentId, doc]));

      for (const file of task.files) {
        if (file.status !== 'completed') continue;

        const documentId = `${task.id}-${file.index}`;
        const document = documentsById.get(documentId) || {};
        const classification = file.result?.classification || {};
        const existingIndex = allMaterials.findIndex(
          (m) => m.claimCaseId === task.claimCaseId &&
                 m.fileName === file.fileName &&
                 m.source === 'offline_import'
        );

        if (existingIndex !== -1) {
          const existing = allMaterials[existingIndex];
          const next = { ...existing };

          // Backfill missing preview fields for old records.
          if (!next.ossKey && file.ossKey) next.ossKey = file.ossKey;
          if ((!next.url || next.url === '#') && file.result?.ossUrl) next.url = file.result.ossUrl;
          if ((!next.fileType || next.fileType === 'unknown') && file.mimeType) next.fileType = file.mimeType;

          // Keep latest parse/classification result for same file import.
          next.category = classification.materialName || next.category || '未分类';
          next.materialName = classification.materialName || next.materialName || '未分类';
          next.materialId = classification.materialId || next.materialId || 'unknown';
          next.classificationError = classification.errorMessage || null;
          next.status = 'completed';
          next.ocrText = file.result?.extractedText || next.ocrText || '';
          next.structuredData = file.result?.structuredData || next.structuredData || {};
          next.auditConclusion = file.result?.auditConclusion || next.auditConclusion;
          next.confidence = file.result?.confidence ?? classification.confidence ?? next.confidence;
          next.documentSummary = document.documentSummary || next.documentSummary;
          next.sourceDetail = {
            importId: analysis.importId,
            importedAt: analysis.importedAt,
            taskId: task.id,
          };
          next.taskId = task.id;
          next.uploadedAt = analysis.importedAt || new Date().toISOString();

          allMaterials[existingIndex] = next;
          updatedCount += 1;
        } else {
          newMaterials.push({
            id: document.documentId || `mat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            claimCaseId: task.claimCaseId,
            fileName: file.fileName,
            fileType: file.mimeType || 'unknown',
            // Keep url field for backward compatibility; preview should prefer ossKey.
            url: file.result?.ossUrl || '#',
            ossKey: file.ossKey,
            category: classification.materialName || '未分类',
            materialName: classification.materialName || '未分类',
            materialId: classification.materialId || 'unknown',
            classificationError: classification.errorMessage || null,
            source: 'offline_import',
            status: 'completed',
            uploadedAt: analysis.importedAt || new Date().toISOString(),
            ocrText: file.result?.extractedText || '',
            structuredData: file.result?.structuredData || {},
            auditConclusion: file.result?.auditConclusion || '',
            confidence: file.result?.confidence ?? classification.confidence ?? 0,
            documentSummary: document.documentSummary || null,
            sourceDetail: {
              importId: analysis.importId,
              importedAt: analysis.importedAt,
              taskId: task.id,
            },
            taskId: task.id,
          });
        }
      }

      if (newMaterials.length > 0 || updatedCount > 0) {
        allMaterials.push(...newMaterials);
        writeData('claim-materials', allMaterials);
        console.log(
          `[Scheduler] Saved ${newMaterials.length} and updated ${updatedCount} materials for claim case ${task.claimCaseId}`
        );
      }
    } catch (error) {
      console.error('[Scheduler] Failed to save materials:', error);
    }
  }

  async saveImportRecordToClaimDocuments(task, finalStatus, analysis = {}) {
    try {
      const allClaimDocs = readData('claim-documents');
      const documents = analysis.documents || [];
      const completed = documents.filter((d) => d.status === 'completed').length;
      const total = documents.length || 1;
      const existingIndex = allClaimDocs.findIndex((r) => r.taskId === task.id);
      const importedAt = existingIndex !== -1
        ? allClaimDocs[existingIndex].importedAt || new Date().toISOString()
        : new Date().toISOString();
      const importId = existingIndex !== -1
        ? allClaimDocs[existingIndex].id
        : `import-${Date.now()}`;

      const nextRecord = {
        id: importId,
        taskId: task.id,
        claimCaseId: task.claimCaseId,
        productCode: task.productCode,
        importedAt,
        documents,
        aggregation: analysis.aggregation || null,
        completeness: {
          isComplete: finalStatus === 'completed',
          completenessScore: completed / total,
          requiredMaterials: [],
          providedMaterials: [],
          missingMaterials: [],
          warnings: finalStatus === 'failed' ? ['离线导入处理失败，请检查文件后重试'] : [],
        },
      };

      if (existingIndex !== -1) {
        allClaimDocs[existingIndex] = {
          ...allClaimDocs[existingIndex],
          ...nextRecord,
        };
      } else {
        allClaimDocs.push(nextRecord);
      }

      writeData('claim-documents', allClaimDocs);
      analysis.importId = importId;
      analysis.importedAt = importedAt;
    } catch (error) {
      console.error('[Scheduler] Failed to save import record:', error);
    }
  }

  emitTaskComplete(task) {
    if (global.taskEventEmitter) {
      global.taskEventEmitter.emit('taskComplete', task);
    }
  }

  getStats() {
    const processingTasks = getProcessingTasks();
    const totalProcessingFiles = Array.from(this.processingFiles.values())
      .reduce((sum, set) => sum + set.size, 0);
    
    return {
      isRunning: this.isRunning,
      processingTasks: processingTasks.length,
      processingFiles: totalProcessingFiles,
      userConcurrency: Object.fromEntries(
        Array.from(this.processingFiles.entries()).map(
          ([userId, files]) => [userId, files.size]
        )
      ),
    };
  }
}

const scheduler = new TaskScheduler();

export function startScheduler() {
  scheduler.start();
}

export function stopScheduler() {
  scheduler.stop();
}

export function getSchedulerStats() {
  return scheduler.getStats();
}

export default scheduler;
