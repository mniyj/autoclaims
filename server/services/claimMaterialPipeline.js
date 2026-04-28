import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OSS from "ali-oss";
import { processFile } from "./fileProcessor.js";
import { readData } from "../utils/fileStore.js";
import { classifyMaterialByRules } from "./materialClassificationService.js";
import { invokeAICapability, generateGeminiContent } from "./aiRuntime.js";
import { renderPromptTemplate } from "./aiConfigService.js";
import { logInteraction } from "./aiInteractionLogger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

function inferMimeType(fileName = "") {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const typeMap = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return typeMap[ext] || "application/octet-stream";
}

function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.API_KEY
  );
}

function createOSSClient() {
  const region = process.env.ALIYUN_OSS_REGION || "oss-cn-beijing";
  const bucket = process.env.ALIYUN_OSS_BUCKET;
  const accessKeyId = process.env.ALIYUN_OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_OSS_ACCESS_KEY_SECRET;

  if (!bucket || !accessKeyId || !accessKeySecret) {
    throw new Error("OSS credentials not configured");
  }

  return new OSS({
    region,
    accessKeyId,
    accessKeySecret,
    bucket,
  });
}

function parseJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

function normalizeFieldKey(value) {
  return String(value || "").trim();
}

function buildJsonSchemaFromFields(fields = []) {
  const properties = {};
  const required = [];

  for (const field of fields || []) {
    const key = normalizeFieldKey(field?.field_key);
    if (!key) continue;
    if (field?.required) {
      required.push(key);
    }

    const typeMap = {
      STRING: "string",
      NUMBER: "number",
      BOOLEAN: "boolean",
      DATE: "string",
    };

    if (field?.data_type === "OBJECT") {
      properties[key] = JSON.parse(
        buildJsonSchemaFromFields(field.children || []),
      );
      continue;
    }

    if (field?.data_type === "ARRAY") {
      properties[key] = {
        type: "array",
        description: field?.description || field?.field_label || key,
        items: JSON.parse(buildJsonSchemaFromFields(field.item_fields || [])),
      };
      continue;
    }

    properties[key] = {
      type: typeMap[field?.data_type] || "string",
      description: field?.description || field?.field_label || key,
    };

    if (field?.data_type === "DATE") {
      properties[key].format = "date";
    }
  }

  const schema = {
    type: "object",
    properties,
  };
  if (required.length > 0) {
    schema.required = required;
  }
  return JSON.stringify(schema, null, 2);
}

function getDefaultValueByDataType(dataType) {
  switch (dataType) {
    case "NUMBER":
      return 0;
    case "BOOLEAN":
      return false;
    case "ARRAY":
      return [];
    case "OBJECT":
      return {};
    case "DATE":
    case "STRING":
    default:
      return "";
  }
}

function normalizeNumberValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const raw = String(value || "").replace(/[,\s]/g, "");
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeScalarByType(value, dataType) {
  if (value === undefined || value === null || value === "") {
    return getDefaultValueByDataType(dataType);
  }
  if (dataType === "NUMBER") {
    return normalizeNumberValue(value);
  }
  if (dataType === "BOOLEAN") {
    if (typeof value === "boolean") return value;
    return ["true", "1", "yes", "y"].includes(
      String(value).trim().toLowerCase(),
    );
  }
  return value;
}

function coerceDataBySchemaFields(fields = [], source = {}) {
  const normalized = {};

  for (const field of fields || []) {
    const key = normalizeFieldKey(field?.field_key);
    if (!key) continue;

    if (field?.data_type === "OBJECT") {
      normalized[key] = coerceDataBySchemaFields(
        field.children || [],
        source?.[key] || {},
      );
      continue;
    }

    if (field?.data_type === "ARRAY") {
      const items = Array.isArray(source?.[key]) ? source[key] : [];
      normalized[key] = items.map((item) =>
        coerceDataBySchemaFields(field.item_fields || [], item || {}),
      );
      continue;
    }

    normalized[key] = normalizeScalarByType(source?.[key], field?.data_type);
  }

  return normalized;
}

