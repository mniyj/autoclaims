// ICD-10 Import Service
// Supports Excel/CSV/JSON data import with preview, validation, and incremental updates

import type { } from 'react'; // in case TS needs React types in project, no runtime import
import * as XLSX from 'xlsx';

// Data model for ICD-10 disease entries
export type ICD10Disease = {
  code: string;
  name: string;
  parentCode?: string;
  [key: string]: any;
};

export type ImportPreview = {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  sample: ICD10Disease[];
  errorSummary: string[];
};

export type ImportOptions = {
  incremental?: boolean; // merge into existing dataset instead of replacing
  updateExisting?: boolean; // if true, update existing codes on conflict
};

export type ImportResult = {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errorDetails?: string[];
  // optional: raw validation errors or processing errors
  validationErrors?: string[];
};

export type ValidationError = {
  row?: number;
  field?: string;
  message: string;
};

export type ValidationResult = {
  isValid: boolean;
  errors: ValidationError[];
};

const CODE_REGEX = /^[A-Z]\d{2}(?:\.\d{1,3})?$/;
const LOCAL_STORAGE_KEY = 'icd10Data';

// Helpers: local storage persistence (simple in-browser store for this MVP)
const readExistingData = (): ICD10Disease[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ICD10Disease[];
    return [];
  } catch {
    return [];
  }
};

const writeData = (data: ICD10Disease[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore write errors in MVP
  }
};

// Normalize a raw object row into ICD10Disease shape
const normalizeRow = (row: any): ICD10Disease => {
  const code = (row?.code ?? row?.Code ?? '').toString().trim();
  const name = (row?.name ?? row?.Name ?? '').toString().trim();
  const parentCode = row?.parentCode ?? row?.ParentCode ?? undefined;
  return {
    code,
    name,
    ...(parentCode !== undefined ? { parentCode: parentCode?.toString().trim() } : {}),
  };
};

// Parse a File object (Excel/CSV) using Sheet 0 as the primary data source
const parseExcelOrCsvFile = async (file: File): Promise<ICD10Disease[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheet = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheet];
  const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  // If sheet has headers like { code, name }, map accordingly. Otherwise, try best-effort
  const results: ICD10Disease[] = [];
  for (const row of json) {
    // Try to directly map known fields; unknown keys pass-through via normalization
    const obj: any = row as any;
    const rowObj = normalizeRow(obj as any);
    // Only include rows that have at least a code and a name (validation will catch downstream)
    results.push(rowObj);
  }
  // Deduplicate obvious duplicates in the parsed array by code to avoid later surprises
  const seen = new Set<string>();
  const dedup: ICD10Disease[] = [];
  for (const r of results) {
    if (r.code && !seen.has(r.code)) {
      seen.add(r.code);
      dedup.push(r);
    }
  }
  return dedup;
};

const parseJsonFile = async (file: File): Promise<ICD10Disease[]> => {
  const text = await file.text();
  let data: any = [];
  try {
    data = JSON.parse(text);
  } catch {
    // Fallback: treat as empty
    data = [];
  }
  if (Array.isArray(data)) {
    return data.map((d) => normalizeRow(d));
  }
  // If wrapped object, try to extract an array property
  if (Array.isArray((data as any)?.diseases)) {
    return (data as any).diseases.map((d: any) => normalizeRow(d));
  }
  return [];
};

const parseFileToData = async (file: File): Promise<ICD10Disease[]> => {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.json')) {
    return await parseJsonFile(file);
  }
  // Excel/CSV via Sheet 0
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    return await parseExcelOrCsvFile(file);
  }
  // Unknown format: return empty
  return [];
};

// Validation logic
const validateImport = (data: ICD10Disease[]): ValidationResult => {
  const errors: ValidationError[] = [];
  const seen = new Set<string>();

  // Precompute a map of codes present in the import for quick duplicate checks
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2; // assuming header row at 1
    // Required fields
    if (!row.code || row.code.toString().trim() === '') {
      errors.push({ row: rowNum, field: 'code', message: 'Code is required' });
      continue;
    }
    if (!row.name || row.name.toString().trim() === '') {
      errors.push({ row: rowNum, field: 'name', message: 'Name is required' });
      continue;
    }
    const code = String(row.code).trim();
    if (!CODE_REGEX.test(code)) {
      errors.push({ row: rowNum, field: 'code', message: 'Invalid ICD-10 code format' });
      continue;
    }
    if (seen.has(code)) {
      errors.push({ row: rowNum, field: 'code', message: 'Duplicate code in import' });
      continue;
    }
    seen.add(code);
    if (row.parentCode) {
      // Normalize parent code for comparison if provided
      const p = String(row.parentCode).trim();
      if (p === code) {
        errors.push({ row: rowNum, field: 'parentCode', message: 'Parent code cannot be the same as code' });
      }
    }
  }

  // Hierarchy consistency: ensure parent exists within the dataset if provided
  const codes = new Set<string>(data.map((d) => String(d.code).trim()).filter((c) => !!c));
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    const p = row?.parentCode?.toString().trim();
    if (p) {
      if (!codes.has(p)) {
        errors.push({ row: rowNum, field: 'parentCode', message: `Parent code '${p}' not found in import` });
      }
    }
  }

  return { isValid: errors.length === 0, errors };
};

// Preview implementation
export const previewImport = async (file: File): Promise<ImportPreview> => {
  const data = await parseFileToData(file);
  const validation = validateImport(data);
  // Compute valid/invalid counts using validation rules and duplicates vs in-file
  const invalidCount = validation.errors.length;
  const validCount = data.length - invalidCount;
  const sample = data.slice(0, 5);
  const errorSummary = validation.errors.map((e) => {
    const r = e.row ?? '?';
    const f = e.field ?? 'row';
    return `Row ${r}, ${f}: ${e.message}`;
  });
  return {
    totalRows: data.length,
    validCount,
    invalidCount,
    sample,
    errorSummary,
  };
};

