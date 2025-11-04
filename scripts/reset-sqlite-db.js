#!/usr/bin/env node
// ============================================================================
// RESET SQLITE DATABASE - TÜM VERİLERİ SİL
// ============================================================================

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(process.cwd(), 'data', 'ihale-scraper.db');

console.log('🗑️  SQLite Database Sıfırlama Başlatılıyor...\n');
console.log(`📁 Database Path: ${DB_PATH}\n`);

// Check if database exists
if (!fs.existsSync(DB_PATH)) {
  console.log('⚠️  Database dosyası bulunamadı! Yeni database oluşturulacak.');
} else {
  console.log('✅ Database dosyası bulundu\n');
}

try {
  const db = new Database(DB_PATH);

  console.log('🧹 Tablolar temizleniyor...\n');

  // 1. Tüm ihaleleri sil
  const deleteResult = db.prepare('DELETE FROM ihale_listings').run();
  console.log(`✅ ${deleteResult.changes} ihale silindi (ihale_listings)`);

  // 2. Tender items'ları sil
  const deleteItems = db.prepare('DELETE FROM tender_items').run();
  console.log(`✅ ${deleteItems.changes} kalem silindi (tender_items)`);

  // 3. Scraping logs'ları sil
  const deleteLogs = db.prepare('DELETE FROM scraping_logs').run();
  console.log(`✅ ${deleteLogs.changes} log silindi (scraping_logs)`);

  // 4. FTS tablosunu temizle
  try {
    const deleteFts = db.prepare('DELETE FROM ihale_listings_fts').run();
    console.log(`✅ ${deleteFts.changes} FTS kaydı silindi (ihale_listings_fts)`);
  } catch (e) {
    console.log('⚠️  FTS tablosu temizlenemedi (bu normal olabilir)');
  }

  // 5. Kontrol: Kayıt kaldı mı?
  const remaining = db.prepare('SELECT COUNT(*) as count FROM ihale_listings').get();
  console.log(`\n📊 Kalan kayıt: ${remaining.count}`);

  // 6. VACUUM - Database dosyasını optimize et
  console.log('\n🧹 Database optimize ediliyor (VACUUM)...');
  db.prepare('VACUUM').run();
  console.log('✅ Optimize tamamlandı');

  db.close();

  console.log('\n🎉 Database başarıyla sıfırlandı!');
  console.log('💡 Şimdi yeni scraping yapabilirsin: npm run dev & curl localhost:3000/api/ihale-scraper/test\n');

} catch (error) {
  console.error('\n❌ Hata:', error.message);
  process.exit(1);
}
