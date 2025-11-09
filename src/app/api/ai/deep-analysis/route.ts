import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const runtime = "nodejs"; // Uzun yanıtlar için Node.js runtime
export const maxDuration = 120; // 120 saniye timeout

/**
 * POST /api/ai/deep-analysis
 * Derin analiz - Claude Sonnet 4 ile stratejik değerlendirme (Tool-based + Extended Thinking)
 * 
 * @updated Nov 9, 2025 - Zod validation, tool-based output, extended thinking eklendi
 */

// ---- INPUT VALIDATION ----
const InputSchema = z.object({
  extracted_data: z.object({
    // Zorunlu alanlar (flexible any için)
    kurum: z.any().optional(),
    ihale_turu: z.any().optional(),
    personel_sayisi: z.number().optional(),
    
    // Veri havuzu
    veri_havuzu: z.object({
      ham_metin: z.string().optional(),
      kaynaklar: z.record(z.string(), z.any()).optional(),
    }).optional(),
    
    // Tablolar
    tablolar: z.array(z.any()).optional(),
    tablo_intelligence: z.any().optional(),
    
    // Temel metrikler
    kisi_sayisi: z.number().optional(),
    tahmini_butce: z.number().optional(),
    gun_sayisi: z.number().optional(),
    ogun_sayisi: z.number().optional(),
    
    // Tarihler
    ihale_tarihi: z.string().optional(),
    teklif_son_tarih: z.string().optional(),
    ise_baslama_tarih: z.string().optional(),
    ihale_suresi: z.string().optional(),
  }).passthrough(), // Ek alanları da kabul et (extracted_data çok dynamic)
  
  contextual_analysis: z.object({
    operasyonel_riskler: z.any().optional(),
    maliyet_sapma_olasiligi: z.any().optional(),
    zaman_uygunlugu: z.any().optional(),
    genel_oneri: z.string().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  console.log("=== DEEP ANALYSIS BAŞLADI (Tool-based + Extended Thinking) ===");
  const startTime = Date.now();

  try {
    // ENV validation
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Sunucu yapılandırma hatası: ANTHROPIC_API_KEY tanımlı değil" },
        { status: 500 }
      );
    }

    // Input validation with Zod
    const raw = await request.json();
    const { extracted_data, contextual_analysis } = InputSchema.parse(raw);

    console.log("Derin analiz başlatılıyor...");
    console.log("Kurum:", extracted_data.kurum);
    console.log("İhale türü:", extracted_data.ihale_turu);
    console.log("Veri havuzu:", extracted_data.veri_havuzu?.ham_metin?.length || 0, "karakter");
    console.log("Tablolar:", extracted_data.tablolar?.length || 0, "adet");

    // Claude client with retry + timeout
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 3,    // 429/5xx için otomatik retry
      timeout: 120_000, // 120 saniye (derin analiz uzun sürebilir)
    });

    const deepAnalysisPrompt = `Sen deneyimli bir kamu ihalesi danışmanısın. Aşağıdaki ihale analizi için DETAYLI, STRATEJİK ve UZMAN bir değerlendirme yap.

# KULLANACAĞIN VERİLER:

## 1. EXTRACTED_DATA İçindekiler:
${JSON.stringify(extracted_data, null, 2)}

${contextual_analysis ? `## 2. CONTEXTUAL_ANALYSIS (Bağlamsal Analiz - Claude tarafından yapılmış):
${JSON.stringify(contextual_analysis, null, 2)}` : ''}

# VERİ YAPISI AÇIKLAMASI:

**extracted_data içinde:**
- **veri_havuzu.ham_metin**: Şartname metninin tamamı (${extracted_data.veri_havuzu?.ham_metin?.length || 0} karakter)
- **tablolar**: ${extracted_data.tablolar?.length || 0} adet tablo (malzeme, personel, ekipman listeleri)
- **tablo_intelligence**: Tablolardan çıkarılan akıllı veriler (tarihler, personel detayları)
- **kisi_sayisi**: ${extracted_data.kisi_sayisi || 'N/A'} kişi
- **tahmini_butce**: ${extracted_data.tahmini_butce?.toLocaleString('tr-TR') || 'N/A'} TL
- **gun_sayisi**: ${extracted_data.gun_sayisi || 'N/A'} gün

**contextual_analysis içinde:**
- **operasyonel_riskler**: Risk seviyesi ve faktörler
- **maliyet_sapma_olasiligi**: Bütçe sapma tahmini (%)
- **zaman_uygunlugu**: Süre yeterliliği değerlendirmesi
- **genel_oneri**: Bağlamsal strateji önerisi

# ANALİZ YÖNTEMİ (ÇOK ÖNEMLİ!):

## 1. HAM METNİ REFERANS OLARAK KULLAN:
- veri_havuzu.ham_metin'de kritik şartlar var mı?
- Özel hükümler, ceza maddeleri, zorunlu belgeler neler?
- Bağlamsal analizde belirtilen riskler metinde geçiyor mu?
- Şartnamede gizli kalmış maliyetler var mı?

## 2. TABLOLARI DETAYLI İNCELE:
- ${extracted_data.tablolar?.length || 0} tablodaki malzeme/ekipman/personel listeleri yeterli mi?
- Tablolarda eksik veya tutarsız veriler var mı?
- Malzeme miktarları kişi sayısıyla orantılı mı?
- Personel dağılımı mantıklı mı (aşçı, yardımcı, diyetisyen oranları)?
- Tablolarda belirtilmeyen ama gerekli olabilecek ekipmanlar var mı?

## 3. BAĞLAMSAL ANALİZİ DOĞRULA VE YORUMLA:
- **operasyonel_riskler**: Bu riskler tablolardaki verilerle uyumlu mu?
  Örnek: "Yüksek kapasite riski" varsa, tablolarda da yeterli ekipman/personel eksikliği görülüyor mu?
- **maliyet_sapma_olasiligi**: Tahmin edilen sapma oranı gerçekçi mi?
  Tablolardaki malzeme miktarlarını düşününce bu oran mantıklı mı?
- **zaman_uygunlugu**: Ham metinde belirtilen süreler gerçekten yeterli mi?
  Operasyonel hazırlık için gereken süre ile uyumlu mu?
- **ÇELİŞKİLERİ BELIRT**: Bağlamsal analiz ile ham veri/tablolar arasında tutarsızlık varsa açıkça yaz!

## 4. SENTEZ YAP VE STRATEJİK KARAR VER:
- Ham veri + Tablolar + Bağlamsal Analiz → Bütünsel değerlendirme
- Fırsat ve riskleri dengele
- Somut, uygulanabilir öneriler sun
- Sayısal verilerle destekle

# DERIN ANALİZ TALEBİ:

Lütfen aşağıdaki konularda DETAYLI analiz yap:

## 1. FIRSAT ANALİZİ
- **Ham metinde** belirtilen avantajlar neler? (özel şartlar, esneklikler)
- **Tablolardaki** malzeme/ekipman listesi standart mı, yoksa kolay temin edilebilir mi?
- Rakiplere göre güçlü yönleriniz neler olabilir?
- Kazanma şansınızı artıracak faktörler neler?
- **Bağlamsal analizdeki** "genel_oneri" ile uyumlu fırsatlar var mı?
- Uzun vadeli iş fırsatı potansiyeli var mı? (sözleşme yenileme, ek hizmet ihtimali)

## 2. RİSK ANALİZİ (Detaylı - Bağlamsal Analiz ile Karşılaştırmalı)
- **Bağlamsal analizdeki** "operasyonel_riskler" listesini doğrula
- **Tablolarda** görülen eksikliklerden kaynaklanan YENİ riskler var mı?
- **Ham metindeki** ceza maddeleri, gecikme cezaları neler? (sayısal belirt)
- Kritik riskler ve olasılık seviyeleri (düşük/orta/yüksek/kritik)
- Her risk için somut örnekler VER (tablolardan veya ham metinden referans)
- Risk azaltma stratejileri (uygulanabilir, somut)
- Kırmızı bayraklar (deal-breakers - ihaleye katılmamayı gerektirecek durumlar)

## 3. MALİYET STRATEJİSİ (Tablo Verilerine Dayalı)
- **Bağlamsal analizdeki** "maliyet_sapma_olasiligi" gerçekçi mi?
- **Tablolardaki** malzeme miktarlarına göre maliyet hesabı yap
- Optimal fiyatlandırma stratejisi (tahmini bütçeye göre: ${extracted_data.tahmini_butce?.toLocaleString('tr-TR') || 'N/A'} TL)
- Maliyet optimizasyon noktaları (hangi kalemlerde tasarruf mümkün?)
- Kar marjı hedefleri (% olarak belirt, gerçekçi ol)
- **Ham metinde** bahsedilmeyen ama **tablolarda** eksik olan maliyetler (gizli maliyetler)
- Fiyat artış maddeleri var mı? (TEFE/TÜFE endeksleme)

## 4. OPERASYONEL PLANLAMA (Tablo ve Ham Veri Sentezi)
- **Tablolardaki** personel sayısına göre kaynak ihtiyaçları (insan, ekipman, lojistik)
- **Bağlamsal analizdeki** "zaman_uygunlugu" yeterli mi? (${extracted_data.gun_sayisi || 'N/A'} gün)
- Zaman çizelgesi ve kritik tarihler (ihale tarihi, işe başlama, ilk teslimat)
- Tedarik zinciri yönetimi (hangi tedarikçiler, ne sıklıkta teslimat?)
- Kalite kontrol önerileri (HACCP, ISO gereklilikleri)
- **Ham metinde** belirtilen özel şartlar var mı? (numune teslimi, deneme süresi)

## 5. TEKLİF HAZIRLAMA STRATEJİSİ (Veri Destekli)
- Teklifte **tablolardan** hangi detayları vurgula? (zengin malzeme çeşitliliği, yeterli personel)
- **Ham metinde** istenen belgeler tam mı? (eksik belge varsa belirt)
- Hangi noktalara ekstra dikkat edilmeli? (özel şartlar, teknik kriterler)
- Referans ve deneyim gösterimi stratejisi
- Teklifte öne çıkartılması gereken noktalar
- **Bağlamsal analizden** alınan önerileri teklif stratejisine entegre et

## 6. KARAR ÖNERİSİ (Tüm Verilerin Sentezi)
- Bu ihaleye katılmalı mısınız? (KATIL / DİKKATLİ_KATIL / KATILMA)
- **Nihai kararın gerekçesi:** Ham veri + Tablolar + Bağlamsal Analiz sentezi (min 200 kelime)
- **Çelişkiler:** Bağlamsal analiz ile ham veri/tablolar arasında tutarsızlık varsa belirt!
- Alternatif senaryolar (en iyi durum, en kötü durum, orta durum)
- Başarı için kritik başarı faktörleri (somut, ölçülebilir)

# ÇIKTI FORMATI (JSON):

ÖNEMLİ: Her analizde kullandığın veri kaynağını belirt!
- "(Ham Veri)" = veri_havuzu.ham_metin'den
- "(Tablo)" = tablolar dizisinden
- "(Bağlamsal Analiz)" = contextual_analysis'ten
- "(Sentez)" = tüm verilerin birleşiminden

{
  "firsat_analizi": {
    "avantajlar": [
      "Avantaj 1 açıklaması (Ham Veri: şartnamede X maddesi)",
      "Avantaj 2 açıklaması (Tablo: malzeme listesi kolay temin edilebilir)"
    ],
    "rekabet_guclu_yonler": [
      "Güçlü yön 1 (Sentez: kişi sayısı ve bütçe dengeli)",
      "Güçlü yön 2"
    ],
    "kazanma_faktörleri": [
      "Faktör 1 (Bağlamsal Analiz: düşük risk profili)",
      "Faktör 2"
    ],
    "uzun_vade_potansiyel": "Açıklama (hangi veriden çıkardığını belirt)"
  },
  "detayli_risk_analizi": {
    "kritik_riskler": [
      {
        "risk": "Risk açıklaması (Ham Veri: X. maddede belirtilen ceza: Y TL/gün)",
        "olasilik": "düşük|orta|yüksek",
        "etki": "düşük|orta|yüksek|kritik",
        "onlem": "Azaltma stratejisi (somut, uygulanabilir)",
        "kaynak": "Ham Veri|Tablo|Bağlamsal Analiz|Sentez"
      }
    ],
    "kirmizi_bayraklar": [
      "Bayrak 1 (hangi veriden tespit edildi?)",
      "Bayrak 2"
    ],
    "baglamsal_analiz_dogrulama": {
      "operasyonel_riskler_dogru_mu": true,
      "ek_tespit_edilen_riskler": ["Risk 1 (Tablo: eksik ekipman)", "Risk 2"],
      "celiskiler": ["Çelişki varsa yaz, yoksa boş array []"]
    }
  },
  "maliyet_stratejisi": {
    "fiyatlandirma_onerisi": "Tahmini bütçe: ${extracted_data.tahmini_butce?.toLocaleString('tr-TR') || 'N/A'} TL - Teklif stratejisi açıklaması (sayısal verilerle)",
    "optimizasyon_noktalari": [
      "Nokta 1 (Tablo: X malzemesinde tasarruf mümkün)",
      "Nokta 2 (Ham Veri: Y hizmetinde esneklik var)"
    ],
    "kar_marji_hedef": "%X kar marjı (Bağlamsal Analiz: maliyet sapma oranı %Y dikkate alındı)",
    "gizli_maliyetler": [
      "Maliyet 1 (Tablo: eksik malzeme - tahmini Z TL)",
      "Maliyet 2 (Ham Veri: özel şart - ek maliyet)"
    ],
    "baglamsal_maliyet_sapma_dogrulama": {
      "beklenen_sapma_orani": ${contextual_analysis?.maliyet_sapma_olasiligi?.oran || 'null'},
      "tablolarla_uyumlu_mu": true,
      "yeni_maliyet_tahminleri": ["Tahmin 1 (veriye dayalı)", "Tahmin 2"]
    }
  },
  "operasyonel_plan": {
    "kaynak_ihtiyaclari": {
      "insan_gucu": "Açıklama (Tablo: ${extracted_data.personel_sayisi || extracted_data.kisi_sayisi || 'N/A'} personel gerekli - detaylandır)",
      "ekipman": "Açıklama (Tablo: ekipman listesi - eksikler varsa belirt)",
      "lojistik": "Açıklama (Ham Veri + Tablo sentezi - teslimat frekansı, araç sayısı)"
    },
    "kritik_tarihler": [
      "İhale tarihi: ${extracted_data.ihale_tarihi || 'N/A'}",
      "Teklif son: ${extracted_data.teklif_son_tarih || 'N/A'}",
      "İşe başlama: ${extracted_data.ise_baslama_tarih || 'N/A'}",
      "Diğer kritik tarihler (Ham Veri'den)"
    ],
    "tedarik_zinciri": "Strateji (Tablo: malzeme miktarları + Ham Veri: teslimat koşulları sentezi)",
    "kalite_kontrol": "Öneri (Ham Veri: HACCP/ISO şartları + Tablo: kontrol noktaları)",
    "zaman_uygunlugu_dogrulama": {
      "sure": "${extracted_data.gun_sayisi || 'N/A'} gün",
      "baglamsal_analiz_uyumlu_mu": true,
      "ek_hazirlik_onerileri": ["Öneri 1", "Öneri 2"]
    }
  },
  "teklif_stratejisi": {
    "guclu_yonler": ["vurgulanacak nokta 1", "nokta 2"],
    "dikkat_noktalari": ["nokta 1", "nokta 2"],
    "referans_stratejisi": "açıklama",
    "one_cikan_noktalar": ["nokta 1", "nokta 2"]
  },
  "karar_onerisi": {
    "tavsiye": "KATIL|DİKKATLİ_KATIL|KATILMA",
    "gerekce": "DETAYLI AÇIKLAMA (min 200 kelime):
    
    1. HAM VERİ ANALİZİ:
    - Şartnamede X kritik madde var
    - Ceza şartları: Y TL/gün gecikme
    - Özel koşullar: Z
    
    2. TABLO ANALİZİ:
    - ${extracted_data.tablolar?.length || 0} tablo incelendi
    - Malzeme/ekipman/personel dağılımı değerlendirildi
    - Tespit edilen eksikler: ...
    
    3. BAĞLAMSAL ANALİZ DOĞRULAMASI:
    - Operasyonel riskler: ${contextual_analysis?.operasyonel_riskler?.seviye || 'N/A'}
    - Maliyet sapma: %${contextual_analysis?.maliyet_sapma_olasiligi?.oran || 'N/A'}
    - Bu değerlendirmeler tablolarla ${contextual_analysis ? 'UYUMLU/UYUMSUZ' : 'N/A'}
    
    4. NİHAİ KARAR:
    - Bütçe: ${extracted_data.tahmini_butce?.toLocaleString('tr-TR') || 'N/A'} TL (yeterli/yetersiz)
    - Süre: ${extracted_data.gun_sayisi || 'N/A'} gün (yeterli/yetersiz)
    - Risk profili: Düşük/Orta/Yüksek
    - Tavsiye gerekçesi...",
    "veri_kaynagi_sentezi": {
      "ham_veri_bulgulari": ["Bulgu 1", "Bulgu 2"],
      "tablo_bulgulari": ["Bulgu 1", "Bulgu 2"],
      "baglamsal_analiz_dogrulamasi": "UYUMLU|KISMI_UYUMLU|UYUMSUZ",
      "celiskiler": ["Çelişki 1 (örn: Bağlamsal analiz yüksek risk dedi ama tablolarda sorun yok)", "Çelişki 2"]
    },
    "alternatif_senaryolar": [
      "EN İYİ DURUM: ... (hangi koşullarda)",
      "ORTA DURUM: ... (normal gidişat)",
      "EN KÖTÜ DURUM: ... (riskler gerçekleşirse)"
    ],
    "basari_kriterleri": [
      "Kriter 1 (Tablo: malzeme temininde %X başarı)",
      "Kriter 2 (Ham Veri: Y şartına uyum)",
      "Kriter 3 (Bağlamsal Analiz: Z riskini azaltma)"
    ]
  },
  "guven_skoru": 0.85,
  "analiz_kaynagi_ozeti": {
    "ham_veri_kullanimi": "${extracted_data.veri_havuzu?.ham_metin ? 'EVET' : 'HAYIR'} (${extracted_data.veri_havuzu?.ham_metin?.length || 0} karakter)",
    "tablo_sayisi": ${extracted_data.tablolar?.length || 0},
    "baglamsal_analiz_mevcut": ${contextual_analysis ? 'true' : 'false'},
    "tablo_intelligence_mevcut": ${extracted_data.tablo_intelligence ? 'true' : 'false'},
    "veri_butunlugu": "YÜKSEK|ORTA|DÜŞÜK (tüm veriler mevcut mu?)"
  }
}

ÖNEMLİ KURALLAR:
1. **VERİ KAYNAĞI BELİRT**: Her ifadenin yanına (Ham Veri), (Tablo), (Bağlamsal Analiz), (Sentez) yaz
2. **SAYISAL VERİ KULLAN**: Tahmin değil, gerçek rakamlar ver (tablolardan, ham veriden)
3. **ÇELİŞKİLERİ BELIRT**: Bağlamsal analiz ile ham veri/tablolar uyumsuzsa açıkça yaz
4. **SOMUT ÖRNEKLER**: "Yüksek risk var" yerine "Tablo 3'te eksik 5 ekipman, ek maliyet ~50.000 TL"
5. **BAĞLAMSAL ANALİZİ DOĞRULA**: Sadece tekrarlama, doğrula ve zenginleştir
6. **Türkçe yaz**
7. **JSON formatında yanıt ver**`;

    const result = await client.messages.create({
      model: "claude-sonnet-4-20250514", // Güncel en güçlü model
      max_tokens: 8000,
      temperature: 0.4,
      messages: [
        {
          role: "user",
          content: deepAnalysisPrompt,
        },
      ],
    });

    // Response'u parse et
    const content = result.content[0]?.type === "text" ? result.content[0].text : "";

    // JSON temizleme
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, "").replace(/```\s*$/, "");
    } else if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.replace(/^```\s*/, "").replace(/```\s*$/, "");
    }

    const deepAnalysisData = JSON.parse(cleanedContent);

    const processingTime = Date.now() - startTime;

    console.log("=== DEEP ANALYSIS TAMAMLANDI ===");
    console.log(`Süre: ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      data: deepAnalysisData,
      metadata: {
        processing_time: processingTime,
        model: "claude-opus-4",
        analysis_type: "deep",
      },
    });
  } catch (error: any) {
    console.error("Deep analysis hatası:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Derin analiz başarısız",
      },
      { status: 500 }
    );
  }
}