import { executeFullReview } from './rules/engine.js';
import { pathToFileURL } from 'node:url';

function parseJsonArg(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`JSON 参数解析失败: ${error.message}`);
  }
}

async function main() {
  const [, , claimCaseId, productCode, ocrJson, invoiceJson] = process.argv;

  if (!claimCaseId) {
    console.error('用法: node server/test-accident-death-review.js <claimCaseId> [productCode] [ocrJson] [invoiceItemsJson]');
    process.exit(1);
  }

  const ocrData = parseJsonArg(ocrJson, {});
  const invoiceItems = parseJsonArg(invoiceJson, []);

  const result = await executeFullReview({
    claimCaseId,
    productCode,
    ocrData,
    invoiceItems,
  });

  const output = {
    claimCaseId,
    productCode: productCode || result.context?.product_code || null,
    decision: result.decision,
    intakeDecision: result.intakeDecision,
    liabilityDecision: result.liabilityDecision,
    assessmentDecision: result.assessmentDecision,
    settlementDecision: result.settlementDecision,
    payableAmount: result.payableAmount,
    missingMaterials: result.missingMaterials,
    matchedRules: result.eligibility?.matchedRules || [],
    coverageResults: result.coverageResults || [],
    benefitLedger: result.amount?.benefitLedger || [],
    manualReviewReasons: result.manualReviewReasons || [],
    warnings: result.warnings || [],
  };

  console.log(JSON.stringify(output, null, 2));
}

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1] || '').href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
