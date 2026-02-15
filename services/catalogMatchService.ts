import { GoogleGenAI } from "@google/genai";
import { MedicalInsuranceCatalogItem, InvoiceItemAudit } from '../types';

// ============================================================
// AI 匹配配置
// ============================================================

/** batchMatchCatalogItems 的选项 */
export interface BatchMatchOptions {
  /** 是否启用 AI 语义匹配（Level 4），默认 true */
  enableAiMatch?: boolean;
  /** 批量 AI 匹配时每批的最大项目数，默认 15 */
  aiBatchSize?: number;
  /** 匹配进度回调 */
  onProgress?: (detail: string) => void;
}

// 获取 Gemini AI 实例
const getAI = () => {
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key not found');
  }
  return new GoogleGenAI({ apiKey });
};

// ============================================================
// 名称兼容化：常见缩写映射表
// ============================================================
const ABBREVIATION_MAP: Record<string, string> = {
  'MRI': '核磁共振检查',
  'CT': 'CT检查',
  'B超': 'B型超声检查',
  'ECG': '心电图检查',
  'EEG': '脑电图检查',
  'EMG': '肌电图检查',
  'X光': 'X线检查',
  'X线': 'X线检查',
  'DR': '数字化X线摄影',
  '彩超': '彩色多普勒超声检查',
  '血常规': '血细胞分析',
  '尿常规': '尿液分析',
  '肝功': '肝功能检查',
  '肾功': '肾功能检查',
  '血糖': '血糖测定',
  '血脂': '血脂检查',
  '心超': '心脏超声检查',
  '胃镜': '电子胃镜检查',
  '肠镜': '电子肠镜检查',
};

// ============================================================
// 名称兼容化：常见商品名→通用名映射表
// ============================================================
const TRADE_TO_GENERIC: Record<string, string> = {
  // 解热镇痛类
  '泰诺林': '对乙酰氨基酚',
  '百服宁': '对乙酰氨基酚',
  '必理通': '对乙酰氨基酚',
  '扑热息痛': '对乙酰氨基酚',
  '日夜百服宁': '酚麻美敏',
  '芬必得': '布洛芬缓释胶囊',
  '美林': '布洛芬混悬液',
  '拜阿司匹灵': '阿司匹林肠溶片',
  '巴米尔': '阿司匹林',
  // 抗生素类
  '阿奇霉素分散片': '阿奇霉素',
  '希舒美': '阿奇霉素',
  '再林': '阿莫西林',
  '联邦阿莫仙': '阿莫西林',
  '世福素': '头孢克肟',
  '达力新': '头孢呋辛酯',
  '罗氏芬': '头孢曲松钠',
  // 消化系统类
  '洛赛克': '奥美拉唑',
  '耐信': '艾司奥美拉唑',
  '达喜': '铝碳酸镁',
  '吗丁啉': '多潘立酮',
  '蒙脱石散': '思密达',
  '思密达': '蒙脱石散',
  // 心血管类
  '波立维': '氯吡格雷',
  '立普妥': '阿托伐他汀',
  '可定': '瑞舒伐他汀',
  '拜新同': '硝苯地平控释片',
  '络活喜': '苯磺酸氨氯地平',
  '代文': '缬沙坦',
  '倍他乐克': '美托洛尔',
  // 降糖类
  '格华止': '盐酸二甲双胍',
  '拜唐苹': '阿卡波糖',
  // 抗过敏类
  '开瑞坦': '氯雷他定',
  '仙特明': '西替利嗪',
  // 维生素类
  'VC': '维生素C',
  'VB': '维生素B',
  'VD': '维生素D',
  'VE': '维生素E',
};

// ============================================================
// 名称标准化预处理
// ============================================================

/**
 * 对项目名称做标准化处理，消除常见的文字差异
 * 处理：去除多余空格、统一大小写、统一全半角字符、统一剂量单位
 */
