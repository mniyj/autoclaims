# 离线材料导入卡死问题修复计划

## TL;DR

> **问题**：点击"离线材料导入"后系统卡死
> 
> **根本原因**：`server/taskQueue/worker-new.js` 尝试导入不存在的 `server/services/material/index.js` 模块，导致 Node.js Worker 崩溃，任务永远卡在 `processing` 状态
>
> **修复方案**：回退到旧版 worker (`worker.js`) 或创建服务端 material 服务
>
> **预计工作量**：30 分钟（方案A）/ 5 分钟（方案B）
> **风险评估**：低风险（方案B）/ 中等风险（方案A）

---

## 问题根因分析

### 1. 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React)                          │
│  OfflineMaterialImportDialog.tsx                              │
│     ↓ POST /api/import-offline-materials                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     后端 (Express)                           │
│  apiHandler.js:1831 createTask()                              │
│     ↓ 创建任务 (pending → processing)                         │
│  scheduler.js 轮询处理                                        │
│     ↓ 调用 worker-new.js                                     │
│  ❌ 模块导入失败 → Worker 崩溃                                │
└─────────────────────────────────────────────────────────────┘
```

### 2. 问题代码定位

**文件**: `server/taskQueue/worker-new.js:9`
```javascript
// ❌ 错误：尝试导入不存在的模块
import { unifiedMaterialService } from '../services/material/index.js';
```

**实际文件位置**:
- ✅ 存在: `services/material/index.ts` (前端 TypeScript)
- ✅ 存在: `services/material/unifiedMaterialService.ts` (前端)
- ❌ 不存在: `server/services/material/index.js` (后端)

**依赖链**:
```
worker-new.js
  └─ unifiedMaterialService (期望在 server/services/material/)
      ├─ classify() - 材料分类
      └─ process() - 字段提取和审核
```

### 3. 卡死机制

1. 用户点击"导入" → 前端调用 API 创建任务
2. API 返回 `taskId`，任务状态为 `pending`
3. 前端开始轮询 `/api/tasks/{taskId}` (每2秒)
4. 调度器 `scheduler.js` 尝试处理任务
5. `worker-new.js` 启动 → 模块导入失败 → 进程崩溃
6. 任务状态永远卡在 `processing`（未完成也未失败）
7. 前端持续轮询，显示"导入中..."

---

## 修复方案

### 方案A：回退到旧版 Worker（推荐，快速修复）

**思路**: 使用已验证可用的 `worker.js` 替代 `worker-new.js`

**优势**:
- ✅ 5分钟完成
- ✅ 零风险
- ✅ 功能可用（已验证）

**劣势**:
- ⚠️ 使用旧版分类逻辑（Gemini 1.5-flash）
- ⚠️ 缺少新版 unifiedMaterialService 的增强功能

**实现步骤**:

```javascript
// server/taskQueue/scheduler.js 第13行
// 修改前:
import { processFileWithRetry } from './worker-new.js';

// 修改后:
import { processFileWithRetry } from './worker.js';
```

---

### 方案B：创建服务端 Material 服务（完整修复）

**思路**: 在 `server/services/material/` 创建 Node.js 兼容版本

**优势**:
- ✅ 保留新版功能
- ✅ 前后端逻辑一致

**劣势**:
- ⚠️ 需要 2-4 小时
- ⚠️ 需要处理浏览器/Node.js API 差异

**文件结构**:
```
server/services/material/
├── index.js                    # 统一导出
├── unifiedMaterialService.js   # 主服务
├── materialClassifier.js       # 分类逻辑
├── materialExtractor.js        # 提取逻辑
└── strategies/                 # 策略模式
    ├── baseStrategy.js
    ├── structuredDocStrategy.js
    ├── generalDocStrategy.js
    ├── imageOnlyStrategy.js
    └── invoiceStrategy.js
```

**关键适配点**:

| 前端 (浏览器) | 后端 (Node.js) |
|--------------|----------------|
| `File` 对象 | `Buffer` + metadata |
| `atob()` | `Buffer.from(base64, 'base64')` |
| `fetch()` | `node-fetch` 或内置 `fetch` (Node 18+) |
| `FormData` | `form-data` 库 |

---

### 方案C：使用同步 API（备选）

**思路**: 修改前端使用同步导入 API `import-offline-materials-sync`

**实现**:
```typescript
// OfflineMaterialImportDialog.tsx:279
// 修改前:
const response = await fetch('/api/import-offline-materials', {...})

