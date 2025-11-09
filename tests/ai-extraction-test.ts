import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

// Test cases
const testCases = [
  {
    name: "Belediye Personel Yemek Hizmeti",
    file: "ihale_test_1.txt",
    expected: {
      kurum: "Ankara Büyükşehir Belediyesi",
      ihale_turu: "Hizmet Alımı",
      kisi_sayisi: 320,
      ogun_sayisi: 1,
      gun_sayisi: 365,
      tahmini_butce: 850000,
    },
  },
  {
    name: "Hastane Hasta Yemeği Hizmeti",
    file: "ihale_test_2.txt",
    expected: {
      kurum: "İstanbul İl Sağlık Müdürlüğü",
      ihale_turu: "Hasta Yemeği Hizmeti",
      kisi_sayisi: 552,
      ogun_sayisi: 5,
      gun_sayisi: 730, // 24 ay
      tahmini_butce: 2400000,
    },
  },
  {
    name: "Okul Yemekhane İşletmeciliği",
    file: "ihale_test_3.txt",
    expected: {
      kurum: "Milli Eğitim Bakanlığı",
      ihale_turu: "İşletmecilik Hizmeti",
      kisi_sayisi: 950,
      ogun_sayisi: 3,
      gun_sayisi: 900, // 5 yıl x 180 gün
      tahmini_butce: 1278000,
    },
  },
];

