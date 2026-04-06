import { readData, writeData } from "../utils/fileStore.js";

function buildCorrectionFromLog(log) {
  const input = log?.inputData || {};
  const output = log?.outputData || {};
  const documentId = input.documentId;
  const fieldKey = input.fieldKey;
  const claimCaseId = log.claimId || log.claimCaseId || log.claimReportNumber;

  if (!documentId || !fieldKey || !claimCaseId) {
    return null;
  }

  return {
    correctionId: `fc-backfill-${log.logId || Date.now()}`,
    documentId,
    fieldKey,
    fieldLabel: input.fieldLabel || fieldKey,
    originalValue: input.originalValue || "",
    correctedValue: output.correctedValue || "",
    correctedAt: log.timestamp || new Date().toISOString(),
    correctedBy: log.userName || "系统用户",
    claimCaseId,
  };
}

function upsertCorrection(material, correction) {
  const existing = Array.isArray(material.fieldCorrections)
    ? material.fieldCorrections
    : [];
  const filtered = existing.filter((item) => item?.fieldKey !== correction.fieldKey);
  return {
    ...material,
    fieldCorrections: [...filtered, correction],
  };
}

function main() {
  const claimCaseIdArg = process.argv[2] || null;
  const logs = readData("user-operation-logs") || [];
  const claimMaterials = readData("claim-materials") || [];

  const corrections = logs
    .filter(
      (log) =>
        log?.operationLabel?.startsWith("修改结构化字段") &&
        log?.success !== false &&
        (!claimCaseIdArg ||
          log.claimId === claimCaseIdArg ||
          log.claimCaseId === claimCaseIdArg ||
          log.claimReportNumber === claimCaseIdArg),
    )
    .map(buildCorrectionFromLog)
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(a.correctedAt).getTime() - new Date(b.correctedAt).getTime(),
    );

  let updatedMaterials = 0;
  let appliedCorrections = 0;

  const nextClaimMaterials = claimMaterials.map((material) => {
    if (claimCaseIdArg && material.claimCaseId !== claimCaseIdArg) {
      return material;
    }

    const matchingCorrections = corrections.filter(
      (item) =>
        item.claimCaseId === material.claimCaseId &&
        item.documentId === material.id,
    );
    if (matchingCorrections.length === 0) {
      return material;
    }

    let nextMaterial = { ...material };
    for (const correction of matchingCorrections) {
      nextMaterial = upsertCorrection(nextMaterial, correction);
      appliedCorrections += 1;
    }
    updatedMaterials += 1;
    return nextMaterial;
  });

  writeData("claim-materials", nextClaimMaterials);

  console.log(
    JSON.stringify(
      {
        claimCaseId: claimCaseIdArg || "ALL",
        correctionsFound: corrections.length,
        appliedCorrections,
        updatedMaterials,
      },
      null,
      2,
    ),
  );
}

main();