export const normalizeItemName = (name: string): string => {
  let normalized = name;

  // 1. 去除首尾空格，合并中间多余空格
  normalized = normalized.trim().replace(/\s+/g, '');

  // 2. 统一全角字符为半角
  normalized = normalized.replace(/[\uff01-\uff5e]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );

  // 3. 统一中文括号为英文括号
  normalized = normalized.replace(/（/g, '(').replace(/）/g, ')');

  // 4. 统一英文为小写（保留中文）
  normalized = normalized.toLowerCase();

  // 5. 统一剂量单位表述
  // 500mg → 0.5g, 250mg → 0.25g (标准化为 g)
  normalized = normalized.replace(/(\d+)mg/g, (_, num) => {
    const grams = parseInt(num) / 1000;
    return grams >= 1 ? `${grams}g` : `${grams}g`;
  });

  // 6. 去除常见无关后缀
  normalized = normalized.replace(/\(.*?\)$/g, ''); // 去除末尾括号内容
  normalized = normalized.replace(/（.*?）$/g, '');

  return normalized;
};

// ============================================================
// 别名匹配
// ============================================================

/**
 * 通过别名（商品名、曾用名、缩写等）匹配目录项
 * 检查顺序：
 *   1. 目录项自身的 aliases 字段
 *   2. 内置商品名→通用名映射表
 *   3. 内置缩写映射表
 */
export const matchByAlias = (
  itemName: string,
  province: string,
  category: 'drug' | 'treatment' | 'material',
  catalogData: MedicalInsuranceCatalogItem[]
): MedicalInsuranceCatalogItem | undefined => {
  const normalizedInput = normalizeItemName(itemName);

  // Filter relevant catalog items by province and category
  const relevantItems = catalogData.filter(
    item =>
      (item.province === province || item.province === 'national') &&
      item.category === category
  );

  // 1. 检查目录项的 aliases 字段
  for (const item of relevantItems) {
    if (item.aliases && item.aliases.length > 0) {
      for (const alias of item.aliases) {
        if (normalizeItemName(alias) === normalizedInput) {
          return item;
        }
      }
    }
    // 也检查 genericName 字段
    if (item.genericName && normalizeItemName(item.genericName) === normalizedInput) {
      return item;
    }
  }

  // 2. 内置商品名→通用名映射
  const mappedGenericName = TRADE_TO_GENERIC[itemName] || TRADE_TO_GENERIC[normalizedInput];
  if (mappedGenericName) {
    const normalizedGeneric = normalizeItemName(mappedGenericName);
    const match = relevantItems.find(
      item => normalizeItemName(item.name) === normalizedGeneric
    );
    if (match) return match;

    // 也尝试在 genericName 字段中查找
    const genericMatch = relevantItems.find(
      item => item.genericName && normalizeItemName(item.genericName) === normalizedGeneric
    );
    if (genericMatch) return genericMatch;
  }

  // 3. 内置缩写映射
  const mappedFullName = ABBREVIATION_MAP[itemName] || ABBREVIATION_MAP[normalizedInput];
  if (mappedFullName) {
    const normalizedFull = normalizeItemName(mappedFullName);
    const match = relevantItems.find(
      item => normalizeItemName(item.name) === normalizedFull
    );
    if (match) return match;
  }

  return undefined;
};

// ============================================================
// 同步快速匹配（Level 1-3 仅内存操作）
// ============================================================

/**
 * 同步匹配医保目录项（仅 Level 1-3，不含 AI）
 *
 * 匹配流程：
 * 1. 标准化精确匹配 — normalize 后名称完全一致
 * 2. 别名匹配 — aliases 字段 + 内置商品名/缩写映射表
 * 3. 模糊匹配 — 标准化后名称包含关系
 *
 * @returns 匹配结果，如果 Level 1-3 都未命中则返回 null（需要 AI 匹配）
 */
