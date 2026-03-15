/**
 * 多文件联合分析服务
 * 实现跨文件数据交叉验证和材料完整性检查
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeMaterialValidationRules } from './materialValidationEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const dataDir = path.join(projectRoot, 'jsonlist');

const getGeminiApiKey = () => process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.API_KEY;

const MATERIAL_ID_ALIASES = {
  'case_initial_report': ['mat-51'],
  'case_public_adjuster_report': ['mat-52'],
  'mat-51': ['case_initial_report'],
  'mat-52': ['case_public_adjuster_report']
};

// ============================================================================
// 交叉验证规则
// ============================================================================

/**
 * 验证金额一致性
 * @param {Array} documents - 解析后的文档列表
 * @returns {object} 验证结果
 */
export function validateAmountConsistency(documents) {
  const results = [];

  // 查找发票和费用清单
  const invoices = documents.filter(d =>
    d.fileType === 'image_invoice' ||
    d.fileType === 'pdf_invoice'
  );
  const expenseLists = documents.filter(d =>
    d.fileType === 'excel_expense' ||
    d.structuredData?.data
  );

  for (const invoice of invoices) {
    const invoiceTotal = invoice.ocrData?.totalAmount ||
                         invoice.structuredData?.totalAmount ||
                         0;

    // 查找对应的费用清单
    for (const expenseList of expenseLists) {
      const expenseTotal = calculateExpenseTotal(expenseList);

      if (expenseTotal > 0 && invoiceTotal > 0) {
        const difference = Math.abs(invoiceTotal - expenseTotal);
        const percentDiff = (difference / Math.max(invoiceTotal, expenseTotal)) * 100;

        results.push({
          type: 'amount_consistency',
          passed: percentDiff < 5, // 5% 容差
          severity: percentDiff < 5 ? 'info' : (percentDiff < 10 ? 'warning' : 'error'),
          message: `发票金额 ¥${invoiceTotal} vs 费用清单 ¥${expenseTotal}`,
          details: {
            invoiceDocumentId: invoice.documentId,
            expenseDocumentId: expenseList.documentId,
            invoiceTotal,
            expenseTotal,
            difference,
            percentDiff: percentDiff.toFixed(2),
          },
        });
      }
    }
  }

  return results;
}

/**
 * 计算费用清单总额
 */
function calculateExpenseTotal(document) {
  const data = document.structuredData?.data || [];
  if (!Array.isArray(data) || data.length === 0) return 0;

  // 尝试找到金额列
  let total = 0;
  for (const row of data) {
    if (Array.isArray(row)) {
      // 数组格式，假设最后一列是金额
      const lastValue = parseFloat(row[row.length - 1]);
      if (!isNaN(lastValue)) total += lastValue;
    } else if (typeof row === 'object') {
      // 对象格式，查找金额字段
      const amountFields = ['金额', 'amount', '费用', 'cost', '总价', 'total'];
      for (const field of amountFields) {
        if (row[field] !== undefined) {
          const value = parseFloat(row[field]);
          if (!isNaN(value)) total += value;
          break;
        }
      }
    }
  }

  return total;
}

/**
 * 验证日期一致性
 * @param {Array} documents - 解析后的文档列表
 * @returns {Array} 验证结果
 */
