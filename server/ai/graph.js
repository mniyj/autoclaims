/**
 * LangGraph 状态图 - 智能理赔审核
 * 将理赔审核流程建模为状态机，支持条件分支和人工介入
 *
 * 增强版本：支持多文件处理、材料完整性检查、多级人工介入
 *
 * 状态图：
 * START
 *   ↓
 * collect_all_documents (文件解析 + 联合分析)
 *   ↓
 * check_document_completeness (材料完整性)
 *   ↓ ─────────────────────┐
 *   │ 不完整               │ 完整
 *   ↓                      ↓
 * request_more_docs    check_eligibility
 * (人工介入点1)              ↓
 *                         ├─ reject_claim
 *                         ├─ ai_eligibility_review (新)
 *                         │     ↓
 *                         │   ├─ human_review (人工介入点2)
 *                         │   └─ calculate_amount
 *                         └─ calculate_amount
 *                                 ↓
 *                            assess_risk
 *                                 ↓
 *                    ┌────────────┼────────────┐
 *                    ↓            ↓            ↓
 *              auto_approve   human_review   reject_claim
 *                            (人工介入点3)
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ClaimState } from './state.js';
import {
  CLAIM_ADJUSTER_SYSTEM_PROMPT,
  formatOcrDataSummary,
  formatInvoiceItemsSummary
} from './prompts/claimAdjuster.js';
import { checkEligibility } from '../rules/engine.js';
import { logAIReview, aiCostTracker } from '../middleware/index.js';
import { createClaimAdjusterAgent } from './agent.js';

// 导入多文件处理服务
import { processFiles } from '../services/fileProcessor.js';
import { analyzeMultiFiles } from '../services/multiFileAnalyzer.js';

// 获取 API Key
const getApiKey = () => process.env.GEMINI_API_KEY || process.env.API_KEY;

// 创建 LLM 模型（用于风险评估）
let riskAssessmentModel = null;

async function getRiskAssessmentModel() {
  if (!riskAssessmentModel) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found');
    }
    const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
    riskAssessmentModel = new ChatGoogleGenerativeAI({
      apiKey,
      model: 'gemini-2.5-flash',
      temperature: 0.3,
      maxRetries: 2,
    });
  }
  return riskAssessmentModel;
}

// ============================================================================
// 节点函数
// ============================================================================

/**
 * 收集材料节点
 * 验证并整理输入的 OCR 数据和发票明细
 */
export async function collectDocuments(state) {
  const debug = { ...state.debug };
  debug.nodeExecutions.push({
    node: 'collect_documents',
    timestamp: Date.now(),
  });

  const messages = [
    new SystemMessage(CLAIM_ADJUSTER_SYSTEM_PROMPT),
    new HumanMessage(`开始审核案件 ${state.claimCaseId || '未指定'}（产品：${state.productCode || '未指定'}）`)
  ];

  return {
    messages,
    debug,
  };
}

/**
 * 责任判断节点
 * 调用规则引擎进行责任判断
 */
export async function checkEligibilityNode(state) {
  const startTime = Date.now();
  const debug = { ...state.debug };

  debug.nodeExecutions.push({
    node: 'check_eligibility',
    timestamp: startTime,
  });

  try {
    const result = await checkEligibility({
      claimCaseId: state.claimCaseId,
      productCode: state.productCode,
      ocrData: state.ocrData
    });

    debug.nodeExecutions[debug.nodeExecutions.length - 1].duration = Date.now() - startTime;

    return {
      eligibility: result,
      ruleTrace: result.matchedRules || [],
      messages: [
        new HumanMessage(`责任判断结果：${result.eligible ? '✅ 通过' : '❌ 未通过'}`)
      ],
      debug,
    };
  } catch (error) {
    console.error('[check_eligibility error]', error);
    debug.nodeExecutions[debug.nodeExecutions.length - 1].error = error.message;

    return {
      eligibility: { eligible: false, rejectionReasons: [{ rule_name: '系统错误', reason_code: 'SYSTEM_ERROR', source_text: error.message }] },
      decision: 'MANUAL_REVIEW',
      reasoning: `责任判断执行异常：${error.message}`,
      debug,
    };
  }
}

