export type AgentEventType =
  | 'status'
  | 'thought'
  | 'token'
  | 'plan'
  | 'step_start'
  | 'step_verifying'
  | 'step_verified'
  | 'step_complete'
  | 'step_failed'
  | 'step_retrying'
  | 'tool_call'
  | 'tool_result'
  | 'approval_required'
  | 'cancelled'
  | 'complete'
  | 'error';

export interface AgentEvent {
  type: AgentEventType;
  data: any;
  timestamp: string;
  conversationId?: string;
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

export type TaskLifecycleState =
  | 'queued'
  | 'planning'
  | 'running'
  | 'awaiting_approval'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export type StepRecoveryPolicy = 'abort' | 'retry_once' | 'continue_optional';

export type VerificationMethod =
  | 'file_exists_and_matches'
  | 'csv_rows_verified'
  | 'crm_record_persisted'
  | 'output_non_empty'
  | 'none';

export interface StepVerificationRequirement {
  method: VerificationMethod;
  targetPath?: string;
  expectedProperty?: string;
  description: string;
}

export interface StepRecoveryStrategy {
  policy: StepRecoveryPolicy;
  maxRetries: number;
  backoffMs: number;
  currentRetryCount?: number;
}

export interface PlanStepItem {
  number: number;
  description: string;
  purpose?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  dependsOnStep?: number[];
  inputMapping?: Record<string, string>;
  expectedOutput?: string;
  verification?: StepVerificationRequirement;
  verificationStatus?: 'unverified' | 'verifying' | 'verified' | 'verification_failed';
  preconditions?: string[];
  completionCondition?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked' | 'skipped' | 'awaiting_approval';
  recoveryPolicy?: StepRecoveryPolicy;
  recoveryStrategy?: StepRecoveryStrategy;
  requiresApproval?: boolean;
  result?: any;
  error?: string;
}

export interface TaskPlanDefinition {
  goal: string;
  category: TaskCategory;
  lifecycleState?: TaskLifecycleState;
  preconditions?: string[];
  completionConditions?: string[];
  steps: PlanStepItem[];
  isValid?: boolean;
  validationErrors?: string[];
}
