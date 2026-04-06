# ICD-10 疾病分类导入系统 - 详细实施计划

**项目**: 保险产品配置与理赔系统  
**日期**: 2026-03-16  
**版本**: 1.0  
**数据源**: ICD-10 医保 2.0 版 (34,227条)

---

## 1. 数据现状分析

### 1.1 ICD-10 医保 2.0 版数据结构

| 层级 | 数量 | 编码格式 | 示例 |
|------|------|----------|------|
| **章** | 23 | A00-B99 (范围) | A00-B99: 某些传染病和寄生虫病 |
| **节** | 275 | A00-A09 (范围) | A00-A09: 肠道传染病 |
| **类目** | 2,048 | A00 (3位) | A00: 霍乱 |
| **亚目** | 10,171 | A00.0 (带点4位) | A00.0: 霍乱生物型 |
| **诊断码** | 33,304 | A00.000 (带点6位) | A00.000: 详细诊断 |

**总条目**: 34,227 条

### 1.2 数据字段映射

```
Excel列名                    →    系统字段名
─────────────────────────────────────────────────
章                                chapterNumber
章代码范围                         chapterCodeRange
章的名称                           chapterName
节代码范围                         sectionCodeRange
节名称                            sectionName
类目代码                          categoryCode
类目名称                          categoryName
亚目代码                          subcategoryCode
亚目名称                          subcategoryName
诊断代码                          diagnosisCode (主编码)
诊断名称                          diagnosisName
```

### 1.3 现有系统状态

| 组件 | 状态 | 说明 |
|------|------|------|
| `DiseaseManagementPage.tsx` | ✅ 已存在 | 基础管理界面 |
| `diseaseDao.js` | ✅ 已存在 | 基础DAO层 |
| `diseases.json` | ❌ 不存在 | 需要创建 |
| 保险元数据 | ❌ 不存在 | 需要扩展 |

---

## 2. 实施阶段规划

### 📋 总览

```
Phase 1 (2天): 基础设施 + 数据模型
    ↓
Phase 2 (3天): 核心服务开发
    ↓
Phase 3 (2天): 数据导入工具
    ↓
Phase 4 (2天): 前端界面
    ↓
Phase 5 (2天): 系统集成
    ↓
Phase 6 (2天): 测试优化

总计: 13 天
```

---

## 3. Phase 1: 基础设施 (2天)

### Task 1.1: 创建 TypeScript 类型定义
**优先级**: P0  
**耗时**: 4h

```typescript
// types/icd10.ts

export interface ICD10Disease {
  id: string;                    // 内部ID: icd-{diagnosisCode}
  code: string;                  // 诊断代码: A00.000
  name: string;                  // 诊断名称
  
  // 层级结构
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
  
  // 版本信息
  version: string;               // 版本: medicare-v2.0
  standard: 'MEDICARE';          // 标准类型
  effectiveDate: string;         // 生效日期
  
  // 保险元数据 (扩展字段)
  insuranceMetadata?: DiseaseInsuranceMetadata;
  
  // 系统字段
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface DiseaseInsuranceMetadata {
  severityLevel: 'none' | 'minor' | 'moderate' | 'severe' | 'critical';
  underwritingDecision: 'standard' | 'rated' | 'exclusion' | 'postpone' | 'decline';
  isChronic: boolean;
  isCongenital: boolean;
  isMalignant: boolean;
  isInfectious: boolean;
  isPreExisting: boolean;
  typicalReimbursementRate?: number;
  avgTreatmentCost?: number;
  avgRecoveryDays?: number;
  remarks?: string;
}
```

**验收标准**:
- [ ] 类型定义完整覆盖数据结构
- [ ] 与现有 `Disease` 类型兼容
- [ ] 支持扩展保险元数据

---

### Task 1.2: 创建存储结构和初始化脚本
**优先级**: P0  
**耗时**: 6h

**文件结构**:
```
jsonlist/
├── icd10/
│   ├── diseases.json              # 主数据文件 (34,227条)
│   ├── chapters.json              # 章数据 (23条)
│   ├── sections.json              # 节数据 (275条)
│   ├── categories.json            # 类目数据 (2,048条)
│   ├── subcategories.json         # 亚目数据 (10,171条)
│   └── metadata/                  # 保险元数据 (初始为空)
│       └── insurance-metadata.json
```

