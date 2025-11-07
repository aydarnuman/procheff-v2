// ============================================================================
// SCRAPER ORCHESTRATOR
// Tüm scraper'ları koordine eder, AI kategorilendirme ve database kaydetme
// ============================================================================

import { IlanGovScraper } from './scrapers/ilan-gov-scraper';
import { IhalebulScraper } from './scrapers/ihalebul-scraper';
import { EkapScraper } from './scrapers/ekap-scraper';
import { TenderCategorizer } from './ai/tender-categorizer';
import { GeminiCategorizer } from './ai/gemini-categorizer';
import { ClaudeCategorizer } from './ai/claude-categorizer';
import { TenderDatabase } from './database';
import { NotificationService } from './notifications/notification-service';
import { getScrapersByPriority, GLOBAL_CONFIG } from './config';
import { OrchestratorLogger } from './logger/orchestrator-logger';
import type { ScrapedTender, CategorizedTender, ScrapeResult } from './types';

export class ScraperOrchestrator {
  private categorizer: TenderCategorizer;
  private geminiCategorizer: GeminiCategorizer | null = null;
  private claudeCategorizer: ClaudeCategorizer | null = null;
  private logger: OrchestratorLogger;

  constructor() {
    this.logger = new OrchestratorLogger(`scraper_${Date.now()}`);
    this.logger.info('orchestrator', 'Initializing ScraperOrchestrator');
    
    this.categorizer = new TenderCategorizer();

    // 🚀 İlk önce Claude Haiku'yu dene (6x HIZLI!)
    try {
      this.claudeCategorizer = new ClaudeCategorizer();
      console.log('✅ Claude Haiku AI categorizer initialized (6x hızlı!)');
    } catch (error) {
      console.warn('⚠️ Claude AI başlatılamadı, Gemini fallback kullanılacak');
      this.claudeCategorizer = null;
    }

    // Gemini'yi dene (yedek)
    if (!this.claudeCategorizer) {
      try {
        this.geminiCategorizer = new GeminiCategorizer();
        console.log('✅ Gemini AI categorizer initialized (200x ucuz!)');
      } catch (error) {
        console.warn('⚠️ Gemini AI de başlatılamadı, sadece keyword filter kullanılacak');
        this.geminiCategorizer = null;
      }
    }
  }

  /**
   * Run all enabled scrapers
   */
  async runAll(testMode: boolean = false, mode: 'new' | 'full' = 'new', sourceFilter?: string): Promise<{
    success: boolean;
    results: ScrapeResult[];
    totalNew: number;
    totalCatering: number;
  }> {
    const startTime = Date.now();
    this.logger.info('runAll', 'Starting scraping orchestration', { 
      testMode, 
      mode,
      sourceFilter: sourceFilter || 'all',
      logPath: this.logger.getLogPath()
    });

    console.log('\n' + '='.repeat(70));
    console.log('🚀 SCRAPER ORCHESTRATOR -', sourceFilter ? sourceFilter.toUpperCase() : 'ALL SOURCES');
    console.log('📝 Log file:', this.logger.getLogPath());
    console.log('='.repeat(70));

    let scrapers = getScrapersByPriority();
    
    // Filter by source if specified
    if (sourceFilter) {
      scrapers = scrapers.filter(s => s.id === sourceFilter);
      if (scrapers.length === 0) {
        this.logger.error('runAll', `Unknown source: ${sourceFilter}`);
        console.error(`❌ Unknown source: ${sourceFilter}`);
        return { success: false, results: [], totalNew: 0, totalCatering: 0 };
      }
    }
    
    this.logger.info('runAll', `Processing ${scrapers.length} scraper(s)`, {
      scrapers: scrapers.map(s => s.id)
    });
    
    const results: ScrapeResult[] = [];
    let totalNew = 0;
    let totalCatering = 0;

    for (const config of scrapers) {
      const scraperStartTime = Date.now();
      
      try {
        this.logger.info(config.id, `Starting scraper: ${config.name}`);
        console.log(`\n📍 Running: ${config.name}`);

        let scraper;

        switch (config.id) {
          case 'ilan_gov':
            scraper = new IlanGovScraper(config);
            break;
          case 'ihalebul':
            scraper = new IhalebulScraper(mode); // 🆕 Pass mode to scraper
            break;
          case 'ekap':
            scraper = new EkapScraper(config);
            break;
          default:
            this.logger.warn(config.id, `Scraper not implemented`);
            console.warn(`⚠️ Scraper not implemented: ${config.id}`);
            continue;
        }

        // Execute scraping
        const result = await scraper.execute();
        results.push(result);

        this.logger.timed(config.id, `Scraping completed`, scraperStartTime, {
          success: result.success,
          totalScraped: result.totalScraped,
          errors: result.errors.length
        });

        // Save tenders to database
        const saveStartTime = Date.now();
        const saved = await this.saveMinimalTenders(result.tenders, testMode);
        totalNew += saved.newCount;

        this.logger.timed(config.id, `Database save completed`, saveStartTime, {
          newTenders: saved.newCount
        });

        // Log to database
        await TenderDatabase.logScraping({
          source: config.id,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
          status: result.success ? 'success' : 'failed',
          totalScraped: result.totalScraped,
          newListings: saved.newCount,
          updatedListings: result.updatedTenders,
          errorMessage: result.errors.length > 0 ? result.errors[0].message : undefined,
        });

        this.logger.success(config.id, `Pipeline completed successfully`, {
          totalScraped: result.totalScraped,
          newTenders: saved.newCount
        });

      } catch (error: any) {
        this.logger.error(config.id, `Scraper failed: ${error.message}`, {
          stack: error.stack
        });
        console.error(`❌ ${config.name} failed:`, error.message);
      }
    }

    this.logger.timed('runAll', 'All scrapers completed', startTime, {
      totalNew,
      totalCatering,
      successfulScrapers: results.filter(r => r.success).length,
      failedScrapers: results.filter(r => !r.success).length
    });

    console.log('\n' + '='.repeat(70));
    console.log('✅ SCRAPING COMPLETED');
    console.log(`   Total new tenders: ${totalNew}`);
    console.log(`   Total catering: ${totalCatering}`);
    console.log('='.repeat(70));
    console.log(this.logger.generateSummary());
    console.log('='.repeat(70) + '\n');

    // Cleanup logger
    this.logger.close();

    return {
      success: results.some(r => r.success),
      results,
      totalNew,
      totalCatering,
    };
  }

