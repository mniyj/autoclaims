/**
 * AI交互日志服务
 * 记录所有AI调用的入参、出参、耗时等信息
 */

import { readData, writeData } from '../utils/fileStore.js';

const LOG_FILE = 'ai-interaction-logs';
const MAX_LOG_ENTRIES = 10000;

/**
 * 记录AI交互日志
 * @param {Object} logData - 日志数据
 */
export function logInteraction(logData) {
  try {
    const logs = readData(LOG_FILE) || [];
    
    const logEntry = {
      id: `ailog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...logData,
    };
    
    logs.push(logEntry);
    
    // 日志轮转：只保留最近的MAX_LOG_ENTRIES条
    if (logs.length > MAX_LOG_ENTRIES) {
      logs.splice(0, logs.length - MAX_LOG_ENTRIES);
    }
    
    writeData(LOG_FILE, logs);
  } catch (error) {
    // 日志记录失败不应阻塞主流程
    console.error('[AI Logger] Failed to log interaction:', error);
  }
}

/**
 * 根据任务ID查询日志
 * @param {string} taskId - 任务ID
 * @returns {Array} 日志列表
 */
export function getLogsByTask(taskId) {
  try {
    const logs = readData(LOG_FILE) || [];
    return logs.filter(log => log.taskId === taskId);
  } catch (error) {
    console.error('[AI Logger] Failed to get logs:', error);
    return [];
  }
}

/**
 * 根据文件索引查询日志
 * @param {string} taskId - 任务ID
 * @param {number} fileIndex - 文件索引
 * @returns {Array} 日志列表
 */
export function getLogsByFile(taskId, fileIndex) {
  try {
    const logs = readData(LOG_FILE) || [];
    return logs.filter(log => log.taskId === taskId && log.fileIndex === fileIndex);
  } catch (error) {
    console.error('[AI Logger] Failed to get logs:', error);
    return [];
  }
}

/**
 * 查询所有日志（支持分页）
 * @param {Object} options - 查询选项
 * @returns {Object} 日志列表和总数
 */
export function queryLogs(options = {}) {
  try {
    const { taskId, fileIndex, taskType, limit = 50, offset = 0 } = options;
    let logs = readData(LOG_FILE) || [];
    
    // 过滤
    if (taskId) {
      logs = logs.filter(log => log.taskId === taskId);
    }
    if (fileIndex !== undefined) {
      logs = logs.filter(log => log.fileIndex === fileIndex);
    }
    if (taskType) {
      logs = logs.filter(log => log.taskType === taskType);
    }
    
    // 按时间倒序
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const total = logs.length;
    const paginatedLogs = logs.slice(offset, offset + limit);
    
    return {
      logs: paginatedLogs,
      total,
      limit,
      offset,
    };
  } catch (error) {
    console.error('[AI Logger] Failed to query logs:', error);
    return { logs: [], total: 0, limit: options.limit || 50, offset: options.offset || 0 };
  }
}

/**
 * 创建AI调用包装器，自动记录日志
 * @param {Function} fn - 要包装的AI调用函数
 * @param {Object} meta - 元数据
 * @returns {Function} 包装后的函数
 */
export function withLogging(fn, meta = {}) {
  return async function(...args) {
    const startTime = Date.now();
    const { taskId, fileIndex, taskType, input } = meta;
    
    try {
      const result = await fn(...args);
      const endTime = Date.now();
      
      logInteraction({
        taskId,
        fileIndex,
        taskType,
        input,
        output: {
          response: JSON.stringify(result),
          parsedResult: result,
        },
        performance: {
          startTime,
          endTime,
          duration: endTime - startTime,
          retryCount: 0,
        },
      });
      
      return result;
    } catch (error) {
      const endTime = Date.now();
      
      logInteraction({
        taskId,
        fileIndex,
        taskType,
        input,
        output: null,
        error: {
          message: error.message,
          code: error.code,
          stack: error.stack,
        },
        performance: {
          startTime,
          endTime,
          duration: endTime - startTime,
          retryCount: 0,
        },
      });
      
      throw error;
    }
  };
}
