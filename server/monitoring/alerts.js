/**
 * 告警服务
 * 失败率告警、队列积压告警、慢任务告警
 */

import { getStats, getMetrics } from './metrics.js';
import { getQueueStats } from '../taskQueue/queue.js';
import { writeAuditLog } from '../middleware/index.js';

const ALERT_RULES = {
  FAILURE_RATE: {
    threshold: 0.1,
    cooldown: 60 * 60 * 1000,
    level: 'warning',
  },
  QUEUE_BACKLOG: {
    threshold: 50,
    cooldown: 30 * 60 * 1000,
    level: 'warning',
  },
  SLOW_TASK: {
    threshold: 60000,
    cooldown: 15 * 60 * 1000,
    level: 'info',
  },
};

const alertCooldowns = new Map();

function shouldAlert(ruleKey) {
  const lastAlert = alertCooldowns.get(ruleKey);
  if (!lastAlert) return true;
  return Date.now() - lastAlert > ALERT_RULES[ruleKey].cooldown;
}

function recordAlert(ruleKey) {
  alertCooldowns.set(ruleKey, Date.now());
}

function sendAlert(alert) {
  writeAuditLog({
    type: 'ALERT',
    level: alert.level,
    rule: alert.rule,
    message: alert.message,
    data: alert.data,
    timestamp: new Date().toISOString(),
  });
  
  console.log(`[ALERT ${alert.level.toUpperCase()}] ${alert.rule}: ${alert.message}`);
}

export async function sendDingTalkAlert(alert) {
  console.log('[Alert] DingTalk push (not implemented):', alert.message);
  return { success: false, error: 'Not implemented' };
}

export async function sendEmailAlert(alert) {
  console.log('[Alert] Email push (not implemented):', alert.message);
  return { success: false, error: 'Not implemented' };
}

export function checkFailureRate() {
  const stats = getStats('1h');
  const failureRate = 100 - stats.successRate;
  
  if (failureRate > ALERT_RULES.FAILURE_RATE.threshold * 100) {
    const ruleKey = 'FAILURE_RATE';
    if (shouldAlert(ruleKey)) {
      const alert = {
        rule: ruleKey,
        level: ALERT_RULES[ruleKey].level,
        message: `最近1小时失败率达到 ${failureRate.toFixed(1)}%，超过阈值 ${(ALERT_RULES.FAILURE_RATE.threshold * 100).toFixed(0)}%`,
        data: { failureRate, threshold: ALERT_RULES.FAILURE_RATE.threshold },
      };
      sendAlert(alert);
      recordAlert(ruleKey);
    }
  }
}

export function checkQueueBacklog() {
  const stats = getQueueStats();
  
  if (stats.pending > ALERT_RULES.QUEUE_BACKLOG.threshold) {
    const ruleKey = 'QUEUE_BACKLOG';
    if (shouldAlert(ruleKey)) {
      const alert = {
        rule: ruleKey,
        level: ALERT_RULES[ruleKey].level,
        message: `任务队列积压 ${stats.pending} 个，超过阈值 ${ALERT_RULES.QUEUE_BACKLOG.threshold}`,
        data: { pending: stats.pending, threshold: ALERT_RULES.QUEUE_BACKLOG.threshold },
      };
      sendAlert(alert);
      recordAlert(ruleKey);
    }
  }
}

export function checkSlowTasks() {
  const stats = getStats('1h');
  
  if (stats.avgDuration > ALERT_RULES.SLOW_TASK.threshold) {
    const ruleKey = 'SLOW_TASK';
    if (shouldAlert(ruleKey)) {
      const alert = {
        rule: ruleKey,
        level: ALERT_RULES.SLOW_TASK.level,
        message: `平均处理耗时 ${stats.avgDuration}ms，超过阈值 ${ALERT_RULES.SLOW_TASK.threshold}ms`,
        data: { avgDuration: stats.avgDuration, threshold: ALERT_RULES.SLOW_TASK.threshold },
      };
      sendAlert(alert);
      recordAlert(ruleKey);
    }
  }
}

export function runAllChecks() {
  checkFailureRate();
  checkQueueBacklog();
  checkSlowTasks();
}

export function startAlertChecker(intervalMinutes = 5) {
  runAllChecks();
  
  const intervalId = setInterval(() => {
    runAllChecks();
  }, intervalMinutes * 60 * 1000);
  
  return () => clearInterval(intervalId);
}

export default {
  checkFailureRate,
  checkQueueBacklog,
  checkSlowTasks,
  runAllChecks,
  startAlertChecker,
};
