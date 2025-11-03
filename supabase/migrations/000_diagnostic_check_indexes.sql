-- ============================================================================
-- DİAGNOSTİC QUERY - Mevcut index durumunu kontrol et
-- Bu sorguyu Supabase SQL Editor'de çalıştırın
-- ============================================================================

-- 1. ihale_listings tablosundaki TÜM index'leri listele
SELECT
    tablename,
    indexname,
    indexdef
FROM
    pg_indexes
WHERE
    tablename = 'ihale_listings'
ORDER BY
    indexname;

-- 2. Özellikle organization ile ilgili index'leri kontrol et
SELECT
    indexname,
    indexdef
FROM
    pg_indexes
WHERE
    tablename = 'ihale_listings'
    AND indexname LIKE '%organization%';

-- 3. Problematik index'in hala var olup olmadığını kontrol et
SELECT
    indexname,
    indexdef
FROM
    pg_indexes
WHERE
    tablename = 'ihale_listings'
    AND indexname = 'idx_ihale_listings_organization';
