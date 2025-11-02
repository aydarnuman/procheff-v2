import { ClaudeProvider } from "./claude-provider";
import { TextExtractionProvider } from "./text-extraction-provider";

/**
 * 🤖 MULTI-MODEL ENSEMBLE PROVIDER
 *
 * Birden fazla AI modelini paralel çalıştırıp en iyi sonucu seç
 * - Claude Sonnet 4 (yüksek kalite)
 * - Claude Haiku 4.5 (hızlı, ucuz)
 * - Gemini 2.0 Flash (alternatif)
 *
 * STRATEJ İ:
 * 1. Tüm modelleri paralel çalıştır
 * 2. Güven skorlarını karşılaştır
 * 3. En yüksek güveni seç
 * 4. Consensus (çoğunluk) kontrolü yap
 *
 * KULLANIM:
 * ```typescript
 * const ensemble = new EnsembleProvider();
 * const result = await ensemble.extractWithEnsemble(text);
 * // result: En güvenilir model sonucu
 * ```
 */

export interface ModelResult {
  model: string;
  result: any;
  confidence: number;
  processingTime: number;
  cost: number;
}

export interface EnsembleResult {
  selectedModel: string;
  selectedResult: any;
  allResults: ModelResult[];
  consensusScore: number; // 0-1: Modeller ne kadar hemfikir
  totalCost: number;
  totalTime: number;
}

export class EnsembleProvider {
  private claudeProvider: ClaudeProvider;

  constructor() {
    this.claudeProvider = new ClaudeProvider();
    console.log("=== ENSEMBLE PROVIDER INIT ===");
    console.log("Models: Claude Sonnet 4, Claude Haiku 4.5");
  }

