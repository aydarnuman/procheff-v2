import { AIConfig, ExtractedData, ContextualAnalysis } from "@/types/ai";
import { TableIntelligenceProvider } from "./table-intelligence-provider";

export class ClaudeProvider {
  private apiKey: string;
  private config: AIConfig;
  private tableIntelligenceProvider: TableIntelligenceProvider;

  constructor() {
    this.apiKey =
      process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";

    // İYİLEŞTİRME: API anahtarı kontrolü - HEMEN throw et, devam ettirme!
    if (!this.apiKey || this.apiKey === "PLACEHOLDER_GEÇERSIZ_ANAHTAR" || this.apiKey.trim().length === 0) {
      const errorMessage = `
❌ ANTHROPIC API ANAHTARI EKSİK VEYA GEÇERSİZ!

Sistem çalışamaz. Lütfen:
1. Proje root dizininde .env.local dosyası oluşturun
2. Aşağıdaki satırı ekleyin:
   ANTHROPIC_API_KEY=sk-ant-api03-...

🔗 API anahtarı almak için: https://console.anthropic.com/

Mevcut durum:
- API Key var mı: ${!!this.apiKey}
- API Key uzunluğu: ${this.apiKey?.length || 0}
- Placeholder mı: ${this.apiKey === "PLACEHOLDER_GEÇERSIZ_ANAHTAR"}
      `;
      console.error(errorMessage);
      throw new Error("ANTHROPIC_API_KEY is missing or invalid. Cannot initialize ClaudeProvider.");
    }

    // Geçici fix: doğru model adını kullan - HARD CODED to bypass env issues
    const modelName = "claude-sonnet-4-20250514"; // Claude Sonnet 4 (May 2025) - Stable and working model

    this.config = {
      provider: "claude",
      model: modelName.trim(), // Boşlukları temizle
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || "16000"), // Increased to 16K for long tender docs
      temperature: parseFloat(process.env.AI_MODEL_TEMPERATURE || "0.3"), // Lower for more consistent, factual outputs
    };

    console.log("=== CLAUDE PROVIDER INIT ===");
    console.log("API Key exists:", !!this.apiKey);
    console.log("API Key length:", this.apiKey.length);
    console.log("API Key first 7 chars:", this.apiKey.substring(0, 7)); // sk-ant-... kontrolü için
    console.log("Model:", this.config.model);
    console.log("Max Tokens:", this.config.maxTokens);
    console.log("Temperature:", this.config.temperature);

    if (!this.config.model) {
      throw new Error("AI model configuration is missing");
    }

    // Geçerli model adlarını kontrol et (2025 Claude 4.x models)
    const validModels = [
      "claude-sonnet-4-5-20250929", // Claude Sonnet 4.5 (September 2025) - Latest
      "claude-sonnet-4-20250514",   // Claude Sonnet 4 (May 2025) - Stable
      "claude-opus-4-1-20250805",   // Claude Opus 4.1 (August 2025)
      "claude-opus-4-20250514",     // Claude Opus 4 (May 2025)
      "claude-haiku-4-5-20251001",  // Claude Haiku 4.5 (October 2025)
    ];

    if (!validModels.includes(this.config.model)) {
      console.warn(`⚠️ Model adı geçerli listede değil: ${this.config.model}`);
      console.warn("Geçerli modeller:", validModels.join(", "));
    }

