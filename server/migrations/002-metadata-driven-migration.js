/**
 * Migration 002: Metadata-Driven Migration
 *
 * Part A: Add type_code to existing materials (from material-type-catalog.json)
 * Part B: Add binding_status to all schemaFields (bound / display_only)
 * Part C: Generate migration report
 *
 * Run: node server/migrations/002-metadata-driven-migration.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATALOG_PATH = path.resolve(__dirname, '../../jsonlist/material-type-catalog.json');
const MATERIALS_PATH = path.resolve(__dirname, '../../jsonlist/claims-materials.json');
const REPORT_PATH = path.resolve(__dirname, '../../jsonlist/migration-report-002.json');

function loadJSON(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * Build a lookup map: material id -> type_code
 */
function buildTypeCodeMap(catalog) {
  const map = {};
  for (const entry of catalog) {
    if (entry._source_material_id) {
      map[entry._source_material_id] = entry.type_code;
    }
  }
  return map;
}

/**
 * Recursively annotate schemaFields with binding_status.
 * Returns { total, bound, displayOnly } counts.
 */
function annotateFields(fields) {
  let total = 0;
  let bound = 0;
  let displayOnly = 0;

  for (const field of fields) {
    total += 1;

    if (field.fact_id) {
      field.binding_status = 'bound';
      bound += 1;
    } else {
      field.binding_status = 'display_only';
      displayOnly += 1;
    }

    // Recurse into children (OBJECT type)
    if (Array.isArray(field.children)) {
      const childCounts = annotateFields(field.children);
      total += childCounts.total;
      bound += childCounts.bound;
      displayOnly += childCounts.displayOnly;
    }

    // Recurse into item_fields (ARRAY type)
    if (Array.isArray(field.item_fields)) {
      const itemCounts = annotateFields(field.item_fields);
      total += itemCounts.total;
      bound += itemCounts.bound;
      displayOnly += itemCounts.displayOnly;
    }
  }

  return { total, bound, displayOnly };
}

function run() {
  console.log('=== Migration 002: Metadata-Driven Migration ===\n');

  // Load data
  const catalog = loadJSON(CATALOG_PATH);
  const materials = loadJSON(MATERIALS_PATH);
  const typeCodeMap = buildTypeCodeMap(catalog);

  console.log(`Loaded ${catalog.length} catalog entries`);
  console.log(`Loaded ${materials.length} materials\n`);

  let materialsWithTypeCode = 0;
  let totalFields = 0;
  let totalBound = 0;
  let totalDisplayOnly = 0;
  const details = [];

  for (const material of materials) {
    // Part A: assign type_code
    const typeCode = typeCodeMap[material.id];
    if (typeCode) {
      material.type_code = typeCode;
      materialsWithTypeCode += 1;
    } else {
      console.warn(`  WARN: No catalog entry found for material ${material.id} (${material.name})`);
    }

    // Part B: annotate schemaFields with binding_status
    let fieldCounts = { total: 0, bound: 0, displayOnly: 0 };
    if (Array.isArray(material.schemaFields)) {
      fieldCounts = annotateFields(material.schemaFields);
    }

    totalFields += fieldCounts.total;
    totalBound += fieldCounts.bound;
    totalDisplayOnly += fieldCounts.displayOnly;

    details.push({
      material_id: material.id,
      type_code: material.type_code || null,
      bound: fieldCounts.bound,
      display_only: fieldCounts.displayOnly,
    });
  }

  // Write back modified materials
  writeJSON(MATERIALS_PATH, materials);
  console.log(`Wrote updated claims-materials.json\n`);

  // Part C: generate report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total_materials: materials.length,
      materials_with_type_code: materialsWithTypeCode,
      total_fields: totalFields,
      bound_fields: totalBound,
      display_only_fields: totalDisplayOnly,
    },
    details,
  };

  writeJSON(REPORT_PATH, report);
  console.log(`Wrote migration report to ${REPORT_PATH}\n`);

  // Console summary
  console.log('--- Migration Summary ---');
  console.log(`  Total materials:          ${report.summary.total_materials}`);
  console.log(`  Materials with type_code: ${report.summary.materials_with_type_code}`);
  console.log(`  Total fields:             ${report.summary.total_fields}`);
  console.log(`  Bound fields:             ${report.summary.bound_fields}`);
  console.log(`  Display-only fields:      ${report.summary.display_only_fields}`);
  console.log('\n=== Migration 002 complete ===');
}

run();
