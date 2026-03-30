# Ruleset Data-Driven Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace three layers of hardcoded insurance-type logic with declarative JSON config in rulesets, plus frontend editing UI.

**Architecture:** Extend each ruleset object with `binding`, `coverage_inference`, and `pre_processors` fields. New backend modules (`coverageInference.js`, `preProcessorRunner.js`) consume these configs. Three new frontend Tab components provide editing UI.

**Tech Stack:** Node.js (ES modules), React 19 + TypeScript, Tailwind CSS, existing `conditionEvaluator.js` for condition evaluation.

**Design doc:** `.claude/plans/2026-03-30-ruleset-data-driven-refactor-design.md`

---

## Task 1: Migration Script — Inject New Schema into Rulesets JSON

**Files:**
- Create: `server/migrations/003-ruleset-data-driven.js`
- Modify: `jsonlist/rulesets.json`

**Step 1: Write migration script**

Create `server/migrations/003-ruleset-data-driven.js`. This script reads `jsonlist/rulesets.json`, injects `binding`, `coverage_inference`, and `pre_processors` into each of the 6 rulesets based on their `product_line`, then writes back.

```javascript
/**
 * Migration 003: Inject binding, coverage_inference, pre_processors
 * into each ruleset based on product_line.
 *
 * Run: node server/migrations/003-ruleset-data-driven.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULESETS_PATH = path.resolve(__dirname, "../../jsonlist/rulesets.json");

const ACCIDENT_BINDING = {
  product_codes: [],  // will be filled per-ruleset from policy_info.product_code
  category_match: { primary: ["意外险"], secondary: [] },
  keywords: ["意外", "身故", "伤残"],
  match_priority: 10,
};

const ACCIDENT_COVERAGE_INFERENCE = {
  rules: [
    {
      coverage_code: "ACC_DEATH",
      label: "意外身故",
      condition: { field: "claim.death_confirmed", operator: "IS_TRUE" },
    },
    {
      coverage_code: "ACC_DISABILITY",
      label: "意外伤残",
      condition: { field: "claim.disability_grade", operator: "GT", value: 0 },
    },
    {
      coverage_code: "ACC_HOSPITAL_ALLOWANCE",
      label: "住院津贴",
      condition: {
        logic: "AND",
        expressions: [
          { field: "claim.hospital_days", operator: "GT", value: 0 },
          { field: "claim.expense_items.length", operator: "EQ", value: 0 },
        ],
      },
    },
  ],
  default_coverage_code: "ACC_MEDICAL",
  default_label: "意外医疗",
};

const HEALTH_BINDING = {
  product_codes: [],
  category_match: { primary: ["健康险", "医疗险"], secondary: [] },
  keywords: ["健康", "医疗", "住院", "重疾"],
  match_priority: 10,
};

const HEALTH_COVERAGE_INFERENCE = {
  rules: [],
  default_coverage_code: "HLT_INPATIENT",
  default_label: "住院医疗",
};

const HEALTH_PRE_PROCESSORS = [
  {
    processor_id: "pre_existing_condition",
    type: "PRE_EXISTING_CONDITION",
    label: "既往症自动评估",
    enabled: true,
    config: {
      skip_when: { field: "ocrData.pre_existing_condition", operator: "IS_NOT_NULL" },
      output_field: "pre_existing_condition",
      on_yes: true,
      on_no: false,
      on_uncertain: null,
    },
  },
];

const AUTO_BINDING = {
  product_codes: [],
  category_match: { primary: ["车险"], secondary: [] },
  keywords: ["车", "汽车", "机动车"],
  match_priority: 10,
};

const AUTO_COVERAGE_INFERENCE = {
  rules: [
    {
      coverage_code: "AUTO_COMPULSORY",
      label: "交强险",
      condition: {
        field: "claim.auto_coverage_type",
        operator: "IN",
        value: ["AUTO_COMPULSORY", "COMPULSORY", "交强险", "CTPL", "JQX"],
      },
    },
    {
      coverage_code: "AUTO_THIRD_PARTY",
      label: "第三者责任险",
      condition: {
        logic: "OR",
        expressions: [
          {
            field: "claim.auto_coverage_type",
            operator: "IN",
            value: ["AUTO_THIRD_PARTY", "THIRD_PARTY", "第三者责任险", "第三者责任保险", "TPL"],
          },
          { field: "claim.third_party_loss_amount", operator: "GT", value: 0 },
        ],
      },
    },
    {
      coverage_code: "AUTO_DRIVER_PASSENGER",
      label: "车上人员责任险",
      condition: {
        logic: "OR",
        expressions: [
          {
            field: "claim.auto_coverage_type",
            operator: "IN",
            value: ["AUTO_DRIVER_PASSENGER", "DRIVER_PASSENGER", "车上人员责任险", "驾乘人员责任险", "SEAT", "DRIVER"],
          },
          { field: "claim.passenger_injury_amount", operator: "GT", value: 0 },
          { field: "claim.injury_grade", operator: "IS_NOT_NULL" },
        ],
      },
    },
  ],
  default_coverage_code: "AUTO_VEHICLE_DAMAGE",
  default_label: "车辆损失险",
};

const AUTO_PRE_PROCESSORS = [
  {
    processor_id: "fault_ratio",
    type: "FIELD_CASCADE",
    label: "故障比例解析",
    enabled: true,
    config: {
      output_field: "fault_ratio",
      field_cascade: [
        "claim.fault_ratio",
        "claim.faultRatio",
        "claim.insured_liability_ratio",
        "claim.insuredLiabilityRatio",
        "claim.third_party_liability_ratio",
        "claim.thirdPartyLiabilityRatio",
      ],
      normalize: "RATIO_0_1",
      default_value: 1.0,
    },
  },
];

const LIABILITY_BINDING = {
  product_codes: [],
  category_match: { primary: ["责任险"], secondary: [] },
  keywords: ["责任", "雇主", "第三者", "工程机械"],
  match_priority: 10,
};

const LIABILITY_COVERAGE_INFERENCE = {
  rules: [],
  default_coverage_code: null,
  default_label: null,
};

function getTemplates(productLine) {
  switch (productLine) {
    case "ACCIDENT":
      return {
        binding: ACCIDENT_BINDING,
        coverage_inference: ACCIDENT_COVERAGE_INFERENCE,
        pre_processors: [],
      };
    case "HEALTH":
      return {
        binding: HEALTH_BINDING,
        coverage_inference: HEALTH_COVERAGE_INFERENCE,
        pre_processors: HEALTH_PRE_PROCESSORS,
      };
    case "AUTO":
      return {
        binding: AUTO_BINDING,
        coverage_inference: AUTO_COVERAGE_INFERENCE,
        pre_processors: AUTO_PRE_PROCESSORS,
      };
    case "LIABILITY":
      return {
        binding: LIABILITY_BINDING,
        coverage_inference: LIABILITY_COVERAGE_INFERENCE,
        pre_processors: [],
      };
    default:
      return {
        binding: { product_codes: [], category_match: { primary: [], secondary: [] }, keywords: [], match_priority: 99 },
        coverage_inference: { rules: [], default_coverage_code: null, default_label: null },
        pre_processors: [],
      };
  }
}

function migrate() {
  const raw = fs.readFileSync(RULESETS_PATH, "utf-8");
  const rulesets = JSON.parse(raw);

  const migrated = rulesets.map((rs) => {
    const templates = getTemplates(rs.product_line);
    const productCode = rs.policy_info?.product_code;
    const binding = {
      ...templates.binding,
      product_codes: productCode
        ? [...new Set([...templates.binding.product_codes, productCode])]
        : templates.binding.product_codes,
    };
    return {
      ...rs,
      binding,
      coverage_inference: templates.coverage_inference,
      pre_processors: templates.pre_processors,
    };
  });

  fs.writeFileSync(RULESETS_PATH, JSON.stringify(migrated, null, 2) + "\n", "utf-8");
  console.log(`Migrated ${migrated.length} rulesets.`);

  // Verify: each ruleset has the three new fields
  for (const rs of migrated) {
    if (!rs.binding) throw new Error(`Missing binding in ${rs.ruleset_id}`);
    if (!rs.coverage_inference) throw new Error(`Missing coverage_inference in ${rs.ruleset_id}`);
    if (!Array.isArray(rs.pre_processors)) throw new Error(`Missing pre_processors in ${rs.ruleset_id}`);
    console.log(`  [OK] ${rs.ruleset_id} (${rs.product_line}): binding.product_codes=${JSON.stringify(rs.binding.product_codes)}, inference_rules=${rs.coverage_inference.rules.length}, pre_processors=${rs.pre_processors.length}`);
  }
}

migrate();
```

