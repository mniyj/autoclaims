/**
 * 监控指标收集
 * 收集任务处理耗时、成功率、队列长度等指标
 */

import { readData, writeData } from '../utils/fileStore.js';

const RESOURCE_NAME = 'task-metrics';
const MAX_DURATION_RECORDS = 100;
const MAX_SNAPSHOTS = 168;

function readMetrics() {
  const data = readData(RESOURCE_NAME);
  return {
    counters: data.counters || {
      task_created_total: 0,
      task_completed_total: 0,
      task_failed_total: 0,
      file_processed_total: 0,
      file_failed_total: 0,
      retry_total: 0,
    },
    durations: data.durations || [],
    snapshots: data.snapshots || [],
    lastUpdated: data.lastUpdated || null,
  };
}

function writeMetrics(metrics) {
  return writeData(RESOURCE_NAME, {
    ...metrics,
    lastUpdated: new Date().toISOString(),
  });
}

export function recordTaskCreated() {
  const metrics = readMetrics();
  metrics.counters.task_created_total++;
  writeMetrics(metrics);
}

export function recordTaskCompleted(taskId, duration) {
  const metrics = readMetrics();
  metrics.counters.task_completed_total++;
  metrics.durations.push({
    taskId,
    duration,
    timestamp: new Date().toISOString(),
  });
  if (metrics.durations.length > MAX_DURATION_RECORDS) {
    metrics.durations = metrics.durations.slice(-MAX_DURATION_RECORDS);
  }
  writeMetrics(metrics);
}

export function recordTaskFailed(taskId, error) {
  const metrics = readMetrics();
  metrics.counters.task_failed_total++;
  writeMetrics(metrics);
}

export function recordFileProcessed(taskId, fileName, duration, success) {
  const metrics = readMetrics();
  if (success) {
    metrics.counters.file_processed_total++;
  } else {
    metrics.counters.file_failed_total++;
  }
  writeMetrics(metrics);
}

export function recordRetry(taskId, fileName, retryCount) {
  const metrics = readMetrics();
  metrics.counters.retry_total++;
  writeMetrics(metrics);
}

export function recordQueueSnapshot(queueStats) {
  const metrics = readMetrics();
  metrics.snapshots.push({
    timestamp: new Date().toISOString(),
    queue_length: queueStats.pending || 0,
    processing_count: queueStats.processing || 0,
    completed_count: queueStats.completed || 0,
    failed_count: queueStats.failed || 0,
  });
  if (metrics.snapshots.length > MAX_SNAPSHOTS) {
    metrics.snapshots = metrics.snapshots.slice(-MAX_SNAPSHOTS);
  }
  writeMetrics(metrics);
}

export function getMetrics() {
  return readMetrics();
}

export function getStats(timeRange = '1h') {
  const metrics = readMetrics();
  const now = new Date();
  let startTime;
  
  switch (timeRange) {
    case '1h':
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    default:
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
  }
  
  const recentDurations = metrics.durations.filter(
    d => new Date(d.timestamp) >= startTime
  );
  
  const avgDuration = recentDurations.length > 0
    ? recentDurations.reduce((sum, d) => sum + d.duration, 0) / recentDurations.length
    : 0;
  
  const recentSnapshots = metrics.snapshots.filter(
    s => new Date(s.timestamp) >= startTime
  );
  
  const avgQueueLength = recentSnapshots.length > 0
    ? recentSnapshots.reduce((sum, s) => sum + s.queue_length, 0) / recentSnapshots.length
    : 0;
  
  const totalFiles = metrics.counters.file_processed_total + metrics.counters.file_failed_total;
  const successRate = totalFiles > 0
    ? (metrics.counters.file_processed_total / totalFiles) * 100
    : 0;
  
  return {
    counters: metrics.counters,
    avgDuration: Math.round(avgDuration),
    avgQueueLength: Math.round(avgQueueLength * 10) / 10,
    successRate: Math.round(successRate * 100) / 100,
    recentSnapshots: recentSnapshots.slice(-24),
  };
}

export default {
  recordTaskCreated,
  recordTaskCompleted,
  recordTaskFailed,
  recordFileProcessed,
  recordRetry,
  recordQueueSnapshot,
  getMetrics,
  getStats,
};
