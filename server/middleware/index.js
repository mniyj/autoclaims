/**
 * 服务端中间件
 * - API 限流
 * - 审计日志
 * - 成本追踪
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const logsDir = path.join(projectRoot, 'logs');

// 确保日志目录存在
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ============ 限流配置 ============

/**
 * AI 接口限流（防止滥用）
 * 每个 IP 每分钟最多 10 次请求
 */
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 10, // 每分钟最多 10 次
  message: {
    error: 'AI 接口请求过于频繁，请稍后再试',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // 使用 IP + 用户标识（如有）作为限流 key
    const userId = req.headers['x-user-id'] || '';
    const forwardedFor = req.headers['x-forwarded-for'];
    const rawIp = req.ip || (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) || 'unknown';
    const ip = ipKeyGenerator(rawIp);
    return `${ip}:${userId}`;
  }
});

/**
 * 规则引擎接口限流
 * 每个 IP 每分钟最多 30 次请求
 */
export const ruleEngineRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: '规则引擎请求过于频繁，请稍后再试',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * 通用 API 限流
 * 每个 IP 每分钟最多 100 次请求
 */
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    error: '请求过于频繁，请稍后再试',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============ 审计日志 ============

/**
 * 审计日志类型
 */
export const AuditLogType = {
  RULE_EXECUTION: 'RULE_EXECUTION',      // 规则执行
  AI_REVIEW: 'AI_REVIEW',                // AI 审核
  CLAIM_ACTION: 'CLAIM_ACTION',          // 案件操作（通过/拒赔）
  API_CALL: 'API_CALL'                   // API 调用
};

/**
 * 写入审计日志
 * @param {object} logEntry - 日志条目
 */
export function writeAuditLog(logEntry) {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const logFile = path.join(logsDir, `audit-${date}.jsonl`);
  
  const entry = {
    timestamp,
    ...logEntry
  };
  
  try {
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch (error) {
    console.error('[Audit Log] Write failed:', error.message);
  }
  
  return entry;
}

/**
 * 记录规则执行日志
 */
export function logRuleExecution({
  rulesetId,
  claimCaseId,
  productCode,
  input,
  output,
  duration,
  success = true,
  error = null
}) {
  return writeAuditLog({
    type: AuditLogType.RULE_EXECUTION,
    rulesetId,
    claimCaseId,
    productCode,
    input: summarizeInput(input),
    output: summarizeOutput(output),
    duration,
    success,
    error: error ? String(error) : null
  });
}

/**
 * 记录 AI 审核日志
 */
export function logAIReview({
  claimCaseId,
  productCode,
  decision,
  amount,
  toolCalls,
  duration,
  tokenUsage = null,
  success = true,
  error = null
}) {
  return writeAuditLog({
    type: AuditLogType.AI_REVIEW,
    claimCaseId,
    productCode,
    decision,
    amount,
    toolCalls: toolCalls?.length || 0,
    duration,
    tokenUsage,
    success,
    error: error ? String(error) : null
  });
}

/**
 * 记录案件操作日志
 */
export function logClaimAction({
  claimCaseId,
  action,  // APPROVE, REJECT, MANUAL_REVIEW
  operator,
  previousStatus,
  newStatus,
  amount,
  reason
}) {
  return writeAuditLog({
    type: AuditLogType.CLAIM_ACTION,
    claimCaseId,
    action,
    operator,
    previousStatus,
    newStatus,
    amount,
    reason
  });
}

// ============ 成本追踪 ============

/**
 * AI 成本追踪器
 */
class AICostTracker {
  constructor() {
    this.sessions = new Map();
    this.dailyStats = {
      date: new Date().toISOString().split('T')[0],
      totalCalls: 0,
      totalTokens: { input: 0, output: 0 },
      totalDuration: 0,
      errors: 0
    };
  }
  
  /**
   * 开始追踪一次 AI 调用
   */
  startSession(sessionId) {
    this.sessions.set(sessionId, {
      startTime: Date.now(),
      toolCalls: []
    });
    return sessionId;
  }
  
  /**
   * 记录工具调用
   */
  recordToolCall(sessionId, toolName, duration) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.toolCalls.push({ toolName, duration });
    }
  }
  
  /**
   * 结束追踪
   */
  endSession(sessionId, { success, tokenUsage, error }) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    const duration = Date.now() - session.startTime;
    
    // 更新每日统计
    this.checkDateRollover();
    this.dailyStats.totalCalls++;
    this.dailyStats.totalDuration += duration;
    
    if (tokenUsage) {
      this.dailyStats.totalTokens.input += tokenUsage.input || 0;
      this.dailyStats.totalTokens.output += tokenUsage.output || 0;
    }
    
    if (!success) {
      this.dailyStats.errors++;
    }
    
    const result = {
      sessionId,
      duration,
      toolCalls: session.toolCalls,
      tokenUsage,
      success,
      error
    };
    
    this.sessions.delete(sessionId);
    return result;
  }
  
  /**
   * 检查日期滚动
   */
  checkDateRollover() {
    const today = new Date().toISOString().split('T')[0];
    if (this.dailyStats.date !== today) {
      // 保存昨日统计
      this.saveDailyStats();
      // 重置统计
      this.dailyStats = {
        date: today,
        totalCalls: 0,
        totalTokens: { input: 0, output: 0 },
        totalDuration: 0,
        errors: 0
      };
    }
  }
  
  /**
   * 保存每日统计
   */
  saveDailyStats() {
    const statsFile = path.join(logsDir, `ai-stats-${this.dailyStats.date}.json`);
    try {
      fs.writeFileSync(statsFile, JSON.stringify(this.dailyStats, null, 2));
    } catch (error) {
      console.error('[AI Stats] Save failed:', error.message);
    }
  }
  
  /**
   * 获取当前统计
   */
  getStats() {
    this.checkDateRollover();
    return { ...this.dailyStats };
  }
}

