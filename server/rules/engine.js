/**
 * 规则引擎核心 - 执行规则集
 * 按 ExecutionDomain 和 Priority 顺序执行规则
 */

import { evaluateConditions } from './conditionEvaluator.js';
import { executeAction, executeItemLoopAction } from './actionExecutor.js';
import { buildContext, getRuleset, getCoverageConfig } from './context.js';
import { logRuleExecution } from '../middleware/index.js';

/**
 * 执行域枚举
 */
const ExecutionDomain = {
  ELIGIBILITY: 'ELIGIBILITY',   // 责任判断
  ASSESSMENT: 'ASSESSMENT',      // 金额计算
  POST_PROCESS: 'POST_PROCESS'   // 后处理
};

/**
 * 按优先级排序规则
 * @param {object[]} rules - 规则数组
 * @returns {object[]} 排序后的规则
 */
function sortRulesByPriority(rules) {
  return [...rules].sort((a, b) => {
    // 先按 level 排序（1 最高）
    const levelDiff = (a.priority?.level || 4) - (b.priority?.level || 4);
    if (levelDiff !== 0) return levelDiff;
    // 再按 rank 排序
    return (a.priority?.rank || 0) - (b.priority?.rank || 0);
  });
}

/**
 * 过滤指定域的规则
 * @param {object[]} rules - 规则数组
 * @param {string} domain - 执行域
 * @returns {object[]} 过滤后的规则
 */
function filterRulesByDomain(rules, domain) {
  return rules.filter(rule => 
    rule.execution?.domain === domain && 
    rule.status === 'EFFECTIVE'
  );
}

/**
 * 执行单条规则
 * @param {object} rule - 规则对象
 * @param {object} context - 执行上下文
 * @param {object} state - 累积状态
 * @returns {object} 执行结果
 */
function executeSingleRule(rule, context, state) {
  const result = {
    rule_id: rule.rule_id,
    rule_name: rule.rule_name,
    category: rule.category,
    executed: false,
    condition_met: false,
    action_result: null,
    item_results: [],
    source: rule.source
  };
  
  // 检查是否是循环执行规则
  const isLoopRule = rule.execution?.loop_over !== null;
  
  if (isLoopRule) {
    // 循环执行规则（针对费用明细等）
    result.item_results = executeItemLoopAction(rule, context, state);
    result.executed = true;
    result.condition_met = result.item_results.some(r => r.conditionMet);
  } else {
    // 普通规则
    const conditionMet = evaluateConditions(rule.conditions, context);
    result.condition_met = conditionMet;
    
    if (conditionMet) {
      result.action_result = executeAction(rule.action, context, state);
      result.executed = true;
    }
  }
  
  return result;
}

/**
 * 执行责任判断（ELIGIBILITY域）
 * @param {object} params - 参数
 * @returns {object} 责任判断结果
 */
export async function checkEligibility({ claimCaseId, productCode, ocrData = {} }) {
  const startTime = Date.now();
  
  // 构建执行上下文
  const context = buildContext({ claimCaseId, productCode, ocrData });
  const rules = context.ruleset.rules;
  
  // 获取并排序 ELIGIBILITY 域规则
  const eligibilityRules = sortRulesByPriority(
    filterRulesByDomain(rules, ExecutionDomain.ELIGIBILITY)
  );
  
  // 执行状态
  const state = {
    claimApproved: false,
    claimRejected: false,
    needsManualReview: false,
    fraudFlagged: false
  };
  
  // 执行结果
  const executionResults = [];
  const matchedRules = [];
  const warnings = [];
  let rejectionReason = null;
  
  // 按顺序执行规则
  for (const rule of eligibilityRules) {
    const result = executeSingleRule(rule, context, state);
    executionResults.push(result);
    
    if (result.condition_met) {
      matchedRules.push(rule.rule_id);
      
      // 检查是否有拒绝动作
      if (state.claimRejected) {
        rejectionReason = {
          rule_id: rule.rule_id,
          rule_name: rule.rule_name,
          reason_code: state.rejectReason,
          source_text: rule.source?.source_text
        };
        // 短路：一旦拒绝，停止后续规则执行
        break;
      }
      
      // 收集警告
      if (state.needsManualReview) {
        warnings.push({
          rule_id: rule.rule_id,
          message: state.manualReviewReason || '需人工复核',
          category: rule.category
        });
      }
      
      if (state.fraudFlagged) {
        warnings.push({
          rule_id: rule.rule_id,
          message: `欺诈风险: 风险分 ${state.fraudRiskScore}`,
          category: 'FRAUD'
        });
      }
    }
  }
  
  // 构建返回结果
  const eligible = !state.claimRejected;
  
  const result = {
    eligible,
    matchedRules,
    rejectionReasons: rejectionReason ? [rejectionReason] : [],
    warnings,
    needsManualReview: state.needsManualReview,
    fraudFlagged: state.fraudFlagged,
    fraudRiskScore: state.fraudRiskScore,
    executionDetails: executionResults,
    context: {
      claim_id: claimCaseId,
      product_code: context.policy?.product_code,
      product_name: context.policy?.product_name,
      ruleset_id: context.ruleset?.ruleset_id
    },
    duration: Date.now() - startTime
  };
  
  // 记录审计日志
  logRuleExecution({
    rulesetId: context.ruleset?.ruleset_id,
    claimCaseId,
    productCode,
    input: { ocrData },
    output: result,
    duration: result.duration,
    success: true
  });
  
  return result;
}

