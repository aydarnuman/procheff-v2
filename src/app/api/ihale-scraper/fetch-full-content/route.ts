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

    // 🆕 Get RAW content (NO PARSING)
    console.log('📸 Capturing raw HTML and screenshot...');

    const htmlContent = await page.content(); // Full HTML
    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false }); // Screenshot (viewport only)
    const innerText = await page.evaluate(() => document.body.innerText); // Plain text

    await browser.close();

    console.log('✅ Raw content captured:', {
      htmlLength: htmlContent.length,
      textLength: innerText.length,
      hasScreenshot: !!screenshot,
    });

    // 🤖 Parse with Claude AI
    console.log('🤖 Parsing with Claude AI...');

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384, // 🔥 MAKSİMUM! (4096 → 16384) - En büyük ihaleler için
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshot,
              },
            },
            {
              type: 'text',
              text: `Bu bir Türk kamu ihalesi sayfasıdır. Aşağıdaki HTML ve görsel içeriğini analiz ederek yapılandırılmış JSON formatında çıkar.

**ÖNEMLİ:** TÜM detayları çıkar, hiçbir şeyi atlama! Büyük ihaleler için tüm bilgiler önemlidir.

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
5. **announcementText**: İhale ilanı metni (tam metin, uzun olabilir - KESİNLİKLE TAMAMINI AL)
6. **itemsList**: Eğer ihale ilanında malzeme/ürün listesi varsa, CSV formatında çıkar. Format:
   - Header: "Sıra No,Ürün Adı,Miktar,Birim,Birim Fiyat (TL),Toplam Fiyat (TL)"
   - Örnek satır: "1,Domates,100,KG,15.50,1550.00"
   - Eğer liste yoksa null döndür

**HTML İçeriği:**
\`\`\`html
${htmlContent.slice(0, 200000)}
\`\`\`

**Plain Text İçeriği:**
\`\`\`
${innerText.slice(0, 100000)}
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
  "announcementText": "string (tam ihale ilanı metni - TAMAMINI AL, KESME)",
  "itemsList": "string (CSV format - eğer malzeme listesi varsa) | null (eğer liste yoksa)"
}`,
            },
          ],
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

        await TenderDatabase.updateTenderWithAIAnalysis(tenderId.toString(), {
          raw_json: structuredData, // Tüm parse edilmiş data (details, documents, fullText, itemsList)
          announcement_text: structuredData.fullText,
          ai_analyzed: true,
          ai_analyzed_at: new Date().toISOString(),
        });

        console.log(`✅ Details saved to database for tender ${tenderId}`);
      } catch (dbError) {
        console.error('⚠️ Failed to save to database:', dbError);
        // Database hatası olsa bile response döndür (kritik değil)
      }
    } else {
      console.log('⚠️ No tenderId provided, skipping database save');
    }

    return NextResponse.json({
      success: true,
      data: structuredData,
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
