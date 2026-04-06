# ICD-10 疾病分类导入系统设计文档

**日期**: 2026-03-16  
**项目**: 保险产品配置与理赔系统  
**版本**: 1.0

---

## 1. 系统概述

### 1.1 背景

ICD-10 (International Classification of Diseases, 10th Revision) 是国际标准疾病分类系统，在保险理赔和核保中用于：
- **理赔场景**: 识别疾病类型、判断保险责任、评估赔付金额
- **核保场景**: 评估健康风险、确定承保条件、计算保费

### 1.2 设计目标

| 目标 | 说明 |
|------|------|
| 标准化 | 支持 ICD-10 国际编码标准 |
| 可扩展 | 支持国家标准 GB/T 14396 和医保版 ICD-10 |
| 高性能 | 支持快速搜索和匹配，响应 < 200ms |
| 易维护 | 支持增量更新和版本管理 |
| 可集成 | 与现有理赔、核保、知识库系统无缝对接 |

---

## 2. 核心功能需求

### 2.1 数据导入功能

```
┌─────────────────────────────────────────────────────────────┐
│                    数据导入模块                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ CSV导入  │  │ Excel    │  │ JSON/API │  │ 手动录入 │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
│       └─────────────┴─────────────┴─────────────┘            │
│                         │                                    │
│              ┌──────────┴──────────┐                        │
│              │    数据清洗引擎      │                        │
│              │  • 编码格式转换     │                        │
│              │  • 重复项检测       │                        │
│              │  • 数据验证         │                        │
│              └──────────┬──────────┘                        │
│                         │                                    │
│              ┌──────────┴──────────┐                        │
│              │    版本管理模块      │                        │
│              │  • 增量更新         │                        │
│              │  • 变更追溯         │                        │
│              │  • 回滚机制         │                        │
│              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 疾病编码匹配功能

**匹配层级设计**（参考 catalogMatchService 5级策略）：

```
┌──────────────────────────────────────────────────────────┐
│                 疾病编码匹配流程                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Level 1: 精确匹配 (编码完全一致)                        │
│     ↓ 未命中                                             │
│  Level 2: 别名匹配 (常用名、曾用名)                      │
│     ↓ 未命中                                             │
│  Level 3: 模糊匹配 (名称包含关系)                        │
│     ↓ 未命中                                             │
│  Level 4: AI 语义匹配 (Gemini 语义理解)                  │
│     ↓ 未命中                                             │
│  Level 5: 标记为未匹配，人工处理                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2.3 理赔应用场景

```typescript
// 理赔场景使用示例
interface ClaimDiseaseValidation {
  // 验证诊断编码是否在保障范围内
  isCovered: (icd10Code: string, policyId: string) => boolean;
  
  // 获取疾病的赔付比例/限额
  getReimbursementRate: (icd10Code: string, planType: string) => number;
  
  // 判断是否为既往症
  isPreExistingCondition: (icd10Code: string, diagnosisDate: Date, policyStartDate: Date) => boolean;
  
  // 获取疾病严重程度评级（用于重疾）
  getSeverityLevel: (icd10Code: string) => 'minor' | 'moderate' | 'severe' | 'critical';
}
```

### 2.4 核保应用场景

```typescript
// 核保场景使用示例
interface UnderwritingDiseaseAssessment {
  // 评估疾病风险等级
  assessRiskLevel: (icd10Code: string, applicantAge: number, gender: string) => RiskLevel;
  
  // 获取核保建议
  getUnderwritingAdvice: (icd10Code: string) => UnderwritingDecision;
  
  // 计算加费系数
  calculateExtraPremium: (icd10Code: string, basePremium: number) => number;
  
  // 判断是否需要体检
  requiresMedicalExam: (icd10Codes: string[]) => boolean;
}
```

---

## 3. 数据模型设计

### 3.1 核心实体

