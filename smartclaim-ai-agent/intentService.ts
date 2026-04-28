/**
 * 意图识别服务
 * 使用 Gemini Function Calling 识别用户意图
 */

import { Type } from "@google/genai";
import {
  IntentType,
  IntentRecognitionResult,
  IntentEntities,
  ToolResponse,
  ClaimState,
} from "./types";
import { executeTool } from "./intentTools";
import { generateContentViaProxy } from "./services/aiProxyService";

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
          // 报案类
          "REPORT_NEW_CLAIM",
          "RESUME_CLAIM_REPORT",
          "MODIFY_CLAIM_REPORT",
          "CANCEL_CLAIM",
          // 材料类
          "UPLOAD_DOCUMENT",
          "SUPPLEMENT_DOCUMENT",
          "VIEW_UPLOADED_DOCUMENTS",
          "REPLACE_DOCUMENT",
          // 查询类
          "QUERY_PROGRESS",
          "QUERY_MATERIALS_LIST",
          "QUERY_MISSING_MATERIALS",
          "QUERY_PREMIUM_IMPACT",
          "QUERY_SETTLEMENT_AMOUNT",
          "QUERY_SETTLEMENT_DETAIL",
          "QUERY_POLICY_INFO",
          "QUERY_CLAIM_HISTORY",
          "QUERY_PAYMENT_STATUS",
          // 协助类
          "GUIDE_CLAIM_PROCESS",
          "GUIDE_DOCUMENT_PHOTO",
          "QUERY_CLAIM_TIMELINE",
          "QUERY_COVERAGE",
          "QUERY_FAQ",
          // 沟通类
          "TRANSFER_TO_AGENT",
          "FILE_COMPLAINT",
          "EXPEDITE_CLAIM",
          "LEAVE_MESSAGE",
          // 操作类
          "UPDATE_BANK_INFO",
          "CONFIRM_SETTLEMENT",
          "REJECT_SETTLEMENT",
          "SIGN_AGREEMENT",
          // 兜底类
          "GENERAL_CHAT",
          "UNCLEAR_INTENT",
          "OUT_OF_SCOPE",
        ],
        description: "识别出的用户意图类型",
      },
      confidence: {
        type: Type.NUMBER,
        description: "意图识别的置信度 (0-1)",
      },
      entities: {
        type: Type.OBJECT,
        properties: {
          claimId: {
            type: Type.STRING,
            description: "案件号/理赔号，如 CLM123456",
          },
          policyId: {
            type: Type.STRING,
            description: "保单号",
          },
          claimType: {
            type: Type.STRING,
            description: "理赔类型：医疗/车险/意外险/重疾等",
          },
          productCode: {
            type: Type.STRING,
            description: "产品代码",
          },
          documentType: {
            type: Type.STRING,
            description: "材料类型：身份证/发票/病历等",
          },
          amount: {
            type: Type.NUMBER,
            description: "金额数值",
          },
          reason: {
            type: Type.STRING,
            description: "用户描述的原因或补充说明",
          },
        },
        description: "从用户输入中提取的实体参数",
      },
      reasoning: {
        type: Type.STRING,
        description: "意图识别的推理过程简述",
      },
    },
    required: ["intent", "confidence", "entities"],
  },
};

/**
 * 系统 Prompt - 意图识别
 */
