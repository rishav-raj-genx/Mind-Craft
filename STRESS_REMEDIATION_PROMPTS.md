# Mindcraft Stress Remediation Prompts (Sequential Execution Guide)

**Author:** Principal Software Architect & QA Lead  
**Format:** 7 Context-Window-Safe, Highly Focused, Sequential Implementation Prompts  
**Instructions for User:** Paste each prompt sequentially into your coding agent. Do not move to the next prompt until the verification commands pass with zero errors.

---

## Prompt Sequence Overview

1. **Prompt 1 (UI Polish):** Consistency Graph Purple-to-Lime Palette & Intro Modals Redesign
2. **Prompt 2 (Performance):** Speed, Edge Caching, Query Prefetching & Search Debouncing
3. **Prompt 3 (Discovery):** Peer Matching Engine, Case-Insensitive Skill Discovery & Cache Invalidation
4. **Prompt 4 (Doubt Forum):** Trending Tag Routing, Forum Filtering, Async Sarvam AI & Rate Limiting
5. **Prompt 5 (Real-Time Chat):** Render In-Process Persistence Fallback, Socket Reconnection & Message Reconciliation
6. **Prompt 6 (Notifications):** End-to-End Notification Overhaul, Offline Parity & Route Alignment
7. **Prompt 7 (Sessions & Gamification):** Tutoring Sessions, Google Calendar/Jitsi, Study Hours/Rating Calculation & Badges

---

## PROMPT 1: Consistency Graph Purple-to-Lime Palette & Intro Modals Redesign

```markdown
ROLE: Senior Frontend Engineer & UI/UX Specialist.
TASK: Implement the signature Mindcraft purple-to-lime color progression in ConsistencyGraph, and overhaul the 4 Intro Modals (Onboarding) for copy, badge styling, and smooth spring animations.

FINDINGS RESOLVED:
- Audit #1 (P2): Consistency Graph uses GitHub green palette with inverted dark/light semantics.
- Audit #2a (P2): Intro Modal 2 mentions Sarvam AI vernacular voice search.
- Audit #2b (P2): Intro Modals use artificial AI-style "✦ ..." sparkle badges.
- Audit #2c (P2): Intro Modals have jarring vertical transitions, desynced glow, and missing mode="wait".

FILES TO MODIFY:
1. `frontend-react/src/components/ConsistencyGraph.jsx`
2. `frontend-react/src/constants/introSlides.js`
3. `frontend-react/src/components/Onboarding.jsx`
4. `frontend-react/src/pages/Profile.jsx` (verify color class alignment)
5. `frontend-react/src/pages/StreakDetail.jsx` (verify color class alignment)
6. `frontend-react/src/test/IntroModals.test.jsx` (update and expand test suite)

SPECIFIC IMPLEMENTATION REQUIREMENTS:

1. Consistency Graph Purple-to-Lime Palette:
   - In `frontend-react/src/components/ConsistencyGraph.jsx`, update `getCellColorClass(level)` and the graph legend (lines 21-38, 303-314).
   - Eliminate all GitHub greens (`#d9f99d`, `#a3e635`, `#65a30d`, `#4d7c0f`, `#24421b`, `#3b6d26`, `#74be34`).
   - Implement the exact uniform Mindcraft brand progression for both Light Mode and Dark Mode:
     * Level -1 (Future day): `bg-transparent border border-dashed border-gray-200 dark:border-white/5 opacity-0 pointer-events-none`
     * Level 0 (Empty baseline): `bg-slate-100 dark:bg-[#1E1E2F] border border-slate-200/80 dark:border-[#2D2D44] hover:border-slate-400 dark:hover:border-slate-500`
     * Level 1 (Low, 1 activity): `bg-[#4C1D95] dark:bg-[#2E1065] border border-[#3B0764] hover:scale-110` (Dark Purple)
     * Level 2 (Medium, 2 activities): `bg-[#7C3AED] dark:bg-[#6D28D9] border border-[#6D28D9] dark:border-[#7C3AED] hover:scale-110` (Brand Violet)
     * Level 3 (High, 3-4 activities): `bg-[#BC84EE] dark:bg-[#A855F7] border border-[#A855F7] dark:border-[#BC84EE] hover:scale-110` (Lavender/Light Purple)
     * Level 4 (Max, 5+ activities): `bg-[#DCFD8B] dark:bg-[#DCFD8B] border border-[#bef264] dark:border-[#DCFD8B] shadow-[0_0_6px_rgba(220,253,139,0.4)] dark:shadow-[0_0_10px_rgba(220,253,139,0.7)] hover:scale-110 text-slate-900` (Mindcraft Signature Lime)
   - Ensure the mini-legend at the bottom of the graph reflects these 5 intensity steps.
   - Verify that `frontend-react/src/pages/Profile.jsx` and `frontend-react/src/pages/StreakDetail.jsx` render identically with zero styling discrepancies.

