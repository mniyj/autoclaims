import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const provinceMap = {
  '北京': 'beijing',
  '天津': 'tianjin',
  '河北': 'hebei',
  '山西': 'shanxi',
  '内蒙古': 'neimenggu',
  '辽宁': 'liaoning',
  '吉林': 'jilin',
  '黑龙江': 'heilongjiang',
  '上海': 'shanghai',
  '江苏': 'jiangsu',
  '浙江': 'zhejiang',
  '安徽': 'anhui',
  '福建': 'fujian',
  '江西': 'jiangxi',
  '山东': 'shandong',
  '河南': 'henan',
  '湖北': 'hubei',
  '湖南': 'hunan',
  '广东': 'guangdong',
  '广西': 'guangxi',
  '海南': 'hainan',
  '重庆': 'chongqing',
  '四川': 'sichuan',
  '贵州': 'guizhou',
  '云南': 'yunnan',
  '西藏': 'xizang',
  '陕西': 'shaanxi',
  '甘肃': 'gansu',
  '青海': 'qinghai',
  '宁夏': 'ningxia',
  '新疆': 'xinjiang'
};

function isQualifiedForInsurance(level) {
  if (!level) return false;
  if (level.includes('三级')) return true;
  if (level.includes('二级甲等')) return true;
  return false;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function generateId(index) {
  return `hosp-${Date.now()}-${index}`;
}

function convertCSVToHospitalInfo(csvPath, outputPath) {
  console.log(`读取 CSV 文件: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const content = csvContent.replace(/^\uFEFF/, '');
  const lines = content.split('\n').filter(line => line.trim());
  console.log(`总共 ${lines.length} 行数据（含标题）`);
  
  const headers = parseCSVLine(lines[0]);
  console.log('CSV 字段:', headers);
  
  const hospitals = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    if (values.length < 6) {
      console.warn(`跳过无效行 ${i}: ${lines[i]}`);
      continue;
    }
    
    const [name, province, city, level, isPublic, address] = values;
    if (!name) continue;
    
    const provinceCode = provinceMap[province] || province.toLowerCase();
    const type = isPublic === '是' ? '公立' : '民营';
    
    hospitals.push({
      id: generateId(i),
      name: name.trim(),
      province: provinceCode,
      city: city ? city.trim() : '',
      level: level ? level.trim() : '',
      type: type,
      address: address ? address.trim() : '',
      qualifiedForInsurance: isQualifiedForInsurance(level)
    });
  }
  
  console.log(`成功解析 ${hospitals.length} 家医院`);
  fs.writeFileSync(outputPath, JSON.stringify(hospitals, null, 2), 'utf-8');
  console.log(`已写入文件: ${outputPath}`);
  
  const stats = {
    total: hospitals.length,
    byProvince: {},
    byLevel: {},
    qualified: 0
  };
  
  hospitals.forEach(h => {
    stats.byProvince[h.province] = (stats.byProvince[h.province] || 0) + 1;
    stats.byLevel[h.level] = (stats.byLevel[h.level] || 0) + 1;
    if (h.qualifiedForInsurance) {
      stats.qualified++;
    }
  });
  
  console.log('\n统计信息:');
  console.log(`- 总计: ${stats.total} 家医院`);
  console.log(`- 符合保险条件: ${stats.qualified} 家`);
  console.log('- 按省份分布:', stats.byProvince);
  console.log('- 按等级分布:', stats.byLevel);
  
  return hospitals;
}

function main() {
  const jsonlistDir = path.join(__dirname, '..', 'jsonlist');
  const csvPath = path.join(jsonlistDir, '中国大陆医院名录_31省.csv');
  const outputPath = path.join(jsonlistDir, 'hospital-info-new.json');
  
  const originalPath = path.join(jsonlistDir, 'hospital-info.json');
  const backupPath = path.join(jsonlistDir, `hospital-info-backup-${Date.now()}.json`);
  
  if (fs.existsSync(originalPath)) {
    fs.copyFileSync(originalPath, backupPath);
    console.log(`已备份原文件到: ${backupPath}`);
  }
  
  const hospitals = convertCSVToHospitalInfo(csvPath, outputPath);
  
  fs.copyFileSync(outputPath, originalPath);
  console.log(`\n已更新原文件: ${originalPath}`);
  console.log('\n导入完成！');
}

main();
