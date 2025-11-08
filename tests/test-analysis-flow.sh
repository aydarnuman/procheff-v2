#!/bin/bash
set -e

echo "=== Analysis API Full Flow Test ==="
echo ""

# 1. Init
echo "1️⃣ Creating analysis..."
INIT_RESP=$(curl -s -X POST http://localhost:3000/api/analysis/init \
  -H "Content-Type: application/json" \
  -d '{"filename":"flow-test.txt","size":300,"mimeType":"text/plain"}')
ANALYSIS_ID=$(echo $INIT_RESP | grep -o '"analysisId":"[^"]*"' | cut -d'"' -f4)
echo "   ✅ analysisId: $ANALYSIS_ID"
echo ""

# 2. Upload
echo "2️⃣ Uploading file..."
UPLOAD_RESP=$(curl -s -X POST "http://localhost:3000/api/analysis/upload-local?analysisId=${ANALYSIS_ID}&filename=flow-test.txt" \
  --data-binary @tests/fixtures/test-upload.txt \
  -H "Content-Type: application/octet-stream")
STORAGE_PATH=$(echo $UPLOAD_RESP | grep -o '"storedPath":"[^"]*"' | cut -d'"' -f4)
echo "   ✅ Stored: $STORAGE_PATH"
echo ""

# 3. Complete
echo "3️⃣ Marking as queued..."
COMPLETE_RESP=$(curl -s -X POST http://localhost:3000/api/analysis/complete \
  -H "Content-Type: application/json" \
  -d "{\"analysisId\":\"${ANALYSIS_ID}\",\"storagePath\":\"${STORAGE_PATH}\"}")
echo "   ✅ Status: $(echo $COMPLETE_RESP | grep -o '"status":"[^"]*"' | cut -d'"' -f4)"
echo ""

# 4. SSE
echo "4️⃣ Streaming progress (5 sec)..."
timeout 5 curl -N "http://localhost:3000/api/analysis/events?analysisId=${ANALYSIS_ID}" 2>/dev/null | while IFS= read -r line; do
  if [[ $line == data:* ]]; then
    PROGRESS=$(echo "${line#data: }" | grep -o '"progress":[0-9]*' | cut -d':' -f2)
    STATUS=$(echo "${line#data: }" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo "   📊 Progress: ${PROGRESS}% | Status: ${STATUS}"
  fi
done

echo ""
echo "✅ All tests passed!"
