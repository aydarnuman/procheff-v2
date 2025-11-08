# 🌐 Cloudflare Tunnel Setup - procheff.app

**Status:** ✅ TAMAMLANDI (8 Kasım 2025, 12:28 UTC)

**Sonuç:** `https://procheff.app` → Tailscale Server (100.88.13.45:3000)

**Kurulum Süresi:** 45 dakika (ilk kurulum)
**Maliyet:** Cloudflare Free ($0) + Zero Trust Access ($3/ay)

---

## 📋 ADIM 1: Cloudflare Hesabı

### 1.1 Hesap Oluştur

**Link:** https://dash.cloudflare.com/sign-up

```
Email: aydarnuman@yedek-arsiv.com (veya başka)
Password: (güçlü şifre)
```

### 1.2 Domain Ekle

1. **"Add a Site"** tıkla
2. **Domain gir:** `procheff.app`
3. **Plan seç:** Free ($0)
4. **Continue** tıkla

---

## 📋 ADIM 2: Nameserver Değişikliği

### 2.1 Cloudflare Nameserver'ları Kopyala

Cloudflare şöyle bir ekran gösterecek:

```
Change your nameservers

Please update your nameservers at your registrar:

Remove these nameservers:
❌ ns-cloud-d1.googledomains.com
❌ ns-cloud-d2.googledomains.com
❌ ns-cloud-d3.googledomains.com
❌ ns-cloud-d4.googledomains.com

Add these nameservers:
✅ xxx.ns.cloudflare.com
✅ yyy.ns.cloudflare.com
```

**Önemli:** xxx ve yyy senin özel nameserver'ların (kopyala!)

### 2.2 Google Domains'te Değiştir

**Link:** https://domains.google.com

1. **procheff.app** → Yönet
2. **DNS** → **Nameservers**
3. **"Use custom name servers"** seç
4. **Google'ın nameserver'larını SİL:**
   ```
   ❌ ns-cloud-d1.googledomains.com
   ❌ ns-cloud-d2.googledomains.com
   ❌ ns-cloud-d3.googledomains.com
   ❌ ns-cloud-d4.googledomains.com
   ```
5. **Cloudflare'ınkileri EKLE:**
   ```
   ✅ xxx.ns.cloudflare.com
   ✅ yyy.ns.cloudflare.com
   ```
6. **Save**

### 2.3 Cloudflare'de Onayla

Cloudflare'e dön → **"Check nameservers"** tıkla

**Bekleme süresi:** 5 dakika - 24 saat (genelde 5-10 dakika)

**Kontrol:**
```bash
dig procheff.app NS +short
```

Çıktı şöyle olmalı:
```
xxx.ns.cloudflare.com.
yyy.ns.cloudflare.com.
```

---

## 📋 ADIM 3: Cloudflare Tunnel Kurulumu

### 3.1 Tunnel Oluştur

**Cloudflare Dashboard'da:**

1. Sol menü → **Zero Trust** (veya "Access")
2. **Networks** → **Tunnels**
3. **"Create a tunnel"** tıkla
4. **Tunnel type:** Cloudflared
5. **Tunnel name:** `procheff-tunnel`
6. **Save tunnel**

### 3.2 Connector Kur (Server'da)

Cloudflare bir komut gösterecek, örnek:

```bash
# ⚠️ BU ÖRNEK! Cloudflare'den kendininkini kopyala
docker run cloudflare/cloudflared:latest tunnel \
  --no-autoupdate run \
  --token eyJhIjoiMTIzNDU2Nzg5MCIsInQiOiJhYmNkZWYxMjM0NTY3ODkwIiwicyI6IlhZWiJ9
```

**Şimdi server'da çalıştır:**

```bash
# SSH ile server'a bağlan
ssh root@161.35.217.113

# Cloudflare'den kopyaladığın komutu çalıştır
# (yukarıdaki örneği değil, Cloudflare panelinden kopyala!)
```

**Docker Compose ile kalıcı yap:**

```bash
# Server'da
cd /opt/procheff-v2
nano docker-compose.yml
```

**En alta ekle:**

```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared-tunnel
    command: tunnel --no-autoupdate run --token YOUR_TOKEN_HERE
    restart: unless-stopped
    networks:
      - app-network
```

**YOUR_TOKEN_HERE'yi değiştir** (Cloudflare'deki token)

**Restart:**
```bash
docker compose up -d
```

### 3.3 Public Hostname Ayarla

**Cloudflare Dashboard → Tunnel → procheff-tunnel:**

1. **"Public Hostnames"** sekmesi
2. **"Add a public hostname"** tıkla

**Ayarlar:**
```
Subdomain: (boş bırak veya "www")
Domain: procheff.app
Path: (boş)
Type: HTTP
URL: http://100.88.13.45:3000
```

