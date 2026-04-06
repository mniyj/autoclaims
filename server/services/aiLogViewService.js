import { readData, writeData } from "../utils/fileStore.js";

const RESOURCE = "ai-log-views";

function loadViews() {
  return readData(RESOURCE) || [];
}

function saveViews(items) {
  writeData(RESOURCE, Array.isArray(items) ? items : []);
}

export function listAILogViews(userId = "anonymous") {
  return loadViews()
    .filter((item) => item.userId === userId)
    .sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return new Date(b.lastUsedAt || b.updatedAt || b.createdAt || 0) - new Date(a.lastUsedAt || a.updatedAt || a.createdAt || 0);
    });
}

export function saveAILogView(userId = "anonymous", payload = {}) {
  const views = loadViews();
  const now = new Date().toISOString();
  const existing = views.find((item) => item.userId === userId && (item.id === payload.id || item.name === payload.name));
  const normalized = {
    id: payload.id || existing?.id || `ai-log-view-${Date.now()}`,
    userId,
    name: String(payload.name || "").trim(),
    filters: payload.filters || {},
    createdAt: payload.createdAt || existing?.createdAt || now,
    updatedAt: now,
    lastUsedAt: payload.lastUsedAt || existing?.lastUsedAt || null,
    isDefault: payload.isDefault === true,
  };
  const nextViews = [
    ...views
      .filter((item) => !(item.userId === userId && (item.id === normalized.id || item.name === normalized.name)))
      .map((item) =>
        normalized.isDefault && item.userId === userId
          ? {
              ...item,
              isDefault: false,
            }
          : item,
      ),
    normalized,
  ].slice(0, 1000);
  saveViews(nextViews);
  return normalized;
}

export function deleteAILogView(userId = "anonymous", id) {
  const views = loadViews();
  const nextViews = views.filter((item) => !(item.userId === userId && item.id === id));
  saveViews(nextViews);
  return { success: nextViews.length !== views.length };
}
