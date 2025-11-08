# 💾 ProCheff v2 - Backup & Restore Rehberi

**2 Tip Backup:**
1. **Kod Backup** → GitHub (otomatik)
2. **Data Backup** → Server (script)

---

## 📦 1. KOD BACKUP (GitHub)

### Zaten Otomatik!

Tüm kodlar GitHub'da yedekleniyor:
```
https://github.com/aydarnuman/procheff-v2
```

**Ne yedekleniyor?**
- ✅ Tüm kaynak kodlar
- ✅ Dockerfile, docker-compose
- ✅ Workflow dosyaları
- ✅ Dokümantasyon

**Ne YEDEKLENMİYOR?**
- ❌ .env (secret'lar)
- ❌ Database dosyası
- ❌ Upload'lanan dosyalar
- ❌ Log dosyaları

---

## 💽 2. DATA BACKUP (Server)

### Otomatik Backup Sistemi

**3 Seviye Backup:**

#### **Seviye 1: DigitalOcean Backup (Aktif)**
- **Frekans:** Günlük
- **Saklama:** 7 gün
- **Kapsam:** Tüm server (full snapshot)
- **Maliyet:** $9.60/ay
- **Yönetim:** DigitalOcean paneli

#### **Seviye 2: Script Backup (Manuel/Cron)**
- **Frekans:** İstediğin zaman
- **Saklama:** 30 gün
- **Kapsam:** Database, uploads, logs
- **Maliyet:** Ücretsiz
- **Yönetim:** Bash script'leri

#### **Seviye 3: Local Backup (Önerilen)**
- **Frekans:** Haftalık
- **Saklama:** Sınırsız
- **Kapsam:** Tüm data
- **Maliyet:** Ücretsiz
- **Yönetim:** Mac'ine indir

---

## 🚀 SCRIPT KULLANIMI

### Backup Alma

**Server'da:**
```bash
# SSH ile bağlan
ssh root@161.35.217.113

# Backup script'ini çalıştır
cd /opt/procheff-v2
bash scripts/backup.sh
```

**Çıktı:**
```
🔄 ProCheff v2 Backup Başlatılıyor...
📦 Database yedekleniyor...
✅ Database yedeklendi: database-20251108-143022.db
📁 Uploads yedekleniyor...
✅ Uploads yedeklendi: uploads-20251108-143022.tar.gz
📝 Logs yedekleniyor...
✅ Logs yedeklendi: logs-20251108-143022.tar.gz
🗜️  Full backup oluşturuluyor...
✅ Backup tamamlandı!

📍 Backup lokasyonu: /opt/procheff-backups
```

---

### Backup Restore Etme

**Server'da:**
```bash
ssh root@161.35.217.113
cd /opt/procheff-v2
bash scripts/restore.sh
```

**İnteraktif seçim:**
```
📋 Mevcut Backuplar:
-----------------------------------
1. database-20251108-143022.db (1.2M)
2. database-20251107-120000.db (1.1M)
3. database-20251106-090000.db (1.0M)
-----------------------------------

Hangi backup'ı restore etmek istiyorsun? (1-10): 1

⚠️  DİKKAT: Mevcut database silinecek!
Restore edilecek: database-20251108-143022.db
Devam etmek istiyor musun? (yes/no): yes

✅ Restore tamamlandı!
```

---

## ⏰ OTOMATİK BACKUP (Cron)

### Günlük Otomatik Backup Kur

**Server'da:**
```bash
# Crontab aç
crontab -e

# Ekle (her gece 3'te)
0 3 * * * cd /opt/procheff-v2 && bash scripts/backup.sh >> /var/log/procheff-backup.log 2>&1

# Kaydet ve çık
```

**Kontrol:**
```bash
# Cron job'ları listele
crontab -l

# Log'ları görüntüle
tail -f /var/log/procheff-backup.log
```

---

## 📥 LOCAL BACKUP (Mac'e İndir)

### Haftalık Manuel Backup

**Mac'te (Terminal):**
```bash
# Backup dosyalarını indir
scp -r root@161.35.217.113:/opt/procheff-backups ~/Desktop/ProCheff-Backups

# Veya sadece en son backup
scp root@161.35.217.113:/opt/procheff-backups/full-backup-*.tar.gz ~/Desktop/
```

**Otomatik indirme script (Mac'te):**
```bash
#!/bin/bash
# ~/Desktop/download-backup.sh

DATE=$(date +%Y%m%d)
scp root@161.35.217.113:/opt/procheff-backups/full-backup-*.tar.gz \
    ~/Desktop/ProCheff-Backups/backup-$DATE.tar.gz

echo "✅ Backup indirildi: ~/Desktop/ProCheff-Backups/backup-$DATE.tar.gz"
```

**Haftalık cron (Mac'te):**
```bash
# Mac'te crontab aç
crontab -e

# Ekle (her Pazar 22:00)
0 22 * * 0 bash ~/Desktop/download-backup.sh
```

---

## 🔄 RESTORE SENARYOLARI

### Senaryo 1: Database Bozuldu

```bash
ssh root@161.35.217.113
cd /opt/procheff-v2
bash scripts/restore.sh
# En son backup'ı seç
```

### Senaryo 2: Server Çöktü (Total Loss)

1. **Yeni Droplet Oluştur**
2. **Docker + Tailscale Kur**
3. **Kodu Clone Et**
4. **Backup'ı Restore Et:**

```bash
# Local'den server'a upload
scp ~/Desktop/ProCheff-Backups/backup-20251108.tar.gz root@NEW_IP:/opt/

# Server'da extract
cd /opt
tar -xzf backup-20251108.tar.gz

# Database'i kopyala
docker cp database-20251108-143022.db procheff-app:/app/data/ihale-scraper.db

# Restart
docker compose restart
```

### Senaryo 3: Yanlışlıkla Veri Silindi

```bash
# Hemen backup al (mevcut durum)
bash scripts/backup.sh

# Son çalışan backup'ı restore et
bash scripts/restore.sh
# Bir önceki backup'ı seç
```

---

## 📊 BACKUP STRATEJİSİ

| Backup Tipi | Frekans | Saklama | Konum |
|-------------|---------|---------|-------|
| DigitalOcean Snapshot | Günlük | 7 gün | DigitalOcean |
| Script Backup | Günlük | 30 gün | Server |
| Local Backup | Haftalık | Sınırsız | Mac |
| GitHub (Kod) | Her push | Sınırsız | GitHub |

**Toplam Koruma:**
- ✅ Son 7 günün full snapshot'ı
- ✅ Son 30 günün data backup'ı
- ✅ Haftalık local arşiv
- ✅ Tüm kod history

---

## 🔍 BACKUP KONTROLÜ

### Backup Boyutlarını Kontrol

```bash
# Server'da
du -sh /opt/procheff-backups
ls -lht /opt/procheff-backups | head -20
```

### Backup Testi

```bash
# Test backup al
bash scripts/backup.sh

# Test restore (DRY RUN)
# 1. Mevcut database'i kopyala
docker cp procheff-app:/app/data/ihale-scraper.db /tmp/test-backup.db

# 2. Restore script'i çalıştır
bash scripts/restore.sh
# En son backup'ı seç

# 3. Health check
curl http://localhost:3000/api/health

# 4. Uygulama çalışıyor mu kontrol et

# 5. Eğer sorun varsa, original'i geri yükle
docker cp /tmp/test-backup.db procheff-app:/app/data/ihale-scraper.db
docker compose restart
```

---

## 🆘 ACİL DURUM PLANI

### Plan A: Hızlı Restore (5 dakika)
```bash
ssh root@161.35.217.113
cd /opt/procheff-v2
bash scripts/restore.sh
```

### Plan B: DigitalOcean Snapshot (15 dakika)
1. DigitalOcean Panel → Droplets
2. procheff-server → Backups
3. En son backup'ı seç
4. "Restore" tıkla

### Plan C: Yeni Server + Local Backup (30 dakika)
1. Yeni Droplet oluştur
2. Setup script çalıştır
3. Local backup upload et
4. Restore et

---

## 📁 BACKUP LOKASYONLARI

**Server:**
```
/opt/procheff-backups/
├── database-20251108-143022.db
├── uploads-20251108-143022.tar.gz
├── logs-20251108-143022.tar.gz
└── full-backup-20251108-143022.tar.gz
```

**Mac (Önerilen):**
```
~/Desktop/ProCheff-Backups/
├── backup-20251108.tar.gz
├── backup-20251101.tar.gz
└── backup-20251025.tar.gz
```

---

## ✅ CHECKLIST

### Haftalık
- [ ] Local backup indir
- [ ] Backup boyutlarını kontrol et
- [ ] Eski local backupları temizle (3+ ay)

### Aylık
- [ ] Backup restore testi yap
- [ ] DigitalOcean backup ayarlarını kontrol et
- [ ] Backup script'lerini güncelle

### Yıllık
- [ ] Tüm backup stratejisini gözden geçir
- [ ] Disaster recovery planını test et
- [ ] Backup maliyetlerini optimize et

---

## 💡 İPUÇLARI

1. **3-2-1 Kuralı:**
   - 3 kopya (server + DigitalOcean + Mac)
   - 2 farklı format (snapshot + file)
   - 1 offsite (Mac)

2. **Otomasyonu Unut:**
   - Cron job kurduktan sonra logları takip et
   - Aylık test yap

3. **Boyut Kontrolü:**
   - Database büyüdükçe backup süresi artar
   - Eski backupları temizle

4. **Güvenlik:**
   - Backup'ları şifrele (hassas veri varsa)
   - .env dosyasını asla GitHub'a koyma

---

**Son güncelleme:** 8 Kasım 2025
**Versiyon:** 1.0
