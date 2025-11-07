// ============================================================================
// GEMINI AI TENDER CATEGORIZER
// Claude yerine Gemini kullanır - 200x UCUZ! ($0.001 vs $0.20)
// ============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ScrapedTender, AICategorization } from '../types';

export class GeminiCategorizer {
  private genai: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    this.genai = new GoogleGenerativeAI(apiKey);
    this.model = this.genai.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
    });
  }

  /**
   * Tek bir ihaleyi kategorize et + veri temizle (Gemini ile) - Retry logic ile
   * ARTIK HEM catering tespiti HEM veri temizleme AYNI ANDA yapılıyor!
   */
  async categorizeSingle(tender: ScrapedTender, retryCount: number = 0): Promise<AICategorization> {
    const prompt = this.buildCategorizationAndCleaningPrompt(tender);
    const maxRetries = 3;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // 📊 TOKEN TRACKING - Store usage metadata
      if (response.usageMetadata) {
        const { promptTokenCount, candidatesTokenCount } = response.usageMetadata;

        // Import store dinamik olarak (server-side için)
        if (typeof window !== 'undefined') {
          import('@/lib/stores/token-store').then(({ useTokenStore }) => {
            useTokenStore.getState().addUsage({
              provider: 'gemini',
              model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
              operation: 'scraper-categorization',
              inputTokens: promptTokenCount,
              outputTokens: candidatesTokenCount,
            });
          });
        }
      }

      // JSON parse et
      let cleaned = text.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(cleaned) as AICategorization;

      console.log(`   🤖 Gemini: ${parsed.is_catering ? '✅ Catering' : '❌ Değil'} (${Math.round(parsed.confidence * 100)}%)`);
      if (parsed.keywords_found.length > 0) {
        console.log(`      Anahtar kelimeler: ${parsed.keywords_found.join(', ')}`);
      }

      return parsed;
    } catch (error: any) {
      // Rate limit hatası (429) kontrolü
      const isRateLimit = error?.message?.includes('429') ||
                         error?.message?.includes('quota') ||
                         error?.message?.includes('rate limit');

      if (isRateLimit && retryCount < maxRetries) {
        // Hata mesajından retry delay'i çıkar (genelde 15 saniye)
        const retryDelay = error?.message?.includes('retryDelay') ? 15000 : 15000;
        console.log(`   ⏳ Rate limit! ${retryDelay / 1000}s bekleniyor... (deneme ${retryCount + 1}/${maxRetries})`);
        await this.sleep(retryDelay);
        return this.categorizeSingle(tender, retryCount + 1);
      }

      console.error(`   ❌ Gemini API hatası: ${error}`);
      throw error;
    }
  }

  /**
   * Birden fazla ihaleyi batch olarak kategorize et
   * Gemini Free Tier: 10 requests per minute (RPM) limit
   * Strateji: Dakikada max 8 request (güvenli marj), her request arası 7.5 saniye
   */
  async categorizeBatch(tenders: ScrapedTender[], batchSize: number = 8): Promise<Map<string, AICategorization>> {
    const results = new Map<string, AICategorization>();
    const SAFE_REQUESTS_PER_MINUTE = 8; // 10'un altında kal
    const DELAY_BETWEEN_REQUESTS = Math.ceil(60000 / SAFE_REQUESTS_PER_MINUTE); // 7500ms = 7.5 saniye

    console.log(`\n🤖 Gemini Kategorilendirme başlıyor: ${tenders.length} ihale`);
    console.log(`   ⏱️  Rate limit: Dakikada ${SAFE_REQUESTS_PER_MINUTE} request, her biri arası ${DELAY_BETWEEN_REQUESTS / 1000}s`);
    console.log(`   ⏱️  Tahmini süre: ~${Math.ceil((tenders.length * DELAY_BETWEEN_REQUESTS) / 60000)} dakika\n`);

    // Her birini sırayla kategorize et (rate limit için)
    for (let i = 0; i < tenders.length; i++) {
      const tender = tenders[i];
      const tenderId = tender.source_id || `${tender.source}_${i}`;

      try {
        console.log(`   [${i + 1}/${tenders.length}] ${tender.title.substring(0, 60)}...`);
        const categorization = await this.categorizeSingle(tender);
        results.set(tenderId, categorization);

        // Son ihale değilse bekle
        if (i < tenders.length - 1) {
          console.log(`   ⏳ ${DELAY_BETWEEN_REQUESTS / 1000}s bekleniyor...`);
          await this.sleep(DELAY_BETWEEN_REQUESTS);
        }
      } catch (error) {
        console.error(`   ❌ ${tender.title.substring(0, 50)}... - Hata: ${error}`);
        // Hata durumunda da bekle (rate limit sıfırlanmasın)
        if (i < tenders.length - 1) {
          await this.sleep(DELAY_BETWEEN_REQUESTS);
        }
      }
    }

    const cateringCount = Array.from(results.values()).filter(r => r.is_catering).length;
    console.log(`\n✅ Gemini kategorilendirme tamamlandı: ${cateringCount}/${results.size} catering`);

    return results;
  }

  /**
   * İhale başlığını temizle ve düzenle (Gemini ile)
   */
  async cleanTitle(title: string): Promise<string> {
    const prompt = `Sen bir ihale başlığı düzenleme uzmanısın. Verilen başlığı temizle ve okunabilir hale getir.

# BAŞLIK
${title}

# GÖREV
Bu başlığı şu kurallara göre düzenle:

1. **Gereksiz Tekrarları Kaldır**: Aynı kelime/kavram birden fazla geçiyorsa birini at
2. **Büyük/Küçük Harf Düzelt**: "YEMEK HİZMETİ" → "Yemek Hizmeti"
3. **Gereksiz Bilgileri Kaldır**: Tarih, sayı, kod gibi önemsiz detaylar
4. **Kısa ve Net Yap**: En fazla 80 karakter, öz bilgi
5. **Türkçe Karakter Kullan**: İ, Ş, Ğ, Ü, Ö, Ç düzgün yazılmalı

ÖNEMLİ: SADECE düzeltilmiş başlığı döndür, başka hiçbir şey yazma!

Örnek:
Giriş: "2024 YILI PERSONEL YEMEK HİZMET ALIMI İHALESİ (Açık İhale Usulü)"
Çıkış: "Personel Yemek Hizmeti Alımı"`;

    try {
      const result = await this.model.generateContent(prompt);
      const cleaned = result.response.text().trim();

      // Eğer çok uzunsa veya hata varsa orijinali döndür
      if (cleaned.length > 100 || cleaned.length < 10) {
        return title;
      }

      return cleaned;
    } catch (error) {
      console.error('   ⚠️ Başlık temizleme hatası:', error);
      return title; // Hata durumunda orijinal başlığı kullan
    }
  }

  /**
   * 🆕 YENİ: Kategorilendirme + Veri Temizleme AYNI ANDA (TEK REQUEST!)
   * Hem catering tespiti hem şehir/tarih çıkarma - Maliyet yarıya düşer!
   */
  private buildCategorizationAndCleaningPrompt(tender: ScrapedTender): string {
    return `Sen bir kamu ihale uzmanısın. 2 görevi AYNI ANDA yapacaksın:
1) İhalenin catering/yemek hizmeti olup olmadığını tespit et
2) Karışık verileri temizle (şehir, tarihler)

# İHALE BİLGİLERİ
Başlık: ${tender.title}
Kurum: ${tender.organization || 'Belirtilmemiş'}
Kategori: ${tender.category || 'Belirtilmemiş'}
Şehir (karışık): ${tender.organization_city || 'Belirtilmemiş'}
Son tarih: ${tender.deadline_date || 'Belirtilmemiş'}
İlan tarihi: ${tender.announcement_date || 'Belirtilmemiş'}
İhale tarihi: ${tender.tender_date || 'Belirtilmemiş'}

# GÖREV 1: CATERING TESPİTİ
Pozitif kelimeler: yemek, öğün, kahvaltı, öğle, akşam, catering, iaşe, beslenme, gıda tedarik, kantin, yemekhane, kafeterya, hazır yemek, lokantacılık
Negatif kelimeler: inşaat, yazılım, danışmanlık, temizlik (sadece), ulaşım, kırtasiye, mobilya

Değerlendirme:
- Başlıkta pozitif kelimeler var mı?
- Kurum eğitim/sağlık/askeri ise yüksek ihtimal
- Kategori "Hazır Yemek" ise kesin catering
- Sadece "gıda alımı" (market ürünleri) catering DEĞİL

# GÖREV 2: VERİ TEMİZLEME
Şehir verisinden: SADECE şehir adını çıkar (örn: "İstanbul", "Ankara", "Mersin")
Tarihlerden: YYYY-MM-DD formatında çıkar (örn: "2025-03-15")
Bulamazsan: null yaz

JSON formatında cevap ver:
{
  "is_catering": true/false,
  "confidence": 0.95,
  "reasoning": "Başlıkta 'yemek hizmeti' geçiyor ve kurum hastane. Kesin catering.",
  "keywords_found": ["yemek", "kahvaltı"],
  "suggested_category": "Catering Hizmet Alımı",
  "cleaned_city": "Mersin",
  "cleaned_deadline_date": "2025-03-15",
  "cleaned_announcement_date": "2025-02-01",
  "cleaned_tender_date": "2025-03-10"
}

SADECE JSON döndür, açıklama yazma!`;
  }

  /**
   * 🧹 Karışık veriyi temizle (şehir, tarih çıkar)
   *
   * Örnek input: "MersinMersinTürkiye032423761073242311255..."
   * Örnek output: { city: "Mersin", deadline: "2025-03-15", ... }
   */
  async cleanMixedData(rawData: {
    organization_city?: string | null;
    deadline_date?: string | null;
    announcement_date?: string | null;
    tender_date?: string | null;
  }): Promise<{
    city: string | null;
    deadline_date: string | null;
    announcement_date: string | null;
    tender_date: string | null;
  }> {
    const prompt = `Sen bir veri temizleme uzmanısın. Verilen karışık verileri ayıkla ve temizle.

# KARIŞIK VERİ
Şehir verisi: "${rawData.organization_city || 'yok'}"
Son tarih: "${rawData.deadline_date || 'yok'}"
İlan tarihi: "${rawData.announcement_date || 'yok'}"
İhale tarihi: "${rawData.tender_date || 'yok'}"

# GÖREV
Bu karışık verilerden şunları çıkar:

1. **Şehir**: Türkiye'de bir şehir adı varsa çıkar (sadece şehir adı, numaralar/adresler olmadan)
2. **Son Tarih**: deadline_date içinde tarih formatı (YYYY-MM-DD) varsa çıkar
3. **İlan Tarihi**: announcement_date içinde tarih formatı varsa çıkar
4. **İhale Tarihi**: tender_date içinde tarih formatı varsa çıkar

Kurallar:
- Şehir: SADECE şehir adı (örn: "İstanbul", "Ankara", "Mersin")
- Tarihler: YYYY-MM-DD formatında (örn: "2025-03-15")
- Bulamazsan "null" döndür
- Emin değilsen "null" döndür

JSON formatında cevap ver:
{
  "city": "Mersin",
  "deadline_date": "2025-03-15",
  "announcement_date": "2025-02-01",
  "tender_date": "2025-03-10"
}

SADECE JSON döndür, açıklama yazma!`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();

      // JSON parse et
      let cleaned = text;
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(cleaned);

      return {
        city: parsed.city === "null" || parsed.city === null ? null : parsed.city,
        deadline_date: parsed.deadline_date === "null" || parsed.deadline_date === null ? null : parsed.deadline_date,
        announcement_date: parsed.announcement_date === "null" || parsed.announcement_date === null ? null : parsed.announcement_date,
        tender_date: parsed.tender_date === "null" || parsed.tender_date === null ? null : parsed.tender_date,
      };
    } catch (error) {
      console.error('   ⚠️ Veri temizleme hatası:', error);
      return {
        city: null,
        deadline_date: null,
        announcement_date: null,
        tender_date: null,
      };
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}