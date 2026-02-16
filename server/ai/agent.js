/**
 * LangChain AI Agent - 智能理赔审核
 * 整合 Tools 和 Prompts，执行端到端的理赔审核
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getAllTools } from './tools/index.js';
import {
  CLAIM_ADJUSTER_SYSTEM_PROMPT,
  CLAIM_ADJUSTER_HUMAN_PROMPT,
  formatOcrDataSummary,
  formatInvoiceItemsSummary
} from './prompts/claimAdjuster.js';
import { logAIReview, aiCostTracker } from '../middleware/index.js';

// 获取 API Key
const getApiKey = () => process.env.GEMINI_API_KEY || process.env.API_KEY;

/**
 * 创建理赔审核 Agent
 * @returns {object} Agent 实例
 */
export function createClaimAdjusterAgent() {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found');
  }
  
  const model = new ChatGoogleGenerativeAI({
    apiKey,
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    maxRetries: 2,
  });
  
  const tools = getAllTools();
  const modelWithTools = model.bindTools(tools);
  
  return {
    model: modelWithTools,
    tools
  };
}

/**
 * 执行工具调用
 * @param {object[]} toolCalls - 工具调用列表
 * @param {object[]} tools - 可用工具列表
 * @returns {object[]} 工具执行结果
 */
async function executeToolCalls(toolCalls, tools) {
  const results = [];
  
  for (const call of toolCalls) {
    const tool = tools.find(t => t.name === call.name);
    if (tool) {
      try {
        const result = await tool.invoke(call.args);
        results.push({
          toolCallId: call.id,
          name: call.name,
          result
        });
      } catch (error) {
        results.push({
          toolCallId: call.id,
          name: call.name,
          result: JSON.stringify({ error: true, message: error.message })
        });
      }
    }
  }
  
  return results;
}

/**
 * 解析 AI 响应中的结构化数据
 * @param {string} content - AI 响应内容
 * @param {object[]} toolResults - 工具执行结果
 * @returns {object} 解析后的审核结果
 */
function parseReviewResult(content, toolResults) {
  const result = {
    decision: 'MANUAL_REVIEW',
    amount: null,
    reasoning: content,
    ruleTrace: [],
    eligibility: null,
    calculation: null
  };
  
  // 从工具结果中提取数据
  for (const tr of toolResults) {
    try {
      const data = JSON.parse(tr.result);
      
      if (tr.name === 'check_eligibility') {
        result.eligibility = {
          eligible: data.eligible,
          matchedRules: data.matchedRules,
          rejectionReasons: data.rejectionReasons,
          warnings: data.warnings
        };
        result.ruleTrace.push(...(data.matchedRules || []));
        
        if (!data.eligible) {
          result.decision = 'REJECT';
        }
      }
      
      if (tr.name === 'calculate_claim_amount') {
        result.calculation = {
          totalClaimable: data.totalClaimable,
          deductible: data.deductible,
          reimbursementRatio: data.reimbursementRatio,
          finalAmount: data.finalAmount,
          itemBreakdown: data.itemBreakdown
        };
        result.amount = data.finalAmount;
        
        if (result.decision !== 'REJECT') {
          result.decision = 'APPROVE';
        }
      }
    } catch (e) {
      // 忽略解析错误
    }
  }
  
  // 从 AI 响应中提取决定（如果明确指出）
  if (content.includes('APPROVE') || content.includes('通过') || content.includes('批准')) {
    if (result.decision !== 'REJECT') {
      result.decision = 'APPROVE';
    }
  }
  if (content.includes('REJECT') || content.includes('拒赔') || content.includes('拒绝')) {
    result.decision = 'REJECT';
  }
  if (content.includes('MANUAL_REVIEW') || content.includes('人工复核') || content.includes('人工审核')) {
    result.decision = 'MANUAL_REVIEW';
  }
  
  return result;
}

/**
 * 执行智能理赔审核
 * @param {object} params - 审核参数
 * @returns {object} 审核结果
 */
export async function executeSmartReview({
  claimCaseId,
  productCode,
  ocrData = {},
  invoiceItems = []
}) {
  const startTime = Date.now();
  const sessionId = `ai-review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  // 开始成本追踪
  aiCostTracker.startSession(sessionId);
  
  const { model, tools } = createClaimAdjusterAgent();
  
  // 构建消息
  const ocrDataSummary = formatOcrDataSummary(ocrData);
  const invoiceItemsSummary = formatInvoiceItemsSummary(invoiceItems);
  
  const humanPrompt = CLAIM_ADJUSTER_HUMAN_PROMPT
    .replace('{productCode}', productCode || '未指定')
    .replace('{claimCaseId}', claimCaseId || '未指定')
    .replace('{ocrDataSummary}', ocrDataSummary)
    .replace('{invoiceItemsSummary}', invoiceItemsSummary);
  
  const messages = [
    new SystemMessage(CLAIM_ADJUSTER_SYSTEM_PROMPT),
    new HumanMessage(humanPrompt)
  ];
  
  // 记录工具调用
  const toolCallsLog = [];
  const toolResultsLog = [];
  
  // Agent 循环（最多 5 轮）
  let iterations = 0;
  const maxIterations = 5;
  let finalContent = '';
  
  while (iterations < maxIterations) {
    iterations++;
    
    // 调用模型
    const response = await model.invoke(messages);
    
    // 检查是否有工具调用
    const toolCalls = response.tool_calls || [];
    
    if (toolCalls.length === 0) {
      // 没有工具调用，结束循环
      finalContent = response.content;
      break;
    }
    
    // 记录工具调用
    toolCallsLog.push(...toolCalls);
    
    // 执行工具
    const toolResults = await executeToolCalls(toolCalls, tools);
    toolResultsLog.push(...toolResults);
    
    // 将工具结果添加到消息中
    messages.push(response);
    
    for (const result of toolResults) {
      messages.push({
        role: 'tool',
        tool_call_id: result.toolCallId,
        content: result.result
      });
    }
  }
  
  // 解析结果
  const parsedResult = parseReviewResult(finalContent, toolResultsLog);
  
  const duration = Date.now() - startTime;
  
  // 结束成本追踪
  const costSession = aiCostTracker.endSession(sessionId, {
    success: true,
    tokenUsage: null, // LangChain 暂时不返回 token 统计
    error: null
  });
  
  // 记录 AI 审核日志
  logAIReview({
    claimCaseId,
    productCode,
    decision: parsedResult.decision,
    amount: parsedResult.amount,
    toolCalls: toolCallsLog,
    duration,
    tokenUsage: costSession?.tokenUsage,
    success: true
  });
  
  return {
    // 决策结果
    decision: parsedResult.decision,
    amount: parsedResult.amount,
    
    // AI 生成的审核意见
    reasoning: parsedResult.reasoning,
    
    // 结构化数据
    eligibility: parsedResult.eligibility,
    calculation: parsedResult.calculation,
    
    // 规则追踪
    ruleTrace: parsedResult.ruleTrace,
    
    // 调试信息
    debug: {
      iterations,
      toolCalls: toolCallsLog.map(tc => ({
        name: tc.name,
        args: tc.args
      })),
      toolResults: toolResultsLog.map(tr => ({
        name: tr.name,
        // 只保留摘要，避免返回过大
        success: !tr.result.includes('"error":true')
      })),
      sessionId
    },
    
    // 上下文
    context: {
      claimCaseId,
      productCode
    },
    
    // 执行时长
    duration
  };
}