const INTENT_RECOGNITION_PROMPT = `你是保险理赔客服智能助手，专门负责识别索赔人（用户）的意图。

## 可识别的意图类型（共7大类33个意图）

### A. 报案类
1. **REPORT_NEW_CLAIM** - 新报案
   - 关键词：报案、理赔、出险、事故、发生了、撞了、住院了、受伤
   - 示例："我要报案" "发生了交通事故" "我要申请理赔"

2. **RESUME_CLAIM_REPORT** - 续填报案
   - 关键词：继续报案、刚才没填完、接着填、恢复报案
   - 示例："继续填报案信息" "刚才报案没填完"

3. **MODIFY_CLAIM_REPORT** - 修改报案信息
   - 关键词：修改报案、改一下、填错了、更正
   - 示例："事故地点填错了" "我要修改报案信息"

4. **CANCEL_CLAIM** - 撤销报案
   - 关键词：撤销、取消报案、不赔了、不理赔了、算了
   - 示例："撤销报案" "不理赔了"

### B. 材料上传类
5. **UPLOAD_DOCUMENT** - 上传理赔材料
   - 关键词：上传、拍照、提交材料、传资料、传文件
   - 示例："上传材料" "拍照上传发票"

6. **SUPPLEMENT_DOCUMENT** - 补充材料
   - 关键词：补充材料、补交、补传、再传一个
   - 示例："补充病历" "我要补交材料"

7. **VIEW_UPLOADED_DOCUMENTS** - 查看已上传材料
   - 关键词：已上传、传过什么、看材料、上传记录
   - 示例："看看我传了什么" "已上传的材料"

8. **REPLACE_DOCUMENT** - 删除/替换材料
   - 关键词：重新上传、换一张、替换、拍错了
   - 示例："这张照片拍错了" "重新上传身份证"

### C. 查询类
9. **QUERY_PROGRESS** - 查询理赔进度
   - 关键词：进度、状态、进展、到哪了、多久了、审核、结果
   - 示例："我的理赔进度怎么样了？"

10. **QUERY_MATERIALS_LIST** - 查询理赔材料清单
    - 关键词：需要什么、材料清单、准备什么、要交什么
    - 示例："理赔需要什么材料？"

11. **QUERY_MISSING_MATERIALS** - 查询缺失材料
    - 关键词：还缺、还差、缺什么、没交的
    - 示例："我还缺什么材料？"

12. **QUERY_PREMIUM_IMPACT** - 查询保费影响
    - 关键词：保费、涨价、NCD、影响续保、上浮
    - 示例："理赔会影响明年保费吗？"

13. **QUERY_SETTLEMENT_AMOUNT** - 查询赔付金额
    - 关键词：赔多少、赔付金额、能赔、预估赔偿
    - 示例："这次能赔多少钱？" "预估赔付金额"

14. **QUERY_SETTLEMENT_DETAIL** - 查询赔付明细
    - 关键词：赔付明细、怎么算的、计算过程、扣了什么
    - 示例："赔付金额是怎么算的？" "扣了什么？"

15. **QUERY_POLICY_INFO** - 查询保单信息
    - 关键词：保单、保什么、保障范围、保额
    - 示例："我的保单保什么？" "保额多少？"

16. **QUERY_CLAIM_HISTORY** - 查询历史案件
    - 关键词：历史理赔、之前的案件、赔过几次、记录
    - 示例："我之前的理赔记录" "赔过几次了？"

17. **QUERY_PAYMENT_STATUS** - 查询打款状态
    - 关键词：到账、打款、钱到了吗、什么时候到
    - 示例："钱到了吗？" "什么时候打款？"

### D. 协助类
18. **GUIDE_CLAIM_PROCESS** - 理赔流程指引
    - 关键词：怎么理赔、理赔流程、步骤、怎么操作、第一次
    - 示例："理赔流程是什么？" "第一次理赔怎么操作？"

19. **GUIDE_DOCUMENT_PHOTO** - 材料拍摄指导
    - 关键词：怎么拍、拍照要求、拍摄指南、示例照片
    - 示例："发票怎么拍清楚？" "拍照有什么要求？"

20. **QUERY_CLAIM_TIMELINE** - 理赔时效说明
    - 关键词：要多久、几天、多长时间、时效
    - 示例："审核要多久？" "多长时间能赔下来？"

21. **QUERY_COVERAGE** - 责任范围咨询
    - 关键词：赔不赔、保障范围、免赔额、能不能赔
    - 示例："这种情况赔不赔？" "免赔额多少？"

22. **QUERY_FAQ** - 常见问题
    - 关键词：常见问题、FAQ、注意事项、注意什么
    - 示例："有什么注意事项？" "常见问题"

### E. 沟通类
23. **TRANSFER_TO_AGENT** - 转人工客服
    - 关键词：转人工、人工客服、找客服、真人
    - 示例："转人工" "我要找人工客服"

24. **FILE_COMPLAINT** - 投诉/申诉
    - 关键词：投诉、申诉、不满意、为什么拒赔
    - 示例："我要投诉" "为什么拒赔？"

25. **EXPEDITE_CLAIM** - 催办/加急
    - 关键词：催、加急、快点、太慢了
    - 示例："能催一下吗？" "太慢了加急处理"

26. **LEAVE_MESSAGE** - 留言/备注
    - 关键词：留言、备注、告诉理赔员、说一下
    - 示例："帮我给理赔员留言" "备注一下"

### F. 操作类
27. **UPDATE_BANK_INFO** - 修改收款信息
    - 关键词：银行卡、收款账户、修改账号、换卡
    - 示例："修改收款银行卡" "换个收款账户"

28. **CONFIRM_SETTLEMENT** - 确认赔付方案
    - 关键词：同意、确认赔付、接受方案、没问题
    - 示例："同意赔付方案" "我确认接受"

29. **REJECT_SETTLEMENT** - 拒绝赔付方案
    - 关键词：不接受、不同意、金额太少、有异议
    - 示例："金额太少了" "我不接受这个方案"

30. **SIGN_AGREEMENT** - 签署协议/授权
    - 关键词：签字、签署、授权、电子签名
    - 示例："我要签署协议" "电子签名在哪"

### G. 兜底类
31. **GENERAL_CHAT** - 普通对话（闲聊、问候等）
32. **UNCLEAR_INTENT** - 意图不明（模糊表达、多意图混合）
33. **OUT_OF_SCOPE** - 超出能力范围（与保险理赔无关的请求）

## 识别规则

1. 仔细分析用户的自然语言输入
2. 提取案件号、保单号、理赔类型、材料类型等实体信息
3. 如果用户提到了具体案件号，提取到 entities.claimId
4. 如果置信度低于 0.7，归类为 UNCLEAR_INTENT
5. 如果用户表达与保险理赔完全无关，归类为 OUT_OF_SCOPE
6. 如果用户表达模糊但与理赔相关，归类为 UNCLEAR_INTENT
7. 结合对话上下文理解用户意图
8. "报案"/"理赔"首次提到时优先判定为 REPORT_NEW_CLAIM
9. 涉及"补充"材料 vs "查缺"材料要区分：补充是动作，查缺是查询

## 返回格式

使用 recognize_intent 工具返回识别结果。`;

