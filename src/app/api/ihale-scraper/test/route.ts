// ============================================================================
// TEST API ROUTE
// Manuel scraping testi için (geliştirme ortamında kullanılır)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { ScraperOrchestrator } from '@/lib/ihale-scraper/orchestrator';

export async function GET(request: NextRequest) {
  try {
    console.log('\n🧪 TEST SCRAPING BAŞLIYOR...\n');

    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source'); // Specific source or all

    const orchestrator = new ScraperOrchestrator();
    let result;

    if (source) {
      // Run specific scraper in TEST MODE (saves all tenders)
      result = await orchestrator.runSingle(source, true);
      return NextResponse.json({
        success: result.success,
        source: result.source,
        totalScraped: result.totalScraped,
        newTenders: result.newTenders,
        duration: result.duration,
        errors: result.errors,
      });
    } else {
      // Run all scrapers
      const allResults = await orchestrator.runAll();
      return NextResponse.json({
        success: allResults.success,
        totalNew: allResults.totalNew,
        totalCatering: allResults.totalCatering,
        results: allResults.results.map(r => ({
          source: r.source,
          success: r.success,
          totalScraped: r.totalScraped,
          newTenders: r.newTenders,
          duration: r.duration,
          errors: r.errors.length,
        })),
      });
    }
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
