# Phase 12 Plan: Analytics & Dashboard

## Goal
Implement analytics tracking and dashboard visualization for campaign performance, social post metrics, and user insights.

---

## Files to Touch

### Backend
- `backend/prisma/schema.prisma` - Add analytics models (PostMetric, CampaignMetric)
- `backend/src/routes/analytics.ts` - New analytics endpoints
- `backend/src/routes/campaigns.ts` - Add metrics endpoints
- `backend/src/worker.ts` - Add metrics collection job processor
- `backend/src/lib/social-metrics.ts` - Social platform API integration for metrics
- `backend/src/index.ts` - Register analytics routes

### Frontend
- `frontend/src/lib/analytics-api.ts` - Analytics API client
- `frontend/src/app/app/dashboard/page.tsx` - Dashboard overview page
- `frontend/src/app/app/campaigns/[id]/page.tsx` - Add metrics tab to campaign detail
- `frontend/src/components/charts/line-chart.tsx` - Line chart component
- `frontend/src/components/charts/bar-chart.tsx` - Bar chart component
- `frontend/src/components/analytics-card.tsx` - Metric display card
- `frontend/src/components/campaign-metrics.tsx` - Campaign-specific metrics

### Documentation
- `docs/analytics.md` - Analytics architecture and metrics documentation

---

## Implementation Steps

### Step 1: Database Schema (Prisma)
```prisma
model PostMetric {
  id              String   @id @default(cuid())
  scheduledPostId String
  scheduledPost   ScheduledPost @relation(fields: [scheduledPostId], references: [id], onDelete: Cascade)
  
  // Metrics
  impressions     Int      @default(0)
  engagements     Int      @default(0)
  likes           Int      @default(0)
  shares          Int      @default(0)
  comments        Int      @default(0)
  clicks          Int      @default(0)
  
  // Calculated
  engagementRate  Float?   @default(0)
  
  // Metadata
  fetchedAt       DateTime @default(now())
  platform        String   // twitter, linkedin, etc.
  externalId      String?  // Platform-specific post ID
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([scheduledPostId])
  @@index([platform])
}

model CampaignMetric {
  id            String   @id @default(cuid())
  campaignId    String
  campaign      Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  
  // Aggregate metrics
  totalPosts       Int      @default(0)
  totalImpressions Int      @default(0)
  totalEngagements Int      @default(0)
  avgEngagementRate Float?  @default(0)
  
  // Time-based
  periodStart      DateTime
  periodEnd        DateTime
  
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  @@index([campaignId])
  @@index([periodStart, periodEnd])
}
```

### Step 2: Backend Analytics Routes
**Endpoints:**
- `GET /api/analytics/dashboard` - Overview metrics for user
- `GET /api/analytics/campaigns/:id/metrics` - Campaign-specific metrics
- `GET /api/analytics/posts/:id/metrics` - Individual post metrics
- `POST /api/analytics/refresh` - Trigger metrics collection job

**Features:**
- Aggregate metrics by campaign
- Time-range filtering (last 7/30/90 days)
- Platform-specific breakdowns
- Engagement rate calculations
- Top performing content identification

### Step 3: Social Platform Metrics Integration
**Twitter/X API Integration:**
- Fetch tweet analytics (impressions, engagements, likes, retweets)
- Use OAuth 2.0 credentials from SocialConnection
- Store metrics in PostMetric table

**LinkedIn API Integration:**
- Fetch post statistics (impressions, clicks, engagement)
- Use OAuth credentials
- Store in PostMetric table

**Rate Limiting & Caching:**
- Respect platform API rate limits
- Cache metrics for 1 hour
- Queue background jobs for bulk fetching

### Step 4: Worker Metrics Collection
**New Job Type: `collect_metrics`**
```typescript
async function processCollectMetrics(job: Job) {
  const { scheduledPostId } = job.data;
  const post = await prisma.scheduledPost.findUnique({
    where: { id: scheduledPostId },
    include: { socialConnection: true }
  });
  
  if (!post || post.status !== 'posted' || !post.externalPostId) {
    throw new Error('Post not eligible for metrics collection');
  }
  
  const metrics = await fetchMetricsFromPlatform(
    post.socialConnection.platform,
    post.externalPostId,
    post.socialConnection.accessToken
  );
  
  await prisma.postMetric.create({
    data: {
      scheduledPostId: post.id,
      platform: post.socialConnection.platform,
      externalId: post.externalPostId,
      ...metrics
    }
  });
}
```

**Scheduled Collection:**
- Collect metrics 1 hour after post
- Collect again at 24 hours
- Collect again at 7 days
- Optional: Real-time webhook listeners

### Step 5: Frontend Dashboard Page
**Layout:**
```
Dashboard
├── Overview Cards (Total Posts, Impressions, Engagement Rate, Best Platform)
├── Engagement Chart (Line chart - last 30 days)
├── Top Campaigns (List with metrics)
└── Recent Activity (Timeline of posted content)
```

**Features:**
- Time range selector (7/30/90 days, custom)
- Platform filter (All, Twitter, LinkedIn, etc.)
- Export to CSV button
- Real-time updates (poll every 30s)

### Step 6: Campaign Metrics Tab
**Add to Campaign Detail Page:**
```
Campaign Detail
├── [Existing Tabs: Content, Analysis, Assets, Schedule]
└── Metrics Tab ← NEW
    ├── Summary Cards (Posts, Reach, Engagement)
    ├── Post Performance Table
    │   ├── Platform icon
    │   ├── Content preview
    │   ├── Posted date
    │   ├── Impressions
    │   ├── Engagements
    │   └── Engagement rate
    └── Performance Chart (Daily engagement)
```

