# 架构缺陷评估报告

## 当前系统架构概览

### 技术栈
- **前端**: React 19 + TypeScript + Vite + Tailwind
- **AI**: Google Gemini API (`@google/genai`)
- **存储**: localStorage + 阿里云 OSS
- **部署**: 两个独立的 Vite 应用（Admin 8080, AI Agent 8081）

### 架构模式
```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                      │
├─────────────────────────────────────────────────────────┤
│  App.tsx (101KB 单体组件)                                │
│  ├── 20+ useState 状态变量                               │
│  ├── ClaimState (理赔流程状态)                           │
│  ├── Messages (对话历史)                                 │
│  └── UI 状态 (弹窗、表单、相机等)                         │
├─────────────────────────────────────────────────────────┤
│  geminiService.ts                                        │
│  ├── getAIResponse() - 直接调用 Gemini API               │
│  ├── analyzeDocument() - OCR 分析                        │
│  └── performFinalAssessment() - 赔付评估                 │
├─────────────────────────────────────────────────────────┤
│  Storage:                                                │
│  ├── localStorage (仅历史记录)                           │
│  └── 阿里云 OSS (文件上传)                               │
└─────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
   Gemini API                      阿里云 OSS
   (直接从浏览器调用)               (直接从浏览器调用)
```

---

## 一、架构缺陷分析

### 1. 🔴 **状态管理缺陷（严重）**

| 问题 | 影响 | 严重性 |
|------|------|--------|
| **无持久化状态** | 对话历史、理赔进度都在内存中，刷新即丢失 | 🔴 高 |
| **状态分散** | 20+ useState，缺乏统一管理 | 🟡 中 |
| **无 Checkpoint 机制** | 无法恢复中断的理赔流程 | 🔴 高 |
| **状态迁移靠 Prompt** | ClaimStatus 变化由 AI 输出控制，不可靠 | 🔴 高 |

**代码示例**:
```typescript
// App.tsx 第 505-580 行
const [messages, setMessages] = useState<Message[]>([...]);  // 刷新丢失
const [claimState, setClaimState] = useState<ClaimState>(() => {
  // 只恢复历史记录，不恢复当前进度
  return {
    status: ClaimStatus.REPORTING,  // 总是从 REPORTING 开始
    ...
  };
});
```

### 2. 🔴 **安全与运维缺陷（严重）**

| 问题 | 影响 | 严重性 |
|------|------|--------|
| **API Key 暴露** | GEMINI_API_KEY 在前端环境变量 | 🔴 高 |
| **无 API 网关** | 无法限流、监控、计费 | 🔴 高 |
| **无后端层** | 业务逻辑在前端，难以维护 | 🟡 中 |
| **无审计日志** | AI 调用无结构化记录 | 🟡 中 |

**代码示例**:
```typescript
// geminiService.ts 第 7 行
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });
// ↑ API Key 在构建时嵌入前端代码，可被逆向
```

### 3. 🟡 **代码架构缺陷（中等）**

| 问题 | 影响 | 严重性 |
|------|------|--------|
| **单体组件** | App.tsx 101KB，2500+ 行 | 🟡 中 |
| **UI/逻辑耦合** | 业务逻辑散落在 UI 代码中 | 🟡 中 |
| **无分层设计** | 缺乏 Service/Repository 层 | 🟡 中 |
| **Prompt 硬编码** | SYSTEM_PROMPT 写死在代码中 | 🟢 低 |

### 4. 🟡 **Agent 架构缺陷（中等）**

| 问题 | 影响 | 严重性 |
|------|------|--------|
| **无真正的状态机** | 流程控制靠 Prompt，不可预测 | 🔴 高 |
| **工具调用无框架** | OCR、OSS 等是独立函数，无统一接口 | 🟡 中 |
| **无 Human-in-the-loop** | 人工审核点没有结构化支持 | 🟡 中 |
| **无重试/错误恢复** | API 调用失败无结构化重试 | 🟡 中 |

**当前流程控制方式**:
```typescript
// geminiService.ts 第 19-37 行
const SYSTEM_PROMPT = `You are a Senior Insurance Claim AI Adjuster. 
Your goal is to guide the user through the claim process:
1. REPORTING: Ask for incident time...
2. DOCUMENTING: Based on incident type...
3. VALIDATION & OCR: Analyze uploaded materials...
4. ASSESSMENT: Determine liability...
5. PAYMENT: Confirm banking details...
`;
// ↑ 靠 AI "理解" 流程，不是真正的状态机
```

