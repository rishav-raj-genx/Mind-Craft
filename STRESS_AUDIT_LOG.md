# Mindcraft Stress Audit Log (Audits 1 to 5 of 5) — Comprehensive Final Audit
**Role:** Principal Integration, Gamification & Real-Time QA Auditor  
**Date:** 2026-11-26  
**Mode:** STRICT READ-ONLY AUDIT — Application code untouched.

---

## Executive Summary Matrix

| Audit Target | Scope / Component | Status | Primary Finding |
|---|---|---|---|
| **1. Consistency Graph Palette** | `ConsistencyGraph.jsx`, `Profile.jsx`, `StreakDetail.jsx` | **FAIL** | GitHub green palette used instead of signature purple-to-lime gradient; inverted dark/light scale. |
| **2a. Intro Modal 2 Copy** | `introSlides.js` | **FAIL** | Mentions Sarvam AI vernacular voice search in description and highlights. |
| **2b. Intro Modal Sparkle Badges** | `Onboarding.jsx` | **FAIL** | Contains artificial AI-style `✦ ...` glyphs in highlight chips. |
| **2c. Intro Modal Transitions** | `Onboarding.jsx` | **FAIL** | `<AnimatePresence>` lacks `mode="wait"`, vertical shift causes layout snap, desynced 0.7s glow. |
| **3a. Static Asset Caching / SPA** | `frontend-react/vercel.json` | **PARTIAL** | `/assets/*` immutable cache and SPA rewrites present; root `index.html` cache headers missing. |
| **3b. Code Splitting & Chunks** | `vite.config.js` | **PASS** | 8 vendor split chunks; largest bundle ~350KB uncompressed; PWA asset caching configured. |
| **3c. TanStack QueryClient** | `queryClient.js`, hooks | **PARTIAL** | `staleTime: 2m`, `gcTime: 10m` set; zero prefetching implemented across routes. |
| **3d. Input Debouncing & Transitions**| `FindMate.jsx`, `App.jsx`, `backend/server.js` | **PARTIAL** | Gzip compression active; live search debounce missing; top-level Suspense flashes PageSpinner. |
| **4. Instant Discovery & Invalidation** | `matchingCache.js`, `user.js` | **FAIL** | `invalidateMatchingFeeds` is dead code; registration/edits never invalidate other users' Redis feeds. |
| **5. Exact Skill Matching Accuracy** | `matchingEngine.js`, `schema.prisma` | **FAIL** | Case-sensitive join on `Skill.name` UUID; `dsa` vs `DSA` or `Web Dev` vs `WEB` yield zero matches. |
| **6. Search Filters & Route Parity** | `FindMate.jsx`, `match.js`, `user.js` | **FAIL** | `match.js` ignores college/dept/year/rating params; `FindMate` never calls broad matches; no search by ID. |
| **7. Match Request & Follow Flow** | `match.js`, `user.js`, `FindMate.jsx` | **FAIL** | Follow routes are dummy no-op stubs; DB lacks unique constraints (TOCTOU race on requests); UI bypasses requests. |
| **8. Performance & Search Load** | `matchingEngine.js`, `user.js` | **PARTIAL** | Single CTE query has zero N+1; but `/user/search` uses un-indexed multi-table `ILIKE` without debounce. |
| **9. Sarvam AI Study Hints Pipeline** | `doubt.js`, `sarvamAI.js`, `DoubtForum.jsx` | **PARTIAL** | Hints generated & stored via OpenAI schema; but blocks HTTP thread up to 30s; `aiAssistError` omitted from payload. |
| **10. Trending Topics & Filter Linkage** | `Home.jsx`, `doubt.js`, `DoubtForum.jsx` | **FAIL** | Backend dynamic aggregation works, but `DoubtForum.jsx` completely ignores `?tag=...` URL parameter on navigation. |
| **11. Doubt Forum Filters, Search & Sort**| `DoubtForum.jsx`, `doubt.js` | **FAIL** | Missing text search bar, solved/unsolved filter, sort selectors; "My Doubts" breaks on 20-item pagination slice. |
| **12. Answers, Voting & Token Integrity** | `doubt.js`, `tokenEconomy.js` | **PASS** | Atomic composite votes prevent spam; self-answering forbidden; token awards protected by unique idempotency keys. |
| **13. AI Hint Abuse & Rate Limiting** | `doubt.js`, `server.js` | **FAIL** | Zero route-level rate limiting on `POST /api/doubt`; concurrent users can burn 100 Sarvam AI calls in 1 minute. |
| **14. Render Free-Tier Persistence Bomb** | `server.js`, `socket.js`, `chatPersistenceWorker.js` | **FAIL** | Messages route strictly to BullMQ without Prisma fallback; dev runs without worker; worker drop = 100% chat loss. |
| **15. Socket Auth & Token Lifespan** | `socketAuth.js`, `NotificationContext.jsx` | **FAIL** | Auth rejects trigger unhandled `connect_error`; socket ceases reconnection permanently on token expiration. |
| **16. Real-Time Chat Delivery & Parity** | `socket.js`, `NotificationContext.jsx`, `Chat.jsx` | **FAIL** | `senderUid` swapped for UUID; `localId` dropped; sent messages duplicated on left; edit/delete events omitted. |
| **17. Notification System End-to-End** | `match.js`, `session.js`, `doubt.js`, `Notifications.jsx` | **FAIL** | Match requests route to `/sessions`; offline requests lost; doubt answers mislabeled; verified answer emits nothing. |
| **18. Concurrency & Multi-Tab Spam** | `socket.js`, `chatPersistenceWorker.js`, `Chat.jsx` | **FAIL** | Zero Socket rate limiting; 60 un-batched queries / 30 msgs; tab close prematurely triggers offline presence. |
| **19. Google Calendar & Meeting Links** | `session.js`, `calendarExport.js`, `SessionsDetail.jsx` | **PARTIAL** | Direct Google Calendar API insert / Google Meet link dead (no OAuth callback); deep-link template / Jitsi works. |
| **20. Session Lifecycle & Spam Protection** | `session.js`, `sessionRouter.js`, `Chat.jsx` | **PARTIAL** | Double complete/rate and self-booking blocked; rescheduling is dead code; interval overlap check is incomplete. |
| **21. Profile Study Hours & Session Count** | `user.js`, `Profile.jsx`, `SessionsDetail.jsx` | **FAIL** | `take: 20` hardcaps completed sessions at 20 and study hours at 20.0h; reviews array overrides with fake 5-star cards. |
| **22. Rating Recalculation & Role Logic** | `session.js`, `schema.prisma` | **FAIL** | Mathematical flaw weights total sessions instead of rated sessions; teacher rating learner mutates teacher's own rating. |
| **23. Badges, Gamification & Automation** | `badgeCalculator.js`, `seed.js`, `BadgeProgress.jsx` | **FAIL** | 8 of 17 seeded badges are ghost definitions; `recordBadgeEarned` is dead code; `badgeHistory` is permanently empty. |

---

## Section 1: In-Depth Technical Audit Findings

### 1. Consistency Graph Palette Audit

