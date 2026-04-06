import { GoogleGenAI } from "@google/genai";
import { finishInteraction, startInteraction } from "./aiInteractionLogger.js";
import { estimateCost } from "./aiPricingService.js";
import { resolveAICapability, renderPromptTemplate } from "./aiConfigService.js";

const GLM_CHAT_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const QWEN_CHAT_URL =
  process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const DEEPSEEK_CHAT_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/chat/completions";
const CLAUDE_CHAT_URL = "https://api.anthropic.com/v1/messages";
const GEMINI_MAX_RETRIES = Number(process.env.GEMINI_MAX_RETRIES || 2);
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 90000);

const PROVIDER_REGISTRY = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return [
    "fetch failed",
    "timeout",
    "timed out",
    "socket hang up",
    "econnreset",
    "etimedout",
    "eai_again",
    "rate limit",
    "429",
    "503",
    "500",
  ].some((token) => message.includes(token));
}

async function withTimeout(task, timeoutMs, label) {
  return Promise.race([
    task(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label || "request"} TIMEOUT`)), timeoutMs);
    }),
  ]);
}

function safeClone(value) {
  if (value === undefined || value === null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => safeClone(item));
  if (typeof value === "object") {
    if (typeof value.toJSON === "function") {
      try {
        return safeClone(value.toJSON());
      } catch {
        // ignore
      }
    }
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = safeClone(child);
    }
    return output;
  }
  return String(value);
}

function normalizeMessage(message) {
  if (!message) return null;
  if (typeof message === "string") return { role: "user", content: message };
  if (message.lc_kwargs) {
    const kwargs = message.lc_kwargs;
    return {
      role: kwargs.role || message.getType?.() || "unknown",
      content: kwargs.content ?? null,
      tool_calls: safeClone(kwargs.tool_calls || message.tool_calls || null),
      name: kwargs.name || null,
    };
  }
  return {
    role: message.role || message.getType?.() || "unknown",
    content: message.content ?? null,
    tool_calls: safeClone(message.tool_calls || null),
    name: message.name || null,
    additional_kwargs: safeClone(message.additional_kwargs || null),
  };
}

function normalizeMessages(messages) {
  if (!messages) return [];
  if (!Array.isArray(messages)) return [normalizeMessage(messages)];
  return messages.map((item) => normalizeMessage(item));
}

function serializeLangChainResponse(response) {
  return {
    content: response?.content ?? null,
    tool_calls: safeClone(response?.tool_calls || response?.toolCalls || null),
    invalid_tool_calls: safeClone(response?.invalid_tool_calls || null),
    additional_kwargs: safeClone(response?.additional_kwargs || null),
    response_metadata: safeClone(response?.response_metadata || null),
    usage_metadata: safeClone(response?.usage_metadata || null),
  };
}

function extractTextParts(contents) {
  const values = [];
  const visit = (input) => {
    if (!input) return;
    if (typeof input === "string") {
      values.push(input);
      return;
    }
    if (Array.isArray(input)) {
      input.forEach(visit);
      return;
    }
    if (input.parts && Array.isArray(input.parts)) {
      input.parts.forEach(visit);
      return;
    }
    if (typeof input.text === "string") {
      values.push(input.text);
    }
  };
  visit(contents);
  return values.filter(Boolean);
}

function buildMessagePayload(request) {
  const textParts = extractTextParts(request.contents);
  const messages = [];
  const systemInstruction = request?.config?.systemInstruction || request?.systemInstruction;
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  if (textParts.length > 0) {
    messages.push({ role: "user", content: textParts.join("\n") });
  }
  return messages;
}

function buildInteractionMeta(meta, request, providerId) {
  return {
    sourceApp: meta.sourceApp || "admin-system",
    module: meta.module || "unknown",
    runtime: meta.runtime || "server",
    provider: providerId,
    model: request.model,
    operation: meta.operation || "generate_content",
    capabilityId: meta.capabilityId || null,
    promptTemplateId: meta.promptTemplateId || null,
    promptSourceType: meta.promptSourceType || null,
    context: meta.context || {},
    traceId: meta.traceId,
    sessionId: meta.sessionId,
    requestId: meta.requestId,
    containsSensitiveData: meta.containsSensitiveData !== false,
    attempt: meta.attempt || 1,
    retryCount: meta.retryCount || 0,
  };
}

function finalizeSuccess(handle, providerId, model, response, tokenUsage, extra = {}) {
  const pricing = estimateCost({
    providerId,
    modelId: model,
    inputTokens: tokenUsage?.promptTokenCount ?? tokenUsage?.input_tokens ?? tokenUsage?.inputTokens ?? null,
    outputTokens:
      tokenUsage?.candidatesTokenCount ??
      tokenUsage?.output_tokens ??
      tokenUsage?.outputTokens ??
      tokenUsage?.completion_tokens ??
      null,
    totalTokens: tokenUsage?.totalTokenCount ?? tokenUsage?.total_tokens ?? tokenUsage?.totalTokens ?? null,
  });

  return finishInteraction(handle, {
    success: true,
    response: safeClone(response),
    tokenUsage: {
      ...safeClone(tokenUsage),
      pricingRuleId: pricing.pricingRuleId,
      estimatedCost: pricing.estimatedCost,
    },
    pricingRuleId: pricing.pricingRuleId,
    estimatedCost: pricing.estimatedCost,
    fallbackInfo: extra.fallbackInfo || null,
    attempt: extra.attempt || 1,
    retryCount: extra.retryCount || 0,
  });
}

function finalizeError(handle, error, extra = {}) {
  return finishInteraction(handle, {
    success: false,
    error,
    fallbackInfo: extra.fallbackInfo || null,
    attempt: extra.attempt || 1,
    retryCount: extra.retryCount || 0,
  });
}

function normalizeOpenAICompatibleResponse(data) {
  const text = data?.choices?.[0]?.message?.content || "";
  return {
    text,
    candidates: [
      {
        content: {
          parts: [{ text }],
        },
      },
    ],
    usageMetadata: data?.usage || null,
    raw: data,
  };
}

function normalizeClaudeResponse(data) {
  const text = Array.isArray(data?.content)
    ? data.content.map((item) => item?.text || "").join("\n")
    : "";
  return {
    text,
    candidates: [
      {
        content: {
          parts: [{ text }],
        },
      },
    ],
    usageMetadata: data
      ? {
          input_tokens: data.usage?.input_tokens ?? null,
          output_tokens: data.usage?.output_tokens ?? null,
          total_tokens:
            (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        }
      : null,
    raw: data,
  };
}

function normalizeGlmResponse(data) {
  return normalizeOpenAICompatibleResponse(data);
}

export async function generateGeminiContent({ apiKey, request, meta = {} }) {
  const ai = new GoogleGenAI({ apiKey });
  const interactionMeta = buildInteractionMeta(meta, request, meta.provider || "gemini");
  const handle = startInteraction({ ...interactionMeta, request });

  try {
    let response = null;
    let lastError = null;
    const maxAttempts = Math.max(1, GEMINI_MAX_RETRIES + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        response = await withTimeout(
          () => ai.models.generateContent(request),
          GEMINI_TIMEOUT_MS,
          "gemini_generate_content",
        );
        break;
      } catch (error) {
        lastError = error;
        if (attempt >= maxAttempts || !isRetryableGeminiError(error)) {
          throw error;
        }
        await sleep(Math.min(1500 * attempt, 5000));
      }
    }

    if (!response && lastError) throw lastError;

    const logEntry = finalizeSuccess(
      handle,
      meta.provider || "gemini-text",
      request.model,
      response,
      response?.usageMetadata,
      interactionMeta,
    );

    return {
      response,
      logEntry,
      gatewayResponse: {
        success: true,
        provider: meta.provider || "gemini-text",
        model: request.model,
        requestId: logEntry?.requestId || null,
        traceId: logEntry?.traceId || interactionMeta.traceId || null,
        latencyMs: logEntry?.performance?.durationMs || 0,
        usage: logEntry?.tokenUsage || null,
        estimatedCost: logEntry?.tokenUsage?.estimatedCost || 0,
        pricingRuleId: logEntry?.tokenUsage?.pricingRuleId || null,
        output: response,
        rawProviderResponse: response,
      },
    };
  } catch (error) {
    finalizeError(handle, error, interactionMeta);
    throw error;
  }
}

export async function generateOpenAICompatibleContent({
  apiKey,
  baseUrl = OPENAI_CHAT_URL,
  request,
  meta = {},
}) {
  const providerId = meta.provider || "openai-text";
  const messages = buildMessagePayload(request);
  if (messages.length === 0) {
    throw new Error(`${providerId} provider requires textual contents`);
  }

  const requestPayload = {
    model: request.model,
    messages,
    temperature: request?.config?.temperature ?? 0.1,
    stream: false,
  };
  const interactionMeta = buildInteractionMeta(meta, request, providerId);
  const handle = startInteraction({
    ...interactionMeta,
    request: {
      ...request,
      contents: messages,
    },
  });

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${providerId} request failed: ${errorText}`);
    }

    const data = await response.json();
    const normalized = normalizeOpenAICompatibleResponse(data);
    const logEntry = finalizeSuccess(
      handle,
      providerId,
      request.model,
      normalized,
      normalized.usageMetadata,
      interactionMeta,
    );
    return {
      response: normalized,
      logEntry,
      gatewayResponse: {
        success: true,
        provider: providerId,
        model: request.model,
        requestId: logEntry?.requestId || null,
        traceId: logEntry?.traceId || interactionMeta.traceId || null,
        latencyMs: logEntry?.performance?.durationMs || 0,
        usage: logEntry?.tokenUsage || null,
        estimatedCost: logEntry?.tokenUsage?.estimatedCost || 0,
        pricingRuleId: logEntry?.tokenUsage?.pricingRuleId || null,
        output: normalized,
        rawProviderResponse: normalized?.raw || normalized,
      },
    };
  } catch (error) {
    finalizeError(handle, error, interactionMeta);
    throw error;
  }
}

