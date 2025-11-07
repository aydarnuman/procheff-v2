import { NextResponse } from 'next/server';
import { TenderDatabase } from '@/lib/ihale-scraper/database';

// Delete single tender
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }

    const result = await TenderDatabase.deleteTenders([parseInt(id, 10)]);

    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Delete failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Delete multiple tenders
export async function POST(request: Request) {
  try {
    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'IDs array required' }, { status: 400 });
    }

    const result = await TenderDatabase.deleteTenders(ids);

    return NextResponse.json({ success: result.success, deleted: ids.length });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
