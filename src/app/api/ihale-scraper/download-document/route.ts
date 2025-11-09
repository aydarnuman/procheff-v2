// ============================================================================
// DOCUMENT DOWNLOAD API
// Şartname ve diğer dökümanları proxy ile indir
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { fileTypeFromBuffer } from 'file-type';
import JSZip from 'jszip';
import * as fs from 'fs';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    console.log(`\n📥 Downloading document: ${url}`);

    // ============================================================
    // 1. Dökümanı fetch et (timeout + retry)
    // ============================================================
    async function safeFetch(url: string, options: any, retries = 2) {
      for (let i = 0; i <= retries; i++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 50000); // 50sn timeout (büyük dosyalar için)
          const response = await fetch(url, { ...options, signal: controller.signal });
          clearTimeout(timeout);
          return response;
        } catch (err) {
          if (i === retries) throw err;
          await new Promise(r => setTimeout(r, 1000)); // 1sn bekle (retry arası)
        }
      }
    }

    // ============================================================
    // 🔑 Authentication: Scraper session cookie'sini kullan
    // ============================================================
    let authCookies = '';

    try {
      const sessionFile = '/tmp/ihalebul-session.json';
      let sessionValid = false;

      // Mevcut session'ı kontrol et
      if (fs.existsSync(sessionFile)) {
        const sessionData = fs.readFileSync(sessionFile, 'utf8');
        const savedSession = JSON.parse(sessionData);
        const sessionAge = Date.now() - new Date(savedSession.timestamp).getTime();

        // Session 1 saatten eskiyse veya cookie yoksa, yeniden login gerekli
        if (sessionAge < 3600000 && Array.isArray(savedSession.cookies) && savedSession.cookies.length > 0) {
          authCookies = savedSession.cookies
            .map((c: any) => `${c.name}=${c.value}`)
            .join('; ');
          console.log(`🔑 Using scraper session cookies (age: ${Math.round(sessionAge / 60000)} min)`);
          sessionValid = true;
        }
      }

      // Session yoksa veya expire olduysa, scraper'ı çalıştır
      if (!sessionValid) {
        console.log('🔄 No valid session found, running scraper to authenticate...');

        const username = process.env.IHALEBUL_USERNAME;
        const password = process.env.IHALEBUL_PASSWORD;

        if (!username || !password) {
          return NextResponse.json(
            {
              success: false,
              error: 'İhalebul credentials not configured. Please set IHALEBUL_USERNAME and IHALEBUL_PASSWORD.',
            },
            { status: 401 }
          );
        }

        // Scraper import ve çalıştır (sadece login için)
        const { IhalebulScraper } = await import('@/lib/ihale-scraper/scrapers/ihalebul-scraper');
        const scraper = new IhalebulScraper('new');

        console.log('🔐 Authenticating with ihalebul.com...');
        await scraper.scrape(); // Bu login yapacak ve session kaydedecek

        // Session'ı tekrar oku
        if (fs.existsSync(sessionFile)) {
          const sessionData = fs.readFileSync(sessionFile, 'utf8');
          const savedSession = JSON.parse(sessionData);

          if (Array.isArray(savedSession.cookies) && savedSession.cookies.length > 0) {
            authCookies = savedSession.cookies
              .map((c: any) => `${c.name}=${c.value}`)
              .join('; ');
            console.log('✅ Authentication successful, cookies loaded');
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Authentication error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication failed: ' + error.message,
        },
        { status: 401 }
      );
    }

    const fetchHeaders: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/pdf,application/zip,application/octet-stream,*/*',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': url,
    };

    // Authentication cookie'si varsa ekle
    if (authCookies) {
      fetchHeaders['Cookie'] = authCookies;
    }

    const response = await safeFetch(url, {
      headers: fetchHeaders,
      redirect: 'follow',
    });
    if (!response) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bağlantı kurulamadı veya yanıt alınamadı',
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `HTTP ${response.status}`,
          details: response.statusText,
        },
        { status: response.status || 500 }
      );
    }

    // ============================================================
    // 2. Buffer'ı al ve gerçek MIME type'ı tespit et
    // ============================================================
    const buffer = await response.arrayBuffer?.();
    if (!buffer) {
      return NextResponse.json(
        {
          success: false,
          error: 'Yanıt alınamadı veya veri okunamadı',
        },
        { status: 500 }
      );
    }

    // 🔍 file-type ile gerçek MIME type detection (magic number'dan)
    const detected = await fileTypeFromBuffer(new Uint8Array(buffer));

    // Fallback: Header'dan gelen veya octet-stream
    const headerContentType = response.headers?.get('content-type') || 'application/octet-stream';

    // Öncelik: detected > header > fallback
    const mimeType = detected?.mime || headerContentType;
    const ext = detected?.ext || '';

    const contentLength = response.headers?.get('content-length');
    console.log(`✅ Document fetched: ${mimeType} (detected: ${detected?.mime || 'none'}), ${contentLength ? (parseInt(contentLength) / 1024).toFixed(1) + ' KB' : 'unknown size'}`);

    // ============================================================
    // 3. Dosya adını akıllıca belirle
    // ============================================================
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    let filename = pathParts[pathParts.length - 1] || 'document';

    // Eğer filename'de extension yoksa, detected extension'ı ekle
    if (!filename.includes('.') && ext) {
      filename += `.${ext}`;
    } else if (!filename.includes('.')) {
      // Fallback: MIME type'dan extension çıkar
      if (mimeType.includes('pdf')) {
        filename += '.pdf';
      } else if (mimeType.includes('word') || mimeType.includes('msword')) {
        filename += '.doc';
      } else if (mimeType.includes('zip')) {
        filename += '.zip';
      } else if (mimeType.includes('csv')) {
        filename += '.csv';
      } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
        filename += '.xlsx';
      } else {
        filename += '.bin';
      }
    }

    // Base64 encode
    const base64 = Buffer.from(buffer).toString('base64');

    // ============================================================
    // 4. 📦 ZIP Extraction (eğer ZIP dosyasıysa)
    // ============================================================
    const isZip = mimeType.includes('zip') || filename.toLowerCase().endsWith('.zip');

    if (isZip) {
      console.log('📦 ZIP dosyası tespit edildi, içeriği çıkarılıyor...');
      
      try {
        const zip = await JSZip.loadAsync(buffer);
        const extractedFiles: any[] = [];

        // ZIP içindeki her dosyayı işle
        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
          // Klasörleri atla
          if (zipEntry.dir) continue;

          const lowerPath = relativePath.toLowerCase();
          
          // 🚫 HTML/HTM dosyalarını filtrele
          if (lowerPath.endsWith('.html') || lowerPath.endsWith('.htm')) {
            console.log(`   ⏭️ HTML dosyası atlandı: ${relativePath}`);
            continue;
          }

          // Dosya içeriğini al
          const fileBuffer = await zipEntry.async('uint8array');
          
          // Dosya tipini tespit et
          const fileType = await fileTypeFromBuffer(fileBuffer);
          const fileMimeType = fileType?.mime || 'application/octet-stream';
          
          // Base64'e çevir
          const fileBase64 = Buffer.from(fileBuffer).toString('base64');

          extractedFiles.push({
            name: relativePath,
            type: fileMimeType,
            size: fileBuffer.length,
            content: fileBase64
          });

          console.log(`   ✅ ${relativePath} (${fileMimeType}, ${(fileBuffer.length / 1024).toFixed(1)} KB)`);
        }

        console.log(`📦 ZIP extraction tamamlandı: ${extractedFiles.length} dosya`);

        // ZIP extraction response
        return NextResponse.json({
          success: true,
          filename,
          mimeType,
          size: buffer.byteLength,
          isZip: true,
          files: extractedFiles,
          filesCount: extractedFiles.length
        });

      } catch (zipError: any) {
        console.error('❌ ZIP extraction hatası:', zipError);
        // ZIP açılamazsa normal dosya olarak dön
        return NextResponse.json({
          success: true,
          filename,
          mimeType,
          size: buffer.byteLength,
          data: base64,
          isZip: false,
          zipError: zipError.message
        });
      }
    }

    // 🚫 HTML/HTM dosyalarını reddet (tek dosya indirme)
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename.endsWith('.html') || lowerFilename.endsWith('.htm') || mimeType.includes('text/html')) {
      console.log(`⏭️ HTML dosyası reddedildi: ${filename}`);
      return NextResponse.json({
        success: false,
        error: 'HTML dosyaları desteklenmiyor',
      }, { status: 400 });
    }

    // JSON response: dosya adı, GERÇEK mimeType, boyut, base64
    return NextResponse.json({
      success: true,
      filename,
      mimeType, // 🔥 Artık gerçek MIME type (file-type detection)
      size: buffer.byteLength,
      data: base64,
      isZip: false
    });

  } catch (error: any) {
    console.error('❌ Document download error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Bilinmeyen hata',
      },
      { status: 500 }
    );
  }
}
