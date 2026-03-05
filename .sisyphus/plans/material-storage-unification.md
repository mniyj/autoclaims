# 材料存储统一化迁移方案

## TL;DR

> **目标**：将 `fileCategories` (案件信息) 和 `claim-documents` (材料审核) 两套存储合并为统一的 `claim-materials` 存储，解决数据不互通、用户体验割裂的问题。
> 
> **关键变化**：
> - 新增 `jsonlist/claim-materials.json` 统一存储所有材料
> - 添加 `source` 字段区分来源：`direct_upload` | `batch_import`
> - 前端两个 Tab 从同一数据源读取，通过 `source` 过滤
> - 提供数据迁移脚本，保留历史数据
> 
> **风险等级**：中等（涉及核心存储层，需数据备份）
> **预估工期**：2-3 小时

---

## Context

### 当前架构问题
```
┌─────────────────────┐     ┌─────────────────────┐
│ claim-cases.json    │     │ claim-documents.json│
│ - fileCategories[]  │     │ - documents[]       │
│ - 案件信息 Tab      │ ❌   │ - 材料审核 Tab      │
└─────────────────────┘     └─────────────────────┘
```

### 目标架构
```
┌──────────────────────────────────────┐
│     claim-materials.json             │
│  ┌────────────────────────────────┐  │
│  │ 统一材料记录                    │  │
│  │ - source: direct_upload        │  │
│  │ - source: batch_import         │  │
│  │ - 所有字段标准化               │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
          ↙                    ↘
   案件信息 Tab            材料审核 Tab
   (filter by source)      (filter by source)
```

---

## Work Objectives

### Core Objective
合并两套材料存储为单一数据源，确保案件信息页上传的文件自动显示在材料审核页。

### Concrete Deliverables
1. **类型定义** (`types.ts`): 新增 `ClaimMaterial` 统一类型
2. **迁移脚本** (`server/migrations/001-merge-materials.js`): 数据迁移工具
3. **存储文件** (`jsonlist/claim-materials.json`): 新建统一存储
4. **API 改造** (`server/apiHandler.js`): 新增/修改 materials API
5. **前端适配** (`ClaimCaseDetailPage.tsx`): 统一数据源
6. **数据验证**: 迁移后数据完整性检查

### Definition of Done
- [ ] 旧数据完整迁移，无丢失
- [ ] 案件信息页上传的文件自动出现在材料审核页
- [ ] 批量导入功能正常工作
- [ ] 现有案件数据可正常查看
- [ ] 回滚方案可用（原数据保留）

### Must Have
- 数据零丢失迁移
- 向后兼容（旧案件可正常显示）
- 支持回滚

### Must NOT Have
- 不修改现有文件上传逻辑（风险太高）
- 不删除旧数据文件（仅标记 deprecated）
- 不改动材料审核的 AI 解析流程

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO (无自动化测试)
- **Automated tests**: NO
- **QA Method**: Agent-Executed Manual Verification

### QA Policy
每个任务包含具体的验证步骤，通过 API 调用和 UI 验证确认功能正确。

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - independent):
├── Task 1: 创建 ClaimMaterial 类型定义 [quick]
├── Task 2: 创建数据迁移脚本 [unspecified-high]
└── Task 3: 备份现有数据 [quick]

Wave 2 (Backend - depends on Wave 1):
├── Task 4: 新建 claim-materials API [unspecified-high]
├── Task 5: 修改案件保存逻辑，同时写入新材料表 [unspecified-high]
└── Task 6: 修改批量导入逻辑，写入 source=batch_import [unspecified-high]

Wave 3 (Frontend - depends on Wave 2):
├── Task 7: 修改 ClaimCaseDetailPage，统一数据源 [unspecified-high]
├── Task 8: 修改材料审核 Tab 数据加载逻辑 [unspecified-high]
└── Task 9: 验证案件信息 Tab 文件显示 [unspecified-high]

Wave 4 (Migration & Verification):
├── Task 10: 执行数据迁移 [unspecified-high]
├── Task 11: 数据完整性验证 [unspecified-high]
└── Task 12: 编写回滚脚本 [quick]

