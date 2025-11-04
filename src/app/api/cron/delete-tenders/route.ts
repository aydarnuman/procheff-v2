// ============================================================================
// CRON: DELETE ALL TENDERS
// Her gün saat 09:50'de çalışır - tüm ihaleleri siler
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

    console.log('🗑️ CRON: Tüm ihaleleri silme başlatıldı...');

    // Delete all tenders
    const db = getDatabase();
    const result = db.prepare('DELETE FROM ihale_listings').run();
    const count = result.changes;

    console.log(`✅ ${count || 0} ihale silindi`);

    return NextResponse.json({
      success: true,
      message: `✅ ${count || 0} ihale başarıyla silindi`,
      deletedCount: count || 0,
      timestamp: new Date().toISOString(),
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
