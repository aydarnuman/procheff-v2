import { NextRequest, NextResponse } from 'next/server';
import { ScraperOrchestrator } from '@/lib/ihale-scraper/orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 dakika timeout

export async function POST(request: NextRequest) {
  try {
    // Support both JSON body and query parameters
    let url, maxPages = 10;
    
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source');
    
    if (source) {
      // Query parameter mode - no body parsing needed
      url = null;
      maxPages = parseInt(searchParams.get('maxPages') || '10');
    } else {
      // JSON body mode
      const body = await request.json();
      url = body.url;
      maxPages = body.maxPages || 10;
    }

    console.log('🚀 Starting scraping in background...');
    console.log('   Source:', source || 'all');
    console.log('   MaxPages:', maxPages);

    // Initialize orchestrator
    console.log('🔧 Initializing ScraperOrchestrator...');
    const orchestrator = new ScraperOrchestrator();
    console.log('✅ ScraperOrchestrator initialized successfully');

    // 🚀 Return immediately - don't wait for scraping to complete
    const response = NextResponse.json({
      success: true,
      message: '✅ Scraping arka planda başlatıldı! Logları terminal/console\'da izleyin.',
      timestamp: new Date().toISOString(),
    });

    // ⚡ Run in background (no await!)
    orchestrator.runAll(false, source || undefined).then(result => {
      console.log('\n✅ SCRAPING TAMAMLANDI:', {
        success: result.success,
        totalNew: result.totalNew,
        totalCatering: result.totalCatering,
        results: result.results.map(r => `${r.source}: ${r.newTenders} new`),
      });
    }).catch(error => {
      console.error('❌ SCRAPING BACKGROUND ERROR:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    });

    return response;

  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 }
    );
  }
}