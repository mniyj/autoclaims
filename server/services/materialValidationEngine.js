import { readData } from "../utils/fileStore.js";
import { createIntervention } from "./interventionStateMachine.js";

function getNestedValue(source, path) {
  if (!source || !path) return undefined;
  const segments = String(path)
    .split(".")
    .flatMap((segment) => {
      if (segment.endsWith("[]")) {
        return [segment.slice(0, -2), "[]"];
      }
      return [segment];
    });

  let current = [source];
  for (const segment of segments) {
    if (segment === "[]") {
      current = current.flatMap((item) => (Array.isArray(item) ? item : []));
      continue;
    }
    current = current
      .map((item) =>
        item && typeof item === "object" ? item[segment] : undefined,
      )
      .filter((item) => item !== undefined && item !== null);
  }

  if (current.length === 0) return undefined;
  return current.length === 1 ? current[0] : current;
}

function normalizeComparableValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value.trim();
  return value;
}

function collectSchemaFieldPaths(fields = [], prefix = "") {
  const results = [];
  for (const field of fields || []) {
    const key = String(field?.field_key || "").trim();
    if (!key) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    results.push({
      path,
      factId: field?.fact_id || "",
    });
    if (field?.data_type === "OBJECT") {
      results.push(...collectSchemaFieldPaths(field.children || [], path));
    }
    if (field?.data_type === "ARRAY") {
      results.push(
        ...collectSchemaFieldPaths(field.item_fields || [], `${path}[]`),
      );
    }
  }
  return results;
}

function hydrateSchemaFields(materialConfig) {
  return (materialConfig?.schemaFields || []).map((field) => ({ ...field }));
}

function compareValues(left, operator, right, params = {}) {
  switch (operator) {
    case "EQ":
      return left === right;
    case "NE":
      return left !== right;
    case "GT":
      return Number(left) > Number(right);
    case "GTE":
      return Number(left) >= Number(right);
    case "LT":
      return Number(left) < Number(right);
    case "LTE":
      return Number(left) <= Number(right);
    case "CONTAINS":
      return String(left || "").includes(String(right || ""));
    case "NOT_CONTAINS":
      return !String(left || "").includes(String(right || ""));
    case "PERCENT_DIFF_LTE": {
      // 两个数值的百分比差异 <= params.threshold（默认5%）
      const l = Number(left);
      const r = Number(right);
      if (l === 0 && r === 0) return true;
      const base = Math.max(Math.abs(l), Math.abs(r));
      if (base === 0) return true;
      const pctDiff = (Math.abs(l - r) / base) * 100;
      const threshold = Number(params.threshold ?? 5);
      return pctDiff <= threshold;
    }
    case "DATE_BEFORE_NOW": {
      // 日期不能是未来日期（只用 left，right 不参与）
      const d = new Date(left);
      if (Number.isNaN(d.getTime())) return true;
      return d <= new Date();
    }
    default:
      return false;
  }
}

function extractFieldValue(document, ref, materialConfig) {
  const sources = [
    document?.structuredData,
    document?.ocrData,
    document?.documentSummary,
  ].filter(Boolean);

  const candidates = [
    ref.field_key,
    ref.fact_id,
    ref.field_key?.split(".").pop(),
    ref.fact_id?.split(".").pop(),
  ].filter(Boolean);

  const schemaBinding = collectSchemaFieldPaths(
    hydrateSchemaFields(materialConfig),
  ).find((item) => item.factId === ref.fact_id || item.path === ref.field_key);
  if (schemaBinding) {
    candidates.unshift(schemaBinding.path);
  }

  for (const source of sources) {
    for (const candidate of candidates) {
      const direct = getNestedValue(source, candidate);
      if (direct !== undefined && direct !== null && direct !== "") {
        return direct;
      }
    }
  }

  return undefined;
}

