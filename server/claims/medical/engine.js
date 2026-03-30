import { getCoverageConfig } from '../../rules/context.js';

const MEDICAL_COVERAGE_CODES = {
  INPATIENT: 'HLT_INPATIENT',
  OPD_SOCIAL: 'HLT_OPD_SOCIAL',
  OPD_NON_SOCIAL: 'HLT_OPD_NON_SOCIAL'
};

export function getMedicalCoverageConfig(productCode, coverageCode = MEDICAL_COVERAGE_CODES.INPATIENT, rulesetOverride = null) {
  return getCoverageConfig(productCode, coverageCode, rulesetOverride);
}

export function isMedicalCoverageCode(coverageCode) {
  return Object.values(MEDICAL_COVERAGE_CODES).includes(coverageCode);
}

export { MEDICAL_COVERAGE_CODES };
