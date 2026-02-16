import { recognizeMedicalInvoice, recognizeMultipleInvoiceImages, recognizeClaimMaterial } from './invoiceOcrService';
import { batchMatchCatalogItems, inferItemCategory, calculateEstimatedReimbursement, normalizeItemName, matchCatalogItem, type BatchMatchOptions } from './catalogMatchService';
import { uploadToOSS, uploadBase64ToOSS } from './ossService';
import { api } from './api';
import { type InvoiceAuditResult, type InvoiceItemAudit, type InvoiceImageOcrResult, type HospitalInfo, type MedicalInsuranceCatalogItem, type MedicalInvoiceData, type ValidationWarning, type AIInteractionLog, type StepTiming, type MaterialAuditResult } from '../types';

// ============================================================
// 审核步骤类型定义
// ============================================================

/**
 * 审核流程步骤
 * idle    - 未开始
 * ocr     - 发票OCR识别中
 * hospital - 医院资质校验中
 * catalog  - 医保目录匹配中
 * summary  - 汇总计算中
 * done     - 审核完成
 * error    - 审核出错
 */
export type AuditStep =
  | 'idle'
  | 'upload'         // 图片上传到 OSS
  | 'ocr'            // AI OCR 识别 + 后置验证
  | 'hospital'       // 医院校验
  | 'catalog_fetch'  // 获取医保目录数据
  | 'catalog_sync'   // 快速匹配（Level 1-3）
  | 'catalog_ai'     // AI 语义匹配（Level 4）
  | 'summary'        // 汇总统计
  | 'saving'         // 保存审核结果
  | 'done'
  | 'error';

/** 审核流程选项 */
export interface AuditOptions {
  /** 是否启用 AI 语义匹配（Level 4），默认 true */
  enableAiMatch?: boolean;
}

// ============================================================
// 医院资质校验
// ============================================================

/**
 * 校验医院是否符合保险理赔要求
 *
 * 匹配策略：
 * 1. 标准化精确匹配 — normalizeItemName 后完全一致
 * 2. 部分匹配 — 发票医院名称包含数据库中的名称，或数据库中的名称包含发票医院名称
 *
 * @param hospitalName - 发票上识别出的医院名称
 * @param hospitalData - 医院数据库
 * @returns 医院校验结果
 */
export const validateHospital = (
  hospitalName: string,
  hospitalData: HospitalInfo[]
): InvoiceAuditResult['hospitalValidation'] => {
  // 如果没有医院名称，直接返回不合格
  if (!hospitalName || hospitalName.trim() === '') {
    return {
      hospitalName: hospitalName || '',
      isQualified: false,
      reason: '发票上未识别到医院名称',
    };
  }

  const normalizedInput = normalizeItemName(hospitalName);

  // 策略 1: 标准化精确匹配
  let matchedHospital = hospitalData.find(
    (h) => normalizeItemName(h.name) === normalizedInput
  );

  // 策略 2: 部分匹配（名称包含关系）
  if (!matchedHospital) {
    matchedHospital = hospitalData.find((h) => {
      const normalizedDb = normalizeItemName(h.name);
      return normalizedDb.includes(normalizedInput) || normalizedInput.includes(normalizedDb);
    });
  }

  // 未找到匹配的医院
  if (!matchedHospital) {
    return {
      hospitalName,
      isQualified: false,
      reason: '未在医院数据库中找到该医院',
    };
  }

  // 找到匹配的医院，检查是否符合保险理赔要求
  if (matchedHospital.qualifiedForInsurance) {
    return {
      hospitalName,
      matchedHospital,
      isQualified: true,
    };
  }

  // 医院存在但不符合理赔要求（例如非公立二级及以上）
  return {
    hospitalName,
    matchedHospital,
    isQualified: false,
    reason: `该医院（${matchedHospital.level}/${matchedHospital.type}）不符合保险理赔要求，通常要求公立二级及以上医院`,
  };
};

const buildHospitalNameCandidates = (name: string): string[] => {
  const candidates = new Set<string>();
  if (name && name.trim()) candidates.add(name);
  const replacements: Array<[RegExp, string]> = [
    [/东文/g, '东方'],
    [/东交/g, '东方'],
  ];
  replacements.forEach(([pattern, replacement]) => {
    if (name && pattern.test(name)) {
      candidates.add(name.replace(pattern, replacement));
    }
  });
  return Array.from(candidates);
};

const calculateNameSimilarity = (a: string, b: string) => {
  if (!a || !b) return 0;
  const aChars = Array.from(a);
  const bChars = Array.from(b);
  const pool = [...bChars];
  let matched = 0;
  aChars.forEach((ch) => {
    const idx = pool.indexOf(ch);
    if (idx >= 0) {
      matched += 1;
      pool.splice(idx, 1);
    }
  });
  return matched / Math.max(aChars.length, bChars.length);
};

const correctHospitalName = (hospitalName: string, hospitalData: HospitalInfo[]) => {
  if (!hospitalName || hospitalData.length === 0) return hospitalName;
  const candidates = buildHospitalNameCandidates(hospitalName);
  let bestMatch: HospitalInfo | undefined;
  let bestScore = 0;

  candidates.forEach((candidate) => {
    const normalizedCandidate = normalizeItemName(candidate);
    hospitalData.forEach((hospital) => {
      const normalizedDb = normalizeItemName(hospital.name);
      if (normalizedDb === normalizedCandidate) {
        bestMatch = hospital;
        bestScore = 1;
        return;
      }
      const score = calculateNameSimilarity(normalizedCandidate, normalizedDb);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = hospital;
      }
    });
  });

  if (bestMatch && bestScore >= 0.75) {
    return bestMatch.name;
  }
  return hospitalName;
};

// ============================================================
// 单个费用项目审核
// ============================================================

/**
 * 判定费用项目是否合格，生成审核结论
 *
 * 判定逻辑：
 * - 甲类（A）：全额纳入报销范围 → 合格
 * - 乙类（B）：部分纳入报销范围 → 合格（部分报销）
 * - 丙类（C）：不纳入报销范围 → 不合格
 * - 不在目录（excluded）：完全自费 → 不合格
 * - 未匹配到目录项：无法判定 → 不合格
 *
 * @param catalogMatch - 医保目录匹配结果
 * @param totalPrice - 该项费用总价
 * @param matchedItem - 匹配到的目录项（可选）
 * @returns 审核结论相关字段
 */
