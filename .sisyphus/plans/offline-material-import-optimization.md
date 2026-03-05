# 离线材料导入业务逻辑优化计划

## TL;DR

> **目标**: 整体优化保险理赔系统中的"离线材料导入"功能，实现高效的批量文件上传、异步分类识别和结构化提取
>
> **核心改进**:
> - 重构上传流程：前端直接上传OSS，减少服务器中转
> - 实现签名URL自动刷新机制，解决URL过期问题
> - 批量分类API，减少网络往返
> - 增强错误处理和重试机制
> - 文件级进度追踪
>
> **交付物**: 优化后的 `OfflineMaterialImportDialog.tsx`, `ossService.ts`, 新的批量API端点, 增强的任务队列Worker
>
> **预计工作量**: Medium (4-6 hours)
> **并行执行**: YES - 4个Wave并行开发
> **关键路径**: Wave 1 (基础设施) → Wave 2 (后端API) → Wave 3 (Worker增强) → Wave 4 (前端集成)

---

## Context

### Original Request
整体优化"离线材料导入"的业务逻辑。用户批量上传材料后，先全部上传至 oss（注意 oss 返回的链接的时效性，再次调用的时候需要重新获取有效 url），再异步批量进行识别，每个材料先根据配置的理赔材料种类识别类型，确定类型后，根据不同类型配置的结构化提取 schema 进行结构化提取。上传的材料支持常见办公文件类型、图片类型、视频类型、音频类型。

### Interview Summary

**用户确认的关键决策**:
- 音频支持: ❌ 不需要（保持现有文件类型：图片、PDF、Word、Excel、视频）
- 上传流程: ✅ 优化为前端→OSS→后端异步（替代现有的base64传输）
- OSS URL管理: ✅ 签名URL，过期自动刷新
- 错误处理: ✅ 增强错误类型 + 重试机制
- 进度显示: ✅ 文件级进度 + 任务级状态

**技术约束**:
- 保持现有技术栈：React 19 + TypeScript + Express + 阿里云OSS
- 使用现有的任务队列系统（基于JSON文件存储）
- 保持向后兼容性

### Research Findings

**现有架构分析**:
1. **前端**: `OfflineMaterialImportDialog.tsx` - 476行，支持拖拽上传、文件分类、导入进度
2. **OSS服务**: `services/ossService.ts` - 已实现 `getSignedUrl()` 函数但使用不充分
3. **后端API**: `server/apiHandler.js` - 包含 `/api/import-offline-materials` 端点
4. **任务队列**: `server/taskQueue/queue.js` + `worker.js` - 基于JSON文件存储
5. **文件处理**: `server/services/fileProcessor.js` - 支持图片、PDF、Word、Excel、视频
6. **材料配置**: `types.ts` 中 `ClaimsMaterial` 类型定义了schema和提取配置

**识别的问题**:
1. 前端使用base64传输文件，大文件时内存压力大
2. 每个文件单独调用分类API，大批量时效率低
3. OSS URL可能在任务处理时过期
4. Worker基于文件存储，高并发时有IO瓶颈
5. 缺少批量分类API
6. 错误处理机制简单，无明确的重试策略

---

## Work Objectives

### Core Objective
重构离线材料导入的业务逻辑，实现：
1. 前端直接批量上传文件到OSS，返回OSS Key列表
2. 创建异步任务，后端批量下载→分类→结构化提取
3. 签名URL自动刷新机制
4. 增强的错误处理和重试机制
5. 文件级进度追踪

### Concrete Deliverables
1. **前端组件优化** (`components/OfflineMaterialImportDialog.tsx`)
   - 批量OSS上传功能
   - 上传进度显示
   - 批量分类结果展示

2. **OSS服务增强** (`services/ossService.ts`)
   - 签名URL生成工具
   - URL过期检测
   - 批量URL刷新

3. **后端API新增**
   - `POST /api/batch-upload-oss` - 获取OSS直传凭证
   - `POST /api/batch-classify` - 批量材料分类
   - `POST /api/import-offline-materials-v2` - 新版导入（接收OSS Key列表）

4. **任务队列增强** (`server/taskQueue/worker.js`)
   - 批量文件下载
   - 签名URL自动刷新
   - 增强错误处理和重试

5. **类型定义更新** (`types.ts`)
   - 新增批量上传相关类型
   - 任务状态类型扩展

### Definition of Done
- [ ] 用户可以批量选择50个文件一次性上传
- [ ] 上传过程中显示每个文件的进度
- [ ] OSS URL过期后自动刷新，识别过程不中断
- [ ] 批量分类API支持一次请求处理多个文件
- [ ] 识别失败的文件可以单独重试
- [ ] 所有测试通过，`npm run build` 无错误

### Must Have (Non-negotiable)
1. 前端直接上传OSS（不再通过base64传输）
2. 签名URL自动刷新机制
3. 批量分类API
4. 向后兼容（现有功能不受影响）

