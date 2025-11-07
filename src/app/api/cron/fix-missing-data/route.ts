// ============================================================================
// CRON: FIX MISSING DATA
// Scraping sonrası eksik kay kayıt numaraları ve kurum adlarını düzeltir
// Günde 1 kez çalışır (scraping'den 10 dakika sonra)
// ============================================================================

import { NextResponse } from 'next/server';
import { TenderDatabase } from '@/lib/ihale-scraper/database';

export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔧 CRON: Eksik veri düzeltme başlatıldı...');

    const startTime = Date.now();

    // Get tenders with missing data (last 7 days, limit 50)
    const tenders = await TenderDatabase.getTenders({
      limit: 50,
      offset: 0,
    });

    // Filter for missing data
    const missingDataTenders = tenders.filter((t: any) =>
      !t.registration_number || 
      t.organization === 'Belirtilmemiş' || 
      t.title === 'Belirtilmemiş'
    );

    console.log(`📊 ${missingDataTenders.length} ihale bulundu`);

    if (missingDataTenders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Eksik veri yok',
        fixed: 0,
        total: 0,
      });
    }

    let fixed = 0;
    let failed = 0;

    // Process each tender
    for (const tender of missingDataTenders) {
      console.log(`\n🔍 [${fixed + failed + 1}/${missingDataTenders.length}] ${tender.id}: ${tender.title}`);

      try {
        // Call fetch-full-content API
        const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/ihale-scraper/fetch-full-content`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: tender.source_url,
            tenderId: tender.id,
          }),
        });

        const data = await response.json();

        if (data.success) {
          console.log(`   ✅ Düzeltildi`);
          fixed++;
        } else {
          console.log(`   ❌ Hata: ${data.error}`);
          failed++;
        }
      } catch (error: any) {
        console.error(`   ❌ İstek hatası: ${error.message}`);
        failed++;
      }

      // Wait 3 seconds between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n✅ Eksik veri düzeltme tamamlandı (${duration}s)`);
    console.log(`   ✅ Düzeltilen: ${fixed}`);
    console.log(`   ❌ Hatalı: ${failed}`);

    return NextResponse.json({
      success: true,
      message: `✅ ${fixed} ihale düzeltildi`,
      fixed,
      failed,
      total: tenders.length,
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