Wave FINAL:
├── Task F1: 全面功能测试 [unspecified-high]
└── Task F2: 清理废弃代码（可选） [unspecified-low]
```

---

## TODOs

- [ ] **Task 1: 创建 ClaimMaterial 统一类型定义**

  **What to do**:
  在 `types.ts` 中添加新的 `ClaimMaterial` 接口，统一材料数据结构：
  - 包含所有 fileCategories 和 claim-documents 的字段
  - 添加 `source` 字段区分来源
  - 添加 `metadata` 用于扩展信息

  **Must NOT do**:
  - 不删除现有类型（保持向后兼容）
  - 不修改 ProcessedFile 接口（已被多处引用）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: 纯类型定义工作，无复杂逻辑

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocked By**: None
  - **Blocks**: Task 2, Task 4

  **References**:
  - `types.ts:617-640` - ProcessedFile 接口参考
  - `types.ts:587` - ClaimFileCategory 类型参考

  **Acceptance Criteria**:
  - [ ] 新增 `ClaimMaterial` 接口定义
  - [ ] 包含字段：id, claimCaseId, fileName, fileType, url, ossKey, category, materialId, materialName, extractedData, auditConclusion, confidence, documentSummary, source, status, uploadedAt, processedAt, metadata
  - [ ] `source` 为枚举类型：`'direct_upload' | 'batch_import' | 'api_sync'`
  - [ ] TypeScript 编译无错误

  **QA Scenarios**:
  ```
  Scenario: 类型定义验证
    Tool: Bash
    Steps:
      1. 运行 npx tsc --noEmit 检查 types.ts
    Expected Result: 无类型错误
  ```

  **Commit**: YES
  - Message: `types: add ClaimMaterial unified interface`
  - Files: `types.ts`

---

- [ ] **Task 2: 创建数据迁移脚本**

  **What to do**:
  创建 `server/migrations/001-merge-materials.js`，将现有数据迁移到新格式：
  1. 读取 `claim-cases.json` 中的 `fileCategories`
  2. 读取 `claim-documents.json` 中的 `documents`
  3. 转换为统一的 `ClaimMaterial` 格式
  4. 写入 `jsonlist/claim-materials.json`
  5. 生成迁移报告

  **Must NOT do**:
  - 不修改源数据文件
  - 不删除任何数据

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: 需要仔细处理数据转换逻辑

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1)
  - **Blocked By**: None
  - **Blocks**: Task 10

  **References**:
  - `server/utils/fileStore.js` - readData/writeData 工具函数
  - `jsonlist/claim-cases.json:134-165` - fileCategories 数据结构示例
  - `jsonlist/claim-documents.json:1-40` - documents 数据结构示例

  **Acceptance Criteria**:
  - [ ] 脚本可独立运行：`node server/migrations/001-merge-materials.js`
  - [ ] 正确处理 fileCategories → ClaimMaterial 转换
  - [ ] 正确处理 claim-documents → ClaimMaterial 转换
  - [ ] 生成迁移报告（统计信息）
  - [ ] 去重检测（相同文件不重复创建）

  **QA Scenarios**:
  ```
  Scenario: 迁移脚本测试
    Tool: Bash
    Steps:
      1. 备份 jsonlist/claim-materials.json（如存在）
      2. 运行 node server/migrations/001-merge-materials.js
      3. 检查生成的 jsonlist/claim-materials.json
    Expected Result:
      - 文件存在且为有效 JSON
      - 包含 source=direct_upload 和 source=batch_import 的记录
      - 无重复记录
  ```

  **Commit**: YES
  - Message: `feat: add data migration script for materials unification`
  - Files: `server/migrations/001-merge-materials.js`

---

- [ ] **Task 3: 备份现有数据**

  **What to do**:
  在迁移前创建数据备份：
  1. 复制 `jsonlist/claim-cases.json` → `jsonlist/backup/claim-cases-YYYYMMDD.json`
  2. 复制 `jsonlist/claim-documents.json` → `jsonlist/backup/claim-documents-YYYYMMDD.json`

  **Must NOT do**:
  - 不修改备份数据

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocked By**: None
  - **Blocks**: Task 10

  **Acceptance Criteria**:
  - [ ] 创建 `jsonlist/backup/` 目录
  - [ ] 成功备份两个文件
  - [ ] 备份文件大小与源文件一致

  **QA Scenarios**:
  ```
  Scenario: 备份验证
    Tool: Bash
    Steps:
      1. ls -la jsonlist/backup/
      2. diff jsonlist/claim-cases.json jsonlist/backup/claim-cases-*.json
    Expected Result: diff 无差异
  ```

  **Commit**: NO（备份文件不入 git）

---

- [ ] **Task 4: 新建 claim-materials API**

  **What to do**:
  在 `server/apiHandler.js` 中添加新的 materials API：
  1. `GET /api/claim-materials?claimCaseId=xxx` - 查询案件的所有材料
  2. `GET /api/claim-materials?claimCaseId=xxx&source=direct_upload` - 按来源过滤
  3. `POST /api/claim-materials` - 添加新材料（直接上传）
  4. `PUT /api/claim-materials/:id/parse` - 触发解析

  **Must NOT do**:
  - 不删除现有的 claim-documents API（保持兼容）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: 需要理解现有 API 模式和错误处理

  **Parallelization**:
  - **Can Run In Parallel**: NO（依赖 Task 1 的类型）
  - **Blocked By**: Task 1
  - **Blocks**: Task 5, Task 7

  **References**:
  - `server/apiHandler.js:1595-1626` - claim-documents GET 实现参考
  - `server/apiHandler.js:2041-2056` - 保存文档逻辑参考
  - `server/utils/fileStore.js` - 数据读写工具

  **Acceptance Criteria**:
  - [ ] GET /api/claim-materials 支持 claimCaseId 过滤
  - [ ] GET /api/claim-materials 支持 source 过滤
  - [ ] POST /api/claim-materials 创建新材料记录
  - [ ] PUT /api/claim-materials/:id/parse 触发 AI 解析
  - [ ] API 返回统一的 ClaimMaterial 格式

  **QA Scenarios**:
  ```
  Scenario: API 测试
    Tool: Bash (curl)
    Steps:
      1. curl "http://localhost:3000/api/claim-materials?claimCaseId=claim-1"
      2. curl "http://localhost:3000/api/claim-materials?claimCaseId=claim-1&source=direct_upload"
    Expected Result:
      - HTTP 200
      - 返回 JSON 数组
      - 每个元素包含 source 字段
  ```

  **Commit**: YES
  - Message: `feat(api): add unified claim-materials endpoints`
  - Files: `server/apiHandler.js`

---

- [ ] **Task 5: 修改案件保存逻辑**

  **What to do**:
  修改案件更新/保存的 API 处理逻辑，在更新 `fileCategories` 时，同步更新 `claim-materials`：
  1. 在 `PUT /api/claim-cases/:id` 中，检测 `fileCategories` 变化
  2. 将新增的文件转换为 `ClaimMaterial` 记录
  3. 写入 `claim-materials.json`

  **Must NOT do**:
  - 不改变现有 fileCategories 保存逻辑
  - 不删除旧数据

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: 需要修改核心业务逻辑

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 4
  - **Blocks**: Task 7

  **References**:
  - `server/apiHandler.js` - 查找 claim-cases PUT 处理逻辑
  - `types.ts:587` - ClaimFileCategory 结构

  **Acceptance Criteria**:
  - [ ] 案件保存时自动同步到 claim-materials
  - [ ] 新上传的文件 source=direct_upload
  - [ ] 不重复创建已有文件

  **QA Scenarios**:
  ```
  Scenario: 文件上传同步测试
    Tool: Bash (curl)
    Steps:
      1. 上传文件到案件（模拟）
      2. 查询 /api/claim-materials?claimCaseId=xxx
    Expected Result:
      - 新上传文件出现在结果中
      - source 字段为 direct_upload
  ```

  **Commit**: YES
  - Message: `feat(api): sync fileCategories to claim-materials on save`
  - Files: `server/apiHandler.js`

---

- [ ] **Task 6: 修改批量导入逻辑**

  **What to do**:
  修改批量导入处理流程，在创建 claim-documents 记录时，同时写入 claim-materials：
  1. 找到批量导入完成后保存文档的代码
  2. 修改为同时写入 claim-materials.json
  3. 设置 source='batch_import'

  **Must NOT do**:
  - 不改变 claim-documents 保存（保持兼容）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 4
  - **Blocks**: Task 7

  **References**:
  - `server/apiHandler.js:2041-2056` - 现有批量导入保存逻辑

  **Acceptance Criteria**:
  - [ ] 批量导入的文件同时写入 claim-materials
  - [ ] source 字段为 batch_import

  **QA Scenarios**:
  ```
  Scenario: 批量导入测试
    Tool: 手动测试
    Steps:
      1. 使用批量导入功能导入文件
      2. 查询 claim-materials API
    Expected Result:
      - 导入的文件出现在结果中
      - source=batch_import
  ```

  **Commit**: YES
  - Message: `feat(api): sync batch import to claim-materials`
  - Files: `server/apiHandler.js`

---

- [ ] **Task 7: 修改前端数据源（ClaimCaseDetailPage）**

  **What to do**:
  修改 `ClaimCaseDetailPage.tsx`，统一使用新的 materials API：
  1. 添加新的 state: `claimMaterials`
  2. 修改数据加载逻辑，调用 `/api/claim-materials`
  3. 将 `reviewDocuments` 改为从 `claimMaterials` 过滤生成

  **Must NOT do**:
  - 不删除旧的 importedDocuments 逻辑（保留兼容性）
  - 不改变 UI 组件的 props 接口

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: 复杂前端组件修改

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 4, Task 5, Task 6
  - **Blocks**: Task 8, Task 9

  **References**:
  - `components/ClaimCaseDetailPage.tsx:137` - reviewDocuments state
  - `components/ClaimCaseDetailPage.tsx:479-507` - loadReviewData 函数
  - `components/ClaimCaseDetailPage.tsx:176` - fetchImportedDocuments 函数

  **Acceptance Criteria**:
  - [ ] 使用新的 claim-materials API 加载数据
  - [ ] reviewDocuments 从 claimMaterials 生成
  - [ ] 案件信息 Tab 的文件显示正常
  - [ ] 材料审核 Tab 的文件显示正常

  **QA Scenarios**:
  ```
  Scenario: 页面加载测试
    Tool: Browser DevTools
    Steps:
      1. 打开案件详情页
      2. 查看 Network 面板
      3. 验证调用了 /api/claim-materials
      4. 切换 Tab 验证数据一致性
    Expected Result:
      - 两个 Tab 的文件列表一致
      - 无重复请求
  ```

  **Commit**: YES
  - Message: `feat(ui): unify data source to claim-materials API`
  - Files: `components/ClaimCaseDetailPage.tsx`

---

- [ ] **Task 8: 修改材料审核 Tab 数据加载**

  **What to do**:
  修改材料审核 Tab 的渲染逻辑，使用统一的数据源：
  1. 修改 `loadReviewData` 函数，调用新 API
  2. 确保 reviewDocuments 包含所有来源的材料
  3. 在 UI 上显示来源标识（可选）

  **Must NOT do**:
  - 不改变 MaterialReviewPanel 的 props

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 7
  - **Blocks**: Task F1

  **References**:
  - `components/ClaimCaseDetailPage.tsx:1974-2001` - 材料审核 Tab 渲染

  **Acceptance Criteria**:
  - [ ] 材料审核 Tab 显示所有材料
  - [ ] 直接上传和批量导入的文件都可见

  **QA Scenarios**:
  ```
  Scenario: 材料审核 Tab 测试
    Tool: Browser
    Steps:
      1. 打开材料审核 Tab
      2. 验证显示所有文件
    Expected Result:
      - 案件信息页上传的文件在此可见
      - 批量导入的文件也在此可见
  ```

  **Commit**: YES
  - Message: `feat(ui): update material review tab to use unified data`
  - Files: `components/ClaimCaseDetailPage.tsx`

---

- [ ] **Task 9: 验证案件信息 Tab 文件显示**

  **What to do**:
  验证案件信息 Tab 的文件显示功能正常工作：
  1. 确保 localFileCategories 仍然从 claim-materials 生成
  2. 测试文件点击、预览、解析功能

  **Must NOT do**:
  - 不修改文件上传逻辑

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 7
  - **Blocks**: Task F1

  **Acceptance Criteria**:
  - [ ] 案件信息 Tab 显示文件列表
  - [ ] 文件点击可预览
  - [ ] 解析按钮正常工作

  **QA Scenarios**:
  ```
  Scenario: 案件信息 Tab 功能测试
    Tool: Browser
    Steps:
      1. 打开案件信息 Tab
      2. 点击文件预览
      3. 点击解析按钮
    Expected Result:
      - 预览弹窗正常显示
      - 解析功能正常工作
  ```

  **Commit**: NO（验证任务，无代码变更）

---

- [ ] **Task 10: 执行数据迁移**

  **What to do**:
  1. 确保已执行 Task 3（备份数据）
  2. 运行迁移脚本：`node server/migrations/001-merge-materials.js`
  3. 验证生成的 `claim-materials.json`

  **Must NOT do**:
  - 不在无备份的情况下运行

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 2, Task 3
  - **Blocks**: Task 11

  **Acceptance Criteria**:
  - [ ] 迁移脚本成功执行
  - [ ] 生成有效的 claim-materials.json
  - [ ] 记录数正确（无丢失）

  **QA Scenarios**:
  ```
  Scenario: 迁移验证
    Tool: Bash
    Steps:
      1. 运行迁移脚本
      2. 检查 jsonlist/claim-materials.json
      3. 统计记录数
    Expected Result:
      - 脚本正常结束
      - JSON 文件有效
      - 记录数 >= 原 fileCategories + claim-documents 数量
  ```

  **Commit**: NO（生成的数据文件不入 git，或选择性提交样本数据）

---

- [ ] **Task 11: 数据完整性验证**

  **What to do**:
  验证迁移后的数据完整性：
  1. 统计原数据记录数
  2. 统计新数据记录数
  3. 抽样验证关键字段

  **Must NOT do**:
  - 不修改数据

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 10
  - **Blocks**: Task F1

  **Acceptance Criteria**:
  - [ ] 创建验证脚本
  - [ ] 所有记录完整迁移
  - [ ] 关键字段无丢失

  **QA Scenarios**:
  ```
  Scenario: 数据完整性检查
    Tool: Node.js 脚本
    Steps:
      1. 统计 claim-cases.json 中的文件数
      2. 统计 claim-documents.json 中的文档数
      3. 统计 claim-materials.json 中的记录数
      4. 对比验证
    Expected Result:
      - claim-materials 记录数 >= 原数据总和
      - 无关键字段丢失
  ```

  **Commit**: NO（验证任务）

---

- [ ] **Task 12: 编写回滚脚本**

  **What to do**:
  创建回滚脚本 `server/migrations/rollback-001.js`：
  1. 删除 `claim-materials.json`
  2. 恢复使用旧的 API 和逻辑

  **Must NOT do**:
  - 不删除备份数据

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocked By**: None
  - **Blocks**: None

  **Acceptance Criteria**:
  - [ ] 回滚脚本可执行
  - [ ] 脚本安全（有确认提示）

  **QA Scenarios**:
  ```
  Scenario: 回滚测试
    Tool: Bash
    Steps:
      1. 执行回滚脚本
      2. 验证系统可回到旧模式
    Expected Result:
      - 脚本有确认提示
      - 回滚后系统正常工作
  ```

  **Commit**: YES
  - Message: `feat: add rollback script for materials migration`
  - Files: `server/migrations/rollback-001.js`

---

## Final Verification Wave

- [ ] **Task F1: 全面功能测试**

  **What to do**:
  进行端到端功能测试：
  1. 创建新案件，上传文件
  2. 验证文件在案件信息 Tab 可见
  3. 切换到材料审核 Tab，验证文件可见
  4. 执行批量导入
  5. 验证两类文件都显示正常
  6. 测试文件解析功能

  **QA Scenarios**:
  ```
  Scenario: 完整流程测试
    Tool: Browser + DevTools
    Steps:
      1. 创建新案件
      2. 上传 2-3 个文件
      3. 验证案件信息 Tab 显示
      4. 切换到材料审核 Tab
      5. 验证文件可见（关键！）
      6. 执行批量导入
      7. 验证所有文件可见
    Expected Result:
      - 案件信息 Tab 文件显示正常
      - 材料审核 Tab 显示所有文件（上传+导入）
      - 解析功能正常工作
  
  Scenario: 旧案件兼容性测试
    Tool: Browser
    Steps:
      1. 打开迁移前的旧案件
      2. 验证文件正常显示
    Expected Result:
      - 旧案件数据完整
      - 文件可正常预览
  ```

  **Evidence**: 
  - `.sisyphus/evidence/f1-materials-unification-test.md`

---

- [ ] **Task F2: 清理废弃代码（可选）**

  **What to do**:
  在验证稳定后，清理废弃代码：
  1. 移除对 claim-documents API 的调用
  2. 移除 fileCategories 的独立处理逻辑
  3. 添加 deprecation 注释

  **Must NOT do**:
  - 不删除数据文件（保留备份）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: []

  **Acceptance Criteria**:
  - [ ] 清理 claim-documents 直接调用
  - [ ] 代码整洁

  **QA Scenarios**:
  ```
  Scenario: 代码审查
    Tool: Grep
    Steps:
      1. grep -r "claim-documents" components/
      2. grep -r "importedDocuments" components/
    Expected Result:
      - 无直接 API 调用残留
  ```

  **Commit**: YES
  - Message: `refactor: clean up deprecated code after materials unification`

---

## Commit Strategy

### Wave 1 (Tasks 1-3)
```
types: add ClaimMaterial unified interface

