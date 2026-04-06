import { readData } from "../utils/fileStore.js";

function includesAnyText(target, candidates = []) {
  const normalized = String(target || "").toLowerCase();
  if (!normalized) return false;
  return candidates.some((item) =>
    normalized.includes(String(item || "").toLowerCase()),
  );
}

function buildProductContext(claimCase = null) {
  const products = readData("products") || [];
  const product = claimCase?.productCode
    ? products.find((item) => item.productCode === claimCase.productCode)
    : null;

  return {
    product,
    categoryText: [
      product?.primaryCategory,
      product?.secondaryCategory,
      product?.racewayName,
      product?.primaryCategoryCode,
      product?.secondaryCategoryCode,
      product?.racewayId,
    ]
      .filter(Boolean)
      .join(" "),
    text: [
      product?.primaryCategory,
      product?.secondaryCategory,
      product?.racewayName,
      product?.marketingName,
      product?.regulatoryName,
      product?.productSummary,
      Array.isArray(product?.tags) ? product.tags.join(" ") : "",
      claimCase?.productName,
      claimCase?.insuranceType,
      claimCase?.accidentReason,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function inferProductLine({ claimCase = null, aggregation = null } = {}) {
  const { product, categoryText, text } = buildProductContext(claimCase);

  if (
    includesAnyText(product?.primaryCategory, ["健康保险", "医疗保险", "健康"])
  ) {
    return "HEALTH";
  }
  if (includesAnyText(product?.primaryCategory, ["意外保险", "意外"])) {
    return "ACCIDENT";
  }
  if (includesAnyText(product?.primaryCategory, ["责任保险", "责任"])) {
    return "LIABILITY";
  }
  if (includesAnyText(product?.primaryCategory, ["机动车", "车险"])) {
    return "AUTO";
  }

  if (
    includesAnyText(categoryText, [
      "工程机械第三者责任",
      "工程机械作业责任",
      "雇主责任",
      "公众责任",
      "产品责任",
      "责任保险",
      "L01",
      "L0101",
    ])
  ) {
    return "LIABILITY";
  }
  if (
    includesAnyText(categoryText, ["机动车", "车险", "交强", "车损", "AUTO"])
  ) {
    return "AUTO";
  }
  if (includesAnyText(categoryText, ["健康", "医疗", "A01"])) {
    return "HEALTH";
  }
  if (includesAnyText(categoryText, ["意外", "C01"])) {
    return "ACCIDENT";
  }

  // 第三层：全文本模糊匹配 — 使用评分机制避免歧义
  // 例如"意外住院医疗"同时命中 ACCIDENT 和 HEALTH，需按匹配数量择优
  const textCandidates = {
    LIABILITY: [
      "责任保险",
      "雇主责任",
      "公众责任",
      "机械责任",
      "作业责任",
      "工程机械第三者责任",
      "工程机械作业责任",
      "第三者责任",
    ],
    HEALTH: ["医疗", "健康", "住院", "门诊", "重疾"],
    ACCIDENT: ["意外", "身故", "伤残"],
    AUTO: ["车险", "机动车", "汽车", "交强", "车损", "商业车险"],
  };

  const normalizedText = String(text || "").toLowerCase();
  const scores = {};
  for (const [line, keywords] of Object.entries(textCandidates)) {
    const matchCount = keywords.filter((kw) =>
      normalizedText.includes(kw.toLowerCase()),
    ).length;
    if (matchCount > 0) scores[line] = matchCount;
  }

  // 选择匹配关键词最多的产品线（同分时按 LIABILITY > HEALTH > ACCIDENT > AUTO 优先）
  const priorityOrder = ["LIABILITY", "HEALTH", "ACCIDENT", "AUTO"];
  const bestMatch = priorityOrder
    .filter((line) => scores[line] > 0)
    .sort((a, b) => scores[b] - scores[a])[0];

  if (bestMatch) {
    return bestMatch;
  }
  if (String(claimCase?.insuranceType || "").toUpperCase() === "AUTO") {
    return "AUTO";
  }

  if (aggregation?.deathProfile?.deathConfirmed) {
    return "ACCIDENT";
  }
  if (Number(aggregation?.expenseAggregation?.medicalTotal || 0) > 0) {
    return "HEALTH";
  }
  return "UNKNOWN";
}

function inferScenario({
  productLine,
  claimCase = null,
  aggregation = null,
  materials = [],
  handlingProfile = null,
} = {}) {
  if (handlingProfile?.profileCode === "medical_expense_reimbursement") {
    return "medical_expense";
  }
  if (handlingProfile?.profileCode === "liability_death_third_party") {
    return "liability_death";
  }
  if (handlingProfile?.profileCode === "accident_death_benefit") {
    return "accident_benefit";
  }

  const deathConfirmed = Boolean(aggregation?.deathProfile?.deathConfirmed);
  const medicalExpense = Number(
    aggregation?.expenseAggregation?.medicalTotal || 0,
  );
  const hasLiabilityEvidence =
    Boolean(aggregation?.liabilityResult) ||
    Boolean(aggregation?.liabilityApportionment) ||
    (materials || []).some((item) =>
      ["mat-57", "mat-58", "mat-64", "mat-66"].includes(item?.materialId),
    );

  if (productLine === "AUTO") {
    return medicalExpense > 0 ? "auto_injury" : "auto_property_damage";
  }
  if (productLine === "LIABILITY" && deathConfirmed) {
    return "liability_death";
  }
  if (productLine === "HEALTH") {
    return "medical_expense";
  }
  if (deathConfirmed && hasLiabilityEvidence) {
    return "liability_death";
  }
  if (deathConfirmed) {
    return "accident_benefit";
  }
  if (productLine === "ACCIDENT") {
    // 意外险 + 有医疗费 → accident_medical（复合场景：同时需要费用核定和可能的伤残定损）
    if (medicalExpense > 0) return "accident_medical";
    return "accident_benefit";
  }
  // 非 ACCIDENT 产品线但有医疗费，回退到 medical_expense
  if (medicalExpense > 0) {
    return "medical_expense";
  }

  return "unknown";
}

function inferCoverageFamily({ productLine, aggregation = null }) {
  if (productLine === "HEALTH") {
    return ["expense", "medical"];
  }
  if (productLine === "AUTO") {
    return ["liability", "property_damage"];
  }
  if (productLine === "LIABILITY") {
    return ["liability", "damage"];
  }
  if (aggregation?.deathProfile?.deathConfirmed) {
    return ["benefit", "death"];
  }
  return ["generic"];
}

function buildRequiredModules({ scenario }) {
  switch (scenario) {
    case "medical_expense":
      return [
        "material_overview",
        "fact_cards",
        "decision_trace",
        "validation",
        "expense_report",
      ];
    case "liability_death":
      return [
        "material_overview",
        "fact_cards",
        "decision_trace",
        "validation",
        "liability_report",
      ];
    case "accident_benefit":
      return [
        "material_overview",
        "fact_cards",
        "decision_trace",
        "validation",
        "benefit_report",
      ];
    case "accident_medical":
      return [
        "material_overview",
        "fact_cards",
        "decision_trace",
        "validation",
        "expense_report",
        "benefit_report",
      ];
    case "auto_property_damage":
    case "auto_injury":
      return [
        "material_overview",
        "fact_cards",
        "decision_trace",
        "validation",
        "auto_report",
      ];
    default:
      return [
        "material_overview",
        "fact_cards",
        "decision_trace",
        "validation",
      ];
  }
}

export function resolveClaimDomainModel({
  claimCase = null,
  aggregation = null,
  materials = [],
  handlingProfile = null,
} = {}) {
  const productLine = inferProductLine({ claimCase, aggregation });
  const claimScenario = inferScenario({
    productLine,
    claimCase,
    aggregation,
    materials,
    handlingProfile,
  });

  const SCENARIO_PROFILE_MAP = {
    medical_expense: "medical_expense_reimbursement",
    accident_medical: "medical_expense_reimbursement",
    liability_death: "liability_death_third_party",
    accident_benefit: "accident_death_benefit",
  };
  const reviewProfileCode =
    handlingProfile?.profileCode ||
    SCENARIO_PROFILE_MAP[claimScenario] ||
    "generic_claim_review";

  return {
    claimCaseId: claimCase?.id || aggregation?.claimCaseId || null,
    productLine,
    claimScenario,
    reviewProfileCode,
    coverageFamily: inferCoverageFamily({ productLine, aggregation }),
    requiresLiabilityAssessment: [
      "liability_death",
      "auto_property_damage",
      "auto_injury",
    ].includes(claimScenario),
    requiresExpenseAssessment: [
      "medical_expense",
      "accident_medical",
      "auto_injury",
      "auto_property_damage",
      "liability_death",
    ].includes(claimScenario),
    requiresBenefitAssessment: [
      "accident_benefit",
      "accident_medical",
    ].includes(claimScenario),
    requiresDeductionAssessment: ["liability_death"].includes(claimScenario),
    requiredModules: buildRequiredModules({ scenario: claimScenario }),
    isMedicalScenario: ["medical_expense", "accident_medical"].includes(
      claimScenario,
    ),
    isLiabilityScenario: claimScenario === "liability_death",
    isBenefitScenario: ["accident_benefit", "accident_medical"].includes(
      claimScenario,
    ),
    isAccidentMedicalScenario: claimScenario === "accident_medical",
    isAutoScenario: ["auto_property_damage", "auto_injury"].includes(
      claimScenario,
    ),
  };
}
