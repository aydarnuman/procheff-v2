/**
 * GERÇEK DÜNYA SİSTEM TESTİ
 *
 * Farklı ihale türlerinde sistemin performansını test eder:
 * - Huzurevi (275 kişi, 3 öğün, 365 gün)
 * - Okul (450 kişi, 3 öğün, 180 gün)
 * - Hastane (2050 kişi, değişken öğün, 365 gün)
 * - Kreş (35 kişi, 2 öğün, 240 gün)
 */

import fs from "fs";
import path from "path";

interface TestCase {
  name: string;
  file: string;
  expectedFields: {
    kurum: boolean;
    kisi_sayisi: boolean;
    ogun_sayisi: boolean;
    gun_sayisi: boolean;
    tahmini_butce: boolean;
  };
  notes: string;
}

interface TestResult {
  testCase: string;
  success: boolean;
  duration: number;
  data: any;
  confidence: number;
  fieldsExtracted: string[];
  fieldsMissing: string[];
  warnings: any[];
}

class RealWorldTester {
  private readonly API_BASE = "http://localhost:3000";
  private readonly FIXTURES_DIR = path.join(__dirname, "fixtures");

  private testCases: TestCase[] = [
    {
      name: "İhale 1: Huzurevi + Çocuk Evi + Kadın Konukevi",
      file: "ihale-1-huzurevi.txt",
      expectedFields: {
        kurum: true,
        kisi_sayisi: true,  // 275 kişi TOPLAM (personel 7 DEĞİL!)
        ogun_sayisi: true,  // 3 öğün
        gun_sayisi: true,   // 365 gün
        tahmini_butce: true // 3.500.000 TL
      },
      notes: "Çoklu lokasyon, personel vs kişi ayrımı kritik"
    },
    {
      name: "İhale 2: Yatılı Okul",
      file: "ihale-2-okul.txt",
      expectedFields: {
        kurum: true,
        kisi_sayisi: true,  // 450 öğrenci (personel 20 DEĞİL!)
        ogun_sayisi: true,  // 3 öğün
        gun_sayisi: true,   // 180 gün (9 ay)
        tahmini_butce: true // 2.800.000 TL (KDV hariç)
      },
      notes: "Okul dönemi (180 gün), KDV hariç bütçe"
    },
    {
      name: "İhale 3: Şehir Hastanesi",
      file: "ihale-3-hastane.txt",
      expectedFields: {
        kurum: true,
        kisi_sayisi: true,  // ~2.050 kişi/gün (personel 96 DEĞİL!)
        ogun_sayisi: true,  // Değişken ama genelde 3-4 öğün
        gun_sayisi: true,   // 365 gün
        tahmini_butce: true // 12.500.000 TL
      },
      notes: "Çok yüksek kişi sayısı, diyet gereksinimleri, 7/24 hizmet"
    },
    {
      name: "İhale 4: Küçük Kreş",
      file: "ihale-4-kucuk.txt",
      expectedFields: {
        kurum: true,
        kisi_sayisi: true,  // 35 çocuk (personel 2 DEĞİL!)
        ogun_sayisi: true,  // 2 öğün
        gun_sayisi: true,   // 240 gün
        tahmini_butce: true // 180.000 TL
      },
      notes: "Küçük ölçekli, hafta içi 5 gün, düşük bütçe"
    }
  ];

  async runAllTests(): Promise<void> {
    console.log("🌍 GERÇEK DÜNYA SİSTEM TESTLERİ");
    console.log("=".repeat(80));
    console.log(`📁 Fixtures klasörü: ${this.FIXTURES_DIR}`);
    console.log(`🎯 Test sayısı: ${this.testCases.length}`);
    console.log("");

    const results: TestResult[] = [];

    for (const testCase of this.testCases) {
      const result = await this.runTest(testCase);
      results.push(result);

      // Test arası kısa bekleme (rate limit için)
      await this.sleep(2000);
    }

    this.printSummary(results);
  }

