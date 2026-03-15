import { getTask } from '../taskQueue/queue.js';
import { processFileWithRetry } from '../taskQueue/worker.js';
import scheduler from '../taskQueue/scheduler.js';
import { loadEnvConfig } from '../utils/loadEnvConfig.js';

const taskId = process.argv[2];

if (!taskId) {
  console.error('Usage: node server/scripts/recoverOfflineTask.js <taskId>');
  process.exit(1);
}

loadEnvConfig({
  forceKeys: [
    'ALIYUN_OSS_REGION',
    'ALIYUN_OSS_ACCESS_KEY_ID',
    'ALIYUN_OSS_ACCESS_KEY_SECRET',
    'ALIYUN_OSS_BUCKET',
  ],
});

const initialTask = getTask(taskId);

if (!initialTask) {
  console.error(`Task not found: ${taskId}`);
  process.exit(1);
}

const recoverableFiles = initialTask.files.filter(
  (file) => file.status !== 'completed'
);

const results = [];
for (const file of recoverableFiles) {
  const result = await processFileWithRetry(
    initialTask.id,
    file,
    file.index,
    file.retryCount || 0,
    initialTask.options || {}
  );

  results.push({
    index: file.index,
    fileName: file.fileName,
    success: result.success,
    error: result.error || null,
  });
}

const refreshedTask = getTask(taskId);

if (!refreshedTask) {
  console.error(`Task disappeared during recovery: ${taskId}`);
  process.exit(1);
}

const allProcessed = refreshedTask.files.every(
  (file) => file.status === 'completed' || file.status === 'failed'
);

if (allProcessed) {
  await scheduler.completeTask(refreshedTask);
}

const finalTask = getTask(taskId);

console.log(JSON.stringify({
  taskId,
  claimCaseId: finalTask?.claimCaseId || refreshedTask.claimCaseId,
  recoveredFiles: results,
  finalStatus: finalTask?.status || refreshedTask.status,
  completed: finalTask?.files.filter((file) => file.status === 'completed').length || 0,
  failed: finalTask?.files.filter((file) => file.status === 'failed').length || 0,
  postProcessedAt: finalTask?.postProcessedAt || null,
}, null, 2));
