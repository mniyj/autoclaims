import { readData, writeData } from "../utils/fileStore.js";

const AI_STORAGE_RESOURCES = {
  alerts: "ai-alerts",
  modelCatalog: "ai-model-catalog",
  consistencyReports: "ai-consistency-reports",
  consistencyMeta: "ai-consistency-meta",
  pricingRules: "ai-pricing-rules",
  statsDaily: "ai-stats-daily",
  statsDailyMeta: "ai-stats-daily-meta",
};

const SUPPORTED_DRIVERS = {
  json: {
    id: "json",
    label: "JSON File Store",
    migrationReady: true,
  },
  sqlite: {
    id: "sqlite",
    label: "SQLite",
    migrationReady: false,
  },
};

function getConfiguredDriverId() {
  const value = String(process.env.AI_STORAGE_DRIVER || "json").trim().toLowerCase();
  return SUPPORTED_DRIVERS[value] ? value : "json";
}

function getResourceName(resourceKey) {
  return AI_STORAGE_RESOURCES[resourceKey] || resourceKey;
}

function getStorageDriver() {
  const driverId = getConfiguredDriverId();
  if (driverId === "json") {
    return {
      id: "json",
      read(resourceKey) {
        return readData(getResourceName(resourceKey));
      },
      write(resourceKey, data) {
        return writeData(getResourceName(resourceKey), data);
      },
    };
  }

  return {
    id: "json",
    read(resourceKey) {
      return readData(getResourceName(resourceKey));
    },
    write(resourceKey, data) {
      return writeData(getResourceName(resourceKey), data);
    },
  };
}

export function readAIStorage(resourceKey, fallback = []) {
  const data = getStorageDriver().read(resourceKey);
  if (data === undefined || data === null || data === "") {
    return fallback;
  }
  return data;
}

export function writeAIStorage(resourceKey, data) {
  return getStorageDriver().write(resourceKey, data);
}

export function getAIStorageDriverStatus() {
  const driverId = getConfiguredDriverId();
  return {
    active: driverId,
    supported: Object.values(SUPPORTED_DRIVERS),
  };
}

export function getAIStorageStatus() {
  const driver = getAIStorageDriverStatus();
  return {
    backend: driver.active === "json" ? "json_file_store" : driver.active,
    driver: driver.active,
    supportedDrivers: driver.supported,
    resources: AI_STORAGE_RESOURCES,
    migrationReady: true,
  };
}

export { AI_STORAGE_RESOURCES };
