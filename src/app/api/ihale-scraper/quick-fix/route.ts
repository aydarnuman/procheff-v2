// ============================================================================
// API: QUICK FIX (Haiku ile hızlı ve ucuz)
// Sadece kayıt numarası ve kurum adını çıkarır (full parsing YOK)
// Claude Haiku: $0.25/1M tokens (12x ucuz, 3x hızlı!)
// ============================================================================

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/ihale-scraper/database/sqlite-client';
import Anthropic from '@anthropic-ai/sdk';
import puppeteer from 'puppeteer';

const LOGIN_CREDENTIALS = {
  email: process.env.IHALEBUL_EMAIL || '',
  password: process.env.IHALEBUL_PASSWORD || '',
};

export async function POST(request: Request) {
  try {
    console.log('⚡ Quick Fix başlatıldı (Haiku)...');

    const db = getDatabase();
    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Get tenders with missing data
    const tenders = db.prepare(`
      SELECT id, title, organization, registration_number, source_url
      FROM ihale_listings
      WHERE (registration_number IS NULL OR organization = 'Belirtilmemiş' OR title = 'Belirtilmemiş')
        AND created_at >= datetime('now', '-7 days')
      ORDER BY id
      LIMIT 50
    `).all();

    console.log(`📊 ${tenders.length} ihale bulundu\n`);

    if (tenders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Eksik veri yok',
        fixed: 0,
        total: 0,
      });
    }

    // Launch browser once for all tenders
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Login once (using form fields by name, not type)
    console.log('🔐 İhalebul.com giriş yapılıyor...');
    await page.goto('https://www.ihalebul.com/tenders', { waitUntil: 'networkidle2' });

    // Wait for login form and fill it (use desktop form - index 1)
    await page.waitForSelector('input[name="kul_adi"]', { timeout: 10000 });

    await page.evaluate((email, pass) => {
      const userInputs = document.querySelectorAll('input[name="kul_adi"]');
      const passInputs = document.querySelectorAll('input[name="sifre"]');

      // Use desktop form (index 1)
      if (userInputs.length >= 2 && passInputs.length >= 2) {
        userInputs[1].value = email;
        passInputs[1].value = pass;
      } else {
        userInputs[0].value = email;
        passInputs[0].value = pass;
      }
    }, LOGIN_CREDENTIALS.email, LOGIN_CREDENTIALS.password);

    // Click login button and wait
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.evaluate(() => {
        const buttons = document.querySelectorAll('button[type="submit"][name="ok"]');
        if (buttons.length >= 2) {
          buttons[1].click(); // Desktop button
        } else if (buttons.length === 1) {
          buttons[0].click();
        }
      })
    ]);

    console.log('✅ Giriş başarılı\n');

    let fixed = 0;
    let failed = 0;

    for (const tender of tenders) {
      console.log(`🔍 [${fixed + failed + 1}/${tenders.length}] ${(tender as any).id}: ${(tender as any).title}`);

      try {
        // Fetch HTML
        await page.goto((tender as any).source_url, { waitUntil: 'networkidle0' });
        const html = await page.content();
        const text = await page.evaluate(() => document.body.innerText);

        // AI prompt (minimal - sadece eksik verileri iste)
        const prompt = `Sen bir veri çıkarma uzmanısın. HTML'den SADECE şu bilgileri çıkar:

HTML İÇERİK:
${html.slice(0, 8000)}

GÖREV:
1. **Kayıt Numarası**: YYYY/NNNNNN formatında (örn: 2025/1634941) VEYA sadece numara (örn: 175427, 25DT1934398)
2. **Kurum Adı**: İhaleyi yapan kurumun kısa adı (max 100 karakter)

JSON formatında döndür:
{
  "kayit_no": "2025/1634941",
  "kurum": "Ankara Büyükşehir Belediyesi"
}

Bulamazsan null dön. SADECE JSON döndür!`;

        const message = await claude.messages.create({
          model: 'claude-3-5-haiku-20241022', // ⚡ HAIKU (12x ucuz!)
          max_tokens: 200, // Minimal response
          messages: [{ role: 'user', content: prompt }],
        });

        const response = message.content[0].type === 'text' ? message.content[0].text : '';
        let cleaned = response.trim();

        // JSON cleanup
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
        } else if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
        }

        const parsed = JSON.parse(cleaned);

        // Update database
        const updates: string[] = [];
        const values: any[] = [];

        if (parsed.kayit_no && parsed.kayit_no !== 'null') {
          updates.push('registration_number = ?');
          values.push(parsed.kayit_no);
        }

        if (parsed.kurum && parsed.kurum !== 'null' && (tender as any).organization === 'Belirtilmemiş') {
          updates.push('organization = ?');
          values.push(parsed.kurum.slice(0, 150)); // Max 150 char
        }

        if ((tender as any).title === 'Belirtilmemiş' && parsed.kurum) {
          // Title'ı da kurum adından türetelim
          updates.push('title = ?');
          values.push(parsed.kurum.slice(0, 100));
        }

        if (updates.length > 0) {
          values.push((tender as any).id);
          db.prepare(`
            UPDATE ihale_listings
            SET ${updates.join(', ')}
            WHERE id = ?
          `).run(...values);

          console.log(`   ✅ Düzeltildi: ${parsed.kayit_no || 'YOK'} | ${parsed.kurum?.slice(0, 50) || 'YOK'}`);
          fixed++;
        } else {
          console.log(`   ⚠️ Veri bulunamadı`);
          failed++;
        }
      } catch (error: any) {
        console.error(`   ❌ Hata: ${error.message}`);
        failed++;
      }
    }

    await browser.close();

    console.log(`\n✅ Tamamlandı!`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Failed: ${failed}`);

    return NextResponse.json({
      success: true,
      message: `${fixed} ihale düzeltildi`,
      fixed,
      failed,
      total: tenders.length,
    });
  } catch (error: any) {
    console.error('❌ Quick fix exception:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
