import { readData, writeData } from "../utils/fileStore.js";
import { clearAIStatsCache } from "./aiStatsCache.js";

const RESOURCE = "ai-capability-binding-history";

export function getBindingHistory(capabilityId = null) {
  const items = readData(RESOURCE) || [];
  if (!capabilityId) return items;
  return items.filter((item) => item.capabilityId === capabilityId);
}

export function appendBindingHistory(entry) {
  const items = readData(RESOURCE) || [];
  items.push(entry);
  writeData(RESOURCE, items);
  clearAIStatsCache();
  return entry;
}
