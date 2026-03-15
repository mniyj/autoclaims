# 语音报案系统 - 意图驱动架构设计

## 核心架构

### 1. 意图类型定义

```typescript
// server/voice/intents/IntentTypes.ts

export enum IntentType {
  // 流程控制意图
  START_CLAIM = 'start_claim',           // 开始报案
  CANCEL = 'cancel',                     // 取消/退出
  CONFIRM = 'confirm',                   // 确认
  REJECT = 'reject',                     // 拒绝/不对
  REPEAT = 'repeat',                     // 重复/再说一遍
  
  // 保单选择意图
  SELECT_POLICY = 'select_policy',       // 选择保单
  QUERY_POLICIES = 'query_policies',     // 查询保单
  
  // 信息提供意图
  PROVIDE_INFO = 'provide_info',         // 提供信息（通用）
  PROVIDE_DATE = 'provide_date',         // 提供日期
  PROVIDE_AMOUNT = 'provide_amount',     // 提供金额
  PROVIDE_HOSPITAL = 'provide_hospital', // 提供医院
  
  // 询问意图
  ASK_HELP = 'ask_help',                 // 寻求帮助
  ASK_EXAMPLE = 'ask_example',           // 询问示例
  
  // 其他
  UNKNOWN = 'unknown',                   // 未知意图
  GREETING = 'greeting',                 // 问候
  SMALL_TALK = 'small_talk',             // 闲聊
}

export interface Intent {
  type: IntentType;
  confidence: number;
  entities?: Record<string, any>;  // 提取的实体
  originalText: string;
}
```

### 2. 意图识别器