export function validateDateConsistency(documents) {
  const results = [];

  // 收集所有日期信息
  const dateInfo = [];

  for (const doc of documents) {
    const data = doc.ocrData || doc.structuredData || {};
    const docDates = {
      documentId: doc.documentId,
      fileName: doc.fileName,
      admissionDate: data.admissionDate || data.入院日期,
      dischargeDate: data.dischargeDate || data.出院日期,
      invoiceDate: data.invoiceDate || data.开票日期 || data.日期,
      accidentDate: data.accidentDate || data.事故日期,
      diagnosisDate: data.diagnosisDate || data.诊断日期,
    };

    // 过滤有效日期
    Object.keys(docDates).forEach(key => {
      if (key !== 'documentId' && key !== 'fileName' && docDates[key]) {
        dateInfo.push({
          documentId: doc.documentId,
          fileName: doc.fileName,
          field: key,
          date: docDates[key],
        });
      }
    });
  }

  // 检查日期逻辑
  // 1. 入院日期应该在出院日期之前
  // 2. 事故日期应该在就诊日期之前
  // 3. 所有日期应该合理（不能是未来日期）

  const now = new Date();

  for (const info of dateInfo) {
    const date = new Date(info.date);

    // 检查是否为未来日期
    if (date > now) {
      results.push({
        type: 'date_consistency',
        passed: false,
        severity: 'error',
        message: `文档 ${info.fileName} 中存在未来日期: ${info.date}`,
        details: {
          documentId: info.documentId,
          field: info.field,
          date: info.date,
        },
      });
    }
  }

  // 检查入院/出院日期顺序
  const admissionDocs = dateInfo.filter(d => d.field === 'admissionDate');
  const dischargeDocs = dateInfo.filter(d => d.field === 'dischargeDate');

  for (const admission of admissionDocs) {
    for (const discharge of dischargeDocs) {
      const admissionDate = new Date(admission.date);
      const dischargeDate = new Date(discharge.date);

      if (admissionDate > dischargeDate) {
        results.push({
          type: 'date_consistency',
          passed: false,
          severity: 'error',
          message: `入院日期(${admission.date}) 晚于 出院日期(${discharge.date})`,
          details: {
            admissionDocumentId: admission.documentId,
            dischargeDocumentId: discharge.documentId,
            admissionDate: admission.date,
            dischargeDate: discharge.date,
          },
        });
      } else {
        results.push({
          type: 'date_consistency',
          passed: true,
          severity: 'info',
          message: `住院日期范围: ${admission.date} ~ ${discharge.date}`,
          details: {
            admissionDocumentId: admission.documentId,
            dischargeDocumentId: discharge.documentId,
            admissionDate: admission.date,
            dischargeDate: discharge.date,
            hospitalDays: Math.ceil((dischargeDate - admissionDate) / (1000 * 60 * 60 * 24)),
          },
        });
      }
    }
  }

  return results;
}

/**
 * 验证身份一致性
 * @param {Array} documents - 解析后的文档列表
 * @returns {Array} 验证结果
 */
export function validateIdentityConsistency(documents) {
  const results = [];

  // 收集所有姓名信息
  const names = new Map();

  for (const doc of documents) {
    const data = doc.ocrData || doc.structuredData || {};
    const name = data.patientName || data.姓名 || data.name || data.patient;

    if (name) {
      if (!names.has(name)) {
        names.set(name, []);
      }
      names.get(name).push({
        documentId: doc.documentId,
        fileName: doc.fileName,
        source: doc.fileType,
      });
    }
  }

  // 检查姓名一致性
  if (names.size > 1) {
    const nameList = Array.from(names.keys());
    results.push({
      type: 'identity',
      passed: false,
      severity: 'warning',
      message: `发现多个不同的姓名: ${nameList.join(', ')}`,
      details: {
        names: nameList,
        occurrences: Array.from(names.entries()).map(([name, docs]) => ({
          name,
          documents: docs,
        })),
      },
    });
  } else if (names.size === 1) {
    const [name, docs] = Array.from(names.entries())[0];
    results.push({
      type: 'identity',
      passed: true,
      severity: 'info',
      message: `所有文档姓名一致: ${name}`,
      details: {
        name,
        documentCount: docs.length,
      },
    });
  }

  return results;
}

/**
 * 验证时间线合理性
 * @param {Array} documents - 解析后的文档列表
 * @param {object} context - 上下文信息（如报案时间）
 * @returns {Array} 验证结果
 */
