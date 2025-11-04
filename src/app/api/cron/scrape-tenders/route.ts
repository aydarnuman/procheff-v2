// ============================================================================
// CRON: SCRAPE NEW TENDERS
// Her gün saat 10:00'da çalışır - yeni ihaleleri toplar
// ============================================================================

import { NextResponse } from 'next/server';
import { ScraperOrchestrator } from '@/lib/ihale-scraper/orchestrator';
import { getDatabase } from '@/lib/ihale-scraper/database/sqlite-client';

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

    console.log('🚀 CRON: İhale scraping başlatıldı (BACKGROUND MODE)...');
    console.log('⏰ Zamanlama: Her gün 10:00');

    // 🔧 ÖNCE DATABASE'İ INIT ET
    getDatabase();
    console.log('📦 Database initialized before scraping');

    const orchestrator = new ScraperOrchestrator();

    // 🚀 HEMEN CEVAP DÖN - Vercel timeout'tan kaçın!
    const response = NextResponse.json({
      success: true,
      message: '✅ Scraping arka planda başlatıldı',
      timestamp: new Date().toISOString(),
    });

    // ⚡ ARKA PLANDA ÇALIŞTIR (await yok!)
    orchestrator.runSingle('ihalebul', false).then(async (result) => {
      console.log(`✅ Scraping tamamlandı`);
      console.log(`   📊 Toplam: ${result.totalScraped}`);
      console.log(`   ✅ Yeni: ${result.newTenders || 0}`);
      console.log(`   ❌ Hata: ${result.errors.length}`);

      // Quick Fix'i de arka planda çalıştır
      console.log('\n⚡ Quick Fix başlatılıyor (eksik veriler için)...');
      try {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000';

        const quickFixResponse = await fetch(`${baseUrl}/api/ihale-scraper/quick-fix`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const quickFixData = await quickFixResponse.json();

        if (quickFixData.success) {
          console.log(`✅ Quick Fix tamamlandı: ${quickFixData.fixed} ihale düzeltildi`);
        } else {
          console.log(`⚠️ Quick Fix hatası: ${quickFixData.error}`);
        }
      } catch (quickFixError: any) {
        console.warn(`⚠️ Quick Fix çalıştırılamadı: ${quickFixError.message}`);
      }
    }).catch(error => {
      console.error('❌ Scraping error:', error);
    });

    return response;
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
