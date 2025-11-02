import { NextRequest, NextResponse } from "next/server";
import { ClaudeProvider } from "@/lib/ai/claude-provider";
import { logger, LogKategori } from "@/lib/logger";
import { BelgeTuru } from "@/types/ai";

export const runtime = "nodejs";

/**
 * MULTI-DOCUMENT CROSS-VALIDATOR API
 *
 * Tüm belgeleri birleştirir ve tutarlılık kontrolü yapar:
 * - İhale İlanı + Teknik Şartname + Sözleşme + CSV → Unified Data
 * - Cross-validation: Farklı belgelerdeki aynı bilgileri karşılaştır
 * - Conflict resolution: Çelişkili bilgileri tespit et ve çöz
 * - Completeness check: Eksik bilgileri tespit et
 *
 * Kullanım:
 * POST /api/ai/merge-documents
 * Body: {
 *   documents: [
 *     { type: "ihale_ilani", data: {...}, fileName: "..." },
 *     { type: "teknik_sartname", data: {...}, fileName: "..." },
 *     ...
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const sessionId = `merge_docs_${Date.now()}`;

  try {
    logger.sessionBaslat(sessionId);
    logger.info(LogKategori.AI_ANALYSIS, '🔀 Multi-document Merger başladı');

    const { documents } = await request.json();

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { success: false, error: "Birleştirilecek belgeler bulunamadı" },
        { status: 400 }
      );
    }

    if (documents.length === 1) {
      return NextResponse.json(
        { success: false, error: "En az 2 belge gerekli (cross-validation için)" },
        { status: 400 }
      );
    }

    logger.info(LogKategori.AI_ANALYSIS, 'Belgeler birleştiriliyor', {
      belgeSayisi: documents.length,
      belgeTurleri: documents.map((d: any) => d.type).join(', '),
    });

    // 1. Basit birleştirme - Manuel merge (AI olmadan)
    const simpleMerge = performSimpleMerge(documents);

    // 2. AI ile akıllı birleştirme ve tutarlılık kontrolü
    const claude = new ClaudeProvider();
    const prompt = buildMergePrompt(documents, simpleMerge);

    const response = await claude.queryRaw(prompt, {
      maxTokens: 16000,
      temperature: 0.1, // Çok düşük - tutarlılık ve doğruluk kritik
    });

    // Parse AI response
    const mergedData = parseMergeResponse(response);

    const processingTime = Date.now() - startTime;

    logger.basarili(LogKategori.EXTRACTION, 'Belgeler başarıyla birleştirildi', {
      ek: {
        guvenSkoru: Math.round(mergedData.guven_skoru * 100),
        tutarsizlikSayisi: mergedData.tutarsizliklar?.length || 0,
        eksikBilgiSayisi: mergedData.eksik_bilgiler?.length || 0,
        konfliktSayisi: mergedData.cozulen_konfliktler?.length || 0,
      },
    });

    logger.sessionBitir(sessionId);

    return NextResponse.json({
      success: true,
      data: mergedData,
      metadata: {
        processing_time: processingTime,
        ai_provider: "claude-sonnet-4-merger",
        document_count: documents.length,
        document_types: documents.map((d: any) => d.type),
        extraction_timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Document merge error:", error);
    logger.hata(LogKategori.AI_ANALYSIS, 'Belge birleştirme başarısız', {
      kod: 'MERGE_ERROR',
      mesaj: error instanceof Error ? error.message : 'Bilinmeyen hata',
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Belge birleştirme başarısız",
      },
      { status: 500 }
    );
  }
}

/**
 * Basit birleştirme - AI olmadan manuel merge
 * İlk geçiş: Aynı alanları birleştir, öncelik sırasına göre
 */
