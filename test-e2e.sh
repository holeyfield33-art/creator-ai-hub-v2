#!/bin/bash
# End-to-End Test Script for Creator AI Hub v2

set -e

echo "🧪 Creator AI Hub v2 - End-to-End Test"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test Results
PASSED=0
FAILED=0

test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

test_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

echo "📋 Step 1: Check Database Connection"
cd backend
if npx prisma db pull --force > /dev/null 2>&1; then
    test_pass "Database connection OK"
else
    test_fail "Database connection failed"
fi
cd ..
echo ""

echo "📋 Step 2: Check Backend Health"
sleep 2
HEALTH=$(curl -s http://localhost:3001/health 2>/dev/null || echo "")
if [[ "$HEALTH" == *"ok"* ]]; then
    test_pass "Backend health endpoint responding"
else
    test_fail "Backend not responding on :3001"
fi
echo ""

echo "📋 Step 3: Check Frontend"
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
if [[ "$FRONTEND" == "200" ]] || [[ "$FRONTEND" == "304" ]]; then
    test_pass "Frontend responding on :3000"
else
    test_fail "Frontend not responding (status: $FRONTEND)"
fi
echo ""

echo "📋 Step 4: Test Backend API Endpoints"

# Test /api/campaigns (should require auth)
CAMPAIGNS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/campaigns 2>/dev/null || echo "000")
if [[ "$CAMPAIGNS" == "401" ]]; then
    test_pass "Campaigns endpoint requires authentication"
else
    test_fail "Campaigns endpoint returned unexpected status: $CAMPAIGNS"
fi

# Test /api/me (should require auth)
ME=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/me 2>/dev/null || echo "000")
if [[ "$ME" == "401" ]]; then
    test_pass "/api/me endpoint requires authentication"
else
    test_fail "/api/me endpoint returned unexpected status: $ME"
fi
echo ""

echo "📋 Step 5: Check Environment Configuration"
cd backend
if grep -q "AI_API_KEY" .env 2>/dev/null; then
    test_pass "Environment variables configured"
else
    test_fail "Missing .env file or AI_API_KEY"
fi
cd ..
echo ""

echo "📋 Step 6: Verify Prisma Schema"
cd backend
if npx prisma validate > /dev/null 2>&1; then
    test_pass "Prisma schema is valid"
else
    test_fail "Prisma schema validation failed"
fi
cd ..
echo ""

echo "📋 Step 7: Check New Phase 13 Features"

# Check if UsageQuota table exists
cd backend
if npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM usage_quotas;" > /dev/null 2>&1; then
    test_pass "UsageQuota table exists"
else
    test_fail "UsageQuota table not found"
fi

# Check if CampaignSource has new fields
if npx prisma db execute --stdin <<< "SELECT status, transcriptText FROM campaign_sources LIMIT 1;" > /dev/null 2>&1; then
    test_pass "CampaignSource has new processing fields"
else
    test_fail "CampaignSource missing new fields"
fi
cd ..
echo ""

echo "========================================"
echo "📊 Test Results Summary"
echo "========================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Ready for production.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the output above.${NC}"
    exit 1
fi