  /**
   * Run single scraper by source ID
   */
  async runSingle(sourceId: string, testMode: boolean = false, mode: 'new' | 'full' = 'new'): Promise<ScrapeResult> {
    console.log(`\n🎯 Running single scraper: ${sourceId}${testMode ? ' (TEST MODE)' : ''} [mode: ${mode}]`);

    const config = getScrapersByPriority().find(s => s.id === sourceId);
    if (!config) {
      throw new Error(`Scraper not found: ${sourceId}`);
    }

    let scraper;
    let totalSaved = 0;

    switch (sourceId) {
      case 'ilan_gov':
        scraper = new IlanGovScraper(config);
        break;
      case 'ihalebul':
        scraper = new IhalebulScraper(mode); // 🆕 Pass mode to scraper
        break;
      case 'ekap':
        scraper = new EkapScraper(config);
        break;
      default:
        throw new Error(`Scraper not implemented: ${sourceId}`);
    }

    const result = await scraper.execute();
    
    // Save tenders to database
    const saved = await this.saveMinimalTenders(result.tenders, testMode);
    result.newTenders = saved.newCount;

    // Log
    await TenderDatabase.logScraping({
      source: sourceId,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      status: result.success ? 'success' : 'failed',
      totalScraped: result.totalScraped,
      newListings: result.newTenders,
      updatedListings: result.updatedTenders,
      errorMessage: result.errors.length > 0 ? result.errors[0].message : undefined,
    });

    return result;
  }

