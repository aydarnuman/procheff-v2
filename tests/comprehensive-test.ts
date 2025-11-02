/**
 * KAPSAMLI SİSTEM TESTLERİ
 *
 * Bu test sistemi farklı zorluk seviyelerinde ihaleleri test eder:
 *
 * TIER 1 - TEMEL (Mevcut testler):
 * - İhale 1: Huzurevi (275 kişi)
 * - İhale 2: Okul (450 kişi)
 * - İhale 3: Hastane (2.050 kişi/gün)
 * - İhale 4: Kreş (35 kişi)
 *
 * TIER 2 - ORTA (Yeni testler):
 * - İhale 5: Askeri (5.900 kişi/gün, 8 lokasyon)
 * - İhale 6: Çok Lokasyon (5.669 kişi, 43 tesis, 17 il)
 * - İhale 7: Üniversite (27.420 öğrenci, mevsimsel değişkenlik)
 *
 * TIER 3 - ZORLAYICI (Challenge testler):
 * - İhale 8: Dev Hastane (35.000 öğün/gün, 150K+ karakter, 50+ diyet tipi)
 *
 * Her test sistemin farklı yeteneklerini kontrol eder:
 * - Basit sayı çıkarımı (Tier 1)
 * - Karmaşık personel vs kişi ayrımı (Tier 1-2)
 * - Çoklu lokasyon toplama (Tier 2)
 * - Mevsimsel hesaplamalar (Tier 2)
 * - Günlük ortalama pattern'i (Tier 1-3)
 * - Büyük dosya işleme (Tier 3)
 * - Çok sayıda diyet tipi (Tier 3)
 */

import fs from "fs";
import path from "path";

interface TestCase {
  tier: 1 | 2 | 3;
  name: string;
  file: string;
  expectedFields: {
    kurum: boolean;
    kisi_sayisi: boolean;
    ogun_sayisi: boolean;
    gun_sayisi: boolean;
    tahmini_butce: boolean;
  };
  challenges: string[]; // Bu test ne tür zorluklar içeriyor
  notes: string;
}

interface TestResult {
  testCase: string;
  tier: number;
  success: boolean;
  duration: number;
  data: any;
  confidence: number;
  fieldsExtracted: string[];
  fieldsMissing: string[];
  warnings: any[];
  challenges: string[];
}

class ComprehensiveTester {
  private readonly API_BASE = "http://localhost:3000";
  private readonly FIXTURES_DIR = path.join(__dirname, "fixtures");

