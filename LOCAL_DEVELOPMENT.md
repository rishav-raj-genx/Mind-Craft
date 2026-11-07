# Local Development Guide

## Prerequisites

- Node.js 20+
- `pnpm` (Corepack or standalone: `corepack enable pnpm`)
- PostgreSQL 14+ (local install, Docker, or hosted instance such as Neon/Supabase)
- Redis 7+ (local install, Docker, or Upstash)
- Clerk Application Account (Publishable Key, Secret Key, and Webhook Signing Secret)
- Sarvam AI API Key (for speech-to-text and bilingual study hints)

---

## 1. Install Dependencies

Use `pnpm` exclusively across all directories:

```bash
cd backend && pnpm install
cd ../frontend-react && pnpm install
```

---

## 2. Configure Environment Files

### Backend (`backend/.env`)

```bash
cd backend
cp .env.example .env
```

Populate the required keys in `backend/.env`:

| Variable | Description | Source |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL | Local Postgres or Neon/Supabase |
| `CLERK_SECRET_KEY` | Clerk Backend Secret Key (`sk_test_...`) | Clerk Dashboard → API Keys |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Signing secret for Clerk webhooks (`whsec_...`) | Clerk Dashboard → Webhooks |
| `REDIS_URL` | Redis connection URL (`redis://localhost:6379`) | Local Redis or Upstash |
| `SARVAM_API_KEY` | Sarvam AI API Key | Sarvam Dashboard |

### Frontend (`frontend-react/.env.local`)

```bash
cd frontend-react
cp .env.example .env.local
```

Populate the required keys in `frontend-react/.env.local`:

| Variable | Description | Source |
| --- | --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key (`pk_test_...`) | Clerk Dashboard → API Keys |
| `VITE_API_BASE_URL` | Backend HTTP & Socket.io server origin | `http://localhost:3000` |

> **Note on White Screen Prevention:** If `VITE_CLERK_PUBLISHABLE_KEY` is missing or contains the placeholder `pk_test_replace_me`, the frontend gracefully renders an informative interactive setup screen rather than crashing.

---

## 3. Start PostgreSQL and Redis

### Option A: Local Services / Docker

For Redis:
```bash
docker run --name mindcraft-redis -p 6379:6379 -d redis:7-alpine
```

For PostgreSQL:
```bash
docker run --name mindcraft-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mindcraft -p 5432:5432 -d postgres:16-alpine
```

### Option B: Cloud Services
You can also use Neon (Postgres) and Upstash (Redis) URLs directly in your `.env`.

---

## 4. Run Prisma Migrations & Generate Client

```bash
cd backend
pnpm prisma generate
pnpm prisma db push
```

To verify Prisma schema integrity:
```bash
pnpm prisma validate
```

---

## 5. Run the Backend & Workers

In separate terminal tabs:

**Terminal 1 — API Server:**
```bash
cd backend
pnpm dev
```

**Terminal 2 — BullMQ Chat Persistence Worker:**
```bash
cd backend
pnpm worker:chat
```

**Terminal 3 — BullMQ Weekly Warrior Scheduler & Worker:**
```bash
cd backend
pnpm scheduler:weekly-audit
```

Verify backend health:
```bash
curl http://localhost:3000/health
# Response: {"status":"ok","timestamp":1709...}
```

---

## 6. Run the Frontend

In a new terminal:
```bash
cd frontend-react
pnpm dev
```

Open `http://localhost:5173` in your browser.

---

## 7. Run Test Suites & Quality Checks

Run all unit and integration tests:

```bash
# Backend Jest/Supertest Suite (SessionRouter, Clerk Webhook, Matching Engine, Sarvam AI)
cd backend && pnpm test

# Frontend Vitest Suite (Hooks, Protected State, Components)
cd ../frontend-react && pnpm test

# Frontend ESLint (Must exit with 0 errors)
cd ../frontend-react && pnpm lint

# Frontend Production Build (Vite + PWA)
cd ../frontend-react && pnpm build
```
