/**
 * 费用分类服务
 * 支持医疗费用分类、社保目录匹配
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 缓存目录数据
let catalogCache = null;

/**
 * 费用类型枚举
 */
export const EXPENSE_CATEGORIES = {
  MEDICINE: { code: 'MEDICINE', name: '药品费', icon: '💊' },
  EXAMINATION: { code: 'EXAMINATION', name: '检查费', icon: '🔬' },
  TREATMENT: { code: 'TREATMENT', name: '治疗费', icon: '💉' },
  SURGERY: { code: 'SURGERY', name: '手术费', icon: '🏥' },
  HOSPITAL: { code: 'HOSPITAL', name: '住院费', icon: '🏨' },
  MATERIAL: { code: 'MATERIAL', name: '材料费', icon: '🧪' },
  OTHER: { code: 'OTHER', name: '其他', icon: '📋' },
};

/**
 * 社保类型枚举
 */
export const SOCIAL_SECURITY_TYPES = {
  CATEGORY_A: { code: 'A', name: '甲类', description: '全额纳入报销范围' },
  CATEGORY_B: { code: 'B', name: '乙类', description: '部分纳入报销范围' },
  CATEGORY_C: { code: 'C', name: '丙类/自费', description: '不纳入报销范围' },
};

/**
 * 加载医保目录配置
 */
function loadMedicalCatalog() {
  if (catalogCache) {
    return catalogCache;
  }

  const configPath = join(__dirname, '../../jsonlist/medical-insurance-catalog.json');
  if (!existsSync(configPath)) {
    console.warn('医保目录配置文件不存在');
    return { items: [] };
  }

  const content = readFileSync(configPath, 'utf-8');
  catalogCache = JSON.parse(content);
  return catalogCache;
}

/**
 * 根据名称判断费用类型
 * @param {string} itemName - 费用项目名称
 * @returns {object} 费用类型
 */
function inferExpenseCategory(itemName) {
  if (!itemName) return EXPENSE_CATEGORIES.OTHER;

  const name = itemName.toLowerCase();

  // 药品费关键词
  if (/(药|剂|丸|片|胶囊|液|素|抗生素|消炎|止痛|麻醉|激素)/.test(name)) {
    return EXPENSE_CATEGORIES.MEDICINE;
  }

  // 检查费关键词
  if (/(检查|检验|化验|透视|CT|MRI|B超|超声|心电图|脑电图|造影)/.test(name)) {
    return EXPENSE_CATEGORIES.EXAMINATION;
  }

  // 治疗费关键词
  if (/(治疗|注射|输液|输血|透析|理疗|放疗|化疗|康复|护理)/.test(name)) {
    return EXPENSE_CATEGORIES.TREATMENT;
  }

  // 手术费关键词
  if (/(手术|切除|缝合|置换|修复|植入|引流|清创|包扎)/.test(name)) {
    return EXPENSE_CATEGORIES.SURGERY;
  }

  // 住院费关键词
  if (/(住院|床位|护理|诊查|陪护|取暖|空调)/.test(name)) {
    return EXPENSE_CATEGORIES.HOSPITAL;
  }

  // 材料费关键词
  if (/(材料|导管|支架|球囊|起搏器|人工关节|人工晶体)/.test(name)) {
    return EXPENSE_CATEGORIES.MATERIAL;
  }

  return EXPENSE_CATEGORIES.OTHER;
}

/**
 * 匹配医保目录
 * @param {string} itemName - 费用项目名称
 * @param {object} catalog - 医保目录
 * @returns {object|null} 匹配到的目录项
 */
function matchMedicalCatalog(itemName, catalog) {
  if (!catalog || !catalog.items) {
    return null;
  }

  const name = itemName.trim().toLowerCase();

  // 精确匹配
  for (const item of catalog.items) {
    if (item.name && item.name.toLowerCase() === name) {
      return item;
    }
  }

  // 模糊匹配（包含关系）
  for (const item of catalog.items) {
    if (item.name && name.includes(item.name.toLowerCase())) {
      return item;
    }
  }

  return null;
}

/**
 * 判断费用是否在保障范围内
 * @param {string} itemName - 费用项目名称
 * @param {string} category - 费用类型（可选）
 * @param {object} exclusions - 排除目录（可选）
 * @returns {object} 判断结果
 */
function isCovered(itemName, category = null, exclusions = []) {
  // 丙类/自费项目不在保障范围
  const result = {
    isCovered: true,
    reason: '',
    socialSecurityType: SOCIAL_SECURITY_TYPES.CATEGORY_A,
    reimbursementRatio: 1.0,
  };

  // 检查排除目录
  for (const exclusion of exclusions) {
    if (itemName.includes(exclusion)) {
      result.isCovered = false;
      result.reason = `排除项目: ${exclusion}`;
      result.socialSecurityType = SOCIAL_SECURITY_TYPES.CATEGORY_C;
      result.reimbursementRatio = 0;
      return result;
    }
  }

  return result;
}

