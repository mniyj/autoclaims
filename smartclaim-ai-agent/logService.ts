import { UserOperationType, UserOperationLog, AIInteractionLog } from '../types';

// 生成唯一日志ID: log-YYYYMMDDHHMMSS-random
const generateLogId = (): string => {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[-:T.]/g, '')
    .substring(0, 14); // YYYYMMDDHHMMSS
  const random = Math.random().toString(36).substring(2, 8);
  return `log-${timestamp}-${random}`;
};

// 识别设备类型
const getDeviceType = (): 'mobile' | 'desktop' | 'tablet' => {
  const ua = navigator.userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
};

// 获取或创建会话ID（存储在sessionStorage）
const getSessionId = (): string => {
  const SESSION_KEY = 'smartclaim_session_id';
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
};

// 敏感数据脱敏（自动过滤敏感字段）
const SENSITIVE_FIELDS = ['password', 'token', 'apiKey', 'idNumber', 'bankAccount', 'phone', 'email'];

const sanitizeData = (data: any): any => {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()));

    if (isSensitive) {
      sanitized[key] = '***';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// 日志队列
let logQueue: UserOperationLog[] = [];
let flushTimer: NodeJS.Timeout | null = null;

const BATCH_SIZE = 10; // 累积10条触发发送
const FLUSH_DELAY = 2000; // 2秒防抖

// 批量发送日志
const flushLogs = async () => {
  if (logQueue.length === 0) return;

  const logsToSend = [...logQueue];
  logQueue = [];

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  try {
    // 使用 fetch 发送批量日志
    const response = await fetch('/api/user-operation-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: logsToSend }),
    });

    if (!response.ok) {
      console.error('[LogService] Failed to send logs:', response.statusText);
      // 失败时重新加入队列（可选，避免丢失）
      logQueue.unshift(...logsToSend);
    }
  } catch (error) {
    console.error('[LogService] Error sending logs:', error);
    // 失败时重新加入队列（可选）
    logQueue.unshift(...logsToSend);
  }
};

// 调度刷新（防抖+批量触发）
const scheduleFlush = () => {
  if (logQueue.length >= BATCH_SIZE) {
    // 达到批量大小，立即发送
    flushLogs();
  } else {
    // 未达到批量大小，设置防抖定时器
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flushLogs, FLUSH_DELAY);
  }
};

// 页面卸载时发送日志（使用 sendBeacon 保证可靠投递）
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (logQueue.length > 0) {
      const blob = new Blob([JSON.stringify({ logs: logQueue })], { type: 'application/json' });
      navigator.sendBeacon('/api/user-operation-logs', blob);
      logQueue = [];
    }
  });
}

// 主日志记录函数
interface LogUserOperationParams {
  operationType: UserOperationType;
  operationLabel: string;
  userName: string;
  userGender?: string;
  claimId?: string;
  claimReportNumber?: string;
  currentStatus?: string;
  inputData?: Record<string, any>;
  outputData?: Record<string, any>;
  aiInteractions?: AIInteractionLog[];
  duration?: number;
  success?: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export const logUserOperation = (params: LogUserOperationParams) => {
  try {
    const log: UserOperationLog = {
      logId: generateLogId(),
      timestamp: new Date().toISOString(),

      userName: params.userName,
      userGender: params.userGender,
      sessionId: getSessionId(),

      operationType: params.operationType,
      operationLabel: params.operationLabel,

      claimId: params.claimId,
      claimReportNumber: params.claimReportNumber,
      currentStatus: params.currentStatus,

      inputData: params.inputData ? sanitizeData(params.inputData) : undefined,
      outputData: params.outputData ? sanitizeData(params.outputData) : undefined,

      aiInteractions: params.aiInteractions,

      duration: params.duration,
      success: params.success !== undefined ? params.success : true,
      errorMessage: params.errorMessage,

      userAgent: navigator.userAgent,
      deviceType: getDeviceType(),

      metadata: params.metadata,
    };

    // 加入队列
    logQueue.push(log);

    // 调度发送
    scheduleFlush();
  } catch (error) {
    // 日志记录失败不影响主流程
    console.error('[LogService] Failed to log operation:', error);
  }
};

// 带计时的操作记录（高阶函数）
export const logOperationWithTiming = async <T>(
  operationType: UserOperationType,
  operationLabel: string,
  userName: string,
  operation: () => Promise<T>,
  context?: {
    userGender?: string;
    claimId?: string;
    claimReportNumber?: string;
    inputData?: Record<string, any>;
  }
): Promise<T> => {
  const startTime = Date.now();
  let success = true;
  let errorMessage: string | undefined;
  let result: T;

  try {
    result = await operation();
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : String(error);
    throw error; // 继续抛出错误
  } finally {
    const duration = Date.now() - startTime;

    logUserOperation({
      operationType,
      operationLabel,
      userName,
      userGender: context?.userGender,
      claimId: context?.claimId,
      claimReportNumber: context?.claimReportNumber,
      inputData: context?.inputData,
      duration,
      success,
      errorMessage,
    });
  }

  return result!;
};

// 手动刷新日志（可选，用于测试或关键操作后强制发送）
export const flushLogsManually = () => {
  flushLogs();
};