```typescript
// types/icd10.ts

/**
 * ICD-10 疾病分类条目
 */
export interface ICD10Disease {
  id: string;                          // 内部唯一标识
  code: string;                        // ICD-10 编码 (如: J45.901)
  name: string;                        // 疾病名称
  nameEn?: string;                     // 英文名称
  aliases: string[];                   // 别名/常用名
  
  // 分类层级
  category: DiseaseCategory;           // 疾病大类
  chapter: ICD10Chapter;               // ICD-10 章节
  
  // 版本信息
  standard: ICD10Standard;             // 标准类型
  version: string;                     // 版本号
  effectiveDate: string;               // 生效日期
  
  // 保险相关属性
  insuranceMetadata: DiseaseInsuranceMetadata;
  
  // 元数据
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

/**
 * 疾病分类（系统/器官）
 */
export interface DiseaseCategory {
  code: string;           // 分类编码
  name: string;           // 分类名称
  level: number;          // 层级 (1-4)
  parentCode?: string;    // 父级编码
  description?: string;   // 描述
}

/**
 * ICD-10 章节
 */
export interface ICD10Chapter {
  code: string;           // 章节编码 (如: X)
  range: string;          // 编码范围 (如: J00-J99)
  title: string;          // 章节标题
  description?: string;   // 描述
}

/**
 * 保险相关元数据
 */
export interface DiseaseInsuranceMetadata {
  // 疾病严重程度
  severityLevel: 'none' | 'minor' | 'moderate' | 'severe' | 'critical';
  
  // 常见核保结论
  commonUnderwritingDecision: 'standard' | 'rated' | 'exclusion' | 'postpone' | 'decline';
  
  // 赔付相关
  reimbursementType: 'full' | 'partial' | 'excluded' | 'case_by_case';
  typicalReimbursementRate?: number;    // 典型赔付比例
  
  // 疾病性质
  isChronic: boolean;                   // 是否慢性病
  isCongenital: boolean;                // 是否先天性疾病
  isMalignant: boolean;                 // 是否恶性肿瘤
  isInfectious: boolean;                // 是否传染病
  isMentalDisorder: boolean;            // 是否精神疾病
  
  // 统计数据
  avgTreatmentCost?: number;            // 平均治疗费用
  avgRecoveryDays?: number;             // 平均康复天数
  recurrenceRate?: number;              // 复发率
}

/**
 * ICD-10 标准类型
 */
export enum ICD10Standard {
  WHO = 'WHO',                    // 世界卫生组织标准
  GB = 'GB_T_14396',             // 国家标准 GB/T 14396
  MEDICARE = 'MEDICARE',          // 医保版 ICD-10
  INSURANCE = 'INSURANCE'         // 保险行业定制版
}
```

### 3.2 数据关系图

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  ICD10Disease   │────▶│  DiseaseCategory │────▶│  ICD10Chapter   │
│   (疾病条目)     │     │   (疾病分类)      │     │   (ICD章节)      │
└────────┬────────┘     └──────────────────┘     └─────────────────┘
         │
         │
         ▼
