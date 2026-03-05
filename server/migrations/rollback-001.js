/**
 * 回滚脚本: rollback-001.js
 * 
 * 回滚 materials unification 迁移
 * - 删除 claim-materials.json
 * - 从备份恢复（如果需要）
 * 
 * Usage: node server/migrations/rollback-001.js [--restore-backup]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const dataDir = path.join(projectRoot, 'jsonlist');
const backupDir = path.join(dataDir, 'backup');

const args = process.argv.slice(2);
const restoreBackup = args.includes('--restore-backup');

console.log('⚠️  Rolling back materials unification...\n');

// 1. 删除 claim-materials.json
const materialsPath = path.join(dataDir, 'claim-materials.json');
if (fs.existsSync(materialsPath)) {
  const stats = fs.statSync(materialsPath);
  console.log(`📄 Found claim-materials.json (${(stats.size / 1024).toFixed(2)} KB)`);
  
  // 安全确认
  console.log('\n⚠️  WARNING: This will delete the unified materials data!');
  console.log('   The following will be removed:');
  console.log(`   - ${materialsPath}`);
  
  if (restoreBackup) {
    console.log('\n📦 --restore-backup flag detected');
    console.log('   Original data files will be restored from backup');
  }
  
  console.log('\n📝 To proceed, run with --confirm flag');
  console.log('   node server/migrations/rollback-001.js --confirm');
  
  if (!args.includes('--confirm')) {
    console.log('\n❌ Aborted (no --confirm flag)');
    process.exit(0);
  }
  
  // 执行删除
  try {
    fs.unlinkSync(materialsPath);
    console.log('   ✓ Removed claim-materials.json');
  } catch (err) {
    console.error('   ❌ Failed to remove:', err.message);
    process.exit(1);
  }
} else {
  console.log('ℹ️  claim-materials.json not found, nothing to remove');
}

// 2. 可选：从备份恢复原始数据
if (restoreBackup) {
  console.log('\n📦 Restoring from backup...');
  
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const backupFiles = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  
  for (const file of ['claim-cases', 'claim-documents']) {
    const backupFile = backupFiles.find(f => f.startsWith(file));
    if (backupFile) {
      const src = path.join(backupDir, backupFile);
      const dest = path.join(dataDir, `${file}.json`);
      try {
        fs.copyFileSync(src, dest);
        console.log(`   ✓ Restored ${file}.json from ${backupFile}`);
      } catch (err) {
        console.error(`   ❌ Failed to restore ${file}.json:`, err.message);
      }
    } else {
      console.warn(`   ⚠️  No backup found for ${file}.json`);
    }
  }
}

// 3. 删除迁移报告
const reportPath = path.join(dataDir, 'migration-report-001.json');
if (fs.existsSync(reportPath)) {
  fs.unlinkSync(reportPath);
  console.log('\n📝 Removed migration report');
}

console.log('\n✅ Rollback preparation complete!');
console.log('\n📝 Next steps:');
console.log('   1. Revert code changes if needed:');
console.log('      git checkout HEAD -- types.ts server/apiHandler.js components/ClaimCaseDetailPage.tsx');
console.log('   2. Restart the application');
console.log('\n💡 Note: Old data files (claim-cases.json, claim-documents.json) are preserved');
