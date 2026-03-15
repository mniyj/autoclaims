import { readData } from '../utils/fileStore.js';
import { normalizeClaimContext } from '../claims/normalizers/claimNormalizer.js';
import { evaluateMedicalCatalogItems, evaluateHospitalRequirement } from '../claims/medical/review.js';

const COVERAGE_CODE_ALIASES = {
  ACC_DISABILITY: ['ACC_DEATH_DISAB'],
  ACC_DEATH: ['ACC_DEATH_DISAB'],
  HLT_INPATIENT: ['HEALTH_MEDICAL']
};

function toDateOnly(value) {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const matched = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (matched) return matched[1];
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().split('T')[0];
}

function calculateDateDiff(startDate, endDate) {
  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  if (!start || !end) return undefined;

  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(diff)) return undefined;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function inferCauseType(claimContext = {}) {
  const reason = [
    claimContext.cause_type,
    claimContext.causeType,
    claimContext.accident_reason,
    claimContext.accidentReason
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!reason) return undefined;
  if (/(意外|事故|撞|摔|伤|交通)/.test(reason)) return 'ACCIDENT';
  if (/(疾病|病|感染|肿瘤|癌)/.test(reason)) return 'DISEASE';
  if (/(自伤|自残|自杀)/.test(reason)) return 'SELF_INFLICTED';
  return undefined;
}

function inferResultType(claimContext = {}) {
  if (claimContext.result_type) return claimContext.result_type;
  if (claimContext.death_confirmed) return 'DEATH';
  if (claimContext.disability_grade !== null && claimContext.disability_grade !== undefined && claimContext.disability_grade !== '') {
    return 'DISABILITY';
  }
  if ((claimContext.expense_items || []).length > 0 || claimContext.hospital_name) {
    return 'MEDICAL_TREATMENT';
  }
  return undefined;
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    return value;
  }
  return undefined;
}

function applyCanonicalClaimFacts(claimContext = {}, canonicalFacts = {}) {
  const next = { ...claimContext };
  Object.entries(canonicalFacts || {}).forEach(([factKey, value]) => {
    if (!String(factKey).startsWith('claim.')) return;
    const claimKey = String(factKey).replace(/^claim\./, '');
    if (next[claimKey] === undefined || next[claimKey] === null || next[claimKey] === '') {
      next[claimKey] = value;
    }
    const snakeKey = claimKey.replace(/[A-Z]/g, (matched) => `_${matched.toLowerCase()}`);
    if (next[snakeKey] === undefined || next[snakeKey] === null || next[snakeKey] === '') {
      next[snakeKey] = value;
    }
  });
  return next;
}

function isWithinCoveragePeriod(accidentDate, effectiveDate, expiryDate) {
  const accident = toDateOnly(accidentDate);
  const effective = toDateOnly(effectiveDate);
  const expiry = toDateOnly(expiryDate);
  if (!accident || !effective || !expiry) return undefined;
  return accident >= effective && accident <= expiry;
}

function buildFacts({ claimCaseId, effectiveProductCode, policyInfo, claimContext, resolvedValidationFacts, product }) {
  const coveragePeriod = isWithinCoveragePeriod(
    claimContext.accident_date,
    policyInfo.effective_date,
    policyInfo.expiry_date
  );
  const resultDate = claimContext.result_date || claimContext.discharge_date || claimContext.invoice_date || claimContext.report_time;
  const daysFromAccidentToResult = calculateDateDiff(claimContext.accident_date, resultDate);
  const causeType = inferCauseType(claimContext);
  const resultType = inferResultType(claimContext);

  return {
    common: {
      claimId: claimCaseId,
      productCode: effectiveProductCode,
      productLine: product?.primaryCategoryCode || product?.primaryCategory || policyInfo.product_line || 'UNKNOWN'
    },
    policy: {
      productCode: effectiveProductCode,
      productName: policyInfo.product_name,
      effectiveDate: policyInfo.effective_date,
      expiryDate: policyInfo.expiry_date,
      isWithinCoveragePeriod: coveragePeriod,
      coverages: policyInfo.coverages || []
    },
    claim: {
      accidentDate: claimContext.accident_date,
      reportDate: claimContext.report_time,
      resultDate,
      daysFromAccidentToResult,
      causeType,
      resultType,
      hospitalName: claimContext.hospital_name,
      disabilityGrade: claimContext.disability_grade,
      hospitalDays: claimContext.hospital_days,
      diagnosis: claimContext.diagnosis,
      diagnosisDate: claimContext.diagnosis_date,
      diagnosisNames: claimContext.diagnosis_names || [],
      specialDiseaseConfirmed:
        claimContext.special_disease_confirmed ??
        claimContext.specialDiseaseConfirmed ??
        undefined,
      faultRatio: claimContext.fault_ratio,
      insuredLiabilityRatio: claimContext.insured_liability_ratio,
      claimantLiabilityPct: claimContext.claimant_liability_pct,
      expenseItems: claimContext.expense_items || []
    },
    validation: resolvedValidationFacts
  };
}


