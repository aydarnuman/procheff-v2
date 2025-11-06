import { NextRequest, NextResponse } from "next/server";
import { ClaudeProvider } from "@/lib/ai/claude-provider";
import { logger, LogKategori } from "@/lib/logger";
import { hesaplaClaudeMaliyeti } from "@/lib/ai/cost-calculator";

export const runtime = "nodejs";

/**
 * İHALE İLANI EXPERT API
 *
 * Özelleşmiş Prompt - İhale İlanlarına Odaklanır:
 * - İhale tarihi ve teklif son tarihi (KRİTİK!)
 * - Tahmini bütçe ve ödeme koşulları
 * - Başvuru şartları ve teminat bilgileri
 * - İhale usulü ve değerlendirme kriterleri
 *
 * DİĞER BELGE TÜRLERİ İÇİN KULLANMA!
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const sessionId = `ihale_ilani_${Date.now()}`;

  try {
    logger.sessionBaslat(sessionId);
    logger.info(LogKategori.AI_ANALYSIS, '📢 İhale İlanı Expert API başladı');

    const { text, fileName } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { success: false, error: "İhale ilanı metni bulunamadı" },
        { status: 400 }
      );
    }

    if (text.length < 200) {
      return NextResponse.json(
        { success: false, error: "İhale ilanı metni çok kısa (min 200 karakter)" },
        { status: 400 }
      );
    }

    const claude = new ClaudeProvider();

    // ÖZEL PROMPT - İhale İlanı için optimize edilmiş
    const prompt = buildIhaleIlaniPrompt(text, fileName);

    logger.info(LogKategori.AI_ANALYSIS, 'İhale ilanı analizi başlıyor', {
      karakterSayisi: text.length,
      dosyaAdi: fileName,
    });

    const response = await claude.queryRaw(prompt, {
      maxTokens: 8000,
      temperature: 0.3, // Düşük temperature - tarihler ve sayılar hassas
    });

    // Parse JSON response
    const extractedData = parseIhaleIlaniResponse(response);

    const processingTime = Date.now() - startTime;

    // Maliyet hesapla
    const estimatedInputTokens = Math.ceil(text.length / 4);
    const estimatedOutputTokens = 2000;
    const maliyet = hesaplaClaudeMaliyeti(process.env.DEFAULT_AI_MODEL || 'claude-sonnet-4-20250514', estimatedInputTokens, estimatedOutputTokens);

    logger.basarili(LogKategori.EXTRACTION, 'İhale İlanı başarıyla analiz edildi', {
      ek: {
        guvenSkoru: Math.round(extractedData.guven_skoru * 100),
        kurum: extractedData.kurum,
        ihaleTarihi: extractedData.ihale_tarihi,
        butce: extractedData.tahmini_butce,
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
        document_type: "ihale_ilani",
        extraction_timestamp: new Date().toISOString(),
        cost: {
          tokens: maliyet.toplamTokens,
          cost_usd: maliyet.toplamMaliyetUSD,
          cost_try: maliyet.toplamMaliyetTRY,
        },
      },
    });
  } catch (error) {
    console.error("İhale İlanı extraction error:", error);
    logger.hata(LogKategori.AI_ANALYSIS, 'İhale İlanı analizi başarısız', {
      kod: 'IHALE_ILANI_ERROR',
      mesaj: error instanceof Error ? error.message : 'Bilinmeyen hata',
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "İhale ilanı analizi başarısız",
      },
      { status: 500 }
    );
  }
}

/**
 * İHALE İLANI İÇİN ÖZELLEŞMİŞ PROMPT
 */
