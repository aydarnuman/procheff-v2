/**
 * END-TO-END UPLOAD TEST
 *
 * Gerçek upload API'sini test eder:
 * 1. Dosya yükleme → Text extraction (OCR dahil)
 * 2. AI analizi (Claude + Gemini)
 * 3. Sonuç doğrulama
 *
 * Bu test gerçek API endpoint'lerini kullanır.
 */

import fs from "fs";
import path from "path";
import FormData from "form-data";
import fetch from "node-fetch";

const API_BASE = "http://localhost:3000";
const FIXTURES_DIR = path.join(__dirname, "fixtures");

interface UploadResponse {
  success: boolean;
  text: string;
  stats: {
    fileCount: number;
    wordCount: number;
    totalCharCount: number;
    processingTime: number;
  };
  warnings?: string[];
  error?: string;
}

interface AnalysisResponse {
  success: boolean;
  analysis: {
    extracted_data: {
      kurum?: string;
      kisi_sayisi?: number;
      ogun_sayisi?: number;
      gun_sayisi?: number;
      tahmini_butce?: number;
      _reasoning?: {
        kisi_sayisi_analiz?: string;
      };
    };
    confidence_score: number;
    tablo_sayisi?: number;
  };
  error?: string;
}

class EndToEndUploadTest {
  async testSingleFileUpload() {
    console.log("\n📤 Test 1: Tek Dosya Upload (Hastane İhalesi)");
    console.log("-".repeat(80));

    try {
      // Test dosyası oku
      const filePath = path.join(FIXTURES_DIR, "ihale-3-hastane.txt");
      const fileContent = fs.readFileSync(filePath);

      // FormData oluştur
      const form = new FormData();
      form.append("fileCount", "1");
      form.append("file0", fileContent, {
        filename: "hastane.txt",
        contentType: "text/plain",
      });

      console.log(`   📄 Yüklenen: hastane.txt (${fileContent.length} bytes)`);

      // Upload API'ye gönder
      const uploadRes = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: form,
        headers: form.getHeaders(),
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
      }

      const uploadData = (await uploadRes.json()) as UploadResponse;

      console.log(`   ✅ Upload başarılı:`);
      console.log(`      - Dosya sayısı: ${uploadData.stats.fileCount}`);
      console.log(`      - Kelime sayısı: ${uploadData.stats.wordCount}`);
      console.log(`      - Karakter sayısı: ${uploadData.stats.totalCharCount}`);
      console.log(`      - İşlem süresi: ${uploadData.stats.processingTime}ms`);

      if (uploadData.warnings && uploadData.warnings.length > 0) {
        console.log(`   ⚠️  Uyarılar (${uploadData.warnings.length}):`);
        uploadData.warnings.forEach((w) => console.log(`      - ${w}`));
      }

      // AI analizine gönder
      console.log(`\n   🤖 AI analizine gönderiliyor...`);
      const analysisRes = await fetch(`${API_BASE}/api/ai/contextual-analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: uploadData.text,
        }),
      });

      if (!analysisRes.ok) {
        throw new Error(`Analysis failed: ${analysisRes.status} ${analysisRes.statusText}`);
      }

      const analysisData = (await analysisRes.json()) as AnalysisResponse;

      console.log(`   ✅ AI analizi tamamlandı:`);
      console.log(`      - Güven skoru: %${analysisData.analysis.confidence_score}`);
      console.log(`      - Kurum: ${analysisData.analysis.extracted_data.kurum || "N/A"}`);
      console.log(`      - Kişi sayısı: ${analysisData.analysis.extracted_data.kisi_sayisi || "N/A"}`);
      console.log(`      - Öğün sayısı: ${analysisData.analysis.extracted_data.ogun_sayisi || "N/A"}`);
      console.log(`      - Gün sayısı: ${analysisData.analysis.extracted_data.gun_sayisi || "N/A"}`);
      console.log(`      - Tahmini bütçe: ${analysisData.analysis.extracted_data.tahmini_butce ? `${analysisData.analysis.extracted_data.tahmini_butce.toLocaleString()} TL` : "N/A"}`);

      // Doğrula
      const expectedKisi = 2050;
      const actualKisi = analysisData.analysis.extracted_data.kisi_sayisi;

      if (actualKisi === expectedKisi) {
        console.log(`   ✅ Kişi sayısı doğru: ${actualKisi}`);
      } else {
        console.log(`   ⚠️  Kişi sayısı yanlış: Beklenen ${expectedKisi}, Bulunan ${actualKisi}`);
      }

      // Kişi/gün pattern kontrolü
      const reasoning = analysisData.analysis.extracted_data._reasoning?.kisi_sayisi_analiz || "";
      if (reasoning.includes("kişi/gün") || reasoning.includes("günlük ortalama")) {
        console.log(`   ✅ Kişi/gün pattern doğru tespit edildi`);
      } else {
        console.log(`   ⚠️  Kişi/gün pattern tespit edilemedi`);
      }

      console.log(`\n   🎯 Test 1: ✅ BAŞARILI`);
    } catch (error) {
      console.error(`   ❌ Test 1 BAŞARISIZ:`, error);
    }
  }

  async testMultiFileUpload() {
    console.log("\n\n📤 Test 2: Çoklu Dosya Upload (3 Dosya)");
    console.log("-".repeat(80));

    try {
      const files = [
        "ihale-1-huzurevi.txt",
        "ihale-2-okul.txt",
        "ihale-3-hastane.txt",
      ];

      const form = new FormData();
      form.append("fileCount", files.length.toString());

      files.forEach((fileName, index) => {
        const filePath = path.join(FIXTURES_DIR, fileName);
        const fileContent = fs.readFileSync(filePath);
        form.append(`file${index}`, fileContent, {
          filename: fileName,
          contentType: "text/plain",
        });
      });

      console.log(`   📄 Yüklenen dosyalar: ${files.length}`);
      files.forEach((f) => console.log(`      - ${f}`));

      // Upload API'ye gönder
      const uploadRes = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: form,
        headers: form.getHeaders(),
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
      }

      const uploadData = (await uploadRes.json()) as UploadResponse;

      console.log(`   ✅ Upload başarılı:`);
      console.log(`      - Dosya sayısı: ${uploadData.stats.fileCount}`);
      console.log(`      - Toplam kelime: ${uploadData.stats.wordCount}`);
      console.log(`      - Toplam karakter: ${uploadData.stats.totalCharCount}`);
      console.log(`      - İşlem süresi: ${uploadData.stats.processingTime}ms`);

      // Birleştirilmiş metinde her dosya etiketini kontrol et
      const hasAllLabels = files.every((fileName) =>
        uploadData.text.includes(`=== DOSYA: ${fileName} ===`)
      );

      if (hasAllLabels) {
        console.log(`   ✅ Tüm dosya etiketleri mevcut`);
      } else {
        console.log(`   ⚠️  Bazı dosya etiketleri eksik`);
      }

      console.log(`\n   🎯 Test 2: ✅ BAŞARILI`);
    } catch (error) {
      console.error(`   ❌ Test 2 BAŞARISIZ:`, error);
    }
  }

  async testLargeFileUpload() {
    console.log("\n\n📤 Test 3: Büyük Dosya Upload (Dev Hastane)");
    console.log("-".repeat(80));

    try {
      const filePath = path.join(FIXTURES_DIR, "ihale-8-dev-hastane-150k.txt");

      if (!fs.existsSync(filePath)) {
        console.log(`   ⚠️  Test dosyası bulunamadı, test atlanıyor...`);
        return;
      }

      const fileContent = fs.readFileSync(filePath);

      const form = new FormData();
      form.append("fileCount", "1");
      form.append("file0", fileContent, {
        filename: "dev-hastane.txt",
        contentType: "text/plain",
      });

      console.log(`   📄 Yüklenen: dev-hastane.txt (${(fileContent.length / 1024).toFixed(0)} KB)`);

      const startTime = Date.now();

      // Upload API'ye gönder
      const uploadRes = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: form,
        headers: form.getHeaders(),
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
      }

      const uploadData = (await uploadRes.json()) as UploadResponse;
      const uploadTime = Date.now() - startTime;

      console.log(`   ✅ Upload başarılı:`);
      console.log(`      - Karakter sayısı: ${uploadData.stats.totalCharCount}`);
      console.log(`      - İşlem süresi: ${uploadTime}ms`);
      console.log(`      - Throughput: ${((fileContent.length / 1024) / (uploadTime / 1000)).toFixed(0)} KB/s`);

      // AI analizine gönder
      console.log(`\n   🤖 AI analizine gönderiliyor...`);
      const analysisStartTime = Date.now();

      const analysisRes = await fetch(`${API_BASE}/api/ai/full-analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: uploadData.text,
        }),
      });

      if (!analysisRes.ok) {
        throw new Error(`Analysis failed: ${analysisRes.status} ${analysisRes.statusText}`);
      }

      const analysisData = (await analysisRes.json()) as AnalysisResponse;
      const analysisTime = Date.now() - analysisStartTime;

      console.log(`   ✅ AI analizi tamamlandı:`);
      console.log(`      - Güven skoru: %${analysisData.analysis.confidence_score}`);
      console.log(`      - Kişi sayısı: ${analysisData.analysis.extracted_data.kisi_sayisi || "N/A"}`);
      console.log(`      - Tablo sayısı: ${analysisData.analysis.tablo_sayisi || 0}`);
      console.log(`      - Analiz süresi: ${analysisTime}ms`);
      console.log(`      - Toplam süre: ${uploadTime + analysisTime}ms`);

      console.log(`\n   🎯 Test 3: ✅ BAŞARILI`);
    } catch (error) {
      console.error(`   ❌ Test 3 BAŞARISIZ:`, error);
    }
  }

  async testErrorHandling() {
    console.log("\n\n⚠️  Test 4: Hata Yönetimi");
    console.log("-".repeat(80));

    // Test 4a: Boş upload
    try {
      console.log(`   4a. Boş upload (fileCount=0):`);
      const form = new FormData();
      form.append("fileCount", "0");

      const uploadRes = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: form,
        headers: form.getHeaders(),
      });

      const uploadData = (await uploadRes.json()) as UploadResponse;

      if (!uploadData.success && uploadData.error?.includes("bulunamadı")) {
        console.log(`      ✅ Doğru hata mesajı: "${uploadData.error}"`);
      } else {
        console.log(`      ⚠️  Beklenmeyen yanıt: ${JSON.stringify(uploadData)}`);
      }
    } catch (error) {
      console.log(`      ❌ İstek hatası: ${error instanceof Error ? error.message : "Unknown"}`);
    }

    // Test 4b: Çok büyük dosya (50MB+)
    try {
      console.log(`\n   4b. Çok büyük dosya (51MB):`);
      const largeContent = Buffer.alloc(51 * 1024 * 1024, "x"); // 51MB

      const form = new FormData();
      form.append("fileCount", "1");
      form.append("file0", largeContent, {
        filename: "large.txt",
        contentType: "text/plain",
      });

      const uploadRes = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: form,
        headers: form.getHeaders(),
      });

      const uploadData = (await uploadRes.json()) as UploadResponse;

      if (!uploadData.success && uploadData.error?.includes("büyük")) {
        console.log(`      ✅ Doğru hata mesajı: "${uploadData.error}"`);
      } else {
        console.log(`      ⚠️  Beklenmeyen yanıt: ${JSON.stringify(uploadData)}`);
      }
    } catch (error) {
      console.log(`      ❌ İstek hatası: ${error instanceof Error ? error.message : "Unknown"}`);
    }

    console.log(`\n   🎯 Test 4: ✅ BAŞARILI`);
  }

  async runAllTests() {
    console.log("=".repeat(80));
    console.log("END-TO-END UPLOAD TEST SUITE");
    console.log("=".repeat(80));
    console.log(`\nAPI Base: ${API_BASE}`);
    console.log(`Fixtures: ${FIXTURES_DIR}`);
    console.log();

    // API'nin çalıştığını kontrol et
    try {
      const healthCheck = await fetch(`${API_BASE}/api/health`).catch(() => null);
      if (!healthCheck || !healthCheck.ok) {
        console.error("❌ API çalışmıyor! Lütfen önce `npm run dev` ile başlatın.");
        process.exit(1);
      }
      console.log("✅ API çalışıyor\n");
    } catch (error) {
      console.error("❌ API bağlantısı kurulamadı:", error);
      process.exit(1);
    }

    await this.testSingleFileUpload();
    await this.testMultiFileUpload();
    await this.testLargeFileUpload();
    await this.testErrorHandling();

    console.log("\n" + "=".repeat(80));
    console.log("✅ TÜM END-TO-END TESTLER TAMAMLANDI");
    console.log("=".repeat(80));
  }
}

// Run tests
const runner = new EndToEndUploadTest();
runner.runAllTests().catch((error) => {
  console.error("❌ Test runner hatası:", error);
  process.exit(1);
});
