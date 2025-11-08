#!/bin/bash

# ============================================================================
# Procheff-v2 - Old Files Cleanup Script
# ============================================================================
# Temizler:
# - .next/ (development cache) - 70MB
# - Eski orchestrator logları (7+ gün) - 40KB
# - Eski session klasörleri (3+ gün) - 1MB
# - deploy.log
# - npm cache verify
# ============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo "🧹 Procheff-v2 Temizlik Başlatılıyor..."
echo "📂 Proje: $PROJECT_DIR"
echo ""

# 1. .next klasörü (development cache)
if [ -d "$PROJECT_DIR/.next" ]; then
  SIZE=$(du -sh "$PROJECT_DIR/.next" | cut -f1)
  echo "🗑️  .next/ klasörü siliniyor ($SIZE)..."
  rm -rf "$PROJECT_DIR/.next"
  echo "   ✅ Silindi"
fi

# 2. Eski orchestrator logları (7+ gün öncesi)
echo ""
echo "📝 Eski orchestrator logları temizleniyor (7+ gün öncesi)..."
if [ -d "$PROJECT_DIR/logs/orchestrator" ]; then
  DELETED_LOGS=$(find "$PROJECT_DIR/logs/orchestrator" -name "*.log" -mtime +7 -print | wc -l | tr -d ' ')
  find "$PROJECT_DIR/logs/orchestrator" -name "*.log" -mtime +7 -delete
  echo "   ✅ $DELETED_LOGS log dosyası silindi"
else
  echo "   ℹ️  Log klasörü bulunamadı"
fi

# 3. Eski session dosyaları (3+ gün öncesi)
echo ""
echo "📁 Eski session klasörleri temizleniyor (3+ gün öncesi)..."
if [ -d "$PROJECT_DIR/data/sessions" ]; then
  DELETED_SESSIONS=$(find "$PROJECT_DIR/data/sessions" -maxdepth 1 -type d -name "tender_*" -mtime +3 -print | wc -l | tr -d ' ')
  find "$PROJECT_DIR/data/sessions" -maxdepth 1 -type d -name "tender_*" -mtime +3 -exec rm -rf {} +
  echo "   ✅ $DELETED_SESSIONS session klasörü silindi"
else
  echo "   ℹ️  Sessions klasörü bulunamadı"
fi

# 4. deploy.log (eski)
if [ -f "$PROJECT_DIR/deploy.log" ]; then
  echo ""
  echo "📋 deploy.log siliniyor..."
  rm -f "$PROJECT_DIR/deploy.log"
  echo "   ✅ Silindi"
fi

# 5. npm cache verify
echo ""
echo "📦 npm cache doğrulanıyor..."
npm cache verify --silent 2>/dev/null
echo "   ✅ Cache doğrulandı"

echo ""
echo "✨ Temizlik tamamlandı!"
echo ""

# Sonuç özeti
echo "📊 Sonuç Özeti:"
if [ -d "$PROJECT_DIR/node_modules" ]; then
  echo "   node_modules: $(du -sh "$PROJECT_DIR/node_modules" 2>/dev/null | cut -f1) (korundu)"
fi
if [ -d "$PROJECT_DIR/data/sessions" ]; then
  echo "   data/sessions: $(du -sh "$PROJECT_DIR/data/sessions" 2>/dev/null | cut -f1)"
fi
if [ -d "$PROJECT_DIR/logs" ]; then
  echo "   logs: $(du -sh "$PROJECT_DIR/logs" 2>/dev/null | cut -f1)"
fi
echo ""
echo "💡 İpucu: 'npm run dev' komutu .next klasörünü otomatik oluşturacak"
