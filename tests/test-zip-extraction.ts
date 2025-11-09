import { ZipExtractor } from '../src/lib/tender-session/zip-extractor';
import path from 'path';

async function testZipExtraction() {
  console.log('🧪 ZIP Extraction Test\n');

  const sessionDir = path.join(process.cwd(), 'data', 'sessions', 'tender_20251107_184035_2g8az');
  const zipPath = path.join(sessionDir, 'test.zip');

  console.log('📦 Test ZIP:', zipPath);
  console.log('📂 Session Dir:', sessionDir);
  console.log('');

  try {
    // Test local ZIP file extraction
    console.log('🔧 adm-zip test başlatılıyor...\n');
    
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    console.log(`✅ ZIP açıldı: ${entries.length} dosya bulundu\n`);

    for (const entry of entries) {
      if (!entry.isDirectory) {
        console.log(`  📄 ${entry.entryName} (${entry.header.size} bytes)`);
        const content = entry.getData().toString('utf-8');
        console.log(`     İçerik preview: ${content.substring(0, 50)}...\n`);
      }
    }

    console.log('✅ Test başarılı!');
  } catch (error) {
    console.error('❌ Test hatası:', error);
    process.exit(1);
  }
}

testZipExtraction();
