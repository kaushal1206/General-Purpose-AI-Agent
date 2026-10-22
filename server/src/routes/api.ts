import { Router, Request, Response } from 'express';
import { prisma, ensureDefaultUser } from '../db/prisma.js';
import { capabilityRegistry } from '../capabilities/registry.js';
import { toolRegistry } from '../tools/registry.js';
import { providerRegistry } from '../providers/registry.js';
import { agentOrchestrator } from '../agent/loop.js';
import { jobQueue } from '../jobs/job_queue.js';

export const apiRouter = Router();

// Middleware helper to get current authenticated or default user
async function getCurrentUser() {
  return ensureDefaultUser();
}

// 1. Health check
apiRouter.get('/health', async (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 2. Capabilities
apiRouter.get('/capabilities', async (req: Request, res: Response) => {
  try {
    const list = await capabilityRegistry.runHealthCheckAll();
    res.json({ success: true, capabilities: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/capabilities/:id/check', async (req: Request, res: Response) => {
  try {
    const status = await capabilityRegistry.runHealthCheck(req.params.id);
    res.json({ success: true, capability: status });
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// 3. Providers
apiRouter.get('/providers', async (req: Request, res: Response) => {
  try {
    const providers = await providerRegistry.getAvailableProviders();
    const active = providerRegistry.getActiveProvider();
    res.json({
      success: true,
      activeProvider: active.id,
      providers
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/providers/active', async (req: Request, res: Response) => {
  try {
    const { providerId } = req.body;
    providerRegistry.setActiveProvider(providerId);
    res.json({ success: true, activeProvider: providerId });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 4. Tools
apiRouter.get('/tools', (req: Request, res: Response) => {
  const tools = toolRegistry.getAllTools().map(t => ({
    name: t.name,
    description: t.description,
    category: t.category,
    riskLevel: t.riskLevel
  }));
  res.json({ success: true, tools });
});

apiRouter.post('/tools/:name/execute', async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser();
    const result = await toolRegistry.executeTool(req.params.name, req.body, {
      userId: user.id,
      conversationId: '',
      isApprovalGranted: req.body.isApprovalGranted ?? false
    });
    res.json({ success: result.success, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Conversations
apiRouter.get('/conversations', async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser();
    const convs = await prisma.conversation.findMany({
      where: { userId: user.id, isArchived: false },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { messages: true } },
        taskPlans: { take: 1, orderBy: { createdAt: 'desc' } }
      }
    });
    res.json({ success: true, conversations: convs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/conversations', async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser();
    const title = req.body.title || 'New Conversation';
    const conv = await prisma.conversation.create({
      data: {
        userId: user.id,
        title
      }
    });
    res.json({ success: true, conversation: conv });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const conv = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        taskPlans: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: { steps: true }
        },
        toolExecutions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });
    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    res.json({ success: true, conversation: conv });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.delete('/conversations/:id', async (req: Request, res: Response) => {
  try {
    await prisma.conversation.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. SSE Streaming Chat Endpoint
apiRouter.post('/chat/stream', async (req: Request, res: Response) => {
  const { prompt, conversationId, approvalGranted, approvedToolName, approvedToolInput } = req.body;

  if (!prompt && !approvalGranted) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const user = await getCurrentUser();

  // Find or create conversation
  let activeConvId = conversationId;
  if (!activeConvId) {
    const newConv = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: prompt ? prompt.slice(0, 40) + '...' : 'Task execution'
      }
    });
    activeConvId = newConv.id;
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Keep-alive heartbeat
  const heartbeat = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  try {
    await agentOrchestrator.execute({
      prompt: prompt || 'Resume approved task',
      conversationId: activeConvId,
      userId: user.id,
      approvalGranted: Boolean(approvalGranted),
      approvedToolName,
      approvedToolInput,
      onEvent: (event) => {
        const payload = JSON.stringify({ ...event, conversationId: activeConvId });
        res.write(`data: ${payload}\n\n`);
      }
    });
  } catch (err: any) {
    const errorPayload = JSON.stringify({
      type: 'error',
      data: { error: err.message },
      timestamp: new Date().toISOString()
    });
    res.write(`data: ${errorPayload}\n\n`);
  } finally {
    clearInterval(heartbeat);
    res.write(`data: [DONE]\n\n`);
    res.end();
  }
});

// 7. Memory Management
apiRouter.get('/memory', async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser();
    const memories = await prisma.memoryItem.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' }
    });
    res.json({ success: true, memories });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/memory', async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser();
    const { key, value, category } = req.body;
    const memory = await prisma.memoryItem.create({
      data: {
        userId: user.id,
        key,
        value,
        category: category || 'preference',
        userConsentGiven: true
      }
    });
    res.json({ success: true, memory });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.delete('/memory/:id', async (req: Request, res: Response) => {
  try {
    await prisma.memoryItem.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Memory deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. CRM Endpoints
apiRouter.get('/crm/contacts', async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser();
    const contacts = await prisma.contact.findMany({
      where: { userId: user.id },
      include: { salesTasks: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, contacts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/crm/contacts', async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser();
    const contact = await prisma.contact.create({
      data: {
        userId: user.id,
        ...req.body
      }
    });
    res.json({ success: true, contact });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/crm/pipeline', async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser();
    const result = await toolRegistry.executeTool('crm', { action: 'get_sales_pipeline' }, {
      userId: user.id,
      conversationId: ''
    });
    res.json({ success: true, pipeline: result.data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Background Jobs
apiRouter.get('/jobs', async (req: Request, res: Response) => {
  try {
    const jobs = await jobQueue.listJobs(30);
    res.json({ success: true, jobs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/jobs', async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser();
    const { type, payload, delayMs } = req.body;
    const jobId = await jobQueue.enqueue(type, { ...payload, userId: user.id }, delayMs);
    res.json({ success: true, jobId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