/**
 * 金额计算节点
 * 调用规则引擎计算赔付金额
 */
export async function calculateAmountNode(state) {
  const startTime = Date.now();
  const debug = { ...state.debug };

  debug.nodeExecutions.push({
    node: 'calculate_amount',
    timestamp: startTime,
  });

  try {
    const { calculateAmount } = await import('../rules/engine.js');
    const result = await calculateAmount({
      claimCaseId: state.claimCaseId,
      productCode: state.productCode,
      eligibilityResult: state.eligibility,
      invoiceItems: state.invoiceItems,
      ocrData: state.ocrData
    });

    debug.nodeExecutions[debug.nodeExecutions.length - 1].duration = Date.now() - startTime;

    return {
      calculation: result,
      messages: [
        new HumanMessage(`金额计算结果：可赔付 ¥${result.finalAmount}`)
      ],
      debug,
    };
  } catch (error) {
    console.error('[calculate_amount error]', error);
    debug.nodeExecutions[debug.nodeExecutions.length - 1].error = error.message;

    return {
      calculation: { finalAmount: 0, error: error.message },
      reasoning: `金额计算执行异常：${error.message}`,
      debug,
    };
  }
}

/**
 * 风险评估节点
 * 使用 LLM 评估案件风险等级
 */
export async function assessRiskNode(state) {
  const startTime = Date.now();
  const debug = { ...state.debug };

  debug.nodeExecutions.push({
    node: 'assess_risk',
    timestamp: startTime,
  });

  try {
    const model = await getRiskAssessmentModel();

    // 构建风险评估 prompt
    const riskPrompt = `
基于以下信息评估理赔案件的风险等级：

## 责任判断结果
- 是否符合责任: ${state.eligibility?.eligible ? '是' : '否'}
- 匹配规则: ${state.eligibility?.matchedRules?.join(', ') || '无'}
- 拒赔原因: ${state.eligibility?.rejectionReasons?.map(r => r.rule_name).join(', ') || '无'}
- 警告: ${state.eligibility?.warnings?.map(w => w.message).join('; ') || '无'}
- 需要人工复核: ${state.eligibility?.needsManualReview ? '是' : '否'}
- 欺诈风险标记: ${state.eligibility?.fraudFlagged ? '是' : '否'}

## 金额计算结果
- 申请总额: ¥${state.calculation?.totalClaimable || 0}
- 免赔额: ¥${state.calculation?.deductible || 0}
- 赔付比例: ${((state.calculation?.reimbursementRatio || 0) * 100)}%
- 最终金额: ¥${state.calculation?.finalAmount || 0}

## OCR 数据摘要
${formatOcrDataSummary(state.ocrData)}

## 费用明细
${formatInvoiceItemsSummary(state.invoiceItems)}

请根据以上信息评估风险等级，并按以下格式输出：

**风险等级**: [LOW/MEDIUM/HIGH]
**理由**: [简要说明评估理由]

风险等级判断标准：
- LOW: 案件信息完整，符合保单责任，无异常情况，金额合理
- MEDIUM: 有警告信息或需要复核的小问题
- HIGH: 欺诈风险标记、重大异常、或金额异常
`;

    const response = await model.invoke([
      new HumanMessage(riskPrompt)
    ]);

    // 解析风险等级
    let riskLevel = 'MEDIUM';
    const content = response.content;
    if (content.includes('HIGH')) {
      riskLevel = 'HIGH';
    } else if (content.includes('LOW')) {
      riskLevel = 'LOW';
    }

    debug.nodeExecutions[debug.nodeExecutions.length - 1].duration = Date.now() - startTime;
    debug.nodeExecutions[debug.nodeExecutions.length - 1].riskLevel = riskLevel;

    return {
      riskLevel,
      reasoning: content,
      messages: [response],
      debug,
    };
  } catch (error) {
    console.error('[assess_risk error]', error);
    debug.nodeExecutions[debug.nodeExecutions.length - 1].error = error.message;

    return {
      riskLevel: 'MEDIUM',
      reasoning: `风险评估执行异常，设为中等风险：${error.message}`,
      debug,
    };
  }
}

