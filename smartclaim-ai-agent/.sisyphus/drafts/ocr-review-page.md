# Draft: 理赔材料OCR结果审核页面

## 需求概述（已确认）
- **页面定位**：理赔员端的统一查看/审核页面
- **布局**：双栏布局 - 左侧材料预览 + 右侧识别结果编辑
- **核心功能**：
  1. 理赔材料预览（图片/PDF等）
  2. OCR识别结果以输入框形式展示
  3. 低置信度字段高亮提示
  4. 支持人工修正
- **数据背景**：不同理赔材料类型已有不同的schema配置

## 技术调研发现

### 1. 现有Schema配置系统
- **存储位置**：`jsonlist/claims-materials.json`
- **配置方式**：每个材料类型包含 `jsonSchema` 字段定义提取结构
- **字段示例**：身份证有 name, gender, ethnicity, birth_date, address, id_number 等
- **提取字段数**：38种材料类型，每种都有完整的schema定义

### 2. 现有置信度处理机制
- **AnchoredField组件**：`components/ui/AnchoredField.tsx`
- **置信度颜色系统**：
  - confidence > 0.9 → 绿色 ✓
  - 0.7 - 0.9 → 蓝色 🔍
  - < 0.7 → 黄色 ⚠️ 需人工处理
  - reviewFlag 存在 → 红色 强制复核
- **阈值配置**：`confidenceThreshold` 字段（默认0.9），在材料配置中可设置

### 3. OCR数据结构
- **已存在类型**：`types.ts` 中定义 MedicalInvoiceData, DischargeSummaryData 等
- **通用提取数据**：`ExtractedDocumentData` 类型支持动态字段
- **置信度字段**：每个字段可携带 confidence 值

### 4. 相关现有页面
- **InvoiceAuditPage.tsx**：发票审核页面（类似功能）
- **ClaimCaseDetailPage.tsx**：理赔详情页（展示提取结果）
- **OfflineMaterialImportDialog.tsx**：离线材料导入（展示分类置信度）

## 待确认问题
- [x] 支持哪些材料类型？→ **已存在38种材料类型，全部支持**
- [x] 置信度阈值如何配置？→ **已支持按材料类型配置 confidenceThreshold**
- [x] 高亮样式偏好？→ **复用现有 AnchoredField 颜色系统**
- [ ] 是否需要字段校验规则？
- [ ] 修正后的数据保存逻辑？

## 技术调研方向
- [ ] 现有OCR服务的返回数据结构
- [ ] 现有的schema配置存储位置
- [ ] 类似的预览/表单组件模式
- [ ] 文件预览组件现状
