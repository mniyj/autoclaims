/**
 * 规则引擎核心 - 执行规则集
 * 按 ExecutionDomain 和 Priority 顺序执行规则
 */

import { evaluateConditions } from './conditionEvaluator.js';
import { executeAction, executeItemLoopAction } from './actionExecutor.js';
import { buildContext, getCoverageConfig } from './context.js';
import { logRuleExecution } from '../middleware/index.js';

/**
 * 执行域枚举
 */
const ExecutionDomain = {
  ELIGIBILITY: 'ELIGIBILITY',   // 责任判断
  ASSESSMENT: 'ASSESSMENT',      // 金额计算
  POST_PROCESS: 'POST_PROCESS'   // 后处理
};

const REQUIRED_POSITIVE_CATEGORIES = new Set([
  'COVERAGE_PERIOD',
  'WAITING_PERIOD',
  'POLICY_STATUS',
  'COVERAGE_SCOPE',
  'CLAIM_TIMELINE'
]);

function extractConditionFields(conditions, collected = new Set()) {
  if (!conditions || typeof conditions !== 'object') {
    return collected;
  }

  if (typeof conditions.field === 'string') {
    collected.add(conditions.field);
    return collected;
  }

  if (Array.isArray(conditions.expressions)) {
    for (const expression of conditions.expressions) {
      extractConditionFields(expression, collected);
    }
  }

  return collected;
}

function findMissingFields(fields, context) {
  return [...fields].filter(field => {
    const parts = field.split('.');
    let current = context;
    for (const part of parts) {
      if (current === null || current === undefined) {
        return true;
      }
      current = current[part];
    }
    return current === undefined || current === null || current === '';
  });
}

function hasUnsupportedValueReference(conditions) {
  if (!conditions || typeof conditions !== 'object') {
    return false;
  }

  if (typeof conditions.value === 'string') {
    const match = conditions.value.match(/^\$\{(.+)\}$/);
    if (match) {
      return !/^[a-zA-Z0-9_.]+$/.test(match[1]);
    }
  }

  if (!Array.isArray(conditions.expressions)) {
    return false;
  }

  return conditions.expressions.some(expression => hasUnsupportedValueReference(expression));
}

function inferCoverageCode(context, state) {
  if (state.coverageCode) {
    return state.coverageCode;
  }

  if (context.claim?.death_confirmed) {
    return 'ACC_DEATH';
  }

  if (context.claim?.disability_grade !== null && context.claim?.disability_grade !== undefined) {
    return 'ACC_DISABILITY';
  }

  if ((context.claim?.hospital_days || 0) > 0 && (context.claim?.expense_items || []).length === 0) {
    return 'ACC_HOSPITAL_ALLOWANCE';
  }

  return 'ACC_MEDICAL';
}

function applyPostProcessRules(postProcessRules, context, state) {
  const executionResults = [];

  for (const rule of postProcessRules) {
    const result = executeSingleRule(rule, context, state);
    executionResults.push(result);
  }

  return executionResults;
}

function appendWarning(warnings, message, category = 'SYSTEM', ruleId = 'SYSTEM') {
  warnings.push({
    rule_id: ruleId,
    message,
    category
  });
}

function getConfiguredAmount(value) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && typeof value.amount === 'number') {
    return value.amount;
  }
  return 0;
}

function getDeductibleAmount(coverageConfig) {
  if (!coverageConfig) return 0;
  return getConfiguredAmount(coverageConfig.deductible);
}

function getSumInsuredAmount(coverageConfig) {
  if (!coverageConfig) return 0;
  return getConfiguredAmount(coverageConfig.sum_insured);
}

