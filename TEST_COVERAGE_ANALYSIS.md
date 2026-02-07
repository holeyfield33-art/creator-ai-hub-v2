# Test Coverage Analysis

## Current State

**13 tests** across **3 test files**, all in the backend. Zero frontend tests.

### Coverage Summary (from `jest --coverage`)

| File | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| **Overall** | **44.6%** | **51.8%** | **47.4%** | **46.1%** |
| `lib/auth.ts` | 90% | 76.5% | 100% | 90% |
| `lib/prisma.ts` | 100% | 100% | 100% | 100% |
| `lib/supabase.ts` | 100% | 85.7% | 100% | 100% |
| `prompts/generate-assets.ts` | 50% | 100% | 0% | 50% |
| `routes/campaigns.ts` | 29.5% | 36.4% | 41.7% | 30.6% |
| `routes/me.ts` | 83.3% | 100% | 100% | 83.3% |

### What Is Tested

| Handler | File | Tests |
|---------|------|-------|
| `createCampaignHandler` | `campaigns.test.ts` | Valid creation, missing auth, missing name, DB error (4 tests) |
| `generateAssetsHandler` | `generate-assets.test.ts` | Job creation, 404 campaign, no channels, no analysis, unsupported channels (5 tests) |
| `getMeHandler` | `me.test.ts` | Valid token, missing header, invalid format, Supabase error (4 tests) |

### What Is NOT Tested

The following source files have **0% test coverage**:

| File / Module | Lines | Risk |
|---------------|-------|------|
| `routes/social.ts` | 445 | **Critical** - OAuth flows, scheduling, token handling |
| `routes/analytics.ts` | 319 | **High** - Dashboard aggregation, campaign metrics |
| `lib/ai-provider.ts` | 158 | **High** - AI provider factory, text chunking utility |
| `lib/social-metrics.ts` | 152 | **Medium** - Platform metrics fetching, engagement rate |
| `prompts/summarize.ts` | 23 | **Low** - Prompt template builder |
| `worker.ts` | 544 | **Excluded from coverage** but critical background logic |

Within `routes/campaigns.ts` (29.5% coverage), the following handlers are untested:

- `listCampaignsHandler` (lines 45-73)
- `getCampaignHandler` (lines 76-110)
- `uploadCampaignSourceHandler` (lines 113-206)
- `registerCampaignSourceHandler` (lines 209-297)
- `deleteCampaignHandler` (lines 383-412)
- `getJobStatusHandler` (lines 415-463)
- `updateAssetHandler` (lines 466-512)

**Frontend**: No test framework is configured. No tests exist for any React components, hooks, or API client utilities.

---

## Proposed Improvements (Prioritized)

### Priority 1: Untested Campaign Route Handlers

**Why**: These are core CRUD operations that users interact with on every session. The existing tests prove the pattern works - extending coverage here is straightforward.

**Recommended tests**:

1. **`listCampaignsHandler`** - Returns user's campaigns ordered by date; returns empty array for new user; requires auth.
2. **`getCampaignHandler`** - Returns campaign with includes; returns 404 for wrong user; returns 404 for nonexistent ID.
3. **`deleteCampaignHandler`** - Deletes owned campaign; returns 404 for unowned campaign; handles DB cascade errors.
4. **`uploadCampaignSourceHandler`** - Text upload creates source + summarize job; file upload creates source with metadata; returns 400 for empty text; returns 400 for invalid source type; returns 404 for wrong user's campaign.
5. **`registerCampaignSourceHandler`** - Creates source + stub analysis + updates campaign status; returns 400 for missing URL; returns 404 for wrong campaign.
6. **`getJobStatusHandler`** - Returns job without payload; returns 404 for nonexistent job; returns 404 when job belongs to another user's campaign.
7. **`updateAssetHandler`** - Updates content and marks approved; returns 400 for empty content; returns 404 for another user's asset.

**Estimated new tests**: ~20

### Priority 2: Social & Scheduling Routes (`routes/social.ts`)

**Why**: This module handles OAuth token exchange, PKCE verification, token storage, post scheduling, and post cancellation. Bugs here can cause auth failures, data loss, or security issues.

**Recommended tests**:

1. **`connectXHandler`** - Generates valid PKCE challenge and state; returns 401 without auth; returns 500 when OAuth not configured.
2. **`xCallbackHandler`** - Exchanges code for token and stores connection; redirects on missing params; rejects invalid/expired state; rejects mismatched PKCE userId.
3. **`listConnectionsHandler`** - Returns user's connections with selected fields; returns 401 without auth.
4. **`disconnectHandler`** - Deletes owned connection; returns 404 for unowned connection.
5. **`schedulePostHandler`** - Creates scheduled post; returns 404 for unowned asset; returns 404 for unowned connection.
6. **`listScheduledPostsHandler`** - Returns posts with asset and connection includes.
7. **`cancelScheduledPostHandler`** - Cancels pending post; returns 404 for already-processed post.
8. **Utility functions** - `generatePKCE()` produces valid verifier/challenge pair; `generateState()`/`verifyState()` roundtrip correctly; `verifyState()` rejects tampered or expired states.

**Estimated new tests**: ~18