2. Intro Modal 2 Copy Redesign:
   - In `frontend-react/src/constants/introSlides.js`, completely remove mentions of Sarvam AI and vernacular voice search from Slide 2.
   - Update Slide 2 to focus on collaborative peer study, mutual skill exchange, and scheduling:
     * `title`: 'Smart Peer Matching'
     * `subtitle`: 'Find Mates Who Teach What You Learn'
     * `desc`: 'Connect with compatible study partners based on mutual skills, courses, and schedules. Teach what you excel in and learn what you need through collaborative peer sessions.'
     * `highlights`: ['Mutual Skill Matchmaking', 'Course & Topic Alignment', 'Verified Study Partners']

3. Intro Modals Clean Human-Designed Pill Badges:
   - In `frontend-react/src/components/Onboarding.jsx` (lines 135-143), remove the artificial `✦ ` character from highlight badges.
   - Replace with a clean, structured tag featuring a subtle solid 6px indicator bullet:
     ```jsx
     <span
       key={i}
       className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-lg border backdrop-blur-sm ${currentSlide.tagColor}`}
     >
       <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
       {h}
     </span>
     ```

4. Smooth Directional Spring Transitions:
   - In `frontend-react/src/components/Onboarding.jsx`:
     * Add `mode="wait"` to `<AnimatePresence>` around the slide content container.
     * Replace vertical snapping translation with direction-aware horizontal slide transitions based on whether the user clicked "Next" or "Back":
       ```javascript
       const slideVariants = {
         enter: (direction) => ({ x: direction > 0 ? 40 : -40, opacity: 0, scale: 0.98 }),
         center: { x: 0, opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 30 } },
         exit: (direction) => ({ x: direction < 0 ? 40 : -40, opacity: 0, scale: 0.98, transition: { duration: 0.15 } })
       };
       ```
     * Synchronize the background ambient glow animation duration to `0.35s` (matching the slide spring transition).

NEW AUTOMATED TESTS TO ADD:
- In `frontend-react/src/test/IntroModals.test.jsx`:
  * Test that Slide 2 contains 'Smart Peer Matching' and does NOT contain 'voice' or 'Sarvam' (case-insensitive).
  * Test that highlight badges render without any `✦` characters.
  * Test that navigating between slides renders the updated content cleanly.
- Create `frontend-react/src/test/ConsistencyGraphPalette.test.jsx`:
  * Test `getCellColorClass` returns `#4C1D95` for level 1, `#7C3AED` for level 2, `#BC84EE` for level 3, and `#DCFD8B` for level 4.
  * Test that no output string contains `#a3e635` or `#65a30d`.

VERIFICATION COMMANDS:
Run the following in the repository:
```bash
cd frontend-react && pnpm test -- --run src/test/IntroModals.test.jsx src/test/ConsistencyGraphPalette.test.jsx
cd frontend-react && pnpm lint
cd frontend-react && pnpm build
```
```

---

## PROMPT 2: Speed, Edge Caching, Query Prefetching & Search Debouncing

```markdown
ROLE: Full-Stack Performance Architect.
TASK: Optimize edge caching headers, TanStack QueryClient prefetching, live search input debouncing, and multi-table search query efficiency.

FINDINGS RESOLVED:
- Audit #3a (P1): Root `index.html` lacks explicit non-caching headers on Vercel CDN.
- Audit #3c (P1): QueryClient lacks route prefetching across primary navigation items.
- Audit #3d (P2): Live search inputs lack debouncing; top-level Suspense triggers full-viewport flashes.
- Audit #8 (P1): `GET /api/user/search` runs unanchored multi-table `ILIKE '%q%'` without rate limits or input debouncing.

FILES TO MODIFY:
1. `frontend-react/vercel.json`
2. `frontend-react/src/config/queryClient.js`
3. `frontend-react/src/hooks/useDebounce.js` (create or export standard hook)
4. `frontend-react/src/pages/FindMate.jsx`
5. `frontend-react/src/App.jsx`
6. `backend/src/routes/user.js`

SPECIFIC IMPLEMENTATION REQUIREMENTS:

