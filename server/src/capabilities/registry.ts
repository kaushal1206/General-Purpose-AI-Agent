import { config } from '../config/index.js';
import { CapabilityStatus } from './types.js';
import { prisma } from '../db/prisma.js';
import fs from 'fs';
import nodemailer from 'nodemailer';

class CapabilityRegistry {
  private capabilities: Map<string, CapabilityStatus> = new Map();

  constructor() {
    this.registerInitialCapabilities();
  }

  private registerInitialCapabilities() {
    // 1. Ollama (Primary Free-First Local Model)
    this.capabilities.set('ollama', {
      id: 'ollama',
      name: 'Ollama Local AI Provider',
      category: 'ai_model',
      implemented: true,
      configured: Boolean(config.ollama.baseUrl),
      credentialsAvailable: true, // Local Ollama does not need API key
      providerReachable: false,
      lastHealthCheckSuccess: false,
      lastHealthCheckTime: new Date().toISOString(),
      actionsPermitted: ['chat', 'reasoning', 'direct_response', 'task_planning'],
      limits: { maxTokens: 4096, localOnly: true, model: config.ollama.model },
      setupInstructions: `1. Ensure Ollama is installed on Windows. Download from https://ollama.com/download\n2. Run Ollama service: 'ollama serve' or start from Windows tray\n3. Pull the required model: 'ollama pull ${config.ollama.model}'\n4. Default endpoint: http://127.0.0.1:11434`,
      alternatives: ['Configure OPENAI_API_KEY or ANTHROPIC_API_KEY in server/.env']
    });

    // 2. OpenAI (Optional Hosted)
    this.capabilities.set('openai', {
      id: 'openai',
      name: 'OpenAI Hosted Provider',
      category: 'ai_model',
      implemented: true,
      configured: Boolean(config.openai.apiKey),
      credentialsAvailable: Boolean(config.openai.apiKey),
      providerReachable: false,
      lastHealthCheckSuccess: false,
      lastHealthCheckTime: new Date().toISOString(),
      actionsPermitted: ['chat', 'tool_calling', 'structured_output'],
      limits: { model: config.openai.model },
      setupInstructions: `1. Obtain an API key from https://platform.openai.com\n2. Set OPENAI_API_KEY=your_key in server/.env\n3. Restart the server`,
      alternatives: ['Use the local Ollama provider (no key required)']
    });

    // 3. Anthropic (Optional Hosted)
    this.capabilities.set('anthropic', {
      id: 'anthropic',
      name: 'Anthropic Claude Hosted Provider',
      category: 'ai_model',
      implemented: true,
      configured: Boolean(config.anthropic.apiKey),
      credentialsAvailable: Boolean(config.anthropic.apiKey),
      providerReachable: false,
      lastHealthCheckSuccess: false,
      lastHealthCheckTime: new Date().toISOString(),
      actionsPermitted: ['chat', 'tool_calling'],
      limits: { model: config.anthropic.model },
      setupInstructions: `1. Obtain an API key from https://console.anthropic.com\n2. Set ANTHROPIC_API_KEY=your_key in server/.env\n3. Restart the server`,
      alternatives: ['Use the local Ollama provider (no key required)']
    });

    // 4. Safe Calculator
    this.capabilities.set('calculator', {
      id: 'calculator',
      name: 'Safe Mathematical Calculator',
      category: 'computation',
      implemented: true,
      configured: true,
      credentialsAvailable: true,
      providerReachable: true,
      lastHealthCheckSuccess: true,
      lastHealthCheckTime: new Date().toISOString(),
      actionsPermitted: ['arithmetic', 'algebra', 'unit_conversion', 'matrix_operations', 'statistics'],
      limits: { maxExpressionLength: 1000, executionTimeoutMs: 2000 },
      setupInstructions: 'Built-in deterministic safe mathjs AST engine. No setup required.'
    });

    // 5. Safe Workspace Filesystem
    this.capabilities.set('workspace_files', {
      id: 'workspace_files',
      name: 'Workspace File Operations',
      category: 'filesystem',
      implemented: true,
      configured: true,
      credentialsAvailable: true,
      providerReachable: false,
      lastHealthCheckSuccess: false,
      lastHealthCheckTime: new Date().toISOString(),
      actionsPermitted: ['list_files', 'read_file', 'write_file', 'create_directory'],
      limits: {
        workspaceRoot: config.workspaceRoot,
        maxFileSize: '5MB',
        restrictedToSandbox: true
      },
      setupInstructions: `The safe workspace sandbox path is: ${config.workspaceRoot}. Ensure this folder exists and is writable.`
    });

    // 6. Document Reader
    this.capabilities.set('documents', {
      id: 'documents',
      name: 'Document Analysis & Reader',
      category: 'documents',
      implemented: true,
      configured: true,
      credentialsAvailable: true,
      providerReachable: true,
      lastHealthCheckSuccess: true,
      lastHealthCheckTime: new Date().toISOString(),
      actionsPermitted: ['read_text', 'read_markdown', 'read_json', 'summarize_sections'],
      limits: { maxTokensPerChunk: 8000 },
      setupInstructions: 'Built-in document parsing engine for text, markdown, code, and JSON files.'
    });

    // 7. Structured Data & CSV
    this.capabilities.set('structured_data', {
      id: 'structured_data',
      name: 'Structured Data & CSV Engine',
      category: 'structured_data',
      implemented: true,
      configured: true,
      credentialsAvailable: true,
      providerReachable: true,
      lastHealthCheckSuccess: true,
      lastHealthCheckTime: new Date().toISOString(),
      actionsPermitted: ['parse_csv', 'filter_rows', 'aggregate_columns', 'export_csv', 'transform_json'],
      limits: { maxRows: 10000 },
      setupInstructions: 'Built-in streaming CSV parser and tabular aggregation utilities.'
    });

    // 8. Web Search
    this.capabilities.set('web_search', {
      id: 'web_search',
      name: 'Configured Web Search',
      category: 'web_search',
      implemented: true,
      configured: config.search.provider !== 'none',
      credentialsAvailable: Boolean(config.search.tavilyApiKey || config.search.braveApiKey || config.search.searxngUrl),
      providerReachable: false,
      lastHealthCheckSuccess: false,
      lastHealthCheckTime: new Date().toISOString(),
      actionsPermitted: ['search_queries', 'extract_sources'],
      limits: { maxResultsPerQuery: 5 },
      setupInstructions: `1. Select a provider in server/.env (e.g. SEARCH_PROVIDER=tavily or brave or searxng)\n2. Add your provider key: TAVILY_API_KEY=tvly-xxx or BRAVE_API_KEY=BSAx...\n3. If using local SearXNG, set SEARXNG_URL=http://localhost:8080\n4. Restart the server`,
      alternatives: ['Provide the document or file directly into the chat for offline analysis']
    });

    // 9. Email & SMTP
    this.capabilities.set('email', {
      id: 'email',
      name: 'Email Integration (SMTP)',
      category: 'email',
      implemented: true,
      configured: Boolean(config.email.host && config.email.user),
      credentialsAvailable: Boolean(config.email.pass),
      providerReachable: false,
      lastHealthCheckSuccess: false,
      lastHealthCheckTime: new Date().toISOString(),
      actionsPermitted: ['draft_email', 'verify_recipient', 'send_email_with_approval'],
      limits: {
        mandatoryApproval: config.security.requireApprovalForExternalSend,
        allowedFrom: config.email.from || 'agent@system'
      },
      setupInstructions: `1. Configure SMTP credentials in server/.env:\n   SMTP_HOST=smtp.gmail.com (or your mail server)\n   SMTP_PORT=587\n   SMTP_USER=you@example.com\n   SMTP_PASS=app_password\n   SMTP_FROM=you@example.com\n2. Note: For Gmail, use an App Password from Google Account Security settings.`,
      alternatives: ['Draft the email text in chat so you can copy and send it manually']
    });

    // 10. Sales & CRM
    this.capabilities.set('crm', {
      id: 'crm',
      name: 'Internal Sales & CRM Engine',
      category: 'crm',
      implemented: true,
      configured: true,
      credentialsAvailable: true,
      providerReachable: false,
      lastHealthCheckSuccess: false,
      lastHealthCheckTime: new Date().toISOString(),
      actionsPermitted: ['list_contacts', 'add_contact', 'update_lead_status', 'add_lead_note', 'create_followup_task', 'get_sales_pipeline'],
      limits: { localPostgresStorage: true },
      setupInstructions: 'Internal CRM system persists directly to PostgreSQL database. Automatically active.'
    });

    // 11. Persistent Memory
    this.capabilities.set('memory', {
      id: 'memory',
      name: 'User-Controlled Memory',
      category: 'memory',
      implemented: true,
      configured: true,
      credentialsAvailable: true,
      providerReachable: false,
      lastHealthCheckSuccess: false,
      lastHealthCheckTime: new Date().toISOString(),
      actionsPermitted: ['store_memory', 'query_memory', 'delete_memory', 'list_all_memories'],
      limits: { explicitConsentRequired: true },
      setupInstructions: 'Persistent memory stored in PostgreSQL. User can view, edit, or delete memories anytime.'
    });
  }