const determineQualification = (
  catalogMatch: InvoiceItemAudit['catalogMatch'],
  totalPrice: number,
  matchedItem?: MedicalInsuranceCatalogItem
): {
  isQualified: boolean;
  qualificationReason: string;
  estimatedReimbursement: number;
  remarks?: string;
} => {
  // 未匹配到目录项
  if (!catalogMatch.matched || !matchedItem) {
    return {
      isQualified: false,
      qualificationReason: '未匹配到医保目录项，无法确认报销资格',
      estimatedReimbursement: 0,
      remarks: `匹配置信度: ${catalogMatch.matchConfidence}%`,
    };
  }

  const estimatedReimbursement = calculateEstimatedReimbursement(totalPrice, matchedItem);

  switch (matchedItem.type) {
    case 'A':
      // 甲类药品/项目：全额纳入报销
      return {
        isQualified: true,
        qualificationReason: `甲类项目（${matchedItem.name}），全额纳入医保报销范围`,
        estimatedReimbursement,
      };

    case 'B':
      // 乙类药品/项目：部分纳入报销，个人需承担一定比例
      return {
        isQualified: true,
        qualificationReason: `乙类项目（${matchedItem.name}），部分纳入医保报销范围`,
        estimatedReimbursement,
        remarks: matchedItem.restrictions
          ? `使用限制: ${matchedItem.restrictions}`
          : '乙类项目个人需承担一定比例自付费用',
      };

    case 'C':
      // 丙类：不纳入医保报销范围
      return {
        isQualified: false,
        qualificationReason: `丙类项目（${matchedItem.name}），不纳入医保报销范围，需全额自费`,
        estimatedReimbursement: 0,
      };

    case 'excluded':
      // 明确排除项
      return {
        isQualified: false,
        qualificationReason: `该项目（${matchedItem.name}）已被排除在医保目录之外`,
        estimatedReimbursement: 0,
        remarks: matchedItem.restrictions || '属于医保目录排除项',
      };

    default:
      return {
        isQualified: false,
        qualificationReason: '未知的目录分类类型',
        estimatedReimbursement: 0,
      };
  }
};

// ============================================================
// OCR 后置验证层 — 去重 + 金额交叉验证 + 异常检测
// ============================================================

/**
 * 验证并修正 OCR 识别结果
 *
 * 功能：
 * 1. 明细去重 — 按 normalizeItemName + quantity + unitPrice 生成指纹，去除完全重复项
 * 2. 单项金额校验 — quantity × unitPrice ≈ totalPrice
 * 3. 合计金额交叉验证 — chargeItems 加总 ≈ totalAmount
 * 4. 医保金额平衡关系验证 — 两组平衡等式
 * 5. 异常值检测 — 金额 ≤ 0、单项超总额等
 *
 * @param ocrData - OCR 原始识别结果
 * @returns 修正后的 ocrData 和验证警告列表
 */
export const validateAndFixOcrResult = (
  ocrData: MedicalInvoiceData
): { fixedData: MedicalInvoiceData; warnings: ValidationWarning[] } => {
  const warnings: ValidationWarning[] = [];
  let fixedChargeItems = [...ocrData.chargeItems];

  // ─── 1. 明细去重 ──────────────────────────────
  const fingerprints = new Map<string, number>(); // fingerprint → first occurrence index
  const duplicates: string[] = [];

  fixedChargeItems = fixedChargeItems.filter((item, index) => {
    const fp = `${normalizeItemName(item.itemName)}|${item.quantity}|${item.unitPrice}`;
    if (fingerprints.has(fp)) {
      duplicates.push(item.itemName);
      return false;
    }
    fingerprints.set(fp, index);
    return true;
  });

  if (duplicates.length > 0) {
    warnings.push({
      type: 'duplicate_item',
      severity: 'warning',
      message: `发现 ${duplicates.length} 条重复明细项目已自动去除：${duplicates.join('、')}`,
      details: { items: duplicates },
    });
  }

  // ─── 2. 单项金额校验 ──────────────────────────
  for (const item of fixedChargeItems) {
    if (item.quantity > 0 && item.unitPrice > 0) {
      const calculated = Math.round(item.quantity * item.unitPrice * 100) / 100;
      const diff = Math.abs(calculated - item.totalPrice);
      if (diff > 0.02) {
        warnings.push({
          type: 'amount_mismatch',
          severity: 'info',
          message: `"${item.itemName}" 数量×单价(${calculated}) ≠ 总价(${item.totalPrice})，差异 ${diff.toFixed(2)} 元，以票面总价为准`,
          details: {
            field: item.itemName,
            expected: calculated,
            actual: item.totalPrice,
            difference: diff,
          },
        });
        // 不自动修正 totalPrice，保持票面值
      }
    }
  }

  // ─── 3. 异常值检测 ────────────────────────────
  const totalAmount = ocrData.totalAmount || 0;

  for (const item of fixedChargeItems) {
    if (item.totalPrice <= 0) {
      warnings.push({
        type: 'abnormal_value',
        severity: 'warning',
        message: `"${item.itemName}" 金额为 ${item.totalPrice}，异常（≤0）`,
        details: { field: item.itemName, actual: item.totalPrice },
      });
    }
    if (totalAmount > 0 && item.totalPrice > totalAmount) {
      warnings.push({
        type: 'abnormal_value',
        severity: 'error',
        message: `"${item.itemName}" 金额 ${item.totalPrice} 超过发票总金额 ${totalAmount}`,
        details: { field: item.itemName, actual: item.totalPrice, expected: totalAmount },
      });
    }
    if (item.quantity <= 0) {
      warnings.push({
        type: 'abnormal_value',
        severity: 'warning',
        message: `"${item.itemName}" 数量为 ${item.quantity}，异常（≤0）`,
        details: { field: item.itemName, actual: item.quantity },
      });
    }
  }

  // ─── 4. 合计金额交叉验证 ──────────────────────
  if (totalAmount > 0 && fixedChargeItems.length > 0) {
    const calculatedTotal = Math.round(
      fixedChargeItems.reduce((sum, item) => sum + item.totalPrice, 0) * 100
    ) / 100;
    const diff = Math.abs(calculatedTotal - totalAmount);
    const threshold = Math.max(1, totalAmount * 0.02); // 容差：max(1元, 2%)

    if (diff > threshold) {
      warnings.push({
        type: 'total_mismatch',
        severity: 'warning',
        message: `明细金额合计 (${calculatedTotal.toFixed(2)}) 与票面总金额 (${totalAmount.toFixed(2)}) 存在 ${diff.toFixed(2)} 元差异，可能存在识别误差或项目遗漏`,
        details: {
          expected: totalAmount,
          actual: calculatedTotal,
          difference: diff,
        },
      });
    } else if (diff > 0.01) {
      // 小差异，记为 info
      warnings.push({
        type: 'total_mismatch',
        severity: 'info',
        message: `明细金额合计 (${calculatedTotal.toFixed(2)}) 与票面总金额 (${totalAmount.toFixed(2)}) 差异 ${diff.toFixed(2)} 元（在合理范围内）`,
        details: {
          expected: totalAmount,
          actual: calculatedTotal,
          difference: diff,
        },
      });
    }
  }

  // ─── 5. 医保金额平衡关系验证 ──────────────────
  const ins = ocrData.insurancePayment;
  if (ins && totalAmount > 0) {
    // 平衡关系一：总金额 ≈ 统筹支付 + 其他支付 + 个人账户支付 + 个人现金支付
    const govFund = ins.governmentFundPayment || 0;
    const otherPay = ins.otherPayment || 0;
    const personalAccount = ins.personalAccountPayment || 0;
    const personalCash = ins.personalCashPayment || 0;
    const paymentSum = govFund + otherPay + personalAccount + personalCash;

    if (paymentSum > 0) {
      const balance1Diff = Math.abs(totalAmount - paymentSum);
      if (balance1Diff > 0.1) {
        warnings.push({
          type: 'insurance_balance',
          severity: balance1Diff > 1 ? 'warning' : 'info',
          message: `医保支付平衡验证：总金额(${totalAmount.toFixed(2)}) ≠ 统筹(${govFund})+其他(${otherPay})+个人账户(${personalAccount})+现金(${personalCash}) = ${paymentSum.toFixed(2)}，差异 ${balance1Diff.toFixed(2)} 元`,
          details: {
            expected: totalAmount,
            actual: paymentSum,
            difference: balance1Diff,
          },
        });
      }
    }

    // 平衡关系二：个人账户支付 + 个人现金支付 ≈ 个人自付 + 个人自费
    const selfPayment = ins.personalSelfPayment || 0;
    const selfExpense = ins.personalSelfExpense || 0;
    const personalTotal = personalAccount + personalCash;
    const selfTotal = selfPayment + selfExpense;

    if (personalTotal > 0 && selfTotal > 0) {
      const balance2Diff = Math.abs(personalTotal - selfTotal);
      if (balance2Diff > 0.1) {
        warnings.push({
          type: 'insurance_balance',
          severity: balance2Diff > 1 ? 'warning' : 'info',
          message: `个人支付平衡验证：个人账户(${personalAccount})+现金(${personalCash}) = ${personalTotal.toFixed(2)} ≠ 自付(${selfPayment})+自费(${selfExpense}) = ${selfTotal.toFixed(2)}，差异 ${balance2Diff.toFixed(2)} 元`,
          details: {
            expected: personalTotal,
            actual: selfTotal,
            difference: balance2Diff,
          },
        });
      }
    }
  }

  return {
    fixedData: {
      ...ocrData,
      chargeItems: fixedChargeItems,
    },
    warnings,
  };
};

