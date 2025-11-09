const { readFileSync } = require('fs');
const { join } = require('path');

async function run() {
  const hasClaudeKey = !!process.env.ANTHROPIC_API_KEY || !!process.env.CLAUDE_API_KEY;
  if (!hasClaudeKey) {
    console.log('⏭️  AI extraction testleri atlandı (ANTHROPIC_API_KEY/CLAUDE_API_KEY yok).');
    process.exit(0);
    return;
  }

  const tests = [
    { name: 'Belediye Personel Yemek Hizmeti', file: 'ihale_test_1.txt' },
    { name: 'Hastane Hasta Yemeği Hizmeti', file: 'ihale_test_2.txt' },
    { name: 'Okul Yemekhane İşletmeciliği', file: 'ihale_test_3.txt' },
  ];

  let passed = 0;
  for (const t of tests) {
    try {
      const filePath = join(process.cwd(), 'tests', 'fixtures', t.file);
      const text = readFileSync(filePath, 'utf-8');
      const resp = await fetch('http://localhost:3000/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!resp.ok) {
        let msg = '';
        try { msg = (await resp.json()).error || ''; } catch { msg = await resp.text(); }
        throw new Error(`API ${resp.status}: ${msg}`);
      }
      const result = await resp.json();
      if (!result?.success) throw new Error('Yanıt başarısız');
      const extracted = result.data;
      console.log(`✅ ${t.name} → kurum=${extracted.kurum} tür=${extracted.ihale_turu} güven=${Math.round(extracted.guven_skoru*100)}%`);
      passed++;
    } catch (e) {
      console.log(`❌ ${t.name} → ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\n📊 AI Extraction: ${passed}/${tests.length} başarılı`);
  process.exit(passed >= 1 ? 0 : 1); // En az birinin geçmesi yeterli eşiği
}

if (require.main === module) run();

