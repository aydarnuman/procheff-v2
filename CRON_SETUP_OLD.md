# İhale Scraper - Otomatik Çalışma (Cron Job Setup)

## Özet

Her gün otomatik olarak:
- **09:50** - Tüm ihaleleri sil
- **10:00** - Yeni ihaleleri çek (scrape)

## Vercel Deploy Sonrası Yapılacaklar

### 1. Vercel Dashboard'da Environment Variable Ekle

1. Vercel Dashboard > Project Settings > Environment Variables
2. Yeni variable ekle:
   ```
   Key: CRON_SECRET
   Value: procheff-ihale-scraper-secret-2025-secure-key-32chars
   ```
3. Production, Preview, Development ortamları için seç
4. Save

### 2. Vercel Cron Jobs Kontrol

Deploy sonrası Vercel otomatik olarak `vercel.json` dosyasındaki cron job'ları algılar:

```json
{
  "crons": [
    {
      "path": "/api/cron/delete-tenders",
      "schedule": "50 9 * * *"
    },
    {
      "path": "/api/cron/scrape-tenders",
      "schedule": "0 10 * * *"
    }
  ]
}
```

### 3. Manuel Test (Production'da)

#### Delete Tenders:
```bash
curl -X GET https://your-app.vercel.app/api/cron/delete-tenders \
  -H "Authorization: Bearer procheff-ihale-scraper-secret-2025-secure-key-32chars"
```

Beklenen response:
```json
{
  "success": true,
  "message": "✅ 218 ihale başarıyla silindi",
  "deletedCount": 218,
  "timestamp": "2025-01-03T10:00:00.000Z"
}
```

#### Scrape Tenders:
```bash
curl -X GET https://your-app.vercel.app/api/cron/scrape-tenders \
  -H "Authorization: Bearer procheff-ihale-scraper-secret-2025-secure-key-32chars"
```

Beklenen response:
```json
{
  "success": true,
  "message": "✅ Scraping tamamlandı",
  "totalScraped": 250,
  "newListings": 245,
  "duplicates": 3,
  "errors": 2,
  "durationSeconds": 127.5,
  "timestamp": "2025-01-03T10:02:07.500Z"
}
```

## Zaman Dilimi (Timezone)

Vercel Cron Jobs **UTC** timezone'unda çalışır:
- `50 9 * * *` = UTC 09:50 = **Türkiye 12:50** (UTC+3)
- `0 10 * * *` = UTC 10:00 = **Türkiye 13:00** (UTC+3)

### Türkiye Saatine Göre Ayarlama (İsteğe Bağlı)

Eğer **Türkiye saati 09:50 ve 10:00** istiyorsan:

```json
{
  "crons": [
    {
      "path": "/api/cron/delete-tenders",
      "schedule": "50 6 * * *"
    },
    {
      "path": "/api/cron/scrape-tenders",
      "schedule": "0 7 * * *"
    }
  ]
}
```

- `50 6 * * *` = UTC 06:50 = **Türkiye 09:50**
- `0 7 * * *` = UTC 07:00 = **Türkiye 10:00**

## Cron Schedule Formatı

```
┌───────────── dakika (0 - 59)
│ ┌───────────── saat (0 - 23)
│ │ ┌───────────── ayın günü (1 - 31)
│ │ │ ┌───────────── ay (1 - 12)
│ │ │ │ ┌───────────── haftanın günü (0 - 6) (Pazar = 0)
│ │ │ │ │
* * * * *
```

Örnekler:
- `0 10 * * *` - Her gün 10:00
- `30 14 * * 1` - Her Pazartesi 14:30
- `0 9 1 * *` - Her ayın 1. günü 09:00
- `*/15 * * * *` - Her 15 dakikada bir

## Monitoring & Logs

### Vercel Dashboard'da Log Kontrolü

1. Vercel Dashboard > Project > Deployments
2. Son deployment'ı seç
3. Functions > Cron logs
4. `/api/cron/delete-tenders` ve `/api/cron/scrape-tenders` loglarını gör

### Database Kontrolü

Supabase'de kontrol:
```sql
-- Toplam ihale sayısı
SELECT COUNT(*) FROM ihale_listings;

-- Catering ihaleleri
SELECT COUNT(*) FROM ihale_listings WHERE is_catering = true;

-- Son eklenen 10 ihale
SELECT title, organization, first_seen_at
FROM ihale_listings
ORDER BY first_seen_at DESC
LIMIT 10;

-- Scraping logları
SELECT * FROM scraping_logs
ORDER BY created_at DESC
LIMIT 10;
```

## Güvenlik

- **CRON_SECRET** environment variable ile korunur
- Sadece doğru Authorization header ile çalışır
- Production'da mutlaka güçlü bir secret kullan
- Secret'ı asla git'e commit etme

## Troubleshooting

### Cron job çalışmıyor?

1. **Vercel Dashboard kontrol et:**
   - Settings > Crons > Cron jobs görünüyor mu?
   - Status: Active mi?

2. **Environment variable kontrol et:**
   - `CRON_SECRET` doğru girilmiş mi?
   - Production environment'ta var mı?

3. **Endpoint manuel test et:**
   ```bash
   curl -X GET https://your-app.vercel.app/api/cron/scrape-tenders \
     -H "Authorization: Bearer YOUR_SECRET"
   ```

4. **Logs kontrol et:**
   - Vercel Dashboard > Functions > Logs
   - Hata mesajları var mı?

### "Unauthorized" hatası alıyorum

- `Authorization` header doğru formatta mı?
  ```
  Authorization: Bearer YOUR_SECRET
  ```
- `CRON_SECRET` environment variable doğru mu?
- Deploy sonrası environment variable'ları güncellemeyi unutma

### Scraping timeout oluyor

- Vercel Functions default timeout: 10 saniye
- Pro plan ile 60 saniye
- Eğer timeout oluyorsa, `maxPages` değerini azalt:
  ```typescript
  const result = await ScraperOrchestrator.scrapeAll({
    sources: ['ihalebul'],
    maxPages: 5, // 10 yerine 5
    parallelPages: 3, // 5 yerine 3
    testMode: false,
  });
  ```

## Sonraki Adımlar (Opsiyonel)

1. **Email bildirimleri ekle** - Scraping tamamlandığında email gönder
2. **Slack/Discord webhook** - Sonuçları Slack'e gönder
3. **Error tracking** - Sentry entegrasyonu
4. **Monitoring dashboard** - Scraping istatistikleri için dashboard

## Destek

Sorun yaşıyorsan:
1. Vercel logs'u kontrol et
2. Supabase logs'u kontrol et
3. Browser console'da hata var mı?
4. Manuel curl komutuyla test et