### Must NOT Have (Explicit Exclusions)
1. 不添加音频文件支持
2. 不修改数据库/持久化存储机制（保持JSON文件存储）
3. 不引入新的第三方服务（Redis、消息队列等）
4. 不修改材料配置管理界面
5. 不修改现有处理策略（invoice, structured_doc等）

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO (No automated tests configured)
- **Automated tests**: NO (Will rely on manual testing + Agent QA)
- **Test framework**: None (Project has no test runner)
- **Agent-Executed QA**: YES (Every task includes QA scenarios)

### QA Policy
Every task MUST include agent-executed QA scenarios:
- **Frontend/UI**: Use Playwright - Navigate, interact, assert DOM, screenshot
- **API**: Use Bash (curl) - Send requests, assert status + response fields
- **File operations**: Use Read tool - Verify file contents
- **Integration**: Use task agents - Execute end-to-end workflows

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Infrastructure - Foundation):
├── Task 1: OSS签名URL工具函数 [quick]
├── Task 2: 批量OSS直传凭证API [quick]
└── Task 3: 类型定义更新 [quick]

Wave 2 (Backend APIs - Parallel, depends on Wave 1):
├── Task 4: 批量分类API [unspecified-high]
├── Task 5: 新版导入API v2 [unspecified-high]
└── Task 6: URL刷新中间件 [quick]

Wave 3 (Worker Enhancement - Parallel, depends on Wave 2):
├── Task 7: Worker批量文件下载 [unspecified-high]
├── Task 8: Worker签名URL自动刷新 [unspecified-high]
└── Task 9: Worker错误处理增强 [unspecified-high]

Wave 4 (Frontend - Parallel, depends on Wave 1):
├── Task 10: 前端批量OSS上传 [visual-engineering]
├── Task 11: 前端批量分类集成 [visual-engineering]
└── Task 12: 前端进度显示优化 [visual-engineering]

Wave 5 (Integration & Testing):
├── Task 13: API集成测试 [deep]
├── Task 14: End-to-End测试 [deep]
└── Task 15: 向后兼容性验证 [deep]