**Step 2: Run migration**

Run: `node server/migrations/003-ruleset-data-driven.js`
Expected: `Migrated 6 rulesets.` with `[OK]` for each.

**Step 3: Verify rulesets.json has new fields**

Spot-check: `head -80 jsonlist/rulesets.json` should show `binding`, `coverage_inference` on the first ruleset.

**Step 4: Add TypeScript types for new fields**

Modify: `types.ts:1308-1318` — extend `InsuranceRuleset` interface.

Add before `InsuranceRuleset`:

```typescript
export interface RulesetBinding {
  product_codes: string[];
  category_match: {
    primary: string[];
    secondary: string[];
  };
  keywords: string[];
  match_priority: number;
}

export interface CoverageInferenceRule {
  coverage_code: string;
  label: string;
  condition: RuleConditions;
}

export interface CoverageInference {
  rules: CoverageInferenceRule[];
  default_coverage_code: string | null;
  default_label: string | null;
}

export type PreProcessorType = 'PRE_EXISTING_CONDITION' | 'FIELD_CASCADE' | 'COVERAGE_ALIAS_RESOLVE';

export interface PreProcessorConfig {
  processor_id: string;
  type: PreProcessorType;
  label: string;
  enabled: boolean;
  config: Record<string, unknown>;
}
```

