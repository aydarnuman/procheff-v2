// ============================================================================
// CRON: SMART CLEANUP - OLD & EXPIRED TENDERS
// Her gün saat 09:00'da çalışır - sadece eski/süresi geçmiş ihaleleri siler
// ============================================================================

import { NextResponse } from 'next/server';
import { TenderDatabase } from '@/lib/ihale-scraper/database';

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

    const now = new Date();
    
    // ============================================================================
    // CLEANUP RULES (AKILLI TEMİZLİK KURALLARI)
    // ============================================================================
    
    // Rule 1: Deadline'ı 7+ gün geçmiş ihaleler
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();
    
    console.log('\n📋 Kural 1: Deadline\'ı 7+ gün geçmiş ihaleler...');
    const expiredIds = await TenderDatabase.getTenders({
      is_active: true,
    });
    const expiredToDelete = expiredIds.filter((t: any) => {
      if (!t.deadline_date) return false;
      return new Date(t.deadline_date) < sevenDaysAgo;
    }).map((t: any) => t.id);
    
    const expiredResult = expiredToDelete.length > 0 
      ? await TenderDatabase.deleteTenders(expiredToDelete)
      : { success: true, deletedCount: 0 };
    
    console.log(`   ✅ ${expiredResult.deletedCount} süresi geçmiş ihale silindi`);
    
    // Rule 2: 30+ gün önce eklenmiş VE deadline bilgisi OLMAYAN ihaleler
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    console.log('\n📋 Kural 2: 30+ gün önce eklenmiş + deadline bilgisi olmayan...');
    const oldNoDeadlineIds = expiredIds.filter((t: any) => {
      if (t.deadline_date) return false;
      if (!t.first_seen_at) return false;
      return new Date(t.first_seen_at) < thirtyDaysAgo;
    }).map((t: any) => t.id);
    
    const oldNoDeadlineResult = oldNoDeadlineIds.length > 0
      ? await TenderDatabase.deleteTenders(oldNoDeadlineIds)
      : { success: true, deletedCount: 0 };
    
    console.log(`   ✅ ${oldNoDeadlineResult.deletedCount} eski ihale silindi`);
    
    // Rule 3: is_active = 0 olan ihaleler (manuel olarak devre dışı bırakılmış)
    console.log('\n📋 Kural 3: Devre dışı bırakılmış ihaleler...');
    const inactiveIds = await TenderDatabase.getTenders({
      is_active: false,
    });
    const inactiveResult = inactiveIds.length > 0
      ? await TenderDatabase.deleteTenders(inactiveIds.map((t: any) => t.id))
      : { success: true, deletedCount: 0 };
    
    console.log(`   ✅ ${inactiveResult.deletedCount} devre dışı ihale silindi`);
    
    // ============================================================================
    // STATISTICS
    // ============================================================================
    const totalDeleted = expiredResult.deletedCount + 
                        oldNoDeadlineResult.deletedCount + 
                        inactiveResult.deletedCount;
    
    // Kalan aktif ihale sayısı
    const stats = await TenderDatabase.getStats();
    
    console.log('\n📊 TEMİZLİK RAPORU:');
    console.log(`   🗑️  Toplam silinen: ${totalDeleted}`);
    console.log(`   ✅ Kalan aktif ihale: ${stats.total}`);
    console.log(`   ⏰ Timestamp: ${now.toISOString()}`);

    return NextResponse.json({
      success: true,
      message: `✅ Smart cleanup tamamlandı`,
      deletedCount: totalDeleted,
      breakdown: {
        expired: expiredResult.deletedCount,
        oldWithoutDeadline: oldNoDeadlineResult.deletedCount,
        inactive: inactiveResult.deletedCount,
      },
      remainingTenders: stats.total,
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
