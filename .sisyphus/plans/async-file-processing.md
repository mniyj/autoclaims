# 异步文件处理系统改造计划

## Context

### Original Request
用户反映"离线材料导入"功能上传文件后处理时间过长（10个文件约30-70秒），需要改造成后台异步处理，支持失败重试，并通过消息中心通知用户结果。

### Interview Summary
**Key Discussions**:
- 技术选型：放弃 Redis/BullMQ，使用现有 JSON 文件存储任务状态
- 并发策略：单用户并发10个文件，多文件完全并行处理
- 超时设置：单个文件60秒超时，整个任务无超时限制
- 数据保留：任务结果永久保存，归档到 JSON 文件
- 失败处理：partial_success 策略，失败文件可单独重试
- 监控需求：耗时统计、失败率告警、队列积压监控
- 边界确认：赔案不允许删除，删除是异常事件

**Technical Decisions Confirmed**:
| 决策项 | 选择 |
|--------|------|
| 任务队列 | 基于 JSON 文件的内存队列 |
| 并发控制 | 单用户并发10个文件 |
| 重试策略 | 单文件级别，3次，指数退避(1s→2s→4s) |
| 通知机制 | 消息中心模块 |
| 监控 | 耗时统计、失败率告警、积压监控 |

### Research Findings
- 现有文件处理：`server/services/fileProcessor.js` - `processFile()` 函数
- 现有端点：`server/apiHandler.js:1406-1600` - `import-offline-materials` 同步端点
- 现有存储：`readData/writeData` 工具，存储在 `jsonlist/` 目录
- 现有日志：`writeAuditLog` 函数用于审计日志
- 无现有任务队列、消息中心、监控系统

---

## Work Objectives

### Core Objective
将"离线材料导入"从同步处理改造成异步任务队列，实现后台自动处理、失败重试、消息通知，并提供监控告警能力。

### Concrete Deliverables
1. **任务队列系统** (`server/taskQueue/`)
   - `queue.js` - 任务队列管理器
   - `worker.js` - 文件处理 Worker
   - `scheduler.js` - 任务调度器

2. **消息中心模块** (`server/messageCenter/`)
   - `messageService.js` - 消息服务
   - 数据模型：messages.json

3. **监控系统** (`server/monitoring/`)
   - `metrics.js` - 指标收集
   - `alerts.js` - 告警服务

4. **API 端点** (`server/apiHandler.js` 新增)
   - `POST /api/tasks/import-materials` - 创建异步任务
   - `GET /api/tasks/:id` - 查询任务状态
   - `GET /api/tasks/:id/files` - 查询文件处理详情
   - `POST /api/tasks/:id/retry` - 手动重试失败文件
   - `GET /api/messages` - 消息列表
   - `GET /api/messages/unread-count` - 未读计数
   - `POST /api/messages/:id/read` - 标记已读

5. **前端组件**
   - `MessageCenter.tsx` - 消息中心页面
   - `MessageBell.tsx` - 顶部消息铃铛组件
   - 修改 `OfflineImportPage.tsx` - 异步上传流程

6. **数据文件** (`jsonlist/`)
   - `processing-tasks.json` - 任务队列数据
   - `messages.json` - 消息数据
   - `task-metrics.json` - 监控指标数据

### Definition of Done
- [ ] 上传10个文件后，API 立即返回 taskId (< 500ms)
- [ ] Worker 自动处理所有文件，单用户并发10个
- [ ] 失败文件自动重试3次（指数退避）
- [ ] 处理完成后，用户收到消息中心通知
- [ ] 可查看任务进度和单个文件状态
- [ ] 可手动重试失败文件
- [ ] 监控数据记录任务耗时、成功率、队列长度

### Must Have
- 基于 JSON 文件的任务队列（不使用 Redis）
- 单文件级别重试（3次，指数退避）
- 消息中心基础功能（列表、未读数、标记已读）
- 任务状态持久化到 JSON 文件
- 处理完成后通过消息中心通知用户

### Must NOT Have (Guardrails)
- 不使用 Redis、RabbitMQ 等外部队列
- 不实现邮件/钉钉推送（仅预留接口）
- 不实现实时聊天功能
- 不修改赔案删除逻辑（赔案不允许删除是既定规则）
- 不改动机损、人伤等其他模块的文件处理

---

## Verification Strategy

### Test Infrastructure Assessment
- **Infrastructure exists**: NO
- **User wants tests**: Manual QA only
- **Framework**: None

### Manual QA Strategy
每个 TODO 包含详细的验证步骤：
- **API 测试**: 使用 curl 验证端点
- **Worker 测试**: 检查 JSON 文件状态变化
- **前端测试**: 浏览器验证 UI 交互
- **监控测试**: 检查指标数据记录

---

## Task Flow

