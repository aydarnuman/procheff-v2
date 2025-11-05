// ============================================================================
// İHALEBUL.COM SCRAPER
// Commercial tender aggregator - Login Required
// ============================================================================

import { BaseScraper } from './base-scraper';
import type { ScrapedTender } from '../types';
import type { ScraperSourceConfig } from '../config';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { BLOCKED_CITIES } from '../config';
import { updateProgress } from '@/app/api/ihale-scraper/progress/route';
import { ItemParser } from '../parsers/item-parser'; // 🆕 Item parsing için

export class IhalebulScraper extends BaseScraper {
  // 🆕 Constructor ile callback'i parent'a ilet
  constructor(config: ScraperSourceConfig, onBatchComplete?: (tenders: ScrapedTender[]) => Promise<void>) {
    super(config, onBatchComplete);
  }

  async scrape(): Promise<ScrapedTender[]> {
    const username = process.env.IHALEBUL_USERNAME;
    const password = process.env.IHALEBUL_PASSWORD;

    // LOGIN IS REQUIRED - Do not scrape without login
    if (!username || !password) {
      throw new Error('❌ İhalebul credentials not found. Login is required for scraping.');
    }

    console.log('🔐 Attempting login scraping (full details)...');
    return await this.scrapeWithLogin(username, password);
    // No fallback to public scraping - login is mandatory
  }