  /**
   * 🤖 Multi-model extraction with ensemble voting
   */
  async extractWithEnsemble(text: string): Promise<EnsembleResult> {
    console.log("\n=== ENSEMBLE EXTRACTION BAŞLADI ===");
    console.log(`Text length: ${text.length} chars`);

    const startTime = Date.now();
    const modelResults: ModelResult[] = [];

    // Paralel model çalıştırma
    const modelPromises = [
      this.runClaudeSonnet(text),
      this.runClaudeHaiku(text),
    ];

    const results = await Promise.allSettled(modelPromises);

    // Başarılı sonuçları topla
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        modelResults.push(result.value);
      } else {
        console.warn(`Model ${index + 1} failed:`, result.reason);
      }
    });

    if (modelResults.length === 0) {
      throw new Error("Tüm modeller başarısız oldu!");
    }

    // En iyi modeli seç (güven skoruna göre)
    const bestResult = this.selectBestResult(modelResults);

    // Consensus skoru hesapla
    const consensusScore = this.calculateConsensus(modelResults);

    const totalTime = Date.now() - startTime;
    const totalCost = modelResults.reduce((sum, r) => sum + r.cost, 0);

    console.log("\n📊 ENSEMBLE SONUÇLARI:");
    console.log(`   Toplam Model: ${modelResults.length}`);
    console.log(`   Seçilen Model: ${bestResult.model}`);
    console.log(`   Güven Skoru: ${(bestResult.confidence * 100).toFixed(1)}%`);
    console.log(`   Consensus: ${(consensusScore * 100).toFixed(1)}%`);
    console.log(`   Toplam Süre: ${totalTime}ms (${Math.round(totalTime / 1000)}s)`);
    console.log(`   Toplam Maliyet: $${totalCost.toFixed(4)}`);

    return {
      selectedModel: bestResult.model,
      selectedResult: bestResult.result,
      allResults: modelResults,
      consensusScore,
      totalCost,
      totalTime,
    };
  }

  /**
   * Run Claude Sonnet 4 (high quality)
   */
  private async runClaudeSonnet(text: string): Promise<ModelResult> {
    console.log("\n🤖 Claude Sonnet 4 başlatılıyor...");
    const start = Date.now();

    try {
      // Sonnet için özel config
      const oldModel = process.env.DEFAULT_AI_MODEL;
      process.env.DEFAULT_AI_MODEL = "claude-sonnet-4-20250514";

      const result = await this.claudeProvider.extractStructuredData(text);

      process.env.DEFAULT_AI_MODEL = oldModel;

      const processingTime = Date.now() - start;
      const estimatedCost = this.estimateCost(text.length, "sonnet");

      console.log(`✅ Sonnet 4: ${processingTime}ms, confidence: ${(result.guven_skoru * 100).toFixed(1)}%`);

      return {
        model: "claude-sonnet-4",
        result,
        confidence: result.guven_skoru || 0.5,
        processingTime,
        cost: estimatedCost,
      };
    } catch (error: any) {
      console.error("❌ Sonnet 4 failed:", error.message);
      throw error;
    }
  }

  /**
   * Run Claude Haiku 4.5 (fast & cheap)
   */
  private async runClaudeHaiku(text: string): Promise<ModelResult> {
    console.log("\n🤖 Claude Haiku 4.5 başlatılıyor...");
    const start = Date.now();

    try {
      // Haiku için özel config
      const oldModel = process.env.DEFAULT_AI_MODEL;
      process.env.DEFAULT_AI_MODEL = "claude-haiku-4-5-20251001";

      const result = await this.claudeProvider.extractStructuredData(text);

      process.env.DEFAULT_AI_MODEL = oldModel;

      const processingTime = Date.now() - start;
      const estimatedCost = this.estimateCost(text.length, "haiku");

      console.log(`✅ Haiku 4.5: ${processingTime}ms, confidence: ${(result.guven_skoru * 100).toFixed(1)}%`);

      return {
        model: "claude-haiku-4.5",
        result,
        confidence: result.guven_skoru || 0.5,
        processingTime,
        cost: estimatedCost,
      };
    } catch (error: any) {
      console.error("❌ Haiku 4.5 failed:", error.message);
      throw error;
    }
  }

  /**
   * Select best result based on confidence
   */
  private selectBestResult(results: ModelResult[]): ModelResult {
    // Güven skoruna göre sırala
    const sorted = [...results].sort((a, b) => b.confidence - a.confidence);

    // En yüksek güveni seç
    return sorted[0];
  }

  /**
   * Calculate consensus score (modeller ne kadar hemfikir?)
   */
  private calculateConsensus(results: ModelResult[]): number {
    if (results.length < 2) return 1.0; // Tek model varsa %100 consensus

    // Basit consensus: Güven skorlarının standart sapmasına bak
    const confidences = results.map(r => r.confidence);
    const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const variance = confidences.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / confidences.length;
    const stdDev = Math.sqrt(variance);

    // Düşük standart sapma = yüksek consensus
    // stdDev 0.0 = perfect consensus (1.0)
    // stdDev 0.5 = low consensus (0.0)
    const consensus = Math.max(0, 1 - (stdDev * 2));

    return consensus;
  }

  /**
   * Estimate cost based on text length and model
   */
  private estimateCost(textLength: number, model: "sonnet" | "haiku"): number {
    const estimatedTokens = Math.ceil(textLength / 4); // ~4 chars = 1 token

    if (model === "sonnet") {
      // Sonnet: $3 per 1M input tokens, $15 per 1M output
      return (estimatedTokens * 3 + 8000 * 15) / 1_000_000;
    } else {
      // Haiku: $1 per 1M input tokens, $5 per 1M output
      return (estimatedTokens * 1 + 8000 * 5) / 1_000_000;
    }
  }
}

/**
 * 🎯 KULLANIM ÖRNEĞİ:
 *
 * const ensemble = new EnsembleProvider();
 *
 * const result = await ensemble.extractWithEnsemble(text);
 *
 * console.log('Seçilen Model:', result.selectedModel);
 * console.log('Güven Skoru:', result.selectedResult.guven_skoru);
 * console.log('Consensus:', result.consensusScore);
 *
 * // Tüm model sonuçlarını karşılaştır
 * result.allResults.forEach(r => {
 *   console.log(`${r.model}: ${r.confidence} (${r.processingTime}ms)`);
 * });
 */
