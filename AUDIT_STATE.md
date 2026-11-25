# Mindcraft Repository Audit State — Final Verification & Release Gate GO Certified

**Current Status:** POST-REMEDIATION FINAL GATE VERIFIED — ALL 9 REMEDIATION PROMPTS EXECUTED AND CONFIRMED  
**Predecessors:** Phase 0 through Phase 9 (ALL COMPLETED & REMEDIATED)  
**Timestamp:** 2026-11-25T19:10:00+05:30  
**Auditor Role:** Principal DevOps & Release Engineer  
**Mode:** POST-REMEDIATION FINAL VERIFICATION  
**Overall Status:** **`GO` — PRODUCTION RELEASE AUTHORIZED. ZERO CRITICAL/HIGH VULNERABILITIES; 100% AUTOMATED TEST PASS (12 BACKEND SUITES, 6 FRONTEND SUITES); DATABASE SEEDED WITH 12 COLLEGES & 10 DEPARTMENTS; LIVE RENDER HEALTH (POSTGRES + REDIS) & VERCEL APP EMPIRICALLY CONFIRMED OPERATIONAL.**

---

## 1. Final Gate Re-Verification Matrix (Empirical Evidence)

| Dimension / Check | Target / Configuration | Execution Command & Evidence | Operational Status | Production Reality & Verification Output |
| :--- | :--- | :--- | :---: | :--- |
| **Git Hygiene & Zero Secrets** | Repository working directory | `git ls-files '*.env*' '*secret*' '*serviceAccount*' 'app/google-services.json'` | **`PASS`** | Exactly matches allowed template set: `backend/.env.example`, `frontend-react/.env.example`. Zero tracked credentials. |
| **Backend Dependency Audit** | `backend/package.json` | `cd backend && pnpm audit --prod` | **`PASS`** | **0 critical, 0 high vulnerabilities** (`No known vulnerabilities found`). `pnpm-workspace.yaml` overrides active. |
| **Frontend Dependency Audit** | `frontend-react/package.json` | `cd frontend-react && pnpm audit --prod` | **`PASS`** | **0 critical, 0 high vulnerabilities** (`No known vulnerabilities found`). |
| **Prisma Schema Validation** | `backend/prisma/schema.prisma` | `cd backend && pnpm prisma validate` | **`PASS`** | Schema valid 🚀. Relational model intact and locked. |
| **Prisma Database Seed** | Neon PostgreSQL Database | `cd backend && pnpm prisma:seed` | **`PASS`** | Idempotent seed completed: 12 colleges, 10 departments, 32 skills, 17 badges inserted/upserted. |
| **Backend Test Suite & Coverage** | `backend/tests/` | `cd backend && pnpm test:coverage` | **`PASS`** | **12 test suites passed, 12 total (72/72 tests passed, 0 failures)**. Real integration tests for health, sessionRouter, tokenEconomy, clerkWebhook. |
| **Frontend Linter** | `frontend-react/` | `cd frontend-react && pnpm lint` | **`PASS`** | ESLint (`eslint .`) completed with **0 errors, 0 warnings**. |
| **Frontend Vitest Suite** | `frontend-react/src/` | `cd frontend-react && pnpm test` | **`PASS`** | Vitest (`vitest run`) passed **6 test files, 13/13 tests passed, 0 failures**. Includes React Testing Library tests for DoubtForum and FindMate. |
| **Frontend Production Build** | `frontend-react/` | `cd frontend-react && pnpm build` | **`PASS`** | Vite v8.3.8 build succeeds in ~660ms with dynamic code-splitting and PWA Workbox service workers generated. |
| **Live Backend Health Check** | `https://mind-craft-backend.onrender.com/health` | `curl -i -sS .../health` | **`PASS`** | HTTP/2 200: `{"status":"ok","uptime":779.89,"services":{"postgres":"connected","redis":"connected"}}`. Rate limiter headers active. |
| **Live Metadata Options Check** | `https://mind-craft-backend.onrender.com/api/user/metadata/options` | `curl -i -sS .../metadata/options` | **`PASS`** | HTTP/2 200: Returns non-empty arrays with 12 institutional colleges and 10 departments. Signup and matching unlocked. |
| **Live Frontend SPA** | `https://mind-craft-ochre.vercel.app` | `curl -i -sS https://mind-craft-ochre.vercel.app` | **`PASS`** | HTTP/2 200 from Vercel edge network with valid SPA html and manifest. |

---

## 2. Automated Quality Gates & Execution Verification Matrix (Phase 9.1)

| Quality Gate | Exact Command Executed | Exit Code | Operational Status | Key Findings & Execution Reality |
| :--- | :--- | :---: | :---: | :--- |
| **Backend Test Suite (Standard)** | `cd backend && pnpm test` | `0` | `PASS` | 4 test suites passed, 7 tests passed in 0.632s (`jest --runInBand`). |
| **Backend Test Coverage (CLI Forwarding)** | `cd backend && pnpm test -- --coverage` | `1` | `FAIL` | **`MEDIUM-41`**: Jest interprets `--coverage` as a test file filter pattern (`Pattern: --coverage - 0 matches`), exiting with code 1: `No tests found`. |
| **Backend Test Coverage (Direct Execution)** | `cd backend && pnpm jest --coverage --runInBand` | `0` | `PASS` (Narrow) | 4 suites, 7 tests passed. Scoped coverage (only files imported by tests): 42.24% Stmts, 28.37% Branch, 39.21% Funcs, 43.92% Lines. |
| **Backend Test Coverage (Repository-Wide)** | `cd backend && pnpm jest --coverage --collectCoverageFrom="src/**/*.js" --collectCoverageFrom="server.js" --runInBand` | `0` | `PASS` (Accurate) | **`HIGH-45`**: True repository-wide backend coverage: **6.81% Stmts**, **7.42% Branch**, **6.51% Funcs**, **7.06% Lines**. 24 source files have **0.00% coverage**. |
| **Frontend Linter** | `cd frontend-react && pnpm lint` | `0` | `PASS` | ESLint (`eslint .`) completed with zero errors and zero warnings. |
| **Frontend Test Suite** | `cd frontend-react && pnpm test` | `0` | `PASS` | Vitest (`vitest run`) passed 3 test files, 4 tests in 776ms. |
| **Frontend Test Coverage Tooling** | `cd frontend-react && pnpm vitest run --coverage` | `Interactive Block` | `FAIL` | **`HIGH-46`**: Fails with `MISSING DEPENDENCY Cannot find dependency '@vitest/coverage-v8'`. Interactive prompt halts unattended execution. |
| **Frontend Production Build** | `cd frontend-react && pnpm build` | `0` | `PASS WITH WARNINGS` | Vite v8.2.1 completed production build in 732ms. Bundle size: `index.js` **1,264.87 kB** (gzip: 373.90 kB), `index.css` **117.90 kB**. Emitted warnings: ineffective dynamic import of `chatService.js`, chunk size > 500 kB. PWA v1.3.0 generated SW with 12 precached entries (2,795.97 KiB). |