  private async scrapePublicPages(): Promise<ScrapedTender[]> {
    try {
      console.log(`📡 Scraping public İhalebul pages with pagination...`);

      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ],
      });

      const page = await browser.newPage();

      // Set realistic browser fingerprint to bypass bot detection
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      // Hide automation indicators
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR', 'tr', 'en-US', 'en'] });
      });

      const allTenders: ScrapedTender[] = [];
      const maxPages = 50; // 216 ihale / ~4-5 per page = ~50 pages

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const searchUrl = `${this.config.baseUrl}${this.config.categoryUrl}&page=${pageNum}`;
        console.log(`\n📄 Page ${pageNum}/${maxPages}: ${searchUrl}`);

        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        const html = await page.content();

        // Debug: Save HTML for first page
        if (pageNum === 1 && process.env.AI_DEBUG === 'true') {
          const fs = require('fs');
          fs.writeFileSync('/tmp/ihalebul-debug.html', html);
          console.log('🐛 Debug: Page 1 HTML saved to /tmp/ihalebul-debug.html');
        }

        const tenders = this.parseHTML(html);
        allTenders.push(...tenders);

        console.log(`✅ Page ${pageNum}: ${tenders.length} active tenders found`);

        // Stop if no tenders found
        if (tenders.length === 0) {
          console.log(`⚠️ No tenders on page ${pageNum}, stopping pagination`);
          break;
        }
      }

      await browser.close();

      console.log(`\n📊 Total: ${allTenders.length} active tenders from ${maxPages} pages`);
      return allTenders;

    } catch (error) {
      this.logError('İhalebul public scraping failed', error, this.config.baseUrl);
      throw error;
    }
  }

  // 🆕 Metadata cache - List page'den gelen title/org bilgilerini sakla
  private metadataCache: Map<string, { title: string; organization: string; city: string }> = new Map();

  private async scrapeWithLogin(username: string, password: string): Promise<ScrapedTender[]> {
    try {
      console.log(`📡 Launching browser for İhalebul with login...`);

      // Always run in headless mode (no visible browser window)
      const browser = await puppeteer.launch({
        headless: true, // Run in background
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ],
      });

      const page = await browser.newPage();
      const fs = require('fs');

      // Check if we have a saved session (within last hour)
      let savedSession = null;
      try {
        const sessionData = fs.readFileSync('/tmp/ihalebul-session.json', 'utf8');
        savedSession = JSON.parse(sessionData);
        const sessionAge = Date.now() - new Date(savedSession.timestamp).getTime();

        if (sessionAge < 3600000) { // 1 hour
          console.log('🔄 Restoring saved session (age: ' + Math.round(sessionAge / 60000) + ' minutes)');
          // Restore cookies
          await page.setCookie(...savedSession.cookies);
        } else {
          console.log('⏰ Saved session expired (age: ' + Math.round(sessionAge / 60000) + ' minutes)');
          savedSession = null;
        }
      } catch (err) {
        console.log('📝 No saved session found, will login fresh');
      }

      // Set realistic browser fingerprint to bypass bot detection
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      // Hide automation indicators
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR', 'tr', 'en-US', 'en'] });
      });

      // Step 1: Login (only if no valid session)
      if (!savedSession) {
        console.log('🔐 Logging in to İhalebul...');
        await page.goto('https://www.ihalebul.com/tenders', { waitUntil: 'networkidle2', timeout: 60000 });

      // Wait for login form to be rendered (DOM may load dynamically)
      console.log('⏳ Waiting for login form to load...');
      try {
        await page.waitForSelector('input[name="kul_adi"], #kul_adi', { timeout: 10000 });
        console.log('✅ Login form detected in DOM');
      } catch (err) {
        const errorHtml = await page.content();
        fs.writeFileSync('/tmp/ihalebul-no-form.html', errorHtml);
        console.error('❌ Login form did not appear within 10 seconds');
        throw new Error('Login form not found - page may have redirected or blocked access');
      }

      // Debug: Save login page HTML
      const loginHtml = await page.content();
      fs.writeFileSync('/tmp/ihalebul-login.html', loginHtml);
      console.log('🐛 Login page HTML saved to /tmp/ihalebul-login.html');

      // Debug: Check for iframes (form may be inside iframe)
      const frames = page.frames();
      console.log(`🖼️  Found ${frames.length} frames:`, frames.map(f => f.url()));
      if (frames.length > 1) {
        console.log('⚠️  Multiple frames detected - form may be in iframe');
      }

      // Find login form with multiple selector options
      console.log('🔍 Looking for login form elements...');
      const usernameInput = await page.$('input[name="kul_adi"]') || await page.$('#kul_adi');
      const passwordInput = await page.$('input[name="sifre"]') || await page.$('#sifre');
      const csrfInput = await page.$('input[name="csrf"]');

      if (!usernameInput || !passwordInput) {
        console.error('❌ Login form inputs not found!');
        console.error(`Username input: ${usernameInput ? 'Found' : 'NOT FOUND'}`);
        console.error(`Password input: ${passwordInput ? 'Found' : 'NOT FOUND'}`);
        throw new Error('Login form inputs not found on page');
      }

      console.log('✅ Login form found');
      console.log('✍️ Filling login credentials...');

      // Extract CSRF token if present
      let csrfToken = '';
      if (csrfInput) {
        csrfToken = await page.evaluate(el => (el as HTMLInputElement).value, csrfInput);
        console.log('🔒 CSRF token extracted');
      }

      // Fill the form (use the VISIBLE desktop form - index 1)
      await page.evaluate((user, pass) => {
        // Find all username inputs
        const userInputs = document.querySelectorAll<HTMLInputElement>('input[name="kul_adi"]');
        const passInputs = document.querySelectorAll<HTMLInputElement>('input[name="sifre"]');

        // Use desktop form (not mobile modal) - it's the second one
        if (userInputs.length >= 2 && passInputs.length >= 2) {
          userInputs[1].value = user; // Desktop form
          passInputs[1].value = pass; // Desktop form
        } else {
          userInputs[0].value = user; // Fallback to first form
          passInputs[0].value = pass;
        }
      }, username, password);

      // Debug: Verify inputs were filled
      const filledValues = await page.evaluate(() => {
        const userInputs = document.querySelectorAll<HTMLInputElement>('input[name="kul_adi"]');
        const passInputs = document.querySelectorAll<HTMLInputElement>('input[name="sifre"]');
        return {
          userCount: userInputs.length,
          passCount: passInputs.length,
          userFilled: userInputs[1]?.value?.length > 0,
          passFilled: passInputs[1]?.value?.length > 0,
        };
      });
      console.log('📝 Input verification:', filledValues);

      console.log('🔐 Submitting login form...');

      // Click the desktop form's login button (index 1, same as the form we filled)
      try {
        // Use page.evaluate to click the DESKTOP button (index 1)
        console.log('🖱️  Clicking desktop login button...');

        // Click and wait for navigation
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
          page.evaluate(() => {
            // Find all submit buttons with name="ok"
            const buttons = document.querySelectorAll<HTMLButtonElement>('button[type="submit"][name="ok"]');

            if (buttons.length >= 2) {
              // Click desktop button (index 1)
              console.log('Clicking desktop button (index 1)');
              buttons[1].click();
            } else if (buttons.length === 1) {
              // Fallback to first button
              console.log('Only one button found, clicking it');
              buttons[0].click();
            } else {
              throw new Error('No submit buttons found!');
            }
          })
        ]);

        console.log('✅ Navigation completed after button click');
      } catch (navError) {
        console.error('❌ Form submission or navigation failed:', navError);
        const failHtml = await page.content();
        fs.writeFileSync('/tmp/ihalebul-submit-error.html', failHtml);
        throw new Error('Login form submission failed - check /tmp/ihalebul-submit-error.html');
      }

      // Check if login was successful
      const afterLoginUrl = page.url();
      const afterLoginHtml = await page.content();

      // Debug: Check cookies after login
      const cookies = await page.cookies();
      console.log('🍪 Cookies after login:', cookies.length, 'cookies');
      const sessionCookies = cookies.filter(c => c.name.toLowerCase().includes('session') || c.name.toLowerCase().includes('auth'));
      console.log('🔑 Session cookies:', sessionCookies.map(c => c.name));

      // Look for logout button or user menu (indicates successful login)
      const isLoggedIn = afterLoginHtml.includes('logout') ||
                        afterLoginHtml.includes('Çıkış') ||
                        afterLoginHtml.includes('Hesabım') ||
                        !afterLoginHtml.includes('name="kul_adi"');

      if (!isLoggedIn) {
        // Still seeing login form = login failed
        fs.writeFileSync('/tmp/ihalebul-login-failed.html', afterLoginHtml);
        console.error('❌ Login failed - still seeing login form or no logout button');
        console.error('📍 Current URL:', afterLoginUrl);

        // Abort scraping as per user requirement
        throw new Error('Login failed, aborting scraping. Check credentials or /tmp/ihalebul-login-failed.html');
      }

      // Save session info for future use
      const sessionInfo = {
        timestamp: new Date().toISOString(),
        url: afterLoginUrl,
        cookies: cookies,
        sessionCookies: sessionCookies,
      };
      fs.writeFileSync('/tmp/ihalebul-session.json', JSON.stringify(sessionInfo, null, 2));
      console.log('💾 Session saved to /tmp/ihalebul-session.json');

        console.log('✅ Login successful! Logout button detected.');
        console.log(`📍 Current URL: ${afterLoginUrl}`);
      } else {
        // Using saved session
        console.log('✅ Using saved session - skipping login');
        // Go directly to tenders page with cookies already set
        await page.goto('https://www.ihalebul.com/tenders', { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('📍 Navigated to tenders page with saved session');
      }

      // Step 2: Navigate to /tenders first (required for session), then search
      console.log('📍 Navigating to /tenders first (to establish session)...');
      await page.goto(`${this.config.baseUrl}/tenders`, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Now collect all tender URLs from search pages
      console.log('🔍 Collecting tender URLs from list pages AND extracting metadata...');
      const tenderUrls: string[] = [];
      const maxPages = 250; // Increased to 250 to capture all tenders

      updateProgress('ihalebul', {
        status: 'running',
        message: 'İhale listesi toplanıyor...',
      });

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const searchUrl = `${this.config.baseUrl}${this.config.categoryUrl}&page=${pageNum}`;
        console.log(`\n📄 Page ${pageNum}/${maxPages}: ${searchUrl}`);

        // Update progress
        updateProgress('ihalebul', {
          status: 'running',
          currentPage: pageNum,
          totalPages: maxPages,
          tendersFound: tenderUrls.length,
          message: `Sayfa ${pageNum}/${maxPages} taranıyor...`,
        });

        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for tenders to be loaded by JavaScript - pages load slowly!
        // The page uses AJAX to load data, so we need to wait for actual content
        console.log('⏳ Waiting for tenders to load (page loads slowly via AJAX)...');
        await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5 seconds for AJAX

        const html = await page.content();

        // Check if page shows "Veri Bulunamadı" (No data found)
        if (html.includes('Veri Bulunamadı')) {
          console.log(`⚠️ Page ${pageNum} shows "Veri Bulunamadı" (no data), stopping pagination`);
          break;
        }

        // Debug: Save category page HTML (first page only)
        if (pageNum === 1) {
          fs.writeFileSync('/tmp/ihalebul-category-page1.html', html);
          console.log('🐛 Category page 1 HTML saved to /tmp/ihalebul-category-page1.html');
        }

        // 🆕 Extract metadata FROM LIST PAGE (title, org, city are here!)
        this.extractMetadataFromListPage(html);

        // Extract tender URLs from this page
        const urls = this.extractTenderUrls(html);
        tenderUrls.push(...urls);

        console.log(`✅ Page ${pageNum}: ${urls.length} tender URLs collected`);

        // Stop if no tenders found
        if (urls.length === 0) {
          console.log(`⚠️ No tenders on page ${pageNum}, stopping pagination`);
          break;
        }

        // Stop if we're past page 10 and getting very few results (likely end of results)
        if (pageNum >= 10 && urls.length < 5) {
          console.log(`⚠️ Page ${pageNum} has only ${urls.length} tenders (likely end of results), stopping pagination`);
          break;
        }
      }

      console.log(`\n📊 Total URLs collected: ${tenderUrls.length}`);

      // Step 3: Visit each tender detail page and extract full information
      console.log('\n🔍 Fetching detailed information from each tender...');
      const allTenders: ScrapedTender[] = [];

      updateProgress('ihalebul', {
        status: 'running',
        message: `${tenderUrls.length} ihale detayı çekiliyor...`,
        tendersFound: tenderUrls.length,
      });

      // CORRECT PARALLEL SCRAPING: Create separate pages for concurrent requests
      const CONCURRENT_PAGES = 5; // 5 parallel pages (safe and fast)
      const failedUrls: string[] = [];

      console.log(`\n📄 Creating ${CONCURRENT_PAGES} browser pages for parallel scraping...`);

      // Create page pool
      const pages: any[] = [];
      for (let i = 0; i < CONCURRENT_PAGES; i++) {
        const newPage = await browser.newPage();
        await newPage.setUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        pages.push(newPage);
      }

      console.log(`✅ ${CONCURRENT_PAGES} pages created, starting parallel scraping...`);

      // Process in batches of CONCURRENT_PAGES
      const BATCH_SIZE = CONCURRENT_PAGES;
      for (let batchStart = 0; batchStart < tenderUrls.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, tenderUrls.length);
        const batch = tenderUrls.slice(batchStart, batchEnd);

        console.log(`\n🚀 Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(tenderUrls.length / BATCH_SIZE)}: Processing ${batch.length} tenders in parallel`);

        // Update progress
        updateProgress('ihalebul', {
          status: 'running',
          message: `İhale detayları: ${batchStart}/${tenderUrls.length} (${CONCURRENT_PAGES} paralel page)`,
          tendersFound: tenderUrls.length,
          currentPage: batchStart,
          totalPages: tenderUrls.length,
        });

        // Each URL gets its own dedicated page
        const batchResults = await Promise.allSettled(
          batch.map(async (url, idx) => {
            const globalIdx = batchStart + idx;
            const dedicatedPage = pages[idx]; // Each request uses its own page!

            try {
              await dedicatedPage.goto(url, {
                waitUntil: 'domcontentloaded', // Faster than networkidle2
                timeout: 20000
              });

              const detailHtml = await dedicatedPage.content();
              const tender = this.parseDetailPage(detailHtml, url);

              if (tender) {
                console.log(`  ✅ [${globalIdx + 1}/${tenderUrls.length}] ${tender.title}`);
                return tender;
              }
              return null;
            } catch (error) {
              console.warn(`  ⚠️ [${globalIdx + 1}/${tenderUrls.length}] Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
              failedUrls.push(url);
              return null;
            }
          })
        );

        // Collect successful results
        // Collect batch results
        const batchTenders: ScrapedTender[] = [];
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            allTenders.push(result.value);
            batchTenders.push(result.value);
          }
        }

        console.log(`✅ Batch complete: ${allTenders.length}/${tenderUrls.length} tenders scraped`);

        // 🆕 PARTİ PARTİ: Her batch tamamlandığında ANINDA database'e kaydet!
        if (this.onBatchComplete && batchTenders.length > 0) {
          await this.onBatchComplete(batchTenders);
        }

        // Rate limiting: wait 500ms between batches
        if (batchEnd < tenderUrls.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Close all pages in the pool
      console.log(`\n🧹 Closing ${pages.length} browser pages...`);
      await Promise.all(pages.map(p => p.close()));

      // Retry failed URLs once (using the original page)
      if (failedUrls.length > 0) {
        console.log(`\n🔄 Retrying ${failedUrls.length} failed tenders...`);
        for (const url of failedUrls) {
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await new Promise(resolve => setTimeout(resolve, 300));

            const detailHtml = await page.content();
            const tender = this.parseDetailPage(detailHtml, url);

            if (tender) {
              allTenders.push(tender);
              console.log(`  ✅ Retry success: ${tender.title}`);
            }
          } catch (error) {
            console.warn(`  ❌ Retry failed: ${error}`);
          }
        }
      }

      await browser.close();

      console.log(`\n📊 Total (with login & details): ${allTenders.length} tenders scraped`);

      updateProgress('ihalebul', {
        status: 'completed',
        message: `✅ Tamamlandı! ${allTenders.length} ihale toplandı`,
        tendersFound: allTenders.length,
      });

      return allTenders;

    } catch (error) {
      this.logError('İhalebul scraping failed', error, this.config.baseUrl);
      updateProgress('ihalebul', {
        status: 'error',
        message: `❌ Hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      });
      throw error;
    }
  }

  private parseHTML(html: string): ScrapedTender[] {
    const $ = cheerio.load(html);
    const tenders: ScrapedTender[] = [];

    // İhalebul uses card-based layout:
    // <div class="card border-secondary my-2 mx-1">
    //   <div class="card-header">
    //     <a href="/tender/{id}" class="fw-medium...details" data-id="{id}">
    //       2025/1634941 - Yemek Hizmeti Alınacaktır
    //     </a>
    //   </div>
    //   <div class="card-body">
    //     <b>İhale başlığı:</b> <span>Yemek Hizmeti Alınacaktır</span>
    //   </div>
    //   <div class="card-body">
    //     <b>İdare adı:</b> <span>Kemal Serhadlı Polis Meslek Eğitim Merkezi Müdürlüğü</span>
    //   </div>
    //   <div class="text-dark-emphasis fw-medium">
    //     <iconify-icon icon="fa6-solid:sign-hanging"></iconify-icon>Adana
    //   </div>
    // </div>

    $('div.card.border-secondary').each((i, card) => {
      try {
        const $card = $(card);

        // Find the main tender link in card-header
        const $link = $card.find('.card-header a.details[href*="/tender/"]').first();
        if ($link.length === 0) return; // Skip if no tender link found

        // Skip cancelled, completed, or expired tenders
        const statusBadge = $card.find('.badge.text-danger, .badge:contains("İptal"), .badge:contains("Tamamlan"), .badge:contains("Sonuçlan")');
        if (statusBadge.length > 0) {
          console.log(`⏭️  Skipping cancelled/completed tender`);
          return;
        }

        const href = $link.attr('href') || '';
        const dataId = $link.attr('data-id') || '';
        const titleFromLink = this.cleanText($link.text()); // "2025/1634941 - Yemek Hizmeti Alınacaktır"

        // 🎯 Extract title with precise selectors
        const titleFromField = this.cleanText(
          $card.find('b:contains("İhale başlığı:")').next('span').text() ||
          $card.find('b:contains("İhale başlığı:")').siblings('span').first().text() ||
          $card.find('.card-body:has(b:contains("İhale başlığı:"))').find('span').first().text()
        );
        const title = titleFromField || titleFromLink.split(' - ').pop() || titleFromLink || 'Belirtilmemiş';

        // Extract Kayıt no (record number)
        const recordNo = this.cleanText(
          $card.find('b:contains("Kayıt no:")').next('span').text() ||
          $card.find('b:contains("Kayıt no:")').siblings('span').first().text() ||
          $card.find('.card-body:has(b:contains("Kayıt no:"))').find('span').first().text()
        );

        // 🎯 Extract organization with precise selectors
        const organization = this.cleanText(
          $card.find('b:contains("İdare adı:")').next('span').text() ||
          $card.find('b:contains("İdare adı:")').siblings('span').first().text() ||
          $card.find('.card-body:has(b:contains("İdare adı:"))').find('span').first().text() ||
          $card.find('b:contains("İhale mercii:")').next('span').text() ||
          'Belirtilmemiş'
        );

        // 🎯 Extract city with precise selector - avoid getting all text
        // Look for the specific element containing the city icon, then get only its direct text
        const cityElement = $card.find('.text-dark-emphasis.fw-medium:has(iconify-icon[icon="fa6-solid:sign-hanging"])');
        let cityText = '';
        if (cityElement.length > 0) {
          // Get only the text nodes, excluding nested elements
          cityText = this.cleanText(
            cityElement.clone().children().remove().end().text().replace('icon', '').trim()
          );
        }
        // Fallback selectors
        if (!cityText) {
          cityText = this.cleanText(
            $card.find('b:contains("İl:")').next('span').text() ||
            $card.find('b:contains("İl:")').siblings('span').first().text() ||
            $card.find('.card-body:has(b:contains("İl:"))').find('span').first().text()
          );
        }

        // Extract budget from "Tahmini bedel" field
        const budgetText = this.cleanText(
          $card.find('.card-body:contains("Tahmini bedel:") span').text() ||
          $card.find('.card-body:contains("Bedel:") span').text()
        );

          // Extract dates from separate text elements (not nested in same parent)
        const announcementDateEl = $card.find('.text-dark-emphasis:contains("Yayın tarihi:")');
        const announcementDateText = this.cleanText(
          announcementDateEl.text().replace('Yayın tarihi:', '').replace(/icon/g, '').trim() ||
          $card.find('.card-body:contains("İlan tarihi:") span').text()
        );

        const deadlineDateEl = $card.find('.text-dark-emphasis:contains("Teklif tarihi:")');
        const deadlineDateText = this.cleanText(
          deadlineDateEl.text().replace('Teklif tarihi:', '').replace(/icon/g, '').trim() ||
          $card.find('.card-body:contains("Son teklif:") span').text() ||
          $card.find('.card-body:contains("İhale tarihi:") span').text()
        );

        // FILTER: Skip Doğu Bölgesi cities
        const tenderCity = cityText || '';
        if (tenderCity && BLOCKED_CITIES.includes(tenderCity)) {
          console.log(`🚫 Skipping Doğu Bölgesi city: ${tenderCity}`);
          return;
        }

        const tender: Partial<ScrapedTender> = {
          source: 'ihalebul',
          source_id: dataId || recordNo || `IHB${Date.now()}${i}`,
          title: title,
          organization: organization,
          organization_city: cityText || undefined, // Don't use extractCity on full card text!
          budget: this.parseBudget(budgetText) || undefined,
          currency: 'TRY',
          announcement_date: this.parseDate(announcementDateText) || undefined,
          deadline_date: this.parseDate(deadlineDateText) || undefined,
          procurement_type: 'Hizmet Alımı',
          category: 'Yemek Hazırlama, Dağıtım, Catering',
          source_url: href.startsWith('http') ? href : this.config.baseUrl + href,
          scraped_at: new Date(),
        };

        if (this.validateTender(tender)) {
          tenders.push(tender as ScrapedTender);
        }
      } catch (error) {
        console.warn(`⚠️ İhalebul card ${i} parse error:`, error);
      }
    });

    console.log(`📊 İhalebul: ${tenders.length} tenders extracted from ${$('div.card.border-secondary').length} cards`);
    return tenders;
  }

  /**
   * 🆕 Extract metadata from list page (title, org, city)
   * Store in cache for later use in detail page
   */
  private extractMetadataFromListPage(html: string): void {
    const $ = cheerio.load(html);

    $('div.card.border-secondary').each((i, card) => {
      try {
        const $card = $(card);

        // Get source_id from link
        const $link = $card.find('.card-header a.details[href*="/tender/"]').first();
        const href = $link.attr('href') || '';
        const sourceIdMatch = href.match(/\/tender\/(\d+)/);
        if (!sourceIdMatch) return;

        const sourceId = sourceIdMatch[1];

        // Extract title - multiple strategies
        const titleFromLink = this.cleanText($link.text()); // "2025/1634941 - Yemek Hizmeti"
        const titleFromField = this.cleanText(
          $card.find('b:contains("İhale başlığı:")').next('span').text() ||
          $card.find('b:contains("İhale başlığı:")').parent().text().replace('İhale başlığı:', '').trim()
        );

        // Title from link usually has format "2025/123456 - TITLE", extract just title part
        let title = titleFromField || titleFromLink.split(' - ').pop() || titleFromLink || '';

        // Clean registration number prefix if present
        title = title.replace(/^\d{4}\/\d+\s*-?\s*/, '').trim();

        // Extract organization
        const organization = this.cleanText(
          $card.find('b:contains("İdare adı:")').next('span').text() ||
          $card.find('b:contains("İdare adı:")').parent().text().replace('İdare adı:', '').trim() ||
          $card.find('b:contains("İhale mercii:")').next('span').text() ||
          ''
        );

        // Extract city - ONLY from icon element, avoid getting all text
        const cityElement = $card.find('.text-dark-emphasis.fw-medium:has(iconify-icon[icon="fa6-solid:sign-hanging"])');
        let city = '';
        if (cityElement.length > 0) {
          // Clone element, remove all children, get only direct text
          city = this.cleanText(
            cityElement.clone().children().remove().end().text()
          );
        }

        // Store in cache
        if (sourceId && title) {
          this.metadataCache.set(sourceId, {
            title: title || 'Belirtilmemiş',
            organization: organization || 'Belirtilmemiş',
            city: city || ''
          });
        }
      } catch (error) {
        console.warn(`⚠️  Metadata extraction error:`, error);
      }
    });

    console.log(`📦 Metadata cached for ${this.metadataCache.size} tenders`);
  }

  private extractTenderUrls(html: string): string[] {
    const $ = cheerio.load(html);
    const urls: string[] = [];

    // İhalebul displays tenders in a list (numbered #1, #2, etc.)
    // Find links with format: /tender/NUMBER (main tender page only, not sub-pages)
    $('a[href*="/tender/"]').each((i, link) => {
      const href = $(link).attr('href');

      if (href) {
        let cleanUrl = href.startsWith('http') ? href : this.config.baseUrl + href;

        // Remove query parameters
        cleanUrl = cleanUrl.split('?')[0];

        // Only accept main tender pages: /tender/NUMBER
        // Skip sub-pages like /tender/NUMBER/follow, /tender/NUMBER/participants, etc.
        const tenderMatch = cleanUrl.match(/\/tender\/(\d+)$/);

        if (tenderMatch && !urls.includes(cleanUrl)) {
          urls.push(cleanUrl);
        }
      }
    });

    console.log(`🔗 Found ${urls.length} unique main tender URLs in HTML`);
    return urls;
  }

  private parseDetailPage(html: string, url: string): ScrapedTender | null {
    const $ = cheerio.load(html);

    try {
      // ============================================================
      // 🚀 MINIMAL SCRAPING - Sadece temel bilgiler!
      // AI analizi kullanıcı tıkladığında yapılacak (on-demand)
      // ============================================================

      // Extract source ID from URL FIRST
      const sourceId = url.split('/tender/')[1]?.split('?')[0] || `IHB${Date.now()}`;

      // 🆕 GET CACHED METADATA FROM LIST PAGE (list page'de doğru veriler var!)
      const cachedMetadata = this.metadataCache.get(sourceId);

      // 🎯 Extract title - ÖNCE CACHE'DEN AL, sonra detail page'den
      const titleFromLink = this.cleanText($('a.details[href*="/tender/"]').first().text());
      const titleFromField = this.cleanText(
        $('b:contains("İhale başlığı:")').next('span').text() ||
        $('b:contains("İhale başlığı:")').siblings('span').first().text() ||
        $('.card-body:has(b:contains("İhale başlığı:"))').find('span').first().text()
      );
      // 🆕 CACHE'DEN AL - List page'de doğru data var!
      let title = cachedMetadata?.title || titleFromField || titleFromLink || 'Belirtilmemiş';

      // 🎯 Extract organization - ÖNCE CACHE'DEN AL
      const organizationFromField = this.cleanText(
        $('b:contains("İdare adı:")').next('span').text() ||
        $('b:contains("İdare adı:")').siblings('span').first().text() ||
        $('.card-body:has(b:contains("İdare adı:"))').find('span').first().text() ||
        'Belirtilmemiş'
      );

      // 🆕 CACHE'DEN AL - List page'de doğru data var!
      let organization = cachedMetadata?.organization || organizationFromField;

      // Eğer organization aslında title ile aynıysa, selector yanlış çalışmış demektir
      if (organization === title && organization.length > 50 && !cachedMetadata) {
        console.warn(`⚠️  Organization ve title aynı: ${organization.slice(0, 50)}...`);
        organization = 'Belirtilmemiş';
      }

      // Eğer organization hala çok uzunsa (>200 char), ilk 200 karakteri al
      if (organization.length > 200) {
        organization = organization.slice(0, 200).trim();
      }

      // Extract city - ÖNCE CACHE'DEN AL
      const cityFromIcon = this.cleanText(
        $('.text-dark-emphasis.fw-medium:has(iconify-icon[icon="fa6-solid:sign-hanging"])').text().replace('icon', '').trim()
      );
      const cityFromModal = this.cleanText(
        $('.col-12.col-xs-9:has(iconify-icon[icon="fa6-solid:sign-hanging"]) .d-inline-block').text().trim()
      );
      // 🆕 CACHE'DEN AL - List page'de doğru data var!
      const cityText = cachedMetadata?.city || cityFromIcon || cityFromModal || undefined;

      // Filter: Skip Doğu Bölgesi cities
      if (cityText && BLOCKED_CITIES.includes(cityText)) {
        console.log(`  🚫 Skipping Doğu Bölgesi city: ${cityText}`);
        return null;
      }

      // 🆕 ZORUNLU: İhale kayıt numarasını çıkar (YYYY/NNNNNN formatı)
      // HTML'den "Kayıt no" alanını çek
      const recordNoFromField = this.cleanText($('.card-body:contains("Kayıt no:") span').text());

      // Regex ile tüm sayfadan kayıt no'yu çıkar (eğer field'da yoksa)
      let registrationNumber = recordNoFromField;
      if (!registrationNumber) {
        const bodyText = $('body').text();
        const regexMatch = bodyText.match(/202\d\/\d{6,7}/); // 2020-2029 arası yıllar, 6-7 haneli numara
        registrationNumber = regexMatch ? regexMatch[0] : '';
      }

      // 🆕 Kayıt numarasını raw_json içine minimal formatta kaydet
      const rawJson = registrationNumber ? { 'Kayıt no': registrationNumber } : null;

      // Extract tender date (İhale Tarihi) from table in announcement text
      // Format: "2.1. Tarih ve Saati : 06.11.2025 - 10:30"
      // Use Cheerio to find the specific table cell
      let tenderDateText = '';
      $('td:contains("2.1")').each((i, el) => {
        const cellText = $(el).text();
        if (cellText.includes('Tarih ve Saati')) {
          // Found the label cell, get the value from next siblings
          const nextCells = $(el).nextAll('td');
          nextCells.each((j, valueCell) => {
            const valueText = $(valueCell).text();
            const match = valueText.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
            if (match) {
              tenderDateText = match[1];
              return false; // Break loop
            }
          });
          return false; // Break outer loop
        }
      });
      const tenderDate = tenderDateText ? this.parseDate(tenderDateText) : undefined;

      // Extract announcement date (Yayın Tarihi) from footer div
      // Format: "Yayın tarihi: 7.10.2025"
      const announcementDateEl = $('div:contains("Yayın tarihi:")').filter((i: number, el: any) => {
        const text = $(el).text();
        return text.includes('Yayın tarihi:') && !!text.match(/\d{1,2}\.\d{1,2}\.\d{4}/);
      }).first();

      let announcementDateText = '';
      if (announcementDateEl.length > 0) {
        const fullText = announcementDateEl.text();
        const match = fullText.match(/Yayın tarihi[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})/i);
        announcementDateText = match ? match[1] : '';
      }
      const announcementDate = announcementDateText ? this.parseDate(announcementDateText) : undefined;

      // Extract deadline date (Teklif / İhale Tarihi) - flexible search
      // Format: "6 Kasım 2025 Perşembe 10:30" or "06.11.2025"
      let deadlineDateText = '';
      const deadlineLabelEl = $('div:contains("teklif")').add('div:contains("Teklif")').add('div:contains("İhale")').filter((i, el) => {
        const text = $(el).text().trim().toLowerCase();
        // Match variations: "teklif tarihi", "ihale tarihi", "son teklif tarihi"
        return (text.includes('teklif') || text.includes('ihale')) && text.includes('tarih');
      }).first();

      if (deadlineLabelEl.length > 0) {
        // Get next element (any type: div, span, p)
        const dateValueEl = deadlineLabelEl.next();
        if (dateValueEl.length > 0) {
          const fullText = dateValueEl.text().trim();
          // Match "6 Kasım 2025", "06.11.2025", "6/11/2025"
          const match = fullText.match(/(\d{1,2}[\.\s\/]?\s?\w+\s?[\.\s\/]?\d{4})/);
          deadlineDateText = match ? match[1] : '';
        }
      }
      const deadlineDate = deadlineDateText ? this.parseDate(deadlineDateText) : undefined;

      // 🔍 DEBUG
      if (sourceId === '1759785131303') {
        console.log(`🔍 NEW DEBUG [${sourceId}]:`);
        console.log(`   tenderDateText="${tenderDateText}", tenderDate=${tenderDate}`);
        console.log(`   announcementDateText="${announcementDateText}", announcementDate=${announcementDate}`);
        console.log(`   deadlineDateText="${deadlineDateText}", deadlineDate=${deadlineDate}`);
      }

      // ✅ TEMEL BİLGİLER + TARİHLER
      // ❌ Bütçe parsing YOK (AI tarafından yapılacak)
      // ❌ AI kategorilendirme YOK (on-demand)
      // ❌ Mal/hizmet listesi parsing YOK (on-demand)
      const tender: Partial<ScrapedTender> = {
        source: 'ihalebul',
        source_id: sourceId,
        title: title,
        organization: organization,
        organization_city: cityText || undefined,
        tender_date: tenderDate || undefined, // İhale tarihi (2.1. Tarih ve Saati)
        announcement_date: announcementDate || undefined, // Yayın tarihi (footer)
        deadline_date: deadlineDate || undefined, // Teklif son tarihi (card-body)
        source_url: url,
        scraped_at: new Date(),
        raw_json: rawJson || undefined, // 🆕 Kayıt numarası burada saklanacak
        // Diğer alanlar AI tarafından doldurulacak (on-demand)
      };

      // 🚨 ZORUNLU KONTROL: Kayıt numarası bulunamadıysa uyar ama skip etme (bazı ihaleler farklı formatta olabilir)
      if (!registrationNumber) {
        console.warn(`  ⚠️ Kayıt numarası bulunamadı: ${title.slice(0, 50)}...`);
      }

      if (this.validateTender(tender)) {
        return tender as ScrapedTender;
      }

      return null;
    } catch (error) {
      console.warn(`⚠️ Detail page parse error: ${error}`);
      return null;
    }
  }

  /**
   * 🆕 Şartname URL'lerini çıkart
   * İdari Şartname tercih edilir, yoksa Teknik Şartname alınır
   */
  private extractSpecificationUrl($: cheerio.CheerioAPI, sourceId: string): string | undefined {
    try {
      // İdari Şartname linki (öncelikli)
      const idariLink = $('a.details:contains("İdari Şartname")').attr('href');
      if (idariLink) {
        return idariLink.startsWith('http') ? idariLink : this.config.baseUrl + idariLink;
      }

      // Teknik Şartname linki (alternatif)
      const teknikLink = $('a.details:contains("Teknik Şartname")').attr('href');
      if (teknikLink) {
        return teknikLink.startsWith('http') ? teknikLink : this.config.baseUrl + teknikLink;
      }

      // Fallback: /tender/{ID}/7 formatında oluştur (İdari Şartname ID'si genelde 7'dir)
      if (sourceId) {
        return `${this.config.baseUrl}/tender/${sourceId}/7`;
      }

      return undefined;
    } catch (error) {
      console.warn(`⚠️ Specification URL extraction error:`, error);
      return undefined;
    }
  }

  /**
   * 🆕 İhale ilan metnini çıkart
   * Temiz, okunabilir metin olarak
   */
  private extractAnnouncementText($: cheerio.CheerioAPI): string | undefined {
    try {
      // İhalebul'da ilan metni genelde .tender-content veya .description içinde
      const announcementSelectors = [
        '.tender-content',
        '.description',
        '.tender-description',
        'div[class*="content"]',
        'div[class*="description"]',
      ];

      for (const selector of announcementSelectors) {
        const text = $(selector).first().text().trim();
        if (text && text.length > 50) {
          // En az 50 karakter olmalı
          return text;
        }
      }

      return undefined;
    } catch (error) {
      console.warn(`⚠️ Announcement text extraction error:`, error);
      return undefined;
    }
  }
}