import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

/**
 * Proxy endpoint to forward requests to tender sites while preserving cookies
 * This allows users to maintain their authenticated session
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json(
        { success: false, error: 'URL parametresi gerekli' },
        { status: 400 }
      );
    }

    console.log('🔄 Proxying request to:', targetUrl);

    // Forward all cookies from the original request
    const cookies = request.headers.get('cookie') || '';

    // Forward all relevant headers
    const headers: HeadersInit = {
      'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': targetUrl,
    };

    // Add cookies if present
    if (cookies) {
      headers['Cookie'] = cookies;
    }

    // Fetch the target URL with cookies
    const response = await fetch(targetUrl, {
      headers,
      redirect: 'follow',
    });

    // Get the response body
    const html = await response.text();

    // Forward the response with all headers
    const proxyResponse = new NextResponse(html, {
      status: response.status,
      statusText: response.statusText,
    });

    // Copy relevant headers from the target response
    const headersToForward = [
      'content-type',
      'cache-control',
      'expires',
      'last-modified',
      'etag',
    ];

    headersToForward.forEach(headerName => {
      const value = response.headers.get(headerName);
      if (value) {
        proxyResponse.headers.set(headerName, value);
      }
    });

    // Forward cookies from target site
    const setCookies = response.headers.get('set-cookie');
    if (setCookies) {
      proxyResponse.headers.set('set-cookie', setCookies);
    }

    // Inject base tag to fix relative URLs
    const urlObj = new URL(targetUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    const modifiedHtml = html.replace(
      '<head>',
      `<head><base href="${baseUrl}/">`
    );

    console.log('✅ Proxy response sent');

    return new NextResponse(modifiedHtml, {
      status: response.status,
      headers: proxyResponse.headers,
    });

  } catch (error: any) {
    console.error('❌ Proxy error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Proxy request failed',
      },
      { status: 500 }
    );
  }
}
