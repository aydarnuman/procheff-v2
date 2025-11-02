import { NextRequest, NextResponse } from "next/server";
import { ClaudeProvider } from "@/lib/ai/claude-provider";
import { GeminiExtractionProvider } from "@/lib/ai/gemini-extraction-provider";
import { AIProviderFactory } from "@/lib/ai/provider-factory";
import { AIAnalysisResult } from "@/types/ai";
import { DataValidator } from "@/lib/ai/data-validator";
import { calculateFinancialControl } from "@/lib/utils/financial-calculator";
import { TurkishContextAnalyzer } from "@/lib/utils/turkish-context-analyzer";
import { DualAPIOrchestrator } from "@/lib/ai/dual-api-orchestrator";

// 💾 CACHE MANAGER
class ServerAnalysisCache {
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static readonly TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  private static readonly MAX_ENTRIES = 50; // Server can hold more

  static async generateHash(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static get(hash: string): any | null {
    const entry = this.cache.get(hash);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(hash);
      return null;
    }

    return entry.data;
  }

  static set(hash: string, data: any): void {
    // LRU eviction
    if (this.cache.size >= this.MAX_ENTRIES) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(hash, { data, timestamp: Date.now() });
  }

  static getStats() {
    return {
      entries: this.cache.size,
      maxEntries: this.MAX_ENTRIES,
    };
  }
}

// Helper: Send progress event to stream
function sendProgressEvent(
  controller: ReadableStreamDefaultController,
  stage: string,
  progress: number,
  details?: string
) {
  const data = JSON.stringify({
    type: 'progress',
    stage,
    progress,
    details,
    timestamp: Date.now()
  });
  controller.enqueue(`data: ${data}\n\n`);
}

// Helper: Send error event to stream
function sendErrorEvent(
  controller: ReadableStreamDefaultController,
  error: string
) {
  const data = JSON.stringify({ type: 'error', error });
  controller.enqueue(`data: ${data}\n\n`);
}

// Helper: Send completion event to stream
function sendCompleteEvent(
  controller: ReadableStreamDefaultController,
  result: any
) {
  const data = JSON.stringify({ type: 'complete', result });
  controller.enqueue(`data: ${data}\n\n`);
}

// Helper: Detect document types from combined text
function detectDocumentTypes(text: string): string[] {
  const types: string[] = [];

  // Dosya başlıklarını tespit et (=== DOSYA: ... ===)
  const fileHeaders = text.match(/=== DOSYA: (.+?) ===/g) || [];

  fileHeaders.forEach(header => {
    const fileName = header.toLowerCase();
    if (fileName.includes('teknik') || fileName.includes('sartname')) {
      if (!types.includes('teknik_sartname')) types.push('teknik_sartname');
    }
    if (fileName.includes('idari') || fileName.includes('şartname')) {
      if (!types.includes('idari_sartname')) types.push('idari_sartname');
    }
    if (fileName.includes('ilan') || fileName.includes('ihale')) {
      if (!types.includes('ihale_ilani')) types.push('ihale_ilani');
    }
    if (fileName.includes('sozlesme') || fileName.includes('sözleşme')) {
      if (!types.includes('sozlesme')) types.push('sozlesme');
    }
    if (fileName.includes('fiyat') || fileName.includes('teklif')) {
      if (!types.includes('fiyat_teklif')) types.push('fiyat_teklif');
    }
  });

  // Hiç başlık yoksa içerik analizi yap
  if (types.length === 0) {
    if (/teknik\s+şartname|menü|porsiyon|gramaj/i.test(text)) types.push('teknik_sartname');
    if (/idari\s+şartname|ödeme\s+şart|ceza\s+hükü/i.test(text)) types.push('idari_sartname');
    if (/ihale\s+ilan|kurum\s+ad|teklif\s+son/i.test(text)) types.push('ihale_ilani');
    if (/sözleşme|madde\s+\d+|taraflar/i.test(text)) types.push('sozlesme');
  }

  return types;
}

