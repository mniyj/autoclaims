# 索赔材料类型识别保存与 Schema 查询实现计划

## TL;DR

> **目标**: 实现索赔端材料类型识别的持久化保存，并在理赔员后台展示，支持按分类查询对应的结构化提取 Schema 进行解析。
>
> **核心变更**:
> - 扩展 `ProcessedFile` 类型，添加 `materialId`, `materialName`, `classificationConfidence`
> - 更新导入流程传递分类信息到后端
> - 新增材料分类展示和修改功能
> - 新增 `/api/materials/:id/schema` API 获取提取配置
> - 实现基于 Schema 的单文件解析流程
>
> **预计工作量**: Medium (5-8 个任务)
> **并行执行**: YES (3 个波浪)
> **关键路径**: 类型定义 → API 更新 → 前端展示 → 解析功能

---

## Context

### 原始需求
索赔端上传的材料在前端做了一次类型识别，这个识别的结果要保存，一同展示在理赔员后台，后面用户点击解析后，需要根据分类查询该分类对应的结构化提取 schema。

### 需求确认结果
1. **分类修正机制** - ✅ 允许理赔员在后台手动修改材料分类
2. **未识别材料处理** - ✅ 如果 AI 识别为 "unknown" 或低置信度，理赔员能手动指定分类
3. **解析触发方式** - ✅ A) 单个文件点击解析
4. **Schema 版本** - ✅ 材料定义更新后，下次手动点击"解析"时使用新的 schema 重新解析

### 现有系统状态
- **类型识别**: 已在 `OfflineMaterialImportDialog` 中实现，调用 `/api/materials/classify`
- **识别结果**: 包含 `materialId`, `materialName`, `confidence`，但仅在前端临时使用
- **材料 Schema**: 存储在 `jsonlist/claims-materials.json`，包含 `extractionConfig.jsonSchema`
- **材料展示**: `MaterialReviewPanel` 及相关组件，当前不显示分类信息

---

## Work Objectives

### 核心目标
实现材料类型识别结果的端到端保存、展示和应用，支持理赔员基于分类进行结构化数据提取。

### 具体交付物
1. 扩展的 `ProcessedFile` / `ParsedDocument` 类型定义
2. 更新后的 `claim-documents` API（存储/查询分类信息）
3. 新增 `/api/materials/:materialId/schema` 查询 API
4. 带分类展示和修改功能的材料审核面板
5. 基于 Schema 的单文件解析功能

### 定义 of Done
- [ ] 导入材料后，在理赔后台能看到材料分类名称和置信度
- [ ] 能手动修改材料分类（包括未识别材料指定分类）
- [ ] 点击"解析"能获取对应 Schema 并调用 AI 提取
- [ ] 提取结果正确展示在材料详情中

### Must Have
- 材料分类信息的持久化存储
- 理赔后台展示分类名称和置信度
- 分类修改功能
- 基于 Schema 的单文件解析

### Must NOT Have (Guardrails)
- 批量解析功能（本次只实现单文件）
- 自动重解析（只在用户点击时解析）
- 复杂的审批流程

---

## Verification Strategy

### 测试决策
- **基础设施**: 无测试框架
- **测试策略**: 无单元测试，依赖 Agent-Executed QA Scenarios
- **QA 方式**: 每个任务包含详细的 Playwright 或手动验证场景

### QA Policy
每个任务必须包含 Agent-Executed QA Scenarios：
- **Frontend/UI**: Playwright 验证展示和交互
- **API**: curl 验证接口返回
- **数据流**: 验证端到端数据一致性

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - 可立即开始):
├── Task 1: 扩展类型定义 (ProcessedFile + ParsedDocument)
├── Task 2: 更新 claim-documents API 存储逻辑
└── Task 3: 添加 /api/materials/:id/schema 查询 API

Wave 2 (Frontend Display - 依赖 Wave 1):
├── Task 4: 更新导入对话框传递分类信息
├── Task 5: 材料卡片展示分类名称和置信度
└── Task 6: 添加分类修改功能

Wave 3 (Parsing Feature - 依赖 Wave 1+2):
├── Task 7: 实现基于 Schema 的单文件解析
└── Task 8: 展示解析结果