#### 1.1 Current Implementation State
- **File:** `frontend-react/src/components/ConsistencyGraph.jsx`
- **Lines:** [21-38](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/components/ConsistencyGraph.jsx#L21-L38) (`getCellColorClass`), [303-314](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/components/ConsistencyGraph.jsx#L303-L314) (Legend)
- **Shared Usage:**
  - `frontend-react/src/pages/Profile.jsx` line [811-817](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/Profile.jsx#L811-L817)
  - `frontend-react/src/pages/StreakDetail.jsx` line [321-327](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/StreakDetail.jsx#L321-L327)
- **Status:** **FAIL**

#### 1.2 Evidence & Current Defect Analysis
Current color levels hardcoded in `getCellColorClass`:
```javascript
// frontend-react/src/components/ConsistencyGraph.jsx:21-38
function getCellColorClass(level) {
  switch (level) {
    case -1:
      return 'bg-transparent border border-dashed border-gray-200 dark:border-white/5 opacity-0 pointer-events-none';
    case 0:
      return 'bg-slate-100 dark:bg-[#1E1E2F] border border-slate-200/80 dark:border-[#2D2D44] hover:border-slate-400 dark:hover:border-slate-500';
    case 1:
      return 'bg-[#d9f99d] dark:bg-[#24421b] border border-[#bef264] dark:border-[#356127] hover:scale-110';
    case 2:
      return 'bg-[#a3e635] dark:bg-[#3b6d26] border border-[#84cc16] dark:border-[#529635] hover:scale-110';
    case 3:
      return 'bg-[#65a30d] dark:bg-[#74be34] border border-[#4d7c0f] dark:border-[#8ce33e] hover:scale-110';
    case 4:
      return 'bg-[#4d7c0f] dark:bg-[#DCFD8B] border border-[#3f6212] dark:border-[#DCFD8B] dark:shadow-[0_0_8px_rgba(220,253,139,0.5)] hover:scale-110';
    default:
      return 'bg-slate-100 dark:bg-[#1E1E2F] border border-slate-200 dark:border-[#2D2D44]';
  }
}
```

**Issues Detected:**
1. **GitHub Green Mimicry:** Cells utilize standard green `#a3e635`, `#65a30d`, and forest green `#4d7c0f` instead of Mindcraft's brand tokens (`#7C3AED`, `#BC84EE`, `#DCFD8B`).
2. **Inverted Light vs. Dark Semantics:**
   - In light mode: Level 1 is light lime (`#d9f99d`) and Level 4 is dark green (`#4d7c0f`).
   - In dark mode: Level 1 is dark green (`#24421b`) and Level 4 is bright neon lime (`#DCFD8B`).
   - Light mode darkens with intensity; dark mode brightens with intensity.
3. **Missing Uniform Mindcraft Progression:** Does not adhere to the required:
   `Empty (Neutral) -> Dark Purple (Low) -> Medium Purple (Moderate) -> Light Purple (High) -> Mindcraft Lime Green (Max intensity)`

#### 1.3 Exact Replacement Palette Specification
To maintain full parity across both `Profile.jsx` and `StreakDetail.jsx`, update `getCellColorClass(level)` in `frontend-react/src/components/ConsistencyGraph.jsx`:

| Level | Intensity | Light Mode Classes | Dark Mode Classes | Hex / Purpose |
|---|---|---|---|---|
| **-1** | Future Day | `bg-transparent border-dashed border-gray-200 opacity-0 pointer-events-none` | `dark:border-white/5` | Masked out |
| **0** | Empty (0 activities) | `bg-slate-100 border border-slate-200/80 hover:border-slate-400` | `dark:bg-[#1E1E2F] dark:border-[#2D2D44] dark:hover:border-slate-500` | Neutral baseline |
| **1** | Low (1 activity) | `bg-[#4C1D95] border border-[#3B0764] hover:scale-110` | `dark:bg-[#2E1065] dark:border-[#3B0764] hover:scale-110` | Dark Purple |
| **2** | Medium (2 activities)| `bg-[#7C3AED] border border-[#6D28D9] hover:scale-110` | `dark:bg-[#6D28D9] dark:border-[#7C3AED] hover:scale-110` | Mindcraft Brand Purple |
| **3** | High (3–4 activities)| `bg-[#BC84EE] border border-[#A855F7] hover:scale-110` | `dark:bg-[#A855F7] dark:border-[#BC84EE] hover:scale-110` | Lavender / Light Purple |
| **4** | Max (5+ activities)  | `bg-[#DCFD8B] border border-[#bef264] shadow-[0_0_6px_rgba(220,253,139,0.4)] hover:scale-110` | `dark:bg-[#DCFD8B] dark:border-[#DCFD8B] dark:shadow-[0_0_10px_rgba(220,253,139,0.7)] hover:scale-110` | Signature Mindcraft Lime |

---

### 2. 4 Intro Modals (`IntroModals` / Onboarding Component) Audit

#### 2.1 File Evidence & Component Hierarchy
- Constants: `frontend-react/src/constants/introSlides.js` lines [8-76](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/constants/introSlides.js#L8-L76)
- Component: `frontend-react/src/components/Onboarding.jsx` lines [1-197](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/components/Onboarding.jsx#L1-L197)
- Test Suite: `frontend-react/src/test/IntroModals.test.jsx` lines [1-109](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/test/IntroModals.test.jsx#L1-L109)
- Invocation: `frontend-react/src/App.jsx` lines [109-157](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/App.jsx#L109-L157)

#### 2.2 Flag (a): Modal 2 Mentions Sarvam AI Voice Search
- **Status:** **FAIL**
- **Location:** `frontend-react/src/constants/introSlides.js` lines [31-37](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/constants/introSlides.js#L31-L37)
- **Remediation Specification:**
  Remove Sarvam AI and vernacular voice claims from the intro tour. Focus strictly on peer matching, skill exchange, and collaborative scheduling:
  - **Proposed Title:** `'Smart Peer Matching'`
  - **Proposed Subtitle:** `'Find Mates Who Teach What You Learn'`
  - **Proposed Description:** `'Connect with compatible study partners based on mutual skills, courses, and schedules. Teach what you excel in and learn what you need through collaborative peer sessions.'`
  - **Proposed Highlights:**
    `['Mutual Skill Matchmaking', 'Course & Topic Alignment', 'Verified Study Partners']`

#### 2.3 Flag (b): Artificial AI-Looking Sparkle Pill Badges (`✦ ...`)
- **Status:** **FAIL**
- **Location:** `frontend-react/src/components/Onboarding.jsx` lines [135-143](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/components/Onboarding.jsx#L135-L143)
- **Remediation Specification:**
  Remove `✦ `. Replace with a structured, clean pill tag using a subtle solid bullet:
  ```jsx
  <span
    key={i}
    className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-lg border backdrop-blur-sm ${currentSlide.tagColor}`}
  >
    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
    {h}
  </span>
  ```

#### 2.4 Flag (c): Enter/Exit and Slide-Transition Animation Jerkiness
- **Status:** **FAIL**
- **Location:** `frontend-react/src/components/Onboarding.jsx` lines [61-67](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/components/Onboarding.jsx#L61-L67), [103-110](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/components/Onboarding.jsx#L103-L110)
- **Root Cause Analysis:**
  1. Missing `mode="wait"` in `<AnimatePresence>` causes layout snapping.
  2. Unidirectional vertical translation defies spatial mental models.
  3. Background glow duration (`0.7s`) is desynced from slide content (`0.2s`).
- **Crisp Physics Upgrade:**
  Add `mode="wait"`, implement horizontal direction-aware spring translation (`stiffness: 400, damping: 32`), and synchronize glow duration to `0.35s`.

---

### 3. Speed, Caching & CDN Readiness Audit

#### 3.1 Vercel Edge & Static Asset Caching (`vercel.json`)
- **File:** `frontend-react/vercel.json` lines [1-25](file:///Users/apple/Desktop/Mind-Craft/frontend-react/vercel.json#L1-L25)
- **Status:** **PARTIAL**
- **Evidence:** SPA Rewrites and `/assets/*` immutable cache are active. Root `index.html` lacks explicit non-caching headers (`public, max-age=0, must-revalidate`).

#### 3.2 Vite Configuration & Bundle Splitting
- **File:** `frontend-react/vite.config.js` lines [58-96](file:///Users/apple/Desktop/Mind-Craft/frontend-react/vite.config.js#L58-L96)
- **Status:** **PASS**
- **Evidence:** 8 manual chunks (`vendor-react`, `vendor-clerk`, etc.). Individual page bundles remain under 40KB.

#### 3.3 QueryClient Caching & Prefetching
- **File:** `frontend-react/src/config/queryClient.js` lines [11-20](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/config/queryClient.js#L11-L20)
- **Status:** **PARTIAL**
- **Evidence:** `staleTime: 2m`, `gcTime: 10m` are set. Zero query prefetching across the frontend.

#### 3.4 Search Inputs, Debouncing & Backend Compression
- **File:** `backend/server.js:93-96`, `FindMate.jsx:665`
- **Status:** **PARTIAL**
- **Evidence:** Gzip compression level 6 active on backend. Search input in `FindMate.jsx` lacks debouncing. Top-level Suspense triggers full-viewport spinner flashes.

---

## Section 2: Peer Matching, Search, and Real-Time Discovery Audit

### 4. Instant Discovery & Cache Invalidation
- **Files:** `matchingCache.js:54-64`, `matchingEngine.js:139-148`, `user.js:52-228`, `user.js:475-617`
- **Status:** **FAIL**
- **Evidence:** `invalidateMatchingFeeds` is dead code (never called). Feed cache keys are bound to User A's `uid` and `updatedAt`. When Friend B registers, User A receives stale cached results until the 300s TTL expires.

### 5. Exact Skill Matching Accuracy
- **Files:** `schema.prisma:132-152`, `user.js:155-171`, `matchingEngine.js:192-207`
- **Status:** **FAIL**
- **Evidence:** `Skill.name` is case-sensitive without normalization. `"DSA"` and `"dsa"` produce distinct rows and different UUIDs. `matchingEngine.js` joins strictly on `candidate."skillId" = requested."skillId"`, resulting in 0 matches across differing casings or synonyms (`Web Dev` vs `WEB`).

### 6. Search by Name / ID / Skill & Filter Synchronization
- **Files:** `FindMate.jsx:404-464`, `match.js:92-105`, `matchingEngine.js:59-61`, `user.js:251-285`
- **Status:** **FAIL**
- **Evidence:** `match.js` ignores `college`, `department`, `year`, `minRating`, and `sortBy` query params. `findMatches` hardcodes `sameCollegeOnly: true`. Searching by user ID is omitted from `GET /api/user/search`.

### 7. Match Request & Follow Flow Verification
- **Files:** `schema.prisma:249-264`, `match.js:124-264`, `user.js:426-432`, `FindMate.jsx:251-256`, `Home.jsx:31-41`
- **Status:** **FAIL**
- **Evidence:** `MatchRequest` lacks unique constraints (TOCTOU race on double-clicks). Follow endpoints are dummy no-op stubs with no DB schema. The entire match request UI is orphaned and bypassed in favor of direct chat creation.

### 8. Performance Under Multi-User Load & Live Typing
- **Files:** `matchingEngine.js:180-290`, `user.js:251-285`, `FindMate.jsx:665`
- **Status:** **PARTIAL**
- **Evidence:** Single CTE query has zero N+1. However, `findMatches` has no cold-start fallback. `GET /api/user/search` runs unanchored `ILIKE '%q%'` across 5 joined tables without GIN indexes or input debouncing.

---

## Section 3: Doubt Forum, Sarvam AI Hints, and Anti-Abuse Audit

### 9. Sarvam AI Study Hints Reality Check

#### 9.1 Implementation State
- **Files:**
  - `backend/src/routes/doubt.js` lines [93-124](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/doubt.js#L93-L124) (`attachSarvamStudyHint`), [190-238](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/doubt.js#L190-L238) (`POST /`), [155-177](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/doubt.js#L155-L177) (`formatDoubt`)
  - `backend/src/services/sarvamAI.js` lines [36-40](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/sarvamAI.js#L36-L40), [478-605](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/sarvamAI.js#L478-L605) (`generateStudyHint`)
  - `frontend-react/src/pages/DoubtForum.jsx` lines [93-111](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/DoubtForum.jsx#L93-L111) (`AIAssistHint`), [562](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/DoubtForum.jsx#L562), [928](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/DoubtForum.jsx#L928)
- **Status:** **PARTIAL**

#### 9.2 Line-by-Line Execution Trace (`POST /api/doubt`)
1. **Middleware Pipeline:**
   - In `backend/src/routes/doubt.js:180-191`:
     `POST /api/doubt` passes through `uploadDoubtImages.array('images')` -> `attachCompressedDoubtImages` -> `express-validator` -> `attachSarvamStudyHint`.
   - In `attachSarvamStudyHint` ([doubt.js:93-124](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/doubt.js#L93-L124)):
     If validation passes, it awaits `generateStudyHint({ title, content, tag })`.
2. **Database Storage & Response:**
   - Inside the transaction ([doubt.js:206-212](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/doubt.js#L206-L212)), the generated hint is persisted directly into the PostgreSQL `Doubt` record:
     `aiHint: req.aiAssist?.hint || null`
     `aiAssistProvider: req.aiAssist?.provider || 'sarvam-ai'`
     `aiAssistModel: req.aiAssist?.model || null`
     `aiAssistStatus: req.aiAssist?.status || 'EMPTY'`
   - Formatted in `formatDoubt` ([doubt.js:174-175](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/doubt.js#L174-L175)):
     `aiHint: d.aiHint || ''`, `aiAssistStatus: (d.aiAssistStatus || '').toLowerCase()`.
   - Returned in HTTP 201 response: `res.status(201).json({ success: true, data: formatted })`.
3. **UI Display:**
   - On the Doubt Forum, both in the expanded detail card ([DoubtForum.jsx:562](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/DoubtForum.jsx#L562)) and in the main feed list ([DoubtForum.jsx:928](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/DoubtForum.jsx#L928)), the hint renders via `<AIAssistHint hint={post.aiHint} status={post.aiAssistStatus} error={post.aiAssistError} />`.
   - Renders a clean bilingual hint banner with English + Hindi Devanagari text.

#### 9.3 Protocol & Configuration Verification
- **API Endpoint:** `https://api.sarvam.ai/v1/chat/completions` ([sarvamAI.js:37](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/sarvamAI.js#L37)). Standard OpenAI-compatible endpoint.
- **Auth Headers:**
  ```javascript
  // sarvamAI.js:548-550
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'api-subscription-key': API_KEY,
    'Content-Type': 'application/json',
  }
  ```
  Correctly supplies both standard Bearer auth and Sarvam's `api-subscription-key` header.
- **Model Name:** Defaults to `sarvam-30b` ([sarvamAI.js:480](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/sarvamAI.js#L480)), with fallback to `sarvam-105b` ([sarvamAI.js:578](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/sarvamAI.js#L578)).
- **Payload Schema:**
  Supplies `model`, `messages` (system role + user role), `temperature: 0.25`, `max_tokens: 220`, and `reasoning_effort: 'none'`.
- **Timeout & Retry:**
  `SARVAM_CHAT_TIMEOUT_MS: 10,000ms`, `attempts: 3` with exponential backoff (`SARVAM_RETRY_BASE_DELAY_MS: 250ms`, `maxDelayMs: 3000ms`). Does NOT retry permanent 4xx codes (`[400, 401, 403, 413]`).
- **Deterministic Fallback Engine:**
  If API key is unset or external Sarvam call fails/returns generic text, `createFallbackStudyHint` ([sarvamAI.js:86-390](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/sarvamAI.js#L86-L390)) reliably matches conceptual keywords (closure, recursion, pointers, trees, graphs, etc.) and generates high-quality bilingual study hints with zero failure downtime.

#### 9.4 Critical Latency & Mapping Defects Identified
1. **Synchronous Thread Blocking on Doubt Creation:**
   Because `attachSarvamStudyHint` runs directly inside the HTTP request lifecycle before response delivery, users posting a doubt face a **1.5s to 30s latency wall** if the external Sarvam API is slow or retrying.
2. **Missing `aiAssistError` Payload Mapping:**
   In `formatDoubt` ([doubt.js:155-177](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/doubt.js#L155-L177)), `aiAssistError` is never included in the formatted response object. Consequently, `post.aiAssistError` in `<AIAssistHint>` is permanently `undefined`.

---

### 10. Trending Topics Dynamic Calculation & Route Integration

#### 10.1 Implementation State
- **Files:**
  - `backend/src/routes/doubt.js` lines [312-340](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/doubt.js#L312-L340) (`GET /trending`)
  - `frontend-react/src/pages/Home.jsx` lines [145-170](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/Home.jsx#L145-L170)
  - `frontend-react/src/pages/DoubtForum.jsx` lines [690-720](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/DoubtForum.jsx#L690-L720)
- **Status:** **FAIL**

#### 10.2 Proof & Architectural Analysis
1. **Backend Dynamic Calculation: PASS**
   In `backend/src/routes/doubt.js:314-336`:
   ```javascript
   const trending = await prisma.doubt.groupBy({
     by: ['primaryTag'],
     where: { status: { not: 'DELETED' }, deletedAt: null },
     _count: { id: true },
     orderBy: { _count: { id: 'desc' } },
     take: 10,
   });
   ```
   Correctly aggregates active doubts grouped by `primaryTag` and orders by count descending.
2. **Dashboard Click Navigation: PASS**
   In `frontend-react/src/pages/Home.jsx:152-161`:
   ```jsx
   <button
     key={topic.tag}
     onClick={() => navigate(`/forum?tag=${encodeURIComponent(topic.tag)}`)}
     ...
   >
     <span className="font-label-lg">{topic.tag.replace('#', '')}</span>
     <span className="text-xs opacity-60">({topic.count})</span>
   </button>
   ```
   Renders the dynamically loaded tags with live counts and routes to `/forum?tag=%23DSA`.
3. **Broken Forum Filter Integration: FAIL**
   In `frontend-react/src/pages/DoubtForum.jsx:690-720`:
   ```javascript
   const [searchParams, setSearchParams] = useSearchParams();
   const [activeFilter, setActiveFilter] = useState('All Doubts');
   // ...
   const requestedDoubtId = searchParams.get('doubtId');
   ```
   `DoubtForum.jsx` parses `searchParams.get('doubtId')` for opening specific doubts from notifications, but **COMPLETELY IGNORES `searchParams.get('tag')`**!
   `activeFilter` defaults to `'All Doubts'`.
   When a user clicks a trending topic on the Dashboard, the browser navigates to `/forum?tag=%23DSA`, but the forum displays "All Doubts" unfiltered. The user's intended filter is silently dropped.

---

### 11. Doubt Forum Filters, Search & Pagination Controls

#### 11.1 Implementation State
- **Files:**
  - `frontend-react/src/pages/DoubtForum.jsx` lines [47](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/DoubtForum.jsx#L47), [697-699](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/DoubtForum.jsx#L697-L699), [773-780](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/DoubtForum.jsx#L773-L780)
  - `backend/src/routes/doubt.js` lines [272-309](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/doubt.js#L272-L309) (`GET /`)
- **Status:** **FAIL**

#### 11.2 Control-by-Control Audit

| Control Feature | UI Implementation (`DoubtForum.jsx`) | Backend API Support (`GET /api/doubt`) | Status | Evidence & Defect Analysis |
|---|---|---|---|---|
| **Tag/Subject Filters** | `FILTERS` horizontal pill bar | `where: { primaryTag: tag }` | **PARTIAL** | Static tag array matches DB; but clicking trending tag from Dashboard does not set filter. |
| **"My Doubts" Tab** | Client-side filter: `posts.filter(p => p.authorUid === uid)` | None (dispatches `fetchFilter = 'All Doubts'`) | **FAIL** | In `DoubtForum.jsx:697`, selecting "My Doubts" fetches page 1 of All Doubts (`limit: 20`) and filters client-side. If the user's doubt is #21 in the database, it disappears completely. |
| **Solved / Unsolved Filter** | None | None (`status` filtering not parsed) | **MISSING** | No UI toggle or tab for Open vs. Closed/Solved doubts. |
| **Search Bar (Text Search)**| None | None (no `q` or `search` query parameter) | **MISSING** | No input to search doubts by title, description, or author. |
| **Sort By (Newest/Votes)**  | None | None (`orderBy: { createdAt: 'desc' }` hardcoded) | **MISSING** | No control to sort by Most Upvoted or Most Answered. |
| **Pagination / Infinite Scroll** | None | `limit: 20`, `offset: 0` | **MISSING** | The forum hard-stops at the first 20 records. No pagination buttons, cursor, or infinite query loader. |

---

### 12. Answers, Voting & Verified Solutions (Destructive Test)

#### 12.1 Implementation State
- **Files:**
  - `backend/prisma/schema.prisma` lines [238-247](file:///Users/apple/Desktop/Mind-Craft/backend/prisma/schema.prisma#L238-L247) (`model DoubtVote`)
  - `backend/src/routes/doubt.js` lines [391-394](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/doubt.js#L391-L394), [451-498](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/doubt.js#L451-L498), [504-562](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/doubt.js#L504-L562)
  - `backend/src/services/tokenEconomy.js` lines [213-238](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/tokenEconomy.js#L213-L238) (`awardForumAnswer`)
  - `frontend-react/src/hooks/useDoubtForum.js` lines [27-57](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/hooks/useDoubtForum.js#L27-L57)
- **Status:** **PASS** (Backend Core) / **PARTIAL** (UI Optimistic Sync)

#### 12.2 Destructive Test Scenarios & Results
1. **Spam-Click Upvote/Downvote Attack:**
   - In `backend/prisma/schema.prisma:245`:
     ```prisma
     model DoubtVote {
       doubtId String @db.Uuid
       userId  String @db.Uuid
       @@id([doubtId, userId])
     }
     ```
   - In `backend/src/routes/doubt.js:466-492`:
     Votes run in an interactive `$transaction`. If existing vote is found, it is deleted and `upvoteCount` decrements; otherwise it is created and `upvoteCount` increments.
   - Result: **PASS**. Mathematically immune to duplicate count stacking or vote flooding. Upvotes do not emit Mind Tokens, preventing token farming.
2. **Self-Verification & Self-Answer Attack:**
   - In `backend/src/routes/doubt.js:391-394`:
     ```javascript
     if (doubt.authorId === user.id || doubt.author?.clerkUserId === req.user.clerkUserId) {
       return res.status(403).json({ success: false, error: 'Authors cannot answer their own doubts' });
     }
     ```
   - In `backend/src/routes/doubt.js:519-521`:
     ```javascript
     if (doubt.author.clerkUserId !== req.user.clerkUserId && doubt.authorId !== user.id) {
       return res.status(403).json({ success: false, error: 'Only the author can accept an answer' });
     }
     ```
   - Result: **PASS**. Authors cannot answer their own doubts. Only the doubt author can mark an answer accepted. Self-awarding is blocked.
3. **Idempotent Token Awards on Acceptance:**
   - In `backend/src/services/tokenEconomy.js:231-237`:
     `awardForumAnswer` uses idempotency key `forum_${doubtId}_${answerId}` backed by `TokenTransaction.idempotencyKey` `@unique`.
   - Result: **PASS**. If an author toggles or spams answer acceptance, the token economy detects `alreadyProcessed: true` and skips minting new Mind Tokens.
4. **Immediate UI Responsiveness:**
   - In `frontend-react/src/hooks/useDoubtForum.js:35-41`, `useToggleDoubtUpvote` invalidates `['doubts']` on success.
   - The UI does not implement optimistic updates (`onMutate`). The upvote count waits for a full network round-trip and query refetch (250–600ms latency). The button is not disabled during mutation, creating visual click jitter.

---

### 13. AI Hint Generation Abuse & Rate Limiting Resilience

#### 13.1 Implementation State
- **Files:**
  - `backend/server.js` lines [98-123](file:///Users/apple/Desktop/Mind-Craft/backend/server.js#L98-L123), [190](file:///Users/apple/Desktop/Mind-Craft/backend/server.js#L190)
  - `backend/src/routes/doubt.js` lines [180-191](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/doubt.js#L180-L191)
- **Status:** **FAIL**

#### 13.2 Proof & Vulnerability Analysis
1. **Missing Route-Level Rate Limiter:**
   - `strictLimiter` (30 requests/min at `backend/server.js:111-121`) is mounted exclusively on `/api/voice-search` (`server.js:190`).
   - `POST /api/doubt` is mounted without any specialized rate limiter. It is subject only to `globalLimiter` (1000 requests per 15 minutes).
2. **Quota Depletion Vulnerability:**
   - Each call to `POST /api/doubt` invokes `generateStudyHint`, which sends a live chat completion request to Sarvam AI (`sarvam-30b`).
   - If Sarvam returns an empty hint or generic template, `sarvamAI.js:576-587` automatically performs 1 to 2 retries (with `sarvam-105b` or a stricter prompt), generating up to **3 external API calls per posted doubt**.
   - A single test script or 5–10 active friends posting doubts can execute 100 doubt submissions in under 2 minutes, firing up to 300 requests to Sarvam AI. This instantly consumes API quota and triggers HTTP 429 upstream blocks.
3. **Remediation Specification:**
   Mount a dedicated `doubtCreationLimiter` (e.g. max 5 doubts per user per 10 minutes) on `POST /api/doubt`, or detach AI hint generation into an asynchronous background queue (bullmq / pg-boss) that processes hints decoupled from the HTTP response.

---

## Action Plan for Implementation (Phase 2, 3 & 4)

### Priority 1: Doubt Forum URL Filter & Search Bar
1. In `DoubtForum.jsx`, initialize `activeFilter` from `searchParams.get('tag')`:
   ```javascript
   const initialTag = searchParams.get('tag');
   const [activeFilter, setActiveFilter] = useState(initialTag ? decodeURIComponent(initialTag) : 'All Doubts');
   ```
2. Add a `useEffect` on `searchParams` so clicking a trending topic while already on `/forum` updates the selected filter chip immediately.
3. Add a search input bar on `DoubtForum.jsx` with debounced text search, and update `GET /api/doubt` in `doubt.js` to accept `q` and filter by `title` and `content`.
4. Replace client-side "My Doubts" filtering with server-side query param `authorUid` or `onlyMine=true`.

### Priority 2: Asynchronous AI Hint Generation & Quota Protection
1. Decouple `generateStudyHint` from the synchronous `POST /api/doubt` response lifecycle. Return the created doubt immediately with `aiAssistStatus: 'pending'` and update the hint asynchronously via background worker or database update.
2. Add a rate limiter to `POST /api/doubt` in `server.js` (e.g., 5 doubts / 10 minutes per IP/User).
3. Include `aiAssistError: d.aiAssistError || ''` in `formatDoubt` in `doubt.js` so error states render cleanly in the UI.

### Priority 3: Optimistic UI Updates for Voting
1. Implement TanStack Query `onMutate` in `useToggleDoubtUpvote` in `useDoubtForum.js`:
   Immediately toggle `hasUpvoted` and update `upvotes` count in query cache, rolling back on network failure.
2. Disable the upvote button while the mutation is in flight to eliminate click jitter.

---

## Section 4: Real-Time Messaging, Socket.io Auth, Render Persistence & Notifications Audit

### 14. CRITICAL: Render Free-Tier Chat Message Persistence Bomb & Fallback Failure

#### 14.1 Implementation State & Scope
- **Files:**
  - `backend/server.js` lines [216-229](file:///Users/apple/Desktop/Mind-Craft/backend/server.js#L216-L229)
  - `backend/src/config/socket.js` lines [158-262](file:///Users/apple/Desktop/Mind-Craft/backend/src/config/socket.js#L158-L262)
  - `backend/src/queues/chatPersistenceQueue.js` lines [1-29](file:///Users/apple/Desktop/Mind-Craft/backend/src/queues/chatPersistenceQueue.js#L1-L29)
  - `backend/src/workers/chatPersistenceWorker.js` lines [1-62](file:///Users/apple/Desktop/Mind-Craft/backend/src/workers/chatPersistenceWorker.js#L1-L62)
  - `backend/src/services/chatPersistenceService.js` lines [13-42](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/chatPersistenceService.js#L13-L42)
  - `backend/src/routes/chat.js` lines [35-56](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/chat.js#L35-L56), [78-146](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/chat.js#L78-L146)
- **Status:** **FAIL**

#### 14.2 Proof: The Render Free-Tier Execution Model
On Render's free tier, applications run strictly as a single Web Service dyno executing:
`pnpm start` -> `node server.js` (per `backend/package.json:7`).
There is no secondary background worker service running `pnpm worker:chat` (`node src/workers/chatPersistenceWorker.js`).

In `backend/server.js:216-229`:
```javascript
// 1b. In-process BullMQ worker fallback for single-dyno hosting
const shouldRunInProcessWorker =
  process.env.RUN_IN_PROCESS_WORKERS === 'true' ||
  (process.env.NODE_ENV === 'production' && process.env.STANDALONE_WORKER !== 'true' && process.env.RUN_IN_PROCESS_WORKERS !== 'false') ||
  process.env.EMBEDDED_WORKERS === 'true';

if (shouldRunInProcessWorker) {
  try {
    startChatPersistenceWorker();
    console.log('   ✔ In-process chat persistence worker started');
  } catch (workerErr) {
    console.warn('   ⚠️ Failed to start in-process chat persistence worker:', workerErr.message);
  }
}
```

#### 14.3 The Critical Persistence Flaw & Complete Message Vanishing Lifecycle
When Friend A sends a text to Friend B over Socket.io, the flow executes inside `backend/src/config/socket.js:158-221`:
```javascript
socket.on('chat:message', async (payload = {}, acknowledge = () => {}) => {
  ...
  const messageId = randomUUID();
  const trimmedText = text.trim();
  const nowIso = new Date().toISOString();

  await enqueueChatMessage({
    messageId,
    threadId,
    senderId: verifiedUserId,
    clientMessageId,
    text: trimmedText,
    createdAt: nowIso,
  });

  const message = {
    messageId,
    clientMessageId,
    threadId,
    senderId: verifiedUserId,
    senderUid: socket.user?.clerkUserId,
    senderName: socket.user?.name,
    text: trimmedText,
    status: 'queued',
    createdAt: nowIso,
  };

  io.to(threadRoom(threadId)).emit('chat:message', message);
  socket.emit('chat:message:received', { messageId, clientMessageId, threadId });
```

1. **Zero Direct Prisma Fallback:**
   Notice what `socket.on('chat:message')` does: it calls `await enqueueChatMessage(...)` which pushes a job into BullMQ (`chat-persistence` queue in Redis).
   If `enqueueChatMessage` fails (Redis down, connection timed out, or Upstash free limit exceeded), the `catch` block at line 256 catches the error and emits `socket.emit('error')`. **There is zero fallback to `persistMessage()` or direct Prisma write.**
2. **Silent Dev / Staging Failure:**
   In development (`NODE_ENV` not set to `'production'`), `shouldRunInProcessWorker` evaluates to `false` unless `RUN_IN_PROCESS_WORKERS=true` is explicitly set in `.env`. Developers testing locally without running `pnpm worker:chat` in a second terminal have all their messages queued in Redis without any worker consuming them.
3. **The Page Refresh Vanishing Bomb:**
   Because `io.to(threadRoom(threadId)).emit('chat:message', message)` fires immediately at line 219, Friend A and Friend B see the message pop up in their chat windows in real time. Both users believe the message is saved.
   However, if the worker failed to start, was killed, or stalled due to Redis TLS/connection drops on Render free tier:
   - The job sits permanently in the Redis BullMQ queue.
   - Postgres `ChatMessage` table receives **zero rows**.
   - As soon as either friend refreshes the page or navigates away and returns, `frontend-react/src/pages/Chat.jsx:252` calls `GET /api/chat/:matchId/history`.
   - In `backend/src/routes/chat.js:35-45`, `prisma.chatMessage.findMany({ where: { threadId, deletedAt: null } })` is executed.
   - **Postgres returns an empty array `[]`. 100% of all chat messages vanish into thin air!**
4. **Architectural Inconsistency:**
   In contrast, HTTP REST route `POST /api/chat/:matchId/send` (`backend/src/routes/chat.js:90`) executes `await persistMessage(...)` directly against Prisma! Only Socket.io relies exclusively on BullMQ queueing without an inline DB write fallback.

---

### 15. Socket.io Authentication, Clerk JWT Token Lifespan & Room Topology

#### 15.1 Implementation State & Scope
- **Files:**
  - `backend/src/middleware/socketAuth.js` lines [1-42](file:///Users/apple/Desktop/Mind-Craft/backend/src/middleware/socketAuth.js#L1-L42)
  - `backend/src/config/socket.js` lines [87-100](file:///Users/apple/Desktop/Mind-Craft/backend/src/config/socket.js#L87-L100)
  - `frontend-react/src/context/NotificationContext.jsx` lines [195-217](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/context/NotificationContext.jsx#L195-L217)
- **Status:** **FAIL**

#### 15.2 Handshake Auth vs Token Expiration
In `backend/src/middleware/socketAuth.js:4-39`:
```javascript
async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      const error = new Error('Authentication token is required');
      error.data = { code: 'AUTH_REQUIRED' };
      return next(error);
    }

    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
...
  } catch (_error) {
    const error = new Error('Invalid authentication token');
    error.data = { code: 'AUTH_INVALID' };
    return next(error);
  }
}
```
In `frontend-react/src/context/NotificationContext.jsx:195-208`:
```javascript
const socket = io(API_BASE_URL, {
  path: '/socket.io',
  auth: async (cb) => {
    try {
      const token = await getTokenRef.current?.();
      cb({ token });
    } catch {
      cb({});
    }
  },
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
});
```

#### 15.3 The Unhandled `connect_error` Permanent Disconnect Bug
1. **Clerk Token 60-Second Lifespan:**
   Clerk short-lived session JWTs expire every 60 seconds. While an active WebSocket TCP connection remains open, the initial handshake verification persists.
2. **Connection Drop & Reconnect Behavior:**
   When the socket encounters a transient network glitch, server restart (Render free tier recycling), or mobile background pause after 60 seconds, Socket.io attempts to reconnect.
   The client invokes `auth(cb)`, and `getTokenRef.current?.()` retrieves a fresh token from Clerk.
3. **The Lethal Bug:**
   If Clerk token generation is delayed, fails, or if `verifyToken` rejects the handshake with `AUTH_INVALID` (`socketAuth.js:38`), Socket.io client triggers a `connect_error` event.
   In `frontend-react/src/context/NotificationContext.jsx`, **there is ZERO `socket.on('connect_error')` handler**.
   By Socket.io client design, when connection middleware rejects a connection on the server (`next(err)`), Socket.io **permanently stops automatic reconnection attempts**.
   Because there is no `connect_error` listener to catch `AUTH_INVALID`, refresh the Clerk token, and call `socket.connect()`, the client enters a permanently disconnected state. The user remains stranded with no real-time messages, no presence, and no incoming notifications until a hard browser refresh.

#### 15.4 Room Topology Verification
In `backend/src/config/socket.js:90-100`:
```javascript
const user = socket.user;
const userId = socket.userId || user?.id;
socket.userId = userId;

if (userId) {
  socket.join(userRoom(userId));           // e.g. "user:9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
}
if (user?.clerkUserId) {
  socket.join(userRoom(user.clerkUserId)); // e.g. "user:user_2t1X..."
}
```
- **Finding:** Joining both `user:${userId}` (Prisma UUID) and `user:${clerkUserId}` is architecturally sound and prevents room identifier mismatch when notifications are emitted to either ID type.

---

### 16. Real-Time Chat Delivery & Parity Matrix (Sender vs Receiver)

#### 16.1 Implementation State & Scope
- **Files:**
  - `backend/src/config/socket.js` lines [101-323](file:///Users/apple/Desktop/Mind-Craft/backend/src/config/socket.js#L101-L323)
  - `backend/src/routes/chat.js` lines [171-231](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/chat.js#L171-L231)
  - `frontend-react/src/context/NotificationContext.jsx` lines [212-304](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/context/NotificationContext.jsx#L212-L304), [376-464](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/context/NotificationContext.jsx#L376-L464)
  - `frontend-react/src/pages/Chat.jsx` lines [275-343](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/Chat.jsx#L275-L343), [383-422](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/Chat.jsx#L383-L422), [684-750](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/Chat.jsx#L684-L750)
- **Status:** **FAIL**

#### 16.2 Socket.io Event Parity Matrix

| Event Name | Backend Emission (`socket.js` / `chat.js`) | Frontend Listener (`NotificationContext.jsx`) | UI Action (`Chat.jsx`) | Parity Status | Critical Defect |
|---|---|---|---|---|---|
| `thread:join` | Listened: line 101 | Emitted: line 215, 379 | N/A | **PASS** | Rooms joined properly on both sides. |
| `thread:leave` | Listened: line 149 | Emitted: line 384 | N/A | **PASS** | Socket leaves room cleanly on unmount. |
| `chat:message` | Emitted: line 219 (`io.to`) | Listened: line 219 | Handled: line 304 | **FAIL** | Drops `clientMessageId`; sends Prisma UUID as `senderUid`; duplicates sent bubbles. |
| `chat:typing` | Emitted: line 273 (`socket.to`) | Listened: line 285 | Handled: line 285 | **PARTIAL** | Compares Prisma UUID against Clerk User ID in UI line 286. |
| `chat:read` | Emitted: line 292 (`io.to`) | Listened: line 292 | Handled: line 277 | **PASS** | Marks messages read and updates tick icons. |
| `presence:changed` | Emitted: line 134, 312 | Listened: line 299 | Unhandled: line 276-340 | **FAIL** | Dispatched to listener, but `Chat.jsx` has no handler for `type === 'presence'`. |
| `message_edited` | Emitted: `chat.js:195` | **NOT LISTENED** | Handled: line 294 | **FAIL** | Backend emits event to room, but `NotificationContext` drops it. Real-time edits dead. |
| `message_deleted`| Emitted: `chat.js:224` | **NOT LISTENED** | Handled: line 299 | **FAIL** | Backend emits event to room, but `NotificationContext` drops it. Real-time deletes dead. |

#### 16.3 The `senderUid` Prisma UUID Mutation & Double-Message Disaster
This is the single most severe visual and logical bug in the chat system. Tracing step-by-step:

1. **Optimistic Message Creation (`Chat.jsx:399-411`):**
   ```javascript
   const localId = Date.now().toString() + Math.random().toString(36).substring(7);
   const optimisticMsg = {
     id: localId,
     messageId: localId,
     localId: localId,
     senderId: currentUser.uid,   // Clerk ID (e.g. "user_2xyz...")
     senderUid: currentUser.uid,  // Clerk ID (e.g. "user_2xyz...")
     text: text,
     timestamp: Date.now(),
     status: 'sending'
   };
   setMessages(prev => [...prev, optimisticMsg]);
   ```
2. **Socket Transmission (`NotificationContext.jsx:389-395`):**
   `socket.emit('chat:message', { threadId: matchId, text, clientMessageId: localId })`
3. **Backend Broadcast (`backend/src/config/socket.js:207-219`):**
   Backend constructs:
   ```javascript
   const message = {
     messageId,
     clientMessageId,            // The localId sent from frontend
     threadId,
     senderId: verifiedUserId,   // Prisma UUID!
     senderUid: socket.user?.clerkUserId, // Clerk User ID!
     senderName: socket.user?.name,
     text: trimmedText,
     status: 'queued',
     createdAt: nowIso,
   };
   io.to(threadRoom(threadId)).emit('chat:message', message);
   ```
4. **The Client Poisoning (`NotificationContext.jsx:226-235`):**
   ```javascript
   socket.on('chat:message', (message) => {
     ...
     const listener = chatListeners.current.get(matchId);
     if (listener) {
       listener({
         type: 'message',
         matchId,
         messageId: message.messageId,
         senderUid: message.senderId, // ⚠️ FATAL BUG: Assumed senderId was senderUid!
         senderName: message.senderName,
         text: message.text,
         timestamp: new Date(message.createdAt).getTime(),
       });
       // ⚠️ FATAL BUG: message.clientMessageId / localId is COMPLETELY OMITTED!
     }
   ```
5. **The Devastating UI Manifestation in `Chat.jsx`:**
   In `Chat.jsx:318-333`:
   - `incoming.localId` is `undefined`. Optimistic message reconciliation `m.localId === incoming.localId` **never matches**.
   - `prev.find(m => m.id === incoming.id)` does not match because `optimisticMsg.id` is `localId` while `incoming.id` is `messageId` (UUID).
   - `incoming` is appended as a **second message**.
   In `Chat.jsx:685`:
   - `const isMine = msg.senderId === currentUser.uid || msg.senderUid === currentUser.uid;`
   - For `incoming`: `msg.senderId` is `undefined`. `msg.senderUid` is the Prisma UUID (`message.senderId`).
   - `currentUser.uid` is the Clerk User ID (`user_2...`).
   - `Prisma UUID !== Clerk User ID` -> **`isMine` evaluates to `false`!**
   
   **Visual Result on Sender's Screen:**
   1. The original optimistic message stays on the right stuck forever with a clock icon (`status: 'sending'`).
   2. The server-broadcasted copy of the sender's own message is rendered on the left in gray/white styling, as if it was sent by their study partner!

---

### 17. Full Notification System Audit Across All App Triggers

#### 17.1 Implementation State & Scope
- **Files:**
  - `backend/src/routes/match.js` lines [181-192](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/match.js#L181-L192), [250-259](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/match.js#L250-L259), [266-294](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/match.js#L266-L294)
  - `backend/src/routes/session.js` lines [164-173](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/session.js#L164-L173), [290-299](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/session.js#L290-L299), [335-346](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/session.js#L335-L346), [353-388](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/session.js#L353-L388), [455-461](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/session.js#L455-L461), [501-511](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/session.js#L501-L511)
  - `backend/src/routes/doubt.js` lines [241-263](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/doubt.js#L241-L263), [418-429](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/doubt.js#L418-L429), [504-562](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/doubt.js#L504-L562)
  - `frontend-react/src/context/NotificationContext.jsx` lines [305-369](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/context/NotificationContext.jsx#L305-L369)
  - `frontend-react/src/pages/Notifications.jsx` lines [39-189](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/Notifications.jsx#L39-L189), [196-236](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/Notifications.jsx#L196-L236)
- **Status:** **FAIL**

#### 17.2 Exhaustive Trigger Verification Matrix

| Trigger Event | Backend Route / Emission Proof | Real-Time Socket Payload | Frontend Context Handler | Route Destination | Audit Status |
|---|---|---|---|---|---|
| **New Chat Message** | `socket.js:245` & `chat.js:121` | `global_new_message` | `NotificationContext.jsx:328` | `/chat/:matchId` | **PASS** |
| **New Match Request** | `match.js:182` | `global_notification` (`match_request`) | `NotificationContext.jsx:305` | Defaults to `/sessions` ❌ | **FAIL** |
| **Match Accepted** | `match.js:250` | `global_notification` (`match_accepted`)| `NotificationContext.jsx:305` | Defaults to `/sessions` ❌ | **FAIL** |
| **Match Declined** | `match.js:266-294` | **NONE (Zero socket emission)** | N/A | None | **FAIL** |
| **Session Booked** | `session.js:164` | `global_notification` (`session_booked`)| `NotificationContext.jsx:305` | `/sessions` | **PASS** |
| **Session Accepted** | `session.js:290` | `global_notification` (`session_accepted`)| `NotificationContext.jsx:305` | `/sessions` | **PASS** |
| **Session Rejected** | `session.js:336` | `global_notification` (`session_rejected`)| `NotificationContext.jsx:305` | `/sessions` | **PASS** |
| **Session Cancelled**| `session.js:502` | `global_notification` (`session_cancelled`)| `NotificationContext.jsx:305` | `/sessions` | **PASS** |
| **Session Rescheduled**| None | **Feature / Route Missing** | N/A | None | **FAIL** |
| **Session Completed**| `session.js:353-388` | `sessionRouter.js:39` sends `rate_session` | Learner gets review notif; teacher gets zero | `/profile` | **PARTIAL** |
| **Doubt Answered** | `doubt.js:418` | `global_forum_doubt` (`new_answer`) | Treated as `NEW_DOUBT` ❌ | `/forum?doubtId=...` | **FAIL** |
| **Doubt Answer Verified**| `doubt.js:504-562` | **NONE (Zero socket emission)** | N/A | None | **FAIL** |

#### 17.3 The Offline Match Request Invisibility Bug
In `frontend-react/src/pages/Notifications.jsx:39-189`, `buildNotifications()` builds fallback REST notifications from:
1. `sessionService.getSessions(..., 'upcoming')`
2. `sessionService.getSessions(..., 'pending')`
3. `gamificationService.getStreak(...)`
4. `doubtService.getAllDoubts('All Doubts')`
5. `chatService.getThreads(...)`

**Match Requests are completely omitted!**
The endpoint `GET /api/match/requests/:uid` is never called.
If User A sends a match request to User B while User B is offline:
- User B never receives the ephemeral socket event.
- User B opens the Notifications tab.
- **The match request is nowhere to be found.** It only exists if User B happens to navigate to the Find Mate page.

#### 17.4 Broken Navigation Routes on Match Notifications
In `backend/src/routes/match.js:182-191`:
```javascript
broadcastToGlobal(recipient.clerkUserId, {
  type: 'global_notification',
  subType: 'match_request',
  data: {
    message: `${requester.name} requested to study with you for ${sharedSkill}!`,
    requestId: matchReq.id,
    requesterName: requester.name,
  },
  timestamp: Date.now(),
});
```
Notice `data.route` is not supplied.
In `NotificationContext.jsx:315`:
`route: data.data?.route || '/sessions'`
When the user clicks the toast or notification item for a match request or match accepted event, **they are routed to `/sessions` instead of `/notifications` or `/chat/:matchId`!**

#### 17.5 Doubt Forum Reply Notification Mutation
In `backend/src/routes/doubt.js:418-429`:
When someone answers an author's doubt, backend emits `type: 'global_forum_doubt'`, `subType: 'new_answer'`.
In `NotificationContext.jsx:341-368`:
```javascript
socket.on('global_forum_doubt', (data) => {
  const doubt = data.data || {};
  if (!doubt.doubtId || doubt.authorUid === currentUser.uid) return;
  ...
  pushNotification({
    id: `forum-${doubt.doubtId}`,
    category: CATEGORIES.FORUM,
    type: 'NEW_DOUBT',
    title: 'New Doubt',
    message: `${doubt.authorName || 'Someone'} asked: "${doubt.title || 'a new doubt'}"`,
    timestamp: Date.now(),
    read: false,
    route: `/forum?doubtId=${doubt.doubtId}`,
    doubtId: doubt.doubtId,
  });
});
```
`NotificationContext.jsx` ignores `subType === 'new_answer'`.
It reads `doubt.authorName` and `doubt.title` (which the backend did not even send in `data`), resulting in the author receiving a toast:
`Someone asked: "a new doubt"` with title `New Doubt`! The author is never informed that an answer was posted to their doubt.

#### 17.6 Unread Badge Lifecycle & `localStorage` Unbounded Growth
1. In `Notifications.jsx:196-209`, mounting the page immediately calls `clearUnreadNotifications()`. This clears the red pulse badge on the bell icon in `Layout.jsx:84`.
2. However, the list items on `Notifications.jsx` themselves derive their read state from `readIds` (`localStorage.getItem('mindcraft_read_notifs')`). Because mounting the page does not add the REST notification IDs to `readIds`, the items on the page still display unread visual indicators until the user manually clicks "Mark all as read".
3. `localStorage.getItem('mindcraft_read_notifs')` has no expiration, max limit, or eviction strategy. Over weeks of usage, this JSON array grows indefinitely in browser storage.

---

### 18. Destructive Concurrency & Multi-Tab Spam Analysis

#### 18.1 Implementation State & Scope
- **Files:**
  - `backend/src/config/socket.js` lines [158-262](file:///Users/apple/Desktop/Mind-Craft/backend/src/config/socket.js#L158-L262), [308-318](file:///Users/apple/Desktop/Mind-Craft/backend/src/config/socket.js#L308-L318)
  - `backend/src/workers/chatPersistenceWorker.js` lines [13-20](file:///Users/apple/Desktop/Mind-Craft/backend/src/workers/chatPersistenceWorker.js#L13-L20)
  - `backend/src/services/chatPersistenceService.js` lines [13-42](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/chatPersistenceService.js#L13-L42)
  - `frontend-react/src/pages/Chat.jsx` lines [336-339](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/Chat.jsx#L336-L339)
- **Status:** **FAIL**

#### 18.2 Concurrency Stress: 30 Messages in 5 Seconds
1. **Zero Socket.io Rate Limiting:**
   `backend/server.js:123` applies `globalLimiter` only to Express HTTP requests. There is no rate limiter (e.g. `rate-limiter-flexible`) on `socket.on('chat:message')`.
2. **Database Query Stampede:**
   For every message sent, `socket.on('chat:message')` immediately executes two synchronous queries:
   - Line 179: `prisma.chatParticipant.findUnique(...)`
   - Line 224: `prisma.chatThread.findUnique(...)`
   30 messages in 5 seconds fire **60 un-batched database queries** against Postgres from the socket thread alone.
3. **BullMQ Row-Lock Contention on `ChatThread`:**
   In `backend/src/workers/chatPersistenceWorker.js:18`, concurrency is set to 10 (`concurrency: 10`).
   All 10 worker threads simultaneously execute `persistMessage`:
   ```javascript
   await tx.chatThread.update({
     where: { id: threadId },
     data: {
       lastMessage: message.text,
       lastMessageAt: message.createdAt,
       lastSenderId: senderId,
     },
   });
   ```
   In PostgreSQL, 10 concurrent transactions executing `UPDATE chat_threads WHERE id = $1` contend for the exact same row lock (`ExclusiveLock`). Under high message volume, this causes serialized deadlock aborts and race conditions where an older message's worker finishes last, overwriting `lastMessage` with outdated text!
4. **Client-Side Mark-Read Storm:**
   In `frontend-react/src/pages/Chat.jsx:336-338`:
   ```javascript
   if (incoming.senderUid !== currentUser.uid && incoming.senderId !== currentUser.uid) {
     setTimeout(() => globalMarkRead(matchId), 150);
   }
   ```
   Receiving 30 messages in 5 seconds fires 30 staggered timeouts, dispatching 30 `socket.emit('chat:read')` events AND 30 `PATCH /api/chat/:matchId/read` HTTP requests in under 5 seconds!

#### 18.3 Multi-Tab Concurrency Collisions
1. **Duplicate Outside-Thread Notifications:**
   When User A has two tabs open (Tab 1 in `/chat/:matchId` and Tab 2 in `/find`), both socket connections are registered in room `user:userId`.
   When Friend B sends a message:
   - Tab 1 receives `chat:message` in room `thread:matchId`.
   - Backend also emits `global_new_message` to room `user:userId` (`socket.js:245`).
   - Both Tab 1 and Tab 2 receive `global_new_message`!
   - Result: Tab 1 (which is already inside the active chat) pops up a disruptive toast notification and creates an unread chat notification for the conversation the user is currently looking at!
2. **Presence Flapping on Tab Close:**
   In `backend/src/config/socket.js:308-318`:
   ```javascript
   socket.on('disconnecting', () => {
     const activeUserId = socket.userId || socket.user?.id;
     for (const room of socket.rooms) {
       if (room.startsWith('thread:')) {
         socket.to(room).emit('presence:changed', {
           userId: activeUserId,
           status: 'offline',
         });
       }
     }
   });
   ```
   If a user has 2 tabs open on the same chat thread and closes Tab 1, Tab 1's socket disconnects and immediately emits `presence:changed` with `status: 'offline'`. The study partner's UI shows the user as offline, even though Tab 2 is actively open and connected!

---

## Action Plan for Real-Time & Notification Systems (Phase 4 Remediation)

### Priority 1: Instant Chat Fallback & Bulletproof Persistence
1. In `backend/src/config/socket.js:198-206`, wrap `enqueueChatMessage` with a direct Prisma fallback:
   ```javascript
   try {
     await enqueueChatMessage({ messageId, threadId, senderId: verifiedUserId, clientMessageId, text: trimmedText, createdAt: nowIso });
   } catch (queueErr) {
     console.warn('Queue unavailable, persisting message directly to Prisma:', queueErr.message);
     await persistMessage({ threadId, senderId: verifiedUserId, clientMessageId, text: trimmedText, createdAt: nowIso });
   }
   ```
2. In `backend/server.js:217`, change `shouldRunInProcessWorker` so it defaults to `true` unless `STANDALONE_WORKER === 'true'`, ensuring in-process workers run in development and staging without requiring extra commands.

### Priority 2: Socket Event Parity & Message Reconciliation
1. In `frontend-react/src/context/NotificationContext.jsx:226-235`, pass the authentic Clerk user ID and preserve `clientMessageId`:
   ```javascript
   listener({
     type: 'message',
     matchId,
     messageId: message.messageId,
     localId: message.clientMessageId,
     senderUid: message.senderUid, // Use Clerk user ID, NOT message.senderId (UUID)
     senderId: message.senderId,
     senderName: message.senderName,
     text: message.text,
     timestamp: new Date(message.createdAt).getTime(),
   });
   ```
2. Add listeners for `message_edited` and `message_deleted` in `NotificationContext.jsx:298`:
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
3. Add a `connect_error` recovery handler in `NotificationContext.jsx` to refresh the token and re-trigger `socket.connect()`.

### Priority 3: Complete Notification Coverage & Offline Parity
1. In `frontend-react/src/pages/Notifications.jsx:39`, add `matchService.getMatchRequests(currentUser.uid)` to `buildNotifications()` so offline match requests appear in the notifications inbox.
2. In `backend/src/routes/match.js:182` and `250`, include `route: '/notifications'` and `route: `/chat/${thread.id}`` in the `data` payload of `broadcastToGlobal`.
3. In `backend/src/routes/doubt.js:547`, add `broadcastToGlobal(answer.author.clerkUserId, { type: 'global_forum_doubt', subType: 'answer_accepted', ... })` so authors are notified when their answer is accepted.
4. In `frontend-react/src/context/NotificationContext.jsx:341`, inspect `data.subType` and branch between `new_doubt`, `new_answer`, and `answer_accepted` with proper titles and messages.

### Priority 4: Spam & Concurrency Protection
1. Implement a token-bucket rate limiter on `socket.on('chat:message')` (e.g. max 5 messages per 2 seconds per socket).
2. Debounce `globalMarkRead` in `Chat.jsx` so rapid bursts of incoming messages do not fire 30 HTTP requests.
3. Track active socket counts per user in Redis/memory so multi-tab users do not emit `offline` presence until their last socket disconnects.

---

## Section 5: Tutoring Sessions, Google Calendar, Ratings & Gamification Audit

### 19. CRITICAL — Google Calendar & Online Meeting Link (Google Meet) Integration

#### 19.1 Implementation State & Scope
- **Files:**
  - `backend/src/routes/session.js` lines [57-63](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/session.js#L57-L63), [276-288](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/session.js#L276-L288), [522-550](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/session.js#L522-L550), [552-595](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/session.js#L552-L595)
  - `backend/src/services/calendarExport.js` lines [14-182](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/calendarExport.js#L14-L182), [210-252](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/calendarExport.js#L210-L252)
  - `frontend-react/src/services/sessionService.js` lines [82-95](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/services/sessionService.js#L82-L95)
  - `frontend-react/src/pages/SessionsDetail.jsx` lines [21-65](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/SessionsDetail.jsx#L21-L65)
  - `frontend-react/src/pages/Notifications.jsx` lines [292-327](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/Notifications.jsx#L292-L327)
  - `frontend-react/src/pages/Chat.jsx` lines [651-663](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/Chat.jsx#L651-L663)
- **Status:** **PARTIAL** (Google Calendar Web Template Deep-Link & `.ics` PASS; Direct Google Calendar API Insert & Google Meet Generation **FAIL / DEAD CODE**)

#### 19.2 The Google OAuth Callback Disconnect & Dead Code Breakdown
When a tutor accepts a tutoring session in `frontend-react/src/pages/Notifications.jsx:292-327` (`handleAcceptSession`), the client attempts to acquire Google OAuth tokens:
```javascript
// frontend-react/src/pages/Notifications.jsx:297-314
let googleTokens = null;
try {
  const authRes = await sessionService.getGoogleAuthUrl();
  if (authRes.data?.authUrl) {
    googleTokens = await new Promise((resolve) => {
      window.open(authRes.data.authUrl, 'googleAuth', 'width=500,height=600');
      const handleMessage = (event) => {
        if (event.data?.googleTokens) {
          window.removeEventListener('message', handleMessage);
          resolve(event.data.googleTokens);
        }
      };
      window.addEventListener('message', handleMessage);
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        resolve(null);
      }, 120000);
    });
  }
} catch { ... }
```
1. **The Missing OAuth Callback Route:**
   - `authRes.data.authUrl` is generated by `backend/src/services/calendarExport.js:27-35`:
     ```javascript
     function getAuthUrl(state = '') {
       const oAuth2Client = createOAuth2Client();
       return oAuth2Client.generateAuthUrl({
         access_type: 'offline',
         scope: ['https://www.googleapis.com/auth/calendar.events'],
         state,
         prompt: 'consent',
       });
     }
     ```
   - `createOAuth2Client()` redirects to `process.env.GOOGLE_REDIRECT_URI`.
   - **Crucial Finding:** Across both `backend/` and `frontend-react/`, **there is NO Google OAuth callback route** (e.g. `/api/session/auth/google/callback`).
   - `exchangeCodeForTokens(code)` (`calendarExport.js:42`) is exported, but is **never invoked anywhere in the application**.
   - When the user consents on Google's consent screen, Google redirects back to `GOOGLE_REDIRECT_URI` with `?code=...`. The popup window encounters an unhandled route or HTTP 404.
   - The popup never executes `window.opener.postMessage({ googleTokens })`.
   - The 120-second timeout in `Notifications.jsx` inevitably expires, resolving `googleTokens` to `null`.
2. **Direct Calendar Insertion is Completely Dead Code:**
   In `backend/src/routes/session.js:278-288`:
   ```javascript
   if (googleTokens) {
     try {
       const calRes = await exportSessionToCalendar(
         { ...session, scheduledAt: new Date(session.scheduledFor).getTime() },
         googleTokens,
         session.learner.name,
         session.learner.email,
       );
       if (calRes?.meetLink) meetLink = calRes.meetLink;
     } catch (_calErr) {}
   }
   ```
   Because `googleTokens` is always `null`, `exportSessionToCalendar` in `calendarExport.js:59-182` is **dead code**. The Google Calendar API is never contacted, and direct automated calendar insertion never occurs.

#### 19.3 Google Meet vs Jitsi Meeting Link Realities
- When a session is booked or accepted without Google OAuth tokens:
  In `backend/src/routes/session.js:41` (`normalizeSession`) and `session.js:276`:
  ```javascript
  meetLink: s.mode === 'ONLINE' ? `https://meet.jit.si/MindCraft-${s.id}` : ''
  ```
- **Real Meeting Link Finding:** The platform does NOT generate Google Meet links (`meet.google.com/xxx-yyyy-zzz`). It generates standard deterministic Jitsi Meet room links (`https://meet.jit.si/MindCraft-${sessionId}`).
- Jitsi links are fully functional, open instantly without login, support audio/video/screen-sharing, and have no credential dependencies.

#### 19.4 The "Add to Calendar" Template Deep-Link (Working Path)
- In `frontend-react/src/pages/SessionsDetail.jsx:21-65` (`AddToCalendarBtn`) and `frontend-react/src/pages/Chat.jsx:651-663`:
  When a user clicks "Add to Calendar", it invokes `sessionService.exportToCalendar(sessionId)` (`POST /api/session/:sessionId/export-calendar`).
- In `backend/src/routes/session.js:578-591`:
  ```javascript
  const meetLink = `https://meet.jit.si/MindCraft-${sessionId}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `MindCraft Session: ${session.title || 'Tutoring'}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `MindCraft P2P Tutoring Session with ${peer.name}\nSkill: ${session.title || 'General'}\nMode: ${session.mode}\nJoin: ${meetLink}`,
    location: meetLink,
  });
  if (peer.email) params.append('add', peer.email);

  res.json({
    success: true,
    data: { htmlLink: `https://calendar.google.com/calendar/render?${params.toString()}` },
  });
  ```
- **Result:** **PASS**. The backend constructs a standard Google Calendar Web URL. Clicking the button opens Google Calendar in a new browser tab with pre-filled title, dates, guest email, and Jitsi join link. The user clicks "Save" and the event is added to their calendar.
- Furthermore, `GET /api/session/:sessionId/ics` (`session.js:522-550`) generates a valid RFC 5545 `.ics` file for Outlook, Apple Calendar, and mobile devices.

#### 19.5 Clean Architectural Comparison & Solution Recommendation

| Metric | Option A: Clerk Google OAuth with `calendar.events` Scope | Option B: Zero-Failure Deep-Link (`action=TEMPLATE`) + Jitsi Fallback |
|---|---|---|
| **Mechanism** | Backend calls `calendar.events.insert` via Clerk-provided Google OAuth Access Token (`/v1/users/{user_id}/oauth_access_tokens/oauth_google`). | Browser navigates to `https://calendar.google.com/calendar/render?action=TEMPLATE...` + Jitsi meet link. |
| **Meeting Provider** | Native Google Meet (`meet.google.com/xxx-yyyy-zzz`) via `conferenceDataVersion: 1`. | Free open-source Jitsi Meet room (`meet.jit.si/MindCraft-${id}`). |
| **User Friction** | Requires user to sign in with Google AND consent to Google Calendar edit permissions. Non-Google logins (email/password) fail. | **Zero friction:** Works for all authentication types (Google, GitHub, email/password). |
| **Failure Modes** | Google OAuth token refresh expiry, scope revocation, or Google API quota exhaustion returns 401/403. | **Zero failure:** Web URL and `.ics` files cannot fail due to authentication or permissions. |
| **Auditor Verdict** | **High-complexity, brittle for non-Google users.** | **RECOMMENDED:** Harden Option B as the default zero-failure path; implement Option A strictly as an optional toggle for users authenticated via Google. |

---

### 20. Session Lifecycle & Destructive Spam Testing

#### 20.1 Implementation State & Scope
- **Files:**
  - `backend/src/routes/session.js` lines [65-181](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/session.js#L65-L181), [245-304](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/session.js#L245-L304), [353-393](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/session.js#L353-L393), [394-475](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/session.js#L394-L475), [476-520](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/session.js#L476-L520)
  - `backend/src/services/sessionRouter.js` lines [4-107](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/sessionRouter.js#L4-L107)
  - `frontend-react/src/pages/Chat.jsx` lines [43-79](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/Chat.jsx#L43-L79)
- **Status:** **PARTIAL**

#### 20.2 Lifecycle Execution Trace
`Book (PENDING)` -> `Accept (UPCOMING)` -> `Reschedule (MISSING)` -> `Complete (COMPLETED)` -> `Rate (RATED)`

1. **Self-Booking Protection (`session.js:80-106`):**
   ```javascript
   if (tutorParam === req.user.id || tutorParam === req.user.clerkUserId) {
     return res.status(400).json({ success: false, error: 'Cannot book a tutoring session with yourself' });
   }
   if (teacher.id === learner.id) {
     return res.status(400).json({ success: false, error: 'Cannot book a tutoring session with yourself' });
   }
   ```
   **Verdict:** **PASS**. Users cannot book sessions where `teacherId === learnerId`.
2. **Double Complete Protection (`sessionRouter.js:14-19`, `session.js:375-379`):**
   ```javascript
   const alreadyCompleted = session.status === 'COMPLETED';
   if (!alreadyCompleted) {
     if (session.status && session.status !== 'UPCOMING') {
       throw Object.assign(new Error(`Cannot complete session with status ${session.status}`), { statusCode: 409 });
     }
     ...
     await prisma.$transaction([...]);
   }
   ```
   In `session.js:375`: `if (!result.alreadyCompleted) { awardSessionComplete(...) }`
   **Verdict:** **PASS**. Clicking "Complete" multiple times or concurrent completion requests return `alreadyCompleted: true`. Sessions are incremented once and tokens are awarded once (protected by unique idempotency keys `session_${sessionId}_teacher`).
3. **Double Rating Protection (`session.js:431-435`):**
   ```javascript
   const callerKey = isLearner ? `learner_${session.learnerId}` : `teacher_${session.teacherId}`;
   if (ratingData[callerKey] || (isLearner && ratingData.learnerRated) || (!isLearner && ratingData.teacherRated)) {
     return res.status(400).json({ success: false, error: 'You have already rated this session' });
   }
   ```
   **Verdict:** **PASS**. Once a participant submits a rating, `session.completionKey` records `callerKey` and sets `learnerRated: true` or `teacherRated: true`. Subsequent rating attempts return HTTP 400.
4. **Missing Reschedule Route & Lifecycle Failure:**
   - **Verdict:** **FAIL**. There is no reschedule endpoint (`PATCH /api/session/:id/reschedule` or `POST /api/session/reschedule`) anywhere in `backend/src/routes/session.js`. Neither `SessionsDetail.jsx` nor `Chat.jsx` provides any reschedule functionality. If a session time needs to be altered, users must cancel the session and start from scratch.
5. **Flawed Time Overlap Logic (`session.js:129-147`):**
   ```javascript
   const overlap = await prisma.tutoringSession.findFirst({
     where: {
       teacherId: teacher.id,
       status: { in: ['UPCOMING', 'PENDING'] },
       OR: [
         {
           scheduledFor: {
             gte: start,
             lt: end,
           },
         },
       ],
     },
   });
   ```
   **Defects Identified:**
   - **Flaw A (Learner Availability Ignored):** Only `teacherId: teacher.id` is checked. A learner can schedule 10 overlapping sessions with 10 different tutors at the exact same hour.
   - **Flaw B (Broken Mathematical Interval Check):** The query only tests `start <= existing.scheduledFor < end`. If an existing session was scheduled at 2:00 PM (lasting until 3:00 PM), and a new session is booked from 2:30 PM to 3:30 PM (`start = 2:30 PM`), `existing.scheduledFor (2:00 PM) >= start (2:30 PM)` is `false`. The query fails to detect the collision! Standard interval collision check (`existing.start < new.end AND existing.end > new.start`) must be enforced.

---

### 21. Session Count, Study Hours & Profile Review Distortion

#### 21.1 Implementation State & Scope
- **Files:**
  - `backend/src/routes/user.js` lines [371-403](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/user.js#L371-L403)
  - `frontend-react/src/pages/Profile.jsx` lines [530-532](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/Profile.jsx#L530-L532), [780-808](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/Profile.jsx#L780-L808)
  - `frontend-react/src/pages/SessionsDetail.jsx` lines [245-247](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/SessionsDetail.jsx#L245-L247)
- **Status:** **FAIL**

#### 21.2 The Hardcoded `take: 20` Cap & 20-Hour Truncation Bug
In `backend/src/routes/user.js:371-391`:
```javascript
// backend/src/routes/user.js:371-391
user.id ? prisma.tutoringSession.findMany({
  where: {
    OR: [{ teacherId: user.id }, { learnerId: user.id }],
    status: 'COMPLETED',
  },
  select: {
    id: true,
    title: true,
    teacherId: true,
    scheduledFor: true,
    learner: { select: { clerkUserId: true } },
  },
  orderBy: { scheduledFor: 'desc' },
  take: 20, // ⚠️ HARD LIMIT OF 20 ROWS!
}).catch(() => []) : Promise.resolve([]),
]);

const totalStudyMins = sessions.length * 60;
const totalStudyHours = +(totalStudyMins / 60).toFixed(1);
const completedSessionsCount = sessions.length;
```
**Defects Identified:**
1. **`completedSessionsCount` Truncation:**
   Because `findMany` specifies `take: 20`, `sessions.length` is strictly capped at 20. When an active student or tutor completes their 21st, 50th, or 100th session, the "Sessions" card on `Profile.jsx:790` **remains stuck at 20**.
2. **`totalStudyHours` Truncation:**
   `totalStudyHours` is derived from `+( (sessions.length * 60) / 60 ).toFixed(1)`. Because `sessions.length` never exceeds 20, the "Study Hours" badge on `Profile.jsx:804` **can never exceed 20.0h**.
3. **Ignored Session Durations:**
   The formula assumes every completed session lasted exactly 60 minutes (`sessions.length * 60`), completely ignoring the actual duration recorded on the session (30m, 90m, 120m).
4. **Cross-Page Formula Conflict:**
   In `SessionsDetail.jsx:245`, total study hours is computed on the frontend as `+(sessions.reduce((acc, s) => acc + (s.duration || 60), 0) / 60).toFixed(1)`. A user seeing 15.5 hours in `SessionsDetail.jsx` sees a completely conflicting number on `Profile.jsx`.

#### 21.3 Hardcoded Fake 5-Star Reviews Injection
In `backend/src/routes/user.js:393-402`:
```javascript
const reviews = sessions
  .filter((s) => s.teacherId === user.id)
  .map((s) => ({
    sessionId: s.id,
    skill: s.title || 'Tutoring',
    rating: 5,                       // ⚠️ HARDCODED 5 STARS!
    ratingComment: 'Great session!', // ⚠️ HARDCODED FAKE COMMENT!
    learnerUid: s.learner?.clerkUserId || '',
    scheduledAt: s.scheduledFor ? new Date(s.scheduledFor).getTime() : 0,
  }));
```
**Defect Identified:** Every single review card displayed on a user's profile is fabricated with hardcoded `rating: 5` and `ratingComment: 'Great session!'`. The actual star ratings and textual comments saved in `tutoring_sessions.completion_key` are ignored and discarded.

---

### 22. Rating Recalculation & Role Logic Inversion

#### 22.1 Implementation State & Scope
- **Files:**
  - `backend/src/routes/session.js` lines [415-453](file:///Users/apple/Desktop/Mind-Craft/backend/src/routes/session.js#L415-L453)
  - `backend/prisma/schema.prisma` lines [35-40](file:///Users/apple/Desktop/Mind-Craft/backend/prisma/schema.prisma#L35-L40)
- **Status:** **FAIL**

#### 22.2 Mathematical Formula Flaw
In `backend/src/routes/session.js:441-443`:
```javascript
const prevSessions = Math.max(session.teacher.totalSessions - 1, 0);
const newRating = Number(((Number(session.teacher.averageRating) * prevSessions + numRating) / Math.max(session.teacher.totalSessions, 1)).toFixed(2));
```
**The Mathematical Bug:**
- `totalSessions` is the total count of **all completed sessions**, NOT the count of **rated sessions**.
- **Case Scenario:** A tutor completes 10 sessions. 9 students do not leave a review. The 10th student leaves a glowing **5.0-star rating**.
  - `session.teacher.totalSessions` = 10.
  - `prevSessions` = 9.
  - Initial `averageRating` = 0.
  - `newRating = ((0 * 9 + 5) / 10) = 0.50`!
- **Impact:** The tutor's profile displays a disastrous **0.5 rating**, because the formula mathematically treats the 9 unrated sessions as zero-star ratings!
- **Fix:** The database must track `ratedSessionsCount` separately from `totalSessions`, or aggregate `AVG(rating)` directly from historical ratings.

#### 22.3 Role Inversion Bug: Teacher Rating Learner
In `backend/src/routes/session.js:415-452`:
```javascript
const isLearner = session.learner.clerkUserId === req.user.clerkUserId || session.learnerId === req.user.id;
const isTeacher = session.teacher.clerkUserId === req.user.clerkUserId || session.teacherId === req.user.id;
...
await prisma.$transaction([
  prisma.tutoringSession.update({
    where: { id: sessionId },
    data: { completionKey: JSON.stringify(ratingData) },
  }),
  prisma.user.update({
    where: { id: session.teacherId }, // ⚠️ ALWAYS UPDATES THE TEACHER!
    data: { averageRating: newRating },
  }),
]);
```
**Defect Identified:**
When a session completes, both learner and tutor are permitted to leave feedback. However, line 450 hardcodes `where: { id: session.teacherId }`. If the **teacher** submits a rating evaluating the **learner**, the calculation mutates the **teacher's own average rating** using the score given to the learner, while the learner's rating is never updated.

---

### 23. Badges, Gamification Triggers & Weekly Warrior Automation

#### 23.1 Implementation State & Scope
- **Files:**
  - `backend/prisma/seed.js` lines [80-203](file:///Users/apple/Desktop/Mind-Craft/backend/prisma/seed.js#L80-L203)
  - `backend/src/services/badgeCalculator.js` lines [4-14](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/badgeCalculator.js#L4-L14), [54-113](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/badgeCalculator.js#L54-L113), [161-199](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/badgeCalculator.js#L161-L199)
  - `backend/src/services/weeklyWarriorService.js` lines [4-93](file:///Users/apple/Desktop/Mind-Craft/backend/src/services/weeklyWarriorService.js#L4-L93)
  - `frontend-react/src/pages/BadgeProgress.jsx` lines [12-22](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/BadgeProgress.jsx#L12-L22), [118-150](file:///Users/apple/Desktop/Mind-Craft/frontend-react/src/pages/BadgeProgress.jsx#L118-L150)
- **Status:** **FAIL**

#### 23.2 The 17 Seeded Badges vs 9 Computed Badges Disconnect

| Badge Name | Seeded in `seed.js`? | Defined in `badgeCalculator.js`? | Trigger / Metric in `badgeCalculator.js` | UI in `BadgeProgress.jsx`? | Audit Status |
|---|---|---|---|---|---|
| **Streak Champion** (`streak_champion`) | Yes (line 141) | Yes (line 5) | `longestStreak` [3, 7, 14, 30] | Yes | **PASS** |
| **Session Pro** (`session_pro`) | Yes (line 148) | Yes (line 6) | `totalSessions` [5, 15, 50] | Yes | **PASS** |
| **DSA Master** (`dsa_master`) | Yes (line 155) | Yes (line 7) | `dsaSessions` [3, 10, 25] | Yes | **PASS** |
| **Late Night Learner** (`late_night_learner`) | Yes (line 162) | Yes (line 8) | `lateNightSessions` [1, 5, 15] | Yes | **PASS** |
| **Problem Solver** (`problem_solver`) | Yes (line 169) | Yes (line 9) | `doubtsAnswered` [3, 10, 25] | Yes | **PASS** |
| **Mentor** (`mentor`) | Yes (line 176) | Yes (line 10) | `sessionsTaught` [3, 10, 30] | Yes | **PASS** |
| **Top Rated** (`top_rated`) | Yes (line 183) | Yes (line 11) | `ratedSessions` [5, 15, 30] | Yes | **PASS** |
| **Social Butterfly** (`social_butterfly`) | Yes (line 190) | Yes (line 12) | `uniqueMates` [3, 10, 25] | Yes | **PASS** |
| **Wealthy Mind** (`wealthy_mind`) | Yes (line 197) | Yes (line 13) | `mindTokens` [100, 500, 1000] | Yes | **PASS** |
| **Weekly Warrior** (`weekly_warrior`) | Yes (line 83) | **NO** | Awarded only by weekly worker | **NO** | **FAIL (Ghost Badge)** |
| **Spark Starter** (`spark_starter`) | Yes (line 98) | **NO** | None (Seeded 3-day streak) | **NO** | **FAIL (Ghost Badge)** |
| **7-Day Streak** (`7_day_streak`) | Yes (line 90) | **NO** | None (Seeded 7-day streak) | **NO** | **FAIL (Ghost Badge)** |
| **Fortnight Focus** (`fortnight_focus`) | Yes (line 104) | **NO** | None (Seeded 14-day streak) | **NO** | **FAIL (Ghost Badge)** |
| **Monthly Master** (`monthly_master`) | Yes (line 111) | **NO** | None (Seeded 30-day streak) | **NO** | **FAIL (Ghost Badge)** |
| **Discipline King** (`discipline_king`) | Yes (line 118) | **NO** | None (Seeded 60-day streak) | **NO** | **FAIL (Ghost Badge)** |
| **Century Legend** (`century_legend`) | Yes (line 125) | **NO** | None (Seeded 100-day streak) | **NO** | **FAIL (Ghost Badge)** |
| **Master Tutor** (`master_tutor`) | Yes (line 134) | **NO** | None (Seeded Master Tutor) | **NO** | **FAIL (Ghost Badge)** |

**Defect Identified:** Exactly **8 out of the 17 seeded badges** are ghost badges. They exist in the PostgreSQL `Badge` table, but are absent from `BADGE_DEFINITIONS` in `badgeCalculator.js` and have no icon mapping in `BadgeProgress.jsx`.

#### 23.3 In-Memory Calculation vs Database Persistence Vacuum
- `calculateBadges()` evaluates metrics dynamically at request time:
  - `longestStreak` from `calculateStreak`
  - `totalSessions`, `sessionsTaught`, `dsaSessions`, `lateNightSessions`, `uniqueMates` from `tutoring_sessions`
  - `doubtsAnswered` from `doubt_answers`
  - `mindTokens` from `users`
- **Dead Database Write Code:**
  `recordBadgeEarned(uid, badgeId, badgeName, level)` (`badgeCalculator.js:178-199`) is the only method that writes to the `UserBadge` table. **It is never called by any endpoint or service.**
- **The Empty Badge History Bug:**
  In `BadgeProgress.jsx:119-150`, the "Badges Earned" panel queries `badgeHistory`.
  In `badgeCalculator.js:161-176`, `getBadgeHistory()` queries `prisma.userBadge.findMany({ where: { userId } })`.
  Because `userBadge` records are never created when badges level up, `badgeHistory` is **permanently empty `[]`**. The UI displays *"No badges earned yet. Keep going!"* even when all badges are maxed out.

#### 23.4 Weekly Warrior Worker Stalled on Render Free Tier
`weeklyWarriorService.js:22-93` calculates perfect 7-day streaks and awards the `weekly_warrior` badge + 50 Mind Tokens. However:
- The service is executed exclusively by `backend/src/workers/weeklyAuditWorker.js`.
- As verified in Section 14, Render free tier executes only `node server.js`. `server.js` contains no cron scheduler for the weekly audit.
- Consequently, the Weekly Warrior award **never executes in production**.

---

## Action Plan for Sessions, Calendar, Ratings & Gamification (Phase 5 Remediation)

### Priority 1: Google Calendar Deep-Link Stabilization & Real Meeting Links
1. Formalize Option B as the primary, zero-failure calendar path across all booking flows:
   - In `frontend-react/src/pages/Notifications.jsx:292-327`, remove the dead 120-second Google OAuth popup promise. Accept sessions immediately without blocking on OAuth.
   - Default all online meeting links to `https://meet.jit.si/MindCraft-${session.id}`.
   - For users desiring real Google Meet links, integrate Clerk's Google OAuth access token endpoint (`/v1/users/{id}/oauth_access_tokens/oauth_google`) to insert events with `conferenceDataVersion: 1` directly from the backend, with zero popup/redirect windows.

### Priority 2: Fix Session Count & Study Hours Truncation on Profile
1. In `backend/src/routes/user.js:371-391`:
   - Replace the `findMany(take: 20)` count with `prisma.tutoringSession.count({ where: { OR: [...], status: 'COMPLETED' } })` to obtain the true `completedSessionsCount`.
   - Calculate actual study hours summing `duration` across all completed sessions using Prisma `aggregate({ _sum: { duration: true } })`, eliminating the artificial 20.0-hour ceiling.
2. In `backend/src/routes/user.js:393-402`, read actual ratings and comments from `tutoring_sessions.completion_key`, removing the fake hardcoded `rating: 5` and `"Great session!"` card overrides.

### Priority 3: Correct Rating Recalculation & Mutual Rating Logic
1. In `backend/src/routes/session.js:441-452`:
   - Calculate `newRating` using the count of *rated* sessions, not total sessions:
     ```javascript
     const ratedSessions = await prisma.tutoringSession.count({
       where: { teacherId: targetUserId, status: 'COMPLETED', completionKey: { not: null } }
     });
     ```
   - Dynamically target the user being reviewed: if the learner is rating the tutor, update `teacher.averageRating`; if the tutor is rating the learner, update `learner.averageRating`.

### Priority 4: Complete Badge Inventory Alignment & History Persistence
1. Add the 8 ghost badges (`spark_starter`, `7_day_streak`, `fortnight_focus`, `monthly_master`, `discipline_king`, `century_legend`, `master_tutor`, `weekly_warrior`) into `BADGE_DEFINITIONS` in `badgeCalculator.js` and map corresponding Lucide icons in `BadgeProgress.jsx`.
2. When `computeBadge` detects a level-up or new badge unlock, persist the event to `UserBadge` so `badgeHistory` renders correctly in `BadgeProgress.jsx`.
3. Add a lightweight in-process node-cron schedule in `backend/server.js` (running every Sunday at midnight) to trigger `awardWeeklyReward` automatically on Render free tier.
