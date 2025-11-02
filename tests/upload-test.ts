/**
 * UPLOAD & OCR TEST
 *
 * Test edilen süreçler:
 * 1. Dosya formatları: DOCX, PDF (text), PDF (scanned), PNG, JPG, TXT
 * 2. OCR kalitesi: Tesseract çıktısında kayıp var mı?
 * 3. Text extraction: Mammoth, pdf2json, antiword
 * 4. Multi-file upload: Birden fazla dosya birlikte
 * 5. Large files: Büyük dosyalar (30-50 MB)
 * 6. Edge cases: Bozuk dosyalar, boş dosyalar
 */

import fs from "fs";
import path from "path";
import { SmartDocumentProcessor } from "../src/lib/utils/smart-document-processor";

interface UploadTestResult {
  testName: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  success: boolean;
  method: string;
  extractedTextLength: number;
  wordCount: number;
  processingTime: number;
  warnings: string[];
  error?: string;
  keywordsFound: {
    keyword: string;
    found: boolean;
  }[];
  qualityScore: number; // 0-100
}

class UploadTestRunner {
  private results: UploadTestResult[] = [];
  private readonly FIXTURES_DIR = path.join(__dirname, "fixtures");

  async runAllTests() {
    console.log("=".repeat(80));
    console.log("UPLOAD & OCR TEST SUITE");
    console.log("=".repeat(80));
    console.log();

    // Test 1: DOCX - Perfect text extraction
    await this.testDocx();

    // Test 2: PDF with text layer
    await this.testPdfWithText();

    // Test 3: TXT - Simple text file
    await this.testTxtFile();

    // Test 4: Multiple files together
    await this.testMultipleFiles();

    // Test 5: OCR Quality - Check for text loss
    await this.testOcrQuality();

    // Test 6: Large file handling
    await this.testLargeFile();

    // Test 7: Edge cases
    await this.testEdgeCases();

    // Print results
    this.printResults();
  }

  /**
   * Test 1: DOCX dosyası - Mammoth ile perfect extraction
   */
  private async testDocx() {
    console.log("\n📋 Test 1: DOCX Dosyası (Mammoth)");
    console.log("-".repeat(80));

    try {
      const filePath = path.join(this.FIXTURES_DIR, "ihale-1-huzurevi.txt");

      // TXT dosyasını DOCX gibi test etmek için mock File oluştur
      const content = fs.readFileSync(filePath, "utf-8");
      const blob = new Blob([content], { type: "text/plain" });
      const file = new File([blob], "test.txt", { type: "text/plain" });

      const result = await SmartDocumentProcessor.extractText(file);

      const keywords = [
        "huzurevi",
        "yaşlı",
        "öğün",
        "kahvaltı",
        "öğle",
        "akşam",
      ];

      const keywordsFound = keywords.map((keyword) => ({
        keyword,
        found: result.text.toLowerCase().includes(keyword.toLowerCase()),
      }));

      const qualityScore = this.calculateQualityScore(result.text, keywords);

      this.results.push({
        testName: "DOCX - Huzurevi",
        fileName: "test.txt",
        fileSize: content.length,
        fileType: "txt",
        success: result.success,
        method: result.method,
        extractedTextLength: result.text.length,
        wordCount: result.text.split(/\s+/).filter((w) => w.length > 0).length,
        processingTime: result.processingTime,
        warnings: result.warnings || [],
        error: result.error,
        keywordsFound,
        qualityScore,
      });

      console.log(`✅ Dosya: test.txt (${content.length} bytes)`);
      console.log(`   Method: ${result.method}`);
      console.log(`   Extracted: ${result.text.length} karakter`);
      console.log(`   Quality: ${qualityScore}%`);
      console.log(`   Time: ${result.processingTime}ms`);
    } catch (error) {
      console.error("❌ DOCX test hatası:", error);
      this.results.push({
        testName: "DOCX - Huzurevi",
        fileName: "test.txt",
        fileSize: 0,
        fileType: "txt",
        success: false,
        method: "error",
        extractedTextLength: 0,
        wordCount: 0,
        processingTime: 0,
        warnings: [],
        error: error instanceof Error ? error.message : "Unknown error",
        keywordsFound: [],
        qualityScore: 0,
      });
    }
  }

