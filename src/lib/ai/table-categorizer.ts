import Anthropic from "@anthropic-ai/sdk";
import { ExtractedTable, TableCategory } from "@/types/ai";
import { logAIRequest, logAIResponse, logAIError } from "@/lib/ai-debug";

/**
 * 📊 AI-BASED TABLE CATEGORIZER
 *
 * Claude API kullanarak tablolarını akıllıca kategorize eder
 * - Tablo başlıklarını analiz eder
 * - Sütun başlıklarını (headers) kontrol eder
 * - İçeriği (rows) sample eder
 * - En uygun kategoriyi belirler
 */

interface CategorizationResult {
  categories: TableCategory[];
  confidence: number;
  reasoning?: string[];
}

export class TableCategorizer {
  private client: Anthropic;
  private model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is missing");
    }

    this.client = new Anthropic({ apiKey });
    this.model = process.env.DEFAULT_AI_MODEL || "claude-sonnet-4-20250514";

    console.log("=== TABLE CATEGORIZER INITIALIZED ===");
    console.log("Model:", this.model);
  }

  /**
   * Tabloları batch olarak kategorize et
   */
  async categorizeTables(tables: ExtractedTable[]): Promise<ExtractedTable[]> {
    if (tables.length === 0) {
      return [];
    }

    console.log(`\n📊 AI TABLO KATEGORİZASYONU BAŞLIYOR - ${tables.length} tablo`);
    const startTime = Date.now();

    // AI Debug logging
    logAIRequest("/ai/table-categorizer", {
      tableCount: tables.length,
      totalRows: tables.reduce((sum, t) => sum + t.satir_sayisi, 0)
    });

    try {
      // Batch boyutuna göre işle (rate limit için)
      const BATCH_SIZE = 20; // Claude API'ye aynı anda max 20 tablo göndermek güvenli
      const allCategorized: ExtractedTable[] = [];

      for (let i = 0; i < tables.length; i += BATCH_SIZE) {
        const batch = tables.slice(i, Math.min(i + BATCH_SIZE, tables.length));
        console.log(`\n📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(tables.length / BATCH_SIZE)}: ${batch.length} tablo kategorize ediliyor...`);

        const batchResult = await this.categorizeBatch(batch);
        allCategorized.push(...batchResult);

        // Batch arası kısa bekleme (rate limit için)
        if (i + BATCH_SIZE < tables.length) {
          console.log(`⏳ Rate limit için 1 saniye bekleniyor...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`\n✅ TABLO KATEGORİZASYONU TAMAMLANDI (${totalTime}ms, ${Math.round(totalTime / 1000)}s)`);

      // Kategori dağılımını göster
      const categoryDistribution = this.getCategoryDistribution(allCategorized);
      console.log("\n📊 KATEGORİ DAĞILIMI:");
      Object.entries(categoryDistribution).forEach(([cat, count]) => {
        console.log(`   ${cat}: ${count} tablo`);
      });

      // AI Debug logging
      logAIResponse("/ai/table-categorizer", {
        success: true,
        categorizedCount: allCategorized.length,
        categoryDistribution
      }, totalTime);

      return allCategorized;
    } catch (error) {
      console.error("❌ Table categorization error:", error);
      logAIError("/ai/table-categorizer", error);

      // Hata durumunda tablolara "other" kategorisi ata
      return tables.map(table => ({
        ...table,
        category: "other" as TableCategory
      }));
    }
  }

  /**
   * Tek bir batch'i kategorize et
   */
  private async categorizeBatch(tables: ExtractedTable[]): Promise<ExtractedTable[]> {
    const prompt = this.buildCategorizationPrompt(tables);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        temperature: 0.1, // Düşük temperature - tutarlı kategorizasyon için
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type");
      }

      const result = this.parseCategorizationResponse(content.text, tables.length);

      // Kategorileri tablolara ata
      return tables.map((table, index) => ({
        ...table,
        category: result.categories[index] || "other"
      }));
    } catch (error) {
      console.error("❌ Batch categorization error:", error);
      // Hata durumunda "other" kategorisi ata
      return tables.map(table => ({
        ...table,
        category: "other" as TableCategory
      }));
    }
  }

  /**
   * Claude için kategorizasyon prompt'u oluştur (BAŞLIK ODAKLI, VERİ KAYBETMEDEN)
   */
  private buildCategorizationPrompt(tables: ExtractedTable[]): string {
    // Her tablo için: başlık (ÖNEMLİ!) + TÜM headers (veri kaybetmeden) + daha fazla satır sample
    const tableDescriptions = tables.map((table, index) => {
      // İlk 3 satır + son 1 satır (pattern tespiti için)
      const firstRows = table.rows.slice(0, 3).map(row =>
        row.join(" | ")
      );
      const lastRow = table.rows.length > 3 ? table.rows[table.rows.length - 1].join(" | ") : "";

      const sampleData = [
        ...firstRows,
        table.rows.length > 4 ? "..." : "",
        lastRow
      ].filter(Boolean).join("\n     ");

      // TÜM HEADERS - veri kaybetmeden (çok önemli!)
      const allHeaders = table.headers.join(", ");

      return `${index + 1}. BAŞLIK: "${table.baslik}"
   ${table.headers.length} SÜTUN: [${allHeaders}]
   Örnek veri (${table.satir_sayisi} satır):
     ${sampleData}`;
    }).join("\n\n");

    return `🎯 GÖREV: İhale dokümanından çıkarılan ${tables.length} tabloyu BAŞLIK ve SÜTUN BAŞLIKLARINA göre kategorize et.

📋 KATEGORİLER (Başlık anahtar kelimeleri ile):

1. **organization** - Kuruluş & Dağılım
   🔍 Başlıkta: "kuruluş", "hastane", "okul", "merkez", "lokasyon", "şube", "adres", "yerler"
   🔍 Sütunlarda: "kuruluş adı", "lokasyon", "adres", "kişi sayısı", "toplam"
   ✅ Örnek: "Kuruluş Öğün Dağılımı", "Hizmet Verilecek Yerler", "Hastane Listesi"

2. **meals** - Öğün & Menu
   🔍 Başlıkta: "öğün", "kahvaltı", "öğle", "akşam", "menu", "yemek çeşidi"
   🔍 Sütunlarda: "kahvaltı", "öğle yemeği", "akşam yemeği", "günlük öğün"
   ✅ Örnek: "Günlük Öğün Sayıları", "Haftalık Menu Planı"

3. **quantities** - Gramaj & Porsiyon
   🔍 Başlıkta: "gramaj", "porsiyon", "miktar", "ölçü", "gr", "ml", "litre"
   🔍 Sütunlarda: "gramaj", "miktar", "porsiyon büyüklüğü", "gr", "ml"
   ✅ Örnek: "Yemek Gramajları", "Porsiyon Tablosu", "Ana Yemek 250 gr"

4. **materials** - Malzeme & Ürün
   🔍 Başlıkta: "malzeme", "ürün", "hammadde", "gıda", "yiyecek", "içecek"
   🔍 Sütunlarda: "malzeme adı", "ürün", "cinsi", "özellik"
   ✅ Örnek: "Malzeme Listesi", "Kullanılacak Ürünler", "Gıda Maddeleri"

5. **personnel** - Personel & Kadro
   🔍 Başlıkta: "personel", "kadro", "çalışan", "aşçı", "garson", "eleman", "nitelik"
   🔍 Sütunlarda: "pozisyon", "unvan", "sayı", "nitelik", "maaş", "ücret"
   ✅ Örnek: "Personel İhtiyacı", "Kadro Dağılımı", "Aşçı Sayısı"

6. **financial** - Maliyet & Bütçe
   🔍 Başlıkta: "maliyet", "bütçe", "fiyat", "ücret", "tutar", "TL", "birim fiyat"
   🔍 Sütunlarda: "fiyat", "tutar", "TL", "birim fiyat", "toplam maliyet"
   ✅ Örnek: "Tahmini Maliyet", "Birim Fiyat Listesi", "Bütçe Dağılımı"

7. **schedule** - Süre & Takvim
   🔍 Başlıkta: "süre", "tarih", "takvim", "gün", "ay", "yıl", "dönem"
   🔍 Sütunlarda: "başlangıç", "bitiş", "süre", "tarih"
   ✅ Örnek: "İhale Süresi", "365 Gün", "Teslim Tarihleri"

8. **equipment** - Ekipman & Araç-Gereç
   🔍 Başlıkta: "ekipman", "araç", "gereç", "cihaz", "malzeme" (teknik)
   🔍 Sütunlarda: "ekipman adı", "cihaz", "araç", "adet", "özellik"
   ✅ Örnek: "Mutfak Ekipmanları", "Araç-Gereç Listesi"

9. **summary** - Özet & Toplam
   🔍 Başlıkta: "özet", "toplam", "genel", "istatistik", "toplu"
   🔍 Sütunlarda: "toplam", "genel toplam", "ara toplam"
   ✅ Örnek: "İhale Özet Bilgileri", "Genel Toplam"

10. **technical** - Teknik Şartlar
    🔍 Başlıkta: "teknik", "standart", "özellik", "sertifika", "hijyen", "ISO"
    🔍 Sütunlarda: "standart", "özellik", "gereksinim"
    ✅ Örnek: "Teknik Özellikler", "ISO Gereksinimleri"

11. **other** - Diğer
    ⚠️ Sadece yukarıdaki kategorilere HIÇBIR ŞEKİLDE uymayan tablolar için kullan

📊 ANALİZ EDİLECEK TABLOLAR:

${tableDescriptions}

⚡ BAŞLIK ODAKLI KATEGORİZASYON KURALLARI:

🎯 ÖNCELİK SIRASI (VERİ KAYBETMEDEN):
1. **BAŞLIK** - En önemli! Başlıktaki anahtar kelimelere DİKKAT
2. **SÜTUN BAŞLIKLARI** - TÜM sütun başlıklarını oku, veri kaybetme
3. **ÖRNEK VERİ** - Veri içeriğine bak, pattern yakala

🔍 KATEGORİ SEÇME STRATEJİSİ:
- Başlıkta birden fazla kategori ipucu varsa → EN BASKINI seç
- "Kuruluş Öğün Dağılımı" → **organization** (kuruluş dağılımı ana tema)
- "Kahvaltı Gramajları" → **quantities** (gramaj ana tema)
- "Personel Maliyet Tablosu" → **personnel** (personel ana tema)
- "Ekipman Fiyat Listesi" → **equipment** (ekipman ana tema)

⚠️ VERİ KAYBINI ÖNLE:
- Sütun başlıklarındaki bilgiyi GÖZ ARDI ETME
- Örnek: ["Kuruluş", "Kahvaltı", "Öğle", "Akşam", "Toplam"]
  → **organization** (ilk sütun "Kuruluş", kuruluş dağılımı)
- Örnek: ["Yemek Adı", "Ana Yemek (gr)", "Çorba (ml)", "Pilav (gr)"]
  → **quantities** (gramaj bilgisi baskın)

🚫 "other" KATEGORİSİNİ KULLANMA:
- Sadece gerçekten kategorize edilemeyen tablolar için
- Mümkün olduğunca spesifik kategori seç

📋 CEVAP FORMATI (SADECE JSON):

{
  "categories": ["organization", "meals", "quantities", ...],
  "confidence": 0.95,
  "reasoning": [
    "Tablo 1: organization - Kuruluş dağılımı tablosu",
    "Tablo 2: meals - Öğün sayıları ve dağılımı",
    ...
  ]
}

⚠️ KRİTİK:
- "categories" arrayinde TAM OLARAK ${tables.length} eleman olmalı
- Her eleman yukarıdaki kategorilerden BİRİ olmalı
- Sıralama tablolarla AYNI OLMALI (1. tablo → categories[0])
- Sadece JSON döndür, açıklama yapma

🚀 ŞİMDİ BAŞLA!`;
  }

  /**
   * Claude'un response'unu parse et
   */
  private parseCategorizationResponse(responseText: string, expectedCount: number): CategorizationResult {
    try {
      // JSON extraction
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validation
      if (!parsed.categories || !Array.isArray(parsed.categories)) {
        throw new Error("Invalid categories format");
      }

      if (parsed.categories.length !== expectedCount) {
        console.warn(`⚠️ Category count mismatch: expected ${expectedCount}, got ${parsed.categories.length}`);
      }

      // Fallback: eksik kategorileri "other" ile doldur
      while (parsed.categories.length < expectedCount) {
        parsed.categories.push("other");
      }

      return {
        categories: parsed.categories as TableCategory[],
        confidence: parsed.confidence || 0.85,
        reasoning: parsed.reasoning || []
      };
    } catch (error) {
      console.error("❌ Failed to parse categorization response:", error);
      console.error("Response text:", responseText);

      // Fallback: tüm tablolara "other" ata
      return {
        categories: Array(expectedCount).fill("other") as TableCategory[],
        confidence: 0.5,
        reasoning: []
      };
    }
  }

  /**
   * Kategori dağılımını hesapla
   */
  private getCategoryDistribution(tables: ExtractedTable[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    tables.forEach(table => {
      const category = table.category || "other";
      distribution[category] = (distribution[category] || 0) + 1;
    });

    return distribution;
  }
}

/**
 * Singleton instance
 */
let categorizerInstance: TableCategorizer | null = null;

export function getTableCategorizer(): TableCategorizer {
  if (!categorizerInstance) {
    categorizerInstance = new TableCategorizer();
  }
  return categorizerInstance;
}

/**
 * Convenience function - tabloları kategorize et
 */
export async function categorizeTables(tables: ExtractedTable[]): Promise<ExtractedTable[]> {
  const categorizer = getTableCategorizer();
  return categorizer.categorizeTables(tables);
}
