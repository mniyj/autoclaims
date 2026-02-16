# AI 多提供商测试系统

## 功能

1. **多 AI 提供商支持** - 轻松切换 Gemini、Claude 等 AI
2. **A/B 测试模式** - 同时调用多个 AI，对比结果
3. **指标记录** - 自动记录耗时、成本、token 使用量
4. **人工评分** - 对 AI 输出进行准确性评分
5. **统计分析** - 查看各 AI 的性能对比

## 快速开始

### 1. 初始化配置

```typescript
import { aiService, aiConfigManager } from './services/ai/aiService';
import { GeminiProvider } from './services/ai/providers/geminiProvider';
import { ClaudeProvider } from './services/ai/providers/claudeProvider';

// 注册 Provider
aiService.registerProvider(new GeminiProvider());
aiService.registerProvider(new ClaudeProvider());

// 配置 API Keys
aiConfigManager.setProviderConfig({
  name: 'gemini',
  apiKey: 'your-gemini-api-key',
  model: 'gemini-2.5-flash',
});

aiConfigManager.setProviderConfig({
  name: 'claude',
  apiKey: 'your-claude-api-key',
  model: 'claude-3-sonnet-20250219',
});

// 设置默认 Provider
aiConfigManager.setCurrentProvider('gemini');
```

### 2. 基础调用

```typescript
// 使用当前默认 Provider
const { result, records } = await aiService.invoke(
  'ocr',  // 任务类型
  '识别这张发票...',  // prompt
  {
    parseOutput: (content) => JSON.parse(content)  // 自定义解析
  }
);

console.log('结果:', result);
console.log('耗时:', records[0].metrics.latency, 'ms');
console.log('成本:', records[0].metrics.cost, 'USD');
```

### 3. A/B 测试模式

```typescript
// 同时调用多个 AI 进行对比
const { result, records, comparison } = await aiService.invoke(
  'ocr',
  '识别这张发票...',
  {
    compareWith: ['claude'],  // 同时调用 Claude 对比
    parseOutput: (content) => JSON.parse(content)
  }
);

// comparison 包含对比信息
console.log('对比结果:', comparison);
// {
//   providers: [
//     { provider: 'gemini', latency: 1200, cost: 0.001, success: true },
//     { provider: 'claude', latency: 2100, cost: 0.015, success: true }
//   ]
// }
```

### 4. 人工评分

```typescript
import { aiInvocationStore } from './services/ai/aiService';

// 对某次调用进行准确性评分（1-5分）
aiInvocationStore.updateAccuracy(recordId, 4, '发票金额识别准确，但日期格式有误');
```

### 5. 查看统计

```typescript
const stats = aiInvocationStore.getStats();

console.log('总调用次数:', stats.totalCalls);
console.log('Gemini 平均耗时:', stats.byProvider.gemini?.avgLatency);
console.log('Claude 平均成本:', stats.byProvider.claude?.avgCost);
console.log('OCR 任务平均准确性:', stats.byTask.ocr?.avgAccuracy);
```

### 6. 导出数据

```typescript
// 导出 CSV 用于分析
const csv = aiInvocationStore.exportToCSV();
// 下载 csv 文件...
```

## 使用测试面板

```typescript
import { AITestPanel } from './services/ai/AITestPanel';

// 在组件中使用
const [showPanel, setShowPanel] = useState(false);

return (
  <>
    <button onClick={() => setShowPanel(true)}>
      打开 AI 测试面板
    </button>
    
    {showPanel && (
      <AITestPanel onClose={() => setShowPanel(false)} />
    )}
  </>
);
```

测试面板功能：
- **配置**: 设置 API Keys、选择 Provider、启用 A/B 测试
- **测试**: 输入 Prompt 运行测试，查看对比结果
- **记录**: 查看历史调用记录，人工评分
- **统计**: 查看各 AI 的性能对比图表

## 添加新的 AI Provider

```typescript
import { AIProvider, AIProviderConfig } from './aiService';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  readonly model: string;

  constructor(model: string = 'gpt-4') {
    this.model = model;
  }

  async invoke(prompt: string, config?: AIProviderConfig): Promise<{ content: string; usage: any }> {
    // 实现 API 调用
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config?.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    
    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: data.usage,
    };
  }

  calculateCost(inputTokens: number, outputTokens: number): number {
    // OpenAI GPT-4 pricing
    const inputCost = (inputTokens / 1_000_000) * 30;
    const outputCost = (outputTokens / 1_000_000) * 60;
    return inputCost + outputCost;
  }

  extractUsage(response: any): { inputTokens: number; outputTokens: number } {
    return {
      inputTokens: response.prompt_tokens || 0,
      outputTokens: response.completion_tokens || 0,
    };
  }
}

// 注册
aiService.registerProvider(new OpenAIProvider());
```

## 数据结构

### AIInvocationRecord

```typescript
{
  id: string;                    // 调用 ID
  timestamp: number;             // 时间戳
  provider: 'gemini' | 'claude'; // AI 提供商
  model: string;                 // 模型名称
  task: string;                  // 任务类型 (ocr/chat/audit)
  input: string;                 // 输入摘要
  output: any;                   // 输出结果
  metrics: {
    latency: number;            // 耗时 (ms)
    inputTokens: number;        // 输入 token 数
    outputTokens: number;       // 输出 token 数
    cost: number;               // 成本 (USD)
    success: boolean;           // 是否成功
  };
  accuracy?: number;            // 人工评分 (1-5)
  notes?: string;               // 备注
}
```

## 成本参考

| Provider | Model | Input | Output |
|----------|-------|-------|--------|
| Gemini | 2.5 Flash | $0.15/M | $0.60/M |
| Claude | 3 Sonnet | $3.00/M | $15.00/M |
| Claude | 3.5 Sonnet | $3.00/M | $15.00/M |
| GPT-4 | Turbo | $10.00/M | $30.00/M |

*价格仅供参考，以官方最新定价为准*

## 注意事项

1. **API Keys** 存储在 localStorage，生产环境建议改用后端存储
2. 记录默认保留最近 1000 条，导出 CSV 可永久保存
3. A/B 测试会同时调用多个 AI，成本会累加
4. 准确性评分需要人工参与，用于评估 AI 效果
