// ============================================================================
// SCRIPT: Fix Missing Data (Registration Number + Organization)
// Kayıt numarası ve kurum adı olmayan ihaleleri AI ile tekrar çek
// ============================================================================

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'ihale-scraper.db');
const db = new Database(DB_PATH);

console.log('🔍 Eksik verileri buluyorum...\n');

// Get tenders with missing registration_number OR "Belirtilmemiş" organization
const tenders = db.prepare(`
  SELECT id, title, organization, registration_number, source_url
  FROM ihale_listings
  WHERE registration_number IS NULL
     OR organization = 'Belirtilmemiş'
  ORDER BY id
`).all();

console.log(`📊 ${tenders.length} ihale bulundu:\n`);

for (const tender of tenders) {
  console.log(`ID: ${tender.id}`);
  console.log(`  Title: ${tender.title || 'YOK'}`);
  console.log(`  Organization: ${tender.organization || 'YOK'}`);
  console.log(`  Registration: ${tender.registration_number || 'YOK'}`);
  console.log(`  URL: ${tender.source_url}`);
  console.log('');
}

console.log('\n💡 Bu ihaleleri düzeltmek için:');
console.log('   1. İhale-takip sayfasında "AI ile Detay Getir" butonuna tıklayın');
console.log('   2. Veya bu API\'yi çağırın:');
console.log('      POST /api/ihale-scraper/fetch-full-content');
console.log('      Body: { "url": "TENDER_URL", "tenderId": TENDER_ID }');

// Mark them for AI analysis
const updateStmt = db.prepare(`
  UPDATE ihale_listings
  SET ai_analyzed = 0
  WHERE id = ?
`);

for (const tender of tenders) {
  updateStmt.run(tender.id);
}

console.log(`\n✅ ${tenders.length} ihale AI analizi için işaretlendi`);

db.close();
