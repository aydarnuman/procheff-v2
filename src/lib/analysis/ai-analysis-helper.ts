/**
 * AI Analysis helper
 * Uses existing Claude provider for document analysis
 */

import { ClaudeProvider } from "@/lib/ai/claude-provider";

export interface AIAnalysisResult {
  summary: string;
  keyPoints: string[];
  entities: {
    institution?: string;
    budget?: number;
    deadline?: string;
    people?: number;
    meals?: number;
    days?: number;
  };
  confidence: number;
}

/**
 * Analyze document text with AI
 * @param text Extracted document text
 * @param filename Original filename for context
 * @returns AI analysis result
 */
export async function analyzeWithAI(
  text: string,
  filename: string
): Promise<AIAnalysisResult> {
  
  console.log(`    🤖 AI Analysis: ${filename} (${text.length} chars)`);
  
  try {
    const provider = new ClaudeProvider();
    
    // Use existing extractStructuredData method
    const extracted = await provider.extractStructuredData(text);
    
    // Map to our result format
    return {
      summary: `İhale: ${extracted.kurum || 'Bilinmeyen'} - ${extracted.ihale_turu || 'Catering'}`,
      keyPoints: [
        `Bütçe: ${extracted.tahmini_butce ? `₺${extracted.tahmini_butce.toLocaleString('tr-TR')}` : 'Belirtilmemiş'}`,
        `Kişi: ${extracted.kisi_sayisi || 'N/A'}`,
        `Öğün: ${extracted.ogun_sayisi || 'N/A'}`,
        `Gün: ${extracted.gun_sayisi || 'N/A'}`,
      ].filter(k => k),
      entities: {
        institution: extracted.kurum,
        budget: extracted.tahmini_butce ?? undefined,
        deadline: extracted.teklif_son_tarih ?? undefined,
        people: extracted.kisi_sayisi ?? undefined,
        meals: extracted.ogun_sayisi ?? undefined,
        days: extracted.gun_sayisi ?? undefined,
      },
      confidence: 0.7, // Default confidence
    };

  } catch (error) {
    console.error("    ❌ AI analysis error:", error);
    
    // Return minimal result on error
    return {
      summary: "Analysis failed",
      keyPoints: [],
      entities: {},
      confidence: 0.0,
    };
  }
}