```typescript
// server/voice/intents/IntentRecognizer.ts

import { Intent, IntentType } from './IntentTypes.js';

export class IntentRecognizer {
  private context: any;
  
  constructor(context: any) {
    this.context = context;
  }
  
  /**
   * 识别用户意图
   */
  recognize(text: string): Intent {
    const normalizedText = text.toLowerCase().trim();
    
    // 1. 首先检查取消意图（最高优先级）
    const cancelIntent = this.checkCancelIntent(normalizedText);
    if (cancelIntent) return cancelIntent;
    
    // 2. 检查确认/拒绝意图
    const confirmIntent = this.checkConfirmIntent(normalizedText);
    if (confirmIntent) return confirmIntent;
    
    // 3. 检查流程控制意图
    const flowIntent = this.checkFlowIntent(normalizedText);
    if (flowIntent) return flowIntent;
    
    // 4. 检查保单选择意图
    const policyIntent = this.checkPolicySelectionIntent(normalizedText);
    if (policyIntent) return policyIntent;
    
    // 5. 检查信息提供意图
    const infoIntent = this.checkInfoProvisionIntent(normalizedText);
    if (infoIntent) return infoIntent;
    
    // 6. 其他意图
    const otherIntent = this.checkOtherIntents(normalizedText);
    if (otherIntent) return otherIntent;
    
    // 默认返回未知意图
    return {
      type: IntentType.UNKNOWN,
      confidence: 0.5,
      originalText: text
    };
  }
  
  /**
   * 检查取消意图（最高优先级）
   */
  private checkCancelIntent(text: string): Intent | null {
    const cancelPatterns = [
      /^(?:不|不用|算了|取消|退出|结束|停止|别).*(?:报|做|弄|搞|搞了)/,
      /^(?:取消|退出|结束|停止|不报了|不弄了|算了|拜拜|再见|bye)/i,
      /.*(?:不想|不要|不用|别).*(?:报案|报|做了|继续)/,
      /.*(?:退出|结束|停止).*(?:对话|流程|报案)/,
      /^退出$/,
      /^取消$/,
      /^结束$/,
      /^算了$/,
    ];
    
    for (const pattern of cancelPatterns) {
      if (pattern.test(text)) {
        return {
          type: IntentType.CANCEL,
          confidence: 0.95,
          originalText: text
        };
      }
    }
    return null;
  }
  
  /**
   * 检查确认/拒绝意图
   */
  private checkConfirmIntent(text: string): Intent | null {
    // 确认意图
    const confirmPatterns = [
      /^(?:对|是的|没错|正确|确认|好|好的|行|可以|嗯|恩)/,
      /^(?:是|yes|yep|yeah|ok|okay|对的)/i,
      /.*(?:没错|对的|正确|确认|没问题|可以).*/,
    ];
    
    for (const pattern of confirmPatterns) {
      if (pattern.test(text)) {
        return {
          type: IntentType.CONFIRM,
          confidence: 0.9,
          originalText: text
        };
      }
    }
    
    // 拒绝意图
    const rejectPatterns = [
      /^(?:不对|不是|错误|错了|否|no|nop)/i,
      /.*(?:不对|不是|错了|不正确).*/,
    ];
    
    for (const pattern of rejectPatterns) {
      if (pattern.test(text)) {
        return {
          type: IntentType.REJECT,
          confidence: 0.9,
          originalText: text
        };
      }
    }
    
    return null;
  }
  
  /**
   * 检查流程控制意图
   */
  private checkFlowIntent(text: string): Intent | null {
    // 开始报案
    const startPatterns = [
      /^(?:我要|我想|帮我|需要).*(?:报案|理赔|申请)/,
      /^(?:报案|理赔|申请).*/,
      /.*(?:出险|出事|住院|生病|受伤|意外).*/,
    ];
    
    for (const pattern of startPatterns) {
      if (pattern.test(text)) {
        return {
          type: IntentType.START_CLAIM,
          confidence: 0.9,
          originalText: text
        };
      }
    }
    
    // 重复
    const repeatPatterns = [
      /^(?:重复|再说|没听清|没听懂|请再说|重复一遍)/,
      /.*(?:再说一遍|重复一下|没听清).*/,
    ];
    
    for (const pattern of repeatPatterns) {
      if (pattern.test(text)) {
        return {
          type: IntentType.REPEAT,
          confidence: 0.9,
          originalText: text
        };
      }
    }
    
    return null;
  }
  
  /**
   * 检查保单选择意图
   */
  private checkPolicySelectionIntent(text: string): Intent | null {
    // 选择第X张
    const indexMatch = text.match(/(?:第|选择|选|要)([一二三四五12345])/);
    if (indexMatch) {
      const numMap: Record<string, number> = {
        '一': 1, '1': 1,
        '二': 2, '2': 2,
        '三': 3, '3': 3,
        '四': 4, '4': 4,
        '五': 5, '5': 5,
      };
      return {
        type: IntentType.SELECT_POLICY,
        confidence: 0.95,
        entities: { index: numMap[indexMatch[1]] },
        originalText: text
      };
    }
    
    // 查询保单
    const queryPatterns = [
      /^(?:查询|查看|有什么|有哪些).*(?:保单|保险)/,
      /.*(?:我有什么|有哪些).*(?:保单|保险)/,
    ];
    
    for (const pattern of queryPatterns) {
      if (pattern.test(text)) {
        return {
          type: IntentType.QUERY_POLICIES,
          confidence: 0.9,
          originalText: text
        };
      }
    }
    
    return null;
  }
  
  /**
   * 检查信息提供意图
   */
  private checkInfoProvisionIntent(text: string): Intent | null {
    // 包含日期信息
    const datePatterns = [
      /(?:今天|昨天|前天|明天|上周|上月)/,
      /\d{4}[年/-]\d{1,2}[月/-]\d{1,2}/,
      /\d{1,2}月\d{1,2}[日号]/,
    ];
    
    for (const pattern of datePatterns) {
      if (pattern.test(text)) {
        return {
          type: IntentType.PROVIDE_DATE,
          confidence: 0.85,
          entities: { date: this.extractDate(text) },
          originalText: text
        };
      }
    }
    
    // 包含金额信息
    const amountPatterns = [
      /\d+(?:\.\d+)?\s*(?:万|w|元|块|人民币)/i,
      /(?:大概|大约|估计|预估)?\s*(\d+)\s*(?:左右|大概|大约)?/,
    ];
    
    for (const pattern of amountPatterns) {
      if (pattern.test(text)) {
        return {
          type: IntentType.PROVIDE_AMOUNT,
          confidence: 0.85,
          entities: { amount: this.extractAmount(text) },
          originalText: text
        };
      }
    }
    
    // 包含医院信息
    const hospitalPatterns = [
      /[\u4e00-\u9fa5]+(?:医院|诊所|卫生院|医疗中心)/,
    ];
    
    for (const pattern of hospitalPatterns) {
      if (pattern.test(text)) {
        return {
          type: IntentType.PROVIDE_HOSPITAL,
          confidence: 0.85,
          entities: { hospital: this.extractHospital(text) },
          originalText: text
        };
      }
    }
    
    // 通用信息提供
    return {
      type: IntentType.PROVIDE_INFO,
      confidence: 0.7,
      originalText: text
    };
  }
  
  /**
   * 检查其他意图
   */
  private checkOtherIntents(text: string): Intent | null {
    // 问候
    const greetingPatterns = [
      /^(?:你好|您好|hi|hello|hey)/i,
    ];
    
    for (const pattern of greetingPatterns) {
      if (pattern.test(text)) {
        return {
          type: IntentType.GREETING,
          confidence: 0.9,
          originalText: text
        };
      }
    }
    
    // 寻求帮助
    const helpPatterns = [
      /^(?:帮助|help|怎么办|怎么做|教教我)/i,
      /.*(?:帮我|教我怎么|不会).*/,
    ];
    
    for (const pattern of helpPatterns) {
      if (pattern.test(text)) {
        return {
          type: IntentType.ASK_HELP,
          confidence: 0.9,
          originalText: text
        };
      }
    }
    
    return null;
  }
  
  // 辅助提取方法
  private extractDate(text: string): string | null {
    // 实现日期提取逻辑
    return null;
  }
  
  private extractAmount(text: string): number | null {
    // 实现金额提取逻辑
    return null;
  }
  
  private extractHospital(text: string): string | null {
    // 实现医院提取逻辑
    return null;
  }
}
```

