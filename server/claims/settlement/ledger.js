import { ACCIDENT_COVERAGE_CODES } from '../accident/engine.js';
import { MEDICAL_COVERAGE_CODES } from '../medical/engine.js';
import { AUTO_COVERAGE_CODES, isAutoCoverageCode, getAutoLossAmount, getAutoActualValue, getCompulsoryBreakdown, getAutoCoverageConfig } from '../auto/engine.js';

function roundAmount(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

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

function diffYears(startDate, endDate) {
  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  if (!start || !end) return null;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) return null;
  return (endTime - startTime) / (1000 * 60 * 60 * 24 * 365);
}

function calculateAgeFromBirthDate(birthDate, referenceDate) {
  const birth = toDateOnly(birthDate);
  const reference = toDateOnly(referenceDate);
  if (!birth || !reference) return null;
  const birthObj = new Date(birth);
  const refObj = new Date(reference);
  if (Number.isNaN(birthObj.getTime()) || Number.isNaN(refObj.getTime())) return null;
  let age = refObj.getFullYear() - birthObj.getFullYear();
  const monthDiff = refObj.getMonth() - birthObj.getMonth();
  const dayDiff = refObj.getDate() - birthObj.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function getConfiguredAmount(value) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && typeof value.amount === 'number') {
    return value.amount;
  }
  return 0;
}

function getItemAmount(item) {
  return roundAmount(item?.totalPrice ?? item?.amount ?? 0);
}

function getItemName(item, index) {
  return item?.itemName || item?.name || `项目${index + 1}`;
}

function getItemKey(item, index) {
  return item?.id || item?.itemId || `${getItemName(item, index)}_${index}`;
}

function getCoverageStatus(needsManualReview, approvedAmount) {
  if (needsManualReview) return 'MANUAL_REVIEW';
  return approvedAmount > 0 ? 'PAYABLE' : 'ZERO_PAY';
}

function buildCoverageResult({ coverageCode, claimedAmount, approvedAmount, deductible, reimbursementRatio, sumInsured, status, warnings = [] }) {
  return {
    coverageCode,
    claimedAmount: roundAmount(claimedAmount),
    approvedAmount: roundAmount(approvedAmount),
    deductible: roundAmount(deductible),
    reimbursementRatio: reimbursementRatio ?? 1,
    sumInsured: Number.isFinite(sumInsured) ? roundAmount(sumInsured) : null,
    status,
    warnings
  };
}

function getPolicyCoverageConfig(context, coverageCode) {
  const coverages = context?.policy?.coverages || [];
  return coverages.find((item) => item?.coverage_code === coverageCode) || null;
}

function getMatchedCoverageCodesFromEligibility(context, eligibilityResult) {
  const matchedRuleIds = new Set(eligibilityResult?.matchedRules || []);
  const rules = context?.ruleset?.rules || [];
  const coverageCodes = new Set();

  for (const rule of rules) {
    if (!matchedRuleIds.has(rule?.rule_id)) continue;
    const appliedCodes = rule?.applies_to?.coverage_codes;
    if (!Array.isArray(appliedCodes)) continue;
    appliedCodes.filter(Boolean).forEach((code) => coverageCodes.add(code));
  }

  return coverageCodes;
}

function isPublicTransportAddonEligible(context) {
  const transportTypes = ['BUS', 'LONG_DISTANCE_BUS', 'TRAIN', 'SUBWAY', 'FERRY', 'AIRCRAFT', 'TAXI'];
  return (
    context?.claim?.scenario === 'PUBLIC_TRANSPORT_PASSENGER' &&
    transportTypes.includes(context?.claim?.transport_type)
  );
}

function isPrivateCarAddonEligible(context) {
  return (
    context?.claim?.scenario === 'PRIVATE_CAR_PASSENGER' &&
    context?.claim?.vehicle_is_non_commercial === true &&
    context?.claim?.vehicle_is_truck === false
  );
}

function buildAddonBenefitCoverage({ coverageCode, coverageName, sumInsured, status, message }) {
  const amount = getConfiguredAmount(sumInsured);
  return {
    coverageCode,
    claimedAmount: amount,
    payableAmount: amount,
    status,
    entries: [
      {
        step: 'INIT',
        beforeAmount: amount,
        afterAmount: amount,
        message: '初始化附加给付责任'
      },
      {
        step: 'TRIGGER',
        beforeAmount: amount,
        afterAmount: amount,
        reasonCode: 'ADDON_TRIGGERED',
        message
      },
      {
        step: 'CAP',
        beforeAmount: amount,
        afterAmount: amount,
        reasonCode: 'SUM_INSURED_CAP',
        message: '按责任保额上限收敛'
      }
    ],
    manualReviewReasons: [],
    coverageName: coverageName || coverageCode
  };
}

function collectAccidentDeathAddonCoverages(context, eligibilityResult, status) {
  const addOnCoverages = [];
  const publicTransportCoverage = getPolicyCoverageConfig(context, 'ACC_PUBLIC_TRANS');
  const privateCarCoverage = getPolicyCoverageConfig(context, 'ACC_PRIVATE_CAR');
  const matchedCoverageCodes = getMatchedCoverageCodesFromEligibility(context, eligibilityResult);

  if (
    publicTransportCoverage &&
    matchedCoverageCodes.has('ACC_PUBLIC_TRANS') &&
    isPublicTransportAddonEligible(context)
  ) {
    addOnCoverages.push(
      buildAddonBenefitCoverage({
        coverageCode: 'ACC_PUBLIC_TRANS',
        coverageName: publicTransportCoverage.coverage_name,
        sumInsured: publicTransportCoverage.sum_insured,
        status,
        message: '营运交通工具乘客附加身故责任成立'
      })
    );
  }

  if (
    privateCarCoverage &&
    matchedCoverageCodes.has('ACC_PRIVATE_CAR') &&
    isPrivateCarAddonEligible(context)
  ) {
    addOnCoverages.push(
      buildAddonBenefitCoverage({
        coverageCode: 'ACC_PRIVATE_CAR',
        coverageName: privateCarCoverage.coverage_name,
        sumInsured: privateCarCoverage.sum_insured,
        status,
        message: '自驾车乘客附加身故责任成立'
      })
    );
  }

  return addOnCoverages;
}