**数据转换脚本**: `scripts/convert-icd10-excel.ts`

```typescript
// 核心转换逻辑
function convertExcelRow(row: ExcelRow): ICD10Disease {
  return {
    id: `icd-${row['诊断代码']}`,
    code: row['诊断代码'],
    name: row['诊断名称'].replace(/\n/g, ''),
    hierarchy: {
      chapter: {
        number: row['章'],
        codeRange: row['章代码\n范围'],
        name: row['章的名称'].replace(/\n/g, '')
      },
      section: {
        codeRange: row['节代码范围'],
        name: row['节名称']
      },
      category: {
        code: row['类目代码'],
        name: row['类目名称']
      },
      subcategory: {
        code: row['亚目代码'],
        name: row['亚目名称'].replace(/\n/g, '')
      }
    },
    version: 'medicare-v2.0',
    standard: 'MEDICARE',
    effectiveDate: '2024-01-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true
  };
}
```

**验收标准**:
- [ ] 脚本成功转换 Excel 数据
- [ ] 生成所有 JSON 文件
- [ ] 数据完整性验证通过
- [ ] 备份原始数据文件

---

### Task 1.3: 创建索引文件（性能优化）
**优先级**: P1  
**耗时**: 4h

**索引文件**: `jsonlist/icd10/indexes.json`

```json
{
  "byCode": {
    "A00.000": "icd-A00.000",
    "A00.001": "icd-A00.001"
  },
  "byChapter": {
    "1": ["icd-A00.000", "icd-A00.001", ...],
    "2": [...]
  },
  "byCategory": {
    "A00": ["icd-A00.000", "icd-A00.100", ...]
  }
}
```

**验收标准**:
- [ ] 索引文件生成成功
- [ ] 支持快速编码查找
- [ ] 支持分类筛选

---

## 4. Phase 2: 核心服务 (3天)

### Task 2.1: ICD10Service 实现
**优先级**: P0  
**耗时**: 8h

```typescript
// services/icd10Service.ts

export class ICD10Service {
  private dataPath = 'jsonlist/icd10';
  private cache: Map<string, ICD10Disease> = new Map();
  private index: ICD10Index | null = null;
  
  // 初始化 - 加载索引到内存
  async initialize(): Promise<void> {
    const indexData = await readData('icd10/indexes');
    this.index = indexData;
    
    // 预加载热门数据 (如: 常见疾病)
    const hotCodes = ['J44', 'I10', 'E11', 'K29'];
    await this.preloadCategories(hotCodes);
  }
  
  // 根据编码获取疾病 (O(1) 查找)
  async getByCode(code: string): Promise<ICD10Disease | null> {
    // 1. 检查缓存
    if (this.cache.has(code)) {
      return this.cache.get(code)!;
    }
    
    // 2. 通过索引查找
    const id = this.index?.byCode[code];
    if (!id) return null;
    
    // 3. 加载数据
    const disease = await this.loadById(id);
    if (disease) {
      this.cache.set(code, disease);
    }
    return disease;
  }
  
  // 搜索疾病 (支持编码和名称)
  async search(query: string, options: SearchOptions): Promise<SearchResult> {
    const { limit = 20, includeHierarchy = false } = options;
    
    // 1. 如果是编码格式，精确查找
    if (this.isICDCode(query)) {
      const disease = await this.getByCode(query.toUpperCase());
      return {
        items: disease ? [disease] : [],
        total: disease ? 1 : 0
      };
    }
    
    // 2. 名称搜索 - 使用 Fuse.js
    const results = this.fuseSearch(query, limit);
    return {
      items: results,
      total: results.length
    };
  }
  
  // 按分类获取
  async getByCategory(type: 'chapter' | 'section' | 'category', code: string): Promise<ICD10Disease[]> {
    const ids = this.index?.[`by${capitalize(type)}`][code];
    if (!ids) return [];
    return Promise.all(ids.map(id => this.loadById(id)));
  }
  
  // 获取所有章
  async getAllChapters(): Promise<Chapter[]> {
    return readData('icd10/chapters');
  }
  
  // 获取章下的节
  async getSectionsByChapter(chapterCode: string): Promise<Section[]> {
    const sections = await readData('icd10/sections');
    return sections.filter((s: Section) => s.chapterCodeRange === chapterCode);
  }
}
```