Then add three optional fields to `InsuranceRuleset`:

```typescript
export interface InsuranceRuleset {
  ruleset_id: string;
  product_line: RulesetProductLine;
  policy_info: RulesetPolicyInfo;
  rules: RulesetRule[];
  execution_pipeline: ExecutionPipeline;
  override_chains: OverrideChain[];
  field_dictionary: Record<string, FieldDefinition>;
  field_mappings?: FactMappingDefinition[];
  metadata: RulesetMetadata;
  binding?: RulesetBinding;
  coverage_inference?: CoverageInference;
  pre_processors?: PreProcessorConfig[];
}
```

**Step 5: Commit**

```bash
git add server/migrations/003-ruleset-data-driven.js jsonlist/rulesets.json types.ts
git commit -m "feat: add binding/inference/preprocessor schema to rulesets"
```

---

## Task 2: Replace getRuleset Regex with Binding-Based Matching

**Files:**
- Modify: `server/rules/context.js:440-482`

**Step 1: Rewrite getRuleset**

Replace lines 440-482 in `server/rules/context.js`. The new implementation reads `binding` from each ruleset:

```javascript
export function getRuleset(productCode, rulesetOverride = null) {
  if (rulesetOverride) {
    return rulesetOverride;
  }
  const rulesets = readData("rulesets");

  // Round 1: exact product_code match via binding.product_codes
  const exactMatches = rulesets.filter(
    (r) => Array.isArray(r.binding?.product_codes) && r.binding.product_codes.includes(productCode),
  );
  if (exactMatches.length >= 1) {
    return pickByMatchPriority(exactMatches);
  }

  // Round 2: category_match
  const product = productCode ? getProduct(productCode) : null;
  if (product) {
    const categoryText = [
      product.primaryCategory,
      product.secondaryCategory,
    ].filter(Boolean);

    const categoryMatches = rulesets.filter((r) => {
      const cm = r.binding?.category_match;
      if (!cm) return false;
      const primaryHit = (cm.primary || []).some((kw) => categoryText.some((t) => t.includes(kw)));
      const secondaryHit = (cm.secondary || []).length === 0 || (cm.secondary || []).some((kw) => categoryText.some((t) => t.includes(kw)));
      return primaryHit && secondaryHit;
    });
    if (categoryMatches.length >= 1) {
      return pickByMatchPriority(categoryMatches);
    }

    // Round 3: keyword match
    const fullText = [
      product.primaryCategory,
      product.secondaryCategory,
      product.racewayName,
      product.marketingName,
      product.regulatoryName,
    ].filter(Boolean).join(" ");

    const keywordMatches = rulesets.filter((r) => {
      const keywords = r.binding?.keywords || [];
      return keywords.some((kw) => fullText.includes(kw));
    });
    if (keywordMatches.length >= 1) {
      return pickByMatchPriority(keywordMatches);
    }
  }

  return null;
}

function pickByMatchPriority(matches) {
  if (matches.length === 1) return matches[0];
  return [...matches].sort(
    (a, b) => (a.binding?.match_priority || 99) - (b.binding?.match_priority || 99),
  )[0];
}
```

**Step 2: Verify server starts**