// Helper: Get document-specific messages
function getDocumentMessages(docType: string) {
  const messages: Record<string, { emoji: string; message: string }> = {
    teknik_sartname: {
      emoji: '🍽️',
      message: 'Teknik Şartname analiz ediliyor (menü, gramaj, kalite kriterleri)...'
    },
    idari_sartname: {
      emoji: '⚖️',
      message: 'İdari Şartname analiz ediliyor (ödeme şartları, ceza hükümleri)...'
    },
    ihale_ilani: {
      emoji: '📢',
      message: 'İhale İlanı analiz ediliyor (kurum, tarih, bütçe bilgileri)...'
    },
    sozlesme: {
      emoji: '📝',
      message: 'Sözleşme analiz ediliyor (maddeler, şartlar, yükümlülükler)...'
    },
    fiyat_teklif: {
      emoji: '💰',
      message: 'Fiyat Teklifi analiz ediliyor (birim fiyatlar, toplam tutar)...'
    }
  };

  return messages[docType] || { emoji: '📄', message: 'Belge analiz ediliyor...' };
}

// Streaming response handler
async function createStreamingResponse(text: string, startTime: number) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Progress: Starting
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          stage: '🚀 AI analizi başlatılıyor...',
          progress: 5,
          timestamp: Date.now()
        })}\n\n`));

        // Doküman türlerini tespit et
        const detectedTypes = detectDocumentTypes(text);
        console.log('📋 Tespit edilen doküman türleri:', detectedTypes);

        // Provider selection
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          stage: '🤖 AI sağlayıcıları seçiliyor...',
          progress: 10,
          timestamp: Date.now()
        })}\n\n`));

        const { extraction, strategic } = AIProviderFactory.getHybridProviders({
          textLength: text.length,
          budget: "balanced",
        });

        // Doküman türlerine özel mesajlar göster (çok kısa - karışıklık olmasın)
        if (detectedTypes.length > 0) {
          const typeList = detectedTypes.map(t => {
            const msg = getDocumentMessages(t);
            return msg.emoji;
          }).join(' ');

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'progress',
            stage: `📋 ${detectedTypes.length} belge tespit edildi ${typeList}`,
            progress: 12,
            timestamp: Date.now()
          })}\n\n`));
        }

        // Turkish context analysis
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          stage: '🔍 Türkçe bağlam analizi yapılıyor...',
          progress: 15,
          timestamp: Date.now()
        })}\n\n`));

        const contextAnalysis = TurkishContextAnalyzer.analyzeParagraph(text);

        // Data extraction - Her doküman türü için mesaj göster
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          stage: `⚙️ AI veri çıkarımı başladı (${extraction.type.toUpperCase()})`,
          progress: 20,
          timestamp: Date.now()
        })}\n\n`));

        // Doküman türlerine özel detaylı mesajlar
        let currentProgress = 25;
        for (const docType of detectedTypes) {
          const docMsg = getDocumentMessages(docType);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'progress',
            stage: `${docMsg.emoji} ${docMsg.message}`,
            progress: currentProgress,
            timestamp: Date.now()
          })}\n\n`));
          currentProgress += Math.floor((45 - 25) / detectedTypes.length);

          // Küçük delay (mesajların okunabilir olması için)
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        let rawExtractedData;
        try {
          const orchestrator = new DualAPIOrchestrator();
          rawExtractedData = await orchestrator.extractWithFallback(text);

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'progress',
            stage: '✅ Veri çıkarımı tamamlandı',
            progress: 50,
            details: `Güven skoru: ${Math.round(rawExtractedData.guven_skoru * 100)}%`,
            timestamp: Date.now()
          })}\n\n`));
        } catch (error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'progress',
            stage: '🔄 Claude fallback aktif...',
            progress: 40,
            timestamp: Date.now()
          })}\n\n`));

          const claude = new ClaudeProvider();
          rawExtractedData = await claude.extractStructuredData(text);
        }

        const extractionTime = Date.now() - startTime;

        // Validation
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          stage: '✔️ Veri doğrulama yapılıyor...',
          progress: 60,
          timestamp: Date.now()
        })}\n\n`));

        const validationResult = DataValidator.validate(rawExtractedData);
        let extractedData = validationResult.data;

        // Financial control
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          stage: '💰 Finansal kontrol hesaplanıyor...',
          progress: 65,
          timestamp: Date.now()
        })}\n\n`));

        const finansalKontrol = calculateFinancialControl(extractedData);
        extractedData = {
          ...extractedData,
          finansal_kontrol: finansalKontrol,
        };

        // Critical field check
        const criticalFieldsMissing = !extractedData.kisi_sayisi || !extractedData.tahmini_butce;

        if (criticalFieldsMissing && extraction.type === "gemini") {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'progress',
            stage: '🔄 Kritik alanlar için Claude fallback...',
            progress: 70,
            timestamp: Date.now()
          })}\n\n`));

          try {
            const claude = new ClaudeProvider();
            const claudeExtraction = await claude.extractStructuredData(text);

            if (!extractedData.kisi_sayisi && claudeExtraction.kisi_sayisi) {
              extractedData.kisi_sayisi = claudeExtraction.kisi_sayisi;
            }
            if (!extractedData.tahmini_butce && claudeExtraction.tahmini_butce) {
              extractedData.tahmini_butce = claudeExtraction.tahmini_butce;
            }
          } catch (claudeError) {
            console.error("Claude fallback failed:", claudeError);
          }
        }

        // Contextual analysis
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          stage: `📊 Stratejik analiz yapılıyor (${strategic.type.toUpperCase()})`,
          progress: 75,
          details: 'Risk değerlendirmesi ve öneriler hazırlanıyor',
          timestamp: Date.now()
        })}\n\n`));

        const contextualAnalysis = await strategic.provider.analyzeContext(extractedData);

        const totalProcessingTime = Date.now() - startTime;
        const analysisTime = totalProcessingTime - extractionTime;

        // Özet mesaj - hangi belgeler analiz edildi göster
        const analyzedDocsMessage = detectedTypes.length > 0
          ? detectedTypes.map(t => getDocumentMessages(t).emoji).join(' ')
          : '📄';

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          stage: `📋 Analiz tamamlandı ${analyzedDocsMessage}`,
          progress: 95,
          details: `${(totalProcessingTime / 1000).toFixed(1)} saniyede tamamlandı`,
          timestamp: Date.now()
        })}\n\n`));

        // Calculate overall confidence
        const overallConfidence = Math.min(
          extractedData.guven_skoru,
          extractedData.kisi_sayisi && extractedData.tahmini_butce ? 0.95 : 0.8
        );

        const result: AIAnalysisResult = {
          extracted_data: extractedData,
          contextual_analysis: contextualAnalysis,
          processing_metadata: {
            processing_time: totalProcessingTime,
            ai_provider: `${extraction.type} (extraction) + ${strategic.type} (strategic)`,
            confidence_score: overallConfidence,
          },
          validation_warnings: validationResult.warnings.length > 0 ? validationResult.warnings : undefined,
        };

        // Send completion
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'complete',
          result: JSON.parse(JSON.stringify(result)),
          metadata: {
            total_processing_time: totalProcessingTime,
            extraction_time: extractionTime,
            analysis_time: analysisTime,
            text_length: text.length,
            timestamp: new Date().toISOString(),
          }
        })}\n\n`));

        controller.close();
      } catch (error) {
        console.error("Stream error:", error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
          timestamp: Date.now()
        })}\n\n`));
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Check if streaming is requested
  const url = new URL(request.url);
  const streamMode = url.searchParams.get('stream') === 'true';

  try {
    console.log("=== AI FULL ANALYSIS BAŞLADI ===");

    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Analiz edilecek metin verisi bulunamadı.",
          code: "NO_TEXT_DATA",
        },
        { status: 400 }
      );
    }

    if (text.length < 100) {
      return NextResponse.json(
        {
          success: false,
          error: "Metin çok kısa. En az 100 karakter olmalı.",
          code: "TEXT_TOO_SHORT",
        },
        { status: 400 }
      );
    }

    console.log(`Metin uzunluğu: ${text.length} karakter`);

    // 💾 CACHE CHECK - Aynı metin daha önce analiz edildi mi?
    const textHash = await ServerAnalysisCache.generateHash(text);
    const cachedResult = ServerAnalysisCache.get(textHash);

    if (cachedResult) {
      const cacheAge = Date.now() - cachedResult.timestamp;
      console.log(`\n💾 CACHE HIT! Analiz cache'den dönüyor`);
      console.log(`   Hash: ${textHash.substring(0, 16)}...`);
      console.log(`   Cache yaşı: ${Math.round(cacheAge / 1000 / 60)} dakika`);
      console.log(`   Boyut: ${Math.round(JSON.stringify(cachedResult.data).length / 1024)}KB`);
      console.log(`   Zaman tasarrufu: ~30-60 saniye\n`);

      const stats = ServerAnalysisCache.getStats();
      console.log(`📊 Cache Stats: ${stats.entries}/${stats.maxEntries} entries`);

      return NextResponse.json({
        success: true,
        data: cachedResult.data,
        metadata: {
          ...cachedResult.metadata,
          cached: true,
          cache_age_ms: cacheAge,
          cache_hit: true,
        },
      });
    }

    console.log(`\n💾 CACHE MISS - Yeni analiz başlatılıyor`);
    console.log(`   Hash: ${textHash.substring(0, 16)}...`);

    // If streaming mode, use ReadableStream
    if (streamMode) {
      return createStreamingResponse(text, startTime);
    }

    // 🚀 HYBRID MODE: Select optimal provider for extraction
    const { extraction, strategic } = AIProviderFactory.getHybridProviders({
      textLength: text.length,
      budget: "balanced", // Can be configured per user/tenant
    });

    console.log(`📊 PROVIDER SELECTION:`);
    console.log(`  Extraction: ${extraction.type.toUpperCase()} - ${extraction.reason}`);
    console.log(`  Strategic: ${strategic.type.toUpperCase()} - ${strategic.reason}`);

    // Step 0.5: Turkish Context Analysis (Rule-Based)
    console.log("Adım 0.5: Türkçe dilbilgisel bağlam analizi...");
    const contextAnalysis = TurkishContextAnalyzer.analyzeParagraph(text);
    console.log("  - Personel sayıları:", contextAnalysis.personnelNumbers);
    console.log("  - Hizmet alan sayıları:", contextAnalysis.recipientNumbers);
    console.log("  - Belirsiz sayılar:", contextAnalysis.ambiguousNumbers);

    // Step 1: Data Extraction (🔥 NEW: Dual API Orchestrator)
    console.log(`Adım 1: Veri çıkarımı başlıyor (DUAL-API mode)...`);

    let rawExtractedData;
    try {
      // 🚀 DUAL API: Text + Table paralel çalışır!
      const orchestrator = new DualAPIOrchestrator();
      rawExtractedData = await orchestrator.extractWithFallback(text);

      console.log("✅ Dual API extraction tamamlandı!");
    } catch (error) {
      console.error(`Dual API extraction failed, falling back to single provider...`);
      console.error(error);

      // Fallback to single provider
      try {
        rawExtractedData = await extraction.provider.extractStructuredData(text);
      } catch (fallbackError) {
        console.error("Single provider also failed, trying Claude...");
        const claude = new ClaudeProvider();
        rawExtractedData = await claude.extractStructuredData(text);
      }
    }

    const extractionTime = Date.now() - startTime;
    console.log(`Veri çıkarımı tamamlandı: ${extractionTime}ms`);
    console.log(`Güven skoru: ${Math.round(rawExtractedData.guven_skoru * 100)}%`);

    // Step 1.5: Validation & Auto-Fix
    console.log("Adım 1.5: Validation süzgeci çalıştırılıyor...");
    const validationResult = DataValidator.validate(rawExtractedData);
    let extractedData = validationResult.data;

    // Step 1.6: Financial Control (JavaScript hesaplama - hızlı!)
    console.log("Adım 1.6: Finansal kontrol hesaplanıyor...");
    const finansalKontrol = calculateFinancialControl(extractedData);
    extractedData = {
      ...extractedData,
      finansal_kontrol: finansalKontrol,
    };
    console.log(`Finansal Karar: ${finansalKontrol.girilir_mi} (${finansalKontrol.gerekce})`);

    if (validationResult.warnings.length > 0) {
      console.log(`⚠️  ${validationResult.warnings.length} uyarı tespit edildi:`);
      validationResult.warnings.forEach((w, i) => {
        console.log(`  ${i + 1}. [${w.severity.toUpperCase()}] ${w.field}: ${w.message}`);
        if (w.auto_fixed) {
          console.log(`     ✓ Otomatik düzeltildi: ${w.original_value} → ${w.suggested_value}`);
        }
      });
    }

    if (validationResult.auto_fixes_applied > 0) {
      console.log(`✅ ${validationResult.auto_fixes_applied} alan otomatik düzeltildi!`);
    }

    // Step 1.7: Critical Field Fallback (If Gemini missed key fields, ask Claude)
    const criticalFieldsMissing = !extractedData.kisi_sayisi || !extractedData.tahmini_butce;

    if (criticalFieldsMissing && extraction.type === "gemini") {
      console.log("⚠️  KRİTİK ALANLAR EKSİK - Claude fallback aktif...");
      console.log(`  - kisi_sayisi: ${extractedData.kisi_sayisi || "NULL"}`);
      console.log(`  - tahmini_butce: ${extractedData.tahmini_butce || "NULL"}`);

      try {
        const claude = new ClaudeProvider();
        const claudeExtraction = await claude.extractStructuredData(text);

        // Sadece eksik alanları doldur (Claude'un bulduğu varsa)
        if (!extractedData.kisi_sayisi && claudeExtraction.kisi_sayisi) {
          console.log(`  ✅ Claude kisi_sayisi buldu: ${claudeExtraction.kisi_sayisi}`);

          // Kaynak göster
          const kaynak = (claudeExtraction._sources as any)?.kisi_sayisi;
          if (kaynak?.proof) {
            console.log(`     📚 Kaynak: "${kaynak.proof.substring(0, 200)}..."`);
          } else {
            console.log(`     ⚠️  Kaynak bilgisi yok!`);
          }

          extractedData.kisi_sayisi = claudeExtraction.kisi_sayisi;
        }

        if (!extractedData.tahmini_butce && claudeExtraction.tahmini_butce) {
          console.log(`  ✅ Claude tahmini_butce buldu: ${claudeExtraction.tahmini_butce.toLocaleString()} TL`);

          // Kaynak göster
          const kaynak = (claudeExtraction._sources as any)?.tahmini_butce;
          if (kaynak?.proof) {
            console.log(`     📚 Kaynak: "${kaynak.proof.substring(0, 200)}..."`);
          }

          extractedData.tahmini_butce = claudeExtraction.tahmini_butce;
        }
      } catch (claudeError) {
        console.error("Claude fallback failed:", claudeError);
        // Continue with Gemini data
      }
    }

    // Step 2: Contextual Analysis (Always use Claude for strategic analysis)
    console.log(`Adım 2: Bağlamsal analiz başlıyor (${strategic.type})...`);
    const contextualAnalysis = await strategic.provider.analyzeContext(extractedData);

    const totalProcessingTime = Date.now() - startTime;
    const analysisTime = totalProcessingTime - extractionTime;

    console.log(`Bağlamsal analiz tamamlandı: ${analysisTime}ms`);
    console.log(`Toplam işleme süresi: ${totalProcessingTime}ms`);

    // Calculate overall confidence score
    const overallConfidence = Math.min(
      extractedData.guven_skoru,
      // Weight contextual analysis based on data quality
      extractedData.kisi_sayisi && extractedData.tahmini_butce ? 0.95 : 0.8
    );

    const result: AIAnalysisResult = {
      extracted_data: extractedData,
      contextual_analysis: contextualAnalysis,
      processing_metadata: {
        processing_time: totalProcessingTime,
        ai_provider: `${extraction.type} (extraction) + ${strategic.type} (strategic)`,
        confidence_score: overallConfidence,
      },
      validation_warnings: validationResult.warnings.length > 0 ? validationResult.warnings : undefined,
    };

    console.log("=== AI FULL ANALYSIS TAMAMLANDI ===");
    console.log(`Kurum: ${extractedData.kurum}`);
    console.log(`İhale türü: ${extractedData.ihale_turu}`);
    console.log(
      `Risk seviyesi: ${contextualAnalysis.operasyonel_riskler.seviye}`
    );
    console.log(`Genel güven skoru: ${Math.round(overallConfidence * 100)}%`);

    // Serialization için veriyi düzleştir
    const sanitizedResult = JSON.parse(JSON.stringify(result));

    const metadata = {
      total_processing_time: totalProcessingTime,
      extraction_time: extractionTime,
      analysis_time: analysisTime,
      text_length: text.length,
      timestamp: new Date().toISOString(),
    };

    // 💾 CACHE SAVE - Başarılı analizi cache'e kaydet
    ServerAnalysisCache.set(textHash, {
      data: sanitizedResult,
      metadata,
      timestamp: Date.now(),
    });

    console.log(`\n💾 Analiz cache'e kaydedildi`);
    console.log(`   Hash: ${textHash.substring(0, 16)}...`);
    const stats = ServerAnalysisCache.getStats();
    console.log(`📊 Cache Stats: ${stats.entries}/${stats.maxEntries} entries\n`);

    return NextResponse.json({
      success: true,
      data: sanitizedResult,
      metadata: {
        ...metadata,
        cached: false,
        cache_hit: false,
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error("=== AI FULL ANALYSIS HATASI ===");
    console.error("Error:", error);
    console.error(`İşleme süresi: ${processingTime}ms`);

    // Hata türüne göre response
    if (error instanceof Error) {
      if (error.message.includes("CLAUDE_API_KEY")) {
        return NextResponse.json(
          {
            success: false,
            error:
              "AI servis yapılandırması eksik. Lütfen sistem yöneticisi ile iletişime geçin.",
            code: "AI_CONFIG_ERROR",
          },
          { status: 500 }
        );
      }

      if (error.message.includes("Claude API error")) {
        return NextResponse.json(
          {
            success: false,
            error:
              "AI servisi geçici olarak kullanılamıyor. Lütfen birkaç dakika sonra tekrar deneyin.",
            code: "AI_SERVICE_ERROR",
          },
          { status: 503 }
        );
      }

      if (error.message.includes("JSON")) {
        return NextResponse.json(
          {
            success: false,
            error:
              "AI yanıtı işlenemedi. Metin formatını kontrol edip tekrar deneyin.",
            code: "AI_RESPONSE_ERROR",
          },
          { status: 422 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "AI analizi sırasında beklenmeyen hata oluştu.",
        code: "FULL_ANALYSIS_ERROR",
        details:
          process.env.NODE_ENV === "development" ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
