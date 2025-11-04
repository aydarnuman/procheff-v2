// ============================================================================
// API: FIX MISSING DATA
// Kayıt numarası veya kurum adı eksik olan ihaleleri AI ile tekrar çeker
// ============================================================================

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/ihale-scraper/database/sqlite-client';

export async function POST(request: Request) {
  try {
    console.log('🔧 Eksik verileri düzeltme başlatıldı...');

    const db = getDatabase();

    // Get tenders with missing data
    const tenders = db.prepare(`
      SELECT id, title, organization, registration_number, source_url
      FROM ihale_listings
      WHERE registration_number IS NULL
         OR organization = 'Belirtilmemiş'
      ORDER BY id
    `).all();

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
    for (const tender of tenders) {
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
