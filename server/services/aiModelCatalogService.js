import { readAIStorage, writeAIStorage } from "./aiStorageService.js";
import { clearAIStatsCache } from "./aiStatsCache.js";

function normalizeModel(model) {
  return {
    modelId: String(model?.modelId || "").trim(),
    providerId: String(model?.providerId || "").trim(),
    displayName: String(model?.displayName || model?.modelId || "").trim(),
    type: model?.type || "text",
    contextLength: Number(model?.contextLength || 0),
    supportsImages: Boolean(model?.supportsImages),
    supportsTools: Boolean(model?.supportsTools),
    supportsJsonMode: Boolean(model?.supportsJsonMode),
    supportsStreaming: Boolean(model?.supportsStreaming),
    deprecated: Boolean(model?.deprecated),
  };
}

export function getModelCatalog() {
  const items = readAIStorage("modelCatalog", []);
  return Array.isArray(items) ? items.map(normalizeModel).filter((item) => item.modelId && item.providerId) : [];
}

export function saveModelCatalog(models) {
  const normalized = (models || [])
    .map(normalizeModel)
    .filter((item) => item.modelId && item.providerId);
  writeAIStorage("modelCatalog", normalized);
  clearAIStatsCache();
  return getModelCatalog();
}
