import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiProvider {
  private apiKey: string;
  private model: string;
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "";
    this.model = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";

    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is missing in environment variables");
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);

    console.log("=== GEMINI PROVIDER INIT ===");
    console.log("API Key exists:", !!this.apiKey);
    console.log("API Key length:", this.apiKey.length);
    console.log("Model:", this.model);
  }

  /**
   * Web search ile fiyat çekme - GERÇEK MARKET SİTELERİNDEN
   */
  async searchPrices(
    productName: string,
    options?: {
      market?: string;
      brand?: string;
      category?: string;
    }
  ): Promise<string> {
    try {
      console.log("=== GEMINI WEB SEARCH BAŞLADI ===");
      console.log("Product:", productName);
      console.log("Market:", options?.market || "TÜM MARKETLER");
      console.log("Brand:", options?.brand || "Tüm markalar");

      // Gemini 2.0 Flash model with grounding (web search)
      const model = this.genAI.getGenerativeModel({
        model: this.model,
      });

      const prompt = this.buildSearchPrompt(productName, options);

      console.log("Gemini'ye web search isteği gönderiliyor...");
      const startTime = Date.now();

      // Google Search ile gerçek fiyatları çek
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4000,
        },
        // Web search aktif
        tools: [
          {
            googleSearch: {},
          },
        ],
      });

      const processingTime = Date.now() - startTime;
      console.log(`Gemini response received in ${processingTime}ms`);

      const response = result.response;
      const text = response.text();

      console.log("=== GEMINI WEB SEARCH TAMAMLANDI ===");
      console.log("Response length:", text.length);

      return text;
    } catch (error) {
      console.error("=== GEMINI WEB SEARCH ERROR ===", error);
      throw error;
    }
  }

  private buildSearchPrompt(
    productName: string,
    options?: {
      market?: string;
      brand?: string;
      category?: string;
    }
  ): string {
    const market = options?.market;
    const brand = options?.brand;

    if (market) {
      // Tek market için
      return `Sen bir fiyat araştırma uzmanısın. Google'da ara ve ${market} marketinin resmi web sitesinden "${productName}" ürününün GERÇEK GÜNCEL fiyatını bul.

GÖREV:
1. "${market} ${productName} fiyat" şeklinde Google'da ara
2. ${market} marketinin resmi sitesine (${this.getMarketUrl(market)}) git
3. Ürünü sitede bul
4. Fiyatı, paket boyutunu, markasını kaydet

🚨 KRİTİK - ÜRÜN İSMİ VE CONFIDENCE 🚨
- Mutlaka ${market} sitesinden al (başka market olmasın!)
- Gerçek, güncel fiyat olmalı (tahmin değil!)
- "productName" alanına ${market} SİTESİNDEKİ TAM ÜRÜN ADINI YAZ!
  * Market sitesinde "Kesme Şeker" yazıyorsa → productName: "Kesme Şeker"
  * Kullanıcının yazdığını değil, SİTEDEKİ GERÇEK ADI kullan!

ÖRNEKLER:
  * Kullanıcı: "kes şeker" → ${market} sitesinde: "Kesme Şeker" → productName: "Kesme Şeker"
  * Kullanıcı: "tel kedayıf" → ${market} sitesinde: "Tel Kadayıf" → productName: "Tel Kadayıf"

CONFIDENCE BELİRLEME:
  * Kullanıcının yazdığı = Sitedeki isim → confidence: 0.95-1.0
  * Küçük fark (büyük/küçük harf) → confidence: 0.7-0.85
  * Eksik kelime ("kes" vs "kesme") → confidence: 0.5-0.7
  * Tamamen farklı → confidence: 0.3-0.5

- Paket boyutunu ve markasını da al
- Uygun birimi seç:
  * Bakliyat, sebze, et → "kg"
  * Sıvı yağ, süt → "litre"
  * Paketlenmiş hazır ürün → "adet"

CEVAP FORMATI (SADECE JSON):
{
  "productName": "gerçek bulduğun ürün adı",
  "price": 249.00,
  "unit": "kg",
  "source": "${market}",
  "brand": "marka adı",
  "packageSize": 0.5,
  "sourceUrl": "${this.getMarketUrl(market)}",
  "confidence": 0.9
}

ÖNEMLİ:
- price ve packageSize NUMBER olmalı, string DEĞİL!
- Ondalık ayırıcı NOKTA olmalı (249.00), virgül OLMAZ (249,00)!
- "searchResult" alanını ÇIKARMA, sadece yukarıdaki alanlar!

SADECE JSON döndür, başka metin yazma!`;
    } else {
      // Çoklu market için
      return `Sen bir fiyat karşılaştırma uzmanısın. Google'da ara ve Türkiye'deki 5 farklı marketin resmi web sitelerinden "${productName}" ürününün GERÇEK GÜNCEL fiyatlarını bul.

MARKETLER:
- Metro (metro.com.tr)
- Migros (migros.com.tr)
- A101 (a101.com.tr)
- ŞOK Market (sokmarket.com.tr)
- BİM (bim.com.tr)

GÖREV:
1. Her market için Google'da "[market adı] ${productName} fiyat" ara
2. Her marketin resmi sitesine git
3. Ürünü bul, fiyatını, paket boyutunu, markasını kaydet
4. TAM 5 market için ayrı ayrı fiyat bul

⚠️ ÜRÜN BULUNAMAZSA:
Eğer "${productName}" hiçbir markette bulunamazsa veya tamamen yanlış yazılmışsa:
{
  "notFound": true,
  "suggestion": "doğru ürün adı"
}
SADECE BU ŞEKİLDE CEVAP VER ve JSON array döndürme!

Örnek: "tel kedayıf" → {"notFound": true, "suggestion": "Tel Kadayıf"}

🚨 KRİTİK - ÜRÜN İSMİ VE CONFIDENCE 🚨
- Her market için AYRI AYRI Google araması yap
- Gerçek, güncel fiyatlar olmalı (tahmin değil!)
- "productName" alanına MARKETİN SİTESİNDEKİ TAM ÜRÜN ADINI YAZ!
  * Market sitesinde "Kesme Şeker" yazıyorsa → productName: "Kesme Şeker"
  * Market sitesinde "Tel Kadayıf" yazıyorsa → productName: "Tel Kadayıf"
  * Kullanıcının yazdığını değil, SİTEDEKİ GERÇEK ADI kullan!

ÖRNEKLER:
  * Kullanıcı: "kes şeker" → Sitede: "Kesme Şeker" → productName: "Kesme Şeker"
  * Kullanıcı: "tel kedayıf" → Sitede: "Tel Kadayıf" → productName: "Tel Kadayıf"
  * Kullanıcı: "nohut" → Sitede: "9mm Yerli Nohut" → productName: "9mm Yerli Nohut"
  * Kullanıcı: "dmates" → Sitede: "Domates" → productName: "Domates"

CONFIDENCE BELİRLEME:
  * Kullanıcının yazdığı = Sitedeki isim (tam eşleşme) → confidence: 0.95-1.0
  * Küçük fark (büyük/küçük harf, "ş"→"s") → confidence: 0.7-0.85
  * Eksik kelime ("kes şeker" vs "kesme şeker") → confidence: 0.5-0.7
  * Tamamen farklı ("dmates" vs "domates") → confidence: 0.3-0.5
  * Farklı ürün (kullanıcı "elma" yazmış, "armut" buldun) → confidence: 0.1-0.3

- Her marketin kendi paket boyutu farklı olabilir
- Markaları siteden aynen kopyala
- TÜM MARKETLERDE AYNI productName olmalı (sitedeki standart adı kullan)

**🚨 KRİTİK - BİRİM TUTARLILIĞI 🚨**
KURAL: HER 5 MARKETTE AYNI "unit" DEĞERİ OLMALI!

❌ YANLIŞ ÖRNEK (KABUL EDİLMEZ):
[
  {"source": "Metro", "unit": "kg", ...},
  {"source": "BİM", "unit": "adet", ...}  ← FARKLI BİRİM, YANLIŞ!
]

✅ DOĞRU ÖRNEK:
[
  {"source": "Metro", "unit": "kg", ...},
  {"source": "BİM", "unit": "kg", ...},
  {"source": "Migros", "unit": "kg", ...},  ← HEPSİ AYNI BİRİM!
  {"source": "A101", "unit": "kg", ...},
  {"source": "ŞOK", "unit": "kg", ...}
]

BİRİM SEÇİMİ:
- Bakliyat (nohut, mercimek), sebze, et → "kg" (hepsinde!)
- Sıvı (yağ, süt) → "litre" (hepsinde!)
- Paket ürün (mantı paketi) → "kg" (hamur ağırlığı - hepsinde!)

EĞER BİR MARKETTE FARKLI BİRİM GÖRÜRSEN:
- Onu diğer marketlerin birimine ÇEVIR
- Örnek: Migros'ta "500 gram" yazıyorsa → "0.5 kg" yap

CEVAP FORMATI (SADECE JSON ARRAY):
[
  {
    "productName": "gerçek bulduğun ürün adı",
    "price": 249.00,
    "unit": "kg",
    "source": "Metro",
    "brand": "marka adı",
    "packageSize": 5,
    "sourceUrl": "metro.com.tr",
    "confidence": 0.9
  },
  {
    "productName": "gerçek bulduğun ürün adı",
    "price": 56.95,
    "unit": "kg",
    "source": "Migros",
    "brand": "marka adı",
    "packageSize": 1,
    "sourceUrl": "migros.com.tr",
    "confidence": 0.85
  },
  ... (5 market - HEPSİ AYNI "unit" ve "productName" DEĞERİ!)
]

ÖNEMLİ:
- price ve packageSize NUMBER olmalı, string DEĞİL!
- Ondalık ayırıcı NOKTA olmalı (56.95), virgül OLMAZ (56,95)!
- "searchResult" alanını ÇIKARMA, sadece yukarıdaki alanlar!
- TAM 5 market döndür!

SADECE JSON ARRAY döndür, başka metin yazma!`;
    }
  }

  private getMarketUrl(market: string): string {
    const urls: Record<string, string> = {
      Metro: "metro.com.tr",
      Migros: "migros.com.tr",
      A101: "a101.com.tr",
      ŞOK: "sokmarket.com.tr",
      BİM: "bim.com.tr",
      Carrefour: "carrefoursa.com",
    };

    return urls[market] || "market sitesi";
  }

  /**
   * Basit text generation - öneri için kullanılacak
   */
  async generateText(prompt: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.model,
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100,
        },
      });

      return result.response.text();
    } catch (error) {
      console.error("Gemini text generation error:", error);
      throw error;
    }
  }
}