function applyInvoiceExtractionAliases(data = {}) {
  const next = { ...(data || {}) };
  const invoiceInfo = { ...(next.invoiceInfo || {}) };
  const insurancePayment = { ...(next.insurancePayment || {}) };

  invoiceInfo.hospitalName =
    invoiceInfo.hospitalName || next.hospital_name || next.hospitalName || "";
  invoiceInfo.invoiceNumber =
    invoiceInfo.invoiceNumber ||
    next.invoice_number ||
    next.invoiceNumber ||
    "";
  invoiceInfo.invoiceCode =
    invoiceInfo.invoiceCode || next.invoice_code || next.invoiceCode || "";
  invoiceInfo.issueDate =
    invoiceInfo.issueDate || next.invoice_date || next.invoiceDate || "";

  insurancePayment.governmentFundPayment =
    insurancePayment.governmentFundPayment ??
    next.insurance_paid ??
    next.social_insurance_paid ??
    next.governmentFundPayment;
  insurancePayment.personalPayment =
    insurancePayment.personalPayment ??
    next.self_paid ??
    next.personal_payment ??
    next.personalPayment;
  insurancePayment.personalSelfPayment =
    insurancePayment.personalSelfPayment ??
    next.personal_self_pay ??
    next.personalSelfPayment;
  insurancePayment.personalSelfExpense =
    insurancePayment.personalSelfExpense ??
    next.personal_self_expense ??
    next.personalSelfExpense;

  next.invoiceInfo = invoiceInfo;
  next.insurancePayment = insurancePayment;
  return next;
}

function normalizeExtractedData(materialConfig, extractedData = {}) {
  if (!materialConfig || !Array.isArray(materialConfig.schemaFields)) {
    return extractedData || {};
  }

  let source = extractedData || {};
  if (materialConfig.id === "mat-20") {
    source = applyInvoiceExtractionAliases(source);
  }

  return coerceDataBySchemaFields(materialConfig.schemaFields, source);
}

function getClaimsMaterialsCatalog() {
  const materials = readData("claims-materials");
  return Array.isArray(materials) ? materials : [];
}

function findMaterialConfig(materialId, materialName) {
  const catalog = getClaimsMaterialsCatalog();
  if (materialId) {
    const matchedById = catalog.find((item) => item.id === materialId);
    if (matchedById) return matchedById;
  }

  if (materialName) {
    return (
      catalog.find((item) => item.name === materialName) ||
      catalog.find(
        (item) =>
          materialName.includes(item.name) || item.name.includes(materialName),
      ) ||
      null
    );
  }

  return null;
}

function logNonAiClassification({
  classification,
  context,
  fileName,
  materialCount,
  matchStrategy,
}) {
  const timestamp = Date.now();
  logInteraction({
    taskId: context?.taskId || null,
    traceId: context?.traceId || null,
    sourceApp: "admin-system",
    module: "claimMaterialPipeline.classifyClaimMaterial",
    runtime: "server",
    provider: matchStrategy === "rules" ? "rule-engine" : "preset",
    model:
      matchStrategy === "rules"
        ? "material-classification-rules"
        : "preferred-material",
    operation: "classify_material",
    context: {
      ...(context || {}),
      fileName,
      materialCount,
      classificationMode: matchStrategy,
    },
    input: {
      fileName,
      materialCount,
      matchStrategy,
    },
    output: {
      response: JSON.stringify(classification),
      parsedResult: classification,
    },
    performance: {
      startTime: timestamp,
      endTime: timestamp,
      duration: 0,
      retryCount: 0,
    },
  });
}

