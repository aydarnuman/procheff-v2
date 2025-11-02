import { NextRequest, NextResponse } from "next/server";
import { ClaudeProvider } from "@/lib/ai/claude-provider";
import { logger, LogKategori } from "@/lib/logger";
import { hesaplaClaudeMaliyeti } from "@/lib/ai/cost-calculator";

export const runtime = "nodejs";

/**
 * CSV MALİYET EXPERT API
 *
 * Özelleşmiş Prompt - CSV Maliyet Dosyalarına Odaklanır:
 * - Maliyet kalemleri ve birim fiyatlar
 * - Toplam bütçe hesaplaması
 * - Kritik maliyet kalemleri (et, sebze, personel, vb.)
 * - Kar marjı analizi
 * - Rekabet gücü değerlendirmesi
 *
 * Format Desteği:
 * - Standart CSV (,)
 * - Türkçe CSV (;)
 * - TSV (tab-separated)
 *
 * DİĞER BELGE TÜRLERİ İÇİN KULLANMA!
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const sessionId = `csv_analiz_${Date.now()}`;

  try {
    logger.sessionBaslat(sessionId);
    logger.info(LogKategori.AI_ANALYSIS, '💰 CSV Maliyet Expert API başladı');

    const { text, fileName } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { success: false, error: "CSV metni bulunamadı" },
        { status: 400 }
      );
    }

    if (text.length < 50) {
      return NextResponse.json(
        { success: false, error: "CSV metni çok kısa (min 50 karakter)" },
        { status: 400 }
      );
    }

    // CSV formatını algıla ve normalize et
    const normalizedCSV = normalizeCSV(text);
    const csvRows = parseCSV(normalizedCSV);

    logger.info(LogKategori.AI_ANALYSIS, 'CSV parsing tamamlandı', {
      satirSayisi: csvRows.length,
      sutunSayisi: csvRows[0]?.length || 0,
      dosyaAdi: fileName,
    });

    const claude = new ClaudeProvider();

    // ÖZEL PROMPT - CSV Maliyet analizi için optimize edilmiş
    const prompt = buildCSVAnalysisPrompt(normalizedCSV, csvRows, fileName);

    const response = await claude.queryRaw(prompt, {
      maxTokens: 10000,
      temperature: 0.2, // Düşük - sayısal hesaplamalar hassas
    });

    // Parse JSON response
    const extractedData = parseCSVAnalysisResponse(response);

    const processingTime = Date.now() - startTime;

    // Maliyet hesapla
    const estimatedInputTokens = Math.ceil(text.length / 4);
    const estimatedOutputTokens = 2500;
    const maliyet = hesaplaClaudeMaliyeti('claude-3-5-sonnet-20241022', estimatedInputTokens, estimatedOutputTokens);

    logger.basarili(LogKategori.EXTRACTION, 'CSV Maliyet başarıyla analiz edildi', {
      ek: {
        guvenSkoru: Math.round(extractedData.guven_skoru * 100),
        toplamButce: extractedData.toplam_butce,
        kalemSayisi: extractedData.maliyet_kalemleri?.length || 0,
        tokenKullanimi: maliyet.toplamTokens,
        maliyetTL: maliyet.toplamMaliyetTRY,
      },
    });

    logger.sessionBitir(sessionId);

    return NextResponse.json({
      success: true,
      data: extractedData,
      metadata: {
        processing_time: processingTime,
        ai_provider: "claude-sonnet-4",
        document_type: "csv_maliyet",
        csv_stats: {
          rows: csvRows.length,
          columns: csvRows[0]?.length || 0,
        },
        extraction_timestamp: new Date().toISOString(),
        cost: {
          tokens: maliyet.toplamTokens,
          cost_usd: maliyet.toplamMaliyetUSD,
          cost_try: maliyet.toplamMaliyetTRY,
        },
      },
    });
  } catch (error) {
    console.error("CSV analysis error:", error);
    logger.hata(LogKategori.AI_ANALYSIS, 'CSV Maliyet analizi başarısız', {
      kod: 'CSV_ANALYSIS_ERROR',
      mesaj: error instanceof Error ? error.message : 'Bilinmeyen hata',
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "CSV analizi başarısız",
      },
      { status: 500 }
    );
  }
}

/**
 * CSV formatını normalize et (farklı delimiter'ları destekle)
 */
