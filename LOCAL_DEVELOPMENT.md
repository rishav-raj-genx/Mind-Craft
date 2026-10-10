# Local Development Guide

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local or managed)
- Redis 7+ (local install or Docker)
- A Clerk application
- A Sarvam API key for voice and study-hint routes

## 1. Install dependencies

Use pnpm consistently with the checked-in lockfiles:

```bash
cd backend
pnpm install

cd ../frontend-react
pnpm install
```

## 2. Configure environment files

```bash
cd backend
cp .env.example .env

cd ../frontend-react
cp .env.example .env.local
```

Required values to fetch manually:

| Variable | Where to get it |
| --- | --- |
| `DATABASE_URL` | PostgreSQL provider or local PostgreSQL credentials |
| `CLERK_SECRET_KEY` | Clerk Dashboard, API keys |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Clerk Dashboard, webhook endpoint settings |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard, API keys |
| `SARVAM_API_KEY` | Sarvam AI dashboard |

Local defaults already provided in the examples include the PostgreSQL database name,
`REDIS_URL=redis://localhost:6379`, backend port `3000`, frontend port `5173`,
CORS origins, Socket.io path, retry limits, and weekly audit settings.

The Neo4j, Firebase, and Google variables are transitional/optional. They remain in
the examples because active legacy route and notification surfaces still read them.

## 3. Start PostgreSQL and Redis

Start PostgreSQL using the installation method for your operating system. For Redis,
Docker is the most reproducible local option:

```bash
docker run --name mindcraft-redis -p 6379:6379 -d redis:7-alpine
```

If the container already exists, use:

```bash
docker start mindcraft-redis
```

## 4. Generate Prisma Client and apply the schema

```bash
cd backend
pnpm prisma generate
pnpm prisma db push
```

For migration-based development instead, use:

```bash
pnpm prisma migrate dev
```

## 5. Run the backend

Use separate terminals for the API and background workers:

```bash
cd backend
pnpm dev
```

```bash
cd backend
pnpm worker:chat
```

```bash
cd backend
pnpm scheduler:weekly-audit
```

Verify the API:

```bash
curl http://localhost:3000/health
```

## 6. Run the frontend

```bash
cd frontend-react
pnpm dev
```

Open `http://localhost:5173`.

## 7. Run the test suites

Backend:

```bash
cd backend
pnpm test
```

Frontend:

```bash
cd frontend-react
pnpm test
```

Additional validation:

```bash
cd backend
pnpm prisma validate

cd ../frontend-react
pnpm build
```