1. Vercel Static & Non-Caching Headers:
   - In `frontend-react/vercel.json`, ensure `/assets/*` maintains `Cache-Control: public, max-age=31536000, immutable`.
   - Add an explicit rule for `index.html` to prevent stale client cache during production deployments:
     ```json
     {
       "source": "/(.*)",
       "headers": [
         { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
       ]
     }
     ```

2. Input Debouncing on Find Mate & User Search:
   - Ensure a robust `useDebounce(value, delay = 300)` hook is implemented.
   - In `frontend-react/src/pages/FindMate.jsx`:
     * Debounce the search input state with a 300ms delay before triggering queries.
     * Prevent empty queries or single-character inputs from firing heavy network searches (require `trimmedQuery.length >= 2` or show default recommendations).

3. QueryClient Prefetching on Navigation:
   - In `frontend-react/src/config/queryClient.js` and top-level navigation components:
     * Add helper methods to prefetch `/api/match/recommendations`, `/api/doubt/trending`, and user profile data on mouse hover over navigation tabs (`FindMate`, `DoubtForum`, `Profile`).

4. Replace Top-Level Suspense Flashes:
   - In `frontend-react/src/App.jsx`:
     * Replace the jarring full-viewport `<PageSpinner>` in top-level React Suspense with a minimal, top-progress bar or localized page skeletons so route transitions feel instantaneous.

5. Optimize Backend Search Endpoint:
   - In `backend/src/routes/user.js` (`GET /api/user/search`):
     * Enforce input validation: if search term is less than 2 characters, return `{ success: true, data: [] }` immediately.
     * Add `take: 20` to prevent unbounded query result serialization.
     * Ensure search query searches `clerkUserId`, `name`, `email`, and `skills` efficiently.

NEW AUTOMATED TESTS TO ADD:
- Create `frontend-react/src/test/useDebounce.test.jsx`:
  * Test that value changes are only emitted after the specified 300ms window.
- Create `backend/tests/userSearch.test.js`:
  * Test `GET /api/user/search?q=a` returns empty array with 0 DB query overhead.
  * Test `GET /api/user/search?q=valid` returns at most 20 records.

VERIFICATION COMMANDS:
```bash
cd frontend-react && pnpm test -- --run src/test/useDebounce.test.jsx
cd backend && pnpm test tests/userSearch.test.js
cd frontend-react && pnpm lint && pnpm build
```
```

---

## PROMPT 3: Peer Matching Engine, Case-Insensitive Skill Discovery & Cache Invalidation

```markdown
ROLE: Senior Backend Engineer & Database Architect.
TASK: Fix the peer matching engine to support case-insensitive skill matching, instant cache invalidation upon user profile updates, robust search filter synchronization, and concurrency-safe match requests.

FINDINGS RESOLVED:
- Audit #4 (P0): `invalidateMatchingFeeds` is dead code; existing users receive 300s stale cache when peers update.
- Audit #5 (P0): `Skill.name` joins are case-sensitive; "dsa" vs "DSA" yields 0 matches.
- Audit #6 (P1): Find Mate query filters (college, department, year, rating) are dropped by backend; no search by User ID.
- Audit #7 (P1): `MatchRequest` lacks unique constraints (TOCTOU double-click race); follow routes are dead stubs.

FILES TO MODIFY:
1. `backend/prisma/schema.prisma`
2. `backend/src/services/matchingEngine.js`
3. `backend/src/services/matchingCache.js`
4. `backend/src/routes/match.js`
5. `backend/src/routes/user.js`
6. `frontend-react/src/pages/FindMate.jsx`

SPECIFIC IMPLEMENTATION REQUIREMENTS:

1. Case-Insensitive Skill Discovery & Normalization:
   - In `backend/prisma/schema.prisma`, ensure skills are uniquely identified case-insensitively or normalized at the service level.
   - In `backend/src/routes/user.js` (skill creation/update) and `backend/src/services/matchingEngine.js`:
     * Normalize skill names upon creation using `.trim().toLowerCase()`.
     * In the matching SQL CTE query, compare skills using `LOWER(s.name) = LOWER(req.name)` rather than strict UUID equality, guaranteeing "DSA", "dsa", and "Dsa" match with 100% precision.

2. Instant Matching Cache Invalidation:
   - In `backend/src/services/matchingCache.js`, ensure `invalidateMatchingFeeds(userId)` clears the user's cache and invalidates relevant global/campus match keys in Redis.
   - In `backend/src/routes/user.js`:
     * Wire `invalidateMatchingFeeds` into `POST /api/user/sync`, `PUT /api/user/profile`, and skill update routes.
     * When User B joins or updates their skills, invalidation triggers so User A sees User B in recommendations immediately.

