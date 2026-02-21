# AI 架构升级 - LangGraph

## 概述

从 LangChain Agent 迁移到 LangGraph 状态机，实现：
- **显式流程控制**: 状态图代替 while 循环
- **可观测性**: 结构化状态便于调试
- **人工介入**: 支持 interrupt/resume
- **状态持久化**: 断点续传审核流程

---

## 架构对比

| 维度 | LangChain Agent (旧) | LangGraph (新) |
|------|---------------------|---------------|
| 流程控制 | while 循环 | 状态图 DAG |
| 结果解析 | 关键词匹配 (脆弱) | 结构化 State |
| 人工介入 | 不支持 | interrupt/resume |
| 状态持久化 | 无 | MemorySaver |
| 可观测性 | 手动日志 | 节点执行追踪 |

---

## 文件结构

```
server/ai/
├── agent.js                      # 旧版 LangChain Agent (保留作为回退)
├── state.js                      # LangGraph 状态 Schema 定义
├── graph.js                      # LangGraph 状态图 (推荐)
├── graph-with-checkpointer.js    # 带状态持久化的版本
├── prompts/
│   └── claimAdjuster.js          # AI 角色 Prompt
└── tools/
    ├── index.js                  # Tools 统一导出
    ├── checkEligibilityTool.js   # 责任判断 Tool
    ├── calculateAmountTool.js    # 金额计算 Tool
    ├── queryMedicalCatalogTool.js   # 医保目录查询 Tool
    └── queryHospitalInfoTool.js # 医院信息查询 Tool
```

---

## 审核流程图

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

## API 使用

### 1. 智能审核 (推荐)

**请求**:
```http
POST /api/ai/smart-review
Content-Type: application/json

{
  "claimCaseId": "CLM001",
  "productCode": "ZA-002",
  "ocrData": {
    "basicInfo": {
      "name": "张三",
      "dischargeDiagnosis": "急性阑尾炎"
    },
    "invoiceInfo": {
      "hospitalName": "北京协和医院",
      "issueDate": "2024-01-15"
    }
  },
  "invoiceItems": [
    {
      "itemName": "阑尾切除术",
      "category": "治疗费",
      "totalPrice": 5000
    },
    {
      "itemName": "阿莫西林",
      "category": "药品费",
      "totalPrice": 200
    }
  ],
  "engine": "graph"  // 可选: 'agent' | 'graph' | 'graph-checkpointer'
}
```

**响应**:
```json
{
  "decision": "APPROVE",
  "amount": 4680,
  "reasoning": "## 审核结论\n- **决定**: APPROVE\n- **理赔金额**: ¥4680\n\n...",
  "eligibility": {
    "eligible": true,
    "matchedRules": ["ELIG_001", "ELIG_002"],
    "rejectionReasons": [],
    "warnings": []
  },
  "calculation": {
    "totalClaimable": 5200,
    "deductible": 200,
    "reimbursementRatio": 0.9,
    "finalAmount": 4680,
    "itemBreakdown": [...]
  },
  "engine": "graph",
  "duration": 1234
}
```

---

### 2. 带状态持久化的审核

**请求**:
```http
POST /api/ai/smart-review
Content-Type: application/json

{
  "claimCaseId": "CLM001",
  "productCode": "ZA-002",
  "ocrData": {...},
  "invoiceItems": [...],
  "engine": "graph-checkpointer"  // 使用带状态持久化的版本
}
```

**响应** (如果是高风险，会中断):
```json
{
  "decision": "MANUAL_REVIEW",
  "amount": 4680,
  "interrupted": true,
  "humanReviewRequired": true,
  "threadId": "claim-CLM001-1705236800000",
  "reasoning": "## 审核结论\n- **决定**: MANUAL_REVIEW\n...",
  "eligibility": {...},
  "calculation": {...}
}
```

---

### 3. 获取审核状态

**请求**:
```http
GET /api/ai/review-state?claimCaseId=CLM001
```

**响应**:
```json
{
  "claimCaseId": "CLM001",
  "exists": true,
  "state": {
    "claimCaseId": "CLM001",
    "decision": "MANUAL_REVIEW",
    "humanReviewRequired": true,
    "calculation": {...}
  }
}
```

---

### 4. 提交人工审核结果

**请求**:
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

**响应**:
```json
{
  "decision": "APPROVE",
  "amount": 4680,
  "reasoning": "## 人工审核结果\n- **审核人**: 张审核员\n- **审核意见**: 已核实，同意赔付\n\n...",
  "humanReview": {
    "auditor": "张审核员",
    "comment": "已核实，同意赔付",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 5. 清除审核状态

**请求**:
```http
POST /api/ai/clear-state
Content-Type: application/json

{
  "claimCaseId": "CLM001"
}
```

---

## 环境变量

在 `.env.local` 中配置:

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

## 引擎选择建议

| 场景 | 推荐引擎 | 说明 |
|------|---------|------|
| **生产环境** | `graph-checkpointer` | 支持人工介入和状态恢复 |
| **开发测试** | `graph` | 简单无状态，调试方便 |
| **兼容旧系统** | `agent` | 保留旧实现作为回退 |

---

## 迁移步骤

### Step 1: 测试新引擎

```bash
# 启动服务
npm run dev

# 测试 API
curl -X POST http://localhost:8080/api/ai/smart-review \
  -H "Content-Type: application/json" \
  -d '{
    "claimCaseId": "TEST001",
    "productCode": "ZA-002",
    "engine": "graph"
  }'
```

### Step 2: 对比结果

同时测试 `engine=agent` 和 `engine=graph`，对比决策结果是否一致。

### Step 3: 切换默认引擎

```bash
# .env.local
AI_ENGINE=graph-checkpointer
```

### Step 4: 重启服务

```bash
npm run dev
```

---

## 调试

### 查看节点执行日志

响应中的 `debug` 字段包含节点执行追踪:

```json
{
  "debug": {
    "nodeExecutions": [
      {
        "node": "collect_documents",
        "timestamp": 1705236800000
      },
      {
        "node": "check_eligibility",
        "timestamp": 1705236800500,
        "duration": 300
      },
      {
        "node": "calculate_amount",
        "timestamp": 1705236801000,
        "duration": 200
      }
    ],
    "duration": 1234
  }
}
```

---

## 待改进

1. **持久化存储**: 当前使用内存存储，生产环境建议使用 Redis 或 PostgreSQL
2. **可观测性**: 集成 LangSmith 进行可视化调试
3. **测试**: 添加单元测试和集成测试
4. **监控**: 添加 Prometheus 指标

---

## 参考文档

- [LangGraph 文档](https://langchain-ai.github.io/langgraph/)
- [LangChain 文档](https://js.langchain.com/)
