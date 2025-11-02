import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { dishNames, institutionType } = await request.json();

    if (!dishNames || !Array.isArray(dishNames) || dishNames.length === 0) {
      return NextResponse.json(
        { error: "Menü listesi gerekli" },
        { status: 400 }
      );
    }

    const targetInstitution = institutionType || "standart";
    const isStandart = targetInstitution === "standart";

    const institutionNames: Record<string, string> = {
      hastane: "Hastane",
      okul: "Okul",
      fabrika: "Fabrika",
      belediye: "Belediye",
      askeri: "Askeri Birlik",
      standart: "Standart (Özel Havuz)"
    };

    const institutionName = institutionNames[targetInstitution] || targetInstitution;

    const dishList = dishNames.map((name: string, idx: number) => `${idx + 1}. ${name}`).join('\n');

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 6000,
      messages: [
        {
          role: "user",
          content: `Sen profesyonel bir aşçısın ve kurum yemekleri konusunda uzmansın.

TOPLU MENÜ LİSTESİ:
${dishList}

GÖREV:
1. Her menü için tam yemek adını bul (kısa isimler varsa tamamla, örn: "brokoli" → "Zeytinyağlı Brokoli", "kemalpasa" → "Kemalpaşa Tatlısı")
2. ${isStandart ? "STANDART GRAMAJLAR" : institutionName.toUpperCase() + " KURUMU GRAMAJLARI"} kullanarak 1 KİŞİLİK DETAYLI reçete hazırla
3. Her yemek için: isim, kategori, TÜM malzemeler (hiçbirini atlama!), detaylı hazırlama adımları, süreler

ÖNEMLİ:
- Her yemeğin ANA malzemesini mutlaka yaz (örn: kemalpaşa tatlısında kemalpaşa, mantıda mantı hamuru, vs.)
- Özel yemekler için karakteristik malzemeleri unutma
- Tüm malzemeleri eksiksiz listele (ana malzeme, sos, baharat, süsleme vs.)
- Eksik malzeme bırakma, tam ve detaylı tarif ver

${isStandart ?
  `BU TARİFLER ÖZEL HAVUZ İÇİN - STANDART GRAMAJLAR:
- Genel/evde pişirme standartları
- Ortalama yetişkin için normal porsiyonlar` :
  `BU TARİFLER ${institutionName.toUpperCase()} İÇİN - RESMI STANDARTLAR (2024-2025)`
}

SADECE JSON array döndür, başka metin ekleme:

[
  {
    "name": "Tam Yemek Adı",
    "category": "corbalar/ana-yemekler/pilavlar/salatalar/tatlilar",
    "ingredients": [
      {"name": "Malzeme", "amount": 100, "unit": "gr"}
    ],
    "instructions": [
      "Adım 1 açıklaması",
      "Adım 2 açıklaması"
    ],
    "prepTime": 15,
    "cookTime": 30,
    "servings": 1
  }
]`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("JSON bulunamadı");
    }

    const recipes = JSON.parse(jsonMatch[0]);

    // Her recipe için ID ve timestamps ekle
    const recipesWithMetadata = recipes.map((recipe: any) => ({
      ...recipe,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      institutions: targetInstitution === "standart" ? [] : [targetInstitution],
    }));

    return NextResponse.json({ recipes: recipesWithMetadata });
  } catch (error) {
    console.error("Bulk recipes error:", error);
    return NextResponse.json(
      { error: "Toplu reçete oluşturma başarısız" },
      { status: 500 }
    );
  }
}
