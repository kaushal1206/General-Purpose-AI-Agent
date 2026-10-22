import { AgentTool, ExecutionContext, ToolResult } from './types.js';
import { calculatorTool } from './calculator.js';
import { datetimeTool } from './datetime.js';
import { workspaceFilesTool } from './workspace_files.js';
import { documentsTool } from './documents.js';
import { structuredDataTool } from './structured_data.js';
import { webSearchTool } from './web_search.js';
import { emailTool } from './email.js';
import { crmTool } from './crm.js';
import { memoryTool } from './memory.js';
import { prisma } from '../db/prisma.js';

export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  constructor() {
    this.register(calculatorTool);
    this.register(datetimeTool);
    this.register(workspaceFilesTool);
    this.register(documentsTool);
    this.register(structuredDataTool);
    this.register(webSearchTool);
    this.register(emailTool);
    this.register(crmTool);
    this.register(memoryTool);
  }

  public register(tool: AgentTool) {
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  public getToolDescriptions(): string {
    return this.getAllTools()
      .map(t => `- **${t.name}** (${t.category}, risk: ${t.riskLevel}): ${t.description}`)
      .join('\n');
  }

  public async executeTool(
    name: string,
    rawInput: any,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found in registry. Available tools: ${Array.from(this.tools.keys()).join(', ')}`
      };
    }

    const startTime = Date.now();
    let validatedInput: any;

    try {
      validatedInput = tool.inputSchema.parse(rawInput);
    } catch (valErr: any) {
      return {
        success: false,
        error: `Tool input schema validation failed: ${valErr.message}`
      };
    }

    // Check approval requirement: verify approval is bound to the exact tool and payload
    if (tool.requiresApproval(validatedInput)) {
      const isApprovedForThisSpecificAction =
        context.isApprovalGranted &&
        context.approvedAction &&
        context.approvedAction.tool === tool.name &&
        JSON.stringify(context.approvedAction.input) === JSON.stringify(validatedInput);

      if (!isApprovedForThisSpecificAction) {
        const prompt = tool.getApprovalPrompt
          ? tool.getApprovalPrompt(validatedInput)
          : `Approval required to execute '${tool.name}' with risk level '${tool.riskLevel}'.`;

        return {
          success: false,
          requiresApproval: true,
          approvalPrompt: prompt,
          data: {
            pendingAction: tool.name,
            input: validatedInput
          }
        };
      }
    }

    // Execute tool
    try {
      const result = await tool.execute(validatedInput, context);
      const duration = Date.now() - startTime;

      // Log to database asynchronously
      if (context.conversationId) {
        prisma.toolExecution.create({
          data: {
            conversationId: context.conversationId,
            toolName: tool.name,
            inputPayload: JSON.stringify(validatedInput),
            outputPayload: JSON.stringify(result.data ?? result.error),
            success: result.success,
            executionMs: duration,
            errorMessage: result.error,
            auditMetadata: JSON.stringify(result.auditDetails ?? {})
          }
        }).catch(() => {
          // Ignore async log failure
        });
      }

      return result;
    } catch (err: any) {
      const duration = Date.now() - startTime;
      if (context.conversationId) {
        prisma.toolExecution.create({
          data: {
            conversationId: context.conversationId,
            toolName: tool.name,
            inputPayload: JSON.stringify(validatedInput),
            outputPayload: null,
            success: false,
            executionMs: duration,
            errorMessage: err.message
          }
        }).catch(() => {});
      }

      return {
        success: false,
        error: `Internal tool execution exception: ${err.message}`
      };
    }
  }
}

export const toolRegistry = new ToolRegistry();
