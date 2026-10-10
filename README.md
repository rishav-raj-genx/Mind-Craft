# Mindcraft

Mindcraft is a peer-learning platform for college students. Users can find
study partners, ask doubts, chat, earn Mind Tokens, and maintain learning
streaks.

## Current architecture

- **Frontend:** React, Vite, Clerk, TanStack Query, Socket.io client
- **Backend:** Node.js 20+, Express, Prisma, Socket.io
- **Persistence:** PostgreSQL
- **Queues/cache:** Redis and BullMQ
- **AI:** Sarvam speech-to-text and study hints
- **Authentication:** Clerk

The PostgreSQL/Prisma, Clerk, Redis/BullMQ, Socket.io, Sarvam resilience, and
TanStack Query migrations are implemented incrementally. Some route and
notification surfaces still use Neo4j, Passport, Firebase, and native WebSocket
compatibility code; those dependencies must not be removed until those surfaces
are migrated.

## Repository layout

```text
backend/          Express API, Prisma schema, workers, and backend tests
frontend-react/   Vite React web application and frontend tests
LOCAL_DEVELOPMENT.md
```

## Run locally

See [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) for:

- Required and optional environment variables
- PostgreSQL and Redis setup
- Prisma Client generation and schema setup
- Backend, worker, and frontend commands
- Jest/Supertest and Vitest test commands

Environment templates:

- [backend/.env.example](./backend/.env.example)
- [frontend-react/.env.example](./frontend-react/.env.example)

## Validation

```bash
cd backend && pnpm test
cd ../frontend-react && pnpm test
```

The frontend production build can be checked with `pnpm build` from
`frontend-react`; Prisma can be checked with `pnpm prisma validate` from
`backend`.

## License

This project is licensed under the MIT License.