3. Complete Filter Synchronization & User ID Search:
   - In `backend/src/routes/match.js` (`GET /api/match/recommendations`):
     * Parse and pass `college`, `department`, `year`, `minRating`, and `sortBy` to `findMatches()`.
     * Update `findMatches()` in `matchingEngine.js` to dynamically apply these WHERE clauses instead of hardcoding `sameCollegeOnly: true`.
   - In `backend/src/routes/user.js` (`GET /api/user/search`):
     * Support searching by exact User ID (`id` UUID or `clerkUserId`).

4. Destructive Double-Click Protection & Safe Match Requests:
   - In `backend/prisma/schema.prisma`:
     * Add `@@unique([requesterId, recipientId, status])` or add an application-level atomic check with Prisma transaction to prevent duplicate pending match requests.
   - In `backend/src/routes/match.js` (`POST /api/match/request`):
     * Validate that a pending match request does not already exist between the two users before creating. If already pending, return `{ success: true, alreadyRequested: true, data: existingRequest }` idempotently.
   - Remove or implement working logic for follow endpoints in `backend/src/routes/user.js`.

NEW AUTOMATED TESTS TO ADD:
- Create `backend/tests/matchingEngine.test.js`:
  * Test case-insensitivity: User with skill "dsa" matches with user teaching "DSA".
  * Test cache invalidation: Feed updates immediately after profile update without waiting 300s.
  * Test match request idempotency: 5 concurrent requests from User A to User B create exactly 1 database record.

VERIFICATION COMMANDS:
```bash
cd backend && pnpm prisma generate
cd backend && pnpm test tests/matchingEngine.test.js
cd backend && pnpm lint
```
```

---

## PROMPT 4: Doubt Forum Architecture, Trending Tag Routing, Server-Side Filtering, AI Hint Async Pipeline & Rate Limiting

```markdown
ROLE: Senior Full-Stack Engineer & API Security Lead.
TASK: Connect Dashboard trending topics to Doubt Forum filters, implement server-side search and solved status filters, decouple Sarvam AI study hints into a non-blocking asynchronous pipeline, and enforce rate limits against AI quota abuse.

FINDINGS RESOLVED:
- Audit #9 (P1): Synchronous Sarvam AI generation blocks HTTP thread for 1.5s to 30s; `aiAssistError` missing from payload.
- Audit #10 (P1): Dashboard trending topic click navigates to `/forum?tag=...` but forum ignores `?tag=` URL query param.
- Audit #11 (P1): Missing text search bar, solved/unsolved filter, and sort options; "My Doubts" breaks on 20-item client slice.
- Audit #12 (P2): Upvoting lacks TanStack Query optimistic update `onMutate`.
- Audit #13 (P1): Zero rate limiting on `POST /api/doubt`; concurrent submissions exhaust Sarvam AI quota.

FILES TO MODIFY:
1. `backend/server.js`
2. `backend/src/routes/doubt.js`
3. `backend/src/services/sarvamAI.js`
4. `frontend-react/src/pages/DoubtForum.jsx`
5. `frontend-react/src/hooks/useDoubtForum.js`

SPECIFIC IMPLEMENTATION REQUIREMENTS:

1. Trending Tag & URL Search Param Routing:
   - In `frontend-react/src/pages/DoubtForum.jsx`:
     * Read `searchParams.get('tag')` upon mount and in a `useEffect` watching `searchParams`.
     * If `?tag=` is present, automatically set `activeFilter` to the decoded tag (e.g. `#DSA`) and filter the doubts list accordingly.
     * When user changes the filter tab, sync the URL with `setSearchParams({ tag: newTag })`.

2. Server-Side Search, Status Filter & "My Doubts" Server Pagination:
   - In `backend/src/routes/doubt.js` (`GET /api/doubt`):
     * Add support for `q` (text search across title and content using `contains` / `mode: 'insensitive'`).
     * Add support for `status` (`OPEN` vs `SOLVED`).
     * Add support for `authorUid` or `onlyMine=true` to query the author's doubts directly in SQL.
     * Add support for `sortBy` (`newest`, `upvotes`, `answers`).
   - In `frontend-react/src/pages/DoubtForum.jsx`:
     * Add a clean debounced search input bar.
     * Add Solved / Unsolved toggle pills.
     * Update "My Doubts" to pass `onlyMine=true` to the API instead of client-filtering the 20-item page slice.

