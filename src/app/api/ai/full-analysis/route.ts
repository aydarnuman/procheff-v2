import { NextRequest, NextResponse } from "next/server";
import { ClaudeProvider } from "@/lib/ai/claude-provider";
import { GeminiExtractionProvider } from "@/lib/ai/gemini-extraction-provider";
import { AIProviderFactory } from "@/lib/ai/provider-factory";
import { AIAnalysisResult, ExtractedTable } from "@/types/ai";
import { DataValidator } from "@/lib/ai/data-validator";
import { calculateFinancialControl } from "@/lib/utils/financial-calculator";
import { TurkishContextAnalyzer } from "@/lib/utils/turkish-context-analyzer";
import { DualAPIOrchestrator } from "@/lib/ai/dual-api-orchestrator";
import { categorizeTables } from "@/lib/ai/table-categorizer";
import { CSVCostAnalysis } from "@/lib/csv/csv-parser";
import { ANALYSIS_STAGES, createProgressEvent, createDocumentStage, getDocumentProcessingProgress } from "@/lib/ai/analysis-stages";

// 💾 CACHE MANAGER
class ServerAnalysisCache {
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static readonly TTL = 3 * 24 * 60 * 60 * 1000; // 3 days (daha güncel analizler)
  private static readonly MAX_ENTRIES = 50; // Server can hold more
  private static readonly MODEL_VERSION = 'v2.0.0'; // Model versiyonu (değişince cache invalidate olur)

  static async generateHash(text: string, additionalContext?: string): Promise<string> {
    // Hash: text + model_version + (opsiyonel context)
    const encoder = new TextEncoder();
    const combinedData = text + this.MODEL_VERSION + (additionalContext || '');
    const data = encoder.encode(combinedData);
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

// Helper: Convert CSV cost analysis to ExtractedTable format
function convertCSVToTables(csvAnalyses: any[]): ExtractedTable[] {
  if (!csvAnalyses || csvAnalyses.length === 0) return [];

  console.log(`\n📊 CSV → TABLO DÖNÜŞÜMÜ: ${csvAnalyses.length} CSV dosyası`);

  const tables: ExtractedTable[] = [];

  csvAnalyses.forEach((csv: any, csvIndex: number) => {
    const analysis: CSVCostAnalysis = csv.analysis;
    const fileName = csv.fileName || `CSV-${csvIndex + 1}`;

    // Her CSV'den bir maliyet tablosu oluştur
    const headers = ["Ürün Adı", "Miktar", "Birim", "Birim Fiyat (TL)", "Toplam Fiyat (TL)", "Kategori"];
    const rows: string[][] = [];

    analysis.items.forEach(item => {
      rows.push([
        item.urun_adi,
        item.miktar?.toString() || "-",
        item.birim || "-",
        item.birim_fiyat?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "-",
        item.toplam_fiyat?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "-",
        item.kategori || "Diğer"
      ]);
    });

    // Toplam satırı ekle
    rows.push([
      "TOPLAM",
      analysis.summary.total_items.toString() + " ürün",
      "-",
      "-",
      analysis.summary.total_cost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL",
      "-"
    ]);

    const table: ExtractedTable = {
      baslik: `Maliyet Tablosu - ${fileName}`,
      headers,
      rows,
      sutun_sayisi: headers.length,
      satir_sayisi: rows.length,
      guven: 1.0, // CSV verileri %100 güvenilir
      category: "financial" // CSV maliyet verileri -> financial category
    };

    tables.push(table);

    console.log(`   ✅ ${fileName}: ${rows.length - 1} ürün, Toplam: ${analysis.summary.total_cost.toLocaleString('tr-TR')} TL → [financial]`);
  });

  console.log(`📊 ${tables.length} CSV tablosu oluşturuldu\n`);
  return tables;
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
async function createStreamingResponse(text: string, csvAnalyses: any[] | undefined, startTime: number, textHash: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Progress: Starting (sabit stage mapping)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(createProgressEvent(ANALYSIS_STAGES.STARTING))}\n\n`));

        // Doküman türlerini tespit et
        const detectedTypes = detectDocumentTypes(text);
        console.log('📋 Tespit edilen doküman türleri:', detectedTypes);

        // Provider selection (sabit stage mapping)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(createProgressEvent(ANALYSIS_STAGES.PROVIDER_SELECTION))}\n\n`));

