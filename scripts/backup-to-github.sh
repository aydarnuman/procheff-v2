#!/bin/bash

# ProCheff v2 - GitHub Backup Script
# Ana repo'yu backup repo'ya kopyalar

set -e

echo "🔄 GitHub Backup başlatılıyor..."

# Renk kodları
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Git durumunu kontrol et
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${BLUE}⚠️  Uncommitted değişiklikler var!${NC}"
    read -p "Devam et? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ İptal edildi"
        exit 1
    fi
fi

# Önce origin'e push
echo -e "${BLUE}📤 Origin'e push ediliyor...${NC}"
git push origin main

# Sonra backup'a push
echo -e "${BLUE}💾 Backup repo'ya push ediliyor...${NC}"
git push backup main --force

# Tag'leri de push et
echo -e "${BLUE}🏷️  Tag'ler push ediliyor...${NC}"
git push backup --tags --force

echo ""
echo -e "${GREEN}✅ Backup tamamlandı!${NC}"
echo -e "${BLUE}📍 Origin:${NC} https://github.com/aydarnuman/procheff-v2"
echo -e "${BLUE}💾 Backup:${NC} https://github.com/aydarnuman/procheff-v2-backup"
echo ""
echo -e "${BLUE}Son commit:${NC}"
git log -1 --oneline
