import { AgentEventHandler, TaskCategory } from './types.js';
import { inspectPrompt, sanitizeToolOutput } from './prompt_guard.js';
import { classifyRequest, generatePlan } from './planner.js';
import { toolRegistry } from '../tools/registry.js';
import { providerRegistry } from '../providers/registry.js';
import { capabilityRegistry } from '../capabilities/registry.js';
import { prisma } from '../db/prisma.js';
import { config } from '../config/index.js';
import { ChatMessage } from '../providers/types.js';

export interface AgentRunOptions {
  prompt: string;
  conversationId: string;
  userId: string;
  onEvent: AgentEventHandler;
  approvalGranted?: boolean;
  approvedToolName?: string;
  approvedToolInput?: any;
}

export function extractToolCall(text: string): { tool: string; input: any } | null {
  // 1. Try markdown fenced code block
  const fencedMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?"tool"[\s\S]*?\})\s*```/i);
  if (fencedMatch) {
    try {
      const parsed = JSON.parse(fencedMatch[1]);
      if (parsed.tool && parsed.input !== undefined) return parsed;
    } catch {}
  }

  // 2. Try bare JSON matching {"tool": "...", "input": {...}}
  const bareMatch = text.match(/(\{[\s\S]*?"tool"\s*:\s*"[^"]+"[\s\S]*?"input"\s*:\s*\{[\s\S]*?\}\s*\})/i);
  if (bareMatch) {
    try {
      const parsed = JSON.parse(bareMatch[1]);
      if (parsed.tool && parsed.input !== undefined) return parsed;
    } catch {}
  }

  // 3. Search for outermost JSON object with "tool" and "input"
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const candidate = text.substring(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(candidate);
      if (parsed.tool && parsed.input !== undefined) return parsed;
    } catch {}
  }

  // 4. Action: tool_name / Action Input: {...}
  const actionMatch = text.match(/Action:\s*([a-zA-Z0-9_]+)[\s\S]*?Action Input:\s*(\{[\s\S]*?\})/i);
  if (actionMatch) {
    try {
      const input = JSON.parse(actionMatch[2]);
      return { tool: actionMatch[1].trim(), input };
    } catch {}
  }

  return null;
}

export class AgentOrchestrator {
  public async execute(options: AgentRunOptions): Promise<void> {
    const { prompt, conversationId, userId, onEvent, approvalGranted, approvedToolName, approvedToolInput } = options;

    const emit = (type: any, data: any) => {
      onEvent({
        type,
        data,
        timestamp: new Date().toISOString()
      });
    };

    emit('status', { message: 'Analyzing request and inspecting security policies...' });

    // 1. Prompt Injection & Policy Guard
    const guard = inspectPrompt(prompt);
    if (!guard.safe) {
      emit('error', { error: guard.warning || 'Security violation detected in input.' });
      emit('complete', { summary: 'Blocked due to policy override or injection attempt.' });
      return;
    }

    // 2. Load User Preferences & Memory
    const memories = await prisma.memoryItem.findMany({
      where: { userId },
      take: 10,
      orderBy: { updatedAt: 'desc' }
    });

    const memoryContext = memories.length > 0
      ? `\n[User Long-Term Memory & Preferences]:\n` + memories.map(m => `- [${m.category}] ${m.key}: ${m.value}`).join('\n')
      : '';

    // 3. Load Multi-turn Conversation History
    const history = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20
    });

    // 4. Classify & Plan
    const category: TaskCategory = classifyRequest(prompt);
    const plan = generatePlan(prompt, category);

    // Save TaskPlan in Database
    let dbPlan: any = null;
    try {
      dbPlan = await prisma.taskPlan.create({
        data: {
          conversationId,
          goal: prompt,
          status: 'running',
          totalSteps: plan.steps.length,
          currentStep: 0,
          steps: {
            create: plan.steps.map(s => ({
              stepNumber: s.number,
              description: s.description,
              toolName: s.toolName,
              status: s.status,
              requiresApproval: Boolean(s.requiresApproval)
            }))
          }
        },
        include: { steps: true }
      });
    } catch {
      // Continue even if DB log fails
    }

    emit('plan', { plan: dbPlan || plan });

    // Handle resumed approval if provided
    if (approvalGranted && approvedToolName && approvedToolInput) {
      emit('status', { message: `Resuming approved action: ${approvedToolName}` });
      const toolRes = await toolRegistry.executeTool(approvedToolName, approvedToolInput, {
        userId,
        conversationId,
        isApprovalGranted: true,
        approvedAction: {
          tool: approvedToolName,
          input: approvedToolInput
        }
      });
      emit('tool_result', {
        tool: approvedToolName,
        success: toolRes.success,
        data: sanitizeToolOutput(toolRes.data),
        error: toolRes.error
      });
    }

    // 5. System Prompt Construction
    const activeProvider = providerRegistry.getActiveProvider();

    // Contextual tool focus based on classified category
    const systemPrompt = `You are an autonomous AI agent with real local tools.
Solve the user's request accurately and safely.

