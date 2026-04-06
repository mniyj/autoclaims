/**
 * 多文件联合分析服务
 * 实现跨文件数据交叉验证和材料完整性检查
 *
 * 所有校验规则已统一迁移至 jsonlist/material-validation-rules.json，
 * 通过「材料校验规则中心」（MaterialValidationRulesPage）可配置管理。
 *
 * 原硬编码规则迁移对照：
 * - validateAmountConsistency → mv-amount-pct-001（百分比差异 ≤ 阈值）
 * - validateDateConsistency   → mv-date-future-001/002/003（未来日期检测）
 *                               mv-date-order-001（入院 ≤ 出院）
 * - validateIdentityConsistency → mv-identity-001 ~ 007（已有可配置规则覆盖）
 * - validateTimeline           → mv-timeline-001/002（事故→入院→开票顺序）
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { executeMaterialValidationRules } from "./materialValidationEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const dataDir = path.join(projectRoot, "jsonlist");

const MATERIAL_ID_ALIASES = {
  case_initial_report: ["mat-51"],
  case_public_adjuster_report: ["mat-52"],
  "mat-51": ["case_initial_report"],
  "mat-52": ["case_public_adjuster_report"],
};

function readJsonFile(fileName, fallback = []) {
  try {
    const fullPath = path.join(dataDir, fileName);
    if (!fs.existsSync(fullPath)) return fallback;
    return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  } catch {
    return fallback;
  }
}

function buildMaterialDisplayNameMap() {
  const claimItems = readJsonFile("claim-items.json", []);
  const materials = readJsonFile("claims-materials.json", []);
  const displayMap = new Map();

  for (const item of claimItems) {
    if (item?.id && item?.name) {
      displayMap.set(String(item.id), String(item.name));
    }
  }

  for (const item of materials) {
    if (item?.id && item?.name) {
      displayMap.set(String(item.id), String(item.name));
    }
  }

  return displayMap;
}

function mapDisplayNames(items = [], displayNameMap = new Map()) {
  return items.map((item) => displayNameMap.get(String(item)) || String(item));
}

function buildRequiredMaterialIdsFromClaimItems(productConfig) {
  const claimItems = readJsonFile("claim-items.json", []);
  const claimItemMap = new Map(
    claimItems
      .filter((item) => item?.id)
      .map((item) => [String(item.id), item]),
  );
  const requiredMaterialSet = new Set();

  for (const respConfig of productConfig?.responsibilityConfigs || []) {
    for (const claimItemId of respConfig.claimItemIds || []) {
      const claimItem = claimItemMap.get(String(claimItemId));
      if (!claimItem) continue;

      const requiredMap = claimItem.materialRequiredMap || {};
      if (Array.isArray(claimItem.materialIds) && claimItem.materialIds.length > 0) {
        for (const materialId of claimItem.materialIds) {
          if (!materialId) continue;
          if (requiredMap[materialId] === false) continue;
          requiredMaterialSet.add(String(materialId));
        }
      }
    }
  }

  return Array.from(requiredMaterialSet);
}

// ============================================================================
// 兼容性空壳（保留导出签名，避免外部调用报错）
// ============================================================================

/** @deprecated 已迁移至可配置规则 mv-amount-pct-001 */
export function validateAmountConsistency() {
  return [];
}
/** @deprecated 已迁移至可配置规则 mv-date-future-*, mv-date-order-* */
export function validateDateConsistency() {
  return [];
}
/** @deprecated 已迁移至可配置规则 mv-identity-* */
export function validateIdentityConsistency() {
  return [];
}
/** @deprecated 已迁移至可配置规则 mv-timeline-* */
export function validateTimeline() {
  return [];
}

// ============================================================================
// 材料完整性检查
// ============================================================================

/**
 * 检查材料完整性
 * @param {Array} documents - 已上传的文档列表
 * @param {string} productCode - 产品代码
 * @param {object} claimInfo - 理赔信息
 * @returns {Promise<object>}
 */
export async function checkDocumentCompleteness(
  documents,
  productCode,
  claimInfo = {},
) {
  const configsPath = path.join(dataDir, "product-claim-configs.json");
  const displayNameMap = buildMaterialDisplayNameMap();
  let requiredMaterials = [];
  let optionalMaterials = [];

  try {
    if (fs.existsSync(configsPath)) {
      const configs = JSON.parse(fs.readFileSync(configsPath, "utf-8"));
      const productConfig = configs.find((c) => c.productCode === productCode);

      if (productConfig) {
        requiredMaterials = buildRequiredMaterialIdsFromClaimItems(productConfig);
      }
    }
  } catch (error) {
    console.error("[multiFileAnalyzer] Error loading product config:", error);
  }

  if (requiredMaterials.length === 0) {
    requiredMaterials = getDefaultRequiredMaterials(claimInfo);
    optionalMaterials = getDefaultOptionalMaterials(claimInfo);
  }

  const providedTypes = new Set(
    documents.map((d) => d.fileType).filter(Boolean),
  );
  const providedMaterialIds = new Set(
    documents.map((d) => d.classification?.materialId).filter(Boolean),
  );
  for (const materialId of Array.from(providedMaterialIds)) {
    for (const alias of MATERIAL_ID_ALIASES[materialId] || []) {
      providedMaterialIds.add(alias);
    }
  }

  const missingMaterials = requiredMaterials.filter(
    (materialId) =>
      !providedTypes.has(materialId) && !providedMaterialIds.has(materialId),
  );
  const requiredMaterialNames = mapDisplayNames(requiredMaterials, displayNameMap);
  const missingMaterialNames = mapDisplayNames(missingMaterials, displayNameMap);

  const completenessScore =
    requiredMaterials.length > 0
      ? Math.round(
          ((requiredMaterials.length - missingMaterials.length) /
            requiredMaterials.length) *
            100,
        )
      : 100;

  return {
    isComplete: missingMaterials.length === 0,
    completenessScore,
    requiredMaterials: requiredMaterialNames,
    requiredMaterialIds: requiredMaterials,
    providedMaterials: Array.from(
      new Set([...providedTypes, ...providedMaterialIds]),
    ),
    missingMaterials: missingMaterialNames,
    missingMaterialIds: missingMaterials,
    optionalMaterials,
    warnings:
      missingMaterialNames.length > 0
        ? [`缺少以下材料: ${missingMaterialNames.join(", ")}`]
        : [],
  };
}