/**
 * 自动通过节点
 * 生成通过决策
 */
export async function autoApproveNode(state) {
  const debug = { ...state.debug };

  debug.nodeExecutions.push({
    node: 'auto_approve',
    timestamp: Date.now(),
  });

  const reasoning = state.reasoning || '自动审核通过';
  const finalReasoning = `## 审核结论\n- **决定**: APPROVE\n- **理赔金额**: ¥${state.calculation?.finalAmount || 0}\n\n${reasoning}`;

  return {
    decision: 'APPROVE',
    reasoning: finalReasoning,
    debug,
  };
}

/**
 * 拒赔节点
 * 生成拒赔决策
 */
export async function rejectClaimNode(state) {
  const debug = { ...state.debug };

  debug.nodeExecutions.push({
    node: 'reject_claim',
    timestamp: Date.now(),
  });

  let reasoning = state.reasoning || '';
  if (state.eligibility?.rejectionReasons?.length > 0) {
    const reason = state.eligibility.rejectionReasons[0];
    reasoning += `\n\n## 拒赔原因\n- **规则**: ${reason.rule_name}\n- **依据**: ${reason.source_text || reason.reason_code}`;
  }

  const finalReasoning = `## 审核结论\n- **决定**: REJECT\n\n${reasoning}`;

  return {
    decision: 'REJECT',
    reasoning: finalReasoning,
    debug,
  };
}

/**
 * 人工审核节点
 * 标记需要人工审核，支持中断/恢复
 */
export async function humanReviewNode(state) {
  const debug = { ...state.debug };

  debug.nodeExecutions.push({
    node: 'human_review',
    timestamp: Date.now(),
  });

  const reasoning = state.reasoning || '需要人工复核';
  const finalReasoning = `## 审核结论\n- **决定**: MANUAL_REVIEW\n- **理赔金额**: ¥${state.calculation?.finalAmount || 0}\n\n${reasoning}`;

  return {
    decision: 'MANUAL_REVIEW',
    humanReviewRequired: true,
    reasoning: finalReasoning,
    debug,
  };
}

// ============================================================================
// 增强版节点函数 - 多文件处理
// ============================================================================

/**
 * 解析所有文档节点
 * 处理上传的所有文件，进行 OCR 和 AI 分析
 */
export async function parseAllDocumentsNode(state) {
  const startTime = Date.now();
  const debug = { ...state.debug };

  debug.nodeExecutions.push({
    node: 'parse_all_documents',
    timestamp: startTime,
  });

  try {
    // 如果没有文档列表，使用 OCR 数据作为模拟
    const documents = state.documents || [];

    if (documents.length === 0) {
      // 没有文档，使用现有 OCR 数据
      debug.nodeExecutions[debug.nodeExecutions.length - 1].duration = Date.now() - startTime;

      return {
        parsedDocuments: [],
        crossValidationResults: [],
        messages: [
          new HumanMessage('未检测到上传文件，使用已有 OCR 数据继续审核')
        ],
        debug,
      };
    }

    // 处理所有文件
    const parsedDocuments = await processFiles(documents, {
      skipOCR: false,
      skipAI: false,
      concurrency: 3,
    });

    // 多文件联合分析
    const analysisResult = await analyzeMultiFiles(parsedDocuments, {
      productCode: state.productCode,
      claimCaseId: state.claimCaseId,
    });

    debug.nodeExecutions[debug.nodeExecutions.length - 1].duration = Date.now() - startTime;
    debug.nodeExecutions[debug.nodeExecutions.length - 1].documentCount = parsedDocuments.length;

    return {
      parsedDocuments,
      crossValidationResults: analysisResult.crossValidation,
      documentCompleteness: analysisResult.completeness,
      completenessScore: analysisResult.completeness.completenessScore,
      missingDocuments: analysisResult.completeness.missingMaterials,
      interventionPoints: analysisResult.interventionPoints,
      messages: [
        new HumanMessage(`已解析 ${parsedDocuments.length} 个文件，交叉验证 ${analysisResult.crossValidation.length} 项`)
      ],
      debug,
    };
  } catch (error) {
    console.error('[parse_all_documents error]', error);
    debug.nodeExecutions[debug.nodeExecutions.length - 1].error = error.message;

    return {
      parsedDocuments: [],
      crossValidationResults: [],
      reasoning: `文件解析异常：${error.message}`,
      debug,
    };
  }
}

