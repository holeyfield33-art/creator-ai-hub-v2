# Test Coverage Analysis

## Current State

### Backend (`backend/`)

**Framework:** Jest 29.5 with ts-jest
**Test files:** 10 files in `backend/tests/`
**Total test cases:** 190
**Coverage report:**

| Directory | % Stmts | % Branch | % Funcs | % Lines | Uncovered Lines |
|-----------|---------|----------|---------|---------|-----------------|
| **All files** | **100** | **95.36** | **100** | **100** | |
| lib/ | 100 | 95 | 100 | 100 | |
| &nbsp;&nbsp;ai-provider.ts | 100 | 100 | 100 | 100 | |
| &nbsp;&nbsp;auth.ts | 100 | 88.23 | 100 | 100 | 64, 69 |
| &nbsp;&nbsp;prisma.ts | 100 | 100 | 100 | 100 | |
| &nbsp;&nbsp;social-metrics.ts | 100 | 100 | 100 | 100 | |
| &nbsp;&nbsp;supabase.ts | 100 | 85.71 | 100 | 100 | 6 |
| prompts/ | 100 | 100 | 100 | 100 | |
| routes/ | 100 | 95.52 | 100 | 100 | |
| &nbsp;&nbsp;analytics.ts | 100 | 92.59 | 100 | 100 | 103, 262 |
| &nbsp;&nbsp;campaigns.ts | 100 | 100 | 100 | 100 | |
| &nbsp;&nbsp;social.ts | 100 | 91.66 | 100 | 100 | 31-32, 81, 93 |

**Excluded from coverage:** `index.ts` (server bootstrap), `worker.ts` (job queue), `create-test-job.ts` (manual utility)

### Frontend (`frontend/`)

**Framework:** None configured
**Test files:** 0
**Coverage:** 0% &mdash; no tests exist

---

## Gap Analysis

### 1. Worker module is excluded from coverage entirely (HIGH)

`backend/src/worker.ts` (544 lines) contains the most critical business logic in the system &mdash; job processing, AI-driven summarization and asset generation, scheduled post execution, and X/Twitter token refresh &mdash; yet it is fully excluded from `collectCoverageFrom` in `jest.config.js`. This is the single largest coverage gap.

**Untested logic in worker.ts:**

- **`summarize` job processor** &mdash; text chunking, AI prompt construction, JSON response parsing with markdown fallback, database writes for campaign analysis, campaign status transitions
- **`generate_asset` job processor** &mdash; prompt building, AI content generation, asset database writes
- **`collect_metrics` job processor** &mdash; post validation chain (exists, posted, has platform ID), metrics fetching, engagement rate calculation, metric history writes
- **`claimJob()`** &mdash; atomic job claiming with race-condition guard (updateMany + count check)
- **`processJob()`** &mdash; retry logic (3 attempts), error classification, status transitions (pending -> running -> completed/failed)
- **`processScheduledPosts()`** &mdash; due post detection, status transitions (pending -> posting -> posted/failed)
- **`refreshXToken()`** &mdash; token expiry check, OAuth token refresh flow, database update
- **`postToX()`** &mdash; Twitter API integration, tweet posting, platform post ID tracking

**Recommendation:** Extract the job processors and helper functions into a separate importable module (e.g., `lib/job-processors.ts`) that can be tested independently of the polling loop and process signal handlers. Add this new module to the coverage scope.

### 2. Frontend has zero test coverage (HIGH)

The frontend has 21 source files (~132 KB of code) with no test framework configured and no test files. Key untested areas:

**Utility/API layer (most testable, highest value):**

| File | Size | Key logic |
|------|------|-----------|
| `lib/api.ts` | 6.1 KB | Centralized HTTP client with bearer token injection, error handling, demo mode fallback, network error recovery |
| `lib/campaigns-api.ts` | 4.7 KB | Campaign CRUD client functions, `waitForJobs()` polling with backoff |
| `lib/social-api.ts` | 1.8 KB | Social connection and scheduling client functions |
| `lib/analytics-api.ts` | 2.0 KB | Metrics and dashboard data client functions |
| `lib/auth-context.tsx` | 2.0 KB | Supabase auth state provider, session management |
| `lib/use-backend-user.ts` | 1.1 KB | Custom hook for loading user data from backend |

**Page components with business logic:**

| File | Size | Key logic |
|------|------|-----------|
| `app/campaigns/[id]/campaign-detail-client.tsx` | 28 KB | Content upload, multi-channel asset generation, inline editing, post scheduling with calendar, metrics display (10+ state hooks) |
| `app/app/schedule/page.tsx` | 11 KB | Social connection management, scheduled post listing with status filtering, post cancellation |
| `app/app/campaigns/page.tsx` | 11 KB | Campaign listing with status filter, create/delete with confirmation dialogs |
| `app/app/dashboard/page.tsx` | 8.1 KB | Analytics dashboard with time range and platform filters, chart rendering |
| `app/login/page.tsx` | 5.9 KB | Login/signup form toggle, Supabase auth, error display |

