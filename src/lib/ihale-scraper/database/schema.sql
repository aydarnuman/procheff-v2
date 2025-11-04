-- ============================================================================
-- İHALE SCRAPER - LOCAL SQLITE DATABASE SCHEMA
-- Supabase'den yerel SQLite'a geçiş için schema
-- ============================================================================

-- ============================================================================
-- İHALE LİSTELERİ (Ana Tablo)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ihale_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Source bilgileri
  source TEXT NOT NULL,                     -- 'ihalebul', 'kik', 'ekap'
  source_id TEXT,                           -- Kaynak sitedeki ID
  source_url TEXT,                          -- İhale detay linki

  -- İhale bilgileri
  title TEXT NOT NULL,                      -- İhale başlığı
  organization TEXT NOT NULL,               -- Kurumu/organizasyon
  organization_city TEXT,                   -- Şehir
  registration_number TEXT,                 -- İhale kayıt numarası (örn: 2025/1634941)
  tender_type TEXT,                         -- İhale türü
  procurement_type TEXT,                    -- Tedarik türü (mal/hizmet)
  category TEXT,                            -- Kategori

  -- Tarihler
  announcement_date TEXT,                   -- İlan tarihi (ISO 8601)
  tender_date TEXT,                         -- İhale tarihi (ISO 8601)
  deadline_date TEXT,                       -- Son başvuru tarihi (ISO 8601)

  -- Bütçe
  budget REAL,                              -- Tahmini bütçe (TL)
  currency TEXT DEFAULT 'TRY',              -- Para birimi

  -- Kategorileme (AI)
  is_catering INTEGER DEFAULT 0,            -- Yemek/catering ihalesi mi? (0=false, 1=true)
  catering_confidence REAL,                 -- AI confidence score (0.0-1.0)
  ai_categorization_reasoning TEXT,         -- AI'ın kategorileme sebebi

  -- AI analiz bilgileri (yeni)
  ai_analyzed INTEGER DEFAULT 0,            -- AI analizi yapıldı mı? (0=false, 1=true)
  ai_analyzed_at TEXT,                      -- AI analiz zamanı (ISO 8601)

  -- Döküman bilgileri
  specification_url TEXT,                   -- Şartname döküman linki
  announcement_text TEXT,                   -- İhale ilan metni (temiz text)

  -- Mal/hizmet kalemleri özet bilgileri
  total_items INTEGER DEFAULT 0,            -- Toplam kalem sayısı
  total_meal_quantity REAL,                 -- Toplam öğün sayısı (catering için)
  estimated_budget_from_items REAL,         -- Kalemlerden hesaplanan bütçe

  -- Metadata
  raw_json TEXT,                            -- Ham JSON data
  is_active INTEGER DEFAULT 1,              -- Aktif mi? (0=false, 1=true)
  first_seen_at TEXT DEFAULT (datetime('now')),  -- İlk görülme zamanı
  last_updated_at TEXT DEFAULT (datetime('now')), -- Son güncelleme
  created_at TEXT DEFAULT (datetime('now')),

  -- Unique constraint
  UNIQUE(source, source_id)
);

-- ============================================================================
-- MAL/HİZMET KALEMLERİ
-- ============================================================================
CREATE TABLE IF NOT EXISTS tender_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tender_id INTEGER NOT NULL,

  -- Kalem bilgileri
  item_number INTEGER,                      -- Sıra numarası
  item_name TEXT NOT NULL,                  -- Kalem adı (örn: "Sabah Kahvaltısı")
  quantity REAL,                            -- Miktar
  unit TEXT,                                -- Birim (ADET, KG, LİTRE)

  -- Fiyat bilgileri
  unit_price REAL,                          -- Birim fiyat
  total_price REAL,                         -- Toplam fiyat

  -- Metadata
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (tender_id) REFERENCES ihale_listings(id) ON DELETE CASCADE
);

