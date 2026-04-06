import { evaluateConditions } from "./conditionEvaluator.js";
import { executeAction, executeItemLoopAction } from "./actionExecutor.js";

export const ExecutionDomain = {
  ELIGIBILITY: "ELIGIBILITY",
  ASSESSMENT: "ASSESSMENT",
  POST_PROCESS: "POST_PROCESS",
};

export function sortRulesByPriority(rules) {
  return [...rules].sort((a, b) => {
    const levelDiff = (a.priority?.level || 4) - (b.priority?.level || 4);
    if (levelDiff !== 0) return levelDiff;
    return (a.priority?.rank || 0) - (b.priority?.rank || 0);
  });
}

export function filterRulesByDomain(rules, domain) {
  return rules.filter(
    (rule) => rule.execution?.domain === domain && rule.status === "EFFECTIVE",
  );
}

export function executeSingleRule(rule, context, state) {
  const result = {
    rule_id: rule.rule_id,
    rule_name: rule.rule_name,
    category: rule.category,
    executed: false,
    condition_met: false,
    action_result: null,
    item_results: [],
    source: rule.source,
  };

  const isLoopRule = rule.execution?.loop_over != null;

  if (isLoopRule) {
    result.item_results = executeItemLoopAction(rule, context, state);
    result.executed = true;
    result.condition_met = result.item_results.some(
      (item) => item.conditionMet,
    );
    return result;
  }

  const conditionMet = evaluateConditions(rule.conditions, context);
  result.condition_met = conditionMet;

  if (conditionMet) {
    result.action_result = executeAction(rule.action, context, state);
    result.executed = true;
  }

  return result;
}