function getCompulsoryLimits(coverageConfig) {
  const defaults = {
    deathDisability: 180000,
    injury: 18000,
    propertyDamage: 2000
  };

  if (!coverageConfig?.limit_breakdown) {
    return defaults;
  }

  return {
    deathDisability: getConfiguredAmount(coverageConfig.limit_breakdown.death_disability) || defaults.deathDisability,
    injury: getConfiguredAmount(coverageConfig.limit_breakdown.injury) || defaults.injury,
    propertyDamage: getConfiguredAmount(coverageConfig.limit_breakdown.property_damage) || defaults.propertyDamage
  };
}

function calculateCompulsoryApprovedAmount(context, coverageConfig, totalClaimedAmount) {
  const breakdown = getCompulsoryBreakdown(context);
  const limits = getCompulsoryLimits(coverageConfig);

  if (breakdown.total <= 0) {
    return {
      claimedAmount: totalClaimedAmount,
      approvedAmount: Math.min(totalClaimedAmount, getConfiguredAmount(coverageConfig?.sum_insured) || totalClaimedAmount)
    };
  }

  return {
    claimedAmount: breakdown.total,
    approvedAmount:
      Math.min(breakdown.propertyDamage, limits.propertyDamage) +
      Math.min(breakdown.injury, limits.injury) +
      Math.min(breakdown.deathDisability, limits.deathDisability)
  };
}

function shouldApplyCompulsoryOffset(context) {
  if (context?.aggregation?.compulsoryInsuranceOffset?.applicable === false) {
    return false;
  }
  return true;
}

function extractClaimRatio(eligibilityResult) {
  const details = eligibilityResult?.executionDetails || [];
  for (let index = details.length - 1; index >= 0; index -= 1) {
    const ratio = details[index]?.action_result?.data?.payout_ratio;
    if (typeof ratio === 'number') {
      return ratio;
    }
  }
  return null;
}

function buildManualReviewReason(code, message, metadata = undefined) {
  return {
    code,
    message,
    ...(metadata ? { metadata } : {})
  };
}

export function determineSettlementMode({ claimType, coverageCode, expenseItems = [], context }) {
  const hasExpenseItems = expenseItems.length > 0;
  const isMedicalCoverage =
    coverageCode === ACCIDENT_COVERAGE_CODES.MEDICAL ||
    coverageCode === MEDICAL_COVERAGE_CODES.INPATIENT;
  const isBenefitCoverage =
    coverageCode === ACCIDENT_COVERAGE_CODES.DISABILITY ||
    coverageCode === ACCIDENT_COVERAGE_CODES.DEATH ||
    coverageCode === ACCIDENT_COVERAGE_CODES.ALLOWANCE ||
    claimType === 'CRITICAL_ILLNESS';

  if (claimType === 'AUTO' || isAutoCoverageCode(coverageCode)) {
    return 'LOSS';
  }
  if (isBenefitCoverage && hasExpenseItems) {
    return 'HYBRID';
  }
  if (isBenefitCoverage) {
    return 'BENEFIT';
  }
  if (isMedicalCoverage || hasExpenseItems) {
    return 'LOSS';
  }
  if ((context?.claim?.hospital_days || 0) > 0) {
    return 'BENEFIT';
  }
  return 'LOSS';
}

function createLossLedgerItem(item, index, coverageCode) {
  const claimedAmount = getItemAmount(item);
  return {
    itemKey: getItemKey(item, index),
    itemName: getItemName(item, index),
    claimedAmount,
    payableAmount: claimedAmount,
    status: claimedAmount > 0 ? 'PAYABLE' : 'ZERO_PAY',
    coverageCode,
    entries: [
      {
        step: 'INIT',
        beforeAmount: claimedAmount,
        afterAmount: claimedAmount,
        message: '载入原始申报金额'
      }
    ],
    manualReviewReasons: [],
    flags: [],
    locked: false
  };
}

function pushLossEntry(ledgerItem, entry) {
  ledgerItem.entries.push({
    ...entry,
    beforeAmount: roundAmount(entry.beforeAmount),
    afterAmount: roundAmount(entry.afterAmount)
  });
  ledgerItem.payableAmount = roundAmount(entry.afterAmount);
}

