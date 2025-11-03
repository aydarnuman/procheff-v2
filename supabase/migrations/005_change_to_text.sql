-- ============================================================================
-- CHANGE VARCHAR TO TEXT (UNLIMITED LENGTH)
-- Tarih: 2025-01-03
-- Amaç: VARCHAR(200) bile bazı veriler için yetersiz - TEXT kullan
-- ============================================================================

-- Step 1: Drop view (CASCADE removes dependencies)
DROP VIEW IF EXISTS active_catering_tenders CASCADE;

-- Step 2: Change columns to TEXT (unlimited length)
ALTER TABLE ihale_listings ALTER COLUMN organization_city TYPE TEXT;
ALTER TABLE ihale_listings ALTER COLUMN tender_type TYPE TEXT;
ALTER TABLE ihale_listings ALTER COLUMN category TYPE TEXT;

-- Step 3: Recreate view
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

-- Başarı mesajı
DO $$
BEGIN
  RAISE NOTICE '✅ Kolonlar TEXT tipine değiştirildi (sınırsız uzunluk)';
  RAISE NOTICE '   - organization_city: VARCHAR(200) → TEXT';
  RAISE NOTICE '   - tender_type: VARCHAR(200) → TEXT';
  RAISE NOTICE '   - category: VARCHAR(200) → TEXT';
END $$;