**验收标准**:
- [ ] 所有 CRUD 方法实现
- [ ] 搜索响应时间 < 200ms
- [ ] 支持分页和筛选
- [ ] 缓存机制正常工作

---

### Task 2.2: ICD10MatchService (匹配服务)
**优先级**: P0  
**耗时**: 8h

参考 `catalogMatchService.ts` 的 5 级匹配策略：

```typescript
// services/icd10MatchService.ts

export class ICD10MatchService {
  /**
   * 5级匹配策略
   * Level 1: 精确匹配 (编码完全一致)
   * Level 2: 前缀匹配 (类目/亚目匹配)
   * Level 3: 别名匹配
   * Level 4: AI 语义匹配
   * Level 5: 未匹配
   */
  async matchDisease(
    input: string,
    options: MatchOptions = {}
  ): Promise<MatchResult> {
    
    // Level 1: 精确匹配
    const exactMatch = await this.icd10Service.getByCode(input.toUpperCase());
    if (exactMatch) {
      return { matched: true, disease: exactMatch, level: 1, confidence: 100 };
    }
    
    // Level 2: 前缀匹配 (如输入 A00 匹配 A00.000)
    const prefixMatches = await this.matchByPrefix(input);
    if (prefixMatches.length > 0) {
      return { 
        matched: true, 
        disease: prefixMatches[0], 
        level: 2, 
        confidence: 90,
        alternatives: prefixMatches.slice(1, 4)
      };
    }
    
    // Level 3: 名称模糊匹配
    const fuzzyMatches = await this.fuzzyMatch(input);
    if (fuzzyMatches.length > 0 && fuzzyMatches[0].score > 0.7) {
      return {
        matched: true,
        disease: fuzzyMatches[0].disease,
        level: 3,
        confidence: Math.round(fuzzyMatches[0].score * 100),
        alternatives: fuzzyMatches.slice(1, 4).map(m => m.disease)
      };
    }
    
    // Level 4: AI 语义匹配 (可选)
    if (options.enableAI) {
      const aiMatch = await this.aiSemanticMatch(input);
      if (aiMatch.confidence >= 60) {
        return { matched: true, ...aiMatch, level: 4 };
      }
    }
    
    // Level 5: 未匹配
    return {
      matched: false,
      level: 5,
      confidence: 0,
      suggestions: fuzzyMatches.slice(0, 5).map(m => m.disease)
    };
  }
  
  // 批量匹配 (用于理赔单据批量处理)
  async batchMatch(
    inputs: string[],
    options: BatchMatchOptions
  ): Promise<Map<string, MatchResult>> {
    const results = new Map();
    const concurrency = options.concurrency || 10;
    
    // 分批处理
    for (let i = 0; i < inputs.length; i += concurrency) {
      const batch = inputs.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(input => this.matchDisease(input, options))
      );
      
      batch.forEach((input, idx) => {
        results.set(input, batchResults[idx]);
      });
      
      // 进度回调
      options.onProgress?.(Math.min(i + concurrency, inputs.length), inputs.length);
    }
    
    return results;
  }
}
```

**验收标准**:
- [ ] 5级匹配策略实现
- [ ] 批量匹配支持并发控制
- [ ] AI 语义匹配集成
- [ ] 匹配准确率 > 90%

---

### Task 2.3: 缓存和性能优化
**优先级**: P1  
**耗时**: 8h

