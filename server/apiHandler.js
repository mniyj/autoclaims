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
import {
  readAuditLogs,
  writeAuditLog,
  logAIReview,
  AuditLogType,
  aiCostTracker,
} from "./middleware/index.js";

// 导入多文件处理服务
import {
  processFile,
  processFiles,
  getFileCategory,
  inferDocumentType,
} from "./services/fileProcessor.js";
import { readData, writeData } from "./utils/fileStore.js";
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

// 导入人伤案件处理服务
import {
  preprocessFiles,
  isContainerFormat,
  getContainerType,
} from "./services/preprocessor.js";
import { checkDuplicatesBatch } from "./services/duplicateDetector.js";
import { extractDocumentSummaries } from "./services/summaryExtractors/index.js";
import { aggregateCase } from "./services/caseAggregator.js";
import { generateDamageReport } from "./services/reportGenerator.js";

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
  "category-material-configs",
  "accident-cause-configs",
  "end-users",
  "users",
  "mapping-data",
  "medical-insurance-catalog", // 医保目录
  "hospital-info", // 医院信息
  "invoice-audits", // 发票审核记录
  "user-operation-logs", // 用户操作日志
  "quotes", // 询价单
  "policies", // 保单
  "claim-documents", // 赔案导入材料
  "system-logs", // 系统审计日志
  "ai", // AI 相关 API (smart-review, review-state 等)
];