function getDefaultRequiredMaterials(claimInfo) {
  const materials = ["image_invoice"];
  if (claimInfo.claimType === "住院") {
    materials.push("image_report");
  }
  if (claimInfo.claimType === "门诊") {
    materials.push("image_report");
  }
  return materials;
}

function getDefaultOptionalMaterials() {
  return ["image_id", "excel_expense", "video_scene"];
}

// ============================================================================
// 综合分析入口
// ============================================================================

/**
 * 执行多文件联合分析
 * 所有校验逻辑统一由 executeMaterialValidationRules 驱动（可配置规则）
 * @param {Array} documents - 解析后的文档列表
 * @param {object} context - 上下文信息
 * @returns {Promise<object>}
 */
export async function analyzeMultiFiles(documents, context = {}) {
  const startTime = Date.now();

  // 统一由可配置规则引擎执行所有校验（含原硬编码逻辑）
  const { validationResults, validationFacts } =
    executeMaterialValidationRules(documents);

  // 材料完整性检查
  const completeness = await checkDocumentCompleteness(
    documents,
    context.productCode,
    context.claimInfo,
  );

  // 生成人工介入点
  const interventionPoints = generateInterventionPoints(
    validationResults,
    completeness,
  );

  return {
    crossValidation: validationResults,
    materialValidationResults: validationResults,
    validationFacts,
    completeness,
    interventionPoints,
    summary: generateAnalysisSummary(
      validationResults,
      completeness,
      interventionPoints,
    ),
    processingTime: Date.now() - startTime,
  };
}

/**
 * 根据验证结果生成人工介入点
 */
function generateInterventionPoints(validationResults, completeness) {
  const points = [];

  if (!completeness.isComplete) {
    points.push({
      id: `intervention-${Date.now()}-1`,
      type: "document_incomplete",
      reason: `缺少 ${completeness.missingMaterials.length} 项必需材料`,
      timestamp: new Date().toISOString(),
      requiredAction: "请补充上传缺失材料",
      resolved: false,
    });
  }

  const errors = validationResults.filter(
    (v) => !v.passed && v.severity === "error",
  );
  if (errors.length > 0) {
    points.push({
      id: `intervention-${Date.now()}-2`,
      type: "validation_error",
      reason: errors.map((e) => e.message).join("; "),
      timestamp: new Date().toISOString(),
      requiredAction: "请核实校验异常原因",
      resolved: false,
    });
  }

  const warnings = validationResults.filter(
    (v) => !v.passed && v.severity === "warning",
  );
  if (warnings.length > 2) {
    points.push({
      id: `intervention-${Date.now()}-3`,
      type: "high_risk",
      reason: `存在 ${warnings.length} 个警告需要关注`,
      timestamp: new Date().toISOString(),
      requiredAction: "建议人工复核",
      resolved: false,
    });
  }

  return points;
}

/**
 * 生成分析摘要
 */
function generateAnalysisSummary(
  validationResults,
  completeness,
  interventionPoints,
) {
  const passed = validationResults.filter((v) => v.passed).length;
  const failed = validationResults.filter((v) => !v.passed).length;

  let summary = `## 多文件联合分析结果\n\n`;
  summary += `### 交叉验证\n`;
  summary += `- 通过: ${passed} 项\n`;
  summary += `- 异常: ${failed} 项\n\n`;
  summary += `### 材料完整性\n`;
  summary += `- 完整度: ${completeness.completenessScore}%\n`;
  summary += `- 状态: ${completeness.isComplete ? "完整" : "缺失材料"}\n\n`;

  if (interventionPoints.length > 0) {
    summary += `### 需要关注\n`;
    for (const point of interventionPoints) {
      summary += `- **${point.type}**: ${point.reason}\n`;
    }
  }

  return summary;
}

// ============================================================================
// 导出
// ============================================================================

export default {
  validateAmountConsistency,
  validateDateConsistency,
  validateIdentityConsistency,
  validateTimeline,
  checkDocumentCompleteness,
  analyzeMultiFiles,
};
