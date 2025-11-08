import { AnalysisStore, updateAnalysis, getAnalysis } from "./records";
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
    await performOCR(analysisId, analysis.storagePath);
    
    // Step 2: Document Parsing (40-60%)
    await parseDocument(analysisId, analysis.storagePath);
    
    // Step 3: AI Analysis (60-95%)
    await performAIAnalysis(analysisId, analysis.storagePath);
    
    // Step 4: Finalize (95-100%)
    updateAnalysis(analysisId, { progress: 95 });
    await sleep(300);
    
    const duration = Date.now() - startTime;
    updateAnalysis(analysisId, { 
      progress: 100, 
      status: "completed", 
      result: { 
        text: "Analysis completed successfully",
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

// TODO: Replace with real Tesseract OCR
async function performOCR(analysisId: string, filePath: string) {
  console.log(`  🔍 OCR: Extracting text...`);
  updateAnalysis(analysisId, { progress: 10 });
  await sleep(800);
  updateAnalysis(analysisId, { progress: 25 });
  await sleep(600);
  updateAnalysis(analysisId, { progress: 40 });
  // Future: const text = await extractTextWithTesseract(filePath);
}

// TODO: Replace with real document parser
async function parseDocument(analysisId: string, filePath: string) {
  console.log(`  📋 Parsing: Analyzing structure...`);
  updateAnalysis(analysisId, { progress: 45 });
  await sleep(500);
  updateAnalysis(analysisId, { progress: 55 });
  await sleep(400);
  updateAnalysis(analysisId, { progress: 60 });
  // Future: const parsed = await parseDocumentStructure(text);
}

// TODO: Replace with real Claude AI analysis
async function performAIAnalysis(analysisId: string, filePath: string) {
  console.log(`  🤖 AI: Analyzing content...`);
  
  // Simulate streaming progress
  for (let p = 65; p <= 90; p += 5) {
    updateAnalysis(analysisId, { progress: p });
    await sleep(400);
  }
  
  // Future: 
  // const aiResult = await analyzeWithClaude({
  //   text: extractedText,
  //   documentType: parsed.type,
  //   extractionPrompt: getExtractionPrompt()
  // });
}
