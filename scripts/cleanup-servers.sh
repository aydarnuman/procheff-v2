#!/bin/bash

# 🧹 ProCheff Server Cleanup Script
# Sadece procheff-v2 projesi için çalışan zombie server'ları temizler

echo "🔍 ProCheff server'ları aranıyor..."

# Dinamik olarak proje dizinini bul
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo "📂 Proje dizini: $PROJECT_DIR"

# Sadece bu projede çalışan Next.js server'larını bul
PROCHEFF_PIDS=$(ps aux | grep "next dev" | grep "$PROJECT_DIR" | grep -v grep | awk '{print $2}')

if [ -z "$PROCHEFF_PIDS" ]; then
    echo "✅ Temizlenecek server bulunamadı"
else
    echo "🗑️  Bulunan server'lar:"
    ps aux | grep "next dev" | grep "$PROJECT_DIR" | grep -v grep

    echo ""
    echo "🔪 Temizleniyor..."
    echo "$PROCHEFF_PIDS" | xargs kill -9 2>/dev/null

    echo "✅ Temizleme tamamlandı!"
fi

# .next cache'ini temizle (opsiyonel)
if [ -d "$PROJECT_DIR/.next" ]; then
    echo ""
    echo "🗑️  .next cache temizleniyor..."
    rm -rf "$PROJECT_DIR/.next"
    echo "✅ Cache temizlendi!"
fi

echo ""
echo "🚀 Yeni server başlatmak için: cd $PROJECT_DIR && npm run dev"