export function validateTimeline(documents, context = {}) {
  const results = [];

  // 收集所有带时间戳的事件
  const events = [];

  for (const doc of documents) {
    const data = doc.ocrData || doc.structuredData || {};

    // 事故时间
    if (data.accidentTime || data.事故时间) {
      events.push({
        type: 'accident',
        time: new Date(data.accidentTime || data.事故时间),
        documentId: doc.documentId,
      });
    }

    // 就诊时间
    if (data.admissionDate || data.入院日期) {
      events.push({
        type: 'hospital_admission',
        time: new Date(data.admissionDate || data.入院日期),
        documentId: doc.documentId,
      });
    }

    // 发票时间
    if (data.invoiceDate || data.开票日期) {
      events.push({
        type: 'invoice',
        time: new Date(data.invoiceDate || data.开票日期),
        documentId: doc.documentId,
      });
    }
  }

  // 添加报案时间
  if (context.reportTime) {
    events.push({
      type: 'report',
      time: new Date(context.reportTime),
      documentId: 'system',
    });
  }

  // 按时间排序
  events.sort((a, b) => a.time - b.time);

  // 验证时间线合理性
  const expectedOrder = ['accident', 'hospital_admission', 'invoice', 'report'];
  let lastExpectedIndex = -1;

  for (const event of events) {
    const expectedIndex = expectedOrder.indexOf(event.type);
    if (expectedIndex !== -1 && expectedIndex < lastExpectedIndex) {
      results.push({
        type: 'timeline',
        passed: false,
        severity: 'warning',
        message: `时间线异常: ${event.type} 发生在预期之后`,
        details: {
          eventType: event.type,
          eventTime: event.time.toISOString(),
          expectedOrder,
          actualOrder: events.map(e => e.type),
        },
      });
    }
    lastExpectedIndex = Math.max(lastExpectedIndex, expectedIndex);
  }

  if (results.length === 0 && events.length > 1) {
    results.push({
      type: 'timeline',
      passed: true,
      severity: 'info',
      message: '时间线验证通过',
      details: {
        events: events.map(e => ({
          type: e.type,
          time: e.time.toISOString(),
        })),
      },
    });
  }

  return results;
}

// ============================================================================
// 材料完整性检查
// ============================================================================

/**
 * 检查材料完整性
 * @param {Array} documents - 已上传的文档列表
 * @param {string} productCode - 产品代码
 * @param {object} claimInfo - 理赔信息
 * @returns {Promise<object>}
 */
export async function checkDocumentCompleteness(documents, productCode, claimInfo = {}) {
  // 读取产品理赔配置
  const configsPath = path.join(dataDir, 'product-claim-configs.json');
  let requiredMaterials = [];
  let optionalMaterials = [];

  try {
    if (fs.existsSync(configsPath)) {
      const configs = JSON.parse(fs.readFileSync(configsPath, 'utf-8'));
      const productConfig = configs.find(c => c.productCode === productCode);

      if (productConfig) {
        // 从配置中提取必需材料
        for (const respConfig of productConfig.responsibilityConfigs || []) {
          requiredMaterials.push(...(respConfig.claimItemIds || []));
        }
      }
    }
  } catch (error) {
    console.error('[multiFileAnalyzer] Error loading product config:', error);
  }

  // 如果没有配置，使用默认规则
  if (requiredMaterials.length === 0) {
    requiredMaterials = getDefaultRequiredMaterials(claimInfo);
    optionalMaterials = getDefaultOptionalMaterials(claimInfo);
  }

  // 已提供的材料类型与已识别材料ID
  const providedTypes = new Set(documents.map(d => d.fileType).filter(Boolean));
  const providedMaterialIds = new Set(
    documents
      .map(d => d.classification?.materialId)
      .filter(Boolean)
  );
  for (const materialId of Array.from(providedMaterialIds)) {
    for (const alias of MATERIAL_ID_ALIASES[materialId] || []) {
      providedMaterialIds.add(alias);
    }
  }

  // 检查缺失材料
  const missingMaterials = requiredMaterials.filter(
    materialId => !providedTypes.has(materialId) && !providedMaterialIds.has(materialId)
  );

  // 计算完整度评分
  const completenessScore = requiredMaterials.length > 0
    ? Math.round(((requiredMaterials.length - missingMaterials.length) / requiredMaterials.length) * 100)
    : 100;

  return {
    isComplete: missingMaterials.length === 0,
    completenessScore,
    requiredMaterials,
    providedMaterials: Array.from(new Set([...providedTypes, ...providedMaterialIds])),
    missingMaterials,
    optionalMaterials,
    warnings: missingMaterials.length > 0
      ? [`缺少以下材料: ${missingMaterials.join(', ')}`]
      : [],
  };
}

/**
 * 获取默认必需材料
 */
function getDefaultRequiredMaterials(claimInfo) {
  const materials = ['image_invoice']; // 发票是必需的

  // 根据理赔类型添加
  if (claimInfo.claimType === '住院') {
    materials.push('image_report'); // 住院报告
  }

  if (claimInfo.claimType === '门诊') {
    materials.push('image_report'); // 门诊病历
  }

  return materials;
}

