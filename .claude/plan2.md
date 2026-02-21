# 自动化定责定损方案设计

## Context

用户正在开发理赔智能体，需要处理复杂案件中的多种文件类型（PDF、视频、Excel、Word、图片等），实现自动化的定责定损。现有系统已具备基础的 AI 审核能力，需要扩展支持多文件处理和更完善的工作流。

### 现有能力

| 模块 | 说明 | 关键文件 |
|------|------|----------|
| **LangGraph 状态图** | collect_documents → check_eligibility → calculate_amount → assess_risk → auto_approve/reject/human_review | `server/ai/graph.js` |
| **规则引擎** | ELIGIBILITY 域（责任判断）+ ASSESSMENT 域（金额计算），支持项目级别循环处理 | `server/rules/engine.js` |
| **OCR 服务** | Gemini / PaddleOCR / GLM-OCR 三种模式 | `server/apiHandler.js` |
| **医保目录匹配** | 5级匹配策略（精确→别名→模糊→AI语义） | `services/catalogMatchService.ts` |
| **文件上传** | OSS 存储，MultiImageUpload/FileUpload 组件 | `components/ui/` |

### 现有文件类型支持

- **已支持**: image/*, application/pdf (基础)
- **待增强**: video/*, .docx, .xlsx

---

## 实施方案

### Phase 1: 多文件统一处理服务

**目标**: 建立统一的多类型文件解析能力

#### 1.1 新建文件处理服务

**文件**: `server/services/fileProcessor.js`

```
FileProcessingService
├── ImageParser      (现有 OCR，需整合)
├── PDFParser        (增强：文本提取 + AI 结构化)
├── VideoParser      (新建：关键帧 + 语音转写)
├── WordParser       (新建：文本提取 + AI 分析)
└── ExcelParser      (新建：数据解析 + 格式验证)
```

#### 1.2 新增类型定义

**文件**: `types.ts`

```typescript
interface ParsedDocument {
  documentId: string;
  fileName: string;
  fileType: FileType;
  ossKey: string;
  ossUrl: string;
  parseStatus: 'pending' | 'processing' | 'completed' | 'failed';

  // 解析结果
  extractedText?: string;
  structuredData?: Record<string, any>;
  ocrData?: MedicalInvoiceData | DischargeSummaryData;

  // 视频专用
  videoMetadata?: {
    duration: number;
    keyFrames: KeyFrame[];
    audioTranscript?: string;
  };

  // AI 分析结果
  aiAnalysis?: DocumentAnalysisResult;
  confidence: number;
}

type FileType =
  | 'image_invoice' | 'image_report' | 'image_scene' | 'image_id'
  | 'pdf_clause' | 'pdf_report'
  | 'video_scene' | 'video_surveillance'
  | 'excel_expense'
  | 'word_diagnosis'
  | 'other';
```

#### 1.3 技术选型

| 文件类型 | 推荐方案 | npm 包 |
|---------|---------|--------|
| PDF 文本提取 | pdf-parse | `pdf-parse` |
| Word 文档 | mammoth | `mammoth` |
| Excel 解析 | xlsx | `xlsx` |
| 视频处理 | FFmpeg + Gemini Vision | `fluent-ffmpeg` |

---

### Phase 2: 多文件联合分析

**目标**: 实现跨文件数据交叉验证

#### 2.1 新建联合分析器

**文件**: `server/services/multiFileAnalyzer.js`

验证规则：
- 发票金额 vs 费用清单总额
- 诊断日期 vs 入院/出院日期
- 患者姓名一致性
- 医院名称一致性
- 事故时间 vs 就诊时间

#### 2.2 交叉验证结果类型

```typescript
interface CrossValidationResult {
  type: 'amount_consistency' | 'date_consistency' | 'identity' | 'timeline';
  passed: boolean;
  severity: 'info' | 'warning' | 'error';
  details: Record<string, any>;
}
```

---

### Phase 3: 增强 LangGraph 状态图

**目标**: 扩展工作流支持材料完整性检查和多人工介入点

#### 3.1 新增节点

```
START
  ↓
collect_all_documents (新：文件解析 + 联合分析)
  ↓
check_document_completeness (新：材料完整性)
  ↓ ─────────────────────┐
  │ 不完整               │ 完整
  ↓                      ↓
request_more_docs    check_eligibility
(人工介入点1)              ↓
                      ├─ reject_claim
                      ├─ ai_eligibility_review (新)
                      │     ↓
                      │   ├─ human_review (人工介入点2)
                      │   └─ calculate_amount
                      └─ calculate_amount
                              ↓
                         assess_risk
                              ↓
                    ┌─────────┼─────────┐
                    ↓                   ↓
              auto_approve        human_review
                               (人工介入点3)
```

#### 3.2 新增状态字段

**文件**: `server/ai/state.js`

```javascript
const EnhancedClaimState = {
  // 文档数据 (新增)
  documents: { value: [], default: () => [] },
  parsedDocuments: { value: [], default: () => [] },
  crossValidationResults: { value: [], default: () => [] },

  // 材料完整性 (新增)
  documentCompleteness: { value: null },
  missingDocuments: { value: [], default: () => [] },

  // 人工介入点 (新增)
  interventionPoints: { value: [], default: () => [] },
};
```

---

### Phase 4: 视频处理能力

**目标**: 支持事故现场视频和监控视频分析

#### 4.1 视频处理流程

```
上传视频 → OSS存储 → FFmpeg关键帧提取 → Gemini Vision分析
                              ↓
                        音频提取 → 语音转文字
```

#### 4.2 关键帧分析

```javascript
// 每个视频提取最多10帧，间隔至少2秒
const keyFrames = await extractKeyFrames(videoPath, {
  maxFrames: 10,
  minInterval: 2000
});

// AI 分析每帧内容
for (const frame of keyFrames) {
  const description = await analyzeFrame(frame.imageData, {
    context: '事故现场分析'
  });
}
```

---

### Phase 5: 完整工作流集成

#### 5.1 人机协作模式

| 案件类型 | 自动化程度 | 人工介入点 |
|---------|-----------|-----------|
| 标准门诊 | 100% | 无 |
| 标准住院 | 80% | 风险评估后 |
| 复杂住院 | 50% | 材料验证 + 金额审核 |
| 重大案件 | 20% | 多级审核 |
| 欺诈嫌疑 | 0% | 全流程人工 |

#### 5.2 API 端点扩展

**文件**: `server/apiHandler.js`

```
POST /api/process-file          # 单文件处理
POST /api/analyze-multi-files   # 多文件联合分析
POST /api/smart-review-v2       # 增强版智能审核
GET  /api/claim/:id/documents   # 获取案件文档列表
```

---

## 关键文件清单

### 需新建

1. `server/services/fileProcessor.js` - 统一文件处理
2. `server/services/multiFileAnalyzer.js` - 多文件联合分析
3. `server/services/videoProcessor.js` - 视频处理
4. `server/services/documentParser.js` - PDF/Word 解析
5. `server/services/exceptionHandler.js` - 异常处理

### 需修改

1. `server/ai/graph.js` - 增强状态图
2. `server/ai/state.js` - 新增状态字段
3. `server/rules/engine.js` - 扩展规则支持
4. `server/apiHandler.js` - 新增 API 端点
5. `types.ts` - 新增类型定义

---

## 验证方案

1. **单元测试**: 测试各文件解析器的正确性
2. **集成测试**: 测试完整工作流
3. **端到端测试**: 上传多类型文件，验证定责定损结果

```bash
# 开发测试
npm run dev  # 启动服务

# 测试视频处理
curl -X POST http://localhost:8080/api/process-file \
  -H "Content-Type: application/json" \
  -d '{"ossKey": "videos/accident.mp4", "mimeType": "video/mp4"}'
```

---

## 实施路径

### 用户确认的方案

- **视频处理**: FFmpeg + Gemini Vision（本地关键帧提取 + 云端 AI 分析）
- **人机协作**: 自动为主，异常转人工
- **优先级**: 同时实现所有能力（多文件联合分析、材料完整性检查、视频处理、增强规则引擎）

### 分阶段实施

| Phase | 内容 | 预估工期 |
|-------|------|---------|
| 1 | 多文件统一处理服务 (PDF/Word/Excel) | 1-2 周 |
| 2 | 多文件联合分析 + 材料完整性检查 | 1-2 周 |
| 3 | 视频处理能力 (FFmpeg + Gemini Vision) | 1-2 周 |
| 4 | 增强 LangGraph 状态图 + 规则引擎扩展 | 1-2 周 |
| 5 | 完整工作流集成 + 人机协作优化 | 1-2 周 |

**总计**: 5-10 周

### 核心设计决策

1. **自动化优先**: 大部分案件自动处理，仅高风险或异常案件转人工审核
2. **多级人工介入**: 材料缺失 → 责任存疑 → 金额异常 → 高风险，四个介入点
3. **增量实现**: 各模块可独立上线，逐步增强系统能力

---

## 附录：Anthropic Skills vs 自建方案对比分析

### Anthropic Skills 本质

Anthropic 的文档处理 Skills **不是原生 API 能力**，而是 **指令文件 + 脚本集合**，告诉 Claude 如何使用开源库处理文档：

| Skill | 底层实现 | 说明 |
|-------|---------|------|
| **pdf** | pypdf, pdfplumber, reportlab | Python 库进行 PDF 操作 |
| **xlsx** | pandas, openpyxl + LibreOffice | Python + LibreOffice 公式重算 |
| **docx** | docx-js, pandoc, LibreOffice | JS 创建 + Python 编辑 |

### 详细对比

#### PDF 处理

| 维度 | Anthropic PDF Skill | 自建方案 (pdf-parse) |
|------|---------------------|---------------------|
| **底层库** | pypdf + pdfplumber | pdf-parse (Node.js) |
| **表格提取** | ✅ pdfplumber 原生支持 | ❌ 需额外处理 |
| **OCR 扫描件** | ✅ pytesseract + pdf2image | ✅ 可集成现有 OCR |
| **运行环境** | 需要 Python + 系统依赖 | Node.js 原生 |
| **部署复杂度** | 高（需 LibreOffice/Poppler） | 低（纯 npm） |

#### Excel 处理

| 维度 | Anthropic XLSX Skill | 自建方案 (xlsx) |
|------|---------------------|-----------------|
| **底层库** | openpyxl + pandas | xlsx (Node.js) |
| **公式重算** | ✅ LibreOffice 脚本 | ❌ 需额外处理 |
| **数据操作** | ✅ pandas 强大 | ✅ xlsx 足够 |
| **运行环境** | 需要 Python + LibreOffice | Node.js 原生 |

#### Word 处理

| 维度 | Anthropic DOCX Skill | 自建方案 (mammoth) |
|------|---------------------|-------------------|
| **底层库** | docx-js + pandoc | mammoth (Node.js) |
| **创建文档** | ✅ 功能完整 | ❌ 仅读取 |
| **编辑文档** | ✅ XML 操作 | ❌ 仅提取文本 |
| **运行环境** | JS + Python + pandoc | Node.js 原生 |

### 最终推荐：混合方案

考虑到项目是 **Node.js 技术栈**，推荐：

| 文件类型 | 推荐方案 | 理由 |
|---------|---------|------|
| **PDF (简单)** | pdf-parse | 纯 Node，部署简单 |
| **PDF (复杂/表格)** | pdfplumber (Python 子进程) | 表格提取能力强 |
| **Excel** | xlsx | Node 原生，够用 |
| **Word (读取)** | mammoth | Node 原生 |
| **Word (创建)** | docx-js | 功能完整 |
| **视频** | FFmpeg + Gemini Vision | 唯一可行方案 |

### 技术选型调整

```javascript
// server/services/fileProcessor.js
const parsers = {
  // PDF: 简单用 Node，复杂用 Python
  pdf: {
    simple: require('pdf-parse'),           // 纯文本提取
    complex: () => spawnPython('pdfplumber') // 表格提取
  },

  // Excel: xlsx 足够
  xlsx: require('xlsx'),

  // Word: mammoth 读取 + docx 创建
  docxRead: require('mammoth'),
  docxCreate: require('docx'),

  // 视频: FFmpeg
  video: require('fluent-ffmpeg')
};
```

### 结论

**Anthropic Skills 和自建方案本质相同** - 都是用开源库处理文档。选择标准是：

1. **技术栈匹配**: Node.js 项目优先用 npm 包
2. **部署复杂度**: 避免 LibreOffice 等重依赖
3. **功能需求**: 表格提取用 Python，其他用 Node
