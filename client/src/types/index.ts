export interface CapabilityStatus {
  id: string;
  name: string;
  category: string;
  implemented: boolean;
  configured: boolean;
  credentialsAvailable: boolean;
  providerReachable: boolean;
  lastHealthCheckSuccess: boolean;
  lastHealthCheckTime: string;
  errorDetails?: string;
  actionsPermitted: string[];
  setupInstructions: string;
  alternatives?: string[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
  taskPlans?: TaskPlan[];
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thoughtProcess?: string | null;
  toolCalls?: string | null;
  createdAt: string;
}

export interface TaskStep {
  id?: string;
  stepNumber: number;
  description: string;
  toolName?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked' | 'awaiting_approval' | 'verifying';
  verificationStatus?: 'unverified' | 'verifying' | 'verified' | 'verification_failed';
  error?: string;
  requiresApproval?: boolean;
}

export interface TaskPlan {
  id?: string;
  goal: string;
  status: 'planned' | 'running' | 'completed' | 'failed' | 'awaiting_approval' | 'cancelled';
  lifecycleState?: string;
  currentStep: number;
  totalSteps: number;
  steps: TaskStep[];
}

export interface MemoryItem {
  id: string;
  category: string;
  key: string;
  value: string;
  userConsentGiven: boolean;
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  status: 'lead' | 'contacted' | 'qualified' | 'customer' | 'churned';
  notes?: string;
  leadScore: number;
  createdAt: string;
}

export interface BackgroundJob {
  id: string;
  type: string;
  payload: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  result?: string;
  error?: string;
  runAt: string;
  createdAt: string;
}

export interface AgentEvent {
  type:
    | 'status'
    | 'thought'
    | 'token'
    | 'plan'
    | 'step_start'
    | 'step_verifying'
    | 'step_verified'
    | 'step_retrying'
    | 'step_complete'
    | 'step_failed'
    | 'tool_call'
    | 'tool_result'
    | 'approval_required'
    | 'cancelled'
    | 'complete'
    | 'error';
  data: any;
  timestamp: string;
  conversationId?: string;
}