// Execute import with optional incremental updates
export const executeImport = async (file: File, options: ImportOptions = {}): Promise<ImportResult> => {
  const data = await parseFileToData(file);
  const validation = validateImport(data);
  const errors = validation.errors.map((e) => `Row ${e.row ?? '?'}: ${e.message}`);

  const existing = readExistingData();
  const existingMap = new Map<string, ICD10Disease>();
  for (const e of existing) existingMap.set(e.code, e);

  let importedCount = 0;
  let skippedCount = 0;

  // If incremental, merge into existing; otherwise replace
  if (options.incremental) {
    // Build a working copy of existing
    const merged = [...existing];
    for (const row of data) {
      if (!row.code) continue;
      const code = row.code.trim();
      const exists = existingMap.has(code);
        if (exists) {
        if (options.updateExisting) {
          const idx = merged.findIndex((d) => d.code === code);
          if (idx >= 0) merged[idx] = { ...merged[idx], ...row };
          importedCount++;
        } else {
          skippedCount++;
        }
      } else {
        merged.push(row);
        importedCount++;
      }
    }
    writeData(merged);
  } else {
    const validRows = data.filter((_, idx) => {
      // Use validation: consider row valid if its code is not in validation.errors for that row
      // Simplify: if there are any errors, skip that row by row index mapping
      return validation.errors.every((e) => (e.row ?? -1) !== (idx + 2));
    });
    writeData(validRows);
    importedCount = validRows.length;
  }

  // Determine skipped/failed counts from validation as a fallback
  if (errors.length > 0 && options.incremental) {
    // approximate: rows with errors are skipped when not updating existing
    // We'll recompute skipped as total - imported
    skippedCount = Math.max(0, data.length - importedCount);
  }

  return {
    success: importedCount > 0 || (options.incremental ? true : data.length === importedCount),
    importedCount,
    skippedCount,
    errorDetails: errors.length ? errors : undefined,
    validationErrors: errors.length ? errors : undefined,
  };
};

// Import from URL: fetch resource and run import flow
export const importFromUrl = async (url: string): Promise<ImportResult> => {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { success: false, importedCount: 0, skippedCount: 0, errorDetails: [`HTTP ${res.status}: ${res.statusText}`] };
    }
    // Try to infer format from URL/content-type; fetch as blob/text accordingly
    const lower = url.toLowerCase();
    let fileData: File | null = null;
    if (lower.endsWith('.json')) {
      const text = await res.text();
      // Create a pseudo-file-like object for parsing (not a real File, but supports .text() usage in our parser)
      // We’ll adapt by delegating to JSON data directly
      const data = JSON.parse(text);
      // Normalize to ICD10Disease[]
      const normalized = Array.isArray(data) ? data.map((d) => normalizeRowImport(d)) : [];
      // Validate and import using existing flow (simulate a File by bypassing parseFileToData)
      const preview = { totalRows: normalized.length, validCount: 0, invalidCount: 0, sample: normalized.slice(0, 5), errorSummary: [] } as any;
      // For simplicity, create a temporary blob-backed File-like object is not necessary; reuse execute path by bypassing file
      return await executeImportedData(normalized);
    } else {
      // For xlsx/xls/csv, we need a File-like input. We can't create File from fetch easily without Blob+File construction.
      const blob = await res.blob();
      // Create a File from blob (name guess based on URL)
      const blobFile = new File([blob], url.substring(url.lastIndexOf('/')+1) || 'import', { type: blob.type || 'application/octet-stream' });
      return await executeImport(blobFile, { incremental: true, updateExisting: true });
    }
  } catch (err: any) {
    return { success: false, importedCount: 0, skippedCount: 0, errorDetails: [err?.message ?? String(err)] };
  }
};

// Utility used by importFromUrl to normalize JSON items (when importing from URL JSON payloads)
const normalizeRowImport = (row: any): ICD10Disease => {
  const code = (row?.code ?? row?.Code ?? '').toString().trim();
  const name = (row?.name ?? row?.Name ?? '').toString().trim();
  const parentCode = row?.parentCode ?? row?.ParentCode ?? undefined;
  return {
    code,
    name,
    ...(parentCode !== undefined ? { parentCode: parentCode?.toString().trim() } : {}),
  };
};

// Helper: import from in-memory data array (used by importFromUrl JSON path)
const executeImportedData = async (data: ICD10Disease[]): Promise<ImportResult> => {
  // Validate first
  const validation = validateImport(data);
  const errors = validation.errors.map((e) => `Row ${e.row ?? '?'}: ${e.message}`);
  const existing = readExistingData();
  const existingMap = new Map<string, ICD10Disease>();
  for (const e of existing) existingMap.set(e.code, e);
  let importedCount = 0;
  const merged = [...existing];
  for (const row of data) {
    const code = row.code?.toString().trim();
    if (!code) continue;
    if (existingMap.has(code)) {
      // skip existing in JSON import for safety
      continue;
    } else {
      merged.push(row);
      importedCount++;
    }
  }
  writeData(merged);
  return { success: importedCount > 0, importedCount, skippedCount: data.length - importedCount, errorDetails: errors.length ? errors : undefined, validationErrors: errors.length ? errors : undefined };
};

export default {
  previewImport,
  executeImport,
  importFromUrl,
  validateImport,
};
