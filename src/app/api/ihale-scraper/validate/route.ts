import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    const { tenders, mode } = await request.json();

    if (!tenders || !Array.isArray(tenders) || tenders.length === 0) {
      return NextResponse.json({ success: false, error: 'Tenders array required' }, { status: 400 });
    }

    const model = genai.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
    });

    const results = [];

    // Her ihale için doğrulama/düzenleme
    for (const tender of tenders) {
      const prompt = buildValidationPrompt(tender, mode);

      try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // JSON parse et
        let cleaned = text.trim();
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
        } else if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
        }

        const parsed = JSON.parse(cleaned);
        results.push({
          tender_id: tender.id,
          original: tender,
          validation: parsed,
        });

        // Rate limit - 7.5 saniye bekle (dakikada 8 request)
        if (tenders.indexOf(tender) < tenders.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 7500));
        }
      } catch (error: any) {
        console.error(`Validation error for tender ${tender.id}:`, error);
        results.push({
          tender_id: tender.id,
          original: tender,
          validation: {
            has_issues: true,
            issues: ['AI doğrulama hatası: ' + error.message],
            suggestions: {},
            confidence: 0,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      total: tenders.length,
      validated: results.filter(r => !r.validation.has_issues).length,
      issues_found: results.filter(r => r.validation.has_issues).length,
    });
  } catch (error: any) {
    console.error('Validation API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

function buildValidationPrompt(tender: any, mode: string = 'validate'): string {
  if (mode === 'edit') {
    return `Sen bir ihale veri düzenleme uzmanısın. Görevi ihalenin eksik veya hatalı bilgilerini düzeltmek.

# İHALE VERİLERİ
Başlık: ${tender.title}
Kurum: ${tender.organization || 'BELİRTİLMEMİŞ'}
Şehir: ${tender.organization_city || 'BELİRTİLMEMİŞ'}
Bütçe: ${tender.budget ? `${tender.budget} ${tender.currency}` : 'BELİRTİLMEMİŞ'}
Kategori: ${tender.category || 'BELİRTİLMEMİŞ'}
İhale Türü: ${tender.tender_type || 'BELİRTİLMEMİŞ'}
Alım Türü: ${tender.procurement_type || 'BELİRTİLMEMİŞ'}
İlan Tarihi: ${tender.announcement_date || 'BELİRTİLMEMİŞ'}
Son Tarih: ${tender.deadline_date || 'BELİRTİLMEMİŞ'}

# GÖREV
Bu ihalenin bilgilerini kontrol et ve eksik olanları tamamla veya hataları düzelt.

## Kontrol Edilecekler:
1. **Şehir**: Kurum adından şehir çıkarılabilir mi? (örn: "İstanbul Büyükşehir Belediyesi" → "İstanbul")
2. **Kategori**: Başlıktan daha uygun bir kategori önerilebilir mi?
3. **İhale/Alım Türü**: Standart terimlere uygun mu? (örn: "Açık İhale", "Hizmet Alımı")
4. **Tutarsızlıklar**: Veriler birbirleriyle çelişiyor mu?

JSON formatında döndür:
{
  "has_changes": true/false,
  "suggestions": {
    "organization_city": "İstanbul",
    "category": "Catering Hizmet Alımı",
    "tender_type": "Açık İhale",
    "procurement_type": "Hizmet Alımı"
  },
  "reasoning": "Kurum adında 'İstanbul' geçiyor, şehir bilgisi eksikti. Kategori başlıktan çıkarıldı.",
  "confidence": 0.95
}

SADECE JSON döndür!`;
  } else {
    return `Sen bir ihale veri doğrulama uzmanısın. Görevi ihalenin verilerinde hata veya tutarsızlık olup olmadığını tespit etmek.

# İHALE VERİLERİ
Başlık: ${tender.title}
Kurum: ${tender.organization || 'BELİRTİLMEMİŞ'}
Şehir: ${tender.organization_city || 'BELİRTİLMEMİŞ'}
Bütçe: ${tender.budget ? `${tender.budget} ${tender.currency}` : 'BELİRTİLMEMİŞ'}
Kategori: ${tender.category || 'BELİRTİLMEMİŞ'}
İhale Türü: ${tender.tender_type || 'BELİRTİLMEMİŞ'}
Catering: ${tender.is_catering ? 'Evet' : 'Hayır'} (Güven: ${Math.round(tender.catering_confidence * 100)}%)
AI Açıklaması: ${tender.ai_categorization_reasoning || 'BELİRTİLMEMİŞ'}

# GÖREV
Bu ihalenin verilerini doğrula. Şüpheli veya hatalı görünen durumları tespit et.

## Kontrol Edilecekler:
1. **Catering Sınıflandırması**: Başlık ile catering kategorizasyonu uyumlu mu?
2. **Eksik Bilgiler**: Kritik alanlar (şehir, bütçe, tarih) eksik mi?
3. **Tutarsızlıklar**: Veriler mantıklı mı? (örn: geçmiş tarihli ihale aktif mi?)
4. **Şüpheli Bütçeler**: Bütçe çok düşük veya çok yüksek mi?

JSON formatında döndür:
{
  "has_issues": true/false,
  "issues": [
    "⚠️ Başlıkta 'yemek' geçiyor ama catering güveni %60, düşük",
    "❌ Şehir bilgisi eksik ama kurum adında 'Ankara' geçiyor",
    "⚠️ Bütçe 50M TL, normalden çok yüksek - kontrol et"
  ],
  "suggestions": {
    "organization_city": "Ankara",
    "is_catering": true,
    "catering_confidence": 0.95
  },
  "severity": "high/medium/low",
  "confidence": 0.90
}

SADECE JSON döndür!`;
  }
}
