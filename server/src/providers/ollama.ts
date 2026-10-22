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
    const timeoutMs = options?.timeoutMs || config.security.stepTimeoutMs || 30000;

    const payload = {
      model: this.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      stream: isStream,
      options: {
        temperature: options?.temperature ?? 0.2,
        num_predict: options?.maxTokens ?? 2048,
        stop: options?.stop
      }
    };

    // Helper to create combined abort signal
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    let combinedSignal = timeoutSignal;
    if (options?.signal) {
      if (typeof (AbortSignal as any).any === 'function') {
        combinedSignal = (AbortSignal as any).any([timeoutSignal, options.signal]);
      } else {
        const controller = new AbortController();
        const onAbort = () => controller.abort();
        timeoutSignal.addEventListener('abort', onAbort);
        options.signal.addEventListener('abort', onAbort);
        combinedSignal = controller.signal;
      }
    }

    let response: Response;
    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: combinedSignal
        });
        break;
      } catch (err: any) {
        if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
          throw new Error(`Ollama request timed out after ${timeoutMs}ms. The model may be overloaded.`);
        }
        if (err.name === 'AbortError' || combinedSignal.aborted) {
          throw new Error('Ollama request was cancelled by the user or client.');
        }
        if (attempt >= maxAttempts) {
          throw new Error(`Failed to connect to Ollama at ${this.baseUrl}: ${err.message}. Is Ollama running on port 11434?`);
        }
        // Brief backoff before 1 safe retry
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (!response!.ok) {
      const errorText = await response!.text();
      if (response!.status === 404 || errorText.includes('not found')) {
        throw new Error(`Ollama model '${this.model}' is not installed. Run 'ollama pull ${this.model}' to install it.`);
      }
      throw new Error(`Ollama request failed (${response!.status}): ${errorText}`);
    }

    if (!isStream) {
      const data: any = await response!.json();
      return {
        content: data.message?.content || '',
        reasoning: undefined
      };
    }

    // Handle Streaming Chunks
    let fullContent = '';
    const reader = response!.body?.getReader();
    if (!reader) {
      throw new Error('Unable to read streaming body from Ollama');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        if (combinedSignal.aborted) {
          reader.cancel();
          throw new Error('Streaming cancelled');
        }

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
    } catch (err: any) {
      if (err.name === 'AbortError' || combinedSignal.aborted) {
        throw new Error('Ollama stream aborted by client.');
      }
      throw err;
    } finally {
      reader.releaseLock();
    }

    return { content: fullContent };
  }
}
