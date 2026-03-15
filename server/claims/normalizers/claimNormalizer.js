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
  const normalized = {
    ...claimCase,
    ...ocrData
  };

  normalized.accident_date = toDateOnly(
    ocrData.accident_date ||
    ocrData.accidentDate ||
    claimCase.accident_date ||
    claimCase.accidentDate ||
    claimCase.accidentTime
  );

  normalized.report_time = toDateOnly(
    ocrData.report_time ||
    ocrData.reportTime ||
    claimCase.report_time ||
    claimCase.reportTime
  );

  normalized.claimed_amount =
    toNumber(
      ocrData.claimed_amount ||
      ocrData.totalAmount ||
      claimCase.claimed_amount ||
      claimCase.claimAmount
    ) || 0;

  normalized.accident_reason =
    ocrData.accident_reason ||
    ocrData.accidentReason ||
    claimCase.accident_reason ||
    claimCase.accidentReason;

  normalized.expense_items = invoiceItems.length > 0 ? invoiceItems : (ocrData.chargeItems || []);
  normalized.total_claimed_amount = calculateClaimedTotal(normalized.expense_items);

  normalized.disability_grade =
    ocrData.disability_grade ??
    ocrData.disabilityGrade ??
    claimCase.disability_grade ??
    claimCase.disabilityGrade ??
    null;

  normalized.death_confirmed = Boolean(
    ocrData.death_confirmed ||
    ocrData.deathConfirmed ||
    claimCase.death_confirmed ||
    claimCase.deathConfirmed
  );

  normalized.is_drunk_driving =
    toBooleanLike(
      ocrData.is_drunk_driving ??
      ocrData.isDrunkDriving ??
      claimCase.is_drunk_driving ??
      claimCase.isDrunkDriving,
      false
    );

  normalized.hospital_days =
    toNumber(
      ocrData.hospital_days ||
      ocrData.hospitalDays ||
      claimCase.hospital_days ||
      claimCase.hospitalDays
    ) || 0;

  normalized.insured_age =
    extractAgeLike(
      ocrData.insured_age ||
      ocrData.insuredAge ||
      ocrData.age ||
      ocrData.basicInfo?.age ||
      claimCase.insured_age ||
      claimCase.insuredAge ||
      claimCase.age
    );

  normalized.insured_birth_date = toDateOnly(
    ocrData.insured_birth_date ||
    ocrData.insuredBirthDate ||
    ocrData.birth_date ||
    ocrData.birthDate ||
    claimCase.insured_birth_date ||
    claimCase.insuredBirthDate ||
    claimCase.birthDate
  );

  normalized.special_disease_confirmed =
    ocrData.special_disease_confirmed ??
    ocrData.specialDiseaseConfirmed ??
    claimCase.special_disease_confirmed ??
    claimCase.specialDiseaseConfirmed ??
    null;

  normalized.diagnosis_names = normalizeDiagnosisNames(
    ocrData.diagnosis_names,
    ocrData.diagnosisNames,
    ocrData.diagnoses,
    ocrData.diagnosis,
    ocrData.diagnosis_result,
    ocrData.diagnosisResult,
    claimCase.diagnosis_names,
    claimCase.diagnosisNames,
    claimCase.diagnosis,
    claimCase.diagnosis_result,
    claimCase.diagnosisResult
  );

  normalized.auto_coverage_type =
    ocrData.auto_coverage_type ||
    ocrData.autoCoverageType ||
    claimCase.auto_coverage_type ||
    claimCase.autoCoverageType ||
    claimCase.claim_liability_type ||
    claimCase.claimLiabilityType;

  normalized.fault_ratio =
    toNumber(
      ocrData.fault_ratio ||
      ocrData.faultRatio ||
      claimCase.fault_ratio ||
      claimCase.faultRatio
    );

  normalized.insured_liability_ratio =
    toNumber(
      ocrData.insured_liability_ratio ||
      ocrData.insuredLiabilityRatio ||
      claimCase.insured_liability_ratio ||
      claimCase.insuredLiabilityRatio
    );

  normalized.third_party_liability_ratio =
    toNumber(
      ocrData.third_party_liability_ratio ||
      ocrData.thirdPartyLiabilityRatio ||
      ocrData.thirdPartyLiabilityPct ||
      claimCase.third_party_liability_ratio ||
      claimCase.thirdPartyLiabilityRatio ||
      claimCase.thirdPartyLiabilityPct
    );

  normalized.claimant_liability_pct =
    toNumber(
      ocrData.claimant_liability_pct ||
      ocrData.claimantLiabilityPct ||
      claimCase.claimant_liability_pct ||
      claimCase.claimantLiabilityPct
    );

  normalized.repair_estimate =
    toNumber(
      ocrData.repair_estimate ||
      ocrData.repairEstimate ||
      claimCase.repair_estimate ||
      claimCase.repairEstimate
    ) || 0;

  normalized.third_party_loss_amount =
    toNumber(
      ocrData.third_party_loss_amount ||
      ocrData.thirdPartyLossAmount ||
      claimCase.third_party_loss_amount ||
      claimCase.thirdPartyLossAmount
    );

  normalized.third_party_property_damage_amount =
    toNumber(
      ocrData.third_party_property_damage_amount ||
      ocrData.thirdPartyPropertyDamageAmount ||
      claimCase.third_party_property_damage_amount ||
      claimCase.thirdPartyPropertyDamageAmount
    );

  normalized.third_party_injury_amount =
    toNumber(
      ocrData.third_party_injury_amount ||
      ocrData.thirdPartyInjuryAmount ||
      claimCase.third_party_injury_amount ||
      claimCase.thirdPartyInjuryAmount
    );

  normalized.third_party_death_disability_amount =
    toNumber(
      ocrData.third_party_death_disability_amount ||
      ocrData.thirdPartyDeathDisabilityAmount ||
      claimCase.third_party_death_disability_amount ||
      claimCase.thirdPartyDeathDisabilityAmount
    );

  normalized.vehicle_damage_amount =
    toNumber(
      ocrData.vehicle_damage_amount ||
      ocrData.vehicleDamageAmount ||
      claimCase.vehicle_damage_amount ||
      claimCase.vehicleDamageAmount
    );

  normalized.passenger_injury_amount =
    toNumber(
      ocrData.passenger_injury_amount ||
      ocrData.passengerInjuryAmount ||
      claimCase.passenger_injury_amount ||
      claimCase.passengerInjuryAmount
    );

  normalized.injury_grade =
    ocrData.injury_grade ||
    ocrData.injuryGrade ||
    claimCase.injury_grade ||
    claimCase.injuryGrade;

  normalized.vehicle = {
    ...(claimCase.vehicle || {}),
    ...(ocrData.vehicle || {})
  };

  const normalizedActualValue = toNumber(
    normalized.vehicle.actual_value ||
    normalized.vehicle.actualValue ||
    ocrData.actual_value ||
    ocrData.actualValue ||
    claimCase.actual_value ||
    claimCase.actualValue
  );
  if (normalizedActualValue !== undefined) {
    normalized.vehicle.actual_value = normalizedActualValue;
  }

  if (ocrData.basicInfo) {
    normalized.patient_name = ocrData.basicInfo.name;
    normalized.patient_gender = ocrData.basicInfo.gender;
    normalized.admission_date = toDateOnly(ocrData.basicInfo.admissionDate);
    normalized.discharge_date = toDateOnly(ocrData.basicInfo.dischargeDate);
    normalized.diagnosis = ocrData.basicInfo.dischargeDiagnosis;
    normalized.department = ocrData.basicInfo.department;
  }

  if (ocrData.invoiceInfo) {
    normalized.hospital_name = ocrData.invoiceInfo.hospitalName;
    normalized.invoice_date = toDateOnly(ocrData.invoiceInfo.issueDate);
  }

  if (ocrData.insurancePayment) {
    normalized.social_insurance_paid = ocrData.insurancePayment.governmentFundPayment || 0;
    normalized.personal_payment = ocrData.insurancePayment.personalPayment || 0;
    normalized.personal_self_pay = ocrData.insurancePayment.personalSelfPayment || 0;
    normalized.personal_self_expense = ocrData.insurancePayment.personalSelfExpense || 0;
  }

  return normalized;
}

export { toDateOnly, toNumber };
