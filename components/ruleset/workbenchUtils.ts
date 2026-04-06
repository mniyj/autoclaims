import {
  type InsuranceRuleset,
  type InsuranceProduct,
  type ProductClaimConfig,
  type ResponsibilityItem,
  type ClaimItem,
  type ClaimsMaterial,
  type FactCatalogField,
  type FieldDefinition,
  type FactMappingDefinition,
  type RulesetRule,
  type RuleActionType,
  type RuleActionParams,
  RuleStatus,
  ExecutionDomain,
  RulesetProductLine,
  RuleCategory,
  RuleKind,
  RuleActionType as RuleActionTypeEnum,
  ConditionLogic,
  ConditionOperator,
} from "../../types";

export type ValidationTone = "passed" | "warning" | "error";

export interface ValidationIssue {
  id: string;
  tone: ValidationTone;
  scope: "ruleset" | "rule";
  ruleId?: string;
  field?: string;
  message: string;
}

export interface RuleSemanticSummary {
  key:
    | "gate"
    | "trigger"
    | "exclusion"
    | "adjustment"
    | "benefit"
    | "item_eligibility"
    | "item_ratio"
    | "item_pricing"
    | "item_cap"
    | "item_flag"
    | "post_process";
  label: string;
  description: string;
}

const RULE_KIND_TO_SEMANTIC: Record<RuleKind, RuleSemanticSummary> = {
  [RuleKind.GATE]: {
    key: "gate",
    label: "准入",
    description: "控制是否允许进入责任触发阶段",
  },
  [RuleKind.TRIGGER]: {
    key: "trigger",
    label: "触发",
    description: "满足责任触发条件后进入赔付或定损",
  },
  [RuleKind.EXCLUSION]: {
    key: "exclusion",
    label: "免责",
    description: "命中即拒赔或终止责任",
  },
  [RuleKind.ADJUSTMENT]: {
    key: "adjustment",
    label: "调整",
    description: "责任成立后调整赔付比例",
  },
  [RuleKind.BENEFIT]: {
    key: "benefit",
    label: "给付规则",
    description: "按责任直接给付保额或固定金额",
  },
  [RuleKind.ITEM_ELIGIBILITY]: {
    key: "item_eligibility",
    label: "费用项准入",
    description: "判断单项费用是否进入核定",
  },
  [RuleKind.ITEM_RATIO]: {
    key: "item_ratio",
    label: "比例规则",
    description: "按费用项适用赔付比例",
  },
  [RuleKind.ITEM_PRICING]: {
    key: "item_pricing",
    label: "限价规则",
    description: "对单项费用做限价或调减",
  },
  [RuleKind.ITEM_CAP]: {
    key: "item_cap",
    label: "限额规则",
    description: "对费用项或责任项应用免赔和限额",
  },
  [RuleKind.ITEM_FLAG]: {
    key: "item_flag",
    label: "复核标记",
    description: "保留明细但标记需人工复核",
  },
  [RuleKind.POST_PROCESS]: {
    key: "post_process",
    label: "后处理",
    description: "案件汇总、限额、备注或额外调整",
  },
};

export interface RulesetHealthSnapshot {
  coverageCount: number;
  effectiveRuleCount: number;
  draftRuleCount: number;
  issueCount: number;
  warningCount: number;
  validationTone: ValidationTone;
  validationLabel: string;
  versionState: "draft" | "published";
  versionLabel: string;
  dependencyCount: number;
}

export interface ValidationInputState {
  policy: Record<string, string | number | boolean>;
  claim: Record<string, string | number | boolean>;
  items: Array<Record<string, string | number | boolean>>;
  missingFacts: string[];
}

interface ClaimDocumentsSnapshot {
  aggregation?: {
    injuryProfile?: {
      injuryDescription?: string | null;
      diagnosisNames?: string[];
      primaryDiagnosisDate?: string | null;
      hospitalizationDays?: number | null;
      disabilityLevel?: string | number | null;
      pastHistory?: string | null;
      firstDiagnosisDate?: string | null;
    } | null;
    deathProfile?: {
      deathConfirmed?: boolean;
      deathDate?: string | null;
    } | null;
    liabilityResult?: {
      thirdPartyLiabilityPct?: number | null;
    } | null;
    factModel?: {
      canonicalFacts?: Record<string, unknown>;
    } | null;
  } | null;
  validationFacts?: Record<string, boolean | null>;
  documents?: Array<{
    structuredData?: Record<string, unknown>;
    ocrData?: Record<string, unknown>;
    medicalData?: {
      chargeItems?: Array<Record<string, unknown>>;
    } | null;
  }>;
}

interface FullReviewApiResult {
  decision: "APPROVE" | "REJECT" | "MANUAL_REVIEW";
  preExistingAssessment?: PreExistingAssessmentTrace | null;
  matchedRuleDetails?: Array<{
    ruleId: string;
    ruleName: string;
    ruleKind?: string;
    category?: string;
    domain?: string;
    fields?: string[];
    actionType?: string | null;
    effect?: string;
    sourceText?: string;
  }>;
  coverageResults?: Array<{
    coverageCode: string;
    claimedAmount?: number;
    approvedAmount?: number;
    payableAmount?: number;
    status?: string;
  }>;
  manualReviewReasons?: Array<{
    code: string;
    message: string;
  }>;
  eligibility?: {
    matchedRules?: string[];
  };
  amount?: {
    settlementMode?: "LOSS" | "BENEFIT" | "HYBRID";
    lossLedger?: Array<{
      itemKey: string;
      itemName: string;
      claimedAmount: number;
      payableAmount: number;
      status: "PAYABLE" | "ZERO_PAY" | "MANUAL_REVIEW";
      entries: Array<{
        step: string;
        beforeAmount: number;
        afterAmount: number;
        reasonCode?: string;
        message?: string;
        ruleId?: string;
      }>;
    }>;
    benefitLedger?: Array<{
      coverageCode: string;
      claimedAmount: number;
      payableAmount: number;
      status: "PAYABLE" | "ZERO_PAY" | "MANUAL_REVIEW";
      entries: Array<{
        step: string;
        beforeAmount: number;
        afterAmount: number;
        reasonCode?: string;
        message?: string;
        ruleId?: string;
      }>;
    }>;
    settlementBreakdown?: {
      lossPayableAmount: number;
      benefitPayableAmount: number;
      totalPayableAmount: number;
    };
  };
  auditTrail?: Array<{
    stage: string;
    ruleId: string;
    matched: boolean;
  }>;
  warnings?: string[];
}

export interface PreExistingAssessmentTrace {
  result: "YES" | "NO" | "UNCERTAIN" | "SKIPPED";
  confidence: number | null;
  reasoning: string;
  evidence: string[];
  historyText: string | null;
  evaluatedAt?: string;
  source?: "AUTO" | "INPUT" | "ENGINE" | "ERROR";
  input?: {
    diagnosis?: string | null;
    diagnosisNames?: string[] | string | null;
    pastMedicalHistory?: string | null;
    firstDiagnosisDate?: string | null;
    policyEffectiveDate?: string | null;
    waitingPeriodDays?: number;
  } | null;
  uncertainResolution?: {
    action?: "MANUAL_REVIEW" | "ASSUME_FALSE" | null;
    matchedRule?: {
      when?: {
        product_line?: string;
        claim_scenario?: string;
        max_claim_amount?: number | null;
      };
      action?: "MANUAL_REVIEW" | "ASSUME_FALSE" | null;
    } | null;
    productLine?: string | null;
    claimScenario?: string | null;
    claimAmount?: number | null;
  } | null;
  steps?: {
    history?: {
      certainty?: string | null;
      text?: string | null;
      vote?: "YES" | "NO" | null;
      weight?: number;
    } | null;
    timeLogic?: {
      verdict?: string | null;
      reason?: string | null;
      firstDiagnosisDate?: string | null;
      vote?: "YES" | "NO" | null;
      weight?: number;
    } | null;
    ai?: {
      invoked?: boolean;
      skippedReason?: string | null;
      result?: "YES" | "NO" | "UNCERTAIN" | null;
      confidence?: number | null;
      reasoning?: string;
      voteWeight?: number;
    } | null;
    synthesis?: {
      preAiResult?: {
        result?: "YES" | "NO" | "UNCERTAIN";
        confidence?: number;
      } | null;
      finalResult?: {
        result?: "YES" | "NO" | "UNCERTAIN";
        confidence?: number;
      } | null;
      yesScore?: number;
      noScore?: number;
      threshold?: number;
    } | null;
  } | null;
}

export interface ValidationSimulationStep {
  id: string;
  label: string;
  field?: string;
  ruleId?: string;
  tone: "success" | "warning" | "danger" | "neutral";
  detail: string;
}

