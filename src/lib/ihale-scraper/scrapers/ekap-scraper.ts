// ============================================================================
// EKAP SCRAPER
// Kamu İhale Kurumu - Login Required + Simple HTML Tables
// ============================================================================

import { BaseScraper } from './base-scraper';
import type { ScrapedTender } from '../types';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

export class EkapScraper extends BaseScraper {
  async scrape(): Promise<ScrapedTender[]> {
    // EKAP requires login - use Puppeteer with credentials
    const username = process.env.EKAP_USERNAME;
    const password = process.env.EKAP_PASSWORD;

    if (!username || !password) {
      console.warn('⚠️ EKAP credentials not configured in .env.local');
      console.warn('   Set EKAP_USERNAME and EKAP_PASSWORD to enable EKAP scraping');
      return [];
    }

    return this.scrapeWithLogin(username, password);
  }

  private async scrapeWithLogin(username: string, password: string): Promise<ScrapedTender[]> {
    try {
      console.log(`📡 Launching browser for EKAP with login...`);

      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

      // Step 1: Login
      console.log('🔐 Logging in to EKAP...');
      await page.goto('https://ekap.kik.gov.tr/EKAP/', { waitUntil: 'networkidle2', timeout: 60000 });

      // Fill login form
      await page.type('#username', username);
      await page.type('#password', password);
      await page.click('button[type="submit"]');

      // Wait for login to complete
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      // Step 2: Navigate to tender search with catering filter
      console.log('🔍 Searching for catering tenders...');
      const searchUrl = `${this.config.baseUrl}${this.config.categoryUrl}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      // Wait for results to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract HTML
      const html = await page.content();
      await browser.close();

      console.log(`✅ HTML retrieved from EKAP: ${html.length} bytes`);

      // Parse tenders
      return this.parseHTML(html);

    } catch (error) {
      this.logError('EKAP scraping failed', error, this.config.baseUrl);
      throw error;
    }
  }

  private parseHTML(html: string): ScrapedTender[] {
    const $ = cheerio.load(html);
    const tenders: ScrapedTender[] = [];

    // EKAP uses table structure for tender listings
    $('table.tender-list tbody tr, table.ihale-liste tbody tr').each((i, row) => {
      try {
        const $row = $(row);

        const tender: Partial<ScrapedTender> = {
          source: 'ekap',
          source_id: this.cleanText($row.find('td').eq(0).text()) || `EKAP${Date.now()}${i}`,
          title: this.cleanText($row.find('td').eq(1).text() || $row.find('td').eq(2).text()),
          organization: this.cleanText($row.find('td').eq(3).text() || $row.find('td').eq(4).text()),
          organization_city: this.extractCity($row.text()),
          budget: this.parseBudget($row.find('td:contains("TL")').text()),
          currency: 'TRY',
          announcement_date: this.parseDate($row.find('td').eq(5).text()),
          deadline_date: this.parseDate($row.find('td').eq(6).text()),
          procurement_type: 'Hizmet Alımı',
          category: 'Yemek Hazırlama, Dağıtım, Catering',
          source_url: this.config.baseUrl + ($row.find('a').attr('href') || ''),
          scraped_at: new Date(),
        };

        if (this.validateTender(tender)) {
          tenders.push(tender as ScrapedTender);
        }
      } catch (error) {
        console.warn(`⚠️ EKAP row ${i} parse error:`, error);
      }
    });

    console.log(`📊 EKAP: ${tenders.length} tenders extracted`);
    return tenders;
  }
}
