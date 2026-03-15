function inferRuleKind(rule = {}) {
  if (rule.rule_kind) return rule.rule_kind;

  const domain = rule.execution?.domain;
  const category = String(rule.category || '').toUpperCase();
  const actionType = rule.action?.action_type;

  if (domain === 'POST_PROCESS') {
    return 'POST_PROCESS';
  }

  if (domain === 'ASSESSMENT') {
    if (actionType === 'REJECT_ITEM' || actionType === 'APPROVE_ITEM') return 'ITEM_ELIGIBILITY';
    if (actionType === 'SET_ITEM_RATIO') return 'ITEM_RATIO';
    if (actionType === 'ADJUST_ITEM_AMOUNT') return 'ITEM_PRICING';
    if (actionType === 'APPLY_CAP' || actionType === 'APPLY_DEDUCTIBLE') return 'ITEM_CAP';
    return 'ITEM_FLAG';
  }

  if (actionType === 'REJECT_CLAIM' || actionType === 'TERMINATE_CONTRACT' || category.includes('EXCLUSION')) {
    return 'EXCLUSION';
  }
  if (actionType === 'SET_CLAIM_RATIO' || actionType === 'FLAG_FRAUD' || category.includes('PAYOUT') || category.includes('PROPORTIONAL')) {
    return 'ADJUSTMENT';
  }
  if (
    category.includes('WAITING') ||
    category.includes('COVERAGE_PERIOD') ||
    category.includes('POLICY_STATUS') ||
    category.includes('CLAIM_TIMELINE') ||
    category === 'E_POLICY_STATUS'
  ) {
    return 'GATE';
  }
  return 'TRIGGER';
}

function normalizeRule(rule) {
  return {
    ...rule,
    rule_kind: inferRuleKind(rule),
  };
}

function normalizePipeline(executionPipeline = {}) {
  const domains = Array.isArray(executionPipeline.domains) ? executionPipeline.domains : [];
  return {
    ...executionPipeline,
    domains: domains.map((domain) => {
      if (Array.isArray(domain.semantic_sequence) && domain.semantic_sequence.length > 0) {
        return domain;
      }
      if (domain.domain === 'ELIGIBILITY') {
        return { ...domain, semantic_sequence: ['GATE', 'TRIGGER', 'EXCLUSION', 'ADJUSTMENT'] };
      }
      if (domain.domain === 'ASSESSMENT') {
        return { ...domain, semantic_sequence: ['ITEM_ELIGIBILITY', 'ITEM_RATIO', 'ITEM_PRICING', 'ITEM_CAP', 'ITEM_FLAG'] };
      }
      return { ...domain, semantic_sequence: ['POST_PROCESS'] };
    }),
  };
}

export function normalizeRuleset(ruleset = {}) {
  return {
    ...ruleset,
    execution_pipeline: normalizePipeline(ruleset.execution_pipeline),
    rules: Array.isArray(ruleset.rules) ? ruleset.rules.map(normalizeRule) : [],
  };
}

export function normalizeRulesetPayload(payload) {
  if (Array.isArray(payload)) {
    return payload.map((ruleset) => normalizeRuleset(ruleset));
  }
  return normalizeRuleset(payload);
}

export function validateRulesetPayload(payload) {
  const rulesets = Array.isArray(payload) ? payload : [payload];
  const errors = [];

  rulesets.forEach((ruleset, rulesetIndex) => {
    if (!ruleset || typeof ruleset !== 'object') {
      errors.push(`rulesets[${rulesetIndex}] 不是有效对象`);
      return;
    }
    if (!ruleset.ruleset_id) {
      errors.push(`rulesets[${rulesetIndex}] 缺少 ruleset_id`);
    }
    if (!ruleset.policy_info?.product_code) {
      errors.push(`rulesets[${rulesetIndex}] 缺少 policy_info.product_code`);
    }
    if (!Array.isArray(ruleset.rules)) {
      errors.push(`rulesets[${rulesetIndex}] rules 必须是数组`);
      return;
    }

    ruleset.rules.forEach((rule, ruleIndex) => {
      if (!rule.rule_id) {
        errors.push(`rulesets[${rulesetIndex}].rules[${ruleIndex}] 缺少 rule_id`);
      }
      if (!rule.execution?.domain) {
        errors.push(`rulesets[${rulesetIndex}].rules[${ruleIndex}] 缺少 execution.domain`);
      }
      if (!rule.action?.action_type) {
        errors.push(`rulesets[${rulesetIndex}].rules[${ruleIndex}] 缺少 action.action_type`);
      }
      if (!rule.rule_kind) {
        errors.push(`rulesets[${rulesetIndex}].rules[${ruleIndex}] 缺少 rule_kind`);
      }
    });
  });

  return errors;
}
