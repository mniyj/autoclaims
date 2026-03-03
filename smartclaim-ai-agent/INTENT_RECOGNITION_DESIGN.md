# SmartClaim AI 意图识别与工具调用设计方案

## 1. 设计目标

为 SmartClaim AI 增加智能意图识别能力，使 AI 能够识别索赔人的多样化诉求并调用相应工具提供精准回复。

## 2. 支持的用户意图

### 核心意图分类

| 意图名称 | 触发关键词示例 | 对应工具 | 说明 |
|---------|--------------|---------|------|
| `QUERY_PROGRESS` | 进度、状态、进展、到哪了、多久了 | `getClaimProgress` | 查询理赔进度 |
| `QUERY_MATERIALS_LIST` | 需要什么材料、清单、都要什么、材料要求 | `getMaterialsList` | 查询理赔材料清单 |
| `QUERY_MISSING_MATERIALS` | 还缺什么、补充什么、差什么、哪些没交 | `getMissingMaterials` | 查询当前案件还缺什么材料 |
| `QUERY_PREMIUM_IMPACT` | 保费、涨价、下年、NCD、无赔款优待、影响 | `getPremiumImpact` | 查询理赔对未来保费的影响 |
| `GENERAL_CHAT` | 其他所有对话 | `generalChat` | 普通闲聊/通用问答 |

## 3. 技术方案

### 3.1 架构选择

采用 **"LLM Function Calling + 前端状态机"** 混合方案：

```
用户输入
   ↓
[意图识别服务] --Gemini Function Calling--> 识别意图 + 提取参数
   ↓
[工具执行器] 调用对应工具函数
   ↓
[响应生成器] 生成自然语言回复
   ↓
用户界面展示
```

### 3.2 意图识别实现方式

使用 Google Gemini 的 Function Calling 能力：

```typescript
// 定义意图识别工具
const intentRecognitionTool = {
  name: 'recognize_intent',
  parameters: {
    intent: 'enum(QUERY_PROGRESS|QUERY_MATERIALS_LIST|QUERY_MISSING_MATERIALS|QUERY_PREMIUM_IMPACT|GENERAL_CHAT)',
    confidence: 'number(0-1)',
    entities: {
      claimId: 'string?',
      policyId: 'string?',
      claimType: 'string?'
    }
  }
}
```

### 3.3 与现有架构集成

1. **新增模块**:
   - `intentService.ts` - 意图识别服务
   - `intentTools.ts` - 工具函数定义和执行

2. **修改模块**:
   - `geminiService.ts` - 增加意图识别调用
   - `App.tsx` - 处理工具调用结果并渲染特殊 UI
   - `types.ts` - 增加意图相关类型

## 4. 详细设计

### 4.1 意图识别 Prompt

```
你是保险理赔客服智能助手，负责识别用户的意图。

可识别的意图类型：
1. QUERY_PROGRESS - 用户想查询理赔案件的进度/状态
2. QUERY_MATERIALS_LIST - 用户想了解理赔需要什么材料
3. QUERY_MISSING_MATERIALS - 用户想知道还缺什么材料没提交
4. QUERY_PREMIUM_IMPACT - 用户关心理赔是否会影响未来保费
5. GENERAL_CHAT - 其他普通对话

请分析用户输入，识别意图并提取相关实体（案件号、保单号等）。
如果置信度低于 0.7，归类为 GENERAL_CHAT。
```

### 4.2 工具函数定义

```typescript
// 查询进度
interface GetClaimProgressParams {
  claimId?: string;  // 可选，如未提供使用当前活跃案件
}

// 查询材料清单
interface GetMaterialsListParams {
  claimType?: string;  // 理赔类型：医疗/车险/意外险等
  productCode?: string;
}

// 查询缺失材料
interface GetMissingMaterialsParams {
  claimId?: string;
}

// 查询保费影响
interface GetPremiumImpactParams {
  claimType?: string;
  claimAmount?: number;
  policyType?: string;
}
```

### 4.3 响应格式

每个工具返回统一格式：

```typescript
interface ToolResponse {
  success: boolean;
  data: any;           // 工具返回的数据
  message: string;     // 给用户的自然语言回复
  uiComponent?: string; // 可选：需要渲染的特殊 UI 组件
}
```

### 4.4 UI 集成

针对特定意图返回特殊 UI：

| 意图 | UI 组件 |
|-----|--------|
| QUERY_PROGRESS | `<ClaimProgressCard claim={...} />` |
| QUERY_MATERIALS_LIST | `<MaterialsChecklist materials={...} />` |
| QUERY_MISSING_MATERIALS | `<MissingMaterialsAlert items={...} />` |
| QUERY_PREMIUM_IMPACT | `<PremiumImpactInfo impact={...} />` |

## 5. 实现步骤

1. 创建 `intentService.ts` - 意图识别核心服务
2. 创建 `intentTools.ts` - 工具函数实现
3. 扩展 `types.ts` - 添加意图相关类型
4. 修改 `geminiService.ts` - 集成意图识别
5. 修改 `App.tsx` - 处理工具调用结果
6. 测试各意图场景

## 6. 边界情况处理

1. **无活跃案件时查询进度**: 提示用户选择案件或先报案
2. **无法识别意图**: 降级为普通聊天
3. **工具执行失败**: 返回友好错误提示，提供人工客服入口
4. **多意图情况**: 取置信度最高的意图，或询问用户确认
5. **上下文继承**: 在多轮对话中保持当前意图上下文

## 7. 扩展性设计

预留扩展接口，方便后续添加新意图：

```typescript
// intentService.ts
const INTENT_REGISTRY: Record<string, IntentConfig> = {
  [IntentType.QUERY_PROGRESS]: {
    handler: handleQueryProgress,
    requiredParams: [],
    optionalParams: ['claimId']
  },
  // 未来可轻松添加新意图
  [IntentType.NEW_INTENT]: {
    handler: handleNewIntent,
    requiredParams: ['param1']
  }
};
```
