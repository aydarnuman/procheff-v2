// ============================================================================
// ON-DEMAND AI ANALYZER
// Kullanıcının seçtiği ihaleleri tam detaylı analiz eder
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import { ItemParser } from '../parsers/item-parser';

interface AnalysisResult {
  success: boolean;
  data?: {
    // Temel bilgiler
    title?: string;
    organization?: string;
    organization_city?: string;
    budget?: number;
    currency?: string;

    // Tarihler
    announcement_date?: string;
    tender_date?: string;
    deadline_date?: string;

    // İhale detayları
    tender_type?: string;
    procurement_type?: string;
    category?: string;

    // Kategorilendirme
    is_catering: boolean;
    catering_confidence: number;
    ai_reasoning?: string;

    // Dökümanlar
    specification_url?: string;
    announcement_text?: string;
    documents?: Array<{
      title: string;
      url: string;
      type: 'idari_sartname' | 'teknik_sartname' | 'ek_dosya' | 'diger';
    }>;

    // Mal/Hizmet listesi
    total_items?: number;
    total_meal_quantity?: number;
    estimated_budget_from_items?: number;

    // Raw data
    raw_json?: any;
  };
  error?: string;
  details?: string;
  duration_ms?: number;
  ai_model?: string;
}

export class OnDemandAnalyzer {
  private claude: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in environment');
    }
    this.claude = new Anthropic({ apiKey });
  }

  /**
   * Tek bir ihale sayfasını TAM DETAYLI analiz eder
   */
  async analyzeFullPage(url: string): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      console.log(`\n🌐 Fetching page: ${url}`);

      // ============================================================
      // 1. Sayfayı fetch et
      // ============================================================
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}`,
          details: response.statusText,
        };
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      console.log(`✅ Page fetched (${(html.length / 1024).toFixed(1)} KB)`);

      // ============================================================
      // 2. Temel bilgileri parse et (basit cheerio ile)
      // ============================================================
      const basicInfo = this.extractBasicInfo($, url);

      // ============================================================
      // 3. Mal/Hizmet listesini parse et
      // ============================================================
      const items = ItemParser.parseItemTable($);
      const itemStats = ItemParser.getItemStats(items);

      // ============================================================
      // 4. İlan metnini çıkart
      // ============================================================
      const announcementText = this.extractAnnouncementText($);

      // ============================================================
      // 5. TÜM DÖKÜMANLAR VE ŞARTNAMELERİ BUL
      // ============================================================
      const documents = this.extractAllDocuments($, url);
      const specificationUrl = documents.find(d => d.type === 'idari_sartname')?.url || documents[0]?.url;

      // ============================================================
      // 6. AI ile EKSİK BİLGİLERİ TAMAMLA + KATEGORİLENDİR
      // ============================================================
      console.log(`\n🤖 Claude AI analizi başlıyor...`);

      const aiAnalysis = await this.analyzeWithClaude(html, basicInfo, {
        items,
        itemStats,
        announcementText,
      });

      const duration_ms = Date.now() - startTime;

      console.log(`✅ AI analizi tamamlandı (${(duration_ms / 1000).toFixed(1)}s)`);

      // ============================================================
      // 7. Sonuçları birleştir
      // ============================================================
      return {
        success: true,
        data: {
          // Temel bilgiler (cheerio + AI)
          title: basicInfo.title,
          organization: basicInfo.organization,
          organization_city: aiAnalysis.cleaned_city || basicInfo.organization_city,
          budget: aiAnalysis.budget || basicInfo.budget,
          currency: 'TRY',

          // Tarihler (AI temizlenmiş)
          announcement_date: aiAnalysis.announcement_date,
          tender_date: aiAnalysis.tender_date,
          deadline_date: aiAnalysis.deadline_date,

          // İhale detayları (AI)
          tender_type: aiAnalysis.tender_type,
          procurement_type: aiAnalysis.procurement_type,
          category: aiAnalysis.category,

          // Kategorilendirme (AI)
          is_catering: aiAnalysis.is_catering,
          catering_confidence: aiAnalysis.confidence,
          ai_reasoning: aiAnalysis.reasoning,

          // Dökümanlar
          specification_url: specificationUrl,
          announcement_text: announcementText,
          documents: documents, // 🆕 Tüm dökümanlar

          // Mal/Hizmet listesi
          total_items: itemStats.totalItems,
          total_meal_quantity: itemStats.totalMeals,
          estimated_budget_from_items: itemStats.estimatedBudget,

          // Raw data
          raw_json: items.length > 0 ? { items } : undefined,
        },
        duration_ms,
        ai_model: 'claude-3-haiku-20240307',
      };

    } catch (error: any) {
      console.error('❌ Analysis error:', error);
      return {
        success: false,
        error: error.message || 'Bilinmeyen hata',
        details: error.stack,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Temel bilgileri HTML'den çıkar (hızlı cheerio)
   */
  private extractBasicInfo($: cheerio.CheerioAPI, url: string) {
    const cleanText = (text: string) => text.trim().replace(/\s+/g, ' ');

    const title = cleanText(
      $('.card-body:contains("İhale başlığı:") span').text() ||
      $('a.details[href*="/tender/"]').first().text()
    );

    const organization = cleanText(
      $('.card-body:contains("İdare adı:") span').text() ||
      $('b:contains("İdare adı:")').parent().find('span').text()
    );

    const cityFromIcon = cleanText(
      $('.text-dark-emphasis.fw-medium:has(iconify-icon[icon="fa6-solid:sign-hanging"])').text().replace('icon', '').trim()
    );

    const budgetText = cleanText(
      $('.card-body:contains("Tahmini bedel") span').text() ||
      $('.card-body:contains("Sözleşme bedeli") span').text()
    );

    return {
      title: title || 'Belirtilmemiş',
      organization: organization || 'Belirtilmemiş',
      organization_city: cityFromIcon || undefined,
      budget: this.parseBudget(budgetText),
    };
  }

  /**
   * İlan metnini çıkart
   */
  private extractAnnouncementText($: cheerio.CheerioAPI): string | undefined {
    const selectors = [
      '.tender-content',
      '.description',
      '.tender-description',
      'div[class*="content"]',
    ];

    for (const selector of selectors) {
      const text = $(selector).first().text().trim();
      if (text && text.length > 50) {
        return text;
      }
    }

    return undefined;
  }

  /**
   * 🆕 TÜM dökümanları bul (şartname, ek dosyalar, vb.)
   */
  private extractAllDocuments($: cheerio.CheerioAPI, pageUrl: string): Array<{
    title: string;
    url: string;
    type: 'idari_sartname' | 'teknik_sartname' | 'ek_dosya' | 'diger';
  }> {
    const documents: Array<{
      title: string;
      url: string;
      type: 'idari_sartname' | 'teknik_sartname' | 'ek_dosya' | 'diger';
    }> = [];

    // İhalebul'da döküman linkleri genelde şu selectorlerde:
    // 1. a.details (şartname linkleri)
    // 2. a[href*="/tender/"][href*="/download"] (indirme linkleri)
    // 3. a[href$=".pdf"], a[href$=".doc"], a[href$=".zip"] (dosya linkleri)

    // İdari Şartname (en önemli)
    $('a.details:contains("İdari Şartname"), a:contains("İdari Şartname")').each((i, el) => {
      const href = $(el).attr('href');
      const title = $(el).text().trim() || 'İdari Şartname';
      if (href) {
        documents.push({
          title,
          url: href.startsWith('http') ? href : new URL(href, pageUrl).href,
          type: 'idari_sartname',
        });
      }
    });

    // Teknik Şartname
    $('a.details:contains("Teknik Şartname"), a:contains("Teknik Şartname")').each((i, el) => {
      const href = $(el).attr('href');
      const title = $(el).text().trim() || 'Teknik Şartname';
      if (href) {
        documents.push({
          title,
          url: href.startsWith('http') ? href : new URL(href, pageUrl).href,
          type: 'teknik_sartname',
        });
      }
    });

    // Ek Dosyalar (PDF, DOC, ZIP, vb.)
    $('a[href$=".pdf"], a[href$=".doc"], a[href$=".docx"], a[href$=".zip"], a[href$=".rar"], a[href$=".xlsx"], a[href$=".xls"]').each((i, el) => {
      const href = $(el).attr('href');
      let title = $(el).text().trim();

      // Eğer title boşsa veya sadece ikon içeriyorsa, href'ten çıkar
      if (!title || title.length < 3) {
        const urlParts = href?.split('/') || [];
        title = urlParts[urlParts.length - 1] || 'Ek Dosya';
      }

      if (href && !documents.some(d => d.url === href)) {
        documents.push({
          title,
          url: href.startsWith('http') ? href : new URL(href, pageUrl).href,
          type: 'ek_dosya',
        });
      }
    });

    // İndirme linkleri (download kelimesi içeren)
    $('a[href*="download"], a:contains("İndir"), a:contains("Download")').each((i, el) => {
      const href = $(el).attr('href');
      const title = $(el).text().trim() || 'Döküman';

      if (href && !documents.some(d => d.url === href)) {
        documents.push({
          title,
          url: href.startsWith('http') ? href : new URL(href, pageUrl).href,
          type: 'diger',
        });
      }
    });

    // Şartname kelimesi geçen diğer linkler
    $('a:contains("Şartname"), a:contains("şartname")').each((i, el) => {
      const href = $(el).attr('href');
      const title = $(el).text().trim();

      if (href && !documents.some(d => d.url === href) && title.length > 3) {
        documents.push({
          title,
          url: href.startsWith('http') ? href : new URL(href, pageUrl).href,
          type: 'diger',
        });
      }
    });

    console.log(`📎 ${documents.length} döküman bulundu`);
    documents.forEach(d => console.log(`   - ${d.type}: ${d.title}`));

    return documents;
  }

  /**
   * Şartname URL'ini bul (deprecated - extractAllDocuments kullan)
   */
  private extractSpecificationUrl($: cheerio.CheerioAPI, pageUrl: string): string | undefined {
    // İdari Şartname (öncelikli)
    const idariLink = $('a.details:contains("İdari Şartname")').attr('href');
    if (idariLink) {
      return idariLink.startsWith('http') ? idariLink : new URL(idariLink, pageUrl).href;
    }

    // Teknik Şartname
    const teknikLink = $('a.details:contains("Teknik Şartname")').attr('href');
    if (teknikLink) {
      return teknikLink.startsWith('http') ? teknikLink : new URL(teknikLink, pageUrl).href;
    }

    return undefined;
  }

  /**
   * Bütçe parse
   */
  private parseBudget(text: string): number | undefined {
    if (!text) return undefined;

    // "1.500.000,00 TRY" -> 1500000
    const cleaned = text.replace(/[^\d,]/g, '').replace(',', '.');
    const number = parseFloat(cleaned);

    return isNaN(number) ? undefined : number;
  }

  /**
   * Claude AI ile eksik bilgileri tamamla + kategorilendirme
   */
  private async analyzeWithClaude(
    html: string,
    basicInfo: any,
    context: {
      items: any[];
      itemStats: any;
      announcementText?: string;
    }
  ): Promise<{
    is_catering: boolean;
    confidence: number;
    reasoning: string;
    budget?: number;
    announcement_date?: string;
    tender_date?: string;
    deadline_date?: string;
    tender_type?: string;
    procurement_type?: string;
    category?: string;
    cleaned_city?: string;
  }> {
    try {
      // HTML'i temizle (sadece text content, max 100KB)
      const $ = cheerio.load(html);
      $('script, style, nav, footer').remove();
      const cleanHtml = $.text().substring(0, 100000);

      const prompt = `Sen bir ihale analiz uzmanısın. Aşağıdaki ihale sayfasını analiz et ve eksik bilgileri tamamla.

