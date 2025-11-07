import { NextResponse } from 'next/server';
import { TenderDatabase } from '@/lib/ihale-scraper/database';

// Update single tender
export async function PATCH(request: Request) {
  try {
    const { id, updates } = await request.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'Updates required' }, { status: 400 });
    }

    const result = await TenderDatabase.updateTender(id, updates);

    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 });
    }

    // Get updated data
    const data = await TenderDatabase.getTenderById(id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Bulk update multiple tenders
export async function POST(request: Request) {
  try {
    const { updates } = await request.json();

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ success: false, error: 'Updates array required' }, { status: 400 });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      if (!update.id) {
        errors.push({ error: 'Missing ID', update });
        continue;
      }

      try {
        const result = await TenderDatabase.updateTender(update.id, update.data);

        if (result.success) {
          const data = await TenderDatabase.getTenderById(update.id);
          results.push(data);
        } else {
          errors.push({ id: update.id, error: 'Update failed' });
        }
      } catch (error: any) {
        errors.push({ id: update.id, error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      updated: results.length,
      total: updates.length,
      errors: errors.length > 0 ? errors : undefined,
      data: results,
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