function getMedicalReimbursementRatio(coverageConfig) {
  if (!coverageConfig) return 1;
  if (typeof coverageConfig.co_pay_ratio === 'number') {
    return 1 - coverageConfig.co_pay_ratio;
  }

  const rules = coverageConfig.reimbursement_rules;
  if (rules) {
    if (typeof rules.social_insurance_covered_ratio === 'number') {
      return rules.social_insurance_covered_ratio;
    }
    if (typeof rules.without_social_insurance_ratio === 'number') {
      return rules.without_social_insurance_ratio;
    }
  }

  return 1;
}

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
  let positiveRuleMatched = false;
  let unresolvedPositiveRule = false;
  
  // 按顺序执行规则
  for (const rule of eligibilityRules) {
    const result = executeSingleRule(rule, context, state);
    executionResults.push(result);
    
    if (result.condition_met) {
      matchedRules.push(rule.rule_id);
      if (REQUIRED_POSITIVE_CATEGORIES.has(rule.category)) {
        positiveRuleMatched = true;
      }
      
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
    } else if (REQUIRED_POSITIVE_CATEGORIES.has(rule.category) && rule.action?.action_type === 'APPROVE_CLAIM') {
      const fields = extractConditionFields(rule.conditions);
      const missingFields = findMissingFields(fields, context);
      const unsupportedReference = hasUnsupportedValueReference(rule.conditions);

      if (missingFields.length > 0 || unsupportedReference) {
        unresolvedPositiveRule = true;
        state.needsManualReview = true;
        state.manualReviewReason = unsupportedReference
          ? `${rule.rule_name} 包含当前引擎不支持的条件表达式`
          : `${rule.rule_name} 缺少关键字段: ${missingFields.join(', ')}`;
        warnings.push({
          rule_id: rule.rule_id,
          message: state.manualReviewReason,
          category: rule.category
        });
      } else {
        state.claimRejected = true;
        state.rejectReason = `UNMET_${rule.category}`;
        rejectionReason = {
          rule_id: rule.rule_id,
          rule_name: rule.rule_name,
          reason_code: state.rejectReason,
          source_text: rule.source?.source_text
        };
        break;
      }
    }
  }
  
  // 构建返回结果
  const hasRequiredPositiveRules = eligibilityRules.some(rule => REQUIRED_POSITIVE_CATEGORIES.has(rule.category));
  const eligible = !state.claimRejected && (positiveRuleMatched || !hasRequiredPositiveRules) && !unresolvedPositiveRule;
  
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
  if (eligibilityResult && !eligibilityResult.eligible && !eligibilityResult.needsManualReview) {
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
  const postProcessRules = sortRulesByPriority(
    filterRulesByDomain(rules, ExecutionDomain.POST_PROCESS)
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
    payoutRatio: null,
    deductible: 0,
    itemAmounts: {},
    coverageCode: inferCoverageCode(context, {}),
    totalApprovedAmount: 0,
    totalClaimedAmount: totalClaimed
  };
  
  // 执行结果
  const executionResults = [];
  const itemBreakdown = [];
  const warnings = [];
  let needsManualReview = Boolean(eligibilityResult?.needsManualReview);
  
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
  state.totalApprovedAmount = totalApproved;
  state.calculatedAmount = totalApproved;

  const postProcessResults = applyPostProcessRules(postProcessRules, context, state);
  executionResults.push(...postProcessResults);

  const coverageCode = inferCoverageCode(context, state);
  const coverageConfig = getCoverageConfig(productCode || context.policy?.product_code, coverageCode);

  if (!coverageConfig) {
    needsManualReview = true;
    appendWarning(
      warnings,
      `未找到责任 ${coverageCode} 对应的保障配置，需人工复核产品责任映射`,
      'COVERAGE_CONFIG'
    );
  }

  if (coverageCode === 'ACC_DISABILITY' || coverageCode === 'ACC_DEATH' || coverageCode === 'ACC_HOSPITAL_ALLOWANCE') {
    state.deductible = 0;
  }

  const deductible = state.deductible || 0;
  const defaultRatio = coverageCode === 'ACC_MEDICAL'
    ? getMedicalReimbursementRatio(coverageConfig)
    : 1;
  const reimbursementRatio = state.payoutRatio || defaultRatio;
  let baseAmount = state.calculatedAmount ?? totalApproved;
  let reportedClaimable = totalApproved;

  if (coverageCode === 'ACC_DISABILITY') {
    baseAmount = getSumInsuredAmount(coverageConfig);
    reportedClaimable = baseAmount;
  } else if (coverageCode === 'ACC_DEATH') {
    baseAmount = getSumInsuredAmount(coverageConfig);
    reportedClaimable = baseAmount;
  } else if (coverageCode === 'ACC_HOSPITAL_ALLOWANCE') {
    const dailyAllowance = coverageConfig?.daily_allowance || 0;
    baseAmount = (context.claim?.hospital_days || 0) * dailyAllowance;
    reportedClaimable = baseAmount;
  } else if (coverageCode === 'ACC_MEDICAL' && deductible === 0 && getDeductibleAmount(coverageConfig) > 0) {
    const fallbackDeductible = getDeductibleAmount(coverageConfig);
    state.deductible = fallbackDeductible;
    baseAmount = Math.max(0, baseAmount - fallbackDeductible);
  }

  const finalAmount = Math.max(0, Math.round(baseAmount * reimbursementRatio * 100) / 100);
  const configuredSumInsured = getSumInsuredAmount(coverageConfig);
  const sumInsured = configuredSumInsured || Infinity;
  const cappedAmount = Math.min(finalAmount, sumInsured);
  const coverageResult = {
    coverageCode,
    claimedAmount: reportedClaimable,
    approvedAmount: cappedAmount,
    deductible: state.deductible || 0,
    reimbursementRatio,
    sumInsured: Number.isFinite(sumInsured) ? sumInsured : null,
    status: needsManualReview ? 'MANUAL_REVIEW' : (cappedAmount > 0 ? 'PAYABLE' : 'ZERO_PAY')
  };
  
  const result = {
    totalClaimable: reportedClaimable,
    deductible: state.deductible || 0,
    reimbursementRatio,
    finalAmount: cappedAmount,
    capApplied: finalAmount > sumInsured,
    sumInsured,
    coverageCode,
    coverageResult,
    itemBreakdown,
    warnings,
    needsManualReview,
    executionDetails: executionResults,
    context: {
      claim_id: claimCaseId,
      product_code: context.policy?.product_code,
      coverage_code: coverageCode
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
    decision: eligibilityResult.needsManualReview
      ? 'MANUAL_REVIEW'
      : (eligibilityResult.eligible ? 'APPROVE' : 'REJECT'),
    
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
      itemBreakdown: amountResult.itemBreakdown,
      coverageCode: amountResult.coverageCode,
      coverageResult: amountResult.coverageResult,
      warnings: amountResult.warnings,
      needsManualReview: amountResult.needsManualReview
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