3. Asynchronous Non-Blocking Sarvam AI Study Hints:
   - In `backend/src/routes/doubt.js`:
     * Decouple `generateStudyHint` from blocking the `POST /api/doubt` HTTP response.
     * Save the doubt immediately with `aiAssistStatus: 'PENDING'`. Respond with HTTP 201 in <200ms.
     * Execute `generateStudyHint` asynchronously in the background. On completion or fallback, update the database record and emit a socket event (`doubt:hint_ready`, `{ doubtId, aiHint, aiAssistStatus }`).
     * In `formatDoubt`, explicitly include `aiAssistError: d.aiAssistError || null`.

4. AI Quota Abuse Protection & Rate Limiting:
   - In `backend/server.js`:
     * Define `doubtCreationLimiter`: max 5 doubts per 10 minutes per authenticated user/IP.
     * Mount `doubtCreationLimiter` directly on `POST /api/doubt`.

5. Optimistic UI Updates for Forum Upvoting:
   - In `frontend-react/src/hooks/useDoubtForum.js`:
     * Implement `onMutate` in `useToggleDoubtUpvote` to immediately toggle `hasUpvoted` and increment/decrement `upvotes` in the TanStack cache with rollback on error.
     * Disable the upvote button while mutation is pending to eliminate click jitter.

NEW AUTOMATED TESTS TO ADD:
- Create `backend/tests/doubtForum.test.js`:
  * Test `POST /api/doubt` returns 201 immediately with status `PENDING`.
  * Test `POST /api/doubt` rate limiter blocks the 6th submission within 10 minutes.
  * Test `GET /api/doubt?q=recursion` filters doubts by text.
  * Test `GET /api/doubt?onlyMine=true` returns author's lifetime doubts regardless of total count.
- Create `frontend-react/src/test/DoubtForumTagParam.test.jsx`:
  * Test that loading `/forum?tag=%23DSA` sets active tag to `#DSA`.

VERIFICATION COMMANDS:
```bash
cd backend && pnpm test tests/doubtForum.test.js
cd frontend-react && pnpm test -- --run src/test/DoubtForumTagParam.test.jsx
cd backend && pnpm lint
cd frontend-react && pnpm lint && pnpm build
```
```

---

## PROMPT 5: Real-Time Socket Architecture, Render Persistence Fallback, Socket Reconnection & Message Reconciliation

```markdown
ROLE: Principal Real-Time Systems Architect.
TASK: Eliminate the Render free-tier chat vanishing bug with an inline Prisma fallback, fix Clerk token expiration recovery, resolve the senderUid mutation / double-message display defect, wire real-time message edit/delete events, and throttle socket spam.

FINDINGS RESOLVED:
- Audit #14 (P0): Render single dyno lacks worker; socket relies strictly on BullMQ without Prisma fallback, causing 100% chat loss on refresh.
- Audit #15 (P0): Token refresh rejections cause unhandled `connect_error`; socket ceases reconnection permanently.
- Audit #16 (P0): `senderUid` swapped with Prisma UUID; `clientMessageId` dropped; sent messages duplicated on left side.
- Audit #16 (P1): Backend emits `message_edited` and `message_deleted`, but `NotificationContext` drops them.
- Audit #18 (P1): Concurrency row lock contention on `ChatThread`; multi-tab presence flapping on tab close.

FILES TO MODIFY:
1. `backend/server.js`
2. `backend/src/config/socket.js`
3. `backend/src/middleware/socketAuth.js`
4. `backend/src/services/chatPersistenceService.js`
5. `backend/src/workers/chatPersistenceWorker.js`
6. `frontend-react/src/context/NotificationContext.jsx`
7. `frontend-react/src/pages/Chat.jsx`

SPECIFIC IMPLEMENTATION REQUIREMENTS:

1. Render Free-Tier Chat Message Persistence Bomb Fix:
   - In `backend/src/config/socket.js` (`socket.on('chat:message')`):
     * Wrap `enqueueChatMessage` in a defensive try/catch.
     * If Redis is unreachable, BullMQ fails, or worker is absent, immediately invoke `await persistMessage({ threadId, senderId: verifiedUserId, clientMessageId, text: trimmedText, createdAt: nowIso })` directly via Prisma.
     * Guarantee that Postgres receives the row before or alongside socket emission.
   - In `backend/server.js:216-229`:
     * Update `shouldRunInProcessWorker` so it defaults to `true` whenever `process.env.STANDALONE_WORKER !== 'true'`, ensuring in-process workers run seamlessly in development and single-dyno hosting.

