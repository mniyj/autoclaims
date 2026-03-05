/**
 * 数据修复脚本: sync-parse-results.js
 * 
 * 将 claim-cases.json 中的 fileParseResults 同步到 claim-materials.json
 * 
 * Usage: node server/migrations/sync-parse-results.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const dataDir = path.join(projectRoot, 'jsonlist');

// 读取 JSON 文件
function readJsonFile(fileName) {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${fileName}`);
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`❌ Error reading ${fileName}:`, err.message);
    return [];
  }
}

// 写入 JSON 文件
function writeJsonFile(fileName, data) {
  const filePath = path.join(dataDir, fileName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`❌ Error writing ${fileName}:`, err.message);
    return false;
  }
}

// 同步解析结果
async function syncParseResults() {
  console.log('🚀 Starting parse results sync...\n');

  // 1. 读取数据
  const claimCases = readJsonFile('claim-cases.json');
  const materials = readJsonFile('claim-materials.json');

  console.log(`📖 Loaded ${claimCases.length} claim cases`);
  console.log(`📖 Loaded ${materials.length} materials`);

  let updatedCount = 0;
  let skippedCount = 0;

  // 2. 遍历所有案件
  for (const claimCase of claimCases) {
    const fileParseResults = claimCase.fileParseResults || {};
    
    // 遍历所有解析结果
    for (const [fileKey, parseResult] of Object.entries(fileParseResults)) {
      // fileKey 格式: "categoryName-fileName"
      const fileName = fileKey.split('-').slice(1).join('-');
      
      if (!fileName || !parseResult?.extractedData) {
        continue;
      }

      // 查找对应的 material
      const material = materials.find(m => 
        m.claimCaseId === claimCase.id && 
        m.fileName === fileName &&
        m.source === 'direct_upload'
      );

      if (!material) {
        console.log(`⚠️  Material not found: ${fileName} (case: ${claimCase.id})`);
        skippedCount++;
        continue;
      }

      // 检查是否已有 extractedData
      if (material.extractedData && Object.keys(material.extractedData).length > 0) {
        console.log(`⏭️  Already has extractedData: ${fileName}`);
        continue;
      }

      // 同步解析结果
      material.extractedData = parseResult.extractedData;
      material.auditConclusion = parseResult.auditConclusion;
      material.confidence = parseResult.confidence;
      material.materialId = parseResult.materialId;
      material.materialName = parseResult.materialName;
      material.processedAt = parseResult.parsedAt;
      material.status = 'completed';

      updatedCount++;
      console.log(`✅ Synced: ${fileName} (case: ${claimCase.id})`);
    }
  }

  // 3. 保存更新后的 materials
  console.log(`\n💾 Saving updated materials...`);
  const success = writeJsonFile('claim-materials.json', materials);

  if (success) {
    console.log('\n✅ Sync completed successfully!');
    console.log(`   - Updated: ${updatedCount} materials`);
    console.log(`   - Skipped: ${skippedCount} materials`);
  } else {
    console.error('\n❌ Failed to save materials');
    process.exit(1);
  }
}

// 执行同步
syncParseResults()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Sync failed:', err);
    process.exit(1);
  });
