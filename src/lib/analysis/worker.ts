import { AnalysisStore, updateAnalysis } from "./records";

function sleep(ms = 500) {
  return new Promise((res) => setTimeout(res, ms));
}

let running = false;

export async function startWorkerLoop({ interval = 1500 } = {}) {
  if (running) return;
  running = true;
  while (running) {
    try {
      const next = Array.from(AnalysisStore.values()).find((r) => r.status === "queued" || r.status === "created");
      if (!next) {
        await sleep(interval);
        continue;
      }
      await processAnalysis(next.analysisId);
    } catch (err) {
      console.error("worker loop err", err);
      await sleep(1000);
    }
  }
}

export function stopWorkerLoop() {
  running = false;
}

async function processAnalysis(analysisId: string) {
  updateAnalysis(analysisId, { status: "processing", progress: 2 });
  // Fake OCR step
  updateAnalysis(analysisId, { progress: 10 });
  await sleep(800);
  updateAnalysis(analysisId, { progress: 30 });
  // Fake parse
  await sleep(600);
  updateAnalysis(analysisId, { progress: 45 });
  // Fake AI step (stream)
  for (let p = 50; p <= 95; p += 15) {
    updateAnalysis(analysisId, { progress: p });
    await sleep(400);
  }
  // finalize
  updateAnalysis(analysisId, { progress: 100, status: "completed", result: { text: "fake-analysis-result" } });
}
