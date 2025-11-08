#!/bin/bash

# ProCheff v2 Restore Script
# Backup'tan geri yükleme

set -e

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKUP_DIR="/opt/procheff-backups"

echo -e "${BLUE}🔄 ProCheff v2 Restore${NC}"
echo ""

# Mevcut backupları listele
echo -e "${BLUE}📋 Mevcut Backuplar:${NC}"
echo "-----------------------------------"
ls -lht $BACKUP_DIR/database-*.db 2>/dev/null | head -10 | awk '{print NR". "$9" ("$5")"}'
echo "-----------------------------------"
echo ""

# Kullanıcıdan seçim al
read -p "Hangi backup'ı restore etmek istiyorsun? (1-10, veya 'q' çık): " CHOICE

if [ "$CHOICE" = "q" ]; then
    echo "❌ İptal edildi."
    exit 0
fi

# Seçilen backup dosyasını al
BACKUP_FILE=$(ls -t $BACKUP_DIR/database-*.db 2>/dev/null | sed -n "${CHOICE}p")

if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Geçersiz seçim!${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}⚠️  DİKKAT: Mevcut database silinecek!${NC}"
echo -e "${BLUE}Restore edilecek: $(basename $BACKUP_FILE)${NC}"
read -p "Devam etmek istiyor musun? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ İptal edildi."
    exit 0
fi

# Container'ı durdur
echo -e "${BLUE}⏸️  Container durduruluyor...${NC}"
docker compose -f /opt/procheff-v2/docker-compose.yml stop

# Mevcut database'i yedekle
echo -e "${BLUE}💾 Mevcut database yedekleniyor...${NC}"
SAFETY_BACKUP="$BACKUP_DIR/safety-backup-$(date +%Y%m%d-%H%M%S).db"
docker cp procheff-app:/app/data/ihale-scraper.db $SAFETY_BACKUP 2>/dev/null || true
echo -e "${GREEN}✅ Safety backup: $SAFETY_BACKUP${NC}"

# Restore
echo -e "${BLUE}📥 Restore ediliyor...${NC}"
docker cp $BACKUP_FILE procheff-app:/app/data/ihale-scraper.db

# Container'ı başlat
echo -e "${BLUE}▶️  Container başlatılıyor...${NC}"
docker compose -f /opt/procheff-v2/docker-compose.yml start

echo ""
echo -e "${GREEN}✅ Restore tamamlandı!${NC}"
echo -e "${BLUE}📍 Restore edilen: $(basename $BACKUP_FILE)${NC}"
echo -e "${BLUE}💾 Safety backup: $SAFETY_BACKUP${NC}"
echo ""
echo -e "${YELLOW}ℹ️  Health check:${NC} curl http://localhost:3000/api/health"
