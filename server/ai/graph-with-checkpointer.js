/**
 * LangGraph 状态图 - 带检查点支持版本
 * 支持状态持久化、interrupt/resume 人工审核功能
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { HumanMessage } from '@langchain/core/messages';
import { ClaimState } from './state.js';
import {
  CLAIM_ADJUSTER_SYSTEM_PROMPT,
  formatOcrDataSummary,
  formatInvoiceItemsSummary
} from './prompts/claimAdjuster.js';
import { checkEligibility } from '../rules/engine.js';
import { logAIReview, aiCostTracker } from '../middleware/index.js';

// ============================================================================
// 检查点存储
// ============================================================================

// 内存检查点存储（开发环境）
const memoryCheckpointer = new MemorySaver();

// 用于存储线程 ID 的映射
const threadIdMap = new Map();

/**
 * 生成线程 ID
 * @param {string} claimCaseId - 理赔案件ID
 * @returns {string} 线程ID
 */
export function generateThreadId(claimCaseId) {
  if (threadIdMap.has(claimCaseId)) {
    return threadIdMap.get(claimCaseId);
  }
  const threadId = `claim-${claimCaseId}-${Date.now()}`;
  threadIdMap.set(claimCaseId, threadId);
  return threadId;
}

/**
 * 获取案件的线程 ID
 * @param {string} claimCaseId - 理赔案件ID
 * @returns {string|null} 线程ID
 */
export function getThreadId(claimCaseId) {
  return threadIdMap.get(claimCaseId) || null;
}

// ============================================================================
// 节点函数（复用 graph.js 的节点，增加 interrupt 支持）
// ============================================================================

/**
 * 收集材料节点
 */
export async function collectDocuments(state) {
  const { collectDocuments: baseCollectDocuments } = await import('./graph.js');
  return baseCollectDocuments(state);
}

/**
 * 责任判断节点
 */
export async function checkEligibilityNode(state) {
  const { checkEligibilityNode: baseCheckEligibilityNode } = await import('./graph.js');
  return baseCheckEligibilityNode(state);
}

/**
 * 金额计算节点
 */
export async function calculateAmountNode(state) {
  const { calculateAmountNode: baseCalculateAmountNode } = await import('./graph.js');
  return baseCalculateAmountNode(state);
}

/**
 * 风险评估节点
 */
export async function assessRiskNode(state) {
  const { assessRiskNode: baseAssessRiskNode } = await import('./graph.js');
  return baseAssessRiskNode(state);
}

/**
 * 自动通过节点
 */
export async function autoApproveNode(state) {
  const { autoApproveNode: baseAutoApproveNode } = await import('./graph.js');
  return baseAutoApproveNode(state);
}

/**
 * 拒赔节点
 */
export async function rejectClaimNode(state) {
  const { rejectClaimNode: baseRejectClaimNode } = await import('./graph.js');
  return baseRejectClaimNode(state);
}

/**
 * 人工审核节点（带 interrupt 支持）
 * 等待人工审核后再继续执行
 */
export async function humanReviewNode(state) {
  const { humanReviewNode: baseHumanReviewNode } = await import('./graph.js');
  const baseResult = await baseHumanReviewNode(state);

  // 如果尚未有人工审核结果，则设置中断标记（由 graph 的 interruptBefore 配置触发中断）
  if (!state.humanReviewResult) {
    return {
      ...baseResult,
      humanReviewRequired: true,
    };
  }

  // 有人工审核结果，使用人工审核结果
  return {
    ...baseResult,
    decision: state.humanReviewResult.decision,
    reasoning: `## 人工审核结果\n- **审核人**: ${state.humanReviewResult.auditor || '未指定'}\n- **审核意见**: ${state.humanReviewResult.comment || '通过'}\n\n${state.reasoning}`,
  };
}

// ============================================================================
// 条件边函数
// ============================================================================

// 从 graph.js 导入条件边函数（非异步）
const { routeAfterEligibility: routeAfterEligibilityBase, routeAfterRisk: routeAfterRiskBase } = await import('./graph.js');

/**
 * 责任判断后的路由
 */
export const routeAfterEligibility = routeAfterEligibilityBase;

/**
 * 风险评估后的路由
 */
export const routeAfterRisk = routeAfterRiskBase;

