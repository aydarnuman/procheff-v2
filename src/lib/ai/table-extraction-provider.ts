import { GoogleGenerativeAI } from "@google/generative-ai";
import { ExtractedTable } from "@/types/ai";

/**
 * Response type for table extraction
 */
interface TableExtractionResponse {
  tablolar: ExtractedTable[];
}

/**
 * Table Extraction Provider - JSON formatında (headers + rows) tablo çıkarımı
 * Gemini 2.0 Flash kullanarak yapılandırılmış tablo verileri döndürür
 */
export class TableExtractionProvider {
  private genAI: GoogleGenerativeAI;
  private model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || "";
    this.model = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    this.genAI = new GoogleGenerativeAI(apiKey);

    console.log("=== GEMINI TABLE EXTRACTION PROVIDER INIT ===");
    console.log("API Key exists:", !!apiKey);
    console.log("API Key length:", apiKey.length);
    console.log("Model:", this.model);
  }

  /**
   * Tabloları JSON formatında (headers + rows) çıkar
   */
  async extractTables(tableText: string): Promise<TableExtractionResponse> {
    console.log("=== TABLE EXTRACTION (JSON FORMAT: headers + rows) ===");
    console.log("Table text length:", tableText.length);

    // Uzun metinler için chunking gerekebilir
    const MAX_CHUNK_SIZE = 100000; // 100K karakter
    if (tableText.length > MAX_CHUNK_SIZE) {
      console.warn(`⚠️ Text too long (${tableText.length} chars), chunking into smaller parts...`);
      return await this.extractTablesFromChunks(tableText, MAX_CHUNK_SIZE);
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 16000, // 8000 → 16000 (büyük tablolar için)
        },
      });

      const prompt = this.buildTableExtractionPrompt(tableText);
      const result = await model.generateContent(prompt);
      const output = result.response.text();

      console.log("Gemini table response length:", output.length);

      return this.parseResponse(output);
    } catch (error) {
      console.error("Table extraction error:", error);
      throw error;
    }
  }

  /**
   * Uzun metinleri chunk'lara böl ve her chunk'tan tablo çıkar
   */
  private async extractTablesFromChunks(
    text: string,
    chunkSize: number
  ): Promise<TableExtractionResponse> {
    const chunks: string[] = [];
    let currentChunk = "";

    // Paragraf sınırlarına göre böl (daha mantıklı)
    const paragraphs = text.split(/\n\n+/);

    for (const para of paragraphs) {
      if (currentChunk.length + para.length > chunkSize && currentChunk) {
        chunks.push(currentChunk);
        currentChunk = para;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + para;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    console.log(`📦 Text split into ${chunks.length} chunks`);

    // ⚡ PARALEL İŞLEME - Gemini API batch işleme desteği
    // Rate limit: 15 RPM (request per minute) - güvenli batch boyutu: 5
    const BATCH_SIZE = 5;
    const allTables: ExtractedTable[] = [];

    console.log(`⚡ PARALEL TABLO ÇIKARIMI - ${BATCH_SIZE} chunk aynı anda işleniyor`);

    // Chunk'ları batch'lere böl
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, Math.min(i + BATCH_SIZE, chunks.length));
      const batchStart = Date.now();

      console.log(`\n📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}: ${batchChunks.length} chunk paralel işleniyor...`);

      // Bu batch'teki tüm chunk'ları PARALEL işle
      const batchPromises = batchChunks.map(async (chunk, idx) => {
        const chunkIndex = i + idx;
        const chunkStart = Date.now();

        try {
          console.log(`🔄 Chunk ${chunkIndex + 1}/${chunks.length} işleniyor... (${Math.round(chunk.length / 1000)}K chars)`);

          const model = this.genAI.getGenerativeModel({
            model: this.model,
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 16000,
            },
          });

          const prompt = this.buildTableExtractionPrompt(chunk);
          const result = await model.generateContent(prompt);
          const output = result.response.text();
          const parsed = this.parseResponse(output);

          const chunkDuration = Date.now() - chunkStart;

          if (parsed.tablolar && parsed.tablolar.length > 0) {
            console.log(`✅ Chunk ${chunkIndex + 1}: ${parsed.tablolar.length} tablo bulundu (${chunkDuration}ms)`);
            return parsed.tablolar;
          }

          console.log(`⚠️ Chunk ${chunkIndex + 1}: Tablo bulunamadı (${chunkDuration}ms)`);
          return [];
        } catch (error: any) {
          console.error(`❌ Chunk ${chunkIndex + 1} başarısız:`, error.message);
          return []; // Continue with other chunks
        }
      });

      // Batch sonuçlarını topla
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(tables => allTables.push(...tables));

      const batchDuration = Date.now() - batchStart;
      console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1} tamamlandı (${batchDuration}ms, ${Math.round(batchDuration / 1000)}s)`);

      // Sonraki batch için kısa bekleme (rate limit için)
      if (i + BATCH_SIZE < chunks.length) {
        console.log(`⏳ Rate limit için 2 saniye bekleniyor...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`\n📊 TABLO ÇIKARIMI TAMAMLANDI: ${allTables.length} tablo bulundu (${chunks.length} chunk)`);

    // 🆕 DUPLICATE DETECTION
    const uniqueTables = this.deduplicateTables(allTables);

    return { tablolar: uniqueTables };
  }

  private buildTableExtractionPrompt(tableText: string): string {
    return `🚨 KRİTİK: SADECE JSON FORMAT! ASCII ART YASAK!

Sen bir tablo çıkarım uzmanısın. Aşağıdaki metinden tabloları BUL ve SADECE JSON headers+rows formatında çıkar.

⛔ YASAK:
- "icerik" field KULLANMA!
- ASCII art (┌ ┐ └ ┘ ├ ┤ ─ │) KULLANMA!
- Monospace tablo formatı KULLANMA!

✅ ZORUNLU FORMAT:
- "baslik": string
- "headers": Array<string>  ← ZORUNLU!
- "rows": Array<Array<string>>  ← ZORUNLU!
- "satir_sayisi": number
- "guven": number (0-1)

📊 METİN (TABLO İÇERİR):
${tableText}

🎯 YAPMAN GEREKENLER:

1️⃣ **TABLO TESPİTİ:**
   - Metinde tablo yapısı bul
   - Tablo başlıklarını tespit et (Kuruluş, Kahvaltı, Öğle, Akşam, TOPLAM, vb.)
   - Satırları ve sütunları ayırt et

2️⃣ **VERİ ÇIKARIMI (JSON ARRAY FORMAT!):**
   - Header'ları (başlıkları) string array olarak çıkar: ["Sütun1", "Sütun2", ...]
   - Her satırı string array olarak çıkar: [["Satır1Col1", "Satır1Col2"], ["Satır2Col1", "Satır2Col2"]]
   - Sayıları string olarak koru: "6", "18", "250 gr"
   - Boş hücreleri "" (empty string) olarak bırak

3️⃣ **BAŞLIK BELİRLE:**
   - Tablo ne hakkında? (Kuruluş Dağılımı, Öğün Tablosu, vb.)
   - Açıklayıcı başlık yaz

📝 ÖRNEK ÇIKTI (DOĞRU FORMAT):

⛔ YANLIŞ (KULLANMA!):
{
  "tablolar": [
    {
      "baslik": "...",
      "icerik": "┌──┬──┐\\n│  │  │\\n└──┴──┘",  ← YANLIŞ! ASCII ART YASAK!
      "satir_sayisi": 2,
      "guven": 0.9
    }
  ]
}

✅ DOĞRU (BU FORMATI KULLAN!):
**ÖRNEK 1 - Basit Tablo:**
METİN GİRDİSİ:
┌───────────────────────────┬──────────┬──────────┬──────────┬─────────┐
│ Kuruluş                   │ Kahvaltı │   Öğle   │  Akşam   │ TOPLAM  │
├───────────────────────────┼──────────┼──────────┼──────────┼─────────┤
│ Huzurevi                  │     6    │     6    │     6    │    18   │
│ Çocuk Evleri              │     6    │     6    │     6    │    18   │
└───────────────────────────┴──────────┴──────────┴──────────┴─────────┘

JSON ÇIKTISI (headers + rows):
{
  "tablolar": [
    {
      "baslik": "Kuruluş Öğün Dağılımı",
      "headers": ["Kuruluş", "Kahvaltı", "Öğle", "Akşam", "TOPLAM"],
      "rows": [
        ["Huzurevi", "6", "6", "6", "18"],
        ["Çocuk Evleri", "6", "6", "6", "18"]
      ],
      "satir_sayisi": 2,
      "guven": 0.95
    }
  ]
}

**ÖRNEK 2 - Gramajlı Yemek Tablosu (ÖNEMLİ - GRAMAJLARI KAÇIRMA!):**
METİN:
│ Ana Yemek        │ Gramaj  │ Yan Yemek   │ Gramaj │
│ Tavuk But        │ 250 gr  │ Pilav       │ 150 gr │
│ Kıymalı Makarna  │ 200 gr  │ Cacık       │ 100 gr │

ÇIKTI:
{
  "tablolar": [
    {
      "baslik": "Yemek Gramajları",
      "headers": ["Ana Yemek", "Gramaj", "Yan Yemek", "Gramaj"],
      "rows": [
        ["Tavuk But", "250 gr", "Pilav", "150 gr"],
        ["Kıymalı Makarna", "200 gr", "Cacık", "100 gr"]
      ],
      "satir_sayisi": 2,
      "guven": 0.90
    }
  ]
}

**ÖRNEK 3 - Tek Satırlık Özet Tablo (BU TİP TABLOLAR DA DAHİL EDİLMELİ!):**
METİN:
│ Toplam Kişi │ Günlük Öğün │ Süre     │
│ 17          │ 3           │ 365 gün  │

ÇIKTI:
{
  "tablolar": [
    {
      "baslik": "İhale Özet Bilgileri",
      "headers": ["Toplam Kişi", "Günlük Öğün", "Süre"],
      "rows": [
        ["17", "3", "365 gün"]
      ],
      "satir_sayisi": 1,
      "guven": 0.85
    }
  ]
}

📋 CEVAP FORMATI (SADECE JSON):

{
  "tablolar": [
    {
      "baslik": "Açıklayıcı tablo başlığı",
      "headers": ["Sütun1", "Sütun2", "Sütun3"],
      "rows": [
        ["Satır1Veri1", "Satır1Veri2", "Satır1Veri3"],
        ["Satır2Veri1", "Satır2Veri2", "Satır2Veri3"]
      ],
      "satir_sayisi": 2,
      "guven": 0.95
    }
  ]
}

⚠️ KRİTİK KURALLAR:

1. 🚨 **ZORUNLU: "headers" ve "rows" kullan! "icerik" field YASAK!**
2. 🚨 **ZORUNLU: ASCII art (┌│─) KULLANMA! Sadece JSON array kullan!**
3. ✅ SADECE JSON formatında cevap ver!
4. ✅ headers: Array<string> - Sütun başlıkları: ["Başlık1", "Başlık2", ...]
5. ✅ rows: Array<Array<string>> - Her satır array: [["Veri1", "Veri2"], ["Veri3", "Veri4"]]
6. ✅ Tüm değerler STRING olarak (sayılar da string: "6", "18", "250 gr", vb.)
7. ✅ Her tablo için açıklayıcı başlık belirle
8. ✅ satir_sayisi: Kaç veri satırı var (header hariç)
9. ✅ guven: 0-1 arası, ne kadar emin olduğun
10. ✅ Tablo yoksa boş array döndür: { "tablolar": [] }
11. ✅ TOPLAM satırlarını normal satır gibi ekle (başlık "TOPLAM" olabilir)
12. ⚠️ MAKSIMUM 20 TABLO - Tüm önemli tabloları dahil et!
13. ✅ Birleştirilmiş hücreleri tekrar etme, sadece ilk hücreye yaz, diğerlerini "" bırak
14. ✅ Her satırda aynı sayıda sütun olmalı (eksik sütunları "" ile doldur)
15. ✅ MİNİMUM SATIR ŞARTI YOK - 1-2 satırlık önemli tablolar da dahil edilmeli
16. ✅ MİNİMUM GÜVEN: 0.60 (60%) - Daha fazla tablo yakalamak için eşiği düşük tut

🔥 ÇOK ÖNEMLİ - DETAYLARI KAÇIRMA:
- GRAMAJLAR: "250 gr", "150 gr", "100 ml" gibi değerleri tam olarak çıkar
- BİRİMLER: "Adet", "Kg", "Lt", "Takım" gibi birimleri koru
- MİKTARLAR: "2 Adet", "5 Kg", "30 Kişilik" gibi ifadeleri tam yaz
- NİTELİKLER: "En az ilkokul mezunu", "2 yıl deneyimli" gibi açıklamaları koru
- ÜCRETLER: "Brüt Asgari Ücretin %30" gibi hesaplamaları aynen yaz
- TARİHLER: "365 gün", "10.09.2025" gibi zaman bilgilerini çıkar

🚀 ŞİMDİ BAŞLA - TABLOLARI BUL VE JSON FORMATLA!

⚠️ SON HATIRLATMA:
- "icerik" KULLANMA → "headers" + "rows" KULLAN!
- ASCII art KULLANMA → JSON array KULLAN!
- Örnek: {"headers": ["A", "B"], "rows": [["1", "2"], ["3", "4"]]}

METİN UZUNLUĞU: ${Math.floor(tableText.length / 1000)}K karakter`;
  }

  private parseResponse(response: string): TableExtractionResponse {
    try {
      let cleaned = response.trim();

      // Remove ```json code blocks
      const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        cleaned = jsonMatch[1].trim();
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\w*\s*/, "").replace(/```\s*$/, "");
      }

      // Extract JSON object - try multiple strategies
      const jsonStartMatch = cleaned.match(/(\{[\s\S]*\})/);
      if (jsonStartMatch) {
        cleaned = jsonStartMatch[1].trim();
      }

      // Remove trailing commas (common JSON error)
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

      // Try to fix truncated JSON (add closing braces if missing)
      const openBraces = (cleaned.match(/\{/g) || []).length;
      const closeBraces = (cleaned.match(/\}/g) || []).length;
      if (openBraces > closeBraces) {
        console.warn(`⚠️ JSON appears truncated, attempting to fix (${openBraces} open, ${closeBraces} close)`);
        cleaned += '\n]}\n'.repeat(openBraces - closeBraces);
      }

      // Parse JSON with better error handling
      let parsed: { tablolar?: ExtractedTable[] };
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseError) {
        // Last resort: try to extract just the tablolar array
        const tabloMatch = cleaned.match(/"tablolar"\s*:\s*\[([\s\S]*)\]/);
        if (tabloMatch) {
          console.warn('⚠️ Full JSON parse failed, trying tablolar array extraction');
          parsed = { tablolar: JSON.parse('[' + tabloMatch[1] + ']') };
        } else {
          throw parseError;
        }
      }

      // Fix Turkish character encoding and validate structure
      if (parsed.tablolar && Array.isArray(parsed.tablolar)) {
        const validTables: ExtractedTable[] = [];

        for (const tablo of parsed.tablolar) {
          // Type assertion for dynamic data from API
          const rawTablo = tablo as unknown as {
            baslik?: string;
            headers?: string[];
            rows?: string[][];
            satir_sayisi?: number;
            guven?: number;
            icerik?: string; // Old format fallback
          };

          // NEW FORMAT: headers + rows (preferred)
          if (rawTablo.headers && rawTablo.rows && Array.isArray(rawTablo.headers) && Array.isArray(rawTablo.rows)) {
            validTables.push({
              baslik: this.fixTurkishEncoding(rawTablo.baslik || ''),
              headers: rawTablo.headers.map((h: string) => this.fixTurkishEncoding(h)),
              rows: rawTablo.rows.map((row: string[]) =>
                row.map((cell: string) => this.fixTurkishEncoding(cell))
              ),
              satir_sayisi: rawTablo.satir_sayisi || rawTablo.rows.length,
              sutun_sayisi: rawTablo.headers.length,
              guven: rawTablo.guven || 0.8,
            });
          }
          // OLD FORMAT FALLBACK: icerik (ASCII art) - parse it
          else if (rawTablo.icerik && typeof rawTablo.icerik === 'string') {
            console.warn('⚠️ Table using old ASCII format, converting:', rawTablo.baslik);

            const asciiParsed = this.parseAsciiToStructured(rawTablo.icerik);
            if (asciiParsed) {
              validTables.push({
                baslik: this.fixTurkishEncoding(rawTablo.baslik || ''),
                headers: asciiParsed.headers.map((h: string) => this.fixTurkishEncoding(h)),
                rows: asciiParsed.rows.map((row: string[]) =>
                  row.map((cell: string) => this.fixTurkishEncoding(cell))
                ),
                satir_sayisi: rawTablo.satir_sayisi || asciiParsed.rows.length,
                sutun_sayisi: asciiParsed.headers.length,
                guven: rawTablo.guven || 0.7,
              });
            }
          } else {
            console.warn('⚠️ Table has no valid format, skipping:', rawTablo.baslik);
          }
        }

        parsed.tablolar = validTables;
      }

      // Ensure we always return valid structure
      return {
        tablolar: parsed.tablolar || []
      };
    } catch (error) {
      console.error("Failed to parse table extraction response:", error);
      console.error("Response was:", response);
      throw error;
    }
  }

  /**
   * Parse ASCII art table to structured format
   */
  private parseAsciiToStructured(asciiTable: string): { headers: string[]; rows: string[][] } | null {
    try {
      const lines = asciiTable.split('\n').filter(line => line.trim());

      let headers: string[] = [];
      let rows: string[][] = [];
      let isFirstDataRow = true;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip separator lines (only box-drawing characters)
        if (line.match(/^[├┼┌┐└┘─┬┴]+$/)) continue;

        // Process data rows (lines with │)
        if (line.includes('│')) {
          const cells = line
            .split('│')
            .map(cell => cell.trim())
            .filter(cell => cell.length > 0);

          if (cells.length > 0) {
            if (isFirstDataRow) {
              headers = cells;
              isFirstDataRow = false;
            } else {
              rows.push(cells);
            }
          }
        }
      }

      // If no headers, use first row as headers
      if (headers.length === 0 && rows.length > 0) {
        headers = rows[0];
        rows = rows.slice(1);
      }

      if (headers.length === 0 || rows.length === 0) {
        return null;
      }

      return { headers, rows };
    } catch (error) {
      console.error('ASCII parse error:', error);
      return null;
    }
  }

  /**
   * Fix Turkish character encoding issues
   */
  private fixTurkishEncoding(text: string): string {
    if (!text) return text;

    let fixed = text;

    // Önce özel kalıpları değiştir (daha spesifik olanlar önce)
    const specificReplacements: Array<[string, string]> = [
      ['Mdrl\\?', 'Müdürlüğü'],
      ['KTAHYA', 'KÜTAHYA'],
      ['TEHİZAT', 'TEÇHİZAT'],
      ['YKLENİCİNİN', 'YÜKLENİCİNİN'],
    ];

    for (const [pattern, replacement] of specificReplacements) {
      fixed = fixed.replace(new RegExp(pattern, 'g'), replacement);
    }

    return fixed;
  }

  /**
   * 🆕 DUPLICATE TABLE DETECTION (Nov 9, 2025)
   * 
   * Similarity-based deduplication - chunk'lardan gelen duplicate tabloları tespit eder
   * 
   * Kontrol kriterleri:
   * 1. Başlık benzerliği (Levenshtein distance > 0.8)
   * 2. Header overlap (> 0.7)
   * 3. Row similarity (ilk 3 satır karşılaştırması > 0.6)
   * 
   * @param tables - Çıkarılmış tablolar
   * @returns Unique tablolar
   */
  private deduplicateTables(tables: ExtractedTable[]): ExtractedTable[] {
    if (tables.length <= 1) return tables;

    console.log(`\n🔍 DUPLICATE TABLE DETECTION - ${tables.length} tablo kontrol ediliyor...`);
    const startTime = Date.now();

    const unique: ExtractedTable[] = [];
    let duplicateCount = 0;

    for (const table of tables) {
      const isDuplicate = unique.some(existing => {
        // 1️⃣ Başlık benzerliği
        const titleSimilarity = this.calculateSimilarity(
          this.normalizeText(table.baslik),
          this.normalizeText(existing.baslik)
        );

        // 2️⃣ Header overlap (ortak header sayısı / toplam unique header)
        const headerOverlap = this.calculateArrayOverlap(
          table.headers,
          existing.headers
        );

        // 3️⃣ Row similarity (ilk 3 satırı karşılaştır)
        const rowSimilarity = this.calculateRowSimilarity(
          table.rows.slice(0, 3),
          existing.rows.slice(0, 3)
        );

        // Threshold kontrolü
        const isDup = titleSimilarity > 0.8 && 
                      headerOverlap > 0.7 && 
                      rowSimilarity > 0.6;

        if (isDup) {
          console.log(`   ⚠️ Duplicate tespit edildi:`);
          console.log(`      Başlık: "${table.baslik}" ≈ "${existing.baslik}" (${(titleSimilarity * 100).toFixed(1)}%)`);
          console.log(`      Header overlap: ${(headerOverlap * 100).toFixed(1)}%`);
          console.log(`      Row similarity: ${(rowSimilarity * 100).toFixed(1)}%`);
        }

        return isDup;
      });

      if (!isDuplicate) {
        unique.push(table);
      } else {
        duplicateCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Deduplication tamamlandı (${duration}ms):`);
    console.log(`   Unique: ${unique.length} tablo`);
    console.log(`   Duplicate: ${duplicateCount} tablo atlandı`);

    return unique;
  }

  /**
   * Levenshtein distance ile string similarity hesapla (0-1 arası)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;

    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 1.0;

    // Levenshtein distance
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const distance = matrix[len1][len2];
    return 1 - (distance / maxLen);
  }

  /**
   * Array overlap hesapla (Jaccard similarity)
   */
  private calculateArrayOverlap(arr1: string[], arr2: string[]): number {
    if (arr1.length === 0 && arr2.length === 0) return 1.0;
    if (arr1.length === 0 || arr2.length === 0) return 0.0;

    const normalized1 = arr1.map(s => this.normalizeText(s));
    const normalized2 = arr2.map(s => this.normalizeText(s));

    const set1 = new Set(normalized1);
    const set2 = new Set(normalized2);

    // Intersection
    const intersection = [...set1].filter(x => set2.has(x)).length;

    // Union
    const union = new Set([...set1, ...set2]).size;

    return union > 0 ? intersection / union : 0;
  }

  /**
   * Row similarity hesapla (satır satır karşılaştırma)
   */
  private calculateRowSimilarity(rows1: string[][], rows2: string[][]): number {
    if (rows1.length === 0 && rows2.length === 0) return 1.0;
    if (rows1.length === 0 || rows2.length === 0) return 0.0;

    const minLen = Math.min(rows1.length, rows2.length);
    let totalSimilarity = 0;

    for (let i = 0; i < minLen; i++) {
      const row1Str = rows1[i].join(' ').toLowerCase();
      const row2Str = rows2[i].join(' ').toLowerCase();

      totalSimilarity += this.calculateSimilarity(row1Str, row2Str);
    }

    return totalSimilarity / minLen;
  }

  /**
   * Text normalizasyonu (comparison için)
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ') // Multiple spaces → single space
      .replace(/[^\w\sğüşıöçĞÜŞİÖÇ]/g, '') // Punctuation kaldır
      .trim();
  }
}
