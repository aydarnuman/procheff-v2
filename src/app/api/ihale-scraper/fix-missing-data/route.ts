// ============================================================================
// API: FIX MISSING DATA
// Kayıt numarası veya kurum adı eksik olan ihaleleri AI ile tekrar çeker
// ============================================================================

import { NextResponse } from 'next/server';
import { TenderDatabase } from '@/lib/ihale-scraper/database';

export async function POST(request: Request) {
  try {
    console.log('🔧 Eksik verileri düzeltme başlatıldı...');

    // Get tenders with missing data
    const allTenders = await TenderDatabase.getTenders({ limit: 500, offset: 0 });
    const tenders = allTenders.filter((t: any) =>
      !t.registration_number || t.organization === 'Belirtilmemiş'
    );

    console.log(`📊 ${tenders.length} ihale bulundu`);

    if (tenders.length === 0) {
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
    for (const tender of tenders as any[]) {
      console.log(`\n🔍 ${tender.id}: ${tender.title}`);

      try {
        // Call fetch-full-content API
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ihale-scraper/fetch-full-content`, {
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

      // Wait 2 seconds between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n✅ Tamamlandı!`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Failed: ${failed}`);

    return NextResponse.json({
      success: true,
      message: `${fixed} ihale düzeltildi`,
      fixed,
      failed,
      total: tenders.length,
    });
  } catch (error: any) {
    console.error('❌ Fix missing data exception:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
