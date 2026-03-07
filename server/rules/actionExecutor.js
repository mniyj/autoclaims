/**
 * 动作执行器 - 执行规则动作
 * 支持所有 RuleActionType
 */

import { getFieldValue, evaluateConditions as evaluateConditionsImported } from './conditionEvaluator.js';

function resolveStateField(state, fieldName) {
  if (!fieldName) return undefined;
  if (Object.prototype.hasOwnProperty.call(state, fieldName)) {
    return state[fieldName];
  }
  return undefined;
}

/**
 * 执行规则动作
 * @param {object} action - RuleAction { action_type, params }
 * @param {object} context - 执行上下文
 * @param {object} state - 累积状态（用于跨规则传递结果）
 * @returns {object} 动作执行结果
 */
export function executeAction(action, context, state = {}) {
  const { action_type, params = {} } = action;
  
  const result = {
    action_type,
    success: true,
    message: '',
    data: {}
  };
  
  switch (action_type) {
    // ============ 理赔级别动作 ============
    
    case 'APPROVE_CLAIM':
      result.message = '理赔通过';
      result.data.approved = true;
      state.claimApproved = true;
      break;
      
    case 'REJECT_CLAIM':
      result.message = `理赔拒绝: ${params.reject_reason_code || '未知原因'}`;
      result.data.approved = false;
      result.data.reject_reason_code = params.reject_reason_code;
      state.claimRejected = true;
      state.rejectReason = params.reject_reason_code;
      break;
      
    case 'SET_CLAIM_RATIO':
      let ratio = params.payout_ratio;
      if (ratio === undefined && Array.isArray(params.disability_grade_table)) {
        const disabilityGrade = Number(context.claim?.disability_grade);
        const matchedRatio = params.disability_grade_table.find(item => Number(item.grade) === disabilityGrade);
        ratio = matchedRatio?.payout_ratio;
      }
      ratio = ratio ?? 1;
      result.message = `设置理赔比例: ${ratio * 100}%`;
      result.data.payout_ratio = ratio;
      state.payoutRatio = ratio;
      break;
      
    case 'ROUTE_CLAIM_MANUAL':
      result.message = `转人工审核: ${params.route_reason || '需人工复核'}`;
      result.data.needs_manual_review = true;
      result.data.route_reason = params.route_reason;
      state.needsManualReview = true;
      state.manualReviewReason = params.route_reason;
      break;
      
    case 'FLAG_FRAUD':
      result.message = `欺诈风险标记: 风险分 ${params.fraud_risk_score || 0}`;
      result.data.fraud_flagged = true;
      result.data.fraud_risk_score = params.fraud_risk_score;
      state.fraudFlagged = true;
      state.fraudRiskScore = params.fraud_risk_score;
      break;
      
    case 'TERMINATE_CONTRACT':
      result.message = '合同终止';
      result.data.contract_terminated = true;
      state.contractTerminated = true;
      break;
    
    // ============ 费用项目级别动作 ============
    
    case 'APPROVE_ITEM':
      result.message = '费用项目通过';
      result.data.item_approved = true;
      break;
      
    case 'REJECT_ITEM':
      result.message = '费用项目拒绝';
      result.data.item_approved = false;
      result.data.item_amount = 0;
      break;
      
    case 'ADJUST_ITEM_AMOUNT':
      const reductionRatio = params.reduction_ratio ?? 0;
      result.message = `费用项目调减: ${reductionRatio * 100}%`;
      result.data.reduction_ratio = reductionRatio;
      break;
      
    case 'SET_ITEM_RATIO':
      const itemRatio = params.payout_ratio ?? 1;
      result.message = `费用项目赔付比例: ${itemRatio * 100}%`;
      result.data.item_ratio = itemRatio;
      break;
      
    case 'FLAG_ITEM':
      result.message = '费用项目标记';
      result.data.item_flagged = true;
      break;
    
    // ============ 计算类动作 ============
    
    case 'APPLY_FORMULA':
      if (params.formula) {
        try {
          const formulaResult = evaluateFormula(params.formula.expression, context);
          result.message = `公式计算: ${params.formula.output_field} = ${formulaResult}`;
          result.data.formula_result = formulaResult;
          result.data.output_field = params.formula.output_field;
          // 将计算结果写入状态
          if (params.formula.output_field) {
            state[params.formula.output_field] = formulaResult;
          }
        } catch (err) {
          result.success = false;
          result.message = `公式计算失败: ${err.message}`;
        }
      }
      break;
      
    case 'APPLY_CAP':
      const capAmount = params.cap_amount ?? Infinity;
      const capField = params.cap_field || 'amount';
      const currentAmount = resolveStateField(state, capField) ?? getFieldValue(context, capField) ?? state.calculatedAmount ?? 0;
      const cappedAmount = Math.min(currentAmount, capAmount);
      result.message = `限额应用: ${capField} 上限 ${capAmount}`;
      result.data.capped_amount = cappedAmount;
      result.data.cap_applied = currentAmount > capAmount;
      state.calculatedAmount = cappedAmount;
      state[capField] = cappedAmount;
      break;
      
    case 'APPLY_DEDUCTIBLE':
      const deductible = params.deductible_amount ?? 0;
      const amountBeforeDeductible = state.calculatedAmount || 0;
      const amountAfterDeductible = Math.max(0, amountBeforeDeductible - deductible);
      result.message = `免赔额应用: ${deductible}`;
      result.data.deductible = deductible;
      result.data.amount_after_deductible = amountAfterDeductible;
      state.deductible = deductible;
      state.calculatedAmount = amountAfterDeductible;
      break;
      
    case 'SUM_COVERAGES':
      // 汇总所有保障项目金额
      const coverages = context.policy?.coverages || [];
      const totalSumInsured = coverages.reduce((sum, c) => sum + (c.sum_insured || 0), 0);
      result.message = `保额汇总: ${totalSumInsured}`;
      result.data.total_sum_insured = totalSumInsured;
      state.totalSumInsured = totalSumInsured;
      break;
      
    case 'DEDUCT_PRIOR_BENEFIT':
      // 扣除既往理赔
      const priorBenefit = context.claim?.prior_benefit || 0;
      const amountBeforePrior = state.calculatedAmount || 0;
      const amountAfterPrior = Math.max(0, amountBeforePrior - priorBenefit);
      result.message = `既往理赔扣除: ${priorBenefit}`;
      result.data.prior_benefit = priorBenefit;
      result.data.amount_after_prior = amountAfterPrior;
      state.calculatedAmount = amountAfterPrior;
      break;
      
    case 'ADD_REMARK':
      const remark = resolveTemplate(params.remark_template || '', context);
      result.message = `添加备注: ${remark}`;
      result.data.remark = remark;
      if (!state.remarks) state.remarks = [];
      state.remarks.push(remark);
      break;
      
    default:
      result.success = false;
      result.message = `未知动作类型: ${action_type}`;
  }
  
  return result;
}

