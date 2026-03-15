import { readData } from '../utils/fileStore.js';
import { normalizeClaimContext } from '../claims/normalizers/claimNormalizer.js';

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
  const effectiveProductCode = productCode || claimCase?.productCode;

  // 获取产品和规则集
  const product = effectiveProductCode ? getProduct(effectiveProductCode) : null;
  const ruleset = effectiveProductCode ? getRuleset(effectiveProductCode, rulesetOverride) : rulesetOverride;

  // 构建保单上下文（从规则集的policy_info获取）
  const policyInfo = ruleset?.policy_info || {};

  // 构建理赔上下文
  const claimContext = normalizeClaimContext(claimCase, ocrData, invoiceItems);
  const resolvedValidationFacts = validationFacts ?? getLatestValidationFacts(claimCaseId);
  const latestAggregation = getLatestAggregationResult(claimCaseId);
  const injuryProfile = latestAggregation?.injuryProfile || {};
  const deathProfile = latestAggregation?.deathProfile || {};
  const validationProfile = latestAggregation?.validationFacts || {};
  const canonicalFacts = latestAggregation?.factModel?.canonicalFacts || {};

  const canonicalizedClaimContext = applyCanonicalClaimFacts(claimContext, canonicalFacts);

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
