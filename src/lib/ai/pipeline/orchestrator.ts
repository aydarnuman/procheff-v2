// AI Pipeline: Orchestrator
import { ServerAnalysisCache } from "./stage-cache";
import { validateExtraction } from "./stage-validation";
import { validateCSVAnalysis } from "./stage-csv";
import { runContextualAnalysis } from "./stage-context";
import { processFinancialData } from "./stage-financial";

export class AIPipeline {
  async run(text: string, csvAnalyses: any[], strategic: any) {
    // 1. Hash & Cache
    const textHash = ServerAnalysisCache.generateHash(text);
    let cached = ServerAnalysisCache.get(textHash);
    if (cached) return cached;

    // 2. Extraction
    let rawExtractedData = await strategic.extraction(text);
    rawExtractedData = validateExtraction(rawExtractedData);

    // 3. CSV Validation
    const validCSVs = validateCSVAnalysis(csvAnalyses);

    // 4. Financial
    const financialData = processFinancialData(validCSVs);

    // 5. Contextual Analysis
    const contextualAnalysis = await runContextualAnalysis(strategic, rawExtractedData);

    // 6. Cache & Return
    const result = {
      extracted: rawExtractedData,
      financial: financialData,
      context: contextualAnalysis,
    };
    ServerAnalysisCache.set(textHash, result);
    return result;
  }
}
