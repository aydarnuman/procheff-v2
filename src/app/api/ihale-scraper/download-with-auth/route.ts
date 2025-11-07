import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Download document with authentication using Puppeteer
 * Supports ZIP extraction
 */
export async function POST(request: Request) {
  let browser;

  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL gerekli' },
        { status: 400 }
      );
    }

    console.log('📥 Authenticated download starting:', url);

    browser = await puppeteer.launch({
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
        await page.goto('https://www.ihalebul.com/tenders', {
          waitUntil: 'networkidle2',
          timeout: 60000
        });

        await page.waitForSelector('input[name="kul_adi"]', { timeout: 10000 });

        await page.evaluate((user, pass) => {
          const userInputs = document.querySelectorAll<HTMLInputElement>('input[name="kul_adi"]');
          const passInputs = document.querySelectorAll<HTMLInputElement>('input[name="sifre"]');

          if (userInputs.length >= 2 && passInputs.length >= 2) {
            userInputs[1].value = user;
            passInputs[1].value = pass;
          } else {
            userInputs[0].value = user;
            passInputs[0].value = pass;
          }
        }, username, password);

        await page.evaluate(() => {
          const buttons = document.querySelectorAll<HTMLButtonElement>('button[type="submit"]');
          if (buttons.length >= 2) {
            buttons[1].click();
          } else if (buttons.length > 0) {
            buttons[0].click();
          }
        });

        await page.waitForNavigation({
          waitUntil: 'networkidle2',
          timeout: 10000
        }).catch(() => {});

        console.log('✅ Login successful');
      } catch (loginError) {
        console.error('⚠️ Login error:', loginError);
        throw new Error('Login failed');
      }
    } else {
      throw new Error('IHALEBUL credentials not found in environment variables');
    }

    // Download the file using CDP (Chrome DevTools Protocol)
    console.log('📥 Downloading file...');

    const client = await page.createCDPSession();

    // Enable fetch domain to intercept downloads
    await client.send('Fetch.enable', {
      patterns: [{ urlPattern: '*' }],
    });

    let downloadData: Buffer | null = null;
    let downloadContentType = '';

    // Listen for download requests
    client.on('Fetch.requestPaused', async (event: any) => {
      const { requestId } = event;

      try {
        // Continue the request and get response
        const response = await client.send('Fetch.getResponseBody', { requestId });
        downloadData = Buffer.from(response.body, response.base64Encoded ? 'base64' : 'utf8');
        downloadContentType = event.responseHeaders?.find((h: any) => h.name.toLowerCase() === 'content-type')?.value || '';

        await client.send('Fetch.continueRequest', { requestId });
      } catch (err) {
        await client.send('Fetch.continueRequest', { requestId });
      }
    });

    // Navigate to download URL
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' }).catch(() => {});

    // Wait a bit for download to be intercepted
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!downloadData) {
      // Fallback: try direct fetch with cookies
      console.log('⚠️ CDP download failed, trying fetch...');
      const cookies = await page.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const fetchResponse = await fetch(url, {
        headers: {
          'Cookie': cookieString,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!fetchResponse.ok) {
        throw new Error(`Fetch failed: ${fetchResponse.status}`);
      }

      const arrayBuffer = await fetchResponse.arrayBuffer();
      downloadData = Buffer.from(arrayBuffer);
      downloadContentType = fetchResponse.headers.get('content-type') || '';
    }

    console.log(`✅ File downloaded: ${downloadContentType}, ${(downloadData.length / 1024).toFixed(2)} KB`);

    await browser.close();

    const buffer = downloadData;
    const contentType = downloadContentType;

    // Check if ZIP
    const isZip = contentType.includes('zip') || url.toLowerCase().includes('.zip');

    if (isZip) {
      console.log('📦 Extracting ZIP...');

      const zip = await JSZip.loadAsync(buffer);
      const files = [];

      for (const [filename, file] of Object.entries(zip.files)) {
        const lowerFilename = filename.toLowerCase();
        
        // 🚫 HTML/HTM dosyalarını filtrele
        if (lowerFilename.endsWith('.html') || lowerFilename.endsWith('.htm')) {
          console.log(`⏭️ HTML dosyası atlandı: ${filename}`);
          continue;
        }
        
        if (!file.dir && (
          lowerFilename.endsWith('.pdf') ||
          lowerFilename.endsWith('.doc') ||
          lowerFilename.endsWith('.docx') ||
          lowerFilename.endsWith('.txt') ||
          lowerFilename.endsWith('.json') ||
          lowerFilename.endsWith('.csv') ||
          lowerFilename.endsWith('.xls') ||
          lowerFilename.endsWith('.xlsx')
        )) {
          const content = await file.async('base64');

          // Determine MIME type
          let mimeType = 'application/octet-stream';
          const ext = filename.toLowerCase();
          if (ext.endsWith('.pdf')) mimeType = 'application/pdf';
          else if (ext.endsWith('.doc')) mimeType = 'application/msword';
          else if (ext.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          else if (ext.endsWith('.txt')) mimeType = 'text/plain';
          else if (ext.endsWith('.json')) mimeType = 'application/json';
          else if (ext.endsWith('.csv')) mimeType = 'text/csv';
          else if (ext.endsWith('.xls')) mimeType = 'application/vnd.ms-excel';
          else if (ext.endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

          files.push({
            name: filename,
            content: content,
            type: mimeType
          });
        }
      }

      console.log(`✅ ZIP extracted: ${files.length} files`);

      return NextResponse.json({
        success: true,
        isZip: true,
        files: files,
      });
    }

    // Not a ZIP - return single file
    const filename = url.split('/').pop() || 'document';
    const lowerFilename = filename.toLowerCase();
    
    // 🚫 HTML/HTM dosyalarını reddet
    if (lowerFilename.endsWith('.html') || lowerFilename.endsWith('.htm') || contentType.includes('text/html')) {
      console.log(`⏭️ HTML dosyası reddedildi: ${filename}`);
      return NextResponse.json({
        success: false,
        error: 'HTML dosyaları desteklenmiyor',
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      isZip: false,
      file: {
        name: filename,
        content: buffer.toString('base64'),
        type: contentType,
      },
    });

  } catch (error: any) {
    console.error('❌ Download error:', error);

    if (browser) {
      await browser.close().catch(() => {});
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Download failed',
      },
      { status: 500 }
    );
  }
}
