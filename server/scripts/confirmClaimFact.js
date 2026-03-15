import { readData, writeData } from "../utils/fileStore.js";
import { generateDamageReport } from "../services/reportGenerator.js";
import { buildDecisionTrace } from "../services/decisionTraceService.js";

const claimCaseId = process.argv[2];
const factKey = process.argv[3];
const confirmedArg = process.argv[4] ?? "true";

if (!claimCaseId || !factKey) {
  console.error("Usage: node server/scripts/confirmClaimFact.js <claimCaseId> <liability_apportionment|third_party_identity_chain> [true|false]");
  process.exit(1);
}

const confirmed = !["false", "0", "no"].includes(String(confirmedArg).toLowerCase());
const normalizedFactKey = factKey === "employment_relation" ? "third_party_identity_chain" : factKey;
const allowedFactKeys = new Set(["liability_apportionment", "third_party_identity_chain"]);
if (!allowedFactKeys.has(normalizedFactKey)) {
  console.error(`Unsupported factKey: ${factKey}`);
  process.exit(1);
}

const allClaimDocs = readData("claim-documents");
const latestIndex = allClaimDocs
  .map((record, index) => ({ record, index }))
  .filter(({ record }) => record.claimCaseId === claimCaseId && record.aggregation)
  .sort((a, b) => new Date(b.record.importedAt || 0) - new Date(a.record.importedAt || 0))[0];

if (!latestIndex?.record?.aggregation) {
  throw new Error(`未找到 ${claimCaseId} 的聚合结果`);
}

const aggregation = { ...latestIndex.record.aggregation };
aggregation.factConfirmations = {
  ...(aggregation.factConfirmations || {}),
  [normalizedFactKey]: {
    confirmed,
    confirmedAt: new Date().toISOString(),
  },
};

if (factKey === "liability_apportionment" && aggregation.liabilityApportionment) {
  aggregation.liabilityApportionment = {
    ...aggregation.liabilityApportionment,
    confirmed,
    confirmedAt: new Date().toISOString(),
  };
}

if (normalizedFactKey === "third_party_identity_chain") {
  aggregation.factModel = {
    ...(aggregation.factModel || {}),
    thirdPartyIdentityChainConfirmed: confirmed,
    thirdPartyIdentityChainConfirmedAt: new Date().toISOString(),
    legacyAliases: {
      ...(((aggregation.factModel || {}).legacyAliases) || {}),
      employmentRelationConfirmed: confirmed,
      employmentRelationConfirmedAt: new Date().toISOString(),
    },
  };
}
aggregation.decisionTrace = buildDecisionTrace({
  claimCaseId,
  materials: (readData("claim-materials") || [])
    .filter((item) => item.claimCaseId === claimCaseId)
    .map((item) => ({
      ...item,
      documentId: item.documentId || item.id,
    })),
  summaries: (latestIndex.record.documents || [])
    .map((doc) => doc.documentSummary)
    .filter(Boolean),
  aggregation,
  operationLogs: (readData("user-operation-logs") || []).filter((item) => item.claimId === claimCaseId),
});

allClaimDocs[latestIndex.index] = {
  ...latestIndex.record,
  aggregation,
};
writeData("claim-documents", allClaimDocs);

const allClaimCases = readData("claim-cases");
const claimCase = allClaimCases.find((item) => item.id === claimCaseId) || {};
const report = generateDamageReport({
  claimCaseId,
  aggregationResult: aggregation,
  claimCase,
});
const reports = (readData("damage-reports") || []).filter((item) => item.claimCaseId !== claimCaseId);
reports.push({ ...report, reportHtml: undefined });
writeData("damage-reports", reports);

console.log(
  JSON.stringify(
    {
      claimCaseId,
      factKey: normalizedFactKey,
      confirmed,
      factConfirmations: aggregation.factConfirmations,
    },
    null,
    2,
  ),
);
