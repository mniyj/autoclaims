import { readData } from "../utils/fileStore.js";

function includesAnyText(target, candidates = []) {
  const normalized = String(target || "").toLowerCase();
  if (!normalized) return false;
  return candidates.some((item) => normalized.includes(String(item || "").toLowerCase()));
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

  if (includesAnyText(product?.primaryCategory, ["健康保险", "医疗保险", "健康"])) {
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
  if (includesAnyText(categoryText, ["机动车", "车险", "交强", "车损", "AUTO"])) {
    return "AUTO";
  }
  if (includesAnyText(categoryText, ["健康", "医疗", "A01"])) {
    return "HEALTH";
  }
  if (includesAnyText(categoryText, ["意外", "C01"])) {
    return "ACCIDENT";
  }

  if (
    includesAnyText(text, [
      "责任保险",
      "雇主责任",
      "公众责任",
      "机械责任",
      "作业责任",
      "工程机械第三者责任",
      "工程机械作业责任",
      "第三者责任",
    ])
  ) {
    return "LIABILITY";
  }
  if (includesAnyText(text, ["医疗", "健康", "住院", "门诊", "重疾"])) {
    return "HEALTH";
  }
  if (includesAnyText(text, ["意外", "身故", "伤残"])) {
    return "ACCIDENT";
  }
  if (includesAnyText(text, ["车险", "机动车", "汽车", "交强", "车损", "商业车险"])) {
    return "AUTO";
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
  const medicalExpense = Number(aggregation?.expenseAggregation?.medicalTotal || 0);
  const hasLiabilityEvidence =
    Boolean(aggregation?.liabilityResult) ||
    Boolean(aggregation?.liabilityApportionment) ||
    (materials || []).some((item) => ["mat-57", "mat-58", "mat-64", "mat-66"].includes(item?.materialId));

  if (productLine === "AUTO") {
    return medicalExpense > 0 ? "auto_injury" : "auto_property_damage";
  }
  if (productLine === "LIABILITY" && deathConfirmed) {
    return "liability_death";
  }
  if (productLine === "HEALTH" || medicalExpense > 0) {
    return "medical_expense";
  }
  if (deathConfirmed && hasLiabilityEvidence) {
    return "liability_death";
  }
  if (deathConfirmed) {
    return "accident_benefit";
  }
  if (productLine === "ACCIDENT") {
    return medicalExpense > 0 ? "medical_expense" : "accident_benefit";
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
      return ["material_overview", "fact_cards", "decision_trace", "validation", "expense_report"];
    case "liability_death":
      return ["material_overview", "fact_cards", "decision_trace", "validation", "liability_report"];
    case "accident_benefit":
      return ["material_overview", "fact_cards", "decision_trace", "validation", "benefit_report"];
    case "auto_property_damage":
    case "auto_injury":
      return ["material_overview", "fact_cards", "decision_trace", "validation", "auto_report"];
    default:
      return ["material_overview", "fact_cards", "decision_trace", "validation"];
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

  const reviewProfileCode =
    handlingProfile?.profileCode ||
    (claimScenario === "medical_expense"
      ? "medical_expense_reimbursement"
      : claimScenario === "liability_death"
        ? "liability_death_third_party"
        : claimScenario === "accident_benefit"
          ? "accident_death_benefit"
          : "generic_claim_review");

  return {
    claimCaseId: claimCase?.id || aggregation?.claimCaseId || null,
    productLine,
    claimScenario,
    reviewProfileCode,
    coverageFamily: inferCoverageFamily({ productLine, aggregation }),
    requiresLiabilityAssessment: ["liability_death", "auto_property_damage", "auto_injury"].includes(claimScenario),
    requiresExpenseAssessment: ["medical_expense", "auto_injury", "auto_property_damage", "liability_death"].includes(claimScenario),
    requiresBenefitAssessment: ["accident_benefit"].includes(claimScenario),
    requiresDeductionAssessment: ["liability_death"].includes(claimScenario),
    requiredModules: buildRequiredModules({ scenario: claimScenario }),
    isMedicalScenario: claimScenario === "medical_expense",
    isLiabilityScenario: claimScenario === "liability_death",
    isBenefitScenario: claimScenario === "accident_benefit",
    isAutoScenario: ["auto_property_damage", "auto_injury"].includes(claimScenario),
  };
}
