
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { ClaimState, ClaimStatus, PolicyTerm, DocumentAnalysis } from "./types";
import { uploadToOSS } from "./ossService";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  const ai = getAI();
  // Using gemini-2.5-flash for maps grounding support
  const model = 'gemini-2.5-flash';

  const prompt = `
    Current Claim State: ${JSON.stringify(state)}
    History: ${messages.map(m => `${m.role}: ${m.content}`).join('\n')}
    
    Task: Respond to the user's latest message. 
    If you've gathered enough info to change status, indicate it. 
    Always prioritize completing the current step.
    If the user mentions an accident location or you need to find a place, use the Google Maps tool.
  `;

  const config: any = {
    systemInstruction: SYSTEM_PROMPT,
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

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config,
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
    groundingLinks
  };
};

export const transcribeAudio = async (base64Audio: string): Promise<string> => {
  const ai = getAI();
  const model = 'gemini-3-flash-preview';
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: base64Audio, mimeType: 'audio/wav' } },
        { text: "请精准转录这段语音内容，仅返回转录的文本，不要有其他解释。" }
      ]
    }
  });
  return response.text || "";
};

export const fetchPolicyTerms = async (incidentType: string): Promise<PolicyTerm[]> => {
  const ai = getAI();
  const model = 'gemini-3-flash-preview';
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

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Failed to parse policy terms", e);
    return [];
  }
};

export const quickAnalyze = async (base64: string, mimeType: string): Promise<{ category: string; needsDeepAnalysis: boolean; ossUrl: string }> => {
  // Run OSS upload in parallel - don't block AI analysis if upload fails
  const ossPromise = uploadToOSS(base64, mimeType).catch(err => {
    console.warn('OSS upload failed, continuing with analysis:', err);
    return '';
  });

  const ai = getAI();
  const model = 'gemini-2.5-flash';

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: "快速识别文档类型，返回JSON: {\"category\": \"类型(身份证/医疗发票/出院小结/诊断证明/现场照片/银行卡等)\", \"needsDeepAnalysis\": true/false}" }
      ]
    },
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    }
  });

  const ossUrl = await ossPromise;

  try {
    const result = JSON.parse(response.text || '{"category":"未知","needsDeepAnalysis":false}');
    return { ...result, ossUrl };
  } catch {
    return { category: '未知', needsDeepAnalysis: false, ossUrl };
  }
};

export const analyzeDocument = async (base64: string, mimeType: string, state: ClaimState, ossUrl: string): Promise<DocumentAnalysis> => {
  const ai = getAI();
  const model = 'gemini-2.5-flash';

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

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { mimeType: mimeType, data: base64 } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    }
  });

  const result = JSON.parse(response.text || '{}');
  result.ossUrl = ossUrl;

  return result;
};

export const performFinalAssessment = async (state: ClaimState) => {
  const ai = getAI();
  const model = 'gemini-3-pro-preview';
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

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      systemInstruction: SYSTEM_PROMPT,
    }
  });

  return JSON.parse(response.text || '{}');
};

export const connectLive = (callbacks: any) => {
  const ai = getAI();
  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
      },
      systemInstruction: SYSTEM_PROMPT + " Now you are interacting via live audio. Be concise but empathetic. Guide the user verbally.",
      inputAudioTranscription: {},
      outputAudioTranscription: {}
    },
  });
};
