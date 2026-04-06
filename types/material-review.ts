import { ProcessedFileExtended, AnyDocumentSummary } from '../types';

/**
 * 材料视图模式
 * - category: 按材料类型分类展示
 * - timeline: 按上传时间轴展示
 * - list: 按清单列表展示
 * - ai_review: AI审核视图（双栏布局）
 */
export type MaterialViewMode = 'category' | 'timeline' | 'list' | 'ai_review';

/**
 * 材料分类类型
 */
export enum MaterialCategory {
  IDENTITY = 'identity',      // 身份证明材料
  MEDICAL = 'medical',        // 医疗材料
  ACCIDENT = 'accident',      // 事故材料
  INCOME = 'income',          // 收入材料
  OTHER = 'other',            // 其他材料
}

/**
 * 材料分类标签映射
 */
export const MaterialCategoryLabels: Record<MaterialCategory, string> = {
  [MaterialCategory.IDENTITY]: '身份证明',
  [MaterialCategory.MEDICAL]: '医疗材料',
  [MaterialCategory.ACCIDENT]: '事故材料',
  [MaterialCategory.INCOME]: '收入材料',
  [MaterialCategory.OTHER]: '其他材料',
};

/**
 * 材料视图项 - 扩展 ProcessedFileExtended 用于视图展示
 */
export interface MaterialViewItem extends ProcessedFileExtended {
  /** 视图特定的排序时间戳 */
  sortTimestamp: number;
  /** 材料分类 */
  category: MaterialCategory;
  /** 是否已审核 */
  isReviewed: boolean;
}

/**
 * 视图切换配置
 */
export interface ViewSwitcherConfig {
  mode: MaterialViewMode;
  label: string;
  icon: string;
  count?: number;
}

/**
 * 分类视图分组结果
 */
export interface CategoryGroup {
  category: MaterialCategory;
  label: string;
  materials: MaterialViewItem[];
  count: number;
}

/**
 * 时间轴视图分组结果
 */
export interface TimelineGroup {
  date: string;
  label: string;
  materials: MaterialViewItem[];
  count: number;
}

/**
 * 材料分类映射配置
 * 根据材料名称关键词映射到分类
 */
const MaterialCategoryMapping: Array<{
  keywords: string[];
  category: MaterialCategory;
}> = [
  {
    keywords: ['身份证', '户口本', '护照', '身份', '证件', 'ID'],
    category: MaterialCategory.IDENTITY,
  },
  {
    keywords: ['病历', '诊断', '发票', '费用', '医疗', '住院', '门诊', '处方', '检查', '化验', '出院', '入院'],
    category: MaterialCategory.MEDICAL,
  },
  {
    keywords: ['责任认定', '事故', '现场', '交警', '认定书', '照片', '影像'],
    category: MaterialCategory.ACCIDENT,
  },
  {
    keywords: ['收入', '工资', '纳税', '误工', '证明', '银行', '流水', '薪资'],
    category: MaterialCategory.INCOME,
  },
];

/**
 * 根据材料名称判断分类
 * @param materialName - 材料名称
 * @returns 材料分类
 */
export function getMaterialCategory(materialName: string): MaterialCategory {
  const lowerName = materialName.toLowerCase();
  
  for (const mapping of MaterialCategoryMapping) {
    if (mapping.keywords.some(keyword => lowerName.includes(keyword.toLowerCase()))) {
      return mapping.category;
    }
  }
  
  return MaterialCategory.OTHER;
}

/**
 * 将 ProcessedFileExtended 转换为 MaterialViewItem
 * @param file - 原始文件数据
 * @returns 视图项
 */
export function toMaterialViewItem(file: ProcessedFileExtended): MaterialViewItem {
  let timestamp = Date.now();
  if (file.dateFrom) {
    timestamp = new Date(file.dateFrom).getTime();
  } else if (file.dateTo) {
    timestamp = new Date(file.dateTo).getTime();
  }
  
  const materialName = file.classification?.materialName || file.fileName || '';
  
  return {
    ...file,
    sortTimestamp: timestamp,
    category: getMaterialCategory(materialName),
    isReviewed: file.status === 'completed' && file.classification?.materialId !== 'unknown',
  };
}

/**
 * 按分类分组材料
 * @param materials - 材料列表
 * @returns 分组结果
 */
