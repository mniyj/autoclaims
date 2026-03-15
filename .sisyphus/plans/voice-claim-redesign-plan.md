# 语音报案系统改造 - 详细实施计划

## 📋 任务总览

| 阶段 | 任务数 | 预估工时 |
|------|--------|----------|
| 阶段1: 基础设施 | 4 | 4h |
| 阶段2: 意图系统 | 3 | 6h |
| 阶段3: 工具开发 | 3 | 5h |
| 阶段4: 核心改造 | 2 | 6h |
| 阶段5: 测试优化 | 2 | 4h |
| **总计** | **14** | **25h** |

---

## 阶段1: 基础设施（前置条件）

### 任务1.1: 创建 intents 目录结构
**文件**: 新建目录 `server/voice/intents/`
**依赖**: 无
**工时**: 0.5h
**步骤**:
1. 创建目录 `server/voice/intents/`
2. 创建空文件占位：
   - `IntentTypes.ts`
   - `IntentRecognizer.ts`
   - `IntentHandlerRegistry.ts`
   - `index.ts` (导出)

**验收标准**:
- [ ] 目录结构创建成功
- [ ] TypeScript 编译无错误

---

### 任务1.2: 定义意图类型系统
**文件**: `server/voice/intents/IntentTypes.ts` (新建)
**依赖**: 任务1.1
**工时**: 1h
**步骤**:
1. 定义 `IntentType` 枚举（15+ 意图类型）
2. 定义 `Intent` 接口
3. 定义意图实体类型

**核心代码**:
```typescript
export enum IntentType {
  CANCEL = 'cancel',
  CONFIRM = 'confirm',
  REJECT = 'reject',
  SELECT_POLICY = 'select_policy',
  PROVIDE_INFO = 'provide_info',
  MODIFY_INFO = 'modify_info',
  // ... 更多
}

export interface Intent {
  type: IntentType;
  confidence: number;
  entities?: Record<string, any>;
  originalText: string;
}
```

**验收标准**:
- [ ] 所有意图类型定义完整
- [ ] 类型导出正确
- [ ] 其他文件可正常导入

---

### 任务1.3: 创建会话上下文管理
**文件**: `server/voice/state/VoiceSessionContext.ts` (新建)
**依赖**: 任务1.2
**工时**: 1.5h
**步骤**:
1. 定义 `VoiceSessionContext` 类
2. 实现状态管理方法
3. 实现数据存储方法
4. 实现取消确认状态管理

**核心方法**:
- `setState(state: string)` - 设置当前状态
- `getCurrentState()` - 获取当前状态
- `setAvailablePolicies(policies: any[])` - 设置可选保单
- `setSelectedPolicy(policy: any)` - 设置选中保单
- `setIntakeConfig(config: any)` - 设置报案配置
- `updateField(fieldId: string, value: any)` - 更新字段值
- `markFieldForModification(fieldId: string)` - 标记修改字段
- `setCancelPending(pending: boolean)` - 设置取消待确认
- `isCancelPending()` - 检查是否取消待确认
- `clearAll()` - 清空所有数据

**验收标准**:
- [ ] 所有状态管理方法正常工作
- [ ] 数据持久化在会话期间有效
- [ ] 取消确认状态正确维护

---

### 任务1.4: 创建意图识别器
**文件**: `server/voice/intents/IntentRecognizer.ts` (新建)
**依赖**: 任务1.2
**工时**: 2h
**步骤**:
1. 创建 `IntentRecognizer` 类
2. 实现 AI 意图识别方法
3. 编写意图识别 prompt
4. 实现实体提取逻辑

**核心代码结构**:
```typescript
export class IntentRecognizer {
  private genAI: GoogleGenAI;
  
  async recognize(text: string, context: VoiceSessionContext): Promise<Intent> {
    const prompt = this.buildPrompt(text, context);
    const response = await this.callGemini(prompt);
    return this.parseResponse(response);
  }
  
  private buildPrompt(text: string, context: VoiceSessionContext): string {
    return `你是意图识别专家...
