import { readData, writeData } from "../utils/fileStore.js";
import { clearAIStatsCache } from "./aiStatsCache.js";

const RESOURCE = "ai-prompt-template-history";

export function getPromptHistory(templateId = null) {
  const items = readData(RESOURCE) || [];
  if (!templateId) return items;
  return items.filter((item) => item.templateId === templateId);
}

export function appendPromptHistory(entry) {
  const items = readData(RESOURCE) || [];
  items.push(entry);
  writeData(RESOURCE, items);
  clearAIStatsCache();
  return entry;
}