Run: `cd /Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔 && node -e "import('./server/rules/context.js').then(m => { const rs = m.getRuleset('ZA-002'); console.log(rs?.ruleset_id || 'null'); })"`
Expected: `RS-ACCIDENT-001`

**Step 3: Commit**

```bash
git add server/rules/context.js
git commit -m "refactor: replace getRuleset regex with binding-based matching"
```

---

## Task 3: Unify Coverage Inference from Ruleset Config

**Files:**
- Create: `server/claims/coverageInference.js`
- Modify: `server/claims/settlement/calculator.js:59-82`
- Modify: `server/claims/accident/engine.js` (delete `inferAccidentCoverageCode`)
- Modify: `server/claims/auto/engine.js` (delete `inferAutoCoverageCode`, `AUTO_COVERAGE_ALIASES`, `AUTO_INJURY_GRADE_RATIO`, `getAutoFaultRatio`)
- Modify: `server/claims/medical/engine.js` (delete `inferMedicalCoverageCode`)

**Step 1: Create coverageInference.js**

```javascript
/**
 * Unified coverage inference — reads coverage_inference config from ruleset
 * and evaluates conditions using the existing conditionEvaluator.
 */
import { evaluateConditionGroup, evaluateLeafCondition } from "../rules/conditionEvaluator.js";

/**
 * Infer coverage_code from context using ruleset's coverage_inference config.
 * @param {object} context - claim context (claim, policy, etc.)
 * @param {object} ruleset - the matched ruleset
 * @param {object} [state] - execution state (may contain pre-set coverageCode)
 * @returns {string|null} inferred coverage_code
 */
export function inferCoverageCode(context, ruleset, state = {}) {
  if (state.coverageCode) {
    return state.coverageCode;
  }

  const inference = ruleset?.coverage_inference;
  if (!inference?.rules?.length) {
    // No inference rules — fall back to first coverage in policy_info
    const firstCoverage = ruleset?.policy_info?.coverages?.[0];
    return firstCoverage?.coverage_code || inference?.default_coverage_code || null;
  }

  for (const rule of inference.rules) {
    const condition = rule.condition;
    const met = evaluateInferenceCondition(condition, context);
    if (met) return rule.coverage_code;
  }

  return inference.default_coverage_code || null;
}

function evaluateInferenceCondition(condition, context) {
  if (!condition) return false;
  // Group condition (has logic + expressions)
  if (condition.logic && Array.isArray(condition.expressions)) {
    return evaluateConditionGroup(condition, context);
  }
  // Leaf condition (has field + operator)
  if (condition.field && condition.operator) {
    return evaluateLeafCondition(condition, context);
  }
  return false;
}
```

**Step 2: Update calculator.js — replace getCoverageConfigByClaimType**

Replace `getCoverageConfigByClaimType` (lines 65-82) and `inferClaimType` (lines 59-63) with a unified lookup:

```javascript
import { getCoverageConfig } from "../../rules/context.js";

// Delete: inferClaimType, getCoverageConfigByClaimType
// Replace all calls to getCoverageConfigByClaimType(productCode, claimType, coverageCode, rulesetOverride)
// with: getCoverageConfig(productCode, coverageCode, rulesetOverride)
```

Find all call sites of `getCoverageConfigByClaimType` within `calculator.js` and replace with `getCoverageConfig`. Also find all call sites of `inferClaimType` and replace with direct `context.ruleset?.product_line` access.

Remove imports of `getAccidentCoverageConfig`, `getMedicalCoverageConfig`, `getAutoCoverageConfig`, `isMedicalCoverageCode`, `isAutoCoverageCode` from the top of `calculator.js`.

**Step 3: Remove inference functions from engine files**

In `server/claims/accident/engine.js`:
- Delete `inferAccidentCoverageCode` function (lines 10-29)
- Delete `ACCIDENT_COVERAGE_CODES` constant (lines 3-8) — but only if no other file imports it; check first with grep
- Keep `getAccidentCoverageConfig` and `isAccidentCoverageCode` if still imported elsewhere

In `server/claims/auto/engine.js`:
- Delete `inferAutoCoverageCode` function (lines 31-77)
- Delete `AUTO_COVERAGE_ALIASES` (lines 10-15)
- Delete `AUTO_INJURY_GRADE_RATIO` (lines 17-21)
- Delete `getAutoFaultRatio` function (lines 79-92)
- Keep `getAutoCoverageConfig` and `isAutoCoverageCode` if still imported

