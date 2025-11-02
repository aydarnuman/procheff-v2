import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body.query || body.dishName;

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Yemek adı gerekli" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key bulunamadı" },
        { status: 500 }
      );
    }

    console.log(`🍽️ Yemek önerisi isteniyor: "${query}"`);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: `Sen bir Türk mutfağı uzmanısın. Kullanıcı yemek adı yazdı ama yazım hatası olabilir VEYA sadece malzeme/sebze adı yazmış olabilir.

KULLANICI YAZDI: "${query}"

GÖREV:
1. Eğer bu TAM BİR YEMEK ADI ise, düzelt ve doğru şeklini yaz
2. Eğer bu SADECE MALZEME/SEBZE adı ise (örn: "brokoli", "pirasa", "ispanak"), o malzemeden yapılan EN POPÜLER TÜRK YEMEĞİNİ öner
3. Güven skorunu 0-100 arası ver

SADECE JSON döndür, başka metin ekleme:

{
  "correctedName": "Tam Yemek Adı",
  "confidence": 95
}

Örnekler:
- "kru fasule" → "Etli Kuru Fasulye" (confidence: 90)
- "mntı" → "Mantı" (confidence: 95)
- "mercmek corbası" → "Mercimek Çorbası" (confidence: 90)
- "brokoli" → "Brokoli Salatası" veya "Buharda Brokoli" (confidence: 85)
- "pirasa" → "Zeytinyağlı Pırasa" (confidence: 90)
- "ispanak" → "Ispanak Kavurma" (confidence: 90)
- "etli nohut" → "Etli Nohut" (confidence: 95)
- "karnabahar" → "Karnabahar Kızartması" veya "Karnabahar Musakka" (confidence: 85)`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Claude API error:", error);
      return NextResponse.json(
        { error: "AI servisi hatası" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const aiResponse = data.content[0].text;

    console.log("AI Response:", aiResponse);

    // JSON'u parse et
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI yanıtı formatlanamadı" },
        { status: 500 }
      );
    }

    const suggestion = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      correctedName: suggestion.correctedName,
      confidence: suggestion.confidence,
      suggestion: {
        original: query,                      // Kullanıcının yazdığı
        suggested: suggestion.correctedName,  // AI'ın düzelttiği
        confidence: suggestion.confidence,
        alternatives: []                      // Şimdilik boş array
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Suggest dish error:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
