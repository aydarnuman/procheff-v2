import { NextRequest, NextResponse } from "next/server";
import { ClaudeProvider } from "@/lib/ai/claude-provider";
import { logger, LogKategori } from "@/lib/logger";
import { hesaplaClaudeMaliyeti } from "@/lib/ai/cost-calculator";

export const runtime = "nodejs";

/**
 * SÖZLEŞME EXPERT API
 *
 * Özelleşmiş Prompt - Sözleşme Belgelerine Odaklanır:
 * - Sözleşme maddeleri ve yükümlülükler
 * - Ceza şartları ve gecikme bedelleri
 * - Ödeme koşulları ve fatura düzenleme
 * - Fesih şartları ve teminat iadesi
 * - Yasal sorumluluklar ve anlaşmazlık çözüm yolları
 *
 * DİĞER BELGE TÜRLERİ İÇİN KULLANMA!
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const sessionId = `sozlesme_${Date.now()}`;

  try {
    logger.sessionBaslat(sessionId);
    logger.info(LogKategori.AI_ANALYSIS, '📝 Sözleşme Expert API başladı');

    const { text, fileName } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { success: false, error: "Sözleşme metni bulunamadı" },
        { status: 400 }
      );
    }

    if (text.length < 300) {
      return NextResponse.json(
        { success: false, error: "Sözleşme metni çok kısa (min 300 karakter)" },
        { status: 400 }
      );
    }

    const claude = new ClaudeProvider();

    // ÖZEL PROMPT - Sözleşme için optimize edilmiş
    const prompt = buildSozlesmePrompt(text, fileName);

    logger.info(LogKategori.AI_ANALYSIS, 'Sözleşme analizi başlıyor', {
      karakterSayisi: text.length,
      dosyaAdi: fileName,
    });

    const response = await claude.queryRaw(prompt, {
      maxTokens: 12000, // Sözleşmeler uzun olabilir
      temperature: 0.2, // Çok düşük - kesin bilgiler gerekli
    });

    // Parse JSON response
    const extractedData = parseSozlesmeResponse(response);

    const processingTime = Date.now() - startTime;

    // Maliyet hesapla
    const estimatedInputTokens = Math.ceil(text.length / 4);
    const estimatedOutputTokens = 3000;
    const maliyet = hesaplaClaudeMaliyeti('claude-3-5-sonnet-20241022', estimatedInputTokens, estimatedOutputTokens);

    logger.basarili(LogKategori.EXTRACTION, 'Sözleşme başarıyla analiz edildi', {
      ek: {
        guvenSkoru: Math.round(extractedData.guven_skoru * 100),
        cezaSartiSayisi: extractedData.ceza_sartlari?.length || 0,
        yukümlulukSayisi: extractedData.yuklenici_yukumlulukleri?.length || 0,
        tokenKullanimi: maliyet.toplamTokens,
        maliyetTL: maliyet.toplamMaliyetTRY,
      },
    });

    logger.sessionBitir(sessionId);

    return NextResponse.json({
      success: true,
      data: extractedData,
      metadata: {
        processing_time: processingTime,
        ai_provider: "claude-sonnet-4",
        document_type: "sozlesme_tasarisi",
        extraction_timestamp: new Date().toISOString(),
        cost: {
          tokens: maliyet.toplamTokens,
          cost_usd: maliyet.toplamMaliyetUSD,
          cost_try: maliyet.toplamMaliyetTRY,
        },
      },
    });
  } catch (error) {
    console.error("Sözleşme extraction error:", error);
    logger.hata(LogKategori.AI_ANALYSIS, 'Sözleşme analizi başarısız', {
      kod: 'SOZLESME_ERROR',
      mesaj: error instanceof Error ? error.message : 'Bilinmeyen hata',
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Sözleşme analizi başarısız",
      },
      { status: 500 }
    );
  }
}

/**
 * SÖZLEŞME İÇİN ÖZELLEŞMİŞ PROMPT
 */