In `server/claims/medical/engine.js`:
- Delete `inferMedicalCoverageCode` function (line 9-11)
- Keep `getMedicalCoverageConfig` and `isMedicalCoverageCode` if still imported

**Before deleting anything**, grep for all imports of the functions to be deleted:
```bash
grep -r "inferAccidentCoverageCode\|inferAutoCoverageCode\|inferMedicalCoverageCode\|getAutoFaultRatio\|AUTO_COVERAGE_ALIASES\|AUTO_INJURY_GRADE_RATIO" server/ --include="*.js"
```
Update or remove each import site.

**Step 4: Update all callers to use inferCoverageCode**

Find all files that call the old inference functions and replace with:
```javascript
import { inferCoverageCode } from "../claims/coverageInference.js";
// ...
const coverageCode = inferCoverageCode(context, ruleset, state);
```

**Step 5: Verify server starts**

Run: `node -e "import('./server/claims/coverageInference.js').then(m => console.log(typeof m.inferCoverageCode))"`
Expected: `function`

**Step 6: Commit**

```bash
git add server/claims/coverageInference.js server/claims/settlement/calculator.js server/claims/accident/engine.js server/claims/auto/engine.js server/claims/medical/engine.js
git commit -m "refactor: unify coverage inference from ruleset config"
```

---

## Task 4: Replace Hardcoded Pre-Processors with Config-Driven Runner

**Files:**
- Create: `server/claims/preProcessorRunner.js`
- Modify: `server/rules/engine.js:202-393` (delete `enrichPreExistingFact`)
- Modify: `server/rules/engine.js:400-437` (update `checkEligibility`)

**Step 1: Create preProcessorRunner.js**

```javascript
/**
 * Config-driven pre-processor runner.
 * Reads pre_processors[] from ruleset and executes each in order.
 */
import { evaluateLeafCondition, getFieldValue } from "../rules/conditionEvaluator.js";
import { assessPreExistingCondition } from "../services/preExistingConditionAssessor.js";
import { buildContext, getRuleset } from "../rules/context.js";

/**
 * Execute all pre-processors defined in the ruleset.
 * @param {object} params
 * @param {string} params.claimCaseId
 * @param {string} params.productCode
 * @param {object} params.ocrData
 * @param {object|null} params.rulesetOverride
 * @returns {Promise<{ocrData: object, assessments: object[]}>}
 */
export async function runPreProcessors({ claimCaseId, productCode, ocrData, rulesetOverride }) {
  const ruleset = getRuleset(productCode, rulesetOverride);
  const processors = ruleset?.pre_processors || [];
  let enrichedData = { ...ocrData };
  const assessments = [];

  for (const proc of processors) {
    if (!proc.enabled) continue;

    // Check skip_when condition
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
      assessments.push({ processor_id: proc.processor_id, result: "SKIPPED", reason: `Unknown processor type: ${proc.type}` });
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

// --- Handler registry ---

const PROCESSOR_HANDLERS = {
  PRE_EXISTING_CONDITION: handlePreExistingCondition,
  FIELD_CASCADE: handleFieldCascade,
  COVERAGE_ALIAS_RESOLVE: handleCoverageAliasResolve,
};

async function handlePreExistingCondition(proc, { claimCaseId, productCode, ocrData, rulesetOverride, ruleset }) {
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
      assessment: { ...assessment, source: "AUTO" },
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

  // Normalize
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
```

**Step 2: Update engine.js checkEligibility**

In `server/rules/engine.js`:

1. Delete the entire `enrichPreExistingFact` function (lines 202-393).
2. Remove the import of `assessPreExistingCondition` (line 15).
3. Add import: `import { runPreProcessors } from "../claims/preProcessorRunner.js";`
4. Update `checkEligibility` (lines 400-437) to call `runPreProcessors` instead of `enrichPreExistingFact`:

