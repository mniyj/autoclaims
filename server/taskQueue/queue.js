/**
 * 任务队列管理器
 * 基于 JSON 文件的异步任务队列系统
 */

import { readData, writeData } from '../utils/fileStore.js';
import { randomUUID } from 'crypto';

const RESOURCE_NAME = 'processing-tasks';

const writeQueue = [];
let isWriting = false;

async function enqueueWrite(writeFn) {
  return new Promise((resolve, reject) => {
    writeQueue.push({ writeFn, resolve, reject });
    processWriteQueue();
  });
}

async function processWriteQueue() {
  if (isWriting || writeQueue.length === 0) return;
  
  isWriting = true;
  const { writeFn, resolve, reject } = writeQueue.shift();
  
  try {
    const result = await writeFn();
    resolve(result);
  } catch (error) {
    reject(error);
  } finally {
    isWriting = false;
    if (writeQueue.length > 0) {
      processWriteQueue();
    }
  }
}

async function safeWriteTasks(tasks) {
  return enqueueWrite(() => {
    const success = writeData(RESOURCE_NAME, { tasks });
    if (!success) {
      throw new Error('Failed to write tasks data');
    }
    return success;
  });
}

function readTasks() {
  const data = readData(RESOURCE_NAME);
  return data.tasks || [];
}

export async function createTask(claimCaseId, productCode, files, userId, options = {}) {
  const taskId = `task-${randomUUID()}`;
  const now = new Date().toISOString();
  
  const task = {
    id: taskId,
    type: 'import-offline-materials',
    claimCaseId,
    productCode,
    status: 'pending',
    files: files.map((file, index) => ({
      index,
      fileName: file.fileName,
      mimeType: file.mimeType,
      base64Data: file.base64Data,
      status: 'pending',
      retryCount: 0,
      result: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    })),
    progress: {
      total: files.length,
      completed: 0,
      failed: 0,
    },
    options: {
      skipOCR: options.skipOCR || false,
      skipAI: options.skipAI || false,
      ...options,
    },
    createdAt: now,
    startedAt: null,
    completedAt: null,
    createdBy: userId,
  };
  
  const tasks = readTasks();
  tasks.push(task);
  await safeWriteTasks(tasks);
  
  return task;
}

export function getTask(taskId) {
  const tasks = readTasks();
  return tasks.find(t => t.id === taskId) || null;
}

export async function updateTask(taskId, updates) {
  const tasks = readTasks();
  const index = tasks.findIndex(t => t.id === taskId);
  
  if (index === -1) return null;
  
  tasks[index] = {
    ...tasks[index],
    ...updates,
  };
  
  await safeWriteTasks(tasks);
  return tasks[index];
}

export async function updateFileStatus(taskId, fileIndex, updates) {
  console.log(`[Queue] Updating file ${fileIndex} status for task ${taskId}:`, updates.status);
  
  const tasks = readTasks();
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  
  if (taskIndex === -1) {
    console.log(`[Queue] Task ${taskId} not found`);
    return null;
  }
  if (!tasks[taskIndex].files[fileIndex]) {
    console.log(`[Queue] File ${fileIndex} not found in task ${taskId}`);
    return null;
  }
  
  const file = tasks[taskIndex].files[fileIndex];
  
  tasks[taskIndex].files[fileIndex] = {
    ...file,
    ...updates,
  };
  
  const completedFiles = tasks[taskIndex].files.filter(f => f.status === 'completed').length;
  const failedFiles = tasks[taskIndex].files.filter(f => f.status === 'failed').length;
  const processingFiles = tasks[taskIndex].files.filter(f => 
    f.status === 'processing' || f.status === 'classifying' || f.status === 'extracting'
  ).length;
  
  tasks[taskIndex].progress = {
    total: tasks[taskIndex].files.length,
    completed: completedFiles,
    failed: failedFiles,
    processing: processingFiles,
  };
  
  const allProcessed = tasks[taskIndex].files.every(
    f => f.status === 'completed' || f.status === 'failed'
  );

  if (allProcessed) {
    tasks[taskIndex].completedAt = new Date().toISOString();

    if (failedFiles === 0) {
      tasks[taskIndex].status = 'completed';
    } else if (completedFiles === 0) {
      tasks[taskIndex].status = 'failed';
    } else {
      tasks[taskIndex].status = 'partial_success';
    }

    console.log(`[Queue] Task ${taskId} completed with status: ${tasks[taskIndex].status}`);
  }
  
  await safeWriteTasks(tasks);
  console.log(`[Queue] File ${fileIndex} status updated for task ${taskId}`);
  return tasks[taskIndex];
}

export function getPendingTasks(options = {}) {
  const tasks = readTasks();
  const pendingTasks = tasks
    .filter(t => t.status === 'pending' || t.status === 'archived')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  if (options.limit) {
    return pendingTasks.slice(0, options.limit);
  }
  return pendingTasks;
}

export function getProcessingTasks() {
  const tasks = readTasks();
  return tasks.filter(t => t.status === 'processing');
}

export function getUserTasks(userId, options = {}) {
  const tasks = readTasks();
  let userTasks = tasks.filter(t => t.createdBy === userId);
  
  if (options.status) {
    userTasks = userTasks.filter(t => t.status === options.status);
  }
  
  userTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  if (options.limit) {
    const offset = options.offset || 0;
    userTasks = userTasks.slice(offset, offset + options.limit);
  }
  
  return userTasks;
}

export async function resetFileForRetry(taskId, fileIndex) {
  const tasks = readTasks();
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  
  if (taskIndex === -1) return null;
  if (!tasks[taskIndex].files[fileIndex]) return null;
  
  const file = tasks[taskIndex].files[fileIndex];
  
  if (file.status !== 'failed') {
    throw new Error('Only failed files can be retried');
  }
  
  tasks[taskIndex].files[fileIndex] = {
    ...file,
    status: 'pending',
    retryCount: 0,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
  };
  
  tasks[taskIndex].status = 'processing';
  tasks[taskIndex].completedAt = null;
  
  await safeWriteTasks(tasks);
  return tasks[taskIndex];
}

export async function deleteTask(taskId) {
  const tasks = readTasks();
  const filteredTasks = tasks.filter(t => t.id !== taskId);
  
  if (filteredTasks.length === tasks.length) {
    return false;
  }
  
  await safeWriteTasks(filteredTasks);
  return true;
}

export function getQueueStats() {
  const tasks = readTasks();
  
  return {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    processing: tasks.filter(t => t.status === 'processing').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    partialSuccess: tasks.filter(t => t.status === 'partial_success').length,
  };
}

export default {
  createTask,
  getTask,
  updateTask,
  updateFileStatus,
  getPendingTasks,
  getProcessingTasks,
  getUserTasks,
  resetFileForRetry,
  deleteTask,
  getQueueStats,
};
