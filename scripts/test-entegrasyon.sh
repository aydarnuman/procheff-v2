#!/bin/bash

# İhale Merkezi Entegrasyon - Quick Test Script
# Bu script yeni entegrasyonu hızlıca test eder

set -e # Exit on error

echo "🚀 İhale Merkezi Entegrasyon Test Başlıyor..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Package kontrolü
echo "📦 Test 1: Paket kontrolü..."
if npm list idb-keyval &> /dev/null; then
    echo -e "${GREEN}✅ idb-keyval paketi yüklü${NC}"
else
    echo -e "${RED}❌ idb-keyval paketi eksik${NC}"
    echo "   Çözüm: npm install"
    exit 1
fi

# Test 2: Dosya kontrolü
echo ""
echo "📁 Test 2: Dosya kontrolü..."

FILES=(
    "src/app/api/ai-status/route.ts"
    "src/app/api/profile/route.ts"
    "src/lib/ui/normalizeProgress.ts"
    "src/lib/storage/idb-adapter.ts"
    "src/lib/net/polling.ts"
    "src/components/ihale/FilterBar.tsx"
)

ALL_FILES_EXIST=true
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file eksik${NC}"
        ALL_FILES_EXIST=false
    fi
done

if [ "$ALL_FILES_EXIST" = false ]; then
    echo -e "${RED}Bazı dosyalar eksik!${NC}"
    exit 1
fi

# Test 3: TypeScript kontrolü
echo ""
echo "🔍 Test 3: TypeScript kontrolü..."
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
    echo -e "${RED}❌ TypeScript hataları var${NC}"
    npx tsc --noEmit | head -20
    exit 1
else
    echo -e "${GREEN}✅ TypeScript hataları yok${NC}"
fi

# Test 4: Feature flag kontrolü
echo ""
echo "🚦 Test 4: Feature flag kontrolü..."
if [ -f ".env.local" ]; then
    if grep -q "NEXT_PUBLIC_USE_ZUSTAND_STORE=true" .env.local; then
        echo -e "${YELLOW}⚠️  Feature flag AKTİF (Zustand store kullanılıyor)${NC}"
    else
        echo -e "${GREEN}✅ Feature flag KAPALI (useState kullanılıyor - güvenli)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env.local bulunamadı${NC}"
    echo "   İsteğe bağlı: cp .env.example .env.local"
fi

# Test 5: Store import kontrolü
echo ""
echo "📦 Test 5: Store import kontrolü..."
if grep -q "idbStorage" src/lib/stores/ihale-robotu-store.ts; then
    echo -e "${GREEN}✅ IndexedDB adapter entegre${NC}"
else
    echo -e "${RED}❌ IndexedDB adapter entegre değil${NC}"
    exit 1
fi

# Özet
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 TÜM TESTLER BAŞARILI!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Sonraki adımlar:"
echo "1. Dev server başlat: npm run dev"
echo "2. Test URL: http://localhost:3000/ihale-robotu"
echo "3. Console kontrol: /ai-status ve /profile 200 OK"
echo "4. FilterBar test: arama, şehir, tarih filtreleri"
echo ""
echo "Feature flag aktif etmek için:"
echo "  echo 'NEXT_PUBLIC_USE_ZUSTAND_STORE=true' >> .env.local"
echo ""
echo "Detaylı rehber: IHALE-MERKEZI-ENTEGRASYON-RAPORU.md"
echo ""
