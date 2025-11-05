import { NextRequest, NextResponse } from "next/server";
import { ClaudeProvider } from "@/lib/ai/claude-provider";
import { BelgeTuru } from "@/types/ai";

export const runtime = "nodejs";

/**
 * Lightweight API endpoint - sadece belge türü tespiti yapar
 * Full analysis'den daha hızlı ve ucuz
 */
export async function POST(request: NextRequest) {
  try {
    const { text, fileName } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { success: false, error: "Metin verisi bulunamadı" },
        { status: 400 }
      );
    }

    // Kısa metinler için basit tespit
    if (text.length < 100) {
      return NextResponse.json({
        success: true,
        data: {
          belge_turu: "belirsiz" as BelgeTuru,
          guven: 0.1,
          sebep: "Metin çok kısa"
        }
      });
    }

    const claude = new ClaudeProvider();

    // Sadece ilk 5000 karakteri kullan (hız için)
    const sampleText = text.substring(0, 5000);

    // Basit prompt - sadece belge türü sor
    const prompt = `Aşağıdaki ihale belgesinin türünü tespit et.

Belgeden bir örnek (ilk 5000 karakter):
---
${sampleText}
---

SADECE şu formatta yanıt ver (başka hiçbir şey yazma):
{
  "belge_turu": "teknik_sartname|ihale_ilani|sozlesme_tasarisi|idari_sartname|fiyat_teklif_mektubu|diger|belirsiz",
  "guven": 0.85,
  "sebep": "Kısa açıklama"
}

Belge Türleri:
- teknik_sartname: Menü, gramaj, malzeme listesi içerir
- ihale_ilani: İhale tarihi, başvuru şartları, teminat bilgileri
- sozlesme_tasarisi: Sözleşme maddeleri, yükümlülükler, ceza şartları
- idari_sartname: İdari kurallar, değerlendirme kriterleri
- fiyat_teklif_mektubu: Fiyat cetveli, teklif tutarı
- diger: Diğer belgeler
- belirsiz: Tespit edilemedi`;

    const response = await claude.queryRaw(prompt, {
      maxTokens: 200, // Çok kısa yanıt yeterli
      temperature: 0.3, // Düşük temperature - tutarlı sonuçlar
    });

    // JSON parse et
    let parsed;
    try {
      // ```json wrapper varsa temizle
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith("```json")) {
        cleanResponse = cleanResponse.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
      }
      parsed = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error("Parse error:", parseError);
      console.error("Raw response:", response);
      return NextResponse.json({
        success: true,
        data: {
          belge_turu: "belirsiz" as BelgeTuru,
          guven: 0.1,
          sebep: "AI yanıtı parse edilemedi"
        }
      });
    }

    console.log(`📄 ${fileName} → ${parsed.belge_turu} (güven: ${Math.round(parsed.guven * 100)}%)`);

    // Düz obje olarak döndür (Next.js serialization hatası önleme)
    const result = {
      success: true,
      data: {
        belge_turu: parsed.belge_turu as BelgeTuru,
        guven: parsed.guven || 0.5,
        sebep: parsed.sebep || ""
      }
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error("Document type detection error:", error);

    // Düz obje olarak hata döndür
    const errorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Bilinmeyen hata",
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