function normalizeCSV(text: string): string {
  // Türkçe Excel CSV format (;) → standart format (,)
  if (text.includes(';') && !text.includes(',')) {
    console.log('🔄 Türkçe CSV formatı tespit edildi (;), normalize ediliyor...');
    return text.replace(/;/g, ',');
  }

  // Tab-separated (TSV) → CSV
  if (text.includes('\t')) {
    console.log('🔄 TSV formatı tespit edildi, CSV\'ye çevriliyor...');
    return text.replace(/\t/g, ',');
  }

  return text;
}

/**
 * CSV'yi parse et - basit parser (satır ve sütunlara ayır)
 */
function parseCSV(text: string): string[][] {
  const lines = text.split('\n').filter(line => line.trim());
  return lines.map(line => {
    // Basit split - tırnak içi virgülleri göz ardı et (gelişmiş CSV parser gerekirse ekle)
    return line.split(',').map(cell => cell.trim().replace(/^["']|["']$/g, ''));
  });
}

/**
 * CSV MALİYET ANALİZİ İÇİN ÖZELLEŞMİŞ PROMPT
 */
function buildCSVAnalysisPrompt(csvText: string, csvRows: string[][], fileName?: string): string {
  const hasHeaders = csvRows.length > 0;
  const headers = hasHeaders ? csvRows[0] : [];
  const dataRows = csvRows.slice(1);

  return `Sen bir maliyet analizi ve ihale uzmanısısın. Aşağıdaki CSV MALİYET dosyasını analiz et.

🎯 GÖREV: CSV MALİYET ANALİZİ (SPECIALIZED)

Bu dosya bir MALİYET TABLOSU veya FİYAT CETVELİDİR. Şu bilgileri ÇIKAR:

🔴 KRİTİK BİLGİLER (MUTLAKA BUL):

1. **MALİYET KALEMLERİ**: Her kalem ne? (Gıda, Personel, Ekipman, Enerji, vb.)
2. **BİRİM FİYATLAR**: Her kalemin birim fiyatı nedir?
3. **MİKTARLAR**: Ne kadar alınacak? (Kg, Lt, Adet, Kişi, vb.)
4. **TOPLAM BÜTÇE**: Tüm kalemlerin toplamı
5. **KRİTİK KALEMLER**: En pahalı ve riskli kalemler (et, süt, personel)
6. **KAR MARJI**: Makul kar marjı nedir?

📊 CSV YAPISI:
- Satır sayısı: ${csvRows.length}
- Sütun sayısı: ${csvRows[0]?.length || 0}
${hasHeaders ? `- Başlıklar: ${headers.join(', ')}` : ''}

📄 CSV VERİSİ:
---
${csvText}
---

📋 CEVAP FORMATI (SADECE JSON):

\`\`\`json
{
  "maliyet_kalemleri": [
    {
      "kategori": "Gıda Malzemeleri",
      "kalem": "Kırmızı et (dana)",
      "birim": "Kg",
      "miktar": 1000,
      "birim_fiyat": 350,
      "toplam": 350000,
      "kritik_mi": true,
      "aciklama": "En yüksek maliyet kalemi, piyasa fiyatına bağlı"
    },
    {
      "kategori": "Personel",
      "kalem": "Aşçı",
      "birim": "Kişi/Ay",
      "miktar": 12,
      "birim_fiyat": 25000,
      "toplam": 300000,
      "kritik_mi": true,
      "aciklama": "Asgari ücret + SGK + vergi"
    }
  ],
  "ozet": {
    "toplam_butce": 2500000,
    "gida_toplam": 1500000,
    "personel_toplam": 500000,
    "diger_toplam": 500000,
    "kritik_kalem_sayisi": 5
  },
  "kar_marji_analizi": {
    "tahmini_maliyet": 2300000,
    "hedef_kar_marji": 0.08,
    "kar_tutari": 200000,
    "teklif_fiyati": 2500000,
    "birim_gun_fiyat": 68.49,
    "aciklama": "%8 kar marjı makul ve rekabetçi"
  },
  "kritik_riskler": [
    "Et fiyatları piyasaya bağlı - %20 artış riski",
    "Asgari ücret artışı - yıllık %30 artış olasılığı",
    "Enerji (doğalgaz, elektrik) fiyat dalgalanması"
  ],
  "rekabet_analizi": {
    "piyasa_ortalama_fiyat": 70,
    "bizim_fiyat": 68.49,
    "rekabetci_mi": "EVET",
    "avantajlar": [
      "Piyasa ortalamasının altında",
      "Makul kar marjı"
    ],
    "dezavantajlar": [
      "Düşük marj - artış karşısında hassas"
    ]
  },
  "oneriler": [
    "Et fiyatları için sözleşmede %15 eskalasyon maddesi ekle",
    "Personel maliyeti için yıllık ücret artış şartı belirt",
    "İlk 6 ay için tedarikçi fiyat garantisi al"
  ],
  "kanitlar": {
    "toplam_butce": "Satır 45: TOPLAM = 2.500.000 TL",
    "kritik_kalem": "Satır 12: Kırmızı Et (Dana) - 1000 Kg × 350 TL = 350.000 TL"
  },
  "guven_skoru": 0.90
}
\`\`\`

⚠️ KRİTİK KURALLAR:

1. **SAYILAR**: Virgül değil nokta kullan
   - "2.500.000,00" → 2500000
   - "68,49" → 68.49

2. **BİRİMLER**: Birimi mutlaka belirt
   - "Kg", "Lt", "Adet", "Kişi/Ay"

3. **KATEGORİLEŞTİRME**: Kalemleri gruplara ayır
   - Gıda Malzemeleri
   - Personel Giderleri
   - Ekipman ve Araç-Gereç
   - Enerji ve Yakıt
   - Diğer Giderler

4. **KRİTİK KALEMLER**: En pahalı ve riskli olanları işaretle
   - kritik_mi: true/false

5. **KAR MARJI**: Makul kar marjını hesapla
   - Catering sektöründe genellikle %5-12 arası

6. **REKABET ANALİZİ**: Piyasa ile karşılaştır
   - Birim fiyat rekabetçi mi?

7. **RİSKLER**: Maliyet artış riskleri
   - Fiyat dalgalanmaları
   - Asgari ücret artışları
   - Tedarik sorunları

8. **ÖNERİLER**: Risk azaltma stratejileri
   - Eskalasyon maddeleri
   - Fiyat garantileri
   - Alternatif tedarikçiler

🔍 ARAMA İPUÇLARI:

- Toplam: "TOPLAM", "GENEL TOPLAM", "TOTAL"
- Et: "Kırmızı et", "Dana", "Tavuk", "Balık"
- Personel: "Aşçı", "Yardımcı", "Garson", "Maaş"
- Enerji: "Elektrik", "Doğalgaz", "Su"

🚀 SADECE JSON FORMATINDA CEVAP VER - BAŞKA HİÇBİR ŞEY YAZMA!

${fileName ? `\nDosya adı: ${fileName}` : ''}`;
}

/**
 * Parse CSV Analysis JSON response
 */
function parseCSVAnalysisResponse(response: string): any {
  try {
    let cleaned = response.trim();

    // Remove ```json wrapper
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\w*\s*/, "").replace(/```\s*$/, "");
    }

    // Extract JSON object
    const jsonMatch = cleaned.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      cleaned = jsonMatch[1].trim();
    }

    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Parse error:", error);
    console.error("Raw response:", response);
    throw new Error("JSON parse başarısız - AI yanıtı bozuk");
  }
}
