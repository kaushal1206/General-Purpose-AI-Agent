export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  streamCallback?: (token: string) => void;
}

export interface ModelProvider {
  id: string;
  name: string;
  isAvailable(): Promise<boolean>;
  generateCompletion(
    messages: ChatMessage[],
    options?: CompletionOptions
  ): Promise<{ content: string; reasoning?: string }>;
}