2. Socket Authentication & Clerk Token Expiration Reconnection:
   - In `frontend-react/src/context/NotificationContext.jsx`:
     * Add an explicit `socket.on('connect_error', async (err) => { ... })` listener.
     * If `err.message` indicates authentication failure or `AUTH_INVALID`, fetch a fresh Clerk token via `getTokenRef.current?.({ skipCache: true })`, update `socket.auth.token`, and call `socket.connect()`.
     * Add an exponential backoff retry to prevent reconnection storms.

3. Fix `senderUid` Prisma UUID Mutation & Message Reconciliation:
   - In `frontend-react/src/context/NotificationContext.jsx` (inside `socket.on('chat:message')`):
     * Map `localId: message.clientMessageId`.
     * Map `senderUid: message.senderUid` (Clerk user ID `user_2...`), NOT `message.senderId` (Prisma UUID).
     * Pass `senderId: message.senderId` as a secondary field.
   - In `frontend-react/src/pages/Chat.jsx`:
     * Match incoming messages against optimistic messages using `localId`:
       ```javascript
       setMessages(prev => {
         const existingIndex = prev.findIndex(m => m.localId && m.localId === incoming.localId);
         if (existingIndex !== -1) {
           const updated = [...prev];
           updated[existingIndex] = { ...incoming, status: 'sent' };
           return updated;
         }
         if (prev.some(m => m.id === incoming.id || m.messageId === incoming.messageId)) return prev;
         return [...prev, incoming];
       });
       ```
     * Ensure `isMine` evaluates `msg.senderUid === currentUser.uid || msg.senderId === currentUser.uid`.

4. Wire Real-Time Edit & Delete Events:
   - In `frontend-react/src/context/NotificationContext.jsx`:
     * Add listeners for `message_edited` and `message_deleted`:
       ```javascript
       socket.on('message_edited', (data) => {
         const listener = chatListeners.current.get(data.matchId);
         if (listener) listener({ type: 'message_edited', ...data });
       });
       socket.on('message_deleted', (data) => {
         const listener = chatListeners.current.get(data.matchId);
         if (listener) listener({ type: 'message_deleted', ...data });
       });
       ```
   - In `frontend-react/src/pages/Chat.jsx`:
     * Handle `message_edited` by updating `text` and setting `isEdited: true`.
     * Handle `message_deleted` by removing the message from `messages` state.

5. Concurrency & Rate Limiting Guards:
   - In `backend/src/config/socket.js`:
     * Add per-socket token-bucket rate limiter: max 5 messages per 2 seconds.
   - In `frontend-react/src/pages/Chat.jsx`:
     * Debounce `globalMarkRead` (300ms) to prevent 30 HTTP requests during rapid incoming message bursts.
   - In `backend/src/config/socket.js` (presence):
     * Count active socket connections for the user before emitting `presence:changed` with `status: 'offline'`. Only emit offline when the user's connection count drops to 0.

NEW AUTOMATED TESTS TO ADD:
- Create `backend/tests/chatPersistenceFallback.test.js`:
  * Test that `socket.on('chat:message')` persists to Postgres even when BullMQ is completely disabled.
- Create `frontend-react/src/test/ChatMessageReconciliation.test.jsx`:
  * Test that an optimistic message with `localId` is updated in place and is NOT duplicated.
  * Test that sender's own message renders with `isMine: true`.

VERIFICATION COMMANDS:
```bash
cd backend && pnpm test tests/chatPersistenceFallback.test.js
cd frontend-react && pnpm test -- --run src/test/ChatMessageReconciliation.test.jsx
cd backend && pnpm lint
cd frontend-react && pnpm lint && pnpm build
```
```

---

## PROMPT 6: Full Notification System Overhaul Across All Triggers & Offline Parity

```markdown
ROLE: Full-Stack Systems Engineer.
TASK: Audit and fix end-to-end notification flows across all application triggers, support offline match request hydration, correct destination route mapping, fix doubt answer notifications, and bound notification storage.

FINDINGS RESOLVED:
- Audit #17 (P1): Match requests omit `route`, defaulting users to `/sessions`; offline match requests completely lost in notifications inbox; doubt answers mislabeled as `NEW_DOUBT`; answer acceptance emits zero notification; unbounded `localStorage` growth.

FILES TO MODIFY:
1. `backend/src/routes/match.js`
2. `backend/src/routes/session.js`
3. `backend/src/routes/doubt.js`
4. `frontend-react/src/context/NotificationContext.jsx`
5. `frontend-react/src/pages/Notifications.jsx`

SPECIFIC IMPLEMENTATION REQUIREMENTS:

