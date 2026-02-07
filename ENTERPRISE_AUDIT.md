# Enterprise Audit & Build Plan
## Creator AI Hub v2

**Audit Date:** February 4, 2026
**Version:** Phase 12 Complete
**Prepared for:** Enterprise Readiness Assessment

---

## Table of Contents
1. [Product Summary](#1-product-summary)
2. [Monetization Model & Profit Potential](#2-monetization-model--profit-potential)
3. [Competitive Landscape](#3-competitive-landscape)
4. [What We Have They Don't](#4-what-we-have-they-dont)
5. [What They Have We Don't](#5-what-they-have-we-dont)
6. [Features to Add (Prioritized)](#6-features-to-add-prioritized)
7. [Production-Readiness Gaps](#7-production-readiness-gaps)
8. [Quick Wins vs Deep Work](#8-quick-wins-vs-deep-work)
9. [Recommended First Build Ticket](#9-recommended-first-build-ticket)

---

## 1. Product Summary

### What It Is
**Creator AI Hub** is an AI-powered content repurposing and social media management platform that transforms raw content into platform-optimized posts across multiple channels.

### Target Users
| Segment | Use Case |
|---------|----------|
| Content Creators/Influencers | Scale content across platforms without manual rewriting |
| Marketing Professionals | Automate campaign content generation |
| Social Media Managers | Unified scheduling and analytics dashboard |
| Small Business Owners | Professional social presence with minimal effort |
| Agencies | Manage multiple client campaigns efficiently |

### Core Value Proposition
**"Upload once, publish everywhere"** — Users provide raw content (text, ideas, or source material), and AI generates channel-specific content for 6 platforms while providing scheduling and analytics.

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16.1.5, React 19, TypeScript, Tailwind CSS |
| Backend | Fastify 4.26, TypeScript, Prisma ORM |
| Database | PostgreSQL (Supabase) |
| Authentication | Supabase Auth (JWT) |
| AI Engine | OpenAI API (gpt-4o-mini) with pluggable provider |
| File Upload | UploadThing |
| Social APIs | X/Twitter OAuth 2.0, LinkedIn (framework) |
| Deployment | Vercel (frontend), Railway (backend) |

### Current Feature Set
- ✅ User authentication with Supabase
- ✅ Campaign CRUD with status workflows (draft → processing → ready → active)
- ✅ Text content upload & AI analysis (summary, key points, hooks)
- ✅ Multi-channel asset generation (Twitter, LinkedIn, Facebook, Instagram, Blog, Email)
- ✅ Asset editing & approval workflows
- ✅ X/Twitter OAuth with PKCE (secure connection)
- ✅ Post scheduling with status tracking
- ✅ Analytics dashboard (impressions, engagement, trends)
- ✅ Background job processing with retry logic
- ✅ Campaign-specific performance metrics

---

## 2. Monetization Model & Profit Potential

### Current State
**No monetization implemented.** The platform currently operates as a free, unrestricted tool.

### Recommended Monetization Model: Freemium + Usage-Based

#### Tier Structure

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0/mo | 3 campaigns, 10 AI generations/mo, 1 social account, 30-day analytics |
| **Creator** | $19/mo | 10 campaigns, 100 AI generations/mo, 3 social accounts, 90-day analytics, priority support |
| **Pro** | $49/mo | Unlimited campaigns, 500 AI generations/mo, 10 social accounts, 1-year analytics, API access, team collaboration (3 seats) |
| **Agency** | $149/mo | Everything in Pro + unlimited accounts, white-label options, 10 team seats, dedicated support, custom integrations |
| **Enterprise** | Custom | SSO/SAML, SLA, audit logs, custom AI training, on-premise option |

#### Revenue Projections (Conservative)

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| Free Users | 10,000 | 50,000 | 150,000 |
| Paid Conversion | 3% | 4% | 5% |
| Paying Users | 300 | 2,000 | 7,500 |
| ARPU | $29 | $35 | $39 |
| **MRR** | $8,700 | $70,000 | $292,500 |
| **ARR** | $104,400 | $840,000 | $3.5M |

#### Unit Economics
- **CAC Target:** $50-100 (content marketing, SEO, affiliates)
- **LTV Target:** $350-500 (12-month average retention at $35 ARPU)
- **LTV:CAC Ratio:** 5:1+ (healthy SaaS benchmark)
- **Gross Margin:** 75-85% (AI API costs ~15%, infrastructure ~5%)

#### Additional Revenue Streams
1. **AI Credits Pack** — $10 for 50 extra generations
2. **Premium Templates** — $5-15 per pack
3. **White-Label Licensing** — $500+/mo for agencies
4. **Affiliate Program** — 20% recurring commission

---

## 3. Competitive Landscape

### Top 5 Competitors

| Competitor | Pricing | Primary Strength | Target Market |
|------------|---------|------------------|---------------|
| **Jasper AI** | $49-125/mo | Brand voice training, long-form content | Enterprise content teams |
| **Copy.ai** | $49+/mo | Speed, short-form variations | Marketing teams |
| **Hootsuite** | $99-249/mo | Comprehensive scheduling, analytics | Agencies, enterprises |
| **Buffer** | $6-120/mo | Simple UX, affordable | Small teams, solopreneurs |
| **FeedHive** | $19-99/mo | AI repurposing, conditional automation | Creators, small businesses |

### Market Context
- **Market Size:** AI in Social Media projected to reach **$11.8B by 2030** (28.4% CAGR)
- **Adoption:** 96% of social media managers use AI tools daily
- **Results:** 80% reduction in content creation time, 32% higher engagement

### Detailed Competitor Analysis

#### Jasper AI
- **Strengths:** Industry-leading brand voice AI, extensive templates, SEO integration
- **Weaknesses:** Expensive, complex for simple social posts, no native scheduling
- **Pricing:** Creator $49/mo, Pro $69/mo, Business custom

#### Copy.ai
- **Strengths:** Fast short-form generation, 90+ content types, workflow automation
- **Weaknesses:** Limited scheduling, basic analytics, no social integrations
- **Pricing:** Free tier, Pro $49/mo, Enterprise custom

#### Hootsuite
- **Strengths:** Full social suite, enterprise features, comprehensive analytics
- **Weaknesses:** Expensive, AI features basic, dated UI
- **Pricing:** $99-249/mo, no free tier

#### Buffer
- **Strengths:** Clean UX, affordable, reliable scheduling
- **Weaknesses:** Basic AI features, limited analytics depth
- **Pricing:** Free (limited), $6/channel/mo

#### FeedHive
- **Strengths:** AI repurposing, conditional automation, engagement prediction
- **Weaknesses:** Limited channel support, newer player
- **Pricing:** $19-99/mo

---

## 4. What We Have They Don't

### Unique Advantages

| Feature | Creator AI Hub | Competitors |
|---------|----------------|-------------|
| **End-to-End Workflow** | Upload → Analyze → Generate → Schedule → Track (single platform) | Usually requires multiple tools |
| **Content Intelligence** | AI extracts key points, hooks, and angles from raw content | Most just generate from prompts |
| **6-Channel Generation** | Twitter, LinkedIn, Facebook, Instagram, Blog, Email in one job | Usually 1-3 platforms per generation |
| **Modern Stack** | Next.js 16, React 19, TypeScript (2026 current) | Many on older frameworks |
| **Transparent Architecture** | Open, auditable, self-hostable | Closed, vendor lock-in |
| **Async Job Processing** | Non-blocking with status tracking | Many block UI during generation |
| **PKCE OAuth** | Secure social connections with state validation | Many use older OAuth flows |
| **Unified Campaign Model** | Sources, assets, posts, metrics linked | Fragmented data models |

### Technical Differentiators
1. **Pluggable AI Provider** — Can swap OpenAI for Claude, Llama, or custom models
2. **Mock AI Mode** — Development/testing without API costs
3. **Background Worker** — Scalable job processing with graceful shutdown
4. **Type-Safe End-to-End** — Full TypeScript from DB to UI

---

## 5. What They Have We Don't

### Feature Gap Analysis

| Gap | Competitors With It | Impact | Priority |
|-----|---------------------|--------|----------|
| **Video Content Support** | Jasper, Pictory, CapCut | High — video is 80% of social engagement | P0 |
| **Image Generation** | Canva, Copy.ai, AdCreative.ai | High — visual content essential | P0 |
| **Brand Voice Training** | Jasper, Copy.ai | High — enterprise requirement | P1 |
| **Team Collaboration** | Hootsuite, Sprout, Planable | High — agency/enterprise blocker | P1 |
| **Approval Workflows** | Planable, Sprout Social | Medium — enterprise compliance | P1 |
| **Engagement Prediction** | FeedHive, Sprout Social | Medium — competitive edge | P2 |
| **Conditional Automation** | FeedHive, Zapier integrations | Medium — power user feature | P2 |
| **Instagram/Facebook Posting** | All major competitors | High — only X/Twitter works now | P0 |
| **Sentiment Analysis** | Sprout Social, Hootsuite | Medium — enterprise analytics | P2 |
| **Competitor Tracking** | Sprout, Socialinsider | Medium — agency value-add | P3 |
| **Mobile App** | Buffer, Hootsuite, Later | Medium — convenience factor | P3 |
| **White-Label** | SocialBee, custom solutions | Low — agency upsell | P3 |
| **A/B Testing** | Most enterprise tools | High — optimization requirement | P1 |
| **Rate Limiting** | All production tools | Critical — security/stability | P0 |

### Critical Missing Features (P0)
1. Rate limiting and API security
2. Video upload and processing
3. Image generation (DALL-E/Midjourney integration)
4. Instagram/Facebook API posting
5. Stripe payment integration

---

## 6. Features to Add (Prioritized)

### Priority Matrix

```
                    HIGH IMPACT
                         │
    ┌────────────────────┼────────────────────┐
    │  P0: DO NOW        │  P1: NEXT QUARTER  │
    │  - Rate Limiting   │  - Brand Voice     │
    │  - Stripe/Billing  │  - Team Features   │
    │  - Video Upload    │  - Approval Flow   │
    │  - Image Gen       │  - A/B Testing     │
    │  - Meta APIs       │  - LinkedIn OAuth  │
LOW ├────────────────────┼────────────────────┤ HIGH
EFFORT│ P3: BACKLOG       │  P2: SCHEDULED     │ EFFORT
    │  - Mobile App      │  - Engagement AI   │
    │  - White Label     │  - Automation      │
    │  - Competitor Track│  - Sentiment       │
    └────────────────────┼────────────────────┘
                         │
                    LOW IMPACT
```

### Detailed Roadmap

#### Phase 13: Production Hardening (P0) — 2-3 weeks
1. **Rate Limiting** — `@fastify/rate-limit` implementation
2. **Input Validation** — Zod schema validation on all endpoints
3. **Security Headers** — Helmet.js integration
4. **Error Boundaries** — Frontend crash protection
5. **Logging/Monitoring** — Structured logs, error tracking

#### Phase 14: Monetization (P0) — 3-4 weeks
1. **Stripe Integration** — Checkout, subscriptions, webhooks
2. **Usage Metering** — Track generations, campaigns, connections
3. **Feature Gating** — Middleware for tier-based access
4. **Billing Portal** — Manage subscriptions, invoices
5. **Usage Dashboard** — Show limits, upgrade prompts

#### Phase 15: Media Generation (P0) — 4-6 weeks
1. **Video Upload** — UploadThing integration complete
2. **Video Transcription** — Whisper API for content extraction
3. **Image Generation** — DALL-E 3 integration
4. **Media Library** — Asset management for generated media
5. **Carousel Support** — Multi-image post generation

#### Phase 16: Platform Expansion (P0/P1) — 4-6 weeks
1. **Meta Business API** — Instagram + Facebook posting
2. **LinkedIn OAuth** — Complete existing framework
3. **TikTok API** — Video posting support
4. **YouTube Shorts** — Short-form video distribution
5. **Platform Templates** — Optimized formats per network

#### Phase 17: Team & Collaboration (P1) — 4-6 weeks
1. **Organizations** — Multi-user accounts
2. **Roles & Permissions** — Admin, Editor, Viewer
3. **Approval Workflows** — Review queue with comments
4. **Activity Audit Log** — Who did what, when
5. **Shared Asset Library** — Team media repository

#### Phase 18: Intelligence (P2) — 6-8 weeks
1. **Brand Voice Training** — Custom tone/style per campaign
2. **Engagement Prediction** — ML-based performance scoring
3. **Best Time Optimization** — AI-powered scheduling
4. **A/B Testing Framework** — Variant generation and tracking
5. **Sentiment Analysis** — Comment/mention monitoring

---

## 7. Production-Readiness Gaps

### Critical Issues (Must Fix Before Launch)

#### 7.1 Security Gaps

| Issue | Risk Level | Fix |
|-------|------------|-----|
| No rate limiting | Critical | Add `@fastify/rate-limit` with tiered limits |
| No request size limits | High | Configure Fastify body limits (1MB default) |
| Missing security headers | High | Add Helmet.js middleware |
| XSS in user content | Medium | Sanitize with DOMPurify before render |
| No CSRF protection | Low | Not critical for JWT, but add for cookies |
| Platform param unvalidated | Medium | Enum validation in analytics endpoint |

**Recommended Security Config:**
```typescript
// Rate limiting
fastify.register(rateLimit, {
  max: 100,           // requests per window
  timeWindow: '1 minute',
  keyGenerator: (req) => req.headers['x-user-id'] || req.ip,
})

// Security headers
fastify.register(helmet, {
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
})
```

#### 7.2 Testing Gaps

| Gap | Current | Target | Fix |
|-----|---------|--------|-----|
| Backend unit tests | 13 tests, 3 files | 100+ tests, 90% coverage | Expand test suite |
| Frontend tests | 0 | 50+ component tests | Add React Testing Library |
| E2E tests | 0 | 20+ critical paths | Add Playwright |
| API integration tests | 0 | 30+ endpoint tests | Add Supertest |
| Coverage threshold | None | 80% enforced | Jest config |

**Recommended Test Structure:**
```
tests/
├── unit/
│   ├── backend/           # Service/util tests
│   └── frontend/          # Component unit tests
├── integration/
│   └── api/               # API endpoint tests
└── e2e/
    └── flows/             # User journey tests
```

#### 7.3 CI/CD Gaps

| Gap | Current | Target | Fix |
|-----|---------|--------|-----|
| Backend deployment | Manual | Automated | Add Railway GitHub Action |
| Coverage reporting | Local only | PR comments | Add Codecov/Coveralls |
| Pre-commit hooks | None | Lint + format | Add Husky + lint-staged |
| Security scanning | None | Automated | Add CodeQL, Dependabot |
| E2E in CI | None | Required | Add Playwright to workflow |

**Recommended CI Workflow:**
```yaml
# .github/workflows/ci.yml additions
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: github/codeql-action/analyze@v2

  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3

  e2e:
    runs-on: ubuntu-latest
    steps:
      - run: npx playwright test
```

#### 7.4 Environment & Config Gaps

| Gap | Fix |
|-----|-----|
| No env validation | Add Zod schema for env vars |
| Secrets in .env.example | Remove example API keys |
| No Docker setup | Add Dockerfile + docker-compose |
| Missing health checks | Add `/health` endpoint |
| No graceful shutdown | Add SIGTERM handlers for Fastify |

#### 7.5 Performance Gaps

| Gap | Current | Target | Fix |
|-----|---------|--------|-----|
| No caching | Direct DB queries | Redis cache | Add Redis for sessions/cache |
| No CDN | Server-served assets | Edge cached | Vercel handles frontend |
| No connection pooling | Prisma default | PgBouncer | Configure for production |
| No query optimization | All queries | Indexed, paginated | Add DB indexes, cursor pagination |
| Job polling | 5s intervals | Event-driven | Consider BullMQ or similar |

---

## 8. Quick Wins vs Deep Work

### Quick Wins (< 1 day each)

| Item | Effort | Impact | Description |
|------|--------|--------|-------------|
| Rate limiting | 2 hrs | High | `npm i @fastify/rate-limit` + 20 lines |
| Helmet.js | 1 hr | High | Security headers in 10 lines |
| Health endpoint | 30 min | Medium | Add `/health` with DB ping |
| Env validation | 2 hrs | Medium | Zod schema for all env vars |
| Error boundary | 1 hr | Medium | React error boundary component |
| Request logging | 1 hr | Medium | Structured request/response logging |
| Favicon + meta | 30 min | Low | Add proper branding assets |
| 404 page | 1 hr | Low | Custom not found page |
| Loading states | 2 hrs | Medium | Skeleton loaders for all pages |
| Platform enum validation | 30 min | Medium | Validate analytics platform param |

### Deep Work (> 1 week each)

| Item | Effort | Impact | Description |
|------|--------|--------|-------------|
| Stripe integration | 3-4 weeks | Critical | Full billing system |
| Video processing | 4-6 weeks | High | Upload, transcribe, generate |
| Image generation | 2-3 weeks | High | DALL-E integration |
| Meta Business API | 3-4 weeks | High | Instagram/Facebook posting |
| Team collaboration | 4-6 weeks | High | Multi-user, roles, permissions |
| Test suite | 3-4 weeks | High | 80%+ coverage target |
| E2E test suite | 2-3 weeks | Medium | Playwright critical paths |
| Brand voice AI | 4-6 weeks | Medium | Custom model fine-tuning |
| Mobile app | 8-12 weeks | Medium | React Native or PWA |

### Implementation Order (First 30 Days)

```
Week 1: Security Hardening (Quick Wins)
├── Day 1: Rate limiting + Helmet.js
├── Day 2: Input validation (Zod schemas)
├── Day 3: Health endpoint + error boundaries
├── Day 4: Request logging + env validation
└── Day 5: Security audit + documentation

Week 2: Payment Foundation
├── Day 1-2: Stripe account + SDK setup
├── Day 3-4: Subscription model + webhooks
└── Day 5: Feature gating middleware

Week 3: Payment Completion
├── Day 1-2: Checkout flow UI
├── Day 3-4: Billing portal integration
└── Day 5: Usage tracking + limits

Week 4: Testing Foundation
├── Day 1-2: Jest config + coverage thresholds
├── Day 3-4: Critical backend tests
└── Day 5: CI/CD updates + Codecov
```

---

## 9. Recommended First Build Ticket

### 🎫 Ticket: Production Security Hardening

**Title:** Implement rate limiting, security headers, and input validation

**Priority:** P0 (Blocker)
**Estimate:** 3-5 days
**Labels:** `security`, `infrastructure`, `production-ready`

---

#### Description

Before any public launch or monetization, the API must be hardened against common attack vectors. This ticket implements the minimum security requirements for production deployment.

#### Acceptance Criteria

- [ ] **Rate Limiting**
  - [ ] Global rate limit: 100 requests/minute per IP
  - [ ] Auth endpoints: 5 requests/minute per IP
  - [ ] AI generation: 10 requests/minute per user
  - [ ] Returns 429 with `Retry-After` header when exceeded
  - [ ] Configurable via environment variables

- [ ] **Security Headers** (Helmet.js)
  - [ ] Content-Security-Policy configured
  - [ ] X-Frame-Options: DENY
  - [ ] X-Content-Type-Options: nosniff
  - [ ] Strict-Transport-Security enabled
  - [ ] X-XSS-Protection enabled

- [ ] **Input Validation**
  - [ ] Zod schemas for all request bodies
  - [ ] Platform enum validated in analytics
  - [ ] Campaign name max length (200 chars)
  - [ ] Description max length (2000 chars)
  - [ ] Proper error messages for validation failures

- [ ] **Request Limits**
  - [ ] Body size limit: 1MB default, 10MB for uploads
  - [ ] URL length limit: 2048 characters
  - [ ] Header size limit: 8KB

- [ ] **Health Endpoint**
  - [ ] `GET /health` returns `{ status: 'ok', db: 'connected' }`
  - [ ] Database connectivity check
  - [ ] Returns 503 if unhealthy

- [ ] **Error Handling**
  - [ ] No stack traces in production responses
  - [ ] Structured error format: `{ error: string, code: string }`
  - [ ] Error logging with request context

#### Technical Implementation

```typescript
// 1. Install dependencies
npm install @fastify/rate-limit @fastify/helmet zod

// 2. Rate limiting (src/index.ts)
import rateLimit from '@fastify/rate-limit'

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => {
    // Use user ID if authenticated, else IP
    return req.headers['x-user-id']?.toString() || req.ip
  },
  errorResponseBuilder: (req, context) => ({
    error: 'Too many requests',
    code: 'RATE_LIMITED',
    retryAfter: context.after,
  }),
})

// 3. Security headers (src/index.ts)
import helmet from '@fastify/helmet'

await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
    },
  },
})

// 4. Input validation (src/lib/validation.ts)
import { z } from 'zod'

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional(),
  budget: z.number().positive().optional(),
})

export const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  platform: z.enum(['all', 'x', 'linkedin', 'facebook', 'instagram']).default('all'),
})

// 5. Health endpoint (src/routes/health.ts)
export async function healthHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'ok', db: 'connected', timestamp: new Date().toISOString() }
  } catch {
    return reply.status(503).send({ status: 'error', db: 'disconnected' })
  }
}
```

#### Files to Modify

| File | Changes |
|------|---------|
| `backend/package.json` | Add @fastify/rate-limit, @fastify/helmet, zod |
| `backend/src/index.ts` | Register rate-limit, helmet, health route |
| `backend/src/lib/validation.ts` | New file with Zod schemas |
| `backend/src/routes/health.ts` | New health check endpoint |
| `backend/src/routes/campaigns.ts` | Add Zod validation to handlers |
| `backend/src/routes/analytics.ts` | Validate platform enum |
| `backend/src/routes/social.ts` | Add Zod validation to handlers |

#### Testing

```typescript
// tests/security.test.ts
describe('Security', () => {
  it('should rate limit excessive requests', async () => {
    for (let i = 0; i < 110; i++) {
      await request(app).get('/api/campaigns')
    }
    const res = await request(app).get('/api/campaigns')
    expect(res.status).toBe(429)
  })

  it('should include security headers', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['x-frame-options']).toBe('DENY')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('should reject invalid input', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: '' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })
})
```

#### Definition of Done

- [ ] All acceptance criteria met
- [ ] Tests written and passing
- [ ] Security headers verified with securityheaders.com
- [ ] Rate limiting tested with load tool
- [ ] PR reviewed and approved
- [ ] Documentation updated
- [ ] Deployed to staging and verified

---

## Summary

Creator AI Hub has a solid foundation with modern tech and differentiated features. The path to production and profitability requires:

1. **Immediate:** Security hardening (this ticket)
2. **Next 30 days:** Stripe monetization + testing foundation
3. **Next 90 days:** Video/image generation + Meta APIs
4. **6 months:** Team features + advanced AI

With these improvements, Creator AI Hub can compete effectively in a $11.8B market while maintaining its technical edge and lower price point than incumbents.

---

## Sources

- [AI in Social Media Market Analysis](https://www.openpr.com/news/4374860/artificial-intelligence-ai-in-social-media-market-set)
- [Best AI Tools for Social Media 2026](https://www.digitalfirst.ai/blog/best-ai-tools-for-social-media-marketing)
- [Social Media AI Tools Tested](https://www.designrush.com/agency/social-media-marketing/trends/social-media-ai-tools)
- [Hootsuite Alternatives](https://planable.io/blog/hootsuite-alternatives/)
- [AI Social Media Content Generation](https://marketingagent.blog/2025/09/04/best-ai-tools-for-social-media-content-generation-2026/)
