# 🚀 ProCheff v2 - 30 Dakikada Server Kurulumu

**Docker + Tailscale ile tam özellikli deployment**

---

## ✅ ÖN HAZIRLIK (5 dakika)

### 1. Server IP'ni Not Al
```
Server IP: ________________
```

### 2. API Keylerini Hazırla
Bu bilgiler .env dosyasına girecek:

```bash
# Claude API
ANTHROPIC_API_KEY=sk-ant-api03-...

# Gemini API
GEMINI_API_KEY=AIzaSy...

# Turso Database
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=eyJhbGci...

# Scraper
SCRAPER_API_KEY=932ded...
IHALEBUL_USERNAME=aydarnuman
IHALEBUL_PASSWORD=Numan.43
CRON_SECRET=procheff-ihale-scraper-secret-2025-secure-key-32chars
```

---

## 🎯 KURULUM (25 dakika)

### ADIM 1: Server'a Bağlan (1 dk)

```bash
ssh root@SERVER_IP
# Şifre: (Hetzner'den gelen)
```

İlk girişte "yes" yaz (fingerprint onayı)

---

### ADIM 2: Otomatik Kurulum (10 dk)

```bash
curl -fsSL https://raw.githubusercontent.com/aydarnuman/procheff-v2/main/docker-setup.sh | bash
```

**Ne olacak?**
- ✅ Docker kurulur
- ✅ Docker Compose kurulur
- ✅ Tailscale kurulur
- ✅ Git kurulur
- ✅ Firewall yapılandırılır
- ✅ Güvenlik güncellemeleri

⏱️ **10 dakika sürer, bekle!**

---

### ADIM 3: Tailscale Başlat (2 dk)

```bash
tailscale up
```

Tarayıcı açılır → **Gmail ile giriş yap**

Terminal'de IP'ni öğren:
```bash
tailscale ip -4
```

Örnek çıktı:
```
100.64.5.10  ← Bu senin Tailscale IP'n (not al!)
```

---

### ADIM 4: Projeyi Clone Et (2 dk)

```bash
cd /opt/procheff
git clone https://github.com/aydarnuman/procheff-v2.git .
```

---

### ADIM 5: Environment Variables (3 dk)

```bash
# Template'i kopyala
cp env.docker.template .env

# Düzenle
nano .env
```

**Nano editör:**
- API keylerini yapıştır (yukarıdan kopyala)
- `Ctrl + O` → Kaydet
- `Enter` → Onayla
- `Ctrl + X` → Çık

---

### ADIM 6: Docker Build + Start (5 dk)

```bash
# Build (ilk seferde 3-5 dakika sürer)
docker-compose up -d

# Logları izle
docker-compose logs -f
```

**"Ready!" görene kadar bekle** (2-3 dakika)

`Ctrl + C` ile log'dan çık

---

### ADIM 7: Test Et! (2 dk)

```bash
# Health check
curl http://localhost:3000/api/health
```

**Başarılı çıktı:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-08T...",
  "version": "2.1.0"
}
```

✅ Çalışıyor! 🎉

---

## 👥 KULLANICI EKLEME

### 1. Kullanıcılar Tailscale Kurar

**Windows/Mac/Linux:**
→ https://tailscale.com/download

**Mobil:**
→ App Store / Play Store: "Tailscale"

**Kurulum:** 5 dakika
1. İndir
2. Kur
3. Gmail ile giriş yap

---

### 2. Sen Onları Ağa Eklersin

https://login.tailscale.com/admin/machines

→ **Share** → Email adreslerini ekle

---

### 3. Kullanıcılar Erişir

Tarayıcıda:
```
http://100.64.5.10:3000
```

✅ ProCheff açılır! Tüm özellikler çalışır!

---

## 🔧 YÖNETİM KOMUTLARI

### Container Yönetimi

```bash
# Restart
docker-compose restart

# Stop
docker-compose down

# Start
docker-compose up -d

# Loglar
docker-compose logs -f

# Status
docker ps
```

### Güncelleme

```bash
cd /opt/procheff
git pull
docker-compose build
docker-compose up -d
```

### Backup

```bash
# Database backup
docker cp procheff-app:/app/data/ihale-scraper.db ./backup-$(date +%Y%m%d).db

# Local'e indir (kendi bilgisayarından)
scp root@SERVER_IP:/opt/procheff/backup-*.db ~/Desktop/
```

---

## 🐛 SORUN GİDERME

### Container başlamıyor

```bash
docker-compose logs procheff
```

### Port zaten kullanılıyor

```bash
# Çakışan process'i bul
lsof -i :3000

# Durdur
kill -9 PID
```

### Disk dolu

```bash
# Docker temizliği
docker system prune -a

# Disk kullanımı
df -h
```

### Memory hatası

```bash
# docker-compose.yml düzenle:
nano docker-compose.yml

# memory limit artır: 2G → 4G
docker-compose up -d
```

---

## 📊 MONİTORİNG

### Resource kullanımı

```bash
# Real-time stats
docker stats procheff-app

# Disk
docker system df
```

### Uptime kontrolü

```bash
# Cron job ekle (her 5 dakikada health check)
crontab -e

# Ekle:
*/5 * * * * curl -f http://localhost:3000/api/health || systemctl restart docker
```

---

## 🎉 BAŞARIYLA TAMAMLANDI!

✅ Server kuruldu
✅ Docker çalışıyor
✅ Tailscale aktif
✅ ProCheff erişilebilir

**Kullanıcılar için link:**
```
http://100.64.5.10:3000
```

**Maliyet:** €4.5/ay (~₺170/ay)

**Sonraki adımlar:**
- [ ] Kullanıcıları ekle
- [ ] Günlük backup kur
- [ ] Monitoring ekle
- [ ] Domain al (opsiyonel)

---

## 📞 DESTEK

Sorun mu var?

1. Logları kontrol et: `docker-compose logs -f`
2. Health check: `curl http://localhost:3000/api/health`
3. GitHub: https://github.com/aydarnuman/procheff-v2/issues

---

**Kolay gelsin! 🚀**
