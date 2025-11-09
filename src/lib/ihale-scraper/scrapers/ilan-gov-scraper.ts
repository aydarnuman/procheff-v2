// ============================================================================
// İLAN.GOV.TR SCRAPER
// Resmi Basın İlan Kurumu - Hybrid: Puppeteer (dev) + ScraperAPI (prod)
// ============================================================================

import { BaseScraper } from './base-scraper';
import type { ScrapedTender } from '../types';
import * as cheerio from 'cheerio';
import type { Element as DomHandlerElement } from 'domhandler';
import puppeteer from 'puppeteer';
import axios from 'axios';
import { MOCK_TENDERS } from '../test-data';

export class IlanGovScraper extends BaseScraper {
  async scrape(): Promise<ScrapedTender[]> {
    // DEMO MODE: Use mock data for testing
    const USE_MOCK_DATA = process.env.SCRAPER_USE_MOCK === 'true';

    if (USE_MOCK_DATA) {
      console.log(`🧪 DEMO MODE: Using mock data (${MOCK_TENDERS.length} tenders)`);
      return MOCK_TENDERS;
    }

    // HYBRID MODE: ScraperAPI (prod) or Puppeteer (dev)
    const useScraperAPI = process.env.SCRAPER_USE_API === 'true';

    if (useScraperAPI) {
      console.log(`🌐 SCRAPERAPI MODE: Fetching via ScraperAPI...`);
      return this.scrapeWithScraperAPI();
    } else {
      console.log(`🤖 PUPPETEER MODE: Fetching with headless browser...`);
      return this.scrapeWithPuppeteer();
    }
  }

  /**
   * Scrape using ScraperAPI (Production)
   */
  private async scrapeWithScraperAPI(): Promise<ScrapedTender[]> {
    const apiKey = process.env.SCRAPER_API_KEY;

    if (!apiKey || apiKey === 'YOUR_SCRAPERAPI_KEY_HERE') {
      console.warn('⚠️ ScraperAPI key not configured, falling back to Puppeteer');
      return this.scrapeWithPuppeteer();
    }

    try {
      const url = `${this.config.baseUrl}${this.config.categoryUrl}`;
      console.log(`📡 Fetching via ScraperAPI: ${url}`);

      const response = await axios.get('http://api.scraperapi.com/', {
        params: {
          api_key: apiKey,
          url: url,
          render: true,  // Enable JavaScript rendering
          // country_code: 'tr',  // Geotargeting not available in $49 plan
          wait_for_selector: 'igt-ad-card,.carousel-item,[class*="ilan"]',  // Wait for Angular to render tender cards
          wait_for: 5000,  // Wait 5 seconds for AJAX to complete
        },
        timeout: 90000,  // 90 second timeout (Angular is slow)
      });

      const html = response.data;
      console.log(`✅ HTML alındı (ScraperAPI): ${html.length} bytes`);

      // Debug: Save HTML
      if (process.env.AI_DEBUG === 'true') {
        const fs = require('fs');
        fs.writeFileSync('/tmp/ilan-gov-scraperapi.html', html);
        console.log('🐛 Debug: HTML saved to /tmp/ilan-gov-scraperapi.html');
      }

      // Parse with Cheerio
      return this.parseHTMLContent(html);

    } catch (error: any) {
      console.error('❌ ScraperAPI failed:', error.message);
      console.log('🔄 Falling back to Puppeteer...');
      return this.scrapeWithPuppeteer();
    }
  }

