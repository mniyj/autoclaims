# 工作计划：理赔材料OCR结果审核页面

## 项目概述

### 核心目标
为理赔员创建一个统一的OCR识别结果审核页面，支持查看原始材料、编辑识别结果、校验数据、处理低置信度字段。

### 嵌入位置
- **父页面**：赔案清单页面 (ClaimCaseListPage) 或相关赔案详情
- **具体位置**：赔案信息 → 材料审核 Tab

### 功能特性
1. **双栏布局**：左侧材料预览 + 右侧识别结果编辑
2. **动态表单**：根据材料 schema 自动生成输入表单
3. **置信度高亮**：低置信度字段（< threshold）高亮显示
4. **字段校验**：实时校验（身份证、日期、必填等）
5. **溯源跳转**：点击字段跳转到原始图片位置
6. **修正记录**：保存每次修正的历史记录
7. **批量操作**："全部通过"按钮一键确认高置信度字段

---

## 技术调研发现

### 1. Schema 配置系统（已存在）
```
文件：jsonlist/claims-materials.json
字段：jsonSchema - 每个材料类型的字段定义
示例材料：身份证正面、发票、病历、诊断证明等38种
```

### 2. 置信度系统（已存在）
```
组件：components/ui/AnchoredField.tsx
阈值字段：confidenceThreshold（默认0.9）
颜色系统：
  - >0.9: 绿色
  - 0.7-0.9: 蓝色  
  - <0.7: 黄色警告
  - reviewFlag: 红色强制复核
```

### 3. OCR 数据结构（已存在）
```
types.ts:
  - MedicalInvoiceData: 医疗发票
  - DischargeSummaryData: 出院小结
  - ExtractedDocumentData: 通用提取数据（含confidence）
  - SourceAnchor: 溯源锚点
```

### 4. 类似实现参考
```
- ClaimCaseDetailPage.tsx: 字段展示逻辑
- AnchoredField.tsx: 字段组件（含置信度指示）
- InvoiceAuditPage.tsx: 审核页面布局参考
```

---

## 数据模型

### OCR 提取结果数据结构
```typescript
interface OCRFieldValue {
  value: string | number | boolean;
  confidence: number;           // 0-1
  anchor?: SourceAnchor;        // 溯源锚点
  reviewFlag?: ReviewFlag;      // 复核标记
  approved?: boolean;           // 是否已通过审核
}

interface ExtractedData {
  [fieldKey: string]: OCRFieldValue;
}

interface OCRResult {
  documentId: string;
  materialType: string;         // 材料类型ID
  extractedData: ExtractedData;
  overallConfidence: number;
  extractedAt: string;
  model: string;                // 使用的AI模型
}
```

### 修正记录数据结构
```typescript
interface CorrectionRecord {
  id: string;
  documentId: string;
  fieldKey: string;
  originalValue: string;
  correctedValue: string;
  originalConfidence: number;
  correctedBy: string;          // 理赔员ID
  correctedAt: string;
  reason?: string;              // 修正原因（可选）
}
```

### Schema 解析后的字段定义
```typescript
interface ParsedSchemaField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required: boolean;
  format?: string;              // date, email, etc.
  description?: string;
  validation?: ValidationRule;
}
```

---

## 组件设计

### 1. 主页面组件
```
DocumentReviewPage.tsx
├── 左侧：DocumentPreviewPanel
│   ├── 图片/PDF 预览器
│   ├── 缩放控制
│   └── 高亮锚点标记
├── 右侧：ExtractionResultPanel
│   ├── 头部：MaterialInfoHeader
│   │   ├── 材料名称
│   │   ├── 整体置信度
│   │   └── "全部通过"按钮
│   ├── 内容：SchemaForm
│   │   └── 分组折叠面板
│   │       └── DynamicFieldInput
│   └── 底部：ActionFooter
│       ├── 保存修正
│       ├── 查看修正记录
│       └── 取消
└── 修正记录抽屉：CorrectionHistoryDrawer
```

### 2. 核心子组件

#### DynamicFieldInput
- 根据 schema 类型渲染不同输入组件
- 显示置信度指示器
- 支持溯源跳转
- 实时校验

#### FieldGroupPanel
- 可折叠的分组面板
- 显示组内低置信度字段数量
- 展开/折叠动画

#### DocumentPreviewPanel  
- 支持图片/PDF预览
- 缩放、拖拽
- 显示字段锚点高亮
- 响应字段点击跳转

---

## 校验规则

### 基础校验
```typescript
const validationRules = {
  // 身份证
  id_number: (v: string) => /^\d{17}[\dXx]$/.test(v) || '身份证号格式不正确',
  
  // 日期
  date: (v: string) => !isNaN(Date.parse(v)) || '日期格式不正确',
  
  // 手机号
  phone: (v: string) => /^1[3-9]\d{9}$/.test(v) || '手机号格式不正确',
  
  // 银行卡号
  bank_card: (v: string) => /^\d{16,19}$/.test(v) || '银行卡号格式不正确',
  
  // 必填
  required: (v: any) => (v !== '' && v !== null && v !== undefined) || '此项为必填',
}
```