    // Initialize table intelligence provider
    this.tableIntelligenceProvider = new TableIntelligenceProvider();
  }

  /**
   * Metni sayfalara böl (OCR'den gelen "--- Sayfa XX Sonu ---" işaretlerine göre)
   */
  private splitIntoPages(text: string): string[] {
    const pageRegex = /--- Sayfa \d+ Sonu ---/g;
    const pages = text.split(pageRegex).filter(page => page.trim().length > 50);
    console.log(`Metin ${pages.length} sayfaya bölündü`);
    return pages;
  }

  /**
   * Uzun metinleri chunk'lara böl (max 60000 karakter per chunk - Claude Sonnet 4 için optimize)
   */
  private chunkText(text: string, maxChunkSize: number = 60000): string[] {
    const pages = this.splitIntoPages(text);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const page of pages) {
      if (currentChunk.length + page.length > maxChunkSize && currentChunk) {
        chunks.push(currentChunk);
        currentChunk = page;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + page;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    console.log(`Toplam ${chunks.length} chunk oluşturuldu`);
    return chunks;
  }

  async extractStructuredData(text: string): Promise<ExtractedData> {
    console.log("=== CLAUDE EXTRACTION BAŞLADI ===");
    console.log("Text length:", text.length);
    console.log("Model:", this.config.model);

    // Eğer metin çok uzunsa, chunk'lara böl ve her chunk'ı işle
    // 150K karakterden fazlası için chunking kullan (prompt + text ~ 180K chars = ~135K tokens)
    if (text.length > 150000) {
      console.log("⚠️ Metin çok uzun, chunk'lara bölünüyor...");
      return await this.extractFromChunks(text);
    }

    const prompt = this.buildExtractionPrompt(text);

    try {
      console.log("Claude API'ye istek gönderiliyor...");
      const requestStart = Date.now();

      const requestBody = {
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      };

      console.log("Request Body:", JSON.stringify(requestBody, null, 2));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(requestBody),
      });

      const requestTime = Date.now() - requestStart;
      console.log(`Claude API response time: ${requestTime}ms`);
      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("=== CLAUDE API ERROR ===");
        console.error("Status:", response.status, response.statusText);
        console.error(
          "Headers:",
          Object.fromEntries(response.headers.entries())
        );
        console.error("Raw Error Response:", errorText);
        console.error("Request Model:", this.config.model);
        console.error("Request Max Tokens:", this.config.maxTokens);

        let errorMessage = `Claude API ${response.status}: ${response.statusText}`;
        let errorType = "UNKNOWN_ERROR";

        try {
          const errorData = JSON.parse(errorText);
          console.error("Parsed Error Data:", errorData);

          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          }
          if (errorData.error?.type) {
            errorType = errorData.error.type;
          }
        } catch (parseError) {
          console.error("Could not parse error response as JSON:", parseError);
          // Raw error text'i kontrol et
          if (errorText.includes("model")) {
            errorMessage = `Invalid model: ${this.config.model}. Raw response: ${errorText}`;
            errorType = "INVALID_MODEL";
          } else if (errorText.includes("authentication")) {
            errorMessage = "Invalid API key";
            errorType = "AUTH_ERROR";
          } else {
            errorMessage = `Claude API error: ${errorText}`;
          }
        }

        // Hata tipine göre özel mesajlar
        if (response.status === 400 && errorType === "INVALID_MODEL") {
          errorMessage += `\n\nGeçerli modeller (2025):\n- claude-sonnet-4-20250514 (önerilen)\n- claude-sonnet-4-5-20250929 (en yeni)\n- claude-opus-4-1-20250805\n- claude-haiku-4-5-20251001`;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("Claude API response received");

      if (
        !result.content ||
        !Array.isArray(result.content) ||
        result.content.length === 0
      ) {
        console.error("Invalid Claude API response structure:", result);
        throw new Error("Invalid response structure from Claude API");
      }

      const content = result.content[0]?.text;

      if (!content) {
        console.error("No content in Claude response:", result);
        throw new Error("No content returned from Claude API");
      }

      console.log("Claude response content length:", content.length);

      // Remove markdown code blocks if present (```json ... ```)
      let cleanedContent = content.trim();
      if (cleanedContent.startsWith("```json")) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, "").replace(/```\s*$/, "");
        console.log("Removed ```json code block wrapper");
      } else if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent.replace(/^```\s*/, "").replace(/```\s*$/, "");
        console.log("Removed ``` code block wrapper");
      }

      // JSON parse with error handling
      try {
        const extractedData = JSON.parse(cleanedContent) as ExtractedData;
        console.log("JSON parsing successful");
        console.log("Extracted data keys:", Object.keys(extractedData));

        const validatedData = this.validateExtractedData(extractedData);
        console.log("=== CLAUDE EXTRACTION TAMAMLANDI ===");
        return validatedData;
      } catch (parseError) {
        console.error("=== JSON PARSE ERROR ===");
        console.error("Parse Error:", parseError);
        console.error(
          "Raw Content (first 500 chars):",
          content.substring(0, 500)
        );
        console.error(
          "Raw Content (last 500 chars):",
          content.substring(Math.max(0, content.length - 500))
        );
        throw new Error(
          `Failed to parse Claude response as JSON: ${
            parseError instanceof Error
              ? parseError.message
              : String(parseError)
          }`
        );
      }
    } catch (error) {
      console.error("=== CLAUDE EXTRACTION ERROR ===", error);

      if (error instanceof Error) {
        if (error.message.includes("fetch")) {
          throw new Error(
            "Claude API network error. Please check your internet connection."
          );
        }
        if (error.message.includes("401")) {
          throw new Error(
            "Claude API authentication failed. Please check your API key."
          );
        }
        if (error.message.includes("429")) {
          throw new Error(
            "Claude API rate limit exceeded. Please wait a moment and try again."
          );
        }
        if (
          error.message.includes("500") ||
          error.message.includes("502") ||
          error.message.includes("503")
        ) {
          throw new Error(
            "Claude API server error. Please try again in a few minutes."
          );
        }
      }

      throw error;
    }
  }

  /**
   * Tek bir chunk'ı işle
   */
  /**
   * 🔁 RETRY HELPER - Exponential backoff ile retry
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 📊 MONITORING İYİLEŞTİRME - Detaylı chunk processing
   * 🔁 ERROR HANDLING - Retry mekanizması ekli (3 deneme, exponential backoff)
   */
  private async processSingleChunk(
    chunk: string,
    chunkIndex: number,
    totalChunks: number,
    maxRetries = 3
  ): Promise<Partial<ExtractedData> | null> {
    const chunkStart = Date.now(); // ⏱️ MONITORING: Chunk süresi

    // 🔁 RETRY LOOP
    for (let attemptNumber = 1; attemptNumber <= maxRetries; attemptNumber++) {
      try {
        // İlk denemede farklı log
        if (attemptNumber === 1) {
          console.log(`\n🔄 Chunk ${chunkIndex + 1}/${totalChunks} işleniyor... (${Math.round(chunk.length / 1000)}K karakter)`);
        } else {
          console.log(`\n🔁 Chunk ${chunkIndex + 1}/${totalChunks} - Retry ${attemptNumber}/${maxRetries}...`);
        }

        const apiStart = Date.now(); // ⏱️ API çağrı süresi

        const prompt = this.buildExtractionPrompt(chunk);
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001", // Haiku - hızlı model extraction için
            max_tokens: 8000, // Optimal değer - iyi çalışıyordu
            temperature: 0.7, // Normal değer
            messages: [{ role: "user", content: prompt }],
          }),
        });

        const apiDuration = Date.now() - apiStart; // ⏱️ API response süresi

        if (!response.ok) {
          // Rate limit (429) veya server error (5xx) - retry yapılabilir
          if (response.status === 429 || response.status >= 500) {
            console.warn(`⚠️ Chunk ${chunkIndex + 1} - HTTP ${response.status} (retry yapılabilir)`);

            // Son denemeyse hata fırlat
            if (attemptNumber === maxRetries) {
              console.error(`❌ Chunk ${chunkIndex + 1} - Tüm retry denemeleri başarısız (HTTP ${response.status})`);
              return null;
            }

            // Exponential backoff: 1s, 2s, 4s
            const waitTime = 1000 * Math.pow(2, attemptNumber - 1);
            console.log(`⏳ ${waitTime}ms bekleniyor (exponential backoff)...`);
            await this.sleep(waitTime);
            continue; // Retry
          }

          // 4xx hatası - retry yapmaya gerek yok
          const errorBody = await response.text();
          console.error(`❌ Chunk ${chunkIndex + 1} - İstek hatası: HTTP ${response.status}`);
          console.error(`   Chunk size: ${chunk.length} chars (~${Math.round(chunk.length * 0.75)} tokens)`);
          console.error(`   Error body: ${errorBody.substring(0, 500)}`);

          // 400 hatası genelde input çok büyük demek
          if (response.status === 400) {
            console.error(`⚠️ CHUNK ÇOK BÜYÜK OLABİLİR - 60K karakter yerine daha küçük deneyin`);
          }

          return null;
        }

        const result = await response.json();

        // ⏱️ MONITORING: Token usage + maliyet + süre
        if (result.usage) {
          const inputTokens = result.usage.input_tokens || 0;
          const outputTokens = result.usage.output_tokens || 0;
          const totalTokens = inputTokens + outputTokens;
          const estimatedCost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;

          console.log(`📊 Token Kullanımı (Chunk ${chunkIndex + 1}):`);
          console.log(`   Input: ${inputTokens.toLocaleString()} tokens`);
          console.log(`   Output: ${outputTokens.toLocaleString()} tokens`);
          console.log(`   Toplam: ${totalTokens.toLocaleString()} tokens`);
          console.log(`   💰 Maliyet: $${estimatedCost.toFixed(4)}`);
          console.log(`   ⏱️ API Süresi: ${apiDuration}ms`);
        }

        const content = result.content?.[0]?.text;

        if (content) {
          let cleanedContent = content.trim();
          if (cleanedContent.startsWith("```json")) {
            cleanedContent = cleanedContent.replace(/^```json\s*/, "").replace(/```\s*$/, "");
          }

          try {
            const chunkData = JSON.parse(cleanedContent) as Partial<ExtractedData>;

            // ⏱️ MONITORING: Toplam chunk süresi
            const chunkDuration = Date.now() - chunkStart;
            console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} başarıyla işlendi`);
            console.log(`   ⏱️ Toplam Süre: ${chunkDuration}ms (${Math.round(chunkDuration / 1000)}s)`);

            return chunkData;
          } catch (parseError: any) {
            console.warn(`⚠️ Chunk ${chunkIndex + 1} - JSON parse hatası (attempt ${attemptNumber})`);

            // JSON parse hatası için retry (bazen API truncate edebiliyor)
            if (attemptNumber < maxRetries) {
              console.log(`🔁 JSON parse başarısız, retry deneniyor...`);
              await this.sleep(1000 * attemptNumber); // 1s, 2s, 3s
              continue; // Retry
            }

            // Son denemede detaylı log
            console.error(`❌ Chunk ${chunkIndex + 1} - JSON parse başarısız (tüm retry'lar tükendi)`);
            console.warn(`Geçersiz JSON (ilk 500 karakter):`);
            console.warn(cleanedContent.substring(0, 500));
            console.warn(`Hata konumu civarı (±100 karakter):`);
            const errorMatch = parseError.message?.match(/position (\d+)/);
            if (errorMatch) {
              const pos = parseInt(errorMatch[1]);
              console.warn(cleanedContent.substring(Math.max(0, pos - 100), Math.min(cleanedContent.length, pos + 100)));
            }
            return null;
          }
        }
      } catch (error: any) {
        console.error(`❌ Chunk ${chunkIndex + 1} - İşleme hatası (attempt ${attemptNumber}):`, error.message);

        // Network error veya timeout - retry yapılabilir
        if (attemptNumber < maxRetries) {
          const waitTime = 1000 * Math.pow(2, attemptNumber - 1);
          console.log(`⏳ ${waitTime}ms bekleniyor (exponential backoff)...`);
          await this.sleep(waitTime);
          continue; // Retry
        }

        console.error(`❌ Chunk ${chunkIndex + 1} - Tüm retry denemeleri başarısız`);
        return null;
      }
    }

    return null;
  }

  /**
   * Uzun metinleri chunk'lara böl ve paralel işle (HIZLI!)
   */
  private async extractFromChunks(text: string): Promise<ExtractedData> {
    // Chunk boyutunu küçülttük: 60K karakter (~45K tokens)
    // Claude prompt ~5K karakter + 60K text = 65K karakter = ~49K tokens (200K limit içinde)
    const chunks = this.chunkText(text, 60000);
    console.log(`⚠️ Text too long (${text.length} chars), chunking into ${chunks.length} chunks of 60K chars each`);
    console.log("⚡ PARALEL İŞLEME AKTIF - 3 chunk aynı anda işleniyor");

    const BATCH_SIZE = 3; // Aynı anda 3 chunk işle (rate limit için güvenli)
    const allExtractedData: Partial<ExtractedData>[] = [];

    // Chunk'ları batch'lere böl ve paralel işle
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const batchStartIndex = i;

      console.log(`\n📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchChunks.length} chunk paralel işleniyor...`);

      // Bu batch'teki tüm chunk'ları paralel işle
      const batchPromises = batchChunks.map((chunk, idx) =>
        this.processSingleChunk(chunk, batchStartIndex + idx, chunks.length)
      );

      const batchResults = await Promise.all(batchPromises);

      // Başarılı sonuçları ekle
      batchResults.forEach((result) => {
        if (result) {
          allExtractedData.push(result);
        }
      });

      // Sonraki batch'e geçmeden önce kısa bekleme (rate limit)
      if (i + BATCH_SIZE < chunks.length) {
        console.log("⏱️  Sonraki batch için 3 saniye bekleniyor...");
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log(`\n✅ Toplam ${allExtractedData.length}/${chunks.length} chunk başarıyla işlendi`);

    // Tüm chunk sonuçlarını birleştir
    console.log("Chunk sonuçları birleştiriliyor...");
    const mergedData = this.mergeChunkResults(allExtractedData);

    return this.validateExtractedData(mergedData as ExtractedData);
  }

  /**
   * Chunk'lardan gelen sonuçları birleştir (güven skoruna göre en güvenilir veriyi seç)
   * İYİLEŞTİRME: "En uzun string" yerine "en yüksek güven skoru" kullanılıyor
   */
  private mergeChunkResults(chunks: Partial<ExtractedData>[]): Partial<ExtractedData> {
    if (chunks.length === 0) {
      throw new Error("Hiçbir chunk başarıyla işlenemedi");
    }

    console.log(`📊 ${chunks.length} chunk birleştiriliyor...`);

    // Chunk'ları güven skoruna göre sırala (en güvenilir önce)
    const sortedChunks = chunks
      .filter(c => c.guven_skoru && c.guven_skoru > 0)
      .sort((a, b) => (b.guven_skoru || 0) - (a.guven_skoru || 0));

    if (sortedChunks.length === 0) {
      console.warn("⚠️  Hiçbir chunk'ta güven skoru yok, ilk chunk kullanılıyor");
      return { ...chunks[0] };
    }

    // En güvenilir chunk'ı temel al
    const bestChunk = sortedChunks[0];
    const merged: Partial<ExtractedData> = { ...bestChunk };

    console.log(`✓ Temel chunk (güven: ${(bestChunk.guven_skoru || 0) * 100}%)`);

    // Diğer chunk'lardan SADECE eksik olan (null/undefined) alanları tamamla
    for (let i = 1; i < sortedChunks.length; i++) {
      const chunk = sortedChunks[i];
      const chunkConfidence = (chunk.guven_skoru || 0) * 100;

      // String değerler - sadece boşsa doldur
      if (!merged.kurum && chunk.kurum) {
        merged.kurum = chunk.kurum;
        console.log(`  ← kurum eklendi (chunk ${i + 1}, güven: ${chunkConfidence}%)`);
      }
      if (!merged.ihale_turu && chunk.ihale_turu) {
        merged.ihale_turu = chunk.ihale_turu;
        console.log(`  ← ihale_turu eklendi (chunk ${i + 1}, güven: ${chunkConfidence}%)`);
      }
      if (!merged.teslim_suresi && chunk.teslim_suresi) {
        merged.teslim_suresi = chunk.teslim_suresi;
        console.log(`  ← teslim_suresi eklendi (chunk ${i + 1}, güven: ${chunkConfidence}%)`);
      }

      // Sayısal değerler - sadece null/0 ise doldur
      if ((!merged.tahmini_butce || merged.tahmini_butce === 0) && chunk.tahmini_butce && chunk.tahmini_butce > 0) {
        merged.tahmini_butce = chunk.tahmini_butce;
        console.log(`  ← tahmini_butce eklendi: ${chunk.tahmini_butce.toLocaleString()} TL`);
      }
      if ((!merged.kisi_sayisi || merged.kisi_sayisi === 0) && chunk.kisi_sayisi && chunk.kisi_sayisi > 0) {
        merged.kisi_sayisi = chunk.kisi_sayisi;
        console.log(`  ← kisi_sayisi eklendi: ${chunk.kisi_sayisi}`);
      }
      if ((!merged.ogun_sayisi || merged.ogun_sayisi === 0) && chunk.ogun_sayisi && chunk.ogun_sayisi > 0) {
        merged.ogun_sayisi = chunk.ogun_sayisi;
        console.log(`  ← ogun_sayisi eklendi: ${chunk.ogun_sayisi}`);
      }
      if ((!merged.gun_sayisi || merged.gun_sayisi === 0) && chunk.gun_sayisi && chunk.gun_sayisi > 0) {
        merged.gun_sayisi = chunk.gun_sayisi;
        console.log(`  ← gun_sayisi eklendi: ${chunk.gun_sayisi}`);
      }

      // Diziler - birleştir ve unique yap (tüm chunk'lardan topla)
      if (chunk.riskler && Array.isArray(chunk.riskler)) {
        merged.riskler = Array.from(new Set([
          ...(merged.riskler || []),
          ...chunk.riskler
        ]));
      }

      if (chunk.ozel_sartlar && Array.isArray(chunk.ozel_sartlar)) {
        merged.ozel_sartlar = Array.from(new Set([
          ...(merged.ozel_sartlar || []),
          ...chunk.ozel_sartlar
        ]));
      }

      // Kanıtlar objesi - merge et (tüm kanıtları birleştir)
      if (chunk.kanitlar) {
        merged.kanitlar = {
          ...(merged.kanitlar || {}),
          ...chunk.kanitlar
        };
      }
    }

    // Final güven skoru: En yüksek güven skorunu kullan
    merged.guven_skoru = bestChunk.guven_skoru;

    console.log("✅ Birleştirme tamamlandı:");
    console.log(`   Kurum: ${merged.kurum || "YOK"}`);
    console.log(`   İhale Türü: ${merged.ihale_turu || "YOK"}`);
    console.log(`   Kişi Sayısı: ${merged.kisi_sayisi || "YOK"}`);
    console.log(`   Tahmini Bütçe: ${merged.tahmini_butce ? merged.tahmini_butce.toLocaleString() + " TL" : "YOK"}`);
    console.log(`   Final Güven Skoru: ${((merged.guven_skoru || 0) * 100).toFixed(1)}%`);
    console.log(`   Riskler: ${(merged.riskler || []).length} adet`);
    console.log(`   Özel Şartlar: ${(merged.ozel_sartlar || []).length} adet`);

    return merged;
  }

  async analyzeContext(
    extractedData: ExtractedData
  ): Promise<ContextualAnalysis> {
    // 🧠 YENİ: Tablolar varsa, önce Table Intelligence çalıştır
    if (extractedData.tablolar && extractedData.tablolar.length > 0) {
      console.log("\n🧠 Tablo Intelligence çalıştırılıyor (Bağlamsal Analiz fazında)...");
      try {
        const intelligence = await this.tableIntelligenceProvider.extractIntelligence(
          extractedData.tablolar
        );

        // Tarih bilgilerini ana data'ya ekle (öncelikli)
        if (intelligence.ihale_tarihi && !extractedData.ihale_tarihi) {
          extractedData.ihale_tarihi = intelligence.ihale_tarihi;
          console.log(`    ✅ ihale_tarihi: ${intelligence.ihale_tarihi} (TABLO)`);
        }
        if (intelligence.teklif_son_tarih && !extractedData.teklif_son_tarih) {
          extractedData.teklif_son_tarih = intelligence.teklif_son_tarih;
          console.log(`    ✅ teklif_son_tarih: ${intelligence.teklif_son_tarih} (TABLO)`);
        }
        if (intelligence.ise_baslama_tarih && !extractedData.ise_baslama_tarih) {
          extractedData.ise_baslama_tarih = intelligence.ise_baslama_tarih;
          console.log(`    ✅ ise_baslama_tarih: ${intelligence.ise_baslama_tarih} (TABLO)`);
        }
        if (intelligence.ihale_suresi && !extractedData.ihale_suresi) {
          extractedData.ihale_suresi = intelligence.ihale_suresi;
          console.log(`    ✅ ihale_suresi: ${intelligence.ihale_suresi} (TABLO)`);
        }

        // Personel sayısını güncelle (tablolardan daha doğru)
        if (intelligence.personel_detaylari?.toplam_personel && !extractedData.personel_sayisi) {
          extractedData.personel_sayisi = intelligence.personel_detaylari.toplam_personel;
          console.log(`    ✅ personel_sayisi: ${extractedData.personel_sayisi} (TABLO INTELLIGENCE)`);
        }

        // Tablo intelligence'ı ekle
        extractedData.tablo_intelligence = intelligence;
        console.log(`    ✅ Tablo Intelligence eklendi (güven: ${Math.round(intelligence.guven_skoru * 100)}%)`);
      } catch (intelligenceError) {
        console.warn("⚠️ Tablo intelligence extraction başarısız:", intelligenceError);
        // Continue without intelligence
      }
    }

    const prompt = this.buildAnalysisPrompt(extractedData);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: 0.3, // Balanced for detailed professional analysis
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Claude API error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      const content = result.content[0]?.text;

      if (!content) {
        throw new Error("No content returned from Claude API");
      }

      // Remove markdown code blocks if present
      let cleanedContent = content.trim();
      if (cleanedContent.startsWith("```json")) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, "").replace(/```\s*$/, "");
        console.log("Removed ```json code block wrapper from analysis");
      } else if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent.replace(/^```\s*/, "").replace(/```\s*$/, "");
        console.log("Removed ``` code block wrapper from analysis");
      }

      try {
        return JSON.parse(cleanedContent) as ContextualAnalysis;
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        console.error("Raw Content:", content);
        throw new Error("Failed to parse Claude analysis response as JSON");
      }
    } catch (error) {
      console.error("Claude Analysis Error:", error);
      throw error;
    }
  }

  private buildExtractionPrompt(text: string): string {
    // Metin çok uzunsa (>100K), prompt'u kısalt
    const isLongText = text.length > 100000;
    const promptHeader = isLongText
      ? `İhale analisti olarak aşağıdaki metinden kritik bilgileri çıkar.`
      : `Sen profesyonel bir kamu ihale analistisin. Verilen ihale şartnamesinden veri çıkaracaksın.`;

    return `${promptHeader}

# İHALE METNİ
${text}

# GÖREV
${isLongText ? 'Metni analiz et ve JSON formatında veri çıkar.' : 'KAYNAK TAKİBİ yaparak her bilgiyi hangi dosyadan aldığını belirt.'}

**Dosya Etiketlerini Tespit Et:**
- Metinde "=== DOSYA: dosya_adı ===" etiketleri varsa, ÇOKLU DOSYA yüklenmiş demektir
- Her dosya etiketi, o noktadan sonraki içeriğin hangi belgeden geldiğini gösterir
- Örnek: "=== DOSYA: Teknik_Şartname.doc ===" → bu etiketin altındaki tüm içerik bu dosyadan

**Kaynak Takibi Kuralları:**
1. Her veriyi hangi dosyadan aldığını "_sources" objesine yaz
2. Dosya adını tam olarak yaz (etiketin içindeki adı kullan)
3. Mümkünse sayfa/tablo/bölüm bilgisini de ekle
4. Birden fazla dosyadan aynı bilgi varsa, en detaylısını kullan ve kaynak olarak belirt

**Tipik Dosya Türleri ve İçerikleri:**
- **Teknik Şartname** (.doc/.docx): Kişi sayıları, öğün sayıları, porsiyon bilgileri, hijyen kuralları, personel gereksinimleri, menu örnek
- **İhale İlanı** (.pdf): Tahmini bütçe, ihale türü, ihale tarihleri, teklif verme tarihleri, kurumsal bilgiler
- **Zeylname/Ek** (.pdf/.doc): Değişiklikler, güncellemeler, ek şartlar

# GÖREV
Yukarıdaki metni analiz et, dosya etiketlerine dikkat ederek hangi bilginin hangi dosyadan geldiğini belirle ve JSON formatında veri çıkar.

## ARANACAK BİLGİLER

### 1. KURUM (zorunlu)
Başlıkta veya ilk 500 kelimede kurum adını bul.
- "... İL MÜDÜRLÜĞÜ" ile biten kelime grubu
- "... BAKANLIĞI", "... BELEDİYESİ" gibi ifadeler
- Tam adı yaz (kısaltma yapma)

### 2. İHALE TÜRÜ
"Açık İhale", "Belli İstekliler Arası", "Pazarlık Usulü" kelimelerini ara.
Bulamazsan: null

### 3. KİŞİ SAYISI (number) - ÇOK ÖNEMLİ!

**AMAÇ:** Kaç kişiye yemek yapılacak? (Hizmet alan sayısı, personel değil!)

**BASİT KURALLAR:**

1️⃣ **TABLOLARDA ARA:**
   - "Kahvaltı, Öğle, Akşam, Toplam" kolonlu tablolar var mı?
   - "Toplam" sütunundaki sayıları BUL ve TOPLA
   - Örnek: Tablo 1'de 6, Tablo 2'de 11 → Toplam: 17 kişi

2️⃣ **KURULUŞ LİSTESİ VAR MI?**
   - Birden fazla kuruluş/birim/dağıtım yeri var mı?
   - HER kuruluştaki kişi sayısını bul ve TOPLA
   - ⚠️ Kuruluş sayısı ≠ Kişi sayısı! (17 kuruluş varsa, her birindeki kişileri say)

3️⃣ **DİREKT AÇIKLAMA:**
   - "500 kişiye yemek", "700 öğrenciye" gibi ifadeler ara

**⚠️ DİKKAT - YAPMA BUNLARI:**
- "8 personel tarafından yapılacak" → Bu PERSONEL, kişi değil! → null
- "1 aşçıbaşı, 3 aşçı..." şeklinde kadro listesi → Bu PERSONEL → null
- Sadece personel sayısı varsa → kisi_sayisi: null
- "17-Yüklenici", "5-Personel", "3-Malzeme" → Bu MADDE NUMARALARI! → null
- Tire (-) ile başlayan madde başlıkları → MADDE NO, veri değil! → null
- "Madde 15:", "Bent 8:", "Paragraf 12:" → Yapısal numaralar, veri değil! → null

**NASIL AÇIKLAYACAĞIN:**
"_sources" → "kisi_sayisi" → "kanit" alanına net yaz:
- "Tablo 1: 6 kişi, Tablo 2: 11 kişi → Toplam: 17"
- "Kuruluş A: 45, Kuruluş B: 30 → Toplam: 75"

Bulamazsan: null

### 4. TAHMİNİ BÜTÇE (number)
"Tahmini bedel", "Muhammen bedel", "Toplam tutar" ara.
Format: "1.500.000 TL" → 1500000
Bulamazsan: null

### 5. TARİHLER
- ihale_tarihi: "İlan tarihi" ara
- teklif_son_tarih: "Teklif verme tarihi" ara
Bulamazsan: null

## JSON FORMATI
{
  "kurum": "string",
  "ihale_turu": "string|null",
  "kisi_sayisi": number|null,
  "ogun_sayisi": 3,
  "gun_sayisi": 365,
  "tahmini_butce": number|null,
  "teslim_suresi": null,
  "ihale_tarihi": "string|null",
  "teklif_son_tarih": "string|null",
  "ise_baslama_tarih": null,
  "ihale_suresi": null,
  "dagitim_yontemi": null,
  "sertifikasyon_etiketleri": [],
  "ornek_menu_basliklari": [],
  "riskler": ["Risk 1", "Risk 2", "Risk 3"],
  "ozel_sartlar": ["Şart 1", "Şart 2"],
  "kanitlar": {},
  "guven_skoru": 0.8,
  "_sources": {
    "kurum": {
      "dosya": "İhale_İlanı.pdf",
      "sayfa": "Başlık bölümü",
      "kanit": "Bilecik Gençlik ve Spor İl Müdürlüğü"
    },
    "ihale_turu": {
      "dosya": "İhale_İlanı.pdf",
      "sayfa": "Genel bilgiler",
      "kanit": "Açık İhale Usulü"
    },
    "kisi_sayisi": {
      "dosya": "TEKNİK_ŞARTNAME-10.09.2025.doc",
      "sayfa": "Öğün sayıları tablosu - Tablo 1, 2, 3",
      "kanit": "Tablolardaki toplam sütunu: 6+6+5=17 kişi"
    },
    "tahmini_butce": {
      "dosya": "İhale_İlanı.pdf",
      "sayfa": "Mali bilgiler",
      "kanit": "Tahmini bedel: 1.500.000,00 TL"
    },
    "ogun_sayisi": {
      "dosya": "TEKNİK_ŞARTNAME-10.09.2025.doc",
      "sayfa": "Öğün sayıları tablosu başlıkları",
      "kanit": "Kahvaltı, Öğle, Akşam kolonları"
    },
    "gun_sayisi": {
      "dosya": "TEKNİK_ŞARTNAME-10.09.2025.doc",
      "sayfa": "Sözleşme süresi",
      "kanit": "365 gün"
    },
    "riskler": {
      "dosya": "TEKNİK_ŞARTNAME-10.09.2025.doc",
      "sayfa": "Özel şartlar ve kısıtlamalar bölümü"
    },
    "ozel_sartlar": {
      "dosya": "TEKNİK_ŞARTNAME-10.09.2025.doc + İhale_İlanı.pdf",
      "sayfa": "Teknik şartname maddeleri ve idari şartlar"
    }
  }
}

## _sources OBJESİ İÇİN DETAYLI KURALLAR

**Her alan için mutlaka kaynak belirt:**
- **dosya**: Tam dosya adı (etiketin içindeki adı kullan, örn: "TEKNİK_ŞARTNAME-10.09.2025.doc")
- **sayfa**: (opsiyonel ama önerilen) Sayfa numarası, tablo numarası veya bölüm adı
- **kanit**: (opsiyonel ama çok önemli) Orijinal metinden alınan kısa pasaj/sayı (30-50 kelime max)

**Örnekler:**

Kişi sayısı örneği:
- dosya: "Teknik_Şartname.doc"
- sayfa: "Tablo 1-3: Öğün sayıları"
- kanit: "Tablo1: 6 kişi, Tablo2: 6 kişi, Tablo3: 5 kişi - Toplam: 17 kişi"

Tahmini bütçe örneği:
- dosya: "İhale_İlanı.pdf"
- sayfa: "4. Madde - Mali hükümler"
- kanit: "Muhammen bedel: 2.850.000,00 TL (KDV Hariç)"

İhale türü örneği:
- dosya: "İhale_İlanı.pdf"
- kanit: "4734 sayılı KİK'in 19. maddesi Açık İhale Usulü"

**Birden fazla dosyadan aynı bilgi varsa:**
- dosya: "Teknik_Şartname.doc (ana kaynak) + İhale_İlanı.pdf (teyit)"
- sayfa: "TS: Tablo 2, İİ: Sayfa 1"
- kanit: "Her iki dosyada da 250 kişi belirtilmiş"

## KURALLAR
1. SADECE JSON döndür
2. Sayılar number tipinde olmalı
3. Bulamazsan null yaz
4. JSON'dan önce/sonra metin yazma

JSON:`;
  }

  private buildAnalysisPrompt(data: ExtractedData): string {
    return `Sen 15+ yıl deneyimli, profesyonel bir kamu ihale danışmanı ve maliyet analistisin. Çıkarılan verileri derinlemesine değerlendirip stratejik öneriler sunacaksın.

# ÇIKARILMIŞ VERİLER
${JSON.stringify(data, null, 2)}

# KAYNAK BİLGİSİ KULLANIMI
Yukarıdaki verilerde "_sources" objesi varsa, her bilginin hangi belgeden geldiğini gösterir:
- Farklı belgelerden gelen bilgiler arasında çelişki olup olmadığını kontrol et
- Teknik Şartname ve İhale İlanı arasındaki tutarsızlıkları belirt
- Eksik belgeler varsa (örn: sadece 1 dosya yüklenmişse) hangi bilgilerin doğrulanamadığını belirt
- Analiz yaparken hangi belgeden gelen bilgiyi kullandığını önerilerde göster

**Örnek analiz yaklaşımı:**
- "Kişi sayısı Teknik Şartname'den 250 kişi olarak belirlendi ancak İhale İlanı'nda bu bilgi teyit edilemedi - doğrulama için idareden onay alınmalı"
- "Tahmini bütçe İhale İlanı'nda 2.850.000 TL olarak belirtilmi��, bu tutar Teknik Şartname'deki kişi sayısı ve öğün detayları ile uyumlu"
- "Sadece tek dosya yüklendiği için tarihlerin çapraz kontrolü yapılamadı"

# GÖREV
Yukarıdaki verileri Türkiye kamu ihale piyasası koşullarında değerlendir, kaynak belgeler arasındaki tutarlılığı kontrol et ve detaylı bağlamsal analiz yap.

## ZORUNLU JSON FORMATI
{
  "belge_tutarliligi": {
    "durum": "tutarli|kismi_tutarsizlik|ciddi_tutarsizlik|tek_belge",
    "aciklama": "Yüklenen belgelerin sayısı ve aralarındaki tutarlılık durumu",
    "tespit_edilen_sorunlar": [
      "Belgeler arasındaki çelişkiler veya eksiklikler (varsa)"
    ],
    "oneriler": [
      "Belge eksikliği veya tutarsızlıklarla ilgili öneriler"
    ]
  },
  "operasyonel_riskler": {
    "seviye": "dusuk|orta|yuksek",
    "faktorler": [
      "Spesifik ve ölçülebilir risk faktörleri (min 5 adet)"
    ],
    "oneriler": [
      "Uygulanabilir, somut öneri ve çözümler (min 5 adet)"
    ]
  },
  "maliyet_sapma_olasiligi": {
    "oran": 25,
    "sebepler": [
      "Maliyet sapmasına neden olabilecek detaylı faktörler (min 4 adet)"
    ],
    "onlem_oneriler": [
      "Sapma riskini azaltacak önlemler (min 4 adet)"
    ]
  },
  "zaman_uygunlugu": {
    "durum": "yeterli|sinirda|yetersiz",
    "aciklama": "Teslim süresi ve operasyonel hazırlık değerlendirmesi (min 2 cümle)"
  },
  "genel_oneri": "Stratejik özet ve sonuç (min 3 cümle, teklife katılım kararı destekleyen)"
}

## ANALİZ KRİTERLERİ VE STANDARTLARI

### 0. BELGE TUTARLILIĞI (ÇOK ÖNEMLİ!)

Bu bölüm, çoklu dosya yüklemelerinde belgelerin birbirleriyle ne kadar tutarlı olduğunu değerlendirir.

**Durum Seviyeleri:**
- **"tutarli"**: 2+ belge yüklendi ve tüm kritik bilgiler (kişi sayısı, bütçe, tarihler) birbiriyle uyumlu
- **"kismi_tutarsizlik"**: 2+ belge yüklendi ancak bazı bilgilerde küçük farklılıklar var (örn: tarih farklılıkları)
- **"ciddi_tutarsizlik"**: 2+ belge yüklendi ve kritik bilgilerde (kişi sayısı, bütçe) çelişkiler var
- **"tek_belge"**: Sadece 1 belge yüklendi, çapraz kontrol yapılamadı

**Kontrol Edilecek Noktalar (_sources objesini kullan):**
1. **Kişi Sayısı**: Teknik Şartname ve İhale İlanı'ndaki kişi sayıları eşleşiyor mu?
2. **Bütçe**: İhale İlanı'ndaki tahmini bütçe, Teknik Şartname'deki detaylarla uyumlu mu?
3. **İhale Türü**: İhale İlanı'nda belirtilen usul doğru mu?
4. **Tarihler**: İhale tarihi, teklif son tarihi tutarlı mı?
5. **Süre**: Sözleşme süresi farklı belgelerde farklı yazılmış mı?

**Tespit Edilen Sorunlar:**
- Boş array [] döndür: Hiçbir sorun yoksa
- Listele: Her tutarsızlık için "X belgede Y bilgisi Z, ancak W belgede V olarak yazılmış" formatında yaz

**Öneriler:**
- Tutarlıysa: "Tüm belgeler birbiriyle uyumlu, ek doğrulamaya gerek yok"
- Tutarsızlıksa: "X ve Y belgeleri arasındaki çelişki için idareden yazılı açıklama istenmeli"
- Tek belgeyse: "Eksik belgeler (İhale İlanı/Teknik Şartname) tedarik edilerek çapraz kontrol yapılmalı"

### 1. OPERASYONEL RİSKLER

**Risk Seviyeleri:**
- "yuksek": 6+ ciddi risk faktörü veya kritik engeller var
- "orta": 3-5 yönetilebilir risk faktörü
- "dusuk": 0-2 minor risk faktörü

**Değerlendirilecek Faktörler:**
- **Kapasite**: Kişi sayısı günlük üretim kapasitesini aşıyor mu?
  - 500+ kişi: Merkezi mutfak gerektirir (yüksek risk)
  - 200-500 kişi: Orta ölçek operasyon (orta risk)
  - <200 kişi: Yönetilebilir (düşük risk)
- **Lojistik**: Teslimat mesafesi, frekans, soğuk zincir
- **Personel**: Kalifiye personel bulma, eğitim, devir hızı
- **Sezonalite**: Gıda fiyat dalgalanmaları, mevsimsel etkiler
- **Hijyen/Kalite**: HACCP, TSE gereklilikleri, denetimler
- **Yasal uyum**: İş kanunu, gıda mevzuatı, sözleşme şartları

**Öneriler şunları içermeli:**
- Somut eylem planı (ne yapılmalı)
- Sorumluluk tanımı (kim yapacak)
- Zaman çerçevesi (ne zaman)
- Maliyet etkisi varsa belirt

### 3. MALİYET SAPMA OLASILLIĞI

**Sapma Oranı Belirleme:**
- 40%+: Yüksek risk (bütçe çok düşük, piyasa volatilitesi yüksek)
- 20-40%: Orta risk (belirsizlikler var, piyasa normal)
- 10-20%: Düşük risk (bütçe yeterli, koşullar stabil)
- <10%: Minimal risk (bütçe bol, koşullar ideal)

**Değerlendirilecek Sebepler:**
- Gıda enflasyonu (%50+ yıllık Türkiye'de)
- Ham madde fiyat dalgalanmaları (et, sebze, yağ)
- Enerji maliyetleri (elektrik, doğalgaz)
- İşçilik maliyetleri (asgari ücret artışları)
- Döviz kuru etkileri (ithal ürünler)
- Mevsimsel fiyat değişimleri

**Önlem Önerileri:**
- Uzun vadeli tedarikçi anlaşmaları
- Esnek menü yapısı (maliyete göre ürün ikamesi)
- Stok yönetimi optimizasyonu
- Fiyat artış maddeleri (sözleşmede)

### 4. ZAMAN UYGUNLUĞU

**İdeal hazırlık süreleri:**
- 45-60 gün: İdeal (tedarik zinciri, personel, ekipman)
- 30-45 gün: Yeterli (acele ama yapılabilir)
- 15-30 gün: Sınırda (büyük operasyonlar için risk)
- <15 gün: Yetersiz (reddet veya kısmi başlat)

**Değerlendirme:**
- Tedarikçi anlaşmaları süresi
- Personel işe alım ve eğitim
- Ekipman/araç temini
- İdari hazırlıklar (sözleşme, sigorta)

### 5. GENEL ÖNERİ

**İçermesi gerekenler:**
- **Katılım kararı**: Kesinlikle katıl / Şartlı katıl / Katılma
- **Gerekçe**: 2-3 cümle finansal ve operasyonel değerlendirme
- **Kritik uyarılar**: Varsa, dikkat edilmesi gerekenler
- **Teklif stratejisi**: Agresif / Dengeli / Muhafazakar fiyatlama önerisi

## ÇIKTI KURALLARI
- Sadece JSON formatında döndür
- Tüm açıklamalar profesyonel ve somut olmalı
- Sayısal değerleri hesaplarken verilerdeki tüm faktörleri dikkate al
- Belirsizlik varsa muhafazakar değerlendir
- Öneriler uygulanabilir ve ölçülebilir olmalı

JSON:`;
  }

  private validateExtractedData(data: unknown): ExtractedData {
    // Basic validation with type guards
    const dataObj = data as Record<string, unknown>;

    const validated: ExtractedData = {
      kurum:
        typeof dataObj.kurum === "string" ? dataObj.kurum : "Belirtilmemiş",
      ihale_turu:
        typeof dataObj.ihale_turu === "string"
          ? dataObj.ihale_turu
          : "Bilinmiyor",
      kisi_sayisi:
        typeof dataObj.kisi_sayisi === "number" ? dataObj.kisi_sayisi : null,
      personel_sayisi:
        typeof dataObj.personel_sayisi === "number" ? dataObj.personel_sayisi : null,
      ogun_sayisi:
        typeof dataObj.ogun_sayisi === "number" ? dataObj.ogun_sayisi : null,
      gun_sayisi:
        typeof dataObj.gun_sayisi === "number" ? dataObj.gun_sayisi : null,
      tahmini_butce:
        typeof dataObj.tahmini_butce === "number"
          ? dataObj.tahmini_butce
          : null,
      teslim_suresi:
        typeof dataObj.teslim_suresi === "string"
          ? dataObj.teslim_suresi
          : null,
      riskler: Array.isArray(dataObj.riskler)
        ? (dataObj.riskler as string[])
        : [],
      ozel_sartlar: Array.isArray(dataObj.ozel_sartlar)
        ? (dataObj.ozel_sartlar as string[])
        : [],
      kanitlar:
        typeof dataObj.kanitlar === "object" && dataObj.kanitlar !== null
          ? (dataObj.kanitlar as Record<string, unknown>)
          : {},
      guven_skoru:
        typeof dataObj.guven_skoru === "number"
          ? Math.max(0, Math.min(1, dataObj.guven_skoru))
          : 0.5,
    };

    return validated;
  }

  /**
   * Raw query to Claude - genel amaçlı AI sorgusu
   * Belge türü tespiti gibi basit görevler için kullanılır
   */
  async queryRaw(
    prompt: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<string> {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: options?.maxTokens || 1000,
          temperature: options?.temperature ?? this.config.temperature,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Claude API error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      const content = result.content[0]?.text;

      if (!content) {
        throw new Error("No content returned from Claude API");
      }

      return content;
    } catch (error) {
      console.error("Claude Raw Query Error:", error);
      throw error;
    }
  }
}
