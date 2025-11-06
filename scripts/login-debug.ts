#!/usr/bin/env tsx
/**
 * İHALEBUL LOGIN DEBUG SCRIPT (Puppeteer)
 *
 * Amaç: Login sürecini detaylı şekilde tanılamak
 * - Console ve network logları
 * - Screenshots (her adımda)
 * - HTML dumps
 * - CSRF token tespiti
 * - Anti-bot/Cloudflare tespiti
 * - Cookie analizi
 *
 * Kullanım:
 *   IHALEBUL_USERNAME="..." IHALEBUL_PASSWORD="..." npx tsx scripts/login-debug.ts
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const TMP_DIR = '/tmp';

interface LoginDebugResult {
  success: boolean;
  finalUrl: string;
  cookies: any[];
  sessionCookies: any[];
  errors: string[];
  warnings: string[];
  artifacts: {
    screenshots: string[];
    htmlDumps: string[];
    logs: string[];
  };
}

async function runLoginDebug(): Promise<LoginDebugResult> {
  const username = process.env.IHALEBUL_USERNAME;
  const password = process.env.IHALEBUL_PASSWORD;

  if (!username || !password) {
    throw new Error('IHALEBUL_USERNAME ve IHALEBUL_PASSWORD environment variable\'ları gerekli');
  }

  console.log('🔍 İHALEBUL LOGIN DEBUG BAŞLADI');
  console.log('📝 Tüm artefaktlar /tmp dizinine kaydedilecek\n');

  const result: LoginDebugResult = {
    success: false,
    finalUrl: '',
    cookies: [],
    sessionCookies: [],
    errors: [],
    warnings: [],
    artifacts: {
      screenshots: [],
      htmlDumps: [],
      logs: []
    }
  };

  const consoleLogPath = path.join(TMP_DIR, 'ihalebul-debug-console.log');
  const networkLogPath = path.join(TMP_DIR, 'ihalebul-debug-network.log');

  // Clear old logs
  [consoleLogPath, networkLogPath].forEach(file => {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  result.artifacts.logs.push(consoleLogPath, networkLogPath);

  // Browser launch - HEADFUL mode for debugging
  console.log('🚀 Browser başlatılıyor (headful mode)...');
  const browser = await puppeteer.launch({
    headless: false, // Görünür mod - debug için önemli
    slowMo: 100, // Yavaş çalıştır
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ]
  });

  const page = await browser.newPage();

  // Set realistic user agent
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  // Hide automation indicators
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR', 'tr', 'en-US', 'en'] });
  });

  // Console logging
  page.on('console', msg => {
    const logLine = `[${msg.type()}] ${msg.text()}\n`;
    fs.appendFileSync(consoleLogPath, logLine);
  });

  // Network logging
  page.on('response', async (res) => {
    try {
      const url = res.url();
      const status = res.status();
      const request = res.request();
      const method = request.method();

      // Log all authentication-related requests
      if (
        status >= 400 ||
        /login|signin|auth|session/i.test(url) ||
        method === 'POST'
      ) {
        const headers = res.headers();
        let body = '';

        try {
          const contentType = headers['content-type'] || '';
          if (contentType.includes('text') || contentType.includes('json')) {
            body = await res.text();
          }
        } catch {}

        const logEntry = `
========================================
[${method}] ${status} ${url}
Time: ${new Date().toISOString()}
Headers: ${JSON.stringify(headers, null, 2)}
Body (first 1000 chars): ${body.substring(0, 1000)}
========================================
`;
        fs.appendFileSync(networkLogPath, logEntry);
      }
    } catch (err) {
      // Ignore errors in logging
    }
  });

  try {
    // Step 1: Navigate to login page
    console.log('\n📄 1/6: Login sayfasına gidiliyor...');
    await page.goto('https://www.ihalebul.com/signin', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait a bit for JavaScript to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Screenshot 1: Initial login page
    const screenshot1 = path.join(TMP_DIR, 'ihalebul-debug-1-initial.png');
    await page.screenshot({ path: screenshot1, fullPage: true });
    result.artifacts.screenshots.push(screenshot1);
    console.log('  ✅ Screenshot: ' + screenshot1);

    // HTML dump 1: Initial page
    const htmlDump1 = path.join(TMP_DIR, 'ihalebul-debug-1-initial.html');
    const html1 = await page.content();
    fs.writeFileSync(htmlDump1, html1);
    result.artifacts.htmlDumps.push(htmlDump1);
    console.log('  ✅ HTML dump: ' + htmlDump1);

    // Step 2: Check for anti-bot protection
    console.log('\n🛡️  2/6: Anti-bot kontrolü...');

    const antiBotIndicators = [
      { pattern: /cloudflare/i, name: 'Cloudflare' },
      { pattern: /cf-chl-bypass/i, name: 'Cloudflare Challenge' },
      { pattern: /turnstile/i, name: 'Cloudflare Turnstile' },
      { pattern: /g-recaptcha/i, name: 'Google reCAPTCHA' },
      { pattern: /h-captcha/i, name: 'hCaptcha' },
    ];

    for (const indicator of antiBotIndicators) {
      if (indicator.pattern.test(html1)) {
        const warning = `⚠️  ${indicator.name} tespit edildi!`;
        console.log('  ' + warning);
        result.warnings.push(warning);
      }
    }

    // Step 3: Find and analyze login form
    console.log('\n📋 3/6: Login formu analizi...');

    // Check for forms
    const formsInfo = await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      return forms.map((form, index) => {
        const action = form.getAttribute('action') || '';
        const method = form.getAttribute('method') || 'GET';
        const style = window.getComputedStyle(form);
        const rect = form.getBoundingClientRect();
        const isVisible = style.display !== 'none' &&
                         style.visibility !== 'hidden' &&
                         parseFloat(style.opacity) > 0 &&
                         rect.width > 0 &&
                         rect.height > 0;

        const inputs = Array.from(form.querySelectorAll('input')).map(inp => ({
          name: inp.getAttribute('name'),
          type: inp.getAttribute('type'),
          placeholder: inp.getAttribute('placeholder')
        }));

        return {
          index,
          action,
          method,
          isVisible,
          inputs
        };
      });
    });

    console.log(`  ℹ️  Toplam ${formsInfo.length} form bulundu`);
    formsInfo.forEach(f => {
      console.log(`     Form ${f.index + 1}: action="${f.action}", visible=${f.isVisible}`);
      if (f.inputs.length > 0) {
        console.log(`       Inputs: ${f.inputs.map(i => `${i.name}(${i.type})`).join(', ')}`);
      }
    });

    const signinForms = formsInfo.filter(f => f.action.includes('signin'));
    console.log(`  ℹ️  ${signinForms.length} adet signin formu`);

    if (signinForms.length === 0) {
      const error = 'Login formu bulunamadı!';
      console.log('  ❌ ' + error);
      result.errors.push(error);
      result.success = false;
      return result;
    }

    // Find visible signin form (prefer visible, fallback to last)
    const visibleSigninForm = signinForms.find(f => f.isVisible);
    const targetFormIndex = visibleSigninForm
      ? visibleSigninForm.index
      : signinForms[signinForms.length - 1].index;

    console.log(`  ✅ Hedef form: Form ${targetFormIndex + 1} (${visibleSigninForm ? 'görünür' : 'gizli ama son'})`);

    // Step 4: Extract CSRF token
    console.log('\n🔐 4/6: CSRF token kontrolü...');
    const csrfToken = await page.evaluate(() => {
      const patterns = [
        'input[name="csrf"]',
        'input[name="csrfmiddlewaretoken"]',
        'input[name="__RequestVerificationToken"]',
        'input[name="_token"]',
        'meta[name="csrf-token"]'
      ];

      for (const selector of patterns) {
        const element = document.querySelector(selector);
        if (element) {
          const value = element.getAttribute('value') || element.getAttribute('content') || '';
          if (value) {
            return {
              selector,
              value,
              length: value.length
            };
          }
        }
      }
      return null;
    });

    if (csrfToken) {
      console.log(`  ✅ CSRF token bulundu!`);
      console.log(`     Selector: ${csrfToken.selector}`);
      console.log(`     Token length: ${csrfToken.length} chars`);
      console.log(`     Token (first 20): ${csrfToken.value.substring(0, 20)}...`);
    } else {
      const warning = 'CSRF token bulunamadı (bazı siteler kullanmaz)';
      console.log('  ⚠️  ' + warning);
      result.warnings.push(warning);
    }

    // Step 5: Fill the form
    console.log('\n✍️  5/6: Form doldurma ve submit...');

    // Get all forms and select the target one by index
    const forms = await page.$$('form[action*="signin"]');
    if (forms.length === 0) {
      result.errors.push('No signin forms found');
      return result;
    }

    // Use the visible form (prefer visible, fallback to last)
    const targetFormElementIndex = visibleSigninForm
      ? signinForms.findIndex(f => f.isVisible)
      : signinForms.length - 1;

    const targetForm = forms[targetFormElementIndex];

    // Find inputs within the form element
    const usernameInput = await targetForm.$('input[name="kul_adi"]');
    const passwordInput = await targetForm.$('input[name="sifre"]');
    const submitButton = await targetForm.$('button[type="submit"], input[type="submit"]');

    if (!usernameInput || !passwordInput || !submitButton) {
      const error = `Form inputları eksik: username=${!!usernameInput}, password=${!!passwordInput}, submit=${!!submitButton}`;
      console.log('  ❌ ' + error);
      result.errors.push(error);
      result.success = false;
      return result;
    }

    console.log('  ✍️  Kullanıcı adı yazılıyor...');
    await usernameInput.type(username, { delay: 80 });

    console.log('  ✍️  Şifre yazılıyor...');
    await passwordInput.type(password, { delay: 80 });

    // Screenshot before submit
    const screenshot2 = path.join(TMP_DIR, 'ihalebul-debug-2-before-submit.png');
    await page.screenshot({ path: screenshot2, fullPage: true });
    result.artifacts.screenshots.push(screenshot2);
    console.log('  ✅ Screenshot: ' + screenshot2);

    // Wait a bit (human-like behavior)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Submit form
    console.log('  🚀 Form submit ediliyor...');

    // Click submit and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => null),
      submitButton.click()
    ]);

    // Wait a bit more for JS to settle
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 6: Verify login success
    console.log('\n✅ 6/6: Login başarı kontrolü...');

    // Screenshot after submit
    const screenshot3 = path.join(TMP_DIR, 'ihalebul-debug-3-after-submit.png');
    await page.screenshot({ path: screenshot3, fullPage: true });
    result.artifacts.screenshots.push(screenshot3);
    console.log('  ✅ Screenshot: ' + screenshot3);

    // HTML dump after submit
    const htmlDump2 = path.join(TMP_DIR, 'ihalebul-debug-2-after-submit.html');
    const afterSubmitHtml = await page.content();
    fs.writeFileSync(htmlDump2, afterSubmitHtml);
    result.artifacts.htmlDumps.push(htmlDump2);
    console.log('  ✅ HTML dump: ' + htmlDump2);

    const finalUrl = page.url();
    result.finalUrl = finalUrl;
    console.log(`  📍 Final URL: ${finalUrl}`);

    const cookies = await page.cookies();
    result.cookies = cookies;
    console.log(`  🍪 Toplam ${cookies.length} cookie alındı`);

    const sessionCookies = cookies.filter(c =>
      /session|auth|token/i.test(c.name) || c.httpOnly
    );
    result.sessionCookies = sessionCookies;
    console.log(`  🔑 ${sessionCookies.length} adet session cookie`);

    if (sessionCookies.length > 0) {
      console.log('     Session cookies:');
      sessionCookies.forEach(c => {
        console.log(`       - ${c.name} (${c.value.substring(0, 20)}...)`);
      });
    }

    // Check for success indicators
    const successIndicators = [
      'Çıkış',
      'Çıkış Yap',
      'Oturumu Kapat',
      'Hesabım',
      'Profilim',
      'Abonelik',
      'hoş geldiniz',
      'hos geldiniz'
    ];

    const hasSuccessIndicator = successIndicators.some(indicator =>
      afterSubmitHtml.toLowerCase().includes(indicator.toLowerCase())
    );

    // Check for error indicators
    const errorIndicators = [
      'Kullanıcı adı veya şifre hatalı',
      'Giriş başarısız',
      'Hesabınız engellenmiştir',
      'Üye girişi engellendi',
      'kul_adi', // Form field still present = not logged in
      'name="sifre"' // Password field still present
    ];

    const hasErrorIndicator = errorIndicators.some(indicator =>
      afterSubmitHtml.includes(indicator)
    );

    // URL-based check
    const urlIndicatesSuccess = !finalUrl.includes('/signin') &&
                                !finalUrl.includes('/login');

    // Determine success
    result.success =
      urlIndicatesSuccess &&
      (sessionCookies.length > 0 || hasSuccessIndicator) &&
      !hasErrorIndicator;

    console.log('\n📊 SONUÇ:');
    console.log(`  URL değişti mi: ${urlIndicatesSuccess ? '✅' : '❌'} (${finalUrl})`);
    console.log(`  Session cookie var mı: ${sessionCookies.length > 0 ? '✅' : '❌'} (${sessionCookies.length} adet)`);
    console.log(`  Başarı göstergesi var mı: ${hasSuccessIndicator ? '✅' : '❌'}`);
    console.log(`  Hata göstergesi var mı: ${hasErrorIndicator ? '❌ EVET' : '✅ YOK'}`);
    console.log(`\n  🎯 GENEL SONUÇ: ${result.success ? '✅ BAŞARILI' : '❌ BAŞARISIZ'}`);

    if (result.success) {
      // Save cookies for future use
      const cookiesPath = path.join(TMP_DIR, 'ihalebul-cookies.json');
      fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
      console.log(`\n  💾 Cookies kaydedildi: ${cookiesPath}`);
    }

  } catch (error: any) {
    console.error('\n❌ HATA:', error.message);
    result.errors.push(error.message);
    result.success = false;

    // Emergency screenshot
    try {
      const errorScreenshot = path.join(TMP_DIR, 'ihalebul-debug-ERROR.png');
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      result.artifacts.screenshots.push(errorScreenshot);
      console.log('  📸 Error screenshot: ' + errorScreenshot);
    } catch {}
  } finally {
    // Close browser
    await browser.close();
  }

  return result;
}

// Main execution
(async () => {
  try {
    const result = await runLoginDebug();

    console.log('\n' + '='.repeat(80));
    console.log('📋 DEBUG RAPORU');
    console.log('='.repeat(80));
    console.log(`\n✅ Başarılı: ${result.success}`);
    console.log(`📍 Final URL: ${result.finalUrl}`);
    console.log(`🍪 Cookies: ${result.cookies.length} total, ${result.sessionCookies.length} session`);

    if (result.warnings.length > 0) {
      console.log(`\n⚠️  Uyarılar (${result.warnings.length}):`);
      result.warnings.forEach(w => console.log(`   - ${w}`));
    }

    if (result.errors.length > 0) {
      console.log(`\n❌ Hatalar (${result.errors.length}):`);
      result.errors.forEach(e => console.log(`   - ${e}`));
    }

    console.log('\n📁 Artefaktlar:');
    console.log(`   Screenshots (${result.artifacts.screenshots.length}):`);
    result.artifacts.screenshots.forEach(s => console.log(`     - ${s}`));
    console.log(`   HTML dumps (${result.artifacts.htmlDumps.length}):`);
    result.artifacts.htmlDumps.forEach(h => console.log(`     - ${h}`));
    console.log(`   Logs (${result.artifacts.logs.length}):`);
    result.artifacts.logs.forEach(l => console.log(`     - ${l}`));

    console.log('\n' + '='.repeat(80));

    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    console.error('❌ FATAL ERROR:', error.message);
    process.exit(1);
  }
})();