---

## 2. Complete Test Inventory & Depth Categorization (Phase 9.1)

| # | Test File Path | Test Suite / Case Description | Test Categorization | Mocking Reality & Boundary Conditions |
| :-: | :--- | :--- | :---: | :--- |
| 1 | `backend/tests/clerkWebhook.test.js` | `rejects an invalid signature` | **True Integration Test** | Hits Express router, body parser, and real Svix cryptographic signature validation; asserts HTTP 400. |
| 2 | `backend/tests/clerkWebhook.test.js` | `returns duplicate success for an already processed event` | **Isolated Unit / Component Test** | Hits Express router and valid Svix signature verification, but mocks `prisma.clerkWebhookEvent.findUnique` to return cached date. Zero real DB execution. |
| 3 | `backend/tests/sarvamAI.test.js` | `rejects oversized audio before making a provider request` | **Isolated Unit Test** | Pure in-memory unit test; verifies 10MB payload boundary check throws HTTP 413. Mocks `axios.post`. |
| 4 | `backend/tests/sarvamAI.test.js` | `retries transient provider failures` | **Isolated Unit Test** | Mocks `axios.post` once with 503 error, once with 200 response; verifies retry loop and backoff timing. |
| 5 | `backend/tests/matchingEngine.test.js` | `returns normalized complementary-skill matches from SQL rows` | **Isolated Unit Test** | Mocks `prisma.user.findUnique`, `prisma.$queryRaw`, and `matchingCache`. Pure in-memory row transformation test; zero real SQL query execution or geospatial validation. |
| 6 | `backend/tests/sessionRouter.test.js` | `completes session and updates participants` | **Isolated Unit Test** | Mocks `prisma.tutoringSession.findUnique`, `prisma.tutoringSession.update`, `prisma.user.findFirst`, `prisma.$transaction`, and `socket.emitToUser`. Zero DB atomicity tested. |
| 7 | `backend/tests/sessionRouter.test.js` | `cancels session` | **Isolated Unit Test** | Mocks `prisma.tutoringSession.findUnique` and `prisma.tutoringSession.update`. |
| 8 | `frontend-react/src/test/ClerkProtectedState.test.jsx` | `renders authenticated content inside SignedIn` | **Superficial Smoke Test** | Mocks `@clerk/clerk-react` with dummy passthrough `SignedIn: ({ children }) => <>{children}</>`. Tests zero Clerk logic and zero Mindcraft application components. |
| 9 | `frontend-react/src/hooks/usePeerMatches.test.jsx` | `does not fetch until a user id is available` | **Isolated Unit Test** | Mocks `matchService.getMatches`; verifies TanStack Query `fetchStatus === 'idle'` when `userId` is undefined. |
| 10 | `frontend-react/src/hooks/usePeerMatches.test.jsx` | `fetches matches for an authenticated user` | **Isolated Unit Test** | Mocks `matchService.getMatches`; verifies TanStack Query transitions to `isSuccess` and triggers mocked service. |
| 11 | `frontend-react/src/hooks/useDoubtForum.test.jsx` | `fetches and caches the selected forum filter` | **Isolated Unit Test** | Mocks `doubtService.getAllDoubts`; verifies TanStack Query caches query key and calls mocked service. |

### Summary Test Taxonomy Breakdown:
- **Total Tests Cataloged:** 11 (7 Backend, 4 Frontend)
- **True Integration Tests:** 1 (9.1%)
- **Isolated Unit Tests:** 9 (81.8%)
- **Superficial Smoke Tests:** 1 (9.1%)
- **Real Database Integration Tests:** 0 (0.0%)
- **Real Redis / BullMQ Tests:** 0 (0.0%)
- **Real WebSocket Tests:** 0 (0.0%)
- **End-to-End (E2E) Browser Tests:** 0 (0.0%)

---

## 3. Core Mindcraft Module Test Coverage & Missing Protection Matrix (Phase 9.1)

| Module # | Core Subsystem Name | Backend Test Coverage | Frontend Test Coverage | Untested Critical Pathways & Edge Cases | Missing Test Priority |
| :-: | :--- | :---: | :---: | :--- | :---: |
| **1** | **Authentication & Identity** | 3.04% (Webhook route only) | 0.00% (1 superficial smoke test) | `requireAuth` middleware, dev bypass tokens (`x-bypass-auth`), bearer header validation, Clerk database sync operations (`clerkUserSync.js`), OAuth login state transitions. | **P0 (Critical)** |
| **2** | **Peer Matching Engine** | 11.62% (`matchingEngine.js` only) | Hook unit test (2 tests) | Real PostgreSQL `$queryRaw` SQL query execution, geospatial / distance math, Redis feed caching/invalidation (`matchingCache.js`), Match request/accept/decline routes, voiceMatcher fallback. | **P1 (High)** |
| **3** | **Real-Time Chat & Persistence** | **0.00%** | **0.00%** | Socket.io connection auth (`socketAuth.js`), thread room authorization (`join_room`), BullMQ queue enqueueing, worker PostgreSQL persistence (`chatPersistenceWorker.js`), `PATCH /api/chat/threads/:threadId/read`, optimistic UI rendering and deduplication. | **P0 (Critical)** |
| **4** | **Tutoring Session Lifecycle** | 10.55% (`sessionRouter.js` service only; route is 0.00%) | **0.00%** | `POST /api/session/book` self-booking and double-booking validations, database state machine transitions, mutating auto-completion on `GET /api/session/:uid`, rating multi-submission guard, concurrency locking. | **P0 (Critical)** |
| **5** | **Calendar, Google Meet & .ics** | **0.00%** | **0.00%** | Google OAuth token refresh and dead token handling, Google Meet link generation and fallbacks, `.ics` iCalendar MIME formatting and timezone offset calculations. | **P2 (Medium)** |
| **6** | **Gamification & Economy** | **0.00%** | **0.00%** | Token minting transaction atomicity (`$transaction`), idempotency key uniqueness, token award endpoints caller authentication (`POST /tokens/award/session`, `POST /tokens/award/forum`), mutating token minting loop on `GET /api/badges/:uid`, daily streak rollover, freeze shield consumption, 90-day reset limit, Weekly Warrior BullMQ worker (`weeklyAuditWorker.js`). | **P0 (Critical)** |
| **7** | **Doubt Forum** | **0.00%** | Hook unit test (1 test) | `GET /api/doubt/trending` route collision, `PATCH /api/doubt/:id/upvote` vs `POST` HTTP method mismatch, upvote atomicity, question creation with Multer/Sharp image processing, answer acceptance logic, soft-delete destruction on resolve, deep link query parameter crash. | **P1 (High)** |
| **8** | **Sarvam AI Integration** | 16.27% (`sarvamAI.js` only) | **0.00%** | Real Sarvam API network calls, audio MIME type validation (`audio/webm;codecs=opus` handling), voice search end-to-end endpoint (`POST /api/voice-search`). | **P2 (Medium)** |
| **9** | **Progressive Web App (PWA)** | N/A | **0.00%** | Service worker lifecycle, Workbox precaching, offline route fallback, web manifest parsing, responsive mobile navigation, WCAG accessibility standards. | **P2 (Medium)** |