function buildIhaleIlaniPrompt(text: string, fileName?: string): string {
  return `Sen bir Türk kamu ihaleleri uzmanısısın. Aşağıdaki İHALE İLANI belgesini analiz et.

🎯 GÖREV: İHALE İLANI EXTRACTION (SPECIALIZED)

Bu belge bir İHALE İLANIDIR. Şu bilgilere ÖZEL DİKKAT ET:

🔴 KRİTİK BİLGİLER (MUTLAKA BUL):
1. İhale Tarihi (ihale günü, saat)
2. Teklif Son Tarihi (son başvuru tarihi)
3. İhale Usulü (Açık, Belli İstekliler, Pazarlık, vb.)
4. Tahmini Bütçe / Sözleşme Bedeli
5. Teminat Miktarı (Geçici teminat)
6. Başvuru Şartları (Belgeler, yeterlilik kriterleri)

📄 BELGE:
---
${text}
---

📋 CEVAP FORMATI (SADECE JSON):

\`\`\`json
{
  "kurum": "Kurum adı",
  "ihale_turu": "Yemek hizmeti / Catering hizmeti / vb.",
  "ihale_usulu": "Açık ihale / Belli istekliler / vb.",
  "ihale_tarihi": "YYYY-MM-DD HH:MM" veya null,
  "teklif_son_tarih": "YYYY-MM-DD HH:MM" veya null,
  "ise_baslama_tarih": "YYYY-MM-DD" veya null,
  "ihale_suresi": "365 gün / 12 ay / vb." veya null,
  "tahmini_butce": sayı veya null,
  "gecici_teminat": sayı veya null,
  "kisi_sayisi": sayı veya null,
  "ogun_sayisi": sayı veya null,
  "gun_sayisi": sayı veya null,
  "basvuru_sartlari": [
    "Yeterlilik belgesi",
    "İş deneyim belgesi",
    "Mali yeterlilik"
  ],
  "degerendirme_kriterleri": [
    "En düşük fiyat",
    "Teknik yeterlilik"
  ],
  "ozel_sartlar": [
    "ISO 22000 sertifikası gerekli",
    "Araç-gereç yüklenici tarafından"
  ],
  "riskler": [
    "Kısa teklif süresi",
    "Yüksek teminat miktarı"
  ],
  "kanitlar": {
    "ihale_tarihi": "İhale 25 Ocak 2025 Cuma günü saat 14:00'te...",
    "butce": "Yaklaşık maliyet: 2.500.000,00 TL",
    "teminat": "Geçici teminat: 75.000 TL"
  },
  "guven_skoru": 0.90
}
\`\`\`

⚠️ KRİTİK KURALLAR:

1. **TARİHLER**: Tam tarih formatı kullan (YYYY-MM-DD HH:MM)
   - "25 Ocak 2025 Cuma 14:00" → "2025-01-25 14:00"
   - Sadece gün varsa saat kısmını atla: "2025-01-25"

2. **BÜTÇE**: Sadece sayı, TL işareti yok
   - "2.500.000,00 TL" → 2500000
   - "2,5 milyon TL" → 2500000

3. **TEMİNAT**: Geçici teminat miktarını bul
   - Genellikle tahmini bütçenin %3'ü

4. **BAŞVURU ŞARTLARI**: Liste formatında, net açıklamalar
   - "En az 3 yıl deneyim belgesi"
   - "Son 5 yıl içinde benzer işler"

5. **RİSKLER**: İhaleye katılmayı zorlaştıran faktörler
   - Kısa teklif süresi
   - Yüksek teminat
   - Katı yeterlilik kriterleri

6. **KANITLAR**: Her kritik bilgi için kaynak metin (200+ karakter)

🔍 ARAMA İPUÇLARI:

- Tarihler: "tarih", "günü", "saat", "son başvuru"
- Bütçe: "yaklaşık maliyet", "sözleşme bedeli", "toplam tutar"
- Teminat: "geçici teminat", "teklif teminatı"
- Şartlar: "yeterlilik", "belgeler", "koşullar"

🚀 SADECE JSON FORMATINDA CEVAP VER - BAŞKA HİÇBİR ŞEY YAZMA!

${fileName ? `\nDosya adı: ${fileName}` : ''}`;
}

/**
 * Parse İhale İlanı JSON response
 */
function parseIhaleIlaniResponse(response: string): any {
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