Wave FINAL (Verification):
├── Task F1: 端到端流程验证
└── Task F2: 代码质量检查
```

### Dependency Matrix
| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 (Types) | - | 2, 4 |
| 2 (API Storage) | 1 | 4 |
| 3 (Schema API) | - | 7 |
| 4 (Import Update) | 1, 2 | 5, 6 |
| 5 (Card Display) | 4 | F1 |
| 6 (Classification Edit) | 4 | F1 |
| 7 (Parsing) | 3 | 8 |
| 8 (Result Display) | 7 | F1 |

---

## TODOs

### Wave 1: Foundation

- [ ] 1. 扩展类型定义 - ProcessedFile 添加分类字段

  **What to do**:
  在 `types.ts` 中扩展 `ProcessedFile` 和 `ParsedDocument` 接口，添加以下字段：
  - `materialId?: string` - 材料类型 ID (如 "mat-1")
  - `materialName?: string` - 材料类型名称 (如 "身份证正面")
  - `classificationConfidence?: number` - 分类置信度 (0-1)
  - `classificationSource?: 'ai' | 'manual'` - 分类来源

  **Must NOT do**:
  - 不要修改现有必需字段的类型
  - 不要删除任何现有字段

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: 简单类型扩展，快速完成

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 2, Task 4

  **References**:
  - `types.ts:1666-1693` - 现有的 ParsedDocument 定义
  - `types.ts:7-13` - ProcessedFile 引用位置

  **Acceptance Criteria**:
  - [ ] TypeScript 编译无错误 (`tsc --noEmit`)
  - [ ] 新字段都是可选的（向后兼容）

  **QA Scenarios**:
  ```
  Scenario: 类型编译检查
    Tool: Bash
    Steps:
      1. 运行 tsc --noEmit
    Expected Result: 无 TypeScript 错误
  ```

  **Commit**: YES
  - Message: `feat(types): add material classification fields to ProcessedFile`
  - Files: `types.ts`

---

- [ ] 2. 更新 claim-documents API - 存储分类信息

  **What to do**:
  1. 修改 `server/apiHandler.js` 中 claim-documents 的 POST/PUT 处理逻辑
  2. 接收并存储 `materialId`, `materialName`, `classificationConfidence`, `classificationSource`
  3. 修改 GET 处理逻辑，返回这些字段

  **Must NOT do**:
  - 不要破坏现有数据结构
  - 不要要求新字段为必需

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: 需要理解现有 API 结构，中等复杂度

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:
  - `server/apiHandler.js` - claim-documents 相关处理
  - `jsonlist/claim-documents.json` - 查看现有存储结构

  **Acceptance Criteria**:
  - [ ] POST /api/claim-documents 能保存分类信息
  - [ ] GET /api/claim-documents 能返回分类信息

  **QA Scenarios**:
  ```
  Scenario: API 保存分类信息
    Tool: Bash (curl)
    Steps:
      1. POST /api/claim-documents with classification fields
      2. GET /api/claim-documents/:id
    Expected Result: 返回的数据包含 classification 字段
  ```

  **Commit**: YES
  - Message: `feat(api): support material classification in claim-documents`
  - Files: `server/apiHandler.js`

---

- [ ] 3. 添加 Schema 查询 API

  **What to do**:
  1. 在 `server/apiHandler.js` 添加新路由 `/api/materials/:materialId/schema`
  2. 从 `jsonlist/claims-materials.json` 读取材料定义
  3. 返回对应材料的 `extractionConfig`（包含 `jsonSchema` 和 `aiAuditPrompt`）

  **Must NOT do**:
  - 不要返回完整的材料定义（只需要 extractionConfig）
  - 不要缓存结果（Schema 可能会更新）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: 简单查询 API

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 7

  **References**:
  - `jsonlist/claims-materials.json:1-50` - 材料结构示例
  - `server/apiHandler.js` - 现有路由处理方式

  **Acceptance Criteria**:
  - [ ] GET /api/materials/mat-1/schema 返回对应 schema
  - [ ] 404 如果 materialId 不存在

  **QA Scenarios**:
  ```
  Scenario: Schema 查询
    Tool: Bash (curl)
    Steps:
      1. GET /api/materials/mat-1/schema
    Expected Result: 返回 { jsonSchema: {...}, aiAuditPrompt: "..." }
    Evidence: .sisyphus/evidence/task-3-schema-query.json
  ```

  **Commit**: YES
  - Message: `feat(api): add schema query endpoint for materials`
  - Files: `server/apiHandler.js`

---

### Wave 2: Frontend Display

- [ ] 4. 更新导入对话框传递分类信息

  **What to do**:
  1. 修改 `OfflineMaterialImportDialog.tsx`
  2. 在调用 `/api/import-offline-materials` 或相关 API 时
  3. 传递每个文件的 classification 信息（materialId, materialName, confidence）

  **Must NOT do**:
  - 不要修改现有导入流程的错误处理
  - 不要阻塞导入过程（分类是辅助信息）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: 修改现有组件，添加参数传递

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 1, Task 2
  - **Blocks**: Task 5

  **References**:
  - `components/OfflineMaterialImportDialog.tsx:276-290` - handleImport 函数
  - `components/OfflineMaterialImportDialog.tsx:105-132` - classify API 调用

  **Acceptance Criteria**:
  - [ ] 导入时传递 classification 到后端
  - [ ] 导入后刷新列表能看到分类信息

  **QA Scenarios**:
  ```
  Scenario: 导入时保存分类
    Tool: Playwright
    Preconditions: 理赔案件已创建
    Steps:
      1. 打开导入对话框
      2. 上传一张身份证图片
      3. 等待分类完成（显示"身份证正面"）
      4. 点击导入
      5. 刷新页面查看材料列表
    Expected Result: 材料卡片显示"身份证正面"标签
  ```

  **Commit**: YES
  - Message: `feat(import): pass classification to backend during import`
  - Files: `components/OfflineMaterialImportDialog.tsx`

---

- [ ] 5. 材料卡片展示分类名称和置信度

  **What to do**:
  1. 修改 `components/material-review/MaterialCard.tsx`
  2. 展示 `materialName`（材料类型名称）
  3. 显示 `classificationConfidence`（置信度，用颜色区分高/中/低）
  4. 如果未识别，显示"未识别"标签

  **Must NOT do**:
  - 不要过度设计置信度展示（简单标签即可）
  - 不要阻塞其他操作的展示

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []
  - Reason: UI 展示优化

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 4
  - **Blocks**: F1

  **References**:
  - `components/material-review/MaterialCard.tsx` - 卡片组件
  - `components/material-review/MaterialReviewPanel.tsx` - 父组件

  **Acceptance Criteria**:
  - [ ] 材料卡片显示分类名称
  - [ ] 显示置信度（>0.8 绿色, 0.5-0.8 黄色, <0.5 红色）
  - [ ] 未识别显示"未识别"标签

  **QA Scenarios**:
  ```
  Scenario: 分类信息展示
    Tool: Playwright
    Preconditions: 已有带分类的材料
    Steps:
      1. 进入理赔详情页
      2. 查看材料列表
    Expected Result: 每个材料卡片显示分类名称和置信度颜色标识
    Evidence: .sisyphus/evidence/task-5-card-display.png
  ```

  **Commit**: YES
  - Message: `feat(ui): display material classification in cards`
  - Files: `components/material-review/MaterialCard.tsx`

---

- [ ] 6. 添加分类修改功能

  **What to do**:
  1. 在 `MaterialCard` 或 `MaterialReviewDrawer` 中添加分类修改按钮
  2. 打开选择器，显示所有可用材料类型（从 `/api/claimsMaterials` 获取）
  3. 选择后调用 API 更新 `materialId`
  4. 更新 `classificationSource` 为 'manual'

  **Must NOT do**:
  - 不要自动重新解析（只更新分类）
  - 不要允许修改为不存在的材料类型

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []
  - Reason: UI 交互功能

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 4
  - **Blocks**: F1

  **References**:
  - `components/material-review/MaterialReviewDrawer.tsx` - 详情抽屉
  - `components/ui/Select.tsx` - 选择器组件（如果存在）

  **Acceptance Criteria**:
  - [ ] 点击修改分类打开选择器
  - [ ] 选择后材料分类更新
  - [ ] 手动修改的分类显示特殊标识

  **QA Scenarios**:
  ```
  Scenario: 修改材料分类
    Tool: Playwright
    Steps:
      1. 打开材料详情抽屉
      2. 点击"修改分类"
      3. 选择"诊断证明书"
      4. 确认修改
    Expected Result: 卡片显示新分类"诊断证明书"，标注"手动"
  ```

  **Commit**: YES
  - Message: `feat(ui): add material classification editing`
  - Files: `components/material-review/MaterialReviewDrawer.tsx` (或 MaterialCard.tsx)

---

### Wave 3: Parsing Feature

- [ ] 7. 实现基于 Schema 的单文件解析

  **What to do**:
  1. 在 `MaterialReviewDrawer` 中添加"解析"按钮
  2. 点击时：
     a. 获取当前材料的 `materialId`
     b. 调用 `/api/materials/:id/schema` 获取 Schema
     c. 调用 AI 提取 API（使用 Schema 和 Prompt）
     d. 保存提取结果

  **Must NOT do**:
  - 不要自动解析所有文件
  - 不要在没有 Schema 时解析（未识别材料）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: 涉及多个 API 调用和 AI 集成

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 3, Task 6
  - **Blocks**: Task 8

  **References**:
  - `services/invoiceOcrService.ts` - AI 调用参考
  - `server/ai/agent.js` - AI Agent 实现

  **Acceptance Criteria**:
  - [ ] 点击解析能获取最新 Schema
  - [ ] 调用 AI 进行结构化提取
  - [ ] 提取结果保存并展示

  **QA Scenarios**:
  ```
  Scenario: 单文件解析
    Tool: Playwright + API 验证
    Steps:
      1. 选择已分类的身份证材料
      2. 点击"解析"按钮
      3. 等待解析完成
    Expected Result: 显示提取的字段（姓名、身份证号等）
  ```

  **Commit**: YES
  - Message: `feat(parsing): implement schema-based document parsing`
  - Files: `components/material-review/MaterialReviewDrawer.tsx`, 可能新增 `services/documentParsingService.ts`

---

- [ ] 8. 展示解析结果

  **What to do**:
  1. 在 `MaterialReviewDrawer` 中展示解析结果
  2. 显示提取的字段（根据 Schema 动态渲染）
  3. 支持人工修正字段值
  4. 显示解析置信度

  **Must NOT do**:
  - 不要一次性展示所有历史解析结果
  - 不要自动保存修正（需要用户确认）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []
  - Reason: UI 展示和表单

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 7
  - **Blocks**: F1

  **References**:
  - `types.ts:2076-2149` - OCR Review Types
  - `components/material-review/MaterialReviewDrawer.tsx`

  **Acceptance Criteria**:
  - [ ] 解析结果正确展示
  - [ ] 字段可编辑并保存
  - [ ] 显示解析置信度

  **QA Scenarios**:
  ```
  Scenario: 解析结果展示
    Tool: Playwright
    Steps:
      1. 打开已解析的材料
      2. 查看解析结果区域
    Expected Result: 按 Schema 字段分组展示提取结果
  ```

  **Commit**: YES
  - Message: `feat(ui): display and edit parsing results`
  - Files: `components/material-review/MaterialReviewDrawer.tsx`

---

### Wave FINAL: Verification

- [ ] F1. 端到端流程验证

  **What to do**:
  完整测试以下流程：
  1. 导入材料 → 自动分类 → 展示分类
  2. 修改分类 → 更新展示
  3. 点击解析 → 获取 Schema → AI 提取 → 展示结果

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO

  **Acceptance Criteria**:
  - [ ] 全流程无阻断
  - [ ] 数据一致
  - [ ] 所有功能可用

  **QA Scenarios**:
  ```
  Scenario: 完整流程 E2E
    Tool: Playwright
    Steps:
      1. 创建新理赔案件
      2. 导入身份证图片
      3. 确认分类显示"身份证正面"
      4. 点击解析
      5. 验证提取结果字段
    Expected Result: 全流程成功，数据正确
  ```

  **Commit**: NO

---

- [ ] F2. 代码质量检查

  **What to do**:
  1. 运行 `tsc --noEmit` 检查 TypeScript
  2. 检查是否有 `console.log` 遗留
  3. 验证所有 API 路径正确

  **Acceptance Criteria**:
  - [ ] TypeScript 编译通过
  - [ ] 无调试代码
  - [ ] 无语法错误

  **Commit**: NO

---

## Commit Strategy

- **1**: `feat(types): add material classification fields`
- **2**: `feat(api): support material classification in claim-documents`
- **3**: `feat(api): add schema query endpoint for materials`
- **4**: `feat(import): pass classification to backend`
- **5**: `feat(ui): display material classification in cards`
- **6**: `feat(ui): add material classification editing`
- **7**: `feat(parsing): implement schema-based document parsing`
- **8**: `feat(ui): display and edit parsing results`

---

## Success Criteria

### 功能验证
```bash
# 1. 验证 Schema API
curl http://localhost:3000/api/materials/mat-1/schema

# 2. 验证 claim-documents 返回分类信息
curl http://localhost:3000/api/claim-documents?claimCaseId=xxx
```

### 最终检查清单
- [ ] 导入材料后能看到分类名称
- [ ] 能修改材料分类
- [ ] 能点击解析获取提取结果
- [ ] 所有 API 正常工作
- [ ] TypeScript 编译无错误
