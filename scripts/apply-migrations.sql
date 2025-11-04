-- ============================================================================
-- COMBINED MIGRATIONS - Apply all pending migrations
-- Run this SQL in Supabase SQL Editor
-- ============================================================================

-- Migration 1: Add tender_items table
CREATE TABLE IF NOT EXISTS tender_items (
  id BIGSERIAL PRIMARY KEY,
  tender_id BIGINT NOT NULL REFERENCES ihale_listings(id) ON DELETE CASCADE,

  item_number INT,
  item_name VARCHAR(500) NOT NULL,
  quantity NUMERIC,
  unit VARCHAR(50),
  unit_price NUMERIC,
  total_price NUMERIC,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tender_items_tender_id ON tender_items(tender_id);
CREATE INDEX IF NOT EXISTS idx_tender_items_item_name ON tender_items USING gin(to_tsvector('turkish', item_name));

-- Migration 2: Add columns to ihale_listings for item summaries
ALTER TABLE ihale_listings
ADD COLUMN IF NOT EXISTS total_items INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_meal_quantity NUMERIC,
ADD COLUMN IF NOT EXISTS estimated_budget_from_items NUMERIC;

-- Migration 3: Add specification_url
ALTER TABLE ihale_listings
ADD COLUMN IF NOT EXISTS specification_url TEXT;

-- Migration 4: Add announcement_text
ALTER TABLE ihale_listings
ADD COLUMN IF NOT EXISTS announcement_text TEXT;

-- Trigger for tender_items updated_at
CREATE OR REPLACE FUNCTION update_tender_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_update_tender_items_updated_at
BEFORE UPDATE ON tender_items
FOR EACH ROW
EXECUTE FUNCTION update_tender_items_updated_at();

-- Comments
COMMENT ON TABLE tender_items IS 'İhalelerin mal/hizmet kalemleri';
COMMENT ON COLUMN ihale_listings.specification_url IS 'İhale şartname dökümanı indirme linki';
COMMENT ON COLUMN ihale_listings.announcement_text IS 'İhale ilan metni (temiz, okunabilir text)';

-- Done!
SELECT 'Migrations applied successfully!' as result;
