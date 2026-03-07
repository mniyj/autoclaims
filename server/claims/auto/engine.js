import { getCoverageConfig } from '../../rules/context.js';

const AUTO_COVERAGE_CODES = {
  COMPULSORY: 'AUTO_COMPULSORY',
  THIRD_PARTY: 'AUTO_THIRD_PARTY',
  VEHICLE_DAMAGE: 'AUTO_VEHICLE_DAMAGE',
  DRIVER_PASSENGER: 'AUTO_DRIVER_PASSENGER'
};

const AUTO_COVERAGE_ALIASES = {
  [AUTO_COVERAGE_CODES.COMPULSORY]: ['交强险', 'COMPULSORY'],
  [AUTO_COVERAGE_CODES.THIRD_PARTY]: ['第三者责任险', 'THIRD_PARTY'],
  [AUTO_COVERAGE_CODES.VEHICLE_DAMAGE]: ['车辆损失险', 'VEHICLE_DAMAGE'],
  [AUTO_COVERAGE_CODES.DRIVER_PASSENGER]: ['车上人员责任险', 'DRIVER_PASSENGER']
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

  switch (explicitType) {
    case AUTO_COVERAGE_CODES.COMPULSORY:
    case 'COMPULSORY':
    case '交强险':
      return AUTO_COVERAGE_CODES.COMPULSORY;
    case AUTO_COVERAGE_CODES.THIRD_PARTY:
    case 'THIRD_PARTY':
    case '第三者责任险':
      return AUTO_COVERAGE_CODES.THIRD_PARTY;
    case AUTO_COVERAGE_CODES.DRIVER_PASSENGER:
    case 'DRIVER_PASSENGER':
    case '车上人员责任险':
      return AUTO_COVERAGE_CODES.DRIVER_PASSENGER;
    case AUTO_COVERAGE_CODES.VEHICLE_DAMAGE:
    case 'VEHICLE_DAMAGE':
    case '车辆损失险':
    default:
      return AUTO_COVERAGE_CODES.VEHICLE_DAMAGE;
  }
}

export function getAutoFaultRatio(context) {
  return (
    normalizeRatio(context.claim?.fault_ratio) ??
    normalizeRatio(context.claim?.faultRatio) ??
    normalizeRatio(context.claim?.insured_liability_ratio) ??
    normalizeRatio(context.claim?.insuredLiabilityRatio) ??
    normalizeRatio(context.claim?.third_party_liability_ratio) ??
    1
  );
}

export function getAutoCoverageConfig(productCode, coverageCode) {
  const exact = getCoverageConfig(productCode, coverageCode);
  if (exact) return exact;

  const aliases = AUTO_COVERAGE_ALIASES[coverageCode] || [];
  for (const alias of aliases) {
    const matched = getCoverageConfig(productCode, alias);
    if (matched) return matched;
  }

  return null;
}

export function isAutoCoverageCode(coverageCode) {
  return Object.values(AUTO_COVERAGE_CODES).includes(coverageCode);
}

export { AUTO_COVERAGE_CODES };
