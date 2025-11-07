// ============================================================================
// LIST API ROUTE
// İhale listesi - filtreleme ve pagination desteği
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { TenderDatabase } from '@/lib/ihale-scraper/database';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // 🆕 Eğer ID parametresi varsa, tek tender getir
    const tenderIdStr = searchParams.get('id');
    if (tenderIdStr) {
      const tender = await TenderDatabase.getTenderById(parseInt(tenderIdStr, 10));
      if (!tender) {
        return NextResponse.json(
          { success: false, error: 'Tender bulunamadı' },
          { status: 404 }
        );
      }

      // Serialize single tender
      const plainTender: any = {};
      for (const [key, value] of Object.entries(tender)) {
        if (value === null || value === undefined) {
          plainTender[key] = value;
        } else if (key === 'raw_json' && typeof value === 'object') {
          plainTender[key] = JSON.parse(JSON.stringify(value));
        } else if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
          plainTender[key] = value?.toString() || null;
        } else {
          plainTender[key] = value;
        }
      }

      return NextResponse.json({
        success: true,
        data: [plainTender], // Array formatında döndür (fetchAI uyumluluğu için)
        total: 1,
      });
    }

    // Parse filters
    const filters = {
      isCatering: searchParams.get('is_catering') === 'true' ? true : undefined,
      minBudget: searchParams.get('min_budget') ? parseInt(searchParams.get('min_budget')!) : undefined,
      maxBudget: searchParams.get('max_budget') ? parseInt(searchParams.get('max_budget')!) : undefined,
      city: searchParams.get('city') || undefined,
      source: searchParams.get('source') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    const result = await TenderDatabase.getTendersFiltered(filters);

    // Serialize data to plain objects (fix "Only plain objects" error)
    const serializedData = result.data.map(tender => {
      const plainTender: any = {};
      for (const [key, value] of Object.entries(tender)) {
        if (value === null || value === undefined) {
          plainTender[key] = value;
        } else if (key === 'raw_json' && typeof value === 'object') {
          plainTender[key] = JSON.parse(JSON.stringify(value));
        } else if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
          plainTender[key] = value?.toString() || null;
        } else {
          plainTender[key] = value;
        }
      }
      return plainTender;
    });

    return NextResponse.json({
      success: true,
      data: serializedData,
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