/**
 * 简单公式求值器
 * 支持基本数学运算和字段引用
 * @param {string} expression - 公式表达式
 * @param {object} context - 执行上下文
 * @returns {number} 计算结果
 */
function evaluateFormula(expression, context) {
  // 替换字段引用
  let resolvedExpr = expression.replace(/\{([^}]+)\}/g, (match, fieldPath) => {
    const value = getFieldValue(context, fieldPath);
    return typeof value === 'number' ? value : 0;
  });
  
  // 安全地执行数学运算（只允许数字和基本运算符）
  if (!/^[\d\s+\-*/().]+$/.test(resolvedExpr)) {
    throw new Error('公式包含非法字符');
  }
  
  try {
    // eslint-disable-next-line no-eval
    return eval(resolvedExpr);
  } catch (err) {
    throw new Error(`公式执行错误: ${err.message}`);
  }
}

/**
 * 模板字符串解析
 * @param {string} template - 模板字符串
 * @param {object} context - 执行上下文
 * @returns {string} 解析后的字符串
 */
function resolveTemplate(template, context) {
  return template.replace(/\{([^}]+)\}/g, (match, fieldPath) => {
    const value = getFieldValue(context, fieldPath);
    return value !== undefined ? String(value) : match;
  });
}

/**
 * 执行费用项目循环动作
 * @param {object} rule - 规则对象
 * @param {object} context - 执行上下文
 * @param {object} state - 累积状态
 * @returns {object[]} 每个项目的执行结果
 */
export function executeItemLoopAction(rule, context, state) {
  const { execution, action } = rule;
  const { loop_over, item_alias, item_action_on_reject } = execution;
  
  if (!loop_over) return [];
  
  const items = getFieldValue(context, loop_over);
  if (!Array.isArray(items)) return [];
  
  const results = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // 创建包含当前项目的上下文
    const itemContext = {
      ...context,
      [item_alias || 'item']: item,
      _itemIndex: i
    };
    
    // 评估条件并执行动作（导入在文件顶部）
    const conditionMet = evaluateConditionsImported(rule.conditions, itemContext);
    
    if (conditionMet) {
      const actionResult = executeAction(action, itemContext, state);
      results.push({
        itemIndex: i,
        item,
        conditionMet: true,
        actionResult
      });
    } else if (item_action_on_reject) {
      // 条件不满足时的处理
      let rejectResult = { action_type: item_action_on_reject, success: true };
      
      switch (item_action_on_reject) {
        case 'ZERO_AMOUNT':
          rejectResult.message = '项目金额置零';
          rejectResult.data = { item_amount: 0 };
          break;
        case 'SKIP_ITEM':
          rejectResult.message = '跳过项目';
          rejectResult.data = { skipped: true };
          break;
        case 'FLAG_ITEM':
          rejectResult.message = '标记项目';
          rejectResult.data = { flagged: true };
          break;
      }
      
      results.push({
        itemIndex: i,
        item,
        conditionMet: false,
        actionResult: rejectResult
      });
    }
  }
  
  return results;
}