**Recommendation:** Set up Vitest (pairs well with Next.js) plus React Testing Library. Prioritize the `lib/` utility layer first since these are pure functions / thin wrappers that are easy to unit test and cover the most logic per line of test code.

### 3. Backend branch coverage has gaps (MEDIUM)

While statement/function/line coverage is 100%, branch coverage is only 95.36%. Specific gaps:

- **`auth.ts` lines 64, 69** (88.23% branch) &mdash; edge cases in `ensureDbUser` around fallback name generation (missing `user_metadata`, missing email)
- **`supabase.ts` line 6** (85.71% branch) &mdash; the `if (!supabaseUrl || !supabaseServiceKey)` warning path is not fully exercised
- **`analytics.ts` lines 103, 262** (92.59% branch) &mdash; untested branches in dashboard metric aggregation (null `postedAt` dates) and campaign metrics endpoint
- **`social.ts` lines 31-32, 81, 93** (91.66% branch) &mdash; untested branches in PKCE cleanup (empty store), random string generation fallback (`Math.random()` fallback when `crypto.randomBytes` fails), and state generation edge case

**Recommendation:** Add targeted tests for these specific branches. The `social.ts` crypto fallback (line 81) is particularly important &mdash; the fallback from `crypto.randomBytes` to `Math.random()` is a security concern that should be tested and potentially removed.

### 4. Integration/E2E tests do not exist (MEDIUM)

All 190 existing backend tests are unit tests that mock Prisma, Supabase, and external APIs. There are no integration tests that verify:

- Route registration and request routing through Fastify
- Prisma query correctness against a real (or in-memory) database
- The full job lifecycle: job creation -> worker pickup -> processing -> completion
- OAuth callback flow end-to-end
- Authentication middleware chaining with route handlers

**Recommendation:** Add a small integration test suite using a test database (e.g., PostgreSQL via Docker in CI, or SQLite via Prisma's adapter). Focus on the two highest-risk flows:
1. Campaign creation -> source upload -> summarize job creation -> asset generation
2. Social connection -> post scheduling -> worker pickup -> posting

### 5. Worker job processors lack edge-case testing (MEDIUM)

Even if we add worker tests per recommendation #1, the following edge cases need specific attention:

- **JSON parse failure in summarize**: The markdown code-block fallback (`/```(?:json)?\s*(\{[\s\S]*?\})\s*```/`) could fail on nested code blocks or truncated responses
- **Job retry logic**: A job at `attempts = maxAttempts` should be marked `failed`, not retried; currently the comparison is `job.attempts >= job.maxAttempts` but `attempts` is incremented *before* processing
- **Token refresh race condition**: Two scheduled posts using the same connection could trigger concurrent token refreshes
- **Stuck "posting" state**: If `postToX()` throws after the status is set to `posting` but before it can be set to `posted`, the post is correctly set to `failed`; but if the *database update itself* fails, the post is stuck in `posting` permanently
- **`collect_metrics` with null `socialConnection.accessToken`**: No null check before passing to `fetchMetricsFromPlatform`

### 6. No test for server bootstrap or route wiring (LOW)

`backend/src/index.ts` registers 14+ routes on the Fastify instance. There is no test that verifies all routes are actually registered or that the server starts successfully. A smoke test that boots the server and checks the health endpoint would catch registration errors.

### 7. No snapshot or visual regression testing for frontend (LOW)

The frontend includes charts (Recharts), complex layouts, and a multi-step campaign detail page. There are no snapshot tests or visual regression tests.

**Recommendation:** Once the higher-priority frontend testing infrastructure is in place, consider adding component snapshots for the dashboard charts and campaign detail page layout to catch unintended visual regressions.

---

## Prioritized Action Plan

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| **P0** | Extract worker job processors into testable module and add unit tests | Medium | Covers the most critical untested business logic |
| **P0** | Set up frontend test framework (Vitest + React Testing Library) | Small | Unblocks all frontend testing |
| **P1** | Add unit tests for frontend `lib/` utilities (`api.ts`, `campaigns-api.ts`, `social-api.ts`, `analytics-api.ts`) | Medium | Covers the entire API client layer |
| **P1** | Close backend branch coverage gaps (auth.ts, social.ts, analytics.ts) | Small | Reaches 100% branch coverage for already-tested files |
| **P2** | Add frontend component tests for `auth-context.tsx` and `use-backend-user.ts` | Small | Covers auth state management |
| **P2** | Add integration tests for campaign lifecycle and social posting flow | Large | Validates end-to-end correctness |
| **P3** | Add server bootstrap smoke test for route registration | Small | Catches wiring errors |
| **P3** | Add frontend page-level tests for campaign list, dashboard, schedule pages | Large | Covers UI interaction logic |
| **P3** | Add snapshot tests for dashboard charts and campaign detail layout | Medium | Prevents visual regressions |
