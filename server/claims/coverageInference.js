/**
 * 统一覆盖范围推断 — 从规则集 coverage_inference 配置读取推断规则
 * 复用 conditionEvaluator 求值
 */
import { evaluateConditionGroup, evaluateLeafCondition } from "../rules/conditionEvaluator.js";

/**
 * 从 context 和 ruleset 的 coverage_inference 配置推断 coverage_code
 * @param {object} context - 案件上下文 (claim, policy 等)
 * @param {object} ruleset - 匹配的规则集
 * @param {object} [state] - 执行状态 (可能包含预设的 coverageCode)
 * @returns {string|null} 推断出的 coverage_code
 */
export function inferCoverageCode(context, ruleset, state = {}) {
  if (state.coverageCode) {
    return state.coverageCode;
  }

  const inference = ruleset?.coverage_inference;
  if (!inference?.rules?.length) {
    const firstCoverage = ruleset?.policy_info?.coverages?.[0];
    return firstCoverage?.coverage_code || inference?.default_coverage_code || null;
  }

  for (const rule of inference.rules) {
    const met = evaluateInferenceCondition(rule.condition, context);
    if (met) return rule.coverage_code;
  }

  return inference.default_coverage_code || null;
}

function evaluateInferenceCondition(condition, context) {
  if (!condition) return false;
  if (condition.logic && Array.isArray(condition.expressions)) {
    return evaluateConditionGroup(condition, context);
  }
  if (condition.field && condition.operator) {
    return evaluateLeafCondition(condition, context);
  }
  return false;
}
