const fs = require('fs');
const path = require('path');

async function run() {
  const API_BASE = 'http://localhost:3000';
  const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures');
  const fixtures = ['sample_tender_1.txt', 'sample_tender_2.txt', 'sample_tender_3.txt'];

  const results = [];

  console.log('🚀 Smoke test (JS) başlıyor...');

  for (const filename of fixtures) {
    const fixturePath = path.join(FIXTURES_DIR, filename);
    if (!fs.existsSync(fixturePath)) {
      console.error('❌ Fixture bulunamadı:', fixturePath);
      process.exitCode = 1;
      continue;
    }

    try {
      const textContent = fs.readFileSync(fixturePath, 'utf-8');
      const formData = new FormData();
      const blob = new Blob([textContent], { type: 'text/plain' });
      const file = new File([blob], filename, { type: 'text/plain' });
      formData.append('file', file);

      const start = Date.now();
      const resp = await fetch(`${API_BASE}/api/ai/analyze-document`, { method: 'POST', body: formData });
      const elapsed = Date.now() - start;

      if (!resp.ok) {
        let msg = '';
        try { msg = (await resp.json()).error || ''; } catch { msg = await resp.text(); }
        throw new Error(`API ${resp.status}: ${msg}`);
      }

      const data = await resp.json();
      results.push({ filename, ok: true, elapsed, data });
      console.log(`✅ ${filename} → ${elapsed}ms | yöntem=${data.documentMetrics?.method} güven=${Math.round(data.overallConfidence * 100)}%`);
    } catch (e) {
      results.push({ filename, ok: false, error: String(e) });
      console.log(`❌ ${filename} → ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n📊 Özet: ${passed}/${results.length} başarılı, ${failed} başarısız`);

  process.exit(passed >= Math.ceil(results.length * 0.8) ? 0 : 1);
}

if (require.main === module) run();

