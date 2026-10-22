# Antigravity Agent OS — Autonomous General-Purpose AI Agent Platform

A production-grade, completely independent, general-purpose autonomous AI agent built from scratch in TypeScript with React, Node.js, PostgreSQL (Prisma), and local Ollama (`llama3.2:1b`) as the primary free-first AI engine.

---

## 🌟 Key Features

1. **Free-First AI Foundation**: Operates locally with **Ollama** (`llama3.2:1b`) out of the box with zero subscription or paid API requirements. Supports optional hosted providers (**OpenAI**, **Anthropic Claude**) with seamless switching.
2. **Live Capability Registry**: Actively tracks 11 system capabilities. Truthfully reports when an external integration is unconfigured or unreachable, providing exact setup guidance and useful offline alternatives.
3. **Controlled ReAct Orchestration Loop**: Classifies tasks, decomposes multi-step goals into execution timelines, and limits step iterations and execution timeouts.
4. **Autonomous Execution with Mandatory Approval Gates**: Safe operations (arithmetic, sandboxed file reading, lead note creation) execute autonomously; high-risk operations (external email dispatch, file overwrites) halt and require explicit human confirmation.
5. **Safe Workspace Sandbox**: Strict path validation prevents path traversal (`..`), confining agent filesystem operations exclusively to `d:/general-purpose AI agent/workspace`.
6. **User-Controlled Long-Term Memory**: Durable preferences and instructions stored in PostgreSQL with explicit user consent, searchable and purgeable anytime.
7. **Internal Sales & CRM Pipeline**: Contact directory, lead scoring, follow-up scheduling, and pipeline stage metrics.
8. **Durable Background Job Queue**: Persistent background task runner with retry tracking, crash recovery, and bounded concurrency.
9. **Real-Time Streaming**: Server-Sent Events (SSE) stream internal thoughts (`<thought>...</thought>`), tool invocations, live tool outputs, and answer tokens to the frontend.

---

## 🏗️ Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │       React + TypeScript Frontend (Vite)     │
                               │  - Multi-Turn Chat & Streaming Responses     │
                               │  - Live Task Execution Timeline              │
                               │  - Capability Diagnostics Dashboard          │
                               │  - Sales & CRM Pipeline View                 │
                               │  - User Memory & Background Jobs Monitor     │
                               └──────────────────────┬───────────────────────┘
                                                      │ SSE Streams & REST API
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │        Node.js + Express + TypeScript        │
                               ├──────────────────────────────────────────────┤
                               │  Agent Orchestrator (ReAct Loop)             │
                               │   ├─ Prompt Injection & Policy Guard         │
                               │   ├─ Task Classifier & Step Planner          │
                               │   ├─ Live Capability Diagnostics             │
                               │   └─ Approval Gate Manager                   │
                               ├──────────────────────────────────────────────┤
                               │  Typed Tool Registry (Zod Validated)         │
                               │   ├─ Safe Calculator (mathjs AST)            │
                               │   ├─ Sandboxed Filesystem (Workspace Root)   │
                               │   ├─ Structured Data & CSV Processor         │
                               │   ├─ Document Reader & Extractor             │
                               │   ├─ Internal Sales & CRM Engine             │
                               │   ├─ User Memory Manager                     │
                               │   ├─ SMTP Email Adapter (Approval Gate)      │
                               │   └─ Web Search Adapter (Tavily/Brave)       │
                               ├──────────────────────────────────────────────┤
                               │  Model Provider Abstraction Layer            │
                               │   ├─ Ollama (Local Free-First Default)       │
                               │   ├─ OpenAI Hosted Adapter                   │
                               │   └─ Anthropic Claude Hosted Adapter         │
                               └──────────────────────┬───────────────────────┘
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
        ┌─────────────────────────────┐                               ┌─────────────────────────────┐
        │    Local PostgreSQL (5434)  │                               │    Local Ollama (11434)     │
        │  - Prisma ORM Client        │                               │  - Model: llama3.2:1b       │
        │  - Messages & Task Plans    │                               │  - Local Token Generation   │
        │  - Contacts & Sales Tasks   │                               │  - Zero Cloud Costs         │
        │  - User Memory & Audit Logs │                               └─────────────────────────────┘
        │  - Durable Background Jobs  │
        └─────────────────────────────┘
```

---

## 🚀 Quickstart Guide (Windows CMD)

### Prerequisites
- **Node.js**: v20+ (Verified on v22.14.0)
- **Ollama**: Installed and running (`ollama serve`, model: `llama3.2:1b`)
- **PostgreSQL**: Running on port `5434` with database `agent_db`

### 1. Install Dependencies
```cmd
cd "d:\general-purpose AI agent"
npm install
```

### 2. Configure Environment
A default working environment is provided in `server/.env`:
```ini
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://postgres@localhost:5434/agent_db
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:1b
WORKSPACE_ROOT=d:/general-purpose AI agent/workspace
```

### 3. Initialize Database Schema
```cmd
cd "d:\general-purpose AI agent\server"
npx prisma db push
```

### 4. Run Automated Test Suite
```cmd
cd "d:\general-purpose AI agent\server"
npm test
```
All 13 unit and integration tests will verify the safe calculator, path traversal sandbox protection, CSV parsing, prompt injection defense, and capability diagnostics.

### 5. Launch Backend Server
```cmd
cd "d:\general-purpose AI agent\server"
npm run dev
```
Backend will start on `http://localhost:3001`.

### 6. Launch Frontend Client
In a separate terminal:
```cmd
cd "d:\general-purpose AI agent\client"
npm run dev
```
Frontend will be available at `http://localhost:5173`.

---

## 🔒 Security & Autonomy Policy

- **Path Sandboxing**: The agent cannot access files outside `d:/general-purpose AI agent/workspace`. Attempts to access system directories (e.g. `../../Windows`) trigger immediate access denial.
- **Human Approval Required**:
  - Dispatching external emails via SMTP.
  - Overwriting existing workspace files.
- **Prompt Injection Defense**: Guard filters detect instructions attempting to bypass security boundaries or extract internal credentials.
- **Truthful Status**: Unconfigured external integrations (e.g. Web search without API key) never pretend to execute. The agent provides clear setup instructions and completes offline tasks.

---

## 📊 Live Verification Checklist

- [x] Node.js, PostgreSQL 18, and Ollama environment verified
- [x] PostgreSQL database cluster initialized on port 5434 with Prisma schema
- [x] Typed tool registry with Zod schemas and DB auditing
- [x] Local Ollama integration with real token streaming
- [x] Controlled ReAct orchestration loop with step planning and approval gates
- [x] Safe sandboxed workspace filesystem tools
- [x] User-controlled long-term memory system
- [x] Internal CRM contacts, follow-ups, and pipeline metrics
- [x] Durable background job execution queue
- [x] Modern SaaS-grade React frontend with glassmorphism design
- [x] 100% passing automated unit & integration test suite
