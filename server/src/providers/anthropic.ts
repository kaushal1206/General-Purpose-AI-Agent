import { ModelProvider, ChatMessage, CompletionOptions } from './types.js';
import { config } from '../config/index.js';

export class AnthropicProvider implements ModelProvider {
  public id = 'anthropic';
  public name = 'Anthropic Claude Hosted API';

  public async isAvailable(): Promise<boolean> {
    return Boolean(config.anthropic.apiKey);
  }

  public async generateCompletion(
    messages: ChatMessage[],
    options?: CompletionOptions
  ): Promise<{ content: string; reasoning?: string }> {
    if (!config.anthropic.apiKey) {
      throw new Error('Anthropic API key is not configured. Please set ANTHROPIC_API_KEY in server/.env');
    }

    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const nonSystemMsgs = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

    const payload: any = {
      model: config.anthropic.model,
      messages: nonSystemMsgs,
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.3
    };

    if (systemMsg) {
      payload.system = systemMsg;
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropic.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${err}`);
    }

    const data: any = await res.json();
    const content = data.content?.[0]?.text || '';
    if (options?.streamCallback) {
      options.streamCallback(content);
    }
    return { content };
  }
}
