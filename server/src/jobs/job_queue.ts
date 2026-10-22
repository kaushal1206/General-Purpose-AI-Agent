import { prisma } from '../db/prisma.js';
import { toolRegistry } from '../tools/registry.js';

export type JobHandler = (payload: any) => Promise<any>;

export class DurableJobQueue {
  private handlers: Map<string, JobHandler> = new Map();
  private isProcessing = false;
  private intervalTimer: NodeJS.Timeout | null = null;
  private concurrencyLimit = 2;
  private activeJobs = 0;

  constructor() {
    this.registerDefaultHandlers();
  }

  private registerDefaultHandlers() {
    // 1. Email delivery or retry job
    this.registerHandler('email_dispatch', async (payload) => {
      const result = await toolRegistry.executeTool('email', payload, {
        userId: payload.userId,
        conversationId: payload.conversationId || '',
        isApprovalGranted: true
      });
      if (!result.success) {
        throw new Error(result.error || 'Email dispatch job failed');
      }
      return result.data;
    });

    // 2. Scheduled follow-up task sync
    this.registerHandler('scheduled_followup', async (payload) => {
      const task = await prisma.salesTask.create({
        data: {
          userId: payload.userId,
          contactId: payload.contactId,
          title: payload.title || 'Scheduled follow-up',
          description: payload.description,
          dueDate: new Date(payload.dueDate || Date.now() + 86400000)
        }
      });
      return task;
    });

    // 3. Document indexing or file verification
    this.registerHandler('verify_workspace', async (payload) => {
      const res = await toolRegistry.executeTool('workspace_files', { operation: 'list_files', filePath: '.' }, {
        userId: payload.userId,
        conversationId: ''
      });
      return res.data;
    });
  }

  public registerHandler(type: string, handler: JobHandler) {
    this.handlers.set(type, handler);
  }

  public async enqueue(type: string, payload: any, delayMs: number = 0): Promise<string> {
    const runAt = new Date(Date.now() + delayMs);
    const job = await prisma.backgroundJob.create({
      data: {
        type,
        payload: JSON.stringify(payload),
        status: 'queued',
        runAt
      }
    });

    // Trigger queue processing
    this.processNext();
    return job.id;
  }

  public startQueue(pollIntervalMs: number = 5000) {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => {
      this.processNext();
    }, pollIntervalMs);
    // Also trigger immediately
    this.processNext();
  }

  public stopQueue() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private async processNext() {
    if (this.activeJobs >= this.concurrencyLimit) return;

    try {
      // Find oldest pending job ready to run
      const job = await prisma.backgroundJob.findFirst({
        where: {
          status: 'queued',
          runAt: { lte: new Date() }
        },
        orderBy: { runAt: 'asc' }
      });

      if (!job) return;

      this.activeJobs++;

      // Update to processing
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: 'processing',
          attempts: job.attempts + 1
        }
      });

      const handler = this.handlers.get(job.type);
      if (!handler) {
        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            error: `No registered handler for job type '${job.type}'`,
            completedAt: new Date()
          }
        });
        this.activeJobs--;
        this.processNext();
        return;
      }

      // Execute Handler
      try {
        const payload = JSON.parse(job.payload);
        const result = await handler(payload);

        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            result: JSON.stringify(result),
            completedAt: new Date()
          }
        });
      } catch (execErr: any) {
        const isExhausted = job.attempts + 1 >= job.maxAttempts;
        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: isExhausted ? 'failed' : 'queued',
            error: execErr.message,
            runAt: isExhausted ? job.runAt : new Date(Date.now() + 10000) // 10s retry backoff
          }
        });
      } finally {
        this.activeJobs--;
        // Check for more
        this.processNext();
      }
    } catch {
      // DB poll error handling
    }
  }

  public async getJobStatus(jobId: string) {
    return prisma.backgroundJob.findUnique({ where: { id: jobId } });
  }

  public async listJobs(limit: number = 20) {
    return prisma.backgroundJob.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' }
    });
  }
}

export const jobQueue = new DurableJobQueue();
