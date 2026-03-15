
import { ClaimState, ClaimStatus, PolicyTerm, DocumentAnalysis, ToolResponse, IntentRecognitionResult } from "./types";
import { AIInteractionLog } from "../types";
import { uploadToOSS } from "./ossService";
import { recognizeIntent, executeIntentTool, quickIntentDetection } from "./intentService";
import { generateContentViaProxy } from "./services/aiProxyService";

const analysisCache = new Map<string, DocumentAnalysis>();

const getFileHash = async (base64: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(base64);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const SYSTEM_PROMPT = `You are a Senior Insurance Claim AI Adjuster. 
Your goal is to guide the user through the claim process:
1. REPORTING: Ask for incident time, location, policy number, and description. Identify the incident type (e.g., Medical, Auto, Property).
2. DOCUMENTING: Based on incident type, list required docs. Provide clear examples.
3. VALIDATION & OCR: Analyze uploaded materials. Extract key info (OCR) like dates, amounts, and names. Confirm if they match required types.
4. ASSESSMENT: 
   - First, determine liability based on policy rules. 
   - If not liable, quote the clause.
   - If liable, calculate payout per item (Limits, Deductibles, Special terms).
5. PAYMENT: Confirm banking details and initiate transfer.
   
Current Policy Rules (Mock):
- Auto: Coverage up to $100k, Deductible $500. Not liable if driver was unlicensed.
- Medical: 90% reimbursement, Max $50k. Requires official receipts.
- Property: Max $200k. Not liable for natural wear/tear.

When asking for a location or discussing geography, use Google Maps to provide accurate and up-to-date place information.

Always return helpful, empathetic, but professional responses. Use Chinese for user-facing content.`;

export const getAIResponse = async (
  messages: { role: string; content: string }[],
  state: ClaimState,
  userLocation?: { latitude: number; longitude: number }
) => {
  const config: any = {
    temperature: 0.7,
    tools: [{ googleMaps: {} }],
  };

  if (userLocation) {
    config.toolConfig = {
      retrievalConfig: {
        latLng: userLocation
      }
    };
  }

  const { response, aiLog } = await generateContentViaProxy({
    capabilityId: 'smartclaim.chat',
    promptTemplateId: 'smartclaim_chat_user',
    systemPromptTemplateId: 'smartclaim_system',
    templateVariables: {
      claimStateJson: JSON.stringify(state),
      historyText: messages.map(m => `${m.role}: ${m.content}`).join('\n'),
    },
    config,
    operation: 'chat_response',
    context: {
      hasUserLocation: Boolean(userLocation),
      messageCount: messages.length,
      claimStatus: state.status,
    },
  });

  const groundingLinks = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.map((chunk: any) => {
      if (chunk.maps) return { uri: chunk.maps.uri, title: chunk.maps.title };
      if (chunk.web) return { uri: chunk.web.uri, title: chunk.web.title };
      return null;
    })
    .filter((link: any) => link !== null);

  return {
    text: response.text || "我暂时无法回答。",
    groundingLinks,
    aiLog
  };
};

export const transcribeAudio = async (base64Audio: string): Promise<string> => {
  const { response } = await generateContentViaProxy({
    capabilityId: 'shared.audio_transcription',
    contents: {
      parts: [
        { inlineData: { data: base64Audio, mimeType: 'audio/wav' } },
        { text: "请精准转录这段语音内容，仅返回转录的文本，不要有其他解释。" }
      ]
    },
    operation: 'transcribe_audio',
    context: {
      mimeType: 'audio/wav',
    },
  });
  return response.text || "";
};

export const fetchPolicyTerms = async (incidentType: string): Promise<PolicyTerm[]> => {
  const model = 'gemini-2.5-flash';
  const prompt = `
    Generate a list of 3-4 insurance policy terms and conditions specifically for the incident type: ${incidentType}.
    Each term should have a title and a formal-sounding legal content snippet in Chinese.
    
    Return ONLY JSON array format:
    [
      {
        "id": "term_1",
        "title": "Clause Title",
        "content": "Formal legal description...",
        "category": "Main Category"
      }
    ]
  `;

  const { response } = await generateContentViaProxy({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
    },
    operation: 'fetch_policy_terms',
    context: {
      incidentType,
    },
  });

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Failed to parse policy terms", e);
    return [];
  }
};

