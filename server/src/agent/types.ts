export type AgentEventType =
  | 'status'
  | 'thought'
  | 'token'
  | 'plan'
  | 'step_start'
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
  | 'multi_step_workflow';

export interface PlanStepItem {
  number: number;
  description: string;
  toolName?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked' | 'awaiting_approval';
  requiresApproval?: boolean;
}

export interface TaskPlanDefinition {
  goal: string;
  category: TaskCategory;
  steps: PlanStepItem[];
}
