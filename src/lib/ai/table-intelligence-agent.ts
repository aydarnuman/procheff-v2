import Anthropic from "@anthropic-ai/sdk";
import { ExtractedTable, TableCategory } from "@/types/ai";
import { logAIRequest, logAIResponse, logAIError } from "@/lib/ai-debug";

/**
 * 🧠 TABLE INTELLIGENCE AGENT
 *
 * Kategorize edilmiş tabloları analiz edip yapılandırılmış intelligence'a dönüştürür
 * - Personel detaylarını çıkarır (pozisyon, maaş, nitelik)
 * - Ekipman listelerini düzenler
 * - Menu analizleri yapar
 * - Kuruluş dağılımlarını özetler
 * - Maliyet verilerini yapılandırır
 */

interface TableIntelligence {
  personel_detaylari?: {
    toplam_personel?: number;
    pozisyonlar?: Array<{
      pozisyon: string;
      sayi: number;
      nitelik?: string;
      maas?: string;
    }>;
  };
  ekipman_listesi?: Array<{
    kategori: string;
    urunler: Array<{
      ad: string;
      miktar?: string;
      ozellik?: string;
    }>;
  }>;
  menu_analizi?: {
    toplam_yemek_cesidi?: number;
    ortalama_gramaj?: string;
    kritik_malzemeler?: string[];
    ozel_diyetler?: string[];
  };
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
  maliyet_verileri?: {
    tahmini_butce?: number;
    birim_fiyatlar?: Array<{
      kalem: string;
      fiyat: string;
    }>;
  };
  // Tarih bilgileri (tablolardan çıkarılır)
  ihale_tarihi?: string;
  teklif_son_tarih?: string;
  ise_baslama_tarih?: string;
  ihale_suresi?: string;

  guven_skoru: number; // Required field
  kaynak_tablolar?: string[];
}

