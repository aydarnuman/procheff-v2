// ============================================================================
// CRON: SCRAPE NEW TENDERS
// Günde 3 kez çalışır - sadece yeni ihaleleri toplar (mode=new)
// Schedule: 09:15, 13:00, 18:00
// ============================================================================

import { NextResponse } from 'next/server';
import { ScraperOrchestrator } from '@/lib/ihale-scraper/orchestrator';
import { getDatabase } from '@/lib/ihale-scraper/database';

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

    const now = new Date();
    const hour = now.getHours();
    
    console.log('🚀 CRON: İhale scraping başlatıldı (SMART MODE)...');
    console.log(`⏰ Çalıştırma saati: ${hour}:${now.getMinutes()}`);
    console.log('📊 Mode: NEW (sadece yeni sayfalar, duplicate\'te dur)');

    // 🔧 ÖNCE DATABASE'İ INIT ET
    getDatabase();
    console.log('📦 Database initialized');

    const orchestrator = new ScraperOrchestrator();

    // 🚀 HEMEN CEVAP DÖN - Vercel timeout'tan kaçın!
    const response = NextResponse.json({
      success: true,
      message: '✅ Smart scraping arka planda başlatıldı',
      mode: 'new',
      timestamp: now.toISOString(),
    });

    // ⚡ ARKA PLANDA ÇALIŞTIR (await yok!)
    // Mode=new parametresi ile - duplicate sayfa gelince dur
    orchestrator.runSingle('ihalebul', false).then(async (result) => {
      console.log(`\n✅ Scraping tamamlandı (${hour}:${now.getMinutes()})`);
      console.log(`   📊 Toplam taranan: ${result.totalScraped}`);
      console.log(`   ✨ Yeni eklenen: ${result.newTenders || 0}`);
      console.log(`   🔄 Duplicate: ${result.totalScraped - (result.newTenders || 0)}`);
      console.log(`   ❌ Hata: ${result.errors.length}`);

      // Sadece SABAH çalışmasında Quick Fix yap (09:15)
      if (hour === 9) {
        console.log('\n⚡ Quick Fix başlatılıyor (sabah rutin bakımı)...');
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
      } else {
        console.log('ℹ️  Quick Fix atlandı (sadece sabah çalışır)');
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