-- ============================================================================
-- SCRAPING LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS scraping_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Log bilgileri
  source TEXT NOT NULL,                     -- Kaynak site
  started_at TEXT NOT NULL,                 -- Başlangıç zamanı (ISO 8601)
  completed_at TEXT,                        -- Bitiş zamanı (ISO 8601)
  status TEXT DEFAULT 'pending',            -- 'success', 'failed', 'partial'

  -- İstatistikler
  total_scraped INTEGER DEFAULT 0,          -- Toplam scrape edilen
  new_listings_count INTEGER DEFAULT 0,     -- Yeni ihaleler
  updated_listings_count INTEGER DEFAULT 0, -- Güncellenen ihaleler
  error_count INTEGER DEFAULT 0,            -- Hata sayısı
  error_message TEXT,                       -- Hata mesajı

  -- Metadata
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- INDEXES (Performans için)
-- ============================================================================

-- İhale listings indexes
CREATE INDEX IF NOT EXISTS idx_ihale_listings_source ON ihale_listings(source);
CREATE INDEX IF NOT EXISTS idx_ihale_listings_source_id ON ihale_listings(source_id);
CREATE INDEX IF NOT EXISTS idx_ihale_listings_is_catering ON ihale_listings(is_catering);
CREATE INDEX IF NOT EXISTS idx_ihale_listings_is_active ON ihale_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_ihale_listings_deadline ON ihale_listings(deadline_date);
CREATE INDEX IF NOT EXISTS idx_ihale_listings_city ON ihale_listings(organization_city);
CREATE INDEX IF NOT EXISTS idx_ihale_listings_first_seen ON ihale_listings(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_ihale_listings_ai_analyzed ON ihale_listings(ai_analyzed) WHERE ai_analyzed = 0;

-- Tender items indexes
CREATE INDEX IF NOT EXISTS idx_tender_items_tender_id ON tender_items(tender_id);

-- Scraping logs indexes
CREATE INDEX IF NOT EXISTS idx_scraping_logs_source ON scraping_logs(source);
CREATE INDEX IF NOT EXISTS idx_scraping_logs_started ON scraping_logs(started_at);

-- ============================================================================
-- FTS (Full-Text Search) - SQLite için
-- ============================================================================

-- Virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS ihale_listings_fts USING fts5(
  title,
  organization,
  content='ihale_listings',
  content_rowid='id'
);

-- Trigger: FTS tablosunu otomatik güncelle
CREATE TRIGGER IF NOT EXISTS ihale_listings_ai AFTER INSERT ON ihale_listings BEGIN
  INSERT INTO ihale_listings_fts(rowid, title, organization)
  VALUES (new.id, new.title, new.organization);
END;

CREATE TRIGGER IF NOT EXISTS ihale_listings_ad AFTER DELETE ON ihale_listings BEGIN
  DELETE FROM ihale_listings_fts WHERE rowid = old.id;
END;

CREATE TRIGGER IF NOT EXISTS ihale_listings_au AFTER UPDATE ON ihale_listings BEGIN
  UPDATE ihale_listings_fts
  SET title = new.title, organization = new.organization
  WHERE rowid = new.id;
END;

-- ============================================================================
-- VIEWS (Kolay sorgulama için)
-- ============================================================================

-- Aktif catering ihaleleri
CREATE VIEW IF NOT EXISTS active_catering_tenders AS
SELECT
  il.*,
  CASE
    WHEN il.deadline_date IS NOT NULL
    THEN julianday(il.deadline_date) - julianday('now')
    ELSE NULL
  END as days_until_deadline
FROM ihale_listings il
WHERE il.is_catering = 1
  AND il.is_active = 1
  AND (il.deadline_date IS NULL OR date(il.deadline_date) >= date('now'))
ORDER BY il.deadline_date ASC;

-- ============================================================================
-- İNİT MESAJI
-- ============================================================================
-- SQLite doesn't support notices, so this is just a comment
-- ✅ İhale Scraper SQLite Database Schema Initialized
