# SmartClaim AI 意图识别使用说明

## 概述

SmartClaim AI 现在支持智能意图识别，能够自动识别用户的以下诉求：

1. **查询理赔进度** - 用户询问案件处理进度
2. **查询材料清单** - 用户询问需要准备什么材料
3. **查询缺失材料** - 用户询问还缺什么材料
4. **查询保费影响** - 用户关心理赔对保费的影响

## 技术实现

### 核心文件

| 文件 | 功能 |
|-----|------|
| `intentService.ts` | 意图识别服务，使用 Gemini Function Calling |
| `intentTools.ts` | 工具函数实现，处理各类意图的业务逻辑 |
| `types.ts` | 意图相关类型定义 |
| `geminiService.ts` | 集成意图识别的 AI 响应服务 |
| `App.tsx` | UI 组件渲染和意图响应处理 |

### 意图识别流程

```
用户输入
   ↓
[快速关键词检测] ← 轻量级，优先匹配
   ↓
[Gemini Function Calling] ← 高精度识别
   ↓
[工具执行器]
   ↓
[UI组件渲染]
   ↓
用户看到结果
```

## 支持的意图示例

### 1. 查询进度

**用户输入示例：**
- "我的理赔进度怎么样了？"
- "案件审核到哪一步了？"
- "还要多久能完成？"

**系统响应：**
- 显示理赔进度卡片
- 展示当前状态、进度百分比、时间线

### 2. 查询材料清单

**用户输入示例：**
- "理赔需要什么材料？"
- "我要准备哪些资料？"
- "车险理赔材料清单"

**系统响应：**
- 显示材料清单卡片
- 区分必需材料和补充材料
- 提供材料说明和示例

### 3. 查询缺失材料

**用户输入示例：**
- "我还需要补充什么材料？"
- "我的案子还差什么？"
- "还缺哪些材料没交？"

**系统响应：**
- 显示缺失材料提醒卡片
- 根据紧急程度显示不同颜色
- 显示补交截止时间

### 4. 查询保费影响

**用户输入示例：**
- "这次理赔会影响明年的保费吗？"
- "报了案明年保费会涨吗？"
- "NCD系数会怎么变？"

**系统响应：**
- 显示保费影响预估卡片
- 展示 NCD 系数变化
- 提供保费变化估算和建议

## 代码使用示例

### 在组件中使用

```typescript
import { smartChat } from './geminiService';

// 发送消息时自动进行意图识别
const handleSend = async (text: string) => {
  const { text, intentResult, toolResponse, usedIntentTool } = await smartChat(
    text,
    messages,
    claimState,
    { userLocation }
  );
  
  // 如果使用了意图工具，toolResponse 中包含特殊 UI 数据
  if (usedIntentTool) {
    // 渲染特殊 UI 组件
    renderUIComponent(toolResponse.uiComponent, toolResponse.uiData);
  }
};
```

### 手动识别意图

```typescript
import { recognizeIntent, executeIntentTool } from './intentService';

// 识别意图
const intentResult = await recognizeIntent(
  "我的理赔进度怎么样了？",
  conversationHistory,
  claimState
);

console.log(intentResult.intent); // "QUERY_PROGRESS"
console.log(intentResult.confidence); // 0.95

// 执行对应工具
const toolResponse = await executeIntentTool(intentResult, claimState);
```

### 快速意图检测

```typescript
import { quickIntentDetection } from './intentService';

// 轻量级关键词匹配，无需调用 AI
const intent = quickIntentDetection("还要多久能审核完？");
console.log(intent); // "QUERY_PROGRESS" 或 null
```

## 扩展新意图

如需添加新意图，按以下步骤：

### 1. 在 `types.ts` 中添加新意图类型

```typescript
export enum IntentType {
  // ... 现有意图
  QUERY_NEW_FEATURE = 'QUERY_NEW_FEATURE'
}
```

### 2. 在 `intentTools.ts` 中添加工具处理器

```typescript
async function handleQueryNewFeature(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  return {
    success: true,
    data: { /* ... */ },
    message: "处理结果消息",
    uiComponent: UIComponentType.NEW_COMPONENT,
    uiData: { /* ... */ }
  };
}

// 注册到工具注册表
const TOOL_REGISTRY: Record<IntentType, ToolHandler> = {
  // ... 现有工具
  [IntentType.QUERY_NEW_FEATURE]: handleQueryNewFeature
};
```

### 3. 在 `App.tsx` 中添加 UI 组件

```typescript
const NewComponentCard = ({ data }: { data: any }) => {
  return (
    <div className="...">
      {/* 组件内容 */}
    </div>
  );
};
```

### 4. 更新消息渲染逻辑

```typescript
{msg.uiComponent === UIComponentType.NEW_COMPONENT && (
  <NewComponentCard data={msg.uiData} />
)}
```

### 5. 更新意图识别 Prompt

在 `intentService.ts` 的 `INTENT_RECOGNITION_PROMPT` 中添加新意图的说明。

## 调试与监控

意图识别相关的操作日志会通过 `logUserOperation` 记录，包含：

- 识别到的意图类型
- 置信度
- 是否使用了意图工具
- 工具执行结果

在浏览器开发者工具中可以查看详细的日志信息。

## 注意事项

1. **置信度阈值**：低于 0.7 的意图会被降级为 GENERAL_CHAT
2. **降级策略**：意图识别出错时会自动降级为普通 AI 对话
3. **性能优化**：使用 `quickIntentDetection` 进行轻量级预过滤，减少不必要的 AI 调用