export async function generateClaudeServerContent({ apiKey, request, meta = {} }) {
  const providerId = meta.provider || "claude-text";
  const messages = buildMessagePayload(request);
  const systemInstruction = request?.config?.systemInstruction || request?.systemInstruction || "";
  const interactionMeta = buildInteractionMeta(meta, request, providerId);
  const handle = startInteraction({
    ...interactionMeta,
    request: {
      ...request,
      contents: messages,
    },
  });

  try {
    const response = await fetch(CLAUDE_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request?.config?.maxOutputTokens || 4096,
        temperature: request?.config?.temperature ?? 0.1,
        system: systemInstruction,
        messages: messages.filter((item) => item.role !== "system"),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`claude-text request failed: ${errorText}`);
    }

    const data = await response.json();
    const normalized = normalizeClaudeResponse(data);
    const logEntry = finalizeSuccess(
      handle,
      providerId,
      request.model,
      normalized,
      normalized.usageMetadata,
      interactionMeta,
    );
    return {
      response: normalized,
      logEntry,
      gatewayResponse: {
        success: true,
        provider: providerId,
        model: request.model,
        requestId: logEntry?.requestId || null,
        traceId: logEntry?.traceId || interactionMeta.traceId || null,
        latencyMs: logEntry?.performance?.durationMs || 0,
        usage: logEntry?.tokenUsage || null,
        estimatedCost: logEntry?.tokenUsage?.estimatedCost || 0,
        pricingRuleId: logEntry?.tokenUsage?.pricingRuleId || null,
        output: normalized,
        rawProviderResponse: normalized?.raw || normalized,
      },
    };
  } catch (error) {
    finalizeError(handle, error, interactionMeta);
    throw error;
  }
}