```javascript
export async function checkEligibility({
  claimCaseId,
  productCode,
  ocrData = {},
  validationFacts = null,
  rulesetOverride = null,
}) {
  // Run config-driven pre-processors (replaces enrichPreExistingFact)
  const { ocrData: enrichedOcrData, assessments } = await runPreProcessors({
    claimCaseId,
    productCode,
    ocrData,
    rulesetOverride,
  });

  const result = evaluateEligibility({
    claimCaseId,
    productCode,
    ocrData: enrichedOcrData,
    validationFacts,
    rulesetOverride,
  });

  logRuleExecution({
    rulesetId: result.context?.ruleset_id,
    claimCaseId,
    productCode,
    input: { ocrData, validationFacts, rulesetOverride },
    output: result,
    duration: result.duration,
    success: true,
  });

  // Find pre-existing assessment from assessments array (backward compat for result shape)
  const preExistingAssessment = assessments.find(
    (a) => a.processor_id === "pre_existing_condition"
  ) || { result: "SKIPPED" };

  return {
    ...result,
    preExistingAssessment,
    preProcessorResults: assessments,
  };
}
```

**Step 3: Verify server starts**

Run: `node -e "import('./server/rules/engine.js').then(m => console.log(typeof m.checkEligibility))"`
Expected: `function`

**Step 4: Commit**

```bash
git add server/claims/preProcessorRunner.js server/rules/engine.js
git commit -m "refactor: replace hardcoded pre-processors with config-driven runner"
```

---

## Task 5: Frontend — BindingConfigTab

**Files:**
- Create: `components/ruleset/BindingConfigTab.tsx`
- Modify: `components/ruleset/RulesetDetailView.tsx:27-36` (add tab)

**Step 1: Create BindingConfigTab.tsx**

```tsx
import React, { useState } from "react";
import { type InsuranceRuleset, type RulesetBinding } from "../../types";

interface BindingConfigTabProps {
  ruleset: InsuranceRuleset;
  onUpdateRuleset: (updated: InsuranceRuleset) => void;
}

const emptyBinding: RulesetBinding = {
  product_codes: [],
  category_match: { primary: [], secondary: [] },
  keywords: [],
  match_priority: 10,
};

const BindingConfigTab: React.FC<BindingConfigTabProps> = ({ ruleset, onUpdateRuleset }) => {
  const binding = ruleset.binding || emptyBinding;
  const [newProductCode, setNewProductCode] = useState("");
  const [newPrimary, setNewPrimary] = useState("");
  const [newSecondary, setNewSecondary] = useState("");
  const [newKeyword, setNewKeyword] = useState("");

  const updateBinding = (patch: Partial<RulesetBinding>) => {
    onUpdateRuleset({ ...ruleset, binding: { ...binding, ...patch } });
  };

  const addTag = (field: "product_codes" | "keywords", value: string) => {
    if (!value.trim()) return;
    const current = binding[field] || [];
    if (current.includes(value.trim())) return;
    updateBinding({ [field]: [...current, value.trim()] });
  };

  const removeTag = (field: "product_codes" | "keywords", value: string) => {
    updateBinding({ [field]: (binding[field] || []).filter((v) => v !== value) });
  };

  const addCategoryTag = (level: "primary" | "secondary", value: string) => {
    if (!value.trim()) return;
    const cm = binding.category_match || { primary: [], secondary: [] };
    if (cm[level].includes(value.trim())) return;
    updateBinding({ category_match: { ...cm, [level]: [...cm[level], value.trim()] } });
  };

  const removeCategoryTag = (level: "primary" | "secondary", value: string) => {
    const cm = binding.category_match || { primary: [], secondary: [] };
    updateBinding({ category_match: { ...cm, [level]: cm[level].filter((v) => v !== value) } });
  };

  return (
    <div className="space-y-6">
      {/* Section: Exact product binding */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">精确绑定产品</h2>
        <p className="mt-1 text-sm text-gray-500">优先级最高，产品代码完全匹配时直接使用此规则集。</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(binding.product_codes || []).map((code) => (
            <span key={code} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
              {code}
              <button onClick={() => removeTag("product_codes", code)} className="ml-1 text-indigo-400 hover:text-indigo-600">&times;</button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newProductCode}
            onChange={(e) => setNewProductCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { addTag("product_codes", newProductCode); setNewProductCode(""); } }}
            placeholder="输入产品代码，回车添加"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={() => { addTag("product_codes", newProductCode); setNewProductCode(""); }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            添加
          </button>
        </div>
      </section>

      {/* Section: Category match */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">分类匹配</h2>
        <p className="mt-1 text-sm text-gray-500">精确绑定未命中时，按产品分类匹配。</p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">一级分类</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(binding.category_match?.primary || []).map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                  {tag}
                  <button onClick={() => removeCategoryTag("primary", tag)} className="ml-1 text-blue-400 hover:text-blue-600">&times;</button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={newPrimary}
                onChange={(e) => setNewPrimary(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { addCategoryTag("primary", newPrimary); setNewPrimary(""); } }}
                placeholder="输入一级分类，回车添加"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <button onClick={() => { addCategoryTag("primary", newPrimary); setNewPrimary(""); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">添加</button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">二级分类</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(binding.category_match?.secondary || []).map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                  {tag}
                  <button onClick={() => removeCategoryTag("secondary", tag)} className="ml-1 text-green-400 hover:text-green-600">&times;</button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={newSecondary}
                onChange={(e) => setNewSecondary(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { addCategoryTag("secondary", newSecondary); setNewSecondary(""); } }}
                placeholder="输入二级分类，回车添加"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <button onClick={() => { addCategoryTag("secondary", newSecondary); setNewSecondary(""); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">添加</button>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Keyword match */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">关键词匹配</h2>
        <p className="mt-1 text-sm text-gray-500">分类匹配未命中时，按关键词在产品名称/分类文本中搜索。</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(binding.keywords || []).map((kw) => (
            <span key={kw} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
              {kw}
              <button onClick={() => removeTag("keywords", kw)} className="ml-1 text-amber-400 hover:text-amber-600">&times;</button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { addTag("keywords", newKeyword); setNewKeyword(""); } }}
            placeholder="输入关键词，回车添加"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button onClick={() => { addTag("keywords", newKeyword); setNewKeyword(""); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">添加</button>
        </div>
      </section>

      {/* Section: Match priority */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">匹配优先级</h2>
        <p className="mt-1 text-sm text-gray-500">多个规则集都匹配时，数值越小优先级越高。</p>
        <div className="mt-4">
          <input
            type="number"
            min={1}
            max={99}
            value={binding.match_priority || 10}
            onChange={(e) => updateBinding({ match_priority: Number(e.target.value) || 10 })}
            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </section>
    </div>
  );
};

export default BindingConfigTab;
```