### 字段名映射（自动推断）
```typescript
const fieldValidationMap: Record<string, string[]> = {
  'id_number': ['required', 'id_number'],
  'idNumber': ['required', 'id_number'],
  '身份证': ['required', 'id_number'],
  'phone': ['required', 'phone'],
  '手机号': ['required', 'phone'],
  'date': ['date'],
  '日期': ['date'],
  // ...
}
```

---

## API 设计

### 1. 获取OCR结果
```typescript
GET /api/ocr-results/:documentId
Response: {
  success: boolean;
  data: OCRResult;
}
```

### 2. 保存修正
```typescript
POST /api/ocr-results/:documentId/corrections
Body: {
  corrections: Array<{
    fieldKey: string;
    correctedValue: string;
    reason?: string;
  }>;
}
Response: {
  success: boolean;
  data: CorrectionRecord[];
}
```

### 3. 获取修正记录
```typescript
GET /api/ocr-results/:documentId/corrections
Response: {
  success: boolean;
  data: CorrectionRecord[];
}
```

### 4. 批量通过
```typescript
POST /api/ocr-results/:documentId/approve-all
Body: {
  fieldKeys?: string[];  // 可选，不传则通过所有高置信度字段
}
```

---

## 状态管理

### 页面状态
```typescript
interface ReviewPageState {
  // 数据
  document: ClaimDocument;
  ocrResult: OCRResult | null;
  materialConfig: ClaimMaterial | null;
  correctionHistory: CorrectionRecord[];
  
  // 表单状态
  formData: Record<string, OCRFieldValue>;
  validationErrors: Record<string, string>;
  
  // UI状态
  activeField: string | null;
  expandedGroups: string[];
  previewZoom: number;
  isCorrectionDrawerOpen: boolean;
  isSubmitting: boolean;
}
```

---

## 样式规范

### 颜色系统（复用现有）
```css
/* 置信度颜色 */
--confidence-high: #10b981;      /* >0.9 绿色 */
--confidence-medium: #3b82f6;    /* 0.7-0.9 蓝色 */
--confidence-low: #f59e0b;       /* <0.7 黄色 */
--confidence-error: #ef4444;     /* 强制复核 红色 */

/* 高亮样式 */
--highlight-bg-low: rgba(245, 158, 11, 0.1);
--highlight-border-low: rgba(245, 158, 11, 0.5);
```

### 布局
```
页面容器：flex h-screen
左侧预览：w-1/2 min-w-[500px]
右侧表单：w-1/2 flex-1 overflow-auto
分组面板：rounded-lg border border-gray-200
输入框：根据置信度动态添加 border-color 和 bg-color
```

---

## 文件结构

```
components/
├── document-review/
│   ├── DocumentReviewPage.tsx          # 主页面
│   ├── DocumentPreviewPanel.tsx        # 左侧预览面板
│   ├── ExtractionResultPanel.tsx       # 右侧结果面板
│   ├── SchemaForm.tsx                  # 动态表单
│   ├── FieldGroupPanel.tsx             # 分组折叠面板
│   ├── DynamicFieldInput.tsx           # 动态字段输入
│   ├── MaterialInfoHeader.tsx          # 材料信息头部
│   ├── CorrectionHistoryDrawer.tsx     # 修正记录抽屉
│   └── validation.ts                   # 校验规则
├── ui/
│   └── AnchoredField.tsx               # 已存在（复用）
```

---

## 风险与注意事项

### 1. 技术风险
- **Schema 解析复杂度**：不同材料的 schema 结构差异大，需要健壮的解析器
- **PDF 预览兼容性**：需要测试多种 PDF 格式的预览效果
- **溯源锚点精度**：OCR 返回的锚点坐标可能与实际位置有偏差

### 2. 产品风险
- **用户体验**：字段过多时，折叠分组的设计要保证易用性
- **性能**：大图片预览可能卡顿，需要考虑懒加载/缩略图
- **误操作**："全部通过"按钮需要有确认提示，防止误触

### 3. 依赖项
- 依赖现有的 `AnchoredField` 组件
- 依赖 `claims-materials.json` 中的 schema 配置
- 可能需要新增后端 API 支持修正记录存储

---

## 验收标准

### 功能验收
- [ ] 左侧正确显示原始材料预览（图片/PDF）
- [ ] 右侧根据 schema 正确渲染所有字段输入框
- [ ] 低置信度字段（< threshold）正确高亮显示
- [ ] 输入时实时进行字段校验并提示错误
- [ ] 点击字段能正确跳转到原始材料对应位置
- [ ] "全部通过"按钮能批量确认高置信度字段
- [ ] 修正后能正确保存修正记录
- [ ] 能查看历史修正记录

### 性能验收
- [ ] 页面加载时间 < 3秒
- [ ] 字段输入响应延迟 < 100ms
- [ ] 图片预览缩放流畅

### 兼容性验收
- [ ] 支持 Chrome/Firefox/Safari 最新两个版本
- [ ] 响应式布局支持最小 1280px 宽度

---

## 后续优化方向

1. **AI 辅助修正**：根据历史修正记录，智能推荐可能的正确值
2. **快捷键支持**：为常用操作添加快捷键（如 Ctrl+Enter 保存）
3. **对比模式**：支持左右对比原始图片和提取结果
4. **批量审核**：支持同时打开多个材料进行审核
5. **审核工作流**：集成到完整的理赔审核流程中
