function roundCurrency(value) {
  return parseFloat((Number(value) || 0).toFixed(2));
}

function buildTransferDedupKey(item = {}) {
  return [
    item.amount || 0,
    item.paidAt || "",
    item.description || "",
  ].join("|");
}

export function dedupeBankTransfers(paymentEvidence = []) {
  const seen = new Set();
  return paymentEvidence
    .filter((item) => item?.type === "bank_transfer")
    .filter((item) => {
      const key = buildTransferDedupKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function summarizePaymentEvidence(paymentEvidence = []) {
  const uniqueTransfers = dedupeBankTransfers(paymentEvidence);
  const confirmedPaidAmount = uniqueTransfers.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );
  const reportedAdvanceAmount = paymentEvidence
    .filter((item) => item?.type === "agreement_note")
    .reduce((sum, item) => sum + (Number(item.funeralAdvancePaid) || 0), 0);

  return {
    uniqueTransfers,
    summary: {
      confirmedPaidAmount: roundCurrency(confirmedPaidAmount),
      reportedAdvanceAmount: roundCurrency(reportedAdvanceAmount),
      deductionRecommendedAmount: roundCurrency(confirmedPaidAmount),
      deductionTotal: 0,
      uniqueTransferCount: uniqueTransfers.length,
      note: confirmedPaidAmount > 0
        ? "已识别付款记录，但付款方向与保险赔付路径仍需人工确认，暂不自动抵扣"
        : "未识别可直接抵扣的已付款项",
    },
  };
}