        const { extraction, strategic } = AIProviderFactory.getHybridProviders({
          textLength: text.length,
          budget: "balanced",
        });

        // Doküman türlerine özel mesajlar göster (sabit stage mapping)
        if (detectedTypes.length > 0) {
          const typeList = detectedTypes.map(t => {
            const msg = getDocumentMessages(t);
            return msg.emoji;
          }).join(' ');

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(createProgressEvent(
            ANALYSIS_STAGES.DOCUMENT_DETECTION,
            `${detectedTypes.length} belge tespit edildi ${typeList}`
          ))}\n\n`));
        }

        // Turkish context analysis (sabit stage mapping)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(createProgressEvent(ANALYSIS_STAGES.CONTEXT_ANALYSIS))}\n\n`));

        const contextAnalysis = TurkishContextAnalyzer.analyzeParagraph(text);

        // Data extraction - Her doküman türü için mesaj göster (sabit stage mapping)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(createProgressEvent(
          ANALYSIS_STAGES.DATA_EXTRACTION_START,
          `${extraction.type.toUpperCase()} kullanılıyor`
        ))}\n\n`));

        // Doküman türlerine özel detaylı mesajlar (dinamik progress 25-45 arası)
        for (let i = 0; i < detectedTypes.length; i++) {
          const docType = detectedTypes[i];
          const docMsg = getDocumentMessages(docType);
          const progress = getDocumentProcessingProgress(i, detectedTypes.length);

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(createDocumentStage(
            docType,
            docMsg.emoji,
            docMsg.message,
            progress
          ))}\n\n`));

          // Küçük delay (mesajların okunabilir olması için)
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        let rawExtractedData;
        try {
          const orchestrator = new DualAPIOrchestrator();
          rawExtractedData = await orchestrator.extractWithFallback(text);

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(createProgressEvent(
            ANALYSIS_STAGES.DATA_EXTRACTION_COMPLETE,
            `Güven skoru: ${Math.round(rawExtractedData.guven_skoru * 100)}%`
          ))}\n\n`));

          // 📊 CSV TABLOLARINI ENTEGRE ET (sabit stage mapping)
          if (csvAnalyses && csvAnalyses.length > 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(createProgressEvent(ANALYSIS_STAGES.CSV_INTEGRATION))}\n\n`));

            const csvTables = convertCSVToTables(csvAnalyses);

            // CSV tablolarını mevcut tablolarla birleştir
            if (!rawExtractedData.tablolar) {
              rawExtractedData.tablolar = [];
            }
            rawExtractedData.tablolar.push(...csvTables);

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(createProgressEvent(
              ANALYSIS_STAGES.CSV_COMPLETE,
              `${csvTables.length} CSV tablosu`
            ))}\n\n`));
          }
        } catch (error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(createProgressEvent(ANALYSIS_STAGES.GEMINI_FALLBACK))}\n\n`));

          const claude = new ClaudeProvider();
          rawExtractedData = await claude.extractStructuredData(text);
        }

        const extractionTime = Date.now() - startTime;

        // Validation (sabit stage mapping)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(createProgressEvent(ANALYSIS_STAGES.VALIDATION))}\n\n`));

        const validationResult = DataValidator.validate(rawExtractedData);
        let extractedData = validationResult.data;

        // Financial control (sabit stage mapping)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(createProgressEvent(ANALYSIS_STAGES.FINANCIAL_CONTROL))}\n\n`));

        const finansalKontrol = calculateFinancialControl(extractedData);
        extractedData = {
          ...extractedData,
          finansal_kontrol: finansalKontrol,
        };

        // Critical field check (sabit stage mapping)
        const criticalFieldsMissing = !extractedData.kisi_sayisi || !extractedData.tahmini_butce;

        if (criticalFieldsMissing && extraction.type === "gemini") {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(createProgressEvent(ANALYSIS_STAGES.CLAUDE_FALLBACK))}\n\n`));

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

        // Contextual analysis (sabit stage mapping)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(createProgressEvent(
          ANALYSIS_STAGES.STRATEGIC_ANALYSIS,
          `${strategic.type.toUpperCase()} - Risk değerlendirmesi`
        ))}\n\n`));

        const contextualAnalysis = await strategic.provider.analyzeContext(extractedData);

        const totalProcessingTime = Date.now() - startTime;
        const analysisTime = totalProcessingTime - extractionTime;

        // Özet mesaj - hangi belgeler analiz edildi göster
        const analyzedDocsMessage = detectedTypes.length > 0
          ? detectedTypes.map(t => getDocumentMessages(t).emoji).join(' ')
          : '📄';

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(createProgressEvent(
          ANALYSIS_STAGES.FINALIZING,
          `${analyzedDocsMessage} ${(totalProcessingTime / 1000).toFixed(1)}s`
        ))}\n\n`));

        // Calculate overall confidence (NaN korumalı)
        console.log('🔍 [CONFIDENCE DEBUG] extractedData.guven_skoru:', extractedData.guven_skoru);
        console.log('🔍 [CONFIDENCE DEBUG] Type:', typeof extractedData.guven_skoru);
        console.log('🔍 [CONFIDENCE DEBUG] isNaN check:', isNaN(extractedData.guven_skoru as any));
        
        const baseConfidence = typeof extractedData.guven_skoru === 'number' && !isNaN(extractedData.guven_skoru)
          ? extractedData.guven_skoru
          : 0.7; // Varsayılan güven skoru
        
        console.log('🔍 [CONFIDENCE DEBUG] baseConfidence:', baseConfidence);
        
        // ✅ FIX: AI güven skoru döndürmediyse, extracted_data'ya yaz (UI için)
        if (!extractedData.guven_skoru || isNaN(extractedData.guven_skoru)) {
          extractedData.guven_skoru = baseConfidence;
          console.warn('⚠️ Güven skoru AI tarafından döndürülmedi, varsayılan 0.7 kullanıldı');
          console.log('🔍 [CONFIDENCE DEBUG] After fix, extractedData.guven_skoru:', extractedData.guven_skoru);
        }
        
        const overallConfidence = Math.min(
          baseConfidence,
          extractedData.kisi_sayisi && extractedData.tahmini_butce ? 0.95 : 0.8
        );
        
        console.log('🔍 [CONFIDENCE DEBUG] overallConfidence:', overallConfidence);

        const result: AIAnalysisResult = {
          extracted_data: {
            ...extractedData,
            guven_skoru: baseConfidence, // ✅ FIX: Force valid value for UI
          },
          contextual_analysis: contextualAnalysis,
          processing_metadata: {
            processing_time: totalProcessingTime,
            ai_provider: `${extraction.type} (extraction) + ${strategic.type} (strategic)`,
            confidence_score: overallConfidence,
          },
          validation_warnings: validationResult.warnings.length > 0 ? validationResult.warnings : undefined,
          csv_analyses: csvAnalyses, // CSV analizlerini ekle
        };
        
        console.log('🔍 [RESULT DEBUG] Final result.extracted_data.guven_skoru:', result.extracted_data.guven_skoru);
        console.log('🔍 [RESULT DEBUG] Final result.processing_metadata.confidence_score:', result.processing_metadata.confidence_score);

        // Serialization için veriyi düzleştir
        const sanitizedResult = JSON.parse(JSON.stringify(result));

        const metadata = {
          total_processing_time: totalProcessingTime,
          extraction_time: extractionTime,
          analysis_time: analysisTime,
          text_length: text.length,
          timestamp: new Date().toISOString(),
        };

        // 💾 CACHE SAVE - Başarılı analizi cache'e kaydet (streaming mode)
        ServerAnalysisCache.set(textHash, {
          data: sanitizedResult,
          metadata,
          timestamp: Date.now(),
        });

        console.log(`\n💾 [STREAMING] Analiz cache'e kaydedildi`);
        console.log(`   Hash: ${textHash.substring(0, 16)}...`);
        const cacheStats = ServerAnalysisCache.getStats();
        console.log(`📊 Cache Stats: ${cacheStats.entries}/${cacheStats.maxEntries} entries\n`);

        // Send completion
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'complete',
          result: sanitizedResult,
          metadata
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

    const { text, csvAnalyses } = await request.json();

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

    // CSV analizleri varsa log yaz
    if (csvAnalyses && csvAnalyses.length > 0) {
      console.log(`📊 ${csvAnalyses.length} CSV analizi alındı`);
      csvAnalyses.forEach((csv: any, i: number) => {
        console.log(`   ${i + 1}. ${csv.fileName}: ${csv.analysis.summary.total_items} ürün, ${csv.analysis.summary.total_cost.toLocaleString('tr-TR')} TL`);
      });
    }

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

      // Streaming mode için cache hit response
      if (streamMode) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            // Progress başlangıç
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(createProgressEvent(ANALYSIS_STAGES.STARTING))}\n\n`));

            // Cache'den geliyor mesajı
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              stage: '💾 Cache\'den yükleniyor...',
              progress: 50,
              details: `${Math.round(cacheAge / 1000 / 60)} dakika önce analiz edildi`,
              timestamp: Date.now()
            })}\n\n`));

            // Tamamlandı
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              result: cachedResult.data,
              metadata: {
                ...cachedResult.metadata,
                cached: true,
                cache_age_ms: cacheAge,
                cache_hit: true,
              }
            })}\n\n`));

            controller.close();
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

      // Non-streaming mode için JSON response
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
      const response = await createStreamingResponse(text, csvAnalyses, startTime, textHash);
      return response;
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

      // 📊 CSV TABLOLARINI ENTEGRE ET
      if (csvAnalyses && csvAnalyses.length > 0) {
        console.log("\n📊 CSV → TABLO ENTEGRASYONu başlıyor...");
        const csvTables = convertCSVToTables(csvAnalyses);

        // CSV tablolarını mevcut tablolarla birleştir
        if (!rawExtractedData.tablolar) {
          rawExtractedData.tablolar = [];
        }

        const totalBeforeCSV = rawExtractedData.tablolar.length;
        rawExtractedData.tablolar.push(...csvTables);

        console.log(`✅ ${csvTables.length} CSV tablosu eklendi (Toplam: ${totalBeforeCSV} PDF + ${csvTables.length} CSV = ${rawExtractedData.tablolar.length} tablo)`);
      }
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

    // Calculate overall confidence score (NaN korumalı)
    console.log('🔍 [NON-STREAMING CONFIDENCE DEBUG] extractedData.guven_skoru:', extractedData.guven_skoru);
    console.log('🔍 [NON-STREAMING CONFIDENCE DEBUG] Type:', typeof extractedData.guven_skoru);
    
    const baseConfidence = typeof extractedData.guven_skoru === 'number' && !isNaN(extractedData.guven_skoru)
      ? extractedData.guven_skoru
      : 0.7; // Varsayılan güven skoru
    
    console.log('🔍 [NON-STREAMING CONFIDENCE DEBUG] baseConfidence:', baseConfidence);
    
    // ✅ FIX: AI güven skoru döndürmediyse, extracted_data'ya yaz (UI için)
    if (!extractedData.guven_skoru || isNaN(extractedData.guven_skoru)) {
      extractedData.guven_skoru = baseConfidence;
      console.warn('⚠️ [NON-STREAMING] Güven skoru AI tarafından döndürülmedi, varsayılan 0.7 kullanıldı');
      console.log('🔍 [NON-STREAMING CONFIDENCE DEBUG] After fix:', extractedData.guven_skoru);
    }
    
    const overallConfidence = Math.min(
      baseConfidence,
      // Weight contextual analysis based on data quality
      extractedData.kisi_sayisi && extractedData.tahmini_butce ? 0.95 : 0.8
    );
    
    console.log('🔍 [NON-STREAMING CONFIDENCE DEBUG] overallConfidence:', overallConfidence);

    const result: AIAnalysisResult = {
      extracted_data: {
        ...extractedData,
        guven_skoru: baseConfidence, // ✅ FIX: Force valid value for UI
      },
      contextual_analysis: contextualAnalysis,
      processing_metadata: {
        processing_time: totalProcessingTime,
        ai_provider: `${extraction.type} (extraction) + ${strategic.type} (strategic)`,
        confidence_score: overallConfidence,
      },
      validation_warnings: validationResult.warnings.length > 0 ? validationResult.warnings : undefined,
      csv_analyses: csvAnalyses, // CSV analizlerini ekle
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