// ============================================================================
// 图构建和编译（带检查点）
// ============================================================================

/**
 * 创建带检查点的理赔审核状态图
 */
export function createClaimReviewGraphWithCheckpointer() {
  const workflow = new StateGraph(ClaimState);

  // 添加节点
  workflow
    .addNode('collect_documents', collectDocuments)
    .addNode('check_eligibility', checkEligibilityNode)
    .addNode('calculate_amount', calculateAmountNode)
    .addNode('assess_risk', assessRiskNode)
    .addNode('auto_approve', autoApproveNode)
    .addNode('reject_claim', rejectClaimNode)
    .addNode('human_review', humanReviewNode);

  // 添加边
  workflow
    .addEdge(START, 'collect_documents')
    .addEdge('collect_documents', 'check_eligibility')
    .addConditionalEdges('check_eligibility', routeAfterEligibility, {
      'calculate_amount': 'calculate_amount',
      'reject_claim': 'reject_claim',
      'human_review': 'human_review',
    })
    .addEdge('calculate_amount', 'assess_risk')
    .addConditionalEdges('assess_risk', routeAfterRisk, {
      'auto_approve': 'auto_approve',
      'human_review': 'human_review',
    })
    .addEdge('auto_approve', END)
    .addEdge('reject_claim', END)
    .addEdge('human_review', END);

  // 编译图（带检查点）
  return workflow.compile({
    checkpointer: memoryCheckpointer,
  });
}

/**
 * 编译后的图实例（单例）
 */
let compiledGraphWithCheckpointer = null;

export function getGraphWithCheckpointer() {
  if (!compiledGraphWithCheckpointer) {
    compiledGraphWithCheckpointer = createClaimReviewGraphWithCheckpointer();
  }
  return compiledGraphWithCheckpointer;
}

// ============================================================================
// 状态管理 API
// ============================================================================

/**
 * 执行智能理赔审核（带状态持久化）
 * @param {object} params - 审核参数
 * @returns {object} 审核结果
 */