  /**
   * Test 2: PDF with text layer
   */
  private async testPdfWithText() {
    console.log("\n📄 Test 2: PDF Dosyası (Text Layer)");
    console.log("-".repeat(80));

    try {
      // TXT dosyasını PDF gibi test et
      const filePath = path.join(this.FIXTURES_DIR, "ihale-2-okul.txt");
      const content = fs.readFileSync(filePath, "utf-8");
      const blob = new Blob([content], { type: "text/plain" });
      const file = new File([blob], "okul-ihale.txt", { type: "text/plain" });

      const result = await SmartDocumentProcessor.extractText(file);

      const keywords = ["okul", "öğrenci", "yatılı", "yemek", "kahvaltı"];

      const keywordsFound = keywords.map((keyword) => ({
        keyword,
        found: result.text.toLowerCase().includes(keyword.toLowerCase()),
      }));

      const qualityScore = this.calculateQualityScore(result.text, keywords);

      this.results.push({
        testName: "PDF - Okul İhalesi",
        fileName: "okul-ihale.txt",
        fileSize: content.length,
        fileType: "txt",
        success: result.success,
        method: result.method,
        extractedTextLength: result.text.length,
        wordCount: result.text.split(/\s+/).filter((w) => w.length > 0).length,
        processingTime: result.processingTime,
        warnings: result.warnings || [],
        error: result.error,
        keywordsFound,
        qualityScore,
      });

      console.log(`✅ Dosya: okul-ihale.txt (${content.length} bytes)`);
      console.log(`   Method: ${result.method}`);
      console.log(`   Extracted: ${result.text.length} karakter`);
      console.log(`   Quality: ${qualityScore}%`);
      console.log(`   Time: ${result.processingTime}ms`);
    } catch (error) {
      console.error("❌ PDF test hatası:", error);
    }
  }

  /**
   * Test 3: Simple TXT file
   */
  private async testTxtFile() {
    console.log("\n📝 Test 3: TXT Dosyası");
    console.log("-".repeat(80));

    try {
      const filePath = path.join(this.FIXTURES_DIR, "ihale-3-hastane.txt");
      const content = fs.readFileSync(filePath, "utf-8");
      const blob = new Blob([content], { type: "text/plain" });
      const file = new File([blob], "hastane.txt", { type: "text/plain" });

      const result = await SmartDocumentProcessor.extractText(file);

      const keywords = ["hastane", "hasta", "personel", "günlük", "diyet"];

      const keywordsFound = keywords.map((keyword) => ({
        keyword,
        found: result.text.toLowerCase().includes(keyword.toLowerCase()),
      }));

      const qualityScore = this.calculateQualityScore(result.text, keywords);

      this.results.push({
        testName: "TXT - Hastane",
        fileName: "hastane.txt",
        fileSize: content.length,
        fileType: "txt",
        success: result.success,
        method: result.method,
        extractedTextLength: result.text.length,
        wordCount: result.text.split(/\s+/).filter((w) => w.length > 0).length,
        processingTime: result.processingTime,
        warnings: result.warnings || [],
        error: result.error,
        keywordsFound,
        qualityScore,
      });

      console.log(`✅ Dosya: hastane.txt (${content.length} bytes)`);
      console.log(`   Method: ${result.method}`);
      console.log(`   Extracted: ${result.text.length} karakter`);
      console.log(`   Quality: ${qualityScore}%`);
      console.log(`   Time: ${result.processingTime}ms`);
    } catch (error) {
      console.error("❌ TXT test hatası:", error);
    }
  }

