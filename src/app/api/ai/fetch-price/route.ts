import { NextRequest, NextResponse } from "next/server";
import { GeminiProvider } from "@/lib/ai/gemini-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FetchPriceRequest {
  productName: string;
  category?: string;
  source?: string; // Market adı (Migros, A101, vb.)
  brand?: string; // Marka adı (Tamek, Tat, vb.)
}

interface PriceResult {
  productName: string;
  price: number;
  unit: string;
  source: string;
  lastUpdated: string;
  confidence: number;
  brand?: string; // Marka bilgisi
  packageSize?: number; // Paket boyutu
  sourceUrl?: string; // Website URL'si
}

interface MultiMarketPriceResult {
  productName: string;
  prices: PriceResult[]; // Birden fazla market
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as FetchPriceRequest;
  const { productName, category, source, brand } = body;

  try {

    if (!productName || productName.trim().length === 0) {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    console.log(`=== AI PRICE FETCH START ===`);
    console.log(`Product: ${productName}`);
    console.log(`Category: ${category || "N/A"}`);
    console.log(`Source: ${source || "N/A"}`);
    console.log(`Brand: ${brand || "N/A"}`);

    // Initialize Gemini provider with web search
    const gemini = new GeminiProvider();

    console.log("Sending web search request to Gemini...");
    const startTime = Date.now();

    // Use Gemini web search for REAL prices
    const response = await gemini.searchPrices(productName, {
      market: source,
      brand,
      category,
    });

    const processingTime = Date.now() - startTime;
    console.log(`Gemini response received in ${processingTime}ms`);

    // Parse the response - array or single
    let priceData;
    try {
      priceData = parseAIPriceResponse(response, productName, source);
    } catch (parseError: any) {
      console.log("Parse hatası - muhtemelen ürün bulunamadı");

      // Eğer error'da suggestion varsa direkt onu kullan (AI'dan gelmiş)
      if (parseError.suggestion) {
        console.log("AI suggestion:", parseError.suggestion);
        return NextResponse.json({
          success: false,
          error: "Ürün bulunamadı",
          suggestion: parseError.suggestion,
        });
      }

      // Yoksa kendimiz öneri üret
      try {
        const suggestionPrompt = `Kullanıcı "${productName}" ürününü arıyor ama bulunamadı. Muhtemelen yanlış yazdı veya eksik yazdı. En yakın doğru ürün ismini tek bir kelime/cümle olarak öner. Sadece ürün ismini yaz, başka açıklama yapma.`;

        const suggestionResult = await gemini.generateText(suggestionPrompt);

        return NextResponse.json({
          success: false,
          error: "Ürün bulunamadı",
          suggestion: suggestionResult.trim(),
        });
      } catch (suggestionError) {
        console.error("Suggestion generation failed:", suggestionError);
      }

      throw parseError;
    }

    console.log("=== AI PRICE FETCH SUCCESS ===");

    if (Array.isArray(priceData)) {
      console.log(`Found ${priceData.length} market prices`);

      // Ortalama confidence hesapla
      const avgConfidence = priceData.reduce((sum, p) => sum + p.confidence, 0) / priceData.length;
      console.log(`Average confidence: ${(avgConfidence * 100).toFixed(1)}%`);

      priceData.forEach((p) => {
        console.log(`  - ${p.source}${p.brand ? ` (${p.brand})` : ""}: ${p.price} TL/${p.unit} (conf: ${(p.confidence * 100).toFixed(0)}%)`);
      });

      // Tüm farklı ürün isimlerini topla (birden fazla öneri için)
      const uniqueProductNames = [...new Set(priceData.map(p => p.productName))];
      console.log(`User input: "${productName}"`);
      console.log(`AI found: ${uniqueProductNames.join(", ")}`);

      // ÖNEMLİ: MUTLAKA isim kontrolü yap - confidence ne olursa olsun!
      // Eğer AI'ın bulduğu isim(ler) kullanıcının yazdığından farklıysa, öneri sun

      // Türkçe karakterleri normalize et (ş->s, ı->i, ğ->g, ü->u, ö->o, ç->c, İ->i)
      const normalizeTurkish = (text: string) => {
        return text
          .toLowerCase()
          .trim()
          .replace(/ş/g, 's')
          .replace(/ı/g, 'i')
          .replace(/ğ/g, 'g')
          .replace(/ü/g, 'u')
          .replace(/ö/g, 'o')
          .replace(/ç/g, 'c')
          .replace(/İ/g, 'i');
      };

      const normalizedUserInput = normalizeTurkish(productName);
      const isExactMatch = uniqueProductNames.some(
        name => normalizeTurkish(name) === normalizedUserInput
      );

      if (!isExactMatch) {
        console.log("Name mismatch detected - asking user for confirmation");

        // En fazla 3 öneri göster
        const suggestions = uniqueProductNames.slice(0, 3);

        return NextResponse.json({
          success: false,
          error: "Bunu mu demek istediniz?",
          suggestion: suggestions.length === 1 ? suggestions[0] : suggestions,
        });
      }

      // İsim aynı ama confidence düşükse yine de sor
      if (avgConfidence < 0.65) {
        console.log("Low confidence detected - asking user for confirmation");

        return NextResponse.json({
          success: false,
          error: "Emin değilim, bunu mu demek istediniz?",
          suggestion: productName,
        });
      }

      return NextResponse.json({
        success: true,
        data: priceData, // Array
        isMultiple: true,
        processingTime,
      });
    } else {
      console.log(`Price: ${priceData.price} TL/${priceData.unit}`);
      console.log(`Source: ${priceData.source}`);
      console.log(`Confidence: ${(priceData.confidence * 100).toFixed(1)}%`);
      console.log(`User input: "${productName}"`);
      console.log(`AI found: "${priceData.productName}"`);

      // Türkçe karakterleri normalize et
      const normalizeTurkish = (text: string) => {
        return text
          .toLowerCase()
          .trim()
          .replace(/ş/g, 's')
          .replace(/ı/g, 'i')
          .replace(/ğ/g, 'g')
          .replace(/ü/g, 'u')
          .replace(/ö/g, 'o')
          .replace(/ç/g, 'c')
          .replace(/İ/g, 'i');
      };

      // ÖNEMLİ: MUTLAKA isim kontrolü yap - confidence ne olursa olsun!
      const normalizedUserInput = normalizeTurkish(productName);
      const normalizedAIResult = normalizeTurkish(priceData.productName);

      if (normalizedAIResult !== normalizedUserInput) {
        console.log("Name mismatch detected - asking user for confirmation");
        console.log(`  Normalized user: "${normalizedUserInput}"`);
        console.log(`  Normalized AI: "${normalizedAIResult}"`);

        return NextResponse.json({
          success: false,
          error: "Bunu mu demek istediniz?",
          suggestion: priceData.productName,
        });
      }

      // İsim aynı ama confidence düşükse yine de sor
      if (priceData.confidence < 0.65) {
        console.log("Low confidence detected - asking user for confirmation");

        return NextResponse.json({
          success: false,
          error: "Emin değilim, bunu mu demek istediniz?",
          suggestion: priceData.productName,
        });
      }

      return NextResponse.json({
        success: true,
        data: priceData, // Single
        isMultiple: false,
        processingTime,
      });
    }
  } catch (error) {
    console.error("=== AI PRICE FETCH ERROR ===", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    // Eğer ürün bulunamadıysa, AI'dan öneri iste
    if (errorMessage.includes("bulunamadı") || errorMessage.includes("not found")) {
      try {
        const gemini = new GeminiProvider();
        const suggestionPrompt = `Kullanıcı "${productName}" ürününü arıyor ama bulunamadı. Muhtemelen yanlış yazdı veya eksik yazdı. En yakın doğru ürün ismini tek bir kelime/cümle olarak öner. Sadece ürün ismini yaz, başka açıklama yapma.`;

        const suggestion = await gemini.generateText(suggestionPrompt);

        return NextResponse.json({
          success: false,
          error: errorMessage,
          suggestion: suggestion.trim(),
        });
      } catch (suggestionError) {
        console.error("Suggestion generation failed:", suggestionError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

// Eski Claude prompt fonksiyonları kaldırıldı - artık Gemini web search kullanıyoruz

function parseAIPriceResponse(
  response: string,
  productName: string,
  requestedSource?: string
): PriceResult | PriceResult[] {
  try {
    // Clean markdown code blocks and extract JSON
    let cleanedResponse = response.trim();

    // Eğer ```json ile başlıyorsa, sadece JSON kısmını al
    const jsonMatch = cleanedResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[1].trim();
    } else if (cleanedResponse.startsWith("```")) {
      // Diğer code block formatları
      cleanedResponse = cleanedResponse
        .replace(/^```\w*\s*/, "")
        .replace(/```\s*$/, "");
    }

    // Eğer JSON'dan önce metin varsa, sadece [ veya { ile başlayan kısmı al
    const jsonStartMatch = cleanedResponse.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (jsonStartMatch) {
      cleanedResponse = jsonStartMatch[1].trim();
    }

    // Türkçe ondalık ayırıcı (virgül) yerine İngilizce (nokta) kullan
    // Örnek: "price": 249,00 -> "price": 249.00
    cleanedResponse = cleanedResponse.replace(/(\d+),(\d{2})/g, "$1.$2");

    const parsed = JSON.parse(cleanedResponse);

    // Eğer "notFound" flag'i varsa, error fırlat - bu catch'te yakalanacak
    if (parsed.notFound === true && parsed.suggestion) {
      const error = new Error("Ürün bulunamadı") as any;
      error.suggestion = parsed.suggestion;
      throw error;
    }

    // Eğer array dönmüşse - çoklu market
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        productName: item.productName || productName, // AI'ın bulduğu gerçek ürün adı
        price: item.price,
        unit: item.unit,
        source: item.source,
        brand: item.brand || undefined,
        packageSize: item.packageSize || 1,
        sourceUrl: item.sourceUrl || undefined,
        lastUpdated: new Date().toISOString(),
        confidence: item.confidence || 0.7,
      }));
    }

    // Tek market
    if (
      typeof parsed.price !== "number" ||
      !parsed.unit ||
      !parsed.source
    ) {
      throw new Error("Invalid price response structure");
    }

    return {
      productName: parsed.productName || productName, // AI'ın bulduğu gerçek ürün adı
      price: parsed.price,
      unit: parsed.unit,
      source: parsed.source,
      brand: parsed.brand || undefined,
      packageSize: parsed.packageSize || 1,
      sourceUrl: parsed.sourceUrl || undefined,
      lastUpdated: new Date().toISOString(),
      confidence: parsed.confidence || 0.7,
    };
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    console.error("Raw response:", response);
    throw new Error("Failed to parse AI price response");
  }
}
