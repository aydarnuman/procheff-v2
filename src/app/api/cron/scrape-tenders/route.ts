// ============================================================================
// CRON: SCRAPE NEW TENDERS
// Her gün saat 10:00'da çalışır - yeni ihaleleri toplar
// ============================================================================

import { NextResponse } from 'next/server';
import { ScraperOrchestrator } from '@/lib/ihale-scraper/orchestrator';

export async function GET(request: Request) {
  try {
    // Verify cron secret (Vercel tarafından otomatik eklenir)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🚀 CRON: İhale scraping başlatıldı...');
    console.log('⏰ Zamanlama: Her gün 10:00');

    const startTime = Date.now();

    // Run scraper
    const result = await ScraperOrchestrator.scrapeAll({
      sources: ['ihalebul'],
      maxPages: 10,
      parallelPages: 5,
      testMode: false, // Production mode - sadece catering ihaleleri
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`✅ Scraping tamamlandı (${duration}s)`);
    console.log(`   📊 Toplam: ${result.totalScraped}`);
    console.log(`   ✅ Yeni: ${result.newListings}`);
    console.log(`   ⚠️  Duplicate: ${result.duplicates}`);
    console.log(`   ❌ Hata: ${result.errors}`);

    return NextResponse.json({
      success: true,
      message: `✅ Scraping tamamlandı`,
      totalScraped: result.totalScraped,
      newListings: result.newListings,
      duplicates: result.duplicates,
      errors: result.errors,
      durationSeconds: parseFloat(duration),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Cron exception:', error);
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