export interface ValidationSimulationResult {
  decision: "APPROVE" | "REJECT" | "PARTIAL_APPROVE" | "MANUAL_REVIEW";
  summary: string;
  executionSource?: "SIMULATED" | "BACKEND";
  explanationCards: Array<{
    id: string;
    title: string;
    tone: "warning" | "danger" | "neutral";
    items: string[];
  }>;
  settlementMode: "LOSS" | "BENEFIT" | "HYBRID";
  matchedRules: Array<{
    ruleId: string;
    ruleName: string;
    semantic: RuleSemanticSummary["key"];
    fields: string[];
    effect: string;
  }>;
  issues: ValidationIssue[];
  ledger: Array<{
    id: string;
    title: string;
    claimedAmount: number;
    payableAmount: number;
    status: "PAYABLE" | "ZERO_PAY" | "MANUAL_REVIEW";
    entries: Array<{
      step: string;
      beforeAmount: number;
      afterAmount: number;
      reason: string;
      ruleId?: string;
    }>;
  }>;
  lossLedger: Array<{
    id: string;
    title: string;
    claimedAmount: number;
    payableAmount: number;
    status: "PAYABLE" | "ZERO_PAY" | "MANUAL_REVIEW";
    entries: Array<{
      step: string;
      beforeAmount: number;
      afterAmount: number;
      reason: string;
      ruleId?: string;
    }>;
  }>;
  benefitLedger: Array<{
    id: string;
    title: string;
    claimedAmount: number;
    payableAmount: number;
    status: "PAYABLE" | "ZERO_PAY" | "MANUAL_REVIEW";
    entries: Array<{
      step: string;
      beforeAmount: number;
      afterAmount: number;
      reason: string;
      ruleId?: string;
    }>;
  }>;
  settlementBreakdown: {
    lossPayableAmount: number;
    benefitPayableAmount: number;
    totalPayableAmount: number;
  };
  coverageResults: Array<{
    coverageCode: string;
    claimedAmount: number;
    payableAmount: number;
    status: string;
  }>;
  manualReviewReasons: Array<{
    code: string;
    message: string;
  }>;
  steps: ValidationSimulationStep[];
  preExistingAssessment?: PreExistingAssessmentTrace | null;
}

export interface ManualRulesetDraftInput {
  product: InsuranceProduct;
  productConfig?: ProductClaimConfig | null;
  responsibilities: ResponsibilityItem[];
  claimItems: ClaimItem[];
  claimsMaterials: ClaimsMaterial[];
  factCatalog: FactCatalogField[];
  existingRulesets: InsuranceRuleset[];
  rulesetName?: string;
}

function inferProductLine(product: InsuranceProduct): RulesetProductLine {
  const primaryCategory = `${product.primaryCategory || ""}${product.secondaryCategory || ""}${product.racewayName || ""}`;
  if (primaryCategory.includes("意外")) return RulesetProductLine.ACCIDENT;
  if (primaryCategory.includes("重大疾病") || primaryCategory.includes("重疾")) return RulesetProductLine.CRITICAL_ILLNESS;
  if (primaryCategory.includes("年金")) return RulesetProductLine.ANNUITY;
  if (primaryCategory.includes("定期寿险")) return RulesetProductLine.TERM_LIFE;
  if (primaryCategory.includes("终身寿险")) return RulesetProductLine.WHOLE_LIFE;
  return RulesetProductLine.HEALTH;
}

function createBaseFieldDictionary(factCatalog: FactCatalogField[]) {
  const baseFactIds = [
    "policy.is_within_coverage_period",
    "claim.result_type",
    "claim.cause_type",
    "claim.expense_items",
    "expense_item.amount",
  ];
  return buildFieldDictionaryFromCatalog(baseFactIds, factCatalog);
}

function parseMaterialSchemaPaths(material: ClaimsMaterial): Array<{ path: string; label: string; type: string }> {
  const rawSchema = material.extractionConfig?.jsonSchema || material.jsonSchema;
  if (!rawSchema) return [];

  let schema: Record<string, any>;
  try {
    schema = typeof rawSchema === "string" ? JSON.parse(rawSchema) : rawSchema;
  } catch {
    return [];
  }

  const paths: Array<{ path: string; label: string; type: string }> = [];

  const walk = (node: Record<string, any>, prefix = "") => {
    const properties = node?.properties;
    if (!properties || typeof properties !== "object") return;

    Object.entries(properties).forEach(([key, value]) => {
      const child = value as Record<string, any>;
      const path = prefix ? `${prefix}.${key}` : key;
      paths.push({
        path,
        label: child.description || key,
        type: String(child.type || "string").toUpperCase(),
      });

      if (child.type === "object") {
        walk(child, path);
      }
      if (child.type === "array" && child.items && typeof child.items === "object") {
        walk(child.items as Record<string, any>, `${path}[]`);
      }
    });
  };

  walk(schema);
  return paths;
}

function createFactMappings(
  fieldDictionary: Record<string, FieldDefinition>,
  claimItems: ClaimItem[],
  claimsMaterials: ClaimsMaterial[],
): FactMappingDefinition[] {
  const claimItemMaterialIds = new Set(claimItems.flatMap((item) => item.materialIds || []));
  const relevantMaterials = claimsMaterials.filter((material) => claimItemMaterialIds.has(material.id));
  const allSchemaPaths = relevantMaterials.flatMap((material) => {
    return parseMaterialSchemaPaths(material).map((path) => ({ material, ...path, factId: "" }));
  });

  const selectFirstMatch = (keywords: string[]) =>
    allSchemaPaths.find((candidate) =>
      keywords.some((keyword) => candidate.path.toLowerCase().includes(keyword) || candidate.label.toLowerCase().includes(keyword)),
    );

  const mappings: FactMappingDefinition[] = [];

  Object.entries(fieldDictionary).forEach(([fieldKey, definition]) => {
    if (definition.source_type === "derived") {
      mappings.push({
        id: `map-${fieldKey}`,
        fact_field: fieldKey,
        source_type: "derived",
        source_label: definition.label,
        transform: definition.derivation || "由标准事实层统一计算",
      });
      return;
    }

    if (definition.source_type === "system") {
      mappings.push({
        id: `map-${fieldKey}`,
        fact_field: fieldKey,
        source_type: "system",
        source_label: definition.label,
        transform: "由产品 / 保单配置自动带入",
      });
      return;
    }

    const directBinding = allSchemaPaths.find((candidate) => candidate.factId === fieldKey);
    const match = directBinding ||
      fieldKey === "claim.result_type"
        ? selectFirstMatch(["diagnosis", "diagnosis_date", "discharge_diagnosis", "work_injury_conclusion"])
        : fieldKey === "claim.cause_type"
          ? selectFirstMatch(["accident_summary", "injury_cause", "accident_location", "accident_date"])
          : fieldKey === "expense_item.amount"
            ? selectFirstMatch(["total_amount", "amount", "charge_amount", "fee"])
            : null;

    if (match) {
      mappings.push({
        id: `map-${fieldKey}-${match.material.id}`,
        fact_field: fieldKey,
        source_type: "material",
        material_id: match.material.id,
        material_name: match.material.name,
        schema_path: match.path,
        source_label: match.label,
        notes: "自动匹配的材料字段候选，发布前建议人工确认。",
      });
    } else {
      mappings.push({
        id: `map-${fieldKey}`,
        fact_field: fieldKey,
        source_type: definition.source_type || "manual",
        source_label: definition.label,
        notes: definition.source_type === "material" ? "尚未绑定材料 schema 字段" : "待补充来源",
      });
    }
  });

  return mappings;
}

function createBasePipeline(): InsuranceRuleset["execution_pipeline"] {
  return {
    domains: [
      {
        domain: ExecutionDomain.ELIGIBILITY,
        label: "定责",
        execution_mode: "SEQUENTIAL",
        semantic_sequence: ["GATE", "TRIGGER", "EXCLUSION", "ADJUSTMENT"],
        category_sequence: ["COVERAGE_PERIOD", "WAITING_PERIOD", "COVERAGE_SCOPE", "EXCLUSION", "PROPORTIONAL_LIABILITY"],
      },
      {
        domain: ExecutionDomain.ASSESSMENT,
        label: "定损",
        execution_mode: "ITEM_LOOP",
        input_granularity: "ITEM",
        loop_collection: "claim.expense_items",
        semantic_sequence: ["ITEM_ELIGIBILITY", "ITEM_RATIO", "ITEM_PRICING", "ITEM_CAP", "ITEM_FLAG"],
        category_sequence: ["ITEM_CLASSIFICATION", "SOCIAL_INSURANCE", "PRICING_REASONABILITY", "DEDUCTIBLE", "SUB_LIMIT"],
      },
      {
        domain: ExecutionDomain.POST_PROCESS,
        label: "后处理",
        execution_mode: "SEQUENTIAL",
        semantic_sequence: ["POST_PROCESS"],
        category_sequence: ["AGGREGATE_CAP", "POST_ADJUSTMENT"],
      },
    ],
  };
}

