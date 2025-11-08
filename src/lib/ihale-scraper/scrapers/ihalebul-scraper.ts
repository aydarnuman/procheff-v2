import type { CheerioAPI } from 'cheerio';
// ============================================================================
// İHALEBUL.COM SCRAPER
// Commercial tender aggregator - Login Required
// ============================================================================

import { BaseScraper } from './base-scraper';
import type { ScrapedTender } from '../types';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { BLOCKED_CITIES, SCRAPER_CONFIG } from '../config';
import { updateProgress } from '@/app/api/ihale-scraper/progress/route';
import * as fs from 'fs';

export class IhalebulScraper extends BaseScraper {
  private mode: 'new' | 'full'; // 🆕 Scraping mode

  constructor(mode: 'new' | 'full' = 'new') {
    super(SCRAPER_CONFIG.ihalebul);
    this.mode = mode;
    console.log(`🎯 IhalebulScraper initialized in ${mode} mode (${mode === 'new' ? 'stop on duplicates' : 'scrape all pages'})`);
  }
  /**
   * Universal tenderInfo parser: #tender .row içindeki tüm key-value alanları map'ler
   * Kullanım: const info = this.parseTenderInfo($);
   * info['Kayıt no'], info['İhale başlığı'], info['Yayın tarihi'] vs. şeklinde erişilir
   */
  private parseTenderInfo($: CheerioAPI): Record<string, string> {
    const info: Record<string, string> = {};
    $('#tender .row').each((i, row) => {
      const key = $(row).find('.fw-bold').text().replace(/\s+/g, ' ').trim();
      const value = $(row).find('.text-dark-emphasis').text().replace(/\s+/g, ' ').trim();
      if (key && value) info[key] = value;
    });
    return info;
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

  /**
   * Auto-login with session management
   */
  private async autoLogin(page: any, username: string, password: string): Promise<boolean> {
    const fs = require('fs');
    const sessionFile = '/tmp/ihalebul-session.json';
    // Ensure a session file exists so other code reading it won't crash if it was deleted
    try {
      if (!fs.existsSync(sessionFile)) {
        const placeholder = { timestamp: new Date().toISOString(), url: '', cookies: [] };
        try { fs.writeFileSync(sessionFile, JSON.stringify(placeholder, null, 2)); console.log('ℹ️ Placeholder session file created at', sessionFile); } catch (e) { /* ignore write errors */ }
      }
    } catch (e) {
      // ignore filesystem permission errors
    }

    try {
      // If a recent saved session exists, restore cookies and skip login
      if (fs.existsSync(sessionFile)) {
        const sessionData = fs.readFileSync(sessionFile, 'utf8');
        const savedSession = JSON.parse(sessionData);
        const sessionAge = Date.now() - new Date(savedSession.timestamp).getTime();

        if (sessionAge < 3600000) { // 1 hour
          try {
            console.log('🔄 Restoring saved session (age: ' + Math.round(sessionAge / 60000) + ' minutes)');
            if (Array.isArray(savedSession.cookies) && savedSession.cookies.length > 0) {
              await page.setCookie(...savedSession.cookies);
              return true;
            }
          } catch (e) {
            console.warn('⚠️ Failed to restore saved session cookies:', e);
          }
        }
      }

      // No valid saved session found — load the dedicated login page and attempt AI login first
      try {
        await page.goto('https://www.ihalebul.com/signin', { waitUntil: 'networkidle2', timeout: 60000 });

        // ✅ İYİLEŞTİRME: JavaScript'in form'ları render etmesi için bekle
        console.log('⏳ Waiting for forms to load (2 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        // If the dedicated login page fails, continue and let performAILogin/Manual handle it
      }

      const html = await page.content();

      // Try AI-powered login, fall back to manual login if it fails
      const aiLoginSuccess = await this.performAILogin(page, html, username, password);
      if (aiLoginSuccess) return true;

      return await this.performManualLogin(page, username, password);
    } catch (error: any) {
      console.error('❌ autoLogin error:', error && error.message ? error.message : error);
      // Fallback to manual login on any unexpected error
      return await this.performManualLogin(page, username, password);
    }
  }

  /**
   * AI-powered login using HTML analysis
   */
  private async performAILogin(page: any, html: string, username: string, password: string): Promise<boolean> {
    try {
      // Import AI provider dynamically
      const { ClaudeProvider } = await import('@/lib/ai/claude-provider');
      const aiProvider = new ClaudeProvider();

      const prompt = `
Sen bir web scraping uzmanısın. Bu HTML sayfasında login formu var ve senin görevi bu formu otomatik olarak doldurup submit etmek.

## GÖREV:
HTML'deki login formunu analiz et ve JavaScript kodu üret.

## HTML İÇERİĞİ:
${html.substring(0, 8000)}

## KULLANICI BİLGİLERİ:
- Username: ${username}
- Password: ${password}

## ÖNEMLİ NOTLAR:
1. **DOĞRU FORMU SEÇ**: Sayfada birden fazla login formu var. İLK ÖNCE id="form" olan formu ara. Yoksa, .modal içinde OLMAYAN (modal dışındaki) formu seç.
2. **Input name'leri**: "kul_adi" ve "sifre" name'lerine sahip input'ları kullan.
3. **CSRF token**: Varsa otomatik gönderilir, elle doldurma
4. **Submit yöntemi**: form.submit() kullan (daha güvenilir)
5. **Modal formları atla**: .modal, .modal-dialog gibi elementlerin içindeki formları kullanma

## ÇIKTI FORMATI:
Sadece executable JavaScript kodu döndür. Örnek:

\`\`\`javascript
(function(username, password) {
  try {
    // ÖNCE: id="form" olan formu ara (ana login formu)
    let targetForm = document.getElementById('form');

    // Eğer yoksa: action="/signin" olan ve modal dışındaki formu bul
    if (!targetForm) {
      const forms = document.querySelectorAll('form[action*="/signin"]');
      for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        // Modal içinde mi kontrol et
        const inModal = form.closest('.modal, .modal-dialog, [class*="modal"]');
        if (!inModal) {
          const hasUsername = form.querySelector('input[name="kul_adi"]');
          const hasPassword = form.querySelector('input[name="sifre"]');
          if (hasUsername && hasPassword) {
            targetForm = form;
            break;
          }
        }
      }
    }

    if (!targetForm) return false;

    // Input'ları doldur - Gerçek kullanıcı etkileşimini simüle et
    const userInput = targetForm.querySelector('input[name="kul_adi"]');
    const passInput = targetForm.querySelector('input[name="sifre"]');

    if (userInput && passInput) {
      // Username input: focus, click, set value, trigger events
      userInput.focus();
      userInput.click();
      userInput.value = username;
      userInput.dispatchEvent(new Event('input', { bubbles: true }));
      userInput.dispatchEvent(new Event('change', { bubbles: true }));

      // Password input: focus, click, set value, trigger events
      passInput.focus();
      passInput.click();
      passInput.value = password;
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
      passInput.dispatchEvent(new Event('change', { bubbles: true }));

      // Submit button: prefer real button click over form.submit()
      const submitBtn = targetForm.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) {
        submitBtn.focus();
        submitBtn.click();
      } else {
        // Fallback to requestSubmit (better than submit() as it triggers validation)
        if (typeof targetForm.requestSubmit === 'function') {
          targetForm.requestSubmit();
        } else {
          targetForm.submit();
        }
      }
      return true;
    }

    return false;
  } catch (e) {
    console.error('Login error:', e);
    return false;
  }
})(arguments[0], arguments[1])
\`\`\`

Şimdi yukarıdaki HTML'i analiz et ve benzeri bir JavaScript kodu üret. Sadece kodu döndür, açıklama yapma.
`;

      // Get AI analysis using queryRaw
      const response = await aiProvider.queryRaw(prompt, {
        maxTokens: 2000,
        temperature: 0.1
      });

      if (!response) {
        console.error('❌ AI analysis failed');
        return false;
      }

      console.log('🤖 AI Login Instructions:', response);

      // Extract JavaScript code from AI response
      const jsCode = this.extractJSCode(response);
      if (!jsCode) {
        console.error('❌ Could not extract JavaScript code from AI response');
        return false;
      }

      console.log('🔧 Executing AI-generated login code...');

      // Execute the AI-generated JavaScript code
      const result = await page.evaluate(jsCode, username, password);

      if (result) {
        console.log('✅ AI login code executed!');

        // Wait for navigation after login
        console.log('⏳ Waiting for navigation after login...');
        try {
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
          console.log('✅ Navigation completed');
        } catch (navError) {
          console.log('⚠️ Navigation timeout (might be ok if login redirected)');
        }

        // Wait a bit for cookies to be set
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify we have cookies now
        const cookies = await page.cookies();
        console.log(`🍪 Cookies after AI login: ${cookies.length} total`);

        if (cookies.length > 0) {
          console.log(`🍪 Cookie names: ${cookies.map((c: any) => c.name).join(', ')}`);
          console.log('✅ AI login successful - cookies received!');
          return true;
        } else {
          console.warn('⚠️ AI login executed but no cookies received');
          return false;
        }
      } else {
        console.error('❌ AI login execution failed');
        return false;
      }

    } catch (error: any) {
      console.error('❌ AI login error:', error.message);
      return false;
    }
  }

  /**
   * Extract JavaScript code from AI response
   */
  private extractJSCode(aiResponse: string): string | null {
    // Try to find code blocks
    const codeBlockRegex = /```(?:javascript|js)?\n?([\s\S]*?)```/i;
    const match = aiResponse.match(codeBlockRegex);

    if (match) {
      return match[1].trim();
    }

    // Try to find function definitions or direct code
    const lines = aiResponse.split('\n');
    const codeLines = lines.filter(line =>
      line.includes('document.') ||
      line.includes('querySelector') ||
      line.includes('getElement') ||
      line.includes('form.') ||
      line.includes('submit()') ||
      line.includes('click()')
    );

    if (codeLines.length > 0) {
      return codeLines.join('\n');
    }

    return null;
  }

  /**
   * Fallback manual login method
   */
  private async performManualLogin(page: any, username: string, password: string): Promise<boolean> {
    try {
      console.log('🔐 Manual login fallback...');
      const fs = require('fs');

      await page.goto('https://www.ihalebul.com/signin', { waitUntil: 'networkidle2', timeout: 60000 });

      // ✅ İYİLEŞTİRME: JavaScript'in form'ları render etmesi için bekle
      console.log('⏳ Waiting for page to fully load (2 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      const formReady = await this.markVisibleLoginForm(page);
      if (!formReady) {
        const loginHtml = await page.content();
        fs.writeFileSync('/tmp/ihalebul-login-missing-form.html', loginHtml);
        console.error('❌ Visible login form not detected. Saved HTML to /tmp/ihalebul-login-missing-form.html');
        return false;
      }

      const usernameHandle = await page.$('[data-login-username="true"]');
      const passwordHandle = await page.$('[data-login-password="true"]');
      const submitHandle = await page.$('[data-login-submit="true"]');

      if (!usernameHandle || !passwordHandle || !submitHandle) {
        const loginHtml = await page.content();
        fs.writeFileSync('/tmp/ihalebul-login-missing-handles.html', loginHtml);
        console.error('❌ Login form handles missing after annotation. Saved HTML to /tmp/ihalebul-login-missing-handles.html');
        console.error('usernameHandle:', !!usernameHandle, 'passwordHandle:', !!passwordHandle, 'submitHandle:', !!submitHandle);
        return false;
      }

      await usernameHandle.click({ clickCount: 3 }).catch(() => undefined);
      await usernameHandle.type(username, { delay: 60 });
      await passwordHandle.click({ clickCount: 3 }).catch(() => undefined);
      await passwordHandle.type(password, { delay: 60 });

      console.log('🔐 Submitting login form...');

      const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => null);
      const responsePromise = page.waitForResponse((res: any) => res.url().includes('/signin') && res.request().method() === 'POST', { timeout: 20000 }).catch(() => null);

      try {
        await submitHandle.evaluate((element: Element) => {
          const el = element as HTMLElement;
          const form = el.closest('form') as HTMLFormElement | null;
          if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) {
            el.click();
          }
          if (form) {
            if (typeof form.requestSubmit === 'function') {
              form.requestSubmit();
            } else {
              form.submit();
            }
          }
          if (!form && !(el instanceof HTMLButtonElement || el instanceof HTMLInputElement)) {
            el.dispatchEvent(new Event('click', { bubbles: true }));
          }
        });
      } catch (submitError) {
        console.warn('⚠️ Submit evaluation failed, falling back to direct click:', submitError);
        await submitHandle.click().catch(() => undefined);
      }

      await Promise.race([
        navigationPromise,
        responsePromise,
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
      await Promise.allSettled([navigationPromise, responsePromise]);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const afterLoginUrl = page.url();
      const afterLoginHtml = await page.content();

        // DEBUG: Login sonrası gelen HTML'i her durumda kaydet
        try {
          const fs = require('fs');
          fs.writeFileSync('/tmp/ihalebul-login-debug.html', afterLoginHtml);
          console.log('🐛 Debug: Login sonrası HTML kaydedildi /tmp/ihalebul-login-debug.html');
        } catch (e) {
          console.warn('⚠️ Login debug HTML kaydedilemedi:', e);
        }

      if (afterLoginHtml.includes('Üye girişi engellendi') ||
          afterLoginHtml.includes('Müşteri hizmetleri ile iletişime geçiniz') ||
          afterLoginHtml.includes('hesabınız engellenmiştir') ||
          afterLoginHtml.includes('account blocked')) {
        fs.writeFileSync('/tmp/ihalebul-account-blocked.html', afterLoginHtml);
        console.error('🚨 Hesap engellenmiş olabilir. /tmp/ihalebul-account-blocked.html dosyasına kaydedildi.');
        return false;
      }

      const cookies = await page.cookies();
      const sessionCookies = cookies.filter((c: any) => /session|auth|token/i.test(c.name));
      console.log('🍪 Cookies after manual login:', cookies.length, 'total');
      console.log('🔑 Session-like cookies:', sessionCookies.map((c: any) => c.name));

      const urlLower = afterLoginUrl.toLowerCase();
      const urlCheck = !urlLower.includes('/signin') && !urlLower.includes('/login') && !urlLower.includes('giris');

      const htmlIndicators = [
        'Çıkış',
        'Çıkış Yap',
        'Oturumu Kapat',
        'Hesabım',
        'Profilim',
        'Abonelik Bilgileri',
        'hoş geldiniz',
        'hos geldiniz',
        'ihale aboneliğiniz'
      ];
      const htmlCheck = htmlIndicators.some(token => afterLoginHtml.toLowerCase().includes(token.toLowerCase())) ||
        (!afterLoginHtml.includes('name="kul_adi"') && !afterLoginHtml.includes('name="sifre"') && !afterLoginHtml.includes('type="password" name="password"'));

      const isLoggedIn = urlCheck && (sessionCookies.length > 0 || htmlCheck);

      if (!isLoggedIn) {
        fs.writeFileSync('/tmp/ihalebul-login-failed.html', afterLoginHtml);
        console.error('❌ Manual login failed. Saved HTML to /tmp/ihalebul-login-failed.html');
        console.error(`   URL check: ${urlCheck} (current: ${afterLoginUrl})`);
        console.error(`   Session cookie check: ${sessionCookies.length > 0}`);
        console.error(`   HTML indicator check: ${htmlCheck}`);
        return false;
      }

      await this.saveSession(page);
      console.log('✅ Manual login successful!');
      console.log(`📍 Current URL: ${afterLoginUrl}`);
      return true;

    } catch (error: any) {
      console.error('❌ Manual login error:', error.message);
      return false;
    }
  }

  /**
   * ✅ İYİLEŞTİRİLMİŞ - Debug script'teki başarılı yöntem
   * İhalebul'da 3 form var: 1 mobil modal (gizli), 2 desktop görünür
   * Görünür formu seçiyoruz
   */
  private async markVisibleLoginForm(page: any): Promise<boolean> {
    return page.evaluate(() => {
      const isVisible = (el: Element | null): boolean => {
        if (!el) return false;
        const style = window.getComputedStyle(el as HTMLElement);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        const rect = (el as HTMLElement).getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      // İhalebul: form[action*="signin"] kullan (3 adet var)
      const signinForms = Array.from(document.querySelectorAll('form[action*="signin"]'));

      if (signinForms.length === 0) {
        console.error('[markVisibleLoginForm] Signin formu bulunamadı!');
        return false;
      }

      console.log(`[markVisibleLoginForm] ${signinForms.length} adet signin formu bulundu`);

      // Görünür formu bul (tercih: görünür, fallback: son form)
      let targetForm: Element | null = null;
      for (const form of signinForms) {
        if (isVisible(form)) {
          targetForm = form;
          console.log('[markVisibleLoginForm] Görünür signin formu bulundu');
          break;
        }
      }

      if (!targetForm) {
        // Fallback: son formu kullan (genelde desktop formu)
        targetForm = signinForms[signinForms.length - 1];
        console.log('[markVisibleLoginForm] Görünür form yok, son formu kullanıyorum');
      }

      // Form içinde input'ları bul
      const usernameInput = targetForm.querySelector('input[name="kul_adi"]');
      const passwordInput = targetForm.querySelector('input[type="password"]');
      const submitButton = targetForm.querySelector('button[type="submit"], input[type="submit"]');

      if (!usernameInput || !passwordInput || !submitButton) {
        console.error('[markVisibleLoginForm] Form inputları eksik:', {
          username: !!usernameInput,
          password: !!passwordInput,
          submit: !!submitButton
        });
        return false;
      }

      // Mark elements for easy finding later
      usernameInput.setAttribute('data-login-username', 'true');
      passwordInput.setAttribute('data-login-password', 'true');
      submitButton.setAttribute('data-login-submit', 'true');
      targetForm.setAttribute('data-login-form', 'true');

      console.log('[markVisibleLoginForm] ✅ Form işaretlendi');
      return true;
    });
  }

  /**
   * Save session cookies
   */
  private async saveSession(page: any): Promise<void> {
    try {
      const fs = require('fs');

      // Wait a bit to ensure cookies are set
      await new Promise(resolve => setTimeout(resolve, 1000));

      const cookies = await page.cookies();
      const currentUrl = page.url();

      console.log(`📍 Saving session from URL: ${currentUrl}`);
      console.log(`🍪 Total cookies: ${cookies.length}`);

      if (cookies.length === 0) {
        console.warn('⚠️ No cookies found! Login might have failed.');
      }

      const sessionInfo = {
        timestamp: new Date().toISOString(),
        url: currentUrl,
        cookies: cookies,
        sessionCookies: cookies.filter((c: any) =>
          c.name.toLowerCase().includes('session') ||
          c.name.toLowerCase().includes('auth') ||
          c.name.toLowerCase().includes('token')
        ),
      };

      fs.writeFileSync('/tmp/ihalebul-session.json', JSON.stringify(sessionInfo, null, 2));
      console.log('💾 Session saved successfully!');
      console.log(`   Cookies: ${cookies.length} total, ${sessionInfo.sessionCookies.length} auth-related`);

      // Debug: Log cookie names
      if (cookies.length > 0) {
        console.log(`   Cookie names: ${cookies.map((c: any) => c.name).join(', ')}`);
      }
    } catch (error) {
      console.error('❌ Error saving session:', error);
    }
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

        // Navigate to category page with domcontentloaded (better for SPA/AJAX pages)
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for tenders to be loaded by JavaScript - pages load slowly via AJAX/DataTables!
        console.log('⏳ Waiting for tender cards to load...');

        try {
          // Stage 1: Wait for first card to be visible
          await page.waitForSelector('div.card.border-secondary', {
            visible: true,
            timeout: 20000
          });
          console.log('  ✓ First tender card appeared');

          // Stage 2: Wait for multiple cards to be loaded (minimum 3 cards)
          await page.waitForFunction(
            () => {
              const cards = document.querySelectorAll('div.card.border-secondary');
              return cards.length >= 3;
            },
            { timeout: 20000 }
          );
          console.log(`  ✓ Multiple tender cards loaded`);

          // Stage 3: Validate that cards have actual content (check for tender links)
          const hasValidContent = await page.evaluate(() => {
            const cards = document.querySelectorAll('div.card.border-secondary');
            if (cards.length < 3) return false;

            // Check if first card has tender detail link
            const firstCard = cards[0];
            return !!firstCard.querySelector('a[href*="/tenders/view/"]');
          });

          if (!hasValidContent) {
            console.warn('⚠️ Cards found but content validation failed');
          } else {
            console.log('  ✓ Content validation passed');
          }

          // Small stabilization delay for scroll/animation
          await new Promise(resolve => setTimeout(resolve, 1500));

        } catch (e) {
          console.error('❌ Failed to load tender cards:', e instanceof Error ? e.message : String(e));

          // Save debug HTML
          const debugHtml = await page.content();
          const debugPath = `/tmp/ihalebul-failed-page${pageNum}-public.html`;
          fs.writeFileSync(debugPath, debugHtml);
          console.log(`🐛 Debug HTML saved to ${debugPath}`);

          // Don't continue if cards didn't load
          console.warn(`⚠️ Skipping page ${pageNum} due to loading failure`);
          continue;
        }

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

      // Run in headless mode (production)
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
      const fs = require('fs');

      let sessionActive = false;

      // Try auto-login first (new method)
      const autoLoginSuccess = await this.autoLogin(page, username, password);
      if (autoLoginSuccess) {
        sessionActive = true;
        console.log('✅ Auto-login successful, proceeding with scraping...');
        await this.saveSession(page);
        try {
          console.log('📄 Navigating to tenders page...');
          await page.goto('https://www.ihalebul.com/tenders', { waitUntil: 'networkidle2', timeout: 60000 });
        } catch (navError) {
          console.warn('⚠️ Navigation after auto-login failed:', navError);
        }
      } else {
        console.log('⚠️ Auto-login failed, checking saved session or manual login...');
      }

      // Check if we have a saved session (within last hour) if auto-login did not already establish one
      if (!sessionActive) {
        try {
          const sessionData = fs.readFileSync('/tmp/ihalebul-session.json', 'utf8');
          const savedSession = JSON.parse(sessionData);
          const sessionAge = Date.now() - new Date(savedSession.timestamp).getTime();

          if (sessionAge < 3600000) { // 1 hour
            console.log('🔄 Restoring saved session (age: ' + Math.round(sessionAge / 60000) + ' minutes)');
            if (Array.isArray(savedSession.cookies) && savedSession.cookies.length > 0) {
              await page.setCookie(...savedSession.cookies);
              sessionActive = true;
            } else {
              console.log('⚠️ Saved session exists but contains no cookies — will perform fresh login');
            }
          } else {
            console.log('⏰ Saved session expired (age: ' + Math.round(sessionAge / 60000) + ' minutes)');
          }
        } catch (err) {
          console.log('📝 No saved session found, will login fresh');
        }
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
      if (!sessionActive) {
        console.log('🔐 Logging in to İhalebul (fresh session)...');
        const loginOk = await this.performManualLogin(page, username, password);
        if (!loginOk) {
          throw new Error('Login failed - unable to authenticate on İhalebul');
        }
        sessionActive = true;
      } else {
        console.log('✅ Using existing session - skipping fresh login');
        await page.goto('https://www.ihalebul.com/tenders', { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('📍 Navigated to tenders page with existing session');
      }

      // Step 2: Navigate to /tenders first (required for session), then search
      console.log('📍 Navigating to /tenders first (to establish session)...');
      await page.goto(`${this.config.baseUrl}/tenders`, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

        // DEBUG: Login sonrası /tenders sayfasının HTML'ini kaydet
        try {
          const debugHtml = await page.content();
          const fs = require('fs');
          fs.writeFileSync('/tmp/ihalebul-tenders.html', debugHtml);
          console.log('🐛 Debug: /tenders HTML kaydedildi /tmp/ihalebul-tenders.html');
        } catch (e) {
          console.warn('⚠️ Debug HTML kaydedilemedi:', e);
        }

      // Step 3: Now collect all tender URLs from search pages
      console.log('🔍 Collecting tender URLs from list pages...');
      const tenderUrls: string[] = [];
      const maxPages = 10; // 🔧 Reduced to 10 to avoid rate limiting and account blocks

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

        // Navigate to category page with domcontentloaded (better for SPA/AJAX pages)
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for tenders to be loaded by JavaScript - pages load slowly via AJAX/DataTables!
        console.log('⏳ Waiting for tender cards to load...');

        try {
          // Stage 1: Wait for first card to be visible
          await page.waitForSelector('div.card.border-secondary', {
            visible: true,
            timeout: 20000
          });
          console.log('  ✓ First tender card appeared');

          // Stage 2: Wait for multiple cards to be loaded (minimum 3 cards)
          await page.waitForFunction(
            () => {
              const cards = document.querySelectorAll('div.card.border-secondary');
              return cards.length >= 3;
            },
            { timeout: 20000 }
          );
          console.log(`  ✓ Multiple tender cards loaded`);

          // Stage 3: Validate that cards have actual content (check for tender links)
          const hasValidContent = await page.evaluate(() => {
            const cards = document.querySelectorAll('div.card.border-secondary');
            if (cards.length < 3) return false;

            // Check if first card has tender detail link
            const firstCard = cards[0];
            return !!firstCard.querySelector('a[href*="/tenders/view/"]');
          });

          if (!hasValidContent) {
            console.warn('⚠️ Cards found but content validation failed');
          } else {
            console.log('  ✓ Content validation passed');
          }

          // Small stabilization delay for scroll/animation
          await new Promise(resolve => setTimeout(resolve, 1500));

        } catch (e) {
          console.error('❌ Failed to load tender cards:', e instanceof Error ? e.message : String(e));

          // Save debug HTML
          const debugHtml = await page.content();
          const debugPath = `/tmp/ihalebul-failed-page${pageNum}-login.html`;
          fs.writeFileSync(debugPath, debugHtml);
          console.log(`🐛 Debug HTML saved to ${debugPath}`);

          // Don't continue if cards didn't load
          console.warn(`⚠️ Skipping page ${pageNum} due to loading failure`);
          continue;
        }

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

        // 🆕 EARLY DUPLICATE CHECK (mode=new only)
        if (this.mode === 'new' && urls.length > 0) {
          const { TenderDatabase } = await import('../database');
          
          // Extract source_ids from URLs (regex: /tender/(\d+))
          const sourceIds = urls.map(url => {
            const match = url.match(/\/tender\/(\d+)/);
            return match ? match[1] : null;
          }).filter(Boolean) as string[];

          // Check how many already exist in DB (async)
          let duplicatesOnPage = 0;
          for (const sourceId of sourceIds) {
            const exists = await TenderDatabase.tenderExists('ihalebul', sourceId);
            if (exists) duplicatesOnPage++;
          }

          const newTendersOnPage = urls.length - duplicatesOnPage;

          console.log(`📊 Duplicate analysis: ${duplicatesOnPage}/${urls.length} exist, ${newTendersOnPage} new`);

          // ✋ STOP PAGINATION: If entire page is duplicates, we've reached known tenders
          if (duplicatesOnPage === urls.length) {
            console.log(`\n🛑 MODE=NEW: All ${urls.length} tenders on page ${pageNum} already exist`);
            console.log(`✅ Stopping pagination early (no new tenders found)`);
            break; // Exit pagination loop
          }
        }

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

        // Extract Kayıt no (record number) from link text: "2025/1845237 - Title"
        const linkTextParts = titleFromLink.split(' - ');
        // Eski çıkarım
        const recordNoFromLink = linkTextParts.length > 1 && linkTextParts[0].match(/^\d{4}\/\d+$/)
          ? linkTextParts[0]
          : '';
        // Yeni: .tender-code veya kartın metninden ILN/2025/xxxx formatı
        let ihaleNo =
          $card.find('.tender-code').text().trim() ||
          $card.text().match(/(?:ihale[\s_-]*kayıt[\s_-]*no|kayıt[\s_-]*no|kayıt[\s_-]*numarası)[^\d]*(ILN\d{6,}|20\d{2}\/\d{5,}|\d{4}\/\d{5,})/i)?.[1] ||
          $card.text().match(/ILN\d{6,}|20\d{2}\/\d{5,}/)?.[0] ||
          recordNoFromLink ||
          '';

        // Extract title from "İhale başlığı" field (cleaner, without record number)
        const titleFromField = this.cleanText(
          $card.find('b:contains("İhale başlığı:")').parent().find('span').text() ||
          $card.find('.card-body:contains("İhale başlığı:") span').text()
        );
        const title = titleFromField || linkTextParts.pop() || titleFromLink || 'Belirtilmemiş';

        const recordNo = ihaleNo;
        // Extract organization from "İdare adı" field
        const organization = this.cleanText(
          $card.find('b:contains("İdare adı:")').parent().find('span').text() ||
          $card.find('.card-body:contains("İdare adı:") span').text() ||
          $card.find('b:contains("İhale mercii:")').parent().find('span').text() ||
          'Belirtilmemiş'
        );
        // Extract city from icon indicator (take only the first match)
        const cityText = this.cleanText(
          $card.find('.text-dark-emphasis.fw-medium:has(iconify-icon[icon="fa6-solid:sign-hanging"])').first().text().replace('icon', '').trim() ||
          $card.find('.card-body:contains("İl:") span').first().text() ||
          $card.find('.card-body:contains("Şehir:") span').first().text()
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
          registration_number: recordNo || undefined,
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
      const sourceId = url.split('/tender/')[1]?.split('?')[0] || `IHB${Date.now()}`;
      const $ = cheerio.load(html);
      const tenderData = this.parseTenderInfo($);
      const htmlContent = $('.htmlcontent').html() || '';

      // Kayıt No
      let kayitNo = tenderData['Kayıt no'];
      if (!kayitNo) {
        const iknMatch = htmlContent.match(/İhale Kayıt Numarası[^<]*<b>\s*:\s*<\/b>[^<]*<b>\s*([\d]{4}\/\d+)\s*<\/b>/i);
        if (iknMatch && iknMatch[1]) kayitNo = iknMatch[1];
        else {
          const regexMatch = htmlContent.match(/(ILN\d{6,}|20\d{2}\/\d{5,}|\d{4}\/\d{5,})/);
          if (regexMatch && regexMatch[1]) kayitNo = regexMatch[1];
        }
      }

      // Başlık
      const title = tenderData['İhale başlığı'] || 'Belirtilmemiş';

      // Organization
      // Tek tanım: organization, cityText, budgetText, announcementDateText, deadlineDateText
      let organization = 'Belirtilmemiş';
      let cityText: string | undefined = undefined;
      let budgetText: string = tenderData['Yaklaşık maliyet limiti'] || '';
      let announcementDateText: string = tenderData['Yayın tarihi'] || '';
      let deadlineDateText: string = tenderData['Teklif tarihi'] || '';
      
      // ✅ FIXED: Extract deadline date from "2.1. Tarih ve Saati" in htmlContent
      const deadlineMatch = htmlContent.match(/<b>\s*2\.1\.\s*<\/b>\s*Tarih ve Saati\s*<\/td><td>\s*:\s*<\/td><td><span>\s*([^<]+)\s*<\/span>/i);
      if (deadlineMatch && deadlineMatch[1]) {
        deadlineDateText = this.cleanText(deadlineMatch[1]); // "06.11.2025 - 10:30"
      }

      // Organization
      {
        const orgMatch = htmlContent.match(/<b>\s*1\.1\.\s*<\/b>\s*Adı\s*<\/td><td>\s*:\s*<\/td><td><span>\s*([^<]+)/i);
        if (orgMatch && orgMatch[1]) {
          organization = this.cleanText(orgMatch[1]);
        } else if (tenderData['İdare adı']) {
          organization = tenderData['İdare adı'];
        }
      }

      // City
      {
        // Method 1: From "1.2. Adresi" in htmlContent
        const cityMatch = htmlContent.match(/<b>\s*1\.2\.\s*<\/b>\s*Adresi\s*<\/td><td>\s*:\s*<\/td><td><span>\s*[^<]*?([A-ZÇĞİÖŞÜ]+)\s*<\/span>/i);
        if (cityMatch && cityMatch[1]) {
          cityText = this.cleanText(cityMatch[1]);
        }
        
        // Method 2: From icon div outside htmlContent
        if (!cityText) {
          const $cityDiv = $('div.d-inline-block:has(iconify-icon[icon="fa6-solid:sign-hanging"])');
          if ($cityDiv.length > 0) {
            const cityFromDiv = $cityDiv.first().text().replace(/icon/g, '').trim();
            if (cityFromDiv && cityFromDiv.length < 30) {
              cityText = this.cleanText(cityFromDiv);
            }
          }
        }
        
        // Method 3: From tenderData (fallback)
        if (!cityText && tenderData['İşin yapılacağı yer']) {
          cityText = tenderData['İşin yapılacağı yer'];
        }
      }

      // Filter: Skip Doğu Bölgesi cities
      if (cityText && BLOCKED_CITIES.includes(cityText)) {
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
        registration_number: kayitNo || undefined,
        source_url: url,
        scraped_at: new Date(),
        announcement_text: htmlContent || undefined, // ✅ FIX: İhale metnini kaydet
      };

  // --- Tüm tekrar eden ve eski kod blokları kaldırıldı ---
  return tender as ScrapedTender;
    } catch (error) {
      console.warn(`⚠️ Detail page parse error: ${error}`);
      return null;
    }
  }
}