TEMEL BİLGİLER:
- Başlık: ${basicInfo.title}
- Kurum: ${basicInfo.organization}
- Şehir: ${basicInfo.organization_city || 'Eksik'}
- Bütçe: ${basicInfo.budget || 'Eksik'}

MAL/HİZMET LİSTESİ:
- Toplam kalem: ${context.itemStats.totalItems}
- Toplam öğün: ${context.itemStats.totalMeals}
- Tahmini bütçe: ${context.itemStats.estimatedBudget}

İLAN METNİ BAŞLANGIÇ:
${context.announcementText?.substring(0, 500) || 'Yok'}

SAYFA İÇERİĞİ:
${cleanHtml}

GÖREV:
1. Bu ihale catering/yemek hizmeti ile ilgili mi? (is_catering: true/false)
2. Emin olma derecen nedir? (confidence: 0-1 arası)
3. Eksik bilgileri tamamla:
   - Bütçe (budget)
   - İlan tarihi (announcement_date)
   - İhale tarihi (tender_date)
   - Son teklif tarihi (deadline_date)
   - İhale türü (tender_type: "Açık İhale", "Belli İstekliler", vb.)
   - Alım türü (procurement_type: "Hizmet Alımı", "Mal Alımı")
   - Kategori (category: "Yemek Hizmeti", "Gıda Alımı", vb.)
   - Şehir (city: tam şehir adı)

