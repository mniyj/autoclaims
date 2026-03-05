/**
 * 数据迁移脚本: 001-merge-materials.js
 * 
 * 将 fileCategories (claim-cases.json) 和 claim-documents (claim-documents.json)
 * 合并为统一的 claim-materials.json 格式
 * 
 * Usage: node server/migrations/001-merge-materials.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const dataDir = path.join(projectRoot, 'jsonlist');

// 生成唯一 ID
function generateId(prefix = 'mat') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 推断文件类型
function inferFileType(fileName) {
  if (!fileName) return 'application/octet-stream';
  const ext = fileName.split('.').pop()?.toLowerCase();
  const typeMap = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return typeMap[ext] || 'application/octet-stream';
}

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

// 迁移主函数
async function migrate() {
  console.log('🚀 Starting materials migration...\n');

  // 1. 读取源数据
  console.log('📖 Reading source data...');
  const claimCases = readJsonFile('claim-cases.json');
  const claimDocuments = readJsonFile('claim-documents.json');

  console.log(`   - Claim cases: ${claimCases.length}`);
  console.log(`   - Import records: ${claimDocuments.length}`);

  // 2. 迁移 fileCategories (direct_upload)
  console.log('\n📤 Migrating fileCategories...');
  const directUploadMaterials = [];
  let fileCategoryCount = 0;

  for (const claimCase of claimCases) {
    if (!claimCase.fileCategories || !Array.isArray(claimCase.fileCategories)) {
      continue;
    }

    for (const category of claimCase.fileCategories) {
      if (!category.files || !Array.isArray(category.files)) {
        continue;
      }

      for (const file of category.files) {
        if (!file.name) continue;

        directUploadMaterials.push({
          id: generateId('direct'),
          claimCaseId: claimCase.id,
          fileName: file.name,
          fileType: inferFileType(file.name),
          url: file.url || '#',
          ossKey: file.ossKey,
          category: category.name,
          materialId: undefined,
          materialName: category.name,
          extractedData: undefined,
          auditConclusion: undefined,
          confidence: undefined,
          documentSummary: undefined,
          source: 'direct_upload',
          sourceDetail: undefined,
          status: 'completed',
          uploadedAt: claimCase.createdAt || claimCase.reportTime || new Date().toISOString(),
          processedAt: undefined,
          metadata: undefined,
        });
        fileCategoryCount++;
      }
    }
  }

  console.log(`   ✓ Migrated ${fileCategoryCount} files from fileCategories`);

  // 3. 迁移 claim-documents (batch_import)
  console.log('\n📤 Migrating claim-documents...');
  const batchImportMaterials = [];
  let documentCount = 0;

  for (const record of claimDocuments) {
    if (!record.documents || !Array.isArray(record.documents)) {
      continue;
    }

    for (const doc of record.documents) {
      batchImportMaterials.push({
        id: doc.documentId || generateId('batch'),
        claimCaseId: record.claimCaseId,
        fileName: doc.fileName,
        fileType: doc.fileType || inferFileType(doc.fileName),
        url: doc.ossUrl || '#',
        ossKey: undefined,
        category: doc.classification?.materialName,
        materialId: doc.classification?.materialId,
        materialName: doc.classification?.materialName,
        extractedData: doc.structuredData,
        auditConclusion: undefined,
        confidence: doc.classification?.confidence,
        documentSummary: doc.documentSummary,
        source: 'batch_import',
        sourceDetail: {
          importId: record.id,
          importedAt: record.importedAt,
          taskId: record.taskId,
        },
        status: doc.status === 'completed' ? 'completed' : 
                doc.status === 'failed' ? 'failed' : 'pending',
        uploadedAt: record.importedAt || new Date().toISOString(),
        processedAt: doc.status === 'completed' ? record.importedAt : undefined,
        metadata: doc.duplicateWarning ? { duplicateWarning: doc.duplicateWarning } : undefined,
      });
      documentCount++;
    }
  }

  console.log(`   ✓ Migrated ${documentCount} documents from claim-documents`);

  // 4. 合并并去重
  console.log('\n🔍 Merging and deduplicating...');
  const allMaterials = [...directUploadMaterials, ...batchImportMaterials];
  
  // 去重逻辑: 基于 claimCaseId + fileName + source
  const seen = new Set();
  const uniqueMaterials = [];
  
  for (const material of allMaterials) {
    const key = `${material.claimCaseId}:${material.fileName}:${material.source}`;
    if (seen.has(key)) {
      console.log(`   ⚠️  Duplicate skipped: ${material.fileName} (${material.source})`);
      continue;
    }
    seen.add(key);
    uniqueMaterials.push(material);
  }

  const duplicatesCount = allMaterials.length - uniqueMaterials.length;
  console.log(`   ✓ Total materials: ${allMaterials.length}`);
  console.log(`   ✓ Duplicates removed: ${duplicatesCount}`);
  console.log(`   ✓ Unique materials: ${uniqueMaterials.length}`);

  // 5. 统计信息
  const stats = {
    bySource: {
      direct_upload: uniqueMaterials.filter(m => m.source === 'direct_upload').length,
      batch_import: uniqueMaterials.filter(m => m.source === 'batch_import').length,
    },
    byStatus: {
      pending: uniqueMaterials.filter(m => m.status === 'pending').length,
      processing: uniqueMaterials.filter(m => m.status === 'processing').length,
      completed: uniqueMaterials.filter(m => m.status === 'completed').length,
      failed: uniqueMaterials.filter(m => m.status === 'failed').length,
    },
    byClaimCase: new Set(uniqueMaterials.map(m => m.claimCaseId)).size,
  };

  console.log('\n📊 Migration Statistics:');
  console.log(`   - Direct uploads: ${stats.bySource.direct_upload}`);
  console.log(`   - Batch imports: ${stats.bySource.batch_import}`);
  console.log(`   - Pending: ${stats.byStatus.pending}`);
  console.log(`   - Completed: ${stats.byStatus.completed}`);
  console.log(`   - Failed: ${stats.byStatus.failed}`);
  console.log(`   - Unique claim cases: ${stats.byClaimCase}`);

  // 6. 写入目标文件
  console.log('\n💾 Writing claim-materials.json...');
  const success = writeJsonFile('claim-materials.json', uniqueMaterials);
  
  if (success) {
    console.log('   ✓ Migration completed successfully!');
    console.log(`\n📝 Output: jsonlist/claim-materials.json (${uniqueMaterials.length} records)`);
  } else {
    console.error('   ❌ Failed to write output file');
    process.exit(1);
  }

  // 7. 生成报告
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalSourceRecords: fileCategoryCount + documentCount,
      totalMigrated: uniqueMaterials.length,
      duplicatesRemoved: duplicatesCount,
    },
    statistics: stats,
    files: {
      input: ['claim-cases.json', 'claim-documents.json'],
      output: 'claim-materials.json',
    },
  };

  const reportPath = path.join(dataDir, 'migration-report-001.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`📝 Report saved: jsonlist/migration-report-001.json`);

  return report;
}

// 执行迁移
migrate()
  .then((report) => {
    console.log('\n✅ Migration finished successfully!');
    console.log(`   Total migrated: ${report.summary.totalMigrated} materials`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  });
