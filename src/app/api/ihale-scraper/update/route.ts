import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

    // Add last_updated_at timestamp
    const updateData = {
      ...updates,
      last_updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('ihale_listings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

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
        const updateData = {
          ...update.data,
          last_updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from('ihale_listings')
          .update(updateData)
          .eq('id', update.id)
          .select()
          .single();

        if (error) {
          errors.push({ id: update.id, error: error.message });
        } else {
          results.push(data);
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
