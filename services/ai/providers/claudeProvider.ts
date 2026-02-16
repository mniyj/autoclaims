import { AIProvider, AIProviderConfig } from '../aiService';

export class ClaudeProvider implements AIProvider {
  readonly name = 'claude';
  readonly model: string;

  constructor(model: string = 'claude-3-sonnet-20250219') {
    this.model = model;
  }

  async invoke(prompt: string, config?: AIProviderConfig): Promise<{ content: string; usage: any }> {
    const apiKey = config?.apiKey || import.meta.env.VITE_ANTHROPIC_API_KEY;
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: config?.maxTokens ?? 4096,
        temperature: config?.temperature ?? 0.1,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.content?.[0]?.text || '',
      usage: data.usage || {},
    };
  }

  calculateCost(inputTokens: number, outputTokens: number): number {
    // Claude 3 Sonnet pricing (as of 2026)
    // Input: $3/1M tokens, Output: $15/1M tokens
    const inputCost = (inputTokens / 1_000_000) * 3.0;
    const outputCost = (outputTokens / 1_000_000) * 15.0;
    return inputCost + outputCost;
  }

  extractUsage(response: any): { inputTokens: number; outputTokens: number } {
    return {
      inputTokens: response.input_tokens || 0,
      outputTokens: response.output_tokens || 0,
    };
  }
}
