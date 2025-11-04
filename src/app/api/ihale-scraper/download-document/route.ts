// ============================================================================
// DOCUMENT DOWNLOAD API
// Şartname ve diğer dökümanları proxy ile indir
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

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
    // 1. Dökümanı fetch et
    // ============================================================
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `HTTP ${response.status}`,
          details: response.statusText,
        },
        { status: response.status }
      );
    }

    // ============================================================
    // 2. Content-Type'ı al
    // ============================================================
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');

    console.log(`✅ Document fetched: ${contentType}, ${contentLength ? (parseInt(contentLength) / 1024).toFixed(1) + ' KB' : 'unknown size'}`);

    // ============================================================
    // 3. Dosya adını belirle
    // ============================================================
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    let filename = pathParts[pathParts.length - 1] || 'document';

    // Eğer uzantı yoksa content-type'a göre ekle
    if (!filename.includes('.')) {
      if (contentType.includes('pdf')) {
        filename += '.pdf';
      } else if (contentType.includes('word') || contentType.includes('msword')) {
        filename += '.doc';
      } else if (contentType.includes('zip')) {
        filename += '.zip';
      }
    }

    // ============================================================
    // 4. Stream olarak döndür
    // ============================================================
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': buffer.byteLength.toString(),
      },
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