当前状态: ${context.getCurrentState()}
用户话语: "${text}"
...`;
  }
}
```

**验收标准**:
- [ ] 能正确识别 CANCEL 意图
- [ ] 能正确识别 CONFIRM/REJECT 意图
- [ ] 能正确识别 SELECT_POLICY 并提取序号
- [ ] 能正确识别 PROVIDE_INFO 并提取实体
- [ ] 能正确识别 MODIFY_INFO 并提取字段

---

## 阶段2: 意图系统（核心逻辑）

### 任务2.1: 创建意图处理器注册表
**文件**: `server/voice/intents/IntentHandlerRegistry.ts` (新建)
**依赖**: 任务1.2, 1.3
**工时**: 2.5h
**步骤**:
1. 定义 `IntentHandler` 类型
2. 创建 `IntentHandlerRegistry` 类
3. 实现处理器注册方法
4. 实现分发处理方法

**核心代码**:
```typescript
export type IntentHandler = (
  intent: Intent,
  context: VoiceSessionContext
) => Promise<IntentHandlerResult>;

export interface IntentHandlerResult {
  success: boolean;
  response: string;
  shouldTerminate?: boolean;
  newState?: string;
  actions?: Array<{ type: string; payload: any }>;
}

export class IntentHandlerRegistry {
  private handlers: Map<IntentType, IntentHandler> = new Map();
  
  register(intentType: IntentType, handler: IntentHandler): void {
    this.handlers.set(intentType, handler);
  }
  
  async handle(intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const handler = this.handlers.get(intent.type);
    return handler ? handler(intent, context) : this.defaultHandler(intent, context);
  }
}
```

**验收标准**:
- [ ] 处理器注册正常
- [ ] 意图分发正确
- [ ] 默认处理器兜底

---

### 任务2.2: 实现所有意图处理器
**文件**: `server/voice/intents/IntentHandlerRegistry.ts` (修改)
**依赖**: 任务2.1
**工时**: 3h
**步骤**:
实现以下意图处理器：

1. **CANCEL 处理器**（含防误触）
   - 检查当前状态
   - 关键状态需二次确认
   - 终止所有进行中的操作

2. **CONFIRM 处理器**
   - `CONFIRMING_POLICY` → `COLLECTING_FIELDS`
   - `CONFIRMING_SUBMISSION` → 提交
   - `CONFIRMING_CANCEL` → 结束

3. **REJECT 处理器**
   - `CONFIRMING_POLICY` → 返回选择
   - `CONFIRMING_SUBMISSION` → 返回修改

4. **SELECT_POLICY 处理器**
   - 解析保单序号
   - 验证有效性
   - 设置选中保单

5. **PROVIDE_INFO 处理器**
   - 提取所有字段
   - 检查缺失字段
   - 生成下一个问题

6. **MODIFY_INFO 处理器**
   - 识别要修改的字段
   - 更新字段值
   - 刷新摘要

**验收标准**:
- [ ] CANCEL 在关键状态需二次确认
- [ ] CONFIRM 在不同状态行为正确
- [ ] SELECT_POLICY 正确解析序号
- [ ] PROVIDE_INFO 正确提取多个字段
- [ ] MODIFY_INFO 支持字段修改

---

### 任务2.3: 创建 intents 模块导出
**文件**: `server/voice/intents/index.ts` (新建)
**依赖**: 任务1.2, 1.4, 2.1, 2.2
**工时**: 0.5h
**步骤**:
1. 导出所有类型
2. 导出识别器
3. 导出注册表

```typescript
export * from './IntentTypes.js';
export { IntentRecognizer } from './IntentRecognizer.js';
export { IntentHandlerRegistry } from './IntentHandlerRegistry.js';
```

**验收标准**:
- [ ] 外部可正常导入

---

## 阶段3: 工具开发（API接口）

### 任务3.1: 创建 listUserPolicies 工具
**文件**: `server/voice/tools/listUserPolicies.ts` (新建)
**依赖**: 无
**工时**: 1.5h
**步骤**:
1. 导入必要的依赖
2. 定义输入 schema
3. 实现 handler 逻辑
4. 格式化保单列表响应