  private testCases: TestCase[] = [
    // ========================================
    // TIER 1: TEMEL TESTLER (Mevcut)
    // ========================================
    {
      tier: 1,
      name: "Tier 1.1: Huzurevi + Çocuk Evi + Kadın Konukevi",
      file: "ihale-1-huzurevi.txt",
      expectedFields: {
        kurum: true,
        kisi_sayisi: true,  // 275 kişi TOPLAM
        ogun_sayisi: true,  // 3 öğün
        gun_sayisi: true,   // 365 gün
        tahmini_butce: true // 3.500.000 TL
      },
      challenges: [
        "Personel vs Kişi Ayrımı (7 personel vs 275 kişi)",
        "Çoklu Lokasyon Toplama (3 tesis)",
        "KDV Dahil/Hariç Tespiti"
      ],
      notes: "Temel test: Çoklu lokasyon, personel ayrımı"
    },
    {
      tier: 1,
      name: "Tier 1.2: Yatılı Okul",
      file: "ihale-2-okul.txt",
      expectedFields: {
        kurum: true,
        kisi_sayisi: true,  // 450 öğrenci
        ogun_sayisi: true,  // 3 öğün
        gun_sayisi: true,   // 180 gün
        tahmini_butce: true // 2.800.000 TL
      },
      challenges: [
        "Personel vs Öğrenci Ayrımı (20 personel vs 450 öğrenci)",
        "Okul Dönemi Gün Sayısı (180 gün)",
        "KDV Hariç Bütçe"
      ],
      notes: "Temel test: Eğitim kurumu, mevsimsel"
    },
    {
      tier: 1,
      name: "Tier 1.3: Şehir Hastanesi",
      file: "ihale-3-hastane.txt",
      expectedFields: {
        kurum: true,
        kisi_sayisi: true,  // 2.050 kişi/gün
        ogun_sayisi: true,  // 3-4 öğün
        gun_sayisi: true,   // 365 gün
        tahmini_butce: true // 12.500.000 TL
      },
      challenges: [
        "Kişi/Gün Pattern (2.050 kişi/gün günlük ortalama)",
        "Personel vs Hasta Ayrımı (96 personel vs 2.050 hasta/gün)",
        "Değişken Öğün Sayısı",
        "Yüksek Kişi Sayısı"
      ],
      notes: "Kritik test: kişi/gün pattern, büyük ölçek"
    },
    {
      tier: 1,
      name: "Tier 1.4: Küçük Kreş",
      file: "ihale-4-kucuk.txt",
      expectedFields: {
        kurum: true,
        kisi_sayisi: true,  // 35 çocuk
        ogun_sayisi: true,  // 2 öğün
        gun_sayisi: true,   // 240 gün
        tahmini_butce: true // 180.000 TL
      },
      challenges: [
        "Küçük Ölçekli Tesis",
        "Hafta İçi Hizmet (240 gün)",
        "Düşük Bütçe Tespiti"
      ],
      notes: "Temel test: Küçük ölçek, basit yapı"
    },

    // ========================================
    // TIER 2: ORTA ZORLUK TESTLER (Yeni)
    // ========================================
    {
      tier: 2,
      name: "Tier 2.1: Askeri Birlik (8 Lokasyon)",
      file: "ihale-5-askeri.txt",
      expectedFields: {
        kurum: true,
        kisi_sayisi: true,  // 5.900 personel/gün (ortalama)
        ogun_sayisi: true,  // 3-4 öğün
        gun_sayisi: true,   // 365 gün
        tahmini_butce: true // 48.500.000 TL
      },
      challenges: [
        "Çoklu Lokasyon (8 üs)",
        "Ana + Tali + Mevsimlik Toplama",
        "Personel/Gün Pattern",
        "Mevsimsel Ek Kamplar",
        "Büyük Dosya (~15K karakter)"
      ],
      notes: "Orta test: Çok lokasyon, mevsimsel değişkenlik"
    },
    {
      tier: 2,
      name: "Tier 2.2: Çok Lokasyonlu (43 Tesis, 17 İl)",
      file: "ihale-6-cok-lokasyon.txt",
      expectedFields: {
        kurum: true,
        kisi_sayisi: true,  // 5.669 kişi (hizmet alan)
        ogun_sayisi: true,  // 3-4 öğün (tesis tipine göre)
        gun_sayisi: true,   // 365 gün
        tahmini_butce: true // 38.750.000 TL
      },
      challenges: [
        "ÇOK FAZLA Lokasyon (43 tesis)",
        "Bölgesel Dağılım (7 bölge)",
        "Personel vs Hizmet Alan Ayrımı (744 personel vs 5.669 kişi)",
        "Farklı Tesis Tipleri (5 tip)",
        "Büyük Dosya (~30K karakter)"
      ],
      notes: "Orta-Zor test: Türkiye çapında dağılım, çok lokasyon"
    },
    {
      tier: 2,
      name: "Tier 2.3: Üniversite (27K Öğrenci, Mevsimsel)",
      file: "ihale-7-universite.txt",
      expectedFields: {
        kurum: true,
        kisi_sayisi: true,  // 27.420 öğrenci
        ogun_sayisi: true,  // 3-4 öğün (yurtlu/gündüz)
        gun_sayisi: true,   // 365 gün
        tahmini_butce: true // 56.800.000 TL
      },
      challenges: [
        "Çok Yüksek Kişi Sayısı (27K)",
        "Mevsimsel Değişkenlik (dönem içi/yaz/ramazan)",
        "Personel vs Öğrenci Ayrımı (2.900 personel vs 27.420 öğrenci)",
        "Karmaşık Öğün Yapısı (hafta içi/sonu/yaz)",
        "Büyük Dosya (~20K karakter)"
      ],
      notes: "Orta-Zor test: Çok yüksek hacim, mevsimsel karmaşıklık"
    },

    // ========================================
    // TIER 3: ZORLAYICI TESTLER (Challenge)
    // ========================================
    {
      tier: 3,
      name: "Tier 3.1: DEV HASTANE (150K+ Karakter, 35K Öğün/Gün)",
      file: "ihale-8-dev-hastane-150k.txt",
      expectedFields: {
        kurum: true,
        kisi_sayisi: true,  // ~14.500 kişi/gün (hasta + refakatçi + ayakta + personel)
        ogun_sayisi: true,  // Değişken (hasta tipine göre)
        gun_sayisi: true,   // 365 gün
        tahmini_butce: true // 185.500.000 TL
      },
      challenges: [
        "ÇOK BÜYÜK DOSYA (150K+ karakter)",
        "11 Farklı Tesis",
        "50+ Farklı Diyet Tipi",
        "Çok Karmaşık Kişi Dağılımı (yatan/ayakta/refakatçi/personel)",
        "35.000 Öğün/Gün Kapasitesi",
        "Chunk Mekanizması Testi",
        "Timeout Riski",
        "Çok Detaylı Teknik Şartname"
      ],
      notes: "ZORLAYICI TEST: Maksimum karmaşıklık, büyük dosya, 115K chunk limiti testi"
    }
  ];

