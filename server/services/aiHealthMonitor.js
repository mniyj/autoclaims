import { getProviderCatalog } from "./aiConfigService.js";
import { queryLogs } from "./aiInteractionLogger.js";

export function getProviderHealthSummary() {
  const providers = getProviderCatalog();
  const { logs } = queryLogs({ view: "summary", limit: 100000, offset: 0 });
  return providers.map((provider) => {
    const providerLogs = logs.filter((log) => log.provider === provider.id);
    const recent = providerLogs.slice(0, 50);
    const successCount = recent.filter((log) => log.success).length;
    const avgLatencyMs =
      recent.length > 0
        ? Math.round(
            recent.reduce((sum, log) => sum + (log.performance?.durationMs || 0), 0) / recent.length,
          )
        : 0;
    const recentError = recent.find((log) => log.error)?.error?.message || null;

    return {
      providerId: provider.id,
      configStatus: provider.available ? "configured" : "missing_env",
      runtimeStatus:
        recent.length === 0 ? "unknown" : successCount === recent.length ? "healthy" : successCount > 0 ? "degraded" : "offline",
      probeStatus: provider.lastHealthCheck?.success ? "healthy" : "idle",
      lastCheckedAt: provider.lastHealthCheck?.timestamp || null,
      lastLatencyMs: provider.lastHealthCheck?.latencyMs || null,
      successRate1h: recent.length > 0 ? Number((successCount / recent.length).toFixed(4)) : null,
      successRate24h: recent.length > 0 ? Number((successCount / recent.length).toFixed(4)) : null,
      avgLatencyMs,
      recentError,
    };
  });
}

export async function runProviderHealthCheck(providerId = null) {
  const summaries = getProviderHealthSummary();
  if (!providerId) return summaries;
  return summaries.find((item) => item.providerId === providerId) || null;
}
