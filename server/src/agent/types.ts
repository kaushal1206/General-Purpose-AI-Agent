export type AgentEventType =
  | 'status'
  | 'thought'
  | 'token'
  | 'plan'
  | 'step_start'
  | 'step_complete'
  | 'step_failed'
  | 'tool_call'
  | 'tool_result'
  | 'approval_required'
  | 'complete'
  | 'error';

export interface AgentEvent {
  type: AgentEventType;
  data: any;
  timestamp: string;
}

export type AgentEventHandler = (event: AgentEvent) => void;

export type TaskCategory =
  | 'direct_response'
  | 'calculation'
  | 'filesystem'
  | 'documents'
  | 'structured_data'
  | 'web_research'
  | 'email'
  | 'crm'
  | 'memory_operations'
  | 'multi_step_workflow'
  | 'clarification_required'
  | 'unsupported';

export type StepRecoveryPolicy = 'abort' | 'retry_once' | 'continue_optional';

export interface PlanStepItem {
  number: number;
  description: string;
  purpose?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  dependsOnStep?: number[];
  inputMapping?: Record<string, string>;
  expectedOutput?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked' | 'skipped' | 'awaiting_approval';
  recoveryPolicy?: StepRecoveryPolicy;
  requiresApproval?: boolean;
  result?: any;
  error?: string;
}

export interface TaskPlanDefinition {
  goal: string;
  category: TaskCategory;
  steps: PlanStepItem[];
  isValid?: boolean;
  validationErrors?: string[];
}
