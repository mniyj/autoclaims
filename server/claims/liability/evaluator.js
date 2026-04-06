import { executeSingleRule } from '../../rules/runtime.js';
import { buildLiabilityInput } from './inputModel.js';

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

function getPreProcessorManagedFields(context) {
  const managedFields = new Set();
  const processors = Array.isArray(context?.ruleset?.pre_processors)
    ? context.ruleset.pre_processors
    : [];

  for (const processor of processors) {
    const outputField = processor?.config?.output_field;
    if (!outputField) continue;
    managedFields.add(`claim.${outputField}`);
    managedFields.add(`ocrData.${outputField}`);
  }

  return managedFields;
}

function findMissingFields(fields, context, nullableManagedFields = new Set()) {
  return [...fields].filter(field => {
    const parts = field.split('.');
    let current = context;
    for (const part of parts) {
      if (current === null || current === undefined) {
        return true;
      }
      current = current[part];
    }
    if (current === undefined || current === '') {
      return true;
    }
    if (current === null) {
      return !nullableManagedFields.has(field);
    }
    return false;
  });
}

function hasUnsupportedValueReference(conditions) {
  if (!conditions || typeof conditions !== 'object') {
    return false;
  }

  if (typeof conditions.value === 'string') {
    const match = conditions.value.match(/^\$\{(.+)\}$/);
    if (match) {
      return !/^[a-zA-Z0-9_.]+(\s*[+-]\s*\d+\s*d)?$/.test(match[1].trim());
    }
  }

  if (!Array.isArray(conditions.expressions)) {
    return false;
  }

  return conditions.expressions.some(expression => hasUnsupportedValueReference(expression));
}

function createInitialState() {
  return {
    claimApproved: false,
    claimRejected: false,
    needsManualReview: false,
    fraudFlagged: false,
    contractTerminated: false
  };
}

function createRejectionReason(rule, state) {
  return {
    rule_id: rule.rule_id,
    rule_name: rule.rule_name,
    reason_code: state.rejectReason || `REJECTED_BY_${rule.rule_kind || rule.category}`,
    source_text: rule.source?.source_text
  };
}

function appendManualReviewReason(reasons, warnings, { code, rule, message, fields = [] }) {
  warnings.push({
    rule_id: rule.rule_id,
    message,
    category: rule.rule_kind || rule.category
  });
  reasons.push({
    code,
    stage: 'LIABILITY',
    source: rule.rule_id,
    category: rule.rule_kind || rule.category,
    fields,
    message
  });
}

