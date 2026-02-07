# Final Test Coverage Report

## Summary

| Metric | Before | After |
|--------|--------|-------|
| **Test suites** | 3 | 7 |
| **Tests** | 13 | 130 |
| **Statement coverage** | 44.6% | **97.75%** |
| **Branch coverage** | 51.8% | **87.56%** |
| **Function coverage** | 47.4% | **98.5%** |
| **Line coverage** | 46.1% | **99.02%** |

## Coverage by File

| File | Stmts | Branch | Funcs | Lines | Uncovered Lines |
|------|-------|--------|-------|-------|----------------|
| `lib/ai-provider.ts` | 100% | 96.8% | 100% | 100% | Branch: L148 (unused `else` in `chunkText`) |
| `lib/auth.ts` | 100% | 88.2% | 100% | 100% | Branch: L64,69 (fallback `email.split('@')`) |
| `lib/prisma.ts` | 100% | 100% | 100% | 100% | |
| `lib/social-metrics.ts` | 100% | 100% | 100% | 100% | |
| `lib/supabase.ts` | 100% | 85.7% | 100% | 100% | Branch: L6 (env var present check) |
| `prompts/generate-assets.ts` | 100% | 100% | 100% | 100% | |
| `prompts/summarize.ts` | 100% | 100% | 100% | 100% | |
| `routes/analytics.ts` | 100% | 85.2% | 100% | 100% | Branch: L103,225,261-262 (optional chaining fallbacks) |
| `routes/campaigns.ts` | 96.8% | 90.9% | 100% | 100% | Stmt: L126,223,308,420,474 (defensive branch guards for `body` fields — always present in real HTTP) |
| `routes/me.ts` | 100% | 100% | 100% | 100% | |
| `routes/social.ts` | 95.2% | 74.4% | 91.7% | 96.5% | L11-14 (module-level `setInterval`), L113 (crypto-failure catch) |

## What Remains Untested and Why

1. **`social.ts` lines 11-14**: Module-level `setInterval` that cleans expired PKCE entries. This is a side effect that runs on `require()` and cannot be reached by calling any exported function. Testing it would require refactoring the timer into an exported function, which is out of scope for a test-only change.

2. **`social.ts` line 113**: The `catch` block in `connectXHandler`. This only triggers if the state-generation logic (PKCE + HMAC signing) throws internally, which requires a Node.js `crypto` module failure. Not realistically triggerable in tests.

3. **`campaigns.ts` branch guards** (5 uncovered branches): These check for `undefined` body fields (e.g., `if (!request.body?.sourceType)`) that are defensive against missing HTTP body parsing. They fire when `body` is `undefined` — a scenario that doesn't occur with Fastify's body parsing middleware.

4. **`auth.ts` branch L64,69**: Fallback to `email.split('@')[0]` for user name when `user_metadata.name` is falsy. Tested via the upsert call path but the fallback branch itself isn't reached because test fixtures always provide `name`.

5. **`analytics.ts` branch L103,225,261-262**: Optional chaining fallbacks for `postedAt?.toISOString()` and `metrics?.[0]`. These guard against null values that Prisma types indicate are possible but that the `where` clause filters prevent.

## Test Architecture

### Mocking Strategy
- **Prisma**: Mocked at the `@prisma/client` module level via `jest.mock()`. All model methods are `jest.fn()` instances shared through `helpers.ts`.
- **Supabase**: Mocked at the `@supabase/supabase-js` module level. `auth.getUser()` is the primary mock target.
- **OpenAI / fetch**: Mocked via `global.fetch` reassignment in `OpenAIProvider` tests. Restored in `afterEach`.
- **No real network calls**: All external service interactions (OpenAI, Twitter OAuth, Supabase) are mocked.

### Test File Organization
| File | Handler(s) Tested | Tests |
|------|------------------|-------|
| `campaigns.test.ts` | `createCampaignHandler` | 7 |
| `campaigns-full.test.ts` | `listCampaigns`, `getCampaign`, `deleteCampaign`, `uploadCampaignSource`, `registerCampaignSource`, `getJobStatus`, `updateAsset` | 34 |
| `generate-assets.test.ts` | `generateAssetsHandler` | 6 |
| `me.test.ts` | `getMeHandler` | 6 |
| `social.test.ts` | `connectX`, `xCallback`, `listConnections`, `disconnect`, `schedulePost`, `listScheduledPosts`, `cancelScheduledPost` | 27 |
| `analytics.test.ts` | Dashboard, campaign metrics, refresh | 16 |
| `ai-provider.test.ts` | `chunkText`, `createAIProvider`, `MockAIProvider`, `OpenAIProvider`, prompt builders, `calculateEngagementRate`, `fetchMetricsFromPlatform` | 34 |

### Key Design Choices
1. **Shared helpers**: `helpers.ts` provides mock factories, test fixtures, and auth setup helpers used by all test files.
2. **Handler-level testing**: Tests call exported handler functions directly with mock request/reply objects, avoiding HTTP overhead.
3. **Fastify plugin extraction**: For `analytics.ts` (a Fastify plugin), a mock Fastify instance captures route handlers during registration.
4. **Deterministic tests**: No real timers (except `MockAIProvider`'s 1s delay which runs in real-time), no network calls, no database access.
5. **`--forceExit`**: Added to the test script to handle the module-level `setInterval` in `social.ts` that creates a non-cancellable timer on import.

## Notes for Future Maintainers

- **Worker tests**: `src/worker.ts` is excluded from coverage collection. To test it, extract job processor functions (summarize, generate_asset, collect_metrics, process_scheduled_posts) into a separate `src/jobs/processors.ts` module and test those pure functions independently.
- **Frontend tests**: No test infrastructure exists for the Next.js frontend. Recommended: add Vitest + React Testing Library for `lib/api.ts` (demo-mode fallback, error handling) and component smoke tests.
- **Branch coverage**: Currently at 87.6%. The remaining uncovered branches are mostly defensive guards for nullable fields that can't be null given the query constraints. Pushing branch coverage higher would require either mocking Prisma at a lower level or testing with an actual database.
- **Integration tests**: All current tests are unit tests with mocked dependencies. Consider adding a small set of integration tests using a test database (e.g., via Docker + Prisma migrate) for the most critical paths (campaign creation → analysis → asset generation).
