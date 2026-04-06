const cache = new Map();

function toCacheKey(parts) {
  return JSON.stringify(parts || []);
}

export function getCachedAIStats(parts, ttlMs, compute) {
  const key = toCacheKey(parts);
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) {
    return existing.value;
  }
  const value = compute();
  cache.set(key, {
    value,
    expiresAt: now + ttlMs,
  });
  return value;
}

export function clearAIStatsCache(prefixParts) {
  if (!prefixParts) {
    cache.clear();
    return;
  }
  const prefix = toCacheKey(prefixParts).slice(0, -1);
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}
