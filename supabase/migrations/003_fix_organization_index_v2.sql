-- ============================================================================
-- İHALE SCRAPER - Organization Index Düzeltmesi (v2 - Güvenli Versiyon)
-- Problem: organization field çok uzun (4000+ bytes), btree index max 2704 bytes
-- Çözüm: Normal btree index yerine hash index kullan
-- ============================================================================

-- ADIM 1: Eski problematik btree index'i kaldır (varsa)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE indexname = 'idx_ihale_listings_organization'
    ) THEN
        DROP INDEX idx_ihale_listings_organization;
        RAISE NOTICE '✓ Eski btree index silindi';
    ELSE
        RAISE NOTICE '! Eski btree index bulunamadı (zaten silinmiş olabilir)';
    END IF;
END $$;

-- ADIM 2: Yeni hash-based index ekle
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE indexname = 'idx_ihale_listings_organization_hash'
    ) THEN
        CREATE INDEX idx_ihale_listings_organization_hash
        ON ihale_listings USING HASH(organization);
        RAISE NOTICE '✓ Yeni hash index oluşturuldu';
    ELSE
        RAISE NOTICE '! Hash index zaten mevcut';
    END IF;
END $$;

-- ADIM 3: Sonucu kontrol et
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'ihale_listings'
  AND indexname LIKE '%organization%';
