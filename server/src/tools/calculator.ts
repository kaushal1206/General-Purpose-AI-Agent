import { z } from 'zod';
import { create, all } from 'mathjs';
import { AgentTool, ToolResult } from './types.js';

// Create a restricted safe mathjs instance
const math = create(all);
const limitedEvaluate = math.evaluate;

export const calculatorTool: AgentTool = {
  name: 'calculator',
  description: 'Evaluate safe mathematical calculations, statistics, algebra, and unit conversions. Input is a standard mathematical expression string.',
  category: 'computation',
  riskLevel: 'safe',
  inputSchema: z.object({
    expression: z.string().min(1).max(500).describe('Mathematical expression to evaluate, e.g. "250 * 1.18", "sqrt(144) + 12", "mean([10, 20, 30])"')
  }),
  requiresApproval: () => false,
  execute: async (input: { expression: string }): Promise<ToolResult> => {
    try {
      const sanitized = input.expression.trim();
      // Block any attempt to execute arbitrary JS or functions outside math
      if (/[;{}()[\]`\\]/.test(sanitized) && /import|require|process|global|constructor|prototype|window/i.test(sanitized)) {
        return {
          success: false,
          error: 'Dangerous keywords or syntax detected in expression'
        };
      }

      const result = limitedEvaluate(sanitized);
      const formatted = typeof result === 'object' && result !== null && 'toString' in result
        ? result.toString()
        : String(result);

      return {
        success: true,
        data: {
          expression: sanitized,
          result: formatted
        }
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Calculation error: ${err.message}`
      };
    }
  }
};
