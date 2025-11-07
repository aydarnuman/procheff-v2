# 🔧 Dosya İşleme Fix - NaN% & Çakışma Çözümü

**Tarih**: 7 Kasım 2025  
**Problem**: "dosyaları işlerken çakışma veya limite takılıyor NaN% güven debug oluyor"  
**Status**: ✅ Root cause bulundu, fix planı hazır

---

## 🐛 Root Cause Analysis

### 1. NaN% Güven Skoru Problemi

**Lokasyon**: `src/app/api/ai/full-analysis/route.ts:375`

**Sebep**:
```typescript
// ❌ MEVCUT KOD (Line 375)
const baseConfidence = typeof extractedData.guven_skoru === 'number' && !isNaN(extractedData.guven_skoru)
  ? extractedData.guven_skoru
  : 0.7; // Varsayılan güven skoru
```

**Neden NaN oluyor**:
- AI provider (Claude/Gemini) bazen `guven_skoru` field'ını **hiç göndermiy or** veya `null` gönderiyor
- Frontend'de `extractedData.guven_skoru` → `undefined` → `Math.round(undefined * 100)` → `NaN`
- API'de fallback var (`0.7`) AMA **UI'a bu değer yansımıyor**

**Örnek Hata Akışı**:
```
AI Response → { kurum: "...", ihale_turu: "...", /* guven_skoru YOK */ }
                ↓
API Processing → baseConfidence = 0.7 ✅ (fallback works)
                ↓
UI Render → extractedData.guven_skoru = undefined ❌
                ↓
Display → Math.round(undefined * 100) = NaN%
```

---

### 2. Dosya Çakışması/Limit Problemi

**Lokasyon**: `src/app/ihale/yeni-analiz/page.tsx:564`

**Mevcut Queue Mekanizması**:
```typescript
// ❌ MEVCUT KOD (Line 564-570)
const processSingleFile = async (file: File) => {
  // Zaten işleniyorsa atla
  if (processingQueueRef.current.has(file.name)) {
    console.warn(`⚠️ ${file.name} zaten işleniyor, atlanıyor...`);
    return;
  }
  
  // Kuyruğa ekle
  processingQueueRef.current.add(file.name);
  // ... dosya işleme başlıyor ...
}
```

**Neden çakışıyor**:
1. **Duplicate check var, SIRA yok!**
   - `processingQueueRef` sadece "aynı dosya 2 kez mi?" kontrolü yapıyor
   - Ama **FARLI dosyalar AYNI ANDA işlenebiliyor**

2. **Concurrency sorunları**:
   ```
   Dosya 1 → processSingleFile() başlıyor → API çağrısı → streaming...
                    ↓ (AYNI ANDA)
   Dosya 2 → processSingleFile() başlıyor → API çağrısı → streaming...
                    ↓ (ÇAKIŞMA!)
   ```

3. **Sorunlar**:
   - `setCurrentAnalysis()` race condition (2 dosya aynı anda set ediyor)
   - API rate limits (Claude: 50 req/min, Gemini: 8 req/min)
   - Memory spike (2 streaming response aynı anda)
   - Progress bar çakışması (`setAnalysisProgress()` iki yerden güncelleniyor)

**Örnek Senaryo**:
```
User: 3 PDF yükler (tender1.pdf, tender2.pdf, tender3.pdf)

❌ ŞU AN (Çakışma):
00:00 → tender1.pdf başladı (API çağrısı)
00:01 → tender2.pdf başladı (API çağrısı) ← HATA: 1. dosya bitmeden 2. başladı!
00:02 → tender3.pdf başladı (API çağrısı) ← HATA: Claude rate limit!
00:05 → NaN% güven skoru (state çakışması)
```

---

## ✅ ÇÖZÜM: Sıralı İşleme Sistemi

### Fix 1: NaN Güven Skoru Düzeltmesi

**Dosya**: `src/app/api/ai/full-analysis/route.ts`

