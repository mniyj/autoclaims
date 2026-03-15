import { buildContext } from '../../rules/context.js';
import { ExecutionDomain, filterRulesByDomain, sortRulesByPriority } from '../../rules/runtime.js';

export function buildLiabilityInput({ claimCaseId, productCode, ocrData = {}, validationFacts = null, rulesetOverride = null }) {
  const context = buildContext({ claimCaseId, productCode, ocrData, validationFacts, rulesetOverride });
  const eligibilityRules = sortRulesByPriority(
    filterRulesByDomain(context.ruleset?.rules || [], ExecutionDomain.ELIGIBILITY)
  );

  const ruleBuckets = {
    gates: [],
    triggers: [],
    exclusions: [],
    adjustments: [],
    auxiliary: []
  };

  for (const rule of eligibilityRules) {
    const normalizedRule = {
      ...rule,
      rule_kind: rule.rule_kind || 'AUXILIARY'
    };

    switch (normalizedRule.rule_kind) {
      case 'GATE':
        ruleBuckets.gates.push(normalizedRule);
        break;
      case 'TRIGGER':
        ruleBuckets.triggers.push(normalizedRule);
        break;
      case 'EXCLUSION':
        ruleBuckets.exclusions.push(normalizedRule);
        break;
      case 'ADJUSTMENT':
        ruleBuckets.adjustments.push(normalizedRule);
        break;
      default:
        ruleBuckets.auxiliary.push(normalizedRule);
    }
  }

  return {
    context,
    facts: context.facts || {},
    rules: eligibilityRules,
    ruleBuckets
  };
}
