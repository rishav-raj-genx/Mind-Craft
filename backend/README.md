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
