# 架构缺陷评估报告

## 当前系统架构概览

### 技术栈
- **前端**: React 19 + TypeScript + Vite + Tailwind
- **后端**: Express 5 + LangChain + Google Gemini
- **AI**: Google Gemini API (`@langchain/google-genai`) + LangGraph
- **存储**: localStorage + 阿里云 OSS
- **部署**: 两个独立的 Vite 应用（Admin 8080, AI Agent 8081）

---

## LangGraph 迁移状态 ✅ 已完成

### 已实现的功能

| 功能 | 状态 | 文件 |
|------|------|------|
| **状态 Schema 定义** | ✅ 完成 | `server/ai/state.js` |
| **LangGraph 状态图** | ✅ 完成 | `server/ai/graph.js` |
| **状态持久化支持** | ✅ 完成 | `server/ai/graph-with-checkpointer.js` |
| **人工审核 interrupt/resume** | ✅ 完成 | `graph-with-checkpointer.js` |
| **API 端点更新** | ✅ 完成 | `server/apiHandler.js` |
| **使用文档** | ✅ 完成 | `server/ai/README.md` |

### 审核流程图

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │
                           ▼
              ┌──────────────────────┐
              │  collect_documents   │  ← 收集材料
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  check_eligibility   │  ← 责任判断
              └──────────┬───────────┘
                         │
           ┌─────────────┴─────────────┐
           │                           │
    eligible=false             eligible=true
           │                           │
           ▼                           ▼
 ┌─────────────────┐   ┌──────────────────────┐
 │  reject_claim   │   │  calculate_amount     │  ← 金额计算
 │     (拒赔)       │   └──────────┬───────────┘
 └────────┬────────┘              │
          │                       ▼
          │            ┌──────────────────────┐
          │            │     assess_risk      │  ← 风险评估
          │            └──────────┬───────────┘
          │                       │
          │         ┌─────────────┴─────────────┐
          │         │                           │
          │    risk=HIGH                 risk=LOW/MEDIUM
          │         │                           │
          │         ▼                           ▼
          │  ┌─────────────────┐   ┌─────────────────┐
          │  │  human_review   │   │  auto_approve   │  ← 自动通过
          │  │   (人工审核)     │   └────────┬────────┘
          │  └────────┬────────┘           │
          │         │                     │
          └─────────┴─────────────────────┘
                          │
                          ▼
                  ┌─────────────┐
                  │    END      │
                  └─────────────┘
```

---

## API 端点

### 1. 智能审核

```http
POST /api/ai/smart-review
Content-Type: application/json

{
  "claimCaseId": "CLM001",
  "productCode": "ZA-002",
  "ocrData": {...},
  "invoiceItems": [...],
  "engine": "graph"  // 'agent' | 'graph' | 'graph-checkpointer'
}
```

### 2. 获取审核状态

```http
GET /api/ai/review-state?claimCaseId=CLM001
```

### 3. 提交人工审核结果

```http
POST /api/ai/human-review
Content-Type: application/json

{
  "claimCaseId": "CLM001",
  "decision": "APPROVE",
  "auditor": "张审核员",
  "comment": "已核实，同意赔付"
}
```

### 4. 清除审核状态

```http
POST /api/ai/clear-state
Content-Type: application/json

{
  "claimCaseId": "CLM001"
}
```

---

## 环境变量配置

```bash
# AI 引擎选择 (默认: graph)
AI_ENGINE=graph

# 可选值:
# - agent: 使用旧的 LangChain Agent
# - graph: 使用 LangGraph (推荐)
# - graph-checkpointer: 使用 LangGraph + 状态持久化

# Gemini API Key (必需)
GEMINI_API_KEY=your_api_key_here
```

---

## 待改进

| 项目 | 优先级 | 说明 |
|------|--------|------|
| **Redis 持久化** | P1 | 当前使用 MemorySaver，生产环境需替换为 Redis/Postgres |
| **集成 LangSmith** | P2 | 可视化调试和监控 |
| **单元测试** | P1 | 添加节点和边的测试 |
| **性能监控** | P1 | 添加 Prometheus 指标 |

---

## 参考文档

- [LangGraph 文档](https://langchain-ai.github.io/langgraph/)
- [使用文档](server/ai/README.md)
