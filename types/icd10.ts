// types/icd10.ts
// 34,227 ICD-10 disease definitions for China Medical Insurance v2.0
// 此文件定义与 Excel 表结构一致的 TypeScript 类型，便于后续数据转换与校验

// 疾病主数据类型：符合实现计划中的字段结构
export interface ICD10Disease {
  id: string;                    // 内部ID: icd-{diagnosisCode}
  code: string;                  // 诊断代码: A00.000
  name: string;                  // 诊断名称

  hierarchy: {
    chapter: {
      number: number;            // 章序号: 1
      codeRange: string;         // 章代码范围: A00-B99
      name: string;              // 章名称
    };
    section: {
      codeRange: string;         // 节代码范围: A00-A09
      name: string;              // 节名称
    };
    category: {
      code: string;              // 类目代码: A00
      name: string;              // 类目名称
    };
    subcategory: {
      code: string;              // 亚目代码: A00.0
      name: string;              // 亚目名称
    };
  };
  
  version: string;               // 版本: medicare-v2.0
  standard: 'MEDICARE';          // 标准类型
  effectiveDate: string;         // 生效日期
  
  insuranceMetadata?: DiseaseInsuranceMetadata;
  
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

// 保险相关元数据，字段来自保险数据表的扩展信息
export interface DiseaseInsuranceMetadata {
  severityLevel: 'none' | 'minor' | 'moderate' | 'severe' | 'critical';
  underwritingDecision: 'standard' | 'rated' | 'exclusion' | 'postpone' | 'decline';
  isChronic: boolean;            // 是否慢性病
  isCongenital: boolean;         // 是否先天性
  isMalignant: boolean;          // 是否恶性/肿瘤相关
  isInfectious: boolean;           // 是否传染性疾病
  typicalReimbursementRate?: number; // 典型报销比例（可选）
  avgTreatmentCost?: number;          // 平均治疗成本（可选）
  avgRecoveryDays?: number;           // 平均恢复天数（可选）
}

// --------------------------  搜索、分页、匹配相关通用类型  --------------------------

// 搜索选项（用于数据检索/过滤时的参数定义）
export interface SearchOptions {
  query: string;            // 搜索关键词
  limit?: number;             // 每页条数
  page?: number;              // 页码，从1开始
  sortBy?: string;            // 排序字段
  sortOrder?: 'asc' | 'desc'; // 排序方向
}

// 匹配结果，包含分数/高亮字段信息，便于排序和展示
export interface MatchingResult<T> {
  item: T;
  score: number;                // 匹配相关分数/相似度
  highlights?: string[];        // 匹配到的字段高亮标记（可选）
}

// 分页结构化结果，便于前端分页展示
export interface PagedResult<T> {
  items: T[];                   // 当前页数据
  total: number;                // 总条目数
  page: number;                 // 当前页码
  pageSize: number;             // 每页条数
  totalPages: number;           // 总页数
  hasNext?: boolean;            // 是否存在下一页
  hasPrev?: boolean;            // 是否存在上一页
}

// 简单的 ICD-10 搜索返回类型示例（若需要直接在代码中使用）
export type ICD10SearchResult = MatchingResult<ICD10Disease>;

// --------------------------  导出类型清单 --------------------------
export type { ICD10Disease as ICD10DiseaseType };