- Add ClaimMaterial type with source field
- Support direct_upload and batch_import sources

feat: add data migration script for materials unification

- Create 001-merge-materials.js
- Migrate fileCategories and claim-documents to unified format

chore: backup existing data before migration
```

### Wave 2 (Tasks 4-6)
```
feat(api): add unified claim-materials endpoints

- GET /api/claim-materials with filtering
- POST for adding new materials
- PUT for triggering parse

feat(api): sync fileCategories to claim-materials on save

- Update PUT /api/claim-cases to sync materials

feat(api): sync batch import to claim-materials

- Update batch import to write to claim-materials
```

### Wave 3 (Tasks 7-9)
```
feat(ui): unify data source to claim-materials API

- Update ClaimCaseDetailPage to use new API
- Ensure both tabs share same data source

feat(ui): update material review tab to use unified data

- Load all materials from unified source
```

### Wave 4 (Tasks 10-12)
```
feat: execute materials data migration

- Run migration script
- Generate claim-materials.json

feat: add rollback script for materials migration

- Create rollback-001.js for emergency use
```

---

## Rollback Plan

### 触发条件
- 数据丢失或损坏
- 功能严重异常
- 用户投诉增加

### 回滚步骤
1. 停止应用服务
2. 运行回滚脚本：`node server/migrations/rollback-001.js`
3. 从备份恢复数据（如需要）：`cp jsonlist/backup/* jsonlist/`
4. 回滚代码到迁移前版本
5. 重启服务

### 回滚脚本内容
```javascript
// server/migrations/rollback-001.js
console.log('Rolling back materials unification...');
console.log('1. Removing claim-materials.json');
const fs = require('fs');
const path = require('path');

const materialsPath = path.join(__dirname, '../jsonlist/claim-materials.json');
if (fs.existsSync(materialsPath)) {
  fs.unlinkSync(materialsPath);
  console.log('   ✓ Removed claim-materials.json');
}

console.log('2. Note: Revert code changes manually or use git');
console.log('   git checkout HEAD~N -- server/apiHandler.js components/ClaimCaseDetailPage.tsx');
console.log('Rollback preparation complete.');
```

---

## Success Criteria

### 功能验证
```bash
# 1. 验证 API 可用
curl "http://localhost:3000/api/claim-materials?claimCaseId=claim-1" | jq

# 2. 验证数据完整性
node -e "const data=require('./jsonlist/claim-materials.json'); console.log('Total materials:', data.length)"

# 3. 验证按来源过滤
curl "http://localhost:3000/api/claim-materials?claimCaseId=claim-1&source=direct_upload" | jq '.[].source' | sort | uniq -c
```

### 最终检查清单
- [ ] 新案件上传文件后，材料审核 Tab 立即可见
- [ ] 批量导入功能正常工作
- [ ] 旧案件数据完整显示
- [ ] 文件解析功能正常
- [ ] 无重复数据
- [ ] 回滚方案已验证

### 性能指标
- [ ] API 响应时间 < 500ms
- [ ] 页面加载时间无明显增加

---

## Risk Assessment

| 风险 | 概率 | 影响 | 缓解措施 |
|-----|------|------|---------|
| 数据丢失 | 低 | 高 | 完整备份 + 迁移脚本测试 |
| 功能回退 | 中 | 中 | 渐进式迁移 + 并行运行 |
| 性能下降 | 低 | 中 | API 响应监控 |
| 用户困惑 | 低 | 低 | UI 保持不变 |

---

## Notes

### 关键设计决策
1. **保留旧数据文件**：不删除 `claim-cases.json` 和 `claim-documents.json`，仅标记为 deprecated
2. **source 字段**：明确区分数据来源，便于调试和统计
3. **向后兼容**：旧案件无需重新导入即可正常显示
4. **渐进式迁移**：前端逐步切换，保留回滚能力

### 后续优化（不在本次范围）
- 删除 deprecated API 和数据文件
- 优化 materials 查询性能（索引）
- 添加 materials 统计报表

