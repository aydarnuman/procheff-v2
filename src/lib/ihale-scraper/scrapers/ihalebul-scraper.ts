// ============================================================================
// İHALEBUL.COM SCRAPER
// Commercial tender aggregator - Login Required
// ============================================================================

import { BaseScraper } from './base-scraper';
import type { ScrapedTender } from '../types';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { BLOCKED_CITIES } from '../config';
import { updateProgress } from '@/app/api/ihale-scraper/progress/route';

export class IhalebulScraper extends BaseScraper {
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

      // ✅ IMPROVED: Type like human + wait for response
      try {
        console.log('⌨️  Typing credentials like a human...');

        // Type slowly like human (anti-bot)
        await page.type('input[name="kul_adi"]', username, { delay: 100 });
        await page.waitForTimeout(500);
        await page.type('input[name="sifre"]', password, { delay: 100 });
        await page.waitForTimeout(500);

        console.log('🖱️  Clicking login button...');

        // Click button and wait for either navigation OR error message
        const [response] = await Promise.all([
          Promise.race([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => null),
            page.waitForSelector('.alert-danger, .error, [class*="error"]', { timeout: 10000 }).catch(() => null),
          ]),
          page.click('button[type="submit"][name="ok"]').catch(err => {
            console.error('Button click failed:', err.message);
          })
        ]);

        // Wait a bit for any post-submit JS
        await page.waitForTimeout(2000);

