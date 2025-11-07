#!/bin/bash

# ============================================================================
# DEV SERVER HEALTH CHECK & AUTO-FIX
# npm run dev çalıştırmadan ÖNCE otomatik kontrol ve temizlik
# ============================================================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}🏥 ProCheff Dev Server Health Check${NC}"
echo -e "${BLUE}============================================================================${NC}\n"

# Dinamik proje dizini
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_DIR"

# ============================================================================
# 1. Port 3000 Kontrolü
# ============================================================================
echo -e "${YELLOW}1️⃣ Port 3000 kontrolü...${NC}"
PORT_PID=$(lsof -ti:3000 2>/dev/null || echo "")

if [ ! -z "$PORT_PID" ]; then
    echo -e "   ${RED}⚠️  Port 3000 kullanımda (PID: $PORT_PID)${NC}"
    
    # Process detayı
    PROCESS_INFO=$(ps -p $PORT_PID -o comm= 2>/dev/null || echo "unknown")
    echo -e "   Process: $PROCESS_INFO"
    
    echo -e "   ${YELLOW}🔪 Temizleniyor...${NC}"
    kill -9 $PORT_PID 2>/dev/null
    sleep 1
    echo -e "   ${GREEN}✅ Port 3000 temizlendi${NC}"
else
    echo -e "   ${GREEN}✅ Port 3000 boş${NC}"
fi

# ============================================================================
# 2. Zombie Next.js Process Kontrolü
# ============================================================================
echo -e "\n${YELLOW}2️⃣ Zombie Next.js process kontrolü...${NC}"
ZOMBIE_PIDS=$(ps aux | grep -E "next dev|next-server" | grep -v grep | awk '{print $2}' || echo "")

if [ ! -z "$ZOMBIE_PIDS" ]; then
    ZOMBIE_COUNT=$(echo "$ZOMBIE_PIDS" | wc -l | xargs)
    echo -e "   ${RED}⚠️  $ZOMBIE_COUNT zombie process bulundu${NC}"
    
    echo "$ZOMBIE_PIDS" | while read pid; do
        if [ ! -z "$pid" ]; then
            kill -9 $pid 2>/dev/null
            echo -e "   🔪 Killed PID: $pid"
        fi
    done
    
    sleep 1
    echo -e "   ${GREEN}✅ Zombie process'ler temizlendi${NC}"
else
    echo -e "   ${GREEN}✅ Zombie process yok${NC}"
fi

# ============================================================================
# 3. .next Cache Kontrolü
# ============================================================================
echo -e "\n${YELLOW}3️⃣ .next cache kontrolü...${NC}"

if [ -d ".next" ]; then
    CACHE_SIZE=$(du -sh .next 2>/dev/null | cut -f1)
    CACHE_AGE=$(find .next -type f -mmin +60 2>/dev/null | wc -l | xargs)
    
    echo -e "   📦 Cache boyutu: $CACHE_SIZE"
    echo -e "   ⏰ 1 saatten eski dosya: $CACHE_AGE"
    
    # Cache 500MB'dan büyükse veya 100+ eski dosya varsa temizle
    if [[ "$CACHE_SIZE" == *G* ]] || [ "$CACHE_AGE" -gt 100 ]; then
        echo -e "   ${YELLOW}🗑️  Cache çok büyük veya eski, temizleniyor...${NC}"
        rm -rf .next
        echo -e "   ${GREEN}✅ Cache temizlendi${NC}"
    else
        echo -e "   ${GREEN}✅ Cache sağlıklı${NC}"
    fi
else
    echo -e "   ${BLUE}ℹ️  .next cache yok (ilk build olacak)${NC}"
fi

# ============================================================================
# 4. node_modules Sağlık Kontrolü
# ============================================================================
echo -e "\n${YELLOW}4️⃣ node_modules kontrolü...${NC}"

if [ ! -d "node_modules" ]; then
    echo -e "   ${RED}❌ node_modules bulunamadı${NC}"
    echo -e "   ${YELLOW}📦 npm install çalıştırılıyor...${NC}"
    npm install
    echo -e "   ${GREEN}✅ Bağımlılıklar yüklendi${NC}"
else
    # package.json daha yeni mi kontrol et
    if [ "package.json" -nt "node_modules" ]; then
        echo -e "   ${YELLOW}⚠️  package.json değişmiş${NC}"
        echo -e "   ${YELLOW}📦 npm install çalıştırılıyor...${NC}"
        npm install
        echo -e "   ${GREEN}✅ Bağımlılıklar güncellendi${NC}"
    else
        echo -e "   ${GREEN}✅ node_modules güncel${NC}"
    fi
fi

# ============================================================================
# 5. .env.local Kontrolü
# ============================================================================
echo -e "\n${YELLOW}5️⃣ Environment variables kontrolü...${NC}"

if [ ! -f ".env.local" ]; then
    echo -e "   ${RED}❌ .env.local bulunamadı${NC}"
    
    if [ -f ".env.example" ]; then
        echo -e "   ${YELLOW}📋 .env.example kopyalanıyor...${NC}"
        cp .env.example .env.local
        echo -e "   ${YELLOW}⚠️  UYARI: .env.local'i düzenleyin ve API keylerini ekleyin!${NC}"
    else
        echo -e "   ${RED}❌ .env.example da bulunamadı!${NC}"
    fi
else
    # Critical keys kontrolü
    MISSING_KEYS=()
    
    # ANTHROPIC_API_KEY kontrolü (hem tırnaklı hem tırnaksız)
    if ! grep -qE 'ANTHROPIC_API_KEY=["'\'']?sk-ant-' .env.local 2>/dev/null; then
        MISSING_KEYS+=("ANTHROPIC_API_KEY")
    fi
    
    # IHALEBUL_USERNAME kontrolü (boş olmamalı)
    if ! grep -qE 'IHALEBUL_USERNAME=["'\'']?.+["'\'']?' .env.local 2>/dev/null; then
        MISSING_KEYS+=("IHALEBUL_USERNAME")
    fi
    
    if [ ${#MISSING_KEYS[@]} -gt 0 ]; then
        echo -e "   ${YELLOW}⚠️  Eksik veya geçersiz API keys: ${MISSING_KEYS[*]}${NC}"
    else
        echo -e "   ${GREEN}✅ Temel environment variables mevcut${NC}"
    fi
fi

# ============================================================================
# 6. Terminal Cleanup
# ============================================================================
echo -e "\n${YELLOW}6️⃣ Terminal temizleme...${NC}"
OPEN_TERMS=$(ps aux | grep -i terminal | grep -v grep | wc -l | xargs)
echo -e "   📊 Açık terminal sayısı: $OPEN_TERMS"

if [ "$OPEN_TERMS" -gt 5 ]; then
    echo -e "   ${YELLOW}⚠️  Çok fazla terminal açık (önerim: temizleyin)${NC}"
else
    echo -e "   ${GREEN}✅ Terminal sayısı normal${NC}"
fi

# ============================================================================
# Final Report
# ============================================================================
echo -e "\n${BLUE}============================================================================${NC}"
echo -e "${GREEN}✨ Health check tamamlandı!${NC}"
echo -e "${BLUE}============================================================================${NC}\n"

echo -e "${GREEN}🚀 Dev server başlatılıyor...${NC}\n"
sleep 1
