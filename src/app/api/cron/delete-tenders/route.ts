// ============================================================================
// CRON: SMART CLEANUP - OLD & EXPIRED TENDERS
// Her gün saat 09:00'da çalışır - sadece eski/süresi geçmiş ihaleleri siler
// ============================================================================

import { NextResponse } from 'next/server';
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

    console.log('🧹 CRON: Smart Cleanup başlatıldı...');
    console.log('⏰ Zamanlama: Her gün 09:00');

    const db = getDatabase();
    const now = new Date();
    
    // ============================================================================
    // CLEANUP RULES (AKILLI TEMİZLİK KURALLARI)
    // ============================================================================
    
    // Rule 1: Deadline'ı 7+ gün geçmiş ihaleler
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();
    
    console.log('\n📋 Kural 1: Deadline\'ı 7+ gün geçmiş ihaleler...');
    const expiredResult = db.prepare(`
      DELETE FROM ihale_listings 
      WHERE deadline_date IS NOT NULL 
        AND deadline_date < ?
        AND deadline_date != ''
    `).run(sevenDaysAgoISO);
    
    console.log(`   ✅ ${expiredResult.changes || 0} süresi geçmiş ihale silindi`);
    
    // Rule 2: 30+ gün önce eklenmiş VE deadline bilgisi OLMAYAN ihaleler
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();
    
    console.log('\n📋 Kural 2: 30+ gün önce eklenmiş + deadline bilgisi olmayan...');
    const oldNoDeadlineResult = db.prepare(`
      DELETE FROM ihale_listings 
      WHERE (deadline_date IS NULL OR deadline_date = '')
        AND first_seen_at < ?
    `).run(thirtyDaysAgoISO);
    
    console.log(`   ✅ ${oldNoDeadlineResult.changes || 0} eski ihale silindi`);
    
    // Rule 3: is_active = 0 olan ihaleler (manuel olarak devre dışı bırakılmış)
    console.log('\n📋 Kural 3: Devre dışı bırakılmış ihaleler...');
    const inactiveResult = db.prepare(`
      DELETE FROM ihale_listings 
      WHERE is_active = 0
    `).run();
    
    console.log(`   ✅ ${inactiveResult.changes || 0} devre dışı ihale silindi`);
    
    // ============================================================================
    // STATISTICS
    // ============================================================================
    const totalDeleted = (expiredResult.changes || 0) + 
                        (oldNoDeadlineResult.changes || 0) + 
                        (inactiveResult.changes || 0);
    
    // Kalan aktif ihale sayısı
    const remainingCount = db.prepare('SELECT COUNT(*) as count FROM ihale_listings').get() as { count: number };
    
    console.log('\n📊 TEMİZLİK RAPORU:');
    console.log(`   🗑️  Toplam silinen: ${totalDeleted}`);
    console.log(`   ✅ Kalan aktif ihale: ${remainingCount.count}`);
    console.log(`   ⏰ Timestamp: ${now.toISOString()}`);

    return NextResponse.json({
      success: true,
      message: `✅ Smart cleanup tamamlandı`,
      deletedCount: totalDeleted,
      breakdown: {
        expired: expiredResult.changes || 0,
        oldWithoutDeadline: oldNoDeadlineResult.changes || 0,
        inactive: inactiveResult.changes || 0,
      },
      remainingTenders: remainingCount.count,
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Cron exception:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
