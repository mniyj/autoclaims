import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { ICD10Disease } from '../types/icd10.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let XLSX: any;
try {
  const xlsxModule = await import('xlsx');
  XLSX = xlsxModule.default || xlsxModule;
} catch (e) {
  console.error('Failed to load xlsx module. Please install it: npm install xlsx');
  process.exit(1);
}

// Phase 1 Task 1.2: Convert ICD-10 Excel data to internal JSON structure
// - Reads docs/医保数据/ICD-10医保2.0版.xlsx
// - Produces jsonlist/icd10/diseases.json and hierarchical extracts
// - Removes newlines from text fields

// Helpers
function sanitize(text: string): string {
  if (!text) return '';
  return text.replace(/\r?\n|\r/g, ' ').trim();
}

function getChapterNumberFromLetter(letter: string): number {
  const L = (letter || 'A').toUpperCase();
  if (L === 'A' || L === 'B') return 1;
  if (L === 'C' || L === 'D') return 2;
  if ('EFGH'.includes(L)) return 3;
  if ('IJKLMN'.includes(L)) return 4;
  if ('OPQRST'.includes(L)) return 5;
  if ('UVWXYZ'.includes(L)) return 6;
  return 1;
}

async function main() {
  // 1) Read Excel file
  const excelPath = path.resolve(__dirname, '../docs/医保数据/ICD-10医保2.0版.xlsx');
  if (!fs.existsSync(excelPath)) {
    console.error('Excel file not found:', excelPath);
    process.exit(1);
  }

  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`ICD-10: read ${rows.length} rows from Excel`);

  const now = new Date().toISOString();
  const baseVersion = 'medicare-v2.0';
  const diseases: ICD10Disease[] = [];

  // Containers for chapter/section/category/subcategory extraction
  const chaptersMap = new Map<string, { number: number; codeRange: string; name: string }>();
  const sectionsMap = new Map<string, { codeRange: string; name: string }>();
  const categoriesMap = new Map<string, { code: string; name: string }>();
  const subcategoriesMap = new Map<string, { code: string; name: string }>();

  // Iterate rows and transform
  const invalidRows: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? {};
    // Try to read common column names, fallback to generic ones
    const codeRaw = String(r['诊断代码'] ?? r['code'] ?? r['Code'] ?? '').trim();
    const nameRaw = String(r['诊断名称'] ?? r['name'] ?? r['Diagnosis'] ?? '').trim();
    const code = codeRaw;
    if (!code) { invalidRows.push(r); continue; }
    const name = sanitize(nameRaw || code);

    // Hierarchy derivation (approximate, robust for export)
    const leading = code.charAt(0).toUpperCase() ?? 'A';
    const chapterNumber = getChapterNumberFromLetter(leading);
    const chapterCodeRange = `${leading}00-${leading}99`;
    const chapterName = `Chapter ${chapterNumber}: ${leading}00-${leading}99`;

    const first3 = code.substring(0, 3);
    const sectionCodeRange = `${first3}-` + first3.substring(0, 2) + '9'; // e.g. A00-A09
    const sectionName = `Section ${first3}`;

    const categoryCode = first3;
    const categoryName = `Category ${categoryCode}`;

    const subcatCode = code.includes('.') ? code : `${categoryCode}.0`;
    const subcatName = code.includes('.') ? `Subcategory ${code}` : `Subcategory ${subcatCode}`;

    // Track unique hierarchies
    if (!chaptersMap.has(leading)) {
      chaptersMap.set(leading, { number: chapterNumber, codeRange: chapterCodeRange, name: chapterName });
    }
    if (!sectionsMap.has(first3)) {
      sectionsMap.set(first3, { codeRange: sectionCodeRange, name: sectionName });
    }
    if (!categoriesMap.has(categoryCode)) {
      categoriesMap.set(categoryCode, { code: categoryCode, name: categoryName });
    }
    if (!subcategoriesMap.has(subcatCode)) {
      subcategoriesMap.set(subcatCode, { code: subcatCode, name: subcatName });
    }

    const disease: ICD10Disease = {
      id: `icd-${code}`,
      code,
      name,
      hierarchy: {
        chapter: {
          number: chapterNumber,
          codeRange: chapterCodeRange,
          name: chapterName
        },
        section: {
          codeRange: sectionCodeRange,
          name: sectionName
        },
        category: {
          code: categoryCode,
          name: categoryName
        },
        subcategory: {
          code: subcatCode,
          name: subcatName
        }
      },
      version: baseVersion,
      standard: 'MEDICARE',
      effectiveDate: new Date().toISOString().slice(0, 10),
      createdAt: now,
      updatedAt: now,
      isActive: true
    };

    // Normalize text fields by removing newlines
    disease.name = sanitize(disease.name);
    disease.hierarchy.chapter.name = sanitize(disease.hierarchy.chapter.name);
    disease.hierarchy.section.name = sanitize(disease.hierarchy.section.name);
    disease.hierarchy.category.name = sanitize(disease.hierarchy.category.name);
    disease.hierarchy.subcategory.name = sanitize(disease.hierarchy.subcategory.name);

    diseases.push(disease);
  }

  // Ensure storage directory exists
  const outDir = path.resolve(__dirname, '../jsonlist/icd10');
  fs.mkdirSync(outDir, { recursive: true });

  // Write outputs
  const diseasesPath = path.resolve(outDir, 'diseases.json');
  fs.writeFileSync(diseasesPath, JSON.stringify(diseases, null, 2), 'utf8');
  console.log(`Wrote ${diseases.length} diseases to ${diseasesPath}`);

  const chapters = Array.from(chaptersMap.values());
  const sections = Array.from(sectionsMap.values());
  const categories = Array.from(categoriesMap.values());
  const subcategories = Array.from(subcategoriesMap.values());

  fs.writeFileSync(path.resolve(outDir, 'chapters.json'), JSON.stringify(chapters, null, 2), 'utf8');
  fs.writeFileSync(path.resolve(outDir, 'sections.json'), JSON.stringify(sections, null, 2), 'utf8');
  fs.writeFileSync(path.resolve(outDir, 'categories.json'), JSON.stringify(categories, null, 2), 'utf8');
  fs.writeFileSync(path.resolve(outDir, 'subcategories.json'), JSON.stringify(subcategories, null, 2), 'utf8');
  console.log('Wrote chapters.json, sections.json, categories.json, subcategories.json');
  if (invalidRows.length > 0) {
    fs.writeFileSync(path.resolve(outDir, 'invalid_rows.json'), JSON.stringify(invalidRows, null, 2), 'utf8');
    console.log(`Wrote invalid_rows.json with ${invalidRows.length} rows`);
  }
}

main().catch((err) => {
  console.error('ICD-10 import failed:', err);
  process.exit(1);
});
