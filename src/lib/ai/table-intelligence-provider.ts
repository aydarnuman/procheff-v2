import Anthropic from "@anthropic-ai/sdk";
import { ExtractedTable } from "@/types/ai";

/**
 * Table Intelligence Response
 * Tablolardan çıkarılan kritik iş zekası bilgileri
 */
export interface TableIntelligence {
  // TARİHLER (tablolardan)
  ihale_tarihi?: string | null;
  teklif_son_tarih?: string | null;
  ise_baslama_tarih?: string | null;
  ihale_suresi?: string | null;

  // PERSONEL BİLGİLERİ
  personel_detaylari?: {
    toplam_personel?: number;
    pozisyonlar?: Array<{
      pozisyon: string;
      sayi: number;
      nitelik?: string; // "En az lise mezunu, 2 yıl deneyim"
      maas?: string; // "Asgari ücret + %20"
    }>;
  };

  // EKİPMAN VE MALZEMELER
  ekipman_listesi?: Array<{
    kategori: string; // "Mutfak Ekipmanları", "Giyim"
    urunler: Array<{
      ad: string;
      miktar?: string;
      ozellik?: string;
    }>;
  }>;

  // GRAMAJ VE MENÜ ANALİZİ
  menu_analizi?: {
    toplam_yemek_cesidi?: number;
    ortalama_gramaj?: string; // "Ana yemek: 200-250g, Çorba: 200ml"
    kritik_malzemeler?: string[]; // ["Kırmızı et minimum 150g", "Beyaz et 200g"]
    ozel_diyetler?: string[]; // ["Diyabetik menü", "Sebze ağırlıklı"]
  };

  // KURULUŞ DAĞILIMI
  kuruluslar?: Array<{
    ad: string;
    kisi_sayisi?: number;
    ogun_dagilimi?: {
      kahvalti?: number;
      ogle?: number;
      aksam?: number;
      toplam?: number;
    };
  }>;

  // MALİYET BİLGİLERİ (tablolarda varsa)
  maliyet_verileri?: {
    tahmini_butce?: number;
    birim_fiyatlar?: Array<{
      kalem: string;
      fiyat: string;
    }>;
  };

  // GÜVEN SKORU
  guven_skoru: number; // 0-1 arası

  // KAYNAK TABLOlar
  kaynak_tablolar: string[]; // Hangi tablolardan çıkarıldı
}

/**
 * Table Intelligence Provider
 * Claude kullanarak tablolardan iş zekası çıkarır
 */
export class TableIntelligenceProvider {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || "";
    this.model = process.env.DEFAULT_AI_MODEL || "claude-sonnet-4-20250514";