/**
 * 根据案件ID获取案件数据
 * @param {string} claimCaseId - 案件ID
 * @returns {object|null} 案件数据
 */
export function getClaimCase(claimCaseId) {
  const claimCases = readData('claim-cases');
  return claimCases.find(c => c.id === claimCaseId || c.reportNumber === claimCaseId) || null;
}

/**
 * 根据产品代码获取产品数据
 * @param {string} productCode - 产品代码
 * @returns {object|null} 产品数据
 */
export function getProduct(productCode) {
  const products = readData('products');
  return products.find(p => p.productCode === productCode) || null;
}

export function getPolicy(policyIdentifier, productCode = null) {
  const policies = readData('policies') || [];
  if (policyIdentifier) {
    const exact = policies.find((item) =>
      item.policyNumber === policyIdentifier ||
      item.policyNo === policyIdentifier ||
      item.policy_number === policyIdentifier ||
      item.id === policyIdentifier
    );
    if (exact) {
      return exact;
    }
  }
  if (!productCode) {
    return null;
  }
  return policies.find((item) => item.productCode === productCode) || null;
}

function normalizeName(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function resolveBoundPolicy(claimCase = {}, explicitProductCode = null) {
  const identifiers = [
    claimCase.policyNumber,
    claimCase.policyNo,
    claimCase.policy_number,
    claimCase.boundPolicyNumber,
    claimCase.boundPolicyNo,
    claimCase.bound_policy_number,
    claimCase.policyId,
    claimCase.boundPolicyId,
  ].filter(Boolean);

  for (const identifier of identifiers) {
    const policy = getPolicy(identifier, explicitProductCode || claimCase.productCode);
    if (policy) {
      return policy;
    }
  }

  return null;
}

function resolveBoundInsured(boundPolicy = null, claimCase = {}, claimContext = {}) {
  if (!boundPolicy || !Array.isArray(boundPolicy.insureds) || boundPolicy.insureds.length === 0) {
    return {
      matched: null,
      matchStatus: null,
      insuredName: null,
    };
  }

  const claimInsuredName = normalizeName(
    claimContext.insured ||
      claimContext.patient_name ||
      claimCase.insured ||
      claimCase.reporter
  );

  if (!claimInsuredName) {
    return {
      matched: null,
      matchStatus: null,
      insuredName: null,
    };
  }

  const matched = boundPolicy.insureds.find((item) => normalizeName(item?.name) === claimInsuredName) || null;
  return {
    matched,
    matchStatus: matched ? true : false,
    insuredName: claimInsuredName,
  };
}

function mergePolicyInfo({ ruleset, boundPolicy, effectiveProductCode, product }) {
  const policyInfo = {
    ...(ruleset?.policy_info || {}),
  };

  if (boundPolicy) {
    policyInfo.policy_no =
      boundPolicy.policyNumber ||
      boundPolicy.policyNo ||
      boundPolicy.policy_number ||
      policyInfo.policy_no;
    policyInfo.product_code = boundPolicy.productCode || policyInfo.product_code || effectiveProductCode;
    policyInfo.product_name = boundPolicy.productName || policyInfo.product_name || product?.marketingName || product?.regulatoryName;
    policyInfo.insurer = boundPolicy.companyName || policyInfo.insurer;
    policyInfo.effective_date = boundPolicy.effectiveDate || policyInfo.effective_date;
    policyInfo.expiry_date = boundPolicy.expiryDate || policyInfo.expiry_date;
    policyInfo.bound_policy = boundPolicy;
    policyInfo.bound_policy_number = boundPolicy.policyNumber || boundPolicy.policyNo || boundPolicy.policy_number || null;
    policyInfo.bound_policy_product_code = boundPolicy.productCode || null;
    policyInfo.bound_policy_product_name = boundPolicy.productName || null;
    policyInfo.bound_policyholder = boundPolicy.policyholder || null;
    policyInfo.bound_insureds = boundPolicy.insureds || [];
    policyInfo.payment_mode = boundPolicy.paymentFrequency || policyInfo.payment_mode;
  }

  return policyInfo;
}

function inferCauseTypeForMedical(claimContext = {}, claimCase = {}, product = null) {
  const explicit = inferCauseType(claimContext);
  if (explicit) return explicit;

  const intakeCause = [
    claimCase?.intakeFormData?.cause_type,
    claimCase?.intakeFormData?.claim_type,
    claimCase?.accidentReason,
    claimContext?.accident_reason,
  ]
    .filter(Boolean)
    .join(' ');

  if (/(意外)/.test(intakeCause)) return 'ACCIDENT';
  if (/(疾病|医疗|门诊|急诊|就诊)/.test(intakeCause)) return 'DISEASE';

  const productText = [
    product?.primaryCategory,
    product?.secondaryCategory,
    product?.racewayName,
    product?.marketingName,
  ].filter(Boolean).join(' ');
  if (/(门急诊|住院|医疗)/.test(productText)) {
    return 'DISEASE';
  }

  return undefined;
}

function inferSettledWithSocialSecurity(claimContext = {}) {
  const explicit = pickFirstNonEmpty(
    claimContext.settled_with_social_security,
    claimContext.settledWithSocialSecurity,
    claimContext.social_settled,
    claimContext.socialSettled,
  );
  if (explicit !== undefined) {
    return Boolean(explicit);
  }

  const socialPaid = Number(
    claimContext.social_insurance_paid ??
      claimContext.socialInsurancePaid ??
      0
  );
  const personalSelfPay = Number(
    claimContext.personal_self_pay ??
      claimContext.personalSelfPay ??
      0
  );
  const personalSelfExpense = Number(
    claimContext.personal_self_expense ??
      claimContext.personalSelfExpense ??
      0
  );

  if (socialPaid > 0) {
    return true;
  }
  if (socialPaid === 0 && (personalSelfPay > 0 || personalSelfExpense > 0)) {
    return false;
  }
  return null;
}

function resolveMedicalNecessity(claimContext = {}, latestAggregation = null) {
  if (claimContext.medically_necessary !== undefined && claimContext.medically_necessary !== null) {
    return Boolean(claimContext.medically_necessary);
  }
  const hasDiagnosis =
    Boolean(claimContext.diagnosis) ||
    (Array.isArray(claimContext.diagnosis_names) && claimContext.diagnosis_names.length > 0) ||
    Boolean(latestAggregation?.injuryProfile?.injuryDescription);
  const hasExpenses = Array.isArray(claimContext.expense_items) && claimContext.expense_items.length > 0;
  return hasDiagnosis && hasExpenses ? true : null;
}

/**
 * 根据产品代码获取规则集
 * @param {string} productCode - 产品代码
 * @returns {object|null} 规则集
 */
export function getRuleset(productCode, rulesetOverride = null) {
  if (rulesetOverride) {
    return rulesetOverride;
  }
  const rulesets = readData('rulesets');
  const exactMatch = rulesets.find(r => r.policy_info?.product_code === productCode);
  if (exactMatch) {
    return exactMatch;
  }

  const product = productCode ? getProduct(productCode) : null;
  const normalizedCategory = [
    product?.primaryCategory,
    product?.secondaryCategory,
    product?.racewayName,
    product?.marketingName,
    product?.regulatoryName,
  ]
    .filter(Boolean)
    .join(' ');
  const inferredProductLine =
    /健康|医疗|住院|重疾/.test(normalizedCategory)
      ? 'HEALTH'
      : /车|汽车|机动车/.test(normalizedCategory)
        ? 'AUTO'
        : /意外|身故|伤残/.test(normalizedCategory)
          ? 'ACCIDENT'
          : null;

  if (inferredProductLine) {
    const lineMatch = rulesets.find((item) => item.product_line === inferredProductLine);
    if (lineMatch) {
      return lineMatch;
    }
  }

  return rulesets[0] || null;
}

export function getLatestValidationFacts(claimCaseId) {
  if (!claimCaseId) return {};
  const importRecords = readData('claim-documents') || [];
  const latestRecord = importRecords
    .filter(record => record.claimCaseId === claimCaseId && record.validationFacts)
    .sort((a, b) => new Date(b.importedAt || 0).getTime() - new Date(a.importedAt || 0).getTime())[0];

  return latestRecord?.validationFacts || {};
}

export function getLatestMaterialValidationResults(claimCaseId) {
  if (!claimCaseId) return [];
  const importRecords = readData('claim-documents') || [];
  const latestRecord = importRecords
    .filter(record => record.claimCaseId === claimCaseId && Array.isArray(record.materialValidationResults))
    .sort((a, b) => new Date(b.importedAt || 0).getTime() - new Date(a.importedAt || 0).getTime())[0];

  return latestRecord?.materialValidationResults || [];
}

export function getLatestAggregationResult(claimCaseId) {
  if (!claimCaseId) return null;
  const importRecords = readData('claim-documents') || [];
  const latestRecord = importRecords
    .filter(record => record.claimCaseId === claimCaseId && record.aggregation)
    .sort((a, b) => new Date(b.importedAt || 0).getTime() - new Date(a.importedAt || 0).getTime())[0];

  return latestRecord?.aggregation || null;
}

function toClaimValidationAliases(validationFacts = {}) {
  return Object.entries(validationFacts).reduce((acc, [key, value]) => {
    const normalizedKey = String(key)
      .replace(/^validation\./, '')
      .replace(/\./g, '_');
    acc[`validation_${normalizedKey}`] = value;
    return acc;
  }, {});
}

/**
 * 获取医保目录数据
 * @returns {object[]} 医保目录
 */
export function getMedicalCatalog() {
  return readData('medical-insurance-catalog');
}

/**
 * 获取医院信息
 * @param {string} hospitalName - 医院名称
 * @returns {object|null} 医院信息
 */
export function getHospitalInfo(hospitalName) {
  const hospitals = readData('hospital-info');
  return hospitals.find(h => h.name === hospitalName || h.name?.includes(hospitalName)) || null;
}

/**
 * 构建完整的执行上下文
 * @param {object} params - 参数
 * @param {string} params.claimCaseId - 案件ID
 * @param {string} params.productCode - 产品代码（可选，从案件获取）
 * @param {object} params.ocrData - OCR提取的数据
 * @param {object[]} params.invoiceItems - 发票费用明细
 * @returns {object} 执行上下文
 */
export function buildContext({ claimCaseId, productCode, ocrData = {}, invoiceItems = [], validationFacts = null, rulesetOverride = null }) {
  // 获取案件数据
  const claimCase = getClaimCase(claimCaseId);
  if (!claimCase && !productCode) {
    throw new Error(`未找到案件: ${claimCaseId}`);
  }

  // 确定产品代码
  const boundPolicy = resolveBoundPolicy(claimCase || {}, productCode || claimCase?.productCode || null);
  const effectiveProductCode = boundPolicy?.productCode || productCode || claimCase?.productCode;

  // 获取产品和规则集
  const product = effectiveProductCode ? getProduct(effectiveProductCode) : null;
  const ruleset = effectiveProductCode ? getRuleset(effectiveProductCode, rulesetOverride) : rulesetOverride;

  // 构建保单上下文（从规则集的policy_info获取）
  const policyInfo = mergePolicyInfo({
    ruleset,
    boundPolicy,
    effectiveProductCode,
    product,
  });

  // 构建理赔上下文
  const claimContext = normalizeClaimContext(claimCase, ocrData, invoiceItems);
  const resolvedValidationFacts = validationFacts ?? getLatestValidationFacts(claimCaseId);
  const latestAggregation = getLatestAggregationResult(claimCaseId);
  const injuryProfile = latestAggregation?.injuryProfile || {};
  const deathProfile = latestAggregation?.deathProfile || {};
  const validationProfile = latestAggregation?.validationFacts || {};
  const canonicalFacts = latestAggregation?.factModel?.canonicalFacts || {};

  const canonicalizedClaimContext = applyCanonicalClaimFacts(claimContext, canonicalFacts);
  const boundInsured = resolveBoundInsured(boundPolicy, claimCase || {}, canonicalizedClaimContext);

  canonicalizedClaimContext.diagnosis = pickFirstNonEmpty(
    canonicalizedClaimContext.diagnosis,
    injuryProfile.injuryDescription
  );
  canonicalizedClaimContext.diagnosis_date = pickFirstNonEmpty(
    canonicalizedClaimContext.diagnosis_date,
    canonicalizedClaimContext.diagnosisDate,
    injuryProfile.primaryDiagnosisDate
  );
  canonicalizedClaimContext.diagnosis_names =
    Array.isArray(canonicalizedClaimContext.diagnosis_names) && canonicalizedClaimContext.diagnosis_names.length > 0
      ? canonicalizedClaimContext.diagnosis_names
      : Array.isArray(injuryProfile.diagnosisNames)
        ? injuryProfile.diagnosisNames
        : [];
  canonicalizedClaimContext.special_disease_confirmed =
    canonicalizedClaimContext.special_disease_confirmed ??
    canonicalizedClaimContext.specialDiseaseConfirmed ??
    validationProfile['claim.special_disease_confirmed'] ??
    validationProfile.special_disease_confirmed ??
    null;
  canonicalizedClaimContext.death_confirmed =
    canonicalizedClaimContext.death_confirmed ||
    deathProfile.deathConfirmed ||
    false;
  canonicalizedClaimContext.death_date = pickFirstNonEmpty(
    canonicalizedClaimContext.death_date,
    canonicalizedClaimContext.deathDate,
    deathProfile.deathDate
  );
  canonicalizedClaimContext.result_date = pickFirstNonEmpty(
    canonicalizedClaimContext.result_date,
    canonicalizedClaimContext.resultDate,
    canonicalizedClaimContext.death_date,
    deathProfile.deathDate
  );
  canonicalizedClaimContext.deceased_name = pickFirstNonEmpty(
    canonicalizedClaimContext.deceased_name,
    canonicalizedClaimContext.deceasedName,
    deathProfile.deceasedName
  );
  canonicalizedClaimContext.death_cause = pickFirstNonEmpty(
    canonicalizedClaimContext.death_cause,
    canonicalizedClaimContext.deathCause,
    deathProfile.deathCause
  );
  canonicalizedClaimContext.death_location = pickFirstNonEmpty(
    canonicalizedClaimContext.death_location,
    canonicalizedClaimContext.deathLocation,
    deathProfile.deathLocation
  );
  canonicalizedClaimContext.claimants =
    Array.isArray(canonicalizedClaimContext.claimants) && canonicalizedClaimContext.claimants.length > 0
      ? canonicalizedClaimContext.claimants
      : Array.isArray(deathProfile.claimants)
        ? deathProfile.claimants
        : [];
  canonicalizedClaimContext.beneficiary_type = pickFirstNonEmpty(
    canonicalizedClaimContext.beneficiary_type,
    canonicalizedClaimContext.beneficiaryType,
    canonicalizedClaimContext.claimants?.[0]?.beneficiaryType
  );
  canonicalizedClaimContext.cause_type =
    canonicalizedClaimContext.cause_type ||
    canonicalizedClaimContext.causeType ||
    inferCauseTypeForMedical(canonicalizedClaimContext, claimCase || {}, product);
  canonicalizedClaimContext.hospital_name = pickFirstNonEmpty(
    canonicalizedClaimContext.hospital_name,
    canonicalizedClaimContext.hospitalName,
    canonicalizedClaimContext.invoiceInfo?.hospitalName
  );
  canonicalizedClaimContext.bound_policy_number =
    boundPolicy?.policyNumber ||
    boundPolicy?.policyNo ||
    boundPolicy?.policy_number ||
    claimCase?.policyNumber ||
    null;
  canonicalizedClaimContext.bound_policy_product_code = boundPolicy?.productCode || effectiveProductCode || null;
  canonicalizedClaimContext.bound_policy_insured_name = boundInsured.insuredName;
  canonicalizedClaimContext.bound_policy_insured_match = boundInsured.matchStatus;
  canonicalizedClaimContext.insured_social_security =
    canonicalizedClaimContext.insured_social_security ??
    canonicalizedClaimContext.insuredSocialSecurity ??
    (boundInsured.matched
      ? /有社保/.test(String(boundInsured.matched.socialSecurity || '')) || boundInsured.matched.socialSecurity === true
      : null);
  canonicalizedClaimContext.settled_with_social_security = inferSettledWithSocialSecurity(canonicalizedClaimContext);
  canonicalizedClaimContext.medically_necessary = resolveMedicalNecessity(canonicalizedClaimContext, latestAggregation);
  const validationAliases = toClaimValidationAliases(resolvedValidationFacts);
  const facts = buildFacts({
    claimCaseId,
    effectiveProductCode,
    policyInfo,
    claimContext: canonicalizedClaimContext,
    resolvedValidationFacts,
    product
  });

  // 构建完整上下文
  const context = {
    // 理赔数据
    claim: {
      ...canonicalizedClaimContext,
      ...validationAliases
    },

    // 材料校验事实
    validation: resolvedValidationFacts,

    aggregation: latestAggregation,

    // 保单数据
    policy: {
      policy_no: policyInfo.policy_no,
      product_code: policyInfo.product_code,
      product_name: policyInfo.product_name,
      insurer: policyInfo.insurer,
      effective_date: policyInfo.effective_date,
      expiry_date: policyInfo.expiry_date,
      is_renewal: Boolean(policyInfo.is_renewal ?? policyInfo.isRenewal ?? false),
      payment_mode: policyInfo.payment_mode || 'ANNUAL',
      premium_overdue: Boolean(policyInfo.premium_overdue),
      days_overdue: Number(policyInfo.days_overdue || 0),
      is_within_coverage_period: facts.policy.isWithinCoveragePeriod,
      coverages: policyInfo.coverages || [],
      boundPolicy: boundPolicy || null,
      bound_policy_number: policyInfo.bound_policy_number || null,
      product_source: boundPolicy?.productCode && boundPolicy.productCode !== claimCase?.productCode ? 'POLICY_BOUND' : 'CLAIM_CASE',
      // 产品详情
      ...product
    },

    vehicle: claimContext.vehicle || policyInfo.insured_subject?.vehicle || null,

    // 规则集元数据
    ruleset: {
      ruleset_id: ruleset?.ruleset_id,
      product_line: ruleset?.product_line,
      rules: ruleset?.rules || []
    },

    facts,

    // 辅助数据
    medical_catalog: getMedicalCatalog(),

    // 当前时间（用于时间比较）
    now: new Date().toISOString().split('T')[0]
  };

  // 如果有医院名称，补充医院信息
  if (claimContext.hospital_name) {
    context.hospital = getHospitalInfo(claimContext.hospital_name);
  }
  if (!context.hospital && context.claim.hospital_name) {
    context.hospital = getHospitalInfo(context.claim.hospital_name);
  }

  context.claim.result_type = context.claim.result_type || facts.claim.resultType;
  context.claim.cause_type = context.claim.cause_type || facts.claim.causeType;
  context.claim.diagnosis_date = context.claim.diagnosis_date || facts.claim.diagnosisDate;
  context.claim.diagnosis_names = context.claim.diagnosis_names || facts.claim.diagnosisNames;
  context.claim.death_date = context.claim.death_date || context.claim.deathDate || deathProfile.deathDate || null;
  context.claim.result_date = context.claim.result_date || context.claim.resultDate || context.claim.death_date || facts.claim.resultDate;
  context.claim.deceased_name = context.claim.deceased_name || context.claim.deceasedName || deathProfile.deceasedName || null;
  context.claim.death_cause = context.claim.death_cause || context.claim.deathCause || deathProfile.deathCause || null;
  context.claim.death_location = context.claim.death_location || context.claim.deathLocation || deathProfile.deathLocation || null;
  context.claim.claimants = Array.isArray(context.claim.claimants) ? context.claim.claimants : (deathProfile.claimants || []);
  context.claim.beneficiary_type =
    context.claim.beneficiary_type ||
    context.claim.beneficiaryType ||
    context.claim.claimants?.[0]?.beneficiaryType ||
    null;
  context.claim.special_disease_confirmed =
    context.claim.special_disease_confirmed ??
    context.claim.specialDiseaseConfirmed ??
    facts.claim.specialDiseaseConfirmed ??
    null;
  context.claim.days_from_accident_to_result =
    context.claim.days_from_accident_to_result ?? facts.claim.daysFromAccidentToResult;
  context.claim.disability_grade = context.claim.disability_grade ?? context.claim.disabilityGrade ?? 0;
  context.claim.scenario = context.claim.scenario || 'GENERAL_ACCIDENT';
  context.claim.transport_type = context.claim.transport_type || context.claim.transportType || 'OTHER';
  context.claim.vehicle_is_non_commercial =
    context.claim.vehicle_is_non_commercial ?? context.claim.vehicleIsNonCommercial ?? false;
  context.claim.vehicle_is_truck =
    context.claim.vehicle_is_truck ?? context.claim.vehicleIsTruck ?? false;
  context.claim.insured_occupation_class_at_accident =
    context.claim.insured_occupation_class_at_accident ??
    context.claim.insuredOccupationClassAtAccident ??
    policyInfo.insured_subject?.person?.occupation_class ??
    claimCase?.insured_occupation_class_at_accident ??
    claimCase?.insuredOccupationClassAtAccident;
  context.claim.cause_sub_type = context.claim.cause_sub_type || context.claim.causeSubType || 'UNKNOWN';
  context.claim.insured_intoxicated = context.claim.insured_intoxicated ?? context.claim.insuredIntoxicated ?? false;
  context.claim.insured_drug_use = context.claim.insured_drug_use ?? context.claim.insuredDrugUse ?? false;
  context.claim.driver_bac_level = context.claim.driver_bac_level ?? context.claim.driverBacLevel ?? 0;
  context.claim.driver_license_valid = context.claim.driver_license_valid ?? context.claim.driverLicenseValid ?? true;
  context.claim.vehicle_registration_valid = context.claim.vehicle_registration_valid ?? context.claim.vehicleRegistrationValid ?? true;
  context.claim.activity_during_accident =
    context.claim.activity_during_accident ||
    context.claim.activityDuringAccident ||
    'NORMAL_DAILY_ACTIVITY';
  context.claim.insured_legal_status =
    context.claim.insured_legal_status ||
    context.claim.insuredLegalStatus ||
    'NORMAL';
  context.claim.insured_occupation_changed =
    context.claim.insured_occupation_changed ?? context.claim.insuredOccupationChanged ?? false;
  context.claim.insured_occupation_change_notified =
    context.claim.insured_occupation_change_notified ?? context.claim.insuredOccupationChangeNotified ?? true;
  context.claim.insured_new_occupation_in_decline_list =
    context.claim.insured_new_occupation_in_decline_list ?? context.claim.insuredNewOccupationInDeclineList ?? false;
  context.claim.insured_occupation_risk_increased =
    context.claim.insured_occupation_risk_increased ?? context.claim.insuredOccupationRiskIncreased ?? false;
  context.claim.accident_sub_type = context.claim.accident_sub_type || context.claim.accidentSubType || 'GENERAL_ACCIDENT';
  context.claim.is_high_altitude_work =
    context.claim.is_high_altitude_work ?? context.claim.isHighAltitudeWork ?? false;
  context.claim.ambulance_type = context.claim.ambulance_type || context.claim.ambulanceType || 'NONE';
  context.claim.hours_accident_to_ambulance =
    context.claim.hours_accident_to_ambulance ?? context.claim.hoursAccidentToAmbulance ?? 999;
  context.claim.insured_accident_policy_count =
    context.claim.insured_accident_policy_count ?? context.claim.insuredAccidentPolicyCount ?? 1;
  context.claim.insured_total_accident_death_sum =
    context.claim.insured_total_accident_death_sum ?? context.claim.insuredTotalAccidentDeathSum ?? 0;
  context.claim.newest_policy_inception_days =
    context.claim.newest_policy_inception_days ?? context.claim.newestPolicyInceptionDays ?? 999;

  const catalogReview = evaluateMedicalCatalogItems({
    context,
    expenseItems: Array.isArray(context.claim.expense_items) ? context.claim.expense_items : [],
  });
  context.claim.expense_items = catalogReview.reviewedItems || [];
  context.claim.claimed_total_amount =
    context.claim.claimed_total_amount ??
    context.claim.total_claimed_amount ??
    catalogReview.summary.totalClaimedAmount;
  const derivedSocialAmount = catalogReview.summary.catalogCoveredAmount;
  const derivedNonSocialAmount =
    catalogReview.summary.selfPayAmount + catalogReview.summary.restrictedAmount;
  context.claim.social_medical_amount =
    Number.isFinite(Number(context.claim.social_medical_amount))
      ? Number(context.claim.social_medical_amount)
      : derivedSocialAmount;
  context.claim.non_social_medical_amount =
    Number.isFinite(Number(context.claim.non_social_medical_amount))
      ? Number(context.claim.non_social_medical_amount)
      : derivedNonSocialAmount;
  context.claim.catalog_covered_amount = catalogReview.summary.catalogCoveredAmount;
  context.claim.catalog_non_covered_amount =
    catalogReview.summary.selfPayAmount + catalogReview.summary.restrictedAmount;
  context.claim.catalog_uncertain_amount = catalogReview.summary.uncertainAmount;

  const primaryMedicalCoverage =
    (context.policy.coverages || []).find((item) => item?.coverage_code === 'HLT_OPD_SOCIAL') ||
    (context.policy.coverages || []).find((item) => item?.coverage_code === 'HLT_INPATIENT') ||
    null;
  const hospitalReview = evaluateHospitalRequirement({
    context,
    coverageConfig: primaryMedicalCoverage || {},
    claimType: context.ruleset?.product_line || '',
  });
  context.claim.hospital_qualified =
    hospitalReview.requirement == null
      ? null
      : (!hospitalReview.hospitalName || !hospitalReview.hospital)
        ? null
        : hospitalReview.manualReviewReasons.some((reason) => reason.code === 'WARD_SCOPE_UNCONFIRMED')
          ? null
          : hospitalReview.passed;
  context.claim.hospital_review = hospitalReview;
  context.claim.medical_review = {
    catalogSummary: catalogReview.summary,
    hospitalReview,
  };
  context.claim.bound_policy_insured_match = boundInsured.matchStatus;
  context.claim.bound_policy_insured_name = boundInsured.insuredName;
  context.claim.bound_policy_number = context.claim.bound_policy_number || policyInfo.bound_policy_number || null;

  return context;
}

/**
 * 获取保障项目配置
 * @param {string} productCode - 产品代码
 * @param {string} coverageCode - 保障代码
 * @returns {object|null} 保障配置
 */
export function getCoverageConfig(productCode, coverageCode, rulesetOverride = null) {
  const ruleset = getRuleset(productCode, rulesetOverride);
  if (!ruleset?.policy_info?.coverages) return null;

  const coverages = ruleset.policy_info.coverages;
  const exactMatch = coverages.find(c => c.coverage_code === coverageCode);
  if (exactMatch) return exactMatch;

  const aliases = COVERAGE_CODE_ALIASES[coverageCode] || [];
  for (const alias of aliases) {
    const aliasMatch = coverages.find(c => c.coverage_code === alias);
    if (aliasMatch) return aliasMatch;
  }

  return coverages.find(c => c.coverage_code?.includes(coverageCode) || coverageCode?.includes(c.coverage_code)) || null;
}

/**
 * 检查药品是否在医保目录内
 * @param {string} drugName - 药品名称
 * @returns {object|null} 目录信息
 */
export function checkMedicalCatalog(drugName) {
  const catalog = getMedicalCatalog();
  return catalog.find(item =>
    item.name === drugName ||
    item.name?.includes(drugName) ||
    drugName?.includes(item.name)
  ) || null;
}