**Gelişmiş Ayarlar (opsiyonel):**
```
✅ No TLS Verify (Tailscale için)
✅ HTTP Host Header: procheff.app
```

3. **Save hostname**

---

## ✅ ADIM 4: Test

### 4.1 DNS Propagation Bekle

**Kontrol:**
```bash
# Mac'ten
dig procheff.app +short
```

Cloudflare IP'leri görmeli:
```
104.21.x.x
172.67.x.x
```

### 4.2 Siteye Eriş

**Tarayıcı:**
```
https://procheff.app
```

✅ **Çalıştı mı?** → Tebrikler!
❌ **Hata veriyor mu?** → ADIM 5'e geç

---

## 🔧 ADIM 5: Sorun Giderme

### Hata: "Connection timed out"

**Çözüm:** Tunnel çalışıyor mu kontrol et

```bash
ssh root@161.35.217.113
docker ps | grep cloudflared
docker logs cloudflared-tunnel
```

### Hata: "502 Bad Gateway"

**Çözüm:** Tailscale IP doğru mu?

```bash
tailscale status | grep procheff
```

Cloudflare'de URL'yi kontrol et: `http://100.88.13.45:3000`

### Hata: "DNS_PROBE_FINISHED_NXDOMAIN"

**Çözüm:** DNS henüz yayılmamış, 10 dakika bekle

**Kontrol:**
```bash
dig procheff.app +short
```

---

## 🎯 SON DURUM

**Başarılı setup sonrası:**

| Erişim | URL | Durum |
|--------|-----|-------|
| **Public (Herkes)** | https://procheff.app | ✅ |
| **Tailscale (VPN)** | http://100.88.13.45:3000 | ✅ |
| **Local (Mac)** | http://localhost:3000 | ❌ (sadece dev için) |

**Özellikler:**
- ✅ HTTPS otomatik (Cloudflare SSL)
- ✅ DDoS koruması
- ✅ Analytics (Cloudflare dashboard)
- ✅ Port 3000 gizli (sadece 80/443 açık)
- ✅ Tailscale güvenliği korunuyor

---

## 📱 Mobil Erişim

**Artık Tailscale'e gerek yok!**

Sadece şunu aç:
```
https://procheff.app
```

**Herhangi bir cihazdan** (WiFi, 4G, 5G)

---

## 🔐 Private Yapmak İstersen

**Cloudflare Access ile sadece belirli kişiler erişsin:**

1. Cloudflare → Zero Trust → Access → Applications
2. **Add an application** → Self-hosted
3. **Application domain:** `procheff.app`
4. **Policy:**
   ```
   Action: Allow
   Include: Emails → aydarnuman@yedek-arsiv.com
   ```
5. **Save**

Artık sadece sen erişebilirsin (email ile login)

---

## 📊 İzleme

**Tunnel durumu:**
```bash
ssh root@161.35.217.113
docker logs -f cloudflared-tunnel
```

**Trafik istatistikleri:**
- Cloudflare Dashboard → Analytics

---

---

## ✅ KURULUM BAŞARILI!

**Tamamlanan Adımlar:**
1. ✅ Cloudflare hesabı oluşturuldu
2. ✅ procheff.app domain'i Cloudflare'e eklendi
3. ✅ Nameserver'lar Squarespace'ten Cloudflare'e taşındı
4. ✅ DNS kayıtları temizlendi (eski Google IP'leri kaldırıldı)
5. ✅ Cloudflare Tunnel oluşturuldu (procheff-tunnel)
6. ✅ Docker container başlatıldı (cloudflared-tunnel)
7. ✅ Public hostname ayarlandı (procheff.app → 100.88.13.45:3000)
8. ✅ HTTPS otomatik aktif edildi

**Aktif Servisler:**
- **Domain:** https://procheff.app
- **Tunnel ID:** 351ffc48-895d-4d64-8b76-25951f077aa0
- **Container:** cloudflared-tunnel (running, auto-restart)
- **Plan:** Cloudflare Free + Zero Trust Access ($3/ay)

**Kurulum Zamanı:**
- Başlangıç: 8 Kasım 2025, 11:45 UTC
- Tamamlanma: 8 Kasım 2025, 12:28 UTC
- Toplam süre: 43 dakika

**Karşılaşılan Sorunlar:**
1. ❌ SSH şifre değişikliği hatası → ✅ DigitalOcean console kullanıldı
2. ❌ DNS A record conflict → ✅ Eski kayıtlar silindi
3. ✅ Tunnel başarıyla kuruldu, ilk seferde çalıştı

---

**Son güncelleme:** 8 Kasım 2025, 12:30 UTC
**Versiyon:** 1.1 (Production Ready)
