#!/bin/bash

# ProCheff v2 Backup Script
# Database, uploads ve logs yedekleme

set -e

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Tarih
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/opt/procheff-backups"

echo -e "${BLUE}🔄 ProCheff v2 Backup Başlatılıyor...${NC}"

# Backup klasörü oluştur
mkdir -p $BACKUP_DIR

# 1. Database backup
echo -e "${BLUE}📦 Database yedekleniyor...${NC}"
docker cp procheff-app:/app/data/ihale-scraper.db $BACKUP_DIR/database-$DATE.db
echo -e "${GREEN}✅ Database yedeklendi: database-$DATE.db${NC}"

# 2. Uploads backup (eğer varsa)
if docker exec procheff-app test -d /app/public/uploads; then
    echo -e "${BLUE}📁 Uploads yedekleniyor...${NC}"
    docker cp procheff-app:/app/public/uploads $BACKUP_DIR/uploads-$DATE
    tar -czf $BACKUP_DIR/uploads-$DATE.tar.gz -C $BACKUP_DIR uploads-$DATE
    rm -rf $BACKUP_DIR/uploads-$DATE
    echo -e "${GREEN}✅ Uploads yedeklendi: uploads-$DATE.tar.gz${NC}"
fi

# 3. Logs backup
echo -e "${BLUE}📝 Logs yedekleniyor...${NC}"
docker cp procheff-app:/app/logs $BACKUP_DIR/logs-$DATE
tar -czf $BACKUP_DIR/logs-$DATE.tar.gz -C $BACKUP_DIR logs-$DATE
rm -rf $BACKUP_DIR/logs-$DATE
echo -e "${GREEN}✅ Logs yedeklendi: logs-$DATE.tar.gz${NC}"

# 4. Full backup (hepsi)
echo -e "${BLUE}🗜️  Full backup oluşturuluyor...${NC}"
tar -czf $BACKUP_DIR/full-backup-$DATE.tar.gz \
    $BACKUP_DIR/database-$DATE.db \
    $BACKUP_DIR/uploads-$DATE.tar.gz \
    $BACKUP_DIR/logs-$DATE.tar.gz \
    2>/dev/null || true

# 5. Eski backupları temizle (30 günden eski)
echo -e "${BLUE}🧹 Eski backuplar temizleniyor (30+ gün)...${NC}"
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
echo -e "${GREEN}✅ Eski backuplar temizlendi${NC}"

# 6. Backup boyutları
echo ""
echo -e "${BLUE}📊 Backup Özeti:${NC}"
echo "-----------------------------------"
ls -lh $BACKUP_DIR/*$DATE* | awk '{print $9, "-", $5}'
echo "-----------------------------------"
echo ""

# 7. Toplam boyut
TOTAL_SIZE=$(du -sh $BACKUP_DIR | awk '{print $1}')
echo -e "${GREEN}📦 Toplam backup boyutu: $TOTAL_SIZE${NC}"
echo -e "${GREEN}✅ Backup tamamlandı!${NC}"
echo ""
echo -e "${BLUE}📍 Backup lokasyonu: $BACKUP_DIR${NC}"
