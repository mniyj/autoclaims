import { readData } from '../utils/fileStore.js';
import { normalizeClaimContext } from '../claims/normalizers/claimNormalizer.js';

const COVERAGE_CODE_ALIASES = {
  ACC_DISABILITY: ['ACC_DEATH_DISAB'],
  ACC_DEATH: ['ACC_DEATH_DISAB'],
  HLT_INPATIENT: ['HEALTH_MEDICAL']
};


/**
 * 根据案件ID获取案件数据
 * @param {string} claimCaseId - 案件ID
 * @returns {object|null} 案件数据
 */
export function getClaimCase(claimCaseId) {
  const claimCases = readData('claim-cases');
  return claimCases.find(c => c.id === claimCaseId || c.reportNumber === claimCaseId) || null;
}

/**
 * 根据产品代码获取产品数据
 * @param {string} productCode - 产品代码
 * @returns {object|null} 产品数据
 */
export function getProduct(productCode) {
  const products = readData('products');
  return products.find(p => p.productCode === productCode) || null;
}

/**
 * 根据产品代码获取规则集
 * @param {string} productCode - 产品代码
 * @returns {object|null} 规则集
 */
export function getRuleset(productCode) {
  const rulesets = readData('rulesets');
  return rulesets.find(r => r.policy_info?.product_code === productCode) || rulesets[0] || null;
}

/**
 * 获取医保目录数据
 * @returns {object[]} 医保目录
 */
export function getMedicalCatalog() {
  return readData('medical-insurance-catalog');
}

/**
 * 获取医院信息
 * @param {string} hospitalName - 医院名称
 * @returns {object|null} 医院信息
 */
export function getHospitalInfo(hospitalName) {
  const hospitals = readData('hospital-info');
  return hospitals.find(h => h.name === hospitalName || h.name?.includes(hospitalName)) || null;
}

/**
 * 构建完整的执行上下文
 * @param {object} params - 参数
 * @param {string} params.claimCaseId - 案件ID
 * @param {string} params.productCode - 产品代码（可选，从案件获取）
 * @param {object} params.ocrData - OCR提取的数据
 * @param {object[]} params.invoiceItems - 发票费用明细
 * @returns {object} 执行上下文
 */
export function buildContext({ claimCaseId, productCode, ocrData = {}, invoiceItems = [] }) {
  // 获取案件数据
  const claimCase = getClaimCase(claimCaseId);
  if (!claimCase && !productCode) {
    throw new Error(`未找到案件: ${claimCaseId}`);
  }

  // 确定产品代码
  const effectiveProductCode = productCode || claimCase?.productCode;

  // 获取产品和规则集
  const product = effectiveProductCode ? getProduct(effectiveProductCode) : null;
  const ruleset = effectiveProductCode ? getRuleset(effectiveProductCode) : null;

  // 构建保单上下文（从规则集的policy_info获取）
  const policyInfo = ruleset?.policy_info || {};

  // 构建理赔上下文
  const claimContext = normalizeClaimContext(claimCase, ocrData, invoiceItems);

  // 构建完整上下文
  const context = {
    // 理赔数据
    claim: claimContext,

    // 保单数据
    policy: {
      policy_no: policyInfo.policy_no,
      product_code: policyInfo.product_code,
      product_name: policyInfo.product_name,
      insurer: policyInfo.insurer,
      effective_date: policyInfo.effective_date,
      expiry_date: policyInfo.expiry_date,
      coverages: policyInfo.coverages || [],
      // 产品详情
      ...product
    },

    vehicle: claimContext.vehicle || policyInfo.insured_subject?.vehicle || null,

    // 规则集元数据
    ruleset: {
      ruleset_id: ruleset?.ruleset_id,
      product_line: ruleset?.product_line,
      rules: ruleset?.rules || []
    },

    // 辅助数据
    medical_catalog: getMedicalCatalog(),

    // 当前时间（用于时间比较）
    now: new Date().toISOString().split('T')[0]
  };

  // 如果有医院名称，补充医院信息
  if (claimContext.hospital_name) {
    context.hospital = getHospitalInfo(claimContext.hospital_name);
  }

  return context;
}

/**
 * 获取保障项目配置
 * @param {string} productCode - 产品代码
 * @param {string} coverageCode - 保障代码
 * @returns {object|null} 保障配置
 */
export function getCoverageConfig(productCode, coverageCode) {
  const ruleset = getRuleset(productCode);
  if (!ruleset?.policy_info?.coverages) return null;

  const coverages = ruleset.policy_info.coverages;
  const exactMatch = coverages.find(c => c.coverage_code === coverageCode);
  if (exactMatch) return exactMatch;

  const aliases = COVERAGE_CODE_ALIASES[coverageCode] || [];
  for (const alias of aliases) {
    const aliasMatch = coverages.find(c => c.coverage_code === alias);
    if (aliasMatch) return aliasMatch;
  }

  return coverages.find(c => c.coverage_code?.includes(coverageCode) || coverageCode?.includes(c.coverage_code)) || null;
}

/**
 * 检查药品是否在医保目录内
 * @param {string} drugName - 药品名称
 * @returns {object|null} 目录信息
 */
export function checkMedicalCatalog(drugName) {
  const catalog = getMedicalCatalog();
  return catalog.find(item =>
    item.name === drugName ||
    item.name?.includes(drugName) ||
    drugName?.includes(item.name)
  ) || null;
}
