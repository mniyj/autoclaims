
import { GoogleGenAI } from "@google/genai";
import { ClaimState, DocumentAnalysis } from "./types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// 优化1: 简化 Prompt，减少 Token 消耗
const SIMPLE_PROMPT = `识别文档类型并提取关键信息。
类型: 身份证/驾驶证/医疗发票/出院小结/诊断证明/现场照片/银行卡等
提取: 姓名、日期、金额、编号
返回JSON格式`;

// 优化2: 分级处理 - 快速识别 + 按需深度解析
export const quickAnalyze = async (base64: string, mimeType: string): Promise<{ category: string; needsDeepAnalysis: boolean }> => {
  const ai = getAI();
  const model = 'gemini-2.5-flash'; // 使用更快的模型
  
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: "快速识别文档类型，返回JSON: {\"category\": \"类型\", \"needsDeepAnalysis\": true/false}" }
      ]
    },
    config: {
      responseMimeType: "application/json",
      temperature: 0.1, // 降低温度提高速度
    }
  });

  return JSON.parse(response.text || '{}');
};

// 优化3: 批量处理 - 减少网络往返
export const analyzeBatch = async (
  files: Array<{ base64: string; mimeType: string; name: string }>,
  state: ClaimState
): Promise<DocumentAnalysis[]> => {
  const ai = getAI();
  const model = 'gemini-2.5-flash';
  
  // 将多个文件合并为一次请求
  const parts = files.flatMap((file, idx) => [
    { inlineData: { mimeType: file.mimeType, data: file.base64 } },
    { text: `文件${idx + 1}: ${file.name}` }
  ]);
  
  parts.push({ 
    text: `批量识别以上${files.length}个文档，返回JSON数组: [{"category":"类型","ocr":{"name":"","date":"","amount":0}}]` 
  });

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    }
  });

  return JSON.parse(response.text || '[]');
};

// 优化4: 缓存机制
const analysisCache = new Map<string, DocumentAnalysis>();

const getFileHash = (base64: string): string => {
  // 使用前100字符作为简单哈希
  return btoa(base64.slice(0, 100));
};

export const analyzeDocumentOptimized = async (
  base64: string, 
  mimeType: string, 
  state: ClaimState
): Promise<DocumentAnalysis> => {
  // 检查缓存
  const hash = getFileHash(base64);
  if (analysisCache.has(hash)) {
    return analysisCache.get(hash)!;
  }

  const ai = getAI();
  const model = 'gemini-2.5-flash'; // 更快的模型
  
  // 精简的 Prompt
  const prompt = `OCR识别并提取:
1. 类型(身份证/医疗发票/出院小结等)
2. 关键字段: 姓名、日期、金额、编号
3. 清晰度评分(0-100)
返回JSON`;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    }
  });

  const result = JSON.parse(response.text || '{}');
  
  // 缓存结果
  analysisCache.set(hash, result);
  
  // 限制缓存大小
  if (analysisCache.size > 100) {
    const firstKey = analysisCache.keys().next().value;
    analysisCache.delete(firstKey);
  }

  return result;
};

// 优化5: 深度解析仅在需要时调用
export const deepAnalyze = async (
  base64: string,
  mimeType: string,
  category: string,
  state: ClaimState
): Promise<any> => {
  const ai = getAI();
  const model = 'gemini-3-flash-preview';
  
  let schema = {};
  if (category === '医疗发票') {
    schema = {
      basicInfo: { name: "string", admissionDate: "string", department: "string" },
      chargeItems: [{ itemName: "string", quantity: "number", totalPrice: "number" }],
      totalAmount: "number"
    };
  } else if (category === '出院小结') {
    schema = {
      patient_info: { name: "string", gender: "string", age: "integer" },
      diagnoses: [{ diagnosis_name: "string" }],
      discharge_date: "string"
    };
  }

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: `提取${category}详细信息，返回JSON: ${JSON.stringify(schema)}` }
      ]
    },
    config: {
      responseMimeType: "application/json",
    }
  });

  return JSON.parse(response.text || '{}');
};
