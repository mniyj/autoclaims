import { executeFullReview } from './rules/engine.js';
import { pathToFileURL } from 'node:url';

const PRESETS = {
  base_death: {
    description: '基础意外身故给付',
    claimCaseId: 'claim-2',
    productCode: 'ZA_ACC_COMP_2022',
    ocrData: {
      accident_date: '2024-06-12',
      death_confirmed: true,
      death_date: '2024-06-12',
      result_date: '2024-06-12',
      cause_type: 'ACCIDENT',
      result_type: 'DEATH',
      is_drunk_driving: false,
    },
  },
  death_after_disability: {
    description: '身故前已赔伤残金自动扣减',
    claimCaseId: 'claim-2',
    productCode: 'ZA_ACC_COMP_2022',
    ocrData: {
      accident_date: '2024-06-12',
      death_confirmed: true,
      death_date: '2024-06-12',
      result_date: '2024-06-12',
      cause_type: 'ACCIDENT',
      result_type: 'DEATH',
      prior_disability_paid: 20000,
      is_drunk_driving: false,
    },
  },
  public_transport_death: {
    description: '营运交通意外身故叠加给付',
    claimCaseId: 'claim-2',
    productCode: 'ZA_ACC_COMP_2022',
    ocrData: {
      accident_date: '2024-06-12',
      death_confirmed: true,
      death_date: '2024-06-12',
      result_date: '2024-06-12',
      cause_type: 'ACCIDENT',
      result_type: 'DEATH',
      scenario: 'PUBLIC_TRANSPORT_PASSENGER',
      transport_type: 'TRAIN',
      is_drunk_driving: false,
    },
  },
  private_car_death: {
    description: '私家车乘客意外身故叠加给付',
    claimCaseId: 'claim-2',
    productCode: 'ZA_ACC_COMP_2022',
    ocrData: {
      accident_date: '2024-06-12',
      death_confirmed: true,
      death_date: '2024-06-12',
      result_date: '2024-06-12',
      cause_type: 'ACCIDENT',
      result_type: 'DEATH',
      scenario: 'PRIVATE_CAR_PASSENGER',
      vehicle_is_non_commercial: true,
      vehicle_is_truck: false,
      is_drunk_driving: false,
    },
  },
};

async function runPreset(name) {
  const preset = PRESETS[name];
  if (!preset) {
    throw new Error(`未知预置场景: ${name}`);
  }

  const result = await executeFullReview({
    claimCaseId: preset.claimCaseId,
    productCode: preset.productCode,
    ocrData: preset.ocrData,
    invoiceItems: [],
  });

  return {
    preset: name,
    description: preset.description,
    claimCaseId: preset.claimCaseId,
    productCode: preset.productCode,
    decision: result.decision,
    intakeDecision: result.intakeDecision,
    liabilityDecision: result.liabilityDecision,
    assessmentDecision: result.assessmentDecision,
    settlementDecision: result.settlementDecision,
    payableAmount: result.payableAmount,
    matchedRules: result.eligibility?.matchedRules || [],
    coverageResults: result.coverageResults || [],
    benefitLedger: result.amount?.benefitLedger || [],
    missingMaterials: result.missingMaterials || [],
    manualReviewReasons: result.manualReviewReasons || [],
    warnings: result.warnings || [],
  };
}

async function main() {
  const [, , presetName = 'base_death'] = process.argv;

  if (presetName === '--list') {
    console.log(JSON.stringify(Object.keys(PRESETS), null, 2));
    return;
  }

  const output = await runPreset(presetName);
  console.log(JSON.stringify(output, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