```typescript
// services/icd10CacheService.ts

export class ICD10CacheService {
  private memoryCache: LRUCache<string, ICD10Disease>;
  private searchIndex: Fuse<ICD10Disease>;
  private isInitialized = false;
  
  constructor() {
    // LRU 缓存，最多缓存 5000 条
    this.memoryCache = new LRUCache({ max: 5000 });
  }
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // 加载所有数据构建搜索索引
    const diseases = await this.loadAllDiseases();
    
    this.searchIndex = new Fuse(diseases, {
      keys: [
        { name: 'code', weight: 0.4 },
        { name: 'name', weight: 0.3 },
        { name: 'hierarchy.category.name', weight: 0.1 },
        { name: 'hierarchy.subcategory.name', weight: 0.1 },
        { name: 'aliases', weight: 0.1 }
      ],
      threshold: 0.3,
      includeScore: true,
      minMatchCharLength: 2
    });
    
    this.isInitialized = true;
  }
  
  // 快速查找
  get(code: string): ICD10Disease | undefined {
    return this.memoryCache.get(code);
  }
  
  set(code: string, disease: ICD10Disease): void {
    this.memoryCache.set(code, disease);
  }
  
  // Fuse.js 搜索
  search(query: string, limit = 20): FuseResult<ICD10Disease>[] {
    return this.searchIndex.search(query, { limit });
  }
  
  // 预热缓存 (系统启动时)
  async warmUp(): Promise<void> {
    const hotCodes = ['J44', 'I10', 'E11', 'K29', 'N18', 'C78', 'F32'];
    for (const code of hotCodes) {
      const diseases = await icd10Service.getByCategory('category', code);
      diseases.forEach(d => this.set(d.code, d));
    }
  }
}
```

**验收标准**:
- [ ] 内存缓存正常工作
- [ ] Fuse.js 索引构建成功
- [ ] 搜索性能 < 100ms
- [ ] 缓存命中率达到 80%+

---

## 5. Phase 3: 数据导入工具 (2天)

### Task 3.1: Excel 导入服务
**优先级**: P0  
**耗时**: 8h

```typescript
// services/icd10ImportService.ts

export class ICD10ImportService {
  /**
   * 从 Excel 文件导入 ICD-10 数据
   */
  async importFromExcel(
    file: File,
    options: ImportOptions
  ): Promise<ImportResult> {
    
    // 1. 解析 Excel
    const rows = await this.parseExcel(file);
    
    // 2. 数据验证
    const validation = this.validateRows(rows);
    if (validation.errors.length > 0) {
      return {
        success: false,
        errors: validation.errors,
        summary: { total: rows.length, valid: 0, invalid: rows.length }
      };
    }
    
    // 3. 数据转换
    const diseases = rows.map(row => this.convertRowToDisease(row));
    
    // 4. 重复检测
    const duplicates = await this.detectDuplicates(diseases);
    if (duplicates.length > 0 && options.skipDuplicates !== true) {
      return {
        success: false,
        duplicates,
        summary: { total: rows.length, duplicates: duplicates.length }
      };
    }
    
    // 5. 批量保存
    const saved = await this.batchSave(diseases, options);
    
    // 6. 重建索引
    await this.rebuildIndexes();
    
    return {
      success: true,
      summary: {
        total: rows.length,
        imported: saved.length,
        skipped: duplicates.length
      }
    };
  }
  
  // 验证行数据
  private validateRows(rows: ExcelRow[]): ValidationResult {
    const errors: ValidationError[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // 必填字段检查
      if (!row['诊断代码']) {
        errors.push({ row: i + 1, field: '诊断代码', message: '诊断代码不能为空' });
      }
      
      // ICD-10 编码格式验证
      if (row['诊断代码'] && !this.isValidICDCode(row['诊断代码'])) {
        errors.push({ row: i + 1, field: '诊断代码', message: '无效的ICD-10编码格式' });
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  // 增量更新 (用于版本更新)
  async incrementalUpdate(
    newData: ICD10Disease[],
    version: string
  ): Promise<UpdateResult> {
    const existing = await icd10Service.listAll();
    
    const changes = {
      added: [] as ICD10Disease[],
      modified: [] as ICD10Disease[],
      removed: [] as ICD10Disease[]
    };
    
    // 对比差异
    const existingMap = new Map(existing.map(d => [d.code, d]));
    const newMap = new Map(newData.map(d => [d.code, d]));
    
    // 新增
    for (const [code, disease] of newMap) {
      if (!existingMap.has(code)) {
        changes.added.push(disease);
      } else if (this.isModified(existingMap.get(code)!, disease)) {
        changes.modified.push(disease);
      }
    }
    
    // 删除
    for (const [code, disease] of existingMap) {
      if (!newMap.has(code)) {
        changes.removed.push(disease);
      }
    }
    
    // 保存变更
    await this.saveChanges(changes, version);
    
    return { success: true, changes };
  }
}
```