CRITICAL RULES:
1. Never hallucinate or claim an action succeeded unless verified by a tool output.
2. If a tool is required, invoke it using a single JSON code block:
\`\`\`json
{
  "tool": "tool_name",
  "input": { ... }
}
\`\`\`
3. If no tool is needed, answer directly.
4. If a capability is unconfigured, honestly explain why and provide instructions.

AVAILABLE TOOLS:
- calculator: evaluate math expressions {"expression": "..."}
- datetime: get current time or date arithmetic {"operation": "current_time"|"add_days"|"diff_dates"}
- workspace_files: read/write/list in workspace sandbox {"operation": "list_files"|"read_file"|"write_file", "filePath": "...", "content": "..."}
- documents: inspect doc content {"documentPath": "..."}
- structured_data: parse/filter/aggregate CSV {"operation": "parse_csv"|"filter_rows"|"aggregate_column", "csvFilePath": "..."}
- crm: manage contacts & pipeline {"action": "list_contacts"|"add_contact"|"get_sales_pipeline", "name": "...", "email": "..."}
- memory: store/recall user preferences {"action": "store"|"recall"|"list_all", "key": "...", "value": "..."}
- email: draft or send email {"action": "draft"|"send", "to": "...", "subject": "...", "body": "..."}
- web_search: search live web {"query": "..."}
${memoryContext}
Workspace Root: ${config.workspaceRoot}
`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content
      })),
      { role: 'user', content: prompt }
    ];

    // 6. Controlled ReAct Execution Loop
    let iteration = 0;
    const maxIterations = config.security.maxExecutionSteps;
    let finalAssistantResponse = '';
    let accumulatedThoughts = '';

    while (iteration < maxIterations) {
      iteration++;
      emit('status', { message: `Step ${iteration}: Consulting ${activeProvider.name}...` });

      let currentStepOutput = '';
      try {
        const completion = await activeProvider.generateCompletion(messages, {
          temperature: 0.2,
          streamCallback: (chunk: string) => {
            currentStepOutput += chunk;
            // Check if chunk contains thinking
            if (chunk.includes('<thought>') || currentStepOutput.includes('<thought>')) {
              emit('thought', { chunk });
            }
          }
        });

        currentStepOutput = completion.content || currentStepOutput;
      } catch (provErr: any) {
        emit('error', {
          error: `Model provider error (${activeProvider.name}): ${provErr.message}. Check capability diagnostics for setup instructions.`
        });
        emit('complete', { summary: 'Task halted due to model provider error.' });
        return;
      }

      // Extract thoughts
      const thoughtMatch = currentStepOutput.match(/<thought>([\s\S]*?)<\/thought>/);
      if (thoughtMatch) {
        accumulatedThoughts += '\n' + thoughtMatch[1].trim();
      }

      // Check for tool call
      const toolCall = extractToolCall(currentStepOutput);

      if (!toolCall) {
        // No tool requested; this is the final answer!
        finalAssistantResponse = currentStepOutput.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
        emit('token', { token: finalAssistantResponse });
        break;
      }

      emit('tool_call', { tool: toolCall.tool, input: toolCall.input });

      // Execute Tool: fresh tool calls generated during the loop must require explicit approval if risky
      const result = await toolRegistry.executeTool(toolCall.tool, toolCall.input, {
        userId,
        conversationId,
        isApprovalGranted: false
      });

      // Check if Approval is Required
      if (result.requiresApproval) {
        emit('approval_required', {
          tool: toolCall.tool,
          input: toolCall.input,
          prompt: result.approvalPrompt || 'Approval required for this high-impact action.'
        });

        if (dbPlan) {
          await prisma.taskPlan.update({
            where: { id: dbPlan.id },
            data: { status: 'awaiting_approval' }
          });
        }

        emit('complete', { summary: 'Paused awaiting user approval for external or destructive action.' });
        return;
      }

      // Emit tool result
      const sanitizedData = sanitizeToolOutput(result.data);
      emit('tool_result', {
        tool: toolCall.tool,
        success: result.success,
        data: sanitizedData,
        error: result.error
      });

      // Append to messages for next iteration
      messages.push({ role: 'assistant', content: currentStepOutput });
      const obsContent = result.success
        ? `Observation from ${toolCall.tool}: ${JSON.stringify(sanitizedData)}`
        : `Observation from ${toolCall.tool} [FAILED]: ${result.error || 'Unknown tool failure'}`;
      messages.push({ role: 'user', content: obsContent });
    }

    // 7. Persist to PostgreSQL Database
    try {
      // Save User Message
      await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: prompt
        }
      });

      // Save Assistant Message
      if (finalAssistantResponse) {
        await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: finalAssistantResponse,
            thoughtProcess: accumulatedThoughts.trim() || null
          }
        });
      }

      // Mark Plan as Completed
      if (dbPlan) {
        await prisma.taskPlan.update({
          where: { id: dbPlan.id },
          data: { status: 'completed' }
        });
      }
    } catch {
      // DB log non-fatal
    }

    emit('complete', {
      summary: finalAssistantResponse ? 'Task completed successfully.' : 'Max execution iterations reached.',
      iterations: iteration
    });
  }
}

export const agentOrchestrator = new AgentOrchestrator();
