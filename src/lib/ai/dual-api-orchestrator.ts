import { TextExtractionProvider } from "./text-extraction-provider";
import { TableExtractionProvider } from "./table-extraction-provider";
import { TableDetector } from "../utils/table-detector";
import { ExtractedData } from "@/types/ai";
import { categorizeTables } from "./table-categorizer";

/**
 * Dual API Orchestrator - İki API'yi koordine eder
 * Text API: Genel bilgiler (kurum, tarihler, şartlar)
 * Table API: Sayısal veriler (kişi sayısı, öğün, tablolar)
 */
export class DualAPIOrchestrator {
  private textProvider: TextExtractionProvider;
  private tableProvider: TableExtractionProvider;

  constructor() {
    this.textProvider = new TextExtractionProvider();
    this.tableProvider = new TableExtractionProvider();
  }

  /**
   * Ana orchestration metodu - paralel çalıştır, birleştir
   */
  async extract(fullText: string): Promise<ExtractedData> {
    console.log("=== DUAL API ORCHESTRATION BAŞLADI ===");
    console.log("Full text length:", fullText.length);

    const startTime = Date.now();

    // 1. Tablo tespit et
    const tableDetection = TableDetector.detectTables(fullText);
    console.log("📊 Tablo tespiti:");
    console.log(`  - Tablo var mı? ${tableDetection.hasTables ? "EVET" : "HAYIR"}`);
    console.log(`  - Tablo sayısı: ${tableDetection.tableCount}`);
    console.log(`  - Güven: ${Math.round(tableDetection.confidence * 100)}%`);

    // 2. YENİ YAKLAŞIM: TÜM METNİ HER İKİ API'YE GÖNDER
    // Claude: Metinsel veri havuzu çıkarımı (tablo olmayan bilgiler)
    // Gemini: Sadece tabloları bulup monospace formatla çıkar
    const tableText = fullText;
    const regularText = fullText;

    console.log(`  ✅ Text API'ye giden: ${regularText.length} karakter (Veri Havuzu)`);
    console.log(`  ✅ Table API'ye giden: ${tableText.length} karakter (Tablo Arama)`);

    // 3. İki API'yi PARALEL çalıştır
    console.log("\n🚀 İki API paralel başlatılıyor...");

    const [textResult, tableResult] = await Promise.allSettled([
      // Text API: DAIMA çalışır - Metinsel veri havuzu çıkarımı
      this.textProvider.extractTextData(regularText),

      // Table API: Tablo varsa çalışır
      tableDetection.hasTables && tableText.length > 50
        ? this.tableProvider.extractTables(tableText)
        : Promise.resolve(null),
    ]);

    const extractionTime = Date.now() - startTime;

    // 4. Sonuçları kontrol et
    const textData = textResult.status === "fulfilled" ? textResult.value : null;
    const tableData = tableResult.status === "fulfilled" ? tableResult.value : null;

    if (!textData) {
      console.error("⚠️ Text API başarısız!");
      console.error(textResult.status === "rejected" ? textResult.reason : "Unknown error");
    }

    if (tableDetection.hasTables && !tableData) {
      console.warn("⚠️ Table API başarısız, fallback gerekli");
    }

    console.log("\n✅ API sonuçları:");
    console.log(`  - Text API: ${textData ? "BAŞARILI" : "BAŞARISIZ"}`);
    console.log(`  - Table API: ${tableData ? "BAŞARILI" : tableDetection.hasTables ? "BAŞARISIZ" : "ÇALIŞMADI"}`);

    // 5. Sonuçları birleştir
    const mergedData = await this.mergeResults(textData, tableData, tableDetection);

    console.log("\n📦 Birleştirme tamamlandı:");
    console.log(`  - Kişi sayısı: ${mergedData.kisi_sayisi || "NULL"}`);
    console.log(`  - Bütçe: ${mergedData.tahmini_butce || "NULL"}`);
    console.log(`  - Özel şartlar: ${mergedData.ozel_sartlar?.length || 0}`);
    console.log(`  - Riskler: ${mergedData.riskler?.length || 0}`);
    console.log(`  - İşleme süresi: ${extractionTime}ms`);

    return mergedData;
  }

