// ============================================================================
// BASE SCRAPER CLASS
// Tüm scraper'ların extend edeceği abstract class
// ============================================================================

import { ScraperSourceConfig, GLOBAL_CONFIG, getRandomUserAgent, calculateRetryDelay } from '../config';
import type { ScrapedTender, ScrapeResult, ScrapeError } from '../types';

export abstract class BaseScraper {
  protected config: ScraperSourceConfig;
  protected errors: ScrapeError[] = [];
  protected startTime: Date;
  protected onBatchComplete?: (tenders: ScrapedTender[]) => Promise<void>; // 🆕 Callback

  constructor(config: ScraperSourceConfig, onBatchComplete?: (tenders: ScrapedTender[]) => Promise<void>) {
    this.config = config;
    this.startTime = new Date();
    this.onBatchComplete = onBatchComplete;
  }

  /**
   * Ana scraping metodu - her scraper implement etmeli
   */
  abstract scrape(): Promise<ScrapedTender[]>;

  /**
   * Execute scraping with error handling and retry logic
   */
  async execute(): Promise<ScrapeResult> {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🚀 ${this.config.name} - Scraping başladı`);
    console.log(`   URL: ${this.config.baseUrl}${this.config.categoryUrl}`);
    console.log(`   Method: ${this.config.method}`);
    console.log(`${'='.repeat(70)}\n`);

    const startedAt = new Date();
    let tenders: ScrapedTender[] = [];
    let success = false;

    try {
      // Rate limiting
      await this.rateLimit();

      // Execute scraping with retry
      tenders = await this.scrapeWithRetry();
      success = true;

      console.log(`\n✅ ${this.config.name} - Scraping başarılı`);
      console.log(`   Toplam: ${tenders.length} ihale bulundu`);
    } catch (error) {
      success = false;
      const scrapeError: ScrapeError = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date(),
      };
      this.errors.push(scrapeError);

      console.error(`\n❌ ${this.config.name} - Scraping başarısız`);
      console.error(`   Hata: ${scrapeError.message}`);
    }

    const completedAt = new Date();
    const duration = completedAt.getTime() - startedAt.getTime();

    console.log(`\n⏱️  Süre: ${Math.round(duration / 1000)} saniye`);
    console.log(`${'='.repeat(70)}\n`);

    return {
      source: this.config.id,
      success,
      tenders,
      totalScraped: tenders.length,
      newTenders: 0, // Database'e kaydederken hesaplanacak
      updatedTenders: 0,
      errors: this.errors,
      duration,
      startedAt,
      completedAt,
    };
  }

  /**
   * Scraping with retry logic
   */
  private async scrapeWithRetry(): Promise<ScrapedTender[]> {
    const { maxAttempts } = GLOBAL_CONFIG.retry;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          const delay = calculateRetryDelay(attempt);
          console.log(`🔁 Retry ${attempt}/${maxAttempts} - ${delay}ms bekleniyor...`);
          await this.sleep(delay);
        }

        const tenders = await this.scrape();
        return tenders;
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error; // Son denemede hata fırlat
        }

        console.warn(`⚠️  Deneme ${attempt} başarısız: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return [];
  }

  /**
   * HTTP request helper with timeout
   */
  protected async fetchWithTimeout(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': getRandomUserAgent(),
          ...options.headers,
        },
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Rate limiting - bekleme ekle
   */
  protected async rateLimit(): Promise<void> {
    if (GLOBAL_CONFIG.rateLimiting.enabled) {
      const delay = this.config.rateLimit || GLOBAL_CONFIG.rateLimiting.defaultDelay;
      await this.sleep(delay);
    }
  }

  /**
   * Sleep helper
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parse budget string to number
   * "1.500.000 TL" → 1500000
   * "2,850,000.00 USD" → 2850000
   */
  protected parseBudget(text: string): number | null {
    if (!text || typeof text !== 'string') return null;

    // Remove all non-numeric except dots and commas
    const cleaned = text.replace(/[^\d.,]/g, '');

    // Turkish format: 1.500.000,50 (dots as thousands, comma as decimal)
    // US format: 1,500,000.50 (commas as thousands, dot as decimal)

    // Detect format
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');

    let number: number;

    if (lastDot > lastComma) {
      // US format: 1,500,000.50
      number = parseFloat(cleaned.replace(/,/g, ''));
    } else {
      // Turkish format: 1.500.000,50
      number = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    }

    return isNaN(number) ? null : Math.round(number);
  }

