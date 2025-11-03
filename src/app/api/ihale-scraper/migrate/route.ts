import { NextResponse } from 'next/server';
import { TenderDatabase } from '@/lib/ihale-scraper/database/supabase-client';

export async function POST(request: Request) {
  try {
    console.log('🔧 VARCHAR Limit Migration başlatılıyor...');

    // Step 1: Drop view
    console.log('Step 1: Dropping view...');
    const dropResult = await TenderDatabase.rawQuery(`
      DROP VIEW IF EXISTS active_catering_tenders CASCADE;
    `);
    console.log('✅ View dropped:', dropResult);

    // Step 2: Alter columns
    console.log('Step 2: Altering column types...');

    await TenderDatabase.rawQuery(`
      ALTER TABLE ihale_listings ALTER COLUMN organization_city TYPE VARCHAR(200);
    `);
    console.log('✅ organization_city → VARCHAR(200)');

    await TenderDatabase.rawQuery(`
      ALTER TABLE ihale_listings ALTER COLUMN tender_type TYPE VARCHAR(200);
    `);
    console.log('✅ tender_type → VARCHAR(200)');

    await TenderDatabase.rawQuery(`
      ALTER TABLE ihale_listings ALTER COLUMN category TYPE VARCHAR(200);
    `);
    console.log('✅ category → VARCHAR(200)');

    // Step 3: Recreate view
    console.log('Step 3: Recreating view...');
    const createViewResult = await TenderDatabase.rawQuery(`
      CREATE OR REPLACE VIEW active_catering_tenders AS
      SELECT
        il.*,
        ipd.kisi_sayisi,
        ipd.ogun_sayisi,
        ipd.gun_sayisi,
        ipd.estimated_daily_meals,
        CASE
          WHEN il.deadline_date IS NOT NULL THEN il.deadline_date - CURRENT_DATE
          ELSE NULL
        END as days_until_deadline
      FROM ihale_listings il
      LEFT JOIN ihale_parsed_details ipd ON il.id = ipd.ihale_id
      WHERE il.is_catering = true
        AND il.is_active = true
        AND (il.deadline_date IS NULL OR il.deadline_date >= CURRENT_DATE)
      ORDER BY il.deadline_date ASC NULLS LAST;
    `);
    console.log('✅ View recreated:', createViewResult);

    console.log('✅ Migration tamamlandı!');

    return NextResponse.json({
      success: true,
      message: '✅ Migration başarıyla tamamlandı! Artık 200+ karakterlik veriler kaydedilebilir.',
      changes: {
        organization_city: 'VARCHAR(100) → VARCHAR(200)',
        tender_type: 'VARCHAR(100) → VARCHAR(200)',
        category: 'VARCHAR(100) → VARCHAR(200)',
      },
    });
  } catch (error: any) {
    console.error('❌ Migration hatası:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