  /**
   * Scrape using Puppeteer (Development/Fallback)
   */
  private async scrapeWithPuppeteer(): Promise<ScrapedTender[]> {
    try {
      const url = `${this.config.baseUrl}${this.config.categoryUrl}`;
      console.log(`📡 Launching headless browser for: ${url}`);

      // Launch Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--ignore-certificate-errors',  // SSL bypass
          '--ignore-certificate-errors-spki-list',
        ],
      });

      const page = await browser.newPage();

      // Set User-Agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Set viewport to desktop size (helps with responsive layouts)
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to page
      console.log('🔄 Loading page...');
      await page.goto(url, {
        waitUntil: 'domcontentloaded', // Faster than networkidle0
        timeout: 60000,
      });

      // Wait for Angular to bootstrap and render
      console.log('⏳ Waiting for Angular to render tender data...');

      // Wait for Angular app to be ready
      await page.waitForFunction(
        () => {
          // Check if Angular has rendered content
          const app = document.querySelector('app-root, [ng-version]');
          return app && app.children.length > 0;
        },
        { timeout: 10000 }
      );

      console.log('✅ Angular app loaded');

      // Now wait for tender data to appear (up to 30 seconds)
      try {
        await page.waitForFunction(
          () => {
            // Look for any of these indicators that data has loaded:
            // 1. ILN IDs in visible text (not in scripts)
            const bodyText = document.body.innerText || '';
            const ilnMatches = bodyText.match(/ILN\d{8}/g) || [];

            // 2. Common tender card selectors
            const cards = document.querySelectorAll(
              'igt-ad-card, .ilan-card, .ihale-card, .ad-card, .tender-item, [class*="list-item"]'
            );

            // 3. Table rows with data
            const tableRows = document.querySelectorAll('table tbody tr');

            return ilnMatches.length >= 3 || cards.length >= 3 || tableRows.length >= 3;
          },
          { timeout: 30000 }
        );
        console.log('✅ Tender data rendered successfully');
      } catch (e) {
        console.warn('⚠️ Tender data wait timeout (30s), proceeding with current page state...');
      }

      // Extract data directly from page using JavaScript
      console.log('📊 Extracting tender data from page...');
      const tendersData = await page.evaluate(() => {
        const results: any[] = [];

        // Strategy 1: Try to find igt-ad-card components (Angular)
        let cards: Element[] = Array.from(document.querySelectorAll('igt-ad-card'));

        // Strategy 2: Try carousel items
        if (cards.length === 0) {
          cards = Array.from(document.querySelectorAll('.carousel-item, [class*="ad-card"], [class*="ilan-item"]'));
        }

        // Strategy 3: Try any element with ILN ID
        if (cards.length === 0) {
          // Find all text nodes containing ILN IDs
          const bodyText = document.body.innerText;
          const ilnMatches = bodyText.match(/ILN\d{8}/g) || [];

          // If ILN IDs exist, try to find their container elements
          if (ilnMatches.length > 0) {
            const allElements = [
              ...document.querySelectorAll('[class*="item"]'),
              ...document.querySelectorAll('[class*="card"]'),
              ...document.querySelectorAll('[class*="row"]')
            ];
            cards = allElements.filter(el => /ILN\d{8}/.test(el.textContent || ''));
          }
        }

        cards.forEach((card) => {
          try {
            const text = card.textContent || '';

            // Extract tender ID (ILN followed by 8 digits)
            const idMatch = text.match(/ILN\d{8}/);
            if (!idMatch) return;

            const tender: any = {
              source_id: idMatch[0],
              title: '',
              organization: '',
              city: '',
              url: '',
            };

            // Find links for title and URL
            const links = card.querySelectorAll('a');
            if (links.length > 0) {
              // The first meaningful link is usually the title
              for (const link of Array.from(links)) {
                const linkText = link.textContent?.trim() || '';
                const href = link.getAttribute('href') || '';

                if (linkText.length > 10 && !linkText.includes('İLN') && href.includes('/ilan/')) {
                  tender.title = linkText;
                  tender.url = href;
                  break;
                }
              }
            }

            // Extract organization - usually before or after title
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            for (const line of lines) {
              // Skip if it's the ILN ID or the title
              if (line.includes('ILN') || line === tender.title) continue;

              // Organization names are usually longer
              if (line.length > 10 && line.length < 200) {
                if (!tender.organization) {
                  tender.organization = line;
                } else if (!tender.city && line.length < 50) {
                  tender.city = line;
                }
              }
            }

            if (tender.title && tender.organization) {
              results.push(tender);
            }
          } catch (e) {
            // Skip problematic cards
            console.error('Card parse error:', e);
          }
        });

        return results;
      });

      // Get HTML as fallback
      const html = await page.content();
      console.log(`✅ HTML alındı (Puppeteer): ${html.length} bytes`);
      console.log(`📊 Found ${tendersData.length} tenders via JavaScript extraction`);

      await browser.close();

      // Debug: Save HTML
      if (process.env.AI_DEBUG === 'true') {
        const fs = require('fs');
        fs.writeFileSync('/tmp/ilan-gov-puppeteer.html', html);
        fs.writeFileSync('/tmp/ilan-gov-extracted.json', JSON.stringify(tendersData, null, 2));
        console.log('🐛 Debug: Files saved to /tmp/');
      }

      // Convert extracted data to ScrapedTender format
      const tenders: ScrapedTender[] = [];
      for (const data of tendersData) {
        const tender: Partial<ScrapedTender> = {
          source: 'ilan_gov',
          source_id: data.source_id,
          source_url: data.url.startsWith('http') ? data.url : `${this.config.baseUrl}${data.url}`,
          title: this.cleanText(data.title),
          organization: this.cleanText(data.organization),
          organization_city: data.city || this.extractCity(data.organization),
          currency: 'TRY',
          procurement_type: 'Hizmet Alımı',
          category: 'Yemek Hazırlama, Dağıtım, Catering',
          scraped_at: new Date(),
        };

        if (this.validateTender(tender)) {
          tenders.push(tender as ScrapedTender);
        }
      }

      // If no tenders found via JS, fallback to HTML parsing
      if (tenders.length === 0) {
        console.log('⚠️ No tenders from JS extraction, trying HTML parsing...');
        return this.parseHTMLContent(html);
      }

      return tenders;

    } catch (error) {
      this.logError('Puppeteer scraping failed', error, this.config.baseUrl);
      throw error;
    }
  }

  /**
   * Parse HTML content (works for both ScraperAPI and Puppeteer)
   */
  private parseHTMLContent(html: string): ScrapedTender[] {
    const $ = cheerio.load(html);
    const tenders: ScrapedTender[] = [];

    // Try to find embedded JSON data first
    const scriptTags = $('script');
    let jsonData: any = null;

    scriptTags.each((i, elem) => {
      const scriptContent = $(elem).html() || '';

      if (scriptContent.includes('Ihaleler') || scriptContent.includes('ilanlar')) {
        try {
          const jsonMatch = scriptContent.match(/({[\s\S]*?})/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.Ihaleler || parsed.data) {
              jsonData = parsed;
              console.log(`✅ JSON data found in script tag`);
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    if (jsonData) {
      const ihaleList = jsonData.Ihaleler || jsonData.data || [];
      console.log(`📊 ${ihaleList.length} tenders found (JSON)`);

      for (const item of ihaleList) {
        const tender = this.parseJSONItem(item);
        if (this.validateTender(tender)) {
          tenders.push(tender as ScrapedTender);
        }
      }

      return tenders;
    }

    // Fallback to HTML parsing
    console.log(`⚠️ No JSON found, parsing HTML...`);

    const selectors = [
      'table tbody tr',
      '.ilan-item',
      '.ihale-card',
      '.tender-item',
      '[class*="list-item"]',
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`✅ ${elements.length} elements found (selector: ${selector})`);

        elements.each((i, elem) => {
          try {
            const tender = this.parseHTMLElement($, $(elem) as cheerio.Cheerio<DomHandlerElement>);
            if (this.validateTender(tender)) {
              tenders.push(tender as ScrapedTender);
            }
          } catch (error) {
            console.warn(`⚠️ Element ${i} parse failed:`, error);
          }
        });

        break;
      }
    }

    if (tenders.length === 0) {
      console.warn('⚠️ No tenders found!');
      console.log('HTML preview (first 1000 chars):');
      console.log($('body').text().substring(0, 1000));
    }

    return tenders;
  }

  /**
   * Parse JSON item to ScrapedTender
   */
  private parseJSONItem(item: any): Partial<ScrapedTender> {
    return {
      source: 'ilan_gov',
      source_id: item.IhaleID || item.id || item.IlanNo || this.generateSourceId({ title: item.Baslik }),
      source_url: item.Url || item.url || `${this.config.baseUrl}/ilan/detay/${item.IhaleID || item.id}`,
      title: this.cleanText(item.Baslik || item.title || item.IhaleAdi || ''),
      organization: this.cleanText(item.Kurum || item.organization || item.IdareName || ''),
      organization_city: this.extractCity(item.Kurum || item.IdareName || ''),
      budget: this.parseBudget(item.TahminiBedel || item.budget || item.Butce || ''),
      currency: 'TRY',
      announcement_date: this.parseDate(item.IlanTarihi || item.announcement_date || item.YayinTarihi || '') || undefined,
      deadline_date: this.parseDate(item.SonTarih || item.deadline || item.TeklifSonTarihi || '') || undefined,
      tender_date: this.parseDate(item.IhaleTarihi || item.tender_date || '') || undefined,
      tender_type: this.cleanText(item.IhaleTuru || item.type || item.UsulAdi || ''),
      procurement_type: 'Hizmet Alımı',
      category: 'Yemek Hazırlama, Dağıtım, Catering',
      raw_json: item,
      scraped_at: new Date(),
    };
  }

  /**
   * Parse HTML element to ScrapedTender
   */
  private parseHTMLElement($: cheerio.CheerioAPI, elem: cheerio.Cheerio<DomHandlerElement>): Partial<ScrapedTender> {
    const $elem = elem;

    const title =
      $elem.find('.baslik, .title, .ihale-adi, h3, h4, td:nth-child(2), .col:nth-child(2)').first().text().trim() ||
      $elem.find('a').first().text().trim() ||
      '';

    const href = $elem.find('a').first().attr('href') || '';
    const fullUrl = href.startsWith('http') ? href : `${this.config.baseUrl}${href}`;

    const organization =
      $elem.find('.kurum, .organization, .idare, td:first-child, .col:first-child').first().text().trim() || '';

    const sourceIdMatch = $elem.text().match(/ILN\d+/);
    const sourceId = sourceIdMatch ? sourceIdMatch[0] : this.generateSourceId({ title });

    return {
      source: 'ilan_gov',
      source_id: sourceId,
      source_url: fullUrl,
      title: this.cleanText(title),
      organization: this.cleanText(organization),
      organization_city: this.extractCity(organization),
      currency: 'TRY',
      procurement_type: 'Hizmet Alımı',
      category: 'Yemek Hazırlama, Dağıtım, Catering',
      raw_html: $elem.html() || '',
      scraped_at: new Date(),
    };
  }
}