  public async runHealthCheckAll(): Promise<CapabilityStatus[]> {
    const checks = Array.from(this.capabilities.keys()).map(id => this.runHealthCheck(id));
    await Promise.all(checks);
    return this.getAllCapabilities();
  }

  public async runHealthCheck(id: string): Promise<CapabilityStatus> {
    const cap = this.capabilities.get(id);
    if (!cap) {
      throw new Error(`Unknown capability: ${id}`);
    }

    const now = new Date().toISOString();
    cap.lastHealthCheckTime = now;

    try {
      switch (id) {
        case 'ollama': {
          const res = await fetch(`${config.ollama.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const data: any = await res.json();
            const models: any[] = data.models || [];
            const hasModel = models.some((m: any) => m.name.includes(config.ollama.model) || config.ollama.model.includes(m.name));
            cap.providerReachable = true;
            cap.lastHealthCheckSuccess = true;
            cap.errorDetails = hasModel
              ? undefined
              : `Ollama is running, but configured model '${config.ollama.model}' is not pulled yet. Available: ${models.map(m => m.name).join(', ') || 'none'}`;
          } else {
            cap.providerReachable = false;
            cap.lastHealthCheckSuccess = false;
            cap.errorDetails = `Ollama server returned HTTP ${res.status}`;
          }
          break;
        }

        case 'openai': {
          if (!config.openai.apiKey) {
            cap.configured = false;
            cap.credentialsAvailable = false;
            cap.providerReachable = false;
            cap.lastHealthCheckSuccess = false;
            cap.errorDetails = 'OPENAI_API_KEY is not set';
          } else {
            cap.configured = true;
            cap.credentialsAvailable = true;
            try {
              const res = await fetch('https://api.openai.com/v1/models', {
                headers: { Authorization: `Bearer ${config.openai.apiKey}` },
                signal: AbortSignal.timeout(4000)
              });
              cap.providerReachable = res.ok;
              cap.lastHealthCheckSuccess = res.ok;
              cap.errorDetails = res.ok ? undefined : `OpenAI API returned HTTP ${res.status}`;
            } catch (err: any) {
              cap.providerReachable = false;
              cap.lastHealthCheckSuccess = false;
              cap.errorDetails = err.message;
            }
          }
          break;
        }

        case 'anthropic': {
          if (!config.anthropic.apiKey) {
            cap.configured = false;
            cap.credentialsAvailable = false;
            cap.providerReachable = false;
            cap.lastHealthCheckSuccess = false;
            cap.errorDetails = 'ANTHROPIC_API_KEY is not set';
          } else {
            cap.configured = true;
            cap.credentialsAvailable = true;
            cap.providerReachable = true; // Key present
            cap.lastHealthCheckSuccess = true;
            cap.errorDetails = undefined;
          }
          break;
        }

        case 'workspace_files': {
          if (!fs.existsSync(config.workspaceRoot)) {
            fs.mkdirSync(config.workspaceRoot, { recursive: true });
          }
          fs.accessSync(config.workspaceRoot, fs.constants.R_OK | fs.constants.W_OK);
          cap.providerReachable = true;
          cap.lastHealthCheckSuccess = true;
          cap.errorDetails = undefined;
          break;
        }

        case 'calculator':
        case 'documents':
        case 'structured_data': {
          cap.providerReachable = true;
          cap.lastHealthCheckSuccess = true;
          cap.errorDetails = undefined;
          break;
        }

        case 'web_search': {
          if (config.search.provider === 'none') {
            cap.configured = false;
            cap.credentialsAvailable = false;
            cap.providerReachable = false;
            cap.lastHealthCheckSuccess = false;
            cap.errorDetails = 'Search provider is disabled (SEARCH_PROVIDER=none)';
          } else if (config.search.provider === 'tavily' && config.search.tavilyApiKey) {
            cap.configured = true;
            cap.credentialsAvailable = true;
            cap.providerReachable = true;
            cap.lastHealthCheckSuccess = true;
            cap.errorDetails = undefined;
          } else {
            cap.configured = true;
            cap.credentialsAvailable = false;
            cap.providerReachable = false;
            cap.lastHealthCheckSuccess = false;
            cap.errorDetails = `Provider '${config.search.provider}' is selected but API key / URL is missing`;
          }
          break;
        }

        case 'email': {
          if (!config.email.host || !config.email.user || !config.email.pass) {
            cap.configured = false;
            cap.credentialsAvailable = false;
            cap.providerReachable = false;
            cap.lastHealthCheckSuccess = false;
            cap.errorDetails = 'SMTP host, user, or pass not configured in .env';
          } else {
            cap.configured = true;
            cap.credentialsAvailable = true;
            try {
              const transporter = nodemailer.createTransport({
                host: config.email.host,
                port: config.email.port,
                secure: config.email.secure,
                auth: { user: config.email.user, pass: config.email.pass },
                connectionTimeout: 4000
              });
              await transporter.verify();
              cap.providerReachable = true;
              cap.lastHealthCheckSuccess = true;
              cap.errorDetails = undefined;
            } catch (err: any) {
              cap.providerReachable = false;
              cap.lastHealthCheckSuccess = false;
              cap.errorDetails = `SMTP connection failed: ${err.message}`;
            }
          }
          break;
        }

        case 'crm':
        case 'memory': {
          try {
            await prisma.$queryRaw`SELECT 1`;
            cap.providerReachable = true;
            cap.lastHealthCheckSuccess = true;
            cap.errorDetails = undefined;
          } catch (err: any) {
            cap.providerReachable = false;
            cap.lastHealthCheckSuccess = false;
            cap.errorDetails = `PostgreSQL database unreachable: ${err.message}`;
          }
          break;
        }
      }
    } catch (err: any) {
      cap.providerReachable = false;
      cap.lastHealthCheckSuccess = false;
      cap.errorDetails = err.message;
    }

    this.capabilities.set(id, cap);
    return cap;
  }

  public getCapability(id: string): CapabilityStatus | undefined {
    return this.capabilities.get(id);
  }

  public getAllCapabilities(): CapabilityStatus[] {
    return Array.from(this.capabilities.values());
  }

  public isAvailable(id: string): boolean {
    const cap = this.capabilities.get(id);
    if (!cap) return false;
    return cap.implemented && cap.configured && cap.providerReachable && cap.lastHealthCheckSuccess;
  }
}

export const capabilityRegistry = new CapabilityRegistry();