**Step 2: Add "binding" tab to RulesetDetailView.tsx**

In `components/ruleset/RulesetDetailView.tsx`:

1. Add import: `import BindingConfigTab from "./BindingConfigTab";`
2. Update `DetailTab` type (line 27): add `"binding"` to the union
3. Update `tabs` array (lines 30-36): add `{ id: "binding", label: "产品绑定" }` after `"overview"`
4. Add tab content render block after the `activeTab === "overview"` section:

```tsx
{activeTab === "binding" && (
  <BindingConfigTab ruleset={ruleset} onUpdateRuleset={onUpdateRuleset} />
)}
```

**Step 3: Verify frontend compiles**

Run: `cd /Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔 && npx tsc --noEmit --skipLibCheck 2>&1 | head -20`
Expected: No new errors (or only pre-existing ones).

**Step 4: Commit**

```bash
git add components/ruleset/BindingConfigTab.tsx components/ruleset/RulesetDetailView.tsx
git commit -m "feat: add BindingConfigTab for ruleset product binding"
```

---

## Task 6: Frontend — CoverageInferenceTab

**Files:**
- Create: `components/ruleset/CoverageInferenceTab.tsx`
- Modify: `components/ruleset/RulesetDetailView.tsx` (add tab)

**Step 1: Create CoverageInferenceTab.tsx**

The component renders an ordered list of coverage inference rules. Each rule has a coverage_code, label, and condition. The condition editor reuses `ConditionTreeBuilder`.

Key features:
- Ordered card list with up/down move buttons
- Each card shows coverage_code + label + condition summary
- "Edit" opens an inline editor with `ConditionTreeBuilder`
- Bottom section for default_coverage_code and default_label
- "Add" button appends a new empty inference rule

The component should:
1. Import `ConditionTreeBuilder` from `./ConditionTreeBuilder`
2. Import types `CoverageInference`, `CoverageInferenceRule`, `RuleConditions` from `../../types`
3. Accept props: `ruleset: InsuranceRuleset`, `onUpdateRuleset: (updated: InsuranceRuleset) => void`
4. Manage local editing state for which rule index is being edited
5. Pass `ruleset.field_dictionary` and a default domain (`ExecutionDomain.ELIGIBILITY`) to `ConditionTreeBuilder`

**Step 2: Add "inference" tab to RulesetDetailView.tsx**

1. Add import
2. Update `DetailTab` union: add `"inference"`
3. Update `tabs` array: add `{ id: "inference", label: "覆盖推断" }` after `"binding"`
4. Add render block

