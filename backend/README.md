# Mindcraft Backend

Production backend for Mindcraft, built with Node.js, Express, PostgreSQL, Prisma, Clerk, Redis, Socket.io, OpenAI, and background workers. Neo4j, Firebase, Sarvam AI, and legacy WebSocket integrations remain during the incremental migration.

## Tech Stack

- Node.js 20+
- Express
- PostgreSQL through Prisma ORM
- Clerk for authentication identity
- Redis/BullMQ for background jobs
- Socket.io adapter for horizontally scalable chat
- OpenAI Whisper and GPT-4o-mini for AI features
- `sharp` + `multer` for compressed doubt image uploads

## PostgreSQL migration status

The initial Prisma schema covers users, colleges, departments, skills, doubts, answers, tags, votes, chat threads, participants, messages, match requests, tutoring sessions, token transactions, and activity days. Existing route and service modules still use Neo4j until each feature is migrated and validated.

## Socket.io chat

Realtime chat uses Socket.io with Clerk bearer-token authentication. Configure `REDIS_URL` to enable the Redis adapter for multi-instance broadcasts. Chat messages are acknowledged immediately as queued, emitted to the thread room, and persisted by the BullMQ `chat-persistence` worker into PostgreSQL. Run the worker separately with `npm run worker:chat`.

## Weekly Warrior audit

The weekly audit runs as a BullMQ job backed by Redis. Start the processor with
`npm run worker:weekly-audit`; start it with `--scheduler` in one dedicated
process to register the Sunday-midnight scheduler:

```bash
npm run scheduler:weekly-audit
```

The worker reads Prisma `ActivityDay` records, processes non-deleted users in
cursor-paginated batches, and awards the Weekly Warrior badge and 50 Mind
Tokens in an idempotent transaction. `WeeklyAuditRun`, `UserBadge`, and the
token transaction idempotency key allow retries and restarts without duplicate
rewards. Set `WEEKLY_AUDIT_TIMEZONE` and the process `TZ` to the same IANA
timezone (for example `Asia/Kolkata`) for the intended midnight boundary.

## SQL peer matching

Find Mate uses indexed PostgreSQL joins over `UserSkill` rather than graph traversal. A candidate is eligible when they have the same skill as the requester with the opposite direction (`LEARNS` versus `TEACHES`). Results are ranked by complementary skill overlap, reciprocal interest, same-college preference, teaching activity, and rating. Redis caches the first-page feed for 60 seconds when `REDIS_URL` is configured; cache failures fall back to PostgreSQL.

## Local Setup

```bash
cd backend
npm install
cp .env.example .env # if you create one, otherwise edit .env manually
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

## Required Environment Variables

```env
PORT=3000
NODE_ENV=development

# Target database layer
DATABASE_URL=postgresql://user:password@localhost:5432/mindcraft?schema=public

# Target auth provider
CLERK_SECRET_KEY=your-clerk-secret-key
CLERK_WEBHOOK_SIGNING_SECRET=your-clerk-webhook-signing-secret

# Target queue/realtime infrastructure
REDIS_URL=redis://localhost:6379

# Legacy variables retained until all dependent features migrate
NEO4J_URI=bolt+s://your-aura-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
NEO4J_DATABASE=neo4j

FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

SARVAM_API_KEY=your-sarvam-api-key
SARVAM_STT_URL=https://api.sarvam.ai/speech-to-text
SARVAM_CHAT_URL=https://api.sarvam.ai/v1/chat/completions
SARVAM_MAX_AUDIO_BYTES=10485760
SARVAM_STT_TIMEOUT_MS=30000
SARVAM_STT_MAX_ATTEMPTS=2
SARVAM_CHAT_TIMEOUT_MS=10000
SARVAM_CHAT_MAX_ATTEMPTS=3
SARVAM_RETRY_BASE_DELAY_MS=250
SARVAM_RETRY_MAX_DELAY_MS=3000

CORS_ORIGIN=*
```

Generate the Prisma client after installing dependencies:

```bash
npm run prisma:generate
```

Create and apply a local migration after PostgreSQL is available:

```bash
npm run prisma:migrate -- --name initial_relational_schema
```

## Clerk authentication

The frontend sends Clerk session tokens as `Authorization: Bearer <token>`. The backend verifies those tokens before protected routes and resolves the Clerk subject to `User.clerkUserId`. Configure a Clerk webhook for `POST /api/webhooks/clerk` with `user.created`, `user.updated`, and `user.deleted` events. Webhook requests are signature-verified and retried safely using the `ClerkWebhookEvent` table. Deleted Clerk users are soft-deactivated so forum, chat, session, and token history remains auditable.

Optional Google Calendar/Meet variables:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

## Scripts

```bash
npm start                  # production server
npm run dev                # watch-mode development server
npm run workflow:weekly-audit
npm run db:clear           # guarded AuraDB wipe, requires CONFIRM_CLEAR_AURADB=YES
```

## Main API Areas

- `GET /health`
- `/api/auth`
- `/api/user`
- `/api/match`
- `/api/chat`
- `/api/doubt`
- `/api/session`
- `/api/voice-search`
- gamification routes for tokens, streaks, and badges

## Sarvam AI Doubt Assist

When a doubt is posted, the backend:

1. Sends the title/content/tag to Sarvam's Indic LLM endpoint.
2. Requests a short bilingual English/Hindi study hint.
3. Rejects repeated generic hints and retries with a stricter prompt.
4. Falls back to a topic-specific local hint if Sarvam times out or fails.
5. Stores the result directly on the Neo4j `Doubt` node as `aiHint`.

Sarvam requests use bounded timeouts and exponential backoff for transient network,
rate-limit, and server errors. Invalid audio and oversized uploads are rejected
without retrying. Speech requests return a provider timeout/unavailable response
when retries are exhausted. Study hints use the existing topic-specific local
fallback so doubt creation does not leave the user waiting on Sarvam.

## Doubt Image Uploads

The doubt route accepts up to 4 images in the multipart field:

```txt
images
```

Each image is:

1. validated by MIME type and size,
2. compressed to WebP with `sharp`,
3. stored on the `Doubt` node as JSON in the `images` property,
4. returned to clients for thumbnail/slideshow display.

## Render Deployment

### If Deploying From The Full Monorepo

Use the root repository containing:

```txt
backend/
frontend-react/
render.yaml
```

In Render:

- New + -> Blueprint
- Branch: `main`
- Blueprint Path: `render.yaml`

The root `render.yaml` already uses:

```yaml
rootDir: backend
```

### If Deploying From A Backend-Only Repo

If your GitHub repo only contains backend files like:

```txt
server.js
package.json
src/
```

then use `backend/render.yaml` as that repo's root `render.yaml`. It intentionally does not use `rootDir: backend`.

## Pre-Deployment Checks

```bash
cd backend
node --check server.js
node --check src/routes/doubt.js
node --check src/services/sarvamAI.js
node --check src/workflows/weeklyAudit.js
node --check scripts/clearAuraDb.js
```

## Clearing AuraDB Before Demo

This is destructive:

```bash
cd backend
CONFIRM_CLEAR_AURADB=YES npm run db:clear
```

It runs:

```cypher
MATCH (n) DETACH DELETE n;
```
