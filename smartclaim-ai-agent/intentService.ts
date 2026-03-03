/**
 * 意图识别服务
 * 使用 Gemini Function Calling 识别用户意图
 */

import { GoogleGenAI, Type } from "@google/genai";
import {
  IntentType,
  IntentRecognitionResult,
  IntentEntities,
  ToolResponse,
  ClaimState
} from "./types";
import { executeTool } from "./intentTools";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/** 置信度阈值 - 低于此值视为 GENERAL_CHAT */
const CONFIDENCE_THRESHOLD = 0.7;

/**
 * 意图识别工具定义
 * 用于 Gemini Function Calling
 */
const INTENT_RECOGNITION_TOOL = {
  name: "recognize_intent",
  description: "识别用户的意图并提取相关实体参数",
  parameters: {
    type: Type.OBJECT,
    properties: {
      intent: {
        type: Type.STRING,
        enum: [
          "QUERY_PROGRESS",
          "QUERY_MATERIALS_LIST",
          "QUERY_MISSING_MATERIALS",
          "QUERY_PREMIUM_IMPACT",
          "GENERAL_CHAT"
        ],
        description: "识别出的用户意图类型"
      },
      confidence: {
        type: Type.NUMBER,
        description: "意图识别的置信度 (0-1)"
      },
      entities: {
        type: Type.OBJECT,
        properties: {
          claimId: {
            type: Type.STRING,
            description: "案件号/理赔号，如 CLM123456"
          },
          policyId: {
            type: Type.STRING,
            description: "保单号"
          },
          claimType: {
            type: Type.STRING,
            description: "理赔类型：医疗/车险/意外险/重疾等"
          },
          productCode: {
            type: Type.STRING,
            description: "产品代码"
          }
        },
        description: "从用户输入中提取的实体参数"
      },
      reasoning: {
        type: Type.STRING,
        description: "意图识别的推理过程简述"
      }
    },
    required: ["intent", "confidence", "entities"]
  }
};

/**
 * 系统 Prompt - 意图识别
 */
const INTENT_RECOGNITION_PROMPT = `你是保险理赔客服智能助手，专门负责识别用户意图。

## 可识别的意图类型

1. **QUERY_PROGRESS** - 查询理赔进度
   - 关键词：进度、状态、进展、到哪了、多久了、审核、什么时候、结果
   - 示例："我的理赔进度怎么样了？" "还要多久能审核完？"

2. **QUERY_MATERIALS_LIST** - 查询理赔材料清单
   - 关键词：需要什么、材料清单、都要什么、材料要求、准备什么、提交什么
   - 示例："理赔需要什么材料？" "我要准备哪些资料？"

3. **QUERY_MISSING_MATERIALS** - 查询还缺什么材料
   - 关键词：还缺什么、补充什么、差什么、哪些没交、缺少、遗漏
   - 示例："我还需要补充什么材料？" "我的案子还差什么？"

4. **QUERY_PREMIUM_IMPACT** - 查询对未来保费的影响
   - 关键词：保费、涨价、下年、NCD、无赔款优待、影响、上浮、折扣
   - 示例："这次理赔会影响明年的保费吗？" "报了案明年保费会涨吗？"

5. **GENERAL_CHAT** - 普通对话
   - 闲聊、问候、或其他无法归类为上述意图的内容

## 识别规则

1. 仔细分析用户的自然语言输入
2. 提取案件号、保单号、理赔类型等实体信息
3. 如果用户提到了具体案件号，提取到 entities.claimId
4. 如果置信度低于 0.7，归类为 GENERAL_CHAT
5. 如果用户表达模糊，优先归类为 GENERAL_CHAT
6. 结合对话上下文理解用户意图

## 返回格式

使用 recognize_intent 工具返回识别结果。`;

/**
 * 识别用户意图
 * @param userInput 用户输入文本
 * @param conversationHistory 对话历史
 * @param claimState 当前理赔状态
 * @returns 意图识别结果
 */
