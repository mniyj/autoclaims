import { getCoverageConfig } from '../../rules/context.js';

const ACCIDENT_COVERAGE_CODES = {
  MEDICAL: 'ACC_MEDICAL',
  DISABILITY: 'ACC_DISABILITY',
  DEATH: 'ACC_DEATH',
  ALLOWANCE: 'ACC_HOSPITAL_ALLOWANCE'
};

export function getAccidentCoverageConfig(productCode, coverageCode, rulesetOverride = null) {
  return getCoverageConfig(productCode, coverageCode, rulesetOverride);
}

export function isAccidentCoverageCode(coverageCode) {
  return Object.values(ACCIDENT_COVERAGE_CODES).includes(coverageCode);
}

export { ACCIDENT_COVERAGE_CODES };