---

## 4. True Repository-Wide Backend Code Coverage Breakdown (Phase 9.1)

```
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |    6.81 |     7.42 |    6.51 |    7.06 |                   
 backend           |       0 |        0 |       0 |       0 |                   
  server.js        |       0 |        0 |       0 |       0 | 9-164             
 ...end/src/config |       0 |        0 |       0 |       0 |                   
  clerk.js         |       0 |        0 |     100 |       0 | 1-11              
  prisma.js        |       0 |        0 |       0 |       0 | 1-19              
  redis.js         |       0 |        0 |       0 |       0 | 1-45              
  socket.js        |       0 |        0 |       0 |       0 | 1-167             
 ...src/middleware |       0 |        0 |       0 |       0 |                   
  auth.js          |       0 |        0 |       0 |       0 | 1-72              
  errorHandler.js  |       0 |        0 |       0 |       0 | 9-136             
  socketAuth.js    |       0 |        0 |       0 |       0 | 1-42              
 ...end/src/queues |       0 |        0 |       0 |       0 |                   
  ...tenceQueue.js |       0 |        0 |       0 |       0 | 1-29              
  ...AuditQueue.js |       0 |        0 |       0 |       0 | 1-38              
 ...end/src/routes |    2.89 |     1.42 |    0.99 |    3.04 |                   
  auth.js          |       0 |        0 |       0 |       0 | 5-71              
  chat.js          |       0 |        0 |       0 |       0 | 1-381             
  clerkWebhook.js  |      65 |    53.33 |      50 |      65 | ...20-21,43,53-76 
  doubt.js         |       0 |        0 |       0 |       0 | 1-496             
  gamification.js  |       0 |        0 |       0 |       0 | 1-221             
  match.js         |       0 |        0 |       0 |       0 | 1-279             
  session.js       |       0 |        0 |       0 |       0 | 1-411             
  user.js          |       0 |        0 |       0 |       0 | 1-469             
  voiceSearch.js   |       0 |        0 |       0 |       0 | 12-149            
 ...d/src/services |   10.55 |    11.41 |    9.16 |   11.62 |                   
  ...Calculator.js |       0 |        0 |       0 |       0 | 1-192             
  ...ndarExport.js |       0 |        0 |       0 |       0 | 16-203            
  ...nceService.js |       0 |        0 |       0 |       0 | 1-52              
  chatService.js   |       0 |        0 |       0 |       0 | 7-35              
  clerkUserSync.js |       0 |        0 |       0 |       0 | 1-118             
  intentParser.js  |       0 |        0 |       0 |       0 | 10-180            
  matchingCache.js |       0 |        0 |       0 |       0 | 4-63              
  ...hingEngine.js |    55.1 |    45.61 |   35.71 |   63.41 | 38,49-59,72-128   
  ...eakService.js |       0 |        0 |       0 |       0 | 1-78              
  sarvamAI.js      |   15.38 |     12.5 |    9.09 |   16.27 | ...80,392,434-616 
  sessionRouter.js |   84.37 |    48.14 |     100 |      90 | 24,65,102         
  ...Calculator.js |       0 |        0 |       0 |       0 | 7-177             
  tokenEconomy.js  |       0 |        0 |       0 |       0 | 7-214             
  ...iorService.js |       0 |        0 |       0 |       0 | 1-95              
 backend/src/utils |      52 |    48.43 |      70 |      50 |                   
  constants.js     |       0 |      100 |     100 |       0 | 10-88             
  pagination.js    |       0 |        0 |       0 |       0 | 1-19              
  ...entRequest.js |   86.66 |    56.36 |    87.5 |   89.47 | 8,63-64,73        
 ...nd/src/workers |       0 |        0 |       0 |       0 |                   
  ...enceWorker.js |       0 |        0 |       0 |       0 | 1-30              
  ...uditWorker.js |       0 |        0 |       0 |       0 | 1-110             
 .../src/workflows |       0 |        0 |       0 |       0 |                   
  weeklyAudit.js   |       0 |        0 |       0 |       0 | 1-20              
-------------------|---------|----------|---------|---------|-------------------
```

---

## 5. Phase 8.2 Production Security, Dependency CVE & SRE Worker Reliability Matrix (Retained)