export const quickAnalyze = async (base64: string, mimeType: string): Promise<{ category: string; needsDeepAnalysis: boolean; ossUrl: string; ossKey: string; aiLog: AIInteractionLog }> => {
  // Run OSS upload in parallel - don't block AI analysis if upload fails
  const ossPromise = uploadToOSS(base64, mimeType).catch(err => {
    console.warn('OSS upload failed, continuing with analysis:', err);
    return { url: '', objectKey: '' };
  });

  const promptText = "快速识别文档类型，返回JSON: {\"category\": \"类型(身份证/医疗发票/出院小结/诊断证明/现场照片/银行卡等)\", \"needsDeepAnalysis\": true/false}";
  const { response, aiLog } = await generateContentViaProxy({
    capabilityId: 'smartclaim.document_analysis',
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: promptText }
      ]
    },
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
    operation: 'quick_analyze',
    context: {
      mimeType,
    },
  });

  const ossResult = await ossPromise;

  try {
    const result = JSON.parse(response.text || '{"category":"未知","needsDeepAnalysis":false}');
    return { ...result, ossUrl: ossResult.url, ossKey: ossResult.objectKey, aiLog };
  } catch {
    return { category: '未知', needsDeepAnalysis: false, ossUrl: ossResult.url, ossKey: ossResult.objectKey, aiLog };
  }
};