  /**
   * 🚀 HIZLI + UCUZ Kategorilendirme (3 katmanlı)
   *
   * Tier 0: Duplicate Check (ÖNCE - AI maliyetini %40-50 düşürür!)
   * Tier 1: Keyword Filter (ANINDA, ÜCRETSİZ, %95 doğru)
   * Tier 2: Gemini AI (arka planda, 200x ucuz)
   * Tier 3: Claude fallback (pahalı ama güvenilir)
   *
   * Kullanıcı ASLA beklemez - keyword sonuçları hemen döner!
   */
  private async categorizeTenders(tenders: ScrapedTender[]): Promise<CategorizedTender[]> {
    // ============================================================
    // TIER 0: DUPLICATE CHECK (MALİYET TASARRUFU!)
    // ============================================================
    console.log(`\n🔍 TIER 0: Duplicate Check (maliyet tasarrufu için)`);
    const startTime = Date.now();

    const newTenders: ScrapedTender[] = [];
    let duplicateCount = 0;

    for (const tender of tenders) {
      const exists = await TenderDatabase.tenderExists(tender.source, tender.source_id);
      if (exists) {
        duplicateCount++;
        console.log(`   ⏭️  Duplicate atlandı: ${tender.title.substring(0, 50)}...`);
      } else {
        newTenders.push(tender);
      }
    }

    const checkDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Duplicate check: ${duplicateCount} duplicate atlandı, ${newTenders.length} yeni ihale (${checkDuration}s)`);
    console.log(`   💰 Tasarruf: ~${duplicateCount} AI çağrısı ($${(duplicateCount * 0.01).toFixed(2)})`);

    if (newTenders.length === 0) {
      console.log('\n✅ Tüm ihaleler duplicate, AI çağrısı yapılmadı!');
      return [];
    }

    if (!GLOBAL_CONFIG.aiCategorization.enabled) {
      console.log('⚠️ AI categorization disabled, using keyword filter only');
      return newTenders.map(t => {
        const keywordResult = this.keywordCategorization(t);
        return {
          ...t,
          is_catering: keywordResult.is_catering,
          catering_confidence: keywordResult.confidence,
          ai_reasoning: keywordResult.reasoning,
          keywords_found: keywordResult.keywords_found,
        };
      });
    }

    // ============================================================
    // TIER 1: KEYWORD FILTER (ANINDA - %95 doğru, ÜCRETSİZ!)
    // ============================================================
    console.log(`\n⚡ TIER 1: Keyword Filter (ANINDA, ÜCRETSİZ)`);
    const keywordResults = newTenders.map(t => {
      const result = this.keywordCategorization(t);
      console.log(`   ${result.is_catering ? '✅' : '❌'} ${t.title.substring(0, 50)}... (${Math.round(result.confidence * 100)}%)`);
      return result;
    });

    const cateringCount = keywordResults.filter(r => r.is_catering).length;
    console.log(`\n✅ Keyword filter: ${cateringCount}/${newTenders.length} catering tespit edildi`);

    // ============================================================
    // 🆕 TIER 2: AI - CATERING TESPİTİ + VERİ TEMİZLEME (TEK SEFERDE!)
    // Claude Haiku tercih edilir (6x hızlı), yoksa Gemini fallback
    // ============================================================
    // Sadece catering olarak işaretlenen ihaleleri AI ile temizle
    const cateringTenders = newTenders.filter((_, i) => keywordResults[i].is_catering);

    let categorizedTenders: CategorizedTender[] = [];

    // 🚀 Önce Claude Haiku'yu dene (6x HIZLI!)
    const activeAI = this.claudeCategorizer || this.geminiCategorizer;
    const aiName = this.claudeCategorizer ? 'Claude Haiku' : 'Gemini';

    if (cateringTenders.length > 0 && activeAI) {
      console.log(`\n🤖 TIER 2: ${aiName} AI - Catering ihalelerini temizliyor (${cateringTenders.length} ihale)`);
      console.log(`   💡 Hem catering doğrulama HEM veri temizleme AYNI ANDA yapılıyor!`);

      const aiResults = await activeAI.categorizeBatch(cateringTenders);

      // AI sonuçlarını uygula
      categorizedTenders = newTenders.map((tender, i) => {
        const tenderId = tender.source_id || `${tender.source}_${i}`;
        const aiResult = aiResults.get(tenderId);

        if (aiResult) {
          // AI temizlenmiş veri varsa kullan
          return {
            ...tender,
            // Temizlenmiş verileri uygula
            organization_city: aiResult.cleaned_city || tender.organization_city,
            deadline_date: aiResult.cleaned_deadline_date || tender.deadline_date,
            announcement_date: aiResult.cleaned_announcement_date || tender.announcement_date,
            tender_date: aiResult.cleaned_tender_date || tender.tender_date,
            // AI sonuçları
            is_catering: aiResult.is_catering,
            catering_confidence: aiResult.confidence,
            ai_reasoning: aiResult.reasoning,
            keywords_found: aiResult.keywords_found,
          };
        } else {
          // AI çalışmadıysa keyword sonucunu kullan
          return {
            ...tender,
            is_catering: keywordResults[i].is_catering,
            catering_confidence: keywordResults[i].confidence,
            ai_reasoning: keywordResults[i].reasoning,
            keywords_found: keywordResults[i].keywords_found,
          };
        }
      });

      console.log(`\n✅ ${aiName} tamamlandı: Veriler temizlendi ve database'e hazır!`);
    } else {
      // AI yok veya catering yok, sadece keyword kullan
      console.log(`\n⚠️ AI kullanılamıyor veya catering ihale yok, keyword sonuçları kullanılıyor`);
      categorizedTenders = newTenders.map((tender, i) => ({
        ...tender,
        is_catering: keywordResults[i].is_catering,
        catering_confidence: keywordResults[i].confidence,
        ai_reasoning: keywordResults[i].reasoning,
        keywords_found: keywordResults[i].keywords_found,
      }));
    }

