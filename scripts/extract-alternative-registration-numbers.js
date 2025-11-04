// ============================================================================
// SCRIPT: Extract Alternative Registration Number Formats
// "Kayıt Sıra Numarası" gibi alternatif formatları çıkar
// ============================================================================

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'ihale-scraper.db');
const db = new Database(DB_PATH);

console.log('🔍 Alternatif kayıt numarası formatlarını arıyorum...\n');

// Get tenders without registration_number but with raw_json
const tenders = db.prepare(`
  SELECT id, raw_json, source_url
  FROM ihale_listings
  WHERE registration_number IS NULL AND raw_json IS NOT NULL
`).all();

console.log(`📊 ${tenders.length} ihale kontrol edilecek\n`);

let updated = 0;
let notFound = 0;

for (const tender of tenders) {
  try {
    const rawData = JSON.parse(tender.raw_json);

    // Try different field names
    let registrationNumber = null;

    // 1. Standard format
    if (rawData['Kayıt no']) {
      registrationNumber = rawData['Kayıt no'];
    }
    // 2. Details object
    else if (rawData.details && rawData.details['Kayıt no']) {
      registrationNumber = rawData.details['Kayıt no'];
    }
    // 3. Kayıt Sıra Numarası
    else if (rawData.details && rawData.details['Kayıt Sıra Numarası']) {
      registrationNumber = rawData.details['Kayıt Sıra Numarası'];
    }
    // 4. Try regex on fullText
    else if (rawData.fullText) {
      // Try YYYY/NNNNNNN format
      const match1 = rawData.fullText.match(/202\d\/\d{6,7}/);
      if (match1) {
        registrationNumber = match1[0];
      } else {
        // Try "Kayıt no:" or "Kayıt Sıra Numarası:" in fullText
        const match2 = rawData.fullText.match(/(?:Kayıt (?:no|Sıra Numarası)):\s*(\d+)/i);
        if (match2) {
          registrationNumber = match2[1];
        }
      }
    }

    if (registrationNumber) {
      db.prepare(`
        UPDATE ihale_listings
        SET registration_number = ?
        WHERE id = ?
      `).run(registrationNumber, tender.id);

      console.log(`✅ ${tender.id}: ${registrationNumber}`);
      updated++;
    } else {
      console.log(`❌ ${tender.id}: Kayıt no bulunamadı - ${tender.source_url.slice(0, 50)}...`);
      notFound++;
    }
  } catch (error) {
    console.log(`❌ ${tender.id}: Parse hatası - ${error.message}`);
    notFound++;
  }
}

console.log(`\n✅ Tamamlandı!`);
console.log(`   ${updated} kayıt güncellendi`);
console.log(`   ${notFound} kayıt bulunamadı`);

// Show remaining tenders without registration number
const remaining = db.prepare(`
  SELECT COUNT(*) as count
  FROM ihale_listings
  WHERE registration_number IS NULL
`).get();

console.log(`\n📊 Hala kayıt no olmayan ihale: ${remaining.count}`);

db.close();
