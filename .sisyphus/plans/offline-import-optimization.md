# 离线材料导入优化工作计划

## TL;DR

> **目标**: 优化"离线材料导入"功能，实现快速存档 + 后台异步AI识别
> 
> **核心改进**:
> - 快速导入：仅存储文件元数据，立即返回（< 1秒）
> - 后台异步：系统自动进行AI分类和提取
> - AI交互日志：所有AI调用记录入参+出参+耗时
> 
> **交付物**:
> - 新的 `/api/offline-import/quick` 快速导入API
> - 增强的后台任务处理（支持分阶段：存档→分类→提取）
> - AI交互日志服务
> - 前端进度展示优化
> 
> **Estimated Effort**: Medium (2 waves, 12 tasks)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Quick Import API → Async Task Processing → AI Logging → Frontend Update

---

## Context

### Original Request
用户反馈点击"确认导入"很慢。经过分析，发现：
1. 每个文件都要经过 AI 分类 + AI 提取（两次 Gemini 调用）
2. 所有处理都是同步的，前端要等待完成
3. 文件上传和AI处理串行执行

### 优化方案
**改为异步流程**：
1. **阶段1 - 快速存档**：用户点击导入后，仅存储文件到系统，立即返回成功
2. **阶段2 - 后台识别**：系统自动在后台进行AI分类和提取
3. **全程记录**：所有AI交互记录详细的入参、出参、耗时、错误信息

### AI交互日志规范
参考 `material-processing-refactor.md`，记录以下信息：
```typescript
interface AIInteractionLog {
  id: string;              // 日志ID
  timestamp: string;       // 时间戳
  taskType: 'classification' | 'extraction';  // 任务类型
  taskId: string;          // 关联的任务ID
  fileIndex: number;       // 文件索引
  
  // 输入参数
  input: {
    prompt: string;        // AI提示词
    fileName: string;      // 文件名
    fileType: string;      // 文件类型
    fileSize: number;      // 文件大小
    mimeType: string;      // MIME类型
    model: string;         // 使用的模型
  };
  
  // 输出结果
  output: {
    response: string;      // 原始响应
    parsedResult: object;  // 解析后的结果
    confidence?: number;   // 置信度（分类任务）
  };
  
  // 性能指标
  performance: {
    startTime: number;     // 开始时间戳
    endTime: number;       // 结束时间戳
    duration: number;      // 总耗时(ms)
    retryCount: number;    // 重试次数
  };
  
  // 错误信息（如果有）
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}
```

---

## Work Objectives

### Core Objective
重构离线材料导入流程，实现"快速存档+后台异步识别"，同时建立完整的AI交互日志体系。

### Concrete Deliverables
- 新的快速导入API `/api/offline-import/quick`
- 增强的任务状态模型（支持分阶段：archived → classified → extracted）
- AI交互日志服务 `aiInteractionLogger`
- 修改后的后台任务处理器（worker-new.js）
- 前端进度展示优化（显示各阶段进度）
- 新的消息通知类型（识别完成通知）

### Definition of Done
- [ ] 导入响应时间 < 1秒（仅存档阶段）
- [ ] 后台任务正确处理所有文件
- [ ] 所有AI调用都有完整日志记录
- [ ] 用户可以实时查看各阶段进度
- [ ] 识别完成后发送消息通知

### Must Have
- [ ] 向后兼容现有任务数据结构
- [ ] AI日志持久化存储（JSON文件）
- [ ] 任务状态实时更新（支持轮询）
- [ ] 错误处理和重试机制

### Must NOT Have (Guardrails)
- [ ] 不修改现有的 `/api/import-offline-materials-sync` 同步接口
- [ ] 不删除现有的任务队列数据结构
- [ ] 不改变前端UI的整体布局（仅优化进度展示）

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO (no test framework)
- **Automated tests**: NO
- **Verification method**: Agent-Executed QA Scenarios + Manual Testing

