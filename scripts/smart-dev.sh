#!/bin/bash

# ============================================================================
# SMART DEV SERVER STARTER
# Otomatik health check + dev server başlatma
# Kullanım: ./scripts/smart-dev.sh veya npm run dev:safe
# ============================================================================

# Dinamik proje dizini
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_DIR"

# 1. Health check çalıştır
if [ -f "./scripts/dev-healthcheck.sh" ]; then
    ./scripts/dev-healthcheck.sh
else
    echo "⚠️  Health check script bulunamadı, direkt başlatılıyor..."
fi

# 2. Dev server başlat
exec npm run dev
