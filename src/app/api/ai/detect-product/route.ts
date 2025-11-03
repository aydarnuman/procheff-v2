import { NextRequest, NextResponse } from "next/server";
import { GeminiProvider } from "@/lib/ai/gemini-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProductDetection {
  category: string;
  icon: string;
  hasVariants: boolean;
  variants?: string[];
  defaultVariant?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productName } = body;

    if (!productName || productName.trim().length === 0) {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    console.log(`=== PRODUCT DETECTION START ===`);
    console.log(`Product: ${productName}`);

    const gemini = new GeminiProvider();

    const prompt = buildDetectionPrompt(productName);

    console.log("Detecting product details...");
    const startTime = Date.now();

    const response = await gemini.searchPrices(productName, {});

    const processingTime = Date.now() - startTime;
    console.log(`Detection completed in ${processingTime}ms`);

    // Parse response
    const detection = parseDetectionResponse(response);

    console.log("=== PRODUCT DETECTION SUCCESS ===");
    console.log(`Category: ${detection.category}`);
    console.log(`Icon: ${detection.icon}`);
    console.log(`Has Variants: ${detection.hasVariants}`);
    if (detection.variants) {
      console.log(`Variants: ${detection.variants.join(", ")}`);
    }

    return NextResponse.json({
      success: true,
      data: detection,
      processingTime,
    });
  } catch (error) {
    console.error("=== PRODUCT DETECTION ERROR ===", error);

    let userFriendlyMessage = "Ürün bilgisi alınamadı";

    if (error instanceof Error) {
      // Quota hatası kontrolü
      if (error.message.includes("quota") || error.message.includes("429") || error.message.includes("Too Many Requests")) {
        userFriendlyMessage = "AI API günlük kullanım limiti doldu. Lütfen yarın tekrar deneyin veya manuel olarak ürün ekleyin.";
      } else if (error.message.includes("API key")) {
        userFriendlyMessage = "AI API anahtarı geçersiz. Lütfen yöneticinize başvurun.";
      } else {
        userFriendlyMessage = `Ürün bilgisi alınamadı: ${error.message}`;
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: userFriendlyMessage,
      },
      { status: 500 }
    );
  }
}

function buildDetectionPrompt(productName: string): string {
  return `Sen bir gıda ürünleri uzmanısın. "${productName}" ürünü hakkında bilgi ver.

GÖREV:
1. Bu ürünün kategorisini belirle
2. Uygun bir emoji icon seç
3. Bu üründe VARYANTLAR var mı kontrol et (boyut, çeşit, kalite farklılıkları)

KATEGORİLER:
- "sebze" → Sebzeler (domates, salatalık, patates...)
- "et-tavuk" → Et & Tavuk
- "bakliyat" → Bakliyat (mercimek, nohut, fasulye, pirinç...)
- "sut-peynir" → Süt & Peynir
- "temel-gida" → Temel Gıda (un, şeker, yağ, makarna...)
- "baharat" → Baharat

ICON SEÇİMİ:
Her kategori için uygun emoji:
- Sebze: 🥬 🥕 🍅 🥔 🧅
- Et: 🥩 🍗
- Bakliyat: 🫘 🌾
- Süt: 🥛 🧀
- Temel Gıda: 🛒 🍞 🧈
- Baharat: 🌶️ 🧂

VARYANT TESPİTİ (ÇOK ÖNEMLİ):
Eğer bu üründe farklı çeşitler/boyutlar varsa "hasVariants: true" yap ve listele.

VARYANT ÖRNEKLERİ:
- **Nohut**: 8mm, 9mm, 10mm, İnce taneli, Iri taneli
- **Mercimek**: Kırmızı, Yeşil, Kahverengi
- **Pirinç**: Baldo, Osmancık, Jasmine, Basmati, Tosya
- **Zeytinyağı**: Natürel, Riviera, Sızma
- **Un**: Ekmeklik, Baklavalik, Çok amaçlı
- **Salça**: Biber salçası, Domates salçası, Acı biber
- **Makarna**: Spagetti, Penne, Fusilli

Eğer varyant YOKSA (örn: şeker, tuz, sadece bir çeşidi var):
- hasVariants: false
- variants: []

CEVAP FORMATI (SADECE JSON):
{
  "category": "bakliyat",
  "icon": "🫘",
  "hasVariants": true,
  "variants": ["8mm Nohut", "9mm Nohut", "10mm Nohut"],
  "defaultVariant": "9mm Nohut"
}

ÖNEMLİ:
- Varyant varsa MUTLAKA listele
- defaultVariant: En yaygın kullanılan çeşit
- Sadece JSON döndür, başka metin yazma!

JSON:`;
}

function parseDetectionResponse(response: string): ProductDetection {
  try {
    // Clean response
    let cleaned = response.trim();

    // Remove markdown
    const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      cleaned = jsonMatch[1].trim();
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\w*\s*/, "").replace(/```\s*$/, "");
    }

    // Extract JSON
    const jsonStartMatch = cleaned.match(/(\{[\s\S]*\})/);
    if (jsonStartMatch) {
      cleaned = jsonStartMatch[1].trim();
    }

    const parsed = JSON.parse(cleaned);

    return {
      category: parsed.category || "temel-gida",
      icon: parsed.icon || "🛒",
      hasVariants: parsed.hasVariants || false,
      variants: parsed.variants || [],
      defaultVariant: parsed.defaultVariant,
    };
  } catch (error) {
    console.error("Failed to parse detection response:", error);
    console.error("Raw response:", response);

    // Fallback
    return {
      category: "temel-gida",
      icon: "🛒",
      hasVariants: false,
    };
  }
}