Wave FINAL (Review - 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 4 → Task 7 → Task 10 → Task 13 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 6 (Waves 2, 3, 4)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 (OSS工具) | - | 2, 3, 6 |
| 2 (批量上传API) | 1 | 5 |
| 3 (类型定义) | 1 | 4, 5 |
| 4 (批量分类API) | 3 | 7, 8 |
| 5 (导入API v2) | 2, 3 | 13 |
| 6 (URL刷新中间件) | 1 | 7, 8 |
| 7 (Worker批量下载) | 4, 6 | 9 |
| 8 (Worker URL刷新) | 4, 6 | 9 |
| 9 (Worker错误处理) | 7, 8 | 13 |
| 10 (前端批量上传) | 2 | 11, 12 |
| 11 (前端批量分类) | 4, 10 | 12 |
| 12 (前端进度优化) | 10, 11 | 14 |
| 13 (API集成测试) | 5, 9 | 14 |
| 14 (E2E测试) | 12, 13 | 15 |
| 15 (兼容性验证) | 14 | F1-F4 |

### Agent Dispatch Summary

- **Wave 1**: **3** tasks → 1x `quick` (Tasks 1-3)
- **Wave 2**: **3** tasks → 2x `unspecified-high` (Tasks 4-5), 1x `quick` (Task 6)
- **Wave 3**: **3** tasks → 3x `unspecified-high` (Tasks 7-9)
- **Wave 4**: **3** tasks → 3x `visual-engineering` (Tasks 10-12)
- **Wave 5**: **3** tasks → 3x `deep` (Tasks 13-15)
- **Wave FINAL**: **4** tasks → 1x `oracle`, 2x `unspecified-high`, 1x `deep`

---

## TODOs

> Implementation + Test = ONE Task. Every task MUST have QA Scenarios.

- [ ] 1. **创建OSS签名URL工具函数**

  **What to do**:
  - 在 `services/ossService.ts` 中创建 `getSignedUrlWithRetry()` 函数
  - 实现URL过期检测逻辑
  - 实现自动刷新机制（检测到过期时重新获取）
  - 添加批量URL刷新函数 `refreshSignedUrls(ossKeys: string[])`

  **Must NOT do**:
  - 不修改现有的 `uploadToOSS` 函数（保持向后兼容）
  - 不引入新的OSS客户端库
  - 不修改后端OSS配置

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 纯工具函数，逻辑简单明确
  - **Skills**: [`typescript`]
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed for backend utility
    - `frontend-ui-ux`: Not applicable

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 2, 3, 6
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `services/ossService.ts:82-90` - 现有的 `getSignedUrl` 函数实现
  - `services/ossService.ts:6-44` - `uploadToOSS` 参考模式
  
  **API/Type References**:
  - `types.ts:671-714` - `ClaimMaterial` 类型（了解ossKey使用场景）
  
  **External References**:
  - 阿里云OSS文档 - 签名URL生成机制

  **WHY Each Reference Matters**:
  - 现有 `getSignedUrl` 是基础，需要在上面封装重试逻辑
  - `ClaimMaterial` 类型展示了ossKey的使用场景，帮助理解何时需要刷新URL

  **Acceptance Criteria**:
  - [ ] `getSignedUrlWithRetry(ossKey, expires)` 函数可正常调用
  - [ ] 当URL过期时自动重新获取（通过返回新的URL验证）
  - [ ] `refreshSignedUrls([key1, key2])` 支持批量刷新
  - [ ] 函数导出并在其他文件可导入

  **QA Scenarios**:

  ```
  Scenario: 获取签名URL成功
    Tool: Bash (curl)
    Preconditions: OSS key存在
    Steps:
      1. 调用 getSignedUrl('claims/test.jpg', 3600)
      2. 验证返回的URL包含OSSAccessKeyId和Signature参数
      3. 使用curl访问该URL，返回200
    Expected Result: 返回有效的签名URL，可正常访问
    Evidence: .sisyphus/evidence/task-1-signed-url-success.txt

  Scenario: URL过期自动刷新
    Tool: Bash (curl + node)
    Preconditions: 已获取URL，等待过期或使用过期时间测试
    Steps:
      1. 获取一个短时效URL（5秒）
      2. 等待5秒
      3. 调用 getSignedUrlWithRetry 自动刷新
      4. 验证返回的新URL与旧URL不同
    Expected Result: 检测到过期并返回新URL
    Evidence: .sisyphus/evidence/task-1-url-refresh.txt
  ```

  **Evidence to Capture**:
  - [ ] 签名URL响应内容
  - [ ] URL刷新前后的对比
  - [ ] 批量刷新结果

  **Commit**: YES
  - Message: `feat(oss): add signed URL refresh utilities`
  - Files: `services/ossService.ts`

---

- [ ] 2. **创建批量OSS直传凭证API**

  **What to do**:
  - 在 `server/apiHandler.js` 中添加 `POST /api/batch-upload-oss` 端点
  - 接收文件列表，返回每个文件的OSS直传凭证（policy, signature, key等）
  - 支持配置过期时间
  - 返回凭证和对应的OSS访问URL

  **Must NOT do**:
  - 不处理文件上传本身（前端直传OSS）
  - 不保存文件到服务器磁盘
  - 不修改现有的单文件上传端点

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: API端点，模式清晰
  - **Skills**: [`typescript`, `nodejs`]
  - **Skills Evaluated but Omitted**:
    - `playwright`: API不需要浏览器测试
    - `frontend-ui-ux`: Not applicable

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `server/apiHandler.js:1450-1550` - 现有的API路由处理模式
  - `server/utils/fileStore.js` - 文件操作工具
  
  **External References**:
  - 阿里云OSS文档 - PostObject直传策略生成

  **Acceptance Criteria**:
  - [ ] POST /api/batch-upload-oss 返回200
  - [ ] 请求体包含文件列表，响应包含每个文件的policy、signature、key
  - [ ] 凭证过期时间可配置（默认3600秒）
  - [ ] 凭证可直接用于前端上传到OSS

  **QA Scenarios**:

  ```
  Scenario: 获取批量上传凭证
    Tool: Bash (curl)
    Preconditions: Server running
    Steps:
      1. POST /api/batch-upload-oss
         Body: {"files":[{"name":"test1.jpg"},{"name":"test2.pdf"}]}
      2. 验证响应包含每个文件的policy、signature、accessid
      3. 验证响应包含OSS endpoint和bucket
    Expected Result: 返回有效的直传凭证
    Evidence: .sisyphus/evidence/task-2-batch-upload-creds.json

  Scenario: 凭证过期时间配置
    Tool: Bash (curl)
    Steps:
      1. POST /api/batch-upload-oss with {"expires": 600}
      2. 解码policy base64，验证过期时间为当前时间+600秒
    Expected Result: 过期时间正确设置
    Evidence: .sisyphus/evidence/task-2-expire-config.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add batch OSS upload credentials endpoint`
  - Files: `server/apiHandler.js`

---

- [ ] 3. **更新类型定义支持批量操作**

  **What to do**:
  - 在 `types.ts` 中添加批量上传相关类型
  - 添加 `BatchOSSUploadRequest`, `BatchOSSUploadResponse`
  - 添加 `BatchClassifyRequest`, `BatchClassifyResponse`
  - 更新 `ClaimMaterial` 添加 `ossUrlExpiresAt` 字段（可选）
  - 添加 `MaterialImportTaskV2` 类型（支持OSS Key列表）

  **Must NOT do**:
  - 不删除或修改现有类型（保持向后兼容）
  - 不修改ClaimsMaterial的核心字段
  - 不添加与当前功能无关的类型

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 类型定义，无复杂逻辑
  - **Skills**: [`typescript`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `types.ts:616-651` - 现有的 `OfflineMaterialImportResult`, `ProcessedFile` 类型
  - `types.ts:671-714` - `ClaimMaterial` 类型
  
  **Acceptance Criteria**:
  - [ ] 新类型定义无TypeScript错误
  - [ ] 类型可以正常导入和使用
  - [ ] 现有类型不受影响

  **QA Scenarios**:

  ```
  Scenario: 类型定义有效
    Tool: Bash (tsc)
    Steps:
      1. 运行 npx tsc --noEmit 检查类型
      2. 确认无类型错误
    Expected Result: TypeScript检查通过
    Evidence: .sisyphus/evidence/task-3-types-check.txt
  ```

  **Commit**: YES
  - Message: `types(offline-import): add batch operation types`
  - Files: `types.ts`

---

- [ ] 4. **创建批量材料分类API**

  **What to do**:
  - 在 `server/apiHandler.js` 中添加 `POST /api/batch-classify` 端点
  - 接收OSS Key列表，批量下载并分类
  - 使用现有的 `materialClassifier` 进行分类
  - 返回每个文件的分类结果（materialId, confidence, 等）
  - 实现并发控制（最多3个文件同时处理）

  **Must NOT do**:
  - 不修改现有的单文件分类端点
  - 不保存分类结果到数据库（返回给前端）
  - 不进行结构化提取（仅分类）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 涉及并发控制、外部API调用、错误处理
  - **Skills**: [`typescript`, `nodejs`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Tasks 7, 8
  - **Blocked By**: Task 3

  **References**:
  **Pattern References**:
  - `server/apiHandler.js` - 查找现有的分类API实现
  - `server/taskQueue/worker.js` - 现有的分类逻辑
  
  **External References**:
  - Gemini API文档 - 多文件处理

  **Acceptance Criteria**:
  - [ ] POST /api/batch-classify 接收OSS Key列表
  - [ ] 返回每个文件的分类结果
  - [ ] 并发控制有效（最多3个并行）
  - [ ] 单个文件失败不影响其他文件
  - [ ] 使用签名URL下载文件

  **QA Scenarios**:

  ```
  Scenario: 批量分类成功
    Tool: Bash (curl)
    Preconditions: OSS上有测试图片文件
    Steps:
      1. POST /api/batch-classify with 3个OSS Key
      2. 验证返回3个分类结果
      3. 每个结果包含materialId和confidence
    Expected Result: 所有文件正确分类
    Evidence: .sisyphus/evidence/task-4-batch-classify.json

  Scenario: 并发控制有效
    Tool: Bash (curl)
    Steps:
      1. POST /api/batch-classify with 10个文件
      2. 检查服务器日志，验证同时处理的文件数不超过3
    Expected Result: 并发数受控
    Evidence: .sisyphus/evidence/task-4-concurrency.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add batch material classification endpoint`
  - Files: `server/apiHandler.js`

---

- [ ] 5. **创建新版导入API v2 (接收OSS Key列表)**

  **What to do**:
  - 在 `server/apiHandler.js` 中添加 `POST /api/import-offline-materials-v2` 端点
  - 接收OSS Key列表（而非base64文件数据）
  - 创建异步任务，存储OSS Key而非文件数据
  - 保持与现有API相同的返回格式
  - 在任务数据中标记使用v2流程

  **Must NOT do**:
  - 不删除或修改现有的 `/api/import-offline-materials` 端点
  - 不在API层进行实际的文件处理（留给Worker）
  - 不修改任务队列的存储格式（保持兼容）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: API设计，需要兼容性和向后兼容考虑
  - **Skills**: [`typescript`, `nodejs`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 6)
  - **Blocks**: Task 13
  - **Blocked By**: Tasks 2, 3

  **References**:
  **Pattern References**:
  - `server/apiHandler.js:2026-2081` - 现有的 `import-offline-materials` 端点
  - `server/taskQueue/queue.js` - 任务创建逻辑
  
  **Acceptance Criteria**:
  - [ ] POST /api/import-offline-materials-v2 接收OSS Key列表
  - [ ] 返回taskId，格式与现有API一致
  - [ ] 任务存储包含v2标记
  - [ ] 旧版API继续正常工作

  **QA Scenarios**:

  ```
  Scenario: v2导入API正常工作
    Tool: Bash (curl)
    Steps:
      1. POST /api/import-offline-materials-v2 with OSS Key列表
      2. 验证返回taskId
      3. GET /api/tasks/{taskId} 验证任务存在
    Expected Result: 任务创建成功
    Evidence: .sisyphus/evidence/task-5-v2-import.json

  Scenario: 向后兼容
    Tool: Bash (curl)
    Steps:
      1. POST /api/import-offline-materials (旧版) with base64文件
      2. 验证返回taskId
      3. 确认旧版流程仍然可用
    Expected Result: 旧版API正常工作
    Evidence: .sisyphus/evidence/task-5-backward-compat.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add v2 import endpoint with OSS key support`
  - Files: `server/apiHandler.js`

---

- [ ] 6. **创建URL刷新中间件**

  **What to do**:
  - 在 `server/` 目录创建 `middleware/urlRefresher.js`
  - 创建中间件函数 `ensureFreshSignedUrl()`
  - 检测URL是否即将过期（<5分钟）
  - 自动刷新并返回新URL
  - 可在Worker中复用

  **Must NOT do**:
  - 不修改请求/响应格式
  - 不在中间件中进行实际的文件下载
  - 不引入新的依赖

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 中间件，逻辑清晰
  - **Skills**: [`nodejs`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Tasks 7, 8
  - **Blocked By**: Task 1

  **References**:
  **Pattern References**:
  - `server/middleware/index.js` - 现有中间件模式
  - Task 1的URL刷新工具
  
  **Acceptance Criteria**:
  - [ ] 中间件可以检测URL过期时间
  - [ ] 即将过期时自动刷新
  - [ ] 可在Worker和其他服务中导入使用
  - [ ] 不中断主流程

  **QA Scenarios**:

  ```
  Scenario: URL即将过期自动刷新
    Tool: Bash (node)
    Steps:
      1. 创建一个3分钟后过期的URL
      2. 调用 ensureFreshSignedUrl(url, key)
      3. 由于>5分钟不触发刷新
      4. 等待2.5分钟，再次调用
      5. 此时<5分钟，应触发刷新并返回新URL
    Expected Result: 适时触发刷新
    Evidence: .sisyphus/evidence/task-6-url-refresh-middleware.txt
  ```

  **Commit**: YES
  - Message: `feat(middleware): add signed URL refresh middleware`
  - Files: `server/middleware/urlRefresher.js`

---

- [ ] 7. **Worker批量文件下载**

  **What to do**:
  - 修改 `server/taskQueue/worker.js`
  - 支持从任务中读取OSS Key列表
  - 批量下载文件（并发控制：3个并行）
  - 使用签名URL中间件确保URL有效
  - 下载到临时目录，处理完成后清理

  **Must NOT do**:
  - 不修改任务队列的存储格式
  - 不将文件永久保存到磁盘
  - 不影响现有的单文件处理流程

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 核心处理逻辑，涉及并发、IO、错误处理
  - **Skills**: [`nodejs`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 9)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 4, 6

  **References**:
  **Pattern References**:
  - `server/taskQueue/worker.js` - 现有Worker实现
  - `server/middleware/urlRefresher.js` - URL刷新中间件
  
  **Acceptance Criteria**:
  - [ ] Worker可从任务读取OSS Key列表
  - [ ] 批量下载文件，并发数=3
  - [ ] 使用签名URL下载
  - [ ] 下载失败时记录错误，不影响其他文件
  - [ ] 处理完成后清理临时文件

  **QA Scenarios**:

  ```
  Scenario: 批量下载成功
    Tool: Bash (node)
    Steps:
      1. 创建一个包含5个OSS Key的任务
      2. 启动Worker处理任务
      3. 验证5个文件都成功下载
      4. 检查并发下载数不超过3
    Expected Result: 所有文件下载成功
    Evidence: .sisyphus/evidence/task-7-batch-download.txt
  ```

  **Commit**: YES
  - Message: `feat(worker): add batch file download support`
  - Files: `server/taskQueue/worker.js`

---

- [ ] 8. **Worker签名URL自动刷新**

  **What to do**:
  - 在 `server/taskQueue/worker.js` 中集成URL刷新中间件
  - 在下载文件前检查URL是否有效
  - URL过期时自动刷新
  - 记录刷新日志
  - 处理刷新失败的情况（标记文件失败）

  **Must NOT do**:
  - 不修改URL刷新的核心逻辑（使用中间件）
  - 不影响其他Worker流程
  - 不存储刷新后的URL（每次需要时重新生成）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 核心逻辑，涉及外部API调用和错误处理
  - **Skills**: [`nodejs`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 9)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 4, 6

  **References**:
  **Pattern References**:
  - `server/taskQueue/worker.js` - 现有Worker
  - `server/middleware/urlRefresher.js` - URL刷新中间件
  
  **Acceptance Criteria**:
  - [ ] Worker在下载前检查URL有效性
  - [ ] URL过期时自动刷新
  - [ ] 刷新失败时标记文件处理失败
  - [ ] 日志记录刷新操作

  **QA Scenarios**:

  ```
  Scenario: URL过期自动刷新
    Tool: Bash (node)
    Steps:
      1. 创建一个任务，使用一个即将过期的URL（10秒）
      2. Worker开始处理
      3. 等待URL过期
      4. 验证Worker检测到过期并自动刷新
      5. 验证文件成功下载
    Expected Result: 自动刷新后继续处理
    Evidence: .sisyphus/evidence/task-8-url-refresh-worker.txt
  ```

  **Commit**: YES
  - Message: `feat(worker): integrate automatic URL refresh`
  - Files: `server/taskQueue/worker.js`

---

- [ ] 9. **Worker错误处理增强**

  **What to do**:
  - 增强 `server/taskQueue/worker.js` 的错误处理
  - 定义明确的错误类型（DownloadError, ClassificationError, ExtractionError）
  - 实现文件级重试机制（最多3次）
  - 添加指数退避策略
  - 记录详细的错误日志
  - 支持手动重试（通过API）

  **Must NOT do**:
  - 不修改任务存储格式
  - 不引入外部重试服务
  - 不影响成功的文件处理

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 复杂的错误处理逻辑
  - **Skills**: [`nodejs`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 8)
  - **Blocks**: Task 13
  - **Blocked By**: Tasks 7, 8

  **References**:
  **Pattern References**:
  - `server/taskQueue/worker.js` - 现有错误处理
  - `server/taskQueue/queue.js` - 任务状态更新
  
  **Acceptance Criteria**:
  - [ ] 定义明确的错误类型
  - [ ] 文件级重试机制（最多3次）
  - [ ] 指数退避策略
  - [ ] 详细的错误日志
  - [ ] 支持手动重试API

  **QA Scenarios**:

  ```
  Scenario: 下载失败自动重试
    Tool: Bash (node)
    Steps:
      1. 创建一个任务，包含一个无效的OSS Key
      2. Worker处理，第一次下载失败
      3. 验证等待退避时间后重试
      4. 验证重试3次后标记为失败
    Expected Result: 自动重试机制工作正常
    Evidence: .sisyphus/evidence/task-9-retry-mechanism.txt
  ```

  **Commit**: YES
  - Message: `feat(worker): enhance error handling with retry mechanism`
  - Files: `server/taskQueue/worker.js`

---

- [ ] 10. **前端批量OSS上传**

  **What to do**:
  - 修改 `components/OfflineMaterialImportDialog.tsx`
  - 添加批量OSS上传功能
  - 先调用 `/api/batch-upload-oss` 获取凭证
  - 使用凭证直接上传到OSS
  - 显示每个文件的上传进度
  - 上传完成后返回OSS Key列表

  **Must NOT do**:
  - 不删除现有的base64上传逻辑（保持兼容）
  - 不修改文件选择UI
  - 不影响其他组件

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI组件，需要处理进度显示和交互
  - **Skills**: [`typescript`, `react`, `frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 11, 12)
  - **Blocks**: Tasks 11, 12
  - **Blocked By**: Task 2

  **References**:
  **Pattern References**:
  - `components/OfflineMaterialImportDialog.tsx` - 现有实现
  - `services/ossService.ts` - OSS服务
  
  **External References**:
  - 阿里云OSS文档 - 浏览器端直传

  **Acceptance Criteria**:
  - [ ] 批量获取OSS上传凭证
  - [ ] 直接上传到OSS（不经过服务器）
  - [ ] 显示每个文件的上传进度
  - [ ] 上传失败时显示错误并可重试
  - [ ] 返回OSS Key列表

  **QA Scenarios**:

  ```
  Scenario: 批量上传到OSS
    Tool: Playwright
    Preconditions: 登录系统，打开理赔案件详情页
    Steps:
      1. 点击"导入材料"按钮
      2. 选择5个文件
      3. 验证显示上传进度条
      4. 等待所有文件上传完成
      5. 验证显示上传成功的提示
    Expected Result: 所有文件成功上传到OSS
    Evidence: .sisyphus/evidence/task-10-frontend-upload.png

  Scenario: 上传失败处理
    Tool: Playwright
    Steps:
      1. 选择文件（模拟网络错误）
      2. 验证显示错误提示
      3. 点击"重试"按钮
      4. 验证重新上传
    Expected Result: 错误处理和重试功能正常
    Evidence: .sisyphus/evidence/task-10-upload-retry.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add batch OSS upload to import dialog`
  - Files: `components/OfflineMaterialImportDialog.tsx`

---

- [ ] 11. **前端批量分类集成**

  **What to do**:
  - 修改 `components/OfflineMaterialImportDialog.tsx`
  - 上传完成后调用 `/api/batch-classify`
  - 显示批量分类结果
  - 支持用户修改分类结果
  - 分类完成后显示"导入"按钮

  **Must NOT do**:
  - 不删除现有的单文件分类逻辑
  - 不影响文件上传流程
  - 不修改分类算法（后端处理）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI组件，需要显示分类结果和交互
  - **Skills**: [`typescript`, `react`, `frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 10, 12)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 4, 10

  **References**:
  **Pattern References**:
  - `components/OfflineMaterialImportDialog.tsx` - 现有分类显示逻辑
  
  **Acceptance Criteria**:
  - [ ] 上传完成后自动调用批量分类API
  - [ ] 显示每个文件的分类结果
  - [ ] 支持用户手动修改分类
  - [ ] 分类完成后启用"导入"按钮

  **QA Scenarios**:

  ```
  Scenario: 批量分类显示
    Tool: Playwright
    Steps:
      1. 上传5个文件
      2. 等待分类完成
      3. 验证显示每个文件的识别类型
      4. 验证显示置信度
    Expected Result: 分类结果正确显示
    Evidence: .sisyphus/evidence/task-11-classification-results.png

  Scenario: 手动修改分类
    Tool: Playwright
    Steps:
      1. 点击文件旁边的"修改"按钮
      2. 选择新的材料类型
      3. 验证分类更新
    Expected Result: 手动修改生效
    Evidence: .sisyphus/evidence/task-11-classification-edit.png
  ```

  **Commit**: YES
  - Message: `feat(ui): integrate batch classification in import dialog`
  - Files: `components/OfflineMaterialImportDialog.tsx`

---

- [ ] 12. **前端进度显示优化**

  **What to do**:
  - 增强 `components/OfflineMaterialImportDialog.tsx` 的进度显示
  - 文件级进度：上传进度、分类进度
  - 任务级进度：处理中、已完成、失败数
  - 添加文件状态指示器（图标/颜色）
  - 优化导入按钮状态（根据就绪文件数）

  **Must NOT do**:
  - 不修改后端API
  - 不影响核心功能
  - 不引入新的UI库

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI/UX优化
  - **Skills**: [`typescript`, `react`, `frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 10, 11)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 10, 11

  **References**:
  **Pattern References**:
  - `components/OfflineMaterialImportDialog.tsx` - 现有进度显示
  
  **Acceptance Criteria**:
  - [ ] 显示每个文件的上传进度
  - [ ] 显示分类进度
  - [ ] 显示任务总体进度
  - [ ] 文件状态通过图标/颜色区分
  - [ ] 导入按钮根据就绪文件数动态启用

  **QA Scenarios**:

  ```
  Scenario: 进度显示完整
    Tool: Playwright
    Steps:
      1. 选择10个文件上传
      2. 验证显示每个文件的上传进度条
      3. 上传完成后显示分类进度
      4. 验证总体进度统计
    Expected Result: 进度信息清晰完整
    Evidence: .sisyphus/evidence/task-12-progress-display.png
  ```

  **Commit**: YES
  - Message: `feat(ui): enhance progress display in import dialog`
  - Files: `components/OfflineMaterialImportDialog.tsx`

---

- [ ] 13. **API集成测试**

  **What to do**:
  - 测试所有新API的集成
  - 批量上传凭证API测试
  - 批量分类API测试
  - 导入API v2测试
  - URL刷新机制测试
  - 验证向后兼容性

  **Must NOT do**:
  - 不编写自动化测试（项目无测试框架）
  - 不修改API实现
  - 不影响生产数据

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 集成测试，需要验证多个组件协同工作
  - **Skills**: [`nodejs`, `bash`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 14, 15)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 5, 9

  **Acceptance Criteria**:
  - [ ] 所有新API工作正常
  - [ ] 批量流程端到端测试通过
  - [ ] URL刷新机制工作正常
  - [ ] 旧版API向后兼容

  **QA Scenarios**:

  ```
  Scenario: 完整批量导入流程
    Tool: Bash (curl + node)
    Steps:
      1. 调用批量上传凭证API
      2. 使用凭证上传文件到OSS
      3. 调用批量分类API
      4. 调用导入API v2
      5. 轮询任务状态直至完成
      6. 验证结果
    Expected Result: 完整流程成功
    Evidence: .sisyphus/evidence/task-13-integration-test.txt
  ```

  **Commit**: NO (Testing task, no code changes)

---

- [ ] 14. **End-to-End测试**

  **What to do**:
  - 使用Playwright进行端到端测试
  - 测试完整的离线材料导入流程
  - 测试批量上传、分类、导入
  - 测试错误场景（网络错误、无效文件等）
  - 截图记录测试过程

  **Must NOT do**:
  - 不修改生产代码
  - 不使用真实理赔数据
  - 不影响其他用户

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: E2E测试，验证整个用户流程
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 13, 15)
  - **Blocks**: Task 15
  - **Blocked By**: Tasks 12, 13

  **Acceptance Criteria**:
  - [ ] 完整的用户流程测试通过
  - [ ] 批量功能正常工作
  - [ ] 错误场景处理正确
  - [ ] 截图记录关键步骤

  **QA Scenarios**:

  ```
  Scenario: E2E导入流程
    Tool: Playwright
    Steps:
      1. 登录系统
      2. 打开理赔案件详情
      3. 点击导入材料
      4. 批量上传5个文件
      5. 等待分类完成
      6. 点击导入
      7. 等待处理完成
      8. 验证文件显示在案件中
    Expected Result: 完整流程成功
    Evidence: .sisyphus/evidence/task-14-e2e-test/
  ```

  **Commit**: NO (Testing task, no code changes)

---

- [ ] 15. **向后兼容性验证**

  **What to do**:
  - 验证旧版导入功能仍然可用
  - 测试旧版API端点
  - 验证现有任务队列处理不受影响
  - 验证UI组件向后兼容
  - 检查数据格式兼容性

  **Must NOT do**:
  - 不修改任何代码
  - 不删除旧功能
  - 不影响现有数据

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 兼容性验证，需要全面检查
  - **Skills**: [`nodejs`, `bash`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 13, 14)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 14

  **Acceptance Criteria**:
  - [ ] 旧版API正常工作
  - [ ] 现有任务可以正常处理
  - [ ] UI组件无破坏性变更
  - [ ] 数据格式兼容

  **QA Scenarios**:

  ```
  Scenario: 旧版API兼容
    Tool: Bash (curl)
    Steps:
      1. 调用旧版 /api/import-offline-materials
      2. 验证返回正常
      3. 验证任务创建成功
      4. 验证Worker可以处理
    Expected Result: 旧版功能完全正常
    Evidence: .sisyphus/evidence/task-15-backward-compat.txt
  ```

  **Commit**: NO (Verification task, no code changes)

---

## Final Verification Wave

- [ ] **F1. Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist in .sisyphus/evidence/.
  Output: `Must Have [4/4] | Must NOT Have [5/5] | Tasks [15/15] | VERDICT: APPROVE/REJECT`

- [ ] **F2. Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + check for console.log. Review all changed files for: `as any`, empty catches, unused imports. Check for AI slop patterns.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] **F3. Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task. Test cross-task integration. Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] **F4. Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 - everything in spec was built. Check "Must NOT do" compliance. Detect cross-task contamination.
  Output: `Tasks [15/15 compliant] | Contamination [CLEAN] | VERDICT`

---

## Commit Strategy

| Task | Commit Message | Files |
|------|---------------|-------|
| 1 | `feat(oss): add signed URL refresh utilities` | `services/ossService.ts` |
| 2 | `feat(api): add batch OSS upload credentials endpoint` | `server/apiHandler.js` |
| 3 | `types(offline-import): add batch operation types` | `types.ts` |
| 4 | `feat(api): add batch material classification endpoint` | `server/apiHandler.js` |
| 5 | `feat(api): add v2 import endpoint with OSS key support` | `server/apiHandler.js` |
| 6 | `feat(middleware): add signed URL refresh middleware` | `server/middleware/urlRefresher.js` |
| 7 | `feat(worker): add batch file download support` | `server/taskQueue/worker.js` |
| 8 | `feat(worker): integrate automatic URL refresh` | `server/taskQueue/worker.js` |
| 9 | `feat(worker): enhance error handling with retry mechanism` | `server/taskQueue/worker.js` |
| 10 | `feat(ui): add batch OSS upload to import dialog` | `components/OfflineMaterialImportDialog.tsx` |
| 11 | `feat(ui): integrate batch classification in import dialog` | `components/OfflineMaterialImportDialog.tsx` |
| 12 | `feat(ui): enhance progress display in import dialog` | `components/OfflineMaterialImportDialog.tsx` |

---

## Success Criteria

### Verification Commands

```bash
# TypeScript compilation
npx tsc --noEmit

# Build check
npm run build

# API health check
curl http://localhost:8080/api/batch-upload-oss -X POST -H "Content-Type: application/json" -d '{"files":[{"name":"test.jpg"}]}'

# Import flow test (after implementation)
curl http://localhost:8080/api/import-offline-materials-v2 -X POST -H "Content-Type: application/json" -d '{"claimCaseId":"test","productCode":"PROD001","ossKeys":["test/1.jpg"]}'
```

### Final Checklist
- [ ] All 12 implementation tasks completed
- [ ] All "Must Have" requirements met
- [ ] All "Must NOT Have" exclusions verified
- [ ] TypeScript compilation passes
- [ ] Build succeeds
- [ ] E2E tests pass
- [ ] Backward compatibility verified
- [ ] Evidence files captured for all tasks

---

## Notes for Executor

1. **File Modifications**: This plan modifies 5 core files:
   - `services/ossService.ts` (Tasks 1)
   - `server/apiHandler.js` (Tasks 2, 4, 5)
   - `types.ts` (Task 3)
   - `server/middleware/urlRefresher.js` (Task 6 - new file)
   - `server/taskQueue/worker.js` (Tasks 7, 8, 9)
   - `components/OfflineMaterialImportDialog.tsx` (Tasks 10, 11, 12)

2. **Dependencies**: 
   - Wave 1 can start immediately
   - Wave 2 depends on Wave 1
   - Wave 3 depends on Wave 2
   - Wave 4 depends on Wave 1 and 2
   - Wave 5 depends on all previous waves

3. **Testing Strategy**: 
   - Use provided QA scenarios for verification
   - Capture evidence to `.sisyphus/evidence/`
   - Run Playwright for UI tests
   - Use curl for API tests

4. **Backward Compatibility**: 
   - All existing APIs must continue working
   - Old import flow should not break
   - UI changes should be additive, not destructive

5. **External Dependencies**:
   - 阿里云OSS (no changes needed)
   - Gemini API (for classification)
   - Existing task queue infrastructure
