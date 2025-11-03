// ============================================================================
// LIST API ROUTE
// İhale listesi - filtreleme ve pagination desteği
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { TenderDatabase } from '@/lib/ihale-scraper/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filters
    const filters = {
      isCatering: searchParams.get('is_catering') === 'true',
      minBudget: searchParams.get('min_budget') ? parseInt(searchParams.get('min_budget')!) : undefined,
      maxBudget: searchParams.get('max_budget') ? parseInt(searchParams.get('max_budget')!) : undefined,
      city: searchParams.get('city') || undefined,
      source: searchParams.get('source') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    const result = await TenderDatabase.getTendersFiltered(filters);

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
      page: Math.floor(filters.offset / filters.limit) + 1,
      pageSize: filters.limit,
      totalPages: Math.ceil(result.total / filters.limit),
    });
  } catch (error: any) {
    console.error('List API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