export const aiCostTracker = new AICostTracker();

// ============ 辅助函数 ============

/**
 * 摘要输入数据（避免日志过大）
 */
function summarizeInput(input) {
  if (!input) return null;
  
  const summary = {};
  
  if (input.claimCaseId) summary.claimCaseId = input.claimCaseId;
  if (input.productCode) summary.productCode = input.productCode;
  if (input.ocrData) {
    summary.ocrDataKeys = Object.keys(input.ocrData);
  }
  if (input.invoiceItems) {
    summary.invoiceItemsCount = input.invoiceItems.length;
  }
  
  return summary;
}

/**
 * 摘要输出数据
 */
function summarizeOutput(output) {
  if (!output) return null;
  
  const summary = {};
  
  if (output.eligible !== undefined) summary.eligible = output.eligible;
  if (output.decision) summary.decision = output.decision;
  if (output.finalAmount !== undefined) summary.finalAmount = output.finalAmount;
  if (output.matchedRules) summary.matchedRulesCount = output.matchedRules.length;
  if (output.rejectionReasons) summary.rejectionReasonsCount = output.rejectionReasons.length;
  
  return summary;
}

/**
 * 读取审计日志
 * @param {string} date - 日期 YYYY-MM-DD，传入 'all' 读取全部
 * @param {object} filters - 过滤条件
 */
export function readAuditLogs(date, filters = {}) {
  // 读取所有日志文件
  if (date === 'all') {
    try {
      const files = fs.readdirSync(logsDir);
      const auditFiles = files.filter(f => f.startsWith('audit-') && f.endsWith('.jsonl'));
      
      let allLogs = [];
      for (const file of auditFiles) {
        const logFile = path.join(logsDir, file);
        try {
          const content = fs.readFileSync(logFile, 'utf-8');
          const lines = content.trim().split('\n').filter(Boolean);
          
          const logs = lines.map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          }).filter(Boolean);
          
          allLogs.push(...logs);
        } catch (e) {
          console.error(`[Audit Log] Failed to read ${file}:`, e.message);
        }
      }
      
      // 应用过滤器
      if (filters.type) {
        allLogs = allLogs.filter(log => log.type === filters.type);
      }
      if (filters.claimCaseId) {
        allLogs = allLogs.filter(log => log.claimCaseId === filters.claimCaseId);
      }
      if (filters.success !== undefined) {
        allLogs = allLogs.filter(log => log.success === filters.success);
      }
      
      // 按时间排序（最新的在前）
      allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      return allLogs;
    } catch (error) {
      console.error('[Audit Log] Read all failed:', error.message);
      return [];
    }
  }
  
  // 读取指定日期的日志文件
  const logFile = path.join(logsDir, `audit-${date}.jsonl`);
  
  if (!fs.existsSync(logFile)) {
    return [];
  }
  
  try {
    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    let logs = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    // 应用过滤器
    if (filters.type) {
      logs = logs.filter(log => log.type === filters.type);
    }
    if (filters.claimCaseId) {
      logs = logs.filter(log => log.claimCaseId === filters.claimCaseId);
    }
    if (filters.success !== undefined) {
      logs = logs.filter(log => log.success === filters.success);
    }
    
    return logs;
  } catch (error) {
    console.error('[Audit Log] Read failed:', error.message);
    return [];
  }
}