/**
 * 执行金额计算（ASSESSMENT域）
 * @param {object} params - 参数
 * @returns {object} 金额计算结果
 */
export async function calculateAmount({ claimCaseId, productCode, eligibilityResult, invoiceItems = [], ocrData = {} }) {
  const startTime = Date.now();
  
  // 如果责任判断未通过，直接返回零赔付
  if (eligibilityResult && !eligibilityResult.eligible) {
    return {
      totalClaimable: 0,
      deductible: 0,
      reimbursementRatio: 0,
      finalAmount: 0,
      itemBreakdown: [],
      reason: '责任判断未通过',
      rejectionReasons: eligibilityResult.rejectionReasons,
      duration: Date.now() - startTime
    };
  }
  
  // 构建执行上下文
  const context = buildContext({ claimCaseId, productCode, ocrData, invoiceItems });
  const rules = context.ruleset.rules;
  
  // 获取并排序 ASSESSMENT 域规则
  const assessmentRules = sortRulesByPriority(
    filterRulesByDomain(rules, ExecutionDomain.ASSESSMENT)
  );
  
  // 从发票或OCR数据获取费用明细
  const expenseItems = invoiceItems.length > 0 ? invoiceItems : (ocrData.chargeItems || []);
  
  // 计算原始申请金额
  const totalClaimed = expenseItems.reduce((sum, item) => {
    return sum + (item.totalPrice || item.amount || 0);
  }, 0);
  
  // 执行状态
  const state = {
    calculatedAmount: totalClaimed,
    payoutRatio: 1,
    deductible: 0,
    itemAmounts: {}
  };
  
  // 执行结果
  const executionResults = [];
  const itemBreakdown = [];
  
  // 按顺序执行规则
  for (const rule of assessmentRules) {
    const result = executeSingleRule(rule, context, state);
    executionResults.push(result);
    
    // 处理项目级别结果
    if (result.item_results && result.item_results.length > 0) {
      for (const itemResult of result.item_results) {
        const item = itemResult.item;
        const itemName = item.itemName || item.name || `项目${itemResult.itemIndex + 1}`;
        const originalAmount = item.totalPrice || item.amount || 0;
        
        let approvedAmount = originalAmount;
        let reason = '通过';
        
        if (!itemResult.conditionMet) {
          approvedAmount = 0;
          reason = '不符合赔付条件';
        } else if (itemResult.actionResult?.data?.reduction_ratio) {
          const reduction = itemResult.actionResult.data.reduction_ratio;
          approvedAmount = originalAmount * (1 - reduction);
          reason = `调减 ${reduction * 100}%`;
        } else if (itemResult.actionResult?.data?.item_ratio) {
          const ratio = itemResult.actionResult.data.item_ratio;
          approvedAmount = originalAmount * ratio;
          reason = `按 ${ratio * 100}% 赔付`;
        }
        
        // 检查是否已记录该项目
        const existingIndex = itemBreakdown.findIndex(b => b.item === itemName);
        if (existingIndex >= 0) {
          itemBreakdown[existingIndex].approved = approvedAmount;
          itemBreakdown[existingIndex].reason = reason;
        } else {
          itemBreakdown.push({
            item: itemName,
            claimed: originalAmount,
            approved: approvedAmount,
            reason
          });
        }
      }
    }
  }
  
  // 如果没有项目级别处理，按总额处理
  if (itemBreakdown.length === 0 && expenseItems.length > 0) {
    for (const item of expenseItems) {
      const itemName = item.itemName || item.name || '费用项目';
      const originalAmount = item.totalPrice || item.amount || 0;
      itemBreakdown.push({
        item: itemName,
        claimed: originalAmount,
        approved: originalAmount,
        reason: '通过'
      });
    }
  }
  
  // 计算各项合计
  const totalApproved = itemBreakdown.reduce((sum, item) => sum + item.approved, 0);
  
  // 获取保障配置
  const coverageConfig = getCoverageConfig(productCode || context.policy?.product_code, 'ACC_MEDICAL');
  
  // 应用免赔额
  const deductible = state.deductible || coverageConfig?.deductible || 0;
  const afterDeductible = Math.max(0, totalApproved - deductible);
  
  // 应用赔付比例
  const reimbursementRatio = state.payoutRatio || (1 - (coverageConfig?.co_pay_ratio || 0));
  const finalAmount = Math.round(afterDeductible * reimbursementRatio * 100) / 100;
  
  // 应用限额
  const sumInsured = coverageConfig?.sum_insured || Infinity;
  const cappedAmount = Math.min(finalAmount, sumInsured);
  
  const result = {
    totalClaimable: totalApproved,
    deductible,
    reimbursementRatio,
    finalAmount: cappedAmount,
    capApplied: finalAmount > sumInsured,
    sumInsured,
    itemBreakdown,
    executionDetails: executionResults,
    context: {
      claim_id: claimCaseId,
      product_code: context.policy?.product_code,
      coverage_code: 'ACC_MEDICAL'
    },
    duration: Date.now() - startTime
  };
  
  // 记录审计日志
  logRuleExecution({
    rulesetId: context.ruleset?.ruleset_id,
    claimCaseId,
    productCode,
    input: { invoiceItems, ocrData },
    output: result,
    duration: result.duration,
    success: true
  });
  
  return result;
}