export async function recognizeIntent(
  userInput: string,
  conversationHistory: { role: string; content: string }[],
  claimState: ClaimState
): Promise<IntentRecognitionResult> {
  const ai = getAI();
  const model = "gemini-2.5-flash";

  try {
    // 构建上下文信息
    const contextInfo = `
当前对话上下文：
- 当前理赔状态: ${claimState.status}
- 已关联案件数: ${claimState.historicalClaims?.length || 0}
- 最近案件ID: ${claimState.historicalClaims?.[0]?.id || '无'}
- 已上传材料数: ${claimState.documents?.length || 0}
`;

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: INTENT_RECOGNITION_PROMPT },
            { text: contextInfo },
            { text: `对话历史：\n${conversationHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}` },
            { text: `用户最新输入："${userInput}"` },
            { text: "请识别用户意图并返回结果。" }
          ]
        }
      ],
      config: {
        temperature: 0.1, // 低温度确保确定性
        tools: [{ functionDeclarations: [INTENT_RECOGNITION_TOOL] }],
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY" as any // 强制使用工具
          }
        }
      }
    });

    // 解析工具调用结果
    const functionCall = response.candidates?.[0]?.content?.parts?.[0]?.functionCall;
    
    if (functionCall && functionCall.name === "recognize_intent") {
      const args = functionCall.args as any;
      
      // 如果置信度低于阈值，降级为 GENERAL_CHAT
      let finalIntent = args.intent as IntentType;
      let finalConfidence = args.confidence as number;
      
      if (finalConfidence < CONFIDENCE_THRESHOLD) {
        finalIntent = IntentType.GENERAL_CHAT;
        finalConfidence = 1 - finalConfidence; // 反向置信度
      }

      return {
        intent: finalIntent,
        confidence: finalConfidence,
        entities: args.entities as IntentEntities || {},
        originalText: userInput
      };
    }

    // 如果未返回工具调用，默认 GENERAL_CHAT
    return {
      intent: IntentType.GENERAL_CHAT,
      confidence: 0.5,
      entities: {},
      originalText: userInput
    };

  } catch (error) {
    console.error("[Intent Recognition Error]", error);
    // 出错时返回 GENERAL_CHAT，确保不阻断对话
    return {
      intent: IntentType.GENERAL_CHAT,
      confidence: 0,
      entities: {},
      originalText: userInput
    };
  }
}

/**
 * 执行意图对应的工具
 * @param intentResult 意图识别结果
 * @param claimState 当前理赔状态
 * @returns 工具执行结果
 */
export async function executeIntentTool(
  intentResult: IntentRecognitionResult,
  claimState: ClaimState
): Promise<ToolResponse> {
  return executeTool(intentResult.intent, intentResult.entities, claimState);
}

/**
 * 意图识别并执行完整流程
 * @param userInput 用户输入
 * @param conversationHistory 对话历史
 * @param claimState 理赔状态
 * @returns 工具响应
 */
export async function processUserIntent(
  userInput: string,
  conversationHistory: { role: string; content: string }[],
  claimState: ClaimState
): Promise<{
  intent: IntentRecognitionResult;
  toolResponse: ToolResponse;
}> {
  // 1. 识别意图
  const intentResult = await recognizeIntent(userInput, conversationHistory, claimState);
  
  // 2. 执行对应工具
  const toolResponse = await executeIntentTool(intentResult, claimState);
  
  return {
    intent: intentResult,
    toolResponse
  };
}

/**
 * 快速意图检测（轻量级，用于前端预判）
 * 使用关键词匹配，无需调用 AI
 * @param userInput 用户输入
 * @returns 可能的意图类型（可能为 null）
 */
export function quickIntentDetection(userInput: string): IntentType | null {
  const text = userInput.toLowerCase();
  
  // 进度查询关键词
  const progressKeywords = ['进度', '状态', '进展', '到哪', '多久', '审核', '结果', '什么时候'];
  if (progressKeywords.some(k => text.includes(k))) {
    return IntentType.QUERY_PROGRESS;
  }
  
  // 材料清单关键词
  const materialsKeywords = ['需要什么', '材料', '清单', '准备', '提交', '资料'];
  if (materialsKeywords.some(k => text.includes(k))) {
    return IntentType.QUERY_MATERIALS_LIST;
  }
  
  // 缺失材料关键词
  const missingKeywords = ['还缺', '还差', '补充', '没交', '遗漏', '缺少'];
  if (missingKeywords.some(k => text.includes(k))) {
    return IntentType.QUERY_MISSING_MATERIALS;
  }
  
  // 保费影响关键词
  const premiumKeywords = ['保费', '涨价', '上浮', '下年', '明年', 'ncd', '折扣', '无赔款'];
  if (premiumKeywords.some(k => text.includes(k))) {
    return IntentType.QUERY_PREMIUM_IMPACT;
  }
  
  return null;
}

/**
 * 获取意图的中文描述
 * @param intent 意图类型
 * @returns 中文描述
 */
export function getIntentLabel(intent: IntentType): string {
  const labels: Record<IntentType, string> = {
    [IntentType.QUERY_PROGRESS]: "查询进度",
    [IntentType.QUERY_MATERIALS_LIST]: "查询材料清单",
    [IntentType.QUERY_MISSING_MATERIALS]: "查询缺失材料",
    [IntentType.QUERY_PREMIUM_IMPACT]: "查询保费影响",
    [IntentType.GENERAL_CHAT]: "普通对话"
  };
  return labels[intent] || "未知意图";
}
