import fs from "fs";
import path from "path";

interface TestResult {
  fixture: string;
  success: boolean;
  processingTime: number;
  documentMetrics: {
    documentHash: string;
    totalPages: number;
    averageQuality: number;
    ocrPagesProcessed: number;
    processingDuration: number;
  };
  analysisResults: {
    overallConfidence: number;
    wordCount: number;
    keyTermsFound: string[];
  };
  error?: string;
}

interface SmokeTestSummary {
  timestamp: Date;
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  averageProcessingTime: number;
  averageQualityScore: number;
  averageConfidence: number;
  ocrUsageRate: number;
  results: TestResult[];
}

class SmokeTestRunner {
  private readonly API_BASE = "http://localhost:3000";
  private readonly FIXTURES_DIR = path.join(process.cwd(), "tests", "fixtures");

  async runSmokeTests(): Promise<SmokeTestSummary> {
    console.log("🚀 E2E Smoke Tests başlatılıyor...");
    console.log(`Fixtures dizini: ${this.FIXTURES_DIR}`);

    const fixtures = [
      "sample_tender_1.txt",
      "sample_tender_2.txt",
      "sample_tender_3.txt",
    ];

    const results: TestResult[] = [];

    for (const fixture of fixtures) {
      console.log(`\n📄 Test fixture: ${fixture}`);

      try {
        const result = await this.testFixture(fixture);
        results.push(result);

        if (result.success) {
          console.log(`✅ Başarılı - ${result.processingTime}ms`);
          console.log(
            `   Kalite: ${Math.round(
              result.documentMetrics.averageQuality * 100
            )}%`
          );
          console.log(
            `   Güven: ${Math.round(
              result.analysisResults.overallConfidence * 100
            )}%`
          );
          console.log(
            `   OCR sayfa: ${result.documentMetrics.ocrPagesProcessed}`
          );
        } else {
          console.log(`❌ Başarısız - ${result.error}`);
        }
      } catch (error) {
        console.log(`💥 Test hatası: ${error}`);
        results.push({
          fixture,
          success: false,
          processingTime: 0,
          documentMetrics: {
            documentHash: "",
            totalPages: 0,
            averageQuality: 0,
            ocrPagesProcessed: 0,
            processingDuration: 0,
          },
          analysisResults: {
            overallConfidence: 0,
            wordCount: 0,
            keyTermsFound: [],
          },
          error: error instanceof Error ? error.message : "Bilinmeyen hata",
        });
      }
    }

    const summary = this.generateSummary(results);
    await this.saveTestResults(summary);
    this.printSummary(summary);

    return summary;
  }

