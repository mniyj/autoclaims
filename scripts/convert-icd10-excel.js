// Lightweight ICD-10 Excel converter (JS, no TS typings required)
// Reads docs/医保数据/ICD-10医保2.0版.xlsx and outputs JSON artifacts under jsonlist/icd10/
import fs from 'fs';
import path from 'path';
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
let XLSX;
try {
  (async () => {
    const mod = await import('xlsx');
    XLSX = mod.default || mod;
  })();
} catch (e) {
  console.error('xlsx module missing. Run: npm install xlsx');
  process.exit(1);
}

function sanitize(text) {
  if (!text) return '';
  return String(text).replace(/\r?\n|\r/g, ' ').trim();
}

function chapterFromCode(code) {
  if (!code) return 1;
  const lead = String(code).charAt(0).toUpperCase();
  // Simple mapping: A/B/C/D/E/F -> chapters 1..6 as a fallback
  const map = { A:1,B:1,C:2,D:2,E:3,F:3 };
  return map[lead] || 1;
}

async function main() {
  const excelPath = path.resolve(process.cwd(), 'docs/医保数据/ICD-10医保2.0版.xlsx');
  if (!fs.existsSync(excelPath)) {
    console.error('Excel file not found:', excelPath);
    process.exit(1);
  }
  const wb = XLSX.readFile(excelPath);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`ICD-10: read ${rows.length} rows from Excel`);

  const now = new Date().toISOString();
  const baseVersion = 'medicare-v2.0';
  const diseases = [];
  const invalidRows = [];
  const chapters = new Map();
  const sections = new Map();
  const categories = new Map();
  const subcategories = new Map();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const code = String(r['诊断代码'] || r['code'] || r['Code'] || '').trim();
    const name = sanitize(String(r['诊断名称'] || r['name'] || r['Diagnosis'] || ''));
    if (!code) { invalidRows.push(r); continue; }

    const leading = code.charAt(0).toUpperCase() || 'A';
    const chapterNum = chapterFromCode(code);
    const chapterCodeRange = `${leading}00-${leading}99`;
    const sectionCodeRange = `${code.substring(0, 3)}-${code.substring(0, 3)}`;
    const categoryCode = code.substring(0, 3);
    const subcatCode = code.includes('.') ? code : `${categoryCode}.0`;

    const chapterName = `Chapter ${chapterNum}: ${leading}00-${leading}99`;
    const sectionName = `Section ${code.substring(0, 3)}`;
    const categoryName = `Category ${categoryCode}`;
    const subcategoryName = code.includes('.') ? `Subcategory ${code}` : `Subcategory ${subcatCode}`;

    if (!chapters.has(leading)) chapters.set(leading, { number: chapterNum, codeRange: chapterCodeRange, name: chapterName });
    if (!sections.has(code.substring(0,3))) sections.set(code.substring(0,3), { codeRange: sectionCodeRange, name: sectionName });
    if (!categories.has(categoryCode)) categories.set(categoryCode, { code: categoryCode, name: categoryName });
    if (!subcategories.has(subcatCode)) subcategories.set(subcatCode, { code: subcatCode, name: subcategoryName });

    const disease = {
      id: `icd-${code}`,
      code,
      name,
      hierarchy: {
        chapter: { number: chapterNum, codeRange: chapterCodeRange, name: chapterName },
        section: { codeRange: sectionCodeRange, name: sectionName },
        category: { code: categoryCode, name: categoryName },
        subcategory: { code: subcatCode, name: subcategoryName }
      },
      version: baseVersion,
      standard: 'MEDICARE',
      effectiveDate: new Date().toISOString().slice(0,10),
      createdAt: now,
      updatedAt: now,
      isActive: true
    };
    // sanitize text fields
    disease.name = sanitize(disease.name);
    disease.hierarchy.chapter.name = sanitize(disease.hierarchy.chapter.name);
    disease.hierarchy.section.name = sanitize(disease.hierarchy.section.name);
    disease.hierarchy.category.name = sanitize(disease.hierarchy.category.name);
    disease.hierarchy.subcategory.name = sanitize(disease.hierarchy.subcategory.name);
    diseases.push(disease);
  }

  const outDir = path.resolve(__dirname, '../jsonlist/icd10');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.resolve(outDir, 'diseases.json'), JSON.stringify(diseases, null, 2), 'utf8');
  console.log(`Wrote diseases.json with ${diseases.length} entries`);
  fs.writeFileSync(path.resolve(outDir, 'chapters.json'), JSON.stringify(Array.from(chapters.values()), null, 2), 'utf8');
  fs.writeFileSync(path.resolve(outDir, 'sections.json'), JSON.stringify(Array.from(sections.values()), null, 2), 'utf8');
  fs.writeFileSync(path.resolve(outDir, 'categories.json'), JSON.stringify(Array.from(categories.values()), null, 2), 'utf8');
  fs.writeFileSync(path.resolve(outDir, 'subcategories.json'), JSON.stringify(Array.from(subcategories.values()), null, 2), 'utf8');
  console.log('Wrote chapters.json, sections.json, categories.json, subcategories.json');
  if (invalidRows.length > 0) {
    fs.writeFileSync(path.resolve(outDir, 'invalid_rows.json'), JSON.stringify(invalidRows, null, 2), 'utf8');
    console.log(`Wrote invalid_rows.json with ${invalidRows.length} rows`);
  }
}

(async () => {
  for (let i = 0; i < 60; i++) {
    if (XLSX) break;
    await new Promise(r => setTimeout(r, 50));
  }
  await main();
})();
