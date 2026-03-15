import { getCoverageConfig } from '../../rules/context.js';

const AUTO_COVERAGE_CODES = {
  COMPULSORY: 'AUTO_COMPULSORY',
  THIRD_PARTY: 'AUTO_THIRD_PARTY',
  VEHICLE_DAMAGE: 'AUTO_VEHICLE_DAMAGE',
  DRIVER_PASSENGER: 'AUTO_DRIVER_PASSENGER'
};

const AUTO_COVERAGE_ALIASES = {
  [AUTO_COVERAGE_CODES.COMPULSORY]: ['交强险', 'COMPULSORY', 'CTPL', 'JQX'],
  [AUTO_COVERAGE_CODES.THIRD_PARTY]: ['第三者责任险', '第三者责任保险', 'THIRD_PARTY', 'TPL'],
  [AUTO_COVERAGE_CODES.VEHICLE_DAMAGE]: ['车辆损失险', '机动车损失保险', 'VEHICLE_DAMAGE', 'VHL'],
  [AUTO_COVERAGE_CODES.DRIVER_PASSENGER]: ['车上人员责任险', '驾乘人员责任险', 'DRIVER_PASSENGER', 'SEAT', 'DRIVER']
};

const AUTO_INJURY_GRADE_RATIO = {
  死亡: 1,
  重伤: 0.8,
  轻伤: 0.3
};

function normalizeRatio(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed > 1) return Math.max(0, Math.min(parsed / 100, 1));
  return Math.max(0, Math.min(parsed, 1));
}

export function inferAutoCoverageCode(context, state = {}) {
  if (state.coverageCode) {
    return state.coverageCode;
  }

  const explicitType =
    context.claim?.auto_coverage_type ||
    context.claim?.autoCoverageType ||
    context.claim?.claim_liability_type ||
    context.claim?.claimLiabilityType;

  switch (typeof explicitType === 'string' ? explicitType.trim().toUpperCase() : explicitType) {
    case AUTO_COVERAGE_CODES.COMPULSORY:
    case 'COMPULSORY':
    case '交强险':
    case 'CTPL':
    case 'JQX':
      return AUTO_COVERAGE_CODES.COMPULSORY;
    case AUTO_COVERAGE_CODES.THIRD_PARTY:
    case 'THIRD_PARTY':
    case '第三者责任险':
    case '第三者责任保险':
    case 'TPL':
      return AUTO_COVERAGE_CODES.THIRD_PARTY;
    case AUTO_COVERAGE_CODES.DRIVER_PASSENGER:
    case 'DRIVER_PASSENGER':
    case '车上人员责任险':
    case '驾乘人员责任险':
    case 'SEAT':
    case 'DRIVER':
      return AUTO_COVERAGE_CODES.DRIVER_PASSENGER;
    case AUTO_COVERAGE_CODES.VEHICLE_DAMAGE:
    case 'VEHICLE_DAMAGE':
    case '车辆损失险':
      return AUTO_COVERAGE_CODES.VEHICLE_DAMAGE;
  }

  if (context.claim?.third_party_loss_amount || context.claim?.thirdPartyLossAmount) {
    return AUTO_COVERAGE_CODES.THIRD_PARTY;
  }

  if (context.claim?.passenger_injury_amount || context.claim?.injury_grade) {
    return AUTO_COVERAGE_CODES.DRIVER_PASSENGER;
  }

  return AUTO_COVERAGE_CODES.VEHICLE_DAMAGE;
}

export function getAutoFaultRatio(context) {
  return (
    normalizeRatio(context.claim?.fault_ratio) ??
    normalizeRatio(context.claim?.faultRatio) ??
    normalizeRatio(context.claim?.insured_liability_ratio) ??
    normalizeRatio(context.claim?.insuredLiabilityRatio) ??
    normalizeRatio(context.claim?.third_party_liability_ratio) ??
    normalizeRatio(context.claim?.thirdPartyLiabilityRatio) ??
    normalizeRatio(context.claim?.thirdPartyLiabilityPct) ??
    normalizeRatio(context.claim?.claimant_liability_pct !== undefined ? 100 - context.claim.claimant_liability_pct : null) ??
    normalizeRatio(context.claim?.claimantLiabilityPct !== undefined ? 100 - context.claim.claimantLiabilityPct : null) ??
    1
  );
}