### QA Policy
Every task MUST include agent-executed QA scenarios:
- **API**: Use curl - Test endpoints with real requests
- **Services**: Use Bash (node REPL) - Test service functions
- **Integration**: Test full flow with file uploads

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Backend - Core Changes):
├── Task 1: Create AI Interaction Logger service
├── Task 2: Create new quick import API endpoint
├── Task 3: Enhance task model with stage tracking
├── Task 4: Modify worker to support staged processing
├── Task 5: Add AI logging to all AI calls
└── Task 6: Create API to query AI interaction logs

Wave 2 (Frontend & Integration):
├── Task 7: Update OfflineMaterialImportDialog for quick import
├── Task 8: Enhance progress display with stage breakdown
├── Task 9: Add real-time log viewer (optional/debug)
└── Task 10: Integration testing and bug fixes

Wave FINAL (Verification):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review
├── Task F3: Performance testing
└── Task F4: Scope fidelity check

Critical Path: Task 1-4 → Task 7-8 → F1-F4
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 6 (Wave 1)
```

### Dependency Matrix

- **1-3**: — — 4
- **4**: 1-3 — 5, 7
- **5**: 1, 4 — 7
- **6**: 1 — F1-F4
- **7**: 2, 4, 5 — 8-10
- **8-10**: 7 — F1-F4

### Agent Dispatch Summary

- **1**: **6** - Core backend tasks → `unspecified-high` or `deep`
- **2**: **4** - Frontend integration → `visual-engineering`
- **FINAL**: **4** - Review tasks → `oracle`, `unspecified-high`

---

## TODOs

- [ ] 1. Create AI Interaction Logger service

  **What to do**:
  - Create `server/services/aiInteractionLogger.js`
  - Implement `logInteraction()` function
  - Implement `getLogsByTask()` function
  - Store logs in `jsonlist/ai-interaction-logs.json`
  - Log rotation (keep last 10000 entries)

  **Must NOT do**:
  - Don't log sensitive data (actual file content)
  - Don't block main flow if logging fails

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: Service design with file I/O

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 2, 3)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 5, 6
  - **Blocked By**: None

  **References**:
  - Pattern: `server/middleware/index.js` - Existing audit logging
  - Pattern: `server/utils/fileStore.js` - File operations

  **Acceptance Criteria**:
  - [ ] Logger service created
  - [ ] Can log AI interactions
  - [ ] Can query logs by task ID
  - [ ] Log rotation works

  **QA Scenarios**:
  ```
  Scenario: Log AI interaction
    Tool: Node REPL
    Steps:
      1. Import aiInteractionLogger
      2. Call logInteraction() with test data
      3. Verify log file created
    Expected: Log entry exists with all fields
  ```

  **Commit**: YES
  - Message: `feat(logging): create AI interaction logger service`
  - Files: `server/services/aiInteractionLogger.js`

- [ ] 2. Create new quick import API endpoint

  **What to do**:
  - Add `/api/offline-import/quick` endpoint in `apiHandler.js`
  - Only store file metadata and base64 data
  - Create task with status `archived` (new initial status)
  - Return immediately with taskId
  - Don't call any AI services

  **Must NOT do**:
  - Don't wait for AI processing
  - Don't modify existing `/api/import-offline-materials` endpoint

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: API endpoint implementation

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1, 3)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 7
  - **Blocked By**: None

  **References**:
  - Pattern: `server/apiHandler.js:1849-1907` - Existing import endpoint
  - Pattern: `server/taskQueue/queue.js:55-98` - createTask function

  **Acceptance Criteria**:
  - [ ] Endpoint accepts files array
  - [ ] Returns taskId immediately (< 1s)
  - [ ] Task created with status 'archived'
  - [ ] No AI calls during import

  **QA Scenarios**:
  ```
  Scenario: Quick import API
    Tool: curl
    Steps:
      1. POST /api/offline-import/quick with 3 files
      2. Measure response time
      3. Verify task created
    Expected: Response < 1s, task.status='archived'
  ```

  **Commit**: YES
  - Message: `feat(api): add quick import endpoint for offline materials`
  - Files: `server/apiHandler.js`

- [ ] 3. Enhance task model with stage tracking

  **What to do**:
  - Modify `server/taskQueue/queue.js`
  - Add new task status: `archived` (initial), `classifying`, `extracting`
  - Add stage tracking to each file:
    ```javascript
    {
      status: 'pending' | 'archived' | 'classifying' | 'extracting' | 'completed' | 'failed',
      stages: {
        archive: { status, completedAt },
        classification: { status, result, completedAt },
        extraction: { status, result, completedAt }
      }
    }
    ```
  - Update `updateFileStatus()` to support stage updates

  **Must NOT do**:
  - Don't break backward compatibility with existing tasks
  - Don't remove existing status values

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: Data model changes

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1, 2)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - Source: `server/taskQueue/queue.js` - Current task model

  **Acceptance Criteria**:
  - [ ] New status values added
  - [ ] Stage tracking implemented
  - [ ] Existing tasks still work
  - [ ] Backward compatibility maintained

  **QA Scenarios**:
  ```
  Scenario: Stage tracking
    Tool: Node REPL
    Steps:
      1. Create task with new model
      2. Update file through stages
      3. Query task status
    Expected: All stages tracked correctly
  ```

  **Commit**: YES
  - Message: `feat(queue): enhance task model with stage tracking`
  - Files: `server/taskQueue/queue.js`

- [ ] 4. Modify worker to support staged processing

  **What to do**:
  - Modify `server/taskQueue/worker-new.js`
  - Split processing into 3 stages:
    1. Archive (already done during import)
    2. Classification - call AI to classify material
    3. Extraction - call AI to extract fields
  - Update file status after each stage
  - Handle errors per stage (can retry individual stages)

  **Must NOT do**:
  - Don't combine classification and extraction into one AI call
  - Don't skip stages if previous failed

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Reason**: Complex async logic

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 3)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 5, 7
  - **Blocked By**: Task 1, 3

  **References**:
  - Source: `server/taskQueue/worker-new.js` - Current worker implementation
  - Source: `server/taskQueue/scheduler.js` - Task scheduling

  **Acceptance Criteria**:
  - [ ] Worker processes files in stages
  - [ ] Classification stage works
  - [ ] Extraction stage works
  - [ ] Error handling per stage
  - [ ] Progress updates sent

  **QA Scenarios**:
  ```
  Scenario: Staged processing
    Tool: Bun test + manual
    Steps:
      1. Create task with archived files
      2. Start scheduler
      3. Monitor stage transitions
    Expected: Files go through archived→classifying→extracting→completed
  ```

  **Commit**: YES
  - Message: `feat(worker): implement staged processing (archive→classify→extract)`
  - Files: `server/taskQueue/worker-new.js`

- [ ] 5. Add AI logging to all AI calls

  **What to do**:
  - Integrate `aiInteractionLogger` into all AI calls
  - Wrap `unifiedMaterialService.classify()` with logging
  - Wrap `unifiedMaterialService.process()` with logging
  - Log before and after each AI call
  - Include full prompt and raw response

  **Must NOT do**:
  - Don't log actual file base64 content (too large)
  - Don't fail if logging fails

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: Integration task

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1, 4)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 7
  - **Blocked By**: Task 1, 4

  **References**:
  - Source: `server/taskQueue/worker-new.js` - Where AI calls happen
  - Pattern: `services/material/materialClassifier.ts` - Classification logic
  - Pattern: `services/material/strategies/` - Extraction strategies

  **Acceptance Criteria**:
  - [ ] All classify() calls logged
  - [ ] All extract() calls logged
  - [ ] Logs include prompt and response
  - [ ] Performance metrics recorded

  **QA Scenarios**:
  ```
  Scenario: AI call logging
    Tool: Bun test
    Steps:
      1. Process file through worker
      2. Check ai-interaction-logs.json
    Expected: Log entries for classification and extraction
  ```

  **Commit**: YES
  - Message: `feat(logging): add AI interaction logging to worker`
  - Files: `server/taskQueue/worker-new.js`, `services/material/`

- [ ] 6. Create API to query AI interaction logs

  **What to do**:
  - Add `/api/ai-logs` endpoint in `apiHandler.js`
  - Support filtering by taskId, fileIndex, taskType
  - Support pagination (limit/offset)
  - Return formatted log entries

  **Must NOT do**:
  - Don't expose sensitive data in API
  - Don't allow querying without filters (too many logs)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Simple API endpoint

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 4, 5)
  - **Parallel Group**: Wave 1
  - **Blocks**: F1-F4
  - **Blocked By**: Task 1

  **References**:
  - Pattern: `server/apiHandler.js` - Existing API patterns

  **Acceptance Criteria**:
  - [ ] Endpoint supports filtering
  - [ ] Pagination works
  - [ ] Returns formatted logs

  **QA Scenarios**:
  ```
  Scenario: Query AI logs
    Tool: curl
    Steps:
      1. GET /api/ai-logs?taskId=xxx
      2. Verify logs returned
    Expected: Logs for specific task returned
  ```

  **Commit**: YES
  - Message: `feat(api): add endpoint to query AI interaction logs`
  - Files: `server/apiHandler.js`, `server/services/aiInteractionLogger.js`

- [ ] 7. Update OfflineMaterialImportDialog for quick import

  **What to do**:
  - Modify `components/OfflineMaterialImportDialog.tsx`
  - Change to call `/api/offline-import/quick` instead of `/api/import-offline-materials`
  - Show "导入成功，后台识别中" message immediately
  - Start polling for task status right away

  **Must NOT do**:
  - Don't wait for processing to complete before showing success
  - Don't remove existing progress display

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Reason**: UI component changes

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 2, 4, 5)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 8
  - **Blocked By**: Task 2, 4, 5

  **References**:
  - Source: `components/OfflineMaterialImportDialog.tsx` - Current implementation

  **Acceptance Criteria**:
  - [ ] Calls new quick import API
  - [ ] Shows immediate success message
  - [ ] Starts polling immediately
  - [ ] UI remains responsive

  **QA Scenarios**:
  ```
  Scenario: Quick import UI
    Tool: Playwright
    Steps:
      1. Open import dialog
      2. Select files
      3. Click import
      4. Measure time to success message
    Expected: Success shown in < 2s
  ```

  **Commit**: YES
  - Message: `feat(ui): update import dialog for quick import flow`
  - Files: `components/OfflineMaterialImportDialog.tsx`

- [ ] 8. Enhance progress display with stage breakdown

  **What to do**:
  - Update progress UI to show 3 stages:
    - 存档完成 ✓
    - 分类中 / 分类完成 ✓ / 分类失败 ✗
    - 提取中 / 提取完成 ✓ / 提取失败 ✗
  - Show per-file stage status
  - Add tooltip or expand view for detailed status

  **Must NOT do**:
  - Don't remove existing progress bar
  - Don't clutter the UI

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Reason**: UI enhancement

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 7)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 10
  - **Blocked By**: Task 7

  **References**:
  - Source: `components/OfflineMaterialImportDialog.tsx` - Progress display

  **Acceptance Criteria**:
  - [ ] Shows 3 stages per file
  - [ ] Stage icons/status work
  - [ ] UI looks clean

  **QA Scenarios**:
  ```
  Scenario: Stage display
    Tool: Playwright
    Steps:
      1. Import files
      2. Watch progress UI
      3. Verify stages shown
    Expected: All 3 stages visible with correct status
  ```

  **Commit**: YES
  - Message: `feat(ui): add stage breakdown to import progress display`
  - Files: `components/OfflineMaterialImportDialog.tsx`

- [ ] 9. Add real-time log viewer (optional/debug)

  **What to do**:
  - Create simple debug component to view AI logs
  - Show recent AI interactions
  - Filter by task/file
  - This is for debugging only, can be simple

  **Must NOT do**:
  - Don't make this a polished feature
  - Don't expose to regular users

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Debug tool

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 8)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Task 6

  **Acceptance Criteria**:
  - [ ] Can view AI logs
  - [ ] Filtering works

  **QA Scenarios**:
  ```
  Scenario: Log viewer
    Tool: Manual
    Steps:
      1. Open debug log viewer
      2. Select task
      3. View logs
    Expected: AI interactions displayed
  ```

  **Commit**: YES (optional)
  - Message: `feat(debug): add AI log viewer for debugging`
  - Files: `components/debug/AILogViewer.tsx`

- [ ] 10. Integration testing and bug fixes

  **What to do**:
  - Test full flow end-to-end
  - Test error scenarios (AI failure, network error)
  - Test with multiple files
  - Fix any bugs found
  - Optimize performance if needed

  **Must NOT do**:
  - Don't skip edge cases

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: Integration testing

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 7, 8)
  - **Parallel Group**: Wave 2
  - **Blocks**: F1-F4
  - **Blocked By**: Task 7, 8

  **Acceptance Criteria**:
  - [ ] Full flow works
  - [ ] Error handling works
  - [ ] Performance acceptable

  **QA Scenarios**:
  ```
  Scenario: Full integration
    Tool: Playwright + manual
    Steps:
      1. Import 5 files
      2. Verify quick import response
      3. Monitor background processing
      4. Verify completion
    Expected: All files processed, logs recorded
  ```

  **Commit**: YES
  - Message: `fix(integration): fix bugs found in integration testing`
  - Files: All modified files

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. Check AI logging works. Check quick import responds fast. Check backward compatibility.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Check for: `as any`, empty catches, console.log, code duplication. Verify error handling. Verify AI logger doesn't block main flow.
  Output: `Build [PASS/FAIL] | Code Quality [PASS/FAIL] | VERDICT`

- [ ] F3. **Performance Testing** — `unspecified-high`
  Test import response time with 1, 5, 10 files. Test background processing speed. Verify AI logging overhead is minimal.
  Output: `Import < 1s [Y/N] | Processing works [Y/N] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  Compare implementation against requirements. Check no breaking changes. Check all AI calls logged.
  Output: `Requirements [N/N] | Breaking Changes [N/N] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat(logging): ...`, `feat(api): ...`, `feat(queue): ...`, `feat(worker): ...`
