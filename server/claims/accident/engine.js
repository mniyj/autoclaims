import { getCoverageConfig } from '../../rules/context.js';

const ACCIDENT_COVERAGE_CODES = {
  MEDICAL: 'ACC_MEDICAL',
  DISABILITY: 'ACC_DISABILITY',
  DEATH: 'ACC_DEATH',
  ALLOWANCE: 'ACC_HOSPITAL_ALLOWANCE'
};

export function inferAccidentCoverageCode(context, state = {}) {
  if (state.coverageCode) {
    return state.coverageCode;
  }

  if (context.claim?.death_confirmed) {
    return ACCIDENT_COVERAGE_CODES.DEATH;
  }

  const disabilityGrade = Number(context.claim?.disability_grade);
  if (Number.isFinite(disabilityGrade) && disabilityGrade > 0) {
    return ACCIDENT_COVERAGE_CODES.DISABILITY;
  }

  if ((context.claim?.hospital_days || 0) > 0 && (context.claim?.expense_items || []).length === 0) {
    return ACCIDENT_COVERAGE_CODES.ALLOWANCE;
  }

  return ACCIDENT_COVERAGE_CODES.MEDICAL;
}

export function getAccidentCoverageConfig(productCode, coverageCode, rulesetOverride = null) {
  return getCoverageConfig(productCode, coverageCode, rulesetOverride);
}

export function isAccidentCoverageCode(coverageCode) {
  return Object.values(ACCIDENT_COVERAGE_CODES).includes(coverageCode);
}

export { ACCIDENT_COVERAGE_CODES };
