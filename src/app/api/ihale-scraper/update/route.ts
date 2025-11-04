import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/ihale-scraper/database/sqlite-client';

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

    // Build update query
    const fields = Object.keys(updates);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => updates[f]);

    const db = getDatabase();
    const result = db.prepare(`
      UPDATE ihale_listings
      SET ${setClause}, last_updated_at = datetime('now')
      WHERE id = ?
    `).run(...values, id);

    if (result.changes === 0) {
      return NextResponse.json({ success: false, error: 'Tender not found' }, { status: 404 });
    }

    // Get updated data
    const data = db.prepare('SELECT * FROM ihale_listings WHERE id = ?').get(id);

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

    const db = getDatabase();
    const results = [];
    const errors = [];

    for (const update of updates) {
      if (!update.id) {
        errors.push({ error: 'Missing ID', update });
        continue;
      }

      try {
        const fields = Object.keys(update.data);
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => update.data[f]);

        const result = db.prepare(`
          UPDATE ihale_listings
          SET ${setClause}, last_updated_at = datetime('now')
          WHERE id = ?
        `).run(...values, update.id);

        if (result.changes > 0) {
          const data = db.prepare('SELECT * FROM ihale_listings WHERE id = ?').get(update.id);
          results.push(data);
        } else {
          errors.push({ id: update.id, error: 'Tender not found' });
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