export class TableIntelligenceAgent {
  private client: Anthropic;
  private model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is missing");
    }

    this.client = new Anthropic({ apiKey });
    this.model = process.env.DEFAULT_AI_MODEL || "claude-sonnet-4-20250514";

    console.log("=== TABLE INTELLIGENCE AGENT INITIALIZED ===");
    console.log("Model:", this.model);
  }

  /**
   * Tabloları analiz et ve intelligence çıkar
   */
  async analyzeTableIntelligence(tables: ExtractedTable[]): Promise<TableIntelligence> {
      if (tables.length === 0) {
        return { guven_skoru: 1.0 }; // Default value for guven_skoru
    }

    console.log(`\n🧠 TABLE INTELLIGENCE BAŞLIYOR - ${tables.length} tablo analiz ediliyor`);
    const startTime = Date.now();

    logAIRequest("/ai/table-intelligence", {
      tableCount: tables.length,
      categories: this.getCategoryCounts(tables)
    });

    try {
      // Tabloları kategorilere göre grupla
      const groupedTables = this.groupTablesByCategory(tables);

      console.log("\n📊 KATEGORİ GRUPLARI:");
      Object.entries(groupedTables).forEach(([cat, tbls]) => {
        console.log(`   ${cat}: ${tbls.length} tablo`);
      });

      // AI prompt oluştur
      const prompt = this.buildIntelligencePrompt(groupedTables);

      // Claude'a gönder
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8192,
        temperature: 0.1, // Düşük temperature - kesin veri çıkarımı için
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

      let intelligence = this.parseIntelligenceResponse(content.text, tables);

      // 🆕 ENTITY RECONCILIATION (Nov 9, 2025)
      intelligence = this.reconcileEntities(intelligence);

      const totalTime = Date.now() - startTime;
      console.log(`\n✅ TABLE INTELLIGENCE TAMAMLANDI (${totalTime}ms, ${Math.round(totalTime / 1000)}s)`);

      // Intelligence özetini göster
      this.logIntelligenceSummary(intelligence);

      logAIResponse("/ai/table-intelligence", {
        success: true,
        intelligence
      }, totalTime);

      return intelligence;
    } catch (error) {
      console.error("❌ Table intelligence error:", error);
      logAIError("/ai/table-intelligence", error);
      return { guven_skoru: 0 };
    }
  }

  /**
   * Tabloları kategorilere göre grupla
   */
  private groupTablesByCategory(tables: ExtractedTable[]): Record<TableCategory, ExtractedTable[]> {
    const groups: Record<string, ExtractedTable[]> = {};

    tables.forEach(table => {
      const category = table.category || "other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(table);
    });

    return groups as Record<TableCategory, ExtractedTable[]>;
  }

  /**
   * Kategori sayılarını hesapla
   */
  private getCategoryCounts(tables: ExtractedTable[]): Record<string, number> {
    const counts: Record<string, number> = {};
    tables.forEach(table => {
      const cat = table.category || "other";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }

  /**
   * Intelligence extraction prompt'u oluştur
   */
  private buildIntelligencePrompt(groupedTables: Record<TableCategory, ExtractedTable[]>): string {
    // Her kategori için tablolardan sample çıkar
    const tableDescriptions: string[] = [];

    Object.entries(groupedTables).forEach(([category, tables]) => {
      if (tables.length === 0) return;

      tableDescriptions.push(`\n### ${category.toUpperCase()} (${tables.length} tablo)\n`);

      tables.forEach((table, idx) => {
        // DAHA FAZLA SATIR: 3 yerine 8 satır göster (daha iyi veri örnekleri için)
        const sampleRows = table.rows.slice(0, 8).map(row =>
          // TÜM SÜTUNLAR: Artık sütun sınırı yok, tüm veriyi göster
          row.join(" | ")
        ).join("\n     ");

        // BOŞ TABLO KONTROLÜ: Boş tabloları tespit et
        const isEmpty = !sampleRows.trim() || table.satir_sayisi === 0;
        const emptyWarning = isEmpty ? " ⚠️ BOŞ TABLO - VERİ YOK" : "";

        tableDescriptions.push(`${idx + 1}. "${table.baslik}"${emptyWarning}
   Sütunlar: [${table.headers.join(", ")}] (${table.headers.length} sütun)
   Örnek veri (${table.satir_sayisi} satır):
     ${sampleRows || "     [BOŞ - VERİ BULUNAMADI]"}
`);
      });
    });

    return `🧠 GÖREV: İhale dokümanından çıkarılan ve kategorize edilmiş tabloları analiz et ve yapılandırılmış intelligence çıkar.

📋 ANALİZ EDİLECEK KATEGORİZE TABLOLAR:

${tableDescriptions.join("\n")}

🎯 ÇIKARILACAK INTELLIGENCE:

1. **PERSONEL DETAYLARI** (personnel kategorisinden)
   - Toplam personel sayısı
   - Pozisyonlar (Aşçı, Aşçı Yardımcısı, Bulaşıkçı vb.)
   - Her pozisyonun sayısı
   - Nitelikler (varsa)
   - Maaş bilgileri (varsa)

2. **EKİPMAN LİSTESİ** (materials, technical kategorilerinden)
   - Kategori bazlı gruplandırma (Mutfak Ekipmanları, Temizlik Malzemeleri vb.)
   - Ürün adları
   - Miktar bilgileri (varsa)
   - Özellikler (varsa)

3. **MENU ANALİZİ** (meals, quantities kategorilerinden)
   - Toplam kaç çeşit yemek var
   - Ortalama gramaj değerleri
   - Kritik malzemeler (et, tavuk, balık vb.)
   - Özel diyet gereksinimleri (varsa)

4. **KURULUŞLAR** (organization kategorisinden)
   - Kuruluş adları (Huzurevi, Bakımevi vb.)
   - Her kuruluştaki kişi sayısı
   - ⚡ ÇOK ÖNEMLİ - Öğün dağılımı (Kahvaltı, Öğle, Akşam):
     * Tablolarda "Kahvaltı", "Öğle", "Akşam" sütunlarını DİKKATLE ara
     * Her kuruluş için ayrı ayrı öğün sayılarını çıkar
     * Boş veya eksik değerleri atla, sadece kesin sayıları al
     * Format: {"kahvalti": 120, "ogle": 120, "aksam": 120, "toplam": 360}
   - Toplam öğün sayısı (kahvaltı + öğle + akşam)

5. **MALİYET VERİLERİ** (financial kategorisinden)
   - Tahmini bütçe (varsa)
   - Birim fiyatlar (varsa)
   - Maliyet kalemleri

⚡ ÖNEMLİ KURALLAR:

1. **BOŞ TABLOLARI ATLA**
   - "⚠️ BOŞ TABLO" işaretli tabloları yoksay
   - Sadece veri içeren tablolardan çıkarım yap
   - Boş tablolar için tahmin yapma

2. **Veri varsa çıkar, yoksa boş bırak**
   - Tahmin yapma, sadece tablolarda gördüğün verileri kullan
   - Belirsiz verileri atlama
   - Eksik öğün dağılımlarını (kahvalti/ogle/aksam) boş bırak

3. **Sayısal değerleri doğru çıkar**
   - Kişi sayıları, miktarlar, fiyatlar kesin olmalı
   - Toplamları kontrol et (varsa)
   - Öğün sayılarını DİKKATLE çıkar (0 olabilir, null ile karıştırma)

4. **Kategori bazlı analiz yap**
   - personnel → personel_detaylari
   - materials/technical → ekipman_listesi
   - meals/quantities → menu_analizi
   - organization → kuruluslar (ÖĞün dağılımı burada!)
   - financial → maliyet_verileri

5. **Özetleme yap**
   - Her tabloyu ayrı ayrı döndürme
   - Benzer verileri birleştir
   - Yapılandırılmış format kullan
   - Öğün dağılımlarını tüm kuruluşlar için topla

📋 CEVAP FORMATI (SADECE JSON):

{
  "personel_detaylari": {
    "toplam_personel": 12,
    "pozisyonlar": [
      {
        "pozisyon": "Aşçı",
        "sayi": 3,
        "nitelik": "Sertifikalı",
        "maas": "15.000 TL"
      },
      ...
    ]
  },
  "ekipman_listesi": [
    {
      "kategori": "Mutfak Ekipmanları",
      "urunler": [
        {
          "ad": "Endüstriyel Fırın",
          "miktar": "2 adet",
          "ozellik": "Elektrikli, 10 tepsi"
        },
        ...
      ]
    },
    ...
  ],
  "menu_analizi": {
    "toplam_yemek_cesidi": 45,
    "ortalama_gramaj": "250-300 gr",
    "kritik_malzemeler": ["Dana eti", "Tavuk", "Pirinç"],
    "ozel_diyetler": ["Diyabetik menu", "Tuz kısıtlı"]
  },
  "kuruluslar": [
    {
      "ad": "Huzurevi",
      "kisi_sayisi": 120,
      "ogun_dagilimi": {
        "kahvalti": 120,
        "ogle": 120,
        "aksam": 120,
        "toplam": 360
      }
    },
    ...
  ],
  "maliyet_verileri": {
    "tahmini_butce": 1500000,
    "birim_fiyatlar": [
      {
        "kalem": "Öğün Başı",
        "fiyat": "45 TL"
      },
      ...
    ]
  },
  "guven_skoru": 0.90,
  "kaynak_tablolar": ["Kuruluş Dağılımı", "Personel İhtiyacı", "Menu Planı"]
}

⚠️ KRİTİK:
- Sadece JSON döndür, açıklama yapma
- Boş olan alanları dahil etme (undefined bırak)
- Sayısal değerleri number olarak döndür (string değil)
- Array'ler boşsa dahil etme

🚀 ŞİMDİ BAŞLA!`;
  }

  /**
   * Claude response'unu parse et
   */
  private parseIntelligenceResponse(responseText: string, sourceTables: ExtractedTable[]): TableIntelligence {
    try {
      // JSON extraction
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Kaynak tablolarını ekle
      if (!parsed.kaynak_tablolar) {
        parsed.kaynak_tablolar = sourceTables
          .map(t => t.baslik)
          .filter((v, i, a) => a.indexOf(v) === i) // Unique
          .slice(0, 10); // İlk 10 tablo
      }

      return parsed as TableIntelligence;
    } catch (error) {
      console.error("❌ Failed to parse table intelligence response:", error);
      console.error("Response text:", responseText);
      return { guven_skoru: 0 };
    }
  }

  /**
   * Intelligence özetini logla
   */
  private logIntelligenceSummary(intelligence: TableIntelligence): void {
    console.log("\n📊 INTELLIGENCE ÖZETİ:");

    if (intelligence.personel_detaylari) {
      console.log(`   👥 Personel: ${intelligence.personel_detaylari.toplam_personel || 0} kişi, ${intelligence.personel_detaylari.pozisyonlar?.length || 0} pozisyon`);
    }

    if (intelligence.ekipman_listesi) {
      const totalProducts = intelligence.ekipman_listesi.reduce(
        (sum, kat) => sum + (kat.urunler?.length || 0),
        0
      );
      console.log(`   🔧 Ekipman: ${intelligence.ekipman_listesi.length} kategori, ${totalProducts} ürün`);
    }

    if (intelligence.menu_analizi) {
      console.log(`   🍽️ Menu: ${intelligence.menu_analizi.toplam_yemek_cesidi || 0} çeşit, ${intelligence.menu_analizi.kritik_malzemeler?.length || 0} kritik malzeme`);
    }

    if (intelligence.kuruluslar) {
      const totalKisi = intelligence.kuruluslar.reduce(
        (sum, k) => sum + (k.kisi_sayisi || 0),
        0
      );
      console.log(`   📍 Kuruluşlar: ${intelligence.kuruluslar.length} kuruluş, ${totalKisi} toplam kişi`);
    }

    if (intelligence.maliyet_verileri) {
      console.log(`   💰 Maliyet: ${intelligence.maliyet_verileri.tahmini_butce?.toLocaleString('tr-TR')} TL, ${intelligence.maliyet_verileri.birim_fiyatlar?.length || 0} fiyat kalemi`);
    }

    if (intelligence.guven_skoru) {
      console.log(`   ✅ Güven: ${Math.round(intelligence.guven_skoru * 100)}%`);
    }
  }

  /**
   * 🆕 ENTITY RECONCILIATION (Nov 9, 2025)
   * 
   * Cross-table entity merging - farklı tablolardan aynı entity'leri birleştirir
   * 
   * Kullanım alanları:
   * 1. Kuruluşlar - Aynı kuruluş farklı tablolarda geçiyorsa merge et
   * 2. Ekipman - Aynı ürün farklı kategorilerde olabilir
   * 3. Personel - Aynı pozisyon farklı tablolarda sayılmış olabilir
   * 
   * @param intelligence - AI'dan gelen intelligence verisi
   * @returns Reconcile edilmiş intelligence
   */
  private reconcileEntities(intelligence: TableIntelligence): TableIntelligence {
    console.log("\n🔄 ENTITY RECONCILIATION başlatılıyor...");
    const startTime = Date.now();

    let reconciledCount = 0;

    // 1️⃣ KURULUŞ RECONCILIATION
    if (intelligence.kuruluslar && intelligence.kuruluslar.length > 1) {
      const original = intelligence.kuruluslar.length;
      intelligence.kuruluslar = this.reconcileOrganizations(intelligence.kuruluslar);
      const diff = original - intelligence.kuruluslar.length;
      
      if (diff > 0) {
        reconciledCount += diff;
        console.log(`   ✅ Kuruluşlar: ${diff} duplicate merge edildi (${original} → ${intelligence.kuruluslar.length})`);
      }
    }

    // 2️⃣ EKIPMAN RECONCILIATION
    if (intelligence.ekipman_listesi && intelligence.ekipman_listesi.length > 0) {
      const originalCount = intelligence.ekipman_listesi.reduce(
        (sum, kat) => sum + (kat.urunler?.length || 0), 
        0
      );
      
      intelligence.ekipman_listesi = this.reconcileEquipment(intelligence.ekipman_listesi);
      
      const newCount = intelligence.ekipman_listesi.reduce(
        (sum, kat) => sum + (kat.urunler?.length || 0), 
        0
      );
      const diff = originalCount - newCount;
      
      if (diff > 0) {
        reconciledCount += diff;
        console.log(`   ✅ Ekipman: ${diff} duplicate ürün merge edildi (${originalCount} → ${newCount})`);
      }
    }

    // 3️⃣ PERSONEL RECONCILIATION
    if (intelligence.personel_detaylari?.pozisyonlar && 
        intelligence.personel_detaylari.pozisyonlar.length > 1) {
      const original = intelligence.personel_detaylari.pozisyonlar.length;
      intelligence.personel_detaylari.pozisyonlar = this.reconcilePersonnel(
        intelligence.personel_detaylari.pozisyonlar
      );
      const diff = original - intelligence.personel_detaylari.pozisyonlar.length;
      
      if (diff > 0) {
        reconciledCount += diff;
        console.log(`   ✅ Personel: ${diff} duplicate pozisyon merge edildi (${original} → ${intelligence.personel_detaylari.pozisyonlar.length})`);
      }
    }

    const duration = Date.now() - startTime;
    
    if (reconciledCount > 0) {
      console.log(`✅ Entity reconciliation tamamlandı (${duration}ms): ${reconciledCount} duplicate entity merge edildi`);
    } else {
      console.log(`✅ Entity reconciliation tamamlandı (${duration}ms): Duplicate entity bulunamadı`);
    }

    return intelligence;
  }

  /**
   * Kuruluşları reconcile et (aynı isimde olanları merge et)
   */
  private reconcileOrganizations(orgs: Array<{
    ad: string;
    kisi_sayisi?: number;
    ogun_dagilimi?: any;
  }>): typeof orgs {
    const merged: typeof orgs = [];

    for (const org of orgs) {
      const existing = merged.find(o => 
        this.normalizeEntityName(o.ad) === this.normalizeEntityName(org.ad)
      );

      if (existing) {
        // Merge: Kişi sayısını topla, öğün dağılımını birleştir
        if (org.kisi_sayisi) {
          existing.kisi_sayisi = (existing.kisi_sayisi || 0) + org.kisi_sayisi;
        }

        if (org.ogun_dagilimi) {
          if (!existing.ogun_dagilimi) {
            existing.ogun_dagilimi = {};
          }
          
          // Öğün sayılarını topla
          for (const [key, value] of Object.entries(org.ogun_dagilimi)) {
            if (typeof value === 'number') {
              existing.ogun_dagilimi[key] = (existing.ogun_dagilimi[key] || 0) + value;
            }
          }
        }
      } else {
        merged.push({ ...org });
      }
    }

    return merged;
  }

  /**
   * Ekipman listesini reconcile et (aynı ürünleri merge et)
   */
  private reconcileEquipment(equipment: Array<{
    kategori: string;
    urunler: Array<{ ad: string; miktar?: string; ozellik?: string }>;
  }>): typeof equipment {
    const reconciledCategories: typeof equipment = [];

    for (const category of equipment) {
      const existingCategory = reconciledCategories.find(c => 
        this.normalizeEntityName(c.kategori) === this.normalizeEntityName(category.kategori)
      );

      if (existingCategory) {
        // Aynı kategorideki ürünleri merge et
        for (const product of category.urunler) {
          const existingProduct = existingCategory.urunler.find(p =>
            this.normalizeEntityName(p.ad) === this.normalizeEntityName(product.ad)
          );

          if (!existingProduct) {
            existingCategory.urunler.push({ ...product });
          }
          // Duplicate ise skip (miktar bilgisi varsa toplama yapılabilir ama şimdilik basit tut)
        }
      } else {
        reconciledCategories.push({ ...category });
      }
    }

    return reconciledCategories;
  }

  /**
   * Personel pozisyonlarını reconcile et (aynı pozisyonu merge et)
   */
  private reconcilePersonnel(positions: Array<{
    pozisyon: string;
    sayi: number;
    nitelik?: string;
    maas?: string;
  }>): typeof positions {
    const merged: typeof positions = [];

    for (const pos of positions) {
      const existing = merged.find(p =>
        this.normalizeEntityName(p.pozisyon) === this.normalizeEntityName(pos.pozisyon)
      );

      if (existing) {
        // Aynı pozisyon: Sayıyı topla
        existing.sayi += pos.sayi;
        
        // Nitelik ve maaş varsa güncelle (daha detaylı olanı tut)
        if (pos.nitelik && (!existing.nitelik || pos.nitelik.length > existing.nitelik.length)) {
          existing.nitelik = pos.nitelik;
        }
        if (pos.maas && !existing.maas) {
          existing.maas = pos.maas;
        }
      } else {
        merged.push({ ...pos });
      }
    }

    return merged;
  }

  /**
   * Entity isim normalizasyonu (karşılaştırma için)
   */
  private normalizeEntityName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '') // Boşlukları kaldır
      .replace(/[^\w\sğüşıöçĞÜŞİÖÇ]/g, '') // Noktalama kaldır
      .trim();
  }
}

/**
 * Singleton instance
 */
let agentInstance: TableIntelligenceAgent | null = null;

export function getTableIntelligenceAgent(): TableIntelligenceAgent {
  if (!agentInstance) {
    agentInstance = new TableIntelligenceAgent();
  }
  return agentInstance;
}

/**
 * Convenience function - tablo intelligence çıkar
 */
export async function extractTableIntelligence(tables: ExtractedTable[]): Promise<TableIntelligence> {
  const agent = getTableIntelligenceAgent();
  return agent.analyzeTableIntelligence(tables);
}