**核心逻辑**:
```typescript
export const listUserPoliciesTool = {
  name: 'listUserPolicies',
  description: '查询当前用户的所有有效保单',
  inputSchema: z.object({}), // 已鉴权，无需参数
  
  handler: async (_params: any, context: { userId: string }) => {
    const policies = await readData('policies') || [];
    const userPolicies = policies.filter(p => 
      p.policyholder?.id === context.userId && p.status === 'ACTIVE'
    );
    
    return {
      success: true,
      data: userPolicies.map((p, index) => ({
        index: index + 1,
        policyNumber: p.policyNumber,
        productCode: p.productCode,
        productName: p.productName,
        insuredName: p.insureds?.[0]?.name,
        effectiveDate: p.effectiveDate,
      })),
      message: `找到${userPolicies.length}张有效保单`
    };
  }
};
```

**验收标准**:
- [ ] 能正确查询用户保单
- [ ] 返回格式符合语音播报要求
- [ ] 包含序号、产品名、被保人、生效日期

---

### 任务3.2: 创建 getProductIntakeConfig 工具
**文件**: `server/voice/tools/getProductIntakeConfig.ts` (新建)
**依赖**: 无
**工时**: 1.5h
**步骤**:
1. 定义输入 schema（productCode）
2. 查询产品配置
3. 提取 intakeConfig
4. 过滤 voice_slot_enabled 字段

**验收标准**:
- [ ] 能正确获取产品配置
- [ ] 返回所有语音字段
- [ ] 包含字段类型、标签、是否必填、选项

---

### 任务3.3: 注册新工具并改造 submitClaim
**文件**: `server/voice/tools/index.ts` (修改)
**依赖**: 任务3.1, 3.2
**工时**: 1h
**步骤**:
1. 导入 listUserPoliciesTool
2. 导入 getProductIntakeConfigTool
3. 在 initializeTools 中注册新工具
4. 改造 submitClaim 支持动态字段

**submitClaim 改造要点**:
```typescript
inputSchema: z.object({
  policyNumber: z.string(),
  productCode: z.string(),
  fieldData: z.record(z.any()) // 动态字段
})
```

**验收标准**:
- [ ] 新工具注册成功
- [ ] submitClaim 支持动态字段提交
- [ ] 工具调用正常

---

## 阶段4: 核心改造（VoiceSession）

### 任务4.1: 改造 VoiceSession 为意图驱动
**文件**: `server/voice/VoiceSession.ts` (重大修改)
**依赖**: 任务1.3, 1.4, 2.3, 3.3
**工时**: 4h
**步骤**:
1. 导入意图系统
2. 添加 IntentRecognizer 实例
3. 添加 IntentHandlerRegistry 实例
4. 添加 VoiceSessionContext 实例
5. 改造 handleTextMessage 方法
6. 实现 executeAction 方法
7. 添加操作取消支持（AbortController）

**关键改造点**:
```typescript
export class VoiceSession {
  private intentRecognizer: IntentRecognizer;
  private intentRegistry: IntentHandlerRegistry;
  private sessionContext: VoiceSessionContext;
  private ongoingOperation: AbortController | null = null;
  
  private async handleTextMessage(payload: any): Promise<void> {
    // 1. 识别意图
    const intent = await this.intentRecognizer.recognize(text, this.sessionContext);
    
    // 2. 检查取消
    if (intent.type === 'cancel' && this.ongoingOperation) {
      this.ongoingOperation.abort();
    }
    
    // 3. 处理意图
    const result = await this.intentRegistry.handle(intent, this.sessionContext);
    
    // 4. 检查终止
    if (result.shouldTerminate) {
      await this.endSession();
      return;
    }
    
    // 5. 执行动作
    for (const action of result.actions || []) {
      await this.executeAction(action);
    }
    
    // 6. 更新状态并响应
    this.sessionContext.setState(result.newState);
    await this.sendResponse(result.response);
  }
}
```

