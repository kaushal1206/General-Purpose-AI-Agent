import { ModelProvider } from './types.js';
import { OllamaProvider } from './ollama.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';

class ProviderRegistry {
  private providers: Map<string, ModelProvider> = new Map();
  private activeProviderId = 'ollama';

  constructor() {
    this.register(new OllamaProvider());
    this.register(new OpenAIProvider());
    this.register(new AnthropicProvider());
  }

  public register(provider: ModelProvider) {
    this.providers.set(provider.id, provider);
  }

  public setActiveProvider(id: string) {
    if (!this.providers.has(id)) {
      throw new Error(`Provider '${id}' is not registered`);
    }
    this.activeProviderId = id;
  }

  public getActiveProvider(): ModelProvider {
    const provider = this.providers.get(this.activeProviderId);
    if (!provider) {
      // Default to Ollama
      return this.providers.get('ollama')!;
    }
    return provider;
  }

  public getProvider(id: string): ModelProvider | undefined {
    return this.providers.get(id);
  }

  public async getAvailableProviders(): Promise<Array<{ id: string; name: string; available: boolean }>> {
    const list = [];
    for (const [id, provider] of this.providers.entries()) {
      const available = await provider.isAvailable();
      list.push({ id, name: provider.name, available });
    }
    return list;
  }
}

export const providerRegistry = new ProviderRegistry();