### Priority 3: AI Provider & Text Chunking (`lib/ai-provider.ts`)

**Why**: `chunkText` is a pure function with non-trivial logic (sentence splitting, word-level fallback for oversized sentences). The factory function `createAIProvider` branches on env vars. Both are easy to unit test with no mocking needed for the pure functions.

**Recommended tests**:

1. **`chunkText`** - Short text returns single chunk; text splits on sentence boundaries; very long single sentence splits on word boundaries; empty string returns single empty chunk; exact boundary length text.
2. **`createAIProvider`** - Returns `MockAIProvider` when key is empty/`mock`/`test`; returns `OpenAIProvider` with real key; respects `AI_MODEL` and `AI_BASE_URL` env vars.
3. **`MockAIProvider.complete`** - Returns valid JSON structure with expected fields.

**Estimated new tests**: ~8

### Priority 4: Analytics Routes (`routes/analytics.ts`)

**Why**: Complex aggregation logic (daily rollups, platform breakdown, engagement rate calculations) that can silently produce wrong numbers without tests.

**Recommended tests**:

1. **Dashboard endpoint** - Aggregates metrics correctly across posts; filters by date range; filters by platform; handles zero-impression case (no division by zero); returns sorted daily metrics.
2. **Campaign metrics endpoint** - Returns 404 for unowned campaign; aggregates post metrics per campaign; sorts posts by engagement.
3. **Refresh endpoint** - Creates jobs only for posts without recent metrics; skips posts fetched within the last hour.

**Estimated new tests**: ~10

### Priority 5: Prompt Builders (`prompts/`)

**Why**: Low risk but trivially easy to test. These are pure string-template functions.

**Recommended tests**:

1. **`buildSummarizePrompt`** - Inserts text into template.
2. **`buildGenerateAssetPrompt`** - Replaces all `{channel}` occurrences; formats key points as numbered list; formats hooks as numbered list.

**Estimated new tests**: ~4

### Priority 6: Social Metrics (`lib/social-metrics.ts`)

**Why**: `calculateEngagementRate` is a pure function. `fetchMetricsFromPlatform` dispatches to platform-specific fetchers and throws on unsupported platforms.

**Recommended tests**:

1. **`calculateEngagementRate`** - Returns 0 when impressions are 0; calculates percentage correctly.
2. **`fetchMetricsFromPlatform`** - Dispatches `x`/`twitter` to Twitter fetcher; dispatches `linkedin` to LinkedIn fetcher; throws for unsupported platform.

**Estimated new tests**: ~5

### Priority 7: Worker Job Processors (`worker.ts`)

**Why**: The worker is excluded from coverage collection in jest.config.js, but it contains the most critical business logic - AI summarization, asset generation, metrics collection, and scheduled post publishing. Bugs here fail silently in background jobs.

**Recommended approach**: Extract job processors into a separate testable module (e.g., `src/jobs/processors.ts`) and test them independently of the polling loop.

**Recommended tests**:

1. **`summarize` processor** - Calls AI with built prompt; parses JSON response; handles markdown-wrapped JSON; creates analysis and updates campaign status; rejects missing fields.
2. **`generate_asset` processor** - Calls AI and creates asset record; rejects missing fields.
3. **`collect_metrics` processor** - Fetches metrics and creates PostMetric; throws when post not found/not posted/no platform ID.
4. **`claimJob`** - Claims pending job atomically; returns null when no jobs; returns null when job already claimed.
5. **`processJob`** - Marks completed on success; retries on failure below max attempts; marks failed at max attempts.
6. **`processScheduledPosts`** - Posts due scheduled posts; marks failed on platform error.

**Estimated new tests**: ~15

### Priority 8: Frontend Testing

**Why**: No test infrastructure exists. The frontend has non-trivial logic in `lib/api.ts` (demo mode fallback, error handling, token management) and complex React components.

**Recommended approach**:

1. **Set up Vitest** (integrates naturally with Next.js) with React Testing Library.
2. **`lib/api.ts`** - Test `request()` demo mode fallback for network errors; test error extraction from response body; test 204 handling.
3. **`lib/auth-context.tsx`** - Test auth state transitions (logged in, logged out, loading).
4. **Component smoke tests** - Dashboard, Campaign list, Schedule page render without crashing.

**Estimated new tests**: ~12

---

## Summary

| Priority | Area | New Tests | Impact |
|----------|------|-----------|--------|
| P1 | Remaining campaign handlers | ~20 | Covers core CRUD gap |
| P2 | Social & scheduling routes | ~18 | Covers auth/OAuth/scheduling |
| P3 | AI provider & chunking | ~8 | Pure function coverage |
| P4 | Analytics routes | ~10 | Aggregation correctness |
| P5 | Prompt builders | ~4 | Trivial wins |
| P6 | Social metrics | ~5 | Pure function coverage |
| P7 | Worker job processors | ~15 | Critical background logic |
| P8 | Frontend testing | ~12 | No coverage today |
| **Total** | | **~92** | |

Implementing P1-P4 would bring backend statement coverage from **44.6% to an estimated ~80%+** and cover all route handlers. Adding P7 (after refactoring the worker) would cover the most critical business logic paths.