  async runAllTests(): Promise<void> {
    console.log("🌍 KAPSAMLI SİSTEM TESTLERİ");
    console.log("═".repeat(100));
    console.log(`📁 Fixtures klasörü: ${this.FIXTURES_DIR}`);
    console.log(`🎯 Toplam test sayısı: ${this.testCases.length}`);
    console.log(`   • Tier 1 (Temel): ${this.testCases.filter(t => t.tier === 1).length} test`);
    console.log(`   • Tier 2 (Orta): ${this.testCases.filter(t => t.tier === 2).length} test`);
    console.log(`   • Tier 3 (Zorlayıcı): ${this.testCases.filter(t => t.tier === 3).length} test`);
    console.log("");

    const results: TestResult[] = [];

    for (const testCase of this.testCases) {
      const result = await this.runTest(testCase);
      results.push(result);

      // Test arası bekleme (rate limit + AI işlem süresi)
      console.log("⏳ Sonraki test için 3 saniye bekleniyor...\n");
      await this.sleep(3000);
    }

    this.printSummary(results);
  }

  private async runTest(testCase: TestCase): Promise<TestResult> {
    console.log(`\n${"═".repeat(100)}`);
    console.log(`📋 ${testCase.name}`);
    console.log(`🏷️  Tier: ${testCase.tier} | 📄 Dosya: ${testCase.file}`);
    console.log(`💡 Zorluklar:`);
    testCase.challenges.forEach(c => console.log(`     - ${c}`));
    console.log(`📝 Not: ${testCase.notes}`);
    console.log("─".repeat(100));

    const startTime = Date.now();

    try {
      // Dosyayı oku
      const filePath = path.join(this.FIXTURES_DIR, testCase.file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Dosya bulunamadı: ${filePath}`);
      }

      const text = fs.readFileSync(filePath, "utf-8");
      const charCount = text.length;

      console.log(`📏 Metin uzunluğu: ${charCount.toLocaleString()} karakter`);
      if (charCount > 100000) {
        console.log(`⚠️  BÜYÜK DOSYA: 115K chunk limiti test edilecek`);
      }

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
          tier: testCase.tier,
          success: false,
          duration,
          data: null,
          confidence: 0,
          fieldsExtracted: [],
          fieldsMissing: Object.keys(testCase.expectedFields),
          warnings: [],
          challenges: testCase.challenges
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
      console.log(`   ⏱️  İşlem Süresi: ${duration}ms (${(duration / 1000).toFixed(1)}s)`);
      console.log(`   🎯 Güven Skoru: ${(confidence * 100).toFixed(1)}%`);
      console.log(`   ✅ Çıkarılan Alanlar: ${fieldsExtracted.length}/${Object.keys(testCase.expectedFields).length}`);

      console.log("\n   📋 Çıkarılan Veriler:");
      console.log(`      • Kurum: ${data.kurum || "❌ YOK"}`);
      console.log(`      • Kişi Sayısı: ${data.kisi_sayisi ? data.kisi_sayisi.toLocaleString("tr-TR") : "❌ YOK"}`);
      console.log(`      • Öğün Sayısı: ${data.ogun_sayisi || "❌ YOK"}`);
      console.log(`      • Gün Sayısı: ${data.gun_sayisi || "❌ YOK"}`);
      console.log(`      • Tahmini Bütçe: ${data.tahmini_butce ? data.tahmini_butce.toLocaleString("tr-TR") + " TL" : "❌ YOK"}`);

      // Reasoning göster (kısmi)
      if (data.reasoning && data.reasoning.kisi_sayisi_dusunce) {
        console.log(`\n   💭 Kişi Sayısı Düşüncesi:`);
        console.log(`      "${data.reasoning.kisi_sayisi_dusunce.substring(0, 200)}..."`);
      }

      if (fieldsMissing.length > 0) {
        console.log(`\n   ⚠️  Eksik Alanlar: ${fieldsMissing.join(", ")}`);
      }

      if (result.warnings && result.warnings.length > 0) {
        console.log(`\n   ⚠️  Uyarılar (${result.warnings.length}):`);
        result.warnings.forEach((w: any, i: number) => {
          console.log(`      ${i + 1}. [${w.severity}] ${w.field}: ${w.message.substring(0, 100)}...`);
        });
      }

      // Başarı değerlendirmesi
      const allFieldsExtracted = fieldsExtracted.length === Object.keys(testCase.expectedFields).length;
      const highConfidence = confidence >= 0.75;
      const success = allFieldsExtracted && highConfidence;

      if (success) {
        console.log("\n   ✅ TEST BAŞARILI (Tüm alanlar çıkarıldı, güven >= %75)");
      } else if (allFieldsExtracted && !highConfidence) {
        console.log("\n   ⚠️  TEST KISMEN BAŞARILI (Tüm alanlar çıkarıldı ama düşük güven)");
      } else if (!allFieldsExtracted && highConfidence) {
        console.log("\n   ⚠️  TEST KISMEN BAŞARILI (Yüksek güven ama bazı alanlar eksik)");
      } else {
        console.log("\n   ❌ TEST BAŞARISIZ (Eksik alanlar ve düşük güven)");
      }

      return {
        testCase: testCase.name,
        tier: testCase.tier,
        success,
        duration,
        data,
        confidence,
        fieldsExtracted,
        fieldsMissing,
        warnings: result.warnings || [],
        challenges: testCase.challenges
      };

    } catch (error: any) {
      console.error("❌ Test hatası:", error.message);
      return {
        testCase: testCase.name,
        tier: testCase.tier,
        success: false,
        duration: Date.now() - startTime,
        data: null,
        confidence: 0,
        fieldsExtracted: [],
        fieldsMissing: Object.keys(testCase.expectedFields),
        warnings: [],
        challenges: testCase.challenges
      };
    }
  }

  private printSummary(results: TestResult[]) {
    console.log("\n\n" + "═".repeat(100));
    console.log("📊 KAPSAMLI TEST SONUÇ ÖZETİ");
    console.log("═".repeat(100));

    const totalTests = results.length;
    const successfulTests = results.filter(r => r.success).length;
    const partialTests = results.filter(r => !r.success && r.fieldsExtracted.length > 0).length;
    const failedTests = results.filter(r => r.fieldsExtracted.length === 0).length;

    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / totalTests;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / totalTests;

    // Tier bazlı istatistikler
    const tier1Results = results.filter(r => r.tier === 1);
    const tier2Results = results.filter(r => r.tier === 2);
    const tier3Results = results.filter(r => r.tier === 3);

    const tier1Success = tier1Results.filter(r => r.success).length;
    const tier2Success = tier2Results.filter(r => r.success).length;
    const tier3Success = tier3Results.filter(r => r.success).length;

    console.log(`\n📈 GENEL İSTATİSTİKLER:`);
    console.log(`   Toplam Test: ${totalTests}`);
    console.log(`   ✅ Tam Başarılı: ${successfulTests} (%${Math.round(successfulTests / totalTests * 100)})`);
    console.log(`   ⚠️  Kısmi Başarılı: ${partialTests} (%${Math.round(partialTests / totalTests * 100)})`);
    console.log(`   ❌ Başarısız: ${failedTests} (%${Math.round(failedTests / totalTests * 100)})`);
    console.log(`   🎯 Ortalama Güven Skoru: %${(avgConfidence * 100).toFixed(1)}`);
    console.log(`   ⏱️  Ortalama Süre: ${avgDuration.toFixed(0)}ms (~${(avgDuration / 1000).toFixed(1)}s)`);

    console.log(`\n📊 TİER BAZLI BAŞARI ORANLARI:`);
    console.log(`   Tier 1 (Temel): ${tier1Success}/${tier1Results.length} (%${Math.round(tier1Success / tier1Results.length * 100)})`);
    console.log(`   Tier 2 (Orta): ${tier2Success}/${tier2Results.length} (%${Math.round(tier2Success / tier2Results.length * 100)})`);
    console.log(`   Tier 3 (Zorlayıcı): ${tier3Success}/${tier3Results.length} (%${Math.round(tier3Success / tier3Results.length * 100)})`);

    console.log(`\n📋 DETAYLI SONUÇLAR:\n`);
    results.forEach((r, idx) => {
      const icon = r.success ? "✅" : r.fieldsExtracted.length > 0 ? "⚠️" : "❌";
      const tierLabel = `Tier ${r.tier}`;
      console.log(`${idx + 1}. ${icon} [${tierLabel}] ${r.testCase}`);
      console.log(`   Güven: %${(r.confidence * 100).toFixed(1)} | Süre: ${r.duration}ms | Çıkarılan: ${r.fieldsExtracted.join(", ") || "Hiç"}`);
      if (r.fieldsMissing.length > 0) {
        console.log(`   ❌ Eksik: ${r.fieldsMissing.join(", ")}`);
      }
      if (r.challenges.length > 0) {
        console.log(`   💡 Zorluklar: ${r.challenges.slice(0, 2).join(", ")}${r.challenges.length > 2 ? "..." : ""}`);
      }
      console.log("");
    });

    // Hedef karşılaştırması
    console.log("🎯 HEDEF KARŞILAŞTIRMASI:");
    console.log(`   Hedef Güven Skoru: %85-95`);
    console.log(`   Gerçekleşen: %${(avgConfidence * 100).toFixed(1)} ${avgConfidence >= 0.85 ? "✅" : avgConfidence >= 0.75 ? "⚠️" : "❌"}`);
    console.log(`   Hedef Başarı Oranı: %90+ (tüm tier'ler)`);
    console.log(`   Gerçekleşen: %${Math.round(successfulTests / totalTests * 100)} ${successfulTests / totalTests >= 0.90 ? "✅" : successfulTests / totalTests >= 0.75 ? "⚠️" : "❌"}`);

    console.log(`\n   Tier 1 Hedef: %100`);
    console.log(`   Gerçekleşen: %${Math.round(tier1Success / tier1Results.length * 100)} ${tier1Success === tier1Results.length ? "✅" : "⚠️"}`);

    console.log(`   Tier 2 Hedef: %90+`);
    console.log(`   Gerçekleşen: %${Math.round(tier2Success / tier2Results.length * 100)} ${tier2Success / tier2Results.length >= 0.90 ? "✅" : "⚠️"}`);

    console.log(`   Tier 3 Hedef: %80+`);
    console.log(`   Gerçekleşen: %${Math.round(tier3Success / tier3Results.length * 100)} ${tier3Success / tier3Results.length >= 0.80 ? "✅" : "⚠️"}`);

    console.log("\n" + "═".repeat(100));
    console.log("✨ KAPSAMLI TESTLER TAMAMLANDI");
    console.log("═".repeat(100));

    // Exit code
    const tier1Pass = tier1Success === tier1Results.length;
    const tier2Pass = tier2Success / tier2Results.length >= 0.90;
    const tier3Pass = tier3Success / tier3Results.length >= 0.80;
    const overallPass = tier1Pass && tier2Pass && tier3Pass && avgConfidence >= 0.85;

    console.log(`\n🏁 SONUÇ: ${overallPass ? "✅ BAŞARILI" : "⚠️  GELİŞTİRME GEREKLİ"}`);
    if (!tier1Pass) console.log("   ⚠️  Tier 1 testleri %100 başarılı olmalı");
    if (!tier2Pass) console.log("   ⚠️  Tier 2 testleri %90+ başarılı olmalı");
    if (!tier3Pass) console.log("   ⚠️  Tier 3 testleri %80+ başarılı olmalı");
    if (avgConfidence < 0.85) console.log("   ⚠️  Ortalama güven skoru %85'in altında");

    process.exit(overallPass ? 0 : 1);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run tests
const tester = new ComprehensiveTester();
tester.runAllTests().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
