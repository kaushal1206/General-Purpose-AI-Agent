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

    // 1. Initial connect / request timeout (generous for local CPU cold start)
    const connectController = new AbortController();
    let isTimedOut = false;
    let isCancelled = false;

    const userSignal = options?.signal;
    const onUserAbort = () => {
      isCancelled = true;
      connectController.abort();
    };

    if (userSignal) {
      if (userSignal.aborted) {
        throw new Error('Ollama request was cancelled by the user or client.');
      }
      userSignal.addEventListener('abort', onUserAbort);
    }

    const connectTimer = setTimeout(() => {
      isTimedOut = true;
      connectController.abort();
    }, timeoutMs);

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
          signal: connectController.signal
        });
        break;
      } catch (err: any) {
        if (isCancelled || userSignal?.aborted) {
          clearTimeout(connectTimer);
          if (userSignal) userSignal.removeEventListener('abort', onUserAbort);
          throw new Error('Ollama request was cancelled by the user or client.');
        }
        if (isTimedOut) {
          clearTimeout(connectTimer);
          if (userSignal) userSignal.removeEventListener('abort', onUserAbort);
          throw new Error(`Ollama request timed out after ${timeoutMs}ms. The model may be overloaded.`);
        }
        if (attempt >= maxAttempts) {
          clearTimeout(connectTimer);
          if (userSignal) userSignal.removeEventListener('abort', onUserAbort);
          throw new Error(`Failed to connect to Ollama at ${this.baseUrl}: ${err.message}. Is Ollama running on port 11434?`);
        }
        // Brief backoff before 1 safe retry
        await new Promise(r => setTimeout(r, 500));
      }
    }
    clearTimeout(connectTimer);
    if (userSignal) {
      userSignal.removeEventListener('abort', onUserAbort);
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

    // Handle Streaming Chunks with sliding inactivity timeout
    let fullContent = '';
    const reader = response!.body?.getReader();
    if (!reader) {
      throw new Error('Unable to read streaming body from Ollama');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    // Sliding inactivity timeout: reset every time a chunk is received
    const inactivityTimeoutMs = 30000;
    let inactivityTimer: NodeJS.Timeout | null = null;
    let streamTimedOut = false;

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        streamTimedOut = true;
        reader.cancel().catch(() => {});
      }, inactivityTimeoutMs);
    };

    resetInactivityTimer();

    const onStreamUserAbort = () => {
      isCancelled = true;
      reader.cancel().catch(() => {});
    };

    if (userSignal) {
      userSignal.addEventListener('abort', onStreamUserAbort);
    }

    try {
      while (true) {
        if (isCancelled || userSignal?.aborted) {
          throw new Error('Ollama request was cancelled by the user or client.');
        }
        if (streamTimedOut) {
          throw new Error(`Ollama streaming timed out (no tokens received for ${inactivityTimeoutMs / 1000}s).`);
        }

        const { done, value } = await reader.read();
        if (done) break;

        resetInactivityTimer();

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
      if (isCancelled || userSignal?.aborted) {
        throw new Error('Ollama request was cancelled by the user or client.');
      }
      if (streamTimedOut) {
        throw new Error(`Ollama streaming timed out (no tokens received for ${inactivityTimeoutMs / 1000}s).`);
      }
      throw err;
    } finally {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (userSignal) {
        userSignal.removeEventListener('abort', onStreamUserAbort);
      }
      reader.releaseLock();
    }

    return { content: fullContent };
  }
}