/**
 * 为低置信度或模糊意图生成澄清问题与候选选项
 * 使用轻量规则模板，避免额外 AI 调用
 */
export function buildClarificationQuestion(
  intent: IntentType,
  entities: IntentEntities,
  originalText: string,
): { question: string; options: string[] } {
  const trimmed = originalText.trim();
  const shortRef = trimmed.length > 20 ? `${trimmed.slice(0, 20)}…` : trimmed;

  if (intent === IntentType.UNCLEAR_INTENT || !intent) {
    return {
      question: `您说的"${shortRef}"我还没完全理解，方便告诉我您想做以下哪件事吗？`,
      options: [
        "查询我的理赔进度",
        "上传/补充材料",
        "咨询理赔材料清单",
        "转人工客服",
      ],
    };
  }

  // 针对有意图但实体模糊的情况给出更聚焦的选项
  const label = getIntentLabel(intent);
  return {
    question: `我大致理解您想${label}，不过信息还不太完整，能再补充一下吗？`,
    options: ["是的，请继续", "换成其他问题", "转人工客服"],
  };
}

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
  claimState: ClaimState,
): Promise<IntentRecognitionResult> {
  try {
    const { response } = await generateContentViaProxy({
      capabilityId: "smartclaim.intent",
      promptTemplateId: "smartclaim_intent_recognition",
      templateVariables: {
        claimStatus: claimState.status,
        historicalClaimCount: claimState.historicalClaims?.length || 0,
        recentClaimId: claimState.historicalClaims?.[0]?.id || "无",
        documentCount: claimState.documents?.length || 0,
        conversationHistory: conversationHistory
          .slice(-5)
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n"),
        userInput,
      },
      config: {
        temperature: 0.1,
        tools: [{ functionDeclarations: [INTENT_RECOGNITION_TOOL] }],
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY" as any,
          },
        },
      },
      operation: "intent_recognition",
      context: {
        claimStatus: claimState.status,
        historyCount: conversationHistory.length,
      },
    });

    // 解析工具调用结果
    const functionCall =
      response.candidates?.[0]?.content?.parts?.[0]?.functionCall;

    if (functionCall && functionCall.name === "recognize_intent") {
      const args = functionCall.args as any;

      const finalIntent = args.intent as IntentType;
      const finalConfidence = args.confidence as number;
      const entities = (args.entities as IntentEntities) || {};

      // 低置信度或模糊意图 → 标记为需澄清，由上层生成澄清问题
      const needsClarification =
        finalConfidence < CONFIDENCE_THRESHOLD ||
        finalIntent === IntentType.UNCLEAR_INTENT;

      if (needsClarification) {
        const { question, options } = buildClarificationQuestion(
          finalIntent,
          entities,
          userInput,
        );
        return {
          intent: finalIntent,
          confidence: finalConfidence,
          entities,
          originalText: userInput,
          requiresClarification: true,
          clarificationQuestion: question,
          clarificationOptions: options,
        };
      }

      return {
        intent: finalIntent,
        confidence: finalConfidence,
        entities,
        originalText: userInput,
      };
    }

    // 如果未返回工具调用，默认 GENERAL_CHAT
    return {
      intent: IntentType.GENERAL_CHAT,
      confidence: 0.5,
      entities: {},
      originalText: userInput,
    };
  } catch (error) {
    console.error("[Intent Recognition Error]", error);
    // 出错时返回 GENERAL_CHAT，确保不阻断对话
    return {
      intent: IntentType.GENERAL_CHAT,
      confidence: 0,
      entities: {},
      originalText: userInput,
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
  claimState: ClaimState,
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
  claimState: ClaimState,
): Promise<{
  intent: IntentRecognitionResult;
  toolResponse: ToolResponse;
}> {
  // 1. 识别意图
  const intentResult = await recognizeIntent(
    userInput,
    conversationHistory,
    claimState,
  );

  // 2. 执行对应工具
  const toolResponse = await executeIntentTool(intentResult, claimState);

  return {
    intent: intentResult,
    toolResponse,
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

  // 意图关键词映射（按优先级排序，越具体的越靠前）
  const intentKeywords: [IntentType, string[]][] = [
    // 沟通类（高优先级，用户明确意愿）
    [IntentType.TRANSFER_TO_AGENT, ["转人工", "人工客服", "找客服", "真人"]],
    [IntentType.FILE_COMPLAINT, ["投诉", "申诉", "不满意", "为什么拒赔"]],
    [IntentType.EXPEDITE_CLAIM, ["催一下", "加急", "太慢了"]],

    // 报案类
    [IntentType.CANCEL_CLAIM, ["撤销报案", "取消报案", "不赔了", "不理赔了"]],
    [
      IntentType.RESUME_CLAIM_REPORT,
      ["继续报案", "没填完", "接着填", "恢复报案"],
    ],
    [IntentType.MODIFY_CLAIM_REPORT, ["修改报案", "填错了", "更正报案"]],
    [
      IntentType.REPORT_NEW_CLAIM,
      ["我要报案", "我要理赔", "出险", "发生事故", "发生了事故"],
    ],

    // 操作类
    [
      IntentType.CONFIRM_SETTLEMENT,
      ["同意赔付", "确认方案", "接受方案", "确认赔付"],
    ],
    [IntentType.REJECT_SETTLEMENT, ["不接受", "不同意", "金额太少", "有异议"]],
    [IntentType.UPDATE_BANK_INFO, ["银行卡", "收款账户", "修改账号", "换卡"]],
    [IntentType.SIGN_AGREEMENT, ["签字", "签署", "电子签名"]],

    // 材料类（具体的先匹配）
    [IntentType.REPLACE_DOCUMENT, ["重新上传", "换一张", "替换", "拍错了"]],
    [IntentType.SUPPLEMENT_DOCUMENT, ["补充材料", "补交", "补传", "再传一个"]],
    [
      IntentType.VIEW_UPLOADED_DOCUMENTS,
      ["已上传", "传过什么", "看材料", "上传记录"],
    ],
    [
      IntentType.UPLOAD_DOCUMENT,
      ["上传材料", "拍照上传", "提交材料", "传资料"],
    ],

    // 查询类
    [
      IntentType.QUERY_MISSING_MATERIALS,
      ["还缺", "还差", "缺什么", "没交的", "遗漏", "缺少"],
    ],
    [
      IntentType.QUERY_SETTLEMENT_DETAIL,
      ["赔付明细", "怎么算的", "计算过程", "扣了什么"],
    ],
    [
      IntentType.QUERY_SETTLEMENT_AMOUNT,
      ["赔多少", "赔付金额", "能赔", "预估赔偿"],
    ],
    [IntentType.QUERY_PAYMENT_STATUS, ["到账", "打款", "钱到了", "什么时候到"]],
    [
      IntentType.QUERY_CLAIM_HISTORY,
      ["历史理赔", "之前的案件", "赔过几次", "理赔记录"],
    ],
    [IntentType.QUERY_POLICY_INFO, ["保单", "保什么", "保障范围", "保额"]],
    [
      IntentType.QUERY_PREMIUM_IMPACT,
      ["保费", "涨价", "上浮", "ncd", "折扣", "无赔款"],
    ],
    [
      IntentType.QUERY_MATERIALS_LIST,
      ["需要什么", "材料清单", "准备什么", "要交什么"],
    ],
    [IntentType.QUERY_PROGRESS, ["进度", "状态", "进展", "到哪", "审核了吗"]],

    // 协助类
    [
      IntentType.GUIDE_DOCUMENT_PHOTO,
      ["怎么拍", "拍照要求", "拍摄指南", "示例照片"],
    ],
    [
      IntentType.GUIDE_CLAIM_PROCESS,
      ["怎么理赔", "理赔流程", "怎么操作", "第一次理赔"],
    ],
    [
      IntentType.QUERY_CLAIM_TIMELINE,
      ["要多久", "几天能赔", "多长时间", "时效"],
    ],
    [IntentType.QUERY_COVERAGE, ["赔不赔", "能不能赔", "免赔额"]],
    [IntentType.QUERY_FAQ, ["常见问题", "faq", "注意事项", "注意什么"]],

    // 留言（较宽泛，放后面）
    [IntentType.LEAVE_MESSAGE, ["留言", "备注", "告诉理赔员"]],
  ];

  for (const [intent, keywords] of intentKeywords) {
    if (keywords.some((k) => text.includes(k))) {
      return intent;
    }
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
    // 报案类
    [IntentType.REPORT_NEW_CLAIM]: "新报案",
    [IntentType.RESUME_CLAIM_REPORT]: "续填报案",
    [IntentType.MODIFY_CLAIM_REPORT]: "修改报案",
    [IntentType.CANCEL_CLAIM]: "撤销报案",
    // 材料类
    [IntentType.UPLOAD_DOCUMENT]: "上传材料",
    [IntentType.SUPPLEMENT_DOCUMENT]: "补充材料",
    [IntentType.VIEW_UPLOADED_DOCUMENTS]: "查看已上传",
    [IntentType.REPLACE_DOCUMENT]: "替换材料",
    // 查询类
    [IntentType.QUERY_PROGRESS]: "查询进度",
    [IntentType.QUERY_MATERIALS_LIST]: "查询材料清单",
    [IntentType.QUERY_MISSING_MATERIALS]: "查询缺失材料",
    [IntentType.QUERY_PREMIUM_IMPACT]: "查询保费影响",
    [IntentType.QUERY_SETTLEMENT_AMOUNT]: "查询赔付金额",
    [IntentType.QUERY_SETTLEMENT_DETAIL]: "查询赔付明细",
    [IntentType.QUERY_POLICY_INFO]: "查询保单信息",
    [IntentType.QUERY_CLAIM_HISTORY]: "查询历史案件",
    [IntentType.QUERY_PAYMENT_STATUS]: "查询打款状态",
    // 协助类
    [IntentType.GUIDE_CLAIM_PROCESS]: "理赔流程指引",
    [IntentType.GUIDE_DOCUMENT_PHOTO]: "材料拍摄指导",
    [IntentType.QUERY_CLAIM_TIMELINE]: "理赔时效说明",
    [IntentType.QUERY_COVERAGE]: "保障范围咨询",
    [IntentType.QUERY_FAQ]: "常见问题",
    // 沟通类
    [IntentType.TRANSFER_TO_AGENT]: "转人工客服",
    [IntentType.FILE_COMPLAINT]: "投诉/申诉",
    [IntentType.EXPEDITE_CLAIM]: "催办/加急",
    [IntentType.LEAVE_MESSAGE]: "留言/备注",
    // 操作类
    [IntentType.UPDATE_BANK_INFO]: "修改收款信息",
    [IntentType.CONFIRM_SETTLEMENT]: "确认赔付方案",
    [IntentType.REJECT_SETTLEMENT]: "拒绝赔付方案",
    [IntentType.SIGN_AGREEMENT]: "签署协议",
    // 兜底类
    [IntentType.GENERAL_CHAT]: "普通对话",
    [IntentType.UNCLEAR_INTENT]: "意图不明",
    [IntentType.OUT_OF_SCOPE]: "超出范围",
  };
  return labels[intent] || "未知意图";
}