async function generateGlmContent({ apiKey, request, meta = {} }) {
  const providerId = meta.provider || "glm-text";
  const messages = buildMessagePayload(request);
  if (messages.length === 0) {
    throw new Error("GLM text provider requires textual contents");
  }

  const interactionMeta = buildInteractionMeta(meta, request, providerId);
  const handle = startInteraction({
    ...interactionMeta,
    request: {
      ...request,
      contents: messages,
    },
  });

  try {
    const response = await fetch(GLM_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages,
        temperature: request?.config?.temperature ?? 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GLM Chat Failed: ${errorText}`);
    }

    const data = await response.json();
    const normalized = normalizeGlmResponse(data);
    const logEntry = finalizeSuccess(
      handle,
      providerId,
      request.model,
      normalized,
      normalized.usageMetadata,
      interactionMeta,
    );
    return {
      response: normalized,
      logEntry,
      gatewayResponse: {
        success: true,
        provider: providerId,
        model: request.model,
        requestId: logEntry?.requestId || null,
        traceId: logEntry?.traceId || interactionMeta.traceId || null,
        latencyMs: logEntry?.performance?.durationMs || 0,
        usage: logEntry?.tokenUsage || null,
        estimatedCost: logEntry?.tokenUsage?.estimatedCost || 0,
        pricingRuleId: logEntry?.tokenUsage?.pricingRuleId || null,
        output: normalized,
        rawProviderResponse: normalized?.raw || normalized,
      },
    };
  } catch (error) {
    finalizeError(handle, error, interactionMeta);
    throw error;
  }
}

function registerProviderHandler(runtime, handler) {
  PROVIDER_REGISTRY.set(runtime, handler);
}

registerProviderHandler("gemini", async ({ request, meta }) =>
  generateGeminiContent({
    apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY,
    request,
    meta,
  }),
);

registerProviderHandler("glm-text", async ({ request, meta }) => {
  const apiKey = process.env.GLM_OCR_API_KEY || process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error("GLM API Key not found");
  return generateGlmContent({ apiKey, request, meta });
});

registerProviderHandler("openai-text", async ({ request, meta }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not found");
  return generateOpenAICompatibleContent({
    apiKey,
    baseUrl: OPENAI_CHAT_URL,
    request,
    meta,
  });
});

registerProviderHandler("qwen-text", async ({ request, meta }) => {
  const apiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error("QWEN_API_KEY or DASHSCOPE_API_KEY not found");
  return generateOpenAICompatibleContent({
    apiKey,
    baseUrl: QWEN_CHAT_URL,
    request,
    meta,
  });
});

registerProviderHandler("deepseek-text", async ({ request, meta }) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not found");
  return generateOpenAICompatibleContent({
    apiKey,
    baseUrl: DEEPSEEK_CHAT_URL,
    request,
    meta,
  });
});

registerProviderHandler("claude-text", async ({ request, meta }) => {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY or CLAUDE_API_KEY not found");
  return generateClaudeServerContent({
    apiKey,
    request,
    meta,
  });
});

export async function invokeLoggedLangChainModel({ model, messages, meta = {}, request = {} }) {
  const normalizedMessages = normalizeMessages(messages);
  const requestPayload = {
    ...request,
    model: meta.model || request.model || null,
    contents: normalizedMessages.map((message) => ({
      role: message.role,
      parts: [{ text: typeof message.content === "string" ? message.content : JSON.stringify(message.content) }],
      tool_calls: message.tool_calls || null,
    })),
  };

  const handle = startInteraction({
    sourceApp: meta.sourceApp || "admin-system",
    module: meta.module || "langchain",
    runtime: meta.runtime || "server",
    provider: meta.provider || "langchain-google-genai",
    model: meta.model || request.model || null,
    operation: meta.operation || "langchain_invoke",
    capabilityId: meta.capabilityId || null,
    promptTemplateId: meta.promptTemplateId || null,
    promptSourceType: meta.promptSourceType || null,
    context: meta.context || {},
    request: requestPayload,
    traceId: meta.traceId,
    sessionId: meta.sessionId,
    requestId: meta.requestId,
    containsSensitiveData: meta.containsSensitiveData !== false,
    attempt: meta.attempt || 1,
    retryCount: meta.retryCount || 0,
  });

  try {
    const response = await model.invoke(messages);
    const serialized = serializeLangChainResponse(response);
    const logEntry = finalizeSuccess(
      handle,
      meta.provider || "langchain-google-genai",
      meta.model || request.model || "unknown",
      serialized,
      response?.usage_metadata ||
        response?.response_metadata?.usage_metadata ||
        response?.response_metadata?.usageMetadata,
      meta,
    );
    return { response, logEntry };
  } catch (error) {
    finalizeError(handle, error, meta);
    throw error;
  }
}

export async function invokeAIProvider({ providerId, model, request, meta = {}, providerRuntime = null }) {
  const runtime = providerRuntime || providerId;
  const handler = PROVIDER_REGISTRY.get(runtime);
  if (!handler) {
    throw new Error(`Provider runtime '${runtime}' is not supported`);
  }
  return handler({
    providerId,
    request: { ...request, model },
    meta: {
      ...meta,
      provider: providerId,
    },
  });
}

function createTraceId() {
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function invokeAICapability({ capabilityId, request, meta = {} }) {
  const resolved = resolveAICapability(capabilityId);
  const baseTraceId = meta.traceId || createTraceId();
  const resolvedRequest = {
    ...request,
    config: {
      ...(resolved.binding?.generationConfig || {}),
      ...(request?.config || {}),
    },
  };
  const commonMeta = {
    ...meta,
    provider: resolved.binding.provider,
    capabilityId,
    traceId: baseTraceId,
    promptTemplateId: meta.promptTemplateId || resolved.capability.promptTemplateId || null,
    promptSourceType: meta.promptSourceType || resolved.capability.promptSourceType || null,
    context: {
      ...(meta.context || {}),
      capabilityId,
      group: resolved.capability.group,
      resolvedProvider: resolved.binding.provider,
      resolvedModel: resolved.binding.model,
    },
  };

  try {
    return await invokeAIProvider({
      providerId: resolved.binding.provider,
      providerRuntime: resolved.provider.runtime,
      model: resolved.binding.model,
      request: resolvedRequest,
      meta: commonMeta,
    });
  } catch (primaryError) {
    const fallbacks = resolved.capability.fallbackBindings || [];
    for (const fallback of fallbacks) {
      try {
        const provider = fallback.provider;
        const fallbackResolvedModel = fallback.model || resolved.binding.model;
        return await invokeAIProvider({
          providerId: provider,
          providerRuntime: provider,
          model: fallbackResolvedModel,
          request: resolvedRequest,
          meta: {
            ...commonMeta,
            provider,
            context: {
              ...commonMeta.context,
              fallbackFrom: resolved.binding.provider,
              fallbackReason: primaryError?.message || String(primaryError),
            },
            fallbackInfo: {
              from: resolved.binding.provider,
              reason: primaryError?.message || String(primaryError),
            },
          },
        });
      } catch (fallbackError) {
        commonMeta.context.lastFallbackError = fallbackError?.message || String(fallbackError);
      }
    }
    throw primaryError;
  }
}

export function buildCapabilityPrompt(templateId, variables = {}) {
  return renderPromptTemplate(templateId, variables);
}

export function toLegacyAIInteractionLog(entry) {
  if (!entry) return null;
  return {
    model: entry.model || "unknown",
    provider: entry.provider || "unknown",
    capabilityId: entry.capabilityId || entry.context?.capabilityId || undefined,
    group: entry.context?.group || undefined,
    promptTemplateId: entry.promptTemplateId || undefined,
    promptSourceType: entry.promptSourceType || undefined,
    prompt: entry.request?.summary?.promptText || "",
    response: entry.response?.text || "",
    duration: entry.performance?.durationMs || 0,
    timestamp: entry.timestamp,
    usageMetadata: entry.tokenUsage?.rawUsageMetadata || null,
    pricingRuleId: entry.tokenUsage?.pricingRuleId || null,
    estimatedCost: entry.tokenUsage?.estimatedCost || 0,
    request: entry.request,
    rawResponse: entry.response,
    context: entry.context,
    tokenUsage: entry.tokenUsage,
    fallbackInfo: entry.fallbackInfo || null,
    errorMessage: entry.error?.message || undefined,
  };
}
