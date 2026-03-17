import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ICD10Disease {
  id: string;
  code: string;
  name: string;
  hierarchy: {
    chapter: { number: number; codeRange: string; name: string };
    section: { codeRange: string; name: string };
    category: { code: string; name: string };
    subcategory: { code: string; name: string };
  };
  [key: string]: any;
}

async function buildICD10Indexes() {
  const baseDir = path.resolve(__dirname, '..', 'jsonlist', 'icd10');
  const inputPath = path.join(baseDir, 'diseases.json');
  const outputPath = path.join(baseDir, 'indexes.json');

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input ICD-10 data not found: ${inputPath}`);
  }

  const raw = await fs.promises.readFile(inputPath, 'utf-8');
  const diseases: ICD10Disease[] = JSON.parse(raw);

  const byCode: Record<string, string> = {};
  const byChapter: Record<string, string[]> = {};
  const byCategory: Record<string, string[]> = {};

  for (const d of diseases) {
    const id = d.id;
    const code = d.code;
    const chapterNumber = String(d.hierarchy.chapter.number);
    const categoryCode = d.hierarchy.category.code;

    byCode[code] = id;

    if (!byChapter[chapterNumber]) {
      byChapter[chapterNumber] = [];
    }
    byChapter[chapterNumber].push(id);

    if (!byCategory[categoryCode]) {
      byCategory[categoryCode] = [];
    }
    byCategory[categoryCode].push(id);
  }

  const indexObject = { byCode, byChapter, byCategory };

  await fs.promises.writeFile(
    outputPath,
    JSON.stringify(indexObject, null, 2),
    'utf-8'
  );

  console.log(`ICD-10 indexes written to ${outputPath}`);
  console.log(`  byCode: ${Object.keys(byCode).length} entries`);
  console.log(`  byChapter: ${Object.keys(byChapter).length} chapters`);
  console.log(`  byCategory: ${Object.keys(byCategory).length} categories`);
}

buildICD10Indexes().catch((err) => {
  console.error('Failed to build ICD-10 indexes:', err);
  process.exit(1);
});