export const analyzeDocument = async (base64: string, mimeType: string, state: ClaimState, ossUrl: string): Promise<{ analysis: DocumentAnalysis; aiLog: AIInteractionLog }> => {
  const dischargeSchema = {
    "document_type": "string (Fixed: '出院小结')",
    "document_id": "string",
    "hospital_info": { "hospital_name": "string", "department": "string" },
    "patient_info": { "name": "string", "gender": "string", "age": "integer", "date_of_birth": "string (YYYY-MM-DD)", "nationality": "string", "patient_id": "string" },
    "admission_details": { "admission_date": "string (YYYY-MM-DD HH:MM:SS)", "main_symptoms_on_admission": "string", "admission_condition_summary": "string", "past_medical_history_relevant": "string" },
    "discharge_details": { "discharge_date": "string (YYYY-MM-DD HH:MM:SS)", "hospital_stay_days": "integer", "discharge_status": "string", "discharge_destination": "string" },
    "diagnoses": [{ "diagnosis_name": "string", "diagnosis_type": "string", "icd10_code": "string", "notes": "string" }],
    "hospitalization_course_summary": "string",
    "main_treatments_during_hospitalization": [{ "treatment_name": "string", "description": "string" }],
    "condition_at_discharge": "string",
    "discharge_instructions": {
      "medications": [{ "med_name": "string", "dosage": "string", "frequency": "string", "route": "string", "duration": "string", "notes": "string" }],
      "lifestyle_recommendations": ["string"],
      "follow_up_appointments": [{ "date_or_interval": "string", "department": "string", "notes": "string" }],
      "rehabilitation_advice": ["string"],
      "precautions_and_warnings": ["string"],
      "other_instructions": ["string"]
    },
    "physician_info": { "attending_physician": "string", "resident_physician": "string", "summary_completion_date": "string" },
    "notes": "string"
  };

  // 精简的 Prompt - 减少 Token 消耗
  const prompt = `识别文档并提取关键信息:
1. 类型: 身份证/医疗发票/出院小结/诊断证明/现场照片/银行卡等
2. OCR提取: 姓名、日期、金额、编号
3. 评分: 清晰度(0-100)、完整度(0-100)
4. 验证必填字段，缺失的加入missingFields数组
5. 生成1句话摘要

返回JSON格式:
{
  "category": "类型",
  "clarityScore": 0-100,
  "completenessScore": 0-100,
  "summary": "摘要",
  "missingFields": ["缺失字段"],
  "ocr": {"name":"","date":"","amount":0,"invoiceNumber":""}
}`;

  const { response, aiLog } = await generateContentViaProxy({
    capabilityId: 'smartclaim.document_analysis',
    contents: {
      parts: [
        { inlineData: { mimeType: mimeType, data: base64 } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
    operation: 'analyze_document',
    context: {
      mimeType,
      claimStatus: state.status,
      ossUrl,
    },
  });

  const result = JSON.parse(response.text || '{}');
  result.ossUrl = ossUrl;

  return { analysis: result, aiLog };
};

export const performFinalAssessment = async (state: ClaimState) => {
  const prompt = `
    FINAL CLAIM ASSESSMENT REQUEST:
    Claim Type: ${state.incidentType}
    Incident Info: ${JSON.stringify(state.reportInfo)}
    Documents OCR Data: ${JSON.stringify(state.documents.filter(d => d.status === 'verified').map(d => ({ cat: d.category, data: d.ocrData })))}
    
    Calculate compensation based on policy limits and extracted OCR amounts.
    Return JSON format:
    {
      "isLiable": boolean,
      "reasoning": "string",
      "clauseReference": "string",
      "items": [
        {"name": "string", "claimed": number, "approved": number, "deduction": "string"}
      ],
      "totalApproved": number,
      "deductible": number,
      "finalAmount": number
    }
  `;

  const { response } = await generateContentViaProxy({
    capabilityId: 'smartclaim.final_assessment',
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      systemInstruction: SYSTEM_PROMPT,
    },
    operation: 'final_assessment',
    context: {
      claimStatus: state.status,
      incidentType: state.incidentType,
    },
  });

  return JSON.parse(response.text || '{}');
};

export const connectLive = (callbacks: any) => {
  throw new Error('Live Gemini browser connection has been disabled. Use the server voice pipeline instead.');
};


// ============================================================================
// 意图识别集成
// ============================================================================

/**
 * 带意图识别的 AI 响应
 * 先进行意图识别，如果是特定意图则执行工具，否则走普通对话
 * @param userInput 用户输入
 * @param messages 对话历史
 * @param state 理赔状态
 * @param userLocation 用户位置
 * @returns 响应结果，包含可能的工具执行结果
 */
export const getAIResponseWithIntent = async (
  userInput: string,
  messages: { role: string; content: string }[],
  state: ClaimState,
  userLocation?: { latitude: number; longitude: number }
): Promise<{
  text: string;
  groundingLinks?: { uri: string; title: string }[];
  aiLog: AIInteractionLog;
  /** 意图识别结果 */
  intentResult?: IntentRecognitionResult;
  /** 工具执行结果 */
  toolResponse?: ToolResponse;
  /** 是否使用了意图工具 */
  usedIntentTool: boolean;
}> => {
  const startTime = Date.now();
  
  // 1. 快速意图检测（轻量级关键词匹配）
  const quickIntent = quickIntentDetection(userInput);
  
  // 如果没有匹配到关键词，直接走普通对话流程
  if (!quickIntent) {
    const normalResponse = await getAIResponse(messages, state, userLocation);
    return {
      ...normalResponse,
      usedIntentTool: false
    };
  }

  // 2. 进行 AI 意图识别
  try {
    const intentResult = await recognizeIntent(userInput, messages, state);
    
    // 3. 如果识别为普通对话，走普通 AI 流程
    if (intentResult.intent === 'GENERAL_CHAT') {
      const normalResponse = await getAIResponse(messages, state, userLocation);
      return {
        ...normalResponse,
        intentResult,
        usedIntentTool: false
      };
    }

    // 4. 执行意图对应的工具
    const toolResponse = await executeIntentTool(intentResult, state);

    // 5. 如果工具有返回消息，直接返回工具结果
    if (toolResponse.message) {
      const aiLog: AIInteractionLog = {
        model: 'intent-recognition',
        prompt: userInput,
        response: JSON.stringify({ intent: intentResult.intent, toolResponse }),
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        usageMetadata: undefined
      };

      return {
        text: toolResponse.message,
        intentResult,
        toolResponse,
        usedIntentTool: true,
        aiLog
      };
    }

    // 6. 工具返回空消息（GENERAL_CHAT 情况），走普通 AI 流程
    const normalResponse = await getAIResponse(messages, state, userLocation);
    return {
      ...normalResponse,
      intentResult,
      toolResponse,
      usedIntentTool: false
    };

  } catch (error) {
    console.error('[Intent Recognition Error]', error);
    // 出错时降级为普通 AI 响应
    const normalResponse = await getAIResponse(messages, state, userLocation);
    return {
      ...normalResponse,
      usedIntentTool: false
    };
  }
};

/**
 * 智能路由 - 根据用户输入自动选择处理方式
 * @param userInput 用户输入
 * @param messages 对话历史
 * @param state 理赔状态
 * @param options 选项
 * @returns 响应结果
 */
export const smartChat = async (
  userInput: string,
  messages: { role: string; content: string }[],
  state: ClaimState,
  options?: {
    userLocation?: { latitude: number; longitude: number };
    /** 强制使用普通对话，跳过意图识别 */
    forceNormalChat?: boolean;
  }
): Promise<{
  text: string;
  groundingLinks?: { uri: string; title: string }[];
  aiLog: AIInteractionLog;
  intentResult?: IntentRecognitionResult;
  toolResponse?: ToolResponse;
  usedIntentTool: boolean;
}> => {
  // 如果强制普通对话，跳过意图识别
  if (options?.forceNormalChat) {
    const normalResponse = await getAIResponse(messages, state, options.userLocation);
    return {
      ...normalResponse,
      usedIntentTool: false
    };
  }

  // 否则使用意图识别流程
  return getAIResponseWithIntent(userInput, messages, state, options?.userLocation);
};