export const matchCatalogItemSync = (
  itemName: string,
  province: string,
  category: 'drug' | 'treatment' | 'material',
  catalogData: MedicalInsuranceCatalogItem[]
): InvoiceItemAudit['catalogMatch'] | null => {
  const normalizedInput = normalizeItemName(itemName);

  // ─── Level 1: 标准化精确匹配 ────────────────────
  const exactMatch = catalogData.find(
    item =>
      normalizeItemName(item.name) === normalizedInput &&
      (item.province === province || item.province === 'national') &&
      item.category === category
  );

  if (exactMatch) {
    return {
      matched: true,
      matchedItem: exactMatch,
      matchConfidence: 100,
      matchMethod: 'exact'
    };
  }

  // ─── Level 2: 别名匹配 ─────────────────────────
  const aliasMatch = matchByAlias(itemName, province, category, catalogData);
  if (aliasMatch) {
    return {
      matched: true,
      matchedItem: aliasMatch,
      matchConfidence: 95,
      matchMethod: 'alias'
    };
  }

  // ─── Level 3: 模糊匹配（名称包含关系）──────────
  const partialMatch = catalogData.find(
    item => {
      const normalizedCatalog = normalizeItemName(item.name);
      return (
        (normalizedCatalog.includes(normalizedInput) || normalizedInput.includes(normalizedCatalog)) &&
        (item.province === province || item.province === 'national') &&
        item.category === category
      );
    }
  );

  if (partialMatch) {
    return {
      matched: true,
      matchedItem: partialMatch,
      matchConfidence: 85,
      matchMethod: 'fuzzy'
    };
  }

  // 对"治疗费"等宽泛名称，不进入 AI 匹配
  const strictNames = ['治疗费', '诊查费', '诊察费', '检查费'];
  const isStrictName = strictNames.some(name => normalizeItemName(name) === normalizedInput);
  if (isStrictName) {
    return {
      matched: false,
      matchConfidence: 0,
      matchMethod: 'none'
    };
  }

  // Level 1-3 均未命中，返回 null 表示需要 AI 匹配
  return null;
};

// ============================================================
// 批量 AI 语义匹配
// ============================================================

/**
 * 批量 AI 语义匹配 — 将多个未匹配项合并到一次 Gemini 请求
 *
 * 原来：N 项 × 1 次请求 = N 次 API 调用
 * 现在：N 项 ÷ batchSize = ceil(N/batchSize) 次 API 调用
 *
 * @param unmatchedItems - Level 1-3 未命中的项目列表
 * @param province - 省份代码
 * @param catalogData - 医保目录数据
 * @param batchSize - 每批最大项目数（默认 15）
 * @param aiConfidenceThreshold - AI 置信度阈值（默认 80）
 * @returns Map<itemName, catalogMatch>
 */
