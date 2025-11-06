// ============================================================================
// CLAUDE HAIKU AI TENDER CATEGORIZER
// Gemini'den 6x hızlı - 50 req/min vs 8 req/min
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import type { ScrapedTender, AICategorization } from '../types';

export class ClaudeCategorizer {
  private client: Anthropic;
  private model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    this.client = new Anthropic({ apiKey });
    this.model = 'claude-3-5-haiku-20241022'; // Haiku - hızlı ve ucuz
    // TODO: 2025'te yeni Haiku modeli çıkarsa güncelle
  }

  /**
   * Tek bir ihaleyi kategorize et + veri temizle (Claude Haiku ile)
   */
  async categorizeSingle(tender: ScrapedTender, retryCount: number = 0): Promise<AICategorization> {
    const prompt = this.buildCategorizationAndCleaningPrompt(tender);
    const maxRetries = 3;

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const textContent = message.content[0];
      if (textContent.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const text = textContent.text;

      // JSON parse et
      let cleaned = text.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(cleaned) as AICategorization;

      console.log(`   🤖 Claude Haiku: ${parsed.is_catering ? '✅ Catering' : '❌ Değil'} (${Math.round(parsed.confidence * 100)}%)`);
      if (parsed.keywords_found.length > 0) {
        console.log(`      Anahtar kelimeler: ${parsed.keywords_found.join(', ')}`);
      }

      return parsed;
    } catch (error: any) {
      // Rate limit hatası kontrolü
      const isRateLimit = error?.status === 429 ||
                         error?.message?.includes('rate limit');

      if (isRateLimit && retryCount < maxRetries) {
        const retryDelay = 2000; // 2 saniye
        console.log(`   ⏳ Rate limit! ${retryDelay / 1000}s bekleniyor... (deneme ${retryCount + 1}/${maxRetries})`);
        await this.sleep(retryDelay);
        return this.categorizeSingle(tender, retryCount + 1);
      }

      console.error(`   ❌ Claude API hatası: ${error}`);
      throw error;
    }
  }

  /**
   * Birden fazla ihaleyi batch olarak kategorize et
   * Claude Haiku: 50 requests per minute (RPM) limit
   * Strateji: Dakikada max 40 request (güvenli marj), her request arası ~1.5 saniye
   */
  async categorizeBatch(tenders: ScrapedTender[], batchSize: number = 40): Promise<Map<string, AICategorization>> {
    const results = new Map<string, AICategorization>();
    const SAFE_REQUESTS_PER_MINUTE = 40; // 50'nin altında kal
    const DELAY_MS = (60 * 1000) / SAFE_REQUESTS_PER_MINUTE; // ~1500ms

    console.log(`🤖 Claude Haiku başlıyor: ${tenders.length} ihale, ${Math.round(DELAY_MS / 1000 * 10) / 10}s aralarla`);

    for (let i = 0; i < tenders.length; i++) {
      const tender = tenders[i];
      const tenderId = tender.source_id || `${tender.source}_${i}`;

      try {
        console.log(`   [${i + 1}/${tenders.length}] ${tender.title?.substring(0, 60)}...`);

        const result = await this.categorizeSingle(tender);
        results.set(tenderId, result);

        // Rate limit: Delay between requests
        if (i < tenders.length - 1) {
          await this.sleep(DELAY_MS);
        }
      } catch (error) {
        console.error(`   ❌ Error categorizing tender ${tenderId}:`, error);
        // Continue with next tender
      }
    }

    console.log(`✅ Claude Haiku tamamlandı: ${results.size}/${tenders.length} ihale kategorize edildi`);
    return results;
  }

  /**
   * Prompt builder - hem catering tespiti hem veri temizleme
   */
  private buildCategorizationAndCleaningPrompt(tender: ScrapedTender): string {
    return `İhale Verisi Analizi ve Temizleme:

**GÖREV 1: Catering İhale Tespiti**
Bu ihale yemek/catering ile ilgili mi? (yemek servisi, hazır yemek, kahvaltı, öğün, iaşe, catering, kantin, kafeterya, yemekhane)

**GÖREV 2: Veri Temizleme**
Şehir ve tarihleri temizle/düzelt.

**İHALE BİLGİLERİ:**
- Başlık: ${tender.title}
- Kurum: ${tender.organization || 'Belirtilmemiş'}
- Şehir (Ham): ${tender.organization_city || 'Belirtilmemiş'}
- Kategori: ${tender.category || 'Belirtilmemiş'}
- İlan Tarihi (Ham): ${tender.announcement_date || 'Belirtilmemiş'}
- Son Teklif (Ham): ${tender.deadline_date || 'Belirtilmemiş'}
- İhale Tarihi (Ham): ${tender.tender_date || 'Belirtilmemiş'}

**ÇIKTI FORMATI (JSON):**
\`\`\`json
{
  "is_catering": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "kısa açıklama",
  "keywords_found": ["bulunan", "anahtar", "kelimeler"],
  "cleaned_city": "Düzgün Şehir Adı" veya null,
  "cleaned_announcement_date": "YYYY-MM-DD" veya null,
  "cleaned_deadline_date": "YYYY-MM-DD" veya null,
  "cleaned_tender_date": "YYYY-MM-DD" veya null
}
\`\`\`

**ÖNEMLİ:**
- Sadece JSON döndür, başka metin yok
- Şehir adlarını düzelt (ör: "ANKARA" → "Ankara", "İSTANBUL" → "Istanbul")
- Tarihleri YYYY-MM-DD formatına çevir
- Tarih parse edilemiyorsa null döndür`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
