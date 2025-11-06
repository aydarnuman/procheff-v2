#!/bin/bash
# ============================================================================
# SQLITE DATABASE BACKUP SCRIPT
# Periodic backup to Google Cloud Storage
# Usage: ./scripts/backup-database.sh
# Cron: 0 2 * * * /path/to/backup-database.sh  # Daily at 2 AM
# ============================================================================

set -e  # Exit on error

# Configuration
DB_PATH="./data/ihale-scraper.db"
BACKUP_DIR="./backups"
GCS_BUCKET="${GCS_BACKUP_BUCKET:-gs://procheff-backups/database}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="ihale-scraper-backup-${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================================================"
echo "🔄 SQLITE DATABASE BACKUP - $(date)"
echo "============================================================================"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}❌ Database not found: $DB_PATH${NC}"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# 1. Create SQL dump
echo -e "\n📤 Creating SQL dump..."
sqlite3 "$DB_PATH" ".dump" > "$BACKUP_DIR/$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ SQL dump created: $BACKUP_FILE${NC}"
    
    # Get file size
    SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo "   Size: $SIZE"
else
    echo -e "${RED}❌ SQL dump failed${NC}"
    exit 1
fi

# 2. Compress backup
echo -e "\n🗜️  Compressing backup..."
gzip -f "$BACKUP_DIR/$BACKUP_FILE"

if [ $? -eq 0 ]; then
    COMPRESSED_SIZE=$(du -h "$BACKUP_DIR/$COMPRESSED_FILE" | cut -f1)
    echo -e "${GREEN}✅ Compressed: $COMPRESSED_FILE${NC}"
    echo "   Size: $COMPRESSED_SIZE"
else
    echo -e "${RED}❌ Compression failed${NC}"
    exit 1
fi

# 3. Upload to Google Cloud Storage (if configured)
if command -v gsutil &> /dev/null; then
    echo -e "\n☁️  Uploading to Google Cloud Storage..."
    
    gsutil cp "$BACKUP_DIR/$COMPRESSED_FILE" "$GCS_BUCKET/"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Uploaded to: $GCS_BUCKET/$COMPRESSED_FILE${NC}"
    else
        echo -e "${YELLOW}⚠️  GCS upload failed (continuing anyway)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  gsutil not found - skipping cloud upload${NC}"
    echo "   Install: https://cloud.google.com/storage/docs/gsutil_install"
fi

# 4. Keep only last 7 local backups
echo -e "\n🧹 Cleaning old local backups (keeping last 7)..."
cd "$BACKUP_DIR"
ls -t ihale-scraper-backup-*.sql.gz | tail -n +8 | xargs -r rm -f
REMAINING=$(ls -1 ihale-scraper-backup-*.sql.gz 2>/dev/null | wc -l)
echo "   Local backups: $REMAINING"

# 5. Verify backup integrity
echo -e "\n🔍 Verifying backup integrity..."
gunzip -t "$COMPRESSED_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backup integrity verified${NC}"
else
    echo -e "${RED}❌ Backup integrity check failed!${NC}"
    exit 1
fi

# 6. Generate backup report
echo -e "\n📊 Backup Statistics:"
echo "   Database size: $(du -h "$DB_PATH" | cut -f1)"
echo "   Backup size: $COMPRESSED_SIZE"
echo "   Backup location: $BACKUP_DIR/$COMPRESSED_FILE"
if command -v gsutil &> /dev/null; then
    echo "   Cloud backup: $GCS_BUCKET/$COMPRESSED_FILE"
fi

echo -e "\n${GREEN}✅ Backup completed successfully!${NC}"
echo "============================================================================"

# Optional: Send notification (if configured)
if [ -n "$BACKUP_WEBHOOK_URL" ]; then
    curl -X POST "$BACKUP_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"✅ Database backup completed: $COMPRESSED_FILE\"}" \
        > /dev/null 2>&1
fi