**验收标准**:
- [ ] 成功导入 34,227 条数据
- [ ] 数据验证准确
- [ ] 增量更新功能正常
- [ ] 导入报告生成

---

### Task 3.2: 导入管理界面
**优先级**: P1  
**耗时**: 8h

```typescript
// components/icd10/ICD10ImportWizard.tsx

interface ImportWizardStep {
  id: 'upload' | 'preview' | 'validate' | 'import' | 'complete';
  title: string;
}

const STEPS: ImportWizardStep[] = [
  { id: 'upload', title: '上传文件' },
  { id: 'preview', title: '数据预览' },
  { id: 'validate', title: '验证数据' },
  { id: 'import', title: '执行导入' },
  { id: 'complete', title: '导入完成' }
];

export const ICD10ImportWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  
  const handleUpload = async (uploadedFile: File) => {
    setFile(uploadedFile);
    
    // 解析预览
    const previewData = await icd10ImportService.preview(uploadedFile);
    setPreview(previewData);
    setCurrentStep(1);
  };
  
  const handleValidate = async () => {
    if (!file) return;
    
    const result = await icd10ImportService.validate(file);
    setValidation(result);
    setCurrentStep(2);
  };
  
  const handleImport = async () => {
    if (!file) return;
    
    setCurrentStep(3);
    
    const result = await icd10ImportService.importFromExcel(file, {
      onProgress: (progress) => setProgress(progress)
    });
    
    setCurrentStep(4);
  };
  
  return (
    <div className="import-wizard">
      <StepIndicator steps={STEPS} current={currentStep} />
      
      {currentStep === 0 && (
        <UploadStep onUpload={handleUpload} />
      )}
      
      {currentStep === 1 && preview && (
        <PreviewStep 
          preview={preview} 
          onBack={() => setCurrentStep(0)}
          onNext={handleValidate}
        />
      )}
      
      {currentStep === 2 && validation && (
        <ValidationStep 
          validation={validation}
          onBack={() => setCurrentStep(1)}
          onNext={handleImport}
        />
      )}
      
      {currentStep === 3 && (
        <ImportProgressStep progress={progress} />
      )}
      
      {currentStep === 4 && (
        <CompleteStep result={importResult} />
      )}
    </div>
  );
};
```

**验收标准**:
- [ ] 5步导入向导实现
- [ ] 数据预览功能
- [ ] 验证报告展示
- [ ] 进度实时更新

---

## 6. Phase 4: 前端界面 (2天)

### Task 4.1: ICD10Selector 组件
**优先级**: P0  
**耗时**: 8h

```typescript
// components/icd10/ICD10Selector.tsx

interface ICD10SelectorProps {
  value?: string;
  onChange: (value: string, disease: ICD10Disease) => void;
  placeholder?: string;
  disabled?: boolean;
  multiple?: boolean;
  filters?: {
    chapters?: number[];
    severityLevels?: SeverityLevel[];
  };
}

export const ICD10Selector: React.FC<ICD10SelectorProps> = ({
  value,
  onChange,
  placeholder = '输入疾病名称或ICD-10编码',
  multiple = false,
  filters
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ICD10Disease[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }
    
    searchDiseases(debouncedQuery);
  }, [debouncedQuery]);
  
  const searchDiseases = async (searchQuery: string) => {
    setLoading(true);
    try {
      const results = await icd10Service.search(searchQuery, {
        limit: 10,
        filters
      });
      setSuggestions(results.items);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="icd10-selector">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        suffix={loading ? <Spinner /> : <SearchIcon />}
      />
      
      {suggestions.length > 0 && (
        <Dropdown>
          {suggestions.map(disease => (
            <DropdownItem
              key={disease.code}
              onClick={() => {
                onChange(disease.code, disease);
                setQuery(disease.name);
                setSuggestions([]);
              }}
            >
              <div className="suggestion-item">
                <span className="code">{disease.code}</span>
                <span className="name">{disease.name}</span>
                <span className="category">
                  {disease.hierarchy.category.name}
                </span>
              </div>
            </DropdownItem>
          ))}
        </Dropdown>
      )}
    </div>
  );
};
```

