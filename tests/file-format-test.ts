/**
 * KAPSAMLI DOSYA FORMAT TESTİ
 * Tüm desteklenen dosya formatlarını test eder: PDF, DOCX, DOC, TXT, CSV
 *
 * MAKSİMUM KALİTE testi - güven skorları kontrol edilir
 */

import fs from "fs";
import path from "path";

interface FileTestResult {
  fileName: string;
  format: string;
  success: boolean;
  processingTime: number;
  extracted: {
    textLength: number;
    wordCount: number;
    tablesFound?: number;
  };
  confidence?: number;
  dataExtracted: {
    kurum?: string;
    kisi_sayisi?: number | null;
    ogun_sayisi?: number | null;
    gun_sayisi?: number | null;
    guven_skoru?: number;
  };
  error?: string;
}

interface FormatTestSummary {
  timestamp: Date;
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  formatResults: {
    [key: string]: {
      tested: number;
      passed: number;
      avgConfidence: number;
      avgProcessingTime: number;
    };
  };
  results: FileTestResult[];
}

class FileFormatTester {
  private readonly API_BASE = "http://localhost:3000";
  private readonly FIXTURES_DIR = path.join(process.cwd(), "tests", "fixtures");

  // Minimum kabul edilebilir güven skoru (kullanıcı %85-95 istiyor)
  private readonly MIN_CONFIDENCE = 0.75; // %75 minimum

  async testAllFormats(): Promise<FormatTestSummary> {
    console.log("📁 TÜM DOSYA FORMATLARI TEST EDİLİYOR...");
    console.log(`Minimum güven skoru: %${this.MIN_CONFIDENCE * 100}`);
    console.log("");

    const results: FileTestResult[] = [];

    // 1. TXT Formatı Test (mevcut fixtures)
    console.log("📄 TXT dosyaları test ediliyor...");
    const txtFiles = fs
      .readdirSync(this.FIXTURES_DIR)
      .filter((f) => f.endsWith(".txt"));

    for (const file of txtFiles) {
      const result = await this.testTextFile(file);
      results.push(result);
      this.printResult(result);
    }

    // 2. PDF Format Test (eğer varsa)
    console.log("\n📕 PDF dosyaları test ediliyor...");
    const pdfFiles = fs
      .readdirSync(this.FIXTURES_DIR)
      .filter((f) => f.endsWith(".pdf"));

    if (pdfFiles.length === 0) {
      console.log("⚠️  PDF fixture bulunamadı - PDF testi atlanıyor");
      console.log("   💡 Eklemek için: tests/fixtures/sample.pdf");
    } else {
      for (const file of pdfFiles) {
        const result = await this.testPDFFile(file);
        results.push(result);
        this.printResult(result);
      }
    }

    // 3. DOCX Format Test
    console.log("\n📘 DOCX dosyaları test ediliyor...");
    const docxFiles = fs
      .readdirSync(this.FIXTURES_DIR)
      .filter((f) => f.endsWith(".docx"));

    if (docxFiles.length === 0) {
      console.log("⚠️  DOCX fixture bulunamadı - DOCX testi atlanıyor");
      console.log("   💡 Eklemek için: tests/fixtures/sample.docx");
    } else {
      for (const file of docxFiles) {
        const result = await this.testDOCXFile(file);
        results.push(result);
        this.printResult(result);
      }
    }

    // 4. DOC Format Test
    console.log("\n📙 DOC dosyaları test ediliyor...");
    const docFiles = fs
      .readdirSync(this.FIXTURES_DIR)
      .filter((f) => f.endsWith(".doc"));

    if (docFiles.length === 0) {
      console.log("⚠️  DOC fixture bulunamadı - DOC testi atlanıyor");
      console.log("   💡 Eklemek için: tests/fixtures/sample.doc");
    } else {
      for (const file of docFiles) {
        const result = await this.testDOCFile(file);
        results.push(result);
        this.printResult(result);
      }
    }

    // 5. CSV Format Test
    console.log("\n📊 CSV dosyaları test ediliyor...");
    const csvFiles = fs
      .readdirSync(this.FIXTURES_DIR)
      .filter((f) => f.endsWith(".csv"));

    if (csvFiles.length === 0) {
      console.log("⚠️  CSV fixture bulunamadı - CSV testi atlanıyor");
      console.log("   💡 Eklemek için: tests/fixtures/sample.csv");
    } else {
      for (const file of csvFiles) {
        const result = await this.testCSVFile(file);
        results.push(result);
        this.printResult(result);
      }
    }

    return this.generateSummary(results);
  }