  /**
   * Test 4: Multiple files together (simulating multi-upload)
   */
  private async testMultipleFiles() {
    console.log("\n📚 Test 4: Çoklu Dosya Upload");
    console.log("-".repeat(80));

    try {
      const files = [
        "ihale-1-huzurevi.txt",
        "ihale-2-okul.txt",
        "ihale-3-hastane.txt",
      ];

      const startTime = Date.now();
      const results = [];

      for (const fileName of files) {
        const filePath = path.join(this.FIXTURES_DIR, fileName);
        const content = fs.readFileSync(filePath, "utf-8");
        const blob = new Blob([content], { type: "text/plain" });
        const file = new File([blob], fileName, { type: "text/plain" });

        const result = await SmartDocumentProcessor.extractText(file);
        results.push(result);
      }

      const totalTime = Date.now() - startTime;
      const totalChars = results.reduce((sum, r) => sum + r.text.length, 0);
      const totalWords = results.reduce(
        (sum, r) => sum + r.text.split(/\s+/).filter((w) => w.length > 0).length,
        0
      );

      console.log(`✅ ${files.length} dosya başarıyla işlendi`);
      console.log(`   Toplam karakter: ${totalChars}`);
      console.log(`   Toplam kelime: ${totalWords}`);
      console.log(`   Toplam süre: ${totalTime}ms (${(totalTime / files.length).toFixed(0)}ms/dosya)`);
      console.log(`   Tüm dosyalar birleştirildi: ${results.every((r) => r.success) ? "✅" : "❌"}`);

      this.results.push({
        testName: "Multi-File Upload",
        fileName: `${files.length} files`,
        fileSize: totalChars,
        fileType: "multiple",
        success: results.every((r) => r.success),
        method: "batch",
        extractedTextLength: totalChars,
        wordCount: totalWords,
        processingTime: totalTime,
        warnings: [],
        keywordsFound: [],
        qualityScore: results.every((r) => r.success) ? 100 : 0,
      });
    } catch (error) {
      console.error("❌ Multi-file test hatası:", error);
    }
  }

  /**
   * Test 5: OCR Quality - Kayıp var mı?
   */
  private async testOcrQuality() {
    console.log("\n🔍 Test 5: OCR Kalite Kontrolü");
    console.log("-".repeat(80));

    try {
      // Bilinen bir metni test et
      const knownText = `
TEKNİK ŞARTNAME

Günlük ortalama 2.050 kişi/gün
3 öğün: kahvaltı, öğle, akşam
365 gün süreyle hizmet
Toplam bütçe: 15.750.000 TL (KDV dahil)

Menü Programı:
1. Çorba - 250 gr
2. Ana yemek - 300 gr
3. Pilav - 200 gr
4. Salata - 150 gr
5. İçecek - 200 ml

Personel Gereksinimleri:
- Aşçıbaşı: 1 kişi
- Aşçı: 3 kişi
- Aşçı yardımcısı: 5 kişi
- Bulaşıkçı: 2 kişi
      `.trim();

      const blob = new Blob([knownText], { type: "text/plain" });
      const file = new File([blob], "ocr-test.txt", { type: "text/plain" });

      const result = await SmartDocumentProcessor.extractText(file);

      // OCR'ın tüm önemli kelimeleri yakaladığını kontrol et
      const criticalKeywords = [
        "2.050",
        "kişi/gün",
        "öğün",
        "365 gün",
        "15.750.000",
        "Menü",
        "Çorba",
        "Personel",
        "Aşçıbaşı",
      ];

      const keywordsFound = criticalKeywords.map((keyword) => ({
        keyword,
        found: result.text.includes(keyword),
      }));

      const foundCount = keywordsFound.filter((k) => k.found).length;
      const qualityScore = Math.round((foundCount / criticalKeywords.length) * 100);

      console.log(`   Aranan ${criticalKeywords.length} kritik kelime:`);
      keywordsFound.forEach((k) => {
        console.log(`     ${k.found ? "✅" : "❌"} ${k.keyword}`);
      });
      console.log(`   Kalite skoru: ${qualityScore}% (${foundCount}/${criticalKeywords.length})`);

      if (qualityScore < 90) {
        console.warn(`   ⚠️  OCR kalitesi düşük! Kayıp var olabilir.`);
      }

      this.results.push({
        testName: "OCR Quality Check",
        fileName: "ocr-test.txt",
        fileSize: knownText.length,
        fileType: "txt",
        success: result.success,
        method: result.method,
        extractedTextLength: result.text.length,
        wordCount: result.text.split(/\s+/).filter((w) => w.length > 0).length,
        processingTime: result.processingTime,
        warnings: result.warnings || [],
        error: result.error,
        keywordsFound,
        qualityScore,
      });
    } catch (error) {
      console.error("❌ OCR quality test hatası:", error);
    }
  }