**验收标准**:
- [ ] 支持编码和名称搜索
- [ ] 防抖优化 (300ms)
- [ ] 下拉建议展示
- [ ] 选中后回显

---

### Task 4.2: 疾病管理页面增强
**优先级**: P1  
**耗时**: 8h

基于现有 `DiseaseManagementPage.tsx` 增强：

```typescript
// 新增功能
interface EnhancedDiseaseManagementPage {
  // 层级筛选
  hierarchyFilter: {
    chapters: Chapter[];
    sections: Section[];
    categories: Category[];
  };
  
  // 保险元数据编辑
  insuranceMetadataEditor: {
    severityLevel: SelectField;
    underwritingDecision: SelectField;
    isChronic: CheckboxField;
    isMalignant: CheckboxField;
    typicalReimbursementRate: NumberField;
  };
  
  // 统计面板
  statisticsPanel: {
    totalDiseases: number;
    byChapter: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  
  // 批量操作
  batchOperations: ['updateMetadata', 'activate', 'deactivate', 'export'];
}
```

**验收标准**:
- [ ] 层级树形筛选
- [ ] 保险元数据编辑
- [ ] 统计面板
- [ ] 批量操作

---

## 7. Phase 5: 系统集成 (2天)

### Task 5.1: 理赔系统集成
**优先级**: P0  
**耗时**: 8h

```typescript
// server/claims/icd10Integration.ts

/**
 * 理赔案件疾病验证
 */
export async function validateClaimDiagnoses(
  claimCaseId: string,
  diagnosisCodes: string[]
): Promise<DiagnosisValidationResult> {
  
  const validations = await Promise.all(
    diagnosisCodes.map(async (code) => {
      // 1. 匹配疾病编码
      const matchResult = await icd10MatchService.matchDisease(code, {
        enableAI: false // 理赔场景不使用AI匹配
      });
      
      if (!matchResult.matched) {
        return {
          code,
          valid: false,
          reason: '编码未匹配',
          suggestions: matchResult.suggestions
        };
      }
      
      const disease = matchResult.disease!;
      
      // 2. 获取保单信息
      const claimCase = await claimCaseService.getById(claimCaseId);
      const policy = await policyService.getById(claimCase.policyId);
      
      // 3. 验证保障范围
      const coverageCheck = await checkDiseaseCoverage(disease, policy);
      
      // 4. 检查既往症
      const preExistingCheck = await checkPreExistingCondition(
        disease,
        claimCase.insuredId,
        claimCase.diagnosisDate,
        policy.effectiveDate
      );
      
      // 5. 计算赔付比例
      const reimbursementRate = calculateReimbursementRate(
        disease,
        policy,
        claimCase
      );
      
      return {
        code,
        valid: true,
        disease,
        coverage: coverageCheck,
        preExisting: preExistingCheck,
        reimbursementRate,
        decision: makeDecision(coverageCheck, preExistingCheck)
      };
    })
  );
  
  return {
    claimCaseId,
    validations,
    overallValid: validations.every(v => v.valid),
    summary: generateSummary(validations)
  };
}

/**
 * 检查疾病是否在保障范围
 */
async function checkDiseaseCoverage(
  disease: ICD10Disease,
  policy: Policy
): Promise<CoverageCheckResult> {
  
  const metadata = disease.insuranceMetadata;
  
  // 1. 检查除外责任
  if (metadata?.underwritingDecision === 'exclusion') {
    return { covered: false, reason: '疾病属于除外责任' };
  }
  
  // 2. 检查先天性疾病
  if (metadata?.isCongenital && !policy.coversCongenital) {
    return { covered: false, reason: '先天性疾病不在保障范围' };
  }
  
  // 3. 检查特定疾病限制
  if (metadata?.isMalignant && policy.malignantWaitingPeriod) {
    // 检查等待期
  }
  
  return { covered: true };
}
```

