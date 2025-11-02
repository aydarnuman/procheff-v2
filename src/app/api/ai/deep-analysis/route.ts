import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

/**
 * POST /api/ai/deep-analysis
 * Derin analiz - Claude Opus ile stratejik değerlendirme
 */
export async function POST(request: NextRequest) {
  console.log("=== DEEP ANALYSIS BAŞLADI ===");
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { extracted_data, contextual_analysis } = body;

    if (!extracted_data) {
      return NextResponse.json(
        { success: false, error: "extracted_data gerekli" },
        { status: 400 }
      );
    }

    console.log("Derin analiz başlatılıyor...");
    console.log("Kurum:", extracted_data.kurum);
    console.log("İhale türü:", extracted_data.ihale_turu);

    // Claude Opus ile derin analiz
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const deepAnalysisPrompt = `Sen deneyimli bir kamu ihalesi danışmanısın. Aşağıdaki ihale analizi için DETAYLI, STRATEJİK ve UZMAN bir değerlendirme yap.

# MEVCUT ANALİZ VERİLERİ:

## Çıkarılan Veriler:
${JSON.stringify(extracted_data, null, 2)}

${contextual_analysis ? `## Bağlamsal Analiz:
${JSON.stringify(contextual_analysis, null, 2)}` : ''}

# DERIN ANALİZ TALEBİ:

Lütfen aşağıdaki konularda DETAYLI analiz yap:

## 1. FIRSAT ANALİZİ
- Bu ihaleye katılmanın avantajları neler?
- Rakiplere göre güçlü yönleriniz neler olabilir?
- Kazanma şansınızı artıracak faktörler neler?
- Uzun vadeli iş fırsatı potansiyeli var mı?

## 2. RİSK ANALİZİ (Detaylı)
- Kritik riskler ve olasılık seviyeleri
- Her risk için somut örnekler
- Risk azaltma stratejileri
- Kırmızı bayraklar (deal-breakers)

## 3. MALİYET STRATEJİSİ
- Optimal fiyatlandırma stratejisi
- Maliyet optimizasyon noktaları
- Kar marjı hedefleri
- Gizli maliyetler ve dikkat edilmesi gerekenler

## 4. OPERASYONEL PLANLAMA
- Kaynak ihtiyaçları (insan, ekipman, lojistik)
- Zaman çizelgesi ve kritik tarihler
- Tedarik zinciri yönetimi
- Kalite kontrol önerileri

## 5. TEKLİF HAZIRLAMA STRATEJİSİ
- Teklif güçlü yönleri nasıl vurgulanmalı?
- Hangi noktalara ekstra dikkat edilmeli?
- Referans ve deneyim gösterimi stratejisi
- Teklifte öne çıkartılması gereken noktalar

## 6. KARAR ÖNERİSİ
- Bu ihaleye katılmalı mısınız? (KATIL / DİKKATLİ KATIL / KATILMA)
- Nihai kararınızın gerekçeleri
- Alternatif senaryolar
- Başarı için kritik başarı faktörleri

# ÇIKTI FORMATI (JSON):

{
  "firsat_analizi": {
    "avantajlar": ["avantaj 1", "avantaj 2"],
    "rekabet_guclu_yonler": ["güçlü yön 1", "güçlü yön 2"],
    "kazanma_faktörleri": ["faktör 1", "faktör 2"],
    "uzun_vade_potansiyel": "açıklama"
  },
  "detayli_risk_analizi": {
    "kritik_riskler": [
      {
        "risk": "risk açıklaması",
        "olasilik": "düşük|orta|yüksek",
        "etki": "düşük|orta|yüksek|kritik",
        "onlem": "azaltma stratejisi"
      }
    ],
    "kirmizi_bayraklar": ["bayrak 1", "bayrak 2"]
  },
  "maliyet_stratejisi": {
    "fiyatlandirma_onerisi": "açıklama",
    "optimizasyon_noktalari": ["nokta 1", "nokta 2"],
    "kar_marji_hedef": "oran ve açıklama",
    "gizli_maliyetler": ["maliyet 1", "maliyet 2"]
  },
  "operasyonel_plan": {
    "kaynak_ihtiyaclari": {
      "insan_gucu": "açıklama",
      "ekipman": "açıklama",
      "lojistik": "açıklama"
    },
    "kritik_tarihler": ["tarih 1", "tarih 2"],
    "tedarik_zinciri": "strateji açıklaması",
    "kalite_kontrol": "öneri açıklaması"
  },
  "teklif_stratejisi": {
    "guclu_yonler": ["vurgulanacak nokta 1", "nokta 2"],
    "dikkat_noktalari": ["nokta 1", "nokta 2"],
    "referans_stratejisi": "açıklama",
    "one_cikan_noktalar": ["nokta 1", "nokta 2"]
  },
  "karar_onerisi": {
    "tavsiye": "KATIL|DİKKATLİ_KATIL|KATILMA",
    "gerekce": "detaylı açıklama (min 200 kelime)",
    "alternatif_senaryolar": ["senaryo 1", "senaryo 2"],
    "basari_kriterleri": ["kriter 1", "kriter 2"]
  },
  "guven_skoru": 0.85
}

ÖNEMLİ:
- Türkçe yaz
- Çok detaylı ve somut örnekler ver
- Sayısal verilerle destekle
- Gerçekçi ve uygulanabilir öneriler sun
- JSON formatında yanıt ver`;

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