  private async runTest(testCase: TestCase): Promise<TestResult> {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`📋 ${testCase.name}`);
    console.log(`📄 Dosya: ${testCase.file}`);
    console.log(`📝 Not: ${testCase.notes}`);
    console.log("-".repeat(80));

    const startTime = Date.now();

    try {
      // Dosyayı oku
      const filePath = path.join(this.FIXTURES_DIR, testCase.file);
      const text = fs.readFileSync(filePath, "utf-8");

      console.log(`📏 Metin uzunluğu: ${text.length} karakter`);

      // API'ye gönder
      console.log("🔄 Basic extraction API'ye gönderiliyor...");
      const response = await fetch(`${this.API_BASE}/api/ai/extract-basic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const result = await response.json();
      const duration = Date.now() - startTime;

      if (!result.success) {
        console.error("❌ API Hatası:", result.error);
        return {
          testCase: testCase.name,
          success: false,
          duration,
          data: null,
          confidence: 0,
          fieldsExtracted: [],
          fieldsMissing: Object.keys(testCase.expectedFields),
          warnings: []
        };
      }

      const data = result.data;
      const confidence = data.guven_skoru || 0;

      // Çıkarılan ve eksik alanları tespit et
      const fieldsExtracted: string[] = [];
      const fieldsMissing: string[] = [];

      Object.entries(testCase.expectedFields).forEach(([field, expected]) => {
        const value = data[field];
        const isExtracted = value !== null && value !== undefined && value !== "";

        if (expected && isExtracted) {
          fieldsExtracted.push(field);
        } else if (expected && !isExtracted) {
          fieldsMissing.push(field);
        }
      });

      // Sonuçları göster
      console.log("\n📊 SONUÇLAR:");
      console.log(`   Süre: ${duration}ms`);
      console.log(`   Güven Skoru: ${(confidence * 100).toFixed(1)}%`);
      console.log(`   Çıkarılan Alanlar (${fieldsExtracted.length}/${Object.keys(testCase.expectedFields).length}):`);

      console.log("\n   📋 Çıkarılan Veriler:");
      console.log(`      • Kurum: ${data.kurum || "YOK"}`);
      console.log(`      • Kişi Sayısı: ${data.kisi_sayisi || "YOK"}`);
      console.log(`      • Öğün Sayısı: ${data.ogun_sayisi || "YOK"}`);
      console.log(`      • Gün Sayısı: ${data.gun_sayisi || "YOK"}`);
      console.log(`      • Tahmini Bütçe: ${data.tahmini_butce ? data.tahmini_butce.toLocaleString() + " TL" : "YOK"}`);
      console.log(`      • Teslim Süresi: ${data.teslim_suresi || "YOK"}`);

      if (fieldsMissing.length > 0) {
        console.log(`\n   ⚠️  Eksik Alanlar: ${fieldsMissing.join(", ")}`);
      }

      if (result.warnings && result.warnings.length > 0) {
        console.log(`\n   ⚠️  Uyarılar (${result.warnings.length}):`);
        result.warnings.forEach((w: any, i: number) => {
          console.log(`      ${i + 1}. [${w.severity}] ${w.field}: ${w.message}`);
        });
      }

      // Context analysis varsa göster
      if (data.context_analysis) {
        console.log(`\n   🔍 Context Analysis:`);
        console.log(`      • Personel tespit: ${data.context_analysis.personnel_detected?.join(", ") || "Yok"}`);
        console.log(`      • Hizmet alan tespit: ${data.context_analysis.recipients_detected?.join(", ") || "Yok"}`);
        console.log(`      • Belirsiz: ${data.context_analysis.ambiguous_detected?.join(", ") || "Yok"}`);
      }

      const success = fieldsExtracted.length === Object.keys(testCase.expectedFields).length && confidence >= 0.75;

      if (success) {
        console.log("\n   ✅ TEST BAŞARILI (Tüm alanlar çıkarıldı, güven >= %75)");
      } else {
        console.log("\n   ⚠️  TEST KISMİ BAŞARILI (Bazı alanlar eksik veya düşük güven)");
      }

      return {
        testCase: testCase.name,
        success,
        duration,
        data,
        confidence,
        fieldsExtracted,
        fieldsMissing,
        warnings: result.warnings || []
      };

    } catch (error: any) {
      console.error("❌ Test hatası:", error.message);
      return {
        testCase: testCase.name,
        success: false,
        duration: Date.now() - startTime,
        data: null,
        confidence: 0,
        fieldsExtracted: [],
        fieldsMissing: Object.keys(testCase.expectedFields),
        warnings: []
      };
    }
  }

  private printSummary(results: TestResult[]) {
    console.log("\n\n" + "=".repeat(80));
    console.log("📊 GERÇEK DÜNYA TEST SONUÇ ÖZETİ");
    console.log("=".repeat(80));

    const totalTests = results.length;
    const successfulTests = results.filter(r => r.success).length;
    const partialTests = results.filter(r => !r.success && r.fieldsExtracted.length > 0).length;
    const failedTests = results.filter(r => r.fieldsExtracted.length === 0).length;

    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / totalTests;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / totalTests;

    console.log(`\n📈 İSTATİSTİKLER:`);
    console.log(`   Toplam Test: ${totalTests}`);
    console.log(`   ✅ Tam Başarılı: ${successfulTests} (%${Math.round(successfulTests / totalTests * 100)})`);
    console.log(`   ⚠️  Kısmi Başarılı: ${partialTests} (%${Math.round(partialTests / totalTests * 100)})`);
    console.log(`   ❌ Başarısız: ${failedTests} (%${Math.round(failedTests / totalTests * 100)})`);
    console.log(`   🎯 Ortalama Güven Skoru: %${(avgConfidence * 100).toFixed(1)}`);
    console.log(`   ⏱️  Ortalama Süre: ${avgDuration.toFixed(0)}ms`);

    console.log(`\n📋 DETAYLI SONUÇLAR:\n`);
    results.forEach((r, idx) => {
      const icon = r.success ? "✅" : r.fieldsExtracted.length > 0 ? "⚠️" : "❌";
      console.log(`${idx + 1}. ${icon} ${r.testCase}`);
      console.log(`   Güven: %${(r.confidence * 100).toFixed(1)} | Süre: ${r.duration}ms`);
      console.log(`   Çıkarılan: ${r.fieldsExtracted.join(", ") || "Hiç"}`);
      if (r.fieldsMissing.length > 0) {
        console.log(`   Eksik: ${r.fieldsMissing.join(", ")}`);
      }
      console.log("");
    });

    // Hedef karşılaştırması
    console.log("🎯 HEDEF KARŞILAŞTIRMASI:");
    console.log(`   Hedef Güven Skoru: %85-95`);
    console.log(`   Gerçekleşen: %${(avgConfidence * 100).toFixed(1)} ${avgConfidence >= 0.85 ? "✅" : avgConfidence >= 0.75 ? "⚠️" : "❌"}`);
    console.log(`   Hedef Başarı Oranı: %95+`);
    console.log(`   Gerçekleşen: %${Math.round(successfulTests / totalTests * 100)} ${successfulTests / totalTests >= 0.95 ? "✅" : "⚠️"}`);

    console.log("\n" + "=".repeat(80));
    console.log("✨ GERÇEK DÜNYA TESTLERİ TAMAMLANDI");
    console.log("=".repeat(80));

    // Exit code
    const overallSuccess = (successfulTests / totalTests) >= 0.75 && avgConfidence >= 0.75;
    process.exit(overallSuccess ? 0 : 1);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run tests
const tester = new RealWorldTester();
tester.runAllTests().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