// ============================================================
// 完整审核流程编排
// ============================================================

/**
 * 执行完整的发票审核流程
 *
 * 流程步骤：
 * 1. OCR 发票识别 — 调用 Gemini AI 提取发票结构化数据
 * 2. 医院资质校验 — 核实就诊医院是否符合理赔要求
 * 3. 医保目录匹配 — 逐项匹配费用明细与医保目录
 * 4. 汇总统计 — 计算合格/不合格金额及预估报销金额
 * 5. 持久化保存 — 将审核结果存入后端
 *
 * @param imageSource - 发票图片来源（base64 / Blob / OSS URL）
 * @param province - 省份代码，用于匹配地方医保目录
 * @param claimCaseId - 可选，关联的理赔案件ID
 * @param onProgress - 可选，步骤进度回调函数
 * @returns 完整的发票审核结果
 */
export const performFullAudit = async (
  imageSource: string | Blob | File[],
  province: string,
  model: 'gemini' | 'glm-ocr' | 'glm-ocr-structured' = 'gemini',
  claimCaseId?: string,
  onProgress?: (step: AuditStep, detail?: string) => void,
  options?: AuditOptions
): Promise<InvoiceAuditResult> => {
  // 多图模式：传入 File[] 时委托给 performMultiImageAudit
  if (Array.isArray(imageSource)) {
    return performMultiImageAudit(imageSource, province, model, claimCaseId, onProgress, options);
  }

  const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const uploadTime = new Date().toISOString();

  let ossUrl = '';
  let ossKey = '';

  // 初始化部分结果（用于出错时返回）
  let ocrData: MedicalInvoiceData | undefined;
  let aiLog: import('../types').AIInteractionLog | undefined;
  let validationWarnings: ValidationWarning[] = [];
  let hospitalValidation: InvoiceAuditResult['hospitalValidation'] = {
    hospitalName: '',
    isQualified: false,
    reason: '审核未完成',
  };
  let itemAudits: InvoiceItemAudit[] = [];
  let summary: InvoiceAuditResult['summary'] = {
    totalAmount: 0,
    qualifiedAmount: 0,
    unqualifiedAmount: 0,
    qualifiedItemCount: 0,
    unqualifiedItemCount: 0,
    estimatedReimbursement: 0,
  };

  const stepLogs: import('../types').StepLog[] = [];
  const stepTimings: StepTiming[] = [];

  // 辅助：记录子步骤计时
  const startTiming = (step: string, label: string) => {
    stepTimings.push({ step, label, startTime: Date.now() });
  };
  const endTiming = (detail?: string) => {
    const last = stepTimings[stepTimings.length - 1];
    if (last && !last.endTime) {
      last.endTime = Date.now();
      last.duration = last.endTime - last.startTime;
      if (detail) last.detail = detail;
    }
  };

  try {
    // ─── 步骤 1: 图片上传到 OSS ───────────────────
    onProgress?.('upload', '上传图片到 OSS...');
    startTiming('upload', '图片上传');

    if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
      ossUrl = imageSource;
      try {
        ossKey = new URL(imageSource).pathname.replace(/^\//, '');
      } catch { /* ignore */ }
    } else if (imageSource instanceof File) {
      try {
        const uploadResult = await uploadToOSS(imageSource, 'invoices');
        ossUrl = uploadResult.url;
        ossKey = uploadResult.objectKey;
      } catch (err) {
        console.warn('OSS upload failed, continuing audit without persistent image:', err);
      }
    } else if (imageSource instanceof Blob) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => { resolve((reader.result as string).split(',')[1]); };
          reader.onerror = reject;
          reader.readAsDataURL(imageSource);
        });
        const uploadResult = await uploadBase64ToOSS(base64, 'image/jpeg', 'invoices');
        ossUrl = uploadResult.url;
        ossKey = uploadResult.objectKey;
      } catch (err) {
        console.warn('OSS upload failed, continuing audit without persistent image:', err);
      }
    }

    endTiming();

    // ─── 步骤 2: OCR 发票识别 ───────────────────────
    onProgress?.('ocr', '发票 AI 识别中...');
    startTiming('ocr', 'OCR 识别');
    const ocrStart = Date.now();

    const ocrResult = await recognizeMedicalInvoice(imageSource, model);
    const ocrData = ocrResult.data;
    const aiLog = ocrResult.log;

    stepLogs.push({
      step: 'ocr',
      input: { imageSourceType: typeof imageSource, model },
      output: { ocrData, aiLog },
      duration: Date.now() - ocrStart,
      timestamp: new Date().toISOString()
    });

    if (!ocrData || !ocrData.chargeItems || ocrData.chargeItems.length === 0) {
      throw new Error('发票识别结果为空或未识别到费用明细');
    }

    // OCR 后置验证
    const validationResult = validateAndFixOcrResult(ocrData);
    Object.assign(ocrData, validationResult.fixedData);
    validationWarnings = validationResult.warnings;

    endTiming(`${ocrData.chargeItems.length} 项明细`);

    // ─── 步骤 3: 医院资质校验 ───────────────────────
    onProgress?.('hospital', '医院资质校验中...');
    startTiming('hospital', '医院校验');
    const hospitalStart = Date.now();

    const hospitalName = ocrData.invoiceInfo?.hospitalName || '';
    let hospitalData: HospitalInfo[] = [];
    try {
      hospitalData = await api.hospitalInfo.list() as HospitalInfo[];
    } catch (err) {
      console.warn('获取医院数据库失败，将跳过医院校验:', err);
    }

    const correctedHospitalName = correctHospitalName(hospitalName, hospitalData);
    if (ocrData.invoiceInfo) {
      ocrData.invoiceInfo.hospitalName = correctedHospitalName;
    }
    const hospitalValidation = validateHospital(correctedHospitalName, hospitalData);

    stepLogs.push({
      step: 'hospital',
      input: { hospitalName, correctedHospitalName, hospitalDataCount: hospitalData.length },
      output: hospitalValidation,
      duration: Date.now() - hospitalStart,
      timestamp: new Date().toISOString()
    });

    endTiming(hospitalValidation.isQualified ? '合格' : '不合格');

    // ─── 步骤 4a: 获取医保目录数据 ──────────────────
    onProgress?.('catalog_fetch', '获取医保目录数据...');
    startTiming('catalog_fetch', '获取目录');

    let catalogData: MedicalInsuranceCatalogItem[] = [];
    try {
      catalogData = await api.medicalInsuranceCatalog.list() as MedicalInsuranceCatalogItem[];
    } catch (err) {
      console.warn('获取医保目录数据失败，将无法进行目录匹配:', err);
    }

    endTiming(`${catalogData.length} 条目录`);

    // ─── 步骤 4b-4c: 批量匹配（快速 + AI） ─────────
    onProgress?.('catalog_sync', '快速匹配中...');
    startTiming('catalog_sync', '快速匹配');
    const catalogStart = Date.now();

    const itemAudits: InvoiceItemAudit[] = [];
    const matchLogs: any[] = [];

    const itemsForMatch = ocrData.chargeItems.map(item => ({
      itemName: item.itemName,
      category: inferItemCategory(item.itemName),
    }));

    let matchResults: Array<InvoiceItemAudit['catalogMatch']>;
    try {
      matchResults = await batchMatchCatalogItems(itemsForMatch, province, catalogData, {
        enableAiMatch: options?.enableAiMatch ?? true,
        onProgress: (phase, detail) => {
          if (phase === 'sync') {
            onProgress?.('catalog_sync', detail);
            // 同步阶段完成 → 结束 catalog_sync 计时
            endTiming(detail);
            // 如果有 AI 阶段，开始 catalog_ai 计时
            if (options?.enableAiMatch !== false) {
              startTiming('catalog_ai', 'AI 匹配');
            }
          } else {
            onProgress?.('catalog_ai', detail);
          }
        },
      });
    } catch (err) {
      console.warn('批量目录匹配失败，回退到逐项匹配:', err);
      matchResults = [];
      for (const item of itemsForMatch) {
        try {
          const match = await matchCatalogItem(item.itemName, province, item.category, catalogData);
          matchResults.push(match);
        } catch {
          matchResults.push({ matched: false, matchConfidence: 0, matchMethod: 'none' });
        }
      }
    }

    // 确保 catalog_ai 计时结束（如果存在）
    const lastTiming = stepTimings[stepTimings.length - 1];
    if (lastTiming && !lastTiming.endTime) {
      endTiming();
    }

    // 如果 AI 被关闭，catalog_ai 显示为已跳过
    if (options?.enableAiMatch === false) {
      stepTimings.push({ step: 'catalog_ai', label: 'AI 匹配', startTime: Date.now(), endTime: Date.now(), duration: 0, detail: '已跳过' });
    }

    // 逐项组装审核结果（纯同步操作）
    for (let i = 0; i < ocrData.chargeItems.length; i++) {
      const chargeItem = ocrData.chargeItems[i];
      const { itemName, quantity, unitPrice, totalPrice } = chargeItem;
      const catalogMatch = matchResults[i];

      matchLogs.push({ itemName, category: itemsForMatch[i].category, matchResult: catalogMatch });
      const qualification = determineQualification(catalogMatch, totalPrice, catalogMatch.matchedItem);

      itemAudits.push({
        itemName, quantity, unitPrice, totalPrice, catalogMatch,
        isQualified: qualification.isQualified,
        qualificationReason: qualification.qualificationReason,
        estimatedReimbursement: qualification.estimatedReimbursement,
        remarks: qualification.remarks,
      });
    }

    stepLogs.push({
      step: 'catalog',
      input: { itemCount: ocrData.chargeItems.length, province, catalogDataCount: catalogData.length },
      output: { itemAudits, detailedMatches: matchLogs },
      duration: Date.now() - catalogStart,
      timestamp: new Date().toISOString()
    });

    // ─── 步骤 5: 汇总统计 ──────────────────────────
    onProgress?.('summary', '汇总统计中...');
    startTiming('summary', '汇总统计');
    const summaryStart = Date.now();

    const totalAmount = ocrData.totalAmount || itemAudits.reduce((sum, item) => sum + item.totalPrice, 0);
    const qualifiedItems = itemAudits.filter((item) => item.isQualified);
    const unqualifiedItems = itemAudits.filter((item) => !item.isQualified);

    const summary = {
      totalAmount: Math.round(totalAmount * 100) / 100,
      qualifiedAmount: Math.round(qualifiedItems.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100,
      unqualifiedAmount: Math.round(unqualifiedItems.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100,
      qualifiedItemCount: qualifiedItems.length,
      unqualifiedItemCount: unqualifiedItems.length,
      estimatedReimbursement: Math.round(itemAudits.reduce((sum, item) => sum + item.estimatedReimbursement, 0) * 100) / 100,
    };

    stepLogs.push({
      step: 'summary',
      input: { itemAuditsCount: itemAudits.length },
      output: summary,
      duration: Date.now() - summaryStart,
      timestamp: new Date().toISOString()
    });

    endTiming();

    // ─── 步骤 6: 保存审核结果 ────────────────────────
    onProgress?.('saving', '保存审核结果...');
    startTiming('saving', '保存结果');

    const result: InvoiceAuditResult = {
      invoiceId, ossUrl, ossKey, uploadTime, claimCaseId,
      ocrData, hospitalValidation, itemAudits, summary,
      auditStatus: 'completed',
      auditTime: new Date().toISOString(),
      aiLog, stepLogs, validationWarnings, stepTimings,
    };

    try {
      await api.invoiceAudits.add(result);
    } catch (err) {
      console.warn('保存审核结果失败，但审核流程已完成:', err);
    }

    endTiming();
    // 将最终 stepTimings 写回 result
    result.stepTimings = stepTimings;

    onProgress?.('done');

    return result;
  } catch (error) {
    // 任一步骤失败，返回部分结果并标记为失败
    console.error('发票审核流程失败:', error);
    onProgress?.('error');

    // 结束当前正在计时的步骤
    const lastT = stepTimings[stepTimings.length - 1];
    if (lastT && !lastT.endTime) {
      lastT.endTime = Date.now();
      lastT.duration = lastT.endTime - lastT.startTime;
    }

    const failedResult: InvoiceAuditResult = {
      invoiceId,
      ossUrl,
      ossKey,
      uploadTime,
      claimCaseId,
      ocrData: ocrData || {
        basicInfo: { name: '', age: '' },
        chargeItems: [],
      },
      hospitalValidation,
      itemAudits,
      summary,
      auditStatus: 'failed',
      auditTime: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : '审核过程中发生未知错误',
      aiLog,
      stepTimings,
    };

    // 即使失败也尝试保存记录，便于后续排查
    try {
      await api.invoiceAudits.add(failedResult);
    } catch (saveErr) {
      console.warn('保存失败审核记录时出错:', saveErr);
    }

    return failedResult;
  }
};

