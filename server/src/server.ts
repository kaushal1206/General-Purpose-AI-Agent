import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { apiRouter } from './routes/api.js';
import { ensureDefaultUser } from './db/prisma.js';
import { capabilityRegistry } from './capabilities/registry.js';
import { jobQueue } from './jobs/job_queue.js';
import fs from 'fs';

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Audit log middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api') && req.method !== 'GET') {
    console.log(`[API AUDIT] ${new Date().toISOString()} ${req.method} ${req.path}`);
  }
  next();
});

// Mount API routes
app.use('/api', apiRouter);

// Ensure workspace directory exists
if (!fs.existsSync(config.workspaceRoot)) {
  fs.mkdirSync(config.workspaceRoot, { recursive: true });
}

// Start Server
export const server = app.listen(config.port, async () => {
  console.log(`====================================================`);
  console.log(`🧠 Autonomous General-Purpose AI Agent Server`);
  console.log(`📡 Listening on http://localhost:${config.port}`);
  console.log(`📁 Safe Workspace Sandbox: ${config.workspaceRoot}`);
  console.log(`🗄️ Database: PostgreSQL (${config.databaseUrl})`);
  console.log(`🤖 Free-First Model: Ollama (${config.ollama.model}) at ${config.ollama.baseUrl}`);
  console.log(`====================================================`);

  try {
    await ensureDefaultUser();
    console.log(`✅ Default user verified.`);

    // Run initial capability checks
    console.log(`🔍 Running initial capability health checks...`);
    const caps = await capabilityRegistry.runHealthCheckAll();
    const ready = caps.filter(c => c.lastHealthCheckSuccess).map(c => c.name);
    console.log(`⚡ Verified working capabilities (${ready.length}/${caps.length}): ${ready.join(', ')}`);

    // Start background job queue
    jobQueue.startQueue(5000);
    console.log(`⚙️ Durable background job queue started.`);
  } catch (err: any) {
    console.error(`❌ Startup initialization warning:`, err.message);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  jobQueue.stopQueue();
  server.close(() => {
    console.log('Server gracefully stopped.');
    process.exit(0);
  });
});