  /**
   * Parse date string to Date
   * "15.01.2025" → Date
   * "2025-01-15" → Date
   * "15/01/2025" → Date
   */
  protected parseDate(text: string): Date | null {
    if (!text || typeof text !== 'string') return null;

    // Format 1: DD.MM.YYYY or D.MM.YYYY or DD.M.YYYY or D.M.YYYY (Turkish)
    const ddmmyyyy = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      const paddedDay = day.padStart(2, '0');
      const paddedMonth = month.padStart(2, '0');
      return new Date(`${year}-${paddedMonth}-${paddedDay}`);
    }

    // Format 2: YYYY-MM-DD (ISO)
    const yyyymmdd = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (yyyymmdd) {
      return new Date(text);
    }

    // Format 3: DD/MM/YYYY
    const ddmmyyyySlash = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (ddmmyyyySlash) {
      const [, day, month, year] = ddmmyyyySlash;
      return new Date(`${year}-${month}-${day}`);
    }

    // Format 4: Natural language (Turkish)
    // "15 Ocak 2025" → Date
    const monthsMap: Record<string, string> = {
      'ocak': '01', 'şubat': '02', 'mart': '03', 'nisan': '04',
      'mayıs': '05', 'haziran': '06', 'temmuz': '07', 'ağustos': '08',
      'eylül': '09', 'ekim': '10', 'kasım': '11', 'aralık': '12',
    };

    for (const [monthName, monthNum] of Object.entries(monthsMap)) {
      if (text.toLowerCase().includes(monthName)) {
        const match = text.match(/(\d{1,2})\s+\w+\s+(\d{4})/);
        if (match) {
          const [, day, year] = match;
          return new Date(`${year}-${monthNum}-${day.padStart(2, '0')}`);
        }
      }
    }

    return null;
  }

  /**
   * Extract city from organization name
   * "İstanbul Milli Eğitim Müdürlüğü" → "İstanbul"
   */
  protected extractCity(organizationName: string): string | undefined {
    if (!organizationName) return undefined;

    // Turkish cities (top 20)
    const cities = [
      'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya',
      'Gaziantep', 'Şanlıurfa', 'Kocaeli', 'Mersin', 'Diyarbakır', 'Hatay',
      'Manisa', 'Kayseri', 'Samsun', 'Balıkesir', 'Kahramanmaraş', 'Van',
      'Aydın', 'Denizli', 'Sakarya', 'Tekirdağ', 'Muğla', 'Eskişehir',
    ];

    for (const city of cities) {
      if (organizationName.includes(city)) {
        return city;
      }
    }

    return undefined;
  }

  /**
   * Clean HTML text
   */
  protected cleanText(text: string): string {
    if (!text) return '';
    return text
      .replace(/\s+/g, ' ') // Multiple spaces → single space
      .replace(/\n+/g, ' ') // Newlines → space
      .trim();
  }

  /**
   * Generate source ID (fallback eğer kaynak ID yoksa)
   */
  protected generateSourceId(tender: Partial<ScrapedTender>): string {
    const timestamp = Date.now();
    const titleHash = this.simpleHash(tender.title || 'unknown');
    return `${this.config.id}_${titleHash}_${timestamp}`;
  }

  /**
   * Simple hash function for strings
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Log error
   */
  protected logError(message: string, error?: any, url?: string): void {
    const scrapeError: ScrapeError = {
      message,
      stack: error?.stack,
      url,
      statusCode: error?.status || error?.statusCode,
      timestamp: new Date(),
    };
    this.errors.push(scrapeError);

    console.error(`\n❌ Error: ${message}`);
    if (url) console.error(`   URL: ${url}`);
    if (error) console.error(`   Details:`, error.message || error);
  }

  /**
   * Validate tender data
   */
  protected validateTender(tender: Partial<ScrapedTender>): tender is ScrapedTender {
    if (!tender.title || tender.title.length < 10) {
      console.warn(`⚠️  Geçersiz ihale: Başlık çok kısa (${tender.title})`);
      return false;
    }

    if (!tender.source_url) {
      console.warn(`⚠️  Geçersiz ihale: URL yok (${tender.title})`);
      return false;
    }

    return true;
  }
}
