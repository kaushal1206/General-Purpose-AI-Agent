import {
  CapabilityStatus,
  Conversation,
  Message,
  MemoryItem,
  Contact,
  BackgroundJob,
  AgentEvent
} from '../types';

const rawBase = (import.meta as any).env?.VITE_API_URL || '';
const API_BASE = rawBase
  ? (rawBase.endsWith('/api') ? rawBase : `${rawBase.replace(/\/$/, '')}/api`)
  : '/api';


export const api = {
  // Capabilities
  async getCapabilities(): Promise<CapabilityStatus[]> {
    const res = await fetch(`${API_BASE}/capabilities`);
    const data = await res.json();
    return data.capabilities || [];
  },

  async checkCapability(id: string): Promise<CapabilityStatus> {
    const res = await fetch(`${API_BASE}/capabilities/${id}/check`, { method: 'POST' });
    const data = await res.json();
    return data.capability;
  },

  // Conversations
  async getConversations(): Promise<Conversation[]> {
    const res = await fetch(`${API_BASE}/conversations`);
    const data = await res.json();
    return data.conversations || [];
  },

  async getConversation(id: string): Promise<{ conversation: Conversation & { messages: Message[] } }> {
    const res = await fetch(`${API_BASE}/conversations/${id}`);
    return res.json();
  },

  async createConversation(title?: string): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    const data = await res.json();
    return data.conversation;
  },

  async deleteConversation(id: string): Promise<void> {
    await fetch(`${API_BASE}/conversations/${id}`, { method: 'DELETE' });
  },

  // Streaming Chat via SSE
  streamChat(
    params: {
      prompt?: string;
      conversationId?: string;
      approvalGranted?: boolean;
      approvedToolName?: string;
      approvedToolInput?: any;
    },
    onEvent: (event: AgentEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await fetch(`${API_BASE}/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
          signal
        });

        if (!response.ok) {
          throw new Error(`Chat stream request failed: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No readable body in SSE stream');

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
            if (!trimmed || trimmed.startsWith(':')) continue; // skip keep-alive
            if (trimmed === 'data: [DONE]') {
              resolve();
              return;
            }
            if (trimmed.startsWith('data: ')) {
              try {
                const event: AgentEvent = JSON.parse(trimmed.slice(6));
                onEvent(event);
              } catch {
                // ignore json chunk parse
              }
            }
          }
        }
        resolve();
      } catch (err: any) {
        if (err.name === 'AbortError') {
          resolve();
        } else {
          reject(err);
        }
      }
    });
  },

  // Cancel running execution
  async cancelTask(conversationId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/chat/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId })
      });
      const data = await res.json();
      return Boolean(data.success);
    } catch {
      return false;
    }
  },

  // Memory
  async getMemories(): Promise<MemoryItem[]> {
    const res = await fetch(`${API_BASE}/memory`);
    const data = await res.json();
    return data.memories || [];
  },

  async addMemory(key: string, value: string, category: string = 'preference'): Promise<MemoryItem> {
    const res = await fetch(`${API_BASE}/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value, category })
    });
    const data = await res.json();
    return data.memory;
  },

  async deleteMemory(id: string): Promise<void> {
    await fetch(`${API_BASE}/memory/${id}`, { method: 'DELETE' });
  },

  // CRM
  async getContacts(): Promise<Contact[]> {
    const res = await fetch(`${API_BASE}/crm/contacts`);
    const data = await res.json();
    return data.contacts || [];
  },

  async addContact(contact: Partial<Contact>): Promise<Contact> {
    const res = await fetch(`${API_BASE}/crm/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact)
    });
    const data = await res.json();
    return data.contact;
  },

  async getPipeline(): Promise<any> {
    const res = await fetch(`${API_BASE}/crm/pipeline`);
    const data = await res.json();
    return data.pipeline;
  },

  // Background Jobs
  async getJobs(): Promise<BackgroundJob[]> {
    const res = await fetch(`${API_BASE}/jobs`);
    const data = await res.json();
    return data.jobs || [];
  },

  async enqueueJob(type: string, payload: any): Promise<{ jobId: string }> {
    const res = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload })
    });
    return res.json();
  },

  // Providers
  async getProviders(): Promise<{ activeProvider: string; providers: Array<{ id: string; name: string; available: boolean }> }> {
    const res = await fetch(`${API_BASE}/providers`);
    return res.json();
  },

  async setActiveProvider(providerId: string): Promise<void> {
    await fetch(`${API_BASE}/providers/active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId })
    });
  }
};