**验收标准**:
- [ ] 能正常启动对话
- [ ] 能识别用户意图
- [ ] 能正确流转状态
- [ ] 取消操作能立即终止

---

### 任务4.2: 更新 VoicePipeline Prompt
**文件**: `server/voice/VoicePipeline.ts` (修改)
**依赖**: 无
**工时**: 1h
**步骤**:
1. 更新 system prompt 支持意图驱动流程
2. 添加报案流程说明
3. 添加保单选择引导

**Prompt 要点**:
```typescript
const systemPrompt = `你是智能理赔助手。

工作流程：
1. 查询保单 → 播报列表 → 用户选择 → 确认
2. 获取配置 → 收集信息 → 确认提交

规则：
- 每次只问一个问题
- 支持用户说"第X张"选择保单
- 支持自然描述一次性提供多个信息
- 支持用户说"改一下XX"修改信息
- 取消需要二次确认`;
```

**验收标准**:
- [ ] Prompt 引导正确
- [ ] AI 回复符合流程要求

---

### 任务4.3: 添加智能槽位提取
**文件**: `server/voice/state/SmartSlotExtractor.ts` (新建)
**依赖**: 任务4.1
**工时**: 1h
**步骤**:
1. 创建 SmartSlotExtractor 类
2. 实现 extractAllFields 方法
3. 实现各类型字段提取逻辑
4. 集成到 VoiceSession

**验收标准**:
- [ ] 能从自然描述中提取多个字段
- [ ] 日期、金额、医院等类型识别准确

---

## 阶段5: 测试优化

### 任务5.1: 单元测试
**文件**: 新增测试文件
**依赖**: 所有开发任务
**工时**: 2h
**步骤**:
1. 测试 IntentRecognizer
2. 测试各意图处理器
3. 测试工具函数

**测试用例**:
- [ ] "取消" → CANCEL 意图
- [ ] "对的" → CONFIRM 意图
- [ ] "第2张" → SELECT_POLICY {index: 2}
- [ ] "昨天急性阑尾炎" → PROVIDE_INFO + 提取日期、原因
- [ ] "改一下时间" → MODIFY_INFO {field: 'accident_date'}

---

### 任务5.2: 集成测试
**文件**: 手动测试
**依赖**: 任务5.1
**工时**: 2h
**步骤**:
1. 完整流程测试
2. 异常流程测试
3. 取消流程测试
4. 修改信息测试

**测试场景**:
1. 正常报案流程
2. 选择保单后取消
3. 收集信息时取消
4. 提交前修改信息
5. 连续修改多个字段

---

## 依赖关系图

```
阶段1: 基础设施
├── 1.1 创建目录结构
├── 1.2 定义意图类型 ─────┐
├── 1.3 会话上下文 ───────┼──┐
└── 1.4 意图识别器 ───────┘  │
                            │
阶段2: 意图系统             │
├── 2.1 处理器注册表 ───────┘
├── 2.2 实现处理器 ─────────┐
└── 2.3 模块导出 ───────────┼──┐
                            │  │
阶段3: 工具开发             │  │
├── 3.1 listUserPolicies ───┘  │
├── 3.2 getIntakeConfig ───────┤
└── 3.3 注册工具 ──────────────┤
                               │
阶段4: 核心改造                │
├── 4.1 改造 VoiceSession ─────┘
├── 4.2 更新 Prompt
└── 4.3 智能提取

阶段5: 测试
└── 5.1, 5.2 测试
```

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| AI意图识别不准确 | 中 | 高 | 准备规则兜底，优化prompt |
| 取消操作不及时 | 低 | 高 | 使用AbortController，充分测试 |
| 多轮状态混乱 | 中 | 中 | 完善状态机，增加边界检查 |
| 动态字段提取失败 | 中 | 中 | 准备默认处理，引导用户重新描述 |

---

## 实施建议

1. **分阶段开发**：按阶段1→5顺序开发，每个阶段完成后再进入下一阶段
2. **频繁测试**：每完成一个任务就进行测试
3. **保持向后兼容**：确保不影响现有语音功能
4. **准备回滚**：保留原VoiceSession备份