function applyAssessmentResultToLedger(ledgerItem, ruleResult, rule) {
  const actionType = ruleResult?.actionResult?.action_type || rule?.action?.action_type;
  const actionData = ruleResult?.actionResult?.data || {};
  const beforeAmount = ledgerItem.payableAmount;

  if (ledgerItem.locked && actionType !== 'FLAG_ITEM') {
    return;
  }

  if (actionType === 'APPROVE_ITEM') {
    pushLossEntry(ledgerItem, {
      step: 'ELIGIBILITY',
      ruleId: rule.rule_id,
      beforeAmount,
      afterAmount: beforeAmount,
      message: ruleResult.conditionMet ? '费用项通过' : '费用项未命中'
    });
    return;
  }

  if (actionType === 'REJECT_ITEM' || actionData.item_amount === 0 || ruleResult?.conditionMet === false) {
    pushLossEntry(ledgerItem, {
      step: 'ELIGIBILITY',
      ruleId: rule.rule_id,
      beforeAmount,
      afterAmount: 0,
      reasonCode: 'ITEM_REJECTED',
      message: ruleResult?.actionResult?.message || '费用项拒赔'
    });
    ledgerItem.locked = true;
    ledgerItem.status = 'ZERO_PAY';
    return;
  }

  if (actionType === 'SET_ITEM_RATIO' && typeof actionData.item_ratio === 'number') {
    pushLossEntry(ledgerItem, {
      step: 'RATIO',
      ruleId: rule.rule_id,
      beforeAmount,
      afterAmount: beforeAmount * actionData.item_ratio,
      reasonCode: 'ITEM_RATIO_APPLIED',
      message: ruleResult.actionResult?.message
    });
    return;
  }

  if (actionType === 'ADJUST_ITEM_AMOUNT') {
    const reductionRatio = typeof actionData.reduction_ratio === 'number' ? actionData.reduction_ratio : 0;
    pushLossEntry(ledgerItem, {
      step: 'PRICING',
      ruleId: rule.rule_id,
      beforeAmount,
      afterAmount: beforeAmount * (1 - reductionRatio),
      reasonCode: 'ITEM_PRICING_ADJUSTED',
      message: ruleResult.actionResult?.message
    });
    return;
  }

  if (actionType === 'APPLY_DEDUCTIBLE') {
    const deductible = typeof actionData.deductible === 'number' ? actionData.deductible : 0;
    pushLossEntry(ledgerItem, {
      step: 'DEDUCTIBLE',
      ruleId: rule.rule_id,
      beforeAmount,
      afterAmount: Math.max(0, beforeAmount - deductible),
      reasonCode: 'DEDUCTIBLE_APPLIED',
      message: ruleResult.actionResult?.message
    });
    return;
  }

  if (actionType === 'APPLY_CAP') {
    const cappedAmount = typeof actionData.capped_amount === 'number' ? actionData.capped_amount : beforeAmount;
    pushLossEntry(ledgerItem, {
      step: 'CAP',
      ruleId: rule.rule_id,
      beforeAmount,
      afterAmount: Math.min(beforeAmount, cappedAmount),
      reasonCode: 'CAP_APPLIED',
      message: ruleResult.actionResult?.message
    });
    return;
  }

  if (actionType === 'FLAG_ITEM') {
    pushLossEntry(ledgerItem, {
      step: 'FLAG',
      ruleId: rule.rule_id,
      beforeAmount,
      afterAmount: beforeAmount,
      reasonCode: 'ITEM_FLAGGED',
      message: ruleResult.actionResult?.message || '费用项需人工复核'
    });
    ledgerItem.flags.push(rule.rule_id);
    ledgerItem.manualReviewReasons.push(buildManualReviewReason('FLAGGED_ITEM', ruleResult.actionResult?.message || '费用项需人工复核'));
    ledgerItem.status = 'MANUAL_REVIEW';
  }
}

function allocateCoverageDeductible(items, deductible, ruleId = 'SYSTEM_DEFAULT_DEDUCTIBLE') {
  let remaining = roundAmount(deductible);
  if (remaining <= 0) return 0;

  for (const item of items) {
    if (remaining <= 0 || item.payableAmount <= 0) continue;
    const deduction = Math.min(item.payableAmount, remaining);
    pushLossEntry(item, {
      step: 'DEDUCTIBLE',
      ruleId,
      beforeAmount: item.payableAmount,
      afterAmount: item.payableAmount - deduction,
      reasonCode: 'COVERAGE_DEDUCTIBLE_APPLIED',
      message: `责任免赔额扣减 ${deduction}`
    });
    if (item.payableAmount <= 0) {
      item.status = 'ZERO_PAY';
      item.locked = true;
    }
    remaining = roundAmount(remaining - deduction);
  }

  return roundAmount(deductible - remaining);
}

function allocateCoverageCap(items, targetTotal, ruleId = 'SYSTEM_CAP') {
  const currentTotal = roundAmount(items.reduce((sum, item) => sum + item.payableAmount, 0));
  if (targetTotal >= currentTotal) return false;
  if (currentTotal <= 0) return false;

  let allocated = 0;
  items.forEach((item, index) => {
    const isLast = index === items.length - 1;
    const proportional = isLast
      ? roundAmount(targetTotal - allocated)
      : roundAmount(targetTotal * (item.payableAmount / currentTotal));
    const nextAmount = Math.max(0, proportional);
    allocated = roundAmount(allocated + nextAmount);
    pushLossEntry(item, {
      step: 'CAP',
      ruleId,
      beforeAmount: item.payableAmount,
      afterAmount: nextAmount,
      reasonCode: 'COVERAGE_CAP_APPLIED',
      message: '责任限额收敛'
    });
    if (item.payableAmount <= 0) {
      item.status = 'ZERO_PAY';
      item.locked = true;
    }
  });

  return true;
}

function buildLegacyItemBreakdown(lossLedger) {
  return lossLedger.map((item) => ({
    item: item.itemName,
    claimed: item.claimedAmount,
    approved: item.payableAmount,
    reason: item.entries[item.entries.length - 1]?.message || (item.status === 'PAYABLE' ? '通过' : '需人工复核')
  }));
}

