import { GoogleGenAI } from '@google/genai';
import { finishInteraction, startInteraction } from './aiInteractionLogger.js';
import { resolveAICapability, renderPromptTemplate } from './aiConfigService.js';

const GLM_CHAT_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const GEMINI_MAX_RETRIES = Number(process.env.GEMINI_MAX_RETRIES || 2);
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 90000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return [
    'fetch failed',
    'timeout',
    'timed out',
    'socket hang up',
    'econnreset',
    'etimedout',
    'eai_again',
    'rate limit',
    '429',
    '503',
    '500',
  ].some((token) => message.includes(token));
}

async function withTimeout(task, timeoutMs, label) {
  return Promise.race([
    task(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label || 'request'} TIMEOUT`)), timeoutMs);
    }),
  ]);
}

function safeClone(value) {
  if (value === undefined || value === null) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => safeClone(item));
  if (typeof value === 'object') {
    if (typeof value.toJSON === 'function') {
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
  if (typeof message === 'string') return { role: 'user', content: message };
  if (message.lc_kwargs) {
    const kwargs = message.lc_kwargs;
    return {
      role: kwargs.role || message.getType?.() || 'unknown',
      content: kwargs.content ?? null,
      tool_calls: safeClone(kwargs.tool_calls || message.tool_calls || null),
      name: kwargs.name || null,
    };
  }
  return {
    role: message.role || message.getType?.() || 'unknown',
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

export async function generateGeminiContent({
  apiKey,
  request,
  meta = {},
}) {
  const ai = new GoogleGenAI({ apiKey });
  const handle = startInteraction({
    sourceApp: meta.sourceApp || 'admin-system',
    module: meta.module || 'unknown',
    runtime: meta.runtime || 'server',
    provider: 'gemini',
    model: request.model,
    operation: meta.operation || 'generate_content',
    capabilityId: meta.capabilityId || null,
    promptTemplateId: meta.promptTemplateId || null,
    promptSourceType: meta.promptSourceType || null,
    context: meta.context || {},
    request,
    traceId: meta.traceId,
    sessionId: meta.sessionId,
    requestId: meta.requestId,
    containsSensitiveData: meta.containsSensitiveData !== false,
    attempt: meta.attempt || 1,
    retryCount: meta.retryCount || 0,
  });

  try {
    let response = null;
    let lastError = null;
    const maxAttempts = Math.max(1, GEMINI_MAX_RETRIES + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        response = await withTimeout(
          () => ai.models.generateContent(request),
          GEMINI_TIMEOUT_MS,
          'gemini_generate_content'
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

    if (!response && lastError) {
      throw lastError;
    }
    const logEntry = finishInteraction(handle, {
      success: true,
      response: safeClone(response),
      tokenUsage: response?.usageMetadata,
      attempt: meta.attempt || 1,
      retryCount: meta.retryCount || 0,
    });
    return { response, logEntry };
  } catch (error) {
    finishInteraction(handle, {
      success: false,
      error,
      attempt: meta.attempt || 1,
      retryCount: meta.retryCount || 0,
    });
    throw error;
  }
}

export async function invokeLoggedLangChainModel({
  model,
  messages,
  meta = {},
  request = {},
}) {
  const normalizedMessages = normalizeMessages(messages);
  const requestPayload = {
    ...request,
    model: meta.model || request.model || null,
    contents: normalizedMessages.map((message) => ({
      role: message.role,
      parts: [{ text: typeof message.content === 'string' ? message.content : JSON.stringify(message.content) }],
      tool_calls: message.tool_calls || null,
    })),
  };

  const handle = startInteraction({
    sourceApp: meta.sourceApp || 'admin-system',
    module: meta.module || 'langchain',
    runtime: meta.runtime || 'server',
    provider: meta.provider || 'langchain-google-genai',
    model: meta.model || request.model || null,
    operation: meta.operation || 'langchain_invoke',
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
    const logEntry = finishInteraction(handle, {
      success: true,
      response: serialized,
      tokenUsage: response?.usage_metadata || response?.response_metadata?.usage_metadata || response?.response_metadata?.usageMetadata,
      attempt: meta.attempt || 1,
      retryCount: meta.retryCount || 0,
    });
    return { response, logEntry };
  } catch (error) {
    finishInteraction(handle, {
      success: false,
      error,
      attempt: meta.attempt || 1,
      retryCount: meta.retryCount || 0,
    });
    throw error;
  }
}

function extractTextParts(contents) {
  const values = [];
  const visit = (input) => {
    if (!input) return;
    if (typeof input === 'string') {
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
    if (typeof input.text === 'string') {
      values.push(input.text);
    }
  };
  visit(contents);
  return values.filter(Boolean);
}

function normalizeGlmResponse(data) {
  const text = data?.choices?.[0]?.message?.content || '';
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

async function generateGlmContent({ apiKey, request, meta = {} }) {
  const textParts = extractTextParts(request.contents);
  if (textParts.length === 0) {
    throw new Error('GLM text provider requires textual contents');
  }

  const messages = [];
  const systemInstruction = request?.config?.systemInstruction || request?.systemInstruction;
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: textParts.join('\n') });

  const handle = startInteraction({
    sourceApp: meta.sourceApp || 'admin-system',
    module: meta.module || 'unknown',
    runtime: meta.runtime || 'server',
    provider: 'glm-text',
    model: request.model,
    operation: meta.operation || 'generate_content',
    capabilityId: meta.capabilityId || null,
    promptTemplateId: meta.promptTemplateId || null,
    promptSourceType: meta.promptSourceType || null,
    context: meta.context || {},
    request: {
      ...request,
      contents: [{ role: 'user', parts: [{ text: textParts.join('\n') }] }],
      config: {
        ...(request.config || {}),
        systemInstruction,
      },
    },
    traceId: meta.traceId,
    sessionId: meta.sessionId,
    requestId: meta.requestId,
    containsSensitiveData: meta.containsSensitiveData !== false,
    attempt: meta.attempt || 1,
    retryCount: meta.retryCount || 0,
  });

  try {
    const response = await fetch(GLM_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    const logEntry = finishInteraction(handle, {
      success: true,
      response: normalized,
      tokenUsage: normalized.usageMetadata,
      attempt: meta.attempt || 1,
      retryCount: meta.retryCount || 0,
    });
    return { response: normalized, logEntry };
  } catch (error) {
    finishInteraction(handle, {
      success: false,
      error,
      attempt: meta.attempt || 1,
      retryCount: meta.retryCount || 0,
    });
    throw error;
  }
}

export async function invokeAIProvider({
  providerId,
  model,
  request,
  meta = {},
}) {
  const normalizedRequest = {
    ...request,
    model,
  };

  if (providerId === 'gemini-text' || providerId === 'gemini-vision') {
    return generateGeminiContent({
      apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY,
      request: normalizedRequest,
      meta: {
        ...meta,
        provider: providerId,
      },
    });
  }

  if (providerId === 'glm-text') {
    const apiKey = process.env.GLM_OCR_API_KEY || process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      throw new Error('GLM API Key not found');
    }
    return generateGlmContent({
      apiKey,
      request: normalizedRequest,
      meta,
    });
  }

  throw new Error(`Provider '${providerId}' is not supported by invokeAIProvider`);
}

export async function invokeAICapability({
  capabilityId,
  request,
  meta = {},
}) {
  const resolved = resolveAICapability(capabilityId);
  return invokeAIProvider({
    providerId: resolved.binding.provider,
    model: resolved.binding.model,
    request,
    meta: {
      ...meta,
      provider: resolved.binding.provider,
      capabilityId,
      promptTemplateId: meta.promptTemplateId || resolved.capability.promptTemplateId || null,
      promptSourceType: meta.promptSourceType || resolved.capability.promptSourceType || null,
      context: {
        ...(meta.context || {}),
        capabilityId,
        resolvedProvider: resolved.binding.provider,
        resolvedModel: resolved.binding.model,
      },
    },
  });
}

export function buildCapabilityPrompt(templateId, variables = {}) {
  return renderPromptTemplate(templateId, variables);
}

export function toLegacyAIInteractionLog(entry) {
  if (!entry) return null;
  return {
    model: entry.model || 'unknown',
    provider: entry.provider || 'unknown',
    capabilityId: entry.capabilityId || entry.context?.capabilityId || undefined,
    promptTemplateId: entry.promptTemplateId || undefined,
    promptSourceType: entry.promptSourceType || undefined,
    prompt: entry.request?.summary?.promptText || '',
    response: entry.response?.text || '',
    duration: entry.performance?.durationMs || 0,
    timestamp: entry.timestamp,
    usageMetadata: entry.tokenUsage?.rawUsageMetadata || null,
    request: entry.request,
    rawResponse: entry.response,
    context: entry.context,
    tokenUsage: entry.tokenUsage,
    errorMessage: entry.error?.message || undefined,
  };
}