async function testAIExtraction() {
  console.log("🧪 AI Extraction Test Suite Başlatılıyor...\n");

  // Önkoşul: AI anahtarı kontrolü (Anthropic/Claude)
  const hasClaudeKey = !!process.env.ANTHROPIC_API_KEY || !!process.env.CLAUDE_API_KEY;
  if (!hasClaudeKey) {
    console.log("⚠️ AI anahtarı bulunamadı (ANTHROPIC_API_KEY/CLAUDE_API_KEY). Testler atlanıyor.\n");
    return {
      total: testCases.length,
      passed: 0,
      failed: 0,
      details: [],
      skipped: true,
    } as any;
  }

  // Sunucu sağlık kontrolü
  try {
    const ok = await fetch("http://localhost:3000/api/health").then(r => r.ok);
    if (!ok) {
      console.log("⚠️ Sunucu sağlığı doğrulanamadı. Lütfen sunucuyu başlatın (npm start).\n");
    }
  } catch {
    console.log("⚠️ Sunucuya bağlanılamadı. Lütfen sunucuyu başlatın (npm start).\n");
  }

  const results = {
    total: testCases.length,
    passed: 0,
    failed: 0,
    details: [] as Array<{
      name: string;
      accuracy?: number;
      processingTime?: number;
      confidenceScore?: number;
      passed: boolean;
      extracted?: Record<string, unknown>;
      expected?: Record<string, unknown>;
      validations?: Record<string, boolean>;
      error?: string;
    }>,
  };

  for (const testCase of testCases) {
    console.log(`📋 Test: ${testCase.name}`);
    console.log(`📄 Dosya: ${testCase.file}`);

    try {
      // Read test file
      const filePath = join(process.cwd(), "tests", "fixtures", testCase.file);
      const text = readFileSync(filePath, "utf-8");

      console.log(`📏 Metin uzunluğu: ${text.length} karakter`);

      // Call AI extraction API
      const startTime = Date.now();

      const response = await fetch("http://localhost:3000/api/ai/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      const processingTime = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error ${response.status}: ${errorData.error}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(`Extraction failed: ${result.error}`);
      }

      const extracted = result.data;

      // Validate results
      const validations = {
        kurum: extracted.kurum === testCase.expected.kurum,
        ihale_turu: extracted.ihale_turu?.includes(
          testCase.expected.ihale_turu.split(" ")[0]
        ),
        kisi_sayisi:
          Math.abs(
            (extracted.kisi_sayisi || 0) - testCase.expected.kisi_sayisi
          ) <= 50,
        ogun_sayisi: extracted.ogun_sayisi === testCase.expected.ogun_sayisi,
        tahmini_butce:
          extracted.tahmini_butce &&
          Math.abs(extracted.tahmini_butce - testCase.expected.tahmini_butce) <=
            testCase.expected.tahmini_butce * 0.1,
      };

      const passedValidations =
        Object.values(validations).filter(Boolean).length;
      const totalValidations = Object.keys(validations).length;
      const accuracy = Math.round((passedValidations / totalValidations) * 100);

      console.log(`✅ Doğruluk oranı: ${accuracy}%`);
      console.log(`⚡ İşleme süresi: ${processingTime}ms`);
      console.log(
        `🎯 Güven skoru: ${Math.round(extracted.guven_skoru * 100)}%`
      );

      // Detailed results
      console.log("\n📊 Çıkarılan Veriler:");
      console.log(`   Kurum: ${extracted.kurum}`);
      console.log(`   İhale Türü: ${extracted.ihale_turu}`);
      console.log(`   Kişi Sayısı: ${extracted.kisi_sayisi}`);
      console.log(`   Öğün Sayısı: ${extracted.ogun_sayisi}`);
      console.log(`   Gün Sayısı: ${extracted.gun_sayisi}`);
      console.log(
        `   Tahmini Bütçe: ${extracted.tahmini_butce?.toLocaleString(
          "tr-TR"
        )} TL`
      );
      console.log(`   Riskler: ${extracted.riskler.join(", ")}`);

      console.log("\n🔍 Validasyon Detayları:");
      Object.entries(validations).forEach(([key, passed]) => {
        const icon = passed ? "✅" : "❌";
        console.log(`   ${icon} ${key}: ${passed}`);
      });

      const testResult = {
        name: testCase.name,
        accuracy,
        processingTime,
        confidenceScore: extracted.guven_skoru,
        passed: accuracy >= 80,
        extracted,
        expected: testCase.expected,
        validations,
      };

      results.details.push(testResult);

      if (testResult.passed) {
        results.passed++;
        console.log("🟢 TEST BAŞARILI\n");
      } else {
        results.failed++;
        console.log("🔴 TEST BAŞARISIZ\n");
      }
    } catch (error) {
      console.error(`❌ Test hatası: ${error}`);
      results.failed++;
      results.details.push({
        name: testCase.name,
        error: String(error),
        passed: false,
      });
      console.log("🔴 TEST BAŞARISIZ\n");
    }

    console.log("---".repeat(30) + "\n");
  }

  // Final summary
  console.log("📈 TEST SONUÇLARI:");
  console.log(`   Toplam Test: ${results.total}`);
  console.log(`   Başarılı: ${results.passed}`);
  console.log(`   Başarısız: ${results.failed}`);
  console.log(
    `   Başarı Oranı: ${Math.round((results.passed / results.total) * 100)}%`
  );

  const avgAccuracy =
    results.details
      .filter((r) => r.accuracy)
      .reduce((sum, r) => sum + (r.accuracy || 0), 0) /
    results.details.filter((r) => r.accuracy).length;

  console.log(`   Ortalama Doğruluk: ${Math.round(avgAccuracy)}%`);

  const avgProcessingTime =
    results.details
      .filter((r) => r.processingTime)
      .reduce((sum, r) => sum + (r.processingTime || 0), 0) /
    results.details.filter((r) => r.processingTime).length;

  console.log(`   Ortalama İşleme Süresi: ${Math.round(avgProcessingTime)}ms`);

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultPath = join(
    process.cwd(),
    "tests",
    "results",
    `ai-extraction-test-${timestamp}.json`
  );

  try {
    writeFileSync(resultPath, JSON.stringify(results, null, 2));
    console.log(`💾 Sonuçlar kaydedildi: ${resultPath}`);
  } catch (err) {
    console.log("⚠️  Sonuçlar kaydedilemedi:", err);
  }

  return results;
}

// Run tests
if (require.main === module) {
  testAIExtraction()
    .then((results) => {
      if ((results as any).skipped) {
        console.log("⏭️  AI extraction testleri atlandı (konfigürasyon eksik).\n");
        process.exit(0);
        return;
      }
      const successRate = (results.passed / results.total) * 100;
      process.exit(successRate >= 90 ? 0 : 1);
    })
    .catch((error) => {
      console.error("Test suite failed:", error);
      process.exit(1);
    });
}

export { testAIExtraction };