```
Phase 1: 核心任务队列
    Task 1 (基础结构)
        ↓
    Task 2 (Worker)
        ↓
    Task 3 (调度器)
        ↓
Phase 2: 消息中心
    Task 4 (消息服务)
        ↓
    Task 5 (消息 API)
        ↓
    Task 6 (前端消息中心)
        ↓
Phase 3: 监控告警
    Task 7 (指标收集)
        ↓
    Task 8 (告警服务)
        ↓
Phase 4: 集成改造
    Task 9 (改造上传端点)
        ↓
    Task 10 (集成验证)
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| Phase 1 | 1, 2, 3 | 必须串行，后续依赖 |
| Phase 2 | 4, 5, 6 | 消息服务 → API → UI |
| Phase 3 | 7, 8 | 可并行，但建议串行 |
| Phase 4 | 9, 10 | 改造 → 验证 |

**Dependencies**:
- Task 2 依赖 Task 1（Worker 依赖队列管理器）
- Task 3 依赖 Task 2（调度器依赖 Worker）
- Task 5 依赖 Task 4（API 依赖消息服务）
- Task 6 依赖 Task 5（UI 依赖 API）
- Task 9 依赖 Task 3 和 Task 5（改造端点依赖队列和消息）
- Task 10 依赖所有其他任务

---

## TODOs

### Phase 1: 核心任务队列

- [ ] 1. 创建任务队列管理器 (queue.js)

  **What to do**:
  - 创建 `server/taskQueue/queue.js`
  - 实现任务创建、查询、更新、删除方法
  - 使用 `readData/writeData` 操作 `jsonlist/processing-tasks.json`
  - 实现任务状态机：pending → processing → completed/failed

  **Must NOT do**:
  - 不要引入 Redis、BullMQ 等外部依赖
  - 不要修改现有 `fileProcessor.js`

  **Parallelizable**: NO (Phase 1 基础)

  **References**:
  - `server/utils/fileStore.js:readData/writeData` - JSON 文件操作模式
  - `server/apiHandler.js:1406-1600` - 现有导入逻辑参考
  - `jsonlist/` 目录 - 现有数据存储位置

  **Data Model**:
  ```javascript
  // processing-tasks.json 结构
  {
    "tasks": [
      {
        "id": "task-uuid",
        "type": "import-offline-materials",
        "claimCaseId": "case-id",
        "productCode": "PROD001",
        "status": "pending|processing|completed|failed|partial_success",
        "files": [
          {
            "fileName": "发票.jpg",
            "mimeType": "image/jpeg",
            "base64Data": "...",
            "status": "pending|processing|completed|failed",
            "retryCount": 0,
            "result": null,
            "errorMessage": null,
            "startedAt": null,
            "completedAt": null
          }
        ],
        "progress": { "total": 10, "completed": 0, "failed": 0 },
        "createdAt": "2026-03-02T...",
        "startedAt": null,
        "completedAt": null,
        "createdBy": "user-id"
      }
    ]
  }
  ```

  **File Write Concurrency Handling**:
  ```javascript
  // 使用简单的文件锁机制避免并发写入冲突
  import { lock, unlock } from 'proper-lockfile';
  
  async function writeTaskData(data) {
    const filePath = 'jsonlist/processing-tasks.json';
    await lock(filePath);
    try {
      writeData('processing-tasks', data);
    } finally {
      await unlock(filePath);
    }
  }
  ```
  
  **Alternative**: 如果 proper-lockfile 不可用，使用内存队列序列化写入：
  ```javascript
  const writeQueue = [];
  let isWriting = false;
  
  async function enqueueWrite(data) {
    return new Promise((resolve) => {
      writeQueue.push({ data, resolve });
      processWriteQueue();
    });
  }
  ```

  **Acceptance Criteria**:
  - [ ] 创建 `server/taskQueue/queue.js`
  - [ ] 实现 `createTask(claimCaseId, productCode, files, userId)` 返回 taskId
  - [ ] 实现 `getTask(taskId)` 查询任务
  - [ ] 实现 `updateTask(taskId, updates)` 更新任务
  - [ ] 实现 `getPendingTasks()` 获取待处理任务（按 createdAt 排序）
  - [ ] 实现 `updateFileStatus(taskId, fileName, status, result, error)`
  - [ ] 数据持久化到 `jsonlist/processing-tasks.json`
  - [ ] 实现文件写入并发控制（文件锁或队列）
  - [ ] 单元测试验证：
    ```bash
    # 启动 Node REPL
    node
    > const { createTask, getTask } = require('./server/taskQueue/queue.js')
    > const taskId = createTask('case-001', 'PROD001', [{fileName: 'test.jpg', mimeType: 'image/jpeg'}], 'user-001')
    > console.log('Created:', taskId)
    > const task = getTask(taskId)
    > console.log('Status:', task.status)  // 预期: pending
    ```

  **Commit**: YES
  - Message: `feat(task-queue): add queue manager for async file processing`
  - Files: `server/taskQueue/queue.js`, `jsonlist/processing-tasks.json` (created)

---

- [ ] 2. 创建文件处理 Worker (worker.js)

  **What to do**:
  - 创建 `server/taskQueue/worker.js`
  - 实现文件处理逻辑，调用现有 `processFile` 和 `classifyMaterial`
  - 实现重试机制：3次，指数退避（1s → 2s → 4s）
  - 处理超时：单个文件60秒超时
  - 记录详细日志到 `writeAuditLog`

  **Must NOT do**:
  - 不要直接处理 HTTP 请求，Worker 是被调用的
  - 不要修改现有 `fileProcessor.js` 或 `classifyMaterial` 函数

  **Parallelizable**: NO (依赖 Task 1)

  **References**:
  - `server/services/fileProcessor.js:processFile` - 文件处理函数
  - `server/apiHandler.js:271` - `classifyMaterial` 函数
  - `server/middleware/index.js:92` - `writeAuditLog` 函数
  - `server/taskQueue/queue.js` (Task 1) - 队列操作方法

  **Retry Logic**:
  ```javascript
  // 可重试错误类型
  const RETRYABLE_ERRORS = [
    'ECONNRESET',      // 网络连接重置
    'ETIMEDOUT',       // 连接超时
    'ECONNREFUSED',    // 连接被拒绝
    'ENOTFOUND',       // DNS 解析失败
    'API_RATE_LIMIT',  // API 限流
    'TIMEOUT',         // 处理超时
  ];
  
  // 指数退避: 1s, 2s, 4s
  const getRetryDelay = (retryCount) => Math.pow(2, retryCount) * 1000;
  ```

  **Acceptance Criteria**:
  - [ ] 创建 `server/taskQueue/worker.js`
  - [ ] 实现 `processFileWithRetry(taskId, file, retryCount = 0)`
  - [ ] 实现重试逻辑：检查错误是否可重试，延迟后重试
  - [ ] 实现超时控制：使用 Promise.race + setTimeout(60000)
  - [ ] 调用 `processFile()` 进行 OCR 和解析
  - [ ] 调用 `classifyMaterial()` 进行文档分类
  - [ ] 成功：更新文件状态为 completed，记录 result
  - [ ] 失败（可重试且 retryCount < 3）：延迟后重试
  - [ ] 失败（不可重试或重试耗尽）：更新状态为 failed，记录 error
  - [ ] 使用 `writeAuditLog` 记录每个文件的：开始、成功、失败、重试事件
  - [ ] 测试验证：模拟网络错误，验证重试3次后标记失败

  **Commit**: YES
  - Message: `feat(task-queue): add file processing worker with retry`
  - Files: `server/taskQueue/worker.js`

---

- [ ] 3. 创建任务调度器 (scheduler.js)

  **What to do**:
  - 创建 `server/taskQueue/scheduler.js`
  - 定期轮询待处理任务（每秒）
  - 单用户并发控制：最多10个文件同时处理
  - 任务完成后发送消息通知
  - 进程启动时初始化调度器

  **Must NOT do**:
  - 不要创建多个调度器实例（使用单例模式）
  - 不要在调度器里实现复杂的并发算法

  **Parallelizable**: NO (依赖 Task 2)

  **References**:
  - `server/taskQueue/queue.js` (Task 1) - 队列操作
  - `server/taskQueue/worker.js` (Task 2) - Worker 实例
  - `server/server.js` - 服务器启动入口

  **Concurrency Control**:
  ```javascript
  // 全局并发控制
  const MAX_CONCURRENT_PER_USER = 10;
  const processingFiles = new Map(); // userId -> Set<taskId_fileName>
  
  // 检查用户是否还有并发额度
  function hasConcurrencySlot(userId) {
    const userProcessing = processingFiles.get(userId) || new Set();
    return userProcessing.size < MAX_CONCURRENT_PER_USER;
  }
  ```

  **Acceptance Criteria**:
  - [ ] 创建 `server/taskQueue/scheduler.js`
  - [ ] 实现 `start()` 方法启动调度器（每秒轮询）
  - [ ] 实现 `stop()` 方法停止调度器
  - [ ] 获取待处理任务：`getPendingTasks()`
  - [ ] 对于每个任务，检查用户并发额度
  - [ ] 如果有额度，获取待处理文件，启动 Worker 处理
  - [ ] 跟踪正在处理的文件（避免超额）
  - [ ] 文件完成后，更新进度，释放并发槽
  - [ ] 所有文件完成后，更新任务状态为 completed/partial_success/failed
  - [ ] 任务完成时，调用消息服务创建通知（预留接口）
  - [ ] 在 `server.js` 启动时调用 `scheduler.start()`
  - [ ] 在进程退出时调用 `scheduler.stop()`
  - [ ] 测试验证：
    ```bash
    # 创建15个文件的任务
    curl -X POST http://localhost:8080/api/tasks/import-materials \
      -H "Content-Type: application/json" \
      -d '{"claimCaseId":"case-001","files":[15个文件]}'
    
    # 观察日志，确认最多同时处理10个
    # 观察 jsonlist/processing-tasks.json，确认进度更新
    ```

  **Commit**: YES
  - Message: `feat(task-queue): add task scheduler with concurrency control`
  - Files: `server/taskQueue/scheduler.js`, `server/server.js` (修改)

---

### Phase 2: 消息中心模块

- [ ] 4. 创建消息服务 (messageService.js)

  **What to do**:
  - 创建 `server/messageCenter/messageService.js`
  - 实现消息创建、查询、标记已读
  - 数据存储在 `jsonlist/messages.json`
  - 预留钉钉/邮件推送接口（暂不实现）

  **Must NOT do**:
  - 不要实现邮件发送逻辑（仅预留接口）
  - 不要实现钉钉机器人逻辑（仅预留接口）

  **Parallelizable**: NO (Phase 2 基础)

  **References**:
  - `server/utils/fileStore.js` - JSON 文件操作
  - `server/middleware/index.js:92` - `writeAuditLog`

  **Data Model**:
  ```javascript
  // jsonlist/messages.json
  {
    "messages": [
      {
        "id": "msg-uuid",
        "userId": "user-001",
        "type": "task_complete|task_failed|system_notice",
        "title": "材料导入完成",
        "content": "您的离线材料导入任务已完成，成功处理 8/10 个文件",
        "data": {
          "taskId": "task-uuid",
          "claimCaseId": "case-001",
          "successCount": 8,
          "failCount": 2
        },
        "isRead": false,
        "createdAt": "2026-03-02T...",
        "readAt": null
      }
    ]
  }
  ```

  **Message Types**:
  | Type | Trigger | Title Example |
  |------|---------|---------------|
  | task_complete | 任务全部成功 | "材料导入完成" |
  | task_failed | 任务全部失败 | "材料导入失败" |
  | task_partial | 部分成功 | "材料导入部分完成" |
  | system_notice | 系统通知 | "系统维护通知" |

  **Acceptance Criteria**:
  - [ ] 创建 `server/messageCenter/messageService.js`
  - [ ] 实现 `createMessage(userId, type, title, content, data)` 返回 messageId
  - [ ] 实现 `getMessages(userId, options)` 查询消息列表（支持分页）
  - [ ] 实现 `getUnreadCount(userId)` 获取未读消息数
  - [ ] 实现 `markAsRead(messageId)` 标记已读
  - [ ] 实现 `markAllAsRead(userId)` 标记所有已读
  - [ ] 实现 `deleteMessage(messageId)` 删除消息
  - [ ] 数据持久化到 `jsonlist/messages.json`
  - [ ] 预留 `sendDingTalk(message)` 接口（空实现）
  - [ ] 预留 `sendEmail(message)` 接口（空实现）
  - [ ] 使用 `writeAuditLog` 记录消息创建事件
  - [ ] 测试验证：
    ```bash
    node
    > const { createMessage, getUnreadCount } = require('./server/messageCenter/messageService.js')
    > const msgId = createMessage('user-001', 'task_complete', '测试', '内容', {taskId: 't1'})
    > console.log('未读数:', getUnreadCount('user-001'))  // 预期: 1
    ```

  **Commit**: YES
  - Message: `feat(message-center): add message service with CRUD operations`
  - Files: `server/messageCenter/messageService.js`, `jsonlist/messages.json` (created)

---

- [ ] 5. 创建消息中心 API 端点

  **What to do**:
  - 在 `server/apiHandler.js` 添加消息相关端点
  - 实现 RESTful API：列表、未读数、标记已读、删除

  **Must NOT do**:
  - 不要修改现有端点（保持向后兼容）
  - 不要添加未实现的推送功能

  **Parallelizable**: NO (依赖 Task 4)

  **References**:
  - `server/apiHandler.js` - 现有 API 处理模式
  - `server/messageCenter/messageService.js` (Task 4) - 消息服务

  **API Endpoints**:
  ```
  GET    /api/messages?page=1&limit=20          # 消息列表
  GET    /api/messages/unread-count             # 未读计数
  POST   /api/messages/:id/read                 # 标记已读
  POST   /api/messages/read-all                 # 全部已读
  DELETE /api/messages/:id                      # 删除消息
  ```

  **Acceptance Criteria**:
  - [ ] 修改 `server/apiHandler.js`，添加消息端点处理
  - [ ] 实现 `GET /api/messages` - 返回消息列表（分页）
  - [ ] 实现 `GET /api/messages/unread-count` - 返回未读数
  - [ ] 实现 `POST /api/messages/:id/read` - 标记单条已读
  - [ ] 实现 `POST /api/messages/read-all` - 标记全部已读
  - [ ] 实现 `DELETE /api/messages/:id` - 删除消息
  - [ ] 所有端点返回统一格式：`{ success: true, data: ..., meta: {...} }`
  - [ ] 测试验证：
    ```bash
    # 先创建测试消息
    curl http://localhost:8080/api/messages/unread-count
    # 预期: {"success":true,"data":{"count":0}}
    
    # 创建消息后
    curl http://localhost:8080/api/messages?page=1&limit=10
    # 预期: 返回消息列表
    ```

  **Commit**: YES
  - Message: `feat(api): add message center REST endpoints`
  - Files: `server/apiHandler.js`

---

- [ ] 6. 创建前端消息中心组件

  **What to do**:
  - 创建 `MessageCenter.tsx` - 消息中心页面
  - 创建 `MessageBell.tsx` - 顶部消息铃铛
  - 修改现有页面集成消息通知

  **Must NOT do**:
  - 不要修改路由逻辑（保持现有路由模式）
  - 不要引入新 CSS 框架（使用现有 Tailwind）

  **Parallelizable**: NO (依赖 Task 5)

  **References**:
  - `components/ui/` - 现有 UI 组件（Modal, Button, Badge 等）
  - `App.tsx` - 现有路由和状态管理
  - `services/api.ts` - API 调用模式

  **UI Components**:
  1. **MessageBell** - 顶部导航栏组件
     - 显示未读消息数（红点 Badge）
     - 点击弹出消息下拉列表
     - 显示最近5条消息
     - "查看全部"链接跳转消息中心

  2. **MessageCenter** - 消息中心页面
     - 消息列表（分页）
     - 未读/已读筛选
     - 标记已读按钮
     - 删除按钮
     - 消息详情弹窗

  **MessageBell Polling Strategy**:
  ```typescript
  // useUnreadCount.ts - 自定义 Hook
  export const useUnreadCount = () => {
    const [count, setCount] = useState(0);
    
    useEffect(() => {
      const fetchUnread = async () => {
        try {
          const res = await fetch('/api/messages/unread-count');
          const data = await res.json();
          setCount(data.data.count);
        } catch (e) {
          console.error('Failed to fetch unread count:', e);
        }
      };
      
      // 初始加载
      fetchUnread();
      
      // 每30秒轮询
      const timer = setInterval(fetchUnread, 30000);
      
      // 页面可见性变化时立即刷新
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          fetchUnread();
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      
      return () => {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }, []);
    
    return count;
  };
  ```

  **Acceptance Criteria**:
  - [ ] 创建 `components/MessageBell.tsx`
  - [ ] 创建 `components/MessageCenter.tsx`
  - [ ] 在顶部导航栏添加 `<MessageBell />` 组件
  - [ ] 实现 `useUnreadCount` Hook，每30秒轮询未读数
  - [ ] 页面从后台切换到前台时立即刷新未读数
  - [ ] 点击铃铛显示最近消息下拉
  - [ ] 消息中心页面显示完整列表
  - [ ] 支持分页加载
  - [ ] 支持标记已读/全部已读
  - [ ] 点击任务完成消息跳转到任务详情
  - [ ] 测试验证：
    ```bash
    npm run dev
    # 登录后查看顶部铃铛
    # 创建消息后验证铃铛显示红点
    # 点击铃铛查看消息下拉
    # 进入消息中心查看完整列表
    ```

  **Commit**: YES
  - Message: `feat(ui): add message center components and bell notification`
  - Files: `components/MessageBell.tsx`, `components/MessageCenter.tsx`, `App.tsx` (修改)

---

### Phase 3: 监控告警系统

- [ ] 7. 创建监控指标收集 (metrics.js)

  **What to do**:
  - 创建 `server/monitoring/metrics.js`
  - 收集任务处理耗时、成功率、队列长度等指标
  - 数据存储在 `jsonlist/task-metrics.json`

  **Must NOT do**:
  - 不要引入 Prometheus、Grafana 等外部系统
  - 不要实现复杂的时序数据库

  **Parallelizable**: NO (Phase 3 基础)

  **References**:
  - `server/utils/fileStore.js` - JSON 文件操作
  - `server/taskQueue/queue.js` - 任务状态

  **Metrics**:
  | 指标 | 说明 |
  |------|------|
  | task_created_total | 创建的任务总数 |
  | task_completed_total | 完成的任务总数 |
  | task_failed_total | 失败的任务总数 |
  | file_processed_total | 处理的文件总数 |
  | file_failed_total | 失败的文件总数 |
  | processing_duration | 处理耗时（按任务/文件） |
  | queue_length | 当前队列长度 |
  | retry_total | 重试次数 |

  **Data Model**:
  ```javascript
  // jsonlist/task-metrics.json
  {
    "counters": {
      "task_created_total": 100,
      "task_completed_total": 95,
      "task_failed_total": 5,
      "file_processed_total": 980,
      "file_failed_total": 20,
      "retry_total": 30
    },
    "durations": [
      // 最近100条处理记录
      {"taskId": "t1", "duration": 45000, "timestamp": "..."}
    ],
    "snapshots": [
      // 每小时队列快照
      {"timestamp": "...", "queue_length": 5, "processing_count": 10}
    ],
    "lastUpdated": "2026-03-02T..."
  }
  ```

  **Acceptance Criteria**:
  - [ ] 创建 `server/monitoring/metrics.js`
  - [ ] 实现 `recordTaskCreated()` - 记录任务创建
  - [ ] 实现 `recordTaskCompleted(taskId, duration)` - 记录完成
  - [ ] 实现 `recordTaskFailed(taskId, error)` - 记录失败
  - [ ] 实现 `recordFileProcessed(taskId, fileName, duration, success)`
  - [ ] 实现 `recordRetry(taskId, fileName, retryCount)`
  - [ ] 实现 `getMetrics()` - 返回当前指标
  - [ ] 实现 `getQueueSnapshot()` - 记录队列快照
  - [ ] 数据持久化到 `jsonlist/task-metrics.json`
  - [ ] 每小时自动记录队列快照
  - [ ] 测试验证：处理任务后检查指标数据

  **Commit**: YES
  - Message: `feat(monitoring): add metrics collection for task processing`
  - Files: `server/monitoring/metrics.js`, `jsonlist/task-metrics.json` (created)

---

- [ ] 8. 创建告警服务 (alerts.js)

  **What to do**:
  - 创建 `server/monitoring/alerts.js`
  - 实现失败率告警（> 10% 触发）
  - 实现队列积压告警（> 50 个任务触发）
  - 实现慢任务告警（单文件 > 60s 触发）
  - 告警记录到日志，预留钉钉/邮件接口

  **Must NOT do**:
  - 不要实现真正的钉钉/邮件发送（仅预留接口）
  - 不要创建告警风暴（同一问题1小时内只告警一次）

  **Parallelizable**: NO (依赖 Task 7)

  **References**:
  - `server/monitoring/metrics.js` (Task 7) - 指标数据
  - `server/middleware/index.js:92` - `writeAuditLog`

  **Alert Rules**:
  | 规则 | 阈值 | 级别 |
  |------|------|------|
  | 失败率过高 | 最近1小时失败率 > 10% | warning |
  | 队列积压 | 待处理任务 > 50 | warning |
  | 处理过慢 | 单文件处理 > 60s | info |
  | 连续失败 | 同一任务重试3次后仍失败 | error |

  **Alert Throttling**:
  ```javascript
  // 告警冷却：同一规则1小时内只发一次
  const alertCooldown = new Map(); // ruleKey -> lastAlertTime
  
  function shouldAlert(ruleKey) {
    const lastAlert = alertCooldown.get(ruleKey);
    if (!lastAlert) return true;
    return Date.now() - lastAlert > 60 * 60 * 1000; // 1小时
  }
  ```

  **Acceptance Criteria**:
  - [ ] 创建 `server/monitoring/alerts.js`
  - [ ] 实现 `checkFailureRate()` - 检查最近1小时失败率
  - [ ] 实现 `checkQueueBacklog()` - 检查队列积压
  - [ ] 实现 `checkSlowTasks()` - 检查慢任务
  - [ ] 实现告警冷却机制（1小时内同一规则不重复告警）
  - [ ] 实现 `sendAlert(alert)` - 记录告警到日志
  - [ ] 预留 `sendDingTalkAlert(alert)` 接口（空实现）
  - [ ] 预留 `sendEmailAlert(alert)` 接口（空实现）
  - [ ] 每5分钟执行一次告警检查
  - [ ] 告警记录到 `writeAuditLog`，type: 'ALERT'
  - [ ] 测试验证：模拟高失败率，验证告警触发

  **Commit**: YES
  - Message: `feat(monitoring): add alert service with rate limiting`
  - Files: `server/monitoring/alerts.js`, `server/server.js` (添加定时检查)

---

### Phase 4: 集成改造

- [ ] 9. 改造导入端点为异步模式

  **What to do**:
  - 修改 `server/apiHandler.js` 的 `import-offline-materials` 端点
  - 改为创建异步任务，立即返回 taskId
  - 集成消息通知（任务完成后发送消息）
  - 添加新端点：查询任务状态、查询文件详情、手动重试

  **Must NOT do**:
  - 不要删除现有同步逻辑（注释掉或保留开关）
  - 不要修改前端上传组件的 props 接口

  **Parallelizable**: NO (依赖 Task 3, 5, 7)

  **References**:
  - `server/apiHandler.js:1406-1600` - 现有同步端点
  - `server/taskQueue/queue.js` (Task 1) - 创建任务
  - `server/taskQueue/scheduler.js` (Task 3) - 调度器
  - `server/messageCenter/messageService.js` (Task 4) - 消息服务
  - `server/monitoring/metrics.js` (Task 7) - 指标收集

  **API Changes**:
  ```javascript
  // 修改现有端点
  POST /api/import-offline-materials  →  改为异步，返回 taskId
  
  // 新增端点
  GET    /api/tasks/:id                  # 查询任务状态
  GET    /api/tasks/:id/files            # 查询文件详情
  POST   /api/tasks/:id/retry            # 重试失败文件
  ```

  **Response Format**:
  ```javascript
  // POST /api/import-offline-materials (修改后)
  {
    "success": true,
    "taskId": "task-uuid",
    "message": "任务已创建，正在后台处理",
    "totalFiles": 10
  }
  
  // GET /api/tasks/:id
  {
    "success": true,
    "data": {
      "id": "task-uuid",
      "status": "processing",
      "progress": { "total": 10, "completed": 5, "failed": 1 },
      "files": [...],
      "createdAt": "...",
      "startedAt": "..."
    }
  }
  ```

  **Integration Points**:
  1. 创建任务时调用 `queue.createTask()`
  2. 任务完成后调用 `messageService.createMessage()` 发送通知
  3. 关键事件调用 `metrics.recordXxx()` 记录指标
  4. 使用 `writeAuditLog` 记录操作日志
  5. 调用 `classifyMaterial()` 进行文档分类（复用现有函数）

  **References**:
  - `server/apiHandler.js:271-330` - `classifyMaterial` 函数实现
  - `server/services/fileProcessor.js:210` - `processFile` 函数

  **Acceptance Criteria**:
  - [ ] 修改 `POST /api/import-offline-materials`：
    - [ ] 接收参数后调用 `createTask()` 创建任务
    - [ ] 立即返回 `{ success: true, taskId, message, totalFiles }`
    - [ ] 响应时间 < 500ms
  - [ ] 实现 `GET /api/tasks/:id`：
    - [ ] 返回任务完整状态
    - [ ] 包含进度统计
  - [ ] 实现 `GET /api/tasks/:id/files`：
    - [ ] 返回所有文件处理详情
    - [ ] 支持按状态筛选
  - [ ] 实现 `POST /api/tasks/:id/retry`：
    - [ ] 仅允许重试 failed 的文件
    - [ ] 重置文件状态为 pending
    - [ ] 更新任务状态为 processing
  - [ ] 在调度器中集成消息通知：
    - [ ] 任务完成后根据状态创建消息
    - [ ] task_complete: 全部成功
    - [ ] task_failed: 全部失败
    - [ ] task_partial: 部分成功
  - [ ] 在关键节点集成指标收集
  - [ ] 测试验证：
    ```bash
    # 创建异步任务
    curl -X POST http://localhost:8080/api/import-offline-materials \
      -d '{"claimCaseId":"c1","files":[...]}'
    # 预期: 立即返回 taskId
    
    # 查询任务状态
    curl http://localhost:8080/api/tasks/task-uuid
    # 预期: 返回任务进度
    
    # 等待处理完成后查询消息
    curl http://localhost:8080/api/messages/unread-count
    # 预期: 未读数 > 0
    ```

  **Commit**: YES
  - Message: `feat(api): convert import-offline-materials to async with task APIs`
  - Files: `server/apiHandler.js`

---

- [ ] 10. 前端上传流程改造

  **What to do**:
  - 修改离线材料导入页面
  - 上传后显示任务 ID 和处理状态
  - 提供查看任务详情的入口
  - 支持手动重试失败文件

  **Must NOT do**:
  - 不要改变页面整体布局
  - 不要删除现有的文件预览功能

  **Parallelizable**: NO (依赖 Task 6, 9)

  **References**:
  - 现有离线材料导入页面（搜索 `import-offline-materials` 相关组件）
  - `components/MessageBell.tsx` (Task 6) - 消息通知
  - `services/api.ts` - API 调用模式

  **UI Changes**:
  1. **上传后状态显示**
     - 显示"任务已提交，后台处理中"
     - 显示任务 ID
     - 显示预计完成时间
     - 提供"查看进度"按钮

  2. **任务进度查看**
     - 弹窗显示任务详情
     - 进度条：X/Y 文件已完成
     - 文件列表：文件名 + 状态图标
     - 失败文件显示错误原因

  3. **重试功能**
     - 失败文件旁显示"重试"按钮
     - 点击后调用重试 API
     - 刷新任务状态

  **Polling Strategy**:
  ```typescript
  // 轮询策略：指数退避 + 最大间隔
  const useTaskPolling = (taskId: string) => {
    const [status, setStatus] = useState('pending');
    const [progress, setProgress] = useState({ total: 0, completed: 0 });
    
    useEffect(() => {
      let interval = 1000; // 初始 1 秒
      const maxInterval = 10000; // 最大 10 秒
      const timer = setInterval(async () => {
        const res = await fetch(`/api/tasks/${taskId}`);
        const data = await res.json();
        setStatus(data.data.status);
        setProgress(data.data.progress);
        
        // 如果完成，停止轮询
        if (['completed', 'failed', 'partial_success'].includes(data.data.status)) {
          clearInterval(timer);
          return;
        }
        
        // 指数退避
        interval = Math.min(interval * 1.5, maxInterval);
      }, interval);
      
      return () => clearInterval(timer);
    }, [taskId]);
    
    return { status, progress };
  };
  ```

  **Acceptance Criteria**:
  - [ ] 找到并修改离线材料导入页面组件
  - [ ] 上传成功后显示任务 ID（而非等待处理完成）
  - [ ] 显示"处理中"状态提示
  - [ ] 提供"查看进度"按钮，打开任务详情弹窗
  - [ ] 弹窗内显示实时进度（轮询）
  - [ ] 显示每个文件的处理状态（成功/失败/处理中）
  - [ ] 失败文件显示错误原因
  - [ ] 失败文件提供"重试"按钮
  - [ ] 任务完成后显示"已完成"提示
  - [ ] 消息中心收到通知后，顶部铃铛显示红点
  - [ ] 测试验证：
    ```bash
    npm run dev
    # 进入离线材料导入页面
    # 上传多个文件
    # 验证：立即返回任务 ID，显示处理中
    # 验证：点击查看进度，显示实时状态
    # 验证：处理完成后收到消息通知
    # 验证：可手动重试失败文件
    ```

  **Commit**: YES
  - Message: `feat(ui): update offline import page for async processing`
  - Files: 离线材料导入页面组件

---

## Commit Strategy

| After Task | Message | Files |
|------------|---------|-------|
| 1 | `feat(task-queue): add queue manager` | `server/taskQueue/queue.js` |
| 2 | `feat(task-queue): add file processing worker` | `server/taskQueue/worker.js` |
| 3 | `feat(task-queue): add task scheduler` | `server/taskQueue/scheduler.js`, `server/server.js` |
| 4 | `feat(message-center): add message service` | `server/messageCenter/messageService.js` |
| 5 | `feat(api): add message center endpoints` | `server/apiHandler.js` |
| 6 | `feat(ui): add message center components` | `components/MessageBell.tsx`, `components/MessageCenter.tsx` |
| 7 | `feat(monitoring): add metrics collection` | `server/monitoring/metrics.js` |
| 8 | `feat(monitoring): add alert service` | `server/monitoring/alerts.js` |
| 9 | `feat(api): convert to async with task APIs` | `server/apiHandler.js` |
| 10 | `feat(ui): update offline import page` | 离线导入页面 |

---

## Success Criteria

### Verification Commands
```bash
# 1. 启动开发服务器
npm run dev

# 2. 测试异步任务创建
curl -X POST http://localhost:8080/api/import-offline-materials \
  -H "Content-Type: application/json" \
  -d '{
    "claimCaseId": "test-case-001",
    "productCode": "TEST001",
    "files": [
      {"fileName": "发票1.jpg", "mimeType": "image/jpeg", "base64Data": "..."},
      {"fileName": "发票2.jpg", "mimeType": "image/jpeg", "base64Data": "..."}
    ]
  }'
