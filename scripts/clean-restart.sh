#!/bin/bash

echo "🧹 ProCheff v2 - Clean Restart Script"
echo "======================================"
echo ""

# 1. Kill all Node.js processes
echo "1️⃣ Killing all Node.js processes..."
killall -9 node 2>/dev/null && echo "   ✅ Node processes killed" || echo "   ℹ️  No Node processes found"

# 2. Kill all Next.js dev servers specifically
echo ""
echo "2️⃣ Killing Next.js dev servers..."
pkill -9 -f "next dev" 2>/dev/null && echo "   ✅ Next.js dev servers killed" || echo "   ℹ️  No Next.js dev servers found"
pkill -9 -f "npm run dev" 2>/dev/null && echo "   ✅ npm run dev processes killed" || echo "   ℹ️  No npm dev processes found"

# 3. Clean all ports
echo ""
echo "3️⃣ Cleaning ports 3000-3010..."
for port in {3000..3010}; do
  pid=$(lsof -ti:$port 2>/dev/null)
  if [ ! -z "$pid" ]; then
    kill -9 $pid 2>/dev/null && echo "   ✅ Port $port cleaned (PID: $pid)"
  fi
done

# 4. Wait for cleanup
echo ""
echo "4️⃣ Waiting for cleanup to complete..."
sleep 3

# 5. Remove Next.js cache
echo ""
echo "5️⃣ Removing Next.js cache..."
if [ -d ".next" ]; then
  rm -rf .next && echo "   ✅ .next directory removed"
else
  echo "   ℹ️  .next directory doesn't exist"
fi

# 6. Verify no processes remain
echo ""
echo "6️⃣ Verifying cleanup..."
remaining=$(ps aux | grep -E "next dev|npm run dev" | grep -v grep | wc -l)
if [ $remaining -eq 0 ]; then
  echo "   ✅ All processes cleaned successfully"
else
  echo "   ⚠️  Warning: $remaining process(es) still running"
  ps aux | grep -E "next dev|npm run dev" | grep -v grep
fi

# 7. Show environment info
echo ""
echo "7️⃣ Environment check..."
echo "   📂 Working directory: $(pwd)"
if [ -f ".env.local" ]; then
  echo "   ✅ .env.local exists"
  echo "   🔑 API Key (first 20 chars): $(grep ANTHROPIC_API_KEY .env.local | cut -d'=' -f2 | cut -c1-20)..."
else
  echo "   ❌ .env.local not found!"
fi

# 8. Start dev server
echo ""
echo "8️⃣ Starting clean dev server..."
echo "======================================"
echo ""

npm run dev