/**
 * 分类费用项目
 * @param {object} params - 分类参数
 * @param {string} params.itemName - 费用项目名称
 * @param {string} params.category - 手动指定费用类型（可选）
 * @param {number} params.amount - 费用金额
 * @param {Array} params.exclusions - 排除目录（可选）
 * @returns {object} 分类结果
 *
 * @example
 * const result = classify({
 *   itemName: '阿莫西林胶囊',
 *   amount: 45.50
 * });
 *
 * // 返回:
 * // {
 * //   itemName: '阿莫西林胶囊',
 * //   category: { code: 'MEDICINE', name: '药品费', icon: '💊' },
 * //   socialSecurityType: { code: 'A', name: '甲类', description: '全额纳入报销范围' },
 * //   isCovered: true,
 * //   reimbursementRatio: 1.0,
 * //   amount: 45.50,
 * //   approvedAmount: 45.50,
 * //   reasoning: '匹配药品费，甲类全额纳入报销'
 * // }
 */
export function classify(params = {}) {
  const {
    itemName = '',
    category = null,
    amount = 0,
    exclusions = [],
  } = params;

  // 1. 推断费用类型
  const expenseCategory = category ? EXPENSE_CATEGORIES[category] : inferExpenseCategory(itemName);

  // 2. 加载医保目录
  const catalog = loadMedicalCatalog();
  const catalogMatch = matchMedicalCatalog(itemName, catalog);

  // 3. 判断社保类型
  let socialSecurityType = SOCIAL_SECURITY_TYPES.CATEGORY_C; // 默认丙类
  let reimbursementRatio = 0;

  if (catalogMatch) {
    if (catalogMatch.category === 'A') {
      socialSecurityType = SOCIAL_SECURITY_TYPES.CATEGORY_A;
      reimbursementRatio = 1.0;
    } else if (catalogMatch.category === 'B') {
      socialSecurityType = SOCIAL_SECURITY_TYPES.CATEGORY_B;
      reimbursementRatio = 0.8; // 乙类默认80%
    } else if (catalogMatch.category === 'C') {
      socialSecurityType = SOCIAL_SECURITY_TYPES.CATEGORY_C;
      reimbursementRatio = 0;
    }
  } else {
    // 目录未匹配，根据名称推断
    // 常见药品甲类较多，默认甲类
    socialSecurityType = SOCIAL_SECURITY_TYPES.CATEGORY_A;
    reimbursementRatio = 1.0;
  }

  // 4. 判断保障范围
  const coverageResult = isCovered(itemName, expenseCategory.code, exclusions);

  // 5. 计算核准金额
  const approvedAmount = coverageResult.isCovered
    ? amount * reimbursementRatio
    : 0;

  // 6. 生成推理说明
  const reasoningParts = [];
  reasoningParts.push(`归类为${expenseCategory.name}`);
  reasoningParts.push(`社保${socialSecurityType.name}，报销比例${reimbursementRatio * 100}%`);

  if (!coverageResult.isCovered) {
    reasoningParts.push(`不在保障范围: ${coverageResult.reason}`);
  }

  return {
    itemName,
    category: expenseCategory,
    socialSecurityType,
    catalogMatch,
    isCovered: coverageResult.isCovered,
    reimbursementRatio: reimbursementRatio,
    amount,
    approvedAmount: Number(approvedAmount.toFixed(2)),
    reasoning: reasoningParts.join('，'),
  };
}

/**
 * 批量分类费用项目
 * @param {Array} items - 费用项目列表
 * @param {object} options - 选项
 * @returns {object} 批量分类结果
 */
export function batchClassify(items, options = {}) {
  const { exclusions = [] } = options;

  const results = [];
  let totalAmount = 0;
  let totalApproved = 0;
  const categorySummary = {};

  for (const item of items) {
    const result = classify({ ...item, exclusions });
    results.push(result);

    totalAmount += item.amount || 0;
    totalApproved += result.approvedAmount;

    // 分类汇总
    const catCode = result.category.code;
    if (!categorySummary[catCode]) {
      categorySummary[catCode] = {
        ...result.category,
        amount: 0,
        approvedAmount: 0,
        count: 0,
      };
    }
    categorySummary[catCode].amount += item.amount || 0;
    categorySummary[catCode].approvedAmount += result.approvedAmount;
    categorySummary[catCode].count += 1;
  }

  return {
    items: results,
    summary: {
      totalAmount: Number(totalAmount.toFixed(2)),
      totalApproved: Number(totalApproved.toFixed(2)),
      approvedRatio: totalAmount > 0 ? (totalApproved / totalAmount).toFixed(2) : 0,
      categorySummary: Object.values(categorySummary),
    },
  };
}

/**
 * 获取所有费用类型
 * @returns {Array} 费用类型列表
 */
export function getExpenseCategories() {
  return Object.values(EXPENSE_CATEGORIES);
}

/**
 * 获取所有社保类型
 * @returns {Array} 社保类型列表
 */
export function getSocialSecurityTypes() {
  return Object.values(SOCIAL_SECURITY_TYPES);
}

/**
 * 清空目录缓存
 */
export function clearCatalogCache() {
  catalogCache = null;
}

export default {
  classify,
  batchClassify,
  getExpenseCategories,
  getSocialSecurityTypes,
  clearCatalogCache,
};