function buildSozlesmePrompt(text: string, fileName?: string): string {
  return `Sen bir Türk kamu ihaleleri ve sözleşme hukuku uzmanısısın. Aşağıdaki SÖZLEŞME belgesini analiz et.

🎯 GÖREV: SÖZLEŞME EXTRACTION (SPECIALIZED)

Bu belge bir SÖZLEŞME TASARISI veya SÖZLEŞMEDİR. Şu bilgilere ÖZEL DİKKAT ET:

🔴 KRİTİK BİLGİLER (MUTLAKA BUL):

1. **SÖZLEŞME SÜRESİ**: Başlangıç-bitiş tarihleri, süre uzatma şartları
2. **ÖDEME KOŞULLARI**: Ne zaman, nasıl ödenecek? Avans var mı?
3. **CEZA ŞARTLARI**: Gecikme, eksik hizmet, kalite düşüklüğü cezaları
4. **YUKLENICI YÜKÜMLÜLÜKLERİ**: Ne yapması gerekiyor?
5. **İDARENİN YÜKÜMLÜLÜKLERİ**: İdare ne sağlayacak?
6. **FESİH ŞARTLARI**: Hangi durumlarda sözleşme feshedilebilir?
7. **TEMİNAT**: Kesin teminat miktarı ve iade şartları
8. **ANLAŞMAZLIK ÇÖZÜMÜ**: Hangi mahkeme, hangi hukuk?

📄 BELGE:
---
${text}
---

📋 CEVAP FORMATI (SADECE JSON):

\`\`\`json
{
  "sozlesme_suresi": "365 gün / 12 ay / Başlangıç-Bitiş" veya null,
  "ise_baslama_tarih": "YYYY-MM-DD" veya null,
  "bitis_tarihi": "YYYY-MM-DD" veya null,
  "odeme_kosullari": {
    "odeme_donemi": "Aylık / Haftalık / vb.",
    "odeme_sekli": "Fatura karşılığı / Hakediş sistemi",
    "avans": "Var mı? Ne kadar?",
    "gecikme_faizi": "Gecikme halinde faiz var mı?"
  },
  "yuklenici_yukumlulukleri": [
    "Günlük temizlik yapacak",
    "Personel maaşlarını ödeyecek",
    "Ekipman-gereç temin edecek",
    "Sigorta yaptıracak"
  ],
  "idarenin_yukumlulukleri": [
    "Mutfak alanı tahsis edecek",
    "Elektrik-su sağlayacak",
    "Ödemeleri zamanında yapacak"
  ],
  "ceza_sartlari": [
    {
      "durum": "Gecikme",
      "ceza": "Günlük sözleşme bedelinin binde 3'ü",
      "ust_limit": "Sözleşme bedelinin %10'u"
    },
    {
      "durum": "Eksik hizmet",
      "ceza": "Her eksik öğün için 500 TL",
      "ust_limit": null
    }
  ],
  "fesih_sartlari": [
    "Sözleşme bedelinin %10'unu aşan ceza",
    "3 kez uyarı yazısına rağmen düzeltme yapılmaması",
    "İflas, konkordato"
  ],
  "teminat": {
    "kesin_teminat": sayı veya null,
    "iade_kosulu": "İş bitiminden X gün sonra"
  },
  "anlaşmazlik_cozumu": {
    "gorevli_mahkeme": "İstanbul Anadolu Adliyesi / vb.",
    "uygulanacak_hukuk": "Türk hukuku",
    "tahkim": "Var mı? Hangi tahkim merkezi?"
  },
  "ozel_sartlar": [
    "Force majeure durumları",
    "İşin devri yasak",
    "Sır saklama yükümlülüğü"
  ],
  "riskler": [
    "Yüksek ceza oranları",
    "Katı fesih şartları",
    "Uzun teminat iade süresi"
  ],
  "kanitlar": {
    "ceza": "Madde 15: Yüklenici hizmetini süresi içinde...",
    "fesih": "Madde 22: Aşağıdaki durumlarda sözleşme feshedilir..."
  },
  "guven_skoru": 0.85
}
\`\`\`

⚠️ KRİTİK KURALLAR:

1. **MADDE NUMARALARI**: Hangi maddede ne yazıyor - kaynak göster
   - "Madde 15: Ceza şartları..."

2. **CEZA MİKTARLARI**: Net sayılar ve oranlar
   - "Günlük binde 3" → Sözleşme bedeli baz alınır
   - "500 TL" → Sabit miktar

3. **TARİHLER**: Kesin tarihler veya süre ifadeleri
   - "2025-01-01" veya "İmza tarihinden 7 gün sonra"

4. **YÜKÜMLÜLÜKLERİ AYIR**: Yüklenici vs İdare ayrı ayrı

5. **RİSKLER**: Yüklenici için tehlikeli maddeler
   - Ağır cezalar
   - Kolay fesih şartları
   - Uzun süre bekleme (ödeme, teminat iadesi)

6. **KANITLAR**: Her kritik bilgi için kaynak metin (200+ karakter)

🔍 ARAMA İPUÇLARI:

- Süre: "sözleşme süresi", "başlangıç tarihi", "bitiş tarihi"
- Ödeme: "ödeme", "fatura", "hakediş", "avans"
- Ceza: "ceza", "gecikme", "tazminat", "kesinti"
- Fesih: "fesih", "sözleşmenin sona ermesi", "fesat"
- Teminat: "kesin teminat", "teminat mektubu", "iade"

🚀 SADECE JSON FORMATINDA CEVAP VER - BAŞKA HİÇBİR ŞEY YAZMA!

${fileName ? `\nDosya adı: ${fileName}` : ''}`;
}

/**
 * Parse Sözleşme JSON response
 */
function parseSozlesmeResponse(response: string): any {
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
