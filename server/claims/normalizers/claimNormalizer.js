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