### Step 7: Chart Components
**Line Chart (frontend/src/components/charts/line-chart.tsx):**
- Use lightweight charting library (recharts or Chart.js)
- Responsive design
- Tooltips with detailed metrics
- Multiple series support (compare platforms)

**Bar Chart (frontend/src/components/charts/bar-chart.tsx):**
- Horizontal bars for campaign comparison
- Color-coded by performance
- Click to drill down

---

## Test Plan

### Backend Tests
1. **POST Metrics Collection**
   - Create scheduled post with externalPostId
   - Trigger collect_metrics job
   - Verify PostMetric created with correct data
   - Mock social platform API responses

2. **GET Dashboard Metrics**
   - Create test data (campaigns, posts, metrics)
   - Call `/api/analytics/dashboard`
   - Verify aggregated metrics correct
   - Test time-range filtering

3. **GET Campaign Metrics**
   - Create campaign with multiple posts and metrics
   - Call `/api/analytics/campaigns/:id/metrics`
   - Verify calculations (engagement rate, totals)
   - Test unauthorized access (different user)

### Frontend Tests
1. **Dashboard Page Rendering**
   - Mock analytics API responses
   - Verify overview cards display correct values
   - Verify chart renders with data
   - Test loading and error states

2. **Campaign Metrics Tab**
   - Navigate to campaign detail
   - Click Metrics tab
   - Verify post performance table populated
   - Test sorting and filtering

3. **Chart Interactions**
   - Hover over data points (tooltips)
   - Change time range selector
   - Filter by platform
   - Verify data updates

### Integration Tests
1. **Metrics Collection Flow**
   - Post scheduled content to social platform
   - Wait for collect_metrics job to run
   - Verify metrics appear in dashboard
   - Verify metrics appear in campaign detail

2. **Real-time Updates**
   - Open dashboard
   - Post new content in another tab
   - Verify dashboard updates within 30s

### Manual Testing
1. Post content to X/Twitter with SocialConnection
2. Wait 1 hour for metrics collection
3. Navigate to dashboard - verify impressions/engagements displayed
4. Navigate to campaign detail - verify metrics tab shows post data
5. Export metrics to CSV - verify format

---

## Rollback Plan

### Database Rollback
```bash
# If schema changes cause issues
npx prisma migrate reset
npx prisma db push
```

### Code Rollback
1. **Remove analytics routes** from backend/src/index.ts
2. **Delete** `backend/src/routes/analytics.ts`
3. **Delete** `backend/src/lib/social-metrics.ts`
4. **Revert** worker.ts changes (remove collect_metrics processor)
5. **Delete** frontend dashboard page and components
6. **Revert** campaign detail page changes

### Git Strategy
- Branch: `feature/phase-12-analytics`
- Commit incrementally:
  - `chore: add analytics schema`
  - `feat(backend): analytics endpoints`
  - `feat(backend): metrics collection worker`
  - `feat(frontend): dashboard page`
  - `feat(frontend): campaign metrics tab`
- Can cherry-pick working commits if needed
- Squash before merge to main

### Feature Flag (Optional)
Add environment variable:
```env
ENABLE_ANALYTICS=true
```
Gate features behind flag for gradual rollout.

---

## Dependencies

### Backend
```json
{
  "dependencies": {
    "date-fns": "^3.0.0"  // Date manipulation for metrics
  }
}
```

### Frontend
```json
{
  "dependencies": {
    "recharts": "^2.10.0",  // Charting library
    "date-fns": "^3.0.0"     // Date formatting
  },
  "devDependencies": {
    "@types/recharts": "^1.8.0"
  }
}
```

---

## Environment Variables

### Backend
```env
# Social Platform API Keys (for metrics collection)
TWITTER_API_KEY=your_key_here
TWITTER_API_SECRET=your_secret_here
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_secret

# Metrics collection settings
METRICS_COLLECTION_ENABLED=true
METRICS_CACHE_TTL=3600  # 1 hour in seconds
```

---

## Success Criteria

✅ PostMetric and CampaignMetric models in database
✅ Backend analytics endpoints return correct data
✅ Worker collects metrics from social platforms
✅ Dashboard page displays overview metrics
✅ Campaign detail shows metrics tab with post performance
✅ Charts render correctly and are interactive
✅ Time-range filtering works
✅ Platform filtering works
✅ Engagement rate calculations accurate
✅ CSV export functionality works
✅ All tests pass
✅ No performance degradation (dashboard loads < 2s)
✅ Responsive design on mobile

---

## Out of Scope (Future Phases)

- Real-time webhook listeners from social platforms
- Predictive analytics / AI insights
- A/B testing framework
- Competitive analysis
- Sentiment analysis on comments
- Automated reporting (email digests)
- Custom metric dashboards

---

## Next Steps After Approval

1. Create branch: `git checkout -b feature/phase-12-analytics`
2. Run migration: `npx prisma migrate dev --name add_analytics_models`
3. Implement backend analytics routes
4. Implement metrics collection in worker
5. Install frontend chart dependencies
6. Implement dashboard page
7. Add metrics tab to campaign detail
8. Write tests (backend + frontend)
9. Test manually with real social connections
10. Commit with message: `feat(analytics): dashboard + campaign metrics`
11. Create PR to main

---

## Estimated Effort

- Database schema: 30 min
- Backend routes: 2 hours
- Social metrics integration: 3 hours
- Worker metrics collection: 2 hours
- Frontend dashboard: 4 hours
- Campaign metrics tab: 2 hours
- Chart components: 2 hours
- Testing: 3 hours
- Documentation: 1 hour

**Total: ~19 hours**
