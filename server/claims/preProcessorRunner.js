/**
 * 配置驱动的前处理器执行器
 * 从规则集 pre_processors[] 配置读取并按顺序执行
 */
import { evaluateLeafCondition, getFieldValue } from "../rules/conditionEvaluator.js";
import { assessPreExistingCondition } from "../services/preExistingConditionAssessor.js";
import { buildContext, getRuleset } from "../rules/context.js";

/**
 * 执行规则集中定义的所有前处理器
 */
export async function runPreProcessors({ claimCaseId, productCode, ocrData, rulesetOverride }) {
  const ruleset = getRuleset(productCode, rulesetOverride);
  const processors = ruleset?.pre_processors || [];
  let enrichedData = { ...ocrData };
  const assessments = [];

  for (const proc of processors) {
    if (!proc.enabled) continue;

    // 检查 skip_when 条件
    if (proc.config?.skip_when) {
      const ctx = { ocrData: enrichedData, claim: enrichedData };
      const shouldSkip = evaluateSkipCondition(proc.config.skip_when, ctx);
      if (shouldSkip) {
        assessments.push({ processor_id: proc.processor_id, result: "SKIPPED", reason: "skip_when condition met" });
        continue;
      }
    }

    const handler = PROCESSOR_HANDLERS[proc.type];
    if (!handler) {
      assessments.push({ processor_id: proc.processor_id, result: "SKIPPED", reason: `Unknown type: ${proc.type}` });
      continue;
    }

    const result = await handler(proc, { claimCaseId, productCode, ocrData: enrichedData, rulesetOverride, ruleset });
    enrichedData = result.ocrData;
    assessments.push({ processor_id: proc.processor_id, ...result.assessment });
  }

  return { ocrData: enrichedData, assessments };
}

function evaluateSkipCondition(condition, context) {
  if (!condition || !condition.field || !condition.operator) return false;
  return evaluateLeafCondition(condition, context);
}

// --- 处理器注册表 ---

const PROCESSOR_HANDLERS = {
  PRE_EXISTING_CONDITION: handlePreExistingCondition,
  FIELD_CASCADE: handleFieldCascade,
  COVERAGE_ALIAS_RESOLVE: handleCoverageAliasResolve,
};

async function handlePreExistingCondition(proc, { claimCaseId, productCode, ocrData, rulesetOverride }) {
  const existing = ocrData[proc.config.output_field];
  if (existing === true || existing === false) {
    return {
      ocrData,
      assessment: {
        result: existing ? "YES" : "NO",
        confidence: typeof ocrData.pre_existing_condition_confidence === "number"
          ? ocrData.pre_existing_condition_confidence : null,
        reasoning: "输入已显式提供既往症结论，跳过自动评估",
        source: "INPUT",
      },
    };
  }

  try {
    const ctx = buildContext({ claimCaseId, productCode, ocrData, rulesetOverride });
    const claimContext = ctx.claim || {};
    const policyInfo = {
      effective_date: ctx.policy?.effective_date,
      waiting_period_days: ctx.policy?.waiting_period_days || 0,
    };

    const assessment = await assessPreExistingCondition(claimContext, policyInfo);
    const outputValue = assessment.result === "YES" ? proc.config.on_yes
      : assessment.result === "NO" ? proc.config.on_no
      : proc.config.on_uncertain;

    return {
      ocrData: {
        ...ocrData,
        [proc.config.output_field]: outputValue,
        pre_existing_condition_confidence: assessment.confidence,
      },
      assessment: {
        ...assessment,
        source: "AUTO",
        input: {
          diagnosis: claimContext.diagnosis || null,
          diagnosisNames: claimContext.diagnosis_names || [],
          pastMedicalHistory: claimContext.past_medical_history || null,
          firstDiagnosisDate: claimContext.first_diagnosis_date || null,
          policyEffectiveDate: policyInfo.effective_date || null,
          waitingPeriodDays: policyInfo.waiting_period_days || 0,
        },
      },
    };
  } catch (error) {
    console.error(`[preProcessorRunner] ${proc.processor_id} failed:`, error.message);
    return {
      ocrData: { ...ocrData, [proc.config.output_field]: proc.config.on_uncertain },
      assessment: { result: "UNCERTAIN", confidence: null, reasoning: `异常：${error.message}`, source: "ERROR" },
    };
  }
}

function handleFieldCascade(proc, { ocrData }) {
  const fields = proc.config.field_cascade || [];
  const context = { claim: ocrData, ocrData };
  let resolvedValue = null;

  for (const fieldPath of fields) {
    const val = getFieldValue(context, fieldPath);
    if (val !== null && val !== undefined && val !== "") {
      resolvedValue = val;
      break;
    }
  }

  if (resolvedValue === null) {
    resolvedValue = proc.config.default_value ?? null;
  }

  if (proc.config.normalize === "RATIO_0_1" && typeof resolvedValue === "number") {
    if (resolvedValue > 1) resolvedValue = Math.max(0, Math.min(resolvedValue / 100, 1));
    else resolvedValue = Math.max(0, Math.min(resolvedValue, 1));
  }

  return {
    ocrData: { ...ocrData, [proc.config.output_field]: resolvedValue },
    assessment: { result: resolvedValue !== null ? "RESOLVED" : "DEFAULT", value: resolvedValue },
  };
}

function handleCoverageAliasResolve(proc, { ocrData }) {
  const aliasMap = proc.config.alias_map || {};
  const inputField = proc.config.input_field || "claim.auto_coverage_type";
  const outputField = proc.config.output_field || "resolved_coverage_code";
  const inputValue = ocrData[inputField.split(".").pop()] || "";

  for (const [standardCode, aliases] of Object.entries(aliasMap)) {
    if (aliases.includes(inputValue) || standardCode === inputValue) {
      return {
        ocrData: { ...ocrData, [outputField]: standardCode },
        assessment: { result: "RESOLVED", from: inputValue, to: standardCode },
      };
    }
  }

  return {
    ocrData: { ...ocrData, [outputField]: inputValue },
    assessment: { result: "PASSTHROUGH", value: inputValue },
  };
}
