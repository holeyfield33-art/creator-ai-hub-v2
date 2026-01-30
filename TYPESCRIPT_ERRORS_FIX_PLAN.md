# Remaining TypeScript Errors - Fix Plan

## Status
Backend won't start due to TypeScript compilation errors. There are ~51 remaining errors primarily related to:

1. **Prisma model name mismatches** - Most fixed, but a few remain
2. **Missing relation includes** - Code accesses relations that aren't loaded
3. **Type annotations** - Some parameters need explicit types

## Quick Fix to Get Server Running

### Option 1: Skip Type Checking (Fastest)
```bash
cd backend
# Start with --transpile-only flag
npx ts-node --transpile-only src/index.ts
```

### Option 2: Use tsx instead of ts-node
```bash
npm install -D tsx
# Update package.json dev script to: "tsx watch src/index.ts"
```

## Remaining Errors by File

### src/routes/campaigns.ts
- Line 650: `asset.campaign` should be `asset.campaigns` (relation name)
- Lines 94, 125: `sources` should be `campaign_sources` in include/select
- Lines 498: `analyses` should be `campaign_analysis`

### src/worker.ts  
- Line 385: Accessing `.social_connections` on object that doesn't have relation loaded
- Need to add `include: { social_connections: true }` to the query

### src/routes/analytics.ts
- Multiple lines trying to access `.metrics` relation without including it
- Lines 64, 341: Add `include: { post_metrics: true }`
- Lines 144, 243: `generatedAssets`/`scheduledPosts` should be snake_case in includes

### src/lib/safety-guards.ts
- Line 49: `campaign:` should be `campaigns:` in where clause

### Other Files
- Missing `updatedAt` in create operations (should be auto-handled by @updatedAt directive)
- Type annotations needed for callback parameters

## Systematic Fix Approach

### 1. Fix Relation Names in Queries
All Prisma relation fields use snake_case plurals. Update:
- `sources` → `campaign_sources`  
- `generatedAssets` → `generated_assets`
- `analyses` → `campaign_analysis`
- `scheduledPosts` → `scheduled_posts`
- `metrics` → `post_metrics`
- `socialConnection` → `social_connections`

### 2. Fix Property Access
When accessing relations, use the field name from the schema:
- `campaign.sources` → `campaign.campaign_sources`
- `asset.campaign` → `asset.campaigns`  
- `post.metrics` → `post.post_metrics`

### 3. Add Missing Includes
Where code accesses a relation, ensure the query includes it:
```typescript
// Before
const post = await prisma.scheduled_posts.findFirst({  where: { id } })
const metrics = post.metrics // ERROR!

// After
const post = await prisma.scheduled_posts.findFirst({
  where: { id },
  include: { post_metrics: true }
})
const metrics = post.post_metrics // OK
```

## Automated Fix Script

```bash
#!/bin/bash
cd /workspaces/creator-ai-hub-v2/backend/src

# Fix remaining model references
find . -name "*.ts" -exec sed -i \
  -e "s/\.campaign /.campaigns /g" \
  -e "s/\.campaign'/.campaigns'/g" \
  -e 's/{ sources:/{ campaign_sources:/g' \
  -e 's/{ analyses:/{ campaign_analysis:/g' \
  -e 's/{ generatedAssets:/{ generated_assets:/g' \
  -e 's/{ scheduledPosts:/{ scheduled_posts:/g' \
  -e 's/{ metrics:/{ post_metrics:/g' \
  -e 's/{ socialConnection:/{ social_connections:/g' \
  -e 's/{ asset:/{ generated_assets:/g' \
  {} \;

echo "Fixed relation names"
```

## Testing Strategy

1. **Start server with transpileOnly**: `npx ts-node --transpile-only src/index.ts`
2. **Test critical endpoints**:
   - `GET /health` - Should return OK
   - `POST /api/login` - Auth flow
   - `GET /api/campaigns` - List campaigns
3. **Fix runtime errors as they occur**
4. **Re-enable type checking once server is stable**

## Files Modified Today

- `prisma/schema.prisma` - Added @updatedAt directives
- `tsconfig.json` - Added transpileOnly option
- `src/**/*.ts` - Partial model name fixes
- `fix-prisma-names.py` - Created automated fix script

## Next Steps

1. Use tsx or transpileOnly to start server
2. Test core functionality
3. Fix errors systematically file-by-file
4. Re-enable strict type checking
5. Commit working state

## Rollback Plan

If issues persist:
```bash
git stash
git checkout HEAD~1  # Before today's changes
npm install
npx prisma generate
npm run dev
```