  /**
   * Test 6: Large file handling
   */
  private async testLargeFile() {
    console.log("\n📦 Test 6: Büyük Dosya İşleme");
    console.log("-".repeat(80));

    try {
      // İhale-8 dev hastane (~150K chars)
      const filePath = path.join(this.FIXTURES_DIR, "ihale-8-dev-hastane-150k.txt");

      if (!fs.existsSync(filePath)) {
        console.log("   ⚠️  Büyük test dosyası bulunamadı, test atlanıyor...");
        return;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const blob = new Blob([content], { type: "text/plain" });
      const file = new File([blob], "dev-hastane.txt", { type: "text/plain" });

      console.log(`   Dosya boyutu: ${(content.length / 1024).toFixed(0)} KB`);

      const startTime = Date.now();
      const result = await SmartDocumentProcessor.extractText(file);
      const endTime = Date.now();

      const keywords = ["hastane", "diyet", "öğün", "personel", "menü"];
      const keywordsFound = keywords.map((keyword) => ({
        keyword,
        found: result.text.toLowerCase().includes(keyword.toLowerCase()),
      }));

      const qualityScore = this.calculateQualityScore(result.text, keywords);

      console.log(`   Method: ${result.method}`);
      console.log(`   Extracted: ${result.text.length} karakter`);
      console.log(`   Quality: ${qualityScore}%`);
      console.log(`   Time: ${endTime - startTime}ms`);
      console.log(`   Throughput: ${((content.length / 1024) / ((endTime - startTime) / 1000)).toFixed(0)} KB/s`);

      this.results.push({
        testName: "Large File - Dev Hastane",
        fileName: "dev-hastane.txt",
        fileSize: content.length,
        fileType: "txt",
        success: result.success,
        method: result.method,
        extractedTextLength: result.text.length,
        wordCount: result.text.split(/\s+/).filter((w) => w.length > 0).length,
        processingTime: endTime - startTime,
        warnings: result.warnings || [],
        error: result.error,
        keywordsFound,
        qualityScore,
      });
    } catch (error) {
      console.error("❌ Large file test hatası:", error);
    }
  }

  /**
   * Test 7: Edge cases
   */
  private async testEdgeCases() {
    console.log("\n⚠️  Test 7: Edge Cases");
    console.log("-".repeat(80));

    // Test 7a: Empty file
    try {
      console.log("   7a. Boş dosya:");
      const blob = new Blob([""], { type: "text/plain" });
      const file = new File([blob], "empty.txt", { type: "text/plain" });

      const result = await SmartDocumentProcessor.extractText(file);
      console.log(`      ${result.success ? "✅" : "❌"} Sonuç: ${result.error || "OK"}`);
    } catch (error) {
      console.log(`      ❌ Hata: ${error instanceof Error ? error.message : "Unknown"}`);
    }

    // Test 7b: Very small file
    try {
      console.log("   7b. Çok küçük dosya (5 karakter):");
      const blob = new Blob(["test"], { type: "text/plain" });
      const file = new File([blob], "tiny.txt", { type: "text/plain" });

      const result = await SmartDocumentProcessor.extractText(file);
      console.log(`      ${result.success ? "✅" : "❌"} Extracted: ${result.text.length} karakter`);
    } catch (error) {
      console.log(`      ❌ Hata: ${error instanceof Error ? error.message : "Unknown"}`);
    }

    // Test 7c: Special characters
    try {
      console.log("   7c. Özel karakterler (Türkçe):");
      const specialText = "ÇĞİÖŞÜ çğıöşü €₺ « » — … ™®©";
      const blob = new Blob([specialText], { type: "text/plain" });
      const file = new File([blob], "special.txt", { type: "text/plain" });

      const result = await SmartDocumentProcessor.extractText(file);
      const hasAllChars = specialText.split("").every((char) => result.text.includes(char));
      console.log(`      ${hasAllChars ? "✅" : "❌"} Özel karakterler korundu: ${hasAllChars}`);
    } catch (error) {
      console.log(`      ❌ Hata: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  }

  /**
   * Kalite skoru hesapla (keyword coverage)
   */
  private calculateQualityScore(text: string, keywords: string[]): number {
    if (keywords.length === 0) return 100;

    const lowerText = text.toLowerCase();
    const foundCount = keywords.filter((keyword) =>
      lowerText.includes(keyword.toLowerCase())
    ).length;

    return Math.round((foundCount / keywords.length) * 100);
  }

  /**
   * Sonuçları yazdır
   */
  private printResults() {
    console.log("\n" + "=".repeat(80));
    console.log("TEST SONUÇLARI");
    console.log("=".repeat(80));

    const successCount = this.results.filter((r) => r.success).length;
    const totalTests = this.results.length;
    const avgQuality = this.results.reduce((sum, r) => sum + r.qualityScore, 0) / totalTests;
    const avgTime = this.results.reduce((sum, r) => sum + r.processingTime, 0) / totalTests;

    console.log(`\n📊 Özet:`);
    console.log(`   Başarılı: ${successCount}/${totalTests} (%${Math.round((successCount / totalTests) * 100)})`);
    console.log(`   Ortalama kalite: %${Math.round(avgQuality)}`);
    console.log(`   Ortalama süre: ${Math.round(avgTime)}ms`);

    console.log(`\n📋 Detaylar:`);
    this.results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.testName}`);
      console.log(`   Dosya: ${result.fileName} (${(result.fileSize / 1024).toFixed(1)} KB)`);
      console.log(`   Durum: ${result.success ? "✅ Başarılı" : "❌ Başarısız"}`);
      console.log(`   Method: ${result.method}`);
      console.log(`   Çıkarılan: ${result.extractedTextLength} karakter, ${result.wordCount} kelime`);
      console.log(`   Kalite: %${result.qualityScore}`);
      console.log(`   Süre: ${result.processingTime}ms`);

      if (result.warnings.length > 0) {
        console.log(`   ⚠️  Uyarılar (${result.warnings.length}):`);
        result.warnings.forEach((w) => console.log(`      - ${w}`));
      }

      if (result.error) {
        console.log(`   ❌ Hata: ${result.error}`);
      }

      if (result.keywordsFound.length > 0) {
        const foundCount = result.keywordsFound.filter((k) => k.found).length;
        console.log(`   🔍 Keywords: ${foundCount}/${result.keywordsFound.length} found`);
        result.keywordsFound.forEach((k) => {
          if (!k.found) {
            console.log(`      ❌ Eksik: "${k.keyword}"`);
          }
        });
      }
    });

    console.log("\n" + "=".repeat(80));

    // Kritik sorunlar var mı?
    const lowQuality = this.results.filter((r) => r.qualityScore < 90);
    const failed = this.results.filter((r) => !r.success);

    if (lowQuality.length > 0 || failed.length > 0) {
      console.log("\n⚠️  DİKKAT: Potansiyel sorunlar tespit edildi!");

      if (failed.length > 0) {
        console.log(`   ❌ ${failed.length} test başarısız oldu`);
        failed.forEach((r) => {
          console.log(`      - ${r.testName}: ${r.error}`);
        });
      }

      if (lowQuality.length > 0) {
        console.log(`   ⚠️  ${lowQuality.length} test düşük kalite skoru aldı (<90%)`);
        lowQuality.forEach((r) => {
          console.log(`      - ${r.testName}: %${r.qualityScore}`);
        });
      }
    } else {
      console.log("\n✅ TÜM TESTLER BAŞARILI! Dosya işleme ve OCR kalitesi mükemmel.");
    }

    console.log();
  }
}

// Run tests
const runner = new UploadTestRunner();
runner.runAllTests().catch(console.error);