### 3. 意图处理器注册表

```typescript
// server/voice/intents/IntentHandlerRegistry.ts

import { Intent, IntentType } from './IntentTypes.js';
import { VoiceSessionContext } from '../state/VoiceSessionContext.js';

export type IntentHandler = (
  intent: Intent,
  context: VoiceSessionContext
) => Promise<IntentHandlerResult>;

export interface IntentHandlerResult {
  success: boolean;
  response: string;
  shouldTerminate?: boolean;  // 是否终止流程
  newState?: string;          // 新状态
  actions?: Array<{
    type: string;
    payload: any;
  }>;
}

export class IntentHandlerRegistry {
  private handlers: Map<IntentType, IntentHandler> = new Map();
  private defaultHandler: IntentHandler;
  
  constructor() {
    // 设置默认处理器
    this.defaultHandler = async (intent, context) => ({
      success: true,
      response: '抱歉，我没明白您的意思。您可以再说一遍吗？'
    });
  }
  
  register(intentType: IntentType, handler: IntentHandler): void {
    this.handlers.set(intentType, handler);
  }
  
  async handle(intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const handler = this.handlers.get(intent.type) || this.defaultHandler;
    return handler(intent, context);
  }
  
  /**
   * 初始化所有处理器
   */
  initializeHandlers(): void {
    // 取消意图处理器 - 最高优先级，立即终止
    this.register(IntentType.CANCEL, async (intent, context) => {
      // 清理当前正在进行的任何操作
      context.clearOngoingOperations();
      
      return {
        success: true,
        response: '好的，已取消报案。如果还有其他需要，随时告诉我。',
        shouldTerminate: true,
        newState: 'ENDED'
      };
    });
    
    // 确认意图处理器
    this.register(IntentType.CONFIRM, async (intent, context) => {
      const currentState = context.getCurrentState();
      
      switch (currentState) {
        case 'CONFIRMING_POLICY':
          // 确认保单选择，进入信息收集阶段
          return {
            success: true,
            response: '好的，请告诉我事故情况。您可以描述事故发生时间、原因、就诊医院等。',
            newState: 'COLLECTING_FIELDS',
            actions: [{
              type: 'LOAD_INTAKE_CONFIG',
              payload: { productCode: context.getSelectedPolicy()?.productCode }
            }]
          };
          
        case 'CONFIRMING_SUBMISSION':
          // 确认提交报案
          return {
            success: true,
            response: '正在提交...',
            actions: [{
              type: 'SUBMIT_CLAIM',
              payload: context.getCollectedData()
            }]
          };
          
        default:
          return {
            success: true,
            response: '好的'
          };
      }
    });
    
    // 拒绝意图处理器
    this.register(IntentType.REJECT, async (intent, context) => {
      const currentState = context.getCurrentState();
      
      switch (currentState) {
        case 'CONFIRMING_POLICY':
          // 重新选择保单
          return {
            success: true,
            response: '没关系，请重新选择。您可以说"第一张"、"第二张"，或者告诉我产品名称。',
            newState: 'SELECTING_POLICY'
          };
          
        case 'CONFIRMING_SUBMISSION':
          // 修改信息
          return {
            success: true,
            response: '好的，请告诉我需要修改哪个信息？',
            newState: 'COLLECTING_FIELDS'
          };
          
        default:
          return {
            success: true,
            response: '好的，那您想怎么做？'
          };
      }
    });
    
    // 保单选择意图处理器
    this.register(IntentType.SELECT_POLICY, async (intent, context) => {
      const index = intent.entities?.index;
      const policies = context.getAvailablePolicies();
      
      if (!index || index > policies.length) {
        return {
          success: false,
          response: `抱歉，您只有${policies.length}张保单可选。请说"第1张"、"第2张"等。`
        };
      }
      
      const selectedPolicy = policies[index - 1];
      context.setSelectedPolicy(selectedPolicy);
      
      return {
        success: true,
        response: `确认选择${selectedPolicy.productName}，被保人${selectedPolicy.insuredName}，对吗？`,
        newState: 'CONFIRMING_POLICY'
      };
    });
    
    // 添加更多处理器...
  }
}
```

