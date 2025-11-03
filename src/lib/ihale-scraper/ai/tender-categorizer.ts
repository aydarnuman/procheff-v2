// ============================================================================
// AI TENDER CATEGORIZER
// Mevcut ClaudeProvider'ı kullanarak ihaleleri kategorize eder
// MEVCUT SİSTEME DOKUNMAZ - sadece okur!
// ============================================================================

import { ClaudeProvider } from '@/lib/ai/claude-provider';
import type { ScrapedTender, AICategorization } from '../types';
import { GLOBAL_CONFIG } from '../config';

export class TenderCategorizer {
  private claude: ClaudeProvider;

  constructor() {
    // Mevcut Claude provider'ı kullan (READ-ONLY!)
    this.claude = new ClaudeProvider();
  }

  /**
   * Tek bir ihaleyi kategorize et
   */
  async categorizeSingle(tender: ScrapedTender): Promise<AICategorization> {
    const prompt = this.buildCategorizationPrompt(tender);

    try {
      const response = await this.claude.queryRaw(prompt, {
        maxTokens: 500,
        temperature: 0.3, // Deterministik sonuç için düşük
      });

      // JSON parse et
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      const result = JSON.parse(cleaned) as AICategorization;

      console.log(`   🤖 AI: ${result.is_catering ? '✅ Catering' : '❌ Değil'} (${Math.round(result.confidence * 100)}%)`);
      if (result.keywords_found.length > 0) {
        console.log(`      Anahtar kelimeler: ${result.keywords_found.join(', ')}`);
      }

      return result;
    } catch (error) {
      console.error(`   ❌ AI kategorilendirme başarısız: ${error}`);

      // Fallback: Basit keyword matching
      return this.fallbackCategorization(tender);
    }
  }

  /**
   * Birden fazla ihaleyi batch olarak kategorize et
   */
  async categorizeBatch(tenders: ScrapedTender[]): Promise<Map<string, AICategorization>> {
    const { batchSize } = GLOBAL_CONFIG.aiCategorization;
    const results = new Map<string, AICategorization>();

    console.log(`\n🤖 AI Kategorilendirme başlıyor: ${tenders.length} ihale`);

    // Batch'lere böl
    for (let i = 0; i < tenders.length; i += batchSize) {
      const batch = tenders.slice(i, i + batchSize);
      console.log(`   Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tenders.length / batchSize)}: ${batch.length} ihale`);

      // Her birini kategorize et (paralel değil, sıralı - rate limit için)
      for (const tender of batch) {
        const tenderId = tender.source_id || `${tender.source}_${i}`;
        try {
          const categorization = await this.categorizeSingle(tender);
          results.set(tenderId, categorization);

          // Rate limiting
          await this.sleep(500); // 0.5 saniye bekle
        } catch (error) {
          console.error(`   ❌ ${tender.title.substring(0, 50)}... - Hata: ${error}`);
          results.set(tenderId, this.fallbackCategorization(tender));
        }
      }
    }

    const cateringCount = Array.from(results.values()).filter(r => r.is_catering).length;
    console.log(`\n✅ Kategorilendirme tamamlandı: ${cateringCount}/${tenders.length} catering`);

    return results;
  }

  /**
   * Kategorilendirme prompt'u oluştur
   */
  private buildCategorizationPrompt(tender: ScrapedTender): string {
    return `Sen bir kamu ihale kategorilendirme uzmanısın. Görevi sadece ihalenin catering/yemek hizmeti ile ilgili olup olmadığını tespit etmek.

# İHALE BİLGİLERİ
Başlık: ${tender.title}
Kurum: ${tender.organization || 'Belirtilmemiş'}
Kategori: ${tender.category || 'Belirtilmemiş'}

# CATERING/YEMEK İLE İLGİLİ ANAHTAR KELİMELER
Pozitif: yemek, öğün, kahvaltı, öğle, akşam, catering, iaşe, beslenme, gıda tedarik, kantin, yemekhane, kafeterya, hazır yemek, lokantacılık, servis hizmeti
Negatif: inşaat, yazılım, danışmanlık, temizlik (sadece), ulaşım, kırtasiye, mobilya

# GÖREV
Bu ihale catering/yemek hizmeti ile ilgili mi?

Değerlendirme kriterleri:
1. Başlıkta "yemek", "catering", "iaşe" gibi kelimeler var mı?
2. Kurum adı eğitim/sağlık/askeri ise (çok yemek tüketen) yüksek ihtimal
3. Kategori "Hazır Yemek" veya "Lokantacılık" ise kesin catering
4. Ama sadece "gıda alımı" (market ürünleri) catering DEĞİL

JSON formatında cevap ver:
{
  "is_catering": true/false,
  "confidence": 0.95,
  "reasoning": "Başlıkta 'yemek hizmeti alımı' geçiyor ve kurum bir hastane. Kesin catering ihalesi.",
  "keywords_found": ["yemek", "kahvaltı", "öğle"],
  "suggested_category": "Catering Hizmet Alımı"
}

SADECE JSON döndür, açıklama yazma!`;
  }

  /**
   * Fallback categorization (AI çalışmazsa basit keyword matching)
   */
  private fallbackCategorization(tender: ScrapedTender): AICategorization {
    const text = `${tender.title} ${tender.organization} ${tender.category}`.toLowerCase();

    // Catering keyword'leri
    const cateringKeywords = [
      'yemek', 'öğün', 'kahvaltı', 'öğle', 'akşam',
      'catering', 'iaşe', 'beslenme', 'gıda tedarik',
      'kantin', 'yemekhane', 'kafeterya', 'hazır yemek',
      'lokantacılık', 'servis hizmeti'
    ];

    // Exclude keyword'leri (yanlış pozitif önleme)
    const excludeKeywords = [
      'inşaat', 'yazılım', 'danışmanlık', 'ulaşım',
      'kırtasiye', 'mobilya', 'araç', 'makine'
    ];

    const foundKeywords = cateringKeywords.filter(kw => text.includes(kw));
    const foundExcludes = excludeKeywords.filter(kw => text.includes(kw));

    const is_catering = foundKeywords.length > 0 && foundExcludes.length === 0;
    const confidence = is_catering
      ? Math.min(0.7, 0.4 + (foundKeywords.length * 0.1))
      : 0.3;

    return {
      is_catering,
      confidence,
      reasoning: `Fallback keyword matching: ${foundKeywords.length} catering keyword, ${foundExcludes.length} exclude keyword`,
      keywords_found: foundKeywords,
      suggested_category: is_catering ? 'Catering Hizmet Alımı' : undefined,
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
