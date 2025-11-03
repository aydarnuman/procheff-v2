-- ============================================================================
-- İHALE SCRAPER DATABASE SCHEMA
-- Versiyon: 1.0
-- Tarih: 2025-01-03
-- Mevcut sisteme SIFIR etki, tamamen izole tablolar
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Text similarity için

-- ============================================================================
-- 1. İHALE LİSTELERİ (Ham Veri)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ihale_listings (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Kaynak Bilgileri
  source VARCHAR(50) NOT NULL CHECK (source IN ('ilan_gov', 'ihale_takip', 'ihalebul', 'ekap')),
  source_id VARCHAR(200), -- Kaynaktaki unique ID
  source_url TEXT NOT NULL,

  -- İhale Temel Bilgileri
  title TEXT NOT NULL,
  organization TEXT,
  organization_city VARCHAR(100),

  -- Mali Bilgiler
  budget DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'TRY',

  -- Tarihler
  announcement_date DATE,
  deadline_date DATE,
  tender_date DATE,

  -- İhale Detayları
  tender_type VARCHAR(100), -- "Açık İhale", "Belli İstekliler" vb.
  procurement_type VARCHAR(50), -- "Hizmet Alımı", "Mal Alımı"
  category VARCHAR(100),

  -- Catering Kategorilendirme (AI)
  is_catering BOOLEAN DEFAULT false,
  catering_confidence DECIMAL(3,2) CHECK (catering_confidence >= 0 AND catering_confidence <= 1),
  ai_categorization_reasoning TEXT, -- Claude'un açıklaması

  -- Ham Veri
  raw_html TEXT,
  raw_json JSONB,

  -- Metadata
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  scrape_count INT DEFAULT 1, -- Kaç kez görüldü
  is_active BOOLEAN DEFAULT true, -- Hala geçerli mi?

  -- Search optimization
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('turkish', coalesce(title, '') || ' ' || coalesce(organization, ''))
  ) STORED,

  -- Constraints
  UNIQUE(source, source_id)
);

-- İndeksler (Performans)
CREATE INDEX idx_ihale_listings_source ON ihale_listings(source);
CREATE INDEX idx_ihale_listings_is_catering ON ihale_listings(is_catering, catering_confidence) WHERE is_catering = true;
CREATE INDEX idx_ihale_listings_deadline ON ihale_listings(deadline_date) WHERE deadline_date IS NOT NULL;
CREATE INDEX idx_ihale_listings_created ON ihale_listings(first_seen_at DESC);
CREATE INDEX idx_ihale_listings_active ON ihale_listings(is_active) WHERE is_active = true;
CREATE INDEX idx_ihale_listings_budget ON ihale_listings(budget) WHERE budget IS NOT NULL;
CREATE INDEX idx_ihale_listings_search ON ihale_listings USING GIN(search_vector);
CREATE INDEX idx_ihale_listings_organization ON ihale_listings(organization);
CREATE INDEX idx_ihale_listings_city ON ihale_listings(organization_city);

-- Trigger: last_updated_at otomatik güncelle
CREATE OR REPLACE FUNCTION update_ihale_listings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ihale_listings_timestamp
  BEFORE UPDATE ON ihale_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_ihale_listings_timestamp();

-- ============================================================================
-- 2. İHALE DETAYLI ANALİZ (AI Parsing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ihale_parsed_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ihale_id UUID REFERENCES ihale_listings(id) ON DELETE CASCADE,

  -- Catering Spesifik Bilgiler
  kisi_sayisi INT,
  personel_sayisi INT,
  ogun_sayisi INT,
  gun_sayisi INT,
  estimated_daily_meals INT,
  meal_types TEXT[], -- ["Kahvaltı", "Öğle", "Akşam"]

  -- Lokasyon
  service_location TEXT,
  delivery_points TEXT[],

  -- Özel Gereksinimler
  special_requirements JSONB,
  dietary_requirements TEXT[], -- ["Vejetaryen", "Glutensiz" vb.]
  certification_requirements TEXT[], -- ["ISO 22000", "HACCP" vb.]

  -- Risk ve Şartlar
  risks JSONB,
  ozel_sartlar TEXT[],

  -- AI Analysis
  ai_analysis JSONB, -- Claude'un tam analizi
  ai_confidence DECIMAL(3,2),

  -- Metadata
  parsed_at TIMESTAMPTZ DEFAULT NOW(),
  parsing_duration_ms INT,

  -- Constraint
  UNIQUE(ihale_id)
);

CREATE INDEX idx_parsed_details_ihale ON ihale_parsed_details(ihale_id);
CREATE INDEX idx_parsed_details_kisi ON ihale_parsed_details(kisi_sayisi) WHERE kisi_sayisi IS NOT NULL;
CREATE INDEX idx_parsed_details_daily_meals ON ihale_parsed_details(estimated_daily_meals) WHERE estimated_daily_meals IS NOT NULL;

