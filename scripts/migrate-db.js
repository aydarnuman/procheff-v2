#!/usr/bin/env node
/**
 * Supabase Database Migration Script
 * Fixes organization index size issue (btree → hash)
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Supabase direkt bağlantı için DB password gerekiyor
// Service role key değil! DB password lazım.
console.log('⚠️  SUPABASE_DB_PASSWORD gerekiyor!');
console.log('📍 Şu adımları izle:');
console.log('1. https://supabase.com/dashboard/project/kxjjyojrebgreauqhvkz/settings/database');
console.log('2. "Database Settings" > "Connection string" > "Connection pooling"');
console.log('3. Host: aws-0-eu-central-1.pooler.supabase.com');
console.log('4. Port: 6543');
console.log('5. Database: postgres');
console.log('6. User: postgres.kxjjyojrebgreauqhvkz');
console.log('7. Password: [sifre] (bu şifreyi .env.local\'e ekle)\n');

const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!dbPassword) {
  console.error('❌ SUPABASE_DB_PASSWORD bulunamadı!');
  console.error('💡 .env.local dosyasına şu satırı ekle:');
  console.error('SUPABASE_DB_PASSWORD=your_database_password');
  process.exit(1);
}

async function migrate() {
  const client = new Client({
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.kxjjyojrebgreauqhvkz',
    password: dbPassword,
    ssl: false,
  });

  try {
    console.log('🔌 Supabase PostgreSQL\'e bağlanılıyor...');
    await client.connect();
    console.log('✅ Bağlantı başarılı!\n');

    // Step 1: Check current indexes
    console.log('📋 Mevcut index durumu kontrol ediliyor...');
    const checkResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'ihale_listings'
      AND indexname LIKE '%organization%';
    `);
    console.log('Mevcut indexler:', checkResult.rows);
    console.log('');

    // Step 2: Drop old btree index
    console.log('🗑️  Eski btree index kaldırılıyor...');
    await client.query('DROP INDEX IF EXISTS idx_ihale_listings_organization;');
    console.log('✅ Eski btree index kaldırıldı\n');

    // Step 3: Create new hash index
    console.log('🔨 Yeni hash index oluşturuluyor...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ihale_listings_organization_hash
      ON ihale_listings USING HASH(organization);
    `);
    console.log('✅ Yeni hash index oluşturuldu\n');

    // Step 4: Verify
    console.log('🔍 Sonuç kontrol ediliyor...');
    const finalResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'ihale_listings'
      AND indexname LIKE '%organization%';
    `);
    console.log('Son durum:', finalResult.rows);
    console.log('');

    console.log('✅ ✅ ✅ MİGRATİON BAŞARILI! ✅ ✅ ✅');
    console.log('Artık 200+ ihale kaydedilecek!\n');

  } catch (error) {
    console.error('❌ Hata:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