  /**
   * İki API sonucunu birleştir - öncelik kuralları uygula
   */
  private async mergeResults(
    textData: any,
    tableData: any,
    tableDetection: any
  ): Promise<ExtractedData> {
    console.log("\n🔀 Sonuçlar birleştiriliyor...");

    // Base data - text API'den
    const merged: any = {
      ...(textData || {}),
    };

    // YENİ: Veri Havuzu ve Tablolar ekleniyor
    if (textData?.veri_havuzu) {
      merged.veri_havuzu = textData.veri_havuzu;
      console.log("  ✅ Veri Havuzu eklendi");
      console.log(`    - ham_metin: ${textData.veri_havuzu.ham_metin?.length || 0} karakter`);
      console.log(`    - kaynaklar: ${Object.keys(textData.veri_havuzu.kaynaklar || {}).length} adet`);
    }

    // Table API varsa, tabloları ekle
    if (tableData) {
      console.log("  ✅ Table API verileri ekleniyor...");

      // YENİ: Tablolar array'ini ekle VE KATEGORİZE ET
      if (tableData.tablolar && Array.isArray(tableData.tablolar)) {
        console.log(`    - ${tableData.tablolar.length} adet tablo bulundu, kategorize ediliyor...`);

        // 🚀 TABLO KATEGORİZASYONU - AI ile akıllı kategorizasyon
        const categorizedTables = await categorizeTables(tableData.tablolar);
        merged.tablolar = categorizedTables;

        // Kategorizasyon sonuçlarını logla
        console.log(`    ✅ Tablolar kategorize edildi:`);
        categorizedTables.forEach((tablo: any, i: number) => {
          console.log(`      Tablo ${i + 1}: [${tablo.category}] ${tablo.baslik} (${tablo.satir_sayisi} satır, güven: ${Math.round(tablo.guven * 100)}%)`);
        });
      }

      // ESKİ: Sayısal veriler - backward compatibility
      if (tableData.kisi_sayisi !== undefined && tableData.kisi_sayisi !== null) {
        merged.kisi_sayisi = tableData.kisi_sayisi;
        console.log(`    - kisi_sayisi: ${tableData.kisi_sayisi} (TABLE API)`);
      }

      if (tableData.personel_sayisi !== undefined && tableData.personel_sayisi !== null) {
        merged.personel_sayisi = tableData.personel_sayisi;
        console.log(`    - personel_sayisi: ${tableData.personel_sayisi} (TABLE API)`);
      }

      if (tableData.ogun_sayisi !== undefined && tableData.ogun_sayisi !== null) {
        merged.ogun_sayisi = tableData.ogun_sayisi;
        console.log(`    - ogun_sayisi: ${tableData.ogun_sayisi} (TABLE API)`);
      }

      if (tableData.gun_sayisi !== undefined && tableData.gun_sayisi !== null) {
        merged.gun_sayisi = tableData.gun_sayisi;
        console.log(`    - gun_sayisi: ${tableData.gun_sayisi} (TABLE API)`);
      }

      // Tablo bütçesi varsa ve text'teki yoksa
      if (tableData.tahmini_butce && !merged.tahmini_butce) {
        merged.tahmini_butce = tableData.tahmini_butce;
        console.log(`    - tahmini_butce: ${tableData.tahmini_butce} (TABLE API)`);
      }

      // Tablo detaylarını ekle
      if (tableData.tablo_detaylari) {
        merged.tablo_detaylari = tableData.tablo_detaylari;
      }

      // Table sources'ları birleştir
      if (tableData._table_sources) {
        merged._sources = [
          ...(merged._sources || []),
          ...tableData._table_sources,
        ];
      }
    }

    // Metadata ekle
    merged._extraction_metadata = {
      text_api_used: !!textData,
      table_api_used: !!tableData,
      tables_detected: tableDetection.hasTables,
      table_count: tableDetection.tableCount,
      table_confidence: tableDetection.confidence,
      extraction_method: tableData ? "dual-api" : "text-only",
    };

    // Güven skoru hesapla
    const textConfidence = textData?.guven_skoru || 0.7;
    const tableConfidence = tableData?.guven_skoru || 0.8;

    if (tableData) {
      // Table API kullanıldıysa weighted average
      merged.guven_skoru = (textConfidence * 0.4 + tableConfidence * 0.6);
    } else {
      merged.guven_skoru = textConfidence;
    }

    console.log(`  📊 Final güven skoru: ${Math.round(merged.guven_skoru * 100)}%`);

    return merged as ExtractedData;
  }

  /**
   * Fallback: Tek API ile deneme (table API başarısızsa)
   */
  async extractWithFallback(fullText: string): Promise<ExtractedData> {
    try {
      return await this.extract(fullText);
    } catch (error) {
      console.error("⚠️ Dual API başarısız, fallback kullanılıyor...");
      console.error(error);

      // Fallback: Sadece text API
      try {
        const textData = await this.textProvider.extractTextData(fullText);
        return {
          ...textData,
          _extraction_metadata: {
            text_api_used: true,
            table_api_used: false,
            extraction_method: "fallback-text-only",
          },
        } as ExtractedData;
      } catch (fallbackError) {
        console.error("❌ Fallback de başarısız!");
        throw fallbackError;
      }
    }
  }
}