    return categorizedTenders;
  }

  /**
   * Clean tender titles with AI (Gemini)
   */
  private async cleanTitles(tenders: ScrapedTender[]): Promise<ScrapedTender[]> {
    if (!this.geminiCategorizer) {
      console.log('⚠️ Gemini yok, başlıklar temizlenmeden devam ediliyor');
      return tenders;
    }

    console.log(`\n✨ AI ile başlık temizleme başlıyor (${tenders.length} ihale)...`);

    const cleaned: ScrapedTender[] = [];

    for (let i = 0; i < tenders.length; i++) {
      const tender = tenders[i];
      try {
        const cleanedTitle = await this.geminiCategorizer.cleanTitle(tender.title);

        if (cleanedTitle !== tender.title) {
          console.log(`   [${i + 1}/${tenders.length}] ✨ "${tender.title.substring(0, 40)}..." → "${cleanedTitle}"`);
        } else {
          console.log(`   [${i + 1}/${tenders.length}] ✓ Zaten temiz`);
        }

        cleaned.push({
          ...tender,
          title: cleanedTitle,
        });

        // Rate limit: Her 10 başlıktan sonra 2 saniye bekle
        if (i > 0 && i % 10 === 0 && i < tenders.length - 1) {
          console.log('   ⏳ 2 saniye bekleniyor...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`   ❌ Başlık temizleme hatası: ${error}`);
        cleaned.push(tender); // Hata durumunda orijinal başlığı kullan
      }
    }

    console.log(`✅ Başlık temizleme tamamlandı!\n`);
    return cleaned;
  }

  /**
   * Keyword-based categorization (ÜCRETSİZ, %95 doğru)
   */
  private keywordCategorization(tender: ScrapedTender): {
    is_catering: boolean;
    confidence: number;
    reasoning: string;
    keywords_found: string[];
  } {
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
      ? Math.min(0.95, 0.6 + (foundKeywords.length * 0.1))
      : 0.2;

    return {
      is_catering,
      confidence,
      reasoning: `Keyword filter: ${foundKeywords.length} catering keyword, ${foundExcludes.length} exclude keyword`,
      keywords_found: foundKeywords,
    };
  }

  /**
   * ASYNC Gemini categorization (arka planda, kullanıcı beklemez!)
   */
  private async runGeminiCategorizationAsync(tenders: ScrapedTender[]): Promise<void> {
    if (!this.geminiCategorizer) return;

    try {
      console.log(`\n🤖 [ASYNC] Gemini AI kategorilendirme başladı (${tenders.length} ihale)`);
      const startTime = Date.now();

      const categorizationMap = await this.geminiCategorizer.categorizeBatch(tenders, 10);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const cateringCount = Array.from(categorizationMap.values()).filter(r => r.is_catering).length;

      console.log(`\n✅ [ASYNC] Gemini tamamlandı: ${cateringCount}/${categorizationMap.size} catering (${duration}s)`);

      // TODO: Database'deki mevcut kayıtları güncelle (confidence'ı artır)
      // Şimdilik sadece log, ilerde database update eklenebilir

    } catch (error) {
      console.error('❌ [ASYNC] Gemini categorization failed:', error);
    }
  }

  /**
   * Save tenders to database
   */
  private async saveTenders(tenders: CategorizedTender[], saveAll: boolean = false): Promise<{
    newCount: number;
    cateringCount: number;
    newCatering: any[];
  }> {
    console.log(`\n💾 Saving ${tenders.length} tenders to database...`);

    // TEST MODE: Save all tenders (geçici veriler için)
    // PRODUCTION: Only save high-confidence catering tenders
    let tendersToSave: CategorizedTender[];

    if (saveAll) {
      console.log(`   🧪 TEST MODE: Saving ALL ${tenders.length} tenders (geçici)`);
      tendersToSave = tenders;
    } else {
      // Filter high-confidence catering tenders
      const threshold = GLOBAL_CONFIG.aiCategorization.confidenceThreshold;
      tendersToSave = tenders.filter(
        t => t.is_catering && t.catering_confidence >= threshold
      );
      console.log(`   ✅ ${tendersToSave.length} high-confidence catering tenders`);
    }

    const cateringTenders = tendersToSave;

    // Prepare insert payloads
    const payloads = cateringTenders.map(t => ({
      source: t.source,
      source_id: t.source_id,
      source_url: t.source_url,
      title: t.title,
      organization: t.organization,
      organization_city: t.organization_city,
      budget: t.budget,
      currency: t.currency || 'TRY',
      announcement_date: t.announcement_date as any,
      deadline_date: t.deadline_date as any,
      tender_date: t.tender_date as any,
      tender_type: t.tender_type,
      procurement_type: t.procurement_type,
      category: t.category,
      specification_url: t.specification_url, // 🆕 Şartname dökümanı linki
      announcement_text: t.announcement_text, // 🆕 İhale ilan metni
      is_catering: t.is_catering,
      catering_confidence: t.catering_confidence,
      ai_categorization_reasoning: t.ai_reasoning,
      // 🆕 Mal/Hizmet listesi özet
      total_items: t.total_items,
      total_meal_quantity: t.total_meal_quantity,
      estimated_budget_from_items: t.estimated_budget_from_items,
      raw_html: t.raw_html,
      raw_json: t.raw_json,
    }));

    // Bulk insert
    const result = await TenderDatabase.bulkInsertTenders(payloads);

    // Get newly inserted tenders for notifications
    const newCatering: any[] = [];
    if (result.inserted > 0) {
      // TODO: Query recently inserted tenders
      // For now, use the payloads
      newCatering.push(...payloads.slice(0, result.inserted));
    }

    return {
      newCount: result.inserted,
      cateringCount: cateringTenders.length,
      newCatering,
    };
  }

  /**
   * 🆕 Save minimal tender data (without AI categorization)
   * AI analizi sonradan on-demand yapılacak
   */
  private async saveMinimalTenders(tenders: ScrapedTender[], saveAll: boolean = false): Promise<{
    newCount: number;
  }> {
    console.log(`\n💾 Saving ${tenders.length} tenders to database...`);

    // Prepare insert payloads - TÜM SCRAPE EDİLEN VERİYİ KAYDET!
    const payloads = tenders.map(t => {
      // 🔍 DEBUG: İlk ihaleyi logla
      if (t.source_id === '1759785131303') {
        console.log(`🔍 ORCHESTRATOR DEBUG [${t.source_id}]:`);
        console.log(`   announcement_date:`, t.announcement_date);
        console.log(`   tender_date:`, t.tender_date);
        console.log(`   deadline_date:`, t.deadline_date);
      }

      return {
        source: t.source,
        source_id: t.source_id,
        source_url: t.source_url,
        title: t.title,
        organization: t.organization,
        organization_city: t.organization_city,
        registration_number: t.registration_number, // ✅ İhale kayıt numarası
        tender_type: t.tender_type,
        procurement_type: t.procurement_type,
        category: t.category,

        // ✅ TARİHLER - SCRAPER'DAN GELİYOR
        announcement_date: t.announcement_date as any,
        deadline_date: t.deadline_date as any,
        tender_date: t.tender_date as any,

      // ✅ BÜTÇE - SCRAPER'DAN GELİYOR
      budget: t.budget,
      currency: t.currency || 'TRY',

      // ✅ DÖKÜMAN VE İÇERİK
      specification_url: t.specification_url,
      announcement_text: t.announcement_text,

      // ❌ AI kategorilendirmesi YOK - on-demand yapılacak
        is_catering: false, // Default olarak false, AI analizi sonrası güncellenecek
        catering_confidence: 0,
        ai_analyzed: false, // 🆕 AI analizi yapılmadı

        raw_html: t.raw_html,
        raw_json: t.raw_json,
      };
    });

    // Bulk insert
    const result = await TenderDatabase.bulkInsertTenders(payloads as any);

    console.log(`✅ ${result.inserted} yeni ihale kaydedildi (tarihler dahil)`);

    return {
      newCount: result.inserted,
    };
  }

  /**
   * Send notifications for new tenders
   */
  private async sendNotifications(tenders: any[]): Promise<void> {
    console.log(`\n🔔 Sending notifications for ${tenders.length} new tenders...`);

    for (const tender of tenders) {
      try {
        await NotificationService.notifyNewTender({
          id: tender.source_id, // Will be updated with real ID
          title: tender.title,
          organization: tender.organization,
          organization_city: tender.organization_city,
          budget: tender.budget,
          deadline_date: tender.deadline_date,
          category: tender.category,
        });
      } catch (error) {
        console.error(`❌ Notification failed for ${tender.title}:`, error);
      }
    }
  }
}