export function getAutoCoverageConfig(productCode, coverageCode, rulesetOverride = null) {
  const exact = getCoverageConfig(productCode, coverageCode, rulesetOverride);
  if (exact) return exact;

  const aliases = AUTO_COVERAGE_ALIASES[coverageCode] || [];
  for (const alias of aliases) {
    const matched = getCoverageConfig(productCode, alias, rulesetOverride);
    if (matched) return matched;
  }

  return null;
}

export function isAutoCoverageCode(coverageCode) {
  return Object.values(AUTO_COVERAGE_CODES).includes(coverageCode);
}

function getNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function sumResolvedNumbers(groups) {
  return groups.reduce((sum, group) => sum + getNumber(...group), 0);
}

function getConfiguredAmount(value) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && typeof value.amount === 'number') {
    return value.amount;
  }
  return 0;
}

export function getAutoLossAmount(context, factResult, coverageCode, coverageConfig = null) {
  const totalApproved = factResult?.totalApproved || 0;

  if (coverageCode === AUTO_COVERAGE_CODES.VEHICLE_DAMAGE) {
    return getNumber(
      context.claim?.repair_estimate,
      context.claim?.repairEstimate,
      context.claim?.vehicle_damage_amount,
      context.claim?.vehicleDamageAmount,
      totalApproved
    );
  }

  if (coverageCode === AUTO_COVERAGE_CODES.THIRD_PARTY || coverageCode === AUTO_COVERAGE_CODES.COMPULSORY) {
    const explicitTotal = getNumber(
      context.claim?.third_party_loss_amount,
      context.claim?.thirdPartyLossAmount,
      context.claim?.third_party_damage_amount,
      context.claim?.thirdPartyDamageAmount
    );
    if (explicitTotal > 0) {
      return explicitTotal;
    }

    const componentTotal = sumResolvedNumbers([
      [
        context.claim?.third_party_property_damage_amount,
        context.claim?.thirdPartyPropertyDamageAmount
      ],
      [
        context.claim?.third_party_injury_amount,
        context.claim?.thirdPartyInjuryAmount
      ],
      [
        context.claim?.third_party_death_disability_amount,
        context.claim?.thirdPartyDeathDisabilityAmount
      ]
    ]);

    return componentTotal || totalApproved;
  }

  if (coverageCode === AUTO_COVERAGE_CODES.DRIVER_PASSENGER) {
    const injuryGrade = context.claim?.injury_grade || context.claim?.injuryGrade;
    const perSeatSumInsured = getConfiguredAmount(coverageConfig?.per_seat_sum_insured);
    if (perSeatSumInsured > 0 && AUTO_INJURY_GRADE_RATIO[injuryGrade]) {
      return perSeatSumInsured * AUTO_INJURY_GRADE_RATIO[injuryGrade];
    }

    return getNumber(
      context.claim?.passenger_injury_amount,
      context.claim?.passengerInjuryAmount,
      totalApproved
    );
  }

  return totalApproved;
}

export function getAutoActualValue(context, coverageConfig = null) {
  return getNumber(
    context.claim?.vehicle?.actual_value,
    context.claim?.vehicle?.actualValue,
    context.vehicle?.actual_value,
    context.vehicle?.actualValue,
    coverageConfig?.sum_insured?.amount,
    coverageConfig?.sum_insured
  );
}

export function getCompulsoryBreakdown(context) {
  const propertyDamage = getNumber(
    context.claim?.third_party_property_damage_amount,
    context.claim?.thirdPartyPropertyDamageAmount
  );
  const injury = getNumber(
    context.claim?.third_party_injury_amount,
    context.claim?.thirdPartyInjuryAmount
  );
  const deathDisability = getNumber(
    context.claim?.third_party_death_disability_amount,
    context.claim?.thirdPartyDeathDisabilityAmount
  );

  return {
    propertyDamage,
    injury,
    deathDisability,
    total: propertyDamage + injury + deathDisability
  };
}

export { AUTO_COVERAGE_CODES };