export const handleApiRequest = async (req, res) => {
  console.log(`[API] Request: ${req.method} ${req.url}`);
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

      let config = {
        region: process.env.ALIYUN_OSS_REGION,
        accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
        bucket: process.env.ALIYUN_OSS_BUCKET,
      };

      // Fallback to local storage if OSS is not configured or upload fails
      let uploadToOssFailed = false;
      if (!config.accessKeyId || !config.accessKeySecret || !config.bucket) {
        console.warn(
          "[API] OSS credentials not configured. Falling back to local storage.",
        );
        uploadToOssFailed = true;
      }

      const buffer = Buffer.from(base64, "base64");
      // Use generating a unique filename if none provided
      // Ensure directory exists for local storage structure simulation
      const finalFileName =
        fileName ||
        `claims/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

      if (!uploadToOssFailed) {
        try {
          const client = new OSS(config);
          console.log(`[API] Uploading to OSS via Proxy: ${finalFileName}`);
          const result = await client.put(finalFileName, buffer, {
            mime: fileType || "image/jpeg",
          });

          res.setHeader("Content-Type", "application/json");
          const signedUrl = client.signatureUrl(finalFileName, {
            expires: 3600,
          });
          res.end(
            JSON.stringify({
              success: true,
              url: signedUrl,
              name: result.name,
              objectKey: finalFileName,
              publicUrl: result.url,
            }),
          );
          return;
        } catch (ossError) {
          console.error("[API] OSS Proxy Upload Failed:", ossError);
          console.warn("[API] Falling back to local storage.");
          uploadToOssFailed = true;
        }
      }

      if (uploadToOssFailed) {
        // Local storage fallback
        const uploadsDir = path.join(projectRoot, "uploads");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Strip directory from filename for local storage to avoid subdirectory issues or ensure they exist
        const localFileName = path.basename(finalFileName);
        const localFilePath = path.join(uploadsDir, localFileName);

        fs.writeFileSync(localFilePath, buffer);
        console.log(`[API] Saved to local storage: ${localFilePath}`);

        const localUrl = `/uploads/${localFileName}`;

        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            success: true,
            url: localUrl,
            name: localFileName,
            objectKey: localFileName,
            publicUrl: localUrl,
          }),
        );
        return;
      }
    } catch (error) {
      console.error("[API] Upload Failed:", error);
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
      const srStartTime = Date.now();
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

      // 写审计日志
      logAIReview({
        claimCaseId,
        productCode,
        decision: result.decision,
        amount: result.amount,
        toolCalls: result.ruleTrace,
        duration: Date.now() - srStartTime,
        success: true,
      });

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
      const pfStartTime = Date.now();
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

      // 处理文件（OCR + 结构化提取）
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

      // 如果要求分类且 OCR 成功，调用 AI 对照 claims-materials 目录进行材料类型识别
      if (options?.classify && result.parseStatus === "completed") {
        try {
          const materials = readData("claims-materials");
          if (materials.length > 0) {
            // 构建紧凑目录（避免 prompt 过长）
            const catalog = materials
              .map((m) => `${m.id}|${m.name}|${m.description.slice(0, 60)}`)
              .join("\n");

            const ocrText = result.extractedText || "";
            const prompt = [
              {
                role: "user",
                parts: [
                  {
                    text: `你是保险理赔材料分类专家。请根据以下 OCR 文字内容，从材料目录中选出最匹配的材料类型。\n\n【OCR 文字】\n${ocrText.slice(0, 1200)}\n\n【文件名参考】${fileName}\n\n【材料目录（格式: id|名称|说明摘要）】\n${catalog}\n\n请返回 JSON：{"materialId":"...","materialName":"...","confidence":0.0到1.0之间的小数,"reason":"简短说明"}。若无匹配则 materialId 填 "unknown"，materialName 填 "未识别"，confidence 填 0。`,
                  },
                ],
              },
            ];

            const response = await callGemini({
              model: "gemini-2.0-flash",
              contents: prompt,
              temperature: 0.1,
            });

            const raw =
              response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            let parsed = {};
            try {
              parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
            } catch {
              // JSON 解析失败则保持 unknown
            }

            result.classification = {
              materialId: parsed.materialId || "unknown",
              materialName: parsed.materialName || "未识别",
              confidence:
                typeof parsed.confidence === "number" ? parsed.confidence : 0,
            };
            console.log(
              `[classify] ${fileName} → ${result.classification.materialName} (${(result.classification.confidence * 100).toFixed(0)}%)`,
            );
          }
        } catch (classifyErr) {
          console.warn("[classify] 分类失败，跳过:", classifyErr.message);
          // 不影响主流程，result.classification 保持未设置
        }
      }

      // 写审计日志
      writeAuditLog({
        type: AuditLogType.API_CALL,
        endpoint: "POST /api/process-file",
        fileName,
        mimeType,
        parseStatus: result.parseStatus,
        classificationResult: result.classification
          ? `${result.classification.materialName}(${(result.classification.confidence * 100).toFixed(0)}%)`
          : "未分类",
        duration: Date.now() - pfStartTime,
        success: result.parseStatus === "completed",
        error: result.errorMessage || null,
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

  // 赔案材料查询 API
  if (resource === "claim-documents" && req.method === "GET") {
    const claimCaseId = url.searchParams.get("claimCaseId");
    const allDocs = readData("claim-documents");

    if (claimCaseId) {
      // Return all import records for this claim, flattened into a single document list
      const records = allDocs.filter((r) => r.claimCaseId === claimCaseId);
      const documents = records.flatMap((r) =>
        (r.documents || []).map((d) => ({
          ...d,
          importedAt: r.importedAt,
          importId: r.id,
        })),
      );
      const latestCompleteness =
        records.length > 0 ? records[records.length - 1].completeness : null;

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          claimCaseId,
          documents,
          completeness: latestCompleteness,
          totalImports: records.length,
        }),
      );
    } else {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(allDocs));
    }
    return;
  }

  // 离线材料导入 API
  if (resource === "import-offline-materials") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const {
        claimCaseId,
        productCode,
        files: uploadedFiles,
      } = await parseBody(req);

      if (!claimCaseId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId" }));
        return;
      }

      if (
        !uploadedFiles ||
        !Array.isArray(uploadedFiles) ||
        uploadedFiles.length === 0
      ) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing or empty files array" }));
        return;
      }

      const startTime = Date.now();

      // 1. Process all files (OCR + classification)
      const documents = [];
      for (const file of uploadedFiles) {
        try {
          const result = await processFile({
            fileName: file.fileName,
            mimeType: file.mimeType,
            options: {
              base64Data: file.base64Data,
              extractText: true,
              classify: true,
            },
          });

          documents.push({
            documentId: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fileName: file.fileName,
            fileType: file.mimeType,
            ossUrl: result.ossUrl || null,
            extractedText: result.extractedText || "",
            structuredData: result.structuredData || {},
            classification: result.classification || {
              materialId: result.documentType?.id || "unknown",
              materialName: result.documentType?.name || "未识别",
              confidence: result.documentType?.confidence || 0,
            },
            status: "completed",
          });
        } catch (fileError) {
          console.error(
            `[import-offline-materials] Failed to process ${file.fileName}:`,
            fileError,
          );
          documents.push({
            documentId: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fileName: file.fileName,
            fileType: file.mimeType,
            classification: {
              materialId: "unknown",
              materialName: "处理失败",
              confidence: 0,
            },
            status: "failed",
            errorMessage: fileError.message || "处理失败",
          });
        }
      }

      // 2. Check completeness
      let completeness = {
        isComplete: false,
        completenessScore: 0,
        requiredMaterials: [],
        providedMaterials: [],
        missingMaterials: [],
        warnings: [],
      };

      try {
        const analysisResult = await analyzeMultiFiles(documents, {
          claimCaseId,
          productCode,
        });
        completeness = analysisResult.completeness || completeness;
      } catch (analysisError) {
        console.error(
          "[import-offline-materials] Completeness check failed:",
          analysisError,
        );
        completeness.warnings.push("完整性检查失败，请手动核实");
      }

      const processingTime = Date.now() - startTime;

      // 3. Persist documents to claim-documents.json
      const allClaimDocs = readData("claim-documents");
      const importRecord = {
        id: `import-${Date.now()}`,
        claimCaseId,
        productCode,
        importedAt: new Date().toISOString(),
        documents: documents.map((d) => ({
          ...d,
          // Don't store extractedText in the list (too large); keep it on demand
          extractedText: undefined,
        })),
        completeness,
      };
      allClaimDocs.push(importRecord);
      writeData("claim-documents", allClaimDocs);

      // 4. Build summary
      const successCount = documents.filter(
        (d) => d.status === "completed",
      ).length;
      const failCount = documents.filter((d) => d.status === "failed").length;
      const summary = `成功处理 ${successCount} 个文件${failCount > 0 ? `，${failCount} 个失败` : ""}，耗时 ${processingTime}ms`;

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          claimCaseId,
          documents,
          completeness,
          summary,
          processingTime,
        }),
      );
    } catch (error) {
      console.error("[import-offline-materials error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
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

  // ============ 理赔材料计算 API ============

  // 计算理赔材料清单
  if (resource === "claim-materials" && id === "calculate") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const { calculateMaterials } = await import("./services/materialCalculator.js");
      const params = await parseBody(req);
      const result = await calculateMaterials(params);

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("[calculate-materials error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({
        success: false,
        error: formatErrorMessage(error),
        materials: [],
        summary: { totalCount: 0, requiredCount: 0, optionalCount: 0 }
      }));
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

  // ============ 人伤案件专用 API ============

  // 批量导入人伤材料（含预处理、去重、摘要提取、聚合）
  if (resource === "import-injury-case") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const {
        claimCaseId,
        productCode,
        files: uploadedFiles,
        operator = "系统",
      } = await parseBody(req);

      if (!claimCaseId || !uploadedFiles?.length) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId or files" }));
        return;
      }

      const startTime = Date.now();

      // 1. 预处理：格式验证 + SHA-256 指纹
      const preprocessResults = await preprocessFiles(uploadedFiles);

      // 收集预处理警告
      const preprocessWarnings = preprocessResults.flatMap((r, i) =>
        r.warnings.map((w) => `[${uploadedFiles[i].fileName}] ${w}`),
      );

      // 2. 获取案件中已有的文件（用于去重）
      const allClaimDocs = readData("claim-documents");
      const existingRecords = allClaimDocs.filter(
        (r) => r.claimCaseId === claimCaseId,
      );
      const existingDocs = existingRecords.flatMap((r) => r.documents || []);

      // 3. 为每个文件附加 sha256 指纹，执行去重检测
      const filesWithHash = uploadedFiles.map((f, i) => ({
        ...f,
        sha256: preprocessResults[i]?.sha256,
        exifRotation: preprocessResults[i]?.exifRotation,
        preprocessWarnings: preprocessResults[i]?.warnings || [],
      }));

      const duplicateResults = checkDuplicatesBatch(
        filesWithHash,
        existingDocs,
      );

      // 过滤：仅处理非精确重复文件（相似文件保留，由前端决定）
      const exactDuplicateFiles = filesWithHash.filter(
        (_, i) => duplicateResults[i]?.duplicateType === "exact",
      );
      const filesToProcess = filesWithHash.filter(
        (_, i) => duplicateResults[i]?.duplicateType !== "exact",
      );

      // 生成 batchId
      const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // 4. OCR + 文档分类（复用现有 processFile）
      const documents = [];
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const dupeResult = duplicateResults[filesWithHash.indexOf(file)];

        try {
          const result = await processFile({
            fileName: file.fileName,
            mimeType: file.mimeType,
            options: {
              base64Data: file.base64Data,
              extractText: true,
              classify: true,
            },
          });

          documents.push({
            documentId: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            batchId,
            fileName: file.fileName,
            fileType: file.mimeType,
            ossUrl: result.ossUrl || null,
            extractedText: result.extractedText || "",
            structuredData: result.structuredData || {},
            classification: result.classification || {
              materialId: result.documentType?.id || "unknown",
              materialName: result.documentType?.name || "未识别",
              confidence: result.documentType?.confidence || 0,
            },
            status: "completed",
            sha256: file.sha256,
            exifRotation: file.exifRotation,
            preprocessWarnings: file.preprocessWarnings,
            // 相似文件标记（非精确重复但相似）
            duplicateWarning: dupeResult?.isDuplicate ? dupeResult : null,
            importedAt: new Date().toISOString(),
          });
        } catch (fileError) {
          console.error(
            `[import-injury-case] Failed to process ${file.fileName}:`,
            fileError,
          );
          documents.push({
            documentId: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            batchId,
            fileName: file.fileName,
            fileType: file.mimeType,
            classification: {
              materialId: "unknown",
              materialName: "处理失败",
              confidence: 0,
            },
            status: "failed",
            errorMessage: fileError.message || "处理失败",
            sha256: file.sha256,
            importedAt: new Date().toISOString(),
          });
        }
      }

      // 5. 类型化摘要提取（仅 completed 文件）
      const completedDocs = documents.filter((d) => d.status === "completed");
      const summaries = await extractDocumentSummaries(completedDocs);
      // 将摘要附加到对应文档
      completedDocs.forEach((doc, i) => {
        if (summaries[i]) {
          doc.documentSummary = summaries[i];
        }
      });

      // 6. 完整性检查（复用现有服务）
      let completeness = {
        isComplete: false,
        completenessScore: 0,
        requiredMaterials: [],
        providedMaterials: [],
        missingMaterials: [],
        warnings: [...preprocessWarnings],
      };
      try {
        const analysisResult = await analyzeMultiFiles(documents, {
          claimCaseId,
          productCode,
        });
        completeness = {
          ...(analysisResult.completeness || completeness),
          warnings: [
            ...preprocessWarnings,
            ...(analysisResult.completeness?.warnings || []),
          ],
        };
      } catch (e) {
        completeness.warnings.push("完整性检查失败，请手动核实");
      }

      // 7. 案件级数据聚合
      const aggregationResult = aggregateCase({ summaries, claimCaseId });

      // 8. 持久化
      const importRecord = {
        id: `import-${Date.now()}`,
        batchId,
        claimCaseId,
        productCode,
        importedAt: new Date().toISOString(),
        importedBy: operator,
        fileCount: uploadedFiles.length,
        successCount: documents.filter((d) => d.status === "completed").length,
        failCount: documents.filter((d) => d.status === "failed").length,
        exactDuplicateCount: exactDuplicateFiles.length,
        sourceType: "manual",
        documents: documents.map((d) => ({ ...d, extractedText: undefined })),
        completeness,
        aggregation: { ...aggregationResult, summaries: undefined },
      };
      allClaimDocs.push(importRecord);
      writeData("claim-documents", allClaimDocs);

      const processingTime = Date.now() - startTime;
      const summary = `成功处理 ${importRecord.successCount} 个文件${importRecord.failCount > 0 ? `，${importRecord.failCount} 个失败` : ""}${exactDuplicateFiles.length > 0 ? `，${exactDuplicateFiles.length} 个跳过（重复）` : ""}，耗时 ${processingTime}ms`;

      // 写审计日志
      writeAuditLog({
        type: AuditLogType.API_CALL,
        endpoint: "POST /api/import-injury-case",
        claimCaseId,
        batchId,
        fileCount: importRecord.fileCount,
        successCount: importRecord.successCount,
        failCount: importRecord.failCount,
        skippedDuplicates: exactDuplicateFiles.length,
        duration: processingTime,
        success: true,
      });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          batchId,
          claimCaseId,
          documents,
          summaries,
          completeness,
          aggregation: aggregationResult,
          duplicateSkipped: exactDuplicateFiles.map((f) => f.fileName),
          duplicateWarnings: duplicateResults.filter(
            (r) => r.isDuplicate && r.duplicateType === "similar",
          ),
          preprocessWarnings,
          summary,
          processingTime,
        }),
      );
    } catch (error) {
      console.error("[import-injury-case error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 生成定损报告
  if (resource === "generate-damage-report") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    try {
      const grStartTime = Date.now();
      const { claimCaseId, standards, claimantAge } = await parseBody(req);
      if (!claimCaseId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Missing claimCaseId" }));
        return;
      }

      // 读取最新的聚合数据
      const allClaimDocs = readData("claim-documents");
      const latestImport = allClaimDocs
        .filter((r) => r.claimCaseId === claimCaseId && r.aggregation)
        .sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt))[0];

      if (!latestImport?.aggregation) {
        res.statusCode = 404;
        res.end(
          JSON.stringify({ error: "未找到该案件的聚合数据，请先执行批量导入" }),
        );
        return;
      }

      // 读取案件基础信息
      const claimCases = readData("claim-cases");
      const claimCase = claimCases.find((c) => c.id === claimCaseId) || {};

      const report = generateDamageReport({
        claimCaseId,
        aggregationResult: latestImport.aggregation,
        claimCase,
        standards: standards || {},
        claimantAge: claimantAge || 35,
      });

      // 保存报告
      const reports = readData("damage-reports") || [];
      reports.push({ ...report, reportHtml: undefined }); // 不存 HTML 到 JSON
      writeData("damage-reports", reports);

      // 写审计日志
      writeAuditLog({
        type: AuditLogType.API_CALL,
        endpoint: "POST /api/generate-damage-report",
        claimCaseId,
        reportId: report.reportId,
        finalAmount: report.finalAmount,
        itemCount: report.items?.length || 0,
        duration: Date.now() - grStartTime,
        success: true,
      });

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(report));
    } catch (error) {
      console.error("[generate-damage-report error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatErrorMessage(error) }));
    }
    return;
  }

  // 获取案件定损报告
  if (resource === "damage-reports") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    const caseId = new URL(req.url, "http://x").searchParams.get("claimCaseId");
    const reports = readData("damage-reports") || [];
    const filtered = caseId
      ? reports.filter((r) => r.claimCaseId === caseId)
      : reports;

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(filtered));
    return;
  }

  // 系统日志查询
  if (resource === "system-logs") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    const params = new URL(req.url, "http://x").searchParams;

    // GET /api/system-logs/stats → 返回今日 AI 成本统计
    if (id === "stats") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(aiCostTracker.getStats()));
      return;
    }

    // GET /api/system-logs?date=YYYY-MM-DD&type=...&claimCaseId=...
    const date = params.get("date") || new Date().toISOString().split("T")[0];
    const type = params.get("type") || null;
    const claimCaseId = params.get("claimCaseId") || null;
    const limit = Math.min(parseInt(params.get("limit") || "200", 10), 500);

    const filters = {};
    if (type) filters.type = type;
    if (claimCaseId) filters.claimCaseId = claimCaseId;

    const logs = readAuditLogs(date, filters);
    const limited = logs.slice(-limit).reverse(); // 最新的在前

    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        date,
        total: logs.length,
        returned: limited.length,
        filters: { type, claimCaseId },
        logs: limited,
      }),
    );
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
