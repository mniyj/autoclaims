function toDateOnly(value) {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().split('T')[0];
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractAgeLike(value) {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const matched = value.match(/(\d{1,3})/);
    if (matched) {
      const parsed = Number(matched[1]);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
  }
  return undefined;
}

function normalizeDiagnosisNames(...values) {
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
    if (typeof value === 'string') {
      value
        .split(/[；;、,\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => names.push(item));
    }
  };
  values.forEach(append);
  return [...new Set(names)];
}

function toBooleanLike(value, fallback = undefined) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', '是'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', '否'].includes(normalized)) return false;
  }
  return fallback;
}

export function calculateClaimedTotal(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const amount = item.totalPrice || item.amount || item.total || 0;
    return sum + Number(amount);
  }, 0);
}

export function normalizeClaimContext(claimCase = {}, ocrData = {}, invoiceItems = []) {
  const safeClaimCase = claimCase || {};
  const safeOcrData = ocrData || {};
  const normalized = {
    ...safeClaimCase,
    ...safeOcrData
  };

  normalized.accident_date = toDateOnly(
    safeOcrData.accident_date ||
    safeOcrData.accidentDate ||
    safeClaimCase.accident_date ||
    safeClaimCase.accidentDate ||
    safeClaimCase.accidentTime
  );

  normalized.report_time = toDateOnly(
    safeOcrData.report_time ||
    safeOcrData.reportTime ||
    safeClaimCase.report_time ||
    safeClaimCase.reportTime
  );

  normalized.claimed_amount =
    toNumber(
      safeOcrData.claimed_amount ||
      safeOcrData.totalAmount ||
      safeClaimCase.claimed_amount ||
      safeClaimCase.claimAmount
    ) || 0;

  normalized.accident_reason =
    safeOcrData.accident_reason ||
    safeOcrData.accidentReason ||
    safeClaimCase.accident_reason ||
    safeClaimCase.accidentReason;

  normalized.expense_items = invoiceItems.length > 0 ? invoiceItems : (safeOcrData.chargeItems || []);
  if (normalized.expense_items.length === 0) {
    const socialMedicalAmount = toNumber(
      safeOcrData.social_medical_amount ??
      safeOcrData.socialMedicalAmount ??
      safeClaimCase.social_medical_amount ??
      safeClaimCase.socialMedicalAmount
    ) || 0;
    const nonSocialMedicalAmount = toNumber(
      safeOcrData.non_social_medical_amount ??
      safeOcrData.nonSocialMedicalAmount ??
      safeClaimCase.non_social_medical_amount ??
      safeClaimCase.nonSocialMedicalAmount
    ) || 0;

    const synthesizedExpenseItems = [];
    if (socialMedicalAmount > 0) {
      synthesizedExpenseItems.push({
        id: 'synthetic-social-medical',
        itemName: '医保内门急诊费用',
        amount: socialMedicalAmount,
        totalPrice: socialMedicalAmount,
        socialInsuranceScope: 'IN',
        source: 'intake-summary',
      });
    }
    if (nonSocialMedicalAmount > 0) {
      synthesizedExpenseItems.push({
        id: 'synthetic-non-social-medical',
        itemName: '医保外门急诊费用',
        amount: nonSocialMedicalAmount,
        totalPrice: nonSocialMedicalAmount,
        socialInsuranceScope: 'OUT',
        source: 'intake-summary',
      });
    }
    normalized.expense_items = synthesizedExpenseItems;
  }
  normalized.total_claimed_amount = calculateClaimedTotal(normalized.expense_items);

  normalized.disability_grade =
    safeOcrData.disability_grade ??
    safeOcrData.disabilityGrade ??
    safeClaimCase.disability_grade ??
    safeClaimCase.disabilityGrade ??
    null;

  normalized.death_confirmed = Boolean(
    safeOcrData.death_confirmed ||
    safeOcrData.deathConfirmed ||
    safeClaimCase.death_confirmed ||
    safeClaimCase.deathConfirmed
  );

  normalized.is_drunk_driving =
    toBooleanLike(
      safeOcrData.is_drunk_driving ??
      safeOcrData.isDrunkDriving ??
      safeClaimCase.is_drunk_driving ??
      safeClaimCase.isDrunkDriving,
      false
    );

  normalized.hospital_days =
    toNumber(
      safeOcrData.hospital_days ||
      safeOcrData.hospitalDays ||
      safeClaimCase.hospital_days ||
      safeClaimCase.hospitalDays
    ) || 0;

  normalized.insured_age =
    extractAgeLike(
      safeOcrData.insured_age ||
      safeOcrData.insuredAge ||
      safeOcrData.age ||
      safeOcrData.basicInfo?.age ||
      safeClaimCase.insured_age ||
      safeClaimCase.insuredAge ||
      safeClaimCase.age
    );

  normalized.insured_birth_date = toDateOnly(
    safeOcrData.insured_birth_date ||
    safeOcrData.insuredBirthDate ||
    safeOcrData.birth_date ||
    safeOcrData.birthDate ||
    safeClaimCase.insured_birth_date ||
    safeClaimCase.insuredBirthDate ||
    safeClaimCase.birthDate
  );

  normalized.special_disease_confirmed =
    safeOcrData.special_disease_confirmed ??
    safeOcrData.specialDiseaseConfirmed ??
    safeClaimCase.special_disease_confirmed ??
    safeClaimCase.specialDiseaseConfirmed ??
    null;

  normalized.diagnosis_names = normalizeDiagnosisNames(
    safeOcrData.diagnosis_names,
    safeOcrData.diagnosisNames,
    safeOcrData.diagnoses,
    safeOcrData.diagnosis,
    safeOcrData.diagnosis_result,
    safeOcrData.diagnosisResult,
    safeClaimCase.diagnosis_names,
    safeClaimCase.diagnosisNames,
    safeClaimCase.diagnosis,
    safeClaimCase.diagnosis_result,
    safeClaimCase.diagnosisResult
  );

  normalized.auto_coverage_type =
    safeOcrData.auto_coverage_type ||
    safeOcrData.autoCoverageType ||
    safeClaimCase.auto_coverage_type ||
    safeClaimCase.autoCoverageType ||
    safeClaimCase.claim_liability_type ||
    safeClaimCase.claimLiabilityType;

  normalized.fault_ratio =
    toNumber(
      safeOcrData.fault_ratio ||
      safeOcrData.faultRatio ||
      safeClaimCase.fault_ratio ||
      safeClaimCase.faultRatio
    );

  normalized.insured_liability_ratio =
    toNumber(
      safeOcrData.insured_liability_ratio ||
      safeOcrData.insuredLiabilityRatio ||
      safeClaimCase.insured_liability_ratio ||
      safeClaimCase.insuredLiabilityRatio
    );

  normalized.third_party_liability_ratio =
    toNumber(
      safeOcrData.third_party_liability_ratio ||
      safeOcrData.thirdPartyLiabilityRatio ||
      safeOcrData.thirdPartyLiabilityPct ||
      safeClaimCase.third_party_liability_ratio ||
      safeClaimCase.thirdPartyLiabilityRatio ||
      safeClaimCase.thirdPartyLiabilityPct
    );

  normalized.claimant_liability_pct =
    toNumber(
      safeOcrData.claimant_liability_pct ||
      safeOcrData.claimantLiabilityPct ||
      safeClaimCase.claimant_liability_pct ||
      safeClaimCase.claimantLiabilityPct
    );

  normalized.repair_estimate =
    toNumber(
      safeOcrData.repair_estimate ||
      safeOcrData.repairEstimate ||
      safeClaimCase.repair_estimate ||
      safeClaimCase.repairEstimate
    ) || 0;

  normalized.third_party_loss_amount =
    toNumber(
      safeOcrData.third_party_loss_amount ||
      safeOcrData.thirdPartyLossAmount ||
      safeClaimCase.third_party_loss_amount ||
      safeClaimCase.thirdPartyLossAmount
    );

  normalized.third_party_property_damage_amount =
    toNumber(
      safeOcrData.third_party_property_damage_amount ||
      safeOcrData.thirdPartyPropertyDamageAmount ||
      safeClaimCase.third_party_property_damage_amount ||
      safeClaimCase.thirdPartyPropertyDamageAmount
    );

  normalized.third_party_injury_amount =
    toNumber(
      safeOcrData.third_party_injury_amount ||
      safeOcrData.thirdPartyInjuryAmount ||
      safeClaimCase.third_party_injury_amount ||
      safeClaimCase.thirdPartyInjuryAmount
    );

  normalized.third_party_death_disability_amount =
    toNumber(
      safeOcrData.third_party_death_disability_amount ||
      safeOcrData.thirdPartyDeathDisabilityAmount ||
      safeClaimCase.third_party_death_disability_amount ||
      safeClaimCase.thirdPartyDeathDisabilityAmount
    );

  normalized.vehicle_damage_amount =
    toNumber(
      safeOcrData.vehicle_damage_amount ||
      safeOcrData.vehicleDamageAmount ||
      safeClaimCase.vehicle_damage_amount ||
      safeClaimCase.vehicleDamageAmount
    );

  normalized.passenger_injury_amount =
    toNumber(
      safeOcrData.passenger_injury_amount ||
      safeOcrData.passengerInjuryAmount ||
      safeClaimCase.passenger_injury_amount ||
      safeClaimCase.passengerInjuryAmount
    );

  normalized.injury_grade =
    safeOcrData.injury_grade ||
    safeOcrData.injuryGrade ||
    safeClaimCase.injury_grade ||
    safeClaimCase.injuryGrade;

  normalized.vehicle = {
    ...(safeClaimCase.vehicle || {}),
    ...(safeOcrData.vehicle || {})
  };

  const normalizedActualValue = toNumber(
    normalized.vehicle.actual_value ||
    normalized.vehicle.actualValue ||
    safeOcrData.actual_value ||
    safeOcrData.actualValue ||
    safeClaimCase.actual_value ||
    safeClaimCase.actualValue
  );
  if (normalizedActualValue !== undefined) {
    normalized.vehicle.actual_value = normalizedActualValue;
  }

  if (safeOcrData.basicInfo) {
    normalized.patient_name = safeOcrData.basicInfo.name;
    normalized.patient_gender = safeOcrData.basicInfo.gender;
    normalized.admission_date = toDateOnly(safeOcrData.basicInfo.admissionDate);
    normalized.discharge_date = toDateOnly(safeOcrData.basicInfo.dischargeDate);
    normalized.diagnosis = safeOcrData.basicInfo.dischargeDiagnosis;
    normalized.department = safeOcrData.basicInfo.department;
  }

  if (safeOcrData.invoiceInfo) {
    normalized.hospital_name = safeOcrData.invoiceInfo.hospitalName;
    normalized.invoice_date = toDateOnly(safeOcrData.invoiceInfo.issueDate);
  }

  if (safeOcrData.insurancePayment) {
    normalized.social_insurance_paid = safeOcrData.insurancePayment.governmentFundPayment || 0;
    normalized.personal_payment = safeOcrData.insurancePayment.personalPayment || 0;
    normalized.personal_self_pay = safeOcrData.insurancePayment.personalSelfPayment || 0;
    normalized.personal_self_expense = safeOcrData.insurancePayment.personalSelfExpense || 0;
  }

  // Default unsupported/negative exclusion facts to false so product-level review can
  // run without requiring every exclusion field to be explicitly supplied.
  const booleanFactDefaults = [
    'policyholder_intentional_harm',
    'self_inflicted',
    'criminal_act',
    'detained_or_imprisoned',
    'intoxicated_or_drug',
    'illegal_drug_use',
    'illegal_driving',
    'pre_existing_condition',
    'exam_within_waiting_period',
    'waiting_period_allergy_or_infection',
    'experimental_treatment',
    'unapproved_treatment',
    'gene_or_cell_therapy',
    'medical_appraisal_fee',
    'occupational_disease',
    'medical_malpractice',
    'self_purchased_drug_without_prescription',
    'non_prescribing_institution_purchase',
    'non_medical_institution_treatment',
    'prescription_over_30_days',
    'off_label_cancer_drug',
    'cancer_drug_not_effective',
    'cancer_drug_resistant',
    'obesity_treatment',
    'cosmetic_treatment',
    'pregnancy_related',
    'vision_correction',
    'preventive_or_wellness',
    'rehabilitation_device',
    'non_covered_genital_treatment',
    'non_listed_artificial_organ',
    'dental_care_only',
    'genetic_or_psychiatric',
    'hiv_related',
    'war_related',
    'dental_exception_covered',
  ];

  for (const key of booleanFactDefaults) {
    normalized[key] = toBooleanLike(normalized[key], false);
  }

  return normalized;
}

export { toDateOnly, toNumber };
