import { AIInteractionLog } from "../../types";

const SESSION_KEY = "smartclaim_ai_proxy_session_id";

const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `smartclaim-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
};

interface ProxyParams {
  model?: string;
  contents?: any;
  capabilityId?: string;
  promptTemplateId?: string;
  systemPromptTemplateId?: string;
  templateVariables?: Record<string, any>;
  config?: any;
  operation: string;
  context?: Record<string, any>;
}

export const generateContentViaProxy = async ({
  model,
  contents,
  capabilityId,
  promptTemplateId,
  systemPromptTemplateId,
  templateVariables,
  config,
  operation,
  context,
}: ProxyParams): Promise<{ response: any; aiLog: AIInteractionLog }> => {
  const response = await fetch("/api/ai/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      contents,
      capabilityId,
      promptTemplateId,
      systemPromptTemplateId,
      templateVariables,
      config,
      meta: {
        sourceApp: "smartclaim-ai-agent",
        module: "smartclaim-ai-agent",
        operation,
        sessionId: getSessionId(),
        context,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `AI proxy failed: ${response.statusText}`);
  }

  return response.json();
};
