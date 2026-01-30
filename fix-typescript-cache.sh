#!/bin/bash
# Script to fix VS Code TypeScript cache issues after Prisma schema changes

echo "🔧 Fixing TypeScript cache issues..."

# Step 1: Clean Prisma client
echo "1️⃣ Cleaning Prisma client cache..."
cd backend
rm -rf node_modules/.prisma node_modules/@prisma
npx prisma generate --schema=./prisma/schema.prisma
cd ..

# Step 2: Clean TypeScript build info
echo "2️⃣ Cleaning TypeScript build cache..."
find . -name "*.tsbuildinfo" -delete 2>/dev/null

# Step 3: Touch files to trigger reload
echo "3️⃣ Triggering VS Code reload..."
touch backend/src/lib/safety-guards.ts
touch backend/src/lib/processing-pipeline.ts
touch backend/src/routes/campaigns.ts
touch frontend/src/lib/api.ts

# Step 4: Verify compilation
echo "4️⃣ Verifying compilation..."
cd backend && npx tsc --noEmit && echo "✅ Backend compiles successfully"
cd ../frontend && npx tsc --noEmit && echo "✅ Frontend compiles successfully"
cd ..

echo ""
echo "✅ All done!"
echo ""
echo "If VS Code still shows errors:"
echo "1. Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)"
echo "2. Type 'TypeScript: Restart TS Server'"
echo "3. Press Enter"
echo ""
echo "Or simply reload the VS Code window:"
echo "Cmd+Shift+P → 'Developer: Reload Window'"
