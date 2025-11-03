// ============================================================================
// CRON: DELETE ALL TENDERS
// Her gün saat 09:50'de çalışır - tüm ihaleleri siler
// ============================================================================

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ihale-scraper/database/supabase-client';

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
    const { error, count } = await supabaseAdmin
      .from('ihale_listings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using a condition that's always true)

    if (error) {
      console.error('❌ Silme hatası:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

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