const batchAiSemanticMatch = async (
  unmatchedItems: Array<{ itemName: string; category: 'drug' | 'treatment' | 'material' }>,
  province: string,
  catalogData: MedicalInsuranceCatalogItem[],
  batchSize: number = 15,
  aiConfidenceThreshold: number = 80,
  onBatchProgress?: (completedItems: number, totalItems: number) => void
): Promise<Map<string, InvoiceItemAudit['catalogMatch']>> => {
  const resultMap = new Map<string, InvoiceItemAudit['catalogMatch']>();

  if (unmatchedItems.length === 0) return resultMap;

  // 按 category 分组，同类别共享一份目录列表
  const categoryGroups = new Map<string, Array<{ itemName: string; category: 'drug' | 'treatment' | 'material' }>>();
  for (const item of unmatchedItems) {
    const group = categoryGroups.get(item.category) || [];
    group.push(item);
    categoryGroups.set(item.category, group);
  }

  let completedCount = 0;

  for (const [category, items] of categoryGroups) {
    // 筛选该类别相关的目录项
    const relevantCatalog = catalogData
      .filter(item =>
        (item.province === province || item.province === 'national') &&
        item.category === category
      )
      .slice(0, 100);

    if (relevantCatalog.length === 0) {
      // 无可匹配目录，全部标记为未匹配
      for (const item of items) {
        resultMap.set(item.itemName, { matched: false, matchConfidence: 0, matchMethod: 'none' });
      }
      completedCount += items.length;
      onBatchProgress?.(completedCount, unmatchedItems.length);
      continue;
    }

    const catalogList = relevantCatalog
      .map(item => {
        const aliasStr = item.aliases?.length ? ` (别名: ${item.aliases.join('、')})` : '';
        return `- ${item.name}${aliasStr} (编码: ${item.code}, 类型: ${item.type})`;
      })
      .join('\n');

    // 分批处理
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      try {
        const ai = getAI();
        const model = 'gemini-2.5-flash';

        const itemListStr = batch
          .map((item, idx) => `${idx + 1}. "${item.itemName}"`)
          .join('\n');

        const prompt = `你是一位中国医保药品/诊疗项目专家。请从以下医保目录中找出与每个给定项目最匹配的条目。

注意事项：
1. 药品可能使用商品名、通用名或别名，需要识别它们之间的对应关系
2. 如"泰诺林"="对乙酰氨基酚"，"芬必得"="布洛芬缓释胶囊"
3. 注意规格表述差异：如"500mg"="0.5g"
4. 注意简称缩写：如"MRI"="核磁共振检查"
5. 考虑剂型差异：同通用名不同剂型也算匹配（如胶囊vs片剂）

医保目录：
${catalogList}

待匹配项目：
${itemListStr}

请返回 JSON 数组格式（每项一个结果）：
[
  { "index": 1, "matchedCode": "医保编码或null", "confidence": 0-100, "reason": "匹配理由" },
  ...
]

规则：
- 置信度低于 ${aiConfidenceThreshold} 时 matchedCode 必须为 null
- 必须为每个待匹配项目返回一条结果
- index 对应待匹配项目的序号（从 1 开始）`;

        const response = await ai.models.generateContent({
          model,
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            temperature: 0.1
          }
        });

        const batchResults = JSON.parse(response.text || '[]');
        const resultsArray = Array.isArray(batchResults) ? batchResults : [batchResults];

        // 解析批量结果
        for (const res of resultsArray) {
          const idx = (res.index || 1) - 1; // 转为 0-based
          if (idx < 0 || idx >= batch.length) continue;

          const item = batch[idx];
          if (res.matchedCode && res.confidence >= aiConfidenceThreshold) {
            const aiMatch = relevantCatalog.find(c => c.code === res.matchedCode);
            if (aiMatch) {
              resultMap.set(item.itemName, {
                matched: true,
                matchedItem: aiMatch,
                matchConfidence: res.confidence,
                matchMethod: 'ai'
              });
              continue;
            }
          }
          resultMap.set(item.itemName, {
            matched: false,
            matchConfidence: res.confidence || 0,
            matchMethod: 'none'
          });
        }

        // 确保批次中所有项目都有结果（防止 AI 漏返回）
        for (const item of batch) {
          if (!resultMap.has(item.itemName)) {
            resultMap.set(item.itemName, { matched: false, matchConfidence: 0, matchMethod: 'none' });
          }
        }
      } catch (error) {
        console.error('Batch AI semantic matching failed:', error);
        // 本批全部标记为未匹配
        for (const item of batch) {
          if (!resultMap.has(item.itemName)) {
            resultMap.set(item.itemName, { matched: false, matchConfidence: 0, matchMethod: 'none' });
          }
        }
      }

      completedCount += batch.length;
      onBatchProgress?.(completedCount, unmatchedItems.length);
    }
  }

  return resultMap;
};

// ============================================================
// 核心匹配函数（5级匹配策略）
// ============================================================

/**
 * 匹配医保目录项（增强版 5 级匹配）
 *
 * 匹配流程：
 * 1. 标准化精确匹配 — normalize 后名称完全一致
 * 2. 别名匹配 — aliases 字段 + 内置商品名/缩写映射表
 * 3. 模糊匹配 — 标准化后名称包含关系
 * 4. AI 语义匹配 — Gemini AI（置信度 ≥ 60）
 * 5. 未匹配
 *
 * @param itemName - 发票上的费用项目名称
 * @param province - 省份代码
 * @param category - 类别（drug/treatment/material）
 * @param catalogData - 医保目录数据
 * @returns 匹配结果
 */
