# 🐳 ProCheff v2 - Docker Deployment Rehberi

Server + Docker + Tailscale ile **tam özellikli** deployment.

---

## 📋 ÖZELLİKLER

✅ **Tüm özellikler çalışır:**
- OCR (Tesseract)
- Web Scraping (Puppeteer)
- AI Analiz (Claude + Gemini)
- Database (Turso + SQLite)
- Dosya İşleme

✅ **7/24 Çalışır** (PM2'ye gerek yok, Docker restart policy)
✅ **Güvenli** (Tailscale VPN)
✅ **Kolay güncelleme** (git pull + docker-compose restart)

---

## 💰 MALİYET

| Servis | Aylık | Yıllık |
|--------|-------|--------|
| **Hetzner CPX11** | €4.5 | €54 |
| **Tailscale** | €0 | €0 |
| **TOPLAM** | **€4.5** | **€54** |

*Vercel alternatifi: $79/ay = $948/yıl*

---

## 🚀 KURULUM (30 Dakika)

### 1️⃣ Server Kirala (5 dakika)

**Hetzner Cloud:**
1. https://console.hetzner.cloud
2. **New Project** → "procheff"
3. **Add Server:**
   - Location: **Falkenstein** (Germany)
   - Image: **Ubuntu 22.04**
   - Type: **CPX11** (2 vCPU, 4GB RAM)
   - SSH Key: Ekle (veya şifre)
4. **Create & Buy**

✅ Server IP'ni not al: `65.108.XXX.XXX`

---

### 2️⃣ Server'a Bağlan (1 dakika)

```bash
ssh root@65.108.XXX.XXX
```

---

### 3️⃣ Otomatik Kurulum (10 dakika)

```bash
# Kurulum scriptini çalıştır
curl -fsSL https://raw.githubusercontent.com/aydarnuman/procheff-v2/main/docker-setup.sh | bash
```

Script şunları kurar:
- ✅ Docker + Docker Compose
- ✅ Tailscale
- ✅ Git
- ✅ Firewall (güvenlik)

---

### 4️⃣ Tailscale Başlat (2 dakika)

```bash
tailscale up
```

Tarayıcı açılır → **Gmail ile giriş yap**

Tailscale IP'ni öğren:
```bash
tailscale ip -4
# Örnek: 100.64.5.10
```

---

### 5️⃣ Projeyi Klonla (2 dakika)

```bash
cd /opt/procheff
git clone https://github.com/aydarnuman/procheff-v2.git .
```

---

### 6️⃣ Environment Variables Ayarla (3 dakika)

```bash
# .env.docker dosyasını kopyala
cp .env.docker .env

# API keylerini kontrol et (gerekirse düzenle)
nano .env
```

---

### 7️⃣ Docker Container Başlat (5 dakika)

```bash
# Build + Start
docker-compose up -d

# İlk build 3-5 dakika sürer (Chromium indiriliyor)
docker-compose logs -f
```

✅ "Ready!" mesajını görünce hazır!

---

### 8️⃣ Test Et (2 dakika)

**Server'da:**
```bash
curl http://localhost:3000/api/health
```

**Çıktı:**
```json
{
  "status": "healthy",
  "version": "2.1.0"
}
```

**Tailscale IP'den:**
```bash
curl http://100.64.5.10:3000/api/health
```

✅ Çalışıyorsa kurulum tamam!

---

## 👥 KULLANICILARI EKLE

### 1. Kullanıcılar Tailscale Kurar

**Windows/Mac/Linux:**
- https://tailscale.com/download

**Mobil:**
- App Store / Play Store → "Tailscale"

### 2. Sen Onları Ağa Eklersin

https://login.tailscale.com/admin/machines
→ **Share** → Email adreslerini ekle

### 3. Kullanıcılar Erişir

```
http://100.64.5.10:3000
```

✅ Tüm özellikler çalışır!

---

## 🔧 YÖNETİM KOMUTLARI

### Logları İzle
```bash
docker-compose logs -f
```

### Restart
```bash
docker-compose restart
```

### Durdur
```bash
docker-compose down
```

### Güncelle (Git'ten)
```bash
git pull
docker-compose build
docker-compose up -d
```

### Veritabanı Backup
```bash
docker cp procheff-app:/app/data/ihale-scraper.db ./backup-$(date +%Y%m%d).db
```

### Container İçine Gir
```bash
docker exec -it procheff-app bash
```

---

## 🔐 GÜVENLİK

### ✅ Yapılanlar:

1. **Firewall:** Sadece Tailscale portuna izin
2. **Tailscale:** End-to-end şifreli
3. **Docker:** Container izolasyonu
4. **No public ports:** 3000 portu dışarıya kapalı

### 🛡️ Ek Güvenlik (Opsiyonel):

```bash
# Otomatik güvenlik güncellemeleri
apt install unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Fail2ban (brute force koruması)
apt install fail2ban
systemctl enable fail2ban
```

---

## 📊 MONİTORİNG

### Docker Stats
```bash
docker stats procheff-app
```

### Disk Kullanımı
```bash
docker system df
```

### Health Check
```bash
docker inspect procheff-app | grep -A 5 Health
```

---

## 🐛 SORUN GİDERME

### Container başlamıyor:
```bash
docker-compose logs procheff
```

### Port meşgul:
```bash
lsof -i :3000
```

### Memory hatası:
```bash
# docker-compose.yml'de memory artır:
limits:
  memory: 4G  # 2G → 4G
```

### Chromium hatası:
```bash
docker exec -it procheff-app chromium --version
```

---

## 🔄 GÜNCELLEME SÜRECİ

```bash
# 1. Kod değişikliklerini çek
cd /opt/procheff
git pull

# 2. Rebuild (sadece değişen layer'lar build olur)
docker-compose build

# 3. Restart (downtime ~5 saniye)
docker-compose up -d

# 4. Verify
docker-compose logs -f
```

**Zero-downtime deployment için:**
```bash
# Blue-green deployment (gelişmiş)
docker-compose up -d --no-deps --build procheff
```

---

## 💾 BACKUP STRATEJİSİ

### Günlük Otomatik Backup (Cron)

```bash
# /etc/cron.daily/procheff-backup
#!/bin/bash
docker cp procheff-app:/app/data/ihale-scraper.db /backup/db-$(date +%Y%m%d).db
find /backup -name "db-*.db" -mtime +7 -delete  # 7 günden eski sil
```

### Manuel Backup
```bash
# Full backup (code + data)
tar -czf procheff-backup-$(date +%Y%m%d).tar.gz /opt/procheff

# Sadece database
docker exec procheff-app tar -czf - /app/data > backup-data.tar.gz
```

---

## ✅ CHECKLIST

**Kurulum tamamlandı mı?**

- [ ] Server kiralandı
- [ ] Docker kuruldu
- [ ] Tailscale çalışıyor
- [ ] Container başladı
- [ ] Health check OK
- [ ] Kullanıcılar eklendi
- [ ] Test edildi
- [ ] Backup planı var

---

## 📞 DESTEK

**Sorun mu var?**

1. Logları kontrol et: `docker-compose logs -f`
2. Health check: `curl http://localhost:3000/api/health`
3. GitHub Issues: https://github.com/aydarnuman/procheff-v2/issues

---

## 🎯 SONRAKİ ADIMLAR

- [ ] SSL/HTTPS ekle (Let's Encrypt)
- [ ] Domain name al (procheff.com)
- [ ] Monitoring dashboard (Grafana)
- [ ] Alerting (email/Slack)
- [ ] Scaling (multi-server)

---

**Kurulum tamamlandı! 🎉**

Kullanıcılar: `http://100.64.5.10:3000`
