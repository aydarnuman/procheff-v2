# 🚀 ProCheff v2 - Hızlı Başlangıç Kılavuzu

## 📋 Ön Gereksinimler

- **Node.js** 20+ 
- **npm** veya **yarn**
- **Claude API Key** (Anthropic)
- **Gemini API Key** (Google) - Opsiyonel

## ⚡ 5 Dakikada Kurulum

### 1️⃣ Projeyi Klonla
```bash
git clone https://github.com/aydarnuman/procheff-v2.git
cd procheff-v2
```

### 2️⃣ Bağımlılıkları Yükle
```bash
npm install
```

### 3️⃣ Environment Variables Ayarla
```bash
# .env.example'ı kopyala
cp .env.example .env.local

# .env.local dosyasını düzenle
nano .env.local
```

**Minimum Gerekli:**
```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
IHALEBUL_USERNAME=your_username
IHALEBUL_PASSWORD=your_password
```

### 4️⃣ Geliştirme Sunucusunu Başlat
```bash
npm run dev
```

🎉 Tarayıcıda aç: **http://localhost:3000**

---

## 🛠️ Kullanışlı Komutlar

### Geliştirme
```bash
npm run dev          # Geliştirme sunucusu
npm run build        # Production build
npm run start        # Production sunucu
npm run lint         # Linting
```

### Temizleme & Bakım
```bash
npm run clean        # .next, cache temizle
npm run fresh        # Tam temizlik + yeniden yükle
npm run cleanup:servers  # Zombie server'ları temizle
```

### Test
```bash
npm run test:ai      # AI extraction testi
npm run test:smoke   # Smoke test
```

### Veritabanı
```bash
npm run backup:db    # SQLite veritabanı backup
```

---

## 📂 Proje Yapısı

```
procheff-v2/
├── src/
│   ├── app/              # Next.js 16 App Router
│   │   ├── ihale-takip/      # İhale takip modülü
│   │   ├── ihale-robotu/     # Doküman analiz
│   │   ├── menu-planner/     # Menü planlama
│   │   ├── price-feed/       # Fiyat takip
│   │   └── api/              # API endpoints
│   ├── components/       # React bileşenleri
│   ├── lib/             # Utilities & business logic
│   │   ├── ai/              # AI providers (Claude, Gemini)
│   │   ├── ihale-scraper/   # Web scraping logic
│   │   └── stores/          # Zustand state stores
│   └── types/           # TypeScript type definitions
├── scripts/          # Shell scripts (backup, cleanup)
├── tests/            # Test dosyaları
└── data/             # SQLite database & sessions
```

---

## 🔑 API Anahtarları Nasıl Alınır?

### Claude API Key (Gerekli)
1. https://console.anthropic.com/ adresine git
2. Hesap oluştur / Giriş yap
3. API Keys > Create Key
4. `.env.local` dosyasına yapıştır

### Gemini API Key (Opsiyonel)
1. https://makersuite.google.com/app/apikey adresine git
2. Google hesabıyla giriş yap
3. "Get API Key" tıkla
4. `.env.local` dosyasına ekle

### İhalebul Credentials
1. https://www.ihalebul.com.tr/ adresine git
2. Üyelik oluştur (ücretsiz deneme mevcut)
3. Kullanıcı adı ve şifreyi `.env.local` dosyasına ekle

---

## 🐛 Sorun Giderme

### Port 3000 Zaten Kullanılıyor
```bash
# Zombie server'ları temizle
npm run cleanup:servers

# Veya manuel
killall -9 node
pkill -9 -f "next dev"
```

### .next Cache Sorunları
```bash
npm run clean
npm install
npm run dev
```

### API Anahtarları Çalışmıyor
```bash
# Tarayıcıda test et:
http://localhost:3000/ai-settings

# API Key Validator'da gerçek zamanlı test yapabilirsiniz
```

### Database Hatası
```bash
# Veritabanını sıfırla (DİKKAT: Veri kaybı olur!)
rm -rf data/ihale-scraper.db
npm run dev  # Otomatik yeniden oluşturulur
```

---

## 🚀 Deployment

### Vercel (Önerilen)
```bash
# Vercel CLI yükle
npm i -g vercel

# Deploy
vercel

# Environment variables'ları Vercel Dashboard'dan ekle:
# Settings > Environment Variables
```

### Environment Variables (Production)
```
NODE_ENV=production
ANTHROPIC_API_KEY=sk-ant-xxx
GOOGLE_API_KEY=xxx
IHALEBUL_USERNAME=xxx
IHALEBUL_PASSWORD=xxx
SCRAPER_CRON_SECRET=random_secret
```

---

## 📚 Daha Fazla Bilgi

- **Proje Dökümantasyonu**: `README.md`
- **AI Coding Guide**: `.github/copilot-instructions.md`
- **Scraper Detayları**: `src/lib/ihale-scraper/README.md`
- **Migration Summary**: `MIGRATION-SUMMARY.md`
- **Cron Setup**: `CRON_SETUP.md`

---

## 🆘 Yardım & Destek

- **GitHub Issues**: https://github.com/aydarnuman/procheff-v2/issues
- **Email**: [destek e-postası buraya]

---

## 📝 Lisans

Private - Tüm hakları saklıdır.

**Son Güncelleme**: 7 Kasım 2025
