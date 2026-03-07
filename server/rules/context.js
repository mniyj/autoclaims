import { readData } from '../utils/fileStore.js';

const COVERAGE_CODE_ALIASES = {
  ACC_DISABILITY: ['ACC_DEATH_DISAB'],
  ACC_DEATH: ['ACC_DEATH_DISAB'],
  HLT_INPATIENT: ['HEALTH_MEDICAL']
};

function toDateOnly(value) {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().split('T')[0];
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeClaimContext(claimCase = {}, ocrData = {}, invoiceItems = []) {
  const normalized = {
    ...claimCase,
    ...ocrData
  };

  normalized.accident_date = toDateOnly(
    ocrData.accident_date ||
    ocrData.accidentDate ||
    claimCase.accident_date ||
    claimCase.accidentDate ||
    claimCase.accidentTime
  );

  normalized.report_time = toDateOnly(
    ocrData.report_time ||
    ocrData.reportTime ||
    claimCase.report_time ||
    claimCase.reportTime
  );

  normalized.claimed_amount =
    toNumber(
      ocrData.claimed_amount ||
      ocrData.totalAmount ||
      claimCase.claimed_amount ||
      claimCase.claimAmount
    ) || 0;

  normalized.accident_reason =
    ocrData.accident_reason ||
    ocrData.accidentReason ||
    claimCase.accident_reason ||
    claimCase.accidentReason;

  normalized.expense_items = invoiceItems.length > 0 ? invoiceItems : (ocrData.chargeItems || []);
  normalized.total_claimed_amount = calculateTotalAmount(normalized.expense_items);

  normalized.disability_grade =
    ocrData.disability_grade ??
    ocrData.disabilityGrade ??
    claimCase.disability_grade ??
    claimCase.disabilityGrade ??
    null;

  normalized.death_confirmed = Boolean(
    ocrData.death_confirmed ||
    ocrData.deathConfirmed ||
    claimCase.death_confirmed ||
    claimCase.deathConfirmed
  );

  normalized.hospital_days =
    toNumber(
      ocrData.hospital_days ||
      ocrData.hospitalDays ||
      claimCase.hospital_days ||
      claimCase.hospitalDays
    ) || 0;

  return normalized;
}


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

  // 从 OCR 数据提取关键字段
  if (ocrData.basicInfo) {
    claimContext.patient_name = ocrData.basicInfo.name;
    claimContext.patient_gender = ocrData.basicInfo.gender;
    claimContext.admission_date = toDateOnly(ocrData.basicInfo.admissionDate);
    claimContext.discharge_date = toDateOnly(ocrData.basicInfo.dischargeDate);
    claimContext.diagnosis = ocrData.basicInfo.dischargeDiagnosis;
    claimContext.department = ocrData.basicInfo.department;
  }

  if (ocrData.invoiceInfo) {
    claimContext.hospital_name = ocrData.invoiceInfo.hospitalName;
    claimContext.invoice_date = toDateOnly(ocrData.invoiceInfo.issueDate);
  }

  if (ocrData.insurancePayment) {
    claimContext.social_insurance_paid = ocrData.insurancePayment.governmentFundPayment || 0;
    claimContext.personal_payment = ocrData.insurancePayment.personalPayment || 0;
    claimContext.personal_self_pay = ocrData.insurancePayment.personalSelfPayment || 0;
    claimContext.personal_self_expense = ocrData.insurancePayment.personalSelfExpense || 0;
  }

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
 * 计算费用明细总金额
 * @param {object[]} items - 费用明细
 * @returns {number} 总金额
 */
function calculateTotalAmount(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const amount = item.totalPrice || item.amount || item.total || 0;
    return sum + Number(amount);
  }, 0);
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