export async function executeSmartReviewWithState({
  claimCaseId,
  productCode,
  ocrData = {},
  invoiceItems = []
}) {
  const startTime = Date.now();
  const sessionId = `ai-review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const threadId = generateThreadId(claimCaseId);

  // 开始成本追踪
  aiCostTracker.startSession(sessionId);

  // 初始化状态
  const initialState = {
    claimCaseId,
    productCode,
    ocrData,
    invoiceItems,
    debug: {
      nodeExecutions: [],
      startTime,
    },
  };

  try {
    const graph = getGraphWithCheckpointer();

    // 执行图（传入线程配置）
    const result = await graph.invoke(initialState, {
      configurable: { thread_id: threadId },
      recursionLimit: 100, // 防止无限循环
    });

    const duration = Date.now() - startTime;

    // 检查是否中断
    const isInterrupted = result.humanReviewRequired && !result.humanReviewResult;

    // 结束成本追踪
    const costSession = aiCostTracker.endSession(sessionId, {
      success: !isInterrupted,
      tokenUsage: null,
      error: isInterrupted ? '等待人工审核' : null,
    });

    // 如果完成，记录日志
    if (!isInterrupted) {
      logAIReview({
        claimCaseId,
        productCode,
        decision: result.decision,
        amount: result.calculation?.finalAmount,
        toolCalls: result.debug?.nodeExecutions || [],
        duration,
        tokenUsage: costSession?.tokenUsage,
        success: true,
      });
    }

    return {
      // 决策结果
      decision: result.decision,
      amount: result.calculation?.finalAmount || null,

      // AI 生成的审核意见
      reasoning: result.reasoning,

      // 结构化数据
      eligibility: result.eligibility,
      calculation: result.calculation,

      // 规则追踪
      ruleTrace: result.ruleTrace,

      // 中断状态
      interrupted: isInterrupted,
      humanReviewRequired: result.humanReviewRequired,

      // 线程信息（用于恢复）
      threadId,

      // 调试信息
      debug: {
        nodeExecutions: result.debug?.nodeExecutions || [],
        duration,
        sessionId,
      },

      // 上下文
      context: {
        claimCaseId,
        productCode,
      },

      // 执行时长
      duration,
    };
  } catch (error) {
    console.error('[GraphWithCheckpointer execution error]', error);

    const duration = Date.now() - startTime;

    aiCostTracker.endSession(sessionId, {
      success: false,
      tokenUsage: null,
      error: error.message,
    });

    // 检查是否是中断错误
    if (error.message?.includes('interrupt')) {
      return {
        decision: 'MANUAL_REVIEW',
        amount: state?.calculation?.finalAmount || null,
        reasoning: '需要人工审核',
        interrupted: true,
        humanReviewRequired: true,
        threadId,
        context: { claimCaseId, productCode },
        duration,
      };
    }

    // 返回降级结果
    return {
      decision: 'MANUAL_REVIEW',
      amount: null,
      reasoning: `智能审核执行异常：${error.message}`,
      interrupted: false,
      threadId,
      context: { claimCaseId, productCode },
      duration,
    };
  }
}

/**
 * 获取案件的当前状态
 * @param {string} claimCaseId - 理赔案件ID
 * @returns {object|null} 当前状态
 */
export async function getReviewState(claimCaseId) {
  const threadId = getThreadId(claimCaseId);
  if (!threadId) {
    return null;
  }

  try {
    const graph = getGraphWithCheckpointer();
    const state = await graph.getState({ configurable: { thread_id: threadId } });

    return {
      claimCaseId,
      threadId,
      state: state.values,
      next: state.next,
      // 检查是否在中断点
      isInterrupted: !state.next || state.next.length === 0,
    };
  } catch (error) {
    console.error('[getReviewState error]', error);
    return null;
  }
}

/**
 * 提交人工审核结果并继续执行
 * @param {object} params - 审核参数
 * @returns {object} 最终审核结果
 */
export async function submitHumanReview({
  claimCaseId,
  decision, // 'APPROVE' | 'REJECT'
  auditor, // 审核人
  comment, // 审核意见
}) {
  const threadId = getThreadId(claimCaseId);
  if (!threadId) {
    throw new Error(`未找到案件 ${claimCaseId} 的审核记录`);
  }

  const startTime = Date.now();

  try {
    const graph = getGraphWithCheckpointer();

    // 更新状态：提交人工审核结果
    await graph.updateState(
      { configurable: { thread_id: threadId } },
      {
        humanReviewResult: {
          decision,
          auditor,
          comment,
          timestamp: new Date().toISOString(),
        },
      }
    );

    // 继续执行 - 不传任何输入以从检查点恢复
    const result = await graph.invoke(null, {
      configurable: { thread_id: threadId },
      recursionLimit: 100,
    });

    const duration = Date.now() - startTime;

    // 记录日志
    logAIReview({
      claimCaseId,
      productCode: result.productCode,
      decision: result.decision,
      amount: result.calculation?.finalAmount,
      toolCalls: result.debug?.nodeExecutions || [],
      duration,
      humanReview: { auditor, comment },
      success: true,
    });

    return {
      // 决策结果
      decision: result.decision,
      amount: result.calculation?.finalAmount || null,

      // 审核意见
      reasoning: result.reasoning,

      // 结构化数据
      eligibility: result.eligibility,
      calculation: result.calculation,

      // 规则追踪
      ruleTrace: result.ruleTrace,

      // 人工审核信息
      humanReview: {
        auditor,
        comment,
        timestamp: new Date().toISOString(),
      },

      // 调试信息
      debug: {
        nodeExecutions: result.debug?.nodeExecutions || [],
        duration,
      },

      // 上下文
      context: {
        claimCaseId,
        productCode: result.productCode,
      },

      // 执行时长
      duration,
    };
  } catch (error) {
    console.error('[submitHumanReview error]', error);

    return {
      decision: 'MANUAL_REVIEW',
      amount: null,
      reasoning: `人工审核提交失败：${error.message}`,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * 清除案件状态
 * @param {string} claimCaseId - 理赔案件ID
 */
export function clearReviewState(claimCaseId) {
  const threadId = getThreadId(claimCaseId);
  if (threadId) {
    threadIdMap.delete(claimCaseId);
  }
}

/**
 * 获取所有活跃的线程 ID
 * @returns {Array<{claimCaseId: string, threadId: string}>}
 */
export function getActiveThreads() {
  return Array.from(threadIdMap.entries()).map(([claimCaseId, threadId]) => ({
    claimCaseId,
    threadId,
  }));
}
