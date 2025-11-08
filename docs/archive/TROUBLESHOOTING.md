# 🔧 ProCheff v2 - Sorun Giderme Rehberi

Sık karşılaşılan sorunlar ve çözümleri

---

## 🐳 DOCKER SORUNLARI

### ❌ "docker: command not found"

**Sorun:** Docker kurulu değil

**Çözüm:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl start docker
```

---

### ❌ "Cannot connect to the Docker daemon"

**Sorun:** Docker servisi çalışmıyor

**Çözüm:**
```bash
systemctl start docker
systemctl enable docker
```

---

### ❌ "port is already allocated"

**Sorun:** 3000 portu başka bir uygulama tarafından kullanılıyor

**Çözüm:**
```bash
# Portu kullanan process'i bul
lsof -i :3000

# Durdur
kill -9 PID

# Veya docker-compose.yml'de port değiştir:
ports:
  - "3001:3000"  # 3000 yerine 3001
```

---

### ❌ "no space left on device"

**Sorun:** Disk dolu

**Çözüm:**
```bash
# Docker temizliği
docker system prune -a -f

# Kullanılmayan volume'leri sil
docker volume prune -f

# Eski log'ları temizle
truncate -s 0 /var/lib/docker/containers/*/*-json.log
```

---

### ❌ Container sürekli restart oluyor

**Sorun:** Uygulama crash oluyor

**Çözüm:**
```bash
# Logları incele
docker-compose logs procheff

# Container içine gir
docker exec -it procheff-app bash

# Manuel başlat (debug için)
npm run start
```

---

## 🔐 TAILSCALE SORUNLARI

### ❌ "tailscale: command not found"

**Sorun:** Tailscale kurulu değil

**Çözüm:**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

---

### ❌ Tailscale IP alamıyorum

**Sorun:** Tailscale servisi çalışmıyor

**Çözüm:**
```bash
# Servisi başlat
systemctl start tailscaled

# Aktif et
tailscale up

# Status kontrol
tailscale status
```

---

### ❌ Kullanıcılar bağlanamıyor

**Sorun:** Kullanıcılar ağa eklenmemiş

**Çözüm:**
1. https://login.tailscale.com/admin/machines
2. "Share" → Kullanıcı email'lerini ekle
3. Kullanıcılar Tailscale'de "Accept" tıklasın

---

## 🌐 NETWORK SORUNLARI

### ❌ "Connection refused" hatası

**Sorun:** Uygulama çalışmıyor veya port kapalı

**Çözüm:**
```bash
# Container çalışıyor mu?
docker ps

# Health check
curl http://localhost:3000/api/health

# Firewall kontrolü
ufw status
ufw allow 3000/tcp  # Gerekirse
```

---

### ❌ Tailscale üzerinden erişilemiyor

**Sorun:** Firewall veya routing sorunu

**Çözüm:**
```bash
# Tailscale IP'den ping at
ping 100.64.5.10

# Port listen kontrolü
netstat -tulpn | grep 3000

# Firewall kuralı ekle (tailscale interface için)
ufw allow in on tailscale0
```

---

## 💾 DATABASE SORUNLARI

### ❌ "SQLITE_CANTOPEN" hatası

**Sorun:** Database dosyası oluşturulamıyor

**Çözüm:**
```bash
# data klasörü izinleri
docker exec -it procheff-app mkdir -p /app/data
docker exec -it procheff-app chmod 777 /app/data

# Container'ı restart et
docker-compose restart
```

---

### ❌ Turso bağlantı hatası

**Sorun:** TURSO_AUTH_TOKEN yanlış veya eksik

**Çözüm:**
```bash
# .env dosyasını kontrol et
cat .env | grep TURSO

# Doğru token'ı gir
nano .env

# Container'ı restart et
docker-compose restart
```

---

## 🤖 AI API SORUNLARI

### ❌ "Invalid API key" hatası

**Sorun:** API key yanlış veya eksik

**Çözüm:**
```bash
# .env dosyasını kontrol et
cat .env | grep API_KEY

# Doğru key'i gir (boşluk bırakma!)
nano .env

# Container'ı restart et
docker-compose restart
```

---

### ❌ "Rate limit exceeded"

**Sorun:** API quota doldu

**Çözüm:**
- Claude: https://console.anthropic.com/
- Gemini: https://aistudio.google.com/

Bakiye kontrol et, gerekirse upgrade yap

---

## 🔨 PUPPETEER SORUNLARI

### ❌ "Failed to launch chrome"

**Sorun:** Chromium kurulu değil veya çalışmıyor

**Çözüm:**
```bash
# Container içine gir
docker exec -it procheff-app bash

# Chromium kontrolü
chromium --version

# Manuel test
chromium --headless --no-sandbox --dump-dom https://google.com

# Yoksa rebuild et
docker-compose build --no-cache
```

---

### ❌ "Protocol error" - Puppeteer timeout

**Sorun:** Memory yetersiz veya sayfa yüklenemiyor

**Çözüm:**
```bash
# Memory limit artır (docker-compose.yml)
deploy:
  resources:
    limits:
      memory: 4G  # 2G → 4G

# Restart
docker-compose up -d
```

---

## 📝 OCR SORUNLARI

### ❌ "tesseract: command not found"

**Sorun:** Tesseract kurulu değil

**Çözüm:**
```bash
# Container içinde kontrol
docker exec -it procheff-app tesseract --version

# Yoksa rebuild et
docker-compose build --no-cache
```

---

### ❌ OCR sonuçları kötü

**Sorun:** Düşük kaliteli görsel veya Türkçe dil paketi eksik

**Çözüm:**
```bash
# Türkçe dil kontrolü
docker exec -it procheff-app tesseract --list-langs

# "tur" listede olmalı
# Yoksa Dockerfile'da zaten var, rebuild et
```

---

## 🚀 PERFORMANS SORUNLARI

### ❌ Uygulama çok yavaş

**Sorun:** Yetersiz kaynak

**Çözüm:**
```bash
# Resource kullanımı kontrol
docker stats procheff-app

# CPU/Memory limit artır (docker-compose.yml)
deploy:
  resources:
    limits:
      cpus: '4'      # 2 → 4
      memory: 4G     # 2G → 4G

# Server upgrade et (Hetzner)
# CPX11 → CPX21 (4 vCPU, 8GB RAM, €9/ay)
```

---

### ❌ Build çok uzun sürüyor

**Sorun:** Cache kullanılmıyor

**Çözüm:**
```bash
# BuildKit kullan (daha hızlı)
export DOCKER_BUILDKIT=1
docker-compose build

# Layer cache'i koru
docker-compose build --pull
```

---

## 🔄 GÜNCELLEME SORUNLARI

### ❌ "git pull" merge conflict

**Sorun:** Local değişiklikler var

**Çözüm:**
```bash
# Local değişiklikleri sakla
git stash

# Güncelle
git pull

# Değişiklikleri geri al
git stash pop

# Veya local'i sıfırla (DİKKATLİ!)
git reset --hard origin/main
```

---

### ❌ Yeni build çalışmıyor

**Sorun:** Cache eski kalmış

**Çözüm:**
```bash
# Full rebuild (cache'siz)
docker-compose build --no-cache

# Eski container ve image'leri temizle
docker-compose down
docker system prune -a

# Yeniden başlat
docker-compose up -d
```

---

## 🔍 DEBUG METODLARI

### Container içine gir

```bash
docker exec -it procheff-app bash
```

### Logları detaylı incele

```bash
# Tüm loglar
docker-compose logs

# Son 100 satır
docker-compose logs --tail=100

# Real-time takip
docker-compose logs -f

# Sadece error logları
docker-compose logs | grep -i error
```

### Environment variables kontrol

```bash
docker exec -it procheff-app env | grep -E 'API_KEY|DATABASE|NODE_ENV'
```

### Network kontrolü

```bash
# Portları kontrol
docker port procheff-app

# Network detayları
docker network inspect procheff_default
```

---

## 📞 HALA ÇÖZÜLMEDI?

### 1. Tam diagnostic çalıştır:

```bash
# diagnostic.sh oluştur
cat > diagnostic.sh << 'EOF'
#!/bin/bash
echo "=== DOCKER STATUS ==="
docker ps -a
echo ""
echo "=== CONTAINER LOGS (son 50 satır) ==="
docker-compose logs --tail=50
echo ""
echo "=== DISK USAGE ==="
df -h
echo ""
echo "=== MEMORY USAGE ==="
free -m
echo ""
echo "=== NETWORK ==="
netstat -tulpn | grep 3000
echo ""
echo "=== ENV VARS ==="
docker exec procheff-app env | grep -v -E 'API_KEY|PASSWORD|TOKEN|SECRET'
EOF

chmod +x diagnostic.sh
./diagnostic.sh > diagnostic-output.txt
```

### 2. Output'u paylaş:

- GitHub Issue aç: https://github.com/aydarnuman/procheff-v2/issues
- `diagnostic-output.txt` dosyasını ekle
- Hatanın ne zaman başladığını yaz

---

## 🆘 ACİL DURUM: Her şeyi sıfırla

```bash
# UYARI: TÜM DATA SİLİNİR!

# 1. Backup al
docker cp procheff-app:/app/data ./backup-data

# 2. Her şeyi durdur
docker-compose down -v

# 3. Temizle
docker system prune -a -f
docker volume prune -f

# 4. Projeyi yeniden clone et
cd /opt
rm -rf procheff
git clone https://github.com/aydarnuman/procheff-v2.git procheff
cd procheff

# 5. .env'i yeniden ayarla
cp env.docker.template .env
nano .env

# 6. Yeniden başlat
docker-compose up -d

# 7. Data'yı geri yükle
docker cp ./backup-data procheff-app:/app/data
```

---

**Sorun çözüldü mü? Harika! 🎉**

**Hala devam ediyor mu? GitHub Issue aç, yardımcı olalım! 💪**
