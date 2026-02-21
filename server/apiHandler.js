import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OSS from "ali-oss";
import { GoogleGenAI } from "@google/genai";
import {
  checkEligibility,
  calculateAmount,
  executeFullReview,
} from "./rules/engine.js";
import { executeSmartReview } from "./ai/agent.js";
import { readAuditLogs, aiCostTracker } from "./middleware/index.js";

// 导入多文件处理服务
import {
  processFile,
  processFiles,
  getFileCategory,
  inferDocumentType,
} from "./services/fileProcessor.js";
import {
  analyzeMultiFiles,
  checkDocumentCompleteness,
} from "./services/multiFileAnalyzer.js";

// 导入定损理算服务
import {
  executeCalculation,
  getAvailableFormulas,
  getFormulaDetail,
  saveFormula as saveFormulaConfig,
} from "./services/calculationEngine.js";
import {
  assessDamage,
  getSupportedInsuranceTypes,
} from "./services/assessmentFactory.js";
import {
  classify,
  getExpenseCategories,
  getSocialSecurityTypes,
} from "./services/expenseClassifier.js";
import { getAllStandards as getInjuryStandards } from "./services/injuryAssessment.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, "jsonlist");

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const getFilePath = (resource) => path.join(dataDir, `${resource}.json`);

// Manual env loader to avoid process.env sync issues in vite dev
const loadEnvConfig = () => {
  const rootEnvPath = path.join(projectRoot, ".env.local");
  if (fs.existsSync(rootEnvPath)) {
    const content = fs.readFileSync(rootEnvPath, "utf8");
    content.split("\n").forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
        // Always update these specific ones for real-time changes
        if (key.startsWith("ALIYUN_OSS_")) process.env[key] = val;
      }
    });
  }
};
loadEnvConfig();

const readData = (resource) => {
  const filePath = getFilePath(resource);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${resource}:`, error);
    return [];
  }
};

const writeData = (resource, data) => {
  const filePath = getFilePath(resource);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error(`Error writing ${resource}:`, error);
    return false;
  }
};

// ID field candidates for matching records
const ID_FIELDS = [
  "id",
  "productCode",
  "code",
  "ruleset_id",
  "field_id",
  "reportNumber",
];

const findItemIndex = (data, id) => {
  if (!Array.isArray(data)) return -1;
  return data.findIndex((item) => {
    for (const field of ID_FIELDS) {
      if (item[field] !== undefined && String(item[field]) === String(id)) {
        return true;
      }
    }
    return false;
  });
};

// Parse request body helper (works with both raw and pre-parsed bodies)
const parseBody = (req) => {
  return new Promise((resolve, reject) => {
    // If body is already parsed (e.g. by express.json()), use it directly
    if (req.body !== undefined && req.body !== null) {
      resolve(req.body);
      return;
    }
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
};

const GLM_OCR_URL = "https://open.bigmodel.cn/api/paas/v4/layout_parsing";
const GLM_CHAT_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
// RapidOCR 服务地址（启动: python server/paddle_ocr_server.py）
const PADDLE_OCR_URL =
  process.env.PADDLE_OCR_URL || "http://localhost:8866/predict/ocr_system";

const getGeminiApiKey = () =>
  process.env.GEMINI_API_KEY ||
  process.env.VITE_GEMINI_API_KEY ||
  process.env.API_KEY;

const loadGraphEngines = async () => {
  const module = await import("./ai/graph.js");
  return {
    executeSmartReviewGraph: module.executeSmartReviewGraph,
    executeSmartReviewGraphV2: module.executeSmartReviewGraphV2,
  };
};

const loadGraphCheckpointer = async () => {
  const module = await import("./ai/graph-with-checkpointer.js");
  return {
    executeSmartReviewWithState: module.executeSmartReviewWithState,
    getReviewState: module.getReviewState,
    submitHumanReview: module.submitHumanReview,
    clearReviewState: module.clearReviewState,
  };
};

const formatErrorMessage = (error) => {
  if (error instanceof Error) {
    const causeMessage =
      error.cause instanceof Error ? error.cause.message : "";
    return causeMessage
      ? `${error.message} | Cause: ${causeMessage}`
      : error.message;
  }
  return "Unknown error";
};

const extractJsonFromText = (text) => {
  if (!text || typeof text !== "string") return "";
  const cleaned = text
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return cleaned.slice(first, last + 1);
  }
  return cleaned;
};

const callGlmChat = async ({ apiKey, model, messages, temperature = 0 }) => {
  const response = await fetch(GLM_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GLM Chat Failed: ${errorText}`);
  }

  return response.json();
};