function performSimpleMerge(documents: any[]): any {
  // Öncelik sırası: İhale İlanı > Teknik Şartname > Sözleşme > CSV > Diğer
  const priority: Record<BelgeTuru, number> = {
    ihale_ilani: 1,
    teknik_sartname: 2,
    sozlesme_tasarisi: 3,
    fiyat_teklif_mektubu: 4,
    idari_sartname: 5,
    diger: 6,
    belirsiz: 7,
  };

  // Belgeleri önceliğe göre sırala
  const sortedDocs = [...documents].sort((a, b) => {
    const priorityA = priority[a.type as BelgeTuru] || 99;
    const priorityB = priority[b.type as BelgeTuru] || 99;
    return priorityA - priorityB;
  });

  console.log('📊 Belge öncelik sırası:', sortedDocs.map(d => d.type).join(' > '));

  // Base object - ilk belgenin verilerini al
  const merged: any = {
    kurum: null,
    ihale_turu: null,
    ihale_tarihi: null,
    teklif_son_tarih: null,
    ise_baslama_tarih: null,
    bitis_tarihi: null,
    gun_sayisi: null,
    kisi_sayisi: null,
    ogun_sayisi: null,
    tahmini_butce: null,
    belge_sayisi: documents.length,
    kaynaklar: {} as Record<string, any>,
  };

  // Her belgeyi sırayla birleştir
  sortedDocs.forEach((doc) => {
    const data = doc.data;
    const type = doc.type;

    // Her alan için: Eğer merged'de yoksa veya yeni değer daha güvenilirse, güncelle
    const fields = [
      'kurum',
      'ihale_turu',
      'ihale_tarihi',
      'teklif_son_tarih',
      'ise_baslama_tarih',
      'bitis_tarihi',
      'gun_sayisi',
      'kisi_sayisi',
      'ogun_sayisi',
      'tahmini_butce',
    ];

    fields.forEach((field) => {
      if (data[field] !== null && data[field] !== undefined) {
        // Eğer henüz set edilmemişse, set et
        if (!merged[field]) {
          merged[field] = data[field];
          merged.kaynaklar[field] = type;
        }
        // Eğer farklı bir değer varsa, kaydet (AI çözecek)
        else if (merged[field] !== data[field]) {
          if (!merged.kaynaklar[`${field}_alternates`]) {
            merged.kaynaklar[`${field}_alternates`] = [];
          }
          merged.kaynaklar[`${field}_alternates`].push({
            value: data[field],
            source: type,
          });
        }
      }
    });
  });

  return merged;
}

/**
 * Multi-document Merge Prompt
 */