export function createRuleDraft(
  overrides: Partial<RulesetRule> = {},
  line: RulesetProductLine = RulesetProductLine.HEALTH,
): RulesetRule {
  const coverageCodes = overrides.applies_to?.coverage_codes || [];
  const draft: RulesetRule = {
    rule_id: overrides.rule_id || `RULE-${Date.now()}`,
    rule_name: overrides.rule_name || "新规则",
    description: overrides.description || "请补充规则说明",
    category: overrides.category || RuleCategory.COVERAGE_SCOPE,
    rule_kind: overrides.rule_kind,
    applies_to: { coverage_codes: coverageCodes },
    tags: overrides.tags || [],
    status: overrides.status || RuleStatus.DRAFT,
    execution: overrides.execution || {
      domain: ExecutionDomain.ELIGIBILITY,
      loop_over: null,
      item_alias: null,
      item_action_on_reject: null,
    },
    source: overrides.source || {
      source_type: "MANUAL",
      source_ref: `${line}.manual`,
      clause_code: null,
      source_text: "手工创建规则",
    },
    priority: overrides.priority || { level: 2, rank: 10 },
    conditions: overrides.conditions || {
      logic: ConditionLogic.AND,
      expressions: [
        {
          field:
            overrides.execution?.domain === ExecutionDomain.ASSESSMENT
              ? "expense_item.amount"
              : "policy.is_within_coverage_period",
          operator:
            overrides.execution?.domain === ExecutionDomain.ASSESSMENT
              ? ConditionOperator.GT
              : ConditionOperator.IS_TRUE,
          value:
            overrides.execution?.domain === ExecutionDomain.ASSESSMENT
              ? 0
              : true,
        },
      ],
    },
    action: overrides.action || {
      action_type:
        overrides.execution?.domain === ExecutionDomain.ASSESSMENT
          ? RuleActionTypeEnum.SET_ITEM_RATIO
          : RuleActionTypeEnum.APPROVE_CLAIM,
      params:
        overrides.execution?.domain === ExecutionDomain.ASSESSMENT
          ? { payout_ratio: 1 }
          : {},
    },
    parsing_confidence: overrides.parsing_confidence,
  };
  draft.rule_kind = draft.rule_kind || inferRuleKind(draft);
  return draft;
}

export function createManualRulesetDraft({
  product,
  productConfig,
  responsibilities,
  claimItems,
  claimsMaterials,
  factCatalog,
  existingRulesets,
  rulesetName,
}: ManualRulesetDraftInput): InsuranceRuleset {
  const productLine = inferProductLine(product);
  const fieldDictionary = createBaseFieldDictionary(factCatalog);
  const responsibilityLookup = new Map(responsibilities.map((item) => [item.id, item]));
  const relatedConfigs = productConfig?.responsibilityConfigs || [];
  const coverages = relatedConfigs.map((config) => {
    const responsibility = responsibilityLookup.get(config.responsibilityId);
    const relatedItemNames = config.claimItemIds
      .map((itemId) => claimItems.find((item) => item.id === itemId)?.name)
      .filter(Boolean)
      .join("、");
    return {
      coverage_code: responsibility?.code || config.responsibilityId,
      coverage_name: responsibility?.name || config.responsibilityId,
      sum_insured: 0,
      deductible: 0,
      co_pay_ratio: 0,
      claim_item_names: relatedItemNames,
    };
  });

  if (coverages.length === 0) {
    const detailCoverages = (product.coverageDetails || []).map((coverage, index) => ({
      coverage_code: `${product.productCode}_COV_${index + 1}`,
      coverage_name: coverage.name,
      sum_insured: 0,
      deductible: 0,
      co_pay_ratio: 0,
      claim_item_names: "",
    }));
    coverages.push(...detailCoverages);
  }

  const coverageCodes = coverages.map((coverage) => coverage.coverage_code);
  const starterRules: RulesetRule[] = [
    createRuleDraft(
      {
        rule_id: `${product.productCode}-GATE-001`,
        rule_name: "保障期间校验",
        description: "产品自动带出的基础准入规则，请补充条件细节。",
        category: RuleCategory.COVERAGE_PERIOD,
        rule_kind: RuleKind.GATE,
        applies_to: { coverage_codes: coverageCodes },
        execution: {
          domain: ExecutionDomain.ELIGIBILITY,
          loop_over: null,
          item_alias: null,
          item_action_on_reject: null,
        },
        action: {
          action_type: RuleActionTypeEnum.APPROVE_CLAIM,
          params: {},
        },
      },
      productLine,
    ),
    createRuleDraft(
      {
        rule_id: `${product.productCode}-TRIGGER-001`,
        rule_name: "责任触发规则",
        description: "按责任项自动生成的触发占位规则，请配置事故/疾病/结果类型。",
        category: RuleCategory.COVERAGE_SCOPE,
        rule_kind: RuleKind.TRIGGER,
        applies_to: { coverage_codes: coverageCodes.slice(0, 1) },
        execution: {
          domain: ExecutionDomain.ELIGIBILITY,
          loop_over: null,
          item_alias: null,
          item_action_on_reject: null,
        },
        conditions: {
          logic: ConditionLogic.AND,
          expressions: [
            { field: "policy.is_within_coverage_period", operator: ConditionOperator.IS_TRUE, value: true },
            { field: "claim.result_type", operator: ConditionOperator.EQ, value: "MEDICAL_TREATMENT" },
          ],
        },
        action: {
          action_type: RuleActionTypeEnum.APPROVE_CLAIM,
          params: {},
        },
      },
      productLine,
    ),
    createRuleDraft(
      {
        rule_id: `${product.productCode}-ASSESS-001`,
        rule_name: "费用项比例规则",
        description: "根据关联索赔项自动生成的定损占位规则，请补充比例和前置条件。",
        category: RuleCategory.SOCIAL_INSURANCE,
        rule_kind: RuleKind.ITEM_RATIO,
        applies_to: { coverage_codes: coverageCodes.slice(0, 1) },
        execution: {
          domain: ExecutionDomain.ASSESSMENT,
          loop_over: "claim.expense_items",
          item_alias: "expense_item",
          item_action_on_reject: "ZERO_AMOUNT",
        },
        conditions: {
          logic: ConditionLogic.AND,
          expressions: [
            { field: "expense_item.amount", operator: ConditionOperator.GT, value: 0 },
          ],
        },
        action: {
          action_type: RuleActionTypeEnum.SET_ITEM_RATIO,
          params: { payout_ratio: 1 },
        },
      },
      productLine,
    ),
  ];

  const now = new Date().toISOString();
  const versionCandidates = existingRulesets
    .filter((ruleset) => ruleset.policy_info.product_code === product.productCode)
    .map((ruleset) => Number(ruleset.metadata.version) || 0);
  const nextVersion = String((versionCandidates.length ? Math.max(...versionCandidates) : 0) + 1);

  return {
    ruleset_id: `${product.productCode}-MANUAL-${Date.now()}`,
    product_line: productLine,
    policy_info: {
      policy_no: `TPL-${product.productCode}`,
      product_code: product.productCode,
      product_name: rulesetName?.trim() || product.marketingName || product.regulatoryName || product.productCode,
      insurer: product.companyName,
      effective_date: product.effectiveDate,
      expiry_date: product.discontinuationDate,
      coverages: coverages.map(({ claim_item_names, ...coverage }) => coverage),
    },
    rules: starterRules,
    execution_pipeline: createBasePipeline(),
    override_chains: [],
    field_dictionary: fieldDictionary,
    field_mappings: createFactMappings(fieldDictionary, claimItems, claimsMaterials),
    metadata: {
      schema_version: "manual-v1",
      version: nextVersion,
      generated_at: now,
      generated_by: "MANUAL_ENTRY",
      total_rules: starterRules.length,
      rules_by_domain: {
        eligibility: starterRules.filter((rule) => rule.execution.domain === ExecutionDomain.ELIGIBILITY).length,
        assessment: starterRules.filter((rule) => rule.execution.domain === ExecutionDomain.ASSESSMENT).length,
        post_process: starterRules.filter((rule) => rule.execution.domain === ExecutionDomain.POST_PROCESS).length,
      },
      latest_validation: {
        status: "warning",
        validated_at: now,
        issue_count: 0,
        summary: "手工创建草稿，待完善规则细节",
      },
      audit_trail: [
        {
          timestamp: now,
          user_id: "ui",
          action: "MANUAL_CREATED",
          details: `基于产品 ${product.productCode} 自动带出责任和索赔项生成草稿`,
        },
      ],
    },
  };
}

export function buildFieldDictionaryFromCatalog(
  factIds: string[],
  factCatalog: FactCatalogField[],
): Record<string, FieldDefinition> {
  return factIds.reduce<Record<string, FieldDefinition>>((acc, factId) => {
    const fact = factCatalog.find((item) => item.fact_id === factId);
    if (!fact) return acc;
    acc[fact.fact_id] = {
      label: fact.label,
      data_type: fact.data_type,
      scope: fact.scope,
      source: fact.source,
      applicable_domains: fact.applicable_domains,
      enum_values: fact.enum_values,
      source_type: fact.source_type,
      source_refs: fact.source_refs,
      derivation: fact.derivation,
      required_evidence: fact.required_evidence,
    };
    return acc;
  }, {});
}

export function syncRulesetFieldDictionary(
  ruleset: InsuranceRuleset,
  factCatalog: FactCatalogField[],
): InsuranceRuleset {
  const usedFields = Array.from(
    new Set(ruleset.rules.flatMap((rule) => getRuleFields(rule))),
  );
  return {
    ...ruleset,
    field_dictionary: buildFieldDictionaryFromCatalog(usedFields, factCatalog),
  };
}

