import Anthropic from "@anthropic-ai/sdk";

/**
 * 🌊 STREAMING CLAUDE PROVIDER
 *
 * Real-time streaming responses from Claude API
 * - UI'da anlık text görünür (kullanıcı beklemez)
 * - Progress feedback daha iyi
 * - Perceived performance artışı
 *
 * KULLANIM:
 * ```typescript
 * const provider = new StreamingClaudeProvider();
 *
 * await provider.extractWithStreaming(text, (chunk) => {
 *   console.log('📝 Streaming chunk:', chunk);
 *   // UI'da göster
 *   setStreamingText(prev => prev + chunk);
 * });
 * ```
 */

export interface StreamingCallbacks {
  onStart?: () => void;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export class StreamingClaudeProvider {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || "";
    this.model = process.env.DEFAULT_AI_MODEL || "claude-sonnet-4-20250514";

    if (!this.apiKey) {
      throw new Error("ANTHROPIC_API_KEY is missing");
    }

    console.log("=== STREAMING CLAUDE PROVIDER INIT ===");
    console.log("Model:", this.model);
  }

  /**
   * 🌊 Streaming extraction - Real-time UI feedback
   */
  async extractWithStreaming(
    text: string,
    prompt: string,
    callbacks: StreamingCallbacks
  ): Promise<string> {
    console.log("=== STREAMING EXTRACTION BAŞLADI ===");
    console.log("Text length:", text.length);

    const anthropic = new Anthropic({ apiKey: this.apiKey });
    let fullText = "";

    try {
      callbacks.onStart?.();

      const stream = await anthropic.messages.stream({
        model: this.model,
        max_tokens: 16000,
        temperature: 0.5,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\n${text}`,
          },
        ],
      });

      // Stream'i dinle
      for await (const messageStreamEvent of stream) {
        if (
          messageStreamEvent.type === "content_block_delta" &&
          messageStreamEvent.delta.type === "text_delta"
        ) {
          const chunk = messageStreamEvent.delta.text;
          fullText += chunk;

          // Callback'i tetikle (UI güncellenir)
          callbacks.onChunk?.(chunk);
        }
      }

      // Final message
      const finalMessage = await stream.finalMessage();

      // Token usage log
      if (finalMessage.usage) {
        console.log("📊 Streaming Token Kullanımı:");
        console.log(`   Input: ${finalMessage.usage.input_tokens.toLocaleString()} tokens`);
        console.log(`   Output: ${finalMessage.usage.output_tokens.toLocaleString()} tokens`);
      }

      callbacks.onComplete?.(fullText);
      console.log("✅ Streaming extraction tamamlandı");

      return fullText;
    } catch (error: any) {
      console.error("❌ Streaming extraction error:", error.message);
      callbacks.onError?.(error);
      throw error;
    }
  }

  /**
   * 🌊 Streaming ile contextual analysis
   */
  async analyzeContextWithStreaming(
    extractedData: any,
    callbacks: StreamingCallbacks
  ): Promise<any> {
    const prompt = this.buildContextPrompt(extractedData);
    const fullText = await this.extractWithStreaming(
      JSON.stringify(extractedData),
      prompt,
      callbacks
    );

    // Parse JSON
    try {
      let cleaned = fullText.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json\s*/, "").replace(/```\s*$/, "");
      }

      return JSON.parse(cleaned);
    } catch (error) {
      console.error("JSON parse error:", error);
      throw error;
    }
  }

  private buildContextPrompt(extractedData: any): string {
    return `Sen bir kamu ihalesi uzmanısın. Aşağıdaki çıkarılmış verilerden bağlamsal analiz yap.

GÖREV:
1. Operasyonel riskleri belirle
2. Fırsat ve zorlukları analiz et
3. Öneriler sun

SADECE JSON formatında cevap ver:
{
  "operasyonel_riskler": {
    "seviye": "dusuk" | "orta" | "yuksek",
    "liste": ["risk 1", "risk 2"]
  },
  "firsatlar": ["fırsat 1", "fırsat 2"],
  "zorluklar": ["zorluk 1", "zorluk 2"],
  "oneriler": ["öneri 1", "öneri 2"]
}`;
  }
}

/**
 * 🎯 ÖRNEK KULLANIM:
 *
 * const provider = new StreamingClaudeProvider();
 * const [streamingText, setStreamingText] = useState('');
 *
 * await provider.extractWithStreaming(text, prompt, {
 *   onStart: () => {
 *     console.log('🌊 Streaming başladı...');
 *     setStreamingText('');
 *   },
 *   onChunk: (chunk) => {
 *     setStreamingText(prev => prev + chunk);
 *   },
 *   onComplete: (fullText) => {
 *     console.log('✅ Streaming tamamlandı:', fullText.length);
 *   },
 *   onError: (error) => {
 *     console.error('❌ Streaming error:', error);
 *   }
 * });
 */
