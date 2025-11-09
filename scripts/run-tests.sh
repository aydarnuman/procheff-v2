#!/usr/bin/env bash
set -euo pipefail

export NEXT_TELEMETRY_DISABLED=1

echo "🚀 Dev server başlatılıyor..."
PORT=3000 npm run -s dev >/tmp/procheff_test_dev.log 2>&1 &
SERVER_PID=$!

cleanup() {
  echo "\n🛑 Sunucu kapatılıyor (PID $SERVER_PID)..."
  kill $SERVER_PID 2>/dev/null || true
  wait $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

echo "⏳ Sunucu hazır bekleniyor..."
for i in {1..60}; do
  if node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "✅ Sunucu hazır."
    break
  fi
  sleep 0.5
  if [ $i -eq 60 ]; then
    echo "❌ Sunucu zamanında hazır olmadı. Log kuyruğu:" >&2
    tail -n 150 /tmp/procheff_test_dev.log || true
    exit 1
  fi
done

set +e
echo "\n🧪 Smoke test (JS)..."
node tests/smoke-test.js
SMOKE=$?

echo "\n🧪 AI extraction test (JS)..."
node tests/ai-extraction-test.js
AI=$?

echo "\n📋 Sonuç: smoke=$SMOKE ai=$AI"
if [ $SMOKE -ne 0 ] || [ $AI -ne 0 ]; then
  exit 1
fi
exit 0

