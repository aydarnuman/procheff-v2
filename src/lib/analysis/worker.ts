import { AnalysisStore, updateAnalysis, getAnalysis } from "./records";
import { extractText } from "./extraction-helpers";
import { analyzeWithAI } from "./ai-analysis-helper";
import fs from "fs";

function sleep(ms = 500) {
  return new Promise((res) => setTimeout(res, ms));
}

let running = false;
let processedCount = 0;

export async function startWorkerLoop({ interval = 1500 } = {}) {
  if (running) {
    console.log("⚠️ Worker already running");
    return;
  }
  
  running = true;
  console.log("🚀 Worker loop started (interval: ${interval}ms)");
  
  while (running) {
    try {
      const next = Array.from(AnalysisStore.values()).find(
        (r) => r.status === "queued" || r.status === "created"
      );
      
      if (!next) {
        await sleep(interval);
        continue;
      }
      
      console.log(`🔄 Processing: ${next.analysisId} | ${next.filename}`);
      await processAnalysis(next.analysisId);
      processedCount++;
      console.log(`✅ Completed: ${next.analysisId} (total: ${processedCount})`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("❌ Worker loop error:", errorMsg);
      await sleep(1000);
    }
  }
  
  console.log("🛑 Worker loop stopped");
}

export function stopWorkerLoop() {
  if (!running) {
    console.log("⚠️ Worker not running");
    return;
  }
  running = false;
  console.log(`🛑 Worker stopping... (processed: ${processedCount} analyses)`);
}

export function getWorkerStats() {
  return {
    running,
    processedCount,
    queueSize: Array.from(AnalysisStore.values()).filter(r => r.status === "queued").length,
  };
}

async function processAnalysis(analysisId: string) {
  const startTime = Date.now();
  
  try {
    const analysis = getAnalysis(analysisId);
    if (!analysis) {
      console.log(`❌ Analysis ${analysisId} not found in store`);
      return;
    }

    // Verify file exists
    if (!analysis.storagePath || !fs.existsSync(analysis.storagePath)) {
      updateAnalysis(analysisId, { 
        status: "failed", 
        error: "File not found at storage path",
        progress: 0 
      });
      return;
    }

    updateAnalysis(analysisId, { status: "processing", progress: 5 });
    console.log(`  📄 File: ${analysis.filename} (${(analysis.size / 1024).toFixed(1)}KB)`);

    // Step 1: OCR/Text Extraction (10-40%)
    const extractedText = await performOCR(analysisId, analysis.storagePath);
    
    // Step 2: Document Parsing (40-60%)
    await parseDocument(analysisId, extractedText);
    
    // Step 3: AI Analysis (60-95%)
    const aiResult = await performAIAnalysis(analysisId, extractedText, analysis.filename);
    
    // Step 4: Finalize (95-100%)
    updateAnalysis(analysisId, { progress: 95 });
    await sleep(300);
    
    const duration = Date.now() - startTime;
    updateAnalysis(analysisId, { 
      progress: 100, 
      status: "completed", 
      result: {
        ...aiResult,
        text: extractedText.substring(0, 500), // First 500 chars
        duration,
        processedAt: new Date().toISOString()
      } 
    });
    
    console.log(`  ⏱️ Duration: ${(duration / 1000).toFixed(1)}s`);
    
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ Processing failed (${duration}ms):`, errorMsg);
    
    updateAnalysis(analysisId, { 
      status: "failed", 
      error: errorMsg,
      progress: 0 
    });
  }
}

// Extract text using real OCR/parsers
async function performOCR(analysisId: string, filePath: string): Promise<string> {
  console.log(`  🔍 OCR: Extracting text...`);
  updateAnalysis(analysisId, { progress: 10 });
  
  try {
    const analysis = getAnalysis(analysisId);
    if (!analysis) throw new Error("Analysis not found");
    
    const result = await extractText(filePath, analysis.filename);
    
    updateAnalysis(analysisId, { progress: 40 });
    console.log(`    ✅ Extracted: ${result.wordCount} words via ${result.method}`);
    
    return result.text;
  } catch (error) {
    console.error(`    ❌ OCR failed:`, error);
    throw error;
  }
}

// Parse document structure (basic for now)
async function parseDocument(analysisId: string, text: string) {
  console.log(`  📋 Parsing: Analyzing structure...`);
  updateAnalysis(analysisId, { progress: 45 });
  
  // Basic structure analysis
  const sections = text.split(/\n\n+/).length;
  const hasNumbers = /\d+/.test(text);
  const hasDates = /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(text);
  
  updateAnalysis(analysisId, { progress: 55 });
  console.log(`    📊 Structure: ${sections} sections, numbers: ${hasNumbers}, dates: ${hasDates}`);
  
  await sleep(300);
  updateAnalysis(analysisId, { progress: 60 });
}

// Perform real AI analysis with Claude
async function performAIAnalysis(analysisId: string, text: string, filename: string): Promise<any> {
  console.log(`  🤖 AI: Analyzing content...`);
  updateAnalysis(analysisId, { progress: 65 });
  
  try {
    const aiResult = await analyzeWithAI(text, filename);
    
    updateAnalysis(analysisId, { progress: 75 });
    console.log(`    🎯 AI Result: ${aiResult.summary.substring(0, 50)}...`);
    console.log(`    📊 Confidence: ${(aiResult.confidence * 100).toFixed(0)}%`);
    
    updateAnalysis(analysisId, { progress: 85 });
    await sleep(500);
    updateAnalysis(analysisId, { progress: 90 });
    
    return aiResult;
  } catch (error) {
    console.error(`    ❌ AI analysis failed:`, error);
    // Return minimal result on error
    return {
      summary: "AI analysis failed",
      keyPoints: [],
      entities: {},
      confidence: 0,
    };
  }
}
