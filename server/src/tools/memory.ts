import { z } from 'zod';
import { AgentTool, ToolResult, ExecutionContext } from './types.js';
import { prisma } from '../db/prisma.js';

export const memoryTool: AgentTool = {
  name: 'memory',
  description: 'Store, recall, search, or delete explicit user preferences, facts, and instructions in long-term memory.',
  category: 'memory',
  riskLevel: 'safe',
  inputSchema: z.object({
    action: z.enum(['store', 'recall', 'list_all', 'delete']).describe('Memory operation'),
    category: z.enum(['preference', 'fact', 'instruction', 'workflow']).default('preference'),
    key: z.string().optional().describe('Short identifier or topic, e.g. "preferred_language" or "timezone"'),
    value: z.string().optional().describe('Content to remember'),
    memoryId: z.string().optional().describe('ID of memory item to delete')
  }),
  requiresApproval: () => false,
  execute: async (input, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const userId = context.userId;

      switch (input.action) {
        case 'store': {
          if (!input.key || !input.value) {
            return { success: false, error: 'key and value are required to store a memory' };
          }

          // Security check: Never store sensitive secrets or credentials in long-term memory
          const lowerVal = input.value.toLowerCase();
          if (
            /sk-[a-zA-Z0-9_]{15,}/.test(input.value) ||
            /ghp_[a-zA-Z0-9_]{15,}/.test(input.value) ||
            lowerVal.includes('bearer ') ||
            lowerVal.includes('password') ||
            lowerVal.includes('private key')
          ) {
            return {
              status: 'error',
              success: false,
              error: 'Security policy violation: API keys, passwords, and sensitive credentials cannot be stored in long-term memory.'
            };
          }

          // Check if key already exists for this user
          const existing = await prisma.memoryItem.findFirst({
            where: { userId, key: input.key }
          });

          let memory;
          if (existing) {
            memory = await prisma.memoryItem.update({
              where: { id: existing.id },
              data: {
                value: input.value,
                category: input.category,
                updatedAt: new Date()
              }
            });
          } else {
            memory = await prisma.memoryItem.create({
              data: {
                userId,
                category: input.category,
                key: input.key,
                value: input.value,
                userConsentGiven: true
              }
            });
          }

          return {
            success: true,
            data: {
              message: `Saved to memory: [${memory.category}] ${memory.key} = "${memory.value}"`,
              memory
            }
          };
        }

        case 'recall': {
          if (!input.key) {
            return { success: false, error: 'key is required for recall' };
          }
          const memories = await prisma.memoryItem.findMany({
            where: {
              userId,
              OR: [
                { key: { contains: input.key, mode: 'insensitive' } },
                { value: { contains: input.key, mode: 'insensitive' } }
              ]
            }
          });

          return {
            success: true,
            data: {
              query: input.key,
              foundCount: memories.length,
              memories
            }
          };
        }

        case 'list_all': {
          const all = await prisma.memoryItem.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
          });

          return {
            success: true,
            data: {
              total: all.length,
              memories: all
            }
          };
        }

        case 'delete': {
          if (!input.memoryId && !input.key) {
            return { success: false, error: 'Either memoryId or key is required to delete a memory' };
          }

          if (input.memoryId) {
            await prisma.memoryItem.delete({ where: { id: input.memoryId } });
          } else if (input.key) {
            await prisma.memoryItem.deleteMany({ where: { userId, key: input.key } });
          }

          return {
            success: true,
            data: {
              message: 'Memory item deleted successfully'
            }
          };
        }
      }
      return { success: false, error: 'Unknown memory action' };
    } catch (err: any) {
      return { success: false, error: `Memory operation failed: ${err.message}` };
    }
  }
};
