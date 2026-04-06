import { loadEnvConfig } from "../utils/loadEnvConfig.js";
import { readData, writeData } from "../utils/fileStore.js";
import {
  loadBufferForClaimMaterial,
  processClaimMaterial,
} from "../services/claimMaterialPipeline.js";

const claimCaseId = process.argv[2];

if (!claimCaseId) {
  console.error("Usage: node server/scripts/reparseClaimMaterials.js <claimCaseId>");
  process.exit(1);
}

loadEnvConfig({
  forceKeys: [
    "ALIYUN_OSS_REGION",
    "ALIYUN_OSS_ACCESS_KEY_ID",
    "ALIYUN_OSS_ACCESS_KEY_SECRET",
    "ALIYUN_OSS_BUCKET",
  ],
});

const materials = readData("claim-materials") || [];
const taskStore = readData("processing-tasks") || { tasks: [] };
const claimDocs = readData("claim-documents") || [];

const targetMaterials = materials.filter(
  (material) => material.claimCaseId === claimCaseId,
);

if (targetMaterials.length === 0) {
  console.error(`No claim materials found for ${claimCaseId}`);
  process.exit(1);
}

const updates = [];

for (const material of targetMaterials) {
  const materialIndex = materials.findIndex((item) => item.id === material.id);
  if (materialIndex < 0) continue;

  const { buffer, mimeType } = await loadBufferForClaimMaterial(material);
  const pipelineResult = await processClaimMaterial({
    fileName: material.fileName,
    mimeType: material.fileType || mimeType,
    buffer,
    materialRecord: material,
    preferredMaterialId: material.materialId,
    preferredMaterialName: material.materialName || material.category,
    context: {
      claimCaseId: material.claimCaseId,
      taskId: material.taskId || null,
      traceId: material.claimCaseId ? `trace-${material.claimCaseId}` : null,
    },
  });

  if (!pipelineResult.success) {
    throw new Error(
      `reparse failed for ${material.fileName}: ${
        pipelineResult.classification?.errorMessage ||
        pipelineResult.parseResult?.errorMessage ||
        "unknown"
      }`,
    );
  }

  const nextMaterial = {
    ...material,
    materialId:
      pipelineResult.classification?.materialId || material.materialId,
    materialName:
      pipelineResult.classification?.materialName || material.materialName,
    category:
      pipelineResult.classification?.materialName ||
      material.category ||
      material.materialName,
    classificationError: pipelineResult.classification?.errorMessage || null,
    extractedData: pipelineResult.extractedData || {},
    auditConclusion: pipelineResult.auditConclusion || "",
    confidence:
      pipelineResult.confidence ??
      pipelineResult.classification?.confidence ??
      0,
    ocrText: pipelineResult.extractedText || material.ocrText || "",
    status: "completed",
    processedAt: new Date().toISOString(),
  };
  materials[materialIndex] = nextMaterial;

  const task = taskStore.tasks.find((item) => item.id === material.taskId);
  const taskFile = task?.files?.find((file) => file.fileName === material.fileName);
  if (taskFile) {
    taskFile.status = "completed";
    taskFile.result = {
      ...(taskFile.result || {}),
      extractedText: pipelineResult.extractedText || "",
      structuredData: pipelineResult.extractedData || {},
      auditConclusion: pipelineResult.auditConclusion || "",
      confidence:
        pipelineResult.confidence ??
        pipelineResult.classification?.confidence ??
        0,
      classification: pipelineResult.classification,
      parseDuration:
        pipelineResult.parseResult?.parseDuration ??
        taskFile.result?.parseDuration ??
        null,
    };
    taskFile.classificationError =
      pipelineResult.classification?.errorMessage || null;
    taskFile.errorMessage = null;
    taskFile.completedAt = new Date().toISOString();
  }

  const record = claimDocs.find((item) => item.taskId === material.taskId);
  const doc = record?.documents?.find((item) => item.fileName === material.fileName);
  if (doc) {
    doc.classification = pipelineResult.classification;
    doc.structuredData = pipelineResult.extractedData || {};
    doc.extractedText = pipelineResult.extractedText || "";
    doc.auditConclusion = pipelineResult.auditConclusion || "";
    doc.confidence =
      pipelineResult.confidence ??
      pipelineResult.classification?.confidence ??
      0;
    doc.status = "completed";
    doc.errorMessage = null;
  }

  updates.push({
    materialId: material.id,
    fileName: material.fileName,
    classifiedAs: pipelineResult.classification?.materialName || "unknown",
    extractedKeys: Object.keys(pipelineResult.extractedData || {}),
  });
}

writeData("claim-materials", materials);
writeData("processing-tasks", taskStore);
writeData("claim-documents", claimDocs);

console.log(
  JSON.stringify(
    {
      claimCaseId,
      updated: updates,
    },
    null,
    2,
  ),
);
