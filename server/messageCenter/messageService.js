/**
 * 消息中心服务
 * 管理用户消息通知，支持站内信、预留钉钉/邮件推送接口
 */

import { readData, writeData } from '../utils/fileStore.js';
import { randomUUID } from 'crypto';

const RESOURCE_NAME = 'messages';

const MESSAGE_TYPES = {
  TASK_COMPLETE: 'task_complete',
  TASK_FAILED: 'task_failed',
  TASK_PARTIAL: 'task_partial',
  TASK_RECOVERY_NEEDED: 'task_recovery_needed',
  TASK_RECOVERY_ESCALATED: 'task_recovery_escalated',
  TASK_RECOVERED: 'task_recovered',
  AI_ALERT: 'ai_alert',
  SYSTEM_NOTICE: 'system_notice',
};

const MAX_MESSAGES_PER_USER = 1000;

function readMessages() {
  const data = readData(RESOURCE_NAME);
  return data.messages || [];
}

function writeMessages(messages) {
  return writeData(RESOURCE_NAME, { messages });
}

function findLatestUnreadByTask(userId, types, taskId) {
  const messages = readMessages();
  const typeList = Array.isArray(types) ? types : [types];
  return messages.find(
    (message) =>
      message.userId === userId &&
      typeList.includes(message.type) &&
      message.data?.taskId === taskId &&
      message.isRead === false,
  ) || null;
}

export function classifyTaskRecoveryIssue(task) {
  const failedFiles = (task.files || []).filter((file) => file.status === 'failed');
  const combinedError = failedFiles
    .map((file) => String(file.errorMessage || ''))
    .join('\n')
    .toLowerCase();

  if (combinedError.includes('api key must be set') || combinedError.includes('api key not found')) {
    return {
      category: 'env_config',
      hint: '疑似 AI API Key 未注入到当前进程，建议优先检查 .env.local 和任务运行环境。',
    };
  }

  if (combinedError.includes('oss credentials not configured')) {
    return {
      category: 'oss_config',
      hint: '疑似 OSS 凭证缺失，建议检查 OSS 环境变量和服务端运行环境。',
    };
  }

  if (
    combinedError.includes('timeout') ||
    combinedError.includes('fetch failed') ||
    combinedError.includes('socket hang up') ||
    combinedError.includes('econnreset') ||
    combinedError.includes('etimedout')
  ) {
    return {
      category: 'network_or_provider',
      hint: '更像网络波动或 OCR/AI 提供商超时，可直接重试恢复；若重复失败，再考虑切换备用 OCR。',
    };
  }

  if (combinedError.includes('failed to read local file') || combinedError.includes('no such file')) {
    return {
      category: 'local_file_missing',
      hint: '疑似本地文件路径失效或原始文件缺失，建议先确认源文件仍存在。',
    };
  }

  if (combinedError.includes('unsupported file') || combinedError.includes('文件解析失败')) {
    return {
      category: 'parse_failure',
      hint: '更像文件解析失败，建议先恢复一次；若仍失败，再人工查看原始文件格式或内容质量。',
    };
  }

  return {
    category: 'unknown',
    hint: '失败原因尚不明确，建议先执行恢复任务，再根据最新错误继续定位。',
  };
}

export function getTaskRecoveryEscalation(task) {
  const maxRetry = Math.max(
    0,
    ...((task.files || []).map((file) => Number(file.retryCount || 0))),
  );

  if (maxRetry >= 2) {
    return {
      level: 'high',
      messageType: MESSAGE_TYPES.TASK_RECOVERY_ESCALATED,
      title: '导入任务持续恢复失败',
    };
  }

  return {
    level: 'normal',
    messageType: MESSAGE_TYPES.TASK_RECOVERY_NEEDED,
    title: null,
  };
}