**验收标准**:
- [ ] 理赔单据疾病验证
- [ ] 既往症自动检测
- [ ] 赔付比例自动计算
- [ ] 核赔建议生成

---

### Task 5.2: 核保系统集成
**优先级**: P0  
**耗时**: 8h

```typescript
// server/underwriting/icd10Integration.ts

/**
 * 核保风险评估
 */
export async function assessUnderwritingRisk(
  applicationId: string,
  disclosedDiseases: string[],
  applicantInfo: ApplicantInfo
): Promise<UnderwritingAssessment> {
  
  const diseaseAssessments = await Promise.all(
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
      
      // 基础风险评估
      let riskLevel: RiskLevel = 'low';
      let decision: UnderwritingDecision = 'standard';
      let extraPremiumRate = 0;
      let exclusions: string[] = [];
      
      // 根据疾病严重程度评估
      switch (metadata?.severityLevel) {
        case 'critical':
          riskLevel = 'very-high';
          decision = 'decline';
          break;
        case 'severe':
          riskLevel = 'high';
          decision = metadata.underwritingDecision === 'standard' 
            ? 'rated' 
            : metadata.underwritingDecision;
          extraPremiumRate = 0.5;
          break;
        case 'moderate':
          riskLevel = 'medium';
          decision = metadata.underwritingDecision || 'rated';
          extraPremiumRate = 0.25;
          break;
        case 'minor':
          riskLevel = 'low';
          decision = 'standard';
          break;
      }
      
      // 慢性病除外
      if (metadata?.isChronic) {
        exclusions.push(`${disease.name}及其并发症`);
      }
      
      // 先天性疾病
      if (metadata?.isCongenital) {
        exclusions.push('先天性疾病及其并发症');
      }
      
      // 年龄调整
      if (applicantInfo.age > 50 && riskLevel === 'medium') {
        riskLevel = 'high';
        extraPremiumRate += 0.1;
      }
      
      return {
        code,
        disease,
        assessed: true,
        riskLevel,
        decision,
        extraPremiumRate,
        exclusions,
        requiresMedicalExam: riskLevel === 'high' || riskLevel === 'very-high',
        riskScore: calculateRiskScore(disease, applicantInfo)
      };
    })
  );
  
  // 综合评估
  const overallRisk = aggregateRiskScores(diseaseAssessments);
  const overallDecision = determineOverallDecision(diseaseAssessments);
  
  return {
    applicationId,
    diseaseAssessments,
    overallRiskLevel: overallRisk.level,
    overallRiskScore: overallRisk.score,
    overallDecision,
    recommendations: generateRecommendations(diseaseAssessments),
    requiresManualReview: diseaseAssessments.some(d => d.requiresManualReview)
  };
}
```

**验收标准**:
- [ ] 疾病风险评估
- [ ] 加费计算
- [ ] 除外责任生成
- [ ] 体检建议

---

## 8. Phase 6: 测试与优化 (2天)

### Task 6.1: 单元测试
**优先级**: P0  
**耗时**: 6h

```typescript
// services/__tests__/icd10Service.test.ts

describe('ICD10Service', () => {
  beforeAll(async () => {
    await icd10Service.initialize();
  });
  
  describe('getByCode', () => {
    it('应该根据编码精确查找疾病', async () => {
      const disease = await icd10Service.getByCode('J44.900');
      expect(disease).toBeDefined();
      expect(disease?.code).toBe('J44.900');
    });
    
    it('应该返回 null 对于不存在的编码', async () => {
      const disease = await icd10Service.getByCode('XXX.000');
      expect(disease).toBeNull();
    });
  });
  
  describe('search', () => {
    it('应该支持名称模糊搜索', async () => {
      const results = await icd10Service.search('哮喘');
      expect(results.items.length).toBeGreaterThan(0);
      expect(results.items[0].name).toContain('哮喘');
    });
    
    it('应该支持编码搜索', async () => {
      const results = await icd10Service.search('J45');
      expect(results.items[0].code).toStartWith('J45');
    });
  });
  
  describe('性能测试', () => {
    it('单次查找应该 < 10ms', async () => {
      const start = performance.now();
      await icd10Service.getByCode('J44.900');
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(10);
    });
    
    it('搜索应该 < 100ms', async () => {
      const start = performance.now();
      await icd10Service.search('糖尿病');
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });
});
```

