import { rebuildAIStatsDaily, summarizeAIStatsDaily } from "../services/aiStatsDailyService.js";
import { clearAIStatsCache } from "../services/aiStatsCache.js";

function main() {
  const startedAt = Date.now();
  const stats = rebuildAIStatsDaily();
  clearAIStatsCache();
  const summary = summarizeAIStatsDaily(stats);
  process.stdout.write(
    `${JSON.stringify(
      {
        success: true,
        durationMs: Date.now() - startedAt,
        ...summary,
      },
      null,
      2,
    )}\n`,
  );
}

main();