function toNumericGrade(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const matched = String(value).match(/(\d+)/);
  if (!matched) return null;
  const parsed = Number(matched[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function findDisabilityGradeRatio(context, grade) {
  if (grade === null || grade === undefined) return null;
  const rules = context?.ruleset?.rules || [];
  for (const rule of rules) {
    const table = rule?.action?.params?.disability_grade_table;
    if (!Array.isArray(table)) continue;
    const matched = table.find((item) => Number(item?.grade) === Number(grade));
    if (matched && typeof matched.payout_ratio === 'number') {
      return matched.payout_ratio;
    }
  }
  return null;
}

function findProductCoverageDetail(context, coverageCode, claimType) {
  const details = context?.policy?.coverageDetails;
  if (!Array.isArray(details)) return null;

  const aliases = {
    [ACCIDENT_COVERAGE_CODES.DEATH]: ['DEATH', 'DEATH_OR_TOTAL_DISABILITY', 'ACCIDENT_DEATH'],
    [ACCIDENT_COVERAGE_CODES.DISABILITY]: ['DISABILITY', 'DEATH_OR_TOTAL_DISABILITY', 'ACCIDENT_DISABILITY'],
    [ACCIDENT_COVERAGE_CODES.ALLOWANCE]: ['ALLOWANCE', 'HOSPITAL_ALLOWANCE'],
  };

  if (claimType === 'CRITICAL_ILLNESS') {
    return (
      details.find((item) => item?.item_code === 'CRITICAL_ILLNESS') ||
      details.find((item) => item?.item_code === 'CRITICAL_ILLNESS_EXTRA') ||
      null
    );
  }

  const codes = aliases[coverageCode] || [coverageCode];
  return details.find((item) => codes.includes(item?.item_code)) || null;
}

function normalizeDiseaseText(value) {
  return String(value || '')
    .replace(/[（(].*?[)）]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function getClaimDiagnosisNames(context) {
  const claim = context?.claim || {};
  const names = [];

  const append = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(append);
      return;
    }
    if (typeof value === 'object') {
      append(value.name);
      return;
    }
    names.push(String(value));
  };

  append(claim.diagnosis_names);
  append(claim.diagnosisNames);
  append(claim.diagnosis);
  append(claim.diagnosis_result);
  append(claim.diagnosisResult);
  append(claim.admission_diagnosis);
  append(claim.discharge_diagnosis);

  return [...new Set(names.map(normalizeDiseaseText).filter(Boolean))];
}

function getCoverageDiseaseList(coverageDetail) {
  const details = coverageDetail?.details || {};
  const directDiseases = Array.isArray(details.disease_list) ? details.disease_list : [];
  const groupedDiseases = Array.isArray(details.group_details?.groups)
    ? details.group_details.groups.flatMap((group) =>
        Array.isArray(group?.disease_list) ? group.disease_list : []
      )
    : [];
  return [...new Set([...directDiseases, ...groupedDiseases].map(normalizeDiseaseText).filter(Boolean))];
}

function inferSpecialDiseaseConfirmed(context, coverageDetail) {
  const diagnosisNames = getClaimDiagnosisNames(context);
  const coverageDiseases = getCoverageDiseaseList(coverageDetail);

  if (diagnosisNames.length === 0 || coverageDiseases.length === 0) {
    return null;
  }

  const matchedDiagnosis = diagnosisNames.find((diagnosis) =>
    coverageDiseases.some((configuredDisease) =>
      diagnosis === configuredDisease ||
      diagnosis.includes(configuredDisease) ||
      configuredDisease.includes(diagnosis)
    )
  );

  return matchedDiagnosis ? true : null;
}

function resolveBenefitModifiers({ context, coverageCode, claimType }) {
  const coverageDetail = findProductCoverageDetail(context, coverageCode, claimType);
  const details = coverageDetail?.details || {};
  const descriptionText = [
    coverageDetail?.description,
    details.payout_logic,
    context?.policy?.productSummery,
    context?.policy?.productIntroduction
  ]
    .filter(Boolean)
    .join(' ');
  const modifiers = {
    payoutRatio: typeof details.payout_ratio === 'number' ? details.payout_ratio : 1,
    extraPayoutRatio: 0,
    extraPayoutReason: '',
    requiresSpecialDiseaseConfirmation: /特疾|特定疾病/.test(descriptionText),
    missingConditions: [],
  };

  if (Array.isArray(details.payout_ratios) && details.payout_ratios.length > 0) {
    const priorBenefitCount = Number(
      context?.claim?.prior_benefit_count ||
      context?.claim?.priorBenefitCount ||
      0
    ) || 0;
    const ratioFromArray = details.payout_ratios[Math.min(priorBenefitCount, details.payout_ratios.length - 1)];
    if (typeof ratioFromArray === 'number') {
      modifiers.payoutRatio = ratioFromArray;
    }
  }

  if (typeof details.extra_payout_ratio === 'number') {
    const effectiveDate = context?.policy?.effective_date || context?.policy?.effectiveDate;
    const triggerDate =
      context?.claim?.diagnosis_date ||
      context?.claim?.diagnosisDate ||
      context?.claim?.result_date ||
      context?.claim?.resultDate ||
      context?.claim?.accident_date ||
      context?.claim?.accidentDate;
    const insuredAge =
      Number(context?.claim?.insured_age) ||
      calculateAgeFromBirthDate(
        context?.claim?.insured_birth_date || context?.claim?.insuredBirthDate,
        triggerDate
      );
    const yearsFromEffective = diffYears(effectiveDate, triggerDate);
    const limitYears = Number(details.age_limit_before);
    const mentionsPolicyYears = /前\d+年|首\d+年|前十年|首十年/.test(descriptionText);
    let withinExtraWindow = true;
    if (Number.isFinite(limitYears)) {
      if (mentionsPolicyYears) {
        withinExtraWindow = yearsFromEffective !== null && yearsFromEffective <= limitYears;
        if (!withinExtraWindow && yearsFromEffective === null) {
          modifiers.missingConditions.push('缺少保单生效日或触发日期，无法判断额外赔付年限条件');
        }
      } else {
        withinExtraWindow = insuredAge !== null && insuredAge !== undefined && insuredAge <= limitYears;
        if (!withinExtraWindow && (insuredAge === null || insuredAge === undefined || Number.isNaN(insuredAge))) {
          modifiers.missingConditions.push('缺少被保险人年龄，无法判断额外赔付年龄条件');
        }
      }
    }

    if (modifiers.requiresSpecialDiseaseConfirmation) {
      const inferredSpecialDiseaseConfirmed = inferSpecialDiseaseConfirmed(context, coverageDetail);
      if (
        context?.claim?.special_disease_confirmed === true ||
        context?.claim?.specialDiseaseConfirmed === true ||
        inferredSpecialDiseaseConfirmed === true
      ) {
        // allowed
      } else {
        withinExtraWindow = false;
        modifiers.missingConditions.push('缺少特定疾病确认结果，无法自动适用特疾额外赔');
      }
    }

    if (withinExtraWindow) {
      modifiers.extraPayoutRatio = details.extra_payout_ratio;
      modifiers.extraPayoutReason =
        coverageDetail?.description ||
        details.payout_logic ||
        '满足额外赔付条件';
    }
  }

  return modifiers;
}

function collectBenefitManualReviewReasons({ context, coverageCode, claimType, baseAmount }) {
  const reasons = [];
  const claim = context?.claim || {};

  if (claimType === 'CRITICAL_ILLNESS') {
    const diagnosisNames = getClaimDiagnosisNames(context);
    const hasDiagnosis = Boolean(
      claim.diagnosis ||
      claim.diagnosis_result ||
      claim.diagnosisResult ||
      claim.admission_diagnosis ||
      claim.discharge_diagnosis ||
      diagnosisNames.length > 0
    );
    const hasDiagnosisDate = Boolean(claim.diagnosis_date || claim.diagnosisDate || claim.result_date || claim.resultDate);
    if (!hasDiagnosis) {
      reasons.push(buildManualReviewReason('CRITICAL_ILLNESS_DIAGNOSIS_MISSING', '缺少重疾诊断结果，需人工复核'));
    }
    if (!hasDiagnosisDate) {
      reasons.push(buildManualReviewReason('CRITICAL_ILLNESS_DIAGNOSIS_DATE_MISSING', '缺少确诊日期，需人工复核'));
    }
    if ((claim.special_disease_confirmed ?? claim.specialDiseaseConfirmed) === false) {
      reasons.push(buildManualReviewReason('SPECIAL_DISEASE_NOT_CONFIRMED', '特定疾病条件未确认，不适用特疾额外赔'));
    }
  }

  if (coverageCode === ACCIDENT_COVERAGE_CODES.DISABILITY) {
    const grade = toNumericGrade(claim.disability_grade);
    if (grade === null) {
      reasons.push(buildManualReviewReason('DISABILITY_GRADE_MISSING', '缺少伤残等级，需人工复核'));
    }
  }

  if (coverageCode === ACCIDENT_COVERAGE_CODES.ALLOWANCE) {
    if (!(Number(claim.hospital_days || 0) > 0)) {
      reasons.push(buildManualReviewReason('HOSPITAL_DAYS_MISSING', '缺少住院天数，需人工复核'));
    }
  }

  const employerFieldPresent = Boolean(
    claim.employer ||
    claim.employer_name ||
    claim.work_injury_conclusion ||
    claim.labor_relation_confirmed ||
    claim.laborRelationConfirmed
  );
  if (employerFieldPresent) {
    const laborRelationConfirmed =
      claim.labor_relation_confirmed ??
      claim.laborRelationConfirmed ??
      null;
    const workInjuryConclusion =
      claim.work_injury_conclusion ||
      claim.workInjuryConclusion ||
      '';

    if (laborRelationConfirmed === false) {
      reasons.push(buildManualReviewReason('LABOR_RELATION_UNCONFIRMED', '劳动关系未确认，需人工复核'));
    }
    if (!workInjuryConclusion) {
      reasons.push(buildManualReviewReason('WORK_INJURY_CONCLUSION_MISSING', '缺少工伤认定结论，需人工复核'));
    }
  }

  if (baseAmount <= 0) {
    reasons.push(buildManualReviewReason('BENEFIT_BASE_AMOUNT_MISSING', '给付基础金额缺失，需人工复核'));
  }

  return reasons;
}

function getMedicalDefaultRatio(coverageConfig) {
  if (!coverageConfig) return 1;
  if (typeof coverageConfig.co_pay_ratio === 'number') {
    return 1 - coverageConfig.co_pay_ratio;
  }
  const rules = coverageConfig.reimbursement_rules;
  if (rules) {
    if (typeof rules.social_insurance_covered_ratio === 'number') {
      return rules.social_insurance_covered_ratio;
    }
    if (typeof rules.without_social_insurance_ratio === 'number') {
      return rules.without_social_insurance_ratio;
    }
  }
  return 1;
}

function calculateAutoLossLedger({ productCode, context, factResult, coverageCode, coverageConfig, warnings, needsManualReview }) {
  const faultRatio = factResult.faultRatio ?? 1;

  if (coverageCode === AUTO_COVERAGE_CODES.VEHICLE_DAMAGE) {
    const claimedAmount = getAutoLossAmount(context, factResult, coverageCode, coverageConfig);
    const actualValue = getAutoActualValue(context, coverageConfig);
    const baseAmount = actualValue > 0 ? Math.min(claimedAmount, actualValue) : claimedAmount;
    const finalAmount = roundAmount(baseAmount * faultRatio);
    const sumInsured = getConfiguredAmount(coverageConfig?.sum_insured) || Infinity;
    const approvedAmount = Math.min(finalAmount, sumInsured);

    const ledger = [{
      itemKey: `${coverageCode}_AUTO_LOSS`,
      itemName: '车辆损失',
      claimedAmount,
      payableAmount: approvedAmount,
      status: getCoverageStatus(needsManualReview, approvedAmount),
      coverageCode,
      entries: [
        { step: 'INIT', beforeAmount: claimedAmount, afterAmount: claimedAmount, message: '载入车辆损失金额' },
        { step: 'PRICING', beforeAmount: claimedAmount, afterAmount: baseAmount, reasonCode: 'ACTUAL_VALUE_LIMIT', message: '按车辆实际价值收敛' },
        { step: 'RATIO', beforeAmount: baseAmount, afterAmount: finalAmount, reasonCode: 'FAULT_RATIO_APPLIED', message: `按责任比例 ${faultRatio}` },
        { step: 'CAP', beforeAmount: finalAmount, afterAmount: approvedAmount, reasonCode: 'SUM_INSURED_CAP', message: '按保额上限收敛' }
      ],
      manualReviewReasons: [],
      flags: []
    }];

    return {
      lossLedger: ledger,
      coverageResults: [
        buildCoverageResult({
          coverageCode,
          claimedAmount,
          approvedAmount,
          deductible: 0,
          reimbursementRatio: faultRatio,
          sumInsured,
          status: getCoverageStatus(needsManualReview, approvedAmount),
          warnings
        })
      ],
      lossPayableAmount: approvedAmount,
      deductible: 0,
      reimbursementRatio: faultRatio,
      totalClaimable: claimedAmount
    };
  }

  if (coverageCode === AUTO_COVERAGE_CODES.COMPULSORY) {
    const claimedAmount = getAutoLossAmount(context, factResult, coverageCode, coverageConfig);
    const compulsoryAmount = calculateCompulsoryApprovedAmount(context, coverageConfig, claimedAmount);
    const sumInsured = getConfiguredAmount(coverageConfig?.sum_insured) || Infinity;
    const approvedAmount = Math.min(compulsoryAmount.approvedAmount, sumInsured);
    return {
      lossLedger: [{
        itemKey: `${coverageCode}_AUTO_COMPULSORY`,
        itemName: '交强险责任',
        claimedAmount: compulsoryAmount.claimedAmount,
        payableAmount: approvedAmount,
        status: getCoverageStatus(needsManualReview, approvedAmount),
        coverageCode,
        entries: [
          { step: 'INIT', beforeAmount: compulsoryAmount.claimedAmount, afterAmount: compulsoryAmount.claimedAmount, message: '载入交强险损失金额' },
          { step: 'CAP', beforeAmount: compulsoryAmount.claimedAmount, afterAmount: approvedAmount, reasonCode: 'COMPULSORY_LIMIT_APPLIED', message: '按交强险限额收敛' }
        ],
        manualReviewReasons: [],
        flags: []
      }],
      coverageResults: [
        buildCoverageResult({
          coverageCode,
          claimedAmount: compulsoryAmount.claimedAmount,
          approvedAmount,
          deductible: 0,
          reimbursementRatio: 1,
          sumInsured,
          status: getCoverageStatus(needsManualReview, approvedAmount),
          warnings
        })
      ],
      lossPayableAmount: approvedAmount,
      deductible: 0,
      reimbursementRatio: 1,
      totalClaimable: compulsoryAmount.claimedAmount
    };
  }

  if (coverageCode === AUTO_COVERAGE_CODES.THIRD_PARTY) {
    const claimedAmount = getAutoLossAmount(context, factResult, coverageCode, coverageConfig);
    const shouldOffsetCompulsory = shouldApplyCompulsoryOffset(context);
    const compulsoryConfig = shouldOffsetCompulsory
      ? getAutoCoverageConfig(productCode, AUTO_COVERAGE_CODES.COMPULSORY)
      : null;
    const compulsoryAmount = shouldOffsetCompulsory
      ? calculateCompulsoryApprovedAmount(context, compulsoryConfig, claimedAmount)
      : { claimedAmount: 0, approvedAmount: 0 };
    const compulsorySumInsured = shouldOffsetCompulsory
      ? (getConfiguredAmount(compulsoryConfig?.sum_insured) || Infinity)
      : 0;
    const compulsoryApproved = shouldOffsetCompulsory
      ? Math.min(compulsoryAmount.approvedAmount, compulsorySumInsured)
      : 0;
    const remainingLoss = Math.max(0, claimedAmount - compulsoryApproved);
    const commercialBaseAmount = roundAmount(remainingLoss * faultRatio);
    const commercialSumInsured = getConfiguredAmount(coverageConfig?.sum_insured) || Infinity;
    const commercialApproved = Math.min(commercialBaseAmount, commercialSumInsured);
    const coverageResults = [];
    const lossLedger = [];

    if (compulsoryApproved > 0) {
      lossLedger.push({
        itemKey: `${AUTO_COVERAGE_CODES.COMPULSORY}_AUTO_TPL`,
        itemName: '交强险先行赔付',
        claimedAmount: compulsoryAmount.claimedAmount,
        payableAmount: compulsoryApproved,
        status: getCoverageStatus(needsManualReview, compulsoryApproved),
        coverageCode: AUTO_COVERAGE_CODES.COMPULSORY,
        entries: [
          { step: 'INIT', beforeAmount: compulsoryAmount.claimedAmount, afterAmount: compulsoryAmount.claimedAmount, message: '载入交强险损失金额' },
          { step: 'CAP', beforeAmount: compulsoryAmount.claimedAmount, afterAmount: compulsoryApproved, reasonCode: 'COMPULSORY_LIMIT_APPLIED', message: '按交强险限额收敛' }
        ],
        manualReviewReasons: [],
        flags: []
      });
      coverageResults.push(buildCoverageResult({
        coverageCode: AUTO_COVERAGE_CODES.COMPULSORY,
        claimedAmount: compulsoryAmount.claimedAmount,
        approvedAmount: compulsoryApproved,
        deductible: 0,
        reimbursementRatio: 1,
        sumInsured: compulsorySumInsured,
        status: getCoverageStatus(needsManualReview, compulsoryApproved),
        warnings
      }));
    }

    lossLedger.push({
      itemKey: `${coverageCode}_AUTO_TPL`,
      itemName: '商业三者责任',
      claimedAmount: remainingLoss || claimedAmount,
      payableAmount: commercialApproved,
      status: getCoverageStatus(needsManualReview, commercialApproved),
      coverageCode,
      entries: [
        { step: 'INIT', beforeAmount: remainingLoss || claimedAmount, afterAmount: remainingLoss || claimedAmount, message: '载入商业三者损失金额' },
        { step: 'RATIO', beforeAmount: remainingLoss || claimedAmount, afterAmount: commercialBaseAmount, reasonCode: 'FAULT_RATIO_APPLIED', message: `按责任比例 ${faultRatio}` },
        { step: 'CAP', beforeAmount: commercialBaseAmount, afterAmount: commercialApproved, reasonCode: 'SUM_INSURED_CAP', message: '按商业三者保额上限收敛' }
      ],
      manualReviewReasons: [],
      flags: []
    });
    coverageResults.push(buildCoverageResult({
      coverageCode,
      claimedAmount: remainingLoss || claimedAmount,
      approvedAmount: commercialApproved,
      deductible: 0,
      reimbursementRatio: faultRatio,
      sumInsured: commercialSumInsured,
      status: getCoverageStatus(needsManualReview, commercialApproved),
      warnings
    }));

    return {
      lossLedger,
      coverageResults,
      lossPayableAmount: roundAmount(lossLedger.reduce((sum, item) => sum + item.payableAmount, 0)),
      deductible: 0,
      reimbursementRatio: faultRatio,
      totalClaimable: claimedAmount
    };
  }

  if (coverageCode === AUTO_COVERAGE_CODES.DRIVER_PASSENGER) {
    const claimedAmount = getAutoLossAmount(context, factResult, coverageCode, coverageConfig);
    const sumInsured = getConfiguredAmount(coverageConfig?.sum_insured) || Infinity;
    const approvedAmount = Math.min(claimedAmount, sumInsured);
    return {
      lossLedger: [{
        itemKey: `${coverageCode}_AUTO_SEAT`,
        itemName: '车上人员责任',
        claimedAmount,
        payableAmount: approvedAmount,
        status: getCoverageStatus(needsManualReview, approvedAmount),
        coverageCode,
        entries: [
          { step: 'INIT', beforeAmount: claimedAmount, afterAmount: claimedAmount, message: '载入车上人员损失金额' },
          { step: 'CAP', beforeAmount: claimedAmount, afterAmount: approvedAmount, reasonCode: 'SUM_INSURED_CAP', message: '按保额上限收敛' }
        ],
        manualReviewReasons: [],
        flags: []
      }],
      coverageResults: [
        buildCoverageResult({
          coverageCode,
          claimedAmount,
          approvedAmount,
          deductible: 0,
          reimbursementRatio: 1,
          sumInsured,
          status: getCoverageStatus(needsManualReview, approvedAmount),
          warnings
        })
      ],
      lossPayableAmount: approvedAmount,
      deductible: 0,
      reimbursementRatio: 1,
      totalClaimable: claimedAmount
    };
  }

  return null;
}

export function runLossLedger({
  productCode,
  context,
  factResult,
  coverageCode,
  coverageConfig,
  claimType,
  warnings = [],
  needsManualReview = false
}) {
  if (claimType === 'AUTO' || isAutoCoverageCode(coverageCode)) {
    const autoLedger = calculateAutoLossLedger({
      productCode,
      context,
      factResult,
      coverageCode,
      coverageConfig,
      warnings,
      needsManualReview
    });
    if (autoLedger) {
      return {
        ...autoLedger,
        legacyItemBreakdown: buildLegacyItemBreakdown(autoLedger.lossLedger)
      };
    }
  }

  const items = (factResult.expenseItems || []).map((item, index) => createLossLedgerItem(item, index, coverageCode));
  const ruleIndex = new Map((context.ruleset?.rules || []).map((rule) => [rule.rule_id, rule]));
  const assessmentResults = factResult.executionDetails || [];

  for (const result of assessmentResults) {
    if (!Array.isArray(result.item_results) || result.item_results.length === 0) {
      continue;
    }

    const rule = ruleIndex.get(result.rule_id);
    if (!rule) continue;

    for (const itemResult of result.item_results) {
      const ledgerItem = items[itemResult.itemIndex];
      if (!ledgerItem) continue;
      applyAssessmentResultToLedger(ledgerItem, itemResult, rule);
    }
  }

  const medicalDefaultRatio = (
    coverageCode === ACCIDENT_COVERAGE_CODES.MEDICAL ||
    coverageCode === MEDICAL_COVERAGE_CODES.INPATIENT
  ) ? getMedicalDefaultRatio(coverageConfig) : 1;

  if (medicalDefaultRatio !== 1) {
    items.forEach((item) => {
      if (item.locked || item.payableAmount <= 0) return;
      pushLossEntry(item, {
        step: 'RATIO',
        ruleId: 'SYSTEM_DEFAULT_RATIO',
        beforeAmount: item.payableAmount,
        afterAmount: item.payableAmount * medicalDefaultRatio,
        reasonCode: 'DEFAULT_REIMBURSEMENT_RATIO',
        message: `按默认赔付比例 ${medicalDefaultRatio}`
      });
    });
  }

  const deductibleAmount = getConfiguredAmount(coverageConfig?.deductible);
  const appliedDeductible = allocateCoverageDeductible(items, deductibleAmount);
  const preCapTotal = roundAmount(items.reduce((sum, item) => sum + item.payableAmount, 0));
  const sumInsured = getConfiguredAmount(coverageConfig?.sum_insured) || Infinity;
  const capApplied = Number.isFinite(sumInsured) ? allocateCoverageCap(items, sumInsured) : false;
  const lossPayableAmount = roundAmount(items.reduce((sum, item) => sum + item.payableAmount, 0));

  items.forEach((item) => {
    if (item.manualReviewReasons.length > 0) {
      item.status = 'MANUAL_REVIEW';
    } else if (item.payableAmount <= 0) {
      item.status = 'ZERO_PAY';
    }
    delete item.locked;
  });

  const claimedAmount = roundAmount(items.reduce((sum, item) => sum + item.claimedAmount, 0));
  const coverageResult = buildCoverageResult({
    coverageCode,
    claimedAmount,
    approvedAmount: lossPayableAmount,
    deductible: appliedDeductible,
    reimbursementRatio: medicalDefaultRatio,
    sumInsured,
    status: getCoverageStatus(needsManualReview || items.some(item => item.status === 'MANUAL_REVIEW'), lossPayableAmount),
    warnings
  });

  return {
    lossLedger: items,
    coverageResults: [coverageResult],
    lossPayableAmount,
    deductible: appliedDeductible,
    reimbursementRatio: medicalDefaultRatio,
    totalClaimable: claimedAmount,
    capApplied: capApplied || (Number.isFinite(sumInsured) && preCapTotal > sumInsured),
    legacyItemBreakdown: buildLegacyItemBreakdown(items)
  };
}

function buildBenefitBaseAmount({ coverageCode, coverageConfig, context, claimType }) {
  if (coverageCode === ACCIDENT_COVERAGE_CODES.DISABILITY) {
    const base = getConfiguredAmount(coverageConfig?.sum_insured);
    const disabilityGrade = toNumericGrade(context?.claim?.disability_grade);
    const gradeRatio = findDisabilityGradeRatio(context, disabilityGrade);
    return roundAmount(base * (gradeRatio ?? 1));
  }
  if (coverageCode === ACCIDENT_COVERAGE_CODES.DEATH || claimType === 'CRITICAL_ILLNESS') {
    return getConfiguredAmount(coverageConfig?.sum_insured);
  }
  if (coverageCode === ACCIDENT_COVERAGE_CODES.ALLOWANCE) {
    const dailyAllowance = Number(coverageConfig?.daily_allowance || 0);
    return roundAmount((Number(context.claim?.hospital_days || 0) || 0) * dailyAllowance);
  }
  return getConfiguredAmount(coverageConfig?.sum_insured);
}

export function runBenefitLedger({
  context,
  coverageCode,
  coverageConfig,
  claimType,
  eligibilityResult,
  warnings = [],
  needsManualReview = false
}) {
  const manualReviewReasons = [];
  const baseAmount = buildBenefitBaseAmount({ coverageCode, coverageConfig, context, claimType });
  const modifiers = resolveBenefitModifiers({ context, coverageCode, claimType });
  const ratio = extractClaimRatio(eligibilityResult) ?? modifiers.payoutRatio ?? 1;
  const priorBenefit = roundAmount(
    context.claim?.prior_benefit ||
    context.claim?.prior_disability_paid ||
    context.claim?.priorDisabilityPaid ||
    0
  );
  const sumInsured = getConfiguredAmount(coverageConfig?.sum_insured) || Infinity;
  const entries = [
    {
      step: 'INIT',
      beforeAmount: baseAmount,
      afterAmount: baseAmount,
      message: '初始化给付责任'
    }
  ];

  if (!eligibilityResult?.eligible) {
    return {
      benefitLedger: [{
        coverageCode,
        claimedAmount: baseAmount,
        payableAmount: 0,
        status: 'ZERO_PAY',
        entries,
        manualReviewReasons
      }],
      coverageResults: [
        buildCoverageResult({
          coverageCode,
          claimedAmount: baseAmount,
          approvedAmount: 0,
          deductible: 0,
          reimbursementRatio: 0,
          sumInsured,
          status: getCoverageStatus(needsManualReview, 0),
          warnings
        })
      ],
      benefitPayableAmount: 0,
      totalClaimable: baseAmount,
      reimbursementRatio: 0
    };
  }

  let currentAmount = baseAmount;
  entries.push({
    step: 'TRIGGER',
    beforeAmount: currentAmount,
    afterAmount: currentAmount,
    message: '责任触发成立'
  });

  manualReviewReasons.push(...collectBenefitManualReviewReasons({
    context,
    coverageCode,
    claimType,
    baseAmount
  }));
  manualReviewReasons.push(
    ...modifiers.missingConditions.map((message) => buildManualReviewReason('BENEFIT_EXTRA_CONDITION_UNCONFIRMED', message))
  );

  if (baseAmount > 0) {
    entries.push({
      step: 'BASE_AMOUNT',
      beforeAmount: currentAmount,
      afterAmount: currentAmount,
      reasonCode: 'BENEFIT_BASE_AMOUNT',
      message: '确定给付基础金额'
    });
  }

  if (ratio !== 1) {
    const afterRatio = roundAmount(currentAmount * ratio);
    entries.push({
      step: 'RATIO',
      beforeAmount: currentAmount,
      afterAmount: afterRatio,
      reasonCode: 'BENEFIT_RATIO_APPLIED',
      message: `按给付比例 ${ratio}`
    });
    currentAmount = afterRatio;
  }

  if (modifiers.extraPayoutRatio > 0 && currentAmount > 0) {
    const extraAmount = roundAmount(baseAmount * modifiers.extraPayoutRatio);
    const afterExtra = roundAmount(currentAmount + extraAmount);
    entries.push({
      step: 'RATIO',
      beforeAmount: currentAmount,
      afterAmount: afterExtra,
      reasonCode: 'EXTRA_BENEFIT_APPLIED',
      message: modifiers.extraPayoutReason || `额外赔付 ${modifiers.extraPayoutRatio * 100}%`
    });
    currentAmount = afterExtra;
  }

  if (priorBenefit > 0) {
    const afterPrior = Math.max(0, roundAmount(currentAmount - priorBenefit));
    entries.push({
      step: 'DEDUCT_PRIOR_BENEFIT',
      beforeAmount: currentAmount,
      afterAmount: afterPrior,
      reasonCode: 'PRIOR_BENEFIT_DEDUCTED',
      message: `扣减既往赔付 ${priorBenefit}`
    });
    currentAmount = afterPrior;
  }

  const cappedAmount = Number.isFinite(sumInsured) ? Math.min(currentAmount, sumInsured) : currentAmount;
  entries.push({
    step: 'CAP',
    beforeAmount: currentAmount,
    afterAmount: cappedAmount,
    reasonCode: 'SUM_INSURED_CAP',
    message: '按责任保额上限收敛'
  });
  currentAmount = roundAmount(cappedAmount);

  const combinedManualReviewReasons = [
    ...manualReviewReasons,
    ...((eligibilityResult?.manualReviewReasons || []).map((reason) => buildManualReviewReason(reason.code || 'LIABILITY_MANUAL_REVIEW', reason.message || '需人工复核')))
  ];

  if (combinedManualReviewReasons.length > 0 || needsManualReview) {
    entries.push({
      step: 'FLAG',
      beforeAmount: currentAmount,
      afterAmount: currentAmount,
      reasonCode: 'BENEFIT_MANUAL_REVIEW',
      message: '给付责任需人工复核'
    });
  }

  const status = combinedManualReviewReasons.length > 0 || needsManualReview
    ? 'MANUAL_REVIEW'
    : getCoverageStatus(false, currentAmount);

  const benefitCoverage = {
    coverageCode,
    claimedAmount: baseAmount,
    payableAmount: currentAmount,
    status,
    entries,
    manualReviewReasons: combinedManualReviewReasons
  };

  const addonBenefitCoverages = coverageCode === ACCIDENT_COVERAGE_CODES.DEATH
    ? collectAccidentDeathAddonCoverages(context, eligibilityResult, status)
    : [];
  const allBenefitCoverages = [benefitCoverage, ...addonBenefitCoverages];
  const coverageResults = allBenefitCoverages.map((item) => {
    const sumInsuredValue = coverageCode === item.coverageCode
      ? sumInsured
      : getConfiguredAmount(getPolicyCoverageConfig(context, item.coverageCode)?.sum_insured) || Infinity;
    return buildCoverageResult({
      coverageCode: item.coverageCode,
      claimedAmount: item.claimedAmount,
      approvedAmount: item.payableAmount,
      deductible: 0,
      reimbursementRatio: ratio,
      sumInsured: sumInsuredValue,
      status: item.status,
      warnings
    });
  });
  const totalBenefitPayableAmount = roundAmount(allBenefitCoverages.reduce((sum, item) => sum + (item.payableAmount || 0), 0));
  const totalClaimable = roundAmount(allBenefitCoverages.reduce((sum, item) => sum + (item.claimedAmount || 0), 0));

  return {
    benefitLedger: allBenefitCoverages,
    coverageResults,
    benefitPayableAmount: totalBenefitPayableAmount,
    totalClaimable,
    reimbursementRatio: ratio
  };
}