export function syncRulesetSemantics(ruleset: InsuranceRuleset): InsuranceRuleset {
  const normalizePipelineDomains = (ruleset.execution_pipeline?.domains || []).map((domain) => {
    if (domain.semantic_sequence?.length) {
      return domain;
    }

    if (domain.domain === ExecutionDomain.ELIGIBILITY) {
      return { ...domain, semantic_sequence: ["GATE", "TRIGGER", "EXCLUSION", "ADJUSTMENT"] };
    }
    if (domain.domain === ExecutionDomain.ASSESSMENT) {
      return { ...domain, semantic_sequence: ["ITEM_ELIGIBILITY", "ITEM_RATIO", "ITEM_PRICING", "ITEM_CAP", "ITEM_FLAG"] };
    }
    return { ...domain, semantic_sequence: ["POST_PROCESS"] };
  });

  return {
    ...ruleset,
    execution_pipeline: {
      ...ruleset.execution_pipeline,
      domains: normalizePipelineDomains,
    },
    rules: ruleset.rules.map((rule) => ({
      ...rule,
      rule_kind: inferRuleKind(rule),
    })),
  };
}

export function normalizeRulesetStructure(
  ruleset: InsuranceRuleset,
  factCatalog: FactCatalogField[],
): InsuranceRuleset {
  return syncRulesetFieldDictionary(syncRulesetSemantics(ruleset), factCatalog);
}

export function getCoverageCodes(rule: RulesetRule): string[] {
  return rule.applies_to?.coverage_codes || [];
}

export function getRuleFields(rule: RulesetRule): string[] {
  const fields = new Set<string>();

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if ("field" in (node as Record<string, unknown>)) {
      const field = (node as Record<string, unknown>).field;
      if (typeof field === "string" && field.trim()) {
        fields.add(field);
      }
      return;
    }
    const expressions = (node as Record<string, unknown>).expressions;
    if (Array.isArray(expressions)) {
      expressions.forEach(walk);
    }
  };

  walk(rule.conditions);
  return [...fields];
}

export function summarizeAction(rule: RulesetRule): string {
  const params = rule.action.params || {};
  switch (rule.action.action_type) {
    case "APPROVE_CLAIM":
      return "责任成立";
    case "REJECT_CLAIM":
      return `拒赔${params.reject_reason_code ? ` · ${params.reject_reason_code}` : ""}`;
    case "SET_CLAIM_RATIO":
      return `赔付比例 ${(params.payout_ratio ?? 1) * 100}%`;
    case "ROUTE_CLAIM_MANUAL":
      return `转人工 · ${params.route_reason || "需复核"}`;
    case "TERMINATE_CONTRACT":
      return "保单终止";
    case "APPROVE_ITEM":
      return "费用通过";
    case "REJECT_ITEM":
      return "费用拒赔";
    case "SET_ITEM_RATIO":
      return `费用比例 ${(params.payout_ratio ?? 1) * 100}%`;
    case "ADJUST_ITEM_AMOUNT":
      return `费用调减 ${((params.reduction_ratio ?? 0) * 100).toFixed(0)}%`;
    case "FLAG_ITEM":
      return `标记复核 · ${params.route_reason || "合理性复核"}`;
    case "APPLY_CAP":
      return `限额 ${params.cap_amount ?? 0}`;
    case "APPLY_DEDUCTIBLE":
      return `免赔 ${params.deductible_amount ?? 0}`;
    case "ADD_REMARK":
      return "写入备注";
    default:
      return rule.action.action_type;
  }
}

export function inferRuleKind(rule: RulesetRule): RuleKind {
  if (rule.rule_kind) return rule.rule_kind;

  if (rule.execution.domain === ExecutionDomain.POST_PROCESS) {
    return RuleKind.POST_PROCESS;
  }

  if (rule.execution.domain === ExecutionDomain.ASSESSMENT) {
    if (rule.action.action_type === "REJECT_ITEM" || rule.action.action_type === "APPROVE_ITEM") {
      return RuleKind.ITEM_ELIGIBILITY;
    }
    if (rule.action.action_type === "SET_ITEM_RATIO") {
      return RuleKind.ITEM_RATIO;
    }
    if (rule.action.action_type === "ADJUST_ITEM_AMOUNT") {
      return RuleKind.ITEM_PRICING;
    }
    if (rule.action.action_type === "APPLY_CAP" || rule.action.action_type === "APPLY_DEDUCTIBLE") {
      return RuleKind.ITEM_CAP;
    }
    return RuleKind.ITEM_FLAG;
  }

  const category = rule.category.toUpperCase();
  const action = rule.action.action_type;
  if (action === "REJECT_CLAIM" || action === "TERMINATE_CONTRACT" || category.includes("EXCLUSION")) {
    return RuleKind.EXCLUSION;
  }
  if (action === "SET_CLAIM_RATIO" || category.includes("PAYOUT") || category.includes("PROPORTIONAL")) {
    return RuleKind.ADJUSTMENT;
  }
  if (
    category.includes("WAITING") ||
    category.includes("COVERAGE_PERIOD") ||
    category.includes("POLICY_STATUS") ||
    category.includes("CLAIM_TIMELINE") ||
    category === "E_POLICY_STATUS"
  ) {
    return RuleKind.GATE;
  }
  return RuleKind.TRIGGER;
}

export function getRuleSemantic(rule: RulesetRule): RuleSemanticSummary {
  const explicitKind = inferRuleKind(rule);
  if (RULE_KIND_TO_SEMANTIC[explicitKind]) {
    return RULE_KIND_TO_SEMANTIC[explicitKind];
  }

  if (rule.execution.domain === ExecutionDomain.POST_PROCESS) {
    return {
      key: "post_process",
      label: "后处理",
      description: "案件汇总、限额、备注或额外调整",
    };
  }

  if (rule.execution.domain === ExecutionDomain.ASSESSMENT) {
    if (rule.action.action_type === "REJECT_ITEM" || rule.action.action_type === "APPROVE_ITEM") {
      return {
        key: "item_eligibility",
        label: "费用项准入",
        description: "判断单项费用是否进入核定",
      };
    }
    if (rule.action.action_type === "SET_ITEM_RATIO") {
      return {
        key: "item_ratio",
        label: "比例规则",
        description: "按费用项适用赔付比例",
      };
    }
    if (rule.action.action_type === "ADJUST_ITEM_AMOUNT") {
      return {
        key: "item_pricing",
        label: "限价规则",
        description: "对单项费用做限价或调减",
      };
    }
    if (rule.action.action_type === "APPLY_CAP" || rule.action.action_type === "APPLY_DEDUCTIBLE") {
      return {
        key: "item_cap",
        label: "限额规则",
        description: "对费用项或责任项应用免赔和限额",
      };
    }
    return {
      key: "item_flag",
      label: "复核标记",
      description: "保留明细但标记需人工复核",
    };
  }

  const category = rule.category.toUpperCase();
  const action = rule.action.action_type;
  if (action === "REJECT_CLAIM" || action === "TERMINATE_CONTRACT" || category.includes("EXCLUSION")) {
    return {
      key: "exclusion",
      label: "免责",
      description: "命中即拒赔或终止责任",
    };
  }
  if (action === "SET_CLAIM_RATIO" || category.includes("PAYOUT") || category.includes("PROPORTIONAL")) {
    return {
      key: "adjustment",
      label: "调整",
      description: "责任成立后调整赔付比例",
    };
  }
  if (
    category.includes("WAITING") ||
    category.includes("COVERAGE_PERIOD") ||
    category.includes("POLICY_STATUS") ||
    category.includes("CLAIM_TIMELINE") ||
    category.includes("COVERAGE_SCOPE")
  ) {
    return {
      key: "gate",
      label: "准入",
      description: "控制是否允许进入责任触发阶段",
    };
  }
  return {
    key: "trigger",
    label: "触发",
    description: "满足责任触发条件后进入赔付或定损",
  };
}

function mapRuleKindToSemanticKey(ruleKind?: string): RuleSemanticSummary["key"] {
  if (!ruleKind) return "post_process";
  const semantic = RULE_KIND_TO_SEMANTIC[ruleKind as RuleKind];
  return semantic?.key || "post_process";
}

function hasUnsupportedExpression(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const node = value as Record<string, unknown>;
  if (typeof node.value === "string" && node.value.includes("${") && !/^\$\{[a-zA-Z0-9_.]+\}$/.test(node.value)) {
    return true;
  }
  if (Array.isArray(node.expressions)) {
    return node.expressions.some(hasUnsupportedExpression);
  }
  return false;
}

function validateActionParams(actionType: RuleActionType, params: RuleActionParams): string[] {
  const issues: string[] = [];
  if (actionType === "REJECT_CLAIM" && !params.reject_reason_code) {
    issues.push("缺少拒赔原因代码");
  }
  if ((actionType === "SET_CLAIM_RATIO" || actionType === "SET_ITEM_RATIO") && typeof params.payout_ratio !== "number") {
    issues.push("缺少赔付比例");
  }
  if (actionType === "ROUTE_CLAIM_MANUAL" && !params.route_reason) {
    issues.push("缺少人工复核原因");
  }
  if (actionType === "APPLY_FORMULA" && !params.formula?.expression) {
    issues.push("缺少公式表达式");
  }
  return issues;
}

