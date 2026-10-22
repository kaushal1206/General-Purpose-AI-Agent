import { z } from 'zod';
import { AgentTool, ToolResult, ExecutionContext } from './types.js';
import { prisma } from '../db/prisma.js';

export const crmTool: AgentTool = {
  name: 'crm',
  description: 'Manage sales leads, contacts, follow-up schedules, notes, and pipeline metrics stored in PostgreSQL.',
  category: 'crm',
  riskLevel: 'safe',
  inputSchema: z.object({
    action: z.enum([
      'list_contacts',
      'add_contact',
      'update_lead_status',
      'add_lead_note',
      'create_followup_task',
      'list_tasks',
      'complete_task',
      'get_sales_pipeline'
    ]).describe('CRM action to perform'),
    name: z.string().optional().describe('Contact full name'),
    email: z.string().email().optional().describe('Contact email address'),
    phone: z.string().optional().describe('Contact phone number'),
    company: z.string().optional().describe('Company or organization'),
    role: z.string().optional().describe('Job title or role'),
    status: z.enum(['lead', 'contacted', 'qualified', 'customer', 'churned']).optional(),
    leadScore: z.number().optional(),
    notes: z.string().optional().describe('Notes about lead or conversation'),
    contactId: z.string().optional().describe('ID of existing contact'),
    taskTitle: z.string().optional().describe('Title of follow-up task'),
    taskDescription: z.string().optional(),
    dueDate: z.string().optional().describe('ISO date string for task deadline'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    taskId: z.string().optional()
  }),
  requiresApproval: () => false,
  execute: async (input, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const userId = context.userId;

      switch (input.action) {
        case 'add_contact': {
          if (!input.name) {
            return { success: false, error: 'Name is required to create a contact' };
          }
          const contact = await prisma.contact.create({
            data: {
              userId,
              name: input.name,
              email: input.email,
              phone: input.phone,
              company: input.company,
              role: input.role,
              status: input.status || 'lead',
              leadScore: input.leadScore ?? 10,
              notes: input.notes
            }
          });

          return {
            success: true,
            data: {
              message: `Contact '${contact.name}' created in local CRM`,
              contact,
              storageType: 'local_database'
            }
          };
        }

        case 'list_contacts': {
          const contacts = await prisma.contact.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: { salesTasks: true }
          });

          return {
            success: true,
            data: {
              total: contacts.length,
              storageType: 'local_database',
              contacts
            }
          };
        }

        case 'update_lead_status': {
          if (!input.contactId || !input.status) {
            return { success: false, error: 'contactId and status are required for update_lead_status' };
          }
          const updated = await prisma.contact.update({
            where: { id: input.contactId },
            data: { status: input.status }
          });

          return {
            success: true,
            data: {
              message: `Updated lead status to '${input.status}' for contact '${updated.name}'`,
              contact: updated
            }
          };
        }

        case 'add_lead_note': {
          if (!input.contactId || !input.notes) {
            return { success: false, error: 'contactId and notes are required for add_lead_note' };
          }
          const existing = await prisma.contact.findUnique({ where: { id: input.contactId } });
          if (!existing) {
            return { success: false, error: `Contact ID '${input.contactId}' not found` };
          }

          const timestamp = new Date().toISOString();
          const appendNotes = existing.notes
            ? `${existing.notes}\n[${timestamp}] ${input.notes}`
            : `[${timestamp}] ${input.notes}`;

          const updated = await prisma.contact.update({
            where: { id: input.contactId },
            data: { notes: appendNotes }
          });

          return {
            success: true,
            data: {
              message: `Note added to contact '${updated.name}'`,
              contact: updated
            }
          };
        }

        case 'create_followup_task': {
          if (!input.taskTitle) {
            return { success: false, error: 'taskTitle is required to create a follow-up task' };
          }
          const task = await prisma.salesTask.create({
            data: {
              userId,
              contactId: input.contactId,
              title: input.taskTitle,
              description: input.taskDescription,
              dueDate: input.dueDate ? new Date(input.dueDate) : new Date(Date.now() + 86400000 * 2),
              priority: input.priority || 'medium'
            }
          });

          return {
            success: true,
            data: {
              message: `Follow-up task '${task.title}' created`,
              task
            }
          };
        }

        case 'list_tasks': {
          const tasks = await prisma.salesTask.findMany({
            where: { userId },
            include: { contact: true },
            orderBy: { dueDate: 'asc' }
          });

          return {
            success: true,
            data: {
              total: tasks.length,
              pendingCount: tasks.filter(t => !t.completed).length,
              tasks
            }
          };
        }

        case 'complete_task': {
          if (!input.taskId) {
            return { success: false, error: 'taskId is required to complete a task' };
          }
          const updated = await prisma.salesTask.update({
            where: { id: input.taskId },
            data: { completed: true }
          });

          return {
            success: true,
            data: {
              message: `Task '${updated.title}' marked as completed`,
              task: updated
            }
          };
        }

        case 'get_sales_pipeline': {
          const contacts = await prisma.contact.findMany({ where: { userId } });
          const pipeline: Record<string, number> = {
            lead: 0,
            contacted: 0,
            qualified: 0,
            customer: 0,
            churned: 0
          };

          for (const c of contacts) {
            pipeline[c.status] = (pipeline[c.status] || 0) + 1;
          }

          const pendingTasks = await prisma.salesTask.count({
            where: { userId, completed: false }
          });

          return {
            success: true,
            data: {
              totalContacts: contacts.length,
              pipelineBreakdown: pipeline,
              pendingFollowups: pendingTasks,
              storageType: 'local_database'
            }
          };
        }
      }
      return { success: false, error: 'Unknown CRM action' };
    } catch (err: any) {
      return { success: false, error: `CRM operation failed: ${err.message}` };
    }
  }
};