/**
 * 执行完整理赔审核（责任判断 + 金额计算）
 * @param {object} params - 参数
 * @returns {object} 完整审核结果
 */
export async function executeFullReview({ claimCaseId, productCode, ocrData = {}, invoiceItems = [] }) {
  const startTime = Date.now();
  
  // 1. 执行责任判断
  const eligibilityResult = await checkEligibility({ claimCaseId, productCode, ocrData });
  
  // 2. 执行金额计算
  const amountResult = await calculateAmount({
    claimCaseId,
    productCode,
    eligibilityResult,
    invoiceItems,
    ocrData
  });
  
  // 3. 构建综合结果
  return {
    // 决策结果
    decision: eligibilityResult.eligible ? 
      (eligibilityResult.needsManualReview ? 'MANUAL_REVIEW' : 'APPROVE') : 'REJECT',
    
    // 责任判断
    eligibility: {
      eligible: eligibilityResult.eligible,
      matchedRules: eligibilityResult.matchedRules,
      rejectionReasons: eligibilityResult.rejectionReasons,
      warnings: eligibilityResult.warnings,
      needsManualReview: eligibilityResult.needsManualReview,
      fraudFlagged: eligibilityResult.fraudFlagged
    },
    
    // 金额计算
    amount: {
      totalClaimable: amountResult.totalClaimable,
      deductible: amountResult.deductible,
      reimbursementRatio: amountResult.reimbursementRatio,
      finalAmount: amountResult.finalAmount,
      itemBreakdown: amountResult.itemBreakdown
    },
    
    // 规则追踪
    ruleTrace: [
      ...eligibilityResult.matchedRules,
      ...(amountResult.executionDetails || [])
        .filter(r => r.condition_met)
        .map(r => r.rule_id)
    ],
    
    // 上下文信息
    context: eligibilityResult.context,
    
    // 执行时长
    duration: Date.now() - startTime
  };
}
