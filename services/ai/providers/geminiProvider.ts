import { AIProvider, AIProviderConfig } from '../aiService';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  readonly model: string;

  constructor(model: string = 'gemini-2.5-flash') {
    this.model = model;
  }

  async invoke(prompt: string, config?: AIProviderConfig): Promise<{ content: string; usage: any }> {
    const apiKey = config?.apiKey || import.meta.env.VITE_GEMINI_API_KEY;
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: config?.temperature ?? 0.1,
            maxOutputTokens: config?.maxTokens ?? 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      usage: data.usageMetadata || {},
    };
  }

  calculateCost(inputTokens: number, outputTokens: number): number {
    // Gemini 2.5 Flash pricing (as of 2026)
    // Input: $0.15/1M tokens, Output: $0.60/1M tokens
    const inputCost = (inputTokens / 1_000_000) * 0.15;
    const outputCost = (outputTokens / 1_000_000) * 0.60;
    return inputCost + outputCost;
  }

  extractUsage(response: any): { inputTokens: number; outputTokens: number } {
    return {
      inputTokens: response.promptTokenCount || 0,
      outputTokens: response.candidatesTokenCount || 0,
    };
  }
}
