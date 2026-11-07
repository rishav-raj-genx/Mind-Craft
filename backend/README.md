# Mindcraft Backend

Production backend service for Mindcraft, built with Node.js 20+, Express, PostgreSQL (via Prisma ORM), Clerk authentication, Redis, BullMQ background queues, and Socket.io.

---

## Tech Stack & Architecture

- **Runtime:** Node.js 20+
- **HTTP Server:** Express 4.x
- **Authentication:** `@clerk/express` (JWT session verification and Svix-verified webhooks)
- **Database:** PostgreSQL accessed exclusively through Prisma ORM
- **Cache & Real-Time Adapter:** Redis 7+ via `ioredis` and `@socket.io/redis-adapter`
- **Background Queues:** BullMQ for worker scheduling and async persistence
- **AI Integrations:** Sarvam AI (Speech-to-Text and bilingual study hints with retry/fallback)

---

## Prisma Schema Overview

The database layer is managed by Prisma (`prisma/schema.prisma`) with the following core models:

| Model | Purpose |
| --- | --- |
| `User` | User profile, Clerk ID mapping, college/department association, token balance |
| `College` / `Department` | Institutional taxonomy for campus-based peer matching |
| `Skill` / `UserSkill` | Skills indexed with `LEARNS` or `TEACHES` direction and proficiency |
| `MatchRequest` | Peer matchmaking state machine (`PENDING`, `ACCEPTED`, `REJECTED`) |
| `TutoringSession` | Scheduled sessions (`PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`) |
| `ChatThread` / `ChatParticipant` / `ChatMessage` | Multi-party and direct chat histories with read states |
| `Doubt` / `DoubtAnswer` / `DoubtVote` | Community forum questions, AI/peer answers, and upvotes |
| `ActivityDay` | Daily user engagement tracking for streaks |
| `TokenTransaction` | Idempotent ledger for Mind Tokens credited/debited |
| `Badge` / `UserBadge` | Earned achievements including Weekly Warrior and Streaks |
| `WeeklyAuditRun` | Audit execution history and idempotency keys |

---

## REST API Endpoints

### Authentication & Webhooks
- `GET /api/auth/me`: Fetch current authenticated user profile from Prisma.
- `GET /api/auth/check`: Verify active Clerk session.
- `POST /api/auth/logout`: Terminate session.
- `POST /api/clerk-webhook`: Svix-verified Clerk webhook syncing user creations, updates, and deletions to Prisma.

### Users & Profiles
- `GET /api/users`: Search and filter users by college, department, or skills.
- `GET /api/users/:uid`: Get detailed user profile with skills, ratings, and stats.
- `PUT /api/users/:uid`: Update user profile details.
- `PUT /api/users/:uid/skills`: Update user skills with `LEARNS` / `TEACHES` directions.

### Peer Matching
- `GET /api/matches`: Query compatible peer matches scored by SQL algorithm (cached in Redis).
- `POST /api/matches/request`: Send a study match request to a peer.
- `PUT /api/matches/:id/status`: Accept or reject a match request.

### Tutoring Sessions
- `GET /api/sessions`: List user's tutoring sessions (filter by `status=upcoming`, `pending`, `past`).
- `POST /api/sessions`: Schedule a new tutoring session.
- `PUT /api/sessions/:id/accept`: Accept a pending session request (creates calendar event).
- `PUT /api/sessions/:id/reject`: Decline a session request.
- `PUT /api/sessions/:id/complete`: Complete a session and distribute Mind Tokens.
- `POST /api/sessions/:id/rate`: Submit a review and rating for a completed session.

### Chat & Messaging
- `GET /api/chat/threads`: Get list of active chat threads for current user.
- `GET /api/chat/history/:threadId`: Get paginated message history.
- `GET /api/chat/threads/:threadId`: Get metadata and participants for a thread.
- `PUT /api/chat/:threadId/read`: Mark messages in thread as read.
- `PUT /api/chat/:threadId/messages/:messageId`: Edit an existing message.
- `DELETE /api/chat/:threadId/messages/:messageId`: Soft delete a message.

### Doubt Forum
- `GET /api/doubts`: List forum questions (filter by `status`, `tag`, `search`).
- `POST /api/doubts`: Create a new doubt (triggers Sarvam AI study hint generation).
- `GET /api/doubts/:id`: Get doubt details with answers and votes.
- `POST /api/doubts/:id/answers`: Post an answer to a doubt.
- `POST /api/doubts/:id/vote`: Upvote/downvote a doubt.
- `PUT /api/doubts/:id/resolve`: Mark a doubt as resolved.

### Gamification & Streaks
- `GET /api/gamification/streak/:uid`: Get current streak, highest streak, and freeze shields.
- `GET /api/gamification/badges/:uid`: Get all unlocked and available badges.
- `GET /api/gamification/tokens/:uid`: Get Mind Token balance and transaction ledger.
- `GET /api/gamification/leaderboard`: Get global and college leaderboards.

### Voice Search
- `POST /api/voice-search`: Convert uploaded audio to text via Sarvam Speech-to-Text and return search matches.

---

## Real-Time Socket.io Events

The Socket.io gateway is mounted at `/socket.io` and authenticated via Clerk JWT tokens.

### Client-to-Server Events
- `thread:join`: Join a chat room (`{ threadId }`).
- `thread:leave`: Leave a chat room (`{ threadId }`).
- `chat:message`: Send a message (`{ threadId, text, clientMessageId }`).
- `chat:typing`: Broadcast typing status (`{ threadId, isTyping }`).
- `chat:read`: Broadcast read receipt (`{ threadId }`).

### Server-to-Client Events
- `chat:message`: Emitted to room members when a new message is accepted.
- `chat:typing`: Emitted when a peer starts or stops typing.
- `chat:read`: Emitted when a message is read by recipient.
- `presence:changed`: Live online/offline status updates.
- `global_notification`: Session booking, acceptance, or reminder notification.
- `global_new_message`: Incoming message notification when user is outside the chat room.
- `global_forum_doubt`: Live broadcast when a new question is posted to the forum.

---

## BullMQ Background Workers

### 1. Chat Persistence Worker (`worker:chat`)
- **Queue Name:** `chat-persistence`
- **Function:** Receives messages emitted via Socket.io and writes them reliably in batches to the `ChatMessage` table in PostgreSQL.
- **Run command:**
  ```bash
  pnpm worker:chat
  ```

### 2. Weekly Warrior Audit (`scheduler:weekly-audit`)
- **Queue Name:** `weekly-audit`
- **Schedule:** Every Sunday at midnight in the configured timezone (`WEEKLY_AUDIT_TIMEZONE=Asia/Kolkata`).
- **Function:** Queries `ActivityDay` records, computes active study days across the week, and awards the Weekly Warrior badge and 50 Mind Tokens idempotently.
- **Run command:**
  ```bash
  pnpm scheduler:weekly-audit
  ```

---

## Local Development & Testing

```bash
# Install dependencies
pnpm install

# Prisma setup
pnpm prisma generate
pnpm prisma db push

# Start development server
pnpm dev

# Run Jest tests
pnpm test
```