export function validateRuleset(ruleset: InsuranceRuleset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenRuleIds = new Set<string>();
  const mappingsByField = new Map<string, FactMappingDefinition[]>();

  (ruleset.field_mappings || []).forEach((mapping) => {
    const current = mappingsByField.get(mapping.fact_field) || [];
    current.push(mapping);
    mappingsByField.set(mapping.fact_field, current);

    if (!ruleset.field_dictionary[mapping.fact_field]) {
      issues.push({
        id: `mapping-${mapping.id}-missing-field`,
        tone: "error",
        scope: "ruleset",
        field: mapping.fact_field,
        message: `事实映射 ${mapping.fact_field} 未登记到字段字典`,
      });
    }

    if (mapping.source_type === "material" && (!mapping.material_id || !mapping.schema_path)) {
      issues.push({
        id: `mapping-${mapping.id}-incomplete`,
        tone: "warning",
        scope: "ruleset",
        field: mapping.fact_field,
        message: `字段 ${mapping.fact_field} 的材料映射不完整`,
      });
    }
  });

  ruleset.rules.forEach((rule) => {
    const normalizedRuleKind = inferRuleKind(rule);
    if (seenRuleIds.has(rule.rule_id)) {
      issues.push({
        id: `dup-${rule.rule_id}`,
        tone: "error",
        scope: "rule",
        ruleId: rule.rule_id,
        message: "规则 ID 重复",
      });
    }
    seenRuleIds.add(rule.rule_id);

    const fields = getRuleFields(rule);
    if (fields.length === 0 && rule.conditions.logic !== "ALWAYS_TRUE") {
      issues.push({
        id: `fields-${rule.rule_id}`,
        tone: "warning",
        scope: "rule",
        ruleId: rule.rule_id,
        message: "未配置字段依赖，规则可能无法命中",
      });
    }

    fields.forEach((field) => {
      const fieldDefinition = ruleset.field_dictionary[field];
      if (!fieldDefinition) {
        issues.push({
          id: `${rule.rule_id}-${field}`,
          tone: "error",
          scope: "rule",
          ruleId: rule.rule_id,
          field,
          message: `字段 ${field} 不在字段字典中`,
        });
        return;
      }

      if (
        fieldDefinition.source_type === "material" &&
        !fieldDefinition.source_refs?.length &&
        !(mappingsByField.get(field) || []).some((mapping) => mapping.source_type === "material" && mapping.schema_path)
      ) {
        issues.push({
          id: `${rule.rule_id}-${field}-mapping`,
          tone: "warning",
          scope: "rule",
          ruleId: rule.rule_id,
          field,
          message: `字段 ${field} 依赖材料提取，但尚未配置 schema 映射`,
        });
      }

      if (fieldDefinition.source_type === "derived" && !fieldDefinition.derivation) {
        issues.push({
          id: `${rule.rule_id}-${field}-derivation`,
          tone: "warning",
          scope: "rule",
          ruleId: rule.rule_id,
          field,
          message: `字段 ${field} 是派生事实，但未登记派生逻辑`,
        });
      }
    });

    if (hasUnsupportedExpression(rule.conditions)) {
      issues.push({
        id: `expr-${rule.rule_id}`,
        tone: "warning",
        scope: "rule",
        ruleId: rule.rule_id,
        message: "条件中包含前端无法解释的动态表达式",
      });
    }

    validateActionParams(rule.action.action_type, rule.action.params || {}).forEach((message, index) => {
      issues.push({
        id: `${rule.rule_id}-action-${index}`,
        tone: "error",
        scope: "rule",
        ruleId: rule.rule_id,
        message,
      });
    });

    if (!rule.rule_kind) {
      issues.push({
        id: `${rule.rule_id}-rule-kind`,
        tone: "warning",
        scope: "rule",
        ruleId: rule.rule_id,
        message: `未显式设置规则语义，当前按 ${RULE_KIND_TO_SEMANTIC[normalizedRuleKind].label} 推断`,
      });
    }

    if (getCoverageCodes(rule).length === 0) {
      issues.push({
        id: `${rule.rule_id}-coverage`,
        tone: rule.execution.domain === ExecutionDomain.ELIGIBILITY ? "warning" : "passed",
        scope: "rule",
        ruleId: rule.rule_id,
        message:
          rule.execution.domain === ExecutionDomain.ELIGIBILITY
            ? "未绑定责任代码，规则将作为案件级规则运行"
            : "未绑定责任代码",
      });
    }
  });

  if (ruleset.rules.length === 0) {
    issues.push({
      id: "empty",
      tone: "error",
      scope: "ruleset",
      message: "规则集为空，无法发布",
    });
  }

  if (!ruleset.policy_info.coverages?.length) {
    issues.push({
      id: "coverages",
      tone: "warning",
      scope: "ruleset",
      message: "未配置责任代码映射，验证与发布风险较高",
    });
  }

  return issues.filter((issue) => issue.tone !== "passed");
}

function buildCoverageResults(ruleset: InsuranceRuleset, ledger: ValidationSimulationResult["ledger"]) {
  const fallbackCoverage =
    ruleset.policy_info.coverages?.[0]?.coverage_code ||
    ruleset.rules.find((rule) => getCoverageCodes(rule).length > 0)?.applies_to?.coverage_codes?.[0] ||
    "UNASSIGNED";
  const payable = ledger.reduce((sum, item) => sum + item.payableAmount, 0);
  const claimed = ledger.reduce((sum, item) => sum + item.claimedAmount, 0);
  return [
    {
      coverageCode: fallbackCoverage,
      claimedAmount: claimed,
      payableAmount: payable,
      status: payable > 0 ? "PAYABLE" : "ZERO_PAY",
    },
  ];
}

function normalizeDateOnly(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const matched = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (matched) return matched[1];
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number) {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().split("T")[0];
}

function parsePastHistoryCertainty(historyText: unknown) {
  const text = typeof historyText === "string" ? historyText.trim() : "";
  if (!text) {
    return { certainty: "UNKNOWN" as const, text: null };
  }
  if (["无", "否认既往病史", "无特殊"].includes(text)) {
    return { certainty: "CLEAR" as const, text };
  }
  if (["不详", "不明"].includes(text)) {
    return { certainty: "UNKNOWN" as const, text };
  }
  return { certainty: "HAS_CONTENT" as const, text };
}

function synthesizePreExistingSignals(
  signals: Array<{ vote: "YES" | "NO"; weight: number }>,
  threshold: number,
) {
  const yesScore = Number(
    signals
      .filter((item) => item.vote === "YES")
      .reduce((sum, item) => sum + item.weight, 0)
      .toFixed(2),
  );
  const noScore = Number(
    signals
      .filter((item) => item.vote === "NO")
      .reduce((sum, item) => sum + item.weight, 0)
      .toFixed(2),
  );
  const total = yesScore + noScore;
  if (total === 0) {
    return {
      result: "UNCERTAIN" as const,
      confidence: 0,
      yesScore,
      noScore,
    };
  }
  const confidence = Number((Math.max(yesScore, noScore) / total).toFixed(2));
  if (confidence < threshold) {
    return {
      result: "UNCERTAIN" as const,
      confidence,
      yesScore,
      noScore,
    };
  }
  return {
    result: yesScore > noScore ? ("YES" as const) : ("NO" as const),
    confidence,
    yesScore,
    noScore,
  };
}

