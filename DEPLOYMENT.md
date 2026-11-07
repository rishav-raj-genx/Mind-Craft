# Production Deployment Guide

This guide details the step-by-step production deployment for the Mindcraft full-stack application.

---

## Architecture Overview

```
                                      +------------------------+
                                      |   Clerk Auth Service   |
                                      +-----------+------------+
                                                  | Webhook (svix)
                                                  v
+------------------------+             +------------------------+             +----------------------+
|     Vercel Edge        |   HTTPS     |    Railway / Render    |   Prisma    |   PostgreSQL (Neon)  |
| Frontend (React + Vite)| ----------> |   Backend API Server   | ----------> |   (Users, Sessions,  |
|   + Socket.io client   | <---------+ |  (Express + Socket.io) |             |    Doubts, Badges)   |
+------------------------+  WebSocket  +-----------+------------+             +----------------------+
                                                  |
                                                  | Redis Adapter &
                                                  | BullMQ Queues
                                                  v
                                       +------------------------+
                                       |  Redis (Upstash / AWS) |
                                       +-----------+------------+
                                                  |
                                                  | Job Dispatch
                                                  v
                                       +------------------------+
                                       |   Background Workers   |
                                       |  - Chat Persistence    |
                                       |  - Weekly Warrior Cron |
                                       +------------------------+
```

---

## 1. Prerequisites & Services Checklist

Create accounts for the following services:
- **Clerk:** [clerk.com](https://clerk.com) (Authentication & User Identity)
- **Database:** [Neon](https://neon.tech) or [Supabase](https://supabase.com) (Serverless PostgreSQL)
- **Cache/Queue:** [Upstash](https://upstash.com) or [Railway](https://railway.app) (Managed Redis)
- **Backend Compute:** [Railway](https://railway.app) or [Render](https://render.com) (Web Service + Worker Services)
- **Frontend Hosting:** [Vercel](https://vercel.com) (Static / SPA Hosting)
- **AI Service:** [Sarvam AI](https://sarvam.ai) (Speech-to-Text & Doubt Study Hints)

---

## 2. Database & Cache Setup

### A. PostgreSQL (Neon / Supabase)
1. Create a new PostgreSQL database named `mindcraft`.
2. Copy the pooled connection string (with `?sslmode=require&schema=public`).
3. Set this as `DATABASE_URL`.

### B. Redis (Upstash / Railway)
1. Create a Redis instance.
2. Copy the connection URI: `rediss://default:<password>@<host>:<port>` (or standard `redis://`).
3. Set this as `REDIS_URL`.

---

## 3. Backend Deployment (Railway / Render)

### A. Environment Variables

Configure the following environment variables in your backend service:

```env
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname>?sslmode=require&schema=public

# Clerk Authentication
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...

# Redis & Real-Time Socket.io
REDIS_URL=rediss://default:<password>@<host>:<port>
SOCKET_IO_PATH=/socket.io
SOCKET_IO_CORS_ORIGIN=https://<your-frontend-domain>.vercel.app
CORS_ORIGIN=https://<your-frontend-domain>.vercel.app
FRONTEND_URL=https://<your-frontend-domain>.vercel.app

# BullMQ Configuration
CHAT_PERSISTENCE_CONCURRENCY=10
WEEKLY_AUDIT_CRON=0 0 * * 0
WEEKLY_AUDIT_TIMEZONE=Asia/Kolkata
WEEKLY_AUDIT_BATCH_SIZE=250

# Sarvam AI
SARVAM_API_KEY=<your-sarvam-api-key>
SARVAM_STT_URL=https://api.sarvam.ai/speech-to-text
SARVAM_CHAT_URL=https://api.sarvam.ai/v1/chat/completions
SARVAM_CHAT_MODEL=sarvam-30b
SARVAM_STT_TIMEOUT_MS=30000
SARVAM_CHAT_TIMEOUT_MS=10000
SARVAM_HINT_FALLBACK=true
```

### B. Database Migration on Deploy
Configure your build or release command:
```bash
pnpm prisma generate && pnpm prisma migrate deploy
```
*(Or `pnpm prisma db push` if managing schemas directly).*

### C. Services Configuration

1. **Web Service (API & Socket.io Server):**
   - Root Directory: `backend`
   - Build Command: `pnpm install --frozen-lockfile && pnpm prisma generate`
   - Start Command: `pnpm start`
   - Healthcheck Path: `/health`

2. **Worker 1 (Chat Persistence Worker):**
   - Root Directory: `backend`
   - Start Command: `pnpm worker:chat`
   - Restart Policy: Always

3. **Worker 2 (Weekly Warrior Audit & Scheduler):**
   - Root Directory: `backend`
   - Start Command: `pnpm scheduler:weekly-audit`
   - Restart Policy: Always

---

## 4. Clerk Webhook Configuration

To synchronize Clerk user signups and profile updates to PostgreSQL:

1. Open your **Clerk Dashboard** → **Webhooks**.
2. Click **Add Endpoint**.
3. **Endpoint URL:** `https://<your-backend-domain>/api/clerk-webhook`
4. **Subscribe to Events:**
   - `user.created`
   - `user.updated`
   - `user.deleted`
5. Copy the **Signing Secret** (`whsec_...`) and save it as `CLERK_WEBHOOK_SIGNING_SECRET` in your backend environment variables.

---

## 5. Frontend Deployment (Vercel)

1. Connect your repository to **Vercel**.
2. Set the **Root Directory** to `frontend-react`.
3. Framework Preset: **Vite**.
4. Configure Build & Output settings:
   - **Build Command:** `pnpm build`
   - **Output Directory:** `dist`
   - **Install Command:** `pnpm install`
5. Set the Environment Variables:
   - `VITE_CLERK_PUBLISHABLE_KEY`: `pk_live_...`
   - `VITE_API_BASE_URL`: `https://<your-backend-domain>`
6. Deploy the project.
7. Configure Clerk Allowed Origins:
   - Go to Clerk Dashboard → Paths & Domains.
   - Add your Vercel production domain (`https://<project-name>.vercel.app`).

---

## 6. Post-Deployment Verification Checklist

- [ ] **Health Check:** `curl https://<your-backend-domain>/health` returns `{"status":"ok"}`.
- [ ] **Auth Flow:** Visit frontend, register a new user with Clerk, confirm the user record is automatically created in PostgreSQL (`User` table).
- [ ] **Socket.io Handshake:** Open browser devtools Network tab, confirm WebSocket / Socket.io connects to `/socket.io/?EIO=4&transport=websocket` with HTTP 101 Switching Protocols.
- [ ] **Peer Matching:** Browse `/find-mate` and verify ranked match recommendations load from PostgreSQL via Prisma.
- [ ] **Real-Time Chat:** Exchange messages between two users; confirm messages appear instantly in chat and are persisted in PostgreSQL by the `chat-persistence` BullMQ worker.
- [ ] **AI Study Hints:** Post a doubt in the forum and verify bilingual hints are generated by Sarvam AI.