    console.log("=== TABLE INTELLIGENCE PROVIDER INIT ===");
    console.log("API Key exists:", !!this.apiKey);
    console.log("Model:", this.model);
  }

  /**
   * Tablolardan kritik iş zekası bilgilerini çıkar
   */
  async extractIntelligence(
    tables: ExtractedTable[]
  ): Promise<TableIntelligence> {
    if (!tables || tables.length === 0) {
      console.log("⚠️ No tables to analyze");
      return {
        guven_skoru: 0,
        kaynak_tablolar: [],
      };
    }

    console.log(`=== TABLE INTELLIGENCE EXTRACTION ===`);
    console.log(`Analyzing ${tables.length} tables...`);

    const client = new Anthropic({ apiKey: this.apiKey });

    const prompt = this.buildIntelligencePrompt(tables);
    const estimatedTokens = Math.ceil(prompt.length / 4); // Rough token estimate
    console.log(`📊 CSV Format Token Count: ~${estimatedTokens.toLocaleString()} tokens`);

    try {
      const response = await client.messages.create({
        model: this.model,
        max_tokens: 8000,
        temperature: 0.3, // Düşük temperature - faktlara odaklan
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const content =
        response.content[0]?.type === "text"
          ? response.content[0].text
          : "";

      // JSON temizleme
      let cleanedContent = content.trim();
      if (cleanedContent.startsWith("```json")) {
        cleanedContent = cleanedContent
          .replace(/^```json\s*/, "")
          .replace(/```\s*$/, "");
      } else if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent
          .replace(/^```\s*/, "")
          .replace(/```\s*$/, "");
      }

      const intelligence = JSON.parse(cleanedContent) as TableIntelligence;

      console.log("✅ Table intelligence extracted successfully");
      console.log(
        `   - Tarihler: ${intelligence.ihale_tarihi ? "✓" : "✗"}`
      );
      console.log(
        `   - Personel: ${intelligence.personel_detaylari ? "✓" : "✗"}`
      );
      console.log(
        `   - Ekipman: ${intelligence.ekipman_listesi ? "✓" : "✗"}`
      );
      console.log(
        `   - Menü: ${intelligence.menu_analizi ? "✓" : "✗"}`
      );
      console.log(
        `   - Kuruluşlar: ${intelligence.kuruluslar ? "✓" : "✗"}`
      );
      console.log(`   - Güven: ${Math.round(intelligence.guven_skoru * 100)}%`);

      return intelligence;
    } catch (error: any) {
      console.error("Table intelligence extraction error:", error);
      throw error;
    }
  }

  /**
   * Tabloları CSV formatına çevir (10x daha az token!)
   */
  private tablesToCSV(tables: ExtractedTable[]): string {
    return tables
      .map((table, idx) => {
        // CSV satırları: başlık + veriler
        const csvRows = [table.headers.join(",")];
        table.rows.forEach((row) => {
          // Virgül içeren değerleri tırnak içine al
          const escapedRow = row.map(cell =>
            cell.includes(",") ? `"${cell}"` : cell
          );
          csvRows.push(escapedRow.join(","));
        });

        return `### TABLO ${idx + 1}: ${table.baslik}\n${csvRows.join("\n")}`;
      })
      .join("\n\n");
  }

  private buildIntelligencePrompt(tables: ExtractedTable[]): string {
    // ✅ CSV FORMAT (10x daha az token!)
    const formattedTables = this.tablesToCSV(tables);

    return `Sen bir kamu ihalesi veri analisti ve tablo uzmanısın.

🎯 GÖREV: Aşağıdaki tablolardan KRİTİK İŞ ZEKASI BİLGİLERİNİ çıkar.

# TABLOLAR (CSV FORMAT):
${formattedTables}

📝 NOT: Tablolar CSV formatında verilmiştir. Her satır virgülle ayrılmış değerler içerir.
İlk satır başlıklar, sonraki satırlar veridir.

# ÇIKARILACAK BİLGİLER:

## 1️⃣ TARİHLER
Tablolarda şunları ara:
- "İhale Tarihi", "İlan Tarihi", "Düzenleme Tarihi"
- "Teklif Son Tarihi", "Son Başvuru"
- "İşe Başlama", "Başlama Tarihi"
- "İhale Süresi", "Sözleşme Süresi", "Gün Sayısı"

Format: "15.01.2025" veya "30.01.2025 14:00"

## 2️⃣ PERSONEL BİLGİLERİ
Tablolarda personel tablosu var mı?
- Pozisyon adları (Aşçı, Aşçı Yardımcısı, Servis Personeli, vb.)
- Her pozisyon için sayı
- Nitelikler (eğitim, deneyim, sertifika)
- Maaş bilgileri (varsa)

## 3️⃣ EKİPMAN VE MALZEMELER
"Yüklenicinin temin edeceği" tablolarını ara:
- Mutfak ekipmanları (tencere, tava, bıçak seti, vb.)
- Giyim malzemeleri (önlük, bone, eldiven, vb.)
- Temizlik malzemeleri
- Her ürün için miktar ve özellik

## 4️⃣ GRAMAJ VE MENÜ ANALİZİ
Menü tablolarını ara:
- Kaç farklı yemek çeşidi var?
- Gramaj bilgileri (ana yemek, çorba, salata, tatlı)
- Kritik malzemeler (kırmızı et, beyaz et, balık, vb.)
- Özel diyetler (diyabetik, vejetaryen, vb.)

## 5️⃣ KURULUŞ DAĞILIMI
"Öğün sayıları", "Dağılım" tablolarını ara:
- Kuruluş adları (Huzurevi, Çocuk Evleri, vb.)
- Her kuruluş için kişi sayısı
- Öğün dağılımı (Kahvaltı, Öğle, Akşam, Toplam)

## 6️⃣ MALİYET BİLGİLERİ
Fiyat/bütçe tabloları var mı?
- Tahmini toplam bütçe
- Birim fiyatlar (varsa)

# ÇIKTI FORMATI (SADECE JSON):

{
  "ihale_tarihi": "15.01.2025" veya null,
  "teklif_son_tarih": "30.01.2025 14:00" veya null,
  "ise_baslama_tarih": "01.02.2025" veya null,
  "ihale_suresi": "365 gün" veya "12 ay" veya null,

  "personel_detaylari": {
    "toplam_personel": 11,
    "pozisyonlar": [
      {
        "pozisyon": "Aşçı",
        "sayi": 3,
        "nitelik": "En az ilkokul mezunu, 2 yıl deneyimli",
        "maas": "Asgari ücret + %20"
      }
    ]
  },

  "ekipman_listesi": [
    {
      "kategori": "Mutfak Ekipmanları",
      "urunler": [
        {
          "ad": "Tencere seti",
          "miktar": "1 takım",
          "ozellik": "Paslanmaz çelik, 5 parça"
        }
      ]
    }
  ],

  "menu_analizi": {
    "toplam_yemek_cesidi": 68,
    "ortalama_gramaj": "Ana yemek: 200-250g, Çorba: 200ml",
    "kritik_malzemeler": [
      "Kırmızı et minimum 150g (dana/kuzu)",
      "Beyaz et 200g (tavuk/hindi)"
    ],
    "ozel_diyetler": ["Diyabetik menü", "Sebze ağırlıklı seçenek"]
  },

  "kuruluslar": [
    {
      "ad": "Huzurevi Yaşlı Bakım ve Rehabilitasyon Merkezi",
      "kisi_sayisi": 6,
      "ogun_dagilimi": {
        "kahvalti": 6,
        "ogle": 6,
        "aksam": 6,
        "toplam": 18
      }
    }
  ],

  "maliyet_verileri": {
    "tahmini_butce": 2850000,
    "birim_fiyatlar": [
      {
        "kalem": "Ana yemek (kişi başı)",
        "fiyat": "45 TL"
      }
    ]
  },

  "guven_skoru": 0.85,
  "kaynak_tablolar": [
    "TABLO 1: Kuruluş Dağılımı",
    "TABLO 6: Personel Tablosu",
    "TABLO 13: Ekipman Listesi"
  ]
}

⚠️ ÖNEMLİ KURALLAR:
1. Sadece tablolarda GÖRDÜKLERİNİ yaz - tahmin etme!
2. Bir bilgi yoksa → null yaz
3. Tarih formatlarını koru (15.01.2025 gibi)
4. Sayıları number olarak yaz (string değil)
5. Güven skorunu gerçekçi belirle (tüm bilgiler varsa 0.9, eksikler varsa daha düşük)
6. kaynak_tablolar'a hangi tabloları kullandığını yaz

SADECE JSON yanıtı ver, açıklama ekleme!`;
  }
}