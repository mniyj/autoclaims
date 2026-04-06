import { readData } from "../utils/fileStore.js";
import { resolveClaimDomainModel } from "./claimDomainService.js";

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function includesAnyText(target, candidates = []) {
  const normalizedTarget = normalizeText(target);
  if (!normalizedTarget) return false;
  return (candidates || []).some((candidate) =>
    normalizedTarget.includes(normalizeText(candidate)),
  );
}

function buildProfileContext({
  claimCase = null,
  aggregation = null,
  materials = [],
} = {}) {
  const deathConfirmed = Boolean(aggregation?.deathProfile?.deathConfirmed);
  const liabilityEvidenceCount = Array.isArray(aggregation?.liabilityEvidence)
    ? aggregation.liabilityEvidence.length
    : 0;
  const identityChainEvidence = Array.isArray(
    aggregation?.identityChainEvidence,
  )
    ? aggregation.identityChainEvidence
    : Array.isArray(aggregation?.employmentEvidence)
      ? aggregation.employmentEvidence
      : [];
  const identityChainEvidenceCount = identityChainEvidence.length;
  const recognizedPayment = Number(
    aggregation?.paymentSummary?.confirmedPaidAmount || 0,
  );
  const medicalExpense = Number(
    aggregation?.expenseAggregation?.medicalTotal || 0,
  );
  const relationshipCount = Array.isArray(aggregation?.deathProfile?.claimants)
    ? aggregation.deathProfile.claimants.length
    : 0;
  const materialIds = new Set(
    (materials || [])
      .map((item) => item?.materialId || item?.classification?.materialId)
      .filter(Boolean),
  );
  const insuranceType =
    claimCase?.insuranceType || claimCase?.productName || "";
  const accidentReason =
    claimCase?.accidentReason || claimCase?.selectedAccidentCauseId || "";

  return {
    claimCaseId: claimCase?.id || aggregation?.claimCaseId || null,
    productCode: claimCase?.productCode || null,
    insuranceType,
    accidentReason,
    deathConfirmed,
    hasLiabilityEvidence:
      liabilityEvidenceCount > 0 ||
      Boolean(aggregation?.liabilityResult) ||
      Boolean(aggregation?.liabilityApportionment) ||
      ["mat-57", "mat-58", "mat-64", "mat-66"].some((id) =>
        materialIds.has(id),
      ),
    hasLiabilityRatio: Boolean(
      aggregation?.liabilityApportionment?.thirdPartyLiabilityPct ||
      aggregation?.liabilityResult?.thirdPartyLiabilityPct,
    ),
    hasNoLiabilityEvidence:
      liabilityEvidenceCount === 0 &&
      !aggregation?.liabilityResult &&
      !aggregation?.liabilityApportionment,
    hasIdentityChainEvidence:
      identityChainEvidenceCount > 0 || materialIds.has("mat-64"),
    hasRecognizedPayment: recognizedPayment > 0,
    hasMedicalExpense: medicalExpense > 0,
    hasRegionalStandards: Boolean(aggregation?.regionalStandards),
    hasClaimantRelationship: relationshipCount > 0 || materialIds.has("mat-45"),
    materialIds: Array.from(materialIds),
    recognizedPayment,
    medicalExpense,
    claimantsCount: relationshipCount,
    matchesLiabilityReason:
      includesAnyText(insuranceType, ["责任", "机械", "三者", "雇主"]) ||
      includesAnyText(accidentReason, ["事故", "作业", "第三者"]),
    matchesMedicalClaim:
      includesAnyText(accidentReason, ["疾病", "门诊", "住院", "医疗"]) ||
      includesAnyText(insuranceType, ["医疗", "门诊", "急诊", "住院"]) ||
      includesAnyText(claimCase?.intakeFormData?.claim_type || "", [
        "医疗",
        "报销",
      ]),
  };
}

function checkFlag(context, flag) {
  return Boolean(context?.[flag]);
}

function matchesTriggers(profile, context) {
  const triggers = profile?.triggers || {};
  if (
    typeof triggers.deathConfirmed === "boolean" &&
    Boolean(context.deathConfirmed) !== triggers.deathConfirmed
  ) {
    return false;
  }

  if (
    Array.isArray(triggers.requiresAll) &&
    triggers.requiresAll.some((flag) => !checkFlag(context, flag))
  ) {
    return false;
  }

  if (Array.isArray(triggers.requiresAny) && triggers.requiresAny.length > 0) {
    const matched = triggers.requiresAny.some((flag) =>
      checkFlag(context, flag),
    );
    if (!matched) return false;
  }

  return true;
}

function loadProfiles() {
  return readData("handling-profiles") || [];
}

export function resolveHandlingProfile({
  claimCase = null,
  aggregation = null,
  materials = [],
} = {}) {
  const profiles = loadProfiles()
    .slice()
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  const context = buildProfileContext({ claimCase, aggregation, materials });
  const matched =
    profiles.find((profile) => matchesTriggers(profile, context)) || null;

  return {
    context,
    profile: matched,
  };
}

export function buildProfileReviewTasks({
  profile = null,
  context = null,
} = {}) {
  if (!profile || !context) return [];
  return (profile.reviewChecklistTemplate || [])
    .filter((item) => !item.when || checkFlag(context, item.when))
    .map((item) => ({
      code: item.code,
      title: item.title,
      severity: item.severity || "warning",
      blocking: Boolean(item.blocking),
      question: item.question || item.title,
      status: "pending",
    }));
}

export function summarizeHandlingProfile({
  claimCase = null,
  aggregation = null,
  materials = [],
} = {}) {
  const { context, profile } = resolveHandlingProfile({
    claimCase,
    aggregation,
    materials,
  });
  const reviewTasks = buildProfileReviewTasks({ profile, context });
  const domainModel = resolveClaimDomainModel({
    claimCase,
    aggregation,
    materials,
    handlingProfile: profile,
  });

  return {
    profileCode: profile?.profileCode || "generic_claim_review",
    profileName: profile?.profileName || "通用案件审核",
    description:
      profile?.description ||
      "当前案件未命中特定处理画像，按通用案件审核模式处理。",
    factSchema: profile?.factSchema || { groups: [] },
    processingStrategy: profile?.processingStrategy || {},
    uiModules: profile?.uiModules || {},
    reviewTasks,
    context,
    domainModel,
  };
}
