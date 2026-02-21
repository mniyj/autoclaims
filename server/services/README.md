# 多文件处理服务

本目录包含理赔智能体的多文件处理和分析服务，支持 PDF、Word、Excel、视频等多种文件格式。

## 服务模块

### 1. documentParser.js - 文档解析服务

支持解析以下文档格式：

| 格式 | 底层实现 | 功能 |
|------|---------|------|
| PDF | pdf-parse | 文本提取 |
| PDF (表格) | pdfplumber (Python) | 表格提取 |
| Word | mammoth | 文本/HTML 提取 |
| Excel | xlsx | 数据解析 |

```javascript
import { parseDocument, parsePDF, parseWord, parseExcel } from './services/documentParser.js';

// 自动识别文件类型并解析
const result = await parseDocument(buffer, 'application/pdf');
```

### 2. fileProcessor.js - 统一文件处理服务

整合图片 OCR、文档解析、视频处理的统一入口。

```javascript
import { processFile, processFiles, getFileCategory } from './services/fileProcessor.js';

// 处理单个文件
const result = await processFile({
  ossKey: 'claims/xxx.pdf',
  ossUrl: 'https://...',
  fileName: 'invoice.pdf',
  mimeType: 'application/pdf',
  buffer: fileBuffer,
  options: { skipOCR: false }
});

// 批量处理文件
const results = await processFiles(files, { concurrency: 3 });
```

### 3. videoProcessor.js - 视频处理服务

使用 FFmpeg 提取关键帧，配合 Gemini Vision 进行分析。

```javascript
import { processVideo, extractKeyFrames } from './services/videoProcessor.js';

// 完整视频处理
const result = await processVideo({
  videoPath: '/path/to/video.mp4',
  options: {
    maxFrames: 10,
    extractAudio: true,
  }
});

// 返回关键帧和语音转写
// result.keyFrames - 关键帧列表
// result.audioTranscript - 语音转写文本
```

### 4. multiFileAnalyzer.js - 多文件联合分析服务

实现跨文件数据交叉验证和材料完整性检查。

```javascript
import { analyzeMultiFiles, checkDocumentCompleteness } from './services/multiFileAnalyzer.js';

// 执行联合分析
const result = await analyzeMultiFiles(parsedDocuments, {
  productCode: 'PROD001',
  claimCaseId: 'CASE001',
});

// 返回
// - crossValidation: 交叉验证结果
// - completeness: 材料完整性检查
// - interventionPoints: 人工介入点
```

## 交叉验证规则

| 验证类型 | 说明 |
|---------|------|
| amount_consistency | 发票金额 vs 费用清单总额 |
| date_consistency | 入院/出院日期、发票日期等 |
| identity | 患者姓名一致性 |
| timeline | 时间线合理性（事故→就诊→发票→报案） |

## API 端点

新增以下 API 端点：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/process-file` | POST | 单文件处理 |
| `/api/analyze-multi-files` | POST | 多文件联合分析 |
| `/api/ai/smart-review-v2` | POST | 增强版智能审核 |
| `/api/infer-file-type` | POST | 文件类型推断 |

### 使用示例

```bash
# 单文件处理
curl -X POST http://localhost:8080/api/process-file \
  -H "Content-Type: application/json" \
  -d '{
    "ossKey": "claims/invoice.pdf",
    "fileName": "发票.pdf",
    "mimeType": "application/pdf",
    "base64Data": "..."
  }'

# 多文件联合分析
curl -X POST http://localhost:8080/api/analyze-multi-files \
  -H "Content-Type: application/json" \
  -d '{
    "claimCaseId": "CASE001",
    "productCode": "PROD001",
    "documents": [
      {"ossKey": "claims/1.jpg", "fileName": "发票1.jpg", "mimeType": "image/jpeg"},
      {"ossKey": "claims/2.pdf", "fileName": "报告.pdf", "mimeType": "application/pdf"}
    ]
  }'

# 增强版智能审核
curl -X POST http://localhost:8080/api/ai/smart-review-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "claimCaseId": "CASE001",
    "productCode": "PROD001",
    "documents": [...]
  }'
```

## 依赖安装

```bash
# Node.js 依赖
npm install pdf-parse mammoth xlsx

# Python 依赖（可选，用于 PDF 表格提取）
pip install pdfplumber

# FFmpeg（用于视频处理）
# macOS
brew install ffmpeg

# Linux (Ubuntu/Debian)
sudo apt install ffmpeg
```

## LangGraph 状态图增强

新增节点：
- `parse_all_documents` - 解析所有文档
- `check_document_completeness` - 材料完整性检查
- `request_more_docs` - 请求补充材料
- `ai_eligibility_review` - AI 责任复核

新增状态字段：
- `documents` - 原始文档列表
- `parsedDocuments` - 解析后的文档
- `crossValidationResults` - 交叉验证结果
- `documentCompleteness` - 完整性检查结果
- `interventionPoints` - 人工介入点

## 人工介入点

| 级别 | 类型 | 触发条件 |
|------|------|---------|
| 1 | document_incomplete | 材料不完整 |
| 2 | eligibility_doubt | 责任存疑 |
| 3 | amount_anomaly | 金额异常 |
| 4 | high_risk | 高风险案件 |