/**
 * 获取默认可选材料
 */
function getDefaultOptionalMaterials(claimInfo) {
  return ['image_id', 'excel_expense', 'video_scene'];
}

// ============================================================================
// 综合分析入口
// ============================================================================

/**
 * 执行多文件联合分析
 * @param {Array} documents - 解析后的文档列表
 * @param {object} context - 上下文信息
 * @returns {Promise<object>}
 */
export async function analyzeMultiFiles(documents, context = {}) {
  const startTime = Date.now();
  const crossValidation = [];

  // 1. 金额一致性验证
  crossValidation.push(...validateAmountConsistency(documents));

  // 2. 日期一致性验证
  crossValidation.push(...validateDateConsistency(documents));

  // 3. 身份一致性验证
  crossValidation.push(...validateIdentityConsistency(documents));

  // 4. 时间线验证
  crossValidation.push(...validateTimeline(documents, context));

  // 5. 材料校验规则
  const { validationResults, validationFacts } = executeMaterialValidationRules(documents);
  crossValidation.push(...validationResults);

  // 6. 材料完整性检查
  const completeness = await checkDocumentCompleteness(
    documents,
    context.productCode,
    context.claimInfo
  );

  // 7. 生成人工介入点
  const interventionPoints = generateInterventionPoints(
    crossValidation,
    completeness,
    documents
  );

  return {
    crossValidation,
    materialValidationResults: validationResults,
    validationFacts,
    completeness,
    interventionPoints,
    summary: generateAnalysisSummary(crossValidation, completeness, interventionPoints),
    processingTime: Date.now() - startTime,
  };
}

/**
 * 根据验证结果生成人工介入点
 */
function generateInterventionPoints(crossValidation, completeness, documents) {
  const points = [];

  // 材料不完整
  if (!completeness.isComplete) {
    points.push({
      id: `intervention-${Date.now()}-1`,
      type: 'document_incomplete',
      reason: `缺少 ${completeness.missingMaterials.length} 项必需材料`,
      timestamp: new Date().toISOString(),
      requiredAction: '请补充上传缺失材料',
      resolved: false,
    });
  }

  // 交叉验证错误
  const errors = crossValidation.filter(v => !v.passed && v.severity === 'error');
  if (errors.length > 0) {
    points.push({
      id: `intervention-${Date.now()}-2`,
      type: 'amount_anomaly',
      reason: errors.map(e => e.message).join('; '),
      timestamp: new Date().toISOString(),
      requiredAction: '请核实金额差异原因',
      resolved: false,
    });
  }

  // 高风险警告
  const warnings = crossValidation.filter(v => !v.passed && v.severity === 'warning');
  if (warnings.length > 2) {
    points.push({
      id: `intervention-${Date.now()}-3`,
      type: 'high_risk',
      reason: `存在 ${warnings.length} 个警告需要关注`,
      timestamp: new Date().toISOString(),
      requiredAction: '建议人工复核',
      resolved: false,
    });
  }

  return points;
}

/**
 * 生成分析摘要
 */
function generateAnalysisSummary(crossValidation, completeness, interventionPoints) {
  const passed = crossValidation.filter(v => v.passed).length;
  const failed = crossValidation.filter(v => !v.passed).length;

  let summary = `## 多文件联合分析结果\n\n`;
  summary += `### 交叉验证\n`;
  summary += `- 通过: ${passed} 项\n`;
  summary += `- 异常: ${failed} 项\n\n`;
  summary += `### 材料完整性\n`;
  summary += `- 完整度: ${completeness.completenessScore}%\n`;
  summary += `- 状态: ${completeness.isComplete ? '✅ 完整' : '⚠️ 缺失材料'}\n\n`;

  if (interventionPoints.length > 0) {
    summary += `### 需要关注\n`;
    for (const point of interventionPoints) {
      summary += `- **${point.type}**: ${point.reason}\n`;
    }
  }

  return summary;
}

// ============================================================================
// 导出
// ============================================================================

export default {
  validateAmountConsistency,
  validateDateConsistency,
  validateIdentityConsistency,
  validateTimeline,
  checkDocumentCompleteness,
  analyzeMultiFiles,
};