export function buildPreExistingAssessmentPreview(
  input: ValidationInputState,
  options: {
    includeAiStep?: boolean;
    source?: PreExistingAssessmentTrace["source"];
    aiTrace?: NonNullable<NonNullable<PreExistingAssessmentTrace["steps"]>["ai"]>;
  } = {},
): PreExistingAssessmentTrace {
  const threshold = 0.65;
  const historyParsed = parsePastHistoryCertainty(
    input.claim.pastMedicalHistory ?? input.claim.past_medical_history,
  );
  const firstDiagnosisDate = normalizeDateOnly(
    input.claim.firstDiagnosisDate ??
      input.claim.first_diagnosis_date ??
      input.claim.diagnosisDate ??
      input.claim.diagnosis_date ??
      input.claim.admissionDate ??
      input.claim.admission_date,
  );
  const policyEffectiveDate = normalizeDateOnly(
    input.policy.effectiveDate ?? input.policy.effective_date,
  );
  const waitingPeriodDays = Number(
    input.policy.waitingPeriodDays ?? input.policy.waiting_period_days ?? 0,
  );

  const evidence: string[] = [];
  const signals: Array<{ vote: "YES" | "NO"; weight: number }> = [];

  const historyStep: NonNullable<NonNullable<PreExistingAssessmentTrace["steps"]>["history"]> = {
    certainty: historyParsed.certainty,
    text: historyParsed.text,
    vote: null,
    weight: 0,
  };
  if (historyParsed.certainty === "CLEAR") {
    signals.push({ vote: "NO", weight: 0.6 });
    evidence.push(`既往史记录为“${historyParsed.text}”`);
    historyStep.vote = "NO";
    historyStep.weight = 0.6;
  } else if (historyParsed.certainty === "HAS_CONTENT") {
    signals.push({ vote: "YES", weight: 0.5 });
    evidence.push(`既往史记录：${historyParsed.text}`);
    historyStep.vote = "YES";
    historyStep.weight = 0.5;
  }

  let timeVerdict = "UNKNOWN";
  let timeReason = "保单生效日或首诊日期缺失";
  let timeVote: "YES" | "NO" | null = null;
  let timeWeight = 0;
  if (policyEffectiveDate && firstDiagnosisDate) {
    if (firstDiagnosisDate < policyEffectiveDate) {
      timeVerdict = "SUSPICIOUS";
      timeReason = `首诊日期(${firstDiagnosisDate})早于保单生效日(${policyEffectiveDate})`;
      timeVote = "YES";
      timeWeight = 0.7;
    } else if (waitingPeriodDays > 0) {
      const waitingEnd = addDays(policyEffectiveDate, waitingPeriodDays);
      if (waitingEnd && firstDiagnosisDate < waitingEnd) {
        timeVerdict = "SUSPICIOUS";
        timeReason = `首诊日期(${firstDiagnosisDate})在等待期内（等待期至${waitingEnd}）`;
        timeVote = "YES";
        timeWeight = 0.7;
      } else {
        timeVerdict = "CLEAR";
        timeReason = "时间逻辑无异常";
        timeVote = "NO";
        timeWeight = 0.4;
      }
    } else {
      timeVerdict = "CLEAR";
      timeReason = "时间逻辑无异常";
      timeVote = "NO";
      timeWeight = 0.4;
    }
  }
  if (timeVote) {
    signals.push({ vote: timeVote, weight: timeWeight });
    evidence.push(timeReason);
  }
  const timeStep: NonNullable<NonNullable<PreExistingAssessmentTrace["steps"]>["timeLogic"]> = {
    verdict: timeVerdict,
    reason: timeReason,
    firstDiagnosisDate,
    vote: timeVote,
    weight: timeWeight,
  };

  const preAiResult = synthesizePreExistingSignals(signals, threshold);
  const aiTrace =
    options.aiTrace ||
    ({
      invoked: false,
      skippedReason: options.includeAiStep
        ? historyParsed.certainty === "UNKNOWN"
          ? "既往史缺失或不详，不触发 AI"
          : preAiResult.result !== "UNCERTAIN"
            ? "文本与时间逻辑已足够确定"
            : "样例模式不调用 AI，仅展示是否会进入 AI"
        : "未提供 AI 调试结果",
      result: null,
      confidence: null,
      reasoning: "",
      voteWeight: 0,
    } as NonNullable<NonNullable<PreExistingAssessmentTrace["steps"]>["ai"]>);

  const aiSignal =
    aiTrace.invoked &&
    (aiTrace.result === "YES" || aiTrace.result === "NO") &&
    typeof aiTrace.confidence === "number"
      ? {
          vote: aiTrace.result,
          weight: Number((aiTrace.confidence * 0.8).toFixed(2)),
        }
      : null;
  const finalResult = aiSignal
    ? synthesizePreExistingSignals(signals.concat(aiSignal), threshold)
    : preAiResult;

  return {
    result: finalResult.result,
    confidence: finalResult.confidence,
    reasoning:
      finalResult.result === "UNCERTAIN"
        ? "信息不足，当前预览建议人工复核"
        : evidence.join("；"),
    evidence,
    historyText: historyParsed.text,
    evaluatedAt: new Date().toISOString(),
    source: options.source || "AUTO",
    input: {
      diagnosis:
        String(
          input.claim.diagnosis ??
            input.claim.diagnosisNames ??
            input.claim.diagnosis_names ??
            "",
        ) || null,
      diagnosisNames:
        input.claim.diagnosisNames ??
        input.claim.diagnosis_names ??
        null,
      pastMedicalHistory: historyParsed.text,
      firstDiagnosisDate,
      policyEffectiveDate,
      waitingPeriodDays,
    },
    steps: {
      history: historyStep,
      timeLogic: timeStep,
      ai: aiTrace,
      synthesis: {
        preAiResult: {
          result: preAiResult.result,
          confidence: preAiResult.confidence,
        },
        finalResult: {
          result: finalResult.result,
          confidence: finalResult.confidence,
        },
        yesScore: finalResult.yesScore,
        noScore: finalResult.noScore,
        threshold,
      },
    },
  };
}

export function buildValidationInput(ruleset: InsuranceRuleset): ValidationInputState {
  const coverage = ruleset.policy_info.coverages?.[0];
  const items =
    ruleset.product_line === "ACCIDENT" || ruleset.product_line === "HEALTH"
      ? [
          {
            itemName: "门诊检查费",
            amount: 580,
            isSocialInsuranceCovered: true,
            hospitalQualified: true,
            unitPriceDeviationPercent: 5,
          },
          {
            itemName: "药品费用",
            amount: 320,
            isSocialInsuranceCovered: false,
            hospitalQualified: true,
            unitPriceDeviationPercent: 35,
          },
        ]
      : [
          {
            itemName: "损失核定项目",
            amount: 4800,
            liabilityRatio: 0.7,
            approvedAmountBySurveyor: 4200,
          },
        ];

  return {
    policy: {
      productCode: ruleset.policy_info.product_code,
      effectiveDate: ruleset.policy_info.effective_date,
      expiryDate: ruleset.policy_info.expiry_date,
      isWithinCoveragePeriod: true,
      waitingPeriodDays: ruleset.product_line === "HEALTH" ? 30 : 0,
      coverageCode: coverage?.coverage_code || "",
      sumInsured: coverage?.sum_insured || 0,
      deductible: coverage?.deductible || 0,
      reimbursementRatio: coverage ? 1 - (coverage.co_pay_ratio || 0) : 1,
    },
    claim: {
      accidentDate: "2026-03-01",
      reportDate: "2026-03-02",
      resultType:
        ruleset.product_line === "CRITICAL_ILLNESS" ? "CRITICAL_ILLNESS" : "MEDICAL_TREATMENT",
      causeType: ruleset.product_line === "HEALTH" ? "DISEASE" : "ACCIDENT",
      scenario: ruleset.product_line === "ACCIDENT" ? "WORKSITE" : "INPATIENT",
      daysFromAccidentToResult: 4,
      hospitalDays: 3,
      liabilityRatio: 0.7,
      pastMedicalHistory:
        ruleset.product_line === "HEALTH" ? "不详" : "",
      firstDiagnosisDate: "2026-03-01",
      diagnosis: "急性上呼吸道感染",
      diagnosisNames: "急性上呼吸道感染",
    },
    items,
    missingFacts: [],
  };
}

export function buildValidationInputFromSnapshot(
  ruleset: InsuranceRuleset,
  snapshot: ClaimDocumentsSnapshot,
): ValidationInputState {
  const base = buildValidationInput(ruleset);
  const aggregation = snapshot.aggregation || {};
  const injuryProfile = aggregation.injuryProfile || {};
  const deathProfile = aggregation.deathProfile || {};
  const liabilityResult = aggregation.liabilityResult || {};
  const validationFacts = snapshot.validationFacts || {};

  const documentItems =
    snapshot.documents?.flatMap((document) => {
      const chargeItems =
        document.medicalData?.chargeItems ||
        ((document.structuredData?.chargeItems as Array<Record<string, unknown>> | undefined) ?? []);
      return chargeItems.map((item) => ({
        itemName: String(item.itemName || item.name || "费用项"),
        amount: Number(item.totalPrice || item.amount || 0),
      }));
    }) || [];

  const diagnosisNames = Array.isArray(injuryProfile.diagnosisNames)
    ? injuryProfile.diagnosisNames.filter(Boolean)
    : [];
  const missingFacts = Object.entries(validationFacts)
    .filter(([, value]) => value === null)
    .map(([key]) => key);

  return {
    policy: {
      ...base.policy,
      isWithinCoveragePeriod: true,
      waitingPeriodDays:
        Number(
          snapshot?.aggregation?.factModel?.canonicalFacts?.["policy.waiting_period_days"],
        ) || Number(base.policy.waitingPeriodDays || 0),
    },
    claim: {
      ...base.claim,
      resultType:
        ruleset.product_line === RulesetProductLine.CRITICAL_ILLNESS
          ? "CRITICAL_ILLNESS"
          : deathProfile.deathConfirmed
            ? "DEATH"
            : base.claim.resultType,
      causeType:
        ruleset.product_line === RulesetProductLine.HEALTH ||
        ruleset.product_line === RulesetProductLine.CRITICAL_ILLNESS
          ? "DISEASE"
          : base.claim.causeType,
      diagnosis: injuryProfile.injuryDescription || "",
      diagnosisNames: diagnosisNames.join("；"),
      diagnosisDate: injuryProfile.primaryDiagnosisDate || "",
      pastMedicalHistory:
        String(
          snapshot?.aggregation?.factModel?.canonicalFacts?.["claim.past_medical_history"] ||
            injuryProfile.pastHistory ||
            "",
        ) || "",
      firstDiagnosisDate:
        String(
          snapshot?.aggregation?.factModel?.canonicalFacts?.["claim.first_diagnosis_date"] ||
            injuryProfile.firstDiagnosisDate ||
            injuryProfile.primaryDiagnosisDate ||
            "",
        ) || "",
      hospitalDays: Number(injuryProfile.hospitalizationDays || base.claim.hospitalDays || 0),
      disabilityGrade: injuryProfile.disabilityLevel || "",
      liabilityRatio:
        typeof liabilityResult.thirdPartyLiabilityPct === "number"
          ? Number((liabilityResult.thirdPartyLiabilityPct / 100).toFixed(2))
          : base.claim.liabilityRatio,
      deathConfirmed: Boolean(deathProfile.deathConfirmed),
      deathDate: deathProfile.deathDate || "",
      specialDiseaseConfirmed:
        validationFacts["claim.special_disease_confirmed"] === true,
    },
    items: documentItems.length > 0 ? documentItems : base.items,
    missingFacts,
  };
}