export const matchCatalogItem = async (
  itemName: string,
  province: string,
  category: 'drug' | 'treatment' | 'material',
  catalogData: MedicalInsuranceCatalogItem[]
): Promise<InvoiceItemAudit['catalogMatch']> => {

  // 先尝试同步快速匹配（Level 1-3）
  const syncResult = matchCatalogItemSync(itemName, province, category, catalogData);
  if (syncResult) return syncResult;

  const aiConfidenceThreshold = 80;

  // ─── Level 4: AI 语义匹配 ─────────────────────
  try {
    const ai = getAI();
    const model = 'gemini-2.5-flash';

    // 筛选相关省份和类别的目录项
    const relevantCatalog = catalogData
      .filter(item =>
        (item.province === province || item.province === 'national') &&
        item.category === category
      )
      .slice(0, 100);

    if (relevantCatalog.length === 0) {
      return {
        matched: false,
        matchConfidence: 0,
        matchMethod: 'none'
      };
    }

    const catalogList = relevantCatalog
      .map(item => {
        const aliasStr = item.aliases?.length ? ` (别名: ${item.aliases.join('、')})` : '';
        return `- ${item.name}${aliasStr} (编码: ${item.code}, 类型: ${item.type})`;
      })
      .join('\n');

    const prompt = `你是一位中国医保药品/诊疗项目专家。请从以下医保目录中找出与"${itemName}"最匹配的项目。

注意事项：
1. 药品可能使用商品名、通用名或别名，需要识别它们之间的对应关系
2. 如"泰诺林"="对乙酰氨基酚"，"芬必得"="布洛芬缓释胶囊"
3. 注意规格表述差异：如"500mg"="0.5g"
4. 注意简称缩写：如"MRI"="核磁共振检查"
5. 考虑剂型差异：同通用名不同剂型也算匹配（如胶囊vs片剂）

医保目录：
${catalogList}

请返回 JSON 格式：
{
  "matchedCode": "医保编码（如果找到匹配项）或 null（如果没有匹配项）",
  "confidence": 0-100,
  "reason": "匹配理由或不匹配原因"
}

置信度低于 ${aiConfidenceThreshold} 时返回 matchedCode 为 null。`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });

    const result = JSON.parse(response.text || '{}');

    if (result.matchedCode && result.confidence >= aiConfidenceThreshold) {
      const aiMatch = relevantCatalog.find(item => item.code === result.matchedCode);
      if (aiMatch) {
        return {
          matched: true,
          matchedItem: aiMatch,
          matchConfidence: result.confidence,
          matchMethod: 'ai'
        };
      }
    }

    return {
      matched: false,
      matchConfidence: result.confidence || 0,
      matchMethod: 'none'
    };
  } catch (error) {
    console.error('AI semantic matching failed:', error);
    return {
      matched: false,
      matchConfidence: 0,
      matchMethod: 'none'
    };
  }
};

/**
 * 批量匹配医保目录项（两阶段优化版）
 *
 * 阶段一：同步快速匹配（Level 1-3，纯内存操作）
 * 阶段二：批量 AI 语义匹配（将未命中项合并到少量 API 请求中）
 *
 * 对比旧版（逐项 AI）：
 * - 100 项中 70 项需 AI：旧版 70 次 API → 新版 ~5 次 API（每批 15 项）
 *
 * @param items - 费用项目列表
 * @param province - 省份代码
 * @param catalogData - 医保目录数据
 * @param options - 可选配置（是否启用 AI、批次大小、进度回调）
 * @returns 匹配结果列表（与 items 顺序一一对应）
 */