**验收标准**:
- [ ] 核心服务测试覆盖 > 80%
- [ ] 性能测试通过
- [ ] 边界条件测试

---

### Task 6.2: 集成测试与优化
**优先级**: P1  
**耗时**: 10h

**测试场景**:

| 场景 | 测试内容 | 预期结果 |
|------|----------|----------|
| 理赔验证 | 输入 10 个诊断编码 | 全部正确匹配，响应 < 500ms |
| 核保评估 | 复杂病史（5种疾病） | 准确计算风险，生成建议 |
| 批量导入 | 导入 1000 条数据 | 无错误，进度正常更新 |
| 并发搜索 | 100 并发搜索请求 | 平均响应 < 200ms |
| 大数据量 | 加载全部 34,227 条 | 内存占用 < 200MB |

**性能优化清单**:

- [ ] 搜索索引优化
- [ ] 缓存命中率监控
- [ ] 内存使用优化
- [ ] 并发处理优化

---

## 9. 任务清单汇总

### Phase 1: 基础设施 (2天)
| 任务 | 耗时 | 优先级 |
|------|------|--------|
| 1.1 创建 TypeScript 类型定义 | 4h | P0 |
| 1.2 创建存储结构和初始化脚本 | 6h | P0 |
| 1.3 创建索引文件 | 4h | P1 |

### Phase 2: 核心服务 (3天)
| 任务 | 耗时 | 优先级 |
|------|------|--------|
| 2.1 ICD10Service 实现 | 8h | P0 |
| 2.2 ICD10MatchService | 8h | P0 |
| 2.3 缓存和性能优化 | 8h | P1 |

### Phase 3: 数据导入 (2天)
| 任务 | 耗时 | 优先级 |
|------|------|--------|
| 3.1 Excel 导入服务 | 8h | P0 |
| 3.2 导入管理界面 | 8h | P1 |

### Phase 4: 前端界面 (2天)
| 任务 | 耗时 | 优先级 |
|------|------|--------|
| 4.1 ICD10Selector 组件 | 8h | P0 |
| 4.2 疾病管理页面增强 | 8h | P1 |

### Phase 5: 系统集成 (2天)
| 任务 | 耗时 | 优先级 |
|------|------|--------|
| 5.1 理赔系统集成 | 8h | P0 |
| 5.2 核保系统集成 | 8h | P0 |

### Phase 6: 测试优化 (2天)
| 任务 | 耗时 | 优先级 |
|------|------|--------|
| 6.1 单元测试 | 6h | P0 |
| 6.2 集成测试与优化 | 10h | P1 |

---

## 10. 关键决策确认

在开发开始前，请确认以下决策：

### 10.1 数据相关
- [ ] **数据量**: 34,227 条 ICD-10 医保 2.0 版数据
- [ ] **编码格式**: 诊断代码 6 位格式 (如 A00.000)
- [ ] **数据更新**: 是否需要支持增量更新？

### 10.2 功能相关
- [ ] **AI 匹配**: 是否启用 AI 语义匹配 (Level 4) ？
- [ ] **多标准**: 是否需要支持 WHO/GB 标准？
- [ ] **历史数据**: 是否需要迁移现有 Disease 数据？

### 10.3 集成相关
- [ ] **理赔集成**: 是否立即集成到现有理赔流程？
- [ ] **核保集成**: 是否立即集成到现有核保流程？
- [ ] **优先级**: 理赔 vs 核保 哪个优先？

---

## 11. 开发启动准备

确认以上决策后，执行以下步骤开始开发：

1. **运行转换脚本**:
   ```bash
   npm run convert-icd10
   ```

2. **验证数据**:
   ```bash
   npm run verify-icd10
   ```

3. **启动开发服务器**:
   ```bash
   npm run dev
   ```

4. **运行测试**:
   ```bash
   npm test -- icd10
   ```

---

**计划状态**: 待确认  
**确认后**: 生成详细开发任务文件
