-- ============================================================================
-- VERCEL POSTGRES MIGRATION SCRIPT
-- SQLite'dan Vercel Postgres'e geçiş için schema
-- ============================================================================

-- ============================================================================
-- İHALE LİSTELERİ (Ana Tablo)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ihale_listings (
  id SERIAL PRIMARY KEY,

  -- Source bilgileri
  source VARCHAR(50) NOT NULL,              -- 'ihalebul', 'kik', 'ekap'
  source_id VARCHAR(100),                   -- Kaynak sitedeki ID
  source_url TEXT,                          -- İhale detay linki

  -- İhale bilgileri
  title TEXT NOT NULL,                      -- İhale başlığı
  organization TEXT NOT NULL,               -- Kurumu/organizasyon
  organization_city VARCHAR(100),           -- Şehir
  registration_number VARCHAR(100),         -- İhale kayıt numarası (örn: 2025/1634941)
  tender_type VARCHAR(100),                 -- İhale türü
  procurement_type VARCHAR(50),             -- Tedarik türü (mal/hizmet)
  category VARCHAR(100),                    -- Kategori

  -- Tarihler
  announcement_date TIMESTAMP,              -- İlan tarihi
  tender_date TIMESTAMP,                    -- İhale tarihi
  deadline_date TIMESTAMP,                  -- Son başvuru tarihi

  -- Bütçe
  budget NUMERIC(15, 2),                    -- Tahmini bütçe (TL)
  currency VARCHAR(10) DEFAULT 'TRY',       -- Para birimi

  -- Kategorileme (AI)
  is_catering BOOLEAN DEFAULT FALSE,        -- Yemek/catering ihalesi mi?
  catering_confidence NUMERIC(3, 2),        -- AI confidence score (0.00-1.00)
  ai_categorization_reasoning TEXT,         -- AI'ın kategorileme sebebi

  -- AI analiz bilgileri
  ai_analyzed BOOLEAN DEFAULT FALSE,        -- AI analizi yapıldı mı?
  ai_analyzed_at TIMESTAMP,                 -- AI analiz zamanı

  -- Döküman bilgileri
  specification_url TEXT,                   -- Şartname döküman linki
  announcement_text TEXT,                   -- İhale ilan metni (temiz text)

  -- Mal/hizmet kalemleri özet bilgileri
  total_items INTEGER DEFAULT 0,            -- Toplam kalem sayısı
  total_meal_quantity NUMERIC(15, 2),       -- Toplam öğün sayısı (catering için)
  estimated_budget_from_items NUMERIC(15, 2), -- Kalemlerden hesaplanan bütçe

  -- Metadata
  raw_json JSONB,                           -- Ham JSON data (Postgres JSONB)
  is_active BOOLEAN DEFAULT TRUE,           -- Aktif mi?
  first_seen_at TIMESTAMP DEFAULT NOW(),    -- İlk görülme zamanı
  last_updated_at TIMESTAMP DEFAULT NOW(),  -- Son güncelleme
  created_at TIMESTAMP DEFAULT NOW(),

  -- Unique constraint
  CONSTRAINT unique_source_id UNIQUE(source, source_id)
);

-- ============================================================================
-- MAL/HİZMET KALEMLERİ
-- ============================================================================
CREATE TABLE IF NOT EXISTS tender_items (
  id SERIAL PRIMARY KEY,
  tender_id INTEGER NOT NULL REFERENCES ihale_listings(id) ON DELETE CASCADE,

  -- Kalem bilgileri
  item_number INTEGER,                      -- Sıra numarası
  item_name TEXT NOT NULL,                  -- Kalem adı
  quantity NUMERIC(15, 2),                  -- Miktar
  unit VARCHAR(50),                         -- Birim (ADET, KG, LİTRE)

  -- Fiyat bilgileri
  unit_price NUMERIC(15, 2),                -- Birim fiyat
  total_price NUMERIC(15, 2),               -- Toplam fiyat

  -- AI kategorileme
  is_catering_item BOOLEAN DEFAULT FALSE,   -- Catering kalemi mi?
  confidence NUMERIC(3, 2),                 -- Confidence score

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- SESSION LOGS (Scraping kayıtları)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scraper_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) UNIQUE NOT NULL,
  source VARCHAR(50) NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  status VARCHAR(20),                       -- 'running', 'completed', 'failed'
  total_scraped INTEGER DEFAULT 0,
  new_tenders INTEGER DEFAULT 0,
  duplicates INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES (Performance için)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_source ON ihale_listings(source);
CREATE INDEX IF NOT EXISTS idx_is_catering ON ihale_listings(is_catering);
CREATE INDEX IF NOT EXISTS idx_deadline_date ON ihale_listings(deadline_date);
CREATE INDEX IF NOT EXISTS idx_is_active ON ihale_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_created_at ON ihale_listings(created_at);
CREATE INDEX IF NOT EXISTS idx_organization_city ON ihale_listings(organization_city);

-- Tender items için index
CREATE INDEX IF NOT EXISTS idx_tender_id ON tender_items(tender_id);

-- Session logs için index
CREATE INDEX IF NOT EXISTS idx_session_source ON scraper_sessions(source);
CREATE INDEX IF NOT EXISTS idx_session_status ON scraper_sessions(status);

-- ============================================================================
-- FULL-TEXT SEARCH (PostgreSQL için)
-- ============================================================================
-- GIN index for full-text search on title and organization
CREATE INDEX IF NOT EXISTS idx_title_search ON ihale_listings USING GIN (to_tsvector('turkish', title));
CREATE INDEX IF NOT EXISTS idx_org_search ON ihale_listings USING GIN (to_tsvector('turkish', organization));

-- ============================================================================
-- TRIGGERS (Auto-update last_updated_at)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ihale_listings_updated_at
    BEFORE UPDATE ON ihale_listings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