// ============================================================
// 多图合并逻辑
// ============================================================

interface MergeResult {
  mergedData: MedicalInvoiceData;
  summaryChargeItems: MedicalInvoiceData['chargeItems'];
  crossValidation: {
    summaryTotal: number;
    detailItemsTotal: number;
    difference: number;
    isConsistent: boolean;
  };
}

/**
 * 合并多张图片的 OCR 结果
 *
 * 合并策略：
 * - basicInfo / invoiceInfo / insurancePayment / totalAmount / medicalInsurance → 从 summary_invoice 优先取
 * - chargeItems（进入审核的项目） → 只取 detail_list 的项目
 * - summaryChargeItems（仅参考展示） → 取 summary_invoice 的大类项目
 * - 向后兼容：全部为 single_invoice 时合并所有 chargeItems
 */
const mergeMultiImageOcrResults = (imageResults: InvoiceImageOcrResult[]): MergeResult => {
  const summaryImages = imageResults.filter(r => r.documentType === 'summary_invoice');
  const detailImages = imageResults.filter(r => r.documentType === 'detail_list');
  const singleImages = imageResults.filter(r => r.documentType === 'single_invoice');

  // 无分离 → 向后兼容：合并所有 chargeItems
  if (summaryImages.length === 0 && detailImages.length === 0) {
    const allItems = singleImages.flatMap(img => img.ocrData.chargeItems || []);
    const firstData = singleImages[0]?.ocrData;
    const total = firstData?.totalAmount || 0;
    const itemsTotal = allItems.reduce((s, i) => s + (i.totalPrice || 0), 0);
    const diff = Math.abs(total - itemsTotal);
    return {
      mergedData: { ...firstData, chargeItems: allItems } as MedicalInvoiceData,
      summaryChargeItems: [],
      crossValidation: {
        summaryTotal: 0,
        detailItemsTotal: 0,
        difference: 0,
        isConsistent: true,
      },
    };
  }

  // 有分离 → summary 提供元数据，detail 提供明细项
  const summaryData = summaryImages[0]?.ocrData;
  const summaryChargeItems = summaryImages.flatMap(img => img.ocrData.chargeItems || []);
  const detailChargeItems = [
    ...detailImages.flatMap(img => img.ocrData.chargeItems || []),
    ...singleImages.flatMap(img => img.ocrData.chargeItems || []),
  ];

  const mergedData: MedicalInvoiceData = {
    documentType: 'summary_invoice',
    basicInfo: summaryData?.basicInfo || detailImages[0]?.ocrData.basicInfo || { name: '', age: '' },
    chargeItems: detailChargeItems,  // 只有明细项进入审核
    totalAmount: summaryData?.totalAmount || 0,
    insurancePayment: summaryData?.insurancePayment,
    invoiceInfo: summaryData?.invoiceInfo || detailImages[0]?.ocrData.invoiceInfo,
    medicalInsurance: summaryData?.medicalInsurance,
  };

  // 交叉验证：汇总金额 vs 明细合计
  const summaryTotal = summaryData?.totalAmount || 0;
  const detailItemsTotal = detailChargeItems.reduce((s, i) => s + (i.totalPrice || 0), 0);
  const difference = Math.abs(summaryTotal - detailItemsTotal);
  // 容差：max(1元, 5% of summaryTotal)
  const threshold = Math.max(1, summaryTotal * 0.05);

  return {
    mergedData,
    summaryChargeItems,
    crossValidation: {
      summaryTotal: Math.round(summaryTotal * 100) / 100,
      detailItemsTotal: Math.round(detailItemsTotal * 100) / 100,
      difference: Math.round(difference * 100) / 100,
      isConsistent: difference <= threshold,
    },
  };
};

