# 🚀 ÖZELLEŞMİŞ AI API MİMARİSİ

Procheff-v2 sisteminde her belge türü için optimize edilmiş özel AI API'leri.

## 📊 Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────────┐
│                   DOCUMENT UPLOAD                            │
│  (DocumentUploadWizard - Belge türü tespiti ile)           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  BELGE TÜRÜNE GÖRE ROUTING    │
        └───────────────┬───────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
    ┌───▼───────┐              ┌───────▼────┐
    │  TEXT API │              │ TABLE API  │
    │  (Claude) │              │  (Gemini)  │
    └───────────┘              └────────────┘
```

## 🔥 5 YENİ SPECIALIZED API

### 1. `/api/ai/extract-ihale-ilani` - İhale İlanı Expert

**AI Provider:** Claude Sonnet 4
**Odak Alanı:** Tarih, bütçe, teminat, başvuru şartları

**Özelleşmiş Extraction:**
- ✅ İhale tarihi ve teklif son tarihi (KRİTİK!)
- ✅ Tahmini bütçe ve ödeme koşulları
- ✅ Başvuru şartları ve teminat bilgileri
- ✅ İhale usulü ve değerlendirme kriterleri

**Prompt Özellikleri:**
- Düşük temperature (0.3) - Tarihler ve sayılar hassas
- Tarih formatı doğrulama (YYYY-MM-DD HH:MM)
- Bütçe sayısal parse (virgül → nokta)
- Teminat hesaplama (genelde %3)

**Örnek Kullanım:**
```typescript
POST /api/ai/extract-ihale-ilani
Body: {
  text: "İhale ilanı metni...",
  fileName: "ihale_ilani.pdf"
}

Response: {
  success: true,
  data: {
    ihale_tarihi: "2025-01-25 14:00",
    teklif_son_tarih: "2025-01-20 17:00",
    tahmini_butce: 2500000,
    gecici_teminat: 75000,
    basvuru_sartlari: [...],
    ...
  }
}
```

---

### 2. `/api/ai/extract-teknik-sartname` - Teknik Şartname Expert

**AI Provider:** Dual API (Claude + Gemini)
**Odak Alanı:** Menü, gramaj, personel, ekipman tabloları

**Özelleşmiş Extraction:**
- ✅ Menü programı ve gramajlar (TABLO - Gemini)
- ✅ Personel sayısı ve nitelikleri (TABLO - Gemini)
- ✅ Ekipman/Araç-Gereç listeleri (TABLO - Gemini)
- ✅ Özel standartlar (ISO, HACCP) (TEXT - Claude)
- ✅ Üretim yöntemi (TEXT - Claude)

**Dual API Orchestrator:**
```typescript
// Text API (Claude): Metinsel bilgiler
// Table API (Gemini): Yapılandırılmış tablolar
// ⚡ PARALEL İŞLEME - Her iki API aynı anda çalışır
```

**Prompt Enhancement:**
- Teknik şartname için özel header eklenir
- Tablo tespit ipuçları verilir
- Gramaj, personel, ekipman vurguları

**Örnek Kullanım:**
```typescript
POST /api/ai/extract-teknik-sartname
Body: {
  text: "Teknik şartname metni (menü tabloları içerir)...",
  fileName: "teknik_sartname.pdf"
}

Response: {
  success: true,
  data: {
    veri_havuzu: { /* Claude - Metin */ },
    tablolar: [ /* Gemini - Tablolar */
      {
        baslik: "Menü Programı",
        headers: ["Gün", "Ana Yemek", "Gramaj"],
        rows: [["1", "Tavuk sote", "250 gr"], ...]
      }
    ],
    tablo_intelligence: { /* Tablo analizi */ }
  },
  metadata: {
    text_api: "claude-sonnet-4",
    table_api: "gemini-2.0-flash"
  }
}
```

---

### 3. `/api/ai/extract-sozlesme` - Sözleşme Expert

**AI Provider:** Claude Sonnet 4
**Odak Alanı:** Ceza şartları, yükümlülükler, fesih koşulları

**Özelleşmiş Extraction:**
- ✅ Sözleşme süresi ve tarihler
- ✅ Ödeme koşulları (dönem, şekil, avans)
- ✅ Ceza şartları (gecikme, eksik hizmet)
- ✅ Yüklenici ve idarenin yükümlülükleri
- ✅ Fesih şartları ve teminat iadesi
- ✅ Anlaşmazlık çözümü (mahkeme, tahkim)

**Prompt Özellikleri:**
- Çok düşük temperature (0.2) - Kesin bilgiler kritik
- Madde numarası referansları
- Ceza miktarları ve oranları (binde 3, %10 vb.)
- Risk tespiti (ağır cezalar, kolay fesih)

**Örnek Kullanım:**
```typescript
POST /api/ai/extract-sozlesme
Body: {
  text: "Sözleşme metni...",
  fileName: "sozlesme.pdf"
}