### 4. 增强的 VoiceSession

```typescript
// server/voice/VoiceSession.ts（意图驱动版本）

import { IntentRecognizer } from './intents/IntentRecognizer.js';
import { IntentHandlerRegistry } from './intents/IntentHandlerRegistry.js';
import { VoiceSessionContext } from './state/VoiceSessionContext.js';

export class VoiceSession {
  private intentRecognizer: IntentRecognizer;
  private intentRegistry: IntentHandlerRegistry;
  private sessionContext: VoiceSessionContext;
  private ongoingOperation: AbortController | null = null;
  
  constructor(config: SessionConfig) {
    // ... 初始化代码
    
    this.sessionContext = new VoiceSessionContext();
    this.intentRecognizer = new IntentRecognizer(this.sessionContext);
    this.intentRegistry = new IntentHandlerRegistry();
    this.intentRegistry.initializeHandlers();
  }
  
  async handleMessage(message: VoiceMessage): Promise<void> {
    if (message.type === 'audio') {
      await this.handleAudioMessage(message.payload);
    } else if (message.type === 'text') {
      await this.handleTextMessage(message.payload);
    }
  }
  
  private async handleTextMessage(payload: any): Promise<void> {
    const text = payload.content;
    
    // 1. 识别意图
    const intent = this.intentRecognizer.recognize(text);
    console.log(`[VoiceSession] 识别意图: ${intent.type}, 置信度: ${intent.confidence}`);
    
    // 2. 检查是否需要取消当前操作
    if (intent.type === 'cancel' && this.ongoingOperation) {
      this.ongoingOperation.abort();
      this.ongoingOperation = null;
      console.log('[VoiceSession] 已取消当前操作');
    }
    
    // 3. 处理意图
    try {
      const result = await this.intentRegistry.handle(intent, this.sessionContext);
      
      // 4. 检查结果
      if (result.shouldTerminate) {
        await this.sendResponse(result.response);
        this.endSession();
        return;
      }
      
      // 5. 执行动作
      if (result.actions) {
        for (const action of result.actions) {
          await this.executeAction(action);
        }
      }
      
      // 6. 更新状态
      if (result.newState) {
        this.sessionContext.setState(result.newState);
      }
      
      // 7. 发送响应
      await this.sendResponse(result.response);
      
    } catch (error) {
      console.error('[VoiceSession] 处理意图失败:', error);
      await this.sendResponse('抱歉，处理出错了，请重试。');
    }
  }
  
  /**
   * 执行动作
   */
  private async executeAction(action: { type: string; payload: any }): Promise<void> {
    // 创建可取消的操作控制器
    this.ongoingOperation = new AbortController();
    const signal = this.ongoingOperation.signal;
    
    try {
      switch (action.type) {
        case 'LOAD_POLICIES':
          await this.loadPolicies(signal);
          break;
          
        case 'LOAD_INTAKE_CONFIG':
          await this.loadIntakeConfig(action.payload.productCode, signal);
          break;
          
        case 'SUBMIT_CLAIM':
          await this.submitClaim(action.payload, signal);
          break;
          
        // ... 其他动作
      }
    } finally {
      this.ongoingOperation = null;
    }
  }
  
  /**
   * 加载保单列表
   */
  private async loadPolicies(signal: AbortSignal): Promise<void> {
    // 检查是否已取消
    if (signal.aborted) {
      throw new Error('操作已取消');
    }
    
    this.sendEvent('tool_call_start', { toolName: '查询保单' });
    
    try {
      const result = await this.pipeline.executeTool('listUserPolicies', {});
      
      if (signal.aborted) {
        throw new Error('操作已取消');
      }
      
      if (result.success) {
        this.sessionContext.setAvailablePolicies(result.data);
        const policyList = result.data.map((p: any, i: number) => 
          `第${i + 1}张，${p.productName}，被保人${p.insuredName}，生效${p.effectiveDate}`
        ).join('；');
        
        await this.sendResponse(`为您找到${result.data.length}张保单：${policyList}。请问您要为哪张报案？`);
        this.sessionContext.setState('SELECTING_POLICY');
      } else {
        await this.sendResponse(result.error || '查询保单失败');
      }
    } finally {
      this.sendEvent('tool_call_end', { toolName: '查询保单' });
    }
  }
  
  /**
   * 加载报案配置
   */
  private async loadIntakeConfig(productCode: string, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return;
    
    this.sendEvent('tool_call_start', { toolName: '加载配置' });
    
    try {
      const result = await this.pipeline.executeTool('getProductIntakeConfig', { productCode });
      
      if (signal.aborted) return;
      
      if (result.success) {
        this.sessionContext.setIntakeConfig(result.data);
      }
    } finally {
      this.sendEvent('tool_call_end', { toolName: '加载配置' });
    }
  }
  
  /**
   * 提交报案
   */
  private async submitClaim(data: any, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return;
    
    this.sendEvent('tool_call_start', { toolName: '提交报案' });
    
    try {
      const result = await this.pipeline.executeTool('submitClaim', data);
      
      if (signal.aborted) return;
      
      if (result.success) {
        const materials = result.data.requiredMaterials
          .map((m: any) => m.name)
          .join('、');
        
        await this.sendResponse(
          `报案成功！您的报案号是${result.data.reportNumber}。` +
          `需要准备的材料：${materials}。预计${result.data.estimatedProcessTime}完成审核。`
        );
        
        this.endSession();
      } else {
        await this.sendResponse(`提交失败：${result.error}`);
      }
    } finally {
      this.sendEvent('tool_call_end', { toolName: '提交报案' });
    }
  }
}
```

