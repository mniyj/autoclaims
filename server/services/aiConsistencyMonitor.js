import { readAIStorage, writeAIStorage } from "./aiStorageService.js";
import { notifyAIDataConsistencyFailure, runAIDataConsistencyCheck } from "./aiConsistencyService.js";

const META_RESOURCE = "ai-consistency-meta";
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_HOUR = 9;

class AIConsistencyMonitor {
  constructor() {
    this.timer = null;
    this.running = false;
  }

  getMeta() {
    const meta = readAIStorage("consistencyMeta", {});
    if (!meta || Array.isArray(meta)) {
      return {
        lastAutoCheckAt: null,
        lastTrigger: null,
        lastResult: null,
      };
    }
    return {
      lastAutoCheckAt: meta.lastAutoCheckAt || null,
      lastTrigger: meta.lastTrigger || null,
      lastResult: meta.lastResult || null,
    };
  }

  saveMeta(meta) {
    writeAIStorage("consistencyMeta", meta);
  }

  getTargetHour() {
    const value = Number(process.env.AI_CONSISTENCY_CHECK_HOUR || DEFAULT_HOUR);
    if (Number.isNaN(value) || value < 0 || value > 23) return DEFAULT_HOUR;
    return value;
  }

  getIntervalMs() {
    const value = Number(process.env.AI_CONSISTENCY_CHECK_INTERVAL_MS || DEFAULT_INTERVAL_MS);
    if (Number.isNaN(value) || value < 60 * 1000) return DEFAULT_INTERVAL_MS;
    return value;
  }

  shouldRun(now = new Date()) {
    const meta = this.getMeta();
    const targetHour = this.getTargetHour();
    if (now.getHours() < targetHour) {
      return false;
    }
    const today = now.toISOString().slice(0, 10);
    const lastDay = String(meta.lastAutoCheckAt || "").slice(0, 10);
    return today !== lastDay;
  }

  runOnce(trigger = "auto") {
    const report = runAIDataConsistencyCheck(trigger);
    const checkedAt = report?.checkedAt || new Date().toISOString();
    this.saveMeta({
      lastAutoCheckAt: checkedAt,
      lastTrigger: trigger,
      lastResult: report?.success ? "pass" : "fail",
    });
    if (!report.success) {
      notifyAIDataConsistencyFailure(report, "anonymous");
    }
    return report;
  }

  getStatus(now = new Date()) {
    const meta = this.getMeta();
    const targetHour = this.getTargetHour();
    const nextRunAt = new Date(now);
    nextRunAt.setHours(targetHour, 0, 0, 0);
    if (now.getHours() >= targetHour && String(meta.lastAutoCheckAt || "").slice(0, 10) === now.toISOString().slice(0, 10)) {
      nextRunAt.setDate(nextRunAt.getDate() + 1);
    } else if (now > nextRunAt) {
      nextRunAt.setDate(nextRunAt.getDate() + 1);
    }
    return {
      enabled: true,
      intervalMs: this.getIntervalMs(),
      targetHour,
      lastAutoCheckAt: meta.lastAutoCheckAt || null,
      lastTrigger: meta.lastTrigger || null,
      lastResult: meta.lastResult || null,
      shouldRunToday: this.shouldRun(now),
      nextRunAt: nextRunAt.toISOString(),
    };
  }

  tick() {
    try {
      if (!this.shouldRun()) return;
      const report = this.runOnce("schedule");
      console.log(
        `[AIConsistencyMonitor] Auto check completed: ${report.success ? "pass" : "fail"} at ${report.checkedAt}`,
      );
    } catch (error) {
      console.error("[AIConsistencyMonitor] Auto check failed:", error);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.tick();
    this.timer = setInterval(() => this.tick(), this.getIntervalMs());
    console.log("[AIConsistencyMonitor] Started");
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log("[AIConsistencyMonitor] Stopped");
  }
}

const aiConsistencyMonitor = new AIConsistencyMonitor();

export function startAIConsistencyMonitor() {
  aiConsistencyMonitor.start();
}

export function stopAIConsistencyMonitor() {
  aiConsistencyMonitor.stop();
}

export function getAIConsistencyMonitorStatus() {
  return aiConsistencyMonitor.getStatus();
}

export default aiConsistencyMonitor;