export const batchMatchCatalogItems = async (
  items: Array<{ itemName: string; category: 'drug' | 'treatment' | 'material' }>,
  province: string,
  catalogData: MedicalInsuranceCatalogItem[],
  options?: BatchMatchOptions
): Promise<Array<InvoiceItemAudit['catalogMatch']>> => {
  const { enableAiMatch = true, aiBatchSize = 15, onProgress } = options || {};

  // ─── 阶段一：同步快速匹配（Level 1-3）────────────
  const syncResults = new Map<number, InvoiceItemAudit['catalogMatch']>();
  const unmatchedItems: Array<{ index: number; itemName: string; category: 'drug' | 'treatment' | 'material' }> = [];

  for (let i = 0; i < items.length; i++) {
    const syncMatch = matchCatalogItemSync(items[i].itemName, province, items[i].category, catalogData);
    if (syncMatch) {
      syncResults.set(i, syncMatch);
    } else {
      unmatchedItems.push({ index: i, ...items[i] });
    }
  }

  const syncHitCount = syncResults.size;
  onProgress?.(`快速匹配 ${syncHitCount}/${items.length} 项命中，${unmatchedItems.length} 项待 AI 匹配`);

  // ─── 阶段二：批量 AI 语义匹配（仅对未命中项）─────
  if (unmatchedItems.length > 0 && enableAiMatch) {
    onProgress?.(`AI 语义匹配中 (0/${unmatchedItems.length})...`);

    const aiResults = await batchAiSemanticMatch(
      unmatchedItems.map(({ itemName, category }) => ({ itemName, category })),
      province,
      catalogData,
      aiBatchSize,
      80,
      (completed, total) => {
        onProgress?.(`AI 语义匹配中 (${completed}/${total})...`);
      }
    );

    for (const item of unmatchedItems) {
      const aiResult = aiResults.get(item.itemName);
      syncResults.set(item.index, aiResult || { matched: false, matchConfidence: 0, matchMethod: 'none' });
    }
  } else if (unmatchedItems.length > 0 && !enableAiMatch) {
    // AI 匹配已关闭，未命中项全部标记为 none
    onProgress?.(`AI 匹配已关闭，${unmatchedItems.length} 项未匹配`);
    for (const item of unmatchedItems) {
      syncResults.set(item.index, { matched: false, matchConfidence: 0, matchMethod: 'none' });
    }
  }

  // 按原顺序返回结果
  return items.map((_, i) => syncResults.get(i)!);
};

/**
 * 根据费用项目名称推断类别
 * @param itemName - 费用项目名称
 * @returns 推断的类别
 */
export const inferItemCategory = (itemName: string): 'drug' | 'treatment' | 'material' => {
  // 药品关键词
  const drugKeywords = ['片', '胶囊', '注射液', '颗粒', '口服液', '软膏', '滴眼液', '喷雾剂', '糖浆',
    '丸', '散', '膏', '酊', '栓', '贴', '缓释', '肠溶', '混悬', '乳剂', '冻干粉'];
  // 诊疗项目关键词
  const treatmentKeywords = ['检查', '化验', 'CT', 'MRI', 'B超', '手术', '治疗', '护理', '诊查',
    '透视', '造影', '穿刺', '活检', '镜检', '心电图', '脑电图', '超声', '放疗', '化疗',
    '康复', '理疗', '针灸', '推拿', '按摩', '拔罐', '采血', '输血', '麻醉', '监护',
    '试验', '测定'];
  // 耗材关键词（含医疗服务设施）
  const materialKeywords = ['输液器', '注射器', '导管', '纱布', '绷带', '敷料', '支架', '缝线',
    '导丝', '球囊', '引流', '氧气', '床位', '陪护', '空调', '取暖', '护理费',
    '膜', '钉', '板', '假体', '植入物', '吻合器'];

  // 检查是否包含药品关键词
  if (drugKeywords.some(keyword => itemName.includes(keyword))) {
    return 'drug';
  }

  // 检查是否包含诊疗项目关键词（包括缩写/大小写不敏感匹配）
  const upperName = itemName.toUpperCase();
  if (treatmentKeywords.some(keyword => itemName.includes(keyword) || upperName.includes(keyword.toUpperCase()))) {
    return 'treatment';
  }

  // 检查是否包含耗材关键词
  if (materialKeywords.some(keyword => itemName.includes(keyword))) {
    return 'material';
  }

  // 通过缩写映射表判断
  if (ABBREVIATION_MAP[itemName]) {
    return 'treatment';
  }

  // 通过商品名映射表判断（如果能映射到通用名，说明是药品）
  if (TRADE_TO_GENERIC[itemName]) {
    return 'drug';
  }

  // 默认返回药品（因为药品最常见）
  return 'drug';
};

/**
 * 计算预估报销金额
 * @param totalPrice - 总价
 * @param matchedItem - 匹配的医保目录项
 * @returns 预估报销金额
 */
export const calculateEstimatedReimbursement = (
  totalPrice: number,
  matchedItem?: MedicalInsuranceCatalogItem
): number => {
  if (!matchedItem || matchedItem.type === 'excluded') {
    return 0;
  }

  const reimbursementRatio = matchedItem.reimbursementRatio || 0;
  return Math.round(totalPrice * (reimbursementRatio / 100) * 100) / 100;
};
