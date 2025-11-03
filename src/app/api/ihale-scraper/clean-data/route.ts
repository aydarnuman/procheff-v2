// ============================================================================
// API: CLEAN DATABASE DATA BY PARSING DETAIL PAGES
// Her ihalenin detay sayfasını fetch edip Claude Haiku ile parse eder
// Tabloda eksik olan bilgileri doldurur (şehir, tarihler, organizasyon vs)
// Claude Haiku: $0.00025/1K tokens (çok ucuz!)
// ============================================================================

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ihale-scraper/database/supabase-client';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    console.log('🧹 Detay sayfalarından veri çekme başlatıldı...');

    // Get ALL tenders that need cleaning
    const { data: tenders, error } = await supabaseAdmin
      .from('ihale_listings')
      .select('id, source_url, organization_city, deadline_date, announcement_date, tender_date, organization, title, budget, procurement_type')
      .eq('is_catering', true)
      .limit(1000); // Tüm ihaleler (max 1000)

    if (error) {
      console.error('❌ Database hatası:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!tenders || tenders.length === 0) {
      return NextResponse.json({ success: false, message: 'Temizlenecek kayıt bulunamadı' });
    }

    console.log(`📊 ${tenders.length} kayıt işlenecek`);

    // Claude Haiku client
    const claude = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // ============================================================================
    // PARALEL İŞLEME: 10 ihale aynı anda işlenir (50 req/min limit = güvenli)
    // ============================================================================
    let cleaned = 0;
    let failed = 0;
    const BATCH_SIZE = 10; // 10 ihale paralel

    const processTender = async (tender: any, index: number, total: number) => {
      console.log(`\n[${index + 1}/${total}] İşleniyor: ${tender.id}`);
      console.log(`   URL: ${tender.source_url}`);

      try {
        // 1. Detay sayfasının HTML'ini fetch et
        const htmlResponse = await fetch(tender.source_url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (!htmlResponse.ok) {
          console.error(`   ❌ HTTP ${htmlResponse.status}: ${htmlResponse.statusText}`);
          return { success: false };
        }

        const html = await htmlResponse.text();
        console.log(`   ✅ HTML çekildi (${html.length} karakter)`);

        // 2. Claude Haiku ile HTML'i parse et
        const prompt = `Sen bir HTML parse uzmanısın. İhale detay sayfasından TÜM bilgileri çıkar.

# HTML İÇERİĞİ (İlk 8000 karakter):
${html.slice(0, 8000)}

# MEVCUT VERİ (Database'de var, eksikse doldur):
- Başlık: "${tender.title || 'YOK'}"
- Şehir: "${tender.organization_city || 'YOK'}"
- Son Tarih: "${tender.deadline_date || 'YOK'}"
- İlan Tarihi: "${tender.announcement_date || 'YOK'}"
- İhale Tarihi: "${tender.tender_date || 'YOK'}"
- Organizasyon: "${tender.organization || 'YOK'}"
- Bütçe: "${tender.budget || 'YOK'}"
- İhale Türü: "${tender.procurement_type || 'YOK'}"

# GÖREV
HTML'den ŞU BİLGİLERİ ÇIKAR:

1. **Başlık** (title): İhalenin kısa özeti (max 100 karakter, örn: "Yemek İhalesi - Mersin")
2. **Şehir** (city): Türkiye şehir adı (örn: "Mersin", "İstanbul", "Ankara")
3. **Son Başvuru Tarihi** (deadline_date): YYYY-MM-DD formatında
4. **İlan Tarihi** (announcement_date): YYYY-MM-DD formatında
5. **İhale Tarihi** (tender_date): İhalenin yapılacağı tarih (YYYY-MM-DD)
6. **Organizasyon** (organization): Kurumun tam adı (örn: "Mersin Aile ve Sosyal Hizmetler İl Müdürlüğü")
7. **Bütçe** (budget): Sadece rakam (örn: 1250000), para birimi olmazsa null
8. **İhale Türü** (procurement_type): "Açık İhale", "Pazarlık Usulü" vs

KURALLAR:
- Mevcut veri temiz ise ONU kullan
- HTML'de bulamazsan "null" döndür
- Tarihler: YYYY-MM-DD formatında
- Başlık: Kısa ve öz (max 100 karakter)
- Bütçe: Sadece rakam (float), para birimi yok

JSON formatında cevap ver:
{
  "title": "Yemek İhalesi - Mersin Aile ve Sosyal Hizmetler",
  "city": "Mersin",
  "deadline_date": "2025-11-04",
  "announcement_date": "2025-10-15",
  "tender_date": "2025-11-05",
  "organization": "Mersin Aile ve Sosyal Hizmetler İl Müdürlüğü",
  "budget": 1250000,
  "procurement_type": "Açık İhale"
}

SADECE JSON döndür!`;

        const message = await claude.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        });

        // 3. Response'u parse et
        const text = message.content[0].type === 'text' ? message.content[0].text : '';
        let cleaned_json = text.trim();

        // JSON wrapper temizle
        if (cleaned_json.startsWith('```json')) {
          cleaned_json = cleaned_json.replace(/^```json\s*/, '').replace(/```\s*$/, '');
        } else if (cleaned_json.startsWith('```')) {
          cleaned_json = cleaned_json.replace(/^```\s*/, '').replace(/```\s*$/, '');
        }

        const parsed = JSON.parse(cleaned_json);
        const cleanedData = {
          title: parsed.title === 'null' || !parsed.title ? null : parsed.title,
          city: parsed.city === 'null' || !parsed.city ? null : parsed.city,
          deadline_date: parsed.deadline_date === 'null' || !parsed.deadline_date ? null : parsed.deadline_date,
          announcement_date: parsed.announcement_date === 'null' || !parsed.announcement_date ? null : parsed.announcement_date,
          tender_date: parsed.tender_date === 'null' || !parsed.tender_date ? null : parsed.tender_date,
          organization: parsed.organization === 'null' || !parsed.organization ? null : parsed.organization,
          budget: parsed.budget === 'null' || !parsed.budget ? null : parseFloat(parsed.budget),
          procurement_type: parsed.procurement_type === 'null' || !parsed.procurement_type ? null : parsed.procurement_type,
        };

        console.log('   ✅ Parse edildi:', cleanedData);

        // 4. Database'i güncelle
        const { error: updateError } = await supabaseAdmin
          .from('ihale_listings')
          .update({
            title: cleanedData.title,
            organization_city: cleanedData.city,
            deadline_date: cleanedData.deadline_date,
            announcement_date: cleanedData.announcement_date,
            tender_date: cleanedData.tender_date,
            organization: cleanedData.organization,
            budget: cleanedData.budget,
            procurement_type: cleanedData.procurement_type,
          })
          .eq('id', tender.id);

        if (updateError) {
          console.error('   ❌ Update hatası:', updateError);
          return { success: false };
        } else {
          console.log('   ✅ Database güncellendi');
          return { success: true };
        }
      } catch (error: any) {
        console.error(`   ❌ Hata: ${error.message}`);
        return { success: false };
      }
    };

    // Batch'lerle paralel işle
    for (let i = 0; i < tenders.length; i += BATCH_SIZE) {
      const batch = tenders.slice(i, i + BATCH_SIZE);
      console.log(`\n🚀 Batch ${Math.floor(i / BATCH_SIZE) + 1} başlatıldı (${batch.length} ihale paralel)`);

      const results = await Promise.all(
        batch.map((tender, batchIndex) => processTender(tender, i + batchIndex, tenders.length))
      );

      // Sonuçları say
      results.forEach(result => {
        if (result.success) {
          cleaned++;
        } else {
          failed++;
        }
      });

      console.log(`✅ Batch tamamlandı - Toplam: ${cleaned} başarılı, ${failed} hatalı`);
    }

    console.log(`\n✅ Veri temizleme tamamlandı!`);
    console.log(`   ✅ Temizlenen: ${cleaned}`);
    console.log(`   ❌ Hatalı: ${failed}`);

    return NextResponse.json({
      success: true,
      message: `${cleaned} kayıt temizlendi`,
      cleaned,
      failed,
      total: tenders.length,
    });
  } catch (error: any) {
    console.error('❌ Clean data exception:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
