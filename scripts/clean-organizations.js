// ============================================================================
// SCRIPT: Clean Organization Names
// Uzun organization adlarını temizler (ilk 150 karakter veya ilk cümle)
// ============================================================================

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'ihale-scraper.db');
const db = new Database(DB_PATH);

console.log('🧹 Organization adlarını temizliyorum...\n');

// Get all tenders with long organization names
const tenders = db.prepare(`
  SELECT id, organization
  FROM ihale_listings
  WHERE length(organization) > 150
`).all();

console.log(`📊 ${tenders.length} uzun organization adı bulundu\n`);

let cleaned = 0;

for (const tender of tenders) {
  let cleanOrg = tender.organization;

  // "1-" veya "İdarenin" gibi ayraçtan öncesini al
  const match = cleanOrg.match(/^([^1\n]+?)(?:\s+1-|\s+İdarenin|\s+Ayrıntılı)/);
  if (match) {
    cleanOrg = match[1].trim();
  } else {
    // Yoksa ilk 150 karakter
    cleanOrg = cleanOrg.slice(0, 150).trim();
  }

  if (cleanOrg !== tender.organization) {
    db.prepare(`
      UPDATE ihale_listings
      SET organization = ?
      WHERE id = ?
    `).run(cleanOrg, tender.id);

    console.log(`✅ ${tender.id}: "${cleanOrg}"`);
    cleaned++;
  }
}

console.log(`\n✅ Tamamlandı! ${cleaned} organization temizlendi`);

db.close();