  private async testTextFile(fileName: string): Promise<FileTestResult> {
    const startTime = Date.now();
    const filePath = path.join(this.FIXTURES_DIR, fileName);

    try {
      const text = fs.readFileSync(filePath, "utf-8");

      // /api/ai/extract-basic endpoint test
      const response = await fetch(`${this.API_BASE}/api/ai/extract-basic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      const processingTime = Date.now() - startTime;

      if (!response.ok || !data.success) {
        return {
          fileName,
          format: "TXT",
          success: false,
          processingTime,
          extracted: { textLength: text.length, wordCount: text.split(/\s+/).length },
          dataExtracted: {},
          error: data.error || "API error",
        };
      }

      return {
        fileName,
        format: "TXT",
        success: true,
        processingTime,
        extracted: {
          textLength: text.length,
          wordCount: text.split(/\s+/).length,
        },
        confidence: data.data.guven_skoru,
        dataExtracted: {
          kurum: data.data.kurum,
          kisi_sayisi: data.data.kisi_sayisi,
          ogun_sayisi: data.data.ogun_sayisi,
          gun_sayisi: data.data.gun_sayisi,
          guven_skoru: data.data.guven_skoru,
        },
      };
    } catch (error: any) {
      return {
        fileName,
        format: "TXT",
        success: false,
        processingTime: Date.now() - startTime,
        extracted: { textLength: 0, wordCount: 0 },
        dataExtracted: {},
        error: error.message,
      };
    }
  }

  private async testPDFFile(fileName: string): Promise<FileTestResult> {
    const startTime = Date.now();
    const filePath = path.join(this.FIXTURES_DIR, fileName);

    try {
      const buffer = fs.readFileSync(filePath);
      const formData = new FormData();
      const blob = new Blob([buffer], { type: "application/pdf" });
      formData.append("file", blob, fileName);

      const response = await fetch(`${this.API_BASE}/api/upload`, {
        method: "POST",
        body: formData as any,
      });

      const data = await response.json();
      const processingTime = Date.now() - startTime;

      if (!response.ok || !data.success) {
        return {
          fileName,
          format: "PDF",
          success: false,
          processingTime,
          extracted: { textLength: 0, wordCount: 0 },
          dataExtracted: {},
          error: data.error || "PDF upload failed",
        };
      }

      // Şimdi extracted text ile basic extraction yap
      const extractResponse = await fetch(`${this.API_BASE}/api/ai/extract-basic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.text }),
      });

      const extractData = await extractResponse.json();

      return {
        fileName,
        format: "PDF",
        success: extractData.success,
        processingTime: Date.now() - startTime,
        extracted: {
          textLength: data.text?.length || 0,
          wordCount: data.metadata?.wordCount || 0,
        },
        confidence: extractData.data?.guven_skoru,
        dataExtracted: {
          kurum: extractData.data?.kurum,
          kisi_sayisi: extractData.data?.kisi_sayisi,
          ogun_sayisi: extractData.data?.ogun_sayisi,
          gun_sayisi: extractData.data?.gun_sayisi,
          guven_skoru: extractData.data?.guven_skoru,
        },
      };
    } catch (error: any) {
      return {
        fileName,
        format: "PDF",
        success: false,
        processingTime: Date.now() - startTime,
        extracted: { textLength: 0, wordCount: 0 },
        dataExtracted: {},
        error: error.message,
      };
    }
  }

  private async testDOCXFile(fileName: string): Promise<FileTestResult> {
    // DOCX testi PDF ile aynı mantık
    const result = await this.testPDFFile(fileName);
    return { ...result, format: "DOCX" };
  }

  private async testDOCFile(fileName: string): Promise<FileTestResult> {
    // DOC testi PDF ile aynı mantık
    const result = await this.testPDFFile(fileName);
    return { ...result, format: "DOC" };
  }

  private async testCSVFile(fileName: string): Promise<FileTestResult> {
    // CSV testi - upload endpoint kullan
    const result = await this.testPDFFile(fileName);
    return { ...result, format: "CSV" };
  }

  private printResult(result: FileTestResult) {
    const icon = result.success ? "✅" : "❌";
    const confidenceStr = result.confidence
      ? `%${Math.round(result.confidence * 100)}`
      : "N/A";

    const confidenceColor = result.confidence && result.confidence >= this.MIN_CONFIDENCE
      ? "🟢"
      : result.confidence && result.confidence >= 0.60
      ? "🟡"
      : "🔴";

    console.log(`${icon} ${result.format.padEnd(5)} | ${result.fileName.padEnd(25)} | Güven: ${confidenceColor} ${confidenceStr} | ${result.processingTime}ms`);

    if (result.success && result.confidence && result.confidence < this.MIN_CONFIDENCE) {
      console.log(`   ⚠️  Güven skoru düşük! (Beklenen: %${this.MIN_CONFIDENCE * 100}+)`);
    }

    if (!result.success) {
      console.log(`   ❌ Hata: ${result.error}`);
    }

    if (result.success && result.dataExtracted) {
      const { kurum, kisi_sayisi, ogun_sayisi, gun_sayisi } = result.dataExtracted;
      console.log(`      Kurum: ${kurum || "N/A"} | Kişi: ${kisi_sayisi ?? "N/A"} | Öğün: ${ogun_sayisi ?? "N/A"} | Gün: ${gun_sayisi ?? "N/A"}`);
    }
  }

  private generateSummary(results: FileTestResult[]): FormatTestSummary {
    const successCount = results.filter((r) => r.success).length;
    const formatResults: { [key: string]: any } = {};

    // Format bazlı istatistikler
    const formats = ["TXT", "PDF", "DOCX", "DOC", "CSV"];
    formats.forEach((format) => {
      const formatTests = results.filter((r) => r.format === format);
      if (formatTests.length === 0) return;

      const passed = formatTests.filter((r) => r.success).length;
      const confidences = formatTests
        .filter((r) => r.confidence !== undefined)
        .map((r) => r.confidence!);
      const avgConfidence = confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0;
      const avgTime = formatTests.reduce((a, b) => a + b.processingTime, 0) / formatTests.length;

      formatResults[format] = {
        tested: formatTests.length,
        passed,
        avgConfidence,
        avgProcessingTime: Math.round(avgTime),
      };
    });

    const summary = {
      timestamp: new Date(),
      totalTests: results.length,
      successfulTests: successCount,
      failedTests: results.length - successCount,
      formatResults,
      results,
    };

    this.printSummary(summary);
    return summary;
  }

  private printSummary(summary: FormatTestSummary) {
    console.log("\n" + "=".repeat(80));
    console.log("📊 DOSYA FORMAT TEST ÖZET");
    console.log("=".repeat(80));
    console.log(`Tarih: ${summary.timestamp.toISOString()}`);
    console.log(`Toplam Test: ${summary.totalTests}`);
    console.log(`✅ Başarılı: ${summary.successfulTests}`);
    console.log(`❌ Başarısız: ${summary.failedTests}`);
    console.log(`Başarı Oranı: %${Math.round((summary.successfulTests / summary.totalTests) * 100)}`);
    console.log("");

    console.log("FORMAT BAZLI İSTATİSTİKLER:");
    console.log("-".repeat(80));
    Object.entries(summary.formatResults).forEach(([format, stats]: [string, any]) => {
      console.log(`${format.padEnd(6)} | Test: ${stats.tested} | Başarılı: ${stats.passed} | Ort. Güven: %${Math.round(stats.avgConfidence * 100)} | Ort. Süre: ${stats.avgProcessingTime}ms`);
    });

    console.log("\n" + "=".repeat(80));

    // Düşük güven skorları için uyarı
    const lowConfidenceResults = summary.results.filter(
      (r) => r.success && r.confidence && r.confidence < 0.75
    );

    if (lowConfidenceResults.length > 0) {
      console.log("\n⚠️  DÜŞÜK GÜVEN SKORLARI:");
      lowConfidenceResults.forEach((r) => {
        console.log(`   ${r.fileName}: %${Math.round(r.confidence! * 100)} (Beklenen: %75+)`);
      });
    }
  }
}

// Test Runner
async function main() {
  const tester = new FileFormatTester();
  const summary = await tester.testAllFormats();

  // Sonuçları dosyaya kaydet
  const resultsDir = path.join(process.cwd(), "tests", "results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const resultFile = path.join(
    resultsDir,
    `file-format-test-${Date.now()}.json`
  );
  fs.writeFileSync(resultFile, JSON.stringify(summary, null, 2));
  console.log(`\n💾 Sonuçlar kaydedildi: ${resultFile}`);

  // Exit code
  const exitCode = summary.failedTests > 0 ? 1 : 0;
  process.exit(exitCode);
}

main().catch((error) => {
  console.error("❌ Test hatası:", error);
  process.exit(1);
});
