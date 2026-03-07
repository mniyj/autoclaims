import { buildContext } from '../../rules/context.js';
import { ExecutionDomain, sortRulesByPriority, filterRulesByDomain, executeSingleRule } from '../../rules/runtime.js';

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

export function evaluateEligibility({ claimCaseId, productCode, ocrData = {} }) {
  const startTime = Date.now();
  const context = buildContext({ claimCaseId, productCode, ocrData });
  const rules = context.ruleset.rules;
  const eligibilityRules = sortRulesByPriority(
    filterRulesByDomain(rules, ExecutionDomain.ELIGIBILITY)
  );

  const state = {
    claimApproved: false,
    claimRejected: false,
    needsManualReview: false,
    fraudFlagged: false
  };

  const executionResults = [];
  const matchedRules = [];
  const warnings = [];
  let rejectionReason = null;
  let positiveRuleMatched = false;
  let unresolvedPositiveRule = false;

  for (const rule of eligibilityRules) {
    const result = executeSingleRule(rule, context, state);
    executionResults.push(result);

    if (result.condition_met) {
      matchedRules.push(rule.rule_id);
      if (REQUIRED_POSITIVE_CATEGORIES.has(rule.category)) {
        positiveRuleMatched = true;
      }

      if (state.claimRejected) {
        rejectionReason = {
          rule_id: rule.rule_id,
          rule_name: rule.rule_name,
          reason_code: state.rejectReason,
          source_text: rule.source?.source_text
        };
        break;
      }

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

      continue;
    }

    if (REQUIRED_POSITIVE_CATEGORIES.has(rule.category) && rule.action?.action_type === 'APPROVE_CLAIM') {
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

  const hasRequiredPositiveRules = eligibilityRules.some(rule => REQUIRED_POSITIVE_CATEGORIES.has(rule.category));
  const eligible = !state.claimRejected && (positiveRuleMatched || !hasRequiredPositiveRules) && !unresolvedPositiveRule;

  return {
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
      ruleset_id: context.ruleset?.ruleset_id,
      product_line: context.ruleset?.product_line
    },
    duration: Date.now() - startTime
  };
}