# 预期: 立即返回 {"success": true, "taskId": "...", "totalFiles": 2}

# 3. 查询任务状态
curl http://localhost:8080/api/tasks/{taskId}
# 预期: 返回任务进度

# 4. 检查消息中心
curl http://localhost:8080/api/messages/unread-count
# 预期: 任务完成后未读数增加

# 5. 检查监控指标
cat jsonlist/task-metrics.json
# 预期: 指标数据已记录
```

### Final Checklist
- [ ] 上传10个文件，API 立即返回 taskId (< 500ms)
- [ ] Worker 自动处理文件，单用户并发10个
- [ ] 失败文件自动重试3次
- [ ] 处理完成后消息中心收到通知
- [ ] 前端可查看任务进度和文件详情
- [ ] 可手动重试失败文件
- [ ] 监控数据记录完整
- [ ] 所有测试命令通过

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| JSON 文件并发写入冲突 | 使用文件锁或队列序列化写入 |
| Worker 进程崩溃 | 启动时恢复 pending 任务状态 |
| 内存泄漏 | Worker 使用完后释放引用 |
| 前端长时间轮询 | 使用指数退避轮询或 SSE |
| 任务堆积 | 监控告警 + 手动干预 |

---

## Future Extensibility

预留的接口和扩展点：
- `sendDingTalk()` / `sendEmail()` - 后续实现推送
- 任务优先级 - 当前所有任务平等，后续可添加 priority 字段
- 分布式处理 - 当前单进程，后续可改为多 Worker 进程
- 任务取消 - 当前不支持，后续可添加 cancel 接口