-- ============================================================================
-- 3. SCRAPING LOGLARI
-- ============================================================================
CREATE TABLE IF NOT EXISTS scraping_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Scraper Bilgileri
  source VARCHAR(50) NOT NULL,
  scraper_version VARCHAR(20) DEFAULT '1.0',

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_seconds INT GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (completed_at - started_at))::INT
  ) STORED,

  -- Sonuçlar
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'success', 'failed', 'partial')),
  total_scraped INT DEFAULT 0,
  new_listings_count INT DEFAULT 0,
  updated_listings_count INT DEFAULT 0,
  error_count INT DEFAULT 0,

  -- Detaylar
  error_message TEXT,
  error_stack TEXT,
  metadata JSONB, -- Ek bilgiler

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scraping_logs_source ON scraping_logs(source, created_at DESC);
CREATE INDEX idx_scraping_logs_status ON scraping_logs(status);
CREATE INDEX idx_scraping_logs_created ON scraping_logs(created_at DESC);

-- ============================================================================
-- 4. BİLDİRİM SİSTEMİ
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Kullanıcı (şimdilik user_id yok, gelecek için hazır)
  user_id UUID, -- İleride auth eklenirse
  user_email VARCHAR(255) NOT NULL,

  -- Bildirim Tercihleri
  notify_new_tenders BOOLEAN DEFAULT true,
  notify_deadline_approaching BOOLEAN DEFAULT true,
  notify_budget_threshold DECIMAL(15,2), -- Bu bütçenin üzerindekiler için bildir
  notify_min_kisi_sayisi INT, -- Bu kişi sayısının üzerindekiler

  -- Kanal Tercihleri
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT false,
  in_app_enabled BOOLEAN DEFAULT true,

  -- Filtreler
  interested_cities TEXT[], -- ["İstanbul", "Ankara"]
  min_budget DECIMAL(15,2),
  max_budget DECIMAL(15,2),

  -- Timing
  notification_frequency VARCHAR(20) DEFAULT 'realtime' CHECK (
    notification_frequency IN ('realtime', 'hourly', 'daily', 'weekly')
  ),
  daily_digest_time TIME DEFAULT '09:00',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_prefs_email ON notification_preferences(user_email);

-- ============================================================================
-- 5. BİLDİRİM GEÇMİŞİ
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- İlişkiler
  ihale_id UUID REFERENCES ihale_listings(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,

  -- Bildirim Detayları
  notification_type VARCHAR(50) NOT NULL CHECK (
    notification_type IN ('new_tender', 'deadline_approaching', 'budget_match', 'custom')
  ),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'push', 'in_app', 'sms')),

  -- İçerik
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,

  -- Durum
  status VARCHAR(20) DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'failed', 'read')
  ),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  -- Hata Tracking
  error_message TEXT,
  retry_count INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_ihale ON notifications(ihale_id);
CREATE INDEX idx_notifications_user ON notifications(user_email, created_at DESC);
CREATE INDEX idx_notifications_status ON notifications(status) WHERE status = 'pending';
CREATE INDEX idx_notifications_type ON notifications(notification_type);

-- ============================================================================
-- 6. DUPLICATE DETECTION (Benzer İhaleler)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ihale_duplicates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  ihale_id_1 UUID REFERENCES ihale_listings(id) ON DELETE CASCADE,
  ihale_id_2 UUID REFERENCES ihale_listings(id) ON DELETE CASCADE,

  similarity_score DECIMAL(3,2) CHECK (similarity_score >= 0 AND similarity_score <= 1),
  matching_algorithm VARCHAR(50), -- "levenshtein", "org_date_budget"

  is_confirmed_duplicate BOOLEAN DEFAULT false, -- Manuel onay
  confirmed_by VARCHAR(100),
  confirmed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(ihale_id_1, ihale_id_2),
  CHECK(ihale_id_1 < ihale_id_2) -- Prevent reverse duplicates
);

CREATE INDEX idx_duplicates_ihale1 ON ihale_duplicates(ihale_id_1);
CREATE INDEX idx_duplicates_ihale2 ON ihale_duplicates(ihale_id_2);
CREATE INDEX idx_duplicates_score ON ihale_duplicates(similarity_score DESC);

-- ============================================================================
-- 7. ANALİTİK VE RAPORLAMA
-- ============================================================================
CREATE TABLE IF NOT EXISTS scraper_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  source VARCHAR(50) NOT NULL,

  -- Metrikler
  total_tenders_scraped INT DEFAULT 0,
  new_tenders INT DEFAULT 0,
  catering_tenders INT DEFAULT 0,
  total_budget_sum DECIMAL(20,2),
  avg_confidence DECIMAL(3,2),

  -- Performans
  avg_scrape_duration_seconds INT,
  error_rate DECIMAL(5,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(date, source)
);