---

## 二、运维成本评估

### 当前架构的运维痛点

| 维度 | 当前状态 | 运维成本 |
|------|----------|----------|
| **部署** | 2 个独立 Vite 应用 | 需分别部署、配置端口 |
| **监控** | 无 | 无法追踪 AI 调用、错误率 |
| **调试** | 只有 console.log | 无结构化日志 |
| **扩展** | 前端直接调 API | 无法水平扩展 |
| **安全** | API Key 暴露 | 需要重构才能修复 |

### 估算月度成本（假设 1000 用户/天）

| 资源 | 估算成本 |
|------|----------|
| 静态托管 (Vercel/OSS) | ¥50-100/月 |
| Gemini API | ¥500-2000/月（取决于用量） |
| OSS 存储 | ¥50-200/月 |
| **运维人力** | **2-4 小时/周**（监控、调试、更新） |

---

## 三、LangGraph 迁移评估

### LangGraph 能解决的问题

| LangGraph 特性 | 解决的问题 |
|----------------|------------|
| **StateGraph** | 真正的状态机，流程可预测 |
| **MemorySaver/Checkpointer** | 状态持久化，中断恢复 |
| **PostgresSaver** | 生产级状态存储 |
| **Human-in-the-loop** | 结构化的人工审核点 |
| **工具调用框架** | 统一的工具接口 |
| **重试策略** | 内置 RetryPolicy |

### ⚠️ 但 LangGraph 有一个关键问题

**LangGraph 是后端框架，当前系统是纯前端！**

```
当前架构:
Browser → Gemini API (直接调用)

LangGraph 架构:
Browser → Backend (LangGraph) → Gemini API
                ↓
          Postgres (状态持久化)
```

### 迁移 LangGraph 需要的架构改造

```
┌─────────────────────────────────────────────────────────┐
│                    改造后架构                             │
├─────────────────────────────────────────────────────────┤
│  Frontend (React)                                       │
│  ├── 只负责 UI 渲染                                      │
│  └── WebSocket/HTTP 调用后端                             │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Backend (Node.js/Python + LangGraph)                   │
│  ├── StateGraph (理赔流程状态机)                         │
│  ├── Checkpointer (状态持久化)                           │
│  ├── Tools (OCR、OSS、赔付计算)                          │
│  └── Human-in-the-loop 节点                             │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Infrastructure                                          │
│  ├── Postgres (状态存储)                                 │
│  ├── Gemini API (LLM)                                   │
│  └── OSS (文件存储)                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 四、建议方案

### 方案 A：渐进式重构（推荐）

**阶段 1**: 添加 BFF 层（Backend for Frontend）
- 用 Express/Fastify 创建简单后端
- API Key 移到后端
- 前端改调用后端 API

**阶段 2**: 引入 LangGraph
- 定义 StateGraph（理赔流程状态机）
- 添加 MemorySaver
- 实现 Human-in-the-loop

**阶段 3**: 添加持久化
- 引入 Postgres
- 替换为 PostgresSaver
- 实现跨设备恢复

### 方案 B：保持纯前端（低成本）

如果不想引入后端：
- 使用 `localStorage` 更完整地保存状态
- 把 API Key 放到 Supabase/Cloudflare Workers
- 用 Zep/LangChain Memory 管理对话历史

### 方案 C：完全重写（高风险）

- 用 Next.js App Router 全栈方案
- 集成 LangGraph.js
- 需要 4-8 周开发时间

---

## 五、结论

### 是否适合迁移 LangGraph？

| 因素 | 评估 |
|------|------|
| **功能需求** | ✅ 非常适合（状态机、持久化、HIL 都需要） |
| **架构适配** | ⚠️ 需要添加后端层 |
| **开发成本** | 🟡 中等（2-4 周改造） |
| **运维收益** | ✅ 显著（可监控、可扩展、可调试） |

### 最终建议

**短期**（1-2 周）：
1. 添加简单的 BFF 后端，解决 API Key 暴露问题
2. 完善前端状态持久化（localStorage 更完整使用）

**中期**（1-2 月）：
3. 引入 LangGraph.js，构建真正的状态机
4. 添加 Postgres 持久化
5. 实现 Human-in-the-loop

**不建议**直接跳到 LangGraph，因为需要后端基础设施支持。
