import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  workspaceRoot: string;
  ollama: {
    baseUrl: string;
    model: string;
  };
  openai: {
    apiKey?: string;
    model: string;
  };
  anthropic: {
    apiKey?: string;
    model: string;
  };
  groq: {
    apiKey?: string;
    model: string;
  };
  search: {
    provider: 'none' | 'tavily' | 'brave' | 'searxng';
    tavilyApiKey?: string;
    braveApiKey?: string;
    searxngUrl?: string;
  };
  email: {
    host?: string;
    port: number;
    user?: string;
    pass?: string;
    from?: string;
    secure: boolean;
  };
  security: {
    requireApprovalForExternalSend: boolean;
    requireApprovalForFileDestructive: boolean;
    maxExecutionSteps: number;
    stepTimeoutMs: number;
  };
}

const resolveWorkspace = (configuredPath?: string): string => {
  if (configuredPath && path.isAbsolute(configuredPath)) {
    return path.normalize(configuredPath);
  }
  return path.resolve(process.cwd(), configuredPath || '../workspace');
};

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5434/agent_db',
  workspaceRoot: resolveWorkspace(process.env.WORKSPACE_ROOT),
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2:1b'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || undefined,
    model: process.env.OPENAI_MODEL || 'gpt-4o'
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || undefined,
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || undefined,
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
  },
  search: {
    provider: (process.env.SEARCH_PROVIDER as any) || 'none',
    tavilyApiKey: process.env.TAVILY_API_KEY || undefined,
    braveApiKey: process.env.BRAVE_API_KEY || undefined,
    searxngUrl: process.env.SEARXNG_URL || undefined
  },
  email: {
    host: process.env.SMTP_HOST || undefined,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    from: process.env.SMTP_FROM || undefined,
    secure: process.env.SMTP_SECURE === 'true'
  },
  security: {
    requireApprovalForExternalSend: process.env.REQUIRE_APPROVAL_FOR_EXTERNAL_SEND !== 'false',
    requireApprovalForFileDestructive: process.env.REQUIRE_APPROVAL_FOR_FILE_DESTRUCTIVE !== 'false',
    maxExecutionSteps: parseInt(process.env.MAX_EXECUTION_STEPS || '10', 10),
    stepTimeoutMs: parseInt(process.env.STEP_TIMEOUT_MS || '30000', 10)
  }
};
