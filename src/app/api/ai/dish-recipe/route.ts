import { NextRequest, NextResponse } from "next/server";
import type { Recipe } from "@/types/menu";

export async function POST(req: NextRequest) {
  try {
    const { dishName, institutionType } = await req.json();
    const servings = 1; // HER ZAMAN 1 KİŞİLİK

    if (!dishName || dishName.trim().length === 0) {
      return NextResponse.json(
        { error: "Yemek adı gerekli" },
        { status: 400 }
      );
    }

    if (!institutionType) {
      return NextResponse.json(
        { error: "Kurum tipi gerekli (hastane, okul, fabrika, belediye, askeri)" },
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

    // Kurum adlarını Türkçe'ye çevir
    const institutionNames: Record<string, string> = {
      hastane: "Hastane",
      okul: "Okul",
      fabrika: "Fabrika",
      belediye: "Belediye",
      askeri: "Askeri Birlik",
      standart: "Standart (Özel Havuz)"
    };

    const institutionName = institutionNames[institutionType] || institutionType;
    const isStandart = institutionType === "standart";

    console.log(`👨‍🍳 Reçete isteniyor: "${dishName}" (${institutionName} için, 1 kişilik)`);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-20250514", // En kaliteli model
        max_tokens: 3000, // Daha detaylı yanıtlar için
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: `Sen profesyonel bir aşçısın ve kurum yemekleri konusunda uzmansın. "${dishName}" yemeği için ${isStandart ? "STANDART/GENEL" : institutionName + " KURUMU İÇİN"} detaylı reçete ver.

ÇOK ÖNEMLİ: SADECE 1 KİŞİLİK PORSIYON HAZIRLA!

${isStandart ?
`BU TARİF ÖZEL HAVUZ İÇİN - STANDART GRAMAJLAR KULLAN:
- Genel/evde pişirme standartlarını kullan
- Ortalama bir yetişkin için normal porsiyonlar
- Ne çok az, ne çok fazla - dengeli gramajlar`
:
`BU TARİF ${institutionName.toUpperCase()} İÇİN OLDUĞU İÇİN GRAMAJLAR O KURUMA AİT RESMI STANDARTLARA GÖRE OLMALI:`}
- Hastane menüleri için: Sağlık Bakanlığı "Hasta Beslenmesi Yönergesi 2024-2025" standartlarını kullan
- Okul menüleri için: MEB "Okul Yemek Hizmetleri Yönergesi 2024-2025" standartlarını kullan
- Fabrika/İşyeri için: İSG Mevzuatı "İşçi Yemekleri Standartları 2024-2025"
- Askeri birimler için: MSB "Asker Beslenmesi Yönergesi 2024-2025"

Örnek gerçek gramajlar (Kuru Fasulye - Hastane):
- Kuru fasulye haşlanmış: 120g
- Kuşbaşı et: 50g
- Soğan: 30g
- Salça: 20g
- Sıvı yağ: 15ml
(Toplam porsiyon: ~440g/kişi)

SADECE JSON döndür:

{
  "name": "Yemek Adı",
  "category": "corba" | "ana_yemek" | "pilav" | "salata" | "tatli" | "icecek" | "aperatif",
  "servings": 1,
  "ingredients": [
    {"name": "Kuru fasulye", "amount": 400, "unit": "g"},
    {"name": "Kuşbaşı et", "amount": 200, "unit": "g"},
    {"name": "Soğan", "amount": 150, "unit": "g"},
    {"name": "Salça", "amount": 30, "unit": "g"},
    {"name": "Tuz", "amount": 10, "unit": "g"},
    {"name": "Karabiber", "amount": 5, "unit": "g"},
    {"name": "Sıvı yağ", "amount": 50, "unit": "ml"},
    {"name": "Su", "amount": 2, "unit": "litre"}
  ],
  "instructions": [
    "Fasulyeleri 1 gece suda bekletin",
    "Haşlayıp süzün",
    "Soğanları kavurun",
    "Salçayı ekleyin",
    "Eti ekleyip pişirin",
    "Fasulyeleri ekleyin",
    "Su ve baharatları ekleyip kaynatın",
    "Kısık ateşte 45 dakika pişirin"
  ],
  "prepTime": 20,
  "cookTime": 60,
  "difficulty": "orta",
  "calories": 350,
  "cost": 45.50,
  "notes": "Bir gece önceden hazırlık gerekir"
}

ÖNEMLİ:
- Tüm malzemeler GRAMAJ ile (g, ml, litre, adet)
- Adımlar sıralı ve net
- Türk mutfağı standartlarına uygun
- Gerçekçi fiyat (2024 TL bazında)
- Kalori bilgisi kişi başı`,
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

    console.log("AI Recipe Response:", aiResponse);

    // JSON'u parse et
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI yanıtı formatlanamadı" },
        { status: 500 }
      );
    }

    const recipeData = JSON.parse(jsonMatch[0]);

    // Recipe objesini oluştur
    const recipe: Omit<Recipe, "id" | "createdAt" | "updatedAt"> = {
      name: recipeData.name,
      category: recipeData.category,
      ingredients: recipeData.ingredients,
      instructions: recipeData.instructions,
      servings: recipeData.servings,
      prepTime: recipeData.prepTime,
      cookTime: recipeData.cookTime,
      difficulty: recipeData.difficulty,
      calories: recipeData.calories,
      cost: recipeData.cost,
      notes: recipeData.notes,
      institutions: [],
    };

    return NextResponse.json({
      success: true,
      recipe,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Dish recipe error:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
