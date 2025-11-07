# 🏥 Dev Server Management Guide

## Sorunlar ve Çözümler

### 🔴 Yaygın Sorunlar

1. **Port 3000 zaten kullanımda**
2. **Eski dev server hala çalışıyor**
3. **Hot reload çalışmıyor**
4. **Çok fazla terminal açık**
5. **Cache sorunları**

---

## ✅ Çözümler

### Yöntem 1: Smart Dev (ÖNERİLEN) 🌟

**En kolay ve güvenli yöntem** - Otomatik health check + dev server

```bash
npm run dev:safe
```

**Ne yapar?**
- ✅ Port 3000'i kontrol eder, meşgulse temizler
- ✅ Zombie Next.js process'leri bulur ve temizler
- ✅ .next cache'i kontrol eder (500MB+/eski ise temizler)
- ✅ node_modules güncel mi kontrol eder
- ✅ .env.local var mı kontrol eder
- ✅ Tüm kontroller OK ise dev server başlatır

**VS Code'dan:**
- `Cmd+Shift+P` → "Tasks: Run Task" → "🚀 Smart Dev Server"

---

### Yöntem 2: Manuel Health Check

Sadece kontrol yapmak istiyorsanız (server başlatmadan):

```bash
npm run dev:check
```

**VS Code'dan:**
- `Cmd+Shift+P` → "Tasks: Run Task" → "🏥 Dev Health Check"

---

### Yöntem 3: Port Monitor (Arka Plan Daemon)

Sürekli port 3000'i izler, sorun olduğunda uyarır:

```bash
# Başlat
npm run monitor:start

# Durum kontrol
npm run monitor:status

# Durdur
npm run monitor:stop
```

**Ne zaman kullanılır?**
- Gün boyunca çok sık dev server açıp kapatıyorsanız
- Başka uygulamalar da port 3000 kullanıyorsa
- Proaktif monitoring istiyorsanız

**Loglar**: `/tmp/procheff-port-monitor.log`

---

### Yöntem 4: Emergency Cleanup

Her şey bozulduysa, tam reset:

```bash
npm run cleanup:servers  # Zombie server'ları temizle
npm run clean            # Cache'leri temizle
npm install              # Bağımlılıkları yenile
npm run dev:safe         # Güvenli başlat
```

**Veya tek komutla:**
```bash
npm run fresh  # clean + install + dev
```

---

## 🎯 Hangi Yöntemi Kullanmalıyım?

| Durum | Önerilen Yöntem |
|-------|----------------|
| **Günlük kullanım** | `npm run dev:safe` |
| **İlk kurulum** | `npm run dev:safe` |
| **Port çakışması** | `npm run dev:check` sonra `dev:safe` |
| **Hot reload bozuk** | `npm run clean` sonra `dev:safe` |
| **Çok sık sorun yaşıyorum** | `npm run monitor:start` + `dev:safe` |
| **Acil durum** | `npm run fresh` |

---

## 📊 Health Check Detayları

### Port Kontrolü
```
✅ Port 3000 boş
⚠️  Port 3000 kullanımda (PID: 12345) → Otomatik temizlenir
```

### Zombie Process
```
✅ Zombie process yok
⚠️  2 zombie process bulundu → Otomatik temizlenir
```

### Cache Kontrolü
```
✅ Cache sağlıklı (125MB, 15 eski dosya)
⚠️  Cache çok büyük (1.2GB) → Otomatik temizlenir
⚠️  150 eski dosya var → Otomatik temizlenir
```

### node_modules
```
✅ node_modules güncel
⚠️  package.json değişmiş → npm install çalışır
❌ node_modules bulunamadı → npm install çalışır
```

### Environment Variables
```
✅ Temel environment variables mevcut
⚠️  Eksik API keys: ANTHROPIC_API_KEY
❌ .env.local bulunamadı → .env.example kopyalanır
```

---

## 🛠️ VS Code Integration

**Command Palette** (`Cmd+Shift+P`) → "Tasks: Run Task":

1. **🏥 Dev Health Check** - Sadece kontrol
2. **🚀 Smart Dev Server** - Health check + dev başlat
3. **📊 Port Monitor - Start** - Arka plan monitoring başlat
4. **📊 Port Monitor - Status** - Monitor durumu
5. **📊 Port Monitor - Stop** - Monitor durdur
6. **🧹 Cleanup Zombie Servers** - Manuel temizlik

---

## 💡 İpuçları

### Alias Tanımlama (Opsiyonel)

`.zshrc` veya `.bashrc` dosyanıza ekleyin:

```bash
# ProCheff shortcuts
alias dev='cd ~/Desktop/procheff-v2 && npm run dev:safe'
alias devcheck='cd ~/Desktop/procheff-v2 && npm run dev:check'
alias devclean='cd ~/Desktop/procheff-v2 && npm run cleanup:servers'
```

Artık her yerden:
```bash
dev         # Smart dev server başlat
devcheck    # Health check yap
devclean    # Zombie temizle
```

### Startup Script (macOS)

Terminal her açıldığında port monitor otomatik başlasın:

`.zshrc` dosyasına ekle:
```bash
# ProCheff port monitor auto-start
if [ ! -f "/tmp/procheff-port-monitor.pid" ]; then
    ~/Desktop/procheff-v2/scripts/port-monitor.sh start > /dev/null 2>&1
fi
```

---

## 🐛 Troubleshooting

### "Permission denied" hatası
```bash
chmod +x scripts/*.sh
```

### Health check çalışmıyor
```bash
# Script'in executable olduğunu kontrol et
ls -la scripts/dev-healthcheck.sh

# Yoksa:
chmod +x scripts/dev-healthcheck.sh
```

### Port monitor logları doldu
```bash
# Log dosyasını temizle
rm /tmp/procheff-port-monitor.log

# Veya son 100 satırı sakla
tail -n 100 /tmp/procheff-port-monitor.log > /tmp/temp.log
mv /tmp/temp.log /tmp/procheff-port-monitor.log
```

---

## 📈 Gelişmiş Kullanım

### Cron ile Otomasyonlu Temizlik

Günde 1 kez otomatik cache temizliği:

```bash
crontab -e

# Ekle:
0 3 * * * cd ~/Desktop/procheff-v2 && npm run clean
```

### Multiple Port Monitoring

Başka portları da izlemek için `port-monitor.sh` dosyasını kopyala ve PORT değişkenini değiştir.

---

**Son Güncelleme**: 7 Kasım 2025  
**Version**: 1.0.0