export function executeMaterialValidationRules(documents = []) {
  const rules = (readData("material-validation-rules") || []).filter(
    (rule) => rule.enabled,
  );
  const materials = readData("claims-materials") || [];
  const results = [];
  const validationFacts = {};

  for (const rule of rules) {
    // DATE_BEFORE_NOW 只需要左侧文档，右侧是系统值
    const isUnaryOperator = rule.operator === "DATE_BEFORE_NOW";
    const isSystemRight = rule.right?.material_id === "$SYSTEM";

    const leftDoc = documents.find(
      (doc) =>
        doc?.classification?.materialId === rule.left.material_id ||
        doc?.materialId === rule.left.material_id,
    );

    if (!leftDoc) {
      continue;
    }

    let rightDoc = null;
    if (!isUnaryOperator && !isSystemRight) {
      rightDoc = documents.find(
        (doc) =>
          doc?.classification?.materialId === rule.right.material_id ||
          doc?.materialId === rule.right.material_id,
      );
      if (!rightDoc) {
        continue;
      }
    }

    const leftMaterial = materials.find(
      (item) => item.id === rule.left.material_id,
    );
    const leftValue = normalizeComparableValue(
      extractFieldValue(leftDoc, rule.left, leftMaterial),
    );

    let rightValue;
    if (isUnaryOperator || isSystemRight) {
      // 单目操作符或系统值：右侧不从文档提取
      rightValue = null;
    } else {
      const rightMaterial = materials.find(
        (item) => item.id === rule.right.material_id,
      );
      rightValue = normalizeComparableValue(
        extractFieldValue(rightDoc, rule.right, rightMaterial),
      );
    }

    // 单目操作符只检查左值是否存在
    if (leftValue === null) {
      results.push({
        type: rule.category,
        passed: false,
        severity: rule.severity,
        message: `${rule.name} 缺少可比对的字段值`,
        details: {
          ruleId: rule.id,
          reasonCode: rule.reason_code,
          field: `${rule.left.field_key}${isUnaryOperator ? "" : ` <> ${rule.right.field_key}`}`,
          relatedDocuments: [leftDoc.documentId, rightDoc?.documentId].filter(
            Boolean,
          ),
        },
      });
      if (rule.output_fact_id) {
        validationFacts[rule.output_fact_id] = null;
      }
      continue;
    }

    // 双目操作符还需要右值
    if (!isUnaryOperator && !isSystemRight && rightValue === null) {
      results.push({
        type: rule.category,
        passed: false,
        severity: rule.severity,
        message: `${rule.name} 缺少可比对的字段值`,
        details: {
          ruleId: rule.id,
          reasonCode: rule.reason_code,
          field: `${rule.left.field_key} <> ${rule.right.field_key}`,
          relatedDocuments: [leftDoc.documentId, rightDoc?.documentId].filter(
            Boolean,
          ),
        },
      });
      if (rule.output_fact_id) {
        validationFacts[rule.output_fact_id] = null;
      }
      continue;
    }

    const passed = compareValues(
      leftValue,
      rule.operator,
      rightValue,
      rule.params || {},
    );
    results.push({
      type: rule.category,
      passed,
      severity: passed ? "info" : rule.severity,
      message: passed
        ? `${rule.name} 通过`
        : rule.message_template || `${rule.name} 未通过`,
      details: {
        ruleId: rule.id,
        reasonCode: rule.reason_code,
        expected: rightValue,
        actual: leftValue,
        field: isUnaryOperator
          ? rule.left.field_key
          : `${rule.left.field_key} ${rule.operator} ${rule.right.field_key}`,
        relatedDocuments: [leftDoc.documentId, rightDoc?.documentId].filter(
          Boolean,
        ),
        failureAction: rule.failure_action,
      },
    });

    if (rule.output_fact_id) {
      validationFacts[rule.output_fact_id] = passed;
    }
  }

  return {
    validationResults: results,
    validationFacts,
  };
}

/**
 * 检查校验结果，为 MANUAL_REVIEW 类型的失败项创建介入点2实例
 * @param {string} claimCaseId - 案件ID
 * @param {Array} validationResults - executeMaterialValidationRules 返回的 validationResults
 */
export function createValidationGateInterventions(
  claimCaseId,
  validationResults = [],
) {
  const manualReviewFailures = validationResults.filter(
    (r) => !r.passed && r.details?.failureAction === "MANUAL_REVIEW",
  );

  if (manualReviewFailures.length === 0) return [];

  const rules = readData("material-validation-rules") || [];
  const created = [];

  for (const failure of manualReviewFailures) {
    const rule = rules.find((r) => r.id === failure.details?.ruleId);
    const ruleName = rule?.name || failure.details?.ruleId || "未知规则";
    const leftVal =
      failure.details?.actual != null ? String(failure.details.actual) : "N/A";
    const rightVal =
      failure.details?.expected != null
        ? String(failure.details.expected)
        : "N/A";

    try {
      const intervention = createIntervention({
        claimCaseId,
        stageKey: "parse",
        interventionType: "VALIDATION_GATE",
        reason: {
          code: failure.details?.reasonCode || "VALIDATION_FAILED",
          summary: `校验规则「${ruleName}」不通过：${failure.message}`,
          detail: `校验规则「${ruleName}」不通过：${failure.message}`,
          sourceRuleId: failure.details?.ruleId,
          sourceRuleName: ruleName,
          leftValue: leftVal,
          rightValue: rightVal,
        },
        priority: failure.severity === "error" ? "HIGH" : "MEDIUM",
        validationRuleIds: [failure.details?.ruleId].filter(Boolean),
      });
      created.push(intervention);
    } catch (err) {
      console.warn("[intervention] 创建校验介入失败:", err.message);
    }
  }

  return created;
}
