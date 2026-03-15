import { getTask } from '../taskQueue/queue.js';
import scheduler from '../taskQueue/scheduler.js';
import { loadEnvConfig } from '../utils/loadEnvConfig.js';

const taskId = process.argv[2];

if (!taskId) {
  console.error('Usage: node server/scripts/reprocessTaskPostProcessing.js <taskId>');
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

const task = getTask(taskId);

if (!task) {
  console.error(`Task not found: ${taskId}`);
  process.exit(1);
}

const allProcessed = task.files.every(
  (file) => file.status === 'completed' || file.status === 'failed'
);

if (!allProcessed) {
  console.error(`Task ${taskId} is not fully processed yet`);
  process.exit(1);
}

await scheduler.completeTask(task);

console.log(JSON.stringify({
  taskId,
  status: 'reprocessed',
  claimCaseId: task.claimCaseId,
}, null, 2));
