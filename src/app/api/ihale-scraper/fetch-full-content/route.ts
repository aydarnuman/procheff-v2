import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import Anthropic from '@anthropic-ai/sdk';
import { TenderDatabase } from '@/lib/ihale-scraper/database/sqlite-client';

// Force Node.js runtime (required for Anthropic SDK)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 dakika timeout (Vercel limit)

/**
 * Fetch full content of a tender page with AI-powered parsing
 * 1. Puppeteer fetches raw HTML + screenshot
 * 2. Claude AI parses and structures the content
 * 3. Returns clean structured data
 */
export async function POST(request: Request) {
  try {
    const { url, tenderId } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL gerekli' },
        { status: 400 }
      );
    }

    console.log('🌐 Fetching full content from:', url);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    );

    // 🔐 Auto-login to ihalebul.com
    const username = process.env.IHALEBUL_USERNAME;
    const password = process.env.IHALEBUL_PASSWORD;

    if (username && password) {
      console.log('🔐 Logging in to ihalebul.com...');

      try {
        await page.goto('https://www.ihalebul.com/tenders', { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for login form
        await page.waitForSelector('input[name="kul_adi"]', { timeout: 10000 });
        console.log('✅ Login form detected');

        // Fill the form (use desktop form - index 1)
        await page.evaluate((user, pass) => {
          const userInputs = document.querySelectorAll<HTMLInputElement>('input[name="kul_adi"]');
          const passInputs = document.querySelectorAll<HTMLInputElement>('input[name="sifre"]');

          // Use desktop form (second one) if available
          if (userInputs.length >= 2 && passInputs.length >= 2) {
            userInputs[1].value = user;
            passInputs[1].value = pass;
          } else {
            userInputs[0].value = user;
            passInputs[0].value = pass;
          }
        }, username, password);

        console.log('✍️ Login credentials filled');

        // Click login button
        await page.evaluate(() => {
          const buttons = document.querySelectorAll<HTMLButtonElement>('button[type="submit"]');
          if (buttons.length >= 2) {
            buttons[1].click(); // Desktop form submit
          } else if (buttons.length > 0) {
            buttons[0].click();
          }
        });

        // Wait for navigation after login
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});

        const currentUrl = page.url();
        if (!currentUrl.includes('/tenders') && !currentUrl.includes('/ihale')) {
          console.warn('⚠️ Login may have failed, URL:', currentUrl);
        } else {
          console.log('✅ Login successful');
        }
      } catch (loginError) {
        console.error('⚠️ Login error:', loginError);
      }
    }

    // Navigate to the tender page
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // ⏳ WAIT for dynamic content to load (ihalebul uses JavaScript)
    console.log('⏳ Waiting for dynamic content to load...');
    await new Promise(r => setTimeout(r, 1500)); // Küçük başlangıç beklemesi

    // Try to ensure document section is visible (longer timeout)
    try {
      await page.waitForSelector(
        'a[href*="/download"], .documents, .document-list, [class*="document"], button[onclick*="download"]',
        { timeout: 7000 }
      );
    } catch {
      console.log('⚠️ No document section found immediately, continuing...');
    }

    // 🧠 1️⃣ Trigger lazy / dynamic buttons (common on ihalebul)
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[onclick*="download"]'));
      btns.forEach((b: any) => {
        try { b.click(); } catch {}
      });

      const acc = Array.from(document.querySelectorAll('.accordion, .collapse, .tab'));
      acc.forEach((a: any) => {
        try { a.click(); } catch {}
      });
    });

    // Give the page time to inject new links
    await new Promise(r => setTimeout(r, 2000));

    // 🧠 2️⃣ Re-scan for new document links after triggers
    const triggeredLinks = await page.evaluate(() => {
      const selectors = [
        'a[href*="/download"]',
        'a[href*=".pdf"]',
        'a[href*=".doc"]',
        'a[href*=".zip"]',
        'a[href*=".txt"]',    // 🆕 TXT
        'a[href*=".json"]',   // 🆕 JSON
        'a[href*=".csv"]',    // 🆕 CSV
        'a[href*=".xls"]',    // 🆕 Excel
        'a[download]',
        'a[class*="download"]',
        'a[href*="document"]'
      ];

      const allLinks: string[] = [];
      selectors.forEach(sel => {
        try {
          const els = Array.from(document.querySelectorAll(sel));
          els.forEach((a: any) => {
            if (a.href && !allLinks.includes(a.href)) {
              allLinks.push(a.href);
            }
          });
        } catch {}
      });
      return allLinks;
    });

    console.log(`📄 Found ${triggeredLinks.length} document links after trigger`);

    if (triggeredLinks.length < 1) {
      console.log('⚠️ Retrying with forced wait...');
      await new Promise(r => setTimeout(r, 3000));

      const retryLinks = await page.evaluate(() => {
        const links: string[] = [];
        const selectors = ['a[href*="download"]', 'a[href*=".pdf"]', 'a[href*=".doc"]', 'a[href*=".zip"]', 'a[href*=".txt"]', 'a[href*=".json"]', 'a[href*=".csv"]', 'a[href*=".xls"]'];
        selectors.forEach(sel => {
          try {
            const els = Array.from(document.querySelectorAll(sel));
            els.forEach((a: any) => {
              if (a.href && !links.includes(a.href)) {
                links.push(a.href);
              }
            });
          } catch {}
        });
        return links;
      });
      console.log(`📄 Second scan found ${retryLinks.length} links`);
    }

    // 🧩 Scroll to bottom to trigger lazy loads
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 1500));

    // Scroll back up (some pages re-render links on top)
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 1000));

    // 🆕 Get RAW content (NO PARSING)
    console.log('📸 Capturing raw HTML and screenshot...');

    const htmlContent = await page.content(); // Full HTML
    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true }); // 🔥 Full page screenshot
    const innerText = await page.evaluate(() => document.body.innerText); // Plain text

    // 📄 Extract document links from the page
    const documentLinks = await page.evaluate(() => {
      const links: Array<{ title: string; url: string; type: string }> = [];

      // 🎯 İhalebul'daki indirme butonlarını bul
      // Birden fazla strateji kullan (button, a, link class'ları)
      const selectors = [
        'a[href*="/download"]',           // Download linkler
        'button[onclick*="download"]',    // Download button'ları
        'a.btn[href*="document"]',        // Doküman button'ları
        'a[class*="download"]',           // Download class'ı olan linkler
        'a[download]',                    // Download attribute'u olan linkler
        'a[href*=".pdf"]',                // PDF linkler
        'a[href*=".doc"]',                // DOC linkler
        'a[href*=".zip"]',                // ZIP linkler
        'a[href*=".txt"]',                // 🆕 TXT linkler
        'a[href*=".json"]',               // 🆕 JSON linkler
        'a[href*=".csv"]',                // 🆕 CSV linkler
        'a[href*=".xls"]',                // 🆕 Excel linkler
      ];

      // Tüm selektörleri dene
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll<HTMLElement>(selector);
          elements.forEach((element) => {
            let href = '';

            // Element'e göre URL al
            if (element.tagName === 'A') {
              href = (element as HTMLAnchorElement).href;
            } else if (element.tagName === 'BUTTON') {
              // Button'dan onclick içindeki URL'i parse et
              const onclick = element.getAttribute('onclick') || '';
              const urlMatch = onclick.match(/['"]([^'"]+)['"]/);
              if (urlMatch) {
                href = urlMatch[1];
                // Relative URL'i absolute yap
                if (!href.startsWith('http')) {
                  href = window.location.origin + (href.startsWith('/') ? href : '/' + href);
                }
              }
            }

            if (!href) return;

            // Title'ı akıllıca al
            let title = element.textContent?.trim() || '';

            // Eğer title boş veya sadece icon ise, parent'tan veya aria-label'dan al
            if (!title || title.length < 3) {
              title = element.getAttribute('aria-label') ||
                      element.getAttribute('title') ||
                      element.closest('.card, .document-item')?.querySelector('.title, .name, h3, h4, h5')?.textContent?.trim() ||
                      'Belge';
            }

            // Determine type
            let type = 'ek_dosya';
            const titleLower = title.toLowerCase();
            const hrefLower = href.toLowerCase();

            if (titleLower.includes('idari') || titleLower.includes('şartname') || hrefLower.includes('idari')) {
              type = 'idari_sartname';
            } else if (titleLower.includes('teknik') || hrefLower.includes('teknik')) {
              type = 'teknik_sartname';
            } else if (hrefLower.endsWith('.txt')) {
              type = 'diger'; // 🆕 TXT dosyaları
            } else if (hrefLower.endsWith('.json')) {
              type = 'diger'; // 🆕 JSON dosyaları
            } else if (hrefLower.endsWith('.csv') || hrefLower.endsWith('.xls') || hrefLower.endsWith('.xlsx')) {
              type = 'diger'; // 🆕 CSV/Excel dosyaları
            }

            // Duplicate check
            if (href && !links.find(l => l.url === href)) {
              links.push({ title: title || 'Doküman', url: href, type });
            }
          });
        } catch (err) {
          console.warn(`Selector ${selector} failed:`, err);
        }
      });

      return links;
    });

    console.log(`📄 Found ${documentLinks.length} document links`);

    // 🐛 DEBUG: Log document links details
    if (documentLinks.length > 0) {
      console.log('🐛 Document links found:');
      documentLinks.forEach((doc, idx) => {
        console.log(`  ${idx + 1}. Title: "${doc.title}"`);
        console.log(`     URL: ${doc.url}`);
        console.log(`     Type: ${doc.type}`);
      });
    } else {
      // 🐛 DEBUG: If no links found, check page HTML for download buttons
      console.log('⚠️ No document links found! Debugging page structure...');

      const debugInfo = await page.evaluate(() => {
        // Check for various download-related elements
        const allLinks = Array.from(document.querySelectorAll('a')).map(a => ({
          href: a.href,
          text: a.textContent?.trim().slice(0, 50),
          classes: a.className,
        }));

        const allButtons = Array.from(document.querySelectorAll('button')).map(btn => ({
          onclick: btn.getAttribute('onclick')?.slice(0, 100),
          text: btn.textContent?.trim().slice(0, 50),
          classes: btn.className,
        }));

        return {
          totalLinks: allLinks.length,
          linksWithDownload: allLinks.filter(l => l.href.includes('download') || l.href.includes('.pdf') || l.href.includes('.zip')),
          totalButtons: allButtons.length,
          buttonsWithDownload: allButtons.filter(b => b.onclick?.includes('download')),
        };
      });

      console.log('🐛 Page structure debug:', JSON.stringify(debugInfo, null, 2));
    }

    // Close browser (all content captured)
    await browser.close();

    console.log('✅ Raw content captured:', {
      htmlLength: htmlContent.length,
      textLength: innerText.length,
      hasScreenshot: !!screenshot,
      documentLinksCount: documentLinks.length,
    });

    // 🤖 Parse with Claude AI
    console.log('🤖 Parsing with Claude AI...');

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Build content array with screenshot + text
    const contentBlocks: any[] = [
      // 1. Page screenshot
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: screenshot,
        },
      },
      // 2. Text prompt
      {
        type: 'text',
              text: `Bu bir Türk kamu ihalesi sayfasıdır. Aşağıdaki içeriği analiz ederek yapılandırılmış JSON formatında çıkar:

1. **Sayfa screenshot'u** (yukarıdaki görsel)
2. **HTML ve text içeriği** (aşağıda)

**ÖNEMLİ:** TÜM detayları çıkar, hiçbir şeyi atlama! Büyük ihaleler için tüm bilgiler önemlidir

**İHTİYAÇ DUYULAN BİLGİLER:**
1. **title**: İhale başlığı / İşin adı
2. **organization**: İdare adı (kurum)
3. **details**: Tüm ihale detaylarını içeren key-value object. Örnekler:
   - "Kayıt no"
   - "Teklif tarihi"
   - "Yaklaşık maliyet limiti"
   - "İhale usulü"
   - "Toplantı adresi"
   - "İhale türü"
   - Ve diğer tüm görünen detaylar (HIÇBIR ŞEYİ ATLAMA!)
4. **documents**: İndirilebilir dokümanlar listesi (her biri şu formatta):
   - title: Doküman adı
   - url: Download linki (tam URL)
   - type: "idari_sartname" | "teknik_sartname" | "ek_dosya"
5. **announcementText**: İhale ilanı metni (SADECE ASIL İLAN METNİ - döküman listesini dahil etme, o zaten 'documents' field'ında var)
6. **itemsList**: Eğer ihale ilanında malzeme/ürün listesi varsa, CSV formatında çıkar. Format:
   - Header: "Sıra No,Ürün Adı,Miktar,Birim,Birim Fiyat (TL),Toplam Fiyat (TL)"
   - Örnek satır: "1,Domates,100,KG,15.50,1550.00"
   - Eğer liste yoksa null döndür

**HTML İçeriği:**
\`\`\`html
${htmlContent.slice(0, 500000)}
\`\`\`

**Plain Text İçeriği:**
\`\`\`
${innerText.slice(0, 300000)}
\`\`\`

**JSON FORMAT (SADECE JSON DÖNDÜR, BAŞKA HİÇBİR ŞEY YAZMA):**
{
  "title": "string",
  "organization": "string",
  "details": {
    "Kayıt no": "string",
    "Teklif tarihi": "string",
    "Yaklaşık maliyet limiti": "string",
    ... (diğer tüm detaylar - HIÇBIR ŞEYİ ATLAMA)
  },
  "documents": [
    {
      "title": "string",
      "url": "string",
      "type": "idari_sartname" | "teknik_sartname" | "ek_dosya"
    }
  ],
  "announcementText": "string (SADECE ASIL İLAN METNİ - döküman listesi hariç)",
  "itemsList": "string (CSV format - eğer malzeme listesi varsa) | null (eğer liste yoksa)"
}`,
      },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    });

    // Extract JSON from AI response
    const aiText = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log('🤖 AI Response:', aiText.slice(0, 500));

    // Parse JSON (AI might wrap it in ```json``` blocks)
    let parsedData;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        parsedData = JSON.parse(aiText);
      }
    } catch (parseError) {
      console.error('❌ Failed to parse AI JSON:', parseError);
      throw new Error('AI response parsing failed');
    }

    console.log('✅ AI Parsing successful:', {
      title: parsedData.title,
      detailsCount: Object.keys(parsedData.details || {}).length,
      documentsCount: (parsedData.documents || []).length,
    });

    // Convert to frontend format
    const structuredData = {
      title: parsedData.title || '',
      organization: parsedData.organization || '',
      details: parsedData.details || {},
      documents: parsedData.documents || [],
      fullText: parsedData.announcementText || innerText, // Fallback to raw text
      itemsList: parsedData.itemsList || null, // 🆕 Malzeme listesi (CSV format)
    };

    // 🆕 Parse edilen detayları veritabanına kaydet (eğer tenderId varsa)
    if (tenderId) {
      try {
        console.log(`💾 Saving parsed details to database for tender ${tenderId}...`);

        // 1. ihale_listings tablosunu güncelle
        await TenderDatabase.updateTenderWithAIAnalysis(tenderId.toString(), {
          raw_json: structuredData, // Tüm parse edilmiş data (details, documents, fullText, itemsList)
          announcement_text: structuredData.fullText,
          ai_analyzed: true,
          ai_analyzed_at: new Date().toISOString(),
        });

        // 2. tender_analysis tablosuna kaydet (cache için)
        const saveResult = await TenderDatabase.saveTenderAnalysis(
          tenderId.toString(),
          structuredData, // analysisResult
          {
            rawHtml: htmlContent,
            plainText: innerText,
            screenshot: screenshot,
            documents: documentLinks,
            structuredData
          } // fullContent
        );

        if (saveResult.success) {
          console.log(`✅ Details saved to database for tender ${tenderId}`);
        } else {
          console.error(`❌ Failed to save analysis to database:`, saveResult.error);
        }
      } catch (dbError) {
        console.error('⚠️ Failed to save to database:', dbError);
        // Database hatası olsa bile response döndür (kritik değil)
      }
    } else {
      console.log('⚠️ No tenderId provided, skipping database save');
    }

    // Güvenli serialize: JSON.stringify/parse
    const safeData = JSON.parse(JSON.stringify(structuredData));
    return NextResponse.json({
      success: true,
      data: safeData,
    });

  } catch (error: any) {
    console.error('❌ Fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Content fetch failed',
      },
      { status: 500 }
    );
  }
}