**Step 3: Verify frontend compiles**

Run: `npx tsc --noEmit --skipLibCheck 2>&1 | head -20`

**Step 4: Commit**

```bash
git add components/ruleset/CoverageInferenceTab.tsx components/ruleset/RulesetDetailView.tsx
git commit -m "feat: add CoverageInferenceTab for coverage inference config"
```

---

## Task 7: Frontend — PreProcessorConfigTab

**Files:**
- Create: `components/ruleset/PreProcessorConfigTab.tsx`
- Modify: `components/ruleset/RulesetDetailView.tsx` (add tab)

**Step 1: Create PreProcessorConfigTab.tsx**

The component renders a list of pre-processor cards. Each card shows:
- Processor label, type badge, enabled toggle
- Type-specific config summary
- Edit/Delete buttons

"Add" flow:
1. Select type from dropdown (PRE_EXISTING_CONDITION / FIELD_CASCADE / COVERAGE_ALIAS_RESOLVE)
2. Show type-specific config form

Type-specific forms:
- **PRE_EXISTING_CONDITION**: skip_when condition (simple field/operator display), output_field text input, on_yes/on_no/on_uncertain value inputs
- **FIELD_CASCADE**: sortable field list (text inputs with add/remove/reorder), normalize dropdown (RATIO_0_1/PERCENTAGE/NONE), default_value number input
- **COVERAGE_ALIAS_RESOLVE**: editable table with columns: standard_code, aliases (comma-separated)

**Step 2: Add "preprocessors" tab to RulesetDetailView.tsx**

1. Add import
2. Update `DetailTab` union: add `"preprocessors"`
3. Update `tabs` array: add `{ id: "preprocessors", label: "前处理器" }` after `"inference"`
4. Add render block

**Step 3: Verify frontend compiles**

**Step 4: Commit**

```bash
git add components/ruleset/PreProcessorConfigTab.tsx components/ruleset/RulesetDetailView.tsx
git commit -m "feat: add PreProcessorConfigTab for pre-processor config"
```

---

## Task 8: Adapt Validation Workspace and List View

**Files:**
- Modify: `components/ruleset/RulesetListView.tsx`
- Modify: `components/ruleset/RulesetValidationWorkspace.tsx`

**Step 1: Add "绑定产品" column to RulesetListView**

In the table header and body, add a new column after "产品线" that shows `ruleset.binding?.product_codes` as tags:

```tsx
<td className="...">
  <div className="flex flex-wrap gap-1">
    {(ruleset.binding?.product_codes || []).map((code) => (
      <span key={code} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
        {code}
      </span>
    ))}
    {(!ruleset.binding?.product_codes?.length) && (
      <span className="text-xs text-gray-400">未绑定</span>
    )}
  </div>
</td>
```

**Step 2: Add inference and pre-processor results to validation workspace**

In `RulesetValidationWorkspace.tsx`, after the existing result display sections, add two new info blocks:

1. **推断的覆盖范围** — show the inferred coverage_code from the validation run
2. **前处理器执行结果** — show each processor's result/status

These are display-only additions using the data returned from the backend validation API.

**Step 3: Verify frontend compiles**

**Step 4: Commit**

```bash
git add components/ruleset/RulesetListView.tsx components/ruleset/RulesetValidationWorkspace.tsx
git commit -m "chore: adapt validation workspace and list view"
```

---

## Summary of All Commits

| # | Message | Type |
|---|---------|------|
| 0 | `docs: add ruleset data-driven refactor design` | Already committed |
| 1 | `feat: add binding/inference/preprocessor schema to rulesets` | Data + Types |
| 2 | `refactor: replace getRuleset regex with binding-based matching` | Backend |
| 3 | `refactor: unify coverage inference from ruleset config` | Backend |
| 4 | `refactor: replace hardcoded pre-processors with config-driven runner` | Backend |
| 5 | `feat: add BindingConfigTab for ruleset product binding` | Frontend |
| 6 | `feat: add CoverageInferenceTab for coverage inference config` | Frontend |
| 7 | `feat: add PreProcessorConfigTab for pre-processor config` | Frontend |
| 8 | `chore: adapt validation workspace and list view` | Frontend |

**Rollback:** Each commit is independent. `git revert <hash>` rolls back one step. Backend commits (2-4) can be reverted without affecting frontend commits (5-8) and vice versa.
