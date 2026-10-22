import { ModelProvider, ChatMessage, CompletionOptions } from './types.js';
import { config } from '../config/index.js';

export class OllamaProvider implements ModelProvider {
  public id = 'ollama';
  public name = 'Ollama Local AI';

  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = config.ollama.baseUrl;
    this.model = config.ollama.model;
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async generateCompletion(
    messages: ChatMessage[],
    options?: CompletionOptions
  ): Promise<{ content: string; reasoning?: string }> {
    const isStream = Boolean(options?.streamCallback);

    const payload = {
      model: this.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      stream: isStream,
      options: {
        temperature: options?.temperature ?? 0.3,
        num_predict: options?.maxTokens ?? 2048,
        stop: options?.stop
      }
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err: any) {
      throw new Error(`Failed to connect to Ollama at ${this.baseUrl}: ${err.message}. Is Ollama running?`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama request failed (${response.status}): ${errorText}`);
    }

    if (!isStream) {
      const data: any = await response.json();
      return {
        content: data.message?.content || '',
        reasoning: undefined
      };
    }

    // Handle Streaming Chunks
    let fullContent = '';
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Unable to read streaming body from Ollama');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const chunk = parsed.message?.content || '';
          if (chunk) {
            fullContent += chunk;
            options?.streamCallback?.(chunk);
          }
        } catch {
          // ignore chunk parse failure
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        const chunk = parsed.message?.content || '';
        if (chunk) {
          fullContent += chunk;
          options?.streamCallback?.(chunk);
        }
      } catch {
        // ignore
      }
    }

    return { content: fullContent };
  }
}