1. Offline Match Request Parity in Notifications:
   - In `frontend-react/src/pages/Notifications.jsx` (`buildNotifications()`):
     * Call `matchService.getMatchRequests(currentUser.uid)` alongside sessions and doubts.
     * Hydrate pending match requests into notification cards with actionable "Accept" and "Decline" buttons.

2. Correct Notification Navigation Routes:
   - In `backend/src/routes/match.js`:
     * When emitting `match_request`, include `route: '/notifications'`.
     * When emitting `match_accepted`, include `route: `/chat/${thread.id}``.
   - In `backend/src/routes/session.js`:
     * Ensure all session notifications supply `route: '/sessions'`.

3. Doubt Reply & Accepted Answer Notifications:
   - In `backend/src/routes/doubt.js`:
     * In `POST /api/doubt/:id/answer`: Emit `type: 'global_forum_doubt'`, `subType: 'new_answer'`, with `authorName`, `doubtTitle`, `doubtId`, and `route: `/forum?doubtId=${id}``.
     * In `POST /api/doubt/:id/accept-answer`: Emit `type: 'global_forum_doubt'`, `subType: 'answer_accepted'`, with `tokenReward: 10`, `doubtTitle`, and `route: `/forum?doubtId=${id}`` to the accepted answer's author.
   - In `frontend-react/src/context/NotificationContext.jsx`:
     * Parse `data.subType`:
       * If `'new_answer'`: Title: 'New Answer to Your Doubt', Message: `${authorName} answered: "${doubtTitle}"`.
       * If `'answer_accepted'`: Title: 'Solution Accepted! 🌟', Message: `Your answer was marked as the accepted solution (+10 Tokens)!`.
       * If `'new_doubt'`: Title: 'New Doubt', Message: `${authorName} asked: "${doubtTitle}"`.

4. Notification Read State & Storage Eviction:
   - In `frontend-react/src/pages/Notifications.jsx`:
     * When user clicks "Mark all as read", persist an updated `readIds` list.
     * Implement a FIFO cap of 100 items for `mindcraft_read_notifs` in `localStorage` to prevent unbounded memory growth.

NEW AUTOMATED TESTS TO ADD:
- Create `backend/tests/notificationEmissions.test.js`:
  * Test that `POST /api/match/request` emits `subType: 'match_request'` with `route: '/notifications'`.
  * Test that `POST /api/doubt/:id/accept-answer` emits `subType: 'answer_accepted'` to answer author.
- Create `frontend-react/src/test/NotificationSubtypes.test.jsx`:
  * Test that `new_answer` and `answer_accepted` render proper notification titles and navigation links.

VERIFICATION COMMANDS:
```bash
cd backend && pnpm test tests/notificationEmissions.test.js
cd frontend-react && pnpm test -- --run src/test/NotificationSubtypes.test.jsx
cd backend && pnpm lint
cd frontend-react && pnpm lint && pnpm build
```
```

---

## PROMPT 7: Tutoring Sessions, Google Calendar, Ratings & Gamification Badges

```markdown
ROLE: Principal Backend Engineer & Gamification Architect.
TASK: Eliminate dead Google OAuth popups by establishing zero-failure calendar deep-links & Jitsi meet links, fix interval overlap checking, correct study hours / completed session counts, fix rating recalculation mathematics & mutual rating logic, synchronize all 17 badges, and schedule Weekly Warrior automation.

FINDINGS RESOLVED:
- Audit #19 (P1): Direct Google Calendar OAuth callback is dead code, causing a hanging 120s popup in Notifications.
- Audit #20 (P1): Broken interval overlap logic allows double-bookings; reschedule route is missing.
- Audit #21 (P0): `take: 20` hardcaps completed sessions at 20 and study hours at 20.0h; reviews array injects fake 5-star cards.
- Audit #22 (P0): Rating formula weights total sessions instead of rated sessions (collapsing ratings to 0.5); teacher rating learner mutates teacher.
- Audit #23 (P1): 8 of 17 seeded badges are ghosts; `recordBadgeEarned` is dead code; weekly warrior worker has no cron runner on single-dyno Render.

FILES TO MODIFY:
1. `backend/src/routes/session.js`
2. `backend/src/routes/user.js`
3. `backend/src/services/calendarExport.js`
4. `backend/src/services/sessionRouter.js`
5. `backend/src/services/badgeCalculator.js`
6. `backend/src/services/weeklyWarriorService.js`
7. `backend/server.js`
8. `frontend-react/src/pages/Notifications.jsx`
9. `frontend-react/src/pages/SessionsDetail.jsx`
10. `frontend-react/src/pages/Profile.jsx`
11. `frontend-react/src/pages/BadgeProgress.jsx`