// ============================================================
// 多图审核流程
// ============================================================

/**
 * 执行多图发票审核流程
 *
 * 支持多张关联图片（汇总发票 + 明细清单），
 * 汇总发票的项目不参与目录匹配，只有明细清单的项目进入逐项审核。
 */
const performMultiImageAudit = async (
  images: File[],
  province: string,
  model: 'gemini' | 'glm-ocr' | 'glm-ocr-structured' = 'gemini',
  claimCaseId?: string,
  onProgress?: (step: AuditStep, detail?: string) => void,
  options?: AuditOptions
): Promise<InvoiceAuditResult> => {
  const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const uploadTime = new Date().toISOString();

  let ocrData: MedicalInvoiceData | undefined;
  let validationWarnings: ValidationWarning[] = [];
  let hospitalValidation: InvoiceAuditResult['hospitalValidation'] = {
    hospitalName: '',
    isQualified: false,
    reason: '审核未完成',
  };
  let itemAudits: InvoiceItemAudit[] = [];
  let summary: InvoiceAuditResult['summary'] = {
    totalAmount: 0, qualifiedAmount: 0, unqualifiedAmount: 0,
    qualifiedItemCount: 0, unqualifiedItemCount: 0, estimatedReimbursement: 0,
  };
  const stepLogs: import('../types').StepLog[] = [];
  const stepTimings: StepTiming[] = [];
  let imageOcrResults: InvoiceImageOcrResult[] = [];
  let summaryChargeItems: MedicalInvoiceData['chargeItems'] = [];
  let crossValidation: InvoiceAuditResult['crossValidation'] | undefined;
  let ossUrl = '';
  let ossKey = '';

  const startTiming = (step: string, label: string) => {
    stepTimings.push({ step, label, startTime: Date.now() });
  };
  const endTiming = (detail?: string) => {
    const last = stepTimings[stepTimings.length - 1];
    if (last && !last.endTime) {
      last.endTime = Date.now();
      last.duration = last.endTime - last.startTime;
      if (detail) last.detail = detail;
    }
  };

  try {
    // ─── 步骤 1: 并行上传所有图片到 OSS ───────────────
    onProgress?.('upload', `上传图片中 (${images.length} 张)...`);
    startTiming('upload', '图片上传');

    const ossResults = await Promise.all(
      images.map(async (file) => {
        try {
          const result = await uploadToOSS(file, 'invoices');
          return { url: result.url, objectKey: result.objectKey };
        } catch (err) {
          console.warn('OSS upload failed for', file.name, err);
          return { url: '', objectKey: '' };
        }
      })
    );

    ossUrl = ossResults[0]?.url || '';
    ossKey = ossResults[0]?.objectKey || '';
    endTiming(`${images.length} 张图片`);

    // ─── 步骤 2: OCR 识别 ───────────────────────────
    onProgress?.('ocr', `发票识别中 (0/${images.length})...`);
    startTiming('ocr', 'OCR 识别');
    const ocrStart = Date.now();

    const ocrResults = await recognizeMultipleInvoiceImages(
      images.map((file) => ({ source: file, fileName: file.name })),
      model,
      (completed, total) => {
        onProgress?.('ocr', `发票识别中 (${completed}/${total})`);
      }
    );

    imageOcrResults = ocrResults.map((result, index) => ({
      imageIndex: index,
      ossUrl: ossResults[index]?.url || '',
      ossKey: ossResults[index]?.objectKey || '',
      fileName: result.fileName,
      documentType: result.data.documentType || 'single_invoice',
      ocrData: result.data,
      aiLog: result.log,
    }));

    stepLogs.push({
      step: 'ocr',
      input: { imageCount: images.length, model, fileNames: images.map(f => f.name) },
      output: {
        imageOcrResults: imageOcrResults.map(r => ({
          fileName: r.fileName, documentType: r.documentType,
          chargeItemCount: r.ocrData.chargeItems?.length || 0,
        })),
      },
      duration: Date.now() - ocrStart,
      timestamp: new Date().toISOString(),
    });

    // 多图合并
    const mergeResult = mergeMultiImageOcrResults(imageOcrResults);
    ocrData = mergeResult.mergedData;
    summaryChargeItems = mergeResult.summaryChargeItems;
    crossValidation = mergeResult.crossValidation;

    if (!ocrData.chargeItems || ocrData.chargeItems.length === 0) {
      throw new Error('所有图片中均未识别到费用明细项目');
    }

    if (crossValidation && !crossValidation.isConsistent) {
      validationWarnings.push({
        type: 'summary_detail_mismatch', severity: 'warning',
        message: `汇总发票金额 (${crossValidation.summaryTotal.toFixed(2)}) 与明细合计 (${crossValidation.detailItemsTotal.toFixed(2)}) 存在 ${crossValidation.difference.toFixed(2)} 元差异`,
        details: { expected: crossValidation.summaryTotal, actual: crossValidation.detailItemsTotal, difference: crossValidation.difference },
      });
    }

    const validationResult = validateAndFixOcrResult(ocrData);
    Object.assign(ocrData, validationResult.fixedData);
    validationWarnings = [...validationWarnings, ...validationResult.warnings];

    endTiming(`${images.length} 张图片，${ocrData.chargeItems.length} 项明细`);

    // ─── 步骤 3: 医院资质校验 ───────────────────────
    onProgress?.('hospital', '医院资质校验中...');
    startTiming('hospital', '医院校验');
    const hospitalStart = Date.now();

    const hospitalName = ocrData.invoiceInfo?.hospitalName || '';
    let hospitalData: HospitalInfo[] = [];
    try {
      hospitalData = await api.hospitalInfo.list() as HospitalInfo[];
    } catch (err) {
      console.warn('获取医院数据库失败，将跳过医院校验:', err);
    }

    const correctedHospitalName = correctHospitalName(hospitalName, hospitalData);
    if (ocrData.invoiceInfo) {
      ocrData.invoiceInfo.hospitalName = correctedHospitalName;
    }
    hospitalValidation = validateHospital(correctedHospitalName, hospitalData);

    stepLogs.push({
      step: 'hospital',
      input: { hospitalName, correctedHospitalName, hospitalDataCount: hospitalData.length },
      output: hospitalValidation,
      duration: Date.now() - hospitalStart,
      timestamp: new Date().toISOString(),
    });

    endTiming(hospitalValidation.isQualified ? '合格' : '不合格');

    // ─── 步骤 4a: 获取医保目录数据 ──────────────────
    onProgress?.('catalog_fetch', '获取医保目录数据...');
    startTiming('catalog_fetch', '获取目录');

    let catalogData: MedicalInsuranceCatalogItem[] = [];
    try {
      catalogData = await api.medicalInsuranceCatalog.list() as MedicalInsuranceCatalogItem[];
    } catch (err) {
      console.warn('获取医保目录数据失败:', err);
    }

    endTiming(`${catalogData.length} 条目录`);

    // ─── 步骤 4b-4c: 批量匹配 ──────────────────────
    onProgress?.('catalog_sync', '快速匹配中...');
    startTiming('catalog_sync', '快速匹配');
    const catalogStart = Date.now();

    itemAudits = [];
    const matchLogs: any[] = [];

    const itemsForMatch = ocrData.chargeItems.map(item => ({
      itemName: item.itemName,
      category: inferItemCategory(item.itemName),
    }));

    let matchResults: Array<InvoiceItemAudit['catalogMatch']>;
    try {
      matchResults = await batchMatchCatalogItems(itemsForMatch, province, catalogData, {
        enableAiMatch: options?.enableAiMatch ?? true,
        onProgress: (phase, detail) => {
          if (phase === 'sync') {
            onProgress?.('catalog_sync', detail);
            endTiming(detail);
            if (options?.enableAiMatch !== false) {
              startTiming('catalog_ai', 'AI 匹配');
            }
          } else {
            onProgress?.('catalog_ai', detail);
          }
        },
      });
    } catch (err) {
      console.warn('批量目录匹配失败，回退到逐项匹配:', err);
      matchResults = [];
      for (const item of itemsForMatch) {
        try {
          const match = await matchCatalogItem(item.itemName, province, item.category, catalogData);
          matchResults.push(match);
        } catch {
          matchResults.push({ matched: false, matchConfidence: 0, matchMethod: 'none' });
        }
      }
    }

    // 确保最后一个 timing 结束
    const lastT2 = stepTimings[stepTimings.length - 1];
    if (lastT2 && !lastT2.endTime) endTiming();

    if (options?.enableAiMatch === false) {
      stepTimings.push({ step: 'catalog_ai', label: 'AI 匹配', startTime: Date.now(), endTime: Date.now(), duration: 0, detail: '已跳过' });
    }

    for (let i = 0; i < ocrData.chargeItems.length; i++) {
      const chargeItem = ocrData.chargeItems[i];
      const { itemName, quantity, unitPrice, totalPrice } = chargeItem;
      const catalogMatch = matchResults[i];
      matchLogs.push({ itemName, category: itemsForMatch[i].category, matchResult: catalogMatch });
      const qualification = determineQualification(catalogMatch, totalPrice, catalogMatch.matchedItem);
      itemAudits.push({
        itemName, quantity, unitPrice, totalPrice, catalogMatch,
        isQualified: qualification.isQualified,
        qualificationReason: qualification.qualificationReason,
        estimatedReimbursement: qualification.estimatedReimbursement,
        remarks: qualification.remarks,
      });
    }

    stepLogs.push({
      step: 'catalog',
      input: { itemCount: ocrData.chargeItems.length, province, catalogDataCount: catalogData.length },
      output: { itemAudits, detailedMatches: matchLogs },
      duration: Date.now() - catalogStart,
      timestamp: new Date().toISOString(),
    });

    // ─── 步骤 5: 汇总统计 ──────────────────────────
    onProgress?.('summary', '汇总统计中...');
    startTiming('summary', '汇总统计');

    const totalAmount = ocrData.totalAmount || itemAudits.reduce((sum, item) => sum + item.totalPrice, 0);
    const qualifiedItems = itemAudits.filter((item) => item.isQualified);
    const unqualifiedItems = itemAudits.filter((item) => !item.isQualified);

    summary = {
      totalAmount: Math.round(totalAmount * 100) / 100,
      qualifiedAmount: Math.round(qualifiedItems.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100,
      unqualifiedAmount: Math.round(unqualifiedItems.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100,
      qualifiedItemCount: qualifiedItems.length,
      unqualifiedItemCount: unqualifiedItems.length,
      estimatedReimbursement: Math.round(itemAudits.reduce((sum, item) => sum + item.estimatedReimbursement, 0) * 100) / 100,
    };

    stepLogs.push({
      step: 'summary',
      input: { itemAuditsCount: itemAudits.length },
      output: summary,
      duration: Date.now() - Date.now(),
      timestamp: new Date().toISOString(),
    });

    endTiming();

    // ─── 步骤 6: 保存审核结果 ────────────────────────
    onProgress?.('saving', '保存审核结果...');
    startTiming('saving', '保存结果');

    const result: InvoiceAuditResult = {
      invoiceId, ossUrl, ossKey, uploadTime, claimCaseId,
      ocrData, hospitalValidation, itemAudits, summary,
      auditStatus: 'completed',
      auditTime: new Date().toISOString(),
      aiLog: imageOcrResults[0]?.aiLog,
      stepLogs, validationWarnings, stepTimings,
      imageCount: images.length, imageOcrResults,
      summaryChargeItems: summaryChargeItems.length > 0 ? summaryChargeItems : undefined,
      crossValidation,
    };

    try {
      await api.invoiceAudits.add(result);
    } catch (err) {
      console.warn('保存审核结果失败，但审核流程已完成:', err);
    }

    endTiming();
    result.stepTimings = stepTimings;

    onProgress?.('done');
    return result;
  } catch (error) {
    console.error('多图发票审核流程失败:', error);
    onProgress?.('error');

    const lastTErr = stepTimings[stepTimings.length - 1];
    if (lastTErr && !lastTErr.endTime) {
      lastTErr.endTime = Date.now();
      lastTErr.duration = lastTErr.endTime - lastTErr.startTime;
    }

    const failedResult: InvoiceAuditResult = {
      invoiceId, ossUrl, ossKey, uploadTime, claimCaseId,
      ocrData: ocrData || { basicInfo: { name: '', age: '' }, chargeItems: [] },
      hospitalValidation, itemAudits, summary,
      auditStatus: 'failed',
      auditTime: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : '审核过程中发生未知错误',
      aiLog: imageOcrResults[0]?.aiLog,
      stepLogs, validationWarnings, stepTimings,
      imageCount: images.length,
      imageOcrResults: imageOcrResults.length > 0 ? imageOcrResults : undefined,
    };

    try {
      await api.invoiceAudits.add(failedResult);
    } catch (saveErr) {
      console.warn('保存失败审核记录时出错:', saveErr);
    }

    return failedResult;
  }
};

// ============================================================
// 通用材料审核流程（3 步简化流程）
// ============================================================

/**
 * 执行通用材料审核流程（非发票类材料）
 *
 * 简化 3 步流程：
 * 1. upload — 上传图片到 OSS
 * 2. ocr    — 调用 AI OCR 识别 + 审核（使用材料自带的 prompt + schema）
 * 3. saving — 保存审核结果
 *
 * @param imageSource - 图片来源
 * @param model - AI 模型
 * @param materialType - 材料类型 ID
 * @param materialName - 材料名称
 * @param aiAuditPrompt - 材料的 AI 审核提示词
 * @param jsonSchema - 材料的 JSON Schema
 * @param onProgress - 步骤进度回调
 * @returns 通用材料审核结果
 */
export const performMaterialAudit = async (
  imageSource: string | Blob | File,
  model: 'gemini' | 'glm-ocr' | 'paddle-ocr',
  materialType: string,
  materialName: string,
  aiAuditPrompt: string,
  jsonSchema: string,
  onProgress?: (step: AuditStep, detail?: string) => void
): Promise<MaterialAuditResult> => {
  const auditId = `MAT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const uploadTime = new Date().toISOString();

  let ossUrl = '';
  let ossKey = '';
  const stepTimings: StepTiming[] = [];

  const startTiming = (step: string, label: string) => {
    stepTimings.push({ step, label, startTime: Date.now() });
  };
  const endTiming = (detail?: string) => {
    const last = stepTimings[stepTimings.length - 1];
    if (last && !last.endTime) {
      last.endTime = Date.now();
      last.duration = last.endTime - last.startTime;
      if (detail) last.detail = detail;
    }
  };

  try {
    // ─── 步骤 1: 图片上传到 OSS ───────────────────
    onProgress?.('upload', '上传图片到 OSS...');
    startTiming('upload', '图片上传');

    if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
      ossUrl = imageSource;
      try { ossKey = new URL(imageSource).pathname.replace(/^\//, ''); } catch { /* ignore */ }
    } else if (imageSource instanceof File) {
      try {
        const uploadResult = await uploadToOSS(imageSource, 'materials');
        ossUrl = uploadResult.url;
        ossKey = uploadResult.objectKey;
      } catch (err) {
        console.warn('OSS upload failed, continuing audit without persistent image:', err);
      }
    } else if (imageSource instanceof Blob) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => { resolve((reader.result as string).split(',')[1]); };
          reader.onerror = reject;
          reader.readAsDataURL(imageSource);
        });
        const uploadResult = await uploadBase64ToOSS(base64, 'image/jpeg', 'materials');
        ossUrl = uploadResult.url;
        ossKey = uploadResult.objectKey;
      } catch (err) {
        console.warn('OSS upload failed, continuing audit without persistent image:', err);
      }
    }

    endTiming();

    // ─── 步骤 2: AI OCR 识别 + 审核 ─────────────────
    onProgress?.('ocr', `「${materialName}」识别中...`);
    startTiming('ocr', 'OCR 识别');

    const ocrResult = await recognizeClaimMaterial(
      imageSource,
      materialName,
      aiAuditPrompt,
      jsonSchema,
      model
    );

    endTiming();

    // ─── 步骤 3: 保存审核结果 ────────────────────────
    onProgress?.('saving', '保存审核结果...');
    startTiming('saving', '保存结果');

    const result: MaterialAuditResult = {
      auditId,
      materialType,
      materialName,
      ossUrl,
      ossKey,
      uploadTime,
      extractedData: ocrResult.extractedData,
      auditConclusion: ocrResult.auditConclusion,
      auditStatus: 'completed',
      aiLog: ocrResult.log,
      stepTimings,
    };

    // 复用 invoiceAudits 存储（存入相同的持久化资源）
    try {
      await api.invoiceAudits.add(result as any);
    } catch (err) {
      console.warn('保存材料审核结果失败，但审核流程已完成:', err);
    }

    endTiming();
    result.stepTimings = stepTimings;

    onProgress?.('done');
    return result;
  } catch (error) {
    console.error('材料审核流程失败:', error);
    onProgress?.('error');

    // 结束当前正在计时的步骤
    const lastT = stepTimings[stepTimings.length - 1];
    if (lastT && !lastT.endTime) {
      lastT.endTime = Date.now();
      lastT.duration = lastT.endTime - lastT.startTime;
    }

    return {
      auditId,
      materialType,
      materialName,
      ossUrl,
      ossKey,
      uploadTime,
      extractedData: {},
      auditConclusion: '',
      auditStatus: 'failed',
      errorMessage: error instanceof Error ? error.message : '审核过程中发生未知错误',
      stepTimings,
    };
  }
};

// ============================================================
// 审核历史查询
// ============================================================

/**
 * 获取审核历史记录列表
 * @returns 审核结果列表
 */
export const getAuditHistory = async (): Promise<InvoiceAuditResult[]> => {
  return api.invoiceAudits.list() as Promise<InvoiceAuditResult[]>;
};
