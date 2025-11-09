import Anthropic from "@anthropic-ai/sdk";

/**
 * Text Extraction Provider - Claude ile METİNSEL Veri Havuzu çıkarımı
 * CHUNKED VERSION: Büyük metinleri chunk'lara böler ve birleştirir
 */
export class TextExtractionProvider {
  private model: string;

  constructor() {
    this.model = process.env.DEFAULT_AI_MODEL || "claude-sonnet-4-20250514";

    console.log("=== TEXT EXTRACTION PROVIDER (CLAUDE) ===");
    console.log("Model:", this.model);
  }

  /**
   * Get fresh Anthropic client with current API key (prevents cache issues)
   */
  private getAnthropicClient(): Anthropic {
    const apiKey = process.env.ANTHROPIC_API_KEY || "";

    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is missing");
    }

    console.log("🔑 Creating fresh Anthropic client with API key:", apiKey.substring(0, 15) + "...");
    return new Anthropic({ apiKey });
  }

  /**
   * Split text into chunks (safe token limit)
   */
  private chunkText(text: string): string[] {
    const MAX_CHUNK_CHARS = 120000; // ~90K tokens (güvenli limit)

    if (text.length <= MAX_CHUNK_CHARS) {
      return [text];
    }

    console.log(`⚠️ Text too long (${text.length} chars), splitting into chunks...`);

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + MAX_CHUNK_CHARS, text.length);

      // Chunk'u kelime sınırında kes (ortadan kelime kesmemek için)
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start) {
          end = lastSpace;
        }
      }

      chunks.push(text.substring(start, end));
      start = end;
    }

    console.log(`📦 Text split into ${chunks.length} chunks`);
    chunks.forEach((chunk, i) => {
      console.log(`   Chunk ${i + 1}: ${chunk.length} chars`);
    });

    return chunks;
  }

  /**
   * Metinsel Veri Havuzu çıkarımı - Chunked version
   */
  async extractTextData(text: string): Promise<any> {
    console.log("=== TEXT EXTRACTION WITH CLAUDE (CHUNKED MODE) ===");
    console.log("Text length:", text.length);

    // Text'i chunk'lara böl
    const chunks = this.chunkText(text);

    // Her chunk'ı paralel işle
    const chunkResults = await Promise.all(
      chunks.map((chunk, index) =>
        this.extractSingleChunk(chunk, index, chunks.length)
      )
    );

    // Sonuçları birleştir
    return this.mergeChunkResults(chunkResults);
  }

  /**
   * Tek bir chunk'ı işle
   * 📊 MONITORING İYİLEŞTİRME - Detaylı süre ve maliyet takibi
   * 🔁 RETRY - Exponential backoff ile 3 deneme
   */
  private async extractSingleChunk(text: string, chunkIndex: number, totalChunks: number): Promise<any> {
    const chunkStart = Date.now(); // ⏱️ MONITORING: Chunk süresi
    console.log(`\n🔄 Processing chunk ${chunkIndex + 1}/${totalChunks} (${Math.round(text.length / 1000)}K chars)...`);

    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`\n🔁 Chunk ${chunkIndex + 1}/${totalChunks} - Retry ${attempt}/${MAX_RETRIES}...`);
        }

        const apiStart = Date.now(); // ⏱️ API süresi

        const prompt = this.buildDataPoolPrompt(text, chunkIndex, totalChunks);
        const anthropic = this.getAnthropicClient();

        const response = await anthropic.messages.create({
          model: this.model,
          max_tokens: 16000,
          temperature: 0.5,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        });

        const apiDuration = Date.now() - apiStart; // ⏱️ API response süresi

        const output = response.content[0].type === "text"
          ? response.content[0].text
          : "";

        // ⏱️ MONITORING: Token usage + maliyet + süre
        const inputTokens = response.usage.input_tokens;
        const outputTokens = response.usage.output_tokens;
        const totalTokens = inputTokens + outputTokens;
        const estimatedCost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;

        console.log(`📊 Token Kullanımı (Chunk ${chunkIndex + 1}):`);
        console.log(`   Input: ${inputTokens.toLocaleString()} tokens`);
        console.log(`   Output: ${outputTokens.toLocaleString()} tokens`);
        console.log(`   Toplam: ${totalTokens.toLocaleString()} tokens`);
        console.log(`   💰 Maliyet: $${estimatedCost.toFixed(4)}`);
        console.log(`   ⏱️ API Süresi: ${apiDuration}ms`);

        const parsed = this.parseResponse(output);

        // ⏱️ MONITORING: Toplam chunk süresi
        const chunkDuration = Date.now() - chunkStart;
        console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} başarıyla işlendi`);
        console.log(`   ⏱️ Toplam Süre: ${chunkDuration}ms (${Math.round(chunkDuration / 1000)}s)`);

        return parsed;
      } catch (error: any) {
        const isOverloaded = error?.status === 529 || error?.message?.includes("overloaded");
        const isRateLimit = error?.status === 429;
        const isServerError = error?.status >= 500;

        console.error(`❌ Chunk ${chunkIndex + 1} - Hata (attempt ${attempt}/${MAX_RETRIES}):`, error.message);

        // Retry yapılabilir hatalar
        if ((isOverloaded || isRateLimit || isServerError) && attempt < MAX_RETRIES) {
          // Exponential backoff: 2s, 4s, 8s
          const waitTime = 2000 * Math.pow(2, attempt - 1);
          console.log(`⏳ ${waitTime}ms bekleniyor (exponential backoff)...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue; // Retry
        }

        if (attempt === MAX_RETRIES) {
          // Son deneme başarısız - partial data döndür
          console.error(`❌ Chunk ${chunkIndex + 1} - Tüm retry denemeleri başarısız, empty result döndürülüyor`);
          return this.getEmptyResult();
        }
      }
    }

    return this.getEmptyResult();
  }

  /**
   * Chunk sonuçlarını birleştir
   */
  private mergeChunkResults(results: any[]): any {
    console.log(`\n🔀 Merging ${results.length} chunk results...`);

    // Base result - ilk chunk'tan al
    const merged: any = {
      veri_havuzu: {
        ham_metin: "",
        kaynaklar: {}
      },
      kurum: "",
      ihale_turu: null,
      ihale_tarihi: null,
      teklif_son_tarih: null,
      ise_baslama_tarih: null,
      gun_sayisi: null,
      kisi_sayisi: null,
      ogun_sayisi: null,
      tahmini_butce: null,
      teslim_suresi: null,
      ozel_sartlar: [],
      riskler: [],
      sertifikasyon_etiketleri: [],
      ornek_menu_basliklari: [],
      dagitim_yontemi: null,
      guven_skoru: 0
    };

    let totalConfidence = 0;

    results.forEach((result, index) => {
      if (!result) return;

      console.log(`  Merging chunk ${index + 1}...`);

      // İlk chunk - base bilgileri al
      if (index === 0) {
        merged.kurum = result.kurum || merged.kurum;
        merged.ihale_turu = result.ihale_turu || merged.ihale_turu;
        merged.ihale_tarihi = result.ihale_tarihi || merged.ihale_tarihi;
        merged.teklif_son_tarih = result.teklif_son_tarih || merged.teklif_son_tarih;
        merged.ise_baslama_tarih = result.ise_baslama_tarih || merged.ise_baslama_tarih;
        merged.dagitim_yontemi = result.dagitim_yontemi || merged.dagitim_yontemi;
      }

      // Sayısal değerler - ilk bulunan değeri al
      if (result.gun_sayisi && !merged.gun_sayisi) merged.gun_sayisi = result.gun_sayisi;
      if (result.kisi_sayisi && !merged.kisi_sayisi) merged.kisi_sayisi = result.kisi_sayisi;
      if (result.ogun_sayisi && !merged.ogun_sayisi) merged.ogun_sayisi = result.ogun_sayisi;
      if (result.tahmini_butce && !merged.tahmini_butce) merged.tahmini_butce = result.tahmini_butce;

      // Ham metin - birleştir
      if (result.veri_havuzu?.ham_metin) {
        if (merged.veri_havuzu.ham_metin) {
          merged.veri_havuzu.ham_metin += "\n\n---\n\n" + result.veri_havuzu.ham_metin;
        } else {
          merged.veri_havuzu.ham_metin = result.veri_havuzu.ham_metin;
        }
      }

      // Kaynaklar - merge et
      if (result.veri_havuzu?.kaynaklar) {
        merged.veri_havuzu.kaynaklar = {
          ...merged.veri_havuzu.kaynaklar,
          ...result.veri_havuzu.kaynaklar
        };
      }

      // Array'leri birleştir (unique)
      if (result.ozel_sartlar) {
        merged.ozel_sartlar = [...new Set([...merged.ozel_sartlar, ...result.ozel_sartlar])];
      }
      if (result.riskler) {
        merged.riskler = [...new Set([...merged.riskler, ...result.riskler])];
      }
      if (result.sertifikasyon_etiketleri) {
        merged.sertifikasyon_etiketleri = [...new Set([...merged.sertifikasyon_etiketleri, ...result.sertifikasyon_etiketleri])];
      }
      if (result.ornek_menu_basliklari) {
        merged.ornek_menu_basliklari = [...new Set([...merged.ornek_menu_basliklari, ...result.ornek_menu_basliklari])];
      }

      totalConfidence += (result.guven_skoru || 0);
    });

    // Average confidence
    merged.guven_skoru = totalConfidence / results.length;

    console.log(`✅ Merge completed:`);
    console.log(`   - ham_metin: ${merged.veri_havuzu.ham_metin?.length || 0} chars`);
    console.log(`   - kaynaklar: ${Object.keys(merged.veri_havuzu.kaynaklar).length} keys`);
    console.log(`   - ozel_sartlar: ${merged.ozel_sartlar.length} items`);
    console.log(`   - riskler: ${merged.riskler.length} items`);
    console.log(`   - confidence: ${Math.round(merged.guven_skoru * 100)}%`);

    return merged;
  }

  /**
   * Empty result for failed chunks
   */
  private getEmptyResult(): any {
    return {
      veri_havuzu: {
        ham_metin: "",
        kaynaklar: {}
      },
      ozel_sartlar: [],
      riskler: [],
      sertifikasyon_etiketleri: [],
      ornek_menu_basliklari: [],
      guven_skoru: 0
    };
  }

  private buildDataPoolPrompt(text: string, chunkIndex: number, totalChunks: number): string {
    const chunkInfo = totalChunks > 1
      ? `\n⚠️ ÖNEMLİ: Bu metin ${totalChunks} parçadan ${chunkIndex + 1}. parçası. Sadece bu parçadaki bilgileri çıkar.\n`
      : '';

    return `Sen bir Türk kamu ihalelerinde uzman yapay zekasısın.${chunkInfo}

🎯 GÖREV: "VERİ HAVUZU" EXTRACTION (Metinsel Anlatım)

Bu görev METİNSEL ANLATIM odaklıdır. Sayısal alanlar yerine UZUN PARAGRAF formatında anlatım yap.

📄 ŞARTNAME METNİ:
${text}

🎯 ÇIKARACAĞIN BİLGİLER:

0️⃣ **BELGE TÜRÜ TESPİTİ** (ÖNCELİKLİ):
   - Belgenin türünü belirle: teknik_sartname | ihale_ilani | sozlesme_tasarisi | idari_sartname | fiyat_teklif_mektubu | diger | belirsiz
   - İçerikte şunları ara:
     * Teknik Şartname: menü, gramaj, ürün özellikleri, hijyen standartları, HACCP, ISO 22000
     * İhale İlanı: ihale kayıt numarası, son teklif verme tarihi, EKAP, açık ihale, yaklaşık maliyet
     * Sözleşme Tasarısı: madde 1-10, taraflar, yüklenici, işveren, ceza şartları, fesih
     * İdari Şartname: genel/özel şartlar, isteklilerde aranan şartlar, geçici/kesin teminat
     * Fiyat Teklif Mektubu: birim fiyat, toplam tutar, KDV, indirim
   - Belge türü tespitinde 0-1 arası güven skoru (belge_turu_guven) ver

1️⃣ **KURUM VE İHALE**: Kurum adı, ihale türü, konu
2️⃣ **TARİHLER**: İhale, teklif, başlama tarihleri
3️⃣ **HİZMET KAPSAMI**: Kişi, öğün, süre (metinsel)
4️⃣ **ÖZEL ŞARTLAR**: Gereksinimler, standartlar (EN AZ 10)
5️⃣ **RİSKLER**: Olası sorunlar (EN AZ 5)

📋 CEVAP FORMATI (SADECE JSON):

\`\`\`json
{
  "belge_turu": "teknik_sartname",
  "belge_turu_guven": 0.95,
  "veri_havuzu": {
    "ham_metin": "BELGE TÜRÜ: Teknik Şartname\\n\\nKURUM: [ad]\\n\\nİHALE TÜRÜ: [tür]\\n\\nTARİHLER:\\n• [tarihler]\\n\\nHİZMET:\\n• [hizmet detayları]\\n\\nÖZEL ŞARTLAR:\\n1. [şart]\\n2. [şart]\\n...\\n\\nRİSKLER:\\n1. [risk]\\n...",
    "kaynaklar": {
      "belge_turu": {
        "deger": "Teknik Şartname - Menü ve gramaj bilgileri içeriyor",
        "kaynak": "[İçerikten belge türünü gösteren 200+ karakter proof]",
        "dosya": "[Dosya adı]"
      },
      "kisi_sayisi": {
        "deger": "[metinsel değer]",
        "kaynak": "[200+ karakter proof]",
        "dosya": "Teknik Şartname"
      }
    }
  },
  "kurum": "[kurum]",
  "ihale_turu": "[tür]",
  "ihale_tarihi": "YYYY-MM-DD|null",
  "teklif_son_tarih": "YYYY-MM-DD|null",
  "ise_baslama_tarih": "YYYY-MM-DD|null",
  "gun_sayisi": number|null,
  "kisi_sayisi": number|null,
  "ogun_sayisi": number|null,
  "tahmini_butce": number|null,
  "teslim_suresi": "string|null",
  "ozel_sartlar": ["Şart 1", "Şart 2"],
  "riskler": ["Risk 1", "Risk 2"],
  "sertifikasyon_etiketleri": ["ISO 22000"],
  "ornek_menu_basliklari": ["Tavuk sote"],
  "dagitim_yontemi": "string|null",
  "guven_skoru": 0.85
}
\`\`\`

⚠️ KURALLAR:
1. SADECE JSON formatında cevap ver
2. ham_metin: Uzun paragraf formatında
3. JSON string'lerde TAB, NEWLINE kullanma! Sadece \\n escape kullan
4. Tablo verileri varsa paragraf formatında ekle

🚀 BAŞLA!`;
  }

  private parseResponse(response: string): any {
    try {
      let cleaned = response.trim();

      // Remove ```json code blocks
      const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        cleaned = jsonMatch[1].trim();
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\w*\s*/, "").replace(/```\s*$/, "");
      }

      // Extract JSON object
      const jsonStartMatch = cleaned.match(/(\{[\s\S]*\})/);
      if (jsonStartMatch) {
        cleaned = jsonStartMatch[1].trim();
      }

      // Kontrol karakteri temizleme
      cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

      // String literal'ların içindeki kontrol karakterlerini escape et
      cleaned = cleaned.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match, content) => {
        const cleaned = content
          .replace(/\t/g, '    ')
          .replace(/\r\n/g, ' ')
          .replace(/\n/g, ' ')
          .replace(/\r/g, ' ');
        return `"${cleaned}"`;
      });

      return JSON.parse(cleaned);
    } catch (error) {
      console.error("Failed to parse response:", error);

      // Fallback
      try {
        return this.manualJsonExtraction(response);
      } catch (fallbackError) {
        console.error("Manual extraction failed:", fallbackError);
        throw error;
      }
    }
  }

  private manualJsonExtraction(response: string): any {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found");
    }

    let json = jsonMatch[0];
    json = json.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, ' ');
    json = json.replace(/,(\s*[}\]])/g, '$1');

    return JSON.parse(json);
  }
}
