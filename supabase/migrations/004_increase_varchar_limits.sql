-- ============================================================================
-- FIX VARCHAR OVERFLOW ERRORS
-- Tarih: 2025-01-03
-- Amaç: organization_city ve diğer varchar(100) alanlarını genişlet
-- ============================================================================

-- organization_city VARCHAR(100) -> VARCHAR(200)
-- Bazı şehir isimleri 100 karakteri aşıyor
ALTER TABLE ihale_listings
ALTER COLUMN organization_city TYPE VARCHAR(200);

-- organization TEXT olarak zaten yeterli ama ekleme yaparken truncate edeceğiz
-- title TEXT olarak zaten yeterli

-- tender_type VARCHAR(100) -> VARCHAR(200) (bazı ihale türleri uzun olabiliyor)
ALTER TABLE ihale_listings
ALTER COLUMN tender_type TYPE VARCHAR(200);

-- category VARCHAR(100) -> VARCHAR(200)
ALTER TABLE ihale_listings
ALTER COLUMN category TYPE VARCHAR(200);

-- Index'leri rebuild et (size değiştiği için)
REINDEX INDEX idx_ihale_listings_city;

-- Başarı mesajı
DO $$
BEGIN
  RAISE NOTICE '✅ VARCHAR limitleri başarıyla artırıldı';
  RAISE NOTICE '   - organization_city: 100 → 200';
  RAISE NOTICE '   - tender_type: 100 → 200';
  RAISE NOTICE '   - category: 100 → 200';
END $$;