// 修改后:
const response = await fetch('/api/import-offline-materials-sync', {...})
// 注意：需要处理长时间请求（可能超时）
```

---

## 执行计划

### Wave 1: 紧急修复（5分钟）

**任务 1.1: 回退到旧版 Worker**

- **优先级**: P0（阻塞问题）
- **文件**: `server/taskQueue/scheduler.js`
- **修改**:
  ```javascript
  // 第13行
  import { processFileWithRetry } from './worker.js';
  ```
- **验证**:
  1. 重启开发服务器
  2. 上传测试文件
  3. 点击导入按钮
  4. 验证任务完成（不卡死）

**QA 场景**:
```
场景: 修复后验证导入功能
  预置条件: 服务器已重启，调度器运行中
  步骤:
    1. 打开任意理赔案件详情页
    2. 点击"离线材料导入"按钮
    3. 上传 1-3 张图片文件
    4. 等待分类完成（显示识别结果）
    5. 点击"导入"按钮
  预期结果:
    - 显示"导入中..."进度条
    - 10-60秒后显示"处理完成"
    - 任务状态变为 completed/failed/partial_success
    - 页面不卡死，可以正常关闭弹窗
  失败指示:
    - 超过2分钟仍显示"导入中..."
    - 浏览器页面无响应
    - 任务状态永远是 processing
```

---

### Wave 2: 可选增强（如需要新版功能）

**任务 2.1: 分析新版 Worker 依赖**

- **分析** `worker-new.js` 所需的所有功能
- **列出** 需要移植的模块
- **评估** 工作量

**任务 2.2: 创建服务端 Material 服务（如选择方案B）**

- 创建 `server/services/material/` 目录
- 移植分类逻辑
- 移植提取逻辑
- 适配 Node.js API
- 恢复使用 `worker-new.js`

---

## 技术细节

### 新旧 Worker 对比

| 特性 | worker.js (旧版) | worker-new.js (新版) |
|------|-----------------|---------------------|
| 分类模型 | Gemini 1.5-flash | unifiedMaterialService |
| 提取逻辑 | 基础 OCR | 按材料类型智能提取 |
| 审核结论 | 简单分类 | 结构化审核报告 |
| 置信度 | 仅分类 | 分类+字段级置信度 |
| 维护状态 | 稳定可用 | 依赖未实现的模块 |

### 相关文件引用

**Pattern References**:
- `server/taskQueue/worker.js:38-104` - 旧版 classifyMaterial 实现
- `server/taskQueue/scheduler.js:111-181` - 任务调度逻辑
- `server/apiHandler.js:1831-1887` - 异步导入 API

**API References**:
- `POST /api/import-offline-materials` - 创建异步任务
- `GET /api/tasks/:taskId` - 查询任务状态
- `POST /api/import-offline-materials-sync` - 同步导入（备选）

---

## 验证策略

### 1. 单元验证

```bash
# 检查模块加载
cd /Users/pegasus/Documents/trae_projects/保险产品配置页面\ -理赔
node -e "import('./server/taskQueue/worker.js').then(() => console.log('✅ Worker 加载成功')).catch(e => console.error('❌', e.message))"
```

### 2. 集成验证

```bash
# 启动开发服务器
npm run dev

# 测试导入流程
# 1. 打开 http://localhost:8080
# 2. 登录系统
# 3. 进入理赔案件详情
# 4. 测试离线材料导入
```

### 3. 日志检查

```bash
# 查看调度器日志（应有以下输出）
[Scheduler] Task scheduler started
[Scheduler] Poll started
[Scheduler] Found X pending tasks
[Scheduler] Starting task task-xxx
[Worker] Starting to process file xxx.jpg
[Worker] File xxx.jpg processed successfully
[Queue] Task task-xxx completed with status: completed
```

---

## 回滚策略

如果修复后出现问题，立即回滚：

```bash
# 恢复 scheduler.js 的修改
git checkout server/taskQueue/scheduler.js

# 或者手动改回
# import { processFileWithRetry } from './worker-new.js';
```

---

## 后续建议

1. **监控**: 添加任务处理超时检测（>5分钟自动标记为失败）
2. **告警**: 调度器检测到 Worker 崩溃时发送告警
3. **重构**: 考虑统一前后端 material 服务架构
4. **文档**: 更新 OFFLINE_IMPORT_MIGRATION.md 说明当前限制

---

## 决策点

**请问选择哪个方案？**

| 选项 | 方案 | 时间 | 风险 | 功能 |
|------|------|------|------|------|
| A | 回退到旧版 Worker | 5分钟 | 低 | 基础功能 |
| B | 创建服务端服务 | 2-4小时 | 中 | 完整功能 |
| C | 使用同步 API | 15分钟 | 低 | 基础功能（可能超时） |

**默认推荐：方案A** - 快速恢复服务，后续再考虑功能增强。
