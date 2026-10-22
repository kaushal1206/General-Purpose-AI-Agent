import { ModelProvider, ChatMessage, CompletionOptions } from './types.js';
import { config } from '../config/index.js';

export class OpenAIProvider implements ModelProvider {
  public id = 'openai';
  public name = 'OpenAI Hosted API';

  public async isAvailable(): Promise<boolean> {
    return Boolean(config.openai.apiKey);
  }

  public async generateCompletion(
    messages: ChatMessage[],
    options?: CompletionOptions
  ): Promise<{ content: string; reasoning?: string }> {
    if (!config.openai.apiKey) {
      throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY in server/.env');
    }

    const payload = {
      model: config.openai.model,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 2048,
      stream: Boolean(options?.streamCallback)
    };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openai.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${err}`);
    }

    if (!options?.streamCallback) {
      const data: any = await res.json();
      return { content: data.choices?.[0]?.message?.content || '' };
    }

    // Stream SSE
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No readable stream from OpenAI');

    let fullContent = '';
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.replace('data: ', '');
        if (jsonStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            options.streamCallback(delta);
          }
        } catch {
          // ignore
        }
      }
    }

    return { content: fullContent };
  }
}
