#!/bin/bash
# Simple dev server startup and test

echo "🚀 Starting Creator AI Hub v2 Dev Servers"
echo "=========================================="
echo ""

# Kill any existing servers
echo "Stopping existing servers..."
pkill -f "nodemon" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 2

# Start backend
echo "Starting backend on :3001..."
cd /workspaces/creator-ai-hub-v2/backend
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Start frontend
echo "Starting frontend on :3000..."
cd /workspaces/creator-ai-hub-v2/frontend
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo ""
echo "⏳ Waiting for servers to start..."
sleep 8

echo ""
echo "🔍 Testing servers..."
echo ""

# Test backend
echo -n "Backend (http://localhost:3001/health): "
if curl -s http://localhost:3001/health | grep -q "ok"; then
    echo "✅ OK"
else
    echo "❌ FAILED"
    echo "Backend logs:"
    tail -20 /tmp/backend.log
fi

# Test frontend
echo -n "Frontend (http://localhost:3000): "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
if [[ "$STATUS" == "200" ]] || [[ "$STATUS" == "304" ]]; then
    echo "✅ OK"
else
    echo "❌ FAILED (status: $STATUS)"
    echo "Frontend logs:"
    tail -20 /tmp/frontend.log
fi

echo ""
echo "=========================================="
echo "✅ Dev servers are running!"
echo ""
echo "📍 URLs:"
echo "   Backend:  http://localhost:3001"
echo "   Frontend: http://localhost:3000"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f /tmp/backend.log"
echo "   Frontend: tail -f /tmp/frontend.log"
echo ""
echo "🛑 To stop: pkill -f 'nodemon|next dev'"
echo "=========================================="
