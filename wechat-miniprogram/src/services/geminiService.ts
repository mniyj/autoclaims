// 智能理赔微信小程序 - Gemini AI 服务
// 从 smartclaim-ai-agent/geminiService.ts 迁移并适配到Taro

import Taro from '@tarojs/taro';
import { GoogleGenAI } from '@google/genai';
import { ClaimState, ClaimStatus, PolicyTerm, DocumentAnalysis, Message } from '../types';

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// 分析缓存（小程序端可用）
const analysisCache = new Map<string, DocumentAnalysis>();

/**
 * 获取AI响应（小程序API调用）
 */
export const getAIResponse = async (
  messages: { role: string; content: string }[],
  state: ClaimState,
  userLocation?: { latitude: number; longitude: number }
): Promise<Message> => {
  const ai = getAI();

  // 使用 gemini-2.5-flash 支持地图定位
  const model = 'gemini-2.5-flash';

  const config: any = {
    systemInstruction: SYSTEM_PROMPT,
    temperature: 0.7,
    tools: undefined // 小程序端暂不需要工具函数
  };

  // 如果有用户位置，添加Maps工具
  if (userLocation) {
    config.tools = [{
      googleMaps: {
        location: {
          latLng: userLocation
        }
      }
    }];
  }

  const prompt = `
Current Claim State: ${JSON.stringify(state)}
History: ${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Task: Respond to the user's latest message.
`;

  const startTime = Date.now();
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config
  });
  const duration = Date.now() - startTime;

  // 尝试解析响应
  let content = response.text || "我暂时无法回答。";
  let groundingLinks: { uri: string; title: string }[] = [];

  try {
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      const groundingMetadata = candidate.groundingMetadata;

      if (groundingMetadata) {
        groundingLinks = groundingMetadata.groundingChunks
          ?.map((chunk: any) => {
            if (chunk.maps) {
              return { uri: chunk.maps.uri, title: chunk.maps.title };
            }
            if (chunk.web) {
              return { uri: chunk.web.uri, title: chunk.web.title };
            }
            return null;
          })
          .filter((link: any) => link !== null);
      }
    }
  } catch (e) {
    console.warn('Failed to parse AI response:', e);
  }

  return {
    id: generateId(),
    role: 'assistant',
    content,
    timestamp: Date.now(),
    groundingLinks
  };
};

/**
 * 语音转文字（小程序语音输入）
 */
export const transcribeAudio = async (audioBase64: string): Promise<string> => {
  const ai = getAI();

  // 使用 gemini-3-flash-preview 支持音频
  const model = 'gemini-3-flash-preview';

  const response = await ai.models.generateContent({
    model,
    contents: [{
      parts: [
        { inlineData: { data: audioBase64, mimeType: 'audio/wav' } },
        { text: "请精准转录这段语音内容，仅返回转录的文本，不要有其他解释。" }
      ]
    }]
  });

  return response.text || "";
};

/**
 * 获取保单条款
 */
export const fetchPolicyTerms = async (incidentType: string): Promise<PolicyTerm[]> => {
  const ai = getAI();

  const model = 'gemini-3-flash-preview';

  const prompt = `
Generate a list of 3-4 insurance policy terms and conditions specifically for incident type: ${incidentType}.

Each term should have:
- id: term_xxx
- title: Clause Title
- content: Formal legal description in Chinese
- category: Main Category

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

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json"
    }
  });

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Failed to parse policy terms", e);
    return [];
  }
};

/**
 * 系统提示词
 */
const SYSTEM_PROMPT = `You are a Senior Insurance Claim AI Adjuster.

Your goal is to guide users through the claim process via WeChat Mini Program.

Claim Process:
1. REPORTING: Ask for incident time, location, policy number, and description. Identify incident type (e.g., Medical, Auto, Property).
2. DOCUMENTING: Based on incident type, list required docs. Provide clear examples.
3. VALIDATION & OCR: Analyze uploaded materials. Extract key info like dates, amounts, and names. Confirm if they match required types.
4. ASSESSMENT:
   - First, determine liability based on policy rules.
   - If not liable, quote the clause.
   - If liable, calculate payout per item (Limits, Deductibles, Special terms).
5. PAYMENT: Confirm banking details and initiate transfer.

Current Policy Rules (Mock):
- Auto: Coverage up to $100k, Deductible $500. Not liable if driver was unlicensed.
- Medical: 90% reimbursement, Max $50k. Requires official receipts.
- Property: Max $200k. Not liable for natural wear/tear.
- Travel: Coverage for travel delays. Personal negligence exclusions apply.

When asking for a location or discussing geography, use Google Maps to provide accurate and up-to-date place information.

Always return helpful, empathetic, but professional responses. Use Chinese for user-facing content.`;

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
