import { readData } from "../utils/fileStore.js";

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
      .map((item) => (item && typeof item === "object" ? item[segment] : undefined))
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
      results.push(...collectSchemaFieldPaths(field.item_fields || [], `${path}[]`));
    }
  }
  return results;
}

function hydrateSchemaFields(materialConfig) {
  return ((materialConfig?.schemaFields || [])).map((field) => ({ ...field }));
}

function compareValues(left, operator, right) {
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

  const schemaBinding = collectSchemaFieldPaths(hydrateSchemaFields(materialConfig)).find((item) =>
    item.factId === ref.fact_id || item.path === ref.field_key,
  );
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
  const rules = (readData("material-validation-rules") || []).filter((rule) => rule.enabled);
  const materials = readData("claims-materials") || [];
  const results = [];
  const validationFacts = {};

  for (const rule of rules) {
    const leftDoc = documents.find((doc) =>
      doc?.classification?.materialId === rule.left.material_id || doc?.materialId === rule.left.material_id,
    );
    const rightDoc = documents.find((doc) =>
      doc?.classification?.materialId === rule.right.material_id || doc?.materialId === rule.right.material_id,
    );

    if (!leftDoc || !rightDoc) {
      continue;
    }

    const leftMaterial = materials.find((item) => item.id === rule.left.material_id);
    const rightMaterial = materials.find((item) => item.id === rule.right.material_id);
    const leftValue = normalizeComparableValue(extractFieldValue(leftDoc, rule.left, leftMaterial));
    const rightValue = normalizeComparableValue(extractFieldValue(rightDoc, rule.right, rightMaterial));

    if (leftValue === null || rightValue === null) {
      results.push({
        type: rule.category,
        passed: false,
        severity: rule.severity,
        message: `${rule.name} 缺少可比对的字段值`,
        details: {
          ruleId: rule.id,
          reasonCode: rule.reason_code,
          field: `${rule.left.field_key} <> ${rule.right.field_key}`,
          relatedDocuments: [leftDoc.documentId, rightDoc.documentId].filter(Boolean),
        },
      });
      if (rule.output_fact_id) {
        validationFacts[rule.output_fact_id] = null;
      }
      continue;
    }

    const passed = compareValues(leftValue, rule.operator, rightValue);
    results.push({
      type: rule.category,
      passed,
      severity: passed ? "info" : rule.severity,
      message: passed ? `${rule.name} 通过` : rule.message_template || `${rule.name} 未通过`,
      details: {
        ruleId: rule.id,
        reasonCode: rule.reason_code,
        expected: rightValue,
        actual: leftValue,
        field: `${rule.left.field_key} ${rule.operator} ${rule.right.field_key}`,
        relatedDocuments: [leftDoc.documentId, rightDoc.documentId].filter(Boolean),
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