Response: {
  success: true,
  data: {
    sozlesme_suresi: "365 gün",
    odeme_kosullari: { ... },
    ceza_sartlari: [
      {
        durum: "Gecikme",
        ceza: "Günlük binde 3",
        ust_limit: "%10"
      }
    ],
    yuklenici_yukumlulukleri: [...],
    fesih_sartlari: [...],
    riskler: ["Yüksek ceza oranları", ...]
  }
}
```

---

### 4. `/api/ai/analyze-csv` - CSV Maliyet Expert

**AI Provider:** Claude Sonnet 4 (CSV Expert)
**Odak Alanı:** Maliyet analizi, kar marjı, rekabet değerlendirmesi

**Özelleşmiş Extraction:**
- ✅ Maliyet kalemleri ve birim fiyatlar
- ✅ Toplam bütçe hesaplaması
- ✅ Kritik maliyet kalemleri (et, personel)
- ✅ Kar marjı analizi (%5-12 makul aralık)
- ✅ Rekabet gücü değerlendirmesi

**CSV Format Desteği:**
- Standart CSV (`,`)
- Türkçe CSV (`;`) - Otomatik normalize
- TSV (tab-separated)

**Prompt Özellikleri:**
- Maliyet kategorileme (Gıda, Personel, Ekipman, Enerji)
- Kritik kalem tespiti (kritik_mi: true/false)
- Risk analizi (fiyat dalgalanması, asgari ücret artışı)
- Öneriler (eskalasyon maddeleri, fiyat garantileri)

**Örnek Kullanım:**
```typescript
POST /api/ai/analyze-csv
Body: {
  text: "Kalem,Miktar,Birim Fiyat,Toplam\nDana Eti,1000,350,350000\n...",
  fileName: "maliyet.csv"
}

Response: {
  success: true,
  data: {
    maliyet_kalemleri: [
      {
        kategori: "Gıda",
        kalem: "Dana eti",
        birim_fiyat: 350,
        toplam: 350000,
        kritik_mi: true
      }
    ],
    kar_marji_analizi: {
      hedef_kar_marji: 0.08,
      teklif_fiyati: 2500000
    },
    kritik_riskler: [...],
    oneriler: [...]
  }
}
```

---

### 5. `/api/ai/merge-documents` - Multi-Document Cross-Validator

**AI Provider:** Claude Sonnet 4 (Merger)
**Odak Alanı:** Belge birleştirme, tutarlılık kontrolü, çelişki çözümü

**Özelleşmiş İşlev:**
- ✅ Cross-validation: Farklı belgelerdeki aynı bilgileri karşılaştır
- ✅ Conflict resolution: Çelişkili bilgileri tespit et ve çöz
- ✅ Completeness check: Eksik bilgileri tespit et
- ✅ Smart merge: Öncelik sırasına göre birleştir

**Öncelik Sırası (Çelişki Durumunda):**
```
İhale İlanı > Teknik Şartname > Sözleşme > CSV > Diğer
```

**Prompt Özellikleri:**
- Çok düşük temperature (0.1) - Tutarlılık kritik
- Belge karşılaştırma matrisi
- Çelişki tespiti ve çözümü
- Skorlama (tutarlılık, eksiksizlik, güven)

**Örnek Kullanım:**
```typescript
POST /api/ai/merge-documents
Body: {
  documents: [
    {
      type: "ihale_ilani",
      data: { kisi_sayisi: 15, tahmini_butce: 2500000 },
      fileName: "ilan.pdf"
    },
    {
      type: "teknik_sartname",
      data: { kisi_sayisi: 17, tahmini_butce: null },
      fileName: "sartname.pdf"
    }
  ]
}