┌────────────────────────┐
│ DiseaseInsuranceMetadata│
│   (保险元数据)          │
└────────────────────────┘
```

### 3.3 存储结构设计

```
jsonlist/
├── icd10-diseases.json          # 主数据文件
├── icd10-categories.json        # 疾病分类
├── icd10-chapters.json          # ICD章节
├── icd10-versions.json          # 版本管理
└── icd10-aliases-index.json     # 别名索引(加速查询)
```

**JSON 格式示例**:

```json
// jsonlist/icd10-diseases.json
[
  {
    "id": "icd-j45901",
    "code": "J45.901",
    "name": "支气管哮喘",
    "nameEn": "Bronchial Asthma",
    "aliases": ["哮喘", "气喘病", "Asthma"],
    "category": {
      "code": "J40-J47",
      "name": "慢性下呼吸道疾病",
      "level": 2,
      "parentCode": "J00-J99"
    },
    "chapter": {
      "code": "X",
      "range": "J00-J99",
      "title": "呼吸系统疾病"
    },
    "standard": "MEDICARE",
    "version": "2024-v1",
    "effectiveDate": "2024-01-01",
    "insuranceMetadata": {
      "severityLevel": "moderate",
      "commonUnderwritingDecision": "rated",
      "reimbursementType": "full",
      "typicalReimbursementRate": 0.8,
      "isChronic": true,
      "isCongenital": false,
      "isMalignant": false,
      "isInfectious": false,
      "isMentalDisorder": false,
      "avgTreatmentCost": 5000,
      "avgRecoveryDays": 7
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "isActive": true
  }
]
```

---

## 4. 系统架构设计

### 4.1 模块架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ICD-10 疾病分类系统                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      接入层 (Presentation)                       │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │   │
│  │  │ 疾病管理页面  │ │ 导入工具页面  │ │ 理赔/核保集成组件        │ │   │
│  │  │(DiseaseAdmin)│ │(ImportWizard)│ │(ICD10Selector)           │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      服务层 (Service)                            │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌───────────────────────────┐  │   │
│  │  │ICD10Service │ │ImportService│ │MatchService               │  │   │
│  │  │(CRUD/Query) │ │(数据导入)    │ │(编码匹配)                 │  │   │
│  │  └─────────────┘ └─────────────┘ └───────────────────────────┘  │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌───────────────────────────┐  │   │
│  │  │CacheService │ │StatsService │ │VersionService             │  │   │
│  │  │(缓存管理)    │ │(统计分析)    │ │(版本管理)                 │  │   │
│  │  └─────────────┘ └─────────────┘ └───────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      数据层 (Data)                               │   │
│  │  ┌────────────────┐ ┌──────────────┐ ┌─────────────────────┐    │   │
│  │  │ JSON文件存储    │ │ 内存索引缓存  │ │ 搜索索引(Fuse.js)   │    │   │
│  │  │ (jsonlist/)    │ │ (Map结构)    │ │                     │    │   │
│  │  └────────────────┘ └──────────────┘ └─────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      集成层 (Integration)                        │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │   │
│  │  │ 理赔引擎集成  │ │ 核保引擎集成  │ │ 知识库集成               │ │   │
│  │  │(RulesEngine) │ │(RiskEngine)  │ │(KnowledgeGraph)          │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 关键服务接口

```typescript
// services/icd10Service.ts

export interface ICD10Service {
  // ========== CRUD 操作 ==========
  
  /** 获取所有疾病条目 */
  list(options: ListOptions): Promise<PaginatedResult<ICD10Disease>>;
  
  /** 根据ID获取疾病详情 */
  getById(id: string): Promise<ICD10Disease | null>;
  
  /** 根据编码获取疾病 */
  getByCode(code: string, standard?: ICD10Standard): Promise<ICD10Disease | null>;
  
  /** 创建疾病条目 */
  create(disease: CreateICD10DiseaseDTO): Promise<ICD10Disease>;
  
  /** 更新疾病条目 */
  update(id: string, updates: UpdateICD10DiseaseDTO): Promise<ICD10Disease>;
  
  /** 批量更新 */
  batchUpdate(updates: BatchUpdateDTO[]): Promise<number>;
  
  /** 软删除 */
  softDelete(id: string): Promise<void>;
  
  // ========== 搜索查询 ==========
  
  /** 全文搜索 */
  search(query: string, options: SearchOptions): Promise<SearchResult<ICD10Disease>>;
  
  /** 模糊搜索（自动完成） */
  fuzzySearch(partial: string, limit?: number): Promise<ICD10Disease[]>;
  
  /** 按分类筛选 */
  filterByCategory(categoryCode: string, recursive?: boolean): Promise<ICD10Disease[]>;
  
  /** 按保险属性筛选 */
  filterByInsuranceProps(props: InsuranceFilterProps): Promise<ICD10Disease[]>;
  
  // ========== 统计报表 ==========
  
  /** 获取分类统计 */
  getCategoryStats(): Promise<CategoryStat[]>;
  
  /** 获取版本对比 */
  getVersionDiff(oldVersion: string, newVersion: string): Promise<VersionDiff>;
}
```

```typescript
// services/icd10ImportService.ts

export interface ICD10ImportService {
  // ========== 导入功能 ==========
  
  /** 预览导入文件 */
  previewImport(file: File, options: ImportOptions): Promise<ImportPreview>;
  
  /** 执行导入 */
  executeImport(file: File, options: ImportOptions): Promise<ImportResult>;
  
  /** 批量导入（支持大文件分片） */
  batchImport(files: File[], options: BatchImportOptions): Promise<BatchImportResult>;
  
  /** 从URL导入 */
  importFromUrl(url: string, options: ImportOptions): Promise<ImportResult>;
  
  // ========== 验证功能 ==========
  
  /** 验证编码格式 */
  validateCode(code: string, standard: ICD10Standard): ValidationResult;
  
  /** 检查重复 */
  checkDuplicates(codes: string[]): Promise<DuplicateCheckResult>;
  
  // ========== 模板下载 ==========
  
  /** 下载导入模板 */
  downloadTemplate(format: 'csv' | 'excel' | 'json'): Promise<Blob>;
}
```

```typescript
// services/icd10MatchService.ts

export interface ICD10MatchService {
  /**
   * 匹配疾病编码（5级匹配策略）
   * 参考 catalogMatchService.ts 的实现
   */
  matchDisease(
    input: string,
    options: MatchOptions
  ): Promise<MatchResult<ICD10Disease>>;
  
  /**
   * 批量匹配
   */
  batchMatch(
    inputs: string[],
    options: BatchMatchOptions
  ): Promise<Map<string, MatchResult<ICD10Disease>>>;
  
  /**
   * 从病历文本提取疾病编码
   * 使用 AI 进行实体识别
   */
  extractFromText(
    text: string,
    options: ExtractionOptions
  ): Promise<ExtractedDisease[]>;
}
```

---

## 5. 导入流程设计

### 5.1 数据导入流程图

```
┌─────────────┐
│  选择文件   │
└──────┬──────┘
       ▼
┌─────────────┐
│  格式检测   │ ────▶ 不支持的格式 ────▶ 错误提示
└──────┬──────┘
       ▼
┌─────────────┐
│  数据解析   │ ────▶ 解析失败 ────▶ 错误提示
└──────┬──────┘
       ▼
┌─────────────┐
│  编码验证   │ ────▶ 编码无效 ────▶ 标记待修正
└──────┬──────┘
       ▼
┌─────────────┐
│  重复检测   │ ────▶ 已存在 ────▶ 更新/跳过/报错
└──────┬──────┘
       ▼
┌─────────────┐
│  数据预览   │
└──────┬──────┘
       ▼
┌─────────────┐
│  确认导入   │
└──────┬──────┘
       ▼
┌─────────────┐
│  执行导入   │
└──────┬──────┘
       ▼
┌─────────────┐
│  生成报告   │
└─────────────┘
```

### 5.2 支持的导入格式

```typescript
// 标准 CSV 格式
interface ICD10CSVRow {
  code: string;              // ICD-10 编码
  name: string;              // 疾病名称
  name_en?: string;          // 英文名称
  aliases?: string;          // 别名（分号分隔）
  category_code: string;     // 分类编码
  category_name: string;     // 分类名称
  chapter_code: string;      // 章节编码
  chapter_name: string;      // 章节名称
  standard: string;          // 标准类型
  severity_level?: string;   // 严重程度
  is_chronic?: boolean;      // 是否慢性病
  // ... 其他字段
}

// 标准 Excel 格式（支持多工作表）
interface ICD10ExcelWorkbook {
  diseases: ICD10CSVRow[];       // 疾病列表
  categories: CategoryRow[];     // 分类列表
  chapters: ChapterRow[];        // 章节列表
}
```

### 5.3 数据清洗规则

```typescript
// utils/icd10DataCleaner.ts

export const dataCleaningRules = {
  // 编码标准化
  normalizeCode: (code: string): string => {
    return code
      .toUpperCase()                    // 转大写
      .replace(/\s+/g, '')              // 去空格
      .replace(/[.。]/g, '.');           // 统一小数点
  },
  
  // 名称清洗
  normalizeName: (name: string): string => {
    return name
      .trim()                           // 去首尾空格
      .replace(/\s+/g, ' ')             // 多空格转单空格
      .replace(/[（]/g, '(')            // 统一括号
      .replace(/[）]/g, ')');
  },
  
  // 别名解析
  parseAliases: (aliasesStr: string): string[] => {
    return aliasesStr
      .split(/[;；,，]/)                // 支持多种分隔符
      .map(s => s.trim())
      .filter(Boolean);
  },
  
  // 编码有效性验证
  validateCode: (code: string): boolean => {
    // ICD-10 格式: A00.0 - Z99.9
    const icd10Regex = /^[A-Z]\d{2}(\.\d{1,2})?$/;
    return icd10Regex.test(code);
  }
};
```

---

## 6. 与现有系统集成

### 6.1 与理赔系统集成

```typescript
// server/claims/icd10Integration.ts

/**
 * 理赔案件中的疾病验证
 */
export const validateClaimDiagnosis = async (
  claimCaseId: string,
  diagnosisCodes: string[]
): Promise<DiagnosisValidationResult> => {
  const results = await Promise.all(
    diagnosisCodes.map(async (code) => {
      const disease = await icd10Service.getByCode(code);
      
      if (!disease) {
        return {
          code,
          valid: false,
          reason: '编码未找到',
          suggestions: await icd10MatchService.fuzzySearch(code, 3)
        };
      }
      
      // 获取保单信息
      const claimCase = await claimCaseService.getById(claimCaseId);
      const policy = await policyService.getById(claimCase.policyId);
      
      // 验证是否在保障范围
      const coverage = await checkCoverage(disease, policy);
      
      // 验证既往症
      const preExisting = await checkPreExistingCondition(
        disease, 
        claimCase.insuredId,
        policy.effectiveDate
      );
      
      return {
        code,
        valid: true,
        disease,
        coverage,
        preExisting,
        reimbursementRate: calculateReimbursementRate(disease, policy)
      };
    })
  );
  
  return {
    claimCaseId,
    validations: results,
    overallValid: results.every(r => r.valid)
  };
};
```

### 6.2 与核保系统集成

```typescript
// server/underwriting/icd10Integration.ts

/**
 * 核保风险评估
 */
export const assessUnderwritingRisk = async (
  applicationId: string,
  disclosedDiseases: string[],
  medicalExamResults?: MedicalExamResult
): Promise<UnderwritingAssessment> => {
  const assessments = await Promise.all(
    disclosedDiseases.map(async (code) => {
      const disease = await icd10Service.getByCode(code);
      
      if (!disease) {
        return {
          code,
          assessed: false,
          requiresManualReview: true,
          reason: '未知疾病编码'
        };
      }
      
      const metadata = disease.insuranceMetadata;
      
      // 基础核保结论
      let decision = metadata.commonUnderwritingDecision;
      let extraPremiumRate = 0;
      let exclusions: string[] = [];
      
      // 根据严重程度调整
      if (metadata.severityLevel === 'critical') {
        decision = 'decline';
      } else if (metadata.severityLevel === 'severe') {
        decision = decision === 'standard' ? 'rated' : decision;
        extraPremiumRate = 0.5; // +50%
      }
      
      // 特定疾病除外责任
      if (metadata.isChronic) {
        exclusions.push(`${disease.name}及相关并发症`);
      }
      
      return {
        code,
        disease,
        assessed: true,
        decision,
        extraPremiumRate,
        exclusions,
        requiresMedicalExam: metadata.severityLevel === 'severe',
        riskScore: calculateRiskScore(disease)
      };
    })
  );
  
  // 综合评估
  const overallRisk = aggregateRiskScores(assessments);
  
  return {
    applicationId,
    diseaseAssessments: assessments,
    overallDecision: determineOverallDecision(assessments),
    overallRiskScore: overallRisk,
    recommendations: generateRecommendations(assessments)
  };
};
```

### 6.3 与知识库集成

```typescript
// server/knowledge/icd10Integration.ts

/**
 * 疾病与知识库关联
 */
export const linkToKnowledgeBase = async (
  icd10Code: string
): Promise<KnowledgeLinks> => {
  const disease = await icd10Service.getByCode(icd10Code);
  
  return {
    // 关联治疗方案
    treatmentProtocols: await knowledgeService.findTreatments({
      diseaseCodes: [icd10Code]
    }),
    
    // 关联药品
    relatedDrugs: await knowledgeService.findDrugs({
      diseaseCodes: [icd10Code]
    }),
    
    // 关联检查项目
    relatedExams: await knowledgeService.findExams({
      diseaseCodes: [icd10Code]
    }),
    
    // 关联核保规则
    underwritingRules: await ruleService.findRules({
      diseaseCode: icd10Code
    }),
    
    // 关联理赔案例
    similarCases: await caseService.findSimilar({
      diagnosisCodes: [icd10Code],
      limit: 10
    })
  };
};
```

---

## 7. 前端界面设计

### 7.1 疾病管理页面

参考已有的 `DiseaseManagementPage.tsx`，规划以下功能模块：

```typescript
// 页面结构
interface DiseaseManagementPage {
  // 搜索筛选区域
  searchSection: {
    quickSearch: string;           // 快速搜索框
    advancedFilters: {
      category: string;            // 疾病分类
      chapter: string;             // ICD章节
      standard: ICD10Standard;     // 标准类型
      severity: SeverityLevel[];   // 严重程度
      insuranceProps: {            // 保险属性
        isChronic: boolean;
        isMalignant: boolean;
        // ...
      };
    };
  };
  
  // 数据表格
  dataTable: {
    columns: ['code', 'name', 'category', 'severity', 'standard', 'actions'];
    pagination: PaginationConfig;
    sorting: SortConfig;
    rowSelection: boolean;
  };
  
  // 批量操作
  batchActions: ['export', 'updateTags', 'activate', 'deactivate', 'delete'];
  
  // 详情抽屉
  detailDrawer: {
    basicInfo: DiseaseBasicInfo;
    insuranceMetadata: InsuranceMetadata;
    versionHistory: VersionHistory[];
    relatedKnowledge: KnowledgeLinks;
  };
}
```

### 7.2 导入向导页面

```typescript
// 导入向导步骤
interface ImportWizard {
  steps: [
    {
      id: 'upload';
      title: '上传文件';
      component: FileUploadZone;
      supportedFormats: ['.csv', '.xlsx', '.xls', '.json'];
      maxFileSize: '10MB';
    },
    {
      id: 'preview';
      title: '数据预览';
      component: DataPreviewTable;
      features: ['错误标记', '重复高亮', '编辑修正'];
    },
    {
      id: 'mapping';
      title: '字段映射';
      component: FieldMappingTable;
      autoDetect: boolean;
    },
    {
      id: 'validate';
      title: '数据验证';
      component: ValidationReport;
      checks: ['编码格式', '必填字段', '重复检测', '分类一致性'];
    },
    {
      id: 'import';
      title: '执行导入';
      component: ImportProgress;
      features: ['进度条', '实时统计', '错误日志'];
    }
  ];
}
```

### 7.3 疾病选择组件

```typescript
// 用于理赔/核保表单
interface ICD10SelectorProps {
  value?: string;                    // 选中的编码
  onChange: (value: string, disease: ICD10Disease) => void;
  
  // 筛选配置
  filters?: {
    categories?: string[];           // 限定分类
    severityLevels?: SeverityLevel[]; // 限定严重程度
    standards?: ICD10Standard[];     // 限定标准
  };
  
  // 显示配置
  showCode?: boolean;                // 显示编码
  showCategory?: boolean;            // 显示分类
  allowMultiple?: boolean;           // 允许多选
  allowCreate?: boolean;             // 允许创建新条目
  
  // 匹配配置
  enableFuzzySearch?: boolean;       // 启用模糊搜索
  enableAiMatch?: boolean;           // 启用 AI 语义匹配
}
```

---

## 8. 性能优化策略

### 8.1 缓存策略

```typescript
// services/icd10CacheService.ts

class ICD10CacheService {
  // 内存缓存（Map 结构）
  private codeIndex: Map<string, ICD10Disease>;      // code -> disease
  private nameIndex: Map<string, string[]>;          // name -> codes[]
  private aliasIndex: Map<string, string[]>;         // alias -> codes[]
  
  // 搜索索引（Fuse.js）
  private searchIndex: Fuse<ICD10Disease>;
  
  // 初始化缓存
  async initialize(): Promise<void> {
    const diseases = await this.loadFromStorage();
    
    // 构建索引
    for (const disease of diseases) {
      this.codeIndex.set(disease.code, disease);
      
      // 名称索引
      const nameKey = this.normalizeForIndex(disease.name);
      this.addToIndex(this.nameIndex, nameKey, disease.code);
      
      // 别名索引
      for (const alias of disease.aliases) {
        const aliasKey = this.normalizeForIndex(alias);
        this.addToIndex(this.aliasIndex, aliasKey, disease.code);
      }
    }
    
    // 构建 Fuse 搜索索引
    this.searchIndex = new Fuse(diseases, {
      keys: ['code', 'name', 'aliases', 'nameEn'],
      threshold: 0.3,
      includeScore: true
    });
  }
  
  // 快速查找（O(1)）
  getByCode(code: string): ICD10Disease | undefined {
    return this.codeIndex.get(code);
  }
  
  // 模糊搜索（Fuse.js）
  search(query: string): FuseResult<ICD10Disease>[] {
    return this.searchIndex.search(query);
  }
}
```

### 8.2 大数据量处理

```typescript
// 分页加载策略
interface PaginationStrategy {
  pageSize: number;              // 默认 50 条
  maxPageSize: number;           // 最大 200 条
  virtualScroll: boolean;        // 虚拟滚动（>1000条）
}

// 数据分片导入（大文件）
interface ChunkedImportStrategy {
  chunkSize: number;             // 每片 1000 条
  concurrentChunks: number;      // 并发 3 片
  progressCallback: (progress: ImportProgress) => void;
}
```

---

## 9. 实施计划

### 9.1 开发阶段

| 阶段 | 任务 | 预估工时 |
|------|------|----------|
| **Phase 1** | 数据模型设计与基础设施 | 2天 |
| | • 定义 TypeScript 类型 | |
| | • 创建 JSON 存储结构 | |
| | • 实现基础 CRUD 服务 | |
| **Phase 2** | 核心服务开发 | 3天 |
| | • ICD10Service 实现 | |
| | • 缓存与索引系统 | |
| | • 搜索与匹配功能 | |
| **Phase 3** | 导入功能开发 | 3天 |
| | • CSV/Excel 解析器 | |
| | • 数据清洗与验证 | |
| | • 批量导入流程 | |
| **Phase 4** | 前端界面开发 | 4天 |
| | • 疾病管理页面 | |
| | • 导入向导页面 | |
| | • ICD10Selector 组件 | |
| **Phase 5** | 系统集成 | 3天 |
| | • 理赔系统集成 | |
| | • 核保系统集成 | |
| | • 知识库集成 | |
| **Phase 6** | 测试与优化 | 3天 |
| | • 单元测试 | |
| | • 性能优化 | |
| | • 数据验证 | |

**总计: 18 天**

### 9.2 数据迁移策略

```
现有数据 ──▶ 导出 ──▶ 转换 ──▶ 导入到新系统 ──▶ 验证
```

1. **数据导出**: 从现有系统导出疾病相关数据
2. **格式转换**: 转换为 ICD-10 标准格式
3. **数据清洗**: 编码验证、重复处理
4. **分批导入**: 使用批量导入功能
5. **验证校验**: 比对数据完整性

---

## 10. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| ICD-10 编码不统一 | 高 | 支持多标准映射（WHO/GB/医保版） |
| 历史数据迁移复杂 | 高 | 分批次迁移，保留原始编码映射 |
| 搜索性能问题 | 中 | 使用 Fuse.js + 内存索引 |
| AI 语义匹配成本 | 中 | 限制 AI 调用频率，缓存结果 |
| 版本更新冲突 | 中 | 设计版本管理机制，支持回滚 |

---

## 11. 参考实现

### 11.1 参考文件

| 功能 | 参考文件 | 说明 |
|------|----------|------|
| 数据导入 | `scripts/import-hospitals.js` | CSV 导入脚本参考 |
| 匹配服务 | `services/catalogMatchService.ts` | 5级匹配策略参考 |
| 文件存储 | `server/utils/fileStore.js` | JSON 文件操作 |
| 缓存策略 | `services/ossService.ts` | URL 缓存模式参考 |
| 知识库 DAO | `server/knowledge/dao/diseaseDao.js` | 疾病数据访问 |
| UI 组件 | `components/knowledge/DiseaseManagementPage.tsx` | 管理界面参考 |

---

## 12. 下一步行动

1. **确认需求**: 与用户确认设计方案中的关键决策点
2. **细化计划**: 创建详细的实施任务清单
3. **数据准备**: 准备 ICD-10 数据源（WHO/GB/医保版）
4. **开发启动**: 按照 Phase 1 开始开发

---

**文档状态**: 设计草案  
**下次评审**: 待用户反馈
