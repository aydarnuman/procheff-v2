import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BelgeTuru } from '@/types/ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Hızlı Belge Türü Tespiti - Gemini Flash
 * Sadece dosya ismi ve ilk 500 karakter ile tespit eder
 */
export async function POST(request: NextRequest) {
  try {
    const { fileName, textPreview } = await request.json();

    if (!fileName) {
      return NextResponse.json(
        { success: false, error: 'Dosya ismi gerekli' },
        { status: 400 }
      );
    }

    console.log(`🚀 [QUICK-DETECT] Başladı: ${fileName}`);

    // Gemini Flash modelini kullan (çok hızlı ve ucuz)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.1, // Düşük temperature - tutarlı sonuç
        maxOutputTokens: 100, // Kısa yanıt
      }
    });

    const prompt = `Sadece dosya isminden veya ilk birkaç cümleden bu belgenin türünü tespit et.

DOSYA İSMİ: ${fileName}
${textPreview ? `İLK 500 KARAKTER:\n${textPreview.slice(0, 500)}` : ''}

OLASI TÜRLER:
- ihale_ilani: İhale duyurusu/ilanı
- teknik_sartname: Teknik şartname (menü, gramaj, malzeme detayları)
- idari_sartname: İdari şartname (ödeme, ceza, prosedür kuralları)
- sozlesme: Sözleşme taslağı
- fiyat_teklif: Fiyat teklif mektubu
- diger: Diğer belgeler
- belirsiz: Tespit edilemedi

SADECE JSON formatında yanıt ver:
{
  "belge_turu": "ihale_ilani",
  "guven": 0.95,
  "sebep": "Dosya isminde 'ilan' kelimesi var"
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log(`📝 [QUICK-DETECT] Gemini yanıtı:`, responseText);

    // JSON parse et
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Gemini JSON döndürmedi');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate
    const validTypes: BelgeTuru[] = [
      'ihale_ilani',
      'teknik_sartname',
      'idari_sartname',
      'sozlesme',
      'fiyat_teklif',
      'diger',
      'belirsiz'
    ];

    if (!validTypes.includes(parsed.belge_turu)) {
      parsed.belge_turu = 'belirsiz';
    }

    console.log(`✅ [QUICK-DETECT] Tespit: ${parsed.belge_turu} (${Math.round(parsed.guven * 100)}%)`);

    return NextResponse.json({
      success: true,
      data: {
        belge_turu: parsed.belge_turu,
        guven: parsed.guven,
        sebep: parsed.sebep
      }
    });

  } catch (error) {
    console.error('❌ [QUICK-DETECT] Hata:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata'
      },
      { status: 500 }
    );
  }
}
