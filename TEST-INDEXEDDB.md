# IndexedDB Test Rehberi

## 🧪 Test Senaryosu

### 1. İhale Robotu Sayfası
1. Bir ihale seç (detay modal'ı aç)
2. Console'u aç (Cmd+Option+J)
3. "Analize Gönder" butonuna bas

### 2. Beklenen Console Logları (Sırayla)

```
✅ BAŞARILI KAYIT SEKANSİ:
───────────────────────────────────────────

🚀 sendToAnalysis çağrıldı - preparedDocuments: X
🔍 preparedDocuments: {...}
🆔 Oluşturulan ID: ihale_docs_1234567890
🧹 X eski IndexedDB verisi temizleniyor...
✅ Eski veriler temizlendi

📦 PAYLOAD DETAYLARI (Kayıt Öncesi)
🆔 Key: ihale_docs_1234567890
📋 Title: ...
📄 Text length: X chars
📊 Document count: X
📦 Total size: X.XX MB
📄 Documents: [...]

✅ Payload validasyon geçti

💾 IndexedDB'ye KAYDEDILIYOR: ihale_docs_1234567890
   - Size: X.XX MB
   - Documents: X

✅ saveToIndexedDB() tamamlandı
✅ IndexedDB kaydı tamamlandı
✅ IndexedDB transaction complete: ihale_docs_1234567890 (X.XX MB)

🔄 IndexedDB transaction flushed (200ms waited)

🔍 Doğrulama denemesi 1/3...
✅ IndexedDB'den yüklendi: ihale_docs_1234567890
✅ IndexedDB yazma doğrulandı (deneme 1)
✅ Veri doğrulandı: {title: "...", textLength: X, documentCount: X}

🚀 Yönlendirme yapılıyor: /ihale/yeni-analiz?from=ihale_docs_1234567890
```

### 3. Yeni Analiz Sayfası

```
✅ BAŞARILI YÜKLEME SEKANSİ:
───────────────────────────────────────────

🔍 useEffect çalıştı - from parametresi: ihale_docs_1234567890
🔍 currentStep: upload
🔍 indexedDBProcessedRef: false
🎯 İhale robotundan gelen veri tespit edildi, IndexedDB'den yükleniyor...
🧹 Eski state temizleniyor...

✅ IndexedDB bağlantısı açıldı
✅ IndexedDB'den yüklendi: ihale_docs_1234567890

📦 IndexedDB'den okunan data: VAR
📦 IndexedDB data bulundu: {hasDocuments: true, hasText: true, documentCount: X, size: "X.XX MB"}

📄 X döküman yükleniyor... (Toplam: X.XX MB)
✅ File oluşturuldu: dosya1.pdf {...}
✅ File oluşturuldu: dosya2.pdf {...}
...

✅ İhale robotu verileri başarıyla yüklendi
```

---

## ❌ HATA SENARYOLARI

### Hata 1: Veri Bulunamadı
```
⚠️ IndexedDB'de bulunamadı: ihale_docs_1234567890
📦 IndexedDB'den okunan data: YOK
⚠️ IndexedDB data bulunamadı: ihale_docs_1234567890
🔍 Mevcut IndexedDB anahtarları: [...]
```

**Çözüm:** İhale robotundan tekrar gönderin.

---

### Hata 2: preparedDocuments Boş
```
⚠️ preparedDocuments boş - sadece ihale metni gönderilecek
⚠️ Döküman yok - sadece ihale metni gönderiliyor
```

**Durum:** Normal! İhale sadece text ile de analiz edilebilir.

---

### Hata 3: Transaction Başarısız
```
❌ IndexedDB kayıt hatası: ...
❌ Transaction hatası: ...
❌ Transaction iptal edildi
```

**Çözüm:** Tarayıcı önbelleğini temizleyin, sayfayı yenileyin.

---

## 🔍 Manuel IndexedDB Kontrolü

### Chrome DevTools → Application → IndexedDB

1. `procheff-ihale-storage` database'ini aç
2. `temp-analysis-data` store'u kontrol et
3. `ihale_docs_*` key'lerini gör
4. Value'yu tıkla → JSON formatında göster

**Beklenen Yapı:**
```json
{
  "title": "İhale Başlığı",
  "text": "İhale metni içeriği...",
  "documents": [
    {
      "name": "dosya.pdf",
      "type": "application/pdf",
      "size": 123456,
      "blob": Blob {...}
    }
  ],
  "size": 987654,
  "timestamp": 1234567890123
}
```

---

## 🧹 IndexedDB Temizleme

Console'da çalıştır:
```javascript
// Tüm verileri listele
const db = await indexedDB.open('procheff-ihale-storage', 1);
const tx = db.transaction('temp-analysis-data', 'readonly');
const keys = await tx.objectStore('temp-analysis-data').getAllKeys();
console.log('Mevcut anahtarlar:', keys);

// Tek bir veriyi sil
await deleteFromIndexedDB('ihale_docs_1234567890');

// Tümünü temizle
await clearIndexedDB();
```

---

## 📊 Test Sonucu

**Tarih:** 8 Kasım 2025
**Durum:** [   ] ✅ Başarılı / [   ] ❌ Başarısız

**Notlar:**
_Buraya test sırasında gözlemlediğiniz logları yazın_
