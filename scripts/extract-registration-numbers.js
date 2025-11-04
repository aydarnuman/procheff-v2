// ============================================================================
// SCRIPT: Extract Registration Numbers from raw_json
// raw_json içindeki kayıt numaralarını registration_number kolonuna çıkarır
// ============================================================================

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'ihale-scraper.db');
const db = new Database(DB_PATH);

console.log('🔍 Kayıt numaralarını çıkarıyorum...\n');

// Get all tenders with raw_json but no registration_number
const tenders = db.prepare(`
  SELECT id, raw_json
  FROM ihale_listings
  WHERE raw_json IS NOT NULL
`).all();

console.log(`📊 Toplam ${tenders.length} ihale bulundu\n`);

let updated = 0;
let notFound = 0;

for (const tender of tenders) {
  try {
    const rawData = JSON.parse(tender.raw_json);
    const registrationNumber = rawData['Kayıt no'];

    if (registrationNumber) {
      db.prepare(`
        UPDATE ihale_listings
        SET registration_number = ?
        WHERE id = ?
      `).run(registrationNumber, tender.id);

      console.log(`✅ ${tender.id}: ${registrationNumber}`);
      updated++;
    } else {
      console.log(`⚠️  ${tender.id}: Kayıt no bulunamadı`);
      notFound++;
    }
  } catch (error) {
    console.log(`❌ ${tender.id}: Parse hatası`);
    notFound++;
  }
}

console.log(`\n✅ Tamamlandı!`);
console.log(`   ${updated} kayıt güncellendi`);
console.log(`   ${notFound} kayıt bulunamadı`);

db.close();
