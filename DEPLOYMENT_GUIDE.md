# Deployment Guide — General-Purpose AI Agent
**Author & Developer:** Kaushal Bhardwaj  
**Repository:** [https://github.com/kaushal1206/General-Purpose-AI-Agent.git](https://github.com/kaushal1206/General-Purpose-AI-Agent.git)  
**Architecture:** Hybrid Cloud Frontend (Vercel) + Local Hardware AI Core (Express + PostgreSQL + Ollama)

---

## 1. Overview & Architecture Strategy

This deployment uses a **Free-First Hybrid Architecture**:
- **Frontend:** Hosted globally on Vercel's Edge CDN (React 18, TypeScript, Vite, SPA routing).
- **Backend & AI Core:** Runs privately on your local PC (Node.js/Express on port `3001`, PostgreSQL on port `5434`, Ollama on port `11434` with model `llama3.2:1b`).
- **Bridge:** An encrypted HTTPS tunnel (e.g. Cloudflare Tunnel or ngrok) maps incoming secure frontend API calls directly to your local backend on port `3001`.

```
┌─────────────────────────────────┐
│     Vercel Global Edge CDN      │
│   (React + TypeScript + Vite)   │
│  "Designed & Developed by       │
│        Kaushal Bhardwaj"        │
└───────────────┬─────────────────┘
                │ HTTPS API Calls (VITE_API_URL)
                ▼
┌─────────────────────────────────┐
│   Encrypted Secure HTTPS Tunnel │
│  (Cloudflare Tunnel / ngrok)    │
└───────────────┬─────────────────┘
                │ Forwards to localhost:3001
                ▼
┌─────────────────────────────────┐
│         Your Local PC           │
│  ┌───────────────────────────┐  │
│  │ Express Backend (:3001)   │  │
│  └──────┬─────────────┬──────┘  │
│         │             │         │
│         ▼             ▼         │
│  ┌────────────┐ ┌─────────────┐ │
│  │ PostgreSQL │ │ Ollama LLM  │ │
│  │   (:5434)  │ │   (:11434)  │ │
│  │  (Private) │ │  (Private)  │ │
│  └────────────┘ └─────────────┘ │
└─────────────────────────────────┘
```

> [!IMPORTANT]
> **Zero Public Exposure of Internal Ports:**
> - PostgreSQL port `5434` is strictly local and never exposed to the public internet.
> - Ollama port `11434` is strictly local and never exposed to the public internet.
> - Only the Express API port `3001` is exposed through the encrypted HTTPS tunnel.
> - No paid cloud AI APIs are required. Your local `llama3.2:1b` model handles all agent inference.

---

## 2. Vercel Frontend Configuration

### Exact Vercel Project Settings
When importing the repository into Vercel, configure the project with these exact parameters:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Framework Preset** | `Vite` | Detected automatically by Vercel |
| **Root Directory** | `client` | Click "Edit" and choose the `client` directory |
| **Build Command** | `npm run build` | Compiles TypeScript and runs Vite production bundle |
| **Output Directory** | `dist` | Generated static production assets |
| **Install Command** | `npm install` | Installs frontend dependencies |
| **Node.js Version** | `20.x` or `22.x` | Modern LTS Node.js runtime |

### Environment Variables on Vercel
In your Vercel Project Settings under **Settings > Environment Variables**, add:

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://your-tunnel-subdomain.trycloudflare.com` | Public HTTPS URL provided by your tunnel to reach backend port `3001`. |

> [!NOTE]
> Do NOT set any backend secrets (such as `DATABASE_URL`, JWT secrets, or internal ports) in Vercel. Vite bundles all `VITE_*` variables into client-side JavaScript. Only public client configuration belongs here.

---

## 3. Step-by-Step GitHub-to-Vercel Deployment

1. **Push Changes to GitHub** (When ready):
   ```bash
   git add client/src/App.tsx client/src/styles/index.css client/src/services/api.ts client/.env.example client/vercel.json vercel.json DEPLOYMENT_GUIDE.md
   git commit -m "feat(branding): add developer attribution and prepare Vercel deployment"
   git push origin main
   ```

2. **Connect to Vercel**:
   - Navigate to [vercel.com](https://vercel.com) and log in.
   - Click **"Add New..."** > **"Project"**.
   - Select your GitHub repository: `kaushal1206/General-Purpose-AI-Agent`.

3. **Configure Project**:
   - Set **Root Directory** to `client`.
   - Expand **Environment Variables** and add:
     - Name: `VITE_API_URL`
     - Value: `https://your-tunnel-url.trycloudflare.com` (leave temporary placeholder if tunnel is not yet started).

4. **Deploy**:
   - Click **"Deploy"**.
   - Vercel will run the build and publish your site at `https://general-purpose-ai-agent-xxxx.vercel.app`.

---

## 4. Secure Backend HTTPS Tunnel Setup

To allow the deployed Vercel frontend (which runs over HTTPS) to communicate with your local Express server, establish an encrypted HTTPS tunnel forwarding to port `3001`.

### Option A: Cloudflare Quick Tunnel (100% Free, Recommended, No Account Required)
1. Download `cloudflared` for Windows (or install via winget / scoop):
   ```powershell
   winget install Cloudflare.cloudflared
   ```
2. Start the tunnel forwarding to your local backend:
   ```powershell
   cloudflared tunnel --url http://localhost:3001
   ```
3. Cloudflare will output a public HTTPS URL like:
   ```
   https://random-words-1234.trycloudflare.com
   ```
4. Copy this URL and set it as `VITE_API_URL` in your Vercel project environment variables (or redeploy / promote).

### Option B: ngrok (Free Account)
1. Install and authenticate ngrok:
   ```powershell
   winget install ngrok.ngrok
   ngrok config add-authtoken <your-auth-token>
   ```
2. Start the tunnel:
   ```powershell
   ngrok http 3001
   ```
3. Copy the provided Forwarding HTTPS URL (e.g. `https://abc-123.ngrok-free.app`) to Vercel's `VITE_API_URL`.

---

## 5. Local Backend & Ollama Startup Instructions

Whenever you want to use the deployed agent, run these services locally on your PC:

### Step 1: Start PostgreSQL (Port 5434)
If not running as a Windows service, start PostgreSQL from PowerShell:
```powershell
& "C:\Program Files\PostgreSQL\18\bin\postgres.exe" -D "d:\agent_pg_data" -p 5434
```

### Step 2: Start Ollama (Port 11434)
Ensure the Ollama daemon is running with model `llama3.2:1b`:
```powershell
# In PowerShell:
ollama serve
# Verify model exists:
ollama list
# If needed, pull the model:
ollama pull llama3.2:1b
```

### Step 3: Start the Backend Server (Port 3001)
```powershell
cd "d:\general-purpose AI agent\server"
npm run dev
```
Verify the backend is healthy:
```powershell
curl http://localhost:3001/api/health
# Response: {"status":"ok","database":true,"ollama":true,"model":"llama3.2:1b",...}
```

### Step 4: Launch the HTTPS Tunnel
```powershell
cloudflared tunnel --url http://localhost:3001
```

---

## 6. Verification Checklist

- [x] **Developer Attribution:** Footer displaying `"Designed & Developed by Kaushal Bhardwaj"` fixed at the bottom of the viewport with responsive padding and existing design tokens.
- [x] **Frontend Production Build:** `npm run build` inside `client/` generates `dist/` cleanly with 0 TypeScript or bundle errors.
- [x] **SPA Routing Fallback:** Both `client/vercel.json` and root `vercel.json` rewrite all non-file routes (`/(.*)`) to `/index.html` to prevent 404s on browser reloads.
- [x] **Dynamic Base URL:** `client/src/services/api.ts` checks `VITE_API_URL`. If blank (local development), it defaults to `/api` (Vite proxy). If set (production), it prepends the tunnel URL.
- [x] **CORS Pre-configured:** `server/src/server.ts` enables CORS with wildcard origins (`origin: '*'`), allowing cross-origin requests from Vercel.
- [x] **Zero Port Exposure:** PostgreSQL (5434) and Ollama (11434) remain purely loopback internal.

---

## 7. Deployment Limitations & Troubleshooting

1. **PC Power & Sleep:**
   - Because the AI reasoning model (`llama3.2:1b`), database, and execution engine reside on your hardware, your PC must remain on and awake for the Vercel frontend to process requests.
   - If your PC is asleep, the Vercel frontend will show a network error.

2. **Tunnel Ephemeral URLs:**
   - Quick tunnels (`trycloudflare.com` or free ngrok without fixed domain) generate a new URL every time the command is restarted.
   - If you restart the tunnel, update `VITE_API_URL` in Vercel and redeploy, or configure a free persistent named Cloudflare Tunnel with your own domain.

3. **Database Migration Safety:**
   - Never run `prisma migrate reset` in production or during deployment.
   - All migrations in `server/prisma/migrations` are preserved and current.
