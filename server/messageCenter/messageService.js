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
