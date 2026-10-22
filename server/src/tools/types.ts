import { z } from 'zod';

export type RiskLevel = 'safe' | 'moderate' | 'destructive' | 'external_communication';

export interface ExecutionContext {
  userId: string;
  conversationId: string;
  isApprovalGranted?: boolean;
  approvedAction?: {
    tool: string;
    input: any;
  };
}

export type ToolExecutionStatus = 'success' | 'error' | 'requires_approval' | 'skipped';

export interface ToolResult {
  status?: ToolExecutionStatus;
  success: boolean;
  data?: any;
  error?: string;
  auditDetails?: Record<string, any>;
  requiresApproval?: boolean;
  approvalPrompt?: string;
}

export interface AgentTool<TInput = any> {
  name: string;
  description: string;
  category: string;
  riskLevel: RiskLevel;
  inputSchema: z.ZodSchema<TInput>;
  requiresApproval: (input: TInput) => boolean;
  getApprovalPrompt?: (input: TInput) => string;
  execute: (input: TInput, context: ExecutionContext) => Promise<ToolResult>;
}
