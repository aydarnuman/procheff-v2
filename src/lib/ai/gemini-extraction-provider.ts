import { GoogleGenerativeAI } from "@google/generative-ai";
import { ExtractedData, ContextualAnalysis } from "@/types/ai";
import { AILogger } from "@/lib/utils/ai-logger";

/**
 * Gemini AI Provider for Tender Document (Şartname) Extraction
 *
 * Advantages over Claude:
 * - 1M token context window (no chunking needed!)
 * - 96% cheaper ($0.000075 vs $0.003 per 1K tokens)
 * - Native PDF vision support
 * - Web search integration for market data
 * - 2-3x faster processing
 */
export class GeminiExtractionProvider {
  private apiKey: string;
  private model: string;
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "";
    this.model = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";

    if (!this.apiKey) {
      AILogger.error("GEMINI_API_KEY is missing", { provider: 'gemini' });
      throw new Error("GEMINI_API_KEY is missing in environment variables");
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);

    AILogger.success("Gemini Provider initialized", {
      provider: 'gemini',
      metadata: {
        model: this.model,
        keyLength: this.apiKey.length
      }
    });
  }

  /**
   * Extract structured data from tender document text
   *
   * No chunking needed - Gemini's 1M context window handles entire documents!
   */
  async extractStructuredData(text: string): Promise<ExtractedData> {
    AILogger.info("Starting Gemini extraction", {
      provider: 'gemini',
      operation: 'document-extraction',
      metadata: { textLength: text.length, model: this.model }
    });

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: 0.5, // Increased for better exploration of long documents
          maxOutputTokens: 16000, // Doubled for more detailed extraction
          topP: 0.95, // Encourage full document reading
        },
      });

      const prompt = this.buildExtractionPrompt(text);

      const requestStart = Date.now();

      const result = await model.generateContent(prompt);
      const response = result.response;
      const output = response.text();

      const requestTime = Date.now() - requestStart;
      AILogger.debug(`Gemini API response time: ${requestTime}ms`, {
        provider: 'gemini',
        metadata: { outputLength: output.length }
      });

      // 📊 TOKEN TRACKING - Store usage metadata
      if (response.usageMetadata) {
        const { promptTokenCount, candidatesTokenCount } = response.usageMetadata;

        // Log token usage
        AILogger.tokenUsage('gemini', promptTokenCount, candidatesTokenCount);

        // Import store dinamik olarak (server-side için)
        if (typeof window !== 'undefined') {
          import('@/lib/stores/token-store').then(({ useTokenStore }) => {
            useTokenStore.getState().addUsage({
              provider: 'gemini',
              model: this.model,
              operation: 'document-extraction',
              inputTokens: promptTokenCount,
              outputTokens: candidatesTokenCount,
            });

            console.log('💰 Token Usage Logged:', {
              input: promptTokenCount,
              output: candidatesTokenCount,
            });
          });
        }
      }

      // Parse JSON response
      const extractedData = this.parseResponse(output);

      AILogger.success("Gemini extraction completed", {
        provider: 'gemini',
        metadata: { 
          confidence: extractedData.guven_skoru,
          fields: Object.keys(extractedData).length
        }
      });

      return extractedData;
    } catch (error) {
      AILogger.error("Gemini extraction failed", {
        provider: 'gemini',
        metadata: { error: error instanceof Error ? error.message : 'Unknown' }
      });
      
      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes('429') || error.message.includes('quota')) {
          AILogger.quotaExceeded('gemini', 'Free tier: 1500 requests/day');
        } else if (error.message.includes('API key')) {
          AILogger.apiKeyStatus('gemini', false, error.message);
        }
      }
      
      throw error;
    }
  }

  /**
   * Extract from PDF directly using Gemini's vision capabilities
   * Skips OCR step entirely!
   */
  async extractFromPDF(file: File): Promise<ExtractedData> {
    console.log("=== GEMINI PDF VISION EXTRACTION ===");
    console.log("File:", file.name, file.size, "bytes");

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.model,
      });

      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString("base64");

      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: "application/pdf",
        },
      };

      const pdfVisionPrompt = this.buildPDFVisionPrompt();
      const prompt = pdfVisionPrompt;

      const result = await model.generateContent([imagePart, { text: prompt }]);
      const output = result.response.text();

      return this.parseResponse(output);
    } catch (error) {
      console.error("PDF vision extraction error:", error);
      throw error;
    }
  }

  /**
   * Build comprehensive extraction prompt for Turkish tender documents
   */
  private buildExtractionPrompt(text: string): string {
    return `Sen bir Türk kamu ihalelerinde uzman bir yapay zeka asistanısın. Aşağıdaki ihale şartnamesinden kritik bilgileri çıkar.

⚠️ ÇOK ÖNEMLİ: Bu belge ${Math.floor(text.length / 1000)}K karakter uzunluğunda. TÜM METNİ BAŞTAN SONA OKU! Sadece başlangıca bakma, SONLARA KADAR GİT!

📄 ŞARTNAME METNİ (BAŞTAN SONA OKUYACAKSIN):
${text}

🎯 GÖREV:
BELGENİN HER YERİNE BAK! Tablolar, listeler, son sayfalar dahil TÜM DETAYLARI çıkar. Aşağıdaki JSON formatında yapılandırılmış veri çıkar. Tüm alanları doldur, bulamadığın bilgiler için null kullan.

⚠️ ÇOK ÖNEMLİ - KİŞİ SAYISI BULMA STRATEJİSİ:

**AMAÇ:** Kaç kişiye yemek yapılacak? (Hizmet alan sayısı, personel değil!)

**3 ADIMLI ARAMA STRATEJİSİ:**

1️⃣ **TABLOLARDA ARA (EN YAYGINI!):**
   - "Kahvaltı, Öğle, Akşam, Toplam" kolonlu tablolar var mı?
   - "Toplam" sütunundaki sayıları BUL ve TOPLA
   - Örnek: Tablo 1'de 6, Tablo 2'de 11 → Toplam: 17 kişi
   - Görsel tablolara dikkat! PDF'te satır/kolon yapısı ara

2️⃣ **KURULUŞ/BİRİM LİSTESİ VAR MI?:**
   - Birden fazla kuruluş/birim/dağıtım yeri var mı?
   - HER kuruluştaki kişi sayısını bul ve TOPLA
   - ⚠️ Kuruluş sayısı ≠ Kişi sayısı! (17 kuruluş varsa, her birindeki kişileri say)
   - Örnek: "Kuruluş A: 45 kişi, Kuruluş B: 30 kişi" → Toplam: 75

3️⃣ **DİREKT İFADELER ARA:**
   - "500 kişiye yemek", "700 öğrenciye", "250 öğrenci için"
   - "yatak kapasitesi", "hasta sayısı", "sporcu sayısı"
   - "günlük ortalama X kişi", "toplam X kişilik"

**⚠️ PERSONEL İLE KARIŞTIRMA:**
- "kisi_sayisi" = Yemek YİYEN kişi (öğrenci, hasta, sporcu)
- "personel_sayisi" = İş YAPAN kişi (aşçı, garson, hizmetli)
- "8 personel çalıştırılacak" → kisi_sayisi: null, personel_sayisi: 8
- "1 aşçıbaşı, 3 aşçı, 4 yardımcı" → Bu PERSONEL! → kisi_sayisi: null

**🚫 MADDE NUMARALARINI ALMA:**
- "17-Yüklenici", "5-Personel", "3-Malzeme" → MADDE NUMARALARI! Veri değil!
- Tire (-) ile başlayan madde başlıkları → MADDE NO, sayı değil!
- "Madde 15:", "Bent 8:", "Paragraf 12:" → Yapısal numaralar, kişi sayısı değil!

⚠️ ÇOK ÖNEMLİ - BÜTÇE BULMA STRATEJİSİ:

**ARAMA TERİMLERİ (hepsini ara!):**
- "tahmini bedel", "muhammen bedel", "yaklaşık maliyet"
- "ihale tutarı", "sözleşme bedeli", "toplam tutar"
- "KDV Dahil", "KDV Hariç" (ikisini de kontrol et)

**FORMAT DÖNÜŞÜMÜ:**
- "1.500.000 TL" → 1500000
- "1.500.000,00 TL" → 1500000
- "2,850,000 TL" → 2850000
- Virgül ve noktaları temizle, sadece rakam bırak

**BİRDEN FAZLA BÜTÇE VARSA:**
- En yüksek tutarı al (genelde KDV dahil olanı)
- Aylık ve yıllık varsa → yıllık tutarı al

🔍 KAYNAK TAKİBİ (ZORUNLU - KANITSIZ VERİ KABUL EDİLMEZ!):
Her bilgi için "_sources" objesi MUTLAKA ekle:
- field: Alan adı
- value: Çıkarılan değer
- document: Hangi belgeden (çoklu dosya varsa)
- proof: Kaynak metin (aynen alıntı - EN AZ 50 KARAKTER!) ← ZORUNLU!
- confidence: 0-1 arası güven skoru
- location: "Sayfa X, Paragraf Y" veya "Tablo başlığı altında"

⚠️ ÖNEMLİ: Eğer bir bilgi için KANIT gösteremiyorsan, o alanı null bırak!
Her alan için EN AZ 1 _source objesi olmalı. Proof alanı boş olamaz!

📋 CEVAP FORMATI (SADECE JSON):

\`\`\`json
{
  "kurum": "Kurum adı",
  "ihale_turu": "Açık İhale | Belli İstekliler Arasında | Pazarlık Usulü",
  "kisi_sayisi": 250,
  "personel_sayisi": 17,
  "ogun_sayisi": 3,
  "gun_sayisi": 365,
  "tahmini_butce": 2850000,
  "teslim_suresi": "7 gün",
  "ihale_tarihi": "2025-01-15",
  "teklif_son_tarih": "2025-01-20",
  "ise_baslama_tarihi": "2025-02-01",
  "ozel_sartlar": [
    "Gıda malzemeleri 1. sınıf tanınmış marka olacak",
    "Türk Gıda Kodeksine uygun olacak",
    "Yüklenici ayda bir mikrobiyolojik analiz yaptıracak",
    "Personel hijyen eğitimi alacak",
    "..."
  ],  // ⚠️ EN AZ 5-10 ŞART BUL! Tüm belgeyi detaylı tara!
  "riskler": [
    "Gıda zehirlenmeleri riski",
    "Mutfak kullanılamaz hale gelebilir (yangın, tadilat)",
    "Personel hijyeni sorunları",
    "..."
  ],  // ⚠️ EN AZ 3-5 RİSK BUL! Gizli riskler de var!
  "_sources": [
    {
      "field": "kisi_sayisi",
      "value": 250,
      "document": "ihale_ilani.pdf",
      "proof": "250 kişi için günlük 3 öğün yemek hizmeti verilecektir. Sabah kahvaltısı, öğle ve akşam yemekleri dahildir.",
      "confidence": 0.95,
      "location": "Sayfa 2, Tablo 1 - Öğün Dağılımı"
    },
    {
      "field": "ozel_sartlar",
      "value": "Gıda malzemeleri 1. sınıf...",
      "document": "teknik_sartname.doc",
      "proof": "Yemeklerde kullanılan tüm malzemeler ekte sunulan Gıda Malzemelerinin Özellikleri adlı dokümandaki şartlar ile Türk Gıda Kodeksine uygun olacaktır.",
      "confidence": 0.95,
      "location": "Sayfa 5, Özel Şartlar Bölümü"
    }
  ],  // ⚠️ HER ALAN İÇİN EN AZ 1 SOURCE EKLE!
  "guven_skoru": 0.85
}
\`\`\`

⚠️ ÖNEMLİ KURALLAR:
1. SADECE JSON formatında cevap ver, başka metin yazma!
2. Tüm sayılar NUMBER olmalı, string değil!
3. Tarihler "YYYY-MM-DD" formatında
4. Türkçe karakterleri koru (İ, Ş, Ğ, vb.)
5. _sources array'i MUTLAKA DETAYLI DOLDUR - her alan için EN AZ 1 kaynak!
6. Proof alanına EN AZ 50 karakter kaynak metin yaz (kısa alıntı kabul edilmez!)
7. ozel_sartlar array'inde EN AZ 5 şart olsun
8. riskler array'inde EN AZ 3 risk olsun
9. null kullanmaktan çekinme (bilinmeyen bilgiler için)
10. **TÜM BELGEYİ OKU** - sadece başa bakma, SONLARA KADAR git!

🚀 ŞİMDİ BAŞLA VE TÜM ${Math.floor(text.length / 1000)}K KARAKTERİ BAŞTAN SONA TARA!`;
  }

  /**
   * Parse Gemini's JSON response
   */
  private parseResponse(response: string): ExtractedData {
    try {
      // Clean markdown code blocks
      let cleaned = response.trim();

      // Remove ```json ... ``` wrapper
      const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        cleaned = jsonMatch[1].trim();
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\w*\s*/, "").replace(/```\s*$/, "");
      }

      // Extract JSON object/array
      const jsonStartMatch = cleaned.match(/(\{[\s\S]*\})/);
      if (jsonStartMatch) {
        cleaned = jsonStartMatch[1].trim();
      }

      const parsed = JSON.parse(cleaned);

      // ✅ FIX: guven_skoru NaN kontrolü
      if (parsed.guven_skoru !== undefined) {
        if (typeof parsed.guven_skoru !== 'number' || isNaN(parsed.guven_skoru)) {
          console.warn('⚠️ Gemini guven_skoru invalid, fallback 0.5 kullanılıyor', { 
            guven_skoru: parsed.guven_skoru 
          });
          parsed.guven_skoru = 0.5;
        } else {
          // 0-1 aralığına clamp et
          parsed.guven_skoru = Math.max(0, Math.min(1, parsed.guven_skoru));
        }
      } else {
        console.warn('⚠️ Gemini guven_skoru missing, fallback 0.5 kullanılıyor');
        parsed.guven_skoru = 0.5;
      }

      // Validate required fields
      if (!parsed.kurum && !parsed.ihale_turu && !parsed.tahmini_butce) {
        throw new Error("Missing critical fields in extraction");
      }

      return parsed as ExtractedData;
    } catch (error) {
      console.error("Failed to parse Gemini response:", error);
      console.error("Raw response:", response);
      throw new Error("Failed to parse Gemini extraction response");
    }
  }

  /**
   * Analyze context and generate insights
   * Used for strategic analysis after extraction
   */
  async analyzeContext(extractedData: ExtractedData): Promise<ContextualAnalysis> {
    console.log("=== GEMINI CONTEXTUAL ANALYSIS ===");

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: 0.5, // Slightly higher for creative analysis
          maxOutputTokens: 4000,
        },
      });

      const prompt = this.buildContextAnalysisPrompt(extractedData);

      const result = await model.generateContent(prompt);
      const output = result.response.text();

      // Parse response
      let cleaned = output.trim();
      const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        cleaned = jsonMatch[1].trim();
      }

      const analysis = JSON.parse(cleaned);

      console.log("=== CONTEXTUAL ANALYSIS TAMAMLANDI ===");
      return analysis as ContextualAnalysis;
    } catch (error) {
      console.error("Contextual analysis error:", error);
      throw error;
    }
  }

  /**
   * Build prompt for contextual analysis
   */
  private buildContextAnalysisPrompt(data: ExtractedData): string {
    return `Sen bir ihale danışmanısın. Aşağıdaki ihale verisini analiz et ve bağlamsal değerlendirme yap.

📊 İHALE VERİSİ:
${JSON.stringify(data, null, 2)}

🎯 GÖREV:
Aşağıdaki JSON formatında bağlamsal analiz yap:

\`\`\`json
{
  "belge_tutarliligi": "tutarli | kismi_tutarsizlik | tutarsiz",
  "tutarsizlik_detaylari": ["Detay 1", "Detay 2"],
  "operasyonel_riskler": ["Risk 1", "Risk 2"],
  "maliyet_sapma_olasiligi": 25,
  "zaman_uygunlugu": "yeterli | sinirda | yetersiz",
  "genel_oneri": "Detaylı öneri metni"
}
\`\`\`

⚠️ SADECE JSON formatında cevap ver!`;
  }

  /**
   * Validate budget with real-time market data using web search
   */
  async validateBudgetWithMarketData(
    budget: number,
    persons: number,
    meals: number,
    days: number
  ): Promise<any> {
    console.log("=== BUDGET VALIDATION WITH MARKET DATA ===");

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.model,
      });

      const budgetPerMeal = budget / (persons * meals * days);

      const prompt = `
Türkiye piyasa fiyatlarını Google'da araştır:

İhale Detayları:
- Toplam bütçe: ${budget.toLocaleString()} TL
- Kişi sayısı: ${persons}
- Günlük öğün: ${meals}
- Süre: ${days} gün
- Öğün başına: ${budgetPerMeal.toFixed(2)} TL

GÖREV:
1. Temel gıda fiyatlarını ara (tavuk, pirinç, sebze, yağ)
2. Öğün başına ${budgetPerMeal.toFixed(2)} TL gerçekçi mi değerlendir
3. Kar marjı olası mı hesapla

CEVAP FORMATI (SADECE JSON):
\`\`\`json
{
  "realMarketPrices": {
    "chicken_kg": 89.50,
    "rice_kg": 45.00,
    "oil_liter": 95.00,
    "vegetables_avg": 35.00
  },
  "estimatedCostPerMeal": 8.50,
  "budgetPerMeal": ${budgetPerMeal.toFixed(2)},
  "profitMargin": 18.3,
  "isRealistic": true,
  "recommendation": "Kar marjı iyi, girilmeli",
  "risks": ["Et fiyatları volatil", "Kış sebzeleri pahalı"]
}
\`\`\`
`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        // tools: [{ googleSearch: {} }], // Disabled - not supported in current SDK version
      });

      const output = result.response.text();

      // Parse JSON
      let cleaned = output.trim();
      const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        cleaned = jsonMatch[1].trim();
      }

      return JSON.parse(cleaned);
    } catch (error) {
      console.error("Budget validation error:", error);
      throw error;
    }
  }

  /**
   * Build specialized prompt for PDF Vision extraction
   * Optimized for visual table recognition and number extraction
   */
  private buildPDFVisionPrompt(): string {
    return `Sen bir Türk kamu ihalelerinde uzman PDF analiz yapay zekasısın. Bu PDF belgesindeki ihale şartnamesinden kritik bilgileri GÖRSEL OLARAK çıkaracaksın.

📄 PDF VİZYON ANALİZİ - ÖZEL TALİMATLAR:

🔍 TABLO TANIMA (ÇOK ÖNEMLİ!):
Bu PDF'te büyük ihtimalle TABLOLAR var. Dikkatli bak!

**TABLO BAŞLIKLARI ARA:**
- "Kahvaltı", "Öğle Yemeği", "Akşam Yemeği", "Toplam"
- "Kuruluş Adı", "Birim", "Kişi Sayısı"
- "Aylık", "Günlük", "Yıllık"
- Satır ve sütunları görsel olarak takip et!

**TABLO İÇİNDE SAYILARI BUL:**
- Her hücredeki sayıyı oku (1, 5, 10, 250 vs.)
- Toplam sütununa özel dikkat et!
- Birden fazla tablo varsa HEPSİNİ topla

**ÖRNEK TABLO YAPISI:**
\`\`\`
| Kuruluş        | Kahvaltı | Öğle | Akşam | Toplam |
|----------------|----------|------|-------|--------|
| Birim A        | 2        | 3    | 1     | 6      |
| Birim B        | 4        | 5    | 2     | 11     |
\`\`\`
→ Bu durumda: kisi_sayisi = 6 + 11 = 17

💰 BÜTÇE SAYILARI İÇİN:
- "1.500.000", "2.850.000" gibi BÜYÜK sayılara dikkat
- "TL", "₺", "lira" kelimelerinin yakınında
- Nokta ve virgülleri göz ardı et (1.500.000 = 1500000)

📊 KİŞİ SAYISI İÇİN:
- Tablolardaki "Toplam" kolonu
- "...kişi", "...öğrenci", "...hasta" ifadeleri
- "...kişilik yemekhane" gibi kelimeler

⚠️ PDF'TE DİKKAT EDİLECEKLER:
1. Metin kalitesi düşük olabilir - benzer sayılara dikkat (0 vs O, 1 vs l)
2. Satır ve kolonları görsel olarak takip et
3. Çoklu sayfa varsa tümünü tara
4. El yazısı varsa olabildiğince oku

🎯 ÇIKARILACAK VERİLER:
Aşağıdaki JSON formatında yapılandırılmış veri çıkar:

\`\`\`json
{
  "kurum": "Kurum adı (başlıktan)",
  "ihale_turu": "Açık İhale | Belli İstekliler Arasında | Pazarlık Usulü",
  "kisi_sayisi": 250,
  "personel_sayisi": 17,
  "ogun_sayisi": 3,
  "gun_sayisi": 365,
  "tahmini_butce": 2850000,
  "teslim_suresi": "7 gün",
  "ihale_tarihi": "2025-01-15",
  "teklif_son_tarih": "2025-01-20",
  "ise_baslama_tarihi": "2025-02-01",
  "ozel_sartlar": ["Şart 1", "Şart 2"],
  "riskler": ["Risk 1", "Risk 2"],
  "_sources": [
    {
      "field": "kisi_sayisi",
      "value": 250,
      "document": "PDF Sayfa 2 - Tablo",
      "proof": "Tablolardaki toplam: 6+11=17",
      "confidence": 0.95
    }
  ],
  "guven_skoru": 0.85
}
\`\`\`

⚠️ ÖNEMLİ KURALLAR:
1. SADECE JSON formatında cevap ver!
2. Tüm sayılar NUMBER olmalı, string değil!
3. Görsel tabloları dikkatlice oku
4. Bulamadığın bilgiler için null kullan
5. _sources'da hangi sayfadan bulduğunu belirt

ŞİMDİ PDF'İ GÖRSEL OLARAK ANALİZ ET VE VERİYİ ÇIKAR!`;
  }
}