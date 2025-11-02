import { ClaudeProvider } from "./claude-provider";
import { GeminiExtractionProvider } from "./gemini-extraction-provider";

/**
 * AI Provider Selection Strategy
 *
 * Automatically selects the best AI provider based on:
 * - Document size (Gemini better for large docs with 1M context)
 * - File type (Gemini has native PDF vision)
 * - Required features (web search, multimodal, etc.)
 * - Cost optimization (Gemini 96% cheaper)
 * - Quality requirements (Claude better for strategic analysis)
 */

export type ProviderType = "gemini" | "claude";

export interface ProviderContext {
  textLength?: number;
  fileType?: string;
  requiresWebSearch?: boolean;
  requiresMultimodal?: boolean;
  budget?: "economy" | "balanced" | "premium";
  analysisType?: "extraction" | "strategic" | "both";
}

export class AIProviderFactory {
  /**
   * Select the optimal AI provider based on context
   */
  static selectProvider(context: ProviderContext): {
    provider: ClaudeProvider | GeminiExtractionProvider;
    type: ProviderType;
    reason: string;
  } {
    // Force Claude for strategic analysis (superior reasoning)
    if (context.analysisType === "strategic") {
      return {
        provider: new ClaudeProvider(),
        type: "claude",
        reason: "Strategic analysis requires Claude's superior reasoning",
      };
    }

    // Force Gemini for web search (unique capability)
    if (context.requiresWebSearch) {
      return {
        provider: new GeminiExtractionProvider(),
        type: "gemini",
        reason: "Web search capability only available in Gemini",
      };
    }

    // Force Gemini for multimodal (PDF vision, images)
    if (context.requiresMultimodal) {
      return {
        provider: new GeminiExtractionProvider(),
        type: "gemini",
        reason: "Multimodal processing (PDF vision) only in Gemini",
      };
    }

    // Large documents: Gemini's 1M context window is perfect
    if (context.textLength && context.textLength > 50000) {
      return {
        provider: new GeminiExtractionProvider(),
        type: "gemini",
        reason: `Large document (${context.textLength} chars) - Gemini's 1M context handles without chunking`,
      };
    }

    // PDF files: Use Gemini's native PDF vision
    if (context.fileType === "application/pdf") {
      return {
        provider: new GeminiExtractionProvider(),
        type: "gemini",
        reason: "PDF file - Gemini's vision API can process directly",
      };
    }

    // Premium quality requirement: Use Claude
    if (context.budget === "premium") {
      return {
        provider: new ClaudeProvider(),
        type: "claude",
        reason: "Premium quality requested - Claude has superior Turkish understanding",
      };
    }

    // Economy budget: Use Gemini (96% cheaper)
    if (context.budget === "economy") {
      return {
        provider: new GeminiExtractionProvider(),
        type: "gemini",
        reason: "Economy mode - Gemini is 96% cheaper than Claude",
      };
    }

    // Default for extraction: Gemini (faster + cheaper)
    // Use Claude only for final strategic analysis
    return {
      provider: new GeminiExtractionProvider(),
      type: "gemini",
      reason: "Default extraction - Gemini is faster and more cost-effective",
    };
  }

  /**
   * Get extraction provider (usually Gemini)
   */
  static getExtractionProvider(context: ProviderContext): {
    provider: ClaudeProvider | GeminiExtractionProvider;
    type: ProviderType;
    reason: string;
  } {
    return this.selectProvider({
      ...context,
      analysisType: "extraction",
    });
  }

  /**
   * Get strategic analysis provider (usually Claude)
   */
  static getStrategicProvider(): {
    provider: ClaudeProvider;
    type: ProviderType;
    reason: string;
  } {
    return {
      provider: new ClaudeProvider(),
      type: "claude",
      reason: "Strategic analysis - Claude has superior reasoning and Turkish language understanding",
    };
  }

  /**
   * Hybrid approach: Gemini for extraction, Claude for strategic
   * This is the recommended approach for most use cases
   */
  static getHybridProviders(context: ProviderContext): {
    extraction: {
      provider: ClaudeProvider | GeminiExtractionProvider;
      type: ProviderType;
      reason: string;
    };
    strategic: {
      provider: ClaudeProvider;
      type: ProviderType;
      reason: string;
    };
  } {
    return {
      extraction: this.getExtractionProvider(context),
      strategic: this.getStrategicProvider(),
    };
  }

  /**
   * Create fallback chain: Try primary, fall back to secondary
   */
  static async executeWithFallback<T>(
    primaryProvider: ClaudeProvider | GeminiExtractionProvider,
    secondaryProvider: ClaudeProvider | GeminiExtractionProvider,
    operation: (provider: any) => Promise<T>
  ): Promise<T> {
    try {
      console.log("Trying primary provider...");
      return await operation(primaryProvider);
    } catch (error) {
      console.warn("Primary provider failed, falling back to secondary...");
      console.error("Primary error:", error);
      return await operation(secondaryProvider);
    }
  }

  /**
   * Parallel execution with confidence-based selection
   * Runs both providers and picks best result based on confidence score
   */
  static async executeWithConfidenceSelection(
    text: string
  ): Promise<{
    result: any;
    provider: ProviderType;
    confidence: number;
  }> {
    console.log("=== PARALLEL EXECUTION WITH CONFIDENCE SELECTION ===");

    const gemini = new GeminiExtractionProvider();
    const claude = new ClaudeProvider();

    // Run both in parallel
    const [geminiResult, claudeResult] = await Promise.all([
      gemini.extractStructuredData(text).catch((e) => {
        console.error("Gemini failed:", e);
        return null;
      }),
      claude.extractStructuredData(text).catch((e) => {
        console.error("Claude failed:", e);
        return null;
      }),
    ]);

    // If one failed, return the other
    if (!geminiResult && claudeResult) {
      return {
        result: claudeResult,
        provider: "claude",
        confidence: claudeResult.guven_skoru || 0,
      };
    }

    if (geminiResult && !claudeResult) {
      return {
        result: geminiResult,
        provider: "gemini",
        confidence: geminiResult.guven_skoru || 0,
      };
    }

    // Both failed
    if (!geminiResult && !claudeResult) {
      throw new Error("Both providers failed");
    }

    // Both succeeded - pick based on confidence
    const geminiConfidence = geminiResult!.guven_skoru || 0;
    const claudeConfidence = claudeResult!.guven_skoru || 0;

    console.log(`Gemini confidence: ${geminiConfidence}`);
    console.log(`Claude confidence: ${claudeConfidence}`);

    if (geminiConfidence >= claudeConfidence) {
      console.log("Selected Gemini result (higher confidence)");
      return {
        result: geminiResult,
        provider: "gemini",
        confidence: geminiConfidence,
      };
    } else {
      console.log("Selected Claude result (higher confidence)");
      return {
        result: claudeResult,
        provider: "claude",
        confidence: claudeConfidence,
      };
    }
  }
}