CREATE INDEX idx_analytics_date ON scraper_analytics(date DESC);
CREATE INDEX idx_analytics_source ON scraper_analytics(source);

-- ============================================================================
-- 8. USEFUL VIEWS
-- ============================================================================

-- View: Aktif Catering İhaleleri
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
ORDER BY il.deadline_date ASC NULLS LAST, il.first_seen_at DESC;

-- View: Günlük Scraper Özeti
CREATE OR REPLACE VIEW daily_scraper_summary AS
SELECT
  DATE(started_at) as date,
  source,
  COUNT(*) as total_runs,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_runs,
  SUM(new_listings_count) as total_new_tenders,
  AVG(duration_seconds) as avg_duration,
  MAX(completed_at) as last_run
FROM scraping_logs
GROUP BY DATE(started_at), source
ORDER BY date DESC, source;

-- View: Bildirim İstatistikleri
CREATE OR REPLACE VIEW notification_stats AS
SELECT
  user_email,
  COUNT(*) as total_notifications,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
  SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_count,
  SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked_count,
  ROUND(
    100.0 * SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) /
    NULLIF(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), 0),
    2
  ) as open_rate
FROM notifications
GROUP BY user_email;

-- ============================================================================
-- 9. HELPER FUNCTIONS
-- ============================================================================

-- Function: İhale benzerliği hesapla (Levenshtein)
CREATE OR REPLACE FUNCTION calculate_tender_similarity(
  tender1_id UUID,
  tender2_id UUID
) RETURNS DECIMAL(3,2) AS $$
DECLARE
  t1_title TEXT;
  t2_title TEXT;
  t1_org TEXT;
  t2_org TEXT;
  title_similarity DECIMAL(3,2);
  org_similarity DECIMAL(3,2);
BEGIN
  SELECT title, organization INTO t1_title, t1_org
  FROM ihale_listings WHERE id = tender1_id;

  SELECT title, organization INTO t2_title, t2_org
  FROM ihale_listings WHERE id = tender2_id;

  title_similarity := similarity(t1_title, t2_title);
  org_similarity := similarity(COALESCE(t1_org, ''), COALESCE(t2_org, ''));

  RETURN (title_similarity * 0.7 + org_similarity * 0.3);
END;
$$ LANGUAGE plpgsql;

-- Function: Deadline yaklaşan ihaleler
CREATE OR REPLACE FUNCTION get_urgent_tenders(days_threshold INT DEFAULT 7)
RETURNS TABLE (
  id UUID,
  title TEXT,
  organization TEXT,
  deadline_date DATE,
  days_left INT,
  budget DECIMAL(15,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    il.id,
    il.title,
    il.organization,
    il.deadline_date,
    (il.deadline_date - CURRENT_DATE)::INT as days_left,
    il.budget
  FROM ihale_listings il
  WHERE il.is_catering = true
    AND il.is_active = true
    AND il.deadline_date IS NOT NULL
    AND il.deadline_date BETWEEN CURRENT_DATE AND CURRENT_DATE + days_threshold
  ORDER BY il.deadline_date ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. ROW LEVEL SECURITY (Gelecek için hazır)
-- ============================================================================

-- RLS şimdilik kapalı, auth eklenince açılacak
-- ALTER TABLE ihale_listings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMPLETED: İHALE SCRAPER DATABASE SCHEMA V1.0
-- ============================================================================

-- Test data için örnek insert (Opsiyonel - production'da silinecek)
-- INSERT INTO ihale_listings (source, source_id, source_url, title, organization, budget, deadline_date, is_catering, catering_confidence)
-- VALUES ('ilan_gov', 'test_001', 'https://example.com', 'Test Catering İhalesi', 'Test Kurumu', 1000000, CURRENT_DATE + 30, true, 0.95);

COMMENT ON TABLE ihale_listings IS 'Tüm scrape edilen ihale ilanlarının ham verisi';
COMMENT ON TABLE ihale_parsed_details IS 'AI ile parse edilmiş catering spesifik detaylar';
COMMENT ON TABLE scraping_logs IS 'Scraper çalıştırma logları ve performans metrikleri';
COMMENT ON TABLE notification_preferences IS 'Kullanıcı bildirim tercihleri';
COMMENT ON TABLE notifications IS 'Gönderilen bildirimler ve delivery durumları';
COMMENT ON TABLE ihale_duplicates IS 'Tespit edilen duplike ihaleler';
COMMENT ON TABLE scraper_analytics IS 'Günlük scraper performans analitiği';
