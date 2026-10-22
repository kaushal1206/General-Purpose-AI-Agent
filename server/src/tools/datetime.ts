import { z } from 'zod';
import { AgentTool, ToolResult } from './types.js';

export const datetimeTool: AgentTool = {
  name: 'datetime',
  description: 'Get current date, time, timezone, or calculate relative dates, time differences, and formats.',
  category: 'utilities',
  riskLevel: 'safe',
  inputSchema: z.object({
    operation: z.enum(['current_time', 'add_days', 'diff_dates', 'format']).default('current_time'),
    baseDate: z.string().optional().describe('ISO date string or leave empty for current time'),
    days: z.number().optional().describe('Number of days to add/subtract'),
    compareDate: z.string().optional().describe('Target date for difference calculation')
  }),
  requiresApproval: () => false,
  execute: async (input): Promise<ToolResult> => {
    try {
      const now = input.baseDate ? new Date(input.baseDate) : new Date();
      if (isNaN(now.getTime())) {
        return { success: false, error: 'Invalid baseDate provided' };
      }

      switch (input.operation) {
        case 'current_time':
          return {
            success: true,
            data: {
              iso: now.toISOString(),
              localString: now.toLocaleString(),
              utcString: now.toUTCString(),
              dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()],
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
          };

        case 'add_days': {
          const daysToAdd = input.days ?? 0;
          const resultDate = new Date(now.getTime() + daysToAdd * 86400000);
          return {
            success: true,
            data: {
              originalDate: now.toISOString(),
              daysAdded: daysToAdd,
              resultDate: resultDate.toISOString(),
              formatted: resultDate.toLocaleDateString()
            }
          };
        }

        case 'diff_dates': {
          if (!input.compareDate) {
            return { success: false, error: 'compareDate is required for diff_dates' };
          }
          const compare = new Date(input.compareDate);
          if (isNaN(compare.getTime())) {
            return { success: false, error: 'Invalid compareDate' };
          }
          const diffMs = compare.getTime() - now.getTime();
          const diffDays = Math.round(diffMs / 86400000);
          return {
            success: true,
            data: {
              startDate: now.toISOString(),
              endDate: compare.toISOString(),
              diffMilliseconds: diffMs,
              diffDays,
              diffHours: Math.round(diffMs / 3600000)
            }
          };
        }

        case 'format':
          return {
            success: true,
            data: {
              iso: now.toISOString(),
              dateOnly: now.toISOString().split('T')[0],
              humanReadable: now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            }
          };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};
