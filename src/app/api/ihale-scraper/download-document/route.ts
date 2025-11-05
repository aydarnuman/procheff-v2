// ============================================================================
// DOCUMENT DOWNLOAD API
// Şartname ve diğer dökümanları proxy ile indir
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { fileTypeFromBuffer } from 'file-type';

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
          const timeout = setTimeout(() => controller.abort(), 10000); // 10sn timeout
          const response = await fetch(url, { ...options, signal: controller.signal });
          clearTimeout(timeout);
          return response;
        } catch (err) {
          if (i === retries) throw err;
          await new Promise(r => setTimeout(r, 500)); // 0.5sn bekle
        }
      }
    }

    // Cookie'leri request'ten al (authentication için gerekli)
    const cookies = request.headers.get('cookie') || '';

    const fetchHeaders: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/pdf,application/zip,application/octet-stream,*/*',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': url,
    };

    // Cookie varsa ekle (authentication için kritik!)
    if (cookies) {
      fetchHeaders['Cookie'] = cookies;
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

    // JSON response: dosya adı, GERÇEK mimeType, boyut, base64
    return NextResponse.json({
      success: true,
      filename,
      mimeType, // 🔥 Artık gerçek MIME type (file-type detection)
      size: buffer.byteLength,
      data: base64,
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