export function createMessage(userId, type, title, content, data = {}) {
  const messages = readMessages();
  
  const message = {
    id: `msg-${randomUUID()}`,
    userId,
    type,
    title,
    content,
    data,
    isRead: false,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  
  messages.push(message);
  
  const userMessages = messages.filter(m => m.userId === userId);
  if (userMessages.length > MAX_MESSAGES_PER_USER) {
    const toDelete = userMessages
      .filter(m => m.isRead)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(0, userMessages.length - MAX_MESSAGES_PER_USER);
    
    const deleteIds = new Set(toDelete.map(m => m.id));
    const filteredMessages = messages.filter(m => !deleteIds.has(m.id));
    writeMessages(filteredMessages);
  } else {
    writeMessages(messages);
  }
  
  return message;
}

export function createTaskCompleteMessage(userId, task) {
  const completedFiles = task.files.filter(f => f.status === 'completed').length;
  const failedFiles = task.files.filter(f => f.status === 'failed').length;
  
  let title = '材料导入完成';
  let content = `您的离线材料导入任务已完成，成功处理 ${completedFiles}/${task.files.length} 个文件`;
  let type = MESSAGE_TYPES.TASK_COMPLETE;
  
  if (failedFiles > 0 && completedFiles === 0) {
    title = '材料导入失败';
    content = `您的离线材料导入任务处理失败，${failedFiles} 个文件未能成功处理`;
    type = MESSAGE_TYPES.TASK_FAILED;
  } else if (failedFiles > 0) {
    title = '材料导入部分完成';
    content = `您的离线材料导入任务部分完成，成功 ${completedFiles} 个，失败 ${failedFiles} 个`;
    type = MESSAGE_TYPES.TASK_PARTIAL;
  }
  
  return createMessage(userId, type, title, content, {
    taskId: task.id,
    claimCaseId: task.claimCaseId,
    totalFiles: task.files.length,
    completedFiles,
    failedFiles,
    status: task.status,
  });
}

export function createTaskRecoveredMessage(userId, task, recoveryResult = {}) {
  const completedFiles = task.files.filter(f => f.status === 'completed').length;
  const failedFiles = task.files.filter(f => f.status === 'failed').length;
  const recoveredCount = Array.isArray(recoveryResult.recoveredFiles)
    ? recoveryResult.recoveredFiles.length
    : 0;

  const title = '导入任务已恢复';
  const content = recoveredCount > 0
    ? `已重新处理 ${recoveredCount} 个文件，当前成功 ${completedFiles} 个，失败 ${failedFiles} 个。`
    : `已刷新导入任务结果，当前成功 ${completedFiles} 个，失败 ${failedFiles} 个。`;

  return createMessage(userId, MESSAGE_TYPES.TASK_RECOVERED, title, content, {
    taskId: task.id,
    claimCaseId: task.claimCaseId,
    totalFiles: task.files.length,
    completedFiles,
    failedFiles,
    status: task.status,
    recoveredFiles: recoveryResult.recoveredFiles || [],
  });
}

export function createTaskRecoveryNeededMessage(userId, task) {
  const escalation = getTaskRecoveryEscalation(task);
  const existing = findLatestUnreadByTask(
    userId,
    [MESSAGE_TYPES.TASK_RECOVERY_NEEDED, MESSAGE_TYPES.TASK_RECOVERY_ESCALATED],
    task.id,
  );
  if (existing) {
    return existing;
  }

  const completedFiles = task.files.filter(f => f.status === 'completed').length;
  const failedFiles = task.files.filter(f => f.status === 'failed').length;
  const issue = classifyTaskRecoveryIssue(task);
  const title = escalation.title || (failedFiles > 0 && completedFiles > 0 ? '导入任务可恢复' : '导入任务恢复待处理');
  const content = failedFiles > 0 && completedFiles > 0
    ? `该导入任务部分完成，已有 ${failedFiles} 个失败文件，建议执行恢复任务。${issue.hint}`
    : `该导入任务处理失败，建议尽快执行恢复任务。${issue.hint}`;

  return createMessage(userId, escalation.messageType, title, content, {
    taskId: task.id,
    claimCaseId: task.claimCaseId,
    totalFiles: task.files.length,
    completedFiles,
    failedFiles,
    status: task.status,
    action: 'recover_task',
    failureCategory: issue.category,
    failureHint: issue.hint,
    escalationLevel: escalation.level,
  });
}

export function findLatestUnreadByIncident(userId, incidentId) {
  return (
    readMessages().find(
      (message) =>
        message.userId === userId &&
        message.type === MESSAGE_TYPES.AI_ALERT &&
        message.data?.incidentId === incidentId &&
        message.isRead === false,
    ) || null
  );
}

export function createAIIncidentMessage(userId, incident) {
  const existing = findLatestUnreadByIncident(userId, incident.id);
  if (existing) return existing;

  return createMessage(
    userId,
    MESSAGE_TYPES.AI_ALERT,
    `AI 告警：${incident.summary}`,
    `${incident.summary}。严重级别：${incident.severity}。触发时间：${incident.triggeredAt}`,
    {
      incidentId: incident.id,
      traceIds: incident.affectedTraceIds || [],
      severity: incident.severity,
      status: incident.status,
    },
  );
}

export function getMessages(userId, options = {}) {
  let messages = readMessages().filter(m => m.userId === userId);
  
  if (options.isRead !== undefined) {
    messages = messages.filter(m => m.isRead === options.isRead);
  }
  
  if (options.type) {
    messages = messages.filter(m => m.type === options.type);
  }
  
  messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const total = messages.length;
  const limit = options.limit || 20;
  const offset = options.offset || 0;
  messages = messages.slice(offset, offset + limit);
  
  return {
    messages,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}

export function getUnreadCount(userId) {
  const messages = readMessages();
  return messages.filter(m => m.userId === userId && !m.isRead).length;
}

export function markAsRead(messageId) {
  const messages = readMessages();
  const index = messages.findIndex(m => m.id === messageId);
  
  if (index === -1) return null;
  
  messages[index] = {
    ...messages[index],
    isRead: true,
    readAt: new Date().toISOString(),
  };
  
  writeMessages(messages);
  return messages[index];
}

export function markAllAsRead(userId) {
  const messages = readMessages();
  let updated = false;
  
  messages.forEach(m => {
    if (m.userId === userId && !m.isRead) {
      m.isRead = true;
      m.readAt = new Date().toISOString();
      updated = true;
    }
  });
  
  if (updated) {
    writeMessages(messages);
  }
  
  return { success: true, updated };
}

export function deleteMessage(messageId) {
  const messages = readMessages();
  const filtered = messages.filter(m => m.id !== messageId);
  
  if (filtered.length === messages.length) {
    return false;
  }
  
  writeMessages(filtered);
  return true;
}

export function deleteAllRead(userId) {
  const messages = readMessages();
  const filtered = messages.filter(m => !(m.userId === userId && m.isRead));
  
  writeMessages(filtered);
  return { success: true, deletedCount: messages.length - filtered.length };
}

export async function sendDingTalk(message) {
  console.log('[MessageCenter] DingTalk push (not implemented):', message.title);
  return { success: false, error: 'Not implemented' };
}

export async function sendEmail(message) {
  console.log('[MessageCenter] Email push (not implemented):', message.title);
  return { success: false, error: 'Not implemented' };
}

export { MESSAGE_TYPES };

export default {
  createMessage,
  createTaskCompleteMessage,
  classifyTaskRecoveryIssue,
  createTaskRecoveryNeededMessage,
  createTaskRecoveredMessage,
  createAIIncidentMessage,
  getTaskRecoveryEscalation,
  getMessages,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteMessage,
  deleteAllRead,
  sendDingTalk,
  sendEmail,
  MESSAGE_TYPES,
};