```typescript
// ✅ YENİ KOD - Line 375'i değiştir
// ÖNCEDEN: extractedData.guven_skoru kontrolü
// SONRA: Her zaman valid bir sayı garantile

const baseConfidence = typeof extractedData.guven_skoru === 'number' && !isNaN(extractedData.guven_skoru)
  ? extractedData.guven_skoru
  : 0.7;

// ✅ EKLE: Extracted data'ya güven skorunu yaz (UI için)
if (!extractedData.guven_skoru || isNaN(extractedData.guven_skoru)) {
  extractedData.guven_skoru = baseConfidence;
  console.warn('⚠️ Güven skoru AI tarafından döndürülmedi, varsayılan 0.7 kullanıldı');
}

const overallConfidence = Math.min(
  baseConfidence,
  extractedData.kisi_sayisi && extractedData.tahmini_butce ? 0.95 : 0.8
);

// ✅ EKLE: Sonuç nesnesinde de güven skorunu güncelle
const result: AIAnalysisResult = {
  extracted_data: {
    ...extractedData,
    guven_skoru: baseConfidence, // ← FORCE VALID VALUE
  },
  contextual_analysis: contextualAnalysis,
  processing_metadata: {
    processing_time: totalProcessingTime,
    ai_provider: `${extraction.type} (extraction) + ${strategic.type} (strategic)`,
    confidence_score: overallConfidence,
  },
  validation_warnings: validationResult.warnings.length > 0 ? validationResult.warnings : undefined,
  csv_analyses: csvAnalyses,
};
```

**Etki**:
- ✅ NaN% güven skoru **asla gösterilmeyecek**
- ✅ AI güven skoru döndürmezse → varsayılan 0.7 (70%)
- ✅ UI her zaman valid sayı alacak

---

### Fix 2: Sıralı Dosya İşleme (File Queue)

**Dosya**: `src/app/ihale/yeni-analiz/page.tsx`

**Yeni Approach**:
1. **Processing Queue** → **FIFO Queue** (First In, First Out)
2. Sadece **1 dosya aynı anda** işlenebilir
3. Diğer dosyalar **sırada bekler**

**Implementasyon**:

```typescript
// ✅ YENİ: Queue State (Line ~140'a ekle)
const [fileQueue, setFileQueue] = useState<File[]>([]); // Bekleyen dosyalar
const [currentlyProcessing, setCurrentlyProcessing] = useState<File | null>(null); // Şu anda işlenen

// ✅ YENİ: Queue İşleme Fonksiyonu
const processFileQueue = useCallback(async () => {
  // Zaten bir dosya işleniyorsa bekle
  if (currentlyProcessing) {
    console.log('⏳ Bir dosya zaten işleniyor, sıra bekleniyor...');
    return;
  }

  // Kuyrukta dosya yoksa bitir
  if (fileQueue.length === 0) {
    console.log('✅ Kuyruk boş, tüm dosyalar işlendi');
    return;
  }

  // Kuyruktan ilk dosyayı al
  const nextFile = fileQueue[0];
  setCurrentlyProcessing(nextFile);
  setFileQueue(prev => prev.slice(1)); // Kuyruktan çıkar

  console.log(`🚀 İşleniyor: ${nextFile.name} (Kuyrukta ${fileQueue.length - 1} dosya kaldı)`);

  try {
    // ✅ Mevcut processSingleFile() fonksiyonunu kullan
    await processSingleFile(nextFile);
    
    toast.success(`✅ ${nextFile.name} tamamlandı!`);
  } catch (error) {
    console.error(`❌ ${nextFile.name} işlenirken hata:`, error);
    toast.error(`❌ ${nextFile.name} işlenemedi: ${error}`);
  } finally {
    setCurrentlyProcessing(null);
    
    // ✅ Sonraki dosyayı işle (recursive)
    setTimeout(() => {
      processFileQueue();
    }, 500); // 500ms bekle (API rate limit için)
  }
}, [fileQueue, currentlyProcessing, processSingleFile]);

// ✅ YENİ: useEffect - Queue değişince işlemeye başla
useEffect(() => {
  if (fileQueue.length > 0 && !currentlyProcessing) {
    processFileQueue();
  }
}, [fileQueue, currentlyProcessing, processFileQueue]);

// ✅ DEĞİŞTİR: handleFileChange - Dosyaları kuyruğa ekle
const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  const maxSize = 50 * 1024 * 1024; // 50MB
  const validFiles: File[] = [];

  for (const file of files) {
    // Boyut ve tip kontrolü (mevcut kod aynı kalır)
    if (file.size > maxSize) {
      toast.error(`❌ ${file.name} çok büyük! Maksimum: 50MB`);
      continue;
    }

    // ... diğer validasyonlar ...

    validFiles.push(file);
  }

  if (validFiles.length === 0) return;

  // ✅ YENİ: Dosyaları kuyruğa ekle (direkt işleme yerine)
  setFileQueue(prev => [...prev, ...validFiles]);
  
  toast.info(`📋 ${validFiles.length} dosya kuyruğa eklendi. Sırayla işlenecek...`);
  
  console.log(`📋 Kuyruk güncellendi: ${validFiles.length} yeni dosya (Toplam: ${fileQueue.length + validFiles.length})`);
};

// ✅ YENİ: Queue Progress UI (Render kısmına ekle)
{fileQueue.length > 0 && (
  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
    <div className="flex items-center gap-3">
      <div className="animate-spin text-blue-600">⏳</div>
      <div>
        <p className="font-semibold text-blue-900 dark:text-blue-100">
          Dosya İşleme Kuyruğu
        </p>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {currentlyProcessing ? (
            <>
              🔄 İşleniyor: <strong>{currentlyProcessing.name}</strong>
            </>
          ) : (
            'Hazırlanıyor...'
          )}
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          Kuyrukta bekleyen: {fileQueue.length} dosya
        </p>
      </div>
    </div>
    
    {/* Queue list */}
    {fileQueue.length > 0 && (
      <div className="mt-3 space-y-1">
        {fileQueue.slice(0, 3).map((file, idx) => (
          <div key={file.name} className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <span className="font-mono">{idx + 1}.</span>
            <span>{file.name}</span>
            <span className="text-blue-400">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
          </div>
        ))}
        {fileQueue.length > 3 && (
          <div className="text-xs text-blue-500">
            ... ve {fileQueue.length - 3} dosya daha
          </div>
        )}
      </div>
    )}
  </div>
)}
```

