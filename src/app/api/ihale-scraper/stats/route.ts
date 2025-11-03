// ============================================================================
// STATS API ROUTE
// Scraper istatistikleri
// ============================================================================

import { NextResponse } from 'next/server';
import { TenderDatabase } from '@/lib/ihale-scraper/database/supabase-client';

export async function GET() {
  try {
    const stats = await TenderDatabase.getScrapingStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
