/**
 * 北京医保诊疗项目CSV转JSON转换脚本
 * 将 jsonlist/北京医保诊疗项目_标准化.csv 转换为 medical-insurance-catalog.json 格式
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

interface MedicalCatalogItem {
  id: string;
  province: string;
  category: "drug" | "treatment" | "material";
  code: string;
  name: string;
  genericName?: string;
  aliases?: string[];
  dosageForm?: string;
  specifications?: string;
  type: "A" | "B" | "C" | "excluded";
  reimbursementRatio: number;
  restrictions: string;
  effectiveDate: string;
}

interface CsvRecord {
  item_code: string;
  item_name: string;
  unit: string;
  price: string;
  price_raw: string;
  description: string;
  insurance_category: string;
  is_valid: string;
  source: string;
  import_time: string;
}

/**
 * 解析CSV行，正确处理引号内的逗号
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // 转义的引号
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * 将医保类别转换为type
 */
function mapInsuranceCategory(category: string): { type: "A" | "B" | "C" | "excluded"; ratio: number } {
  switch (category.trim()) {
    case "甲":
      return { type: "A", ratio: 100 };
    case "乙":
      return { type: "B", ratio: 70 };
    case "丙":
      return { type: "C", ratio: 0 };
    case "无效":
      return { type: "excluded", ratio: 0 };
    default:
      console.warn(`⚠️ 未知的医保类别: ${category}，使用默认值"excluded"`);
      return { type: "excluded", ratio: 0 };
  }
}

/**
 * 生成唯一ID
 */
function generateId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `catalog-${timestamp}-${random}`;
}

/**
 * 读取并解析CSV文件
 */
function readCsvFile(filePath: string): CsvRecord[] {
  console.log(`📖 读取CSV文件: ${filePath}`);
  
  if (!existsSync(filePath)) {
    throw new Error(`CSV文件不存在: ${filePath}`);
  }

  // 读取文件并移除BOM头
  let content = readFileSync(filePath, "utf-8");
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.substring(1);
    console.log("✓ 已移除BOM头");
  }

  const lines = content.split("\n").filter(line => line.trim());
  console.log(`✓ 读取到 ${lines.length} 行数据（含表头）`);

  // 解析表头
  const headers = parseCsvLine(lines[0]);
  console.log(`✓ 表头字段: ${headers.join(", ")}`);

  // 解析数据行
  const records: CsvRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < headers.length) {
      console.warn(`⚠️ 第 ${i + 1} 行字段数不足，跳过`);
      continue;
    }

    const record: any = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || "";
    });
    records.push(record as CsvRecord);
  }

  console.log(`✓ 成功解析 ${records.length} 条记录`);
  return records;
}

/**
 * 转换CSV记录为JSON格式
 */
function convertRecord(record: CsvRecord): MedicalCatalogItem | null {
  // 只导入有效记录
  if (record.is_valid.trim() !== "是") {
    return null;
  }

  const { type, ratio } = mapInsuranceCategory(record.insurance_category);
  
  // 提取日期部分（从 import_time 如 "2026-03-04 20:03:19"）
  const effectiveDate = record.import_time.split(" ")[0] || "2026-03-04";

  return {
    id: generateId(),
    province: "beijing",
    category: "treatment",
    code: record.item_code.trim(),
    name: record.item_name.trim(),
    specifications: record.unit.trim(),
    type,
    reimbursementRatio: ratio,
    restrictions: record.description.trim(),
    effectiveDate,
  };
}

/**
 * 主函数
 */
function main() {
  console.log("=".repeat(60));
  console.log("北京医保诊疗项目CSV转JSON转换工具");
  console.log("=".repeat(60));
  console.log();

  const csvPath = join(process.cwd(), "jsonlist", "北京医保诊疗项目_标准化.csv");
  const jsonPath = join(process.cwd(), "jsonlist", "medical-insurance-catalog.json");

  try {
    // 1. 读取CSV文件
    const csvRecords = readCsvFile(csvPath);
    console.log();

    // 2. 转换记录
    console.log("🔄 转换记录...");
    const newRecords: MedicalCatalogItem[] = [];
    let skippedCount = 0;
    let invalidCount = 0;

    for (const record of csvRecords) {
      const converted = convertRecord(record);
      if (converted) {
        newRecords.push(converted);
      } else if (record.is_valid.trim() !== "是") {
        invalidCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`✓ 转换成功: ${newRecords.length} 条`);
    console.log(`  - 跳过无效记录: ${invalidCount} 条`);
    console.log();

    // 3. 读取现有JSON文件
    console.log("📖 读取现有JSON文件...");
    let existingRecords: MedicalCatalogItem[] = [];
    if (existsSync(jsonPath)) {
      const jsonContent = readFileSync(jsonPath, "utf-8");
      existingRecords = JSON.parse(jsonContent);
      console.log(`✓ 现有记录: ${existingRecords.length} 条`);
    } else {
      console.log("⚠️ JSON文件不存在，将创建新文件");
    }
    console.log();

    // 4. 去重并合并
    console.log("🔀 合并数据（基于code去重）...");
    const existingCodes = new Set(existingRecords.map(r => r.code));
    const uniqueNewRecords = newRecords.filter(r => {
      if (existingCodes.has(r.code)) {
        console.log(`  ⚠️ 跳过重复code: ${r.code} (${r.name})`);
        return false;
      }
      existingCodes.add(r.code);
      return true;
    });

    const mergedRecords = [...existingRecords, ...uniqueNewRecords];
    console.log(`✓ 新增记录: ${uniqueNewRecords.length} 条`);
    console.log(`✓ 合并后总记录: ${mergedRecords.length} 条`);
    console.log();

    // 5. 写入JSON文件
    console.log("💾 写入JSON文件...");
    writeFileSync(jsonPath, JSON.stringify(mergedRecords, null, 2), "utf-8");
    console.log(`✓ 文件已保存: ${jsonPath}`);
    console.log();

    // 6. 输出统计报告
    console.log("=".repeat(60));
    console.log("转换报告");
    console.log("=".repeat(60));
    console.log(`CSV总记录数:     ${csvRecords.length}`);
    console.log(`有效记录数:       ${newRecords.length}`);
    console.log(`无效记录数:       ${invalidCount}`);
    console.log(`重复code跳过:     ${newRecords.length - uniqueNewRecords.length}`);
    console.log(`新增记录数:       ${uniqueNewRecords.length}`);
    console.log(`现有记录数:       ${existingRecords.length}`);
    console.log(`合并后总记录数:   ${mergedRecords.length}`);
    console.log();

    // 7. 抽样展示
    console.log("📋 抽样数据（前3条）:");
    uniqueNewRecords.slice(0, 3).forEach((record, i) => {
      console.log(`\n  [${i + 1}] ${record.code}`);
      console.log(`      名称: ${record.name}`);
      console.log(`      类型: ${record.type} (${record.reimbursementRatio}%)`);
      console.log(`      单位: ${record.specifications}`);
      console.log(`      限制: ${record.restrictions || "(无)"}`);
    });
    console.log();
    console.log("✅ 转换完成！");

  } catch (error) {
    console.error("❌ 转换失败:", error);
    process.exit(1);
  }
}

main();