function buildMergePrompt(documents: any[], simpleMerge: any): string {
  // Belge özetlerini hazırla
  const docSummaries = documents.map((doc, idx) => {
    return `
### BELGE ${idx + 1}: ${doc.type.toUpperCase()}
Dosya: ${doc.fileName || 'Bilinmiyor'}
---
${JSON.stringify(doc.data, null, 2)}
---
`;
  }).join('\n\n');

  return `Sen bir veri tutarlılığı uzmanısısın. Aşağıda aynı ihale ile ilgili ${documents.length} FARKLI BELGE var.

🎯 GÖREV: MULTI-DOCUMENT CROSS-VALIDATION & MERGE

Şu işlemleri yap:

1. **TUTARLILIK KONTROLÜ**: Farklı belgelerde aynı bilgi var mı? Uyuşuyor mu?
2. **ÇELIŞKI TESPİTİ**: Farklı değerler varsa hangi kaynak daha güvenilir?
3. **EKSİK BİLGİ TESPİTİ**: Hangi bilgiler eksik?
4. **UNIFIED DATA**: Birleştirilmiş, tutarlı veri seti oluştur

📄 BELGELER:
${docSummaries}

📊 BASIT BİRLEŞTİRME (Manuel):
${JSON.stringify(simpleMerge, null, 2)}

📋 CEVAP FORMATI (SADECE JSON):

\`\`\`json
{
  "unified_data": {
    "kurum": "En güvenilir kaynaktan",
    "ihale_turu": "...",
    "ihale_tarihi": "YYYY-MM-DD HH:MM",
    "teklif_son_tarih": "YYYY-MM-DD HH:MM",
    "ise_baslama_tarih": "YYYY-MM-DD",
    "bitis_tarihi": "YYYY-MM-DD",
    "gun_sayisi": sayı,
    "kisi_sayisi": sayı,
    "ogun_sayisi": sayı,
    "tahmini_butce": sayı,
    "teslim_suresi": "...",
    "dagitim_yontemi": "...",
    "kaynaklar": {
      "kisi_sayisi": "teknik_sartname",
      "tahmini_butce": "ihale_ilani",
      "ihale_tarihi": "ihale_ilani"
    }
  },
  "tutarsizliklar": [
    {
      "alan": "kisi_sayisi",
      "degerler": [
        { "deger": 17, "kaynak": "teknik_sartname" },
        { "deger": 15, "kaynak": "ihale_ilani" }
      ],
      "cozum": "17 seçildi - Teknik şartname daha detaylı",
      "secilen_deger": 17,
      "secilen_kaynak": "teknik_sartname"
    }
  ],
  "eksik_bilgiler": [
    {
      "alan": "bitis_tarihi",
      "aciklama": "Hiçbir belgede bitiş tarihi belirtilmemiş"
    }
  ],
  "cozulen_konfliktler": [
    {
      "alan": "tahmini_butce",
      "problem": "İhale ilanında 2.5M, CSV'de 2.3M",
      "cozum": "2.5M seçildi (İhale ilanı resmi belge)",
      "secilen_deger": 2500000,
      "aciklama": "CSV yüklenicinin iç hesabı, resmi ilan daha güvenilir"
    }
  ],
  "tutarlilik_skoru": 0.85,
  "eksiksizlik_skoru": 0.90,
  "guven_skoru": 0.88,
  "genel_yorum": "Belgeler genel olarak tutarlı. Sadece kişi sayısında küçük fark var, teknik şartnameden alındı. Bütçe bilgisi ilan ile uyumlu.",
  "oneriler": [
    "Bitiş tarihi eksik - sözleşme süresinden hesaplanabilir",
    "CSV maliyet verisi ile ilan bütçesi arasında %8 fark var - kar marjı analizi yap"
  ]
}
\`\`\`

⚠️ KRİTİK KURALLAR:

1. **ÖNCELİK SIRASI (Çelişki durumunda)**:
   - İhale İlanı > Teknik Şartname > Sözleşme > CSV
   - Resmi belgeler (ilan, şartname) > Dahili belgeler (CSV)

2. **TUTARLILIK KONTROLÜ**:
   - Kişi sayısı: Tüm belgelerde aynı mı?
   - Bütçe: İhale ilanı ile CSV uyumlu mu?
   - Tarihler: Tarih sıralaması mantıklı mı? (İlan < Teklif Son < İşe Başlama)
   - Süre: Gün sayısı ile başlangıç-bitiş tarihleri uyumlu mu?

3. **ÇELIŞKI ÇÖZÜMÜ**:
   - Farklı değerler varsa HANGİ KAYNAK DAHA GÜVENİLİR?
   - Neden o kaynağı seçtin? Açıkla

4. **EKSİK BİLGİ**:
   - Hangi önemli bilgiler hiçbir belgede yok?
   - Hesaplanabilir mi? (Örn: Bitiş tarihi = Başlangıç + Gün sayısı)

5. **SKORLAMA**:
   - tutarlilik_skoru: Belgeler ne kadar tutarlı? (0-1)
   - eksiksizlik_skoru: Kritik bilgiler ne kadar tam? (0-1)
   - guven_skoru: Birleştirilmiş veriye ne kadar güveniyoruz? (0-1)

🔍 ÖRNEK TUTARSIZLIK:

Senaryo: İhale ilanında "15 kişi", Teknik şartnamede "17 kişi"

Analiz:
- Teknik şartname daha detaylı (kuruluş dağılımı tablosu var)
- İhale ilanı genel bilgi verir
- KARAR: 17 kişi seç (Teknik şartname kaynak)

🚀 SADECE JSON FORMATINDA CEVAP VER - BAŞKA HİÇBİR ŞEY YAZMA!`;
}

/**
 * Parse Merge Response
 */
function parseMergeResponse(response: string): any {
  try {
    let cleaned = response.trim();

    // Remove ```json wrapper
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\w*\s*/, "").replace(/```\s*$/, "");
    }

    // Extract JSON object
    const jsonMatch = cleaned.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      cleaned = jsonMatch[1].trim();
    }

    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Parse error:", error);
    console.error("Raw response:", response);
    throw new Error("JSON parse başarısız - AI yanıtı bozuk");
  }
}