---

## 📊 Beklenen İyileştirmeler

### 1. NaN Fix Sonrası
- ✅ **100% Valid Confidence Scores** - NaN asla gösterilmeyecek
- ✅ **Fallback Guarantee** - AI response'da eksik olsa bile 70% gösterilir
- ✅ **User Trust** - Her zaman anlamlı bir güven skoru

### 2. Queue Fix Sonrası
- ✅ **0% Çakışma** - Her dosya sırayla işlenir
- ✅ **API Rate Limit Koruması** - 500ms delay between files
- ✅ **Memory Efficiency** - Tek streaming response
- ✅ **Progress Transparency** - Kullanıcı kuyruğu görebilir
- ✅ **Better UX** - "3/5 dosya işleniyor" feedback

**Performans**:
```
ÖNCE (Çakışma):
- 3 dosya → 3 parallel API → CRASH veya NaN

SONRA (Sıralı):
- 3 dosya → File 1 (10s) → File 2 (10s) → File 3 (10s) → ✅ 30s total
- API rate limit: ✅ Güvenli
- Memory: ✅ Stabil
- State: ✅ Çakışma yok
```

---

## 🚀 Uygulama Planı

### Adım 1: NaN Fix (5 dakika)
1. `src/app/api/ai/full-analysis/route.ts` aç
2. Line 375-395 arası güven skoru hesaplamasını değiştir
3. `extractedData.guven_skoru` field'ını force et
4. Test: Güven skoru döndürmeyen bir dosya yükle → %70 görmeli

### Adım 2: Queue Fix (30 dakika)
1. `src/app/ihale/yeni-analiz/page.tsx` aç
2. State ekle: `fileQueue`, `currentlyProcessing`
3. `processFileQueue()` fonksiyonunu ekle
4. `handleFileChange()` güncelle (kuyruğa ekle)
5. Queue UI component'i ekle
6. Test: 3 dosya yükle → sırayla işlendiğini gör

### Adım 3: Test Senaryoları
1. ✅ Tek dosya → Normal çalışmalı
2. ✅ 3 dosya paralel → Sırayla işlenmeli
3. ✅ AI güven skoru döndürmezse → %70 görmeli
4. ✅ Queue'da beklerken yeni dosya ekle → Kuyruğa eklenmeli
5. ✅ İşlem sırasında hata → Sonraki dosya işlenmeli

---

## 📝 Notes

### Neden Bu Problem Önce Yoktu?
1. **AI Model Değişikliği**: Claude/Gemini output formatı değişmiş olabilir
2. **Kullanım Artışı**: Önce tek dosya test ediliyordu, şimdi multi-file
3. **Rate Limit**: API quota önce dolmuyordu, şimdi doluyor

### Alternatif Çözümler
- ❌ **Parallel Processing + Mutex**: Karmaşık, rate limit riski devam eder
- ❌ **Web Worker**: Overkill, state management zorlaşır
- ✅ **FIFO Queue**: Basit, güvenli, anlaşılır

### Gelecek İyileştirmeler
- 🔮 **Priority Queue**: Küçük dosyalar önce işlensin
- 🔮 **Batch Processing**: 100MB altı dosyalar birleştirilip tek API çağrısı
- 🔮 **Smart Retry**: API fail olursa otomatik 3 deneme
- 🔮 **Persistent Queue**: localStorage - Sayfa yenilenince devam etsin

---

**Hazırlayan**: AI Agent  
**Review**: Bekliyor  
**Status**: ✅ Ready to implement