### 5. 完整流程示例

```typescript
// 报案流程示例

// 用户: "我要报案"
// 意图: START_CLAIM
// 响应: "好的，我来帮您办理理赔报案。让我先查询一下您的保单..."
// 动作: LOAD_POLICIES

// 用户: "第1张"
// 意图: SELECT_POLICY { index: 1 }
// 响应: "确认选择平安e生保医疗保险，被保人张三，对吗？"
// 状态: CONFIRMING_POLICY

// 用户: "对的"
// 意图: CONFIRM
// 响应: "好的，请告诉我事故情况。您可以描述事故发生时间、原因、就诊医院等。"
// 状态: COLLECTING_FIELDS
// 动作: LOAD_INTAKE_CONFIG

// 用户: "昨天急性阑尾炎，在上海市六院"
// 意图: PROVIDE_INFO
// 提取: { accident_date: '2025-03-05', accident_reason: '急性阑尾炎', hospital_name: '上海市六院' }
// 响应: "收到！已记录您昨天因急性阑尾炎在上海市六院就诊。预估理赔金额是多少？"

// 用户: "取消，不报了"
// 意图: CANCEL
// 响应: "好的，已取消报案。如果还有其他需要，随时告诉我。"
// 终止: shouldTerminate = true
```

## 文件清单

### 新增文件

1. `server/voice/intents/IntentTypes.ts` - 意图类型定义
2. `server/voice/intents/IntentRecognizer.ts` - 意图识别器
3. `server/voice/intents/IntentHandlerRegistry.ts` - 意图处理器注册表
4. `server/voice/state/VoiceSessionContext.ts` - 会话上下文管理

### 修改文件

1. `server/voice/VoiceSession.ts` - 改为意图驱动架构
2. `server/voice/VoicePipeline.ts` - 调整 prompt 支持意图识别
3. `server/voice/tools/index.ts` - 注册新工具

## 关键特性

1. **实时意图识别**: 每句话都经过意图识别器
2. **取消即终止**: 识别到取消意图立即中断当前操作
3. **状态驱动**: 不同状态下相同意图有不同处理
4. **可扩展**: 易于添加新意图和处理器
5. **鲁棒性**: 置信度低的意图有默认处理