  private async testFixture(filename: string): Promise<TestResult> {
    const fixturePath = path.join(this.FIXTURES_DIR, filename);

    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Fixture bulunamadı: ${fixturePath}`);
    }

    // Text file'ı fake PDF olarak simüle et
    const textContent = fs.readFileSync(fixturePath, "utf-8");

    // FormData oluştur
    const formData = new FormData();

    // Text'i blob olarak ekle (PDF simülasyonu için)
    const blob = new Blob([textContent], { type: "application/pdf" });
    const file = new File([blob], filename.replace(".txt", ".pdf"), {
      type: "application/pdf",
    });

    formData.append("file", file);

    const startTime = Date.now();

    // API çağrısı
    const response = await fetch(`${this.API_BASE}/api/ai/analyze-document`, {
      method: "POST",
      body: formData,
    });

    const processingTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${response.status} - ${errorData.error}`);
    }

    const analysisResult = await response.json();

    return {
      fixture: filename,
      success: true,
      processingTime,
      documentMetrics: analysisResult.documentMetrics,
      analysisResults: {
        overallConfidence: analysisResult.overallConfidence,
        wordCount: analysisResult.wordCount,
        keyTermsFound: analysisResult.keyTermsFound,
      },
    };
  }

  private generateSummary(results: TestResult[]): SmokeTestSummary {
    const successfulTests = results.filter((r) => r.success);
    const failedTests = results.filter((r) => !r.success);

    const avgProcessingTime =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.processingTime, 0) / results.length
        : 0;

    const avgQuality =
      successfulTests.length > 0
        ? successfulTests.reduce(
            (sum, r) => sum + r.documentMetrics.averageQuality,
            0
          ) / successfulTests.length
        : 0;

    const avgConfidence =
      successfulTests.length > 0
        ? successfulTests.reduce(
            (sum, r) => sum + r.analysisResults.overallConfidence,
            0
          ) / successfulTests.length
        : 0;

    const totalOcrPages = results.reduce(
      (sum, r) => sum + (r.documentMetrics?.ocrPagesProcessed || 0),
      0
    );
    const totalPages = results.reduce(
      (sum, r) => sum + (r.documentMetrics?.totalPages || 0),
      0
    );
    const ocrUsageRate = totalPages > 0 ? totalOcrPages / totalPages : 0;

    return {
      timestamp: new Date(),
      totalTests: results.length,
      successfulTests: successfulTests.length,
      failedTests: failedTests.length,
      averageProcessingTime: Math.round(avgProcessingTime),
      averageQualityScore: Math.round(avgQuality * 100) / 100,
      averageConfidence: Math.round(avgConfidence * 100) / 100,
      ocrUsageRate: Math.round(ocrUsageRate * 100) / 100,
      results,
    };
  }

  private async saveTestResults(summary: SmokeTestSummary): Promise<void> {
    const resultsDir = path.join(process.cwd(), "tests", "results");

    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const timestamp = summary.timestamp.toISOString().replace(/[:.]/g, "-");
    const filename = `smoke-test-${timestamp}.json`;
    const filepath = path.join(resultsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(summary, null, 2));
    console.log(`\n💾 Test sonuçları kaydedildi: ${filepath}`);
  }

  private printSummary(summary: SmokeTestSummary): void {
    console.log("\n" + "=".repeat(60));
    console.log("📊 SMOKE TEST ÖZET RAPORU");
    console.log("=".repeat(60));
    console.log(`📅 Tarih: ${summary.timestamp.toLocaleString("tr-TR")}`);
    console.log(`🧪 Toplam Test: ${summary.totalTests}`);
    console.log(`✅ Başarılı: ${summary.successfulTests}`);
    console.log(`❌ Başarısız: ${summary.failedTests}`);
    console.log(
      `⏱️  Ortalama İşlem Süresi: ${summary.averageProcessingTime}ms`
    );
    console.log(
      `🎯 Ortalama Kalite Skoru: ${Math.round(
        summary.averageQualityScore * 100
      )}%`
    );
    console.log(
      `🤖 Ortalama Güven Skoru: ${Math.round(summary.averageConfidence * 100)}%`
    );
    console.log(
      `👁️  OCR Kullanım Oranı: ${Math.round(summary.ocrUsageRate * 100)}%`
    );

    if (summary.failedTests > 0) {
      console.log("\n❌ BAŞARISIZ TESTLER:");
      summary.results
        .filter((r) => !r.success)
        .forEach((result) => {
          console.log(`   - ${result.fixture}: ${result.error}`);
        });
    }

    console.log("=".repeat(60));

    const successRate = Math.round(
      (summary.successfulTests / summary.totalTests) * 100
    );
    if (successRate >= 80) {
      console.log("🎉 Smoke testleri BAŞARILI! Sistem çalışır durumda.");
    } else {
      console.log("⚠️  Smoke testleri UYARI! Sistemde sorunlar mevcut.");
    }
  }
}

// Script çalıştırma
if (require.main === module) {
  const runner = new SmokeTestRunner();

  runner
    .runSmokeTests()
    .then((summary) => {
      const successRate = summary.successfulTests / summary.totalTests;
      process.exit(successRate >= 0.8 ? 0 : 1);
    })
    .catch((error) => {
      console.error("💥 Smoke test çalıştırma hatası:", error);
      process.exit(1);
    });
}

export { SmokeTestRunner, type SmokeTestSummary, type TestResult };
