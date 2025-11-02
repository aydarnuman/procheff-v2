#!/bin/bash

# 🧹 ProCheff Server Cleanup Script
# Sadece procheff-v2 projesi için çalışan zombie server'ları temizler

echo "🔍 ProCheff server'ları aranıyor..."

# Sadece procheff-v2 dizininde çalışan Next.js server'larını bul
PROCHEFF_PIDS=$(ps aux | grep "next dev" | grep "procheff-v2" | grep -v grep | awk '{print $2}')

if [ -z "$PROCHEFF_PIDS" ]; then
    echo "✅ Temizlenecek server bulunamadı"
else
    echo "🗑️  Bulunan server'lar:"
    ps aux | grep "next dev" | grep "procheff-v2" | grep -v grep

    echo ""
    echo "🔪 Temizleniyor..."
    echo "$PROCHEFF_PIDS" | xargs kill -9 2>/dev/null

    echo "✅ Temizleme tamamlandı!"
fi

# .next cache'ini temizle (opsiyonel)
if [ -d "/Users/numanaydar/Desktop/procheff-v2/.next" ]; then
    echo ""
    echo "🗑️  .next cache temizleniyor..."
    rm -rf /Users/numanaydar/Desktop/procheff-v2/.next
    echo "✅ Cache temizlendi!"
fi

echo ""
echo "🚀 Yeni server başlatmak için: cd /Users/numanaydar/Desktop/procheff-v2 && npm run dev"