| Audit Dimension | Target / Module | Actual Implementation Reality | Status | Evidence & Operational Security Risk |
| :--- | :--- | :--- | :---: | :--- |
| **Security Headers (`helmet`)** | [`backend/server.js:42-44`](file:///Users/apple/Desktop/Mind-Craft/backend/server.js#L42) | `helmet({ contentSecurityPolicy: false })` | `PASS` | Disables CSP appropriately for pure JSON REST API. Injects X-DNS-Prefetch-Control, X-Frame-Options, Strict-Transport-Security (HSTS), X-Download-Options, X-Content-Type-Options, and X-XSS-Protection. |
| **CORS Origin Validation & Credentials** | [`backend/server.js:60-76`](file:///Users/apple/Desktop/Mind-Craft/backend/server.js#L60), [`socket.js:39-53`](file:///Users/apple/Desktop/Mind-Craft/backend/src/config/socket.js#L39) | Wildcard Allowed Origins Reflected with Credentials | `FAIL` | **`HIGH-41`**: `allowed.includes('*')` triggers `callback(null, true)`, dynamically reflecting incoming caller `Origin` header alongside `Access-Control-Allow-Credentials: true`. Bypasses browser wildcard safety boundaries; arbitrary third-party origins can execute credentialed requests. |
| **Rate Limiting & Abuse Prevention** | `backend/server.js`, `backend/package.json` | Zero Rate Limiting Across All Routes | `FAIL` | **`HIGH-42`**: `express-rate-limit` is not installed. Zero global or per-route throttling. Complex SQL matching feeds (`/api/match`), 10MB voice uploads (`/api/voice-search`), and LLM generation (`/api/doubt`) are completely defenseless against denial of service and quota exhaustion. |
| **JSON Body Parser Size Limits** | [`backend/server.js:89-90`](file:///Users/apple/Desktop/Mind-Craft/backend/server.js#L89) | Global 10MB Threshold on Express Body Parsers | `FAIL` | **`MEDIUM-38`**: `express.json({ limit: '10mb' })` applies to all endpoints. Parsing 10MB JSON payloads blocks Node.js event loop synchronously for hundreds of milliseconds and exposes process to heap memory exhaustion DoS. File uploads already use Multer. |
| **SQL & NoSQL Injection Vectors** | [`matchingEngine.js:186`](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/matchingEngine.js#L186) | Parameterized `Prisma.sql` Tagged Templates | `PASS` | Zero `$queryRawUnsafe` or `$executeRawUnsafe` found in codebase. Single `$queryRaw` uses `Prisma.sql` tagged template literal with explicit variable binding (`${requester.id}::uuid`, `${skillFilter}`). |
| **Mass-Assignment Protection** | `backend/src/routes/*.js` | Explicit Property Allowlisting | `PASS` | All Prisma `create` and `update` calls explicitly extract and sanitize allowed keys (`userData` in `user.js:113`, doubt fields in `doubt.js:201`, session fields in `session.js:96`). Zero direct `...req.body` spreads into Prisma. |
| **Secrets & Git Hygiene** | `.gitignore`, `git ls-files` | Active Production Credentials Tracked in Git | `FAIL` | **`CRITICAL-01`**: `frontend-react/mobile/.env` tracked in git with active production tokens.<br>**`MEDIUM-40`**: `app/google-services.json` tracked in git containing live Firebase project IDs, OAuth client IDs, and API key (`AIzaSyA...`). `.gitignore` line 27 explicitly leaves it commented out. |
| **Backend Dependency Vulnerabilities** | [`backend/package.json`](file:///Users/apple/Desktop/Mind-Craft/backend/package.json) | 30 Production CVEs (1 Critical, 16 High) | `FAIL` | **`HIGH-43`**: Critical IP spoofing in `proxy-addr` (`GHSA-jqcg-44mw-7w3h`) via `express`. High stack exhaustion in `deepmerge-ts` (`GHSA-ggr8-5vv4-36mx`) via `prisma`. Misplaced `jest` and `supertest` in production dependencies. |
| **Frontend Dependency Vulnerabilities** | [`frontend-react/package.json`](file:///Users/apple/Desktop/Mind-Craft/frontend-react/package.json) | 42 Production CVEs (22 High) | `FAIL` | **`HIGH-44`**: High authorization bypass in `@clerk/clerk-react` (`GHSA-w24r-5266-9c3c`, version 5.57.0). High host confusion in `fast-uri` (`GHSA-5jgf-p345-68v8`) via Workbox PWA precaching tools. |
| **Redis Configuration for BullMQ** | [`redis.js:13-16`](file:///Users/apple/Desktop/Mind-Craft/backend/src/config/redis.js#L13) | `maxRetriesPerRequest: null, enableReadyCheck: true` | `PASS` | `createRedisClient()` explicitly configures `maxRetriesPerRequest: null` as required by BullMQ. |
| **BullMQ Worker Lifecycle & Signals** | [`chatPersistenceWorker.js:1-30`](file:///Users/apple/Desktop/Mind-Craft/backend/src/workers/chatPersistenceWorker.js#L1), [`weeklyAuditWorker.js:95-103`](file:///Users/apple/Desktop/Mind-Craft/backend/src/workers/weeklyAuditWorker.js#L95) | Missing SIGTERM in Chat Worker | `FAIL` | **`MEDIUM-39`**: `chatPersistenceWorker.js` defines zero `SIGTERM`/`SIGINT` handlers. Standalone worker terminations abort active message persistence transactions abruptly without calling `await worker.close()`. |
| **Graceful Shutdown Orchestration** | [`backend/server.js:139-155`](file:///Users/apple/Desktop/Mind-Craft/backend/server.js#L139) | Asynchronous Drain Not Awaited; Leaked Redis | `FAIL` | **`MEDIUM-39`**: `httpServer.close()` does not await connection drainage before closing Redis and Prisma. BullMQ queues/workers are not closed. Standalone Redis client in `matchingCache.js` is leaked. Zero fallback force-kill timeout. |
| **Health Check Observability** | [`backend/server.js:93-101`](file:///Users/apple/Desktop/Mind-Craft/backend/server.js#L93) | Shallow / Dummy Static Response | `FAIL` | **`MEDIUM-39`**: `GET /health` returns static process uptime and timestamp without pinging PostgreSQL (`prisma.$queryRaw`) or Redis (`redis.ping()`). Continues reporting healthy HTTP 200 during total database/cache outages. |

---

## 2. Frontend-to-Backend API Contract Cross-Check Matrix (Retained from Phase 8.1)

| # | Frontend Service Method | Frontend HTTP URL & Method | Backend Handler Route & Line | Backend HTTP Method | Auth Requirement | Contract Status | Discrepancy & Root Cause Analysis |
| :-: | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| 1 | `userService.getProfile` | `GET /api/user/profile/:uid` | `user.js:20` (`GET /profile/:uid`) | `GET` | `requireAuth` | `MATCH` | Clean match. Returns `{ status, data: { user } }`. |
| 2 | `userService.getFullProfile` | `GET /api/user/profile/:uid/full` | `user.js:46` (`GET /profile/:uid/full`) | `GET` | `requireAuth` | `MATCH` | Clean match. Aggregates skills, sessions, streak. |
| 3 | `userService.updateProfile` | `PATCH /api/user/:uid` | `user.js:93` (`PATCH /:uid`) | `PATCH` | `requireAuth` | `MATCH` | Clean match. Updates profile attributes and skills. |
| 4 | `userService.getMetadataOptions` | `GET /api/user/metadata/options` | `user.js:189` (`GET /metadata/options`) | `GET` | None | `MATCH` (Data Blocked) | Contract matches, but returns `{ colleges: [], departments: [] }` on cold deployments due to missing DB seeds (**`HIGH-40`**). |
| 5 | `userService.searchUsers` | `GET /api/user/search?q=...` | `user.js:210` (`GET /search`) | `GET` | `requireAuth` | `MATCH` | Clean match. Case-insensitive search on name/skills. |
| 6 | `userService.followUser` | `POST /api/user/follow` | `user.js:267` (`POST /follow`) | `POST` | `requireAuth` | `MATCH` | Clean match. Body: `{ targetUid }`. |
| 7 | `userService.unfollowUser` | `DELETE /api/user/follow/:targetUid` | `user.js:315` (`DELETE /follow/:targetUid`) | `DELETE` | `requireAuth` | `MATCH` | Clean match. Removes follower relationship. |
| 8 | `userService.getFollowers` | `GET /api/user/:uid/followers` | `user.js:347` (`GET /:uid/followers`) | `GET` | `requireAuth` | `MATCH` | Clean match. Returns followers list. |
| 9 | `userService.getFollowing` | `GET /api/user/:uid/following` | `user.js:386` (`GET /:uid/following`) | `GET` | `requireAuth` | `MATCH` | Clean match. Returns following list. |
| 10 | `voiceService.searchByVoice` | `POST /api/voice-search` | `voiceSearch.js:75` (`POST /`) | `POST` | `requireAuth` | `MATCH` (Codec Bug) | Contract matches, but Chrome/Firefox uploads (`audio/webm;codecs=opus`) rejected with HTTP 415 (**`HIGH-33`**). |
| 11 | `matchService.getMatches` | `GET /api/match` | `match.js:22` (`GET /`) | `GET` | `requireAuth` | `MATCH` | Clean match. Returns scored reciprocal peer matches. |
| 12 | `matchService.sendRequest` | `POST /api/match/request` | `match.js:154` (`POST /request`) | `POST` | `requireAuth` | `MATCH` | Clean match. Creates `MatchRequest` record. |
| 13 | `matchService.getRequests` | `GET /api/match/requests/:uid` | `match.js:259` (`GET /requests/:uid`) | `GET` | `requireAuth` | `ORPHANED` | Route exists, but **zero frontend components import or consume this function** (**`LOW-15`**). |
| 14 | `matchService.acceptRequest` | `POST /api/match/accept` | `match.js:296` (`POST /accept`) | `POST` | `requireAuth` | `ORPHANED` | Route exists, but **UI bypasses match acceptance** by directly creating threads (**`MEDIUM-08`**, **`LOW-15`**). |
| 15 | `matchService.declineRequest` | `POST /api/match/decline` | `match.js:345` (`POST /decline`) | `POST` | `requireAuth` | `ORPHANED` | Route exists, but **zero frontend components call it** (**`LOW-15`**). |
| 16 | `gamificationService.getStreak` | `GET /api/streak/:uid` | `gamification.js:31` (`GET /streak/:uid`) | `GET` | `requireAuth` | `MATCH` | Clean match. Returns current and longest streaks. |
| 17 | `gamificationService.checkIn` | `POST /api/streak/check-in` | `gamification.js:46` (`POST /streak/check-in`) | `POST` | `requireAuth` | `MATCH` | Clean match. Body: `{ uid }`. |
| 18 | `gamificationService.awardSessionTokens` | `POST /api/tokens/award/session` | `gamification.js:78` (`POST /tokens/award/session`) | `POST` | `requireAuth` | `ORPHANED / EXPLOIT` | Route exists but unguarded (**`CRITICAL-02`**). Frontend service wraps it, but zero UI components call it directly. |
| 19 | `gamificationService.awardForumTokens` | `POST /api/tokens/award/forum` | `gamification.js:114` (`POST /tokens/award/forum`) | `POST` | `requireAuth` | `ORPHANED / EXPLOIT` | Route exists but unverified (**`HIGH-05`**). Wrapped in service but unconsumed in UI. |
| 20 | `gamificationService.getBadges` | `GET /api/badges/:uid` | `gamification.js:144` (`GET /badges/:uid`) | `GET` | `requireAuth` | `MATCH / MUTATING` | Contract matches, but executes mutating reward loop minting tokens on read (**`CRITICAL-05`**). |
| 21 | `gamificationService.getLeaderboard` | `GET /api/leaderboard` | `gamification.js:168` (`GET /leaderboard`) | `GET` | `requireAuth` | `MATCH` | Clean match. Returns top 100 users by tokens. |
| 22 | `gamificationService.getTokens` | `GET /api/tokens/:uid` | `gamification.js:192` (`GET /tokens/:uid`) | `GET` | `requireAuth` | `MATCH` | Clean match. Returns token balance and transaction history. |
| 23 | `doubtService.getDoubts` | `GET /api/doubt` | `doubt.js:30` (`GET /`) | `GET` | `requireAuth` | `MATCH` | Clean match. Paginated question feed with tag filtering. |
| 24 | `doubtService.getDoubtById` | `GET /api/doubt/:id` | `doubt.js:122` (`GET /:id`) | `GET` | `requireAuth` | `MATCH` | Clean match. Returns doubt details with answers and votes. |
| 25 | **`doubtService.getTrendingDoubts`** | **`GET /api/doubt/trending`** | **`doubt.js:122` (`GET /:id`)** | **`GET`** | **`requireAuth`** | **`CRASH (500)`** | **`HIGH-29`**: No `/trending` route exists. Express matches `/:id`, passing string `"trending"` to PostgreSQL UUID column, throwing HTTP 500 syntax crash. |
| 26 | `doubtService.createDoubt` | `POST /api/doubt` | `doubt.js:174` (`POST /`) | `POST` | `requireAuth` | `MATCH` | Clean match. Multipart form upload with images. |
| 27 | `doubtService.addAnswer` | `POST /api/doubt/:id/answers` | `doubt.js:246` (`POST /:id/answers`) | `POST` | `requireAuth` | `MATCH` | Clean match. Adds answer to doubt question. |
| 28 | **`doubtService.toggleUpvote`** | **`PATCH /api/doubt/:id/upvote`** | **`doubt.js:312` (`POST /:id/upvote`)** | **`POST`** | **`requireAuth`** | **`MISMATCH (404)`** | **`HIGH-30`**: Frontend calls `PATCH`, backend defines `POST`. Express returns HTTP 404 Cannot PATCH, breaking doubt voting 100% of the time in the UI. |
| 29 | `doubtService.resolveDoubt` | `PATCH /api/doubt/:id/resolve` | `doubt.js:343` (`PATCH /:id/resolve`) | `PATCH` | `requireAuth` | `MATCH` | Clean match, though destructive soft-delete behavior noted in **`MEDIUM-27`**. |
| 30 | `sessionService.bookSession` | `POST /api/session/book` | `session.js:26` (`POST /book`) | `POST` | `requireAuth` | `MATCH` | Clean match. Books tutoring session. |
| 31 | `sessionService.getSessions` | `GET /api/session/:uid` | `session.js:84` (`GET /:uid`) | `GET` | `requireAuth` | `MATCH / MUTATING` | Contract matches, but executes mutating auto-complete and token awards on read (**`MEDIUM-19`**). |
| 32 | `sessionService.acceptSession` | `POST /api/session/:id/accept` | `session.js:143` (`POST /:id/accept`) | `POST` | `requireAuth` | `MATCH` | Clean match. Transitions session to `UPCOMING`. |
| 33 | `sessionService.rejectSession` | `POST /api/session/:id/reject` | `session.js:192` (`POST /:id/reject`) | `POST` | `requireAuth` | `MATCH` | Clean match. Rejects session booking. |
| 34 | `sessionService.cancelSession` | `POST /api/session/:id/cancel` | `session.js:226` (`POST /:id/cancel`) | `POST` | `requireAuth` | `MATCH` | Clean match. Cancels session booking. |
| 35 | `sessionService.rateSession` | `POST /api/session/:id/rate` | `session.js:263` (`POST /:id/rate`) | `POST` | `requireAuth` | `MATCH` | Clean match, but allows unbounded rating multi-submissions (**`HIGH-19`**). |
| 36 | `chatService.getThreads` | `GET /api/chat/threads/:uid` | `chat.js:25` (`GET /threads/:uid`) | `GET` | `requireAuth` | `MATCH` | Clean match. Lists user's active chat threads. |
| 37 | `chatService.getHistory` | `GET /api/chat/history/:threadId` | `chat.js:84` (`GET /history/:threadId`) | `GET` | `requireAuth` | `MATCH` | Clean match. Paginated message history. |
| 38 | `chatService.createThread` | `POST /api/chat/thread` | `chat.js:154` (`POST /thread`) | `POST` | `requireAuth` | `MATCH` | Clean match. Direct thread creation bypassing match requests. |
| 39 | `chatService.markThreadRead` | `PATCH /api/chat/threads/:threadId/read` | `chat.js:195` (`PATCH /threads/:threadId/read`) | `PATCH` | `requireAuth` | `MATCH` | Clean match. Updates unread counter. |

---

## 3. Prisma Schema Relational Integrity, Seeding & Migration Matrix (Retained from Phase 8.1)

| Model Name | Foreign Keys & Target Model | Relation Cascade Policy (`onDelete`) | Unique Constraints & Composite Indexes | Seeding Readiness on Cold Deploy | Relational Integrity Verdict & Operational Risks |
| :--- | :--- | :---: | :--- | :---: | :--- |
| **`User`** | `collegeId -> College(id)`<br>`departmentId -> Department(id)` | `SetNull` (default)<br>`SetNull` (default) | `@unique(clerkUserId)`<br>`@unique(email)`<br>`@@index([collegeId, departmentId])` | Handled via Clerk Webhook Sync | `PASS` for soft-delete (`deletedAt`). However, administrative hard delete (`prisma.user.delete`) is blocked by 7 child relations (**`MEDIUM-37`**). |
| **`College`** | *None* | N/A | `@unique(domain)`<br>`@@index([name])` | **ZERO SEED SCRIPTS (`HIGH-40`)** | `FAIL`: Fresh databases start with 0 rows. Signup and profile edit college dropdowns render completely empty. |
| **`Department`** | *None* | N/A | `@unique(code)`<br>`@@index([name])` | **ZERO SEED SCRIPTS (`HIGH-40`)** | `FAIL`: Fresh databases start with 0 rows. Signup and profile edit department dropdowns render completely empty. |
| **`Skill`** | *None* | N/A | `@unique(name)`<br>`@@index([category])` | **ZERO SEED SCRIPTS (`HIGH-40`)** | `FAIL`: Zero skills seeded. Users cannot select teach/learn skills, crippling matching engine on clean deployments. |
| **`UserSkill`** | `userId -> User(id)`<br>`skillId -> Skill(id)` | `Cascade`<br>`Cascade` | `@@id([userId, skillId])`<br>`@@index([skillId, type])` | Clean | `PASS`: Automatic cascading cleanup on user or skill removal. |
| **`MatchRequest`** | `senderId -> User(id)`<br>`receiverId -> User(id)` | `Restrict`<br>`Restrict` | `@@unique([senderId, receiverId])`<br>`@@index([receiverId, status])` | Dynamic | **`MEDIUM-37`**: `Restrict` cascade blocks user account purging. UI completely bypasses this table (**`MEDIUM-08`**). |
| **`ChatThread`** | `matchRequestId -> MatchRequest(id)`<br>`lastSenderId -> User(id)` | `SetNull`<br>`SetNull` | `@@index([updatedAt])` | Dynamic | `PASS`: Gracefully sets foreign keys to NULL if referenced match request or sender is purged. |
| **`ChatParticipant`** | `userId -> User(id)`<br>`threadId -> ChatThread(id)` | `Cascade`<br>`Cascade` | `@@id([userId, threadId])` | Dynamic | `PASS`: Cascading deletion cleanly cleans up thread memberships. |
| **`ChatMessage`** | `threadId -> ChatThread(id)`<br>`senderId -> User(id)` | `Restrict`<br>`Restrict` | `@@index([threadId, createdAt])` | Dynamic | **`MEDIUM-37`**: `Restrict` cascade prevents hard-deletion of user accounts without first wiping chat messages. |
| **`TutoringSession`** | `tutorId -> User(id)`<br>`learnerId -> User(id)` | `Restrict`<br>`Restrict` | `@@index([tutorId, status])`<br>`@@index([learnerId, status])` | Dynamic | **`MEDIUM-37`**: `Restrict` cascade prevents user hard-deletion. Zero rating model linked (**`HIGH-19`**). |
| **`TokenTransaction`** | `userId -> User(id)` | `Restrict` | `@unique(idempotencyKey)`<br>`@@index([userId, createdAt])` | Dynamic | **`MEDIUM-37`**: `Restrict` cascade preserves financial auditability, but requires explicit archival before account deletion. |
| **`ActivityDay`** | `userId -> User(id)` | `Cascade` | `@@unique([userId, date])` | Dynamic | `PASS`: Clean cascading cleanup. |
| **`Badge`** | *None* | N/A | `@unique(slug)` | **ZERO SEED SCRIPTS (`MEDIUM-25`, `HIGH-40`)** | `FAIL`: Global badge master table starts empty. Dynamically created rows lead to global level overwrite bugs (**`MEDIUM-24`**). |
| **`UserBadge`** | `userId -> User(id)`<br>`badgeId -> Badge(id)` | `Cascade`<br>`Cascade` | `@@unique([userId, badgeId, auditWeek])` | Dynamic | `PASS`: Cascading cleanup. Idempotent composite key protects against duplicate weekly awards. |
| **`WeeklyAuditRun`** | *None* | N/A | `@unique(weekKey)` | Dynamic | `PASS`: Clean execution tracking. |
| **`Doubt`** | `authorId -> User(id)` | `Restrict` | `@@index([tag, status])`<br>`@@index([createdAt])` | Dynamic | **`MEDIUM-37`**: `Restrict` cascade blocks user account deletion. |
| **`DoubtImage`** | `doubtId -> Doubt(id)` | `Restrict` | `@@index([doubtId])` | Dynamic | **`MEDIUM-37`**: `Restrict` prevents parent doubt deletion without prior image purging. |
| **`DoubtAnswer`** | `doubtId -> Doubt(id)`<br>`authorId -> User(id)` | `Restrict`<br>`Restrict` | `@@index([doubtId, isAccepted])` | Dynamic | **`MEDIUM-37`**: `Restrict` blocks user hard deletion. `isAccepted` is un-updated phantom column (**`MEDIUM-27`**). |
| **`DoubtVote`** | `doubtId -> Doubt(id)`<br>`answerId -> DoubtAnswer(id)`<br>`userId -> User(id)` | `Cascade`<br>`Cascade`<br>`Cascade` | `@@unique([userId, doubtId])`<br>`@@unique([userId, answerId])` | Dynamic | `PASS`: Clean cascading deletion on vote removals. |

---

## 4. Phase 7.1 Page-by-Page Frontend Audit Matrix (Retained)

| Page / Component | Route(s) | Data Layer Architecture | Loading State UX | Empty State UX | Cold-Start & Error Recovery UX | Audit Status | Key Defects & Architectural Violations |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **`Home.jsx`** | `/`, `/dashboard` | TanStack Query (`useProfile`, `useStreak`, `useBadges`, `usePeerMatches`, `useFollowing`, `useTrendingDoubts`) | `NONE` (Zero skeleton or spinner; destructures only `{ data }`) | Matches: Card with "No matches yet!" and "Edit Profile" button; Topics: "No trending topics yet!" | `FAIL` (Zero error recovery/retry; silently displays 0 streaks, 0 badges, empty cards during Render 50s cold-start) | `FAIL` | **`HIGH-35`**: "Edit Profile" executes `navigate('/profile')` which does not exist in `App.jsx`, dumping users on a blank screen.<br>**`MEDIUM-32`**: Cold-start error blindness. |
| **`FindMate.jsx`** | `/find` | TanStack Query (`usePeerMatches`, `useFollowing`, `useMetadataOptions`, `useSearchUsers`, `useFollowUser`) | Defective (Local `loading` flag only tracks audio recording; TanStack Query `isLoading` ignored) | Premature empty card ("No matches found for this topic") flashed before query resolves | `FAIL` (Query errors completely untracked; zero retry button) | `FAIL` | **`HIGH-34`**: Reciprocal voice matches clobbered by search state.<br>**`MEDIUM-32`**: Immediate false empty state while waiting for network. |
| **`Chat.jsx`** | `/chat`, `/chat/:matchId` | Legacy raw `useEffect` + `chatService.getHistory`, `sessionService.getSessions`, `NotificationContext` sockets | Thread list: `NONE` (Flashes "No chats yet!" during cold start); Chat room: `PARTIAL` | Thread list: "No chats yet!" with "Find a Mate" CTA; Chat room: Empty feed | `FAIL` (Errors caught with `console.error`; zero error banner or retry prompt) | `FAIL` | **`HIGH-37`**: Bypasses TanStack Query.<br>**`HIGH-15`**: Decoupled BullMQ worker risks chat history loss.<br>**`HIGH-11`**: Identity mismatch. |
| **`DoubtForum.jsx`** | `/forum` | TanStack Query (`useDoubts`, `useCreateDoubt`, `useAddAnswer`, `useResolveDoubt`, `useToggleDoubtUpvote`) | `PASS` (Full-page spinning loader) | `PASS` (Distinct empty states for "All Doubts" and "My Doubts") | `PASS` (Displays error banner with functional "Retry" button) | `FAIL` | **`HIGH-36`**: Uncaught `TypeError` when opening via `?doubtId=...` crashes entire forum.<br>**`HIGH-30`**: Upvote PATCH vs POST mismatch.<br>**`MEDIUM-26`**: Field contract drift.<br>**`MEDIUM-31`**: Zero optimistic rollback. |
| **`SessionsDetail.jsx`** | `/sessions` | Legacy raw `useEffect` + `sessionService.getSessions(currentUser.uid, status)` | `PASS` (Centered loading spinner) | `PASS` ("No sessions found" with filter contextualization) | `FAIL` (Network error swallowed in `.catch()`, rendering "No sessions found" instead of connection failure) | `FAIL` | **`HIGH-37`**: Bypasses TanStack Query.<br>**`MEDIUM-32`**: Silent error swallowing. |
| **`Profile.jsx`** | `/profile/:uid` | Legacy raw `useEffect` + `userService.getFullProfile`, `userService.getFollowing`, `gamificationService` | `PASS` (Full-screen spinner) | `PASS` (0 teaches / 0 learns handled with "None added yet") | `FAIL` (On 50s cold-start timeout or 500, displays "Profile not found" with "Go Home" and "Log Out"; zero retry) | `FAIL` | **`HIGH-37`**: Bypasses TanStack Query.<br>**`HIGH-35`**: Unreachable via `/profile` link.<br>**`MEDIUM-32`**: Cold start renders "Profile not found". |
| **`Leaderboard.jsx`** | `/leaderboard` | Legacy raw `useEffect` + `gamificationService.getLeaderboard()` | `PASS` (Centered purple spinner) | `PASS` ("No one is on the leaderboard yet") | `FAIL` (Swallows error into `console.error`, displaying "No one on leaderboard" on connection failure) | `FAIL` | **`HIGH-37`**: Bypasses TanStack Query.<br>**`MEDIUM-22`**: Rank -1 balance erasure.<br>**`MEDIUM-32`**: Silent error swallowing. |
| **`StreakDetail.jsx`** | `/streak` | Legacy raw `useEffect` + `gamificationService.checkIn()` and `gamificationService.getStreak()` | `PASS` (Loader2 spinner) | `PASS` (Builds empty contribution grid) | `FAIL` (Swallows error, resets state to 0 streak / 0 active days with zero error message) | `FAIL` | **`HIGH-37`**: Bypasses TanStack Query.<br>**`HIGH-22`**: Phantom freeze shields.<br>**`LOW-10`**: 105-cell vs 35-day grid mismatch.<br>**`MEDIUM-32`**: Silent error swallowing. |
| **`Notifications.jsx`** | `/notifications` | Legacy raw `useEffect` executing sequential REST queries (`getSessions`, `getThreads`) | `PASS` (Centered loading spinner) | `PASS` ("No notifications yet. You're all caught up!") | `FAIL` (Swallows all errors with `catch { // Ignore background fetch error }`, showing empty state on failure) | `FAIL` | **`HIGH-37`**: Bypasses TanStack Query.<br>**`HIGH-20`**: Broken Google Calendar OAuth hang.<br>**`LOW-08`**: Notification miscategorization. |
| **`BadgeProgress.jsx`** | `/badges` | Legacy raw `useEffect` + `gamificationService.getBadges()` | `PASS` (Loader2 spinner) | `PASS` (Renders 0 badges cleanly) | `FAIL` (Swallows error, sets empty defaults, zero retry UI) | `FAIL` | **`HIGH-37`**: Bypasses TanStack Query.<br>**`MEDIUM-32`**: Silent error swallowing. |
| **`Wallet.jsx`** | `/wallet` | Legacy raw `useEffect` + `gamificationService.getTokens()` | `FAIL` (Zero loading indicator; balance initialized to `useState(450)`) | Static mock mission list | `FAIL` (Swallows error; keeps balance stuck at 450) | `FAIL` | **`HIGH-37`**: Bypasses TanStack Query.<br>**`LOW-09`**: Hardcoded 450 default balance displayed to new users. |
| **`RatingDetail.jsx`** | `/ratings` | Legacy raw `useEffect` + `userService.getFullProfile()` | `PASS` (Centered spinner) | `PASS` ("No reviews yet") | `FAIL` (Swallows error, leaves reviews empty, zero retry UI) | `FAIL` | **`HIGH-37`**: Bypasses TanStack Query.<br>**`MEDIUM-32`**: Silent error swallowing. |
| **`MatesDetail.jsx`** | `/mates` | Legacy raw `useEffect` + `matchService.getMatches()` | `PASS` (Centered spinner) | `PASS` ("No mates yet" with "Find Mates" CTA) | `FAIL` (Swallows error, leaves mates empty, zero retry UI) | `FAIL` | **`HIGH-37`**: Bypasses TanStack Query.<br>**`MEDIUM-32`**: Silent error swallowing. |

---

## 5. Phase 8 Command Execution Evidence

1. **Git Secret & Tracked Credential Inspection:**
   ```bash
   git ls-files '*.env*' '*secret*' '*serviceAccount*'
   ```
   - **Result:**
     ```
     backend/.env.example
     frontend-react/.env.example
     frontend-react/mobile/.env
     ```
   - **Confirmation:** Confirmed `frontend-react/mobile/.env` is tracked in git with active production secrets (**`CRITICAL-01`**).
2. **Git Tracked JSON & Keystore File Search:**
   ```bash
   git ls-files '*.json' '*.key' '*.pem' '*.cert' | grep -v 'package.json\|tsconfig.json'
   ```
   - **Result:** Confirmed `app/google-services.json` is actively tracked in git with valid Google Cloud project credentials, OAuth client IDs, and API key (`AIzaSyA...`) (**`MEDIUM-40`**).
3. **Security Headers, CORS, Rate Limit & Shutdown Grep:**
   ```bash
   grep -rnE "queryRaw|executeRaw|helmet|rateLimit|cors|SIGTERM|SIGINT" backend/server.js backend/src/
   ```
   - **Result:** Confirmed `helmet` active with CSP false. Confirmed dynamic origin function in `server.js` and `socket.js` returning `callback(null, true)` with credentials (**`HIGH-41`**). Confirmed zero occurrences of `rateLimit` (**`HIGH-42`**). Confirmed single parameterized `Prisma.sql` query in `matchingEngine.js`.
4. **Backend Production Dependency Audit:**
   ```bash
   cd backend && pnpm audit --prod || true
   ```
   - **Result:** Found 30 production vulnerabilities (1 Critical, 16 High, 13 Moderate). Flagged critical IP spoofing in `proxy-addr` (`GHSA-jqcg-44mw-7w3h`) and high stack exhaustion in `deepmerge-ts` (`GHSA-ggr8-5vv4-36mx`) (**`HIGH-43`**).
5. **Frontend Production Dependency Audit:**
   ```bash
   cd frontend-react && pnpm audit --prod || true
   ```
   - **Result:** Found 42 production vulnerabilities (22 High, 16 Moderate, 4 Low). Flagged high authorization bypass in `@clerk/clerk-react` (`GHSA-w24r-5266-9c3c`) and high host confusion in `fast-uri` (`GHSA-5jgf-p345-68v8`) (**`HIGH-44`**).