Response: {
  success: true,
  data: {
    unified_data: {
      kisi_sayisi: 17,  // Teknik şartname seçildi (daha detaylı)
      tahmini_butce: 2500000,  // İhale ilanından alındı
      kaynaklar: {
        kisi_sayisi: "teknik_sartname",
        tahmini_butce: "ihale_ilani"
      }
    },
    tutarsizliklar: [
      {
        alan: "kisi_sayisi",
        degerler: [
          { deger: 15, kaynak: "ihale_ilani" },
          { deger: 17, kaynak: "teknik_sartname" }
        ],
        cozum: "17 seçildi - Teknik şartname daha detaylı",
        secilen_deger: 17
      }
    ],
    tutarlilik_skoru: 0.85,
    eksiksizlik_skoru: 0.90,
    guven_skoru: 0.88
  }
}
```

---

## 🎯 UI ENTEGRASYONu

### DocumentUploadWizard Güncellemesi

Her belge kartında artık AI bilgisi gösteriliyor:

```tsx
{/* AI Info */}
{req.aiProvider && (
  <div className="mt-2 flex items-center gap-2 text-xs">
    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded font-medium">
      🤖 {req.aiProvider}
    </span>
    <span className="text-gray-500">• {req.aiDescription}</span>
  </div>
)}
```

**Görüntü:**
- **İhale İlanı:** 🤖 Claude Sonnet 4 • Tarih, bütçe, teminat ve başvuru şartlarına odaklanır
- **Teknik Şartname:** 🤖 Dual API (Claude + Gemini) • Metin için Claude, tablolar için Gemini kullanır
- **Sözleşme Taslağı:** 🤖 Claude Sonnet 4 • Ceza şartları, yükümlülükler ve fesih koşullarını analiz eder
- **CSV Dosyalar:** 🤖 Claude Sonnet 4 (CSV Expert) • Maliyet kalemleri, kar marjı ve rekabet analizi yapar

---

## 📈 AVANTAJLAR

### 1. **Daha Yüksek Doğruluk**
- Her belge türü için optimize edilmiş prompt
- Düşük temperature → Hassas sonuçlar
- Özel validation kuralları

### 2. **Daha Hızlı İşleme**
- Dual API ile paralel işleme (Teknik Şartname)
- Chunked processing (büyük dosyalar)
- Rate limit yönetimi

### 3. **Daha İyi Maliyet Yönetimi**
- Her API için optimize token kullanımı
- Gereksiz extraction'lar yok
- Targeted prompts → Az token

### 4. **Cross-Validation**
- Çoklu belge tutarlılık kontrolü
- Çelişki tespiti ve çözümü
- Güven skorları

### 5. **Kullanıcı Deneyimi**
- UI'da AI bilgisi gösterimi
- Şeffaf süreç
- Belge türüne özel beklentiler

---

## 🔄 ÇALIŞMA AKIŞI

```mermaid
graph TD
    A[Dosya Yükleme] --> B{Belge Türü?}
    B -->|İhale İlanı| C[/api/ai/extract-ihale-ilani]
    B -->|Teknik Şartname| D[/api/ai/extract-teknik-sartname]
    B -->|Sözleşme| E[/api/ai/extract-sozlesme]
    B -->|CSV| F[/api/ai/analyze-csv]
    B -->|Diğer| G[Otomatik Tespit]

    C --> H[Results]
    D --> H
    E --> H
    F --> H
    G --> H

    H --> I{Çoklu Belge?}
    I -->|Evet| J[/api/ai/merge-documents]
    I -->|Hayır| K[Tek Belge Sonucu]

    J --> L[Unified + Cross-Validated Sonuç]
    K --> L
```

---

## 💰 MALİYET OPTİMİZASYONU

### Token Kullanımı Karşılaştırması

| API | Avg Input | Avg Output | Total | Maliyet/Belge |
|-----|-----------|------------|-------|---------------|
| **İhale İlanı** | ~3K tokens | ~2K tokens | ~5K | $0.011 |
| **Teknik Şartname** | ~30K tokens | ~16K tokens | ~46K | $0.33 |
| **Sözleşme** | ~10K tokens | ~3K tokens | ~13K | $0.076 |
| **CSV Analiz** | ~2K tokens | ~2.5K tokens | ~4.5K | $0.044 |
| **Merge (3 belge)** | ~8K tokens | ~4K tokens | ~12K | $0.084 |

**Ortalama Tam Analiz (5 belge):** ~$0.55

---

## 🚀 GELECEKTEKİ GELİŞTİRMELER

### Faz 1 - Completed ✅
- [x] İhale İlanı Expert API
- [x] Teknik Şartname Expert API (Dual API)
- [x] Sözleşme Expert API
- [x] CSV Maliyet Expert API
- [x] Multi-document Merger API
- [x] UI'da AI bilgisi gösterimi

### Faz 2 - Planlanan
- [ ] Smart Router API - Belge türü otomatik tespit + routing
- [ ] Enhanced Table Intelligence - Gemini ile gelişmiş tablo analizi
- [ ] Risk Scoring API - Çoklu belge risk değerlendirmesi
- [ ] Comparison API - İhale karşılaştırma (hangi ihale daha iyi?)

### Faz 3 - İleri Seviye
- [ ] Historical Analysis - Geçmiş ihalelerle karşılaştırma
- [ ] Market Intelligence - Piyasa fiyat analizi
- [ ] Auto Proposal Generator - Otomatik teklif oluşturma

---

## 📝 SONUÇ

Mevcut sistem başarıyla **5 özelleşmiş AI API** ile genişletildi:

1. ✅ `/api/ai/extract-ihale-ilani` - İhale İlanı Expert
2. ✅ `/api/ai/extract-teknik-sartname` - Teknik Şartname Expert (Dual API)
3. ✅ `/api/ai/extract-sozlesme` - Sözleşme Expert
4. ✅ `/api/ai/analyze-csv` - CSV Maliyet Expert
5. ✅ `/api/ai/merge-documents` - Multi-Document Cross-Validator

**Sonuç:**
- 🎯 Daha doğru extraction (belge türüne özel promptlar)
- ⚡ Daha hızlı işleme (paralel API'ler + chunking)
- 💰 Daha düşük maliyet (optimize token kullanımı)
- 🔍 Cross-validation (çoklu belge tutarlılık kontrolü)
- 🎨 Daha iyi UX (AI bilgisi gösterimi)

Sistem artık **ultra veri ve akıllı analiz** yapabilecek kapasitede! 🚀