export function groupMaterialsByCategory(
  materials: MaterialViewItem[]
): CategoryGroup[] {
  const groups = new Map<MaterialCategory, MaterialViewItem[]>();
  
  // 初始化所有分类组（保持顺序）
  const orderedCategories = [
    MaterialCategory.IDENTITY,
    MaterialCategory.MEDICAL,
    MaterialCategory.ACCIDENT,
    MaterialCategory.INCOME,
    MaterialCategory.OTHER,
  ];
  
  orderedCategories.forEach(cat => groups.set(cat, []));
  
  // 分组
  materials.forEach(material => {
    const group = groups.get(material.category);
    if (group) {
      group.push(material);
    }
  });
  
  // 构建结果
  return orderedCategories
    .map(category => ({
      category,
      label: MaterialCategoryLabels[category],
      materials: groups.get(category) || [],
      count: (groups.get(category) || []).length,
    }))
    .filter(group => group.count > 0); // 过滤空组
}

/**
 * 按时间分组材料
 * @param materials - 材料列表
 * @returns 分组结果（按时间倒序）
 */
export function groupMaterialsByTime(
  materials: MaterialViewItem[]
): TimelineGroup[] {
  // 按时间倒序排序
  const sorted = [...materials].sort((a, b) => b.sortTimestamp - a.sortTimestamp);
  
  const groups = new Map<string, MaterialViewItem[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  sorted.forEach(material => {
    const date = new Date(material.sortTimestamp);
    date.setHours(0, 0, 0, 0);
    
    let key: string;
    let label: string;
    
    if (date.getTime() === today.getTime()) {
      key = 'today';
      label = '今天';
    } else if (date.getTime() === yesterday.getTime()) {
      key = 'yesterday';
      label = '昨天';
    } else {
      key = date.toISOString().split('T')[0];
      label = `${date.getMonth() + 1}月${date.getDate()}日`;
    }
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(material);
  });
  
  // 构建结果（保持时间倒序）
  const result: TimelineGroup[] = [];
  
  // 今天
  if (groups.has('today')) {
    result.push({
      date: 'today',
      label: '今天',
      materials: groups.get('today')!,
      count: groups.get('today')!.length,
    });
  }
  
  // 昨天
  if (groups.has('yesterday')) {
    result.push({
      date: 'yesterday',
      label: '昨天',
      materials: groups.get('yesterday')!,
      count: groups.get('yesterday')!.length,
    });
  }
  
  // 更早的日期（按时间倒序）
  const dateKeys = Array.from(groups.keys())
    .filter(key => key !== 'today' && key !== 'yesterday')
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  dateKeys.forEach(key => {
    const date = new Date(key);
    result.push({
      date: key,
      label: `${date.getMonth() + 1}月${date.getDate()}日`,
      materials: groups.get(key)!,
      count: groups.get(key)!.length,
    });
  });
  
  return result;
}

/**
 * 按时间排序材料
 * @param materials - 材料列表
 * @param ascending - 是否升序（默认倒序，最新的在前）
 * @returns 排序后的列表
 */
export function sortMaterialsByTime(
  materials: MaterialViewItem[],
  ascending = false
): MaterialViewItem[] {
  return [...materials].sort((a, b) => {
    const diff = a.sortTimestamp - b.sortTimestamp;
    return ascending ? diff : -diff;
  });
}

/**
 * 获取材料状态标签
 * @param material - 材料项
 * @returns 状态标签和颜色
 */
export function getMaterialStatusInfo(material: MaterialViewItem): {
  label: string;
  color: 'green' | 'yellow' | 'red' | 'gray';
} {
  if (material.status === 'processing') {
    return { label: '处理中', color: 'yellow' };
  }

  if (material.status === 'failed') {
    return { label: '处理失败', color: 'red' };
  }
  
  if (material.classification?.materialId === 'unknown') {
    return { label: '未识别', color: 'gray' };
  }
  
  return { label: '已识别', color: 'green' };
}

/**
 * 获取置信度样式
 * @param confidence - 置信度值 (0-1)
 * @returns 颜色类和标签
 */
export function getConfidenceStyle(confidence?: number): {
  colorClass: string;
  bgClass: string;
  label: string;
} {
  if (confidence === undefined) {
    return { colorClass: 'text-gray-400', bgClass: 'bg-gray-100', label: '未知' };
  }
  
  if (confidence >= 0.9) {
    return { colorClass: 'text-green-600', bgClass: 'bg-green-100', label: '高' };
  }
  
  if (confidence >= 0.7) {
    return { colorClass: 'text-blue-600', bgClass: 'bg-blue-100', label: '中' };
  }
  
  return { colorClass: 'text-yellow-600', bgClass: 'bg-yellow-100', label: '低' };
}
