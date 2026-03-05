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
} from './queue.js';
import { processFileWithRetry } from './worker.js';
import { writeAuditLog } from '../middleware/index.js';
import { createTaskCompleteMessage } from '../messageCenter/messageService.js';
import {
  recordTaskCreated,
  recordTaskCompleted,
  recordFileProcessed,
  recordRetry,
  recordQueueSnapshot,
} from '../monitoring/metrics.js';
import { runAllChecks } from '../monitoring/alerts.js';
import { readData, writeData } from '../utils/fileStore.js';

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
    const pendingFiles = task.files.filter(f => f.status === 'pending');
    const filesToProcess = pendingFiles.slice(0, maxSlots);

    console.log(`[Scheduler] Task ${task.id}: ${pendingFiles.length} pending files, processing ${filesToProcess.length} files`);

    if (filesToProcess.length === 0) return;

    if (task.status === 'pending') {
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
      
      if (allProcessed && updatedTask.status === 'processing') {
        await this.completeTask(updatedTask);
      }
    }
  }

  async processFile(task, file) {
    console.log(`[Scheduler] Processing file ${file.fileName} (index: ${file.index}) for task ${task.id}`);
    const fileKey = `${task.id}_${file.index}`;

    this.addProcessingFile(task.createdBy, fileKey);

    try {
      await processFileWithRetry(task.id, file, file.index, file.retryCount || 0);
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

    await this.saveMaterialsToClaimCase(task);

    this.emitTaskComplete(task);
  }

  async saveMaterialsToClaimCase(task) {
    try {
      const allMaterials = readData('claim-materials');
      const newMaterials = [];

      for (const file of task.files) {
        if (file.status !== 'completed') continue;


        const exists = allMaterials.some(
          (m) => m.claimCaseId === task.claimCaseId &&
                 m.fileName === file.fileName &&
                 m.source === 'offline_import'
        );

        if (!exists) {
          const classification = file.result?.classification || {};
          newMaterials.push({
            id: `mat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            claimCaseId: task.claimCaseId,
            fileName: file.fileName,
            fileType: file.mimeType || 'unknown',
            category: classification.materialName || '未分类',
            materialName: classification.materialName || '未分类',
            materialId: classification.materialId || 'unknown',
            source: 'offline_import',
            status: 'completed',
            uploadedAt: new Date().toISOString(),
            ocrText: file.result?.extractedText || '',
            structuredData: file.result?.structuredData || {},
            taskId: task.id,
          });
        }
      }

      if (newMaterials.length > 0) {
        allMaterials.push(...newMaterials);
        writeData('claim-materials', allMaterials);
        console.log(`[Scheduler] Saved ${newMaterials.length} materials to claim case ${task.claimCaseId}`);
      }
    } catch (error) {
      console.error('[Scheduler] Failed to save materials:', error);
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