const hasInlineData = (contents) => {
  const parts = Array.isArray(contents?.parts) ? contents.parts : [];
  return parts.some(
    (part) => part && typeof part === "object" && part.inlineData,
  );
};

const getGeminiModelCandidates = (requested, contents) => {
  const candidates = [];
  if (requested) candidates.push(requested);
  const envDefault =
    process.env.GEMINI_MODEL || process.env.DEFAULT_GEMINI_MODEL;
  if (envDefault && !candidates.includes(envDefault))
    candidates.push(envDefault);
  const visionFallbacks = ["gemini-2.5-flash", "gemini-2.5-pro"];
  const textFallbacks = ["gemini-2.5-flash", "gemini-2.5-pro"];
  const fallbackList = hasInlineData(contents)
    ? visionFallbacks
    : textFallbacks;
  fallbackList.forEach((model) => {
    if (!candidates.includes(model)) candidates.push(model);
  });
  return candidates;
};

const callGemini = async ({ model, contents, temperature = 0.1 }) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API Key not found");
  }
  const ai = new GoogleGenAI({ apiKey });
  const candidates = getGeminiModelCandidates(model, contents);
  let lastError;
  for (const candidate of candidates) {
    try {
      const response = await ai.models.generateContent({
        model: candidate,
        contents,
        config: {
          responseMimeType: "application/json",
          temperature,
        },
      });
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Gemini request failed: ${formatErrorMessage(lastError)}`);
};

// Supported resources
const allowedResources = [
  "products",
  "clauses",
  "strategies",
  "companies",
  "industry-data",
  "insurance-types",
  "responsibilities",
  "claims-materials",
  "claim-items",
  "claim-cases",
  "rulesets",
  "product-claim-configs",
  "end-users",
  "users",
  "mapping-data",
  "medical-insurance-catalog", // 医保目录
  "hospital-info", // 医院信息
  "invoice-audits", // 发票审核记录
  "user-operation-logs", // 用户操作日志
  "quotes", // 询价单
  "policies", // 保单
  "ai", // AI 相关 API (smart-review, review-state 等)
];

export const handleApiRequest = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const match = url.pathname.match(/^\/api\/([^/]+)(?:\/(.+))?$/);

  if (!match) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not Found" }));
    return;
  }

  const resource = match[1];
  const id = match[2] ? decodeURIComponent(match[2]) : null;

  if (resource === "upload-token") {
    const config = {
      region: process.env.ALIYUN_OSS_REGION,
      accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
      bucket: process.env.ALIYUN_OSS_BUCKET,
    };

    console.log("[API] Requested upload-token. Current Config:", {
      region: config.region,
      bucket: config.bucket,
      hasKeyId: !!config.accessKeyId,
      hasSecret: !!config.accessKeySecret,
    });

    if (!config.accessKeyId) {
      console.error("[API] OSS credentials missing in process.env");
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: "OSS credentials not configured on server",
          hint: "Please ensure .env.local in root is set and server restarted if needed.",
        }),
      );
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(config));
    return;
  }

  if (resource === "upload") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { fileName, fileType, base64 } = await parseBody(req);
      if (!base64) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing base64 data" }));
        return;
      }

      const config = {
        region: process.env.ALIYUN_OSS_REGION,
        accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
        bucket: process.env.ALIYUN_OSS_BUCKET,
      };

      if (!config.accessKeyId) {
        throw new Error("OSS credentials not configured on server");
      }

      const client = new OSS(config);
      const buffer = Buffer.from(base64, "base64");

      // Use generating a unique filename if none provided
      const finalFileName =
        fileName ||
        `claims/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

      console.log(`[API] Uploading to OSS via Proxy: ${finalFileName}`);
      const result = await client.put(finalFileName, buffer, {
        mime: fileType || "image/jpeg",
      });

      res.setHeader("Content-Type", "application/json");
      const signedUrl = client.signatureUrl(finalFileName, { expires: 3600 });
      res.end(
        JSON.stringify({
          success: true,
          url: signedUrl,
          name: result.name,
          objectKey: finalFileName,
          publicUrl: result.url,
        }),
      );
    } catch (error) {
      console.error("[API] OSS Proxy Upload Failed:", error);
      res.statusCode = 500;
      res.end(
        JSON.stringify({ error: "Upload failed", message: error.message }),
      );
    }
    return;
  }

  if (resource === "oss-url") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const key = url.searchParams.get("key");
      const expires = Number(url.searchParams.get("expires") || 3600);
      if (!key) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing key" }));
        return;
      }

      const config = {
        region: process.env.ALIYUN_OSS_REGION,
        accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
        bucket: process.env.ALIYUN_OSS_BUCKET,
      };

      if (!config.accessKeyId) {
        throw new Error("OSS credentials not configured on server");
      }

      const client = new OSS(config);
      const signedUrl = client.signatureUrl(key, { expires });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, url: signedUrl }));
    } catch (error) {
      console.error("[API] OSS Signed URL Failed:", error);
      res.statusCode = 500;
      res.end(
        JSON.stringify({ error: "Signed URL failed", message: error.message }),
      );
    }
    return;
  }

  if (resource === "invoice-ocr") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { mode, base64Data, mimeType, prompt, geminiModel, invoiceSchema } =
        await parseBody(req);
      if (!base64Data || !mimeType) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing base64 data or mimeType" }));
        return;
      }

      // PaddleOCR 模式
      if (mode === "paddle-ocr") {
        const ocrStartTime = Date.now();
        let paddleResponse;
        try {
          paddleResponse = await fetch(PADDLE_OCR_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              images: [`data:${mimeType};base64,${base64Data}`],
            }),
          });
        } catch (error) {
          res.statusCode = 502;
          res.end(
            JSON.stringify({
              error: `Paddle OCR fetch failed: ${formatErrorMessage(error)}`,
            }),
          );
          return;
        }

        if (!paddleResponse.ok) {
          const errorText = await paddleResponse.text();
          res.statusCode = paddleResponse.status;
          res.end(JSON.stringify({ error: `Paddle OCR Failed: ${errorText}` }));
          return;
        }

        const paddleResult = await paddleResponse.json();
        const ocrDuration = Date.now() - ocrStartTime;

        // Paddle OCR 返回结果格式: { results: [{ data: [{ text, confidence, text_region }] }] }
        const ocrTexts = (paddleResult.results?.[0]?.data || [])
          .map((item) => item.text)
          .filter(Boolean);
        const ocrText = ocrTexts.join("\n");

        const schemaText = JSON.stringify(invoiceSchema || {}, null, 2);
        const parsePrompt = `以下是中国医疗发票的 OCR 识别结果。请从中提取结构化信息。

## 重要规则
1. 只提取 OCR 文本中**明确存在**的信息，严禁补充或编造
2. 费用明细项目**不要重复**，同一项目只提取一次
3. 注意区分"个人自付"(personalSelfPayment)和"个人自费"(personalSelfExpense)
4. 医院名称优先从票面印刷文字提取
5. 只返回 JSON，不要使用代码块或多余文字

## OCR 原文
${ocrText}

## 输出 JSON 格式
${schemaText}

## 输出规范
- 日期格式：YYYY-MM-DD
- 数字字段：纯数字，不含货币符号或千分位逗号
- 无法识别的字段：字符串用 ""，数字用 0`;

        const parsingStartTime = Date.now();
        const parseResponse = await callGemini({
          model: geminiModel || "gemini-2.5-flash",
          contents: { parts: [{ text: parsePrompt }] },
          temperature: 0,
        });
        const parsingDuration = Date.now() - parsingStartTime;

        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            text: parseResponse.text || "{}",
            usageMetadata: {
              ocr: { textLength: ocrText.length },
              parsing: parseResponse.usageMetadata,
            },
            timing: {
              ocrDuration,
              parsingDuration,
              totalDuration: ocrDuration + parsingDuration,
            },
          }),
        );
        return;
      }

      if (mode === "glm-ocr" || mode === "glm-ocr-structured") {
        const glmApiKey =
          process.env.GLM_OCR_API_KEY || process.env.ZHIPU_API_KEY;
        if (!glmApiKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "GLM OCR API Key not found" }));
          return;
        }

        const ocrStartTime = Date.now();
        const dataUri = `data:${mimeType};base64,${base64Data}`;
        let glmResponse;
        try {
          glmResponse = await fetch(GLM_OCR_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${glmApiKey}`,
            },
            body: JSON.stringify({
              model: "glm-ocr",
              file: dataUri,
            }),
          });
        } catch (error) {
          res.statusCode = 502;
          res.end(
            JSON.stringify({
              error: `GLM OCR fetch failed: ${formatErrorMessage(error)}`,
            }),
          );
          return;
        }

        if (!glmResponse.ok) {
          const errorText = await glmResponse.text();
          res.statusCode = glmResponse.status;
          res.end(JSON.stringify({ error: `GLM OCR Failed: ${errorText}` }));
          return;
        }

        const glmResult = await glmResponse.json();
        const ocrDuration = Date.now() - ocrStartTime;
        const ocrText = glmResult.md_results || "";
        const schemaText = JSON.stringify(invoiceSchema || {}, null, 2);
        const parsePrompt = `以下是中国医疗发票的 OCR 识别结果（Markdown 格式）。请从中提取结构化信息。

## 重要规则
1. 只提取 OCR 文本中**明确存在**的信息，严禁补充或编造
2. 费用明细项目**不要重复**，同一项目只提取一次
3. 注意区分"个人自付"（personalSelfPayment，医保目录内）和"个人自费"（personalSelfExpense，医保目录外）
4. 医院名称优先从票面印刷文字提取，印章文字仅作参考且不要优先采用
5. 忽略 OCR 排版干扰，专注于内容
6. 只返回 JSON，不要使用代码块或多余文字

## OCR 原文
${ocrText}

## 输出 JSON 格式
${schemaText}

## 输出规范
- 日期格式：YYYY-MM-DD
- 数字字段：纯数字，不含货币符号或千分位逗号
- 无法识别的字段：字符串用 ""，数字用 0`;

        if (mode === "glm-ocr-structured") {
          const parsingStartTime = Date.now();
          const glmTextModel =
            process.env.GLM_TEXT_MODEL ||
            process.env.ZHIPU_MODEL ||
            "glm-4.7-flash";
          const glmParseResponse = await callGlmChat({
            apiKey: glmApiKey,
            model: glmTextModel,
            messages: [{ role: "user", content: parsePrompt }],
            temperature: 0,
          });
          const parsingDuration = Date.now() - parsingStartTime;
          const glmContent =
            glmParseResponse?.choices?.[0]?.message?.content || "";
          const extracted = extractJsonFromText(glmContent);

          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              text: extracted || "{}",
              usageMetadata: {
                ocr: glmResult.usage,
                parsing: glmParseResponse.usage,
              },
              timing: {
                ocrDuration,
                parsingDuration,
                totalDuration: ocrDuration + parsingDuration,
              },
            }),
          );
          return;
        }

        const parsingStartTime = Date.now();
        const parseResponse = await callGemini({
          model: geminiModel || "gemini-2.5-flash",
          contents: {
            parts: [{ text: parsePrompt }],
          },
          temperature: 0,
        });
        const parsingDuration = Date.now() - parsingStartTime;

        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            text: parseResponse.text || "{}",
            usageMetadata: {
              ocr: glmResult.usage,
              parsing: parseResponse.usageMetadata,
            },
            timing: {
              ocrDuration,
              parsingDuration,
              totalDuration: ocrDuration + parsingDuration,
            },
          }),
        );
        return;
      }

      const response = await callGemini({
        model: geminiModel || "gemini-2.5-flash",
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: prompt || "" },
          ],
        },
        temperature: 0.1,
      });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          text: response.text || "{}",
          usageMetadata: response.usageMetadata,
        }),
      );
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // ============ 规则引擎 API ============

  // 责任判断 API
  if (resource === "claim" && id === "check-eligibility") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { claimCaseId, productCode, ocrData } = await parseBody(req);
      if (!claimCaseId && !productCode) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({ error: "Missing claimCaseId or productCode" }),
        );
        return;
      }

      const result = await checkEligibility({
        claimCaseId,
        productCode,
        ocrData,
      });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 金额计算 API
  if (resource === "claim" && id === "calculate-amount") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const {
        claimCaseId,
        productCode,
        eligibilityResult,
        invoiceItems,
        ocrData,
      } = await parseBody(req);

      const result = await calculateAmount({
        claimCaseId,
        productCode,
        eligibilityResult,
        invoiceItems,
        ocrData,
      });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 完整审核 API（责任判断 + 金额计算）
  if (resource === "claim" && id === "full-review") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { claimCaseId, productCode, ocrData, invoiceItems } =
        await parseBody(req);
      if (!claimCaseId && !productCode) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({ error: "Missing claimCaseId or productCode" }),
        );
        return;
      }

      const result = await executeFullReview({
        claimCaseId,
        productCode,
        ocrData,
        invoiceItems,
      });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // ============ AI 智能审核 API ============

  // AI 智能审核（LangGraph 版本，默认）
  // 使用环境变量 AI_ENGINE 选择: 'agent' (旧版) | 'graph' (新版) | 'graph-checkpointer' (带状态持久化)
  if (resource === "ai" && id === "smart-review") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { claimCaseId, productCode, ocrData, invoiceItems, engine } =
        await parseBody(req);
      if (!claimCaseId && !productCode) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({ error: "Missing claimCaseId or productCode" }),
        );
        return;
      }

      // 选择 AI 引擎
      const aiEngine = engine || process.env.AI_ENGINE || "graph";

      let result;
      switch (aiEngine) {
        case "agent":
          // 使用旧的 LangChain Agent
          console.log(`[AI] Using agent engine for case ${claimCaseId}`);
          result = await executeSmartReview({
            claimCaseId,
            productCode,
            ocrData,
            invoiceItems,
          });
          break;

        case "graph-checkpointer":
          // 使用 LangGraph + 状态持久化
          console.log(
            `[AI] Using graph-checkpointer engine for case ${claimCaseId}`,
          );
          {
            const { executeSmartReviewWithState } =
              await loadGraphCheckpointer();
            result = await executeSmartReviewWithState({
              claimCaseId,
              productCode,
              ocrData,
              invoiceItems,
            });
          }
          break;

        case "graph":
        default:
          // 使用 LangGraph (推荐)
          console.log(`[AI] Using graph engine for case ${claimCaseId}`);
          {
            const { executeSmartReviewGraph } = await loadGraphEngines();
            result = await executeSmartReviewGraph({
              claimCaseId,
              productCode,
              ocrData,
              invoiceItems,
            });
          }
          break;
      }

      // 添加使用的引擎信息
      result.engine = aiEngine;

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[AI Smart Review Error]", error);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: formatErrorMessage(error),
          decision: "MANUAL_REVIEW",
          reasoning: "智能审核服务异常，请转人工处理",
        }),
      );
    }
    return;
  }

  // 获取审核状态（带状态持久化的版本）
  if (resource === "ai" && id === "review-state") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const claimCaseId = url.searchParams.get("claimCaseId");
      if (!claimCaseId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId" }));
        return;
      }

      const { getReviewState } = await loadGraphCheckpointer();
      const state = await getReviewState(claimCaseId);

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          claimCaseId,
          exists: !!state,
          state,
        }),
      );
    } catch (error) {
      console.error("[AI Review State Error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 提交人工审核（带状态持久化的版本）
  if (resource === "ai" && id === "human-review") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { claimCaseId, decision, auditor, comment } = await parseBody(req);

      if (!claimCaseId || !decision) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId or decision" }));
        return;
      }

      if (!["APPROVE", "REJECT"].includes(decision)) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: "Invalid decision, must be APPROVE or REJECT",
          }),
        );
        return;
      }

      const { submitHumanReview } = await loadGraphCheckpointer();
      const result = await submitHumanReview({
        claimCaseId,
        decision,
        auditor,
        comment,
      });

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[AI Human Review Error]", error);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: formatErrorMessage(error),
          decision: "MANUAL_REVIEW",
          reasoning: "人工审核提交失败",
        }),
      );
    }
    return;
  }

  // 清除审核状态
  if (resource === "ai" && id === "clear-state") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { claimCaseId } = await parseBody(req);
      if (!claimCaseId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId" }));
        return;
      }

      const { clearReviewState } = await loadGraphCheckpointer();
      clearReviewState(claimCaseId);

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, claimCaseId }));
    } catch (error) {
      console.error("[AI Clear State Error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 审计日志查询
  if (resource === "ai" && id === "audit-logs") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const date =
        url.searchParams.get("date") || new Date().toISOString().split("T")[0];
      const type = url.searchParams.get("type") || null;
      const claimCaseId = url.searchParams.get("claimCaseId") || null;

      const logs = readAuditLogs(date, { type, claimCaseId });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          date,
          count: logs.length,
          logs,
        }),
      );
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // AI 调用统计
  if (resource === "ai" && id === "stats") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const stats = aiCostTracker.getStats();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(stats));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // ============ 多文件处理 API ============

  // 单文件处理 API
  if (resource === "process-file") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const {
        ossKey,
        ossUrl,
        fileName,
        mimeType,
        base64Data,
        buffer,
        options,
      } = await parseBody(req);

      if (!ossKey && !fileName) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing ossKey or fileName" }));
        return;
      }

      // 处理文件
      const result = await processFile({
        ossKey,
        ossUrl,
        fileName,
        mimeType,
        buffer: buffer ? Buffer.from(buffer, "base64") : null,
        options: {
          ...options,
          base64Data,
        },
      });

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[process-file error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 多文件联合分析 API
  if (resource === "analyze-multi-files") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { claimCaseId, productCode, documents, options } =
        await parseBody(req);

      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({ error: "Missing or invalid documents array" }),
        );
        return;
      }

      const startTime = Date.now();

      // 1. 处理所有文件
      const parsedDocuments = await processFiles(documents, {
        skipOCR: options?.skipOCR || false,
        skipAI: options?.skipAI || false,
        concurrency: options?.concurrency || 3,
      });

      // 2. 联合分析
      const analysisResult = await analyzeMultiFiles(parsedDocuments, {
        claimCaseId,
        productCode,
        claimInfo: options?.claimInfo,
      });

      const processingTime = Date.now() - startTime;

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          claimCaseId,
          documents: parsedDocuments,
          crossValidation: analysisResult.crossValidation,
          completeness: analysisResult.completeness,
          interventionPoints: analysisResult.interventionPoints,
          summary: analysisResult.summary,
          processingTime,
        }),
      );
    } catch (error) {
      console.error("[analyze-multi-files error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 增强版智能审核 API（支持多文件）
  if (resource === "ai" && id === "smart-review-v2") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const {
        claimCaseId,
        productCode,
        ocrData,
        invoiceItems,
        documents,
        engine,
      } = await parseBody(req);

      if (!claimCaseId && !productCode) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({ error: "Missing claimCaseId or productCode" }),
        );
        return;
      }

      // 使用增强版图引擎
      const { executeSmartReviewGraphV2 } = await loadGraphEngines();
      const result = await executeSmartReviewGraphV2({
        claimCaseId,
        productCode,
        ocrData: ocrData || {},
        invoiceItems: invoiceItems || [],
        documents: documents || [],
      });

      result.engine = engine || "graph-v2";

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[AI Smart Review V2 Error]", error);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: formatErrorMessage(error),
          decision: "MANUAL_REVIEW",
          reasoning: "智能审核服务异常，请转人工处理",
        }),
      );
    }
    return;
  }

  // 文件类型推断 API
  if (resource === "infer-file-type") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { fileName, mimeType, context } = await parseBody(req);

      const category = getFileCategory(mimeType, fileName);
      const documentType = inferDocumentType(fileName, context);

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          fileName,
          mimeType,
          category,
          documentType,
        }),
      );
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // ============ 询价及保单管理专用 API ============

  // 保费计算 API
  if (resource === "calculate-premium") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { productCode, planId, insureds, clauses } = await parseBody(req);

      // 简单的保费计算逻辑（实际应根据费率表计算）
      // 这里返回模拟数据，实际项目应接入费率计算引擎
      const basePremium =
        clauses?.reduce((sum, c) => sum + (c.premium || 0), 0) || 1000;
      const totalPremium = basePremium * (insureds?.length || 1);

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          premium: totalPremium,
          breakdown:
            clauses?.map((c) => ({
              clauseCode: c.clauseCode,
              clauseName: c.clauseName,
              premium: c.premium || basePremium / (clauses?.length || 1),
            })) || [],
        }),
      );
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 询价单转保单 API
  if (resource === "quotes" && id && id.endsWith("/convert")) {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const quoteId = id.replace("/convert", "");
      const quotes = readData("quotes");
      const quoteIdx = findItemIndex(quotes, quoteId);

      if (quoteIdx === -1) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Quote not found" }));
        return;
      }

      const quote = quotes[quoteIdx];

      // 创建保单
      const policies = readData("policies");
      const newPolicyNumber = `POL${Date.now()}`;
      const selectedPlan =
        quote.plans?.find((p) => p.id === quote.selectedPlanId) ||
        quote.plans?.[0];

      const newPolicy = {
        id: `policy-${Date.now()}`,
        policyNumber: newPolicyNumber,
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        status: "草稿",
        productCode: selectedPlan?.productCode || "",
        productName: selectedPlan?.productName || "",
        companyName: selectedPlan?.companyName || "",
        policyholder: quote.policyholder,
        insureds: quote.insureds,
        mainClause:
          selectedPlan?.clauses?.find((c) => c.clauseType === "主险") || {},
        riderClauses:
          selectedPlan?.clauses?.filter((c) => c.clauseType === "附加险") || [],
        specialAgreements: [],
        deductionRules: [],
        effectiveDate: quote.effectiveDate || "",
        expiryDate: quote.expiryDate || "",
        issueDate: new Date().toISOString().split("T")[0],
        totalPremium: selectedPlan?.premium || 0,
        paymentFrequency: "年缴",
        claimCount: 0,
        totalClaimAmount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        operator: quote.operator,
      };

      policies.push(newPolicy);
      writeData("policies", policies);

      // 更新询价单状态
      quotes[quoteIdx] = {
        ...quote,
        status: "已转保单",
        updatedAt: new Date().toISOString(),
      };
      writeData("quotes", quotes);

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, policy: newPolicy }));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 生成保单明细表 API
  if (resource === "policies" && id && id.endsWith("/schedule")) {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const policyId = id.replace("/schedule", "");
      const policies = readData("policies");
      const policyIdx = findItemIndex(policies, policyId);

      if (policyIdx === -1) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Policy not found" }));
        return;
      }

      const policy = policies[policyIdx];

      // 生成明细表
      const scheduleItems = [];

      // 主险明细
      if (policy.mainClause?.clauseCode) {
        scheduleItems.push({
          id: `schedule-${Date.now()}-1`,
          category: "主险",
          itemName: policy.mainClause.clauseName,
          sumInsured: policy.mainClause.sumInsured || 0,
          deductible: 0,
          reimbursementRatio: 100,
          remarks: "",
        });
      }

      // 附加险明细
      policy.riderClauses?.forEach((clause, idx) => {
        scheduleItems.push({
          id: `schedule-${Date.now()}-${idx + 2}`,
          category: "附加险",
          itemName: clause.clauseName,
          sumInsured: clause.sumInsured || 0,
          deductible: 0,
          reimbursementRatio: 100,
          remarks: "",
        });
      });

      const schedule = {
        version: "1.0",
        generatedAt: new Date().toISOString(),
        items: scheduleItems,
        totalSumInsured: scheduleItems.reduce(
          (sum, item) => sum + item.sumInsured,
          0,
        ),
        totalPremium: policy.totalPremium || 0,
      };

      // 更新保单
      policies[policyIdx] = {
        ...policy,
        schedule,
        updatedAt: new Date().toISOString(),
      };
      writeData("policies", policies);

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, schedule }));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // ============ 定损理算 API ============

  // 执行定损（通用接口，按险种区分）
  if (resource === "assess-damage") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const params = await parseBody(req);
      const result = await assessDamage(params);

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[assess-damage error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 执行理算（通用接口，按公式类型区分）
  if (resource === "calculate") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { formulaType, context } = await parseBody(req);
      if (!formulaType) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing formulaType" }));
        return;
      }

      const result = executeCalculation(formulaType, context || {});

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[calculate error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 获取公式列表
  // 获取公式列表
  if (resource === "formulas" && !id) {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const formulas = getAvailableFormulas();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(formulas));
    } catch (error) {
      console.error("[formulas error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 获取/保存公式详情
  if (resource === "formulas" && id) {
    if (req.method === "GET") {
      try {
        const formula = getFormulaDetail(id);
        if (!formula) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Formula not found" }));
        } else {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(formula));
        }
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: formatErrorMessage(error) }));
      }
      return;
    }

    if (req.method === "PUT") {
      try {
        const config = await parseBody(req);
        const success = saveFormulaConfig(id, config);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success }));
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: formatErrorMessage(error) }));
      }
      return;
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  // 费用分类
  if (resource === "classify-expense") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const params = await parseBody(req);
      const result = classify(params);

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[classify-expense error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 获取费用类型列表
  if (resource === "expense-categories") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const categories = getExpenseCategories();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(categories));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 获取社保类型列表
  if (resource === "social-security-types") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const types = getSocialSecurityTypes();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(types));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 获取伤害标准列表
  if (resource === "injury-standards") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const standards = getInjuryStandards();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(standards));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  if (!allowedResources.includes(resource)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: `Invalid Resource: ${resource}` }));
    return;
  }

  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method === "GET") {
      const data = readData(resource);
      if (id) {
        const idx = findItemIndex(data, id);
        if (idx === -1) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Item not found" }));
        } else {
          res.end(JSON.stringify(data[idx]));
        }
      } else {
        res.end(JSON.stringify(data));
      }
    } else if (req.method === "POST") {
      const newItem = await parseBody(req);
      const data = readData(resource);

      // 特殊处理：批量日志插入
      if (
        resource === "user-operation-logs" &&
        newItem.logs &&
        Array.isArray(newItem.logs)
      ) {
        data.push(...newItem.logs);
        writeData(resource, data);
        res.statusCode = 201;
        res.end(JSON.stringify({ success: true, count: newItem.logs.length }));
      } else {
        // 原有逻辑：单个插入
        data.push(newItem);
        writeData(resource, data);
        res.statusCode = 201;
        res.end(JSON.stringify({ success: true, data: newItem }));
      }
    } else if (req.method === "PUT") {
      const payload = await parseBody(req);
      if (id) {
        const data = readData(resource);
        const idx = findItemIndex(data, id);
        if (idx === -1) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Item not found" }));
        } else {
          data[idx] = { ...data[idx], ...payload };
          writeData(resource, data);
          res.end(JSON.stringify({ success: true, data: data[idx] }));
        }
      } else {
        writeData(resource, payload);
        res.end(
          JSON.stringify({
            success: true,
            count: Array.isArray(payload) ? payload.length : 1,
          }),
        );
      }
    } else if (req.method === "DELETE") {
      if (!id) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "DELETE requires an ID" }));
        return;
      }
      const data = readData(resource);
      const idx = findItemIndex(data, id);
      if (idx === -1) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Item not found" }));
      } else {
        const removed = data.splice(idx, 1)[0];
        writeData(resource, data);
        res.end(JSON.stringify({ success: true, data: removed }));
      }
    } else {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
    }
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: e.message || "Bad Request" }));
  }
};
