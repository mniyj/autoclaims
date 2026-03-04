/**
 * 数据迁移脚本
 * 为现有材料数据添加新字段（category, processingStrategy, extractionConfig）
 * 
 * 使用方法:
 *   npx ts-node scripts/migrate-materials.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../jsonlist/claims-materials.json');

// 材料类型映射规则
const MATERIAL_TYPE_MAPPING: Record<string, { category: string; processingStrategy: string }> = {
  // 身份材料 (mat-1 ~ mat-7)
  'mat-1': { category: 'identity', processingStrategy: 'structured_doc' },
  'mat-2': { category: 'identity', processingStrategy: 'structured_doc' },
  'mat-3': { category: 'identity', processingStrategy: 'structured_doc' },
  'mat-4': { category: 'identity', processingStrategy: 'structured_doc' },
  'mat-5': { category: 'identity', processingStrategy: 'general_doc' },
  'mat-6': { category: 'identity', processingStrategy: 'structured_doc' },
  'mat-7': { category: 'identity', processingStrategy: 'structured_doc' },

  // 事故材料 (mat-8 ~ mat-10)
  'mat-8': { category: 'accident', processingStrategy: 'general_doc' },
  'mat-9': { category: 'accident', processingStrategy: 'general_doc' },
  'mat-10': { category: 'accident', processingStrategy: 'general_doc' },

  // 医疗材料 (mat-11 ~ mat-19)
  'mat-11': { category: 'medical', processingStrategy: 'structured_doc' },
  'mat-12': { category: 'medical', processingStrategy: 'structured_doc' },
  'mat-13': { category: 'medical', processingStrategy: 'structured_doc' },
  'mat-14': { category: 'medical', processingStrategy: 'structured_doc' },
  'mat-15': { category: 'medical', processingStrategy: 'structured_doc' },
  'mat-16': { category: 'medical', processingStrategy: 'structured_doc' },
  'mat-17': { category: 'medical', processingStrategy: 'structured_doc' },
  'mat-18': { category: 'medical', processingStrategy: 'structured_doc' },
  'mat-19': { category: 'medical', processingStrategy: 'structured_doc' },

  // 发票类 (mat-20 ~ mat-28)
  'mat-20': { category: 'medical', processingStrategy: 'invoice' },
  'mat-21': { category: 'medical', processingStrategy: 'invoice' },
  'mat-22': { category: 'medical', processingStrategy: 'invoice' },
  'mat-23': { category: 'medical', processingStrategy: 'invoice' },
  'mat-24': { category: 'medical', processingStrategy: 'invoice' },
  'mat-25': { category: 'medical', processingStrategy: 'structured_doc' },
  'mat-26': { category: 'medical', processingStrategy: 'invoice' },
  'mat-27': { category: 'medical', processingStrategy: 'invoice' },
  'mat-28': { category: 'medical', processingStrategy: 'invoice' },

  // 收入材料 (mat-29 ~ mat-34)
  'mat-29': { category: 'income', processingStrategy: 'general_doc' },
  'mat-30': { category: 'income', processingStrategy: 'general_doc' },
  'mat-31': { category: 'income', processingStrategy: 'structured_doc' },
  'mat-32': { category: 'income', processingStrategy: 'structured_doc' },
  'mat-33': { category: 'income', processingStrategy: 'general_doc' },
  'mat-34': { category: 'income', processingStrategy: 'general_doc' },

  // 鉴定类 (mat-35 ~ mat-38)
  'mat-35': { category: 'medical', processingStrategy: 'structured_doc' },
  'mat-36': { category: 'medical', processingStrategy: 'structured_doc' },
  'mat-37': { category: 'medical', processingStrategy: 'structured_doc' },
  'mat-38': { category: 'medical', processingStrategy: 'structured_doc' },

  // 居住与扶养类 (mat-39 ~ mat-42)
  'mat-39': { category: 'other', processingStrategy: 'structured_doc' },
  'mat-40': { category: 'other', processingStrategy: 'structured_doc' },
  'mat-41': { category: 'other', processingStrategy: 'general_doc' },
  'mat-42': { category: 'other', processingStrategy: 'general_doc' },

  // 死亡及法律类 (mat-43 ~ mat-47)
  'mat-43': { category: 'other', processingStrategy: 'structured_doc' },
  'mat-44': { category: 'other', processingStrategy: 'structured_doc' },
  'mat-45': { category: 'other', processingStrategy: 'general_doc' },
  'mat-46': { category: 'other', processingStrategy: 'structured_doc' },
  'mat-47': { category: 'other', processingStrategy: 'structured_doc' },
};

interface ClaimsMaterial {
  id: string;
  name: string;
  description?: string;
  jsonSchema: string;
  aiAuditPrompt?: string;
  required?: boolean;
  sampleUrl?: string;
  ossKey?: string;
  confidenceThreshold?: number;
  // 新增字段
  category?: string;
  processingStrategy?: string;
  extractionConfig?: {
    jsonSchema: string;
    aiAuditPrompt: string;
    validationRules?: any[];
  };
}

function migrateMaterials() {
  console.log('开始迁移材料数据...');

  // 读取现有数据
  if (!fs.existsSync(DATA_FILE)) {
    console.error('数据文件不存在:', DATA_FILE);
    process.exit(1);
  }

  const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
  const materials: ClaimsMaterial[] = JSON.parse(rawData);

  console.log(`找到 ${materials.length} 条材料记录`);

  // 迁移数据
  const migratedMaterials = materials.map((material) => {
    const mapping = MATERIAL_TYPE_MAPPING[material.id];
    
    if (!mapping) {
      console.warn(`未找到映射规则: ${material.id} - ${material.name}`);
      return material;
    }

    return {
      ...material,
      category: mapping.category,
      processingStrategy: mapping.processingStrategy,
      extractionConfig: {
        jsonSchema: material.jsonSchema,
        aiAuditPrompt: material.aiAuditPrompt || '',
        validationRules: [],
      },
    };
  });

  // 验证迁移结果
  const migratedCount = migratedMaterials.filter(m => m.category).length;
  console.log(`成功迁移 ${migratedCount}/${materials.length} 条记录`);

  // 备份原文件
  const backupFile = `${DATA_FILE}.backup.${Date.now()}`;
  fs.copyFileSync(DATA_FILE, backupFile);
  console.log(`已备份原文件到: ${backupFile}`);

  // 写入新数据
  fs.writeFileSync(DATA_FILE, JSON.stringify(migratedMaterials, null, 2), 'utf-8');
  console.log('迁移完成！');

  // 统计信息
  const categoryStats = migratedMaterials.reduce((acc, m) => {
    if (m.category) {
      acc[m.category] = (acc[m.category] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  console.log('\n分类统计:');
  Object.entries(categoryStats).forEach(([category, count]) => {
    console.log(`  ${category}: ${count}`);
  });

  console.log('\n策略统计:');
  const strategyStats = migratedMaterials.reduce((acc, m) => {
    if (m.processingStrategy) {
      acc[m.processingStrategy] = (acc[m.processingStrategy] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  Object.entries(strategyStats).forEach(([strategy, count]) => {
    console.log(`  ${strategy}: ${count}`);
  });
}

// 执行迁移
migrateMaterials();