/**
 * 检查材料完整性节点
 */
export async function checkDocumentCompletenessNode(state) {
  const startTime = Date.now();
  const debug = { ...state.debug };

  debug.nodeExecutions.push({
    node: 'check_document_completeness',
    timestamp: startTime,
  });

  const completeness = state.documentCompleteness;
  const isComplete = completeness?.isComplete ?? true;
  const score = completeness?.completenessScore ?? 100;

  debug.nodeExecutions[debug.nodeExecutions.length - 1].duration = Date.now() - startTime;
  debug.nodeExecutions[debug.nodeExecutions.length - 1].completenessScore = score;

  return {
    completenessScore: score,
    needsMoreDocuments: !isComplete,
    requestedDocuments: completeness?.missingMaterials || [],
    messages: [
      new HumanMessage(`材料完整度: ${score}%${isComplete ? ' ✅' : ' ⚠️ 缺失材料'}`)
    ],
    debug,
  };
}

/**
 * 请求补充材料节点
 * 标记需要用户补充材料
 */
export async function requestMoreDocsNode(state) {
  const debug = { ...state.debug };

  debug.nodeExecutions.push({
    node: 'request_more_docs',
    timestamp: Date.now(),
  });

  const missingDocs = state.missingDocuments || [];
  const interventionPoint = {
    id: `intervention-${Date.now()}-doc`,
    type: 'document_incomplete',
    reason: `材料不完整，缺少 ${missingDocs.length} 项`,
    timestamp: new Date().toISOString(),
    requiredAction: `请补充上传: ${missingDocs.join(', ')}`,
    resolved: false,
  };

  return {
    decision: 'NEED_MORE_DOCS',
    needsMoreDocuments: true,
    requestedDocuments: missingDocs,
    interventionPoints: [interventionPoint],
    reasoning: `## 材料补正通知\n\n需要补充以下材料:\n${missingDocs.map(d => `- ${d}`).join('\n')}\n\n请上传完整材料后重新提交。`,
    messages: [
      new HumanMessage(`材料不完整，需要补充: ${missingDocs.join(', ')}`)
    ],
    debug,
  };
}

/**
 * AI 责任复核节点
 * 当责任判断存疑时，使用 AI 进行深度分析
 */
export async function aiEligibilityReviewNode(state) {
  const startTime = Date.now();
  const debug = { ...state.debug };

  debug.nodeExecutions.push({
    node: 'ai_eligibility_review',
    timestamp: startTime,
  });

  try {
    const model = await getRiskAssessmentModel();

    // 构建复核 prompt
    const reviewPrompt = `
作为资深理赔审核员，请对以下案件进行责任复核：

## 基本信息
- 案件号: ${state.claimCaseId}
- 产品代码: ${state.productCode}

## 初步责任判断
- 是否符合责任: ${state.eligibility?.eligible ? '是' : '否'}
- 拒赔原因: ${state.eligibility?.rejectionReasons?.map(r => r.rule_name).join(', ') || '无'}
- 警告: ${state.eligibility?.warnings?.map(w => w.message).join('; ') || '无'}

## OCR 数据摘要
${formatOcrDataSummary(state.ocrData)}

## 交叉验证结果
${state.crossValidationResults?.map(v => `- ${v.type}: ${v.passed ? '✅' : '❌'} ${v.message}`).join('\n') || '无'}

## 文档完整性
- 完整度: ${state.completenessScore}%
- ${state.documentCompleteness?.isComplete ? '✅ 材料完整' : '⚠️ 材料不完整'}

请分析：
1. 责任判断是否合理？
2. 是否存在需要特别关注的风险点？
3. 建议的处理方式？

回复格式：
**责任判断**: [确认/存疑/需要人工]
**风险点**: [列出风险点]
**建议**: [处理建议]
`;

    const response = await model.invoke([
      new HumanMessage(reviewPrompt)
    ]);

    const content = response.content;

    // 判断是否需要人工介入
    const needsHumanReview = content.includes('需要人工') || content.includes('存疑');

    debug.nodeExecutions[debug.nodeExecutions.length - 1].duration = Date.now() - startTime;

    return {
      reasoning: content,
      humanReviewRequired: needsHumanReview,
      messages: [response],
      debug,
    };
  } catch (error) {
    console.error('[ai_eligibility_review error]', error);
    debug.nodeExecutions[debug.nodeExecutions.length - 1].error = error.message;

    return {
      reasoning: `AI 复核异常: ${error.message}`,
      humanReviewRequired: true,
      debug,
    };
  }
}

