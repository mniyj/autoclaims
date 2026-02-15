import { recognizeMedicalInvoice, recognizeMultipleInvoiceImages } from './invoiceOcrService';
import { matchCatalogItem, inferItemCategory, calculateEstimatedReimbursement, normalizeItemName } from './catalogMatchService';
import { uploadToOSS, uploadBase64ToOSS } from './ossService';
import { api } from './api';
import { type InvoiceAuditResult, type InvoiceItemAudit, type InvoiceImageOcrResult, type HospitalInfo, type MedicalInsuranceCatalogItem, type MedicalInvoiceData, type ValidationWarning, type AIInteractionLog } from '../types';

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
export type AuditStep = 'idle' | 'ocr' | 'hospital' | 'catalog' | 'summary' | 'done' | 'error';

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
  model: 'gemini' | 'glm-ocr' = 'gemini',
  claimCaseId?: string,
  onProgress?: (step: AuditStep, detail?: string) => void
): Promise<InvoiceAuditResult> => {
  // 多图模式：传入 File[] 时委托给 performMultiImageAudit
  if (Array.isArray(imageSource)) {
    return performMultiImageAudit(imageSource, province, model, claimCaseId, onProgress);
  }

  const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const uploadTime = new Date().toISOString();

  // 确定 ossUrl 和 ossKey — 上传图片到 OSS 持久存储
  // ossKey 初始化为空字符串，只在上传成功后才赋值，避免产生幽灵路径
  let ossUrl = '';
  let ossKey = '';

  if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
    // 已经是 OSS/HTTP URL
    ossUrl = imageSource;
    try {
      ossKey = new URL(imageSource).pathname.replace(/^\//, '');
    } catch {
      // URL 解析失败，ossKey 保持空字符串
    }
  } else if (imageSource instanceof File) {
    // 将 File 上传到 OSS
    try {
      const uploadResult = await uploadToOSS(imageSource, 'invoices');
      ossUrl = uploadResult.url;
      ossKey = uploadResult.objectKey;
    } catch (err) {
      console.warn('OSS upload failed, continuing audit without persistent image:', err);
    }
  } else if (imageSource instanceof Blob) {
    // 将 Blob 转为 base64 后上传
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = (reader.result as string).split(',')[1];
          resolve(result);
        };
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

  try {
    // ─── 步骤 1: OCR 发票识别 ───────────────────────
    onProgress?.('ocr');
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

    // ─── 步骤 1.5: OCR 后置验证 — 去重 + 金额交叉验证 ───
    const validationResult = validateAndFixOcrResult(ocrData);
    // 用验证后的数据替换原始数据（去重后的 chargeItems）
    Object.assign(ocrData, validationResult.fixedData);
    validationWarnings = validationResult.warnings;

    if (validationWarnings.length > 0) {
      console.log(`[Validation] ${validationWarnings.length} warning(s):`,
        validationWarnings.map(w => `[${w.severity}] ${w.message}`));
    }

    // ─── 步骤 2: 医院资质校验 ───────────────────────
    onProgress?.('hospital');
    const hospitalStart = Date.now();

    const hospitalName = ocrData.invoiceInfo?.hospitalName || '';

    // 从后端获取医院数据
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

    // ─── 步骤 3: 医保目录匹配 ───────────────────────
    onProgress?.('catalog');
    const catalogStart = Date.now();

    // 从后端获取医保目录数据
    let catalogData: MedicalInsuranceCatalogItem[] = [];
    try {
      catalogData = await api.medicalInsuranceCatalog.list() as MedicalInsuranceCatalogItem[];
    } catch (err) {
      console.warn('获取医保目录数据失败，将无法进行目录匹配:', err);
    }

    // 逐项审核费用明细
    const itemAudits: InvoiceItemAudit[] = [];
    const matchLogs: any[] = []; // Collect detailed match logs

    for (const chargeItem of ocrData.chargeItems) {
      const { itemName, quantity, unitPrice, totalPrice } = chargeItem;

      // 推断费用项目类别（药品/诊疗项目/耗材）
      const category = inferItemCategory(itemName);

      // 匹配医保目录
      let catalogMatch: InvoiceItemAudit['catalogMatch'];
      try {
        catalogMatch = await matchCatalogItem(itemName, province, category, catalogData);
      } catch (err) {
        console.warn(`目录匹配失败 [${itemName}]:`, err);
        catalogMatch = {
          matched: false,
          matchConfidence: 0,
          matchMethod: 'none',
        };
      }

      // Log the match attempt
      matchLogs.push({
        itemName,
        category,
        matchResult: catalogMatch
      });

      // 判定审核结论
      const qualification = determineQualification(
        catalogMatch,
        totalPrice,
        catalogMatch.matchedItem
      );

      const itemAudit: InvoiceItemAudit = {
        itemName,
        quantity,
        unitPrice,
        totalPrice,
        catalogMatch,
        isQualified: qualification.isQualified,
        qualificationReason: qualification.qualificationReason,
        estimatedReimbursement: qualification.estimatedReimbursement,
        remarks: qualification.remarks,
      };

      itemAudits.push(itemAudit);
    }

    stepLogs.push({
      step: 'catalog',
      input: { itemCount: ocrData.chargeItems.length, province, catalogDataCount: catalogData.length },
      output: { itemAudits, detailedMatches: matchLogs },
      duration: Date.now() - catalogStart,
      timestamp: new Date().toISOString()
    });

    // ─── 步骤 4: 汇总统计 ──────────────────────────
    onProgress?.('summary');
    const summaryStart = Date.now();

    const totalAmount = ocrData.totalAmount || itemAudits.reduce((sum, item) => sum + item.totalPrice, 0);
    const qualifiedItems = itemAudits.filter((item) => item.isQualified);
    const unqualifiedItems = itemAudits.filter((item) => !item.isQualified);

    const summary = {
      totalAmount: Math.round(totalAmount * 100) / 100,
      qualifiedAmount: Math.round(
        qualifiedItems.reduce((sum, item) => sum + item.totalPrice, 0) * 100
      ) / 100,
      unqualifiedAmount: Math.round(
        unqualifiedItems.reduce((sum, item) => sum + item.totalPrice, 0) * 100
      ) / 100,
      qualifiedItemCount: qualifiedItems.length,
      unqualifiedItemCount: unqualifiedItems.length,
      estimatedReimbursement: Math.round(
        itemAudits.reduce((sum, item) => sum + item.estimatedReimbursement, 0) * 100
      ) / 100,
    };

    stepLogs.push({
      step: 'summary',
      input: { itemAuditsCount: itemAudits.length },
      output: summary,
      duration: Date.now() - summaryStart,
      timestamp: new Date().toISOString()
    });

    // ─── 步骤 5: 构建并保存审核结果 ─────────────────
    const result: InvoiceAuditResult = {
      invoiceId,
      ossUrl,
      ossKey,
      uploadTime,
      claimCaseId,
      ocrData,
      hospitalValidation,
      itemAudits,
      summary,
      auditStatus: 'completed',
      auditTime: new Date().toISOString(),
      aiLog,
      stepLogs,
      validationWarnings,
    };

    // 持久化保存审核结果
    try {
      await api.invoiceAudits.add(result);
    } catch (err) {
      console.warn('保存审核结果失败，但审核流程已完成:', err);
    }

    onProgress?.('done');

    return result;
  } catch (error) {
    // 任一步骤失败，返回部分结果并标记为失败
    console.error('发票审核流程失败:', error);
    onProgress?.('error');

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
  model: 'gemini' | 'glm-ocr' = 'gemini',
  claimCaseId?: string,
  onProgress?: (step: AuditStep, detail?: string) => void
): Promise<InvoiceAuditResult> => {
  const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const uploadTime = new Date().toISOString();

  // 初始化部分结果
  let ocrData: MedicalInvoiceData | undefined;
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
  let imageOcrResults: InvoiceImageOcrResult[] = [];
  let summaryChargeItems: MedicalInvoiceData['chargeItems'] = [];
  let crossValidation: InvoiceAuditResult['crossValidation'] | undefined;

  // 第一张图片的 OSS 信息（向后兼容）
  let ossUrl = '';
  let ossKey = '';

  try {
    // ─── 步骤 0: 并行上传所有图片到 OSS ───────────────
    onProgress?.('ocr', `上传图片中 (0/${images.length})`);

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

    // 取第一张图片的 OSS 信息（向后兼容 ossUrl/ossKey）
    ossUrl = ossResults[0]?.url || '';
    ossKey = ossResults[0]?.objectKey || '';

    // ─── 步骤 1: 逐张 OCR 识别 ───────────────────────
    const ocrStart = Date.now();

    const ocrResults = await recognizeMultipleInvoiceImages(
      images.map((file) => ({ source: file, fileName: file.name })),
      model,
      (completed, total) => {
        onProgress?.('ocr', `发票识别中 (${completed}/${total})`);
      }
    );

    // 构建 InvoiceImageOcrResult[]
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
          fileName: r.fileName,
          documentType: r.documentType,
          chargeItemCount: r.ocrData.chargeItems?.length || 0,
        })),
      },
      duration: Date.now() - ocrStart,
      timestamp: new Date().toISOString(),
    });

    // ─── 步骤 1.5: 多图合并 ─────────────────────────
    const mergeResult = mergeMultiImageOcrResults(imageOcrResults);
    ocrData = mergeResult.mergedData;
    summaryChargeItems = mergeResult.summaryChargeItems;
    crossValidation = mergeResult.crossValidation;

    if (!ocrData.chargeItems || ocrData.chargeItems.length === 0) {
      throw new Error('所有图片中均未识别到费用明细项目');
    }

    // 如果汇总 vs 明细金额不一致，生成警告
    if (crossValidation && !crossValidation.isConsistent) {
      validationWarnings.push({
        type: 'summary_detail_mismatch',
        severity: 'warning',
        message: `汇总发票金额 (${crossValidation.summaryTotal.toFixed(2)}) 与明细合计 (${crossValidation.detailItemsTotal.toFixed(2)}) 存在 ${crossValidation.difference.toFixed(2)} 元差异`,
        details: {
          expected: crossValidation.summaryTotal,
          actual: crossValidation.detailItemsTotal,
          difference: crossValidation.difference,
        },
      });
    }

    // ─── 步骤 1.75: OCR 后置验证（对合并后的明细项） ─────
    const validationResult = validateAndFixOcrResult(ocrData);
    Object.assign(ocrData, validationResult.fixedData);
    validationWarnings = [...validationWarnings, ...validationResult.warnings];

    // ─── 步骤 2: 医院资质校验 ───────────────────────
    onProgress?.('hospital');
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

    // ─── 步骤 3: 医保目录匹配（仅明细项） ──────────────
    onProgress?.('catalog');
    const catalogStart = Date.now();

    let catalogData: MedicalInsuranceCatalogItem[] = [];
    try {
      catalogData = await api.medicalInsuranceCatalog.list() as MedicalInsuranceCatalogItem[];
    } catch (err) {
      console.warn('获取医保目录数据失败:', err);
    }

    itemAudits = [];
    const matchLogs: any[] = [];

    for (const chargeItem of ocrData.chargeItems) {
      const { itemName, quantity, unitPrice, totalPrice } = chargeItem;
      const category = inferItemCategory(itemName);

      let catalogMatch: InvoiceItemAudit['catalogMatch'];
      try {
        catalogMatch = await matchCatalogItem(itemName, province, category, catalogData);
      } catch (err) {
        console.warn(`目录匹配失败 [${itemName}]:`, err);
        catalogMatch = { matched: false, matchConfidence: 0, matchMethod: 'none' };
      }

      matchLogs.push({ itemName, category, matchResult: catalogMatch });

      const qualification = determineQualification(catalogMatch, totalPrice, catalogMatch.matchedItem);

      itemAudits.push({
        itemName,
        quantity,
        unitPrice,
        totalPrice,
        catalogMatch,
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

    // ─── 步骤 4: 汇总统计 ──────────────────────────
    onProgress?.('summary');
    const summaryStart = Date.now();

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
      duration: Date.now() - summaryStart,
      timestamp: new Date().toISOString(),
    });

    // ─── 步骤 5: 构建并保存审核结果 ─────────────────
    const result: InvoiceAuditResult = {
      invoiceId,
      ossUrl,
      ossKey,
      uploadTime,
      claimCaseId,
      ocrData,
      hospitalValidation,
      itemAudits,
      summary,
      auditStatus: 'completed',
      auditTime: new Date().toISOString(),
      aiLog: imageOcrResults[0]?.aiLog,
      stepLogs,
      validationWarnings,
      // 多图字段
      imageCount: images.length,
      imageOcrResults,
      summaryChargeItems: summaryChargeItems.length > 0 ? summaryChargeItems : undefined,
      crossValidation,
    };

    try {
      await api.invoiceAudits.add(result);
    } catch (err) {
      console.warn('保存审核结果失败，但审核流程已完成:', err);
    }

    onProgress?.('done');
    return result;
  } catch (error) {
    console.error('多图发票审核流程失败:', error);
    onProgress?.('error');

    const failedResult: InvoiceAuditResult = {
      invoiceId,
      ossUrl,
      ossKey,
      uploadTime,
      claimCaseId,
      ocrData: ocrData || { basicInfo: { name: '', age: '' }, chargeItems: [] },
      hospitalValidation,
      itemAudits,
      summary,
      auditStatus: 'failed',
      auditTime: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : '审核过程中发生未知错误',
      aiLog: imageOcrResults[0]?.aiLog,
      stepLogs,
      validationWarnings,
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
// 审核历史查询
// ============================================================

/**
 * 获取审核历史记录列表
 * @returns 审核结果列表
 */
export const getAuditHistory = async (): Promise<InvoiceAuditResult[]> => {
  return api.invoiceAudits.list() as Promise<InvoiceAuditResult[]>;
};
