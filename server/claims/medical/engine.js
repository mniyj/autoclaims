import { getCoverageConfig } from '../../rules/context.js';

const MEDICAL_COVERAGE_CODES = {
  INPATIENT: 'HLT_INPATIENT'
};

export function inferMedicalCoverageCode() {
  return MEDICAL_COVERAGE_CODES.INPATIENT;
}

export function getMedicalCoverageConfig(productCode, coverageCode = MEDICAL_COVERAGE_CODES.INPATIENT, rulesetOverride = null) {
  return getCoverageConfig(productCode, coverageCode, rulesetOverride);
}

export function isMedicalCoverageCode(coverageCode) {
  return Object.values(MEDICAL_COVERAGE_CODES).includes(coverageCode);
}

export { MEDICAL_COVERAGE_CODES };