export function transformFullReviewToValidationResult(
  ruleset: InsuranceRuleset,
  result: FullReviewApiResult,
): ValidationSimulationResult {
  const lossLedger = (result.amount?.lossLedger || []).map((item) => ({
    id: item.itemKey,
    title: item.itemName,
    claimedAmount: Number(item.claimedAmount || 0),
    payableAmount: Number(item.payableAmount || 0),
    status: item.status,
    entries: (item.entries || []).map((entry) => ({
      step: entry.step,
      beforeAmount: Number(entry.beforeAmount || 0),
      afterAmount: Number(entry.afterAmount || 0),
      reason: entry.message || entry.reasonCode || entry.step,
      ruleId: entry.ruleId,
    })),
  }));

  const benefitLedger = (result.amount?.benefitLedger || []).map((item) => ({
    id: item.coverageCode,
    title: item.coverageCode,
    claimedAmount: Number(item.claimedAmount || 0),
    payableAmount: Number(item.payableAmount || 0),
    status: item.status,
    entries: (item.entries || []).map((entry) => ({
      step: entry.step,
      beforeAmount: Number(entry.beforeAmount || 0),
      afterAmount: Number(entry.afterAmount || 0),
      reason: entry.message || entry.reasonCode || entry.step,
      ruleId: entry.ruleId,
    })),
  }));

  const ledger = [...lossLedger, ...benefitLedger];
  const matchedRuleIds = new Set([
    ...(result.eligibility?.matchedRules || []),
    ...((result.auditTrail || []).filter((item) => item.matched).map((item) => item.ruleId)),
  ]);
  const matchedRules =
    (result.matchedRuleDetails || []).length > 0
      ? (result.matchedRuleDetails || []).map((item) => ({
          ruleId: item.ruleId,
          ruleName: item.ruleName || item.ruleId,
          semantic: mapRuleKindToSemanticKey(item.ruleKind),
          fields: item.fields || [],
          effect: item.effect || item.actionType || "后端真实执行命中",
        }))
      : [...matchedRuleIds].map((ruleId) => ({
          ruleId,
          ruleName: ruleId,
          semantic: "post_process" as const,
          fields: [],
          effect: "后端真实执行命中",
        }));

  const explanationCards = buildExplanationCards(
    (result.manualReviewReasons || []).map((reason) => ({
      code: reason.code,
      message: reason.message,
    })),
    (result.warnings || []).map((message, index) => ({
      id: `backend-warning-${index}`,
      tone: "warning" as const,
      scope: "ruleset" as const,
      message,
    })),
  );

  return {
    decision: result.decision === "MANUAL_REVIEW" ? "MANUAL_REVIEW" : result.decision,
    summary:
      result.decision === "APPROVE"
        ? "后端真实试跑通过"
        : result.decision === "REJECT"
          ? "后端真实试跑判定拒赔"
          : "后端真实试跑建议人工复核",
    executionSource: "BACKEND",
    explanationCards,
    settlementMode: result.amount?.settlementMode || "LOSS",
    matchedRules,
    issues: (result.warnings || []).map((message, index) => ({
      id: `backend-warning-${index}`,
      tone: "warning",
      scope: "ruleset",
      message,
    })),
    ledger,
    lossLedger,
    benefitLedger,
    settlementBreakdown: result.amount?.settlementBreakdown || {
      lossPayableAmount: 0,
      benefitPayableAmount: 0,
      totalPayableAmount: 0,
    },
    coverageResults: (result.coverageResults || []).map((item) => ({
      coverageCode: item.coverageCode,
      claimedAmount: Number(item.claimedAmount || 0),
      payableAmount: Number(item.payableAmount ?? item.approvedAmount ?? 0),
      status: item.status || "PAYABLE",
    })),
    manualReviewReasons: (result.manualReviewReasons || []).map((reason) => ({
      code: reason.code,
      message: reason.message,
    })),
    preExistingAssessment: result.preExistingAssessment || null,
    steps: (result.auditTrail || []).map((item, index) => ({
      id: `audit-${index}`,
      label: item.stage,
      ruleId: item.ruleId,
      tone: item.matched ? "success" : "neutral",
      detail: `${item.ruleId}${item.matched ? " 命中" : " 未命中"}`,
    })),
  };
}

function evaluateLeaf(rule: RulesetRule, input: ValidationInputState): { matched: boolean; fields: string[] } {
  const fields = getRuleFields(rule);
  const matched = fields.every((field) => {
    if (field.startsWith("policy.")) {
      const key = field.replace("policy.", "");
      return input.policy[key] !== undefined && input.policy[key] !== "";
    }
    if (field.startsWith("claim.")) {
      const key = field.replace("claim.", "");
      return input.claim[key] !== undefined && input.claim[key] !== "";
    }
    if (field.startsWith("expense_item.") || field.startsWith("item.")) {
      const key = field.replace("expense_item.", "").replace("item.", "");
      return input.items.some((item) => item[key] !== undefined && item[key] !== "");
    }
    return false;
  });
  return { matched, fields };
}