export async function classifyClaimMaterial({
  parseResult,
  fileName,
  mimeType,
  buffer,
  preferredMaterialId,
  preferredMaterialName,
  context = {},
}) {
  const materials = getClaimsMaterialsCatalog();
  const directConfig = findMaterialConfig(
    preferredMaterialId,
    preferredMaterialName,
  );
  if (directConfig) {
    const classification = {
      materialId: directConfig.id,
      materialName: directConfig.name,
      confidence: 1,
      source: "manual",
      matchStrategy: "preset",
    };
    logNonAiClassification({
      classification,
      context,
      fileName,
      materialCount: materials.length,
      matchStrategy: "preset",
    });
    return classification;
  }

  if (parseResult?.parseStatus !== "completed") {
    return {
      materialId: "unknown",
      materialName: "未识别",
      confidence: 0,
      matchStrategy: "fallback",
      errorMessage: "文件解析未完成，无法分类",
    };
  }

  if (materials.length === 0) {
    return {
      materialId: "unknown",
      materialName: "未识别",
      confidence: 0,
      matchStrategy: "fallback",
      errorMessage: "材料目录为空，无法执行分类",
    };
  }

  const ocrText = parseResult.extractedText || "";
  const ruleResult = classifyMaterialByRules(materials, ocrText);
  if (ruleResult) {
    logNonAiClassification({
      classification: ruleResult,
      context,
      fileName,
      materialCount: materials.length,
      matchStrategy: "rules",
    });
    return ruleResult;
  }

  const isImage =
    (mimeType && mimeType.startsWith("image/")) ||
    /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(fileName || "");
  const useVisionFallback = Boolean(isImage && buffer);

  try {
    const catalog = materials
      .map((item) => `${item.id}|${item.name}`)
      .join("\n");
    const prompt = renderPromptTemplate("material_classifier", {
      ocrText: useVisionFallback
        ? `（已附图片，请**优先依据图片视觉内容**分类。以下 OCR 文字可能只是水印/位置等噪声信息，仅作参考）\n${ocrText.slice(0, 600) || "（无 OCR 文本）"}`
        : ocrText.slice(0, 1800),
      catalog,
    });

    const parts = [{ text: prompt }];
    if (useVisionFallback) {
      parts.unshift({
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: buffer.toString("base64"),
        },
      });
    }

    const { response } = await invokeAICapability({
      capabilityId: "admin.material.classification",
      request: {
        contents: { parts },
        config: { temperature: 0.1 },
      },
      meta: {
        sourceApp: "admin-system",
        module: "claimMaterialPipeline.classifyClaimMaterial",
        operation: "classify_material",
        context: {
          ...context,
          fileName,
          materialCount: materials.length,
        },
      },
    });

    const parsed = parseJsonObject(response.text || "{}");
    const parsedId = parsed.materialId || "unknown";
    const matched = materials.find((item) => item.id === parsedId);
    if (!matched) {
      return {
        materialId: "unknown",
        materialName: "未识别",
        confidence: 0,
        source: "ai",
        matchStrategy: "fallback",
        errorMessage: "AI 未匹配到有效材料目录项",
      };
    }

    return {
      materialId: matched.id,
      materialName: matched.name || parsed.materialName || "未识别",
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0,
      source: "ai",
      matchStrategy: "ai",
    };
  } catch (error) {
    return {
      materialId: "unknown",
      materialName: "分类失败",
      confidence: 0,
      source: "ai",
      matchStrategy: "fallback",
      errorMessage: error?.message || String(error),
    };
  }
}

