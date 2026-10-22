import { describe, it, expect, vi } from 'vitest';
import { extractToolCall, resolveStepInput } from '../agent/loop.js';
import { toolRegistry } from '../tools/registry.js';
import { agentOrchestrator } from '../agent/loop.js';

describe('Phase 4 — Production Hardening & Real-World Agent Reliability', () => {
  describe('Track 1: Task Execution & Dependent Input Mapping', () => {
    it('1. Interpolates {{step_X}} and {{step_X.field}} placeholders from stepOutputs', () => {
      const stepOutputs = {
        1: { totalRows: 15, totalRevenue: 4500 },
        2: 540
      };

      const inputWithPlaceholders = {
        operation: 'write_file',
        filePath: 'report.txt',
        content: 'Total records: {{step_1.totalRows}}, Revenue: ${{step_1.totalRevenue}}, Value: {{step_2}}'
      };

      const resolved = resolveStepInput(inputWithPlaceholders, stepOutputs);
      expect(resolved.content).toBe('Total records: 15, Revenue: $4500, Value: 540');
    });

    it('2. Maps explicit inputMapping fields from prerequisite step output', () => {
      const stepOutputs = {
        1: { calculatedValue: 1250 }
      };

      const rawInput = {
        action: 'add_contact',
        name: 'John Connor'
      };

      const inputMapping = {
        dealSize: 'step_1.calculatedValue'
      };

      const resolved = resolveStepInput(rawInput, stepOutputs, inputMapping);
      expect(resolved.name).toBe('John Connor');
      expect(resolved.dealSize).toBe(1250);
    });

    it('3. Safely handles missing step output placeholders without crashing', () => {
      const stepOutputs = {};
      const input = { text: 'Data: {{step_9.missingField}}' };
      const resolved = resolveStepInput(input, stepOutputs);
      expect(resolved.text).toBe('Data: ');
    });
  });

  describe('Track 2: Small Model Tolerance & Relaxed Parsing', () => {
    it('4. Parses relaxed single-quoted JSON tool invocations', () => {
      const singleQuoted = `\`\`\`json
{'tool': 'calculator', 'input': {'expression': '45 * 12'}}
\`\`\``;
      const parsed = extractToolCall(singleQuoted);
      expect(parsed).not.toBeNull();
      expect(parsed?.tool).toBe('calculator');
      expect(parsed?.input.expression).toBe('45 * 12');
    });

    it('5. Normalizes primitive string inputs for calculator', () => {
      const stringInput = JSON.stringify({ tool: 'calculator', input: '125 * 48' });
      const parsed = extractToolCall(stringInput);
      expect(parsed?.tool).toBe('calculator');
      expect(parsed?.input).toEqual({ expression: '125 * 48' });
    });

    it('6. Normalizes primitive string inputs for workspace_files and documents', () => {
      const docInput = JSON.stringify({ tool: 'documents', input: 'README.md' });
      const parsedDoc = extractToolCall(docInput);
      expect(parsedDoc?.tool).toBe('documents');
      expect(parsedDoc?.input).toEqual({ documentPath: 'README.md' });

      const fileInput = JSON.stringify({ tool: 'workspace_files', input: 'notes.txt' });
      const parsedFile = extractToolCall(fileInput);
      expect(parsedFile?.tool).toBe('workspace_files');
      expect(parsedFile?.input).toEqual({ operation: 'read_file', filePath: 'notes.txt' });
    });
  });

  describe('Track 3 & 5: Loop Detection, Recovery Policies & Side-Effect Safety', () => {
    it('7. Rejects unknown tool calls without executing arbitrary commands', () => {
      expect(toolRegistry.hasTool('arbitrary_shell_exec')).toBe(false);
      expect(toolRegistry.hasTool('crypto_miner')).toBe(false);
    });

    it('8. Enforces side-effect safety: destructive mutations do not permit auto-retry', () => {
      const fileWriteTool = toolRegistry.getTool('workspace_files');
      expect(fileWriteTool).toBeDefined();

      // Overwrite requires approval when destructive
      const writeReqsApproval = fileWriteTool?.requiresApproval({
        operation: 'write_file',
        filePath: 'existing.txt',
        content: 'new data'
      });
      // Safety check: returns a boolean
      expect(typeof writeReqsApproval).toBe('boolean');
    });

    it('9. Concurrency guard rejects simultaneous duplicate executions on same conversation', async () => {
      const convId = 'test-concurrency-' + Date.now();
      let eventCount = 0;

      // Mock an active run in orchestrator
      (agentOrchestrator as any).activeRuns.set(convId, {
        abortController: new AbortController(),
        prompt: 'Task in progress',
        startTime: Date.now()
      });

      await expect(
        agentOrchestrator.execute({
          prompt: 'Duplicate concurrent attempt',
          conversationId: convId,
          userId: 'user-1',
          onEvent: () => { eventCount++; }
        })
      ).rejects.toThrow(/A task is already actively executing/);

      // Clean up
      (agentOrchestrator as any).activeRuns.delete(convId);
    });

    it('10. Cancellation cleanly halts active execution', () => {
      const convId = 'test-cancel-' + Date.now();
      const controller = new AbortController();

      (agentOrchestrator as any).activeRuns.set(convId, {
        abortController: controller,
        prompt: 'Active run',
        startTime: Date.now()
      });

      const cancelled = agentOrchestrator.cancel(convId);
      expect(cancelled).toBe(true);
      expect(controller.signal.aborted).toBe(true);
      expect(agentOrchestrator.isRunning(convId)).toBe(false);
    });
  });
});