CEVAP FORMATI (sadece JSON, başka text yok):
{
  "is_catering": true,
  "confidence": 0.95,
  "reasoning": "Yemek hizmeti alımı, 150000 öğün",
  "budget": 1500000,
  "announcement_date": "2025-01-04",
  "tender_date": "2025-02-15",
  "deadline_date": "2025-02-10",
  "tender_type": "Açık İhale",
  "procurement_type": "Hizmet Alımı",
  "category": "Yemek Hizmeti - Okul",
  "cleaned_city": "Ankara"
}`;

      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307', // En hızlı ve ucuz model
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      // JSON parse et
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const result = JSON.parse(jsonMatch[0]);

      return {
        is_catering: result.is_catering || false,
        confidence: result.confidence || 0.5,
        reasoning: result.reasoning || 'AI analizi',
        budget: result.budget,
        announcement_date: result.announcement_date,
        tender_date: result.tender_date,
        deadline_date: result.deadline_date,
        tender_type: result.tender_type,
        procurement_type: result.procurement_type,
        category: result.category,
        cleaned_city: result.cleaned_city,
      };

    } catch (error: any) {
      console.error('❌ Claude analysis error:', error);
      // Hata durumunda basit keyword analizi yap
      return this.fallbackKeywordAnalysis(html, basicInfo);
    }
  }

  /**
   * AI başarısız olursa fallback keyword analizi
   */
  private fallbackKeywordAnalysis(html: string, basicInfo: any) {
    const text = html.toLowerCase();
    const cateringKeywords = ['yemek', 'öğün', 'kahvaltı', 'catering', 'iaşe', 'beslenme'];
    const foundKeywords = cateringKeywords.filter(kw => text.includes(kw));

    return {
      is_catering: foundKeywords.length > 0,
      confidence: foundKeywords.length > 0 ? 0.7 : 0.3,
      reasoning: `Keyword analizi (fallback): ${foundKeywords.join(', ')}`,
    };
  }
}
