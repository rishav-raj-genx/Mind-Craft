# Mindcraft

Mindcraft is a full-stack peer-learning and tutoring platform designed for college students. Students can find complementary study partners, schedule peer-tutoring sessions, chat in real time, solve academic doubts with AI-assisted bilingual study hints, and earn Mind Tokens and badges through learning streaks.

---

## Production Architecture

```
                                      +------------------------+
                                      |   Clerk Auth Service   |
                                      +-----------+------------+
                                                  |
                                                  | Webhook (svix)
                                                  v
+------------------------+             +------------------------+             +-----------------------+
|  Frontend Application  |   HTTPS     |   Backend API Server   |   Prisma    |   PostgreSQL Database |
|  - React 19 + Vite     | ----------> |   - Node 20+ / Express | ----------> |   - Users & Profiles  |
|  - TanStack Query v5   |             |   - Clerk Middleware   |             |   - Peer Matches      |
|  - Socket.io Client    | <---------+ |   - Socket.io Server   |             |   - Chat & Threads    |
|  - Tailwind CSS + PWA  |  WebSocket  +-----------+------------+             |   - Doubts & Answers  |
+------------------------+                         |                          |   - Tokens & Streaks  |
                                                   | Redis Adapter &          +-----------------------+
                                                   | BullMQ Queues
                                                   v
                                        +------------------------+
                                        |   Redis In-Memory Bus  |
                                        |   - Socket.io Adapter  |
                                        |   - Match Query Cache  |
                                        +-----------+------------+
                                                    |
                                                    | Job Dispatch
                                                    v
                                        +------------------------+
                                        |   BullMQ Workers       |
                                        |   - Chat Persistence   |
                                        |   - Weekly Warrior     |
                                        +------------------------+
```

---

## Production Tech Stack

| Domain | Technology | Purpose |
| --- | --- | --- |
| **Frontend Web** | React 19, Vite, Tailwind CSS | High-performance SPA with progressive web app (PWA) support |
| **Data Fetching** | TanStack Query v5 | Cache management, optimistic UI updates, background synchronization |
| **Authentication** | Clerk (`@clerk/clerk-react`, `@clerk/express`) | JWT verification, session management, webhooks |
| **Backend API** | Node.js 20+, Express | RESTful API endpoints and WebSocket lifecycle coordination |
| **ORM & Database** | Prisma ORM, PostgreSQL | Strongly-typed relational schema, complex joins, atomic transactions |
| **Real-Time WebSockets**| Socket.io, `@socket.io/redis-adapter` | Scalable multi-room chat, typing indicators, live presence, instant push |
| **Background Queues** | BullMQ, Redis 7+ | Asynchronous message persistence, weekly streak audits, badge awarding |
| **AI Integration** | Sarvam AI (`SARVAM_STT_URL`, `SARVAM_CHAT_URL`) | Speech-to-text voice search and bilingual study hints |

---

## Feature Breakdown

1. **Authentication & Identity Management:**
   - Clerk authentication on the frontend with dedicated sign-in/sign-up flows.
   - Non-blocking setup screen if publishable keys are unset.
   - Backend `@clerk/express` middleware protecting all private endpoints.
   - Secure svix-verified Clerk webhook syncing user profiles to PostgreSQL.

2. **SQL Peer Matching Engine:**
   - Weighted multi-factor compatibility algorithm calculated via indexed PostgreSQL queries over `UserSkill`.
   - Matches learners with tutors across opposite skill requirements (`LEARNS` vs `TEACHES`).
   - Scoring criteria: complementary skill overlap, reciprocal interest, college affiliation, teaching reputation, and ratings.
   - Redis-cached top recommendations with graceful fallback to PostgreSQL.

3. **Real-Time Chat & Direct Messaging:**
   - Instant messaging over Socket.io with room subscriptions (`thread:join`, `thread:leave`).
   - Read receipts, typing indicators, presence changes, and message editing/deletion.
   - BullMQ asynchronous worker (`worker:chat`) guaranteeing message delivery and batch persistence into PostgreSQL.

4. **Peer Tutoring Sessions & Scheduling:**
   - Book, accept, reject, complete, and rate peer tutoring sessions.
   - Real-time Socket.io alerts delivered directly to students when sessions are booked or updated.
   - Calendar export integration with Google Meet link generator.

5. **Gamification & Token Economy:**
   - Mind Tokens credited for accepted tutoring sessions and community contributions.
   - Automated Daily Streak tracking with freeze shields.
   - Automated BullMQ scheduler and worker (`scheduler:weekly-audit`) auditing weekly study activity and awarding Weekly Warrior badges idempotently.

6. **Doubt Forum & Sarvam AI:**
   - Community Q&A forum with upvoting, verified solutions, and tag filtering.
   - Automatic bilingual study hints powered by Sarvam AI (`sarvam-30b`) with exponential backoff retry and graceful fallback.
   - Voice-powered search using Sarvam Speech-to-Text (`sarvam-audio`).

---

## Repository Structure

```text
├── backend/                     # Express REST API, Prisma schema, BullMQ workers, tests
│   ├── prisma/                  # schema.prisma, migrations
│   ├── src/
│   │   ├── config/              # Prisma, Clerk, Redis, Sarvam clients
│   │   ├── middleware/          # Clerk auth, Socket.io auth
│   │   ├── routes/              # Auth, User, Match, Chat, Session, Doubt, Gamification
│   │   ├── services/            # Matching, Chat, SessionRouter, Tokens, Badges, Sarvam
│   │   └── workers/             # Chat persistence worker, Weekly Warrior audit worker
│   └── tests/                   # Jest/Supertest suite
├── frontend-react/              # React 19 Vite application, TanStack Query, tests
│   ├── src/
│   │   ├── components/          # Reusable UI components & ErrorBoundary
│   │   ├── context/             # AuthContext, NotificationContext, AppContext
│   │   ├── hooks/               # TanStack query hooks (usePeerMatches, useDoubtForum)
│   │   ├── pages/               # FindMate, Chat, Forum, Sessions, Profile, Leaderboard
│   │   └── services/            # Axios API clients
│   └── src/test/                # Vitest test suite
├── LOCAL_DEVELOPMENT.md         # Step-by-step local setup guide
├── DEPLOYMENT.md                # Production deployment guide (Vercel, Railway, Neon, Upstash)
└── README.md                    # Root project documentation
```

---

## Quick Start

### 1. Run Backend
```bash
cd backend
pnpm install
pnpm prisma generate
pnpm prisma db push
pnpm dev
```

### 2. Run Background Workers
```bash
# In separate terminal sessions
cd backend && pnpm worker:chat
cd backend && pnpm scheduler:weekly-audit
```

### 3. Run Frontend
```bash
cd frontend-react
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Testing & Quality Assurance

```bash
# Run backend Jest test suite
cd backend && pnpm test

# Run frontend Vitest test suite
cd ../frontend-react && pnpm test

# Run frontend ESLint check (0 errors required)
cd ../frontend-react && pnpm lint

# Verify frontend production bundle
cd ../frontend-react && pnpm build
```

---

## Documentation Links

- [Local Development Guide](./LOCAL_DEVELOPMENT.md)
- [Production Deployment Guide](./DEPLOYMENT.md)
- [Backend Architecture & API Reference](./backend/README.md)

---

## License

This project is licensed under the MIT License.