export function simulateRulesetValidation(
  ruleset: InsuranceRuleset,
  input: ValidationInputState,
): ValidationSimulationResult {
  const issues = validateRuleset(ruleset);
  const preExistingAssessment =
    ruleset.product_line === RulesetProductLine.HEALTH
      ? buildPreExistingAssessmentPreview(input, {
          includeAiStep: true,
          source: "AUTO",
        })
      : null;
  const matchedRules: ValidationSimulationResult["matchedRules"] = [];
  const manualReviewReasons: ValidationSimulationResult["manualReviewReasons"] = [];
  const steps: ValidationSimulationStep[] = [];
  let decision: ValidationSimulationResult["decision"] = "APPROVE";

  const enabledRules = ruleset.rules.filter((rule) => rule.status !== RuleStatus.DISABLED);
  const gateRules = enabledRules.filter((rule) => getRuleSemantic(rule).key === "gate");
  const exclusionRules = enabledRules.filter((rule) => getRuleSemantic(rule).key === "exclusion");
  const triggerRules = enabledRules.filter((rule) => getRuleSemantic(rule).key === "trigger");
  const adjustmentRules = enabledRules.filter((rule) => getRuleSemantic(rule).key === "adjustment");

  const runGroup = (label: string, rules: RulesetRule[]) => {
    rules.forEach((rule) => {
      const { matched, fields } = evaluateLeaf(rule, input);
      if (!matched) {
        steps.push({
          id: `${label}-${rule.rule_id}`,
          label,
          field: fields[0],
          ruleId: rule.rule_id,
          tone: "neutral",
          detail: `${rule.rule_name} 未命中`,
        });
        return;
      }

      matchedRules.push({
        ruleId: rule.rule_id,
        ruleName: rule.rule_name,
        semantic: getRuleSemantic(rule).key,
        fields,
        effect: summarizeAction(rule),
      });
      steps.push({
        id: `${label}-${rule.rule_id}`,
        label,
        field: fields[0],
        ruleId: rule.rule_id,
        tone: rule.action.action_type === "REJECT_CLAIM" ? "danger" : "success",
        detail: `${rule.rule_name} · ${summarizeAction(rule)}`,
      });

      if (rule.action.action_type === "ROUTE_CLAIM_MANUAL") {
        decision = "MANUAL_REVIEW";
        manualReviewReasons.push({
          code: "RULE_REQUIRES_MANUAL",
          message: `${rule.rule_name} 要求人工复核`,
        });
      }
      if (rule.action.action_type === "REJECT_CLAIM" || rule.action.action_type === "TERMINATE_CONTRACT") {
        decision = "REJECT";
      }
    });
  };

  runGroup("准入", gateRules);
  if (decision !== "REJECT") {
    runGroup("免责", exclusionRules);
  }
  if (decision !== "REJECT") {
    runGroup("触发", triggerRules);
  }
  if (decision === "APPROVE") {
    runGroup("调整", adjustmentRules);
  }

  if (decision === "APPROVE" && triggerRules.length > 0 && !matchedRules.some((item) => item.semantic === "trigger")) {
    decision = input.missingFacts.length > 0 ? "MANUAL_REVIEW" : "REJECT";
  }

  if (input.missingFacts.length > 0) {
    decision = "MANUAL_REVIEW";
    manualReviewReasons.push({
      code: "MISSING_FACT",
      message: `缺失关键字段: ${input.missingFacts.join("、")}`,
    });
  }

  const lossLedger = input.items.map((item, index) => {
    const claimedAmount = Number(item.amount || 0);
    let payableAmount = claimedAmount;
    const entries = [
      {
        step: "初始化",
        beforeAmount: claimedAmount,
        afterAmount: claimedAmount,
        reason: "加载样例费用项",
      },
    ];

    const pricingRule = enabledRules.find((rule) => getRuleSemantic(rule).key === "item_pricing");
    if (pricingRule && claimedAmount > 0 && typeof item.unitPriceDeviationPercent === "number" && item.unitPriceDeviationPercent > 30) {
      const beforeAmount = payableAmount;
      payableAmount = Math.round(payableAmount * 0.8 * 100) / 100;
      entries.push({
        step: "限价",
        beforeAmount,
        afterAmount: payableAmount,
        reason: "单价偏差过高，按限价规则调减",
        ruleId: pricingRule.rule_id,
      });
    }

    const ratioRule = enabledRules.find((rule) => getRuleSemantic(rule).key === "item_ratio");
    if (ratioRule && item.isSocialInsuranceCovered === false) {
      const beforeAmount = payableAmount;
      payableAmount = Math.round(payableAmount * 0.8 * 100) / 100;
      entries.push({
        step: "比例",
        beforeAmount,
        afterAmount: payableAmount,
        reason: "目录外费用按 80% 试算",
        ruleId: ratioRule.rule_id,
      });
    }

    if (decision === "REJECT") {
      entries.push({
        step: "责任",
        beforeAmount: payableAmount,
        afterAmount: 0,
        reason: "责任结论拒赔，不进入赔付",
      });
      payableAmount = 0;
    }

    return {
      id: `ledger-${index}`,
      title: String(item.itemName || `项目 ${index + 1}`),
      claimedAmount,
      payableAmount,
      status:
        decision === "MANUAL_REVIEW"
          ? "MANUAL_REVIEW"
          : payableAmount > 0
            ? "PAYABLE"
            : "ZERO_PAY",
      entries,
    };
  });

  const benefitLedger =
    ruleset.product_line === RulesetProductLine.CRITICAL_ILLNESS ||
    (ruleset.product_line === RulesetProductLine.ACCIDENT && input.claim.resultType === "DEATH")
      ? [
          {
            id: `benefit-${ruleset.policy_info.product_code}`,
            title: ruleset.product_line === RulesetProductLine.CRITICAL_ILLNESS ? "重疾给付" : "意外身故给付",
            claimedAmount: 100000,
            payableAmount: decision === "REJECT" ? 0 : 100000,
            status:
              decision === "MANUAL_REVIEW"
                ? "MANUAL_REVIEW"
                : decision === "REJECT"
                  ? "ZERO_PAY"
                  : "PAYABLE",
            entries: [
              {
                step: "初始化",
                beforeAmount: 100000,
                afterAmount: 100000,
                reason: "载入给付基础金额",
              },
              {
                step: "触发",
                beforeAmount: 100000,
                afterAmount: decision === "REJECT" ? 0 : 100000,
                reason: decision === "REJECT" ? "责任拒赔，不进入给付" : "责任成立，进入给付",
              },
            ],
          },
        ]
      : [];

  const settlementMode =
    lossLedger.length > 0 && benefitLedger.length > 0
      ? "HYBRID"
      : benefitLedger.length > 0
        ? "BENEFIT"
        : "LOSS";
  const lossPayableAmount = lossLedger.reduce((sum, item) => sum + item.payableAmount, 0);
  const benefitPayableAmount = benefitLedger.reduce((sum, item) => sum + item.payableAmount, 0);
  const ledger = [...lossLedger, ...benefitLedger];

  if (decision === "MANUAL_REVIEW" && manualReviewReasons.length === 0) {
    manualReviewReasons.push({
      code: "RULESET_VALIDATION_WARNING",
      message: "规则命中结果存在待确认项，建议人工复核",
    });
  }

  const decisionLabel =
    decision === "APPROVE"
      ? "规则试跑通过，可进入赔付核定"
      : decision === "REJECT"
        ? "规则试跑判定拒赔，请核对责任与免责"
        : decision === "PARTIAL_APPROVE"
          ? "规则试跑返回部分赔付"
          : "规则试跑建议人工复核";

  const explanationCards = buildExplanationCards(manualReviewReasons, issues);

  return {
    decision,
    summary: decisionLabel,
    executionSource: "SIMULATED",
    explanationCards,
    settlementMode,
    matchedRules,
    issues,
    ledger,
    lossLedger,
    benefitLedger,
    settlementBreakdown: {
      lossPayableAmount,
      benefitPayableAmount,
      totalPayableAmount: lossPayableAmount + benefitPayableAmount,
    },
    coverageResults: buildCoverageResults(ruleset, ledger),
    manualReviewReasons,
    preExistingAssessment,
    steps,
  };
}

function buildExplanationCards(
  manualReviewReasons: Array<{ code: string; message: string }>,
  issues: ValidationIssue[],
) {
  const missingMaterials = manualReviewReasons
    .filter((reason) => reason.code === "MISSING_REQUIRED_MATERIALS")
    .map((reason) => reason.message);
  const coverageMappings = manualReviewReasons
    .filter((reason) => reason.code === "COVERAGE_CONFIG_MISSING")
    .map((reason) => reason.message);
  const missingFields = [
    ...manualReviewReasons
      .filter((reason) =>
        ["MISSING_FACT", "MISSING_LIABILITY_FIELDS", "CRITICAL_ILLNESS_DIAGNOSIS_MISSING", "CRITICAL_ILLNESS_DIAGNOSIS_DATE_MISSING", "DISABILITY_GRADE_MISSING", "HOSPITAL_DAYS_MISSING"].includes(reason.code),
      )
      .map((reason) => reason.message),
    ...issues
      .filter((issue) => issue.field || issue.message.includes("字段") || issue.message.includes("缺失"))
      .map((issue) => issue.message),
  ];

  const cards = [];
  if (missingMaterials.length > 0) {
    cards.push({
      id: "missing-materials",
      title: "材料缺口",
      tone: "danger" as const,
      items: [...new Set(missingMaterials)],
    });
  }
  if (coverageMappings.length > 0) {
    cards.push({
      id: "coverage-mapping",
      title: "保障映射缺口",
      tone: "warning" as const,
      items: [...new Set(coverageMappings)],
    });
  }
  if (missingFields.length > 0) {
    cards.push({
      id: "missing-fields",
      title: "关键字段缺口",
      tone: "warning" as const,
      items: [...new Set(missingFields)],
    });
  }
  return cards;
}

export function deriveRulesetHealth(ruleset: InsuranceRuleset): RulesetHealthSnapshot {
  const issues = validateRuleset(ruleset);
  const errorCount = issues.filter((issue) => issue.tone === "error").length;
  const warningCount = issues.filter((issue) => issue.tone === "warning").length;
  const validationTone: ValidationTone = errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "passed";
  const validationLabel = validationTone === "error" ? "规则冲突" : validationTone === "warning" ? "待校验" : "已验证";
  const versionState = ruleset.metadata.published_at ? "published" : "draft";
  const versionLabel = versionState === "published" ? "已发布" : "仅草稿";
  const dependencies = new Set<string>();

  ruleset.rules.forEach((rule) => {
    getRuleFields(rule).forEach((field) => dependencies.add(field));
  });

  return {
    coverageCount: ruleset.policy_info.coverages?.length || 0,
    effectiveRuleCount: ruleset.rules.filter((rule) => rule.status === RuleStatus.EFFECTIVE).length,
    draftRuleCount: ruleset.rules.filter((rule) => rule.status === RuleStatus.DRAFT).length,
    issueCount: errorCount,
    warningCount,
    validationTone,
    validationLabel,
    versionState,
    versionLabel,
    dependencyCount: dependencies.size,
  };
}

export function duplicateRuleset(ruleset: InsuranceRuleset): InsuranceRuleset {
  const timestamp = new Date().toISOString();
  const nextVersion = Number(ruleset.metadata.version) || 0;
  return {
    ...ruleset,
    ruleset_id: `${ruleset.ruleset_id}-COPY-${timestamp.slice(11, 19).replace(/:/g, "")}`,
    metadata: {
      ...ruleset.metadata,
      version: String(nextVersion + 1),
      generated_at: timestamp,
      published_at: undefined,
      published_by: undefined,
      latest_validation: undefined,
      audit_trail: [
        ...(ruleset.metadata.audit_trail || []),
        {
          timestamp,
          user_id: "ui",
          action: "DUPLICATED",
          details: `从 ${ruleset.ruleset_id} 复制生成新版本`,
        },
      ],
    },
  };
}

export function publishRuleset(ruleset: InsuranceRuleset): InsuranceRuleset {
  const now = new Date().toISOString();
  const issues = validateRuleset(ruleset);
  return {
    ...ruleset,
    metadata: {
      ...ruleset.metadata,
      published_at: now,
      published_by: "ui",
      latest_validation: {
        status: issues.some((issue) => issue.tone === "error")
          ? "error"
          : issues.some((issue) => issue.tone === "warning")
            ? "warning"
            : "passed",
        validated_at: now,
        issue_count: issues.length,
        summary: issues.length > 0 ? `发布前识别 ${issues.length} 个问题` : "发布前校验通过",
      },
      audit_trail: [
        ...(ruleset.metadata.audit_trail || []),
        {
          timestamp: now,
          user_id: "ui",
          action: "PUBLISHED",
          details: "从规则中心发布",
        },
      ],
    },
  };
}