// ============================================================================
// 条件边函数
// ============================================================================

/**
 * 责任判断后的路由
 * 根据是否符合责任决定下一步
 */
export function routeAfterEligibility(state) {
  if (!state.eligibility?.eligible) {
    return 'reject_claim';
  }
  if (state.eligibility?.needsManualReview || state.eligibility?.fraudFlagged) {
    return 'human_review';
  }
  return 'calculate_amount';
}

/**
 * 风险评估后的路由
 * 根据风险等级决定是否人工审核
 */
export function routeAfterRisk(state) {
  const riskLevel = state.riskLevel || 'MEDIUM';
  if (riskLevel === 'HIGH') {
    return 'human_review';
  }
  return 'auto_approve';
}

// ============================================================================
// 增强版条件边函数
// ============================================================================

/**
 * 文档收集后的路由
 */
export function routeAfterCollect(state) {
  // 如果有文档列表，先进行完整性检查
  if (state.documents && state.documents.length > 0) {
    return 'check_document_completeness';
  }
  // 否则直接进行责任判断
  return 'check_eligibility';
}

/**
 * 材料完整性检查后的路由
 */
export function routeAfterCompleteness(state) {
  // 如果材料不完整且完整度低于阈值
  if (state.needsMoreDocuments || state.completenessScore < 60) {
    return 'request_more_docs';
  }
  // 材料完整，继续责任判断
  return 'check_eligibility';
}

/**
 * AI 责任复核后的路由
 */
export function routeAfterAIReview(state) {
  if (state.humanReviewRequired) {
    return 'human_review';
  }
  return 'calculate_amount';
}

// ============================================================================
// 图构建和编译
// ============================================================================

/**
 * 创建理赔审核状态图（基础版本）
 */
export function createClaimReviewGraph() {
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

  return workflow;
}

/**
 * 创建理赔审核状态图（增强版本）
 * 支持多文件处理、材料完整性检查、多级人工介入
 */
export function createEnhancedClaimReviewGraph() {
  const workflow = new StateGraph(ClaimState);

  // 添加基础节点
  workflow
    .addNode('collect_documents', collectDocuments)
    .addNode('check_eligibility', checkEligibilityNode)
    .addNode('calculate_amount', calculateAmountNode)
    .addNode('assess_risk', assessRiskNode)
    .addNode('auto_approve', autoApproveNode)
    .addNode('reject_claim', rejectClaimNode)
    .addNode('human_review', humanReviewNode);

  // 添加增强节点
  workflow
    .addNode('parse_all_documents', parseAllDocumentsNode)
    .addNode('check_document_completeness', checkDocumentCompletenessNode)
    .addNode('request_more_docs', requestMoreDocsNode)
    .addNode('ai_eligibility_review', aiEligibilityReviewNode);

  // 添加边 - 增强流程
  workflow
    .addEdge(START, 'collect_documents')
    .addConditionalEdges('collect_documents', routeAfterCollect, {
      'check_document_completeness': 'check_document_completeness',
      'check_eligibility': 'check_eligibility',
    })
    .addConditionalEdges('check_document_completeness', routeAfterCompleteness, {
      'request_more_docs': 'request_more_docs',
      'check_eligibility': 'check_eligibility',
    })
    .addEdge('request_more_docs', END)  // 需要补充材料，结束流程
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

  return workflow;
}