- **Wave 2**: `feat(ui): ...`, `fix(integration): ...`
- **Wave FINAL**: `docs: ...`, `test: ...`

---

## Success Criteria

### Verification Commands
```bash
# Quick import performance test
curl -w "@curl-format.txt" -X POST http://localhost:8080/api/offline-import/quick \
  -H "Content-Type: application/json" \
  -d '{"claimCaseId":"test","files":[{"fileName":"test.jpg","base64Data":"..."}]}'
# Expected: time_total < 1.0

# Check AI logs exist
ls jsonlist/ai-interaction-logs.json

# Query AI logs
curl http://localhost:8080/api/ai-logs?taskId=xxx
```

### Final Checklist
- [ ] Import response time < 1 second
- [ ] All AI calls logged with full context
- [ ] Stage progress visible in UI
- [ ] Backward compatibility maintained
- [ ] No breaking changes to existing APIs
- [ ] Background processing works reliably
- [ ] Error handling works for each stage

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| AI logging impacts performance | Async logging, don't block main flow |
| Log file grows too large | Implement log rotation (keep last 10000) |
| Stage tracking adds complexity | Clear state machine, good error handling |
| User confused by async flow | Clear progress UI, completion notification |

---

## Post-Implementation

After completing all tasks:
1. Monitor import response times in production
2. Monitor AI log file size
3. Gather user feedback on new flow
4. Consider adding "查看详细日志" button for advanced users