function runBucket(rules, context, state, executionResults, matchedRules, warnings, manualReviewReasons) {
  const matched = [];
  const unresolved = [];
  let rejectionReason = null;
  const nullableManagedFields = getPreProcessorManagedFields(context);

  for (const rule of rules) {
    const prevNeedsManualReview = state.needsManualReview;
    const prevManualReviewReason = state.manualReviewReason;
    const result = executeSingleRule(rule, context, state);
    executionResults.push(result);

    if (result.condition_met) {
      matched.push(rule);
      matchedRules.push(rule.rule_id);

      if (state.claimRejected || state.contractTerminated) {
        rejectionReason = createRejectionReason(rule, state);
        break;
      }

      const hasNewManualReviewReason =
        state.needsManualReview &&
        (!prevNeedsManualReview ||
          state.manualReviewReason !== prevManualReviewReason);

      if (hasNewManualReviewReason) {
        appendManualReviewReason(manualReviewReasons, warnings, {
          code: 'LIABILITY_RULE_REVIEW',
          rule,
          message: state.manualReviewReason || '需人工复核'
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

    const fields = extractConditionFields(rule.conditions);
    const missingFields = findMissingFields(fields, context, nullableManagedFields);
    const unsupportedReference = hasUnsupportedValueReference(rule.conditions);
    if (missingFields.length > 0 || unsupportedReference) {
      const message = unsupportedReference
        ? `${rule.rule_name} 包含当前引擎不支持的条件表达式`
        : `${rule.rule_name} 缺少关键字段: ${missingFields.join(', ')}`;
      unresolved.push({
        rule,
        missingFields,
        unsupportedReference,
        message
      });
      state.needsManualReview = true;
      state.manualReviewReason = message;
      appendManualReviewReason(manualReviewReasons, warnings, {
        code: unsupportedReference ? 'UNSUPPORTED_RULE_EXPRESSION' : 'MISSING_LIABILITY_FIELDS',
        rule,
        message,
        fields: missingFields
      });
    }
  }

  return {
    matched,
    unresolved,
    rejectionReason
  };
}

export function evaluateEligibility({ claimCaseId, productCode, ocrData = {}, validationFacts = null, rulesetOverride = null }) {
  const startTime = Date.now();
  const liabilityInput = buildLiabilityInput({ claimCaseId, productCode, ocrData, validationFacts, rulesetOverride });
  const { context, ruleBuckets } = liabilityInput;

  if (context?.claim?.bound_policy_insured_match === false) {
    const message = `赔案被保险人“${context.claim.bound_policy_insured_name || context.claim.insured || '未知'}”不在绑定保单 ${context.claim.bound_policy_number || context.policy?.bound_policy_number || ''} 的承保名单内`;
    return {
      eligible: false,
      matchedRules: [],
      rejectionReasons: [],
      warnings: [
        {
          rule_id: 'POLICY_BINDING_INSURED_CHECK',
          message,
          category: 'POLICY_BINDING',
        },
      ],
      needsManualReview: true,
      manualReviewReasons: [
        {
          code: 'INSURED_NOT_COVERED_BY_POLICY',
          stage: 'LIABILITY',
          source: 'POLICY_BINDING',
          category: 'POLICY_BINDING',
          fields: ['claim.bound_policy_insured_match'],
          message,
        },
      ],
      fraudFlagged: false,
      fraudRiskScore: 0,
      executionDetails: [],
      context: {
        claim_id: claimCaseId,
        product_code: context.policy?.product_code,
        product_name: context.policy?.product_name,
        ruleset_id: context.ruleset?.ruleset_id,
        product_line: context.ruleset?.product_line,
        facts: context.facts,
      },
      liabilityModel: {
        gateCount: ruleBuckets.gates.length,
        triggerCount: ruleBuckets.triggers.length,
        exclusionCount: ruleBuckets.exclusions.length,
        adjustmentCount: ruleBuckets.adjustments.length,
        matchedGates: [],
        matchedTriggers: [],
        matchedExclusions: [],
      },
      duration: Date.now() - startTime,
    };
  }

  const state = createInitialState();
  const executionResults = [];
  const matchedRules = [];
  const warnings = [];
  const manualReviewReasons = [];

  const gateResult = runBucket(
    ruleBuckets.gates,
    context,
    state,
    executionResults,
    matchedRules,
    warnings,
    manualReviewReasons
  );
  if (gateResult.rejectionReason) {
    return {
      eligible: false,
      matchedRules,
      rejectionReasons: [gateResult.rejectionReason],
      warnings,
      needsManualReview: state.needsManualReview,
      manualReviewReasons,
      fraudFlagged: state.fraudFlagged,
      fraudRiskScore: state.fraudRiskScore,
      executionDetails: executionResults,
      context: {
        claim_id: claimCaseId,
        product_code: context.policy?.product_code,
        product_name: context.policy?.product_name,
        ruleset_id: context.ruleset?.ruleset_id,
        product_line: context.ruleset?.product_line,
        facts: context.facts
      },
      duration: Date.now() - startTime
    };
  }

  const exclusionResult = runBucket(
    ruleBuckets.exclusions,
    context,
    state,
    executionResults,
    matchedRules,
    warnings,
    manualReviewReasons
  );
  if (exclusionResult.rejectionReason) {
    return {
      eligible: false,
      matchedRules,
      rejectionReasons: [exclusionResult.rejectionReason],
      warnings,
      needsManualReview: state.needsManualReview,
      manualReviewReasons,
      fraudFlagged: state.fraudFlagged,
      fraudRiskScore: state.fraudRiskScore,
      executionDetails: executionResults,
      context: {
        claim_id: claimCaseId,
        product_code: context.policy?.product_code,
        product_name: context.policy?.product_name,
        ruleset_id: context.ruleset?.ruleset_id,
        product_line: context.ruleset?.product_line,
        facts: context.facts
      },
      duration: Date.now() - startTime
    };
  }

  const triggerResult = runBucket(
    ruleBuckets.triggers,
    context,
    state,
    executionResults,
    matchedRules,
    warnings,
    manualReviewReasons
  );

  runBucket(
    ruleBuckets.adjustments,
    context,
    state,
    executionResults,
    matchedRules,
    warnings,
    manualReviewReasons
  );

  const hasTriggerRules = ruleBuckets.triggers.length > 0;
  const hasMatchedTrigger = triggerResult.matched.length > 0;
  const hasUnresolvedTrigger = triggerResult.unresolved.length > 0;
  const hasUnresolvedGate = gateResult.unresolved.length > 0;

  let eligible = false;
  let rejectionReason = null;

  if (state.claimRejected || state.contractTerminated) {
    eligible = false;
    rejectionReason = createRejectionReason(
      triggerResult.matched[triggerResult.matched.length - 1] ||
        exclusionResult.matched[exclusionResult.matched.length - 1] ||
        gateResult.matched[gateResult.matched.length - 1] || {
          rule_id: 'SYSTEM',
          rule_name: '系统规则',
          category: 'SYSTEM',
          source: {}
        },
      state
    );
  } else if (hasUnresolvedGate || (hasUnresolvedTrigger && !hasMatchedTrigger)) {
    eligible = false;
  } else if (hasTriggerRules) {
    eligible = hasMatchedTrigger;
    if (!eligible) {
      rejectionReason = {
        rule_id: 'SYSTEM',
        rule_name: '责任触发校验',
        reason_code: 'NO_LIABILITY_TRIGGER_MATCHED',
        source_text: '未命中任何责任触发规则'
      };
    }
  } else {
    eligible = true;
  }

  return {
    eligible,
    matchedRules,
    rejectionReasons: rejectionReason ? [rejectionReason] : [],
    warnings,
    needsManualReview: state.needsManualReview,
    manualReviewReasons,
    fraudFlagged: state.fraudFlagged,
    fraudRiskScore: state.fraudRiskScore,
    executionDetails: executionResults,
    context: {
      claim_id: claimCaseId,
      product_code: context.policy?.product_code,
      product_name: context.policy?.product_name,
      ruleset_id: context.ruleset?.ruleset_id,
      product_line: context.ruleset?.product_line,
      facts: context.facts
    },
    liabilityModel: {
      gateCount: ruleBuckets.gates.length,
      triggerCount: ruleBuckets.triggers.length,
      exclusionCount: ruleBuckets.exclusions.length,
      adjustmentCount: ruleBuckets.adjustments.length,
      matchedGates: gateResult.matched.map(rule => rule.rule_id),
      matchedTriggers: triggerResult.matched.map(rule => rule.rule_id),
      matchedExclusions: exclusionResult.matched.map(rule => rule.rule_id)
    },
    duration: Date.now() - startTime
  };
}
