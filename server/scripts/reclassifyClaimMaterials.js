import { readData, writeData } from "../utils/fileStore.js";
import { classifyMaterialByRules, getMaterialCatalog } from "../services/materialClassificationService.js";

const claimCaseId = process.argv[2];
const reclassifyAll = process.argv.includes("--all");

if (!claimCaseId) {
  console.error("Usage: node server/scripts/reclassifyClaimMaterials.js <claimCaseId> [--all]");
  process.exit(1);
}

const catalog = getMaterialCatalog();
const claimMaterials = readData("claim-materials");

let updatedCount = 0;
let unknownBefore = 0;
let unknownAfter = 0;

const updated = claimMaterials.map((item) => {
  if (item.claimCaseId !== claimCaseId) {
    return item;
  }

  const isUnknown = !item.materialId || item.materialId === "unknown";
  if (isUnknown) unknownBefore += 1;
  if (!reclassifyAll && !isUnknown) {
    if (!item.materialId || item.materialId === "unknown") unknownAfter += 1;
    return item;
  }

  const classification = classifyMaterialByRules(
    catalog,
    item.fileName || "",
    item.ocrText || item.extractedText || ""
  );

  if (!classification) {
    if (isUnknown) unknownAfter += 1;
    return item;
  }

  const nextItem = {
    ...item,
    materialId: classification.materialId,
    materialName: classification.materialName,
    category: classification.materialName,
    classificationError: null,
  };

  const changed =
    nextItem.materialId !== item.materialId ||
    nextItem.materialName !== item.materialName ||
    nextItem.category !== item.category ||
    item.classificationError;

  if (changed) {
    updatedCount += 1;
  }

  if (!nextItem.materialId || nextItem.materialId === "unknown") {
    unknownAfter += 1;
  }

  return nextItem;
});

writeData("claim-materials", updated);

console.log(
  JSON.stringify(
    {
      claimCaseId,
      updatedCount,
      unknownBefore,
      unknownAfter,
      mode: reclassifyAll ? "all" : "unknown_only",
    },
    null,
    2
  )
);
