-- ============================================================================
-- İHALE SCRAPER - Organization Index Düzeltmesi
-- Problem: organization field çok uzun (4000+ bytes), btree index max 2704 bytes
-- Çözüm: Normal btree index yerine hash index veya text pattern ops kullan
-- ============================================================================

-- Eski problematik index'i kaldır
DROP INDEX IF EXISTS idx_ihale_listings_organization;

-- Yeni hash-based index ekle (organization değerine göre arama için)
-- Hash index çok uzun stringler için daha uygun
CREATE INDEX idx_ihale_listings_organization_hash ON ihale_listings USING HASH(organization);

-- Alternatif: Pattern matching için GIN index (LIKE sorguları için)
-- CREATE INDEX idx_ihale_listings_organization_gin ON ihale_listings USING GIN(organization gin_trgm_ops);

-- Not: search_vector zaten organization'ı içeriyor, full-text search için o kullanılabilir
