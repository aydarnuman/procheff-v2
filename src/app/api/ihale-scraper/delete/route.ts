import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/ihale-scraper/database/sqlite-client';

// Delete single tender
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }

    const db = getDatabase();
    const result = db.prepare('DELETE FROM ihale_listings WHERE id = ?').run(id);

    if (result.changes === 0) {
      return NextResponse.json({ success: false, error: 'Tender not found' }, { status: 404 });
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

    const db = getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(`DELETE FROM ihale_listings WHERE id IN (${placeholders})`).run(...ids);

    return NextResponse.json({ success: true, deleted: result.changes });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
