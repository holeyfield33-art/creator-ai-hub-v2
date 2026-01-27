#!/bin/bash

echo "📦 Installing dependencies..."
npm install

echo "🗄️ Running database migrations..."
cd backend
npx prisma migrate deploy
npx prisma generate

echo "✅ Build completed successfully!"