SPECIFIC IMPLEMENTATION REQUIREMENTS:

1. Zero-Failure Calendar & Reliable Meeting Links:
   - In `frontend-react/src/pages/Notifications.jsx` (`handleAcceptSession`):
     * Completely remove the dead 120-second Google OAuth popup promise.
     * Accept sessions immediately without blocking.
   - Standardize online meeting links:
     * Set `meetLink: https://meet.jit.si/MindCraft-${session.id}` for all online sessions.
     * Ensure `AddToCalendarBtn` uses `POST /api/session/:id/export-calendar` generating the zero-failure Google Calendar Web URL (`action=TEMPLATE`) with Jitsi link and participant email.

2. Session Interval Overlap & Rescheduling:
   - In `backend/src/routes/session.js`:
     * Fix interval collision detection to standard mathematical overlap:
       `existing.scheduledFor < newEnd AND existing.scheduledFor + existing.duration > newStart`
     * Check collisions for BOTH `teacherId` AND `learnerId`.
     * Add `PATCH /api/session/:id/reschedule` endpoint to reschedule pending or upcoming sessions safely.

3. Fix Lifetime Study Hours & Session Count Truncation:
   - In `backend/src/routes/user.js`:
     * Replace `findMany({ take: 20 })` with:
       ```javascript
       const completedSessionsCount = await prisma.tutoringSession.count({
         where: { OR: [{ teacherId: user.id }, { learnerId: user.id }], status: 'COMPLETED' },
       });
       const aggregateHours = await prisma.tutoringSession.aggregate({
         where: { OR: [{ teacherId: user.id }, { learnerId: user.id }], status: 'COMPLETED' },
         _sum: { duration: true },
       });
       const totalStudyHours = +((aggregateHours._sum.duration || 0) / 60).toFixed(1);
       ```
     * In the reviews mapper, extract actual `rating` and `comment` stored in `completionKey`, eliminating the hardcoded `rating: 5` and `"Great session!"` overrides.

4. Fix Rating Recalculation & Mutual Rating Logic:
   - In `backend/src/routes/session.js` (`POST /api/session/:id/rate`):
     * Determine target user: if learner is rating -> target is teacher; if teacher is rating -> target is learner.
     * Query `ratedSessionsCount = await prisma.tutoringSession.count({ where: { [targetField]: targetUserId, status: 'COMPLETED', completionKey: { contains: targetRatingKey } } })`.
     * Calculate `newRating = ((prevRating * (ratedSessionsCount - 1) + numRating) / ratedSessionsCount)`.
     * Update `prisma.user.update({ where: { id: targetUserId }, data: { averageRating: newRating } })`.

5. 17-Badge Inventory Alignment, History Persistence & Weekly Warrior Cron:
   - In `backend/src/services/badgeCalculator.js`:
     * Register all 8 ghost badges (`spark_starter`, `7_day_streak`, `fortnight_focus`, `monthly_master`, `discipline_king`, `century_legend`, `master_tutor`, `weekly_warrior`) into `BADGE_DEFINITIONS`.
     * When `calculateBadges` detects a newly unlocked badge or level increase, call `recordBadgeEarned(uid, badgeId, badgeName, level)` to persist into `UserBadge`.
   - In `frontend-react/src/pages/BadgeProgress.jsx`:
     * Map icons and render all 17 badges; verify `badgeHistory` renders earned history cards.
   - In `backend/server.js`:
     * Add a node-cron job running every Sunday at 23:59 to execute `weeklyWarriorService.runWeeklyAudit()`.

NEW AUTOMATED TESTS TO ADD:
- Create `backend/tests/sessionLifecycle.test.js`:
  * Test interval collision prevents booking overlapping sessions for both tutor and learner.
  * Test rating recalculation does not penalize unrated sessions.
  * Test that teacher rating learner mutates learner's rating, not teacher's rating.
- Create `backend/tests/badgePersistence.test.js`:
  * Test that all 17 badges have valid definitions.
  * Test that unlocking a badge creates a `UserBadge` record accessible via `getBadgeHistory`.

VERIFICATION COMMANDS:
```bash
cd backend && pnpm test tests/sessionLifecycle.test.js tests/badgePersistence.test.js
cd frontend-react && pnpm test -- --run src/test/BadgeProgress.test.jsx
cd backend && pnpm lint
cd frontend-react && pnpm lint && pnpm build
```
```