export async function loadBufferForClaimMaterial(material) {
  if (material?.ossKey) {
    const client = createOSSClient();
    const signedUrl = client.signatureUrl(material.ossKey, { expires: 3600 });
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file from OSS: ${response.status}`);
    }
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType:
        response.headers.get("content-type") ||
        material.fileType ||
        inferMimeType(material.fileName),
    };
  }

  if (
    typeof material?.url === "string" &&
    material.url.startsWith("/uploads/")
  ) {
    const localFilePath = path.join(
      projectRoot,
      material.url.replace(/^\//, ""),
    );
    return {
      buffer: await fs.promises.readFile(localFilePath),
      mimeType: material.fileType || inferMimeType(material.fileName),
    };
  }

  if (typeof material?.url === "string" && /^https?:\/\//.test(material.url)) {
    const response = await fetch(material.url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType:
        response.headers.get("content-type") ||
        material.fileType ||
        inferMimeType(material.fileName),
    };
  }

  throw new Error("Material file source is not available");
}

export async function extractClaimMaterial({
  fileName,
  mimeType,
  buffer,
  materialConfig,
  context = {},
}) {
  const fallback = {
    extractedData: {},
    auditConclusion: "",
    confidence: 0,
    rawText: "",
  };

  if (!materialConfig) {
    return fallback;
  }

  const jsonSchema =
    (Array.isArray(materialConfig?.schemaFields) &&
    materialConfig.schemaFields.length > 0
      ? buildJsonSchemaFromFields(materialConfig.schemaFields)
      : null) ||
    materialConfig?.extractionConfig?.jsonSchema ||
    materialConfig?.jsonSchema ||
    "{}";
  const aiAuditPrompt =
    materialConfig?.extractionConfig?.aiAuditPrompt ||
    materialConfig?.aiAuditPrompt ||
    "请提取图片中的关键信息并进行校验";
  const effectiveMimeType = mimeType || inferMimeType(fileName);
  const isImage = effectiveMimeType.startsWith("image/");
  const isPdf =
    effectiveMimeType === "application/pdf" ||
    fileName?.toLowerCase().endsWith(".pdf");

  if (!isImage && !isPdf) {
    return {
      ...fallback,
      auditConclusion: `文件类型 ${effectiveMimeType} 暂不支持按材料配置自动提取`,
    };
  }

  const prompt = `你是一个专业的保险理赔材料审核系统。请对上传的「${materialConfig.name || "理赔材料"}」进行 OCR 识别和审核。

## 提取要求
请严格根据图片中可见的文字内容提取信息，按以下 JSON Schema 结构提取：
${jsonSchema}

## 审核要求
${aiAuditPrompt}

## 重要规则
1. 只提取图片中明确可见的文字和数字，严禁补充、推测或编造任何信息
2. 如果某个区域模糊不清或被遮挡，对应字段返回空字符串，不要猜测
3. 数字必须严格按图片显示提取
4. 日期格式统一为 YYYY-MM-DD
5. 无法识别的字段：字符串用空字符串 ""，数字用 0
6. 必须严格使用 schema 中的属性名和层级结构，不能改名，不能把嵌套对象拍平
7. schema 中出现的对象字段必须保留；即使字段识别不到，也要返回空对象中的空值，而不是省略整个对象
8. 不要把本应属于 invoiceInfo、insurancePayment 等结构化字段的内容合并到 otherInfo 或备注字段

## 输出格式
请严格返回以下 JSON 格式（不要包含 markdown 代码块标记）：
{
  "extractedData": { ... 按 schema 提取的字段 },
  "auditConclusion": "审核结论文本，包含提取摘要和校验结果",
  "confidence": 0.95
}`;

  const { response } = await generateGeminiContent({
    apiKey: getGeminiApiKey(),
    request: {
      model: process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: effectiveMimeType,
                data: buffer.toString("base64"),
              },
            },
          ],
        },
      ],
    },
    meta: {
      sourceApp: "admin-system",
      module: "claimMaterialPipeline.extractClaimMaterial",
      operation: "extract_claim_material",
      context: {
        ...context,
        fileName,
        materialId: materialConfig.id,
        materialName: materialConfig.name,
      },
    },
  });

  const parsed = parseJsonObject(response.text || "");
  const normalizedExtractedData = normalizeExtractedData(
    materialConfig,
    parsed.extractedData || {},
  );
  return {
    extractedData: normalizedExtractedData,
    auditConclusion: parsed.auditConclusion || "识别完成",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
    rawText: response.text || "",
  };
}

export async function processClaimMaterial({
  fileName,
  mimeType,
  buffer,
  materialRecord,
  parseResult,
  preferredMaterialId,
  preferredMaterialName,
  context = {},
}) {
  const baseParseResult =
    parseResult ||
    (await processFile({
      fileName,
      mimeType,
      buffer,
      options: { extractText: true },
    }));

  if (baseParseResult.parseStatus !== "completed") {
    return {
      success: false,
      parseResult: baseParseResult,
      classification: {
        materialId: "unknown",
        materialName: "未识别",
        confidence: 0,
        matchStrategy: "fallback",
        errorMessage: baseParseResult.errorMessage || "文件解析失败",
      },
      extractedData: {},
      auditConclusion: "",
      confidence: 0,
    };
  }

  const classification = await classifyClaimMaterial({
    parseResult: baseParseResult,
    fileName,
    mimeType,
    buffer,
    preferredMaterialId: preferredMaterialId || materialRecord?.materialId,
    preferredMaterialName:
      preferredMaterialName ||
      materialRecord?.materialName ||
      materialRecord?.category,
    context,
  });

  const materialConfig = findMaterialConfig(
    classification.materialId !== "unknown"
      ? classification.materialId
      : undefined,
    classification.materialName,
  );
  const extraction = await extractClaimMaterial({
    fileName,
    mimeType,
    buffer,
    materialConfig,
    context,
  });

  return {
    success: true,
    parseResult: baseParseResult,
    classification: materialConfig
      ? {
          ...classification,
          materialId: materialConfig.id,
          materialName: materialConfig.name,
        }
      : classification,
    materialConfig,
    extractedData:
      Object.keys(extraction.extractedData || {}).length > 0
        ? extraction.extractedData
        : baseParseResult.structuredData || {},
    auditConclusion: extraction.auditConclusion || "",
    confidence:
      typeof extraction.confidence === "number"
        ? extraction.confidence
        : classification.confidence || 0,
    extractedText: baseParseResult.extractedText || "",
  };
}