        console.log('✅ Form submitted');
      } catch (navError: any) {
        console.error('❌ Form submission failed:', navError?.message);
        const failHtml = await page.content();
        fs.writeFileSync('/tmp/ihalebul-submit-error.html', failHtml);
      }

      // Check if login was successful
      const afterLoginUrl = page.url();
      const afterLoginHtml = await page.content();

      // ⚠️ CHECK FOR ACCOUNT BLOCK FIRST
      if (afterLoginHtml.includes('Üye girişi engellendi') ||
          afterLoginHtml.includes('Müşteri hizmetleri ile iletişime geçiniz') ||
          afterLoginHtml.includes('hesabınız engellenmiştir') ||
          afterLoginHtml.includes('account blocked')) {
        console.error('🚨 ========================================');
        console.error('🚨 HESAP ENGELLENMİŞ!');
        console.error('🚨 ========================================');
        console.error('💬 Çözüm: İhalebul müşteri hizmetleri ile iletişime geçin');
        console.error('📞 İletişim: https://www.ihalebul.com/contact');
        console.error('⏰ Alternatif: 24 saat bekleyin veya farklı hesap deneyin');
        fs.writeFileSync('/tmp/ihalebul-account-blocked.html', afterLoginHtml);
        console.error('📄 Hata sayfası: /tmp/ihalebul-account-blocked.html');
        throw new Error('🚨 Account blocked - contact ihalebul.com support');
      }

      // Debug: Check cookies after login
      const cookies = await page.cookies();
      console.log('🍪 Cookies after login:', cookies.length, 'cookies');
      const sessionCookies = cookies.filter(c => c.name.toLowerCase().includes('session') || c.name.toLowerCase().includes('auth'));
      console.log('🔑 Session cookies:', sessionCookies.map(c => c.name));

      // ✅ IMPROVED: Check if actually logged in
      // 1. URL should NOT be /signin (should redirect away)
      // 2. Should have session cookies
      // 3. Should NOT see login form anymore

      const urlCheck = !afterLoginUrl.includes('/signin') && !afterLoginUrl.includes('/login');
      const cookieCheck = sessionCookies.length > 0 || cookies.length > 2; // CSRF + session cookies
      const htmlCheck = afterLoginHtml.includes('Çıkış') ||
                       afterLoginHtml.includes('Hesabım') ||
                       afterLoginHtml.includes('Profilim') ||
                       (!afterLoginHtml.includes('name="kul_adi"') && !afterLoginHtml.includes('name="sifre"'));

      console.log(`🔍 Login checks: URL=${urlCheck}, Cookies=${cookieCheck}, HTML=${htmlCheck}`);

      const isLoggedIn = urlCheck && (cookieCheck || htmlCheck);

      if (!isLoggedIn) {
        // Login failed
        fs.writeFileSync('/tmp/ihalebul-login-failed.html', afterLoginHtml);
        console.error('❌ Login failed!');
        console.error(`   URL check: ${urlCheck} (current: ${afterLoginUrl})`);
        console.error(`   Cookie check: ${cookieCheck} (${cookies.length} total, ${sessionCookies.length} session)`);
        console.error(`   HTML check: ${htmlCheck}`);
        console.error('📍 Saved failed login HTML to /tmp/ihalebul-login-failed.html');

        // Abort scraping
        throw new Error('Login failed - still at signin page or no session cookies. Check credentials.');
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
      console.log('🔍 Collecting tender URLs from list pages...');
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

        // Collect successful results from this batch
        const batchTenders: ScrapedTender[] = [];
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            batchTenders.push(result.value);
            allTenders.push(result.value);
          }
        }

        console.log(`✅ Batch complete: ${allTenders.length}/${tenderUrls.length} tenders scraped`);

        // 🆕 DATABASE KAYDET: Her batch'ten sonra database'e kaydet
        if (this.onBatchComplete && batchTenders.length > 0) {
          console.log(`💾 Saving ${batchTenders.length} tenders from this batch to database...`);
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

        // Extract title from "İhale başlığı" field (cleaner, without record number)
        const titleFromField = this.cleanText(
          $card.find('b:contains("İhale başlığı:")').parent().find('span').text() ||
          $card.find('.card-body:contains("İhale başlığı:") span').text()
        );
        const title = titleFromField || titleFromLink.split(' - ').pop() || titleFromLink || 'Belirtilmemiş';

        // Extract Kayıt no (record number)
        const recordNo = this.cleanText($card.find('.card-body:contains("Kayıt no:") span').text());

        // Extract organization from "İdare adı" field
        const organization = this.cleanText(
          $card.find('b:contains("İdare adı:")').parent().find('span').text() ||
          $card.find('.card-body:contains("İdare adı:") span').text() ||
          $card.find('b:contains("İhale mercii:")').parent().find('span').text() ||
          'Belirtilmemiş'
        );

        // Extract city from icon indicator
        const cityText = this.cleanText(
          $card.find('.text-dark-emphasis.fw-medium:has(iconify-icon[icon="fa6-solid:sign-hanging"])').text().replace('icon', '').trim() ||
          $card.find('.card-body:contains("İl:") span').text() ||
          $card.find('.card-body:contains("Şehir:") span').text()
        );

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
        const tenderCity = cityText || this.extractCity($card.text()) || '';
        if (tenderCity && BLOCKED_CITIES.includes(tenderCity)) {
          console.log(`🚫 Skipping Doğu Bölgesi city: ${tenderCity}`);
          return;
        }

        const tender: Partial<ScrapedTender> = {
          source: 'ihalebul',
          source_id: dataId || recordNo || `IHB${Date.now()}${i}`,
          title: title,
          organization: organization,
          organization_city: cityText || this.extractCity($card.text()),
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
    const fs = require('fs'); // fs import (debug için gerekli)

    try {
      // Extract source ID from URL (needed for debug and tender object)
      const sourceId = url.split('/tender/')[1]?.split('?')[0] || `IHB${Date.now()}`;

      // 🔍 DEBUG: İlk detay HTML'i kaydet
      if (sourceId && parseInt(sourceId) % 50 === 1) {
        const debugPath = `/tmp/ihalebul-detail-${sourceId}.html`;
        fs.writeFileSync(debugPath, html);
        console.log(`   🐛 DEBUG HTML saved: ${debugPath}`);
      }

      // 🆕 NEW HTML STRUCTURE: row-based layout (without :has() which Cheerio doesn't support)

      // Extract title - find label, then get next column
      let title = 'Belirtilmemiş';
      $('.bg-info-subtle').each((i, el) => {
        const labelText = $(el).text().trim();
        if (labelText === 'İhale başlığı') {
          const valueCol = $(el).parent().find('.responsive-right').first();
          title = this.cleanText(valueCol.text()) || 'Belirtilmemiş';
        }
      });

      // Extract organization - İlan metni içinden parse et
      let organization = 'Belirtilmemiş';

      // Önce .htmlcontent içinde ara (ihale ilan metni)
      const htmlContent = $('.htmlcontent').html() || '';
      console.log(`🔍 [DEBUG] htmlContent length:`, htmlContent.length);

      // "1.1. Adı : ORGANIZASYON ADI" pattern'ini bul
      const orgMatch = htmlContent.match(/<b>\s*1\.1\.\s*<\/b>\s*Adı\s*<\/td><td>\s*:\s*<\/td><td><span>\s*([^<]+)/i);
      console.log(`🔍 [DEBUG] orgMatch:`, orgMatch ? `Found: ${orgMatch[1]}` : 'NO MATCH');

      if (orgMatch && orgMatch[1]) {
        organization = this.cleanText(orgMatch[1]);
        console.log(`🔍 [DEBUG] İdare adı bulundu (htmlcontent):`, organization);
      } else {
        // Fallback: .bg-info-subtle içinde ara
        $('.bg-info-subtle').each((i, el) => {
          const labelText = $(el).text().trim();
          if (labelText === 'İdare adı') {
            const valueCol = $(el).parent().find('.responsive-right').first();
            const orgText = this.cleanText(
              valueCol.find('.d-block.border-bottom.fw-bold').text() ||
              valueCol.text()
            );
            console.log(`🔍 [DEBUG] İdare adı bulundu (bg-info-subtle):`, orgText);
            organization = orgText || 'Belirtilmemiş';
          }
        });
      }

      // 🐛 DEBUG: Save HTML for inspection
      const debugPath = `/tmp/ihalebul-detail-${sourceId}.html`;
      fs.writeFileSync(debugPath, html);
      console.log(`🐛 [DEBUG] HTML saved:`, debugPath, `(org: "${organization}", htmlContent.length: ${htmlContent.length})`);

      // Extract city - İlan metninden parse et
      let cityText: string | undefined = undefined;

      // "1.2. Adresi : ... ŞEHIR" pattern'inden şehir çıkar
      const cityMatch = htmlContent.match(/<b>\s*1\.2\.\s*<\/b>\s*Adresi\s*<\/td><td>\s*:\s*<\/td><td><span>\s*[^<]*?\s+([A-ZÇĞİÖŞÜ]+)\s*<\/span>/i);
      if (cityMatch && cityMatch[1]) {
        cityText = this.cleanText(cityMatch[1]);
        console.log(`🔍 [DEBUG] Şehir bulundu (htmlcontent):`, cityText);
      } else {
        // Fallback: icon-based city detection
        $('iconify-icon[icon="fa6-solid:sign-hanging"]').each((i, el) => {
          const parent = $(el).parent();
          const text = this.cleanText(parent.text());
          if (text && text !== 'icon') {
            cityText = text;
            console.log(`🔍 [DEBUG] Şehir bulundu (icon):`, cityText);
          }
        });
      }

      // Extract budget
      let budgetText = '';
      $('.bg-info-subtle').each((i, el) => {
        const labelText = $(el).text().trim();
        if (labelText.includes('Yaklaşık maliyet') || labelText.includes('maliyet limiti')) {
          const valueCol = $(el).parent().find('.responsive-right').first();
          budgetText = this.cleanText(valueCol.text());
        }
      });

      // Extract dates
      let announcementDateText = '';
      let deadlineDateText = '';
      // "2.1. Tarih ve Saati : 06.11.2025 - 10:30" pattern'i - İhale/Teklif tarihi
      const dateMatch = htmlContent.match(/<b>\s*2\.1\.\s*<\/b>\s*Tarih ve Saati\s*<\/td><td>\s*:\s*<\/td><td><span>\s*([^<]+)/i);
      if (dateMatch && dateMatch[1]) {
        deadlineDateText = this.cleanText(dateMatch[1]);
        console.log(`🔍 [DEBUG] İhale tarihi bulundu (htmlcontent):`, deadlineDateText);
      } else {
        // Fallback: .bg-info-subtle içinde ara
        $('.bg-info-subtle').each((i, el) => {
          const labelText = $(el).text().trim();
          if (labelText === 'Yayın tarihi') {
            const valueCol = $(el).parent().find('.responsive-right').first();
            announcementDateText = this.cleanText(valueCol.text());
          }
          if (labelText === 'Teklif tarihi') {
            const valueCol = $(el).parent().find('.responsive-right').first();
            deadlineDateText = this.cleanText(valueCol.text());
            console.log(`🔍 [DEBUG] Teklif tarihi bulundu (bg-info-subtle):`, deadlineDateText);
          }
        });
      }

      // Filter: Skip Doğu Bölgesi cities
      if (cityText && BLOCKED_CITIES.includes(cityText)) {
        console.log(`  🚫 Skipping Doğu Bölgesi city: ${cityText}`);
        return null;
      }

      const tender: Partial<ScrapedTender> = {
        source: 'ihalebul',
        source_id: sourceId,
        title: title,
        organization: organization,
        organization_city: cityText || undefined,
        budget: this.parseBudget(budgetText) || undefined,
        currency: 'TRY',
        announcement_date: this.parseDate(announcementDateText) || undefined,
        deadline_date: this.parseDate(deadlineDateText) || undefined,
        procurement_type: 'Hizmet Alımı',
        category: 'Yemek Hazırlama, Dağıtım, Catering',
        source_url: url,
        scraped_at: new Date(),
      };

      if (this.validateTender(tender)) {
        return tender as ScrapedTender;
      }

      return null;
    } catch (error) {
      console.warn(`⚠️ Detail page parse error: ${error}`);
      return null;
    }
  }
}