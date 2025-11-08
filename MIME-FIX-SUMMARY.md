# 🎯 MIME Type Fix - Dosya Upload Crash Çözümü

**Tarih**: 7 Kasım 2025
**Sorun**: TXT, JSON dosyaları upload edildiğinde sayfa kapanıyor, CSV çalışıyor
**Kök Sebep**: Browser'dan gelen bozuk MIME tipleri (boş, `application/octet-stream`, `application/json`)

---

## 🔍 Sorun Analizi

### Çalışan Format
- **CSV** → `text/csv` ✅ Next.js upload route kabul ediyor

### Çalışmayan Formatlar
- **TXT** → `""` veya `text/plain` veya `application/octet-stream` ❌
- **JSON** → `application/json` ❌ (form-data parser JSON'u data olarak görüyor)
- **HTML** → `application/octet-stream` ❌

### Neden Oluyor?
1. Browser bazı dosya tiplerini tanıyamıyor → boş MIME gönderiyor
2. Bazı sistemler her şeyi `application/octet-stream` (generic binary) olarak gönderiyor
3. Next.js upload route `SmartDocumentProcessor` sadece belirli MIME tiplerinde düzgün parse ediyor
4. Fallback mekanizması devreye girmiyor → 500/415 hata → sayfa kapanıyor

---

## ✅ Uygulanan Çözüm

### 1. Client-Side MIME Override (3 Lokasyon)

#### A) File Input Handler (`handleFileChange`)
```typescript
// 🎯 MIME TYPE FIX: Browser'dan gelen bozuk MIME'ları düzelt
let fixedFile = file;
const originalMime = file.type;

const isBrokenMime = 
  originalMime === "" || 
  originalMime === "application/octet-stream" ||
  originalMime === "application/json" ||
  originalMime === "text/plain";

if (isBrokenMime) {
  const ext = file.name.toLowerCase().split('.').pop();
  let correctedMime = "text/html"; // Default fallback
  
  if (ext === "txt") correctedMime = "text/plain";
  else if (ext === "json") correctedMime = "text/plain"; // JSON'u text olarak işle
  else if (ext === "csv") correctedMime = "text/csv";
  else if (ext === "pdf") correctedMime = "application/pdf";
  else if (ext === "docx") correctedMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  
  fixedFile = new File([file], file.name, { type: correctedMime });
  console.log(`🔧 MIME düzeltildi: ${file.name} "${originalMime}" → "${correctedMime}"`);
}

fileObjectsMapRef.current.set(file.name, fixedFile);
```

#### B) Drag-and-Drop Handler (`onFileSelect`)
- Aynı MIME fix mantığı
- Console log: `🔧 MIME düzeltildi (drag-drop): ...`

#### C) İhale Dökümanı Loader (IndexedDB'den gelen dosyalar)
```typescript
let mimeType = doc.mimeType || 'application/pdf';

if (mimeType === "" || mimeType === "application/octet-stream") {
  const ext = (doc.title || '').toLowerCase().split('.').pop();
  // Uzantıya göre doğru MIME ata
}
```

### 2. Document Downloader Fix (`document-downloader.ts`)

#### ZIP İçinden Çıkan Dosyalar
```typescript
let mimeType = file.type || 'application/octet-stream';

if (mimeType === "" || mimeType === "application/octet-stream") {
  const ext = (file.name || '').toLowerCase().split('.').pop();
  // Uzantıya göre düzelt
}
```

#### Tek Dosya İndirmeleri
- Aynı mantık
- Console log: `🔧 Download MIME düzeltildi: ...`

### 3. Debug Logging
```typescript
// handleFileChange başında
console.log('🔍 Dosya seçildi - MIME type analizi:');
files.forEach((file, i) => {
  console.log(`  [${i+1}] ${file.name}`);
  console.log(`      MIME: "${file.type}" ${file.type === "" ? "⚠️ BOŞ!" : ""}`);
  console.log(`      Size: ${(file.size/1024).toFixed(1)}KB`);
});
```

---

## 🧪 Test Senaryoları

### 1. Manual Upload (File Input)
```bash
# Test dosyaları:
echo "Test içerik" > test.txt
echo '{"key": "value"}' > test.json
echo "col1,col2\nval1,val2" > test.csv

# Beklenen davranış:
# - Console'da MIME analizi görünmeli
# - Bozuk MIME'ler düzeltilmeli
# - 3 dosya da başarıyla yüklenmeli
# - Sayfa kapanmamalı
```

### 2. Drag & Drop
```bash
# Aynı dosyaları sürükle-bırak
# Beklenen: "🔧 MIME düzeltildi (drag-drop)" log'u
```

### 3. İhale Dökümanları (IndexedDB)
```bash
# İhale seç → Döküman İndir
# Beklenen: "🔧 İhale dökümanı MIME düzeltildi" log'u
```

### 4. URL'den İndirme
```bash
# URL ile döküman indir (ZIP veya tek dosya)
# Beklenen: "🔧 ZIP dosya MIME düzeltildi" veya "🔧 Download MIME düzeltildi"
```

---

## 📊 Beklenen Sonuçlar

### Console Çıktısı (Başarılı Fix)
```
🔍 Dosya seçildi - MIME type analizi:
  [1] test.txt
      MIME: "" ⚠️ BOŞ!
      Size: 0.3KB
  [2] test.json
      MIME: "application/json"
      Size: 0.5KB
  [3] test.csv
      MIME: "text/csv"
      Size: 0.4KB

🔧 MIME düzeltildi: test.txt "" → "text/plain"
🔧 MIME düzeltildi: test.json "application/json" → "text/plain"

✅ 3 dosya pending olarak eklendi
📋 3 dosya kuyruğa eklendi. Sırayla işlenecek...
```

### Upload API Çıktısı
```
📤 Processed file: test.txt (type: text/plain)
📤 Processed file: test.json (type: text/plain)
📤 Processed file: test.csv (type: text/csv)

✅ Upload successful - 3 files
```

---

## 🎯 Değişen Dosyalar

1. **`/src/app/ihale/yeni-analiz/page.tsx`** (3 lokasyon)
   - `handleFileChange` - Line ~1235
   - `onFileSelect` (drag-drop) - Line ~1800
   - İhale döküman loader - Line ~315

2. **`/src/lib/utils/document-downloader.ts`** (2 lokasyon)
   - ZIP file extraction - Line ~105
   - Single file download - Line ~135

---

## 🔒 Güvenlik & Performans

### ✅ Güvenli
- Sadece uzantıya göre MIME düzeltme (içerik değişmiyor)
- Browser File API kullanımı (standart)
- Memory leak yok (FileObjectsMap zaten mevcut)

### ⚡ Performans
- Minimal overhead (sadece MIME string replace)
- Async işlem yok
- Dosya içeriği kopyalanmıyor (Blob referansı korunuyor)

---

## 🚀 Deployment Checklist

- [x] TypeScript hataları yok
- [x] ESLint/Prettier uyumlu
- [x] Console log'ları ekli (production'da kalsın - debug için yararlı)
- [x] Tüm upload yolları kapsandı
- [ ] Local test (3 dosya türü)
- [ ] Production test (gerçek ihale dökümanları)

---

## 📝 Notlar

### Neden JSON → `text/plain`?
- `application/json` MIME tipi form-data parser'da "veri" olarak algılanıyor
- `text/plain` olarak gönderilince SmartDocumentProcessor düzgün parse ediyor
- JSON içeriği korunuyor, sadece MIME etiketi değişiyor

### Neden Boş MIME → `text/html`?
- Fallback mekanizması en güvenli format
- SmartDocumentProcessor HTML'i otomatik temizliyor
- Gerçek format AI tarafından tespit ediliyor (detectedType)

### CSV Neden Çalışıyordu?
- Browser `text/csv` MIME'ını doğru gönderiyor
- Upload route bu MIME'ı kabul ediyor
- CSVParser sorunsuz parse ediyor

---

**Son Güncelleme**: 7 Kasım 2025 22:15
**Durum**: ✅ IMPLEMENTED - Test bekleniyor
**Next Steps**: 
1. Local test (3 dosya türü)
2. Production deployment
3. Real-world ihale dökümanları ile test
