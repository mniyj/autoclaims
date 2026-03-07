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

  normalized.hospital_days =
    toNumber(
      ocrData.hospital_days ||
      ocrData.hospitalDays ||
      claimCase.hospital_days ||
      claimCase.hospitalDays
    ) || 0;

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