/**
 * 编译图（不带检查点 - 简化版）
 */
export const graph = createClaimReviewGraph().compile();

/**
 * 编译增强版图
 */
export const enhancedGraph = createEnhancedClaimReviewGraph().compile();

/**
 * 执行智能理赔审核（LangGraph 版本）
 * 与原 agent.js 的 executeSmartReview 接口兼容
 */
export async function executeSmartReviewGraph({
  claimCaseId,
  productCode,
  ocrData = {},
  invoiceItems = []
}) {
  const startTime = Date.now();
  const sessionId = `ai-review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
    // 执行图
    const result = await graph.invoke(initialState);

    const duration = Date.now() - startTime;

    // 结束成本追踪
    const costSession = aiCostTracker.endSession(sessionId, {
      success: true,
      tokenUsage: null,
      error: null,
    });

    // 记录 AI 审核日志
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
    console.error('[Graph execution error]', error);

    const duration = Date.now() - startTime;

    aiCostTracker.endSession(sessionId, {
      success: false,
      tokenUsage: null,
      error: error.message,
    });

    // 返回降级结果
    return {
      decision: 'MANUAL_REVIEW',
      amount: null,
      reasoning: `智能审核执行异常：${error.message}`,
      eligibility: null,
      calculation: null,
      ruleTrace: [],
      debug: {
        error: error.message,
        duration,
        sessionId,
      },
      context: {
        claimCaseId,
        productCode,
      },
      duration,
    };
  }
}

/**
 * 导出所有节点和边函数（用于测试和扩展）
 */
export const nodes = {
  // 基础节点
  collectDocuments,
  checkEligibilityNode,
  calculateAmountNode,
  assessRiskNode,
  autoApproveNode,
  rejectClaimNode,
  humanReviewNode,
  // 增强节点
  parseAllDocumentsNode,
  checkDocumentCompletenessNode,
  requestMoreDocsNode,
  aiEligibilityReviewNode,
};

export const edges = {
  routeAfterEligibility,
  routeAfterRisk,
  routeAfterCollect,
  routeAfterCompleteness,
  routeAfterAIReview,
};

/**
 * 执行智能理赔审核（增强版本）
 * 支持多文件处理和材料完整性检查
 */
export async function executeSmartReviewGraphV2({
  claimCaseId,
  productCode,
  ocrData = {},
  invoiceItems = [],
  documents = [],  // 新增：上传的文件列表
}) {
  const startTime = Date.now();
  const sessionId = `ai-review-v2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 开始成本追踪
  aiCostTracker.startSession(sessionId);

  // 初始化状态
  const initialState = {
    claimCaseId,
    productCode,
    ocrData,
    invoiceItems,
    documents,  // 新增
    debug: {
      nodeExecutions: [],
      startTime,
    },
  };

  try {
    // 选择使用增强版图
    const graphToUse = documents.length > 0 ? enhancedGraph : graph;

    // 执行图
    const result = await graphToUse.invoke(initialState);

    const duration = Date.now() - startTime;

    // 结束成本追踪
    const costSession = aiCostTracker.endSession(sessionId, {
      success: true,
      tokenUsage: null,
      error: null,
    });

    // 记录 AI 审核日志
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

      // 新增：多文件处理结果
      parsedDocuments: result.parsedDocuments,
      crossValidation: result.crossValidationResults,
      completeness: result.documentCompleteness,
      interventionPoints: result.interventionPoints,

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
    console.error('[Enhanced Graph execution error]', error);

    const duration = Date.now() - startTime;

    aiCostTracker.endSession(sessionId, {
      success: false,
      tokenUsage: null,
      error: error.message,
    });

    // 返回降级结果
    return {
      decision: 'MANUAL_REVIEW',
      amount: null,
      reasoning: `智能审核执行异常：${error.message}`,
      eligibility: null,
      calculation: null,
      ruleTrace: [],
      parsedDocuments: [],
      crossValidation: [],
      interventionPoints: [],
      debug: {
        error: error.message,
        duration,
        sessionId,
      },
      context: {
        claimCaseId,
        productCode,
      },
      duration,
    };
  }
}
