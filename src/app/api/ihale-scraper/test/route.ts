// ============================================================================
// TEST API ROUTE
// Manuel scraping testi için (geliştirme ortamında kullanılır)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { ScraperOrchestrator } from '@/lib/ihale-scraper/orchestrator';
import { getDatabase } from '@/lib/ihale-scraper/database/sqlite-client';

export async function GET(request: NextRequest) {
  try {
    console.log('\n🧪 TEST SCRAPING BAŞLIYOR (BACKGROUND MODE)...\n');

    // 🔧 ÖNCE DATABASE'İ INIT ET (schema lock file oluştur)
    getDatabase();
    console.log('📦 Database initialized before scraping');

    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source'); // Specific source or all

    const orchestrator = new ScraperOrchestrator();

    // 🚀 HEMEN CEVAP DÖN - Tarayıcı bloke olmaz!
    const response = NextResponse.json({
      success: true,
      message: '✅ Scraping arka planda başlatıldı! Logları terminal/console\'da izleyin.',
      source: source || 'all',
      timestamp: new Date().toISOString(),
    });

    // ⚡ ARKA PLANDA ÇALIŞTIR (await yok!)
    if (source) {
      // Run specific scraper (TEST MODE: save ALL tenders)
      orchestrator.runSingle(source, true).then(result => {
        console.log('\n✅ SCRAPING TAMAMLANDI:', {
          source: result.source,
          success: result.success,
          totalScraped: result.totalScraped,
          newTenders: result.newTenders,
          duration: result.duration,
          errors: result.errors.length,
        });
      }).catch(error => {
        console.error('❌ Scraping error:', error);
      });
    } else {
      // Run all scrapers (TEST MODE: save ALL tenders)
      orchestrator.runAll(true).then(allResults => {
        console.log('\n✅ TÜM SCRAPING TAMAMLANDI:', {
          success: allResults.success,
          totalNew: allResults.totalNew,
          totalCatering: allResults.totalCatering,
        });
      }).catch(error => {
        console.error('❌ Scraping error:', error);
      });
    }

    return response;
  } catch (error: any) {
    console.error('❌ Test scraping error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Same as GET but with authentication check
  return GET(request);
